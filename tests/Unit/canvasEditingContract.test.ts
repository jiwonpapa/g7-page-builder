import { describe, expect, it } from 'vitest';

import {
  BUILTIN_CANVAS_EDITING_CONTRACT,
  collectionLimit,
  CANVAS_ELEMENT_MESSAGE,
  elementAppearanceClassName,
  normalizeElementAppearanceMap,
  remapCollectionElementAppearanceMap,
  notifyCanvasElementSelection,
  resolveMediaFieldPath,
  resolveRouteFieldPath,
  setValueAtPath,
  valueAtPath,
  type CanvasElementSelection,
} from '../../resources/js/editor/canvasEditingContract';
import { BUILTIN_BLOCK_DEFINITIONS } from '../../resources/js/blocks/builtinCatalog';

describe('canvas editing contract', () => {
  it('covers every one of the 45 builtin blocks without duplicate component names', () => {
    expect(BUILTIN_CANVAS_EDITING_CONTRACT).toHaveLength(45);
    expect(new Set(BUILTIN_CANVAS_EDITING_CONTRACT.map((item) => item.componentType)).size).toBe(45);
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.map((item) => item.componentType).sort())
      .toEqual(BUILTIN_BLOCK_DEFINITIONS.map((item) => item.editor_component).sort());
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.every((item) => item.directText)).toBe(true);
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.filter((item) => item.dynamicData).map((item) => item.componentType))
      .toEqual(['G7RecentPosts', 'G7BoardArchive', 'G7PostDetail', 'G7ProductGrid', 'G7ProductShowcase', 'G7ProductDetail']);
  });

  it('resolves direct route and media fields from the selected visible element', () => {
    expect(resolveRouteFieldPath('Cta', 'secondaryLabel')).toBe('secondaryUrl');
    expect(resolveRouteFieldPath('ImageText', 'primaryLabel')).toBe('primaryUrl');
    expect(resolveRouteFieldPath('Image', 'src')).toBe('linkUrl');
    expect(resolveRouteFieldPath('Buttons', 'items.1.label')).toBe('items.1.url');
    expect(resolveRouteFieldPath('HeroSlider', 'slides.2.buttonLabel')).toBe('slides.2.buttonUrl');
    expect(resolveRouteFieldPath('DownloadResources', 'items.0.buttonLabel')).toBe('items.0.url');
    expect(resolveRouteFieldPath('G7PostDetail', 'linkLabel')).toBe('detailUrl');
    expect(resolveRouteFieldPath('G7ProductDetail', 'buttonLabel')).toBe('detailUrl');

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
    expect(collectionLimit('Buttons', 'items')).toEqual({ min: 1, max: 3 });
    expect(collectionLimit('IconList', 'items')).toEqual({ min: 2, max: 8 });
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

  it('keeps per-item appearance attached to collection content through every edit operation', () => {
    const styles = {
      heading: { weight: 'bold' as const },
      'items.0.label': { tone: 'accent' as const },
      'items.1.title': { font: 'serif' as const },
      'items.1.body': { align: 'right' as const },
      'items.2.title': { size: 'large' as const },
    };

    expect(remapCollectionElementAppearanceMap(styles, 'items', 'up', 1)).toEqual({
      heading: { weight: 'bold' },
      'items.0.title': { font: 'serif' },
      'items.0.body': { align: 'right' },
      'items.1.label': { tone: 'accent' },
      'items.2.title': { size: 'large' },
    });
    expect(remapCollectionElementAppearanceMap(styles, 'items', 'down', 1)).toEqual({
      heading: { weight: 'bold' },
      'items.0.label': { tone: 'accent' },
      'items.2.title': { font: 'serif' },
      'items.2.body': { align: 'right' },
      'items.1.title': { size: 'large' },
    });
    expect(remapCollectionElementAppearanceMap(styles, 'items', 'duplicate', 1)).toEqual({
      heading: { weight: 'bold' },
      'items.0.label': { tone: 'accent' },
      'items.1.title': { font: 'serif' },
      'items.2.title': { font: 'serif' },
      'items.1.body': { align: 'right' },
      'items.2.body': { align: 'right' },
      'items.3.title': { size: 'large' },
    });
    expect(remapCollectionElementAppearanceMap(styles, 'items', 'delete', 1)).toEqual({
      heading: { weight: 'bold' },
      'items.0.label': { tone: 'accent' },
      'items.1.title': { size: 'large' },
    });
    expect(styles['items.1.title']).toEqual({ font: 'serif' });
  });

  it('accepts elements from the Puck iframe realm and reports the selected inline field', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();
    frameDocument!.body.innerHTML = '<section><h2 data-g7pb-inline-field="title">프레임 제목</h2></section>';
    const title = frameDocument!.querySelector<HTMLElement>('h2');
    expect(title).not.toBeNull();
    Object.defineProperty(frame.contentWindow, 'innerWidth', { configurable: true, value: 400 });
    Object.defineProperty(frame.contentWindow, 'innerHeight', { configurable: true, value: 300 });
    frame.getBoundingClientRect = () => ({
      bottom: 700, height: 600, left: 50, right: 850, top: 100, width: 800,
      x: 50, y: 100, toJSON: () => ({}),
    });
    title!.getBoundingClientRect = () => ({
      bottom: 60, height: 40, left: 20, right: 120, top: 20, width: 100,
      x: 20, y: 20, toJSON: () => ({}),
    });
    let selection: CanvasElementSelection | null = null;
    const receive = (event: Event): void => {
      selection = (event as CustomEvent<CanvasElementSelection>).detail;
    };
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, receive);
    const nativeHTMLElement = globalThis.HTMLElement;
    Object.defineProperty(globalThis, 'HTMLElement', {
      configurable: true,
      value: class ForeignRealmHTMLElement {},
    });
    try {
      notifyCanvasElementSelection(
        { target: title } as unknown as Parameters<typeof notifyCanvasElementSelection>[0],
        'block-id',
        'hero',
      );
    } finally {
      Object.defineProperty(globalThis, 'HTMLElement', { configurable: true, value: nativeHTMLElement });
    }

    window.removeEventListener(CANVAS_ELEMENT_MESSAGE, receive);
    frame.remove();
    expect(title?.dataset.g7pbCanvasSelected).toBe('true');
    expect(selection).toMatchObject({ fieldPath: 'title', role: 'text', label: '제목' });
    expect(selection).toMatchObject({
      anchor: { bottom: 220, height: 80, left: 90, right: 290, top: 140, width: 200 },
    });
  });

  it('leaves rich-text range activation to the dedicated Tiptap state contract', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const frameDocument = frame.contentDocument;
    expect(frameDocument).not.toBeNull();
    frameDocument!.body.innerHTML = '<section><div data-g7pb-inline-field="items.0.body" data-g7pb-richtext-field="true"><p>문장 일부를 선택합니다.</p></div></section>';
    const paragraph = frameDocument!.querySelector<HTMLElement>('p');
    let selection: CanvasElementSelection | null = null;
    const receive = (event: Event): void => {
      selection = (event as CustomEvent<CanvasElementSelection>).detail;
    };
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, receive);

    notifyCanvasElementSelection(
      { target: paragraph } as unknown as Parameters<typeof notifyCanvasElementSelection>[0],
      'block-id',
      'card-grid',
    );

    expect(selection).toMatchObject({
      fieldPath: 'items.0.body',
      role: 'text',
    });
    expect(selection).not.toHaveProperty('rangeEditing');

    const text = paragraph?.firstChild;
    expect(text).not.toBeNull();
    const range = frameDocument!.createRange();
    range.setStart(text!, 3);
    range.setEnd(text!, 5);
    frame.contentWindow!.getSelection()?.removeAllRanges();
    frame.contentWindow!.getSelection()?.addRange(range);
    notifyCanvasElementSelection(
      { target: paragraph } as unknown as Parameters<typeof notifyCanvasElementSelection>[0],
      'block-id',
      'card-grid',
    );

    window.removeEventListener(CANVAS_ELEMENT_MESSAGE, receive);
    frame.remove();
    expect(selection).toMatchObject({
      fieldPath: 'items.0.body',
      role: 'text',
    });
    expect(selection).not.toHaveProperty('rangeEditing');
  });
});
