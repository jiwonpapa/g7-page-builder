import policy from '../../../../schemas/design-policy-v3.json';
import type { Node } from './types';
import { reject } from './schema';

const children: Readonly<Record<string, readonly string[]>> = policy.semantics.children;
const parents: Readonly<Record<string, readonly string[]>> = policy.semantics.parents;
const displays: Readonly<Record<string, string>> = policy.semantics.display;
const sequences: Readonly<Record<string, { order: readonly string[]; singletons: readonly string[] }>> = policy.semantics.sequence;
const edges: Readonly<Record<string, readonly string[]>> = policy.semantics.edge_children;
const tagOf = (node?: Node): string => node && 'tag' in node.props ? node.props.tag : '';

/** Pure structural HTML grammar, shared with PHP via the versioned policy.
 * Invalid insert/move/delete candidates fail atomically before Puck or HTML can
 * normalize them into a different tree. Empty groups remain authorable.
 */
export function validateNodeSemantics(node: Node, parent?: Node): void {
  const tag = tagOf(node), parentTag = tagOf(parent);
  if (parents[tag] && !parents[tag].includes(parentTag)) reject('semantic_parent', node.instance_id);
  if (children[parentTag] && !children[parentTag].includes(tag)) reject('semantic_child', node.instance_id);
  const tags = (node.slots.content ?? []).map(tagOf), sequence = sequences[tag];
  if (sequence) {
    const ranks = tags.map(child => sequence.order.indexOf(child));
    if (ranks.some((rank, index) => index > 0 && rank < ranks[index - 1])
      || sequence.singletons.some(child => tags.filter(value => value === child).length > 1)) reject('semantic_order', node.instance_id);
  }
  for (const child of edges[tag] ?? []) {
    const index = tags.indexOf(child);
    if (index >= 0 && (index !== 0 && index !== tags.length - 1 || tags.lastIndexOf(child) !== index)) reject('semantic_order', node.instance_id);
  }
}
export function semanticDisplay(node: Node): string { return displays[tagOf(node)] ?? 'block'; }
