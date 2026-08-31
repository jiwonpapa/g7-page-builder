import policy from '../../../schemas/layout-policy-v1.json';
import type { PageBuilderBlock } from './types';

export const layoutPolicy = policy;
export type LayoutDocument = { blocks: PageBuilderBlock[] };
export class LayoutPolicyError extends Error {
  constructor(public readonly code: string, public readonly path: string) {
    super(`${code}: ${path}`);
    this.name = 'LayoutPolicyError';
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const layouts = new Set<string>(Object.values(policy.layouts));
const known = new Set([...policy.root_types, ...layouts]);
const childGroups: Record<string, readonly string[]> = {
  compatibility: policy.root_types, leaf: policy.leaf_types,
  ...Object.fromEntries(Object.entries(policy.layouts).map(([key, type]) => [key, [type]])),
};
const childrenByParent = new Map<string | null, Set<string>>(
  Object.entries(policy.child_groups).map(([parent, groups]) => [
    parent === 'root' ? null : policy.layouts[parent as keyof typeof policy.layouts],
    new Set(groups.flatMap((group) => childGroups[group])),
  ]),
);
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function reject(code: string, path: string): never { throw new LayoutPolicyError(code, path); }

/** Match compact Unicode/slash-unescaped JSON on the PHP boundary, not JS length. */
export function compactJsonBytes(value: unknown): number {
  try {
    const json = JSON.stringify(value, function (key, encoded: unknown) {
      const original: unknown = (this as Record<string, unknown>)[key];
      if (original === undefined || typeof original === 'function' || typeof original === 'symbol'
        || typeof original === 'bigint' || (typeof original === 'number' && !Number.isFinite(original))) reject('json', '$');
      if (record(original) && ![Object.prototype, null].includes(Object.getPrototypeOf(original))) reject('json', '$');
      if (record(original) && (typeof original.toJSON === 'function' || Object.getOwnPropertySymbols(original).length > 0)) reject('json', '$');
      return encoded;
    });
    return new TextEncoder().encode(json).byteLength;
  } catch (error) {
    if (error instanceof LayoutPolicyError) throw error;
    return reject('json', '$');
  }
}

export function layoutSlotNames(node: Pick<PageBuilderBlock, 'type' | 'props'>): string[] {
  if (node.type === policy.layouts.section || node.type === policy.layouts.stack) return ['content'];
  if (node.type !== policy.layouts.columns) return [];
  const { columns, ratio } = node.props;
  if (columns !== 1 && columns !== 2 && columns !== 3) return reject('columns', 'props.columns');
  if (typeof ratio !== 'string' || !(policy.ratios[columns] as string[]).includes(ratio)) return reject('columns', 'props.ratio');
  return Array.from({ length: columns }, (_, index) => `column${index + 1}`);
}

export function layoutAllowsChild(parentType: string | null, childType: string): boolean {
  return childrenByParent.get(parentType)?.has(childType) ?? false;
}

/** Structural validation only. Block props, envelope and responsive schemas remain separate. */
export function validateLayoutDocument(value: unknown): LayoutDocument {
  if (!record(value) || !Array.isArray(value.blocks)) return reject('shape', 'blocks');
  const pending = value.blocks.map((node, index) => ({ node: node as unknown, parent: null as string | null, depth: 1, path: `blocks.${index}` })).reverse();
  const ids = new Set<string>();
  while (pending.length) {
    const entry = pending.pop()!;
    const { node, parent, depth, path } = entry;
    if (depth > policy.limits.depth) return reject('depth_limit', path);
    if (!record(node) || !record(node.props) || !Number.isInteger(node.block_version) || Number(node.block_version) < 1) return reject('shape', path);
    if (typeof node.instance_id !== 'string' || !uuid.test(node.instance_id)) return reject('id', path);
    // UUID spelling is case-insensitive, so uppercase cannot bypass uniqueness.
    const identity = node.instance_id.toLowerCase();
    if (ids.has(identity)) return reject('duplicate_id', path);
    ids.add(identity);
    if (ids.size > policy.limits.nodes) return reject('node_limit', path);
    if (typeof node.type !== 'string' || !known.has(node.type) || (layouts.has(node.type) && node.block_version !== 1)) return reject('type', path);
    if (!layoutAllowsChild(parent, node.type)) return reject('parent', path);
    const names = layoutSlotNames({ type: node.type, props: node.props });
    const slots = Object.hasOwn(node, 'slots') ? node.slots : {};
    if (!record(slots)) return reject('shape', `${path}.slots`);
    for (const [name, children] of Object.entries(slots).reverse()) {
      if (!names.includes(name)) return reject('slot', `${path}.slots.${name}`);
      if (!Array.isArray(children)) return reject('shape', `${path}.slots.${name}`);
      if (children.length > policy.limits.slot_children) return reject('slot_limit', `${path}.slots.${name}`);
      for (let index = children.length - 1; index >= 0; index--) pending.push({ node: children[index], parent: node.type, depth: depth + 1, path: `${path}.slots.${name}.${index}` });
    }
  }
  if (compactJsonBytes(value) > policy.limits.utf8_bytes) return reject('byte_limit', '$');
  // All recursive structural members have been narrowed above; props are untouched.
  return value as LayoutDocument;
}
