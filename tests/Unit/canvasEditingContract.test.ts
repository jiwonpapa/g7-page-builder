import { describe, expect, it } from 'vitest';

import {
  BUILTIN_CANVAS_EDITING_CONTRACT,
  collectionLimit,
  CANVAS_ELEMENT_MESSAGE,
  elementAppearanceClassName,
  normalizeElementAppearanceMap,
  notifyCanvasElementSelection,
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

  it('normalizes safe element tokens per field path and rejects arbitrary style payloads', () => {
    const styles = normalizeElementAppearanceMap({
      title: { font: 'serif', size: 'large', weight: 'bold', align: 'right', tone: 'accent', color: 'red' },
      'items.0.body': { size: 'expression(alert(1))', align: 'center' },
      'bad[path]': { size: 'large' },
    });
    expect(styles).toEqual({
      title: { font: 'serif', size: 'large', weight: 'bold', align: 'right', tone: 'accent' },
      'items.0.body': { align: 'center' },
    });
    expect(elementAppearanceClassName(styles, 'title')).toContain('g7pb-element-size--large');
    expect(elementAppearanceClassName(styles, 'title')).toContain('g7pb-element-font--serif');
    expect(elementAppearanceClassName(styles, 'items.0.body')).not.toContain('expression');
  });

  it('accepts elements from the Puck iframe realm and reports the selected inline field', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();
    frameDocument!.body.innerHTML = '<section><h2 data-g7pb-inline-field="title">프레임 제목</h2></section>';
    const title = frameDocument!.querySelector<HTMLElement>('h2');
    let selection: CanvasElementSelection | null = null;
    const receive = (event: Event): void => {
      selection = (event as CustomEvent<CanvasElementSelection>).detail;
    };
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, receive);

    notifyCanvasElementSelection(
      { target: title } as unknown as Parameters<typeof notifyCanvasElementSelection>[0],
      'block-id',
      'hero',
    );

    window.removeEventListener(CANVAS_ELEMENT_MESSAGE, receive);
    frame.remove();
    expect(title?.dataset.g7pbCanvasSelected).toBe('true');
    expect(selection).toMatchObject({ fieldPath: 'title', role: 'text', label: '제목' });
  });
});
