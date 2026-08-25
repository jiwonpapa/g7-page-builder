import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PageBuilderDocument, SitePartResource } from '../../resources/js/documents/types';
import { CANVAS_ELEMENT_MESSAGE } from '../../resources/js/editor/canvasEditingContract';
import builtinManifest from '../../resources/block-packs/builtin-core/manifest.json';
import companyPageKit from '../../resources/store/source/page-kits/company-launch/document.json';
import editorialPageKit from '../../resources/store/source/page-kits/editorial-community/document.json';
import eventPageKit from '../../resources/store/source/page-kits/event-launch/document.json';
import localBusinessPageKit from '../../resources/store/source/page-kits/local-business/document.json';
import servicePageKit from '../../resources/store/source/page-kits/service-conversion/document.json';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;
const localStorageValues = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    clear: () => localStorageValues.clear(),
    getItem: (key: string) => localStorageValues.get(key) ?? null,
    key: (index: number) => Array.from(localStorageValues.keys())[index] ?? null,
    get length() { return localStorageValues.size; },
    removeItem: (key: string) => localStorageValues.delete(key),
    setItem: (key: string, value: string) => localStorageValues.set(key, value),
  },
});
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: () => ({
    bottom: 40,
    height: 40,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }),
});

const { PageBuilderApiClient } = await import('../../resources/js/api/pageBuilderApi');
const { PuckEditorAdapter, pageBuilderPuckConfig } = await import('../../resources/js/editor/PuckEditorAdapter');
const {
  createRichTextField,
  RichTextCanvasField,
  isRichTextRangeActive,
  RICH_TEXT_RANGE_STATE_MESSAGE,
} = await import('../../resources/js/editor/richTextEditing');

const fixture: PageBuilderDocument = {
  schema_version: 'g7-page-builder/v1',
  document_id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'surface-test',
  mode: 'canvas',
  locale: 'ko',
  tokens: {},
  blocks: [
    {
      instance_id: '223e4567-e89b-42d3-a456-426614174001',
      type: 'content.hero-centered-01',
      block_version: 1,
      props: {
        eyebrow: 'Hero eyebrow',
        title: 'Hero title',
        body: '<p>Hero body</p>',
        alignment: 'center',
        image: { src: 'https://images.example.com/hero.webp', alt: 'Hero image' },
      },
      slots: {},
    },
    {
      instance_id: '323e4567-e89b-42d3-a456-426614174002',
      type: 'content.features-grid-01',
      block_version: 1,
      props: {
        title: 'Features title',
        items: [
          { icon: 'sparkles', title: 'First title', body: 'First body' },
          { icon: 'shield', title: 'Second title', body: 'Second body' },
        ],
      },
      slots: {},
    },
    {
      instance_id: '423e4567-e89b-42d3-a456-426614174003',
      type: 'content.cta-split-01',
      block_version: 1,
      props: {
        eyebrow: 'CTA eyebrow',
        heading: 'CTA heading',
        body: 'CTA body',
        primaryLink: { label: 'Primary', url: '/start' },
        secondaryLink: { label: 'Secondary', url: '/about' },
        theme: 'dark',
      },
      slots: {},
    },
    {
      instance_id: '523e4567-e89b-42d3-a456-426614174004',
      type: 'content.contact-info-01',
      block_version: 1,
      props: {
        heading: 'Contact heading',
        address: 'Seoul address',
        phone: '02-1234-5678',
        email: 'hello@example.com',
        cta: { label: 'Contact us', url: '/contact' },
        mapLink: { label: 'Map', url: 'https://maps.example.com/' },
      },
      slots: {},
    },
  ],
};

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) {
    cleanup();
  }
  window.localStorage.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function eventually<T extends Element>(selector: string): Promise<T> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.querySelector<T>(selector)
      ?? document.querySelector('iframe')?.contentDocument?.querySelector<T>(selector);
    if (element) {
      return element;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  throw new Error(`Element not rendered: ${selector}`);
}

function editorElements(selector: string): NodeListOf<HTMLElement> {
  const editorDocument = document.querySelector('iframe')?.contentDocument;

  return (editorDocument ?? document).querySelectorAll<HTMLElement>(selector);
}

