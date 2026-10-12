import type { DocumentV3, Node } from './types';
import { validateDocumentV3, effectiveStyle, designPolicyV3 } from './validate';
import { reject, jsonBytes } from './schema';
import { assertEditable, assertFlow, cloneDocument, containerChildren, indexTree, location, selectionRoots, type Location } from './tree';
import { copyTree, freshId, materializeClipboard, type NewId, type TreeClipboard } from './clipboard';

export interface Destination { parentId: string | null; index: number }
export type TreeCommand =
  | { kind: 'insert'; destination: Destination; nodes: Node[] }
  | { kind: 'move'; ids: string[]; destination: Destination }
  | { kind: 'delete' | 'duplicate' | 'group' | 'ungroup'; ids: string[] }
  | { kind: 'paste'; clipboard: TreeClipboard; destination: Destination }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'lock'; ids: string[]; locked: boolean }
  | { kind: 'hide'; ids: string[]; hidden: boolean };
export interface TreeResult { document: DocumentV3; selection: string[]; changed: boolean }

function destination(document: DocumentV3, target: Destination): Node[] {
  const children = containerChildren(document, target.parentId);
  if (!Number.isInteger(target.index) || target.index < 0 || target.index > children.length) reject('destination_index', '$');
  return children;
}
function detach(items: Location[]): void {
  // Locate by identity after each removal, not by stale array indices.
  for (const item of items) item.siblings.splice(item.siblings.indexOf(item.node), 1);
}
function siblings(items: Location[]): void {
  if (items.some(item => item.siblings !== items[0].siblings)) reject('mixed_parents', '$');
}
function groupContext(parent: Node | undefined): void {
  if (parent && (['base', 'tablet', 'mobile'] as const).some(viewport => {
    const style = effectiveStyle(parent, viewport);
    return (style.display ?? 'block') !== 'block';
  })) reject('group_layout_requires_measurement', parent.instance_id);
}
/** Pure immutable transaction. UI/vendor adapters own session freshness and history. */
export function executeTreeCommand(source: DocumentV3, command: TreeCommand, nextId: NewId): TreeResult {
  validateDocumentV3(source);
  const document = cloneDocument(source);
  const tree = indexTree(document);
  let selected: string[] = [];
  if (command.kind === 'insert' || command.kind === 'paste') {
    const target = destination(document, command.destination);
    if (command.kind === 'insert' && jsonBytes(command.nodes, designPolicyV3.limits.json_depth) > designPolicyV3.limits.utf8_bytes) reject('byte_limit', '$');
    const nodes = command.kind === 'paste' ? materializeClipboard(document, command.clipboard, nextId)
      : JSON.parse(JSON.stringify(command.nodes)) as Node[];
    if (!nodes.length) reject('empty_selection', '$');
    if (command.kind === 'paste') nodes.forEach(assertFlow);
    target.splice(command.destination.index, 0, ...nodes);
    selected = nodes.map(node => node.instance_id);
  } else if (command.kind === 'rename') {
    const item = location(tree, command.id);
    assertEditable(item);
    item.node.name = command.name;
    selected = [command.id];
  } else {
    const items = selectionRoots(tree, command.ids);
    selected = items.map(item => item.node.instance_id);
    items.forEach(item => assertEditable(item,
      command.kind !== 'lock', command.kind === 'lock' && !command.locked));
    switch (command.kind) {
      case 'lock': items.forEach(item => { item.node.locked = command.locked; }); break;
      case 'hide':
        // Base visibility only. Breakpoint overrides remain authored values (IP6).
        items.forEach(item => { item.node.style.hidden = command.hidden; }); break;
      case 'delete': detach(items); selected = []; break;
      case 'duplicate': {
        siblings(items);
        items.forEach(item => assertFlow(item.node));
        const nodes = materializeClipboard(document, copyTree(source, selected), nextId);
        items[0].siblings.splice(items.at(-1)!.index + 1, 0, ...nodes);
        selected = nodes.map(node => node.instance_id);
        break;
      }
      case 'move': {
        const target = destination(document, command.destination);
        if (command.destination.parentId !== null) {
          const parent = location(tree, command.destination.parentId);
          if ([parent.node, ...parent.ancestors].some(node => selected.includes(node.instance_id))) reject('parent_cycle', '$');
        }
        items.forEach(item => {
          if ((item.parent?.instance_id ?? null) !== command.destination.parentId) assertFlow(item.node);
        });
        const index = command.destination.index - items.filter(item => item.siblings === target && item.index < command.destination.index).length;
        detach(items);
        target.splice(index, 0, ...items.map(item => item.node));
        break;
      }
      case 'group': {
        siblings(items);
        groupContext(items[0].parent);
        if (items.some((item, index) => item.index !== items[0].index + index)) reject('non_contiguous_selection', '$');
        items.forEach(item => assertFlow(item.node));
        const id = freshId(new Set(tree.keys()), nextId);
        const group: Node = { instance_id: id, type: 'layout.container', block_version: 1,
          name: '그룹', locked: false, props: { tag: 'div' }, slots: { content: items.map(item => item.node) }, style: {}, responsive: {} };
        items[0].siblings.splice(items[0].index, items.length, group);
        selected = [id];
        break;
      }
      case 'ungroup': {
        selected = [];
        for (const item of items) {
          const node = item.node;
          // Removing a styled/semantic wrapper is not a structure-only operation.
          if (node.type !== 'layout.container' || node.props.tag !== 'div'
            || Object.keys(node.style).length || Object.values(node.responsive).some(style => Object.keys(style).length)) reject('non_neutral_group', node.instance_id);
          groupContext(item.parent);
          const children = node.slots.content ?? [];
          children.forEach(assertFlow);
          item.siblings.splice(item.siblings.indexOf(node), 1, ...children);
          selected.push(...children.map(child => child.instance_id));
        }
        break;
      }
    }
  }
  validateDocumentV3(document);
  const changed = JSON.stringify(document) !== JSON.stringify(source);
  return { document: changed ? document : source, selection: selected, changed };
}
