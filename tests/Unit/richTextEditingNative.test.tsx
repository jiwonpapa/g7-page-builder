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
          <InlineMenu editor={editor as never} editorState={nextState as never} readOnly={false}>
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
    expect(container.querySelector('[data-testid="puck-default-inline-controls"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="page-builder-richtext-font"]')?.getAttribute('aria-label'))
      .toBe('선택한 글자 글꼴: 모던');
    expect(editor.on).not.toHaveBeenCalled();
    expect(editor.off).not.toHaveBeenCalled();

    await rerender(editorState({ g7HasSelection: false }));
    expect(container.querySelector('[data-testid="page-builder-richtext-inline-toolbar"]')).toBeNull();
  });

  it('keeps link input inside the Puck menu and applies to the retained editor selection', async () => {
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
    const input = container.querySelector<HTMLInputElement>('input[aria-label="링크 주소"]');
    expect(input).not.toBeNull();
    expect(input?.closest('[data-puck-rte-menu]')).not.toBeNull();

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
    const form = container.querySelector<HTMLFormElement>('form');
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

  it('opens and applies a range choice on pointer down before a moving Puck action bar can cancel click', async () => {
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
        pointerType: 'mouse',
      }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');

    const serif = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="option"]'))
      .find((option) => option.textContent?.includes('명조'));
    await act(async () => {
      serif?.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'mouse',
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

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }));
    });
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
  });
});
