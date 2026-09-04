import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasCurrentElementStylesContext, normalizeElementAppearanceMap } from '../../resources/js/editor/canvasEditingContract';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const {
  createInlineRichTextField,
  createRichTextField,
  G7SingleLineRichText,
  RichTextCanvasField,
} = await import('../../resources/js/editor/richTextEditing');

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function editorState(overrides: Record<string, boolean> = {}): Record<string, boolean> {
  return {
    g7HasSelection: true,
    g7CanLink: true,
    g7FontInherit: true,
    g7SizeBase: true,
    g7WeightRegular: true,
    g7ToneDefault: true,
    isBold: false,
    canBold: true,
    isItalic: false,
    canItalic: true,
    isUnderline: false,
    canUnderline: true,
    isLink: false,
    ...overrides,
  };
}

function renderInlineMenu(
  field: ReturnType<typeof createRichTextField>,
  editor: unknown,
  readOnly = false,
): { container: HTMLDivElement; rerender: (nextState: Record<string, boolean>, next?: { editor?: unknown; readOnly?: boolean }) => Promise<void> } {
  const InlineMenu = field.renderInlineMenu;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(() => act(() => root.unmount()));

  return {
    container,
    rerender: async (nextState: Record<string, boolean>, next?: { editor?: unknown; readOnly?: boolean }): Promise<void> => {
      if (next && 'editor' in next) editor = next.editor;
      if (next?.readOnly !== undefined) readOnly = next.readOnly;
      await act(async () => {
        root.render(
          <InlineMenu editor={editor as never} editorState={nextState as never} readOnly={readOnly}>
            <span data-testid="puck-default-inline-controls">기본 B/I/U</span>
          </InlineMenu>,
        );
      });
    },
  };
}

