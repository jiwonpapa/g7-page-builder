import { useEffect } from 'react';
import type { Editor } from '@tiptap/core';
import type { CanvasRangeAnchor } from './canvasContextState';

export const RICH_TEXT_RANGE_STATE_MESSAGE = 'g7pb:richtext-range-state';

export function richTextRangeAnchorFromSelection(
  ownerDocument: Document,
  editorRoot?: HTMLElement,
): CanvasRangeAnchor | null {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) return null;
  const selection = ownerWindow.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const commonElement = range.commonAncestorContainer instanceof ownerWindow.Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  if (!commonElement?.closest('[data-g7pb-richtext-field]')) return null;
  if (editorRoot && !editorRoot.contains(commonElement)) return null;
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function richTextRangeAnchor(editor: Editor | null): CanvasRangeAnchor | null {
  if (!editor?.state?.selection || editor.state.selection.empty || !editor.view?.dom) return null;
  return richTextRangeAnchorFromSelection(editor.view.dom.ownerDocument, editor.view.dom);
}

function dispatchRichTextRangeState(active: boolean, anchor: CanvasRangeAnchor | null): void {
  const detail = { active, anchor };
  if (window.parent !== window) {
    window.parent.postMessage({ type: RICH_TEXT_RANGE_STATE_MESSAGE, ...detail }, window.location.origin);
  }
  window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_STATE_MESSAGE, { detail }));
}

export function RichTextRangeStateSignal({ active, editor }: { active: boolean; editor: Editor | null }): null {
  const anchor = active ? richTextRangeAnchor(editor) : null;
  const anchorKey = anchor
    ? `${anchor.left}:${anchor.top}:${anchor.right}:${anchor.bottom}`
    : 'none';
  useEffect(() => {
    dispatchRichTextRangeState(active, anchor);
  }, [active, anchorKey]);

  useEffect(() => () => dispatchRichTextRangeState(false, null), []);

  return null;
}

