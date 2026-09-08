import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import { BUILTIN_BLOCK_DEFINITIONS, BUILTIN_BLOCK_PRESETS } from '../../resources/js/blocks/builtinCatalog';
import type { BlockCatalogItem } from '../../resources/js/blocks/types';
import { BLOCK_GALLERY_ITEMS } from '../../resources/js/editor/BlockCatalogContext';
import { galleryItemFromApi, libraryCategories, libraryEditingCapabilities, libraryKind } from '../../resources/js/editor/blockGalleryModel';
import { createRuntimePuckConfig, pageBuilderPuckConfig } from '../../resources/js/editor/puckEditorConfig';

describe('editor library production units and declared editing boundaries', () => {
  it('keeps element presets in their production unit without changing preset contents or identity', () => {
    for (const type of ['Heading', 'RichText', 'Image', 'Buttons', 'Divider', 'Icon', 'List', 'Badge']) {
      const items = BLOCK_GALLERY_ITEMS.filter((item) => item.type === type);
      expect(items.length).toBeGreaterThan(1);
      expect(items.every((item) => item.productionKind === 'element')).toBe(true);
      for (const item of items.filter((candidate) => candidate.kind === 'preset')) {
        const preset = BUILTIN_BLOCK_PRESETS.find((candidate) => item.catalogId.endsWith(`:${candidate.preset_id}`));
        expect(item.presetProps).toBe(preset?.props);
        expect(item.blockId).toBe(preset?.block_id);
      }
    }
    expect(libraryKind('Hero')).toBe('section');
    expect(libraryKind('CardGrid')).toBe('section');
    expect(libraryKind('ImageText')).toBe('component');
    expect(libraryKind('G7RecentPosts')).toBe('component');
    expect(libraryKind('InquiryForm')).toBe('component');
  });

  it('uses the same classification and definition candidates in the drawer and gallery', () => {
    const categories = pageBuilderPuckConfig.categories ?? {};
    const offered = Object.entries(categories).filter(([, value]) => value.visible !== false)
      .flatMap(([kind, value]) => (value.components ?? []).map((type) => ({ kind, type })));
    expect(new Set(offered.map((entry) => entry.type)).size).toBe(offered.length);
    expect(offered.filter((entry) => entry.kind !== 'layout').map((entry) => entry.type).sort())
      .toEqual(BLOCK_GALLERY_ITEMS.filter((item) => item.kind === 'definition').map((item) => item.type).sort());
    for (const entry of offered) expect(entry.kind).toBe(libraryKind(entry.type));
    expect(createRuntimePuckConfig(false, false).categories?.layout.visible).toBe(false);
    expect(createRuntimePuckConfig(true, false).categories?.layout.visible).toBe(true);
    const actorConfig = createRuntimePuckConfig(false, false, ['Hero']);
    expect(Object.values(actorConfig.categories ?? {}).filter((category) => category.visible !== false)
      .flatMap((category) => category.components ?? [])).toEqual(['Hero']);
    expect(actorConfig.categories?.unavailable.components).toContain('Heading');
    expect(actorConfig.components.Heading).toBe(pageBuilderPuckConfig.components.Heading);
  });

  it('retains the legacy Hero renderer while excluding new legacy insertion', () => {
    expect(pageBuilderPuckConfig.components.HeroSplit).toBeDefined();
    expect(BUILTIN_BLOCK_DEFINITIONS.some((entry) => entry.editor_component === 'HeroSplit')).toBe(true);
    expect(BLOCK_GALLERY_ITEMS.some((item) => item.type === 'HeroSplit')).toBe(false);
  });

  it('declares all five boundaries for every builtin and structure from current editor contracts', () => {
    for (const [type, component] of Object.entries(pageBuilderPuckConfig.components)) {
      const capabilities = libraryEditingCapabilities(type, component.fields ?? {});
      expect(capabilities.map((entry) => entry.key)).toEqual(['fields', 'style', 'repeaters', 'slots', 'fixed']);
      expect(capabilities.every((entry) => entry.description.length > 0)).toBe(true);
      expect(capabilities.find((entry) => entry.key === 'slots')?.available).toBe(Object.values(component.fields ?? {}).some((field) => field.type === 'slot'));
    }
    const hero = libraryEditingCapabilities('Hero', pageBuilderPuckConfig.components.Hero.fields ?? {});
    expect(hero.find((entry) => entry.key === 'slots')?.description).toContain('내부');
    expect(hero.find((entry) => entry.key === 'repeaters')?.available).toBe(false);
    const buttons = libraryEditingCapabilities('Buttons', pageBuilderPuckConfig.components.Buttons.fields ?? {});
    expect(buttons.find((entry) => entry.key === 'repeaters')?.available).toBe(true);
    const form = libraryEditingCapabilities('InquiryForm', {});
    expect(form.find((entry) => entry.key === 'fixed')?.description).toContain('필수 입력·동의·검증·전송');
    const data = libraryEditingCapabilities('G7RecentPosts', {});
    expect(data.find((entry) => entry.key === 'fixed')?.description).toContain('실제 데이터·접근 권한');
  });

  it('reads a legacy data-pack preset as the same element and preserves the supplier axis', () => {
    const item: BlockCatalogItem = {
      catalog_id: 'preset:vendor/legacy:heading', kind: 'preset', block_id: 'content.heading-01', block_version: 1,
      pack_id: 'vendor/legacy', pack_version: '1.0.0', category: 'marketing', label: { ko: '팩 제목' },
      description: { ko: '기존 팩' }, thumbnail: '', editor_component: 'Heading', favorite: true, insertable: true,
      preset_props: { heading: '내용 보존', level: 2 },
    };
    const result = galleryItemFromApi(item, 'ko', 'Heading', BLOCK_GALLERY_ITEMS);
    expect(result).toMatchObject({ productionKind: 'element', kind: 'preset', packId: 'vendor/legacy', category: 'marketing', favorite: true });
    expect(result?.presetProps).toBe(item.preset_props);
    expect(galleryItemFromApi(item, 'ko', null, BLOCK_GALLERY_ITEMS)).toBeNull();
  });

  it('keeps old external editors discoverable without claiming undeclared inline or slot support', () => {
    const categories = libraryCategories(['External_LegacyWidget']);
    expect(categories.component.components).toEqual(['External_LegacyWidget']);
    const capabilities = libraryEditingCapabilities('External_LegacyWidget', {});
    expect(capabilities.filter((entry) => entry.available)).toEqual([]);
    expect(capabilities[0].description).toContain('팩의 설정 패널');
    expect(capabilities.find((entry) => entry.key === 'slots')?.description).toContain('지원하지 않습니다');
  });
});