describe('Puck-native rich-text editing', () => {
  it('keeps readonly rich-text headings on the same semantic typography as editable headings', () => {
    const css = readFileSync(resolve('resources/css/page-builder-editor-wysiwyg.css'), 'utf8');
    const semanticHeadingRule = css.match(/\[data-g7pb-heading-level\] :is\([^}]+\) \{([^}]+)\}/s);
    expect(semanticHeadingRule?.[0]).toContain(':is([contenteditable], p)');
    expect(semanticHeadingRule?.[1]).toContain('color: inherit');
    expect(semanticHeadingRule?.[1]).toContain('font-size: inherit');
    expect(semanticHeadingRule?.[1]).toContain('line-height: inherit');
  });

  it('preserves explicit strong weights and restores the semantic default without replacing field content', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));
    let previousField: Element | null = null;
    let previousContent: Element | null = null;
    for (const weight of ['regular', 'medium', 'bold', undefined, 'regular']) {
      const styles = normalizeElementAppearanceMap({ 'columns.0.title': weight ? { weight } : {} });
      await act(async () => {
        root.render(
          <CanvasCurrentElementStylesContext.Provider value={styles}>
            <RichTextCanvasField as="strong" fieldPath="columns.0.title">
              <span contentEditable suppressContentEditableWarning>합성 비교 열 제목</span>
            </RichTextCanvasField>
          </CanvasCurrentElementStylesContext.Provider>,
        );
      });
      const field = container.querySelector('[data-g7pb-inline-field="columns.0.title"]');
      if (!field) throw new Error('Expected the rendered strong field');
      const content = field.querySelector('[contenteditable]');
      expect(field.getAttribute('role')).toBe('strong');
      expect(field.getAttribute('data-g7pb-richtext-display')).toBe('strong');
      expect(field.classList.contains(`g7pb-element-weight--${weight ?? 'regular'}`)).toBe(true);
      expect(field.classList.contains('g7pb-element-weight--bold')).toBe(weight === 'bold');
      expect(field.classList.contains('g7pb-element-weight--strong-default')).toBe(weight === undefined);
      expect(field.textContent).toBe('합성 비교 열 제목');
      expect(content).not.toBeNull();
      if (previousField) {
        expect(field).toBe(previousField);
        expect(content).toBe(previousContent);
      }
      previousField = field;
      previousContent = content;
    }
  });

  it.each([
    { label: 'explicit regular', appearance: { weight: 'regular' }, headingDefault: false },
    { label: 'absent weight', appearance: {}, headingDefault: true },
  ])('distinguishes $label from the semantic heading default after normalization', async ({ appearance, headingDefault }) => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));
    const styles = normalizeElementAppearanceMap({ heading: appearance });
    await act(async () => {
      root.render(
        <CanvasCurrentElementStylesContext.Provider value={styles}>
          <RichTextCanvasField as="h2" fieldPath="heading"><span>합성 제목</span></RichTextCanvasField>
        </CanvasCurrentElementStylesContext.Provider>,
      );
    });
    const heading = container.querySelector('[data-g7pb-inline-field="heading"]');
    if (!heading) throw new Error('Expected the rendered heading field');
    expect(heading.getAttribute('role')).toBe('heading');
    expect(heading.getAttribute('aria-level')).toBe('2');
    expect(heading.classList.contains('g7pb-element-weight--regular')).toBe(true);
    expect(heading.classList.contains('g7pb-element-weight--heading-default')).toBe(headingDefault);
    expect(heading.textContent).toBe('합성 제목');
  });

  function markEditor() {
    const chain = { focus: vi.fn(() => chain), setMark: vi.fn(() => chain), unsetMark: vi.fn(() => chain), run: vi.fn(() => true) };
    return { state: { selection: { empty: false, from: 3, to: 7 } }, chain: vi.fn(() => chain), operations: chain };
  }

  async function pointer(element: Element, type: 'pointerdown' | 'pointerup'): Promise<void> {
    await act(async () => { element.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, button: 0, pointerId: 71, pointerType: 'touch',
    })); });
  }

  async function openFont(container: HTMLElement): Promise<HTMLButtonElement> {
    const trigger = container.querySelector('[data-testid="page-builder-richtext-font"]');
    if (!trigger) throw new Error('Expected the font control');
    await pointer(trigger, 'pointerdown');
    const option = [...document.body.querySelectorAll<HTMLButtonElement>('[role="option"]')]
      .find(element => element.textContent?.includes('명조'));
    if (!option) throw new Error('Expected the serif option');
    return option;
  }

  it('does not let a delayed font close dismiss a subsequently opened tone menu', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const editor = markEditor();
    const rendered = renderInlineMenu(createRichTextField('본문'), editor);
    await rendered.rerender(editorState());
    const option = await openFont(rendered.container);
    await pointer(option, 'pointerdown');
    await pointer(option, 'pointerup');
    const tone = rendered.container.querySelector('[data-testid="page-builder-richtext-tone"]');
    if (!tone) throw new Error('Expected the tone control');
    await pointer(tone, 'pointerdown');
    expect(tone.getAttribute('aria-expanded')).toBe('true');
    await act(async () => { vi.advanceTimersByTime(60); });
    expect(tone.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe('선택한 글자 색상');
    expect(editor.operations.run).toHaveBeenCalledOnce();
  });

  it('does not reopen narrow advanced controls by keyboard after becoming readonly', async () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    try {
      const rendered = renderInlineMenu(createRichTextField('본문'), markEditor());
      await rendered.rerender(editorState());
      const more = rendered.container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-more"]');
      if (!more) throw new Error('Expected narrow advanced control');
      await pointer(more, 'pointerdown');
      expect(document.body.querySelector('[data-testid="page-builder-richtext-advanced-panel"]')).not.toBeNull();
      await rendered.rerender(editorState(), { readOnly: true });
      expect(document.body.querySelector('[data-testid="page-builder-richtext-advanced-panel"]')).toBeNull();
      await act(async () => { more.click(); });
      expect(document.body.querySelector('[data-testid="page-builder-richtext-advanced-panel"]')).toBeNull();
      expect(more.disabled).toBe(true);
      await rendered.rerender(editorState(), { readOnly: false });
      await act(async () => { more.click(); });
      expect(document.body.querySelector('[data-testid="page-builder-richtext-advanced-panel"]')).not.toBeNull();
    } finally {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
    }
  });

  it.each(['editor', 'readonly'] as const)('discards a pending option gesture after %s changes and permits a fresh gesture', async (change) => {
    const first = markEditor();
    const second = markEditor();
    const rendered = renderInlineMenu(createRichTextField('본문'), first);
    await rendered.rerender(editorState());
    const staleOption = await openFont(rendered.container);
    await pointer(staleOption, 'pointerdown');
    await rendered.rerender(editorState(), change === 'editor' ? { editor: second } : { readOnly: true });
    await pointer(staleOption, 'pointerup');
    expect(first.operations.run).not.toHaveBeenCalled();
    expect(second.operations.run).not.toHaveBeenCalled();
    expect(staleOption.isConnected).toBe(false);
    await rendered.rerender(editorState(), { editor: second, readOnly: false });
    const freshOption = await openFont(rendered.container);
    await pointer(freshOption, 'pointerdown');
    await pointer(freshOption, 'pointerup');
    expect(second.operations.run).toHaveBeenCalledOnce();
  });

  it('discards the previous editor link form on an editor switch', async () => {
    const first = { ...markEditor(), getAttributes: vi.fn(() => ({ href: '/first' })) };
    const second = { ...markEditor(), getAttributes: vi.fn(() => ({ href: '/second' })) };
    const rendered = renderInlineMenu(createRichTextField('본문'), first);
    await rendered.rerender(editorState());
    const button = rendered.container.querySelector<HTMLButtonElement>('[aria-label="링크 편집"]');
    await act(async () => button?.click());
    expect(document.body.querySelector<HTMLInputElement>('input[aria-label="링크 주소"]')?.value).toBe('/first');
    await rendered.rerender(editorState(), { editor: second });
    expect(document.body.querySelector('input[aria-label="링크 주소"]')).toBeNull();
    await act(async () => button?.click());
    expect(document.body.querySelector<HTMLInputElement>('input[aria-label="링크 주소"]')?.value).toBe('/second');
  });

  it('renders from Puck editorState inside RichTextMenu without direct subscriptions', async () => {
    const editor = {
      state: { selection: { empty: true, from: 8, to: 8 } },
      on: vi.fn(),
      off: vi.fn(),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);
    await rerender(editorState({ g7FontInherit: false, g7FontModern: true }));

    const toolbar = container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.closest('[data-puck-rte-menu]')).not.toBeNull();
    expect(container.querySelector('[data-testid="puck-default-inline-controls"]')).toBeNull();
    expect(container.querySelectorAll('[aria-label="선택한 글자 굵게"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label="선택한 글자 기울임"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-label="선택한 글자 밑줄"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="page-builder-richtext-font"]')?.getAttribute('aria-label'))
      .toBe('선택한 글자 글꼴: 모던');
    expect(editor.on).not.toHaveBeenCalled();
    expect(editor.off).not.toHaveBeenCalled();

    await rerender(editorState({ g7HasSelection: false }));
    expect(container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]')).toBeNull();
  });

  it('keeps only the compact range entry visible in a narrow canvas and portals advanced controls', async () => {
    const originalWidth = window.innerWidth;
    const firstFloatingMeasurement: string[] = [];
    const pendingFrames = new Map<number, FrameRequestCallback>();
    let nextFrame = 1;
    let trackAdvancedAnchor = false;
    let advancedAnchorRead = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const frame = nextFrame++;
      pendingFrames.set(frame, callback);
      return frame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => {
      pendingFrames.delete(frame);
    });
    const flushFrame = async (): Promise<void> => {
      const callbacks = [...pendingFrames.values()];
      pendingFrames.clear();
      await act(async () => {
        for (const callback of callbacks) callback(performance.now());
      });
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('g7pb-richtext-floating-layer')) {
        firstFloatingMeasurement.push(this.style.getPropertyValue('--g7pb-richtext-floating-max-width'));
      }
      const anchorTop = trackAdvancedAnchor && this.dataset.testid === 'page-builder-richtext-more'
        ? [40, 37, 37][Math.min(advancedAnchorRead++, 2)]
        : 40;
      return {
        bottom: anchorTop + 40, height: 40, left: 10, right: 130, top: anchorTop, width: 120,
        x: 10, y: anchorTop, toJSON: () => ({}),
      };
    });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    const chain = {
      focus: vi.fn(() => chain),
      setMark: vi.fn(() => chain),
      unsetMark: vi.fn(() => chain),
      run: vi.fn(() => true),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 9 } },
      getAttributes: vi.fn(() => ({})),
      chain: vi.fn(() => chain),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);

    try {
      await rerender(editorState());
      const more = container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-more"]');
      expect(more).not.toBeNull();
      expect(container.querySelector('[data-testid="page-builder-richtext-font"]')).toBeNull();

      trackAdvancedAnchor = true;
      await act(async () => {
        more?.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerType: 'touch',
        }));
      });
      const advanced = document.body.querySelector<HTMLElement>('.g7pb-richtext-inline-toolbar__advanced');
      expect(advanced).not.toBeNull();
      expect(advanced?.querySelector('[data-testid="page-builder-richtext-font"]')).not.toBeNull();
      expect(advanced?.style.getPropertyValue('--g7pb-richtext-floating-max-width')).not.toBe('0px');
      expect(Number.parseFloat(firstFloatingMeasurement[0] ?? '0')).toBeGreaterThan(0);
      expect(advanced?.style.visibility).toBe('hidden');
      expect(advanced?.hasAttribute('data-g7pb-floating-ready')).toBe(false);
      await flushFrame();
      expect(advanced?.style.visibility).toBe('hidden');
      expect(advanced?.hasAttribute('data-g7pb-floating-ready')).toBe(false);
      expect(advanced?.style.getPropertyValue('--g7pb-richtext-floating-top')).toBe('83px');
      await flushFrame();
      expect(advanced?.style.visibility).toBe('hidden');
      expect(advanced?.hasAttribute('data-g7pb-floating-ready')).toBe(false);
      expect(advanced?.style.getPropertyValue('--g7pb-richtext-floating-top')).toBe('83px');
      await flushFrame();
      expect(advanced?.style.visibility).toBe('visible');
      expect(advanced?.getAttribute('data-g7pb-floating-ready')).toBe('true');
      expect(advanced?.style.getPropertyValue('--g7pb-richtext-floating-top')).toBe('83px');
      expect(more?.getAttribute('aria-expanded')).toBe('true');
    } finally {
      await act(async () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
        window.dispatchEvent(new Event('resize'));
      });
    }
  });

  it('portals the link input outside the clipped Puck action strip and applies to the retained editor selection', async () => {
    const operations: string[] = [];
    const chain = {
      focus: vi.fn(() => { operations.push('focus'); return chain; }),
      extendMarkRange: vi.fn(() => { operations.push('extendMarkRange'); return chain; }),
      setLink: vi.fn(() => { operations.push('setLink'); return chain; }),
      run: vi.fn(() => { operations.push('run'); return true; }),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 9 } },
      getAttributes: vi.fn(() => ({})),
      chain: vi.fn(() => chain),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);
    await rerender(editorState());

    const linkButton = container.querySelector<HTMLButtonElement>('[aria-label="링크 편집"]');
    await act(async () => linkButton?.click());
    const input = document.body.querySelector<HTMLInputElement>('input[aria-label="링크 주소"]');
    expect(input).not.toBeNull();
    const floatingLayer = input?.closest<HTMLElement>('.g7pb-richtext-floating-layer');
    expect(floatingLayer).not.toBeNull();
    expect(floatingLayer?.getAttribute('data-puck-rte-menu')).toBe('portal');
    expect(floatingLayer?.parentElement).toBe(document.body);

    await act(async () => {
      input?.focus();
      if (input) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          input,
          'https://example.com',
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    const form = document.body.querySelector<HTMLFormElement>('.g7pb-richtext-floating-layer form');
    await act(async () => form?.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })));

    expect(operations).toEqual(['focus', 'setLink', 'run']);
    expect((chain as Record<string, unknown>).setTextSelection).toBeUndefined();
  });

  it('derives selection, link, and G7 marks in the Puck selector', () => {
    const selector = createRichTextField('본문').tiptap.selector;
    const editor = {
      state: { selection: { empty: false } },
      getAttributes: vi.fn((mark: string) => mark === 'g7TextStyle'
        ? { font: 'serif', size: 'large', weight: 'semibold', tone: 'accent' }
        : {}),
      isActive: vi.fn((mark: string) => mark === 'link'),
    };

    expect(selector({ editor } as never, false)).toMatchObject({
      g7HasSelection: true,
      g7FontSerif: true,
      g7SizeLarge: true,
      g7WeightSemibold: true,
      g7ToneAccent: true,
      isLink: true,
    });
  });

  it('keeps body structure and constrains an action title to one non-link line', async () => {
    const body = createRichTextField('본문', 150, true);
    const title = createInlineRichTextField('제목', { allowLink: false });

    expect(body).toMatchObject({ contentEditable: true, visible: false });
    expect(title).toMatchObject({ contentEditable: true, visible: false });
    expect(body.options).toMatchObject({ heading: { levels: [2, 3, 4] } });
    const bodyOptions = body.options as Record<string, unknown>;
    expect(bodyOptions.blockquote).not.toBe(false);
    expect(bodyOptions.bulletList).not.toBe(false);
    expect(bodyOptions.link).not.toBe(false);
    expect(title.options).toMatchObject({
      blockquote: false,
      bulletList: false,
      document: false,
      hardBreak: false,
      heading: false,
      link: false,
      listItem: false,
      listKeymap: false,
      orderedList: false,
    });
    expect(title.tiptap.extensions.map((extension) => extension.name)).toEqual(
      expect.arrayContaining(['doc', 'g7SingleLineRichText']),
    );

    const shortcuts = G7SingleLineRichText.config.addKeyboardShortcuts?.call({} as never);
    expect(shortcuts?.Enter?.({} as never)).toBe(true);
    expect(shortcuts?.['Shift-Enter']?.({} as never)).toBe(true);

    const editor = { state: { selection: { empty: false } } };
    const rendered = renderInlineMenu(title as ReturnType<typeof createRichTextField>, editor);
    await rendered.rerender(editorState());
    expect(rendered.container.querySelector('[aria-label="링크 편집"]')).toBeNull();
  });

  it('keeps the one-argument inline-field signature link-capable', () => {
    expect(createInlineRichTextField('독립 제목').options.link).not.toBe(false);
  });

  it('keeps a touch range option mounted through the compatibility click and applies once', async () => {
    const chain = {
      focus: vi.fn(() => chain),
      setMark: vi.fn(() => chain),
      unsetMark: vi.fn(() => chain),
      run: vi.fn(() => true),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 7 } },
      chain: vi.fn(() => chain),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);
    await rerender(editorState());

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-font"]');
    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerType: 'touch',
      }));
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 0,
      }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    const serif = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes('명조'));
    const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
    await act(async () => {
      serif?.dispatchEvent(touchStart);
      serif?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerId: 7,
        pointerType: 'touch',
      }));
    });
    expect(touchStart.defaultPrevented).toBe(true);
    expect(chain.setMark).not.toHaveBeenCalled();
    expect(chain.run).not.toHaveBeenCalled();
    expect(serif?.isConnected).toBe(true);
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      serif?.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerId: 7,
        pointerType: 'touch',
      }));
    });
    expect(chain.setMark).toHaveBeenCalledWith('g7TextStyle', {
      font: 'serif',
      size: 'base',
      weight: 'regular',
      tone: 'default',
    });
    expect(chain.run).toHaveBeenCalledOnce();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(serif?.isConnected).toBe(true);

    await act(async () => {
      serif?.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        detail: 1,
      }));
    });
    expect(chain.setMark).toHaveBeenCalledOnce();
    expect(chain.run).toHaveBeenCalledOnce();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(serif?.isConnected).toBe(false);

    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });

  it('closes a touch range option after pointer up when no compatibility click is emitted', async () => {
    const chain = {
      focus: vi.fn(() => chain),
      setMark: vi.fn(() => chain),
      unsetMark: vi.fn(() => chain),
      run: vi.fn(() => true),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 7 } },
      chain: vi.fn(() => chain),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);
    await rerender(editorState());

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-font"]');
    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerType: 'touch',
      }));
    });
    const serif = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes('명조'));
    const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
    await act(async () => {
      serif?.dispatchEvent(touchStart);
      serif?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 13,
        pointerType: 'touch',
      }));
      serif?.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerId: 13,
        pointerType: 'touch',
      }));
    });
    expect(touchStart.defaultPrevented).toBe(true);

    expect(chain.setMark).toHaveBeenCalledOnce();
    expect(chain.run).toHaveBeenCalledOnce();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(serif?.isConnected).toBe(true);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 75)));
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(serif?.isConnected).toBe(false);
  });

  it('applies each native mark on pointer down without duplicating the compatibility click', async () => {
    const operations: string[] = [];
    const chain = {
      focus: vi.fn(() => { operations.push('focus'); return chain; }),
      toggleBold: vi.fn(() => { operations.push('toggleBold'); return chain; }),
      toggleItalic: vi.fn(() => { operations.push('toggleItalic'); return chain; }),
      toggleUnderline: vi.fn(() => { operations.push('toggleUnderline'); return chain; }),
      run: vi.fn(() => { operations.push('run'); return true; }),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 7 } },
      getAttributes: vi.fn(() => ({})),
      chain: vi.fn(() => chain),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);
    await rerender(editorState());

    for (const [label, command] of [
      ['선택한 글자 굵게', 'toggleBold'],
      ['선택한 글자 기울임', 'toggleItalic'],
      ['선택한 글자 밑줄', 'toggleUnderline'],
    ] as const) {
      const control = container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
      await act(async () => {
        control?.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerType: 'mouse',
        }));
        control?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
      });
      expect(operations.splice(0)).toEqual(['focus', command, 'run']);
    }

    const bold = container.querySelector<HTMLButtonElement>('[aria-label="선택한 글자 굵게"]');
    await act(async () => {
      bold?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      bold?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(operations).toEqual(['focus', 'toggleBold', 'run']);
  });

  it('ignores non-left native pointers and disables commands when editing is unavailable', async () => {
    const chain = {
      focus: vi.fn(() => chain),
      toggleBold: vi.fn(() => chain),
      run: vi.fn(() => true),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 7 } },
      getAttributes: vi.fn(() => ({})),
      chain: vi.fn(() => chain),
    };
    const rendered = renderInlineMenu(createRichTextField('본문'), editor);
    await rendered.rerender(editorState());
    const bold = rendered.container.querySelector<HTMLButtonElement>('[aria-label="선택한 글자 굵게"]');
    await act(async () => {
      bold?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 2,
        pointerType: 'mouse',
      }));
    });
    expect(chain.toggleBold).not.toHaveBeenCalled();

    await act(async () => {
      bold?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        pointerType: 'touch',
      }));
      bold?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'touch' }));
      bold?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      bold?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(chain.toggleBold).toHaveBeenCalledTimes(2);

    await rendered.rerender(editorState({ canBold: false }));
    expect(rendered.container.querySelector<HTMLButtonElement>('[aria-label="선택한 글자 굵게"]')?.disabled).toBe(true);

    const readOnly = renderInlineMenu(createRichTextField('본문'), editor, true);
    await readOnly.rerender(editorState());
    expect(readOnly.container.querySelector<HTMLButtonElement>('[aria-label="선택한 글자 굵게"]')?.disabled).toBe(true);
  });

  it('ignores non-left range-menu pointers and clears a canceled pointer before keyboard activation', async () => {
    const chain = {
      focus: vi.fn(() => chain),
      setMark: vi.fn(() => chain),
      unsetMark: vi.fn(() => chain),
      run: vi.fn(() => true),
    };
    const editor = {
      state: { selection: { empty: false, from: 3, to: 7 } },
      chain: vi.fn(() => chain),
    };
    const { container, rerender } = renderInlineMenu(createRichTextField('본문'), editor);
    await rerender(editorState());
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-font"]');

    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 2,
        isPrimary: true,
        pointerType: 'mouse',
      }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: false,
        pointerType: 'mouse',
      }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      trigger?.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerType: 'mouse' }));
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    await act(async () => {
      trigger?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    const serif = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes('명조'));
    await act(async () => {
      serif?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerId: 11,
        pointerType: 'touch',
      }));
      serif?.dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId: 11,
        pointerType: 'touch',
      }));
      serif?.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerId: 11,
        pointerType: 'touch',
      }));
    });
    expect(chain.setMark).not.toHaveBeenCalled();
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => {
      serif?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' }));
      serif?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(chain.setMark).toHaveBeenCalledOnce();
    expect(chain.run).toHaveBeenCalledOnce();
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });
});
