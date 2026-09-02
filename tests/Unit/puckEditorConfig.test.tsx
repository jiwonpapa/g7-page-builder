import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PageBuilderDocument } from '../../resources/js/documents/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });

const { pageBuilderPuckConfig } = await import('../../resources/js/editor/puckEditorConfig');
const { PuckEditorAdapter, pageBuilderPuckConfig: compatibilityConfig } = await import('../../resources/js/editor/PuckEditorAdapter');
const cleanup: Array<() => void> = [];
afterEach(async () => {
  await act(async () => cleanup.splice(0).forEach((run) => run()));
  vi.restoreAllMocks();
});

function source(blocks: PageBuilderDocument['blocks']): PageBuilderDocument {
  return { schema_version: 'g7-page-builder/v1', document_id: crypto.randomUUID(), slug: 'config-synthetic',
    mode: 'canvas', locale: 'ko', shell_mode: 'none', blocks };
}
function block(type: string, props: Record<string, unknown>): PageBuilderDocument['blocks'][number] {
  return { instance_id: crypto.randomUUID(), type, block_version: 1, props, slots: {} };
}
async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
}
async function element<T extends HTMLElement>(host: HTMLElement, selector: string): Promise<T> {
  let result: T | null = null;
  await vi.waitFor(async () => {
    await flush();
    result = host.querySelector<T>(selector);
    expect(result, `Missing ${selector}`).not.toBeNull();
  });
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
function mount(initial: PageBuilderDocument) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const onChange = vi.fn();
  cleanup.push(() => { root.unmount(); host.remove(); });
  const render = async (document = initial, disabled = false, revisionKey = 0) => {
    await act(async () => root.render(<PuckEditorAdapter document={document} disabled={disabled}
      revisionKey={revisionKey} iframeEnabled={false} onChange={onChange} onPublish={() => undefined} />));
    await flush();
  };
  return { host, onChange, render };
}

describe('extracted Puck configuration owners', () => {
  it('keeps the shared config and live Hero/Features text DOM focused across parent and field updates', async () => {
    expect(compatibilityConfig).toBe(pageBuilderPuckConfig);
    const document = source([
      block('content.hero-centered-01', { eyebrow: 'Eyebrow', title: '<p>Hero sentinel</p>', body: '<p>Hero body</p>' }),
      block('content.features-grid-01', { title: '<p>Features sentinel</p>', items: [
        { icon: 'sparkles', title: 'First', body: 'One' }, { icon: 'shield', title: 'Second', body: 'Two' },
      ] }),
    ]);
    const view = mount(document);
    await view.render();
    for (const type of ['hero', 'features']) {
      const fieldSelector = `[data-block-type="${type}"] [data-g7pb-inline-field="title"]`;
      const field = await element(view.host, fieldSelector);
      await act(async () => {
        field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
        field.click();
      });
      const editor = await element(view.host, `${fieldSelector} .tiptap.ProseMirror[contenteditable="true"]`);
      await act(async () => editor.focus());
      expect(globalThis.document.activeElement).toBe(editor);
      await view.render({ ...document });
      expect(view.host.querySelector(`${fieldSelector} .tiptap.ProseMirror`)).toBe(editor);
      expect(editor.isConnected).toBe(true);
      expect(globalThis.document.activeElement).toBe(editor);

      view.onChange.mockClear();
      if (type === 'hero') {
        const alternate = await element<HTMLInputElement>(view.host, '[data-testid="page-builder-hero-subtitle"]');
        await act(async () => {
          const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (!setValue) throw new Error('Input setter is unavailable');
          setValue.call(alternate, 'Updated eyebrow');
          alternate.dispatchEvent(new Event('input', { bubbles: true }));
        });
      } else {
        const theme = await element<HTMLButtonElement>(view.host, 'button[aria-label="다크 테마"]');
        await act(async () => theme.click());
      }
      await flush();
      expect(view.host.querySelector(`${fieldSelector} .tiptap.ProseMirror`)).toBe(editor);
      expect(globalThis.document.activeElement).toBe(editor);
      expect(view.onChange).toHaveBeenCalled();
    }
  });

  it('shares the viewport context with CTA rendering for empty and nonempty body fields', async () => {
    const selector = '[data-block-type="cta"] [data-g7pb-inline-field="body"]';
    for (const body of ['', '<p><strong>CTA body sentinel</strong></p>']) {
      const document = source([block('content.cta-split-01', { heading: '<p>CTA sentinel</p>', body, theme: 'light' })]);
      const view = mount(document);
      await view.render();
      const editable = await element(view.host, selector);
      if (body) expect(editable.textContent).toContain('CTA body sentinel');
      await view.render(document, true);
      if (body) expect((await element(view.host, selector)).textContent).toContain('CTA body sentinel');
      else expect(view.host.querySelector(selector)).toBeNull();
      expect(view.onChange).not.toHaveBeenCalled();
    }
  });
});
