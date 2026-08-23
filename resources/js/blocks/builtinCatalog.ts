import rawManifest from '../../../resources/block-packs/builtin-core/manifest.json';

import type { BlockDefinitionDescriptor, BlockPackManifest, BlockPresetDescriptor } from './types';

export const BUILTIN_CORE_MANIFEST = rawManifest as BlockPackManifest;

export const BUILTIN_BLOCK_DEFINITIONS: readonly BlockDefinitionDescriptor[] = Object.freeze(
  BUILTIN_CORE_MANIFEST.blocks.map((definition) => Object.freeze({ ...definition })),
);

export const BUILTIN_BLOCK_PRESETS: readonly BlockPresetDescriptor[] = Object.freeze(
  BUILTIN_CORE_MANIFEST.presets.map((preset) => Object.freeze({ ...preset, props: Object.freeze({ ...preset.props }) })),
);

export const BLOCK_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  basic: '기본',
  'hero-conversion': '첫 화면·전환',
  content: '콘텐츠',
  media: '미디어',
  navigation: '탐색',
  'trust-company': '신뢰·회사',
  'data-comparison': '데이터·비교',
  'form-location': '문의·방문',
  'g7-data': 'G7 데이터',
});

export function blockCatalogTestId(editorComponent: string): string {
  const slug = editorComponent
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  return `page-builder-block-option-${slug}`;
}
