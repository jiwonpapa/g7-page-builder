import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
} = await import('../../resources/js/editor/richTextEditing');

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
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
): { container: HTMLDivElement; rerender: (nextState: Record<string, boolean>) => Promise<void> } {
  const InlineMenu = field.renderInlineMenu;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mounted.push(() => act(() => root.unmount()));

  return {
    container,
    rerender: async (nextState: Record<string, boolean>): Promise<void> => {
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
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
      window.dispatchEvent(new Event('resize'));
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

  it('keeps a range option mounted through touch down, applies once, and closes on pointer up without a compatibility click', async () => {
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
    await act(async () => {
      serif?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        isPrimary: true,
        pointerId: 7,
        pointerType: 'touch',
      }));
    });
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
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(serif?.isConnected).toBe(false);

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
