import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor, Node as TiptapNode } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { G7SingleLineDocument } from '../../resources/js/editor/richTextModel';
import { RICH_TEXT_RANGE_STATE_MESSAGE, RichTextRangeStateSignal, richTextRangeAnchorFromSelection } from '../../resources/js/editor/richTextSelection';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function select(ownerDocument: Document, node: Node | HTMLElement, rects: DOMRect[]): Range {
  const range = ownerDocument.createRange();
  range.selectNodeContents(node);
  range.getClientRects = () => Object.assign(rects, { item: (index: number) => rects[index] ?? null });
  const selection = ownerDocument.defaultView?.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return range;
}

function field(ownerDocument = document): HTMLDivElement {
  const element = ownerDocument.createElement('div');
  element.dataset.g7pbRichtextField = 'true';
  element.textContent = 'selection sample';
  ownerDocument.body.append(element);
  return element;
}

describe('rich-text selection ownership', () => {
  it('unites visible line fragments and rejects collapsed, external and zero-size ranges', () => {
    const current = field();
    const other = field();
    const range = select(document, current, [new DOMRect(10, 20, 40, 10), new DOMRect(5, 40, 30, 10), new DOMRect(0, 0, 0, 0)]);
    expect(richTextRangeAnchorFromSelection(document, current)).toEqual({ left: 5, top: 20, right: 50, bottom: 50, width: 45, height: 30 });
    expect(richTextRangeAnchorFromSelection(document, other)).toBeNull();
    range.collapse();
    expect(richTextRangeAnchorFromSelection(document, current)).toBeNull();
    select(document, current, [new DOMRect(10, 20, 0, 10)]);
    expect(richTextRangeAnchorFromSelection(document, current)).toBeNull();
    delete current.dataset.g7pbRichtextField;
    select(document, current, [new DOMRect(10, 20, 40, 10)]);
    expect(richTextRangeAnchorFromSelection(document, current)).toBeNull();
  });

  it('uses the field owner document rather than the host window selection', () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const ownerDocument = iframe.contentDocument;
    if (!ownerDocument) throw new Error('Expected an iframe document');
    const current = field(ownerDocument);
    select(ownerDocument, current, [new DOMRect(8, 16, 24, 12)]);
    const hostSelection = vi.spyOn(window, 'getSelection');
    expect(richTextRangeAnchorFromSelection(ownerDocument, current)).toEqual({ left: 8, top: 16, right: 32, bottom: 28, width: 24, height: 12 });
    expect(hostSelection).not.toHaveBeenCalled();
  });

  it('announces current anchor changes and clears the range signal on release and unmount', async () => {
    const paragraph = TiptapNode.create({ name: 'paragraph', group: 'block', content: 'inline*', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
    const text = TiptapNode.create({ name: 'text', group: 'inline' });
    const host = field();
    host.replaceChildren();
    const editor = new Editor({ element: host, extensions: [G7SingleLineDocument, paragraph, text], content: '<p>sample</p>' });
    cleanups.push(() => editor.destroy());
    editor.commands.setTextSelection({ from: 1, to: 7 });
    select(document, editor.view.dom, [new DOMRect(10, 20, 30, 10)]);
    const details: unknown[] = [];
    const onRange = (event: Event): void => { if (event instanceof CustomEvent) details.push(event.detail); };
    window.addEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, onRange);
    cleanups.push(() => window.removeEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, onRange));
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    let mounted = true;
    cleanups.push(() => { if (mounted) act(() => root.unmount()); });
    const render = async (active: boolean) => { await act(async () => { root.render(<RichTextRangeStateSignal active={active} editor={editor} />); }); };
    await render(true);
    expect(details.at(-1)).toEqual({ active: true, anchor: { left: 10, top: 20, right: 40, bottom: 30, width: 30, height: 10 } });
    select(document, editor.view.dom, [new DOMRect(25, 40, 30, 10)]);
    await render(true);
    expect(details.at(-1)).toEqual({ active: true, anchor: { left: 25, top: 40, right: 55, bottom: 50, width: 30, height: 10 } });
    await render(false);
    expect(details.at(-1)).toEqual({ active: false, anchor: null });
    await render(true);
    await act(async () => { root.unmount(); mounted = false; });
    expect(details.at(-1)).toEqual({ active: false, anchor: null });
  });
});
