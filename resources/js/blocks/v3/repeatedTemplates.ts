import { BUILTIN_BLOCK_PRESETS } from '../builtinCatalog';
import type { DocumentV3, Node } from '../../documents/v3/types';
import type { NewId, TreeClipboard } from '../../documents/v3/clipboard';
import { record, reject } from '../../documents/v3/schema';
import { CompositionBuilder, padding, token } from './compositionBuilder';
import * as compositions from './repeatedCompositions';

/** This registry consumes ONLY the bundled, schema-tested catalog, not arbitrary
 * legacy documents. Explicit legacy conversion has a separate validation boundary.
 * Keep the single assertion at this trusted catalog dispatch, not in UI consumers.
 */
const bundled = <T extends object>(build: (props: T, builder: CompositionBuilder) => Node) =>
  (props: object, builder: CompositionBuilder): Node => build(props as T, builder);
const factories = {
  'trust.logo-cloud-01': bundled(compositions.logos), 'commerce.pricing-tiers-01': bundled(compositions.pricing),
  'company.team-grid-01': bundled(compositions.team), 'media.gallery-grid-01': bundled(compositions.gallery),
  'trust.testimonials-01': bundled(compositions.testimonials), 'content.process-timeline-01': bundled(compositions.process),
  'commerce.comparison-table-01': bundled(compositions.comparison), 'content.article-list-01': bundled(compositions.articles),
  'content.event-schedule-01': bundled(compositions.events), 'content.download-resources-01': bundled(compositions.downloads),
  'content.card-grid-01': bundled(compositions.cards), 'action.buttons-01': bundled(compositions.buttons),
  'content.list-01': bundled(compositions.list), 'navigation.breadcrumbs-01': bundled(compositions.breadcrumbs),
};
export const repeatedCompositionTypes = Object.freeze(Object.keys(factories));
export const repeatedCompositionOptions = Object.freeze(BUILTIN_BLOCK_PRESETS.filter(preset => Object.hasOwn(factories, preset.block_id))
  .map(preset => Object.freeze({ key: preset.preset_id, label: preset.label.ko, blockId: preset.block_id })));

/** Returns an independent insertable tree; does not publish, write, or migrate. */
export function createRepeatedComposition(key: string, document: DocumentV3, nextId: NewId): TreeClipboard {
  const preset = BUILTIN_BLOCK_PRESETS.find(value => value.preset_id === key);
  if (!preset || !Object.hasOwn(factories, preset.block_id)) reject('composition', key);
  const builder = new CompositionBuilder(document, nextId);
  const root = factories[preset.block_id as keyof typeof factories](structuredClone(preset.props), builder);
  // This is the one appearance envelope currently present in these bundled presets.
  // Unknown future catalog envelopes fail instead of being silently discarded.
  if (preset.props.appearance !== undefined) {
    const appearance = preset.props.appearance;
    if (!record(appearance) || Object.keys(appearance).length !== 2 || appearance.surface !== 'soft' || appearance.spacing !== 'compact') reject('composition_appearance', key);
    root.style = { ...root.style, ...padding(16), background: { kind: 'solid', color: token('border') } };
  }
  root.name = preset.label.ko;
  return builder.finish(root);
}
