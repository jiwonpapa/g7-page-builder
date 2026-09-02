import type { Editor } from '@tiptap/core';
import type { selectedMark } from './richTextModel';

export type RichTextMark = ReturnType<typeof selectedMark>;
export type RichTextCommandContext = { editor: Editor | null; readOnly: boolean; rangeActive: boolean };

export function safeEditorLink(value: string): string | null {
  const trimmed = value.trim();
  if (/^\/(?!\/)[^\s\\]*$/.test(trimmed)) return trimmed;
  if (/^(?:mailto:[^\s@]+@[^\s@]+\.[^\s@]+|tel:\+?[0-9][0-9 .()\-]{2,39})$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' && url.hostname ? trimmed : null;
  } catch {
    return null;
  }
}

function editableEditor(context: RichTextCommandContext): Editor | null {
  return context.readOnly || !context.rangeActive ? null : context.editor;
}

export function updateRichTextMark(context: RichTextCommandContext, mark: RichTextMark, patch: Partial<RichTextMark>): void {
  const editor = editableEditor(context);
  if (!editor) return;
  const chain = editor.chain().focus();
  const next = { ...mark, ...patch };
  if (next.font === 'inherit' && next.fontSizeRem === undefined && next.size === 'base' && next.weight === 'regular' && next.tone === 'default') {
    chain.unsetMark('g7TextStyle').run();
  } else if (Object.prototype.hasOwnProperty.call(patch, 'fontSizeRem') && patch.fontSizeRem === undefined) {
    const { fontSizeRem: _removedFontSize, ...withoutFontSize } = next;
    chain.unsetMark('g7TextStyle').setMark('g7TextStyle', withoutFontSize).run();
  } else {
    chain.setMark('g7TextStyle', next).run();
  }
}

export function applyRichTextLink(context: RichTextCommandContext, value: string, allowLink: boolean, isLink: boolean): 'blocked' | 'invalid' | 'applied' {
  const editor = editableEditor(context);
  if (!editor || !allowLink) return 'blocked';
  const safe = safeEditorLink(value);
  if (!safe) return 'invalid';
  const chain = editor.chain().focus();
  if (isLink) chain.extendMarkRange('link');
  chain.setLink({ href: safe }).run();
  return 'applied';
}

export function toggleRichTextMark(context: RichTextCommandContext, mark: 'bold' | 'italic' | 'underline'): void {
  const editor = editableEditor(context);
  if (!editor) return;
  if (mark === 'bold') editor.chain().focus().toggleBold().run();
  else if (mark === 'italic') editor.chain().focus().toggleItalic().run();
  else editor.chain().focus().toggleUnderline().run();
}

export function removeRichTextLink(context: RichTextCommandContext): void {
  editableEditor(context)?.chain().focus().extendMarkRange('link').unsetLink().run();
}

export function clearRichTextMarks(context: RichTextCommandContext): void {
  editableEditor(context)?.chain().focus().unsetAllMarks().run();
}
