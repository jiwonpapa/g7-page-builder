import { describe, expect, it } from 'vitest';

import {
  BUILTIN_CANVAS_EDITING_CONTRACT,
  collectionLimit,
  resolveMediaFieldPath,
  resolveRouteFieldPath,
  setValueAtPath,
  valueAtPath,
  type CanvasElementSelection,
} from '../../resources/js/editor/canvasEditingContract';
import { BUILTIN_BLOCK_DEFINITIONS } from '../../resources/js/blocks/builtinCatalog';

describe('canvas editing contract', () => {
  it('covers every one of the 29 builtin blocks without duplicate component names', () => {
    expect(BUILTIN_CANVAS_EDITING_CONTRACT).toHaveLength(29);
    expect(new Set(BUILTIN_CANVAS_EDITING_CONTRACT.map((item) => item.componentType)).size).toBe(29);
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.map((item) => item.componentType).sort())
      .toEqual(BUILTIN_BLOCK_DEFINITIONS.map((item) => item.editor_component).sort());
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.every((item) => item.directText)).toBe(true);
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.filter((item) => item.dynamicData).map((item) => item.componentType))
      .toEqual(['G7RecentPosts', 'G7BoardArchive', 'G7ProductGrid', 'G7ProductShowcase']);
  });

  it('resolves direct route and media fields from the selected visible element', () => {
    expect(resolveRouteFieldPath('Cta', 'secondaryLabel')).toBe('secondaryUrl');
    expect(resolveRouteFieldPath('HeroSlider', 'slides.2.buttonLabel')).toBe('slides.2.buttonUrl');
    expect(resolveRouteFieldPath('DownloadResources', 'items.0.buttonLabel')).toBe('items.0.url');

    const selection: CanvasElementSelection = {
      blockId: 'block', blockType: 'gallery', fieldPath: 'images.1.caption', role: 'text',
      label: '캡션 · 2번 항목', collection: 'images', itemIndex: 1,
    };
    expect(resolveMediaFieldPath('Gallery', selection)).toBe('images.1.src');
  });

  it('updates nested array values immutably and enforces collection bounds metadata', () => {
    const source = { slides: [{ title: '첫째' }, { title: '둘째' }] };
    const next = setValueAtPath(source, 'slides.1.title', '변경');
    expect(valueAtPath(next, 'slides.1.title')).toBe('변경');
    expect(valueAtPath(source, 'slides.1.title')).toBe('둘째');
    expect(collectionLimit('HeroSlider', 'slides')).toEqual({ min: 2, max: 5 });
    expect(collectionLimit('ComparisonTable', 'rows')).toEqual({ min: 1, max: 12 });
  });
});
