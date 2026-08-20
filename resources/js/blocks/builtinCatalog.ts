import rawManifest from '../../../resources/block-packs/builtin-core/manifest.json';

import type { BlockDefinitionDescriptor, BlockPackManifest } from './types';

export const BUILTIN_CORE_MANIFEST = rawManifest as BlockPackManifest;

export const BUILTIN_BLOCK_DEFINITIONS: readonly BlockDefinitionDescriptor[] = Object.freeze(
  BUILTIN_CORE_MANIFEST.blocks.map((definition) => Object.freeze({ ...definition })),
);

export const BLOCK_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  hero: '첫 화면',
  content: '콘텐츠',
  action: '전환',
  contact: '안내',
  trust: '신뢰',
  data: '데이터',
  commerce: '비즈니스',
  company: '회사 소개',
  media: '미디어',
  'g7-data': 'G7 데이터',
});

export function blockCatalogTestId(editorComponent: string): string {
  const slug = editorComponent
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  return `page-builder-block-option-${slug}`;
}
