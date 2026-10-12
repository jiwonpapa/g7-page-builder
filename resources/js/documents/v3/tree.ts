import type { DocumentV3, Node } from './types';
import { designPolicyV3, effectiveStyle } from './validate';
import { reject } from './schema';

export interface Location {
  node: Node;
  parent: Node | undefined;
  ancestors: Node[];
  siblings: Node[];
  index: number;
}
/** Safe HTML fragment for a stable v3 node UUID (not an array/DOM selector). */
export function nodeAnchor(id: string): string { return `node-${id}`; }
/** Callers validate the document once at the command/adapter boundary. */
export function indexTree(document: DocumentV3): Map<string, Location> {
  const result = new Map<string, Location>();
  function visit(siblings: Node[], ancestors: Node[]): void {
    siblings.forEach((node, index) => {
      result.set(node.instance_id, { node, parent: ancestors.at(-1), ancestors, siblings, index });
      visit(node.slots.content ?? [], [...ancestors, node]);
    });
  }
  visit(document.blocks, []);
  return result;
}
export function location(tree: Map<string, Location>, id: string): Location {
  return tree.get(id) ?? reject('missing_node', id);
}
/** Deduplicate parent/child selections and always return DOM reading order. */
export function selectionRoots(tree: Map<string, Location>, ids: readonly string[]): Location[] {
  if (!ids.length) reject('empty_selection', '$');
  const selected = new Set(ids);
  for (const id of selected) location(tree, id);
  return [...tree.values()].filter(item => selected.has(item.node.instance_id)
    && !item.ancestors.some(parent => selected.has(parent.instance_id)));
}
export function assertEditable(item: Location, includeDescendants = false, allowSelfUnlock = false): void {
  if (item.ancestors.some(node => node.locked) || (!allowSelfUnlock && item.node.locked)) reject('locked', item.node.instance_id);
  function check(nodes: Node[]): void {
    for (const node of nodes) {
      if (node.locked) reject('locked', node.instance_id);
      check(node.slots.content ?? []);
    }
  }
  if (includeDescendants) check(item.node.slots.content ?? []);
}
export function containerChildren(document: DocumentV3, parentId: string | null): Node[] {
  if (parentId === null) return document.blocks;
  const item = location(indexTree(document), parentId);
  assertEditable(item);
  if (!designPolicyV3.containers.includes(item.node.type)) reject('leaf_parent', parentId);
  return item.node.slots.content ?? (item.node.slots.content = []);
}
export function assertFlow(node: Node): void {
  if ((['base', 'tablet', 'mobile'] as const).some(viewport => effectiveStyle(node, viewport).position === 'absolute')) {
    // Reparenting absolute nodes needs the IP5 measured coordinate adapter.
    reject('coordinate_conversion_required', node.instance_id);
  }
}
export function cloneDocument(document: DocumentV3): DocumentV3 {
  // Only validated JSON reaches this helper. Never clone vendor/session objects.
  return JSON.parse(JSON.stringify(document)) as DocumentV3;
}
