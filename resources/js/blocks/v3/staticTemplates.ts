import { BUILTIN_BLOCK_PRESETS } from '../builtinCatalog';
import type { DocumentV3, Node } from '../../documents/v3/types';
import type { NewId, TreeClipboard } from '../../documents/v3/clipboard';
import { record, reject } from '../../documents/v3/schema';
import { CompositionBuilder, padding, token } from './compositionBuilder';
import * as compositions from './staticCompositions';

// Only schema-tested built-in presets cross this dispatch. This is not the
// untrusted legacy-document conversion boundary or a permissive props parser.
const bundled = <T extends object>(build: (props: T, builder: CompositionBuilder) => Node) =>
  (props: object, builder: CompositionBuilder): Node => build(props as T, builder);
const factories = {
  'content.heading-01': bundled(compositions.heading), 'media.image-01': bundled(compositions.image),
  'content.cta-split-01': bundled(compositions.cta),
  'data.bar-chart-01': bundled(compositions.barChart), 'content.divider-01': bundled(compositions.divider),
  'content.blockquote-01': bundled(compositions.blockquote), 'content.notice-01': bundled(compositions.notice),
};
export const staticCompositionTypes = Object.freeze(Object.keys(factories));
export const staticCompositionOptions = Object.freeze(BUILTIN_BLOCK_PRESETS.filter(preset => Object.hasOwn(factories, preset.block_id))
  .map(preset => Object.freeze({ key: preset.preset_id, label: preset.label.ko, blockId: preset.block_id })));

export function createStaticComposition(key: string, document: DocumentV3, nextId: NewId): TreeClipboard {
  const preset = BUILTIN_BLOCK_PRESETS.find(value => value.preset_id === key);
  if (!preset || !Object.hasOwn(factories, preset.block_id)) reject('composition', key);
  const builder = new CompositionBuilder(document, nextId);
  const root = factories[preset.block_id as keyof typeof factories](structuredClone(preset.props), builder);
  if (preset.props.appearance !== undefined) {
    const appearance = preset.props.appearance;
    if (!record(appearance) || Object.keys(appearance).some(key => !['surface', 'spacing'].includes(key))
      || !['soft', 'default'].includes(String(appearance.surface)) || !['compact', 'normal'].includes(String(appearance.spacing))) reject('composition_appearance', key);
    root.style = { ...root.style, ...padding(appearance.spacing === 'compact' ? 16 : 24),
      background: { kind: 'solid', color: token(appearance.surface === 'soft' ? 'border' : 'surface') } };
  }
  root.name = preset.label.ko;
  return builder.finish(root);
}
