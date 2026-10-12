import type { DocumentV3, Node, Style } from './types';
import { documentPresentation } from './presentation';
import { effectiveStyle, type Viewport } from './validate';
import { indexTree, nodeAnchor } from './tree';

export type BehaviorAttributes = Record<string, string>;
/** Generated output only. A renderer never changes authored nodes or runtime state. */
export function behaviorPresentation(document: DocumentV3, viewport: Viewport = 'base') {
  const tree = indexTree(document), styles = documentPresentation(document, viewport);
  const attributes = new Map<string, BehaviorAttributes>();
  const set = (id: string, values: BehaviorAttributes) => attributes.set(id, { ...attributes.get(id), ...values });
  const defaults = (id: string, values: [keyof Style, string, string][]) => {
    const authored = effectiveStyle(tree.get(id)!.node, viewport), generated = styles.get(id)!;
    if (generated.display === 'none') return;
    for (const [key, property, value] of values) if (authored[key] === undefined) generated[property] = value;
  };
  for (const { node } of tree.values()) {
    const behavior = node.behavior;
    if (!behavior) continue;
    const host = node.instance_id;
    set(host, { 'data-g7pb-control-ids': 'stable' });
    if (behavior.kind === 'tabs') {
      set(host, { 'data-g7pb-tabs': '', 'data-g7pb-tabs-initial': String(behavior.pairs.findIndex(pair => pair.panel_id === behavior.active_panel_id)) });
      set(behavior.tablist_id, { role: 'tablist', 'aria-label': behavior.label, 'aria-orientation': behavior.orientation });
      for (const pair of behavior.pairs) {
        const active = pair.panel_id === behavior.active_panel_id;
        set(pair.trigger_id, { role: 'tab', 'aria-controls': nodeAnchor(pair.panel_id), 'aria-selected': String(active), tabindex: active ? '0' : '-1' });
        set(pair.panel_id, { role: 'tabpanel', 'aria-labelledby': nodeAnchor(pair.trigger_id), tabindex: '0' });
      }
    } else if (behavior.kind === 'disclosure') {
      set(host, { 'data-g7pb-accordion': '', 'data-g7pb-accordion-behavior': behavior.mode });
      for (const pair of behavior.pairs) {
        set(pair.item_id, { 'data-g7pb-accordion-item': '', 'data-g7pb-open': String(pair.expanded) });
        set(pair.trigger_id, { 'data-g7pb-accordion-trigger': '', 'aria-controls': nodeAnchor(pair.panel_id), 'aria-expanded': String(pair.expanded) });
        set(pair.panel_id, { 'data-g7pb-accordion-panel': '', 'aria-labelledby': nodeAnchor(pair.trigger_id), role: 'region' });
      }
    } else {
      const slides = tree.get(behavior.track_id)!.node.slots.content ?? [];
      set(host, { 'data-g7pb-slider': '', role: 'region', 'aria-roledescription': '캐러셀', 'aria-label': behavior.label,
        'data-g7pb-slider-initial': String(slides.findIndex(slide => slide.instance_id === behavior.active_slide_id)),
        'data-g7pb-slider-loop': String(behavior.loop), 'data-g7pb-slider-autoplay': String(behavior.autoplay),
        'data-g7pb-slider-interval': String(behavior.interval_ms) });
      set(behavior.viewport_id, { 'data-g7pb-slider-viewport': '' });
      set(behavior.track_id, { 'data-g7pb-slider-track': '', 'aria-live': behavior.autoplay ? 'off' : 'polite', 'aria-atomic': 'false' });
      set(behavior.previous_id, { 'data-g7pb-slider-prev': '', 'aria-controls': nodeAnchor(behavior.viewport_id) });
      set(behavior.next_id, { 'data-g7pb-slider-next': '', 'aria-controls': nodeAnchor(behavior.viewport_id) });
      if (behavior.rotation_id) set(behavior.rotation_id, { 'data-g7pb-slider-toggle': '', 'aria-controls': nodeAnchor(behavior.viewport_id), 'aria-pressed': String(behavior.autoplay) });
      // Carousel flow defaults apply only where the author has not set a value.
      styles.get(behavior.viewport_id)!.overflow = 'hidden';
      defaults(behavior.track_id, [['display', 'display', 'flex'], ['direction', 'flex-direction', 'row'], ['wrap', 'flex-wrap', 'nowrap']]);
      slides.forEach((slide: Node, index) => {
        set(slide.instance_id, { 'data-g7pb-slider-slide': '', role: 'group', 'aria-roledescription': '슬라이드', 'aria-label': `${index + 1} / ${slides.length}` });
        defaults(slide.instance_id, [['grow', 'flex-grow', '0'], ['shrink', 'flex-shrink', '0'], ['basis', 'flex-basis', '100%'], ['min_width', 'min-width', '0px']]);
      });
    }
  }
  return { attributes, styles };
}
