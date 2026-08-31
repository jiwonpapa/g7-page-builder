import { layoutPolicy, layoutSlotNames, LayoutPolicyError, validateLayoutDocument, type LayoutDocument } from './layoutPolicy';
import type { PageBuilderBlock } from './types';

export interface LayoutLocation {
  node: PageBuilderBlock;
  parentId: string | null;
  slot: string;
  index: number;
  ancestors: string[];
}
export interface LayoutDestination { parentId: string | null; slot: string; index: number }
export type LayoutChange<T> = { status: 'applied'; document: T } | {
  status: 'confirmation-required'; document: T; affectedNodes: number; targetSlot?: string;
};

function locations(document: LayoutDocument): LayoutLocation[] {
  const result: LayoutLocation[] = [];
  const visit = (nodes: PageBuilderBlock[], parentId: string | null, slot: string, ancestors: string[]) => {
    nodes.forEach((node, index) => {
      result.push({ node, parentId, slot, index, ancestors });
      for (const name of layoutSlotNames(node)) visit(node.slots?.[name] ?? [], node.instance_id, name, [...ancestors, node.instance_id]);
    });
  };
  visit(document.blocks, null, 'blocks', []);
  return result;
}

export function findLayoutNode(document: LayoutDocument, instanceId: string): LayoutLocation | undefined {
  validateLayoutDocument(document);
  return locations(document).find(({ node }) => node.instance_id === instanceId);
}
function requireLocation(document: LayoutDocument, id: string): LayoutLocation {
  const location = locations(document).find(({ node }) => node.instance_id === id);
  if (!location) throw new LayoutPolicyError('not_found', id);
  return location;
}
function children(document: LayoutDocument, parentId: string | null, slot: string): PageBuilderBlock[] {
  if (parentId === null) {
    if (slot !== 'blocks') throw new LayoutPolicyError('slot', slot);
    return document.blocks;
  }
  const parent = requireLocation(document, parentId).node;
  if (!layoutSlotNames(parent).includes(slot)) throw new LayoutPolicyError('slot', slot);
  parent.slots ??= {};
  parent.slots[slot] ??= [];
  return parent.slots[slot];
}
function insert(document: LayoutDocument, node: PageBuilderBlock, target: LayoutDestination): void {
  const siblings = children(document, target.parentId, target.slot);
  if (!Number.isInteger(target.index) || target.index < 0 || target.index > siblings.length) throw new LayoutPolicyError('index', String(target.index));
  siblings.splice(target.index, 0, node);
}
function copy<T extends LayoutDocument>(document: T): T {
  validateLayoutDocument(document);
  return structuredClone(document);
}
function accept<T extends LayoutDocument>(document: T): T {
  validateLayoutDocument(document);
  return document;
}

/** Destination index is measured AFTER removal, matching one canonical transaction. */
export function moveLayoutNode<T extends LayoutDocument>(document: T, id: string, target: LayoutDestination): T {
  const next = copy(document);
  const source = requireLocation(next, id);
  if (target.parentId !== null) {
    const parent = requireLocation(next, target.parentId);
    if (parent.node.instance_id === id || parent.ancestors.includes(id)) throw new LayoutPolicyError('descendant', id);
  }
  children(next, source.parentId, source.slot).splice(source.index, 1);
  insert(next, source.node, target);
  return accept(next);
}

/** A caller (including future pattern insertion) supplies the UUID generator. */
export function cloneLayoutNode<T extends LayoutDocument>(document: T, id: string, target: LayoutDestination, newId: () => string): T {
  const next = copy(document);
  const subtree = structuredClone(requireLocation(next, id).node);
  for (const { node } of locations({ blocks: [subtree] })) node.instance_id = newId();
  insert(next, subtree, target);
  return accept(next);
}

export function deleteLayoutNode<T extends LayoutDocument>(document: T, id: string, confirmed = false): LayoutChange<T> {
  const next = copy(document);
  const source = requireLocation(next, id);
  const affectedNodes = locations({ blocks: [source.node] }).length;
  if (!confirmed && layoutSlotNames(source.node).length > 0) return { status: 'confirmation-required', document, affectedNodes };
  children(next, source.parentId, source.slot).splice(source.index, 1);
  return { status: 'applied', document: accept(next) };
}

export function resizeLayoutColumns<T extends LayoutDocument>(document: T, id: string, count: 1 | 2 | 3, ratio: string, confirmed = false): LayoutChange<T> {
  const next = copy(document);
  const node = requireLocation(next, id).node;
  if (node.type !== layoutPolicy.layouts.columns) throw new LayoutPolicyError('columns', id);
  const before = layoutSlotNames(node);
  const after = layoutSlotNames({ ...node, props: { ...node.props, columns: count, ratio } });
  const removed = before.filter((slot) => !after.includes(slot)).flatMap((slot) => node.slots?.[slot] ?? []);
  const targetSlot = after[after.length - 1];
  const affectedNodes = locations({ blocks: removed }).length;
  node.slots ??= {};
  for (const slot of after) node.slots[slot] ??= [];
  node.slots[targetSlot].push(...removed);
  for (const slot of before) if (!after.includes(slot)) delete node.slots[slot];
  node.props = { ...node.props, columns: count, ratio };
  // Reject impossible merges before offering a confirmation the user cannot fulfill.
  accept(next);
  if (affectedNodes > 0 && !confirmed) return { status: 'confirmation-required', document, affectedNodes, targetSlot };
  return { status: 'applied', document: next };
}
