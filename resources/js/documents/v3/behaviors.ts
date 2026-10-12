import policy from '../../../../schemas/design-policy-v3.json';
import type { Behavior, DocumentV3, Node } from './types';
import { reject } from './schema';

interface Entry { node: Node; ancestors: Node[]; order: number }
const rules = policy.behaviors;
const layout = (node: Node): boolean => rules.layout_types.includes(node.type)
  && 'tag' in node.props && rules.layout_tags.includes(node.props.tag);

/** Meaning validation follows wire validation. References never use a DOM index or block name. */
export function validateBehaviors(document: DocumentV3): void {
  const entries = new Map<string, Entry>();
  function visit(nodes: Node[], ancestors: Node[]): void {
    for (const node of nodes) {
      entries.set(node.instance_id, { node, ancestors, order: entries.size });
      visit(node.slots.content ?? [], [...ancestors, node]);
    }
  }
  visit(document.blocks, []);
  const within = (id: string, parent: string): boolean => entries.get(id)?.ancestors.some(node => node.instance_id === parent) ?? false;
  for (const { node: host } of entries.values()) {
    const behavior = host.behavior;
    if (!behavior) continue;
    if (!layout(host)) reject('behavior_host', host.instance_id);
    const used = new Set<string>();
    const target = (id: string, role: 'layout' | 'trigger'): Node => {
      const entry = entries.get(id);
      if (!entry || !within(id, host.instance_id)) reject('behavior_reference', id);
      const afterHost = entry.ancestors.slice(entry.ancestors.findIndex(node => node === host) + 1);
      if (entry.node.behavior || afterHost.some(node => node.behavior)) reject('behavior_owner', id);
      if (used.has(id)) reject('behavior_duplicate', id);
      used.add(id);
      if (role === 'layout' ? !layout(entry.node) : !rules.trigger_types.includes(entry.node.type)) reject('behavior_role', id);
      return entry.node;
    };
    const disjoint = (ids: string[]) => {
      if (ids.some(id => ids.some(other => other !== id && within(id, other)))) reject('behavior_overlap', host.instance_id);
    };
    if (behavior.kind === 'carousel') {
      const viewport = target(behavior.viewport_id, 'layout'), track = target(behavior.track_id, 'layout');
      target(behavior.previous_id, 'trigger'); target(behavior.next_id, 'trigger');
      if (behavior.rotation_id) target(behavior.rotation_id, 'trigger');
      if (behavior.autoplay && !behavior.rotation_id) reject('behavior_rotation', host.instance_id);
      const slides = track.slots.content ?? [];
      if (viewport.slots.content?.length !== 1 || viewport.slots.content[0] !== track
        || !slides.length || slides.some(node => !layout(node) || node.behavior)) reject('behavior_track', host.instance_id);
      if (!slides.some(node => node.instance_id === behavior.active_slide_id)) reject('behavior_active', host.instance_id);
      if ([behavior.previous_id, behavior.next_id, ...(behavior.rotation_id ? [behavior.rotation_id] : [])]
        .some(id => within(id, behavior.viewport_id))) reject('behavior_overlap', host.instance_id);
      if (behavior.rotation_id && entries.get(behavior.rotation_id)!.order > Math.min(
        entries.get(behavior.previous_id)!.order, entries.get(behavior.next_id)!.order, entries.get(behavior.viewport_id)!.order)) reject('behavior_order', host.instance_id);
    } else {
      for (const pair of behavior.pairs) { target(pair.trigger_id, 'trigger'); target(pair.panel_id, 'layout'); }
      disjoint(behavior.pairs.map(pair => pair.panel_id));
      if (behavior.pairs.some(pair => behavior.pairs.some(other => within(pair.trigger_id, other.panel_id)))) reject('behavior_overlap', host.instance_id);
      if (behavior.kind === 'tabs') {
        target(behavior.tablist_id, 'layout');
        if (!behavior.pairs.some(pair => pair.panel_id === behavior.active_panel_id)) reject('behavior_active', host.instance_id);
        if (behavior.pairs.some(pair => !within(pair.trigger_id, behavior.tablist_id)
          || within(pair.panel_id, behavior.tablist_id) || within(behavior.tablist_id, pair.panel_id))) reject('behavior_tablist', host.instance_id);
      } else {
        if (behavior.mode === 'single' && behavior.pairs.filter(pair => pair.expanded).length > 1) reject('behavior_expanded', host.instance_id);
        for (const pair of behavior.pairs) {
          target(pair.item_id, 'layout');
          if (!within(pair.trigger_id, pair.item_id) || !within(pair.panel_id, pair.item_id)) reject('behavior_item', host.instance_id);
        }
        disjoint(behavior.pairs.map(pair => pair.item_id));
      }
    }
  }
}

/** Whole behavior groups copy as data; partial copies cannot retain foreign ownership. */
export function remapBehavior(behavior: Behavior, ids: ReadonlyMap<string, string>): Behavior {
  const remap = (id: string) => ids.get(id) ?? reject('behavior_clipboard', id);
  if (behavior.kind === 'disclosure') return { ...behavior, pairs: behavior.pairs.map(pair => ({
    ...pair, item_id: remap(pair.item_id), trigger_id: remap(pair.trigger_id), panel_id: remap(pair.panel_id),
  })) };
  if (behavior.kind === 'tabs') return { ...behavior, tablist_id: remap(behavior.tablist_id), active_panel_id: remap(behavior.active_panel_id),
    pairs: behavior.pairs.map(pair => ({ trigger_id: remap(pair.trigger_id), panel_id: remap(pair.panel_id) })) };
  return { ...behavior, viewport_id: remap(behavior.viewport_id), track_id: remap(behavior.track_id), active_slide_id: remap(behavior.active_slide_id),
    previous_id: remap(behavior.previous_id), next_id: remap(behavior.next_id), ...(behavior.rotation_id ? { rotation_id: remap(behavior.rotation_id) } : {}) };
}
