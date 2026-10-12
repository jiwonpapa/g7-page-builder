import type { Content, Data, PuckAction, Slot } from '@puckeditor/core';
import type { DocumentV3, Node } from '../../documents/v3/types';
import { validateDocumentV3, designPolicyV3 } from '../../documents/v3/validate';
import { jsonBytes, record, reject } from '../../documents/v3/schema';
import { cloneDocument, indexTree, location } from '../../documents/v3/tree';
import { executeTreeCommand, type TreeCommand } from '../../documents/v3/commands';

export interface NodeProps { node: Omit<Node, 'slots' | 'instance_id'>; content: Slot; slotPresent: boolean }
export type V3Components = { Node: NodeProps };
export type V3Root = { metadata: Omit<DocumentV3, 'blocks'>; title?: string };
export type V3Data = Data<V3Components, V3Root>;

export function documentToPuck(source: DocumentV3): V3Data {
  const document = cloneDocument(validateDocumentV3(source));
  const { blocks, ...metadata } = document;
  function encode(nodes: Node[]): Content<V3Components> {
    return nodes.map(({ instance_id, slots, ...node }) => ({ type: 'Node', props: {
      id: instance_id, node, slotPresent: Object.hasOwn(slots, 'content'), content: encode(slots.content ?? []),
    } }));
  }
  return { root: { props: { metadata } }, content: encode(blocks) };
}
function object(value: unknown): Record<string, unknown> { return record(value) ? value : reject('puck_shape', '$'); }
function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) reject('puck_unknown_field', '$');
}
/** Vendor Data is an untrusted adapter representation, never a save payload. */
export function documentFromPuck(value: unknown): DocumentV3 {
  // Bound traversal before decoding (cycles, accessors and vendor objects are forbidden).
  if (jsonBytes(value, designPolicyV3.limits.json_depth) > 2 * designPolicyV3.limits.utf8_bytes) reject('puck_bytes', '$');
  const data = object(value);
  keys(data, ['root', 'content', 'zones']);
  if (data.zones !== undefined && Object.keys(object(data.zones)).length) reject('puck_legacy_zones', '$');
  const root = object(data.root);
  keys(root, ['props', 'readOnly']);
  const props = object(root.props);
  keys(props, ['metadata', 'id']);
  const metadata = object(props.metadata);
  if (Object.hasOwn(metadata, 'blocks')) reject('puck_duplicate_source', '$');
  function decode(value: unknown, depth: number): unknown[] {
    if (!Array.isArray(value) || depth > designPolicyV3.limits.depth && value.length) reject('puck_content', '$');
    return value.map(item => {
      const entry = object(item);
      keys(entry, ['type', 'props', 'readOnly']);
      if (entry.type !== 'Node') reject('puck_type', '$');
      const properties = object(entry.props);
      keys(properties, ['id', 'node', 'content', 'slotPresent']);
      const node = object(properties.node);
      if (Object.hasOwn(node, 'slots') || Object.hasOwn(node, 'instance_id')) reject('puck_duplicate_source', '$');
      if (typeof properties.slotPresent !== 'boolean') reject('puck_slot', '$');
      const children = decode(properties.content, depth + 1);
      return { ...node, instance_id: properties.id,
        slots: properties.slotPresent || children.length ? { content: children } : {} };
    });
  }
  return cloneDocument(validateDocumentV3({ ...metadata, blocks: decode(data.content, 1) }));
}
function parentOfZone(zone: string): string | null {
  if (zone === 'root:default-zone') return null;
  if (!zone.endsWith(':content')) reject('puck_zone', '$');
  return zone.slice(0, -':content'.length);
}
/** Convert public Puck DnD actions to the same canonical tree command as the layer controls. */
export function puckMoveCommand(document: DocumentV3, action: PuckAction): TreeCommand {
  if (action.type !== 'move' && action.type !== 'reorder') reject('puck_action', '$');
  const sourceParent = parentOfZone(action.type === 'move' ? action.sourceZone : action.destinationZone);
  const targetParent = parentOfZone(action.destinationZone);
  const source = sourceParent === null ? document.blocks : location(indexTree(document), sourceParent).node.slots.content ?? [];
  const node = source[action.sourceIndex] ?? reject('puck_source', '$');
  const index = action.destinationIndex + (sourceParent === targetParent && action.sourceIndex < action.destinationIndex ? 1 : 0);
  return { kind: 'move', ids: [node.instance_id], destination: { parentId: targetParent, index } };
}
export function assessPuckMove(before: DocumentV3, candidate: unknown, action: PuckAction): DocumentV3 {
  const result = executeTreeCommand(before, puckMoveCommand(before, action), () => reject('unexpected_id', '$'));
  const decoded = documentFromPuck(candidate);
  if (!sameDocument(decoded, result.document)) reject('puck_unexpected_change', '$');
  return result.document;
}
export function sameDocument(left: DocumentV3, right: DocumentV3): boolean {
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
    return value;
  }
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}