async function eventuallyBlockTypes(expected: string[]): Promise<void> {
  let actual: Array<string | undefined> = [];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    actual = Array.from(
      editorElements('[data-testid="page-builder-block"]'),
    ).map((element) => element.dataset.blockType);
    if (actual.length === expected.length && actual.every((type, index) => type === expected[index])) {
      return;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  expect(actual).toEqual(expected);
}

async function eventuallyContains(selector: string, expected: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const element = document.querySelector<HTMLElement>(selector)
      ?? document.querySelector('iframe')?.contentDocument?.querySelector<HTMLElement>(selector);
    if (element?.textContent?.includes(expected)) {
      return;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  throw new Error(`Text not rendered: ${selector} -> ${expected}`);
}

describe('Puck editor surface contract', () => {
  it('keeps rich-text pointer selection out of the parent block drag sensor', async () => {
    const parentPointerDown = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));
    await act(async () => {
      root.render(<div onPointerDown={parentPointerDown}>
        <RichTextCanvasField fieldPath="content">
          <div contentEditable suppressContentEditableWarning>실제 글자 범위 선택</div>
        </RichTextCanvasField>
      </div>);
    });

    const field = container.querySelector<HTMLElement>('[contenteditable="true"]');
    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    field?.dispatchEvent(pointerDown);

    expect(parentPointerDown).not.toHaveBeenCalled();
    expect(pointerDown.defaultPrevented).toBe(false);
    expect(field?.parentElement?.getAttribute('data-puck-overlay-portal')).toBe('true');
  });

  it('treats only a non-collapsed Tiptap selection as an active text range', () => {
    const editor = (empty: boolean) => ({ state: { selection: { empty } } }) as never;

    expect(isRichTextRangeActive(null)).toBe(false);
    expect(isRichTextRangeActive(editor(true))).toBe(false);
    expect(isRichTextRangeActive(editor(false))).toBe(true);
  });

  it('reacts to Tiptap selection updates without waiting for a content update', async () => {
    type EditorEvent = 'selectionUpdate' | 'transaction';
    const selection = { empty: true, from: 4, to: 4 };
    let selectedFont = 'inherit';
    const handlers = new Map<EditorEvent, Set<() => void>>();
    const editorDom = document.createElement('div');
    document.body.append(editorDom);
    const editor = {
      state: { selection },
      view: { dom: editorDom },
      getAttributes: vi.fn((mark: string) => mark === 'g7TextStyle' ? { font: selectedFont } : {}),
      isActive: vi.fn(() => false),
      on: vi.fn((event: EditorEvent, handler: () => void) => {
        const eventHandlers = handlers.get(event) ?? new Set();
        eventHandlers.add(handler);
        handlers.set(event, eventHandlers);
        return editor;
      }),
      off: vi.fn((event: EditorEvent, handler: () => void) => {
        handlers.get(event)?.delete(handler);
        return editor;
      }),
    } as never;
    const emit = (event: EditorEvent): void => handlers.get(event)?.forEach((handler) => handler());
    const InlineMenu = createRichTextField('본문').renderInlineMenu;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    let unmounted = false;
    mounted.push(() => {
      if (!unmounted) act(() => root.unmount());
    });

    await act(async () => {
      root.render(<InlineMenu editor={editor} editorState={null} readOnly={false}>
        <button type="button">기본 서식</button>
      </InlineMenu>);
    });
    expect(container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]')).toBeNull();

    selection.empty = false;
    selection.to = 12;
    editorDom.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await act(async () => emit('selectionUpdate'));
    expect(container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]')).toBeNull();
    await act(async () => {
      editorDom.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]')).not.toBeNull();

    selectedFont = 'modern';
    await act(async () => emit('transaction'));
    expect(container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-font"]')?.getAttribute('aria-label'))
      .toBe('선택한 글자 글꼴: 모던');

    selection.empty = true;
    selection.from = 12;
    await act(async () => emit('selectionUpdate'));
    expect(container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]')).toBeNull();

    await act(async () => root.unmount());
    unmounted = true;
    expect(handlers.get('selectionUpdate')).toHaveLength(0);
    expect(handlers.get('transaction')).toHaveLength(0);
  });

  it('restores the bookmarked text range before an actual toolbar click applies a mark', async () => {
    type EditorEvent = 'selectionUpdate' | 'transaction';
    const selection = { empty: false, from: 4, to: 10 };
    const handlers = new Map<EditorEvent, Set<() => void>>();
    const editorDom = document.createElement('div');
    document.body.append(editorDom);
    const operations: Array<[string, unknown?]> = [];
    const chain = {
      focus: vi.fn(() => { operations.push(['focus']); return chain; }),
      setTextSelection: vi.fn((range: { from: number; to: number }) => {
        operations.push(['setTextSelection', range]);
        selection.empty = range.from === range.to;
        selection.from = range.from;
        selection.to = range.to;
        return chain;
      }),
      toggleBold: vi.fn(() => { operations.push(['toggleBold']); return chain; }),
      run: vi.fn(() => { operations.push(['run']); return true; }),
    };
    const editor = {
      state: { selection },
      view: { dom: editorDom },
      getAttributes: vi.fn(() => ({})),
      isActive: vi.fn(() => false),
      chain: vi.fn(() => chain),
      on: vi.fn((event: EditorEvent, handler: () => void) => {
        const eventHandlers = handlers.get(event) ?? new Set();
        eventHandlers.add(handler);
        handlers.set(event, eventHandlers);
        return editor;
      }),
      off: vi.fn((event: EditorEvent, handler: () => void) => {
        handlers.get(event)?.delete(handler);
        return editor;
      }),
    } as never;
    const InlineMenu = createRichTextField('본문').renderInlineMenu;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));

    await act(async () => {
      root.render(<InlineMenu editor={editor} editorState={null} readOnly={false}>기존 서식</InlineMenu>);
    });
    const bold = container.querySelector<HTMLButtonElement>('[aria-label="선택한 글자 굵게"]');
    expect(bold).not.toBeNull();

    const pointerDown = new PointerEvent('pointerdown', { bubbles: true, cancelable: true });
    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    bold?.dispatchEvent(pointerDown);
    bold?.dispatchEvent(mouseDown);
    expect(pointerDown.defaultPrevented).toBe(true);
    expect(mouseDown.defaultPrevented).toBe(true);
    selection.empty = true;
    selection.from = 10;
    selection.to = 10;
    await act(async () => bold?.click());

    expect(operations).toEqual([
      ['focus'],
      ['setTextSelection', { from: 4, to: 10 }],
      ['toggleBold'],
      ['run'],
    ]);
  });

  it('broadcasts both active and inactive rich-text range state transitions', async () => {
    type EditorEvent = 'selectionUpdate' | 'transaction';
    const selection = { empty: true, from: 2, to: 2 };
    const handlers = new Map<EditorEvent, Set<() => void>>();
    const editorDom = document.createElement('div');
    document.body.append(editorDom);
    const editor = {
      state: { selection },
      view: { dom: editorDom },
      getAttributes: vi.fn(() => ({})),
      isActive: vi.fn(() => false),
      on: vi.fn((event: EditorEvent, handler: () => void) => {
        const eventHandlers = handlers.get(event) ?? new Set();
        eventHandlers.add(handler);
        handlers.set(event, eventHandlers);
        return editor;
      }),
      off: vi.fn((event: EditorEvent, handler: () => void) => {
        handlers.get(event)?.delete(handler);
        return editor;
      }),
    } as never;
    const emit = (event: EditorEvent): void => handlers.get(event)?.forEach((handler) => handler());
    const states: boolean[] = [];
    const receive = (event: Event): void => {
      states.push(Boolean((event as CustomEvent).detail?.active));
    };
    window.addEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, receive);
    const InlineMenu = createRichTextField('본문').renderInlineMenu;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => {
      window.removeEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, receive);
      act(() => root.unmount());
    });

    await act(async () => {
      root.render(<InlineMenu editor={editor} editorState={null} readOnly={false}>서식</InlineMenu>);
    });
    selection.empty = false;
    selection.to = 7;
    await act(async () => emit('selectionUpdate'));
    selection.empty = true;
    selection.from = 7;
    await act(async () => emit('selectionUpdate'));

    expect(states).toEqual([false, true, false]);
  });

  it('subscribes safely before the Tiptap view is mounted', async () => {
    const on = vi.fn();
    const off = vi.fn();
    const editor = {
      state: { selection: { empty: true, from: 1, to: 1 } },
      get view() { throw new Error('view is not mounted'); },
      getAttributes: vi.fn(() => ({})),
      isActive: vi.fn(() => false),
      on,
      off,
    } as never;
    const InlineMenu = createRichTextField('본문').renderInlineMenu;
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    let unmounted = false;
    mounted.push(() => {
      if (!unmounted) act(() => root.unmount());
    });

    await act(async () => {
      root.render(<InlineMenu editor={editor} editorState={null} readOnly={false}>서식</InlineMenu>);
    });
    expect(on).toHaveBeenCalledWith('selectionUpdate', expect.any(Function));
    expect(on).toHaveBeenCalledWith('transaction', expect.any(Function));

    await act(async () => root.unmount());
    unmounted = true;
    expect(off).toHaveBeenCalledWith('selectionUpdate', expect.any(Function));
    expect(off).toHaveBeenCalledWith('transaction', expect.any(Function));
  });

  it('provides stable container controls to every built-in block', () => {
    for (const [component, config] of Object.entries(pageBuilderPuckConfig.components)) {
      expect(config.fields, component).toMatchObject({
        containerWidth: { type: 'custom' },
        containerAlign: { type: 'custom' },
        minHeight: { type: 'custom' },
        verticalAlign: { type: 'custom' },
      });
    }
  });

  it('provides selected-range rich text editing across all long-copy product families', () => {
    const components = pageBuilderPuckConfig.components as Record<string, { fields: Record<string, any> }>;
    const field = (component: string, path: string[]): any => path.reduce(
      (value, segment) => segment === '[]' ? value.arrayFields : value[segment],
      components[component].fields as any,
    );
    const cases: Array<[string, string[]]> = [
      ['Hero', ['body']],
      ['RichText', ['content']],
      ['ImageText', ['body']],
      ['HeroSplit', ['body']],
      ['HeroSlider', ['slides', '[]', 'body']],
      ['Testimonials', ['items', '[]', 'quote']],
      ['FaqAccordion', ['items', '[]', 'answer']],
      ['ProcessTimeline', ['items', '[]', 'body']],
      ['Tabs', ['items', '[]', 'body']],
      ['ArticleList', ['items', '[]', 'summary']],
      ['TestimonialSlider', ['items', '[]', 'quote']],
      ['EventSchedule', ['items', '[]', 'description']],
      ['DownloadResources', ['items', '[]', 'description']],
      ['Blockquote', ['quote']],
      ['Notice', ['body']],
      ['CardGrid', ['items', '[]', 'body']],
    ];

    for (const [component, path] of cases) {
      expect(field(component, path), `${component}.${path.join('.')}`).toMatchObject({
        type: 'richtext',
        contentEditable: true,
      });
    }
  });

  it('closes the element-wide balloon on outside click and follows the canonical rich-text range state', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.append(outside);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));
    await act(async () => {
      root.render(<PuckEditorAdapter document={fixture} revisionKey={0} iframeEnabled={false}
        onChange={() => undefined} onPublish={() => undefined} />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CANVAS_ELEMENT_MESSAGE, { detail: {
        blockId: fixture.blocks[0].instance_id,
        blockType: 'hero',
        fieldPath: 'title',
        role: 'text',
        label: '제목',
      } }));
    });
    expect(await eventually<HTMLElement>('[data-testid="page-builder-context-panel"]')).not.toBeNull();

    await act(async () => { outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    expect(document.querySelector('[data-testid="page-builder-context-panel"]')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(CANVAS_ELEMENT_MESSAGE, { detail: {
        blockId: fixture.blocks[0].instance_id,
        blockType: 'hero',
        fieldPath: 'body',
        role: 'text',
        label: '본문',
      } }));
      window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_STATE_MESSAGE, { detail: { active: true } }));
    });
    expect(document.querySelector('[data-testid="page-builder-context-panel"]')).toBeNull();

    await act(async () => {
      window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_STATE_MESSAGE, { detail: { active: false } }));
    });
    expect(await eventually<HTMLElement>('[data-testid="page-builder-context-panel"]')).not.toBeNull();
  });

  it('keeps structured inline copy visible in every official Page Kit', async () => {
    const cases: Array<{ document: PageBuilderDocument; checks: Array<[string, string]> }> = [
      {
        document: companyPageKit as unknown as PageBuilderDocument,
        checks: [
          ['[data-block-type="stats"] [data-g7pb-inline-field="items.0.value"]', '120+'],
          ['[data-block-type="team"] [data-g7pb-inline-field="members.0.name"]', '김기획'],
          ['[data-block-type="testimonials"] [data-g7pb-inline-field="items.0.quote"]', '기획과 제작'],
        ],
      },
      {
        document: servicePageKit as unknown as PageBuilderDocument,
        checks: [
          ['[data-block-type="icon-list"] [data-g7pb-inline-field="items.0.title"]', '문제 정의'],
          ['[data-block-type="process-timeline"] [data-g7pb-inline-field="items.0.title"]', '현재 확인'],
          ['[data-block-type="faq-accordion"] [data-g7pb-inline-field="items.0.question"]', '요청 범위'],
        ],
      },
      {
        document: localBusinessPageKit as unknown as PageBuilderDocument,
        checks: [
          ['[data-block-type="process-timeline"] [data-g7pb-inline-field="items.0.body"]', '방문 희망 시간'],
          ['[data-block-type="testimonials"] [data-g7pb-inline-field="items.0.name"]', '김민지'],
        ],
      },
      {
        document: eventPageKit as unknown as PageBuilderDocument,
        checks: [
          ['[data-block-type="event-schedule"] [data-g7pb-inline-field="items.0.title"]', '오프닝 키노트'],
          ['[data-block-type="logo-cloud"] [data-g7pb-inline-field="logos.0.name"]', 'Northstar'],
          ['[data-block-type="faq-accordion"] [data-g7pb-inline-field="items.0.question"]', '참가 신청'],
        ],
      },
      {
        document: editorialPageKit as unknown as PageBuilderDocument,
        checks: [
          ['[data-block-type="article-list"] [data-g7pb-inline-field="items.0.title"]', '한 자리를 오래'],
          ['[data-block-type="event-schedule"] [data-g7pb-inline-field="items.0.location"]', '중앙도서관 앞'],
          ['[data-block-type="download-resources"] [data-g7pb-inline-field="items.0.title"]', '동네 인터뷰 질문지'],
        ],
      },
    ];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));

    for (const [index, pageKit] of cases.entries()) {
      await act(async () => {
        root.render(<PuckEditorAdapter key={pageKit.document.document_id} document={pageKit.document} revisionKey={index} iframeEnabled={false}
          onChange={() => undefined} onPublish={() => undefined} />);
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      for (const [selector, expected] of pageKit.checks) {
        await eventuallyContains(selector, expected);
      }
    }
  }, 15_000);

  it('shows builder-owned Header and Footer in the canvas and edits them without leaving the document work surface', async () => {
    const resource = (kind: 'header' | 'footer'): SitePartResource => ({
      title: kind === 'header' ? '사이트 Header' : '사이트 Footer',
      document: {
        schema_version: 'g7-page-builder/site-part/v1',
        site_part_id: kind === 'header' ? '123e4567-e89b-42d3-a456-426614174070' : '123e4567-e89b-42d3-a456-426614174071',
        kind,
        locale: 'ko',
        tokens: {},
        blocks: [{
          instance_id: kind === 'header' ? '123e4567-e89b-42d3-a456-426614174072' : '123e4567-e89b-42d3-a456-426614174073',
          type: kind === 'header' ? 'site.header.navigation-01' : 'site.footer.simple-01',
          block_version: 1,
          props: kind === 'header'
            ? { brand_name: '지원소프트', home_url: '/', logo_url: '', variant: 'solid', sticky: true, navigation: [], cta: null, mobile_menu: true, mobile_menu_style: 'drawer-right' }
            : { brand_name: '지원소프트', home_url: '/', navigation: [], footer_text: 'Copyright' },
          slots: {},
        }],
      },
      lock_version: 1,
      revision: 1,
      active_revision: 1,
      status: 'published',
      created_at: '2026-08-21T00:00:00+09:00',
      updated_at: '2026-08-21T00:00:00+09:00',
      published_at: '2026-08-21T00:00:00+09:00',
    });
    vi.spyOn(PageBuilderApiClient.prototype, 'getSitePart').mockImplementation(async (kind) => resource(kind));
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));

    await act(async () => {
      root.render(<PuckEditorAdapter document={{ ...fixture, shell_mode: 'builder' }} revisionKey={0} iframeEnabled={false}
        onChange={() => undefined} onPublish={() => undefined} />);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect((await eventually<HTMLElement>('[data-testid="page-builder-canvas-header"]')).textContent).toContain('지원소프트');
    expect((await eventually<HTMLElement>('[data-testid="page-builder-canvas-footer"]')).textContent).toContain('Copyright');
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="page-builder-canvas-header"] .g7pb-full-site-part__edit')?.click();
    });
    expect((await eventually<HTMLElement>('[data-testid="page-builder-site-part-editor"]')).dataset.kind).toBe('header');
    await act(async () => {
      document.querySelector<HTMLButtonElement>('button[aria-label="페이지 편집으로 돌아가기"]')?.click();
    });
    expect(await eventually<HTMLElement>('[data-testid="page-builder-canvas-page"]')).not.toBeNull();
  });

  it('lets the Hero-family advisory stay dismissed until the block count changes', async () => {
    const secondHero = {
      ...structuredClone(fixture.blocks[0]),
      instance_id: '623e4567-e89b-42d3-a456-426614174005',
      props: { ...structuredClone(fixture.blocks[0].props), title: 'Second Hero' },
    };
    const thirdHero = {
      ...structuredClone(fixture.blocks[0]),
      instance_id: '723e4567-e89b-42d3-a456-426614174006',
      props: { ...structuredClone(fixture.blocks[0].props), title: 'Third Hero' },
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
    });

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={{ ...fixture, blocks: [...fixture.blocks, secondHero] }}
          revisionKey={0}
          iframeEnabled={false}
          onChange={() => undefined}
          onPublish={() => undefined}
        />,
      );
    });

    expect((await eventually<HTMLElement>('[data-testid="page-builder-hero-warning"]')).textContent)
      .toContain('Hero 계열 블록이 2개');
    const dismiss = await eventually<HTMLButtonElement>('[data-testid="page-builder-hero-warning-dismiss"]');
    await act(async () => {
      dismiss.click();
    });
    expect(document.querySelector('[data-testid="page-builder-hero-warning"]')).toBeNull();

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={{ ...fixture, blocks: [...fixture.blocks, secondHero, thirdHero] }}
          revisionKey={1}
          iframeEnabled={false}
          onChange={() => undefined}
          onPublish={() => undefined}
        />,
      );
    });

    expect((await eventually<HTMLElement>('[data-testid="page-builder-hero-warning"]')).textContent)
      .toContain('Hero 계열 블록이 3개');
  });

  it('renders stable block and inspector selectors through the adapter', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    vi.spyOn(PageBuilderApiClient.prototype, 'getRouteCatalog').mockResolvedValue({
      active_template: 'default',
      routes: [{ id: 'login', label: '로그인', path: '/login', category: '회원', parameters: [],
        parameter_sources: {}, auth_required: false, guest_only: true, source: { kind: 'core', identifier: null } }],
    });
    mounted.push(() => {
      act(() => root.unmount());
    });

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={fixture}
          revisionKey={0}
          iframeEnabled={false}
          onChange={onChange}
          onPublish={() => undefined}
        />,
      );
    });

    const hero = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="hero"]');
    const features = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="features"]');
    const cta = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="cta"]');
    const contact = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="contact"]');
    expect(editorElements('[data-testid="page-builder-block"]')).toHaveLength(4);
    expect((await eventually<HTMLElement>('[data-testid="page-builder-canvas-header"]')).textContent).toContain('G7 활성 템플릿 Header');
    expect((await eventually<HTMLElement>('[data-testid="page-builder-canvas-footer"]')).textContent).toContain('G7 활성 템플릿 Footer');
    expect(hero.textContent).toContain('Hero body');
    expect(hero.textContent).not.toContain('[object Object]');

    await act(async () => {
      hero.click();
    });
    expect(hero.querySelector('[data-g7pb-inline-field="title"]')?.textContent).toContain('Hero title');
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-hero-subtitle"]')).value).toBe('Hero eyebrow');

    const heroTitle = hero.querySelector<HTMLElement>('[data-g7pb-inline-field="title"]');
    await act(async () => {
      heroTitle?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const textScaleMarker = await eventually<HTMLSelectElement>('[data-testid="page-builder-text-scale"]');
    await act(async () => {
      textScaleMarker.value = 'large';
      textScaleMarker.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onChange.mock.calls.some(([changed]) => changed.blocks[0].props.appearance?.elements?.title?.size === 'large'
      && changed.blocks[0].props.appearance?.textScale === undefined)).toBe(true);
    expect(await eventually('[data-block-type="hero"] [data-g7pb-inline-field="title"].g7pb-element-size--large')).not.toBeNull();
    expect(editorElements('[data-block-type="hero"] [data-g7pb-inline-field="body"]')[0]?.classList.contains('g7pb-element-size--large')).toBe(false);
    const serifMarker = await eventually<HTMLSelectElement>('[data-testid="page-builder-element-font"]');
    await act(async () => {
      serifMarker.value = 'serif';
      serifMarker.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onChange.mock.calls.some(([changed]) => changed.blocks[0].props.appearance?.elements?.title?.font === 'serif')).toBe(true);
    expect(await eventually('[data-block-type="hero"] [data-g7pb-inline-field="title"].g7pb-element-font--serif')).not.toBeNull();
    const alignRightMarker = await eventually<HTMLElement>('[data-testid="page-builder-text-align-right"]');
    await act(async () => {
      alignRightMarker.closest('button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onChange.mock.calls.some(([changed]) => changed.blocks[0].props.appearance?.elements?.title?.size === 'large'
      && changed.blocks[0].props.appearance?.elements?.title?.align === 'right')).toBe(true);

    const darkTheme = await eventually<HTMLButtonElement>('button[aria-label="다크 테마"]');
    await act(async () => {
      darkTheme.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect((await eventually<HTMLElement>('.g7pb-preview-page')).classList.contains('g7pb-theme-mode-dark')).toBe(true);

    const heroImage = hero.querySelector<HTMLElement>('[data-g7pb-media-field="imageSrc"]');
    expect(heroImage).not.toBeNull();
    await act(async () => {
      heroImage?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.body.textContent).toContain('이미지 · 이미지');
    const mediaOpenMarker = await eventually<HTMLElement>('[data-testid="page-builder-canvas-media-open"]');
    await act(async () => {
      mediaOpenMarker.closest('button')?.click();
    });
    expect(await eventually<HTMLElement>('[data-testid="page-builder-media-library"]')).not.toBeNull();
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="page-builder-media-open"]')?.click();
      hero.querySelector<HTMLElement>('[data-g7pb-inline-field="primaryLabel"]')
        ?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const routeOpenMarker = await eventually<HTMLElement>('[data-testid="page-builder-canvas-route-open"]');
    expect(routeOpenMarker).not.toBeNull();
    const elementRouteOpenMarker = await eventually<HTMLButtonElement>('[data-testid="page-builder-element-route-open"]');
    await act(async () => {
      elementRouteOpenMarker.click();
    });
    expect(await eventually<HTMLElement>('[data-testid="page-builder-route-picker"]')).not.toBeNull();
    await act(async () => {
      (await eventually<HTMLButtonElement>('.g7pb-route-picker__routes button')).click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onChange.mock.calls.some(([changed]) => changed.blocks[0].props.primaryCta?.url === '/login')).toBe(true);
    expect(document.querySelector('[data-testid="page-builder-route-picker"]')).toBeNull();

    await act(async () => {
      features.click();
    });
    expect(features.querySelector('[data-g7pb-inline-field="title"]')?.textContent).toContain('Features title');
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-features-item-0-title"]')).value).toBe('First title');
    expect((await eventually<HTMLTextAreaElement>('[data-testid="page-builder-features-item-0-body"]')).value).toBe('First body');
    const firstFeatureTitle = features.querySelector<HTMLElement>('[data-g7pb-inline-field="items.0.title"]');
    await act(async () => {
      firstFeatureTitle?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.body.textContent).toContain('제목 · 1번 항목 · 텍스트');
    const duplicateItem = await eventually<HTMLElement>('[data-testid="page-builder-item-duplicate"]');
    await act(async () => {
      duplicateItem.closest('button')?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(onChange.mock.calls.some(([changed]) => changed.blocks[1].props.items?.length === 3)).toBe(true);

    await act(async () => {
      cta.click();
    });
    expect(cta.querySelector('[data-g7pb-inline-field="heading"]')?.textContent).toContain('CTA heading');
    expect((await eventually<HTMLTextAreaElement>('[data-testid="page-builder-cta-body"]')).value).toBe('CTA body');
    expect((await eventually<HTMLSelectElement>('[data-testid="page-builder-cta-theme"]')).value).toBe('dark');

    await act(async () => {
      contact.click();
    });
    expect(contact.querySelector('[data-g7pb-inline-field="heading"]')?.textContent).toContain('Contact heading');
    expect((await eventually<HTMLTextAreaElement>('[data-testid="page-builder-contact-address"]')).value).toBe('Seoul address');
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-contact-email"]')).value).toBe('hello@example.com');

    await act(async () => {
      features.click();
    });

    const moveUpMarker = await eventually<HTMLElement>('[data-testid="page-builder-block-move-up"]');
    const moveUp = moveUpMarker.closest('button');
    expect(moveUp).not.toBeNull();
    expect(moveUp?.disabled).toBe(false);
    await act(async () => {
      moveUp?.click();
    });

    await eventuallyBlockTypes(['features', 'hero', 'cta', 'contact']);
    expect(features.querySelector('[data-g7pb-inline-field="title"]')?.textContent).toContain('Features title');
  });

  it('shows descriptive previews before a block is inserted', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
    });

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={{ ...fixture, blocks: [] }}
          revisionKey={0}
          iframeEnabled={false}
          onChange={() => undefined}
          onPublish={() => undefined}
        />,
      );
    });

    const library = await eventually<HTMLElement>('[data-testid="page-builder-block-library"]');
    expect(library.textContent).toContain('실제 화면을 확인하고 블록을 선택하세요.');
    expect(library.textContent).not.toContain('끌어');
    expect(library.textContent).toContain('완성 섹션과 모든 출처 보기');
    for (const component of [
      'Hero',
      'Heading',
      'RichText',
      'Image',
      'Buttons',
      'ImageText',
      'IconList',
      'HeroSplit',
      'HeroSlider',
      'Features',
      'Cta',
      'Contact',
      'LogoCloud',
      'Stats',
      'Pricing',
      'Team',
      'Gallery',
      'BarChart',
      'Divider',
      'Blockquote',
      'Notice',
      'CardGrid',
      'Breadcrumbs',
      'AnchorMenu',
      'SocialLinks',
      'ImageCarousel',
    ]) {
      const drawerItem = await eventually<HTMLElement>(`[data-testid="drawer-item:${component}"]`);
      expect(drawerItem.querySelector(`[data-library-block="${component}"]`)).not.toBeNull();
      expect(drawerItem.querySelector('[data-block-preview]')).not.toBeNull();
      expect(drawerItem.querySelector('.g7pb-block-thumb__zoom')).toBeNull();
    }

    const mobileViewport = await eventually<HTMLButtonElement>('[data-testid="page-builder-viewport-360"]');
    const tabletViewport = await eventually<HTMLButtonElement>('[data-testid="page-builder-viewport-768"]');
    const desktopViewport = await eventually<HTMLButtonElement>('[data-testid="page-builder-viewport-1280"]');
    expect(desktopViewport.getAttribute('aria-pressed')).toBe('true');
    expect(mobileViewport.getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      mobileViewport.click();
    });
    expect(mobileViewport.getAttribute('aria-pressed')).toBe('true');
    expect(tabletViewport.getAttribute('aria-pressed')).toBe('false');

    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
    const addButton = await eventually<HTMLButtonElement>('[data-testid="page-builder-add-block"]');
    expect(addButton.textContent).toContain('블록 추가');
    await act(async () => {
      addButton.click();
    });

    const gallery = await eventually<HTMLElement>('[data-testid="page-builder-block-gallery"]');
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(Array.from(gallery.querySelectorAll('[role="tab"]')).map((tab) => tab.textContent)).toEqual([
      '전체140', '블록 종류45', '완성 섹션95',
    ]);
    expect(Array.from(gallery.querySelector<HTMLSelectElement>('[aria-label="블록 팩"]')?.options ?? [])
      .map((option) => option.textContent)).toEqual(['모든 출처', '기본 제공']);
    expect(gallery.querySelector('.g7pb-block-thumb__zoom')).toBeNull();
    expect(gallery.querySelector('.g7pb-block-gallery__grid')?.getAttribute('data-total-items')).toBe('140');
    expect(gallery.querySelector('.g7pb-block-gallery__grid')?.getAttribute('data-rendered-items')).toBe('24');
    expect(gallery.querySelectorAll('[data-block-preview]')).toHaveLength(24);
    for (let batch = 0; batch < 5; batch += 1) {
      await act(async () => {
        gallery.querySelector<HTMLButtonElement>('[data-testid="page-builder-gallery-load-more"]')?.click();
      });
    }
    expect(gallery.querySelectorAll('[data-block-preview]')).toHaveLength(140);
    expect(gallery.textContent).toContain('히어로');
    expect(gallery.textContent).toContain('제목');
    expect(gallery.textContent).toContain('리치텍스트');
    expect(gallery.textContent).toContain('단일 이미지');
    expect(gallery.textContent).toContain('버튼 묶음');
    expect(gallery.textContent).toContain('이미지 + 텍스트');
    expect(gallery.textContent).toContain('아이콘 목록');
    expect(gallery.textContent).toContain('섹션 시작 제목');
    expect(gallery.textContent).toContain('제품 소개 히어로');
    expect(gallery.textContent).toContain('특징 목록');
    expect(gallery.textContent).toContain('행동 유도');
    expect(gallery.textContent).toContain('연락처');
    expect(gallery.textContent).toContain('슬라이더 히어로');
    expect(gallery.textContent).toContain('요금제');
    expect(gallery.textContent).toContain('팀 소개');
    expect(gallery.textContent).toContain('갤러리 그리드');
    expect(gallery.textContent).toContain('막대그래프');
    expect(gallery.textContent).toContain('G7 최근 게시글');
    expect(gallery.textContent).toContain('G7 상품 그리드');
    expect(gallery.textContent).toContain('고객 후기');
    expect(gallery.textContent).toContain('FAQ 아코디언');
    expect(gallery.textContent).toContain('프로세스·타임라인');
    expect(gallery.textContent).toContain('탭 콘텐츠');
    expect(gallery.textContent).toContain('비교표');
    expect(gallery.textContent).toContain('에디토리얼 목록');
    expect(gallery.textContent).toContain('영상');
    expect(gallery.textContent).toContain('로고 캐러셀');
    expect(gallery.textContent).toContain('후기 슬라이더');
    expect(gallery.textContent).toContain('이벤트 일정');
    expect(gallery.textContent).toContain('다운로드 자료');
    expect(gallery.textContent).toContain('G7 콘텐츠 아카이브');
    expect(gallery.textContent).toContain('G7 상품 쇼케이스');
    expect(gallery.textContent).toContain('G7 게시글 상세');
    expect(gallery.textContent).toContain('G7 상품 상세');
    expect(gallery.textContent).toContain('구분선');
    expect(gallery.textContent).toContain('인용문');
    expect(gallery.textContent).toContain('알림·안내');
    expect(gallery.textContent).toContain('카드 그리드');
    expect(gallery.textContent).toContain('경로 탐색');
    expect(gallery.textContent).toContain('섹션 바로가기');
    expect(gallery.textContent).toContain('소셜 링크');
    expect(gallery.textContent).toContain('이미지 캐러셀');
    expect(gallery.textContent).toContain('자주 쓰는 기본 블록');
    expect(gallery.querySelectorAll('[data-testid^="page-builder-quick-add-"]')).toHaveLength(6);
    const categorySelect = gallery.querySelector<HTMLSelectElement>('[aria-label="블록 분류"]');
    expect(Array.from(categorySelect?.options ?? []).map((option) => option.textContent)).toEqual([
      '전체 분류', '기본', '첫 화면·전환', '콘텐츠', '미디어', '탐색', '신뢰·회사', '데이터·비교', '문의·방문', 'G7 데이터',
    ]);
    builtinManifest.presets.forEach((preset) => {
      const slug = preset.preset_id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const button = gallery.querySelector<HTMLButtonElement>(`[data-testid="page-builder-preset-${slug}"]`);
      expect(button, preset.preset_id).not.toBeNull();
      expect(button?.textContent).toContain(preset.label.ko);
      expect(button?.querySelector('[data-block-preview]')).not.toBeNull();
    });

    await act(async () => {
      gallery.querySelector<HTMLButtonElement>('[data-testid="page-builder-preset-heading-section-intro"]')?.click();
    });
    expect((await eventually<HTMLElement>('[data-block-type="heading"]')).textContent)
      .toContain('방문자가 먼저 알아야 할 내용');
  });

  it('coalesces rapid inspector typing into one canonical conversion per animation frame', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const onChange = vi.fn();
    const onDirty = vi.fn();
    mounted.push(() => { act(() => root.unmount()); });

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={fixture}
          revisionKey={0}
          iframeEnabled={false}
          onDirty={onDirty}
          onChange={onChange}
          onPublish={() => undefined}
        />,
      );
    });
    const hero = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="hero"]');
    await act(async () => { hero.click(); });
    const subtitle = await eventually<HTMLInputElement>('[data-testid="page-builder-hero-subtitle"]');

    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameId += 1;
      frames.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
    onChange.mockClear();
    onDirty.mockClear();

    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    await act(async () => {
      for (const value of ['첫', '첫 화', '첫 화면']) {
        setValue?.call(subtitle, value);
        subtitle.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    expect(onDirty).toHaveBeenCalledTimes(3);
    expect(onChange).not.toHaveBeenCalled();
    expect(frames.size).toBeGreaterThanOrEqual(1);
    await act(async () => {
      const queuedFrames = Array.from(frames.values());
      frames.clear();
      for (const callback of queuedFrames) callback(16);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.lastCall?.[0].blocks[0].props.eyebrow).toBe('첫 화면');
  });

  it('uses the actor catalog for search, categories, favorites, and preset insertion', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    const catalog = {
      items: [
        {
          catalog_id: 'block:content.hero-centered-01@1', kind: 'definition',
          block_id: 'content.hero-centered-01', block_version: 1,
          pack_id: 'builtin/core', pack_version: '0.6.0', category: 'hero',
          label: { ko: '서버 히어로', en: 'Server Hero' },
          description: { ko: '서버 카탈로그 정의', en: 'Server catalog definition' },
          thumbnail: 'thumbnails/hero.svg', editor_component: 'Hero', favorite: true,
          insertable: true, preset_props: null,
        },
        {
          catalog_id: 'preset:vendor/marketing:promotion', kind: 'preset',
          block_id: 'content.hero-centered-01', block_version: 1,
          pack_id: 'vendor/marketing', pack_version: '1.0.0', category: 'marketing',
          label: { ko: '프로모션 히어로', en: 'Promotion hero' },
          description: { ko: '설치한 데이터 프리셋', en: 'Installed data preset' },
          thumbnail: 'thumbnails/promotion.svg', editor_component: 'Hero', favorite: false,
          insertable: true,
          preset_props: {
            eyebrow: '한정 혜택', title: '프로모션 제목', body: '<p>프로모션 본문</p>', alignment: 'center',
          },
        },
        {
          catalog_id: 'block:vendor.missing-01@1', kind: 'definition',
          block_id: 'vendor.missing-01', block_version: 1,
          pack_id: 'vendor/missing', pack_version: '1.0.0', category: 'content',
          label: { ko: '로드되지 않은 블록' }, description: { ko: '표시하면 안 됩니다.' },
          thumbnail: 'missing.svg', editor_component: 'MissingRuntime', favorite: false,
          insertable: true, preset_props: null,
        },
      ],
      categories: ['hero', 'marketing'],
    };
    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: catalog }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true, message: 'ok', data: { catalog_id: 'preset:vendor/marketing:promotion', favorite: true },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const onChange = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => { act(() => root.unmount()); });
    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={{ ...fixture, locale: 'en', blocks: [] }} revisionKey={0} iframeEnabled={false}
          onChange={onChange} onPublish={() => undefined}
        />,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const addButton = await eventually<HTMLButtonElement>('[data-testid="page-builder-add-block"]');
    await act(async () => { addButton.click(); });
    const gallery = await eventually<HTMLElement>('[data-testid="page-builder-block-gallery"]');
    expect(gallery.textContent).toContain('Server Hero');
    expect(gallery.textContent).toContain('Promotion hero');
    expect(gallery.textContent).not.toContain('로드되지 않은 블록');
    expect(Array.from(gallery.querySelector<HTMLSelectElement>('[aria-label="블록 팩"]')?.options ?? [])
      .map((option) => option.textContent)).toEqual(['모든 출처', '기본 제공', 'marketing']);

    const presetTab = Array.from(gallery.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab) => tab.textContent?.includes('완성 섹션'));
    await act(async () => { presetTab?.click(); });
    expect(gallery.textContent).not.toContain('Server Hero');
    expect(gallery.textContent).toContain('Promotion hero');
    const allTab = Array.from(gallery.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((tab) => tab.textContent?.includes('전체'));
    await act(async () => { allTab?.click(); });

    const search = gallery.querySelector<HTMLInputElement>('[aria-label="블록 검색"]');
    await act(async () => {
      if (search) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, '프로모션');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(gallery.textContent).not.toContain('Server Hero');
    expect(gallery.textContent).toContain('Promotion hero');

    const favorite = gallery.querySelector<HTMLButtonElement>('[aria-label="Promotion hero 즐겨찾기 추가"]');
    await act(async () => {
      favorite?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(gallery.querySelector('[aria-label="Promotion hero 즐겨찾기 해제"]')).not.toBeNull();

    const preset = gallery.querySelector<HTMLButtonElement>('[data-testid="page-builder-block-preset-vendor-marketing-promotion"]');
    await act(async () => {
      preset?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall?.[0].blocks[0]).toMatchObject({
      type: 'content.hero-centered-01', block_version: 1,
      props: { eyebrow: '한정 혜택', title: '프로모션 제목' },
    });
  });
});
