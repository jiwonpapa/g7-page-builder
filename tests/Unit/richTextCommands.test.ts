import { Editor, Mark, Node } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyRichTextLink, clearRichTextMarks, removeRichTextLink, safeEditorLink, toggleRichTextMark, updateRichTextMark, type RichTextCommandContext } from '../../resources/js/editor/richTextCommands';
import { G7SingleLineDocument, G7TextStyleMark, selectedMark } from '../../resources/js/editor/richTextModel';

const paragraph = Node.create({ name: 'paragraph', group: 'block', content: 'inline*', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
const text = Node.create({ name: 'text', group: 'inline' });
const bold = Mark.create({ name: 'bold', parseHTML: () => [{ tag: 'strong' }], renderHTML: () => ['strong', 0] });
const editors: Editor[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); vi.restoreAllMocks(); });

function context(content = '<p>sample</p>'): RichTextCommandContext & { editor: Editor } {
  const editor = new Editor({ extensions: [G7SingleLineDocument, paragraph, text, bold, G7TextStyleMark], content });
  editors.push(editor);
  editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
  return { editor, readOnly: false, rangeActive: true };
}

function recordChain(editor: Editor) {
  // Link/toggle are Puck-provided commands. This fixture checks the public chain
  // contract; the mark preservation tests below execute real Tiptap transactions.
  const calls: unknown[] = [];
  const chain = editor.chain();
  vi.spyOn(chain, 'focus').mockImplementation(() => { calls.push('focus'); return chain; });
  vi.spyOn(chain, 'extendMarkRange').mockImplementation((name) => { calls.push(['extend', name]); return chain; });
  vi.spyOn(chain, 'unsetAllMarks').mockImplementation(() => { calls.push('clear-all'); return chain; });
  vi.spyOn(chain, 'run').mockImplementation(() => { calls.push('run'); return true; });
  chain.setLink = (attrs) => { calls.push(['link', attrs]); return chain; };
  chain.unsetLink = () => { calls.push('unlink'); return chain; };
  chain.toggleBold = () => { calls.push('bold'); return chain; };
  chain.toggleItalic = () => { calls.push('italic'); return chain; };
  chain.toggleUnderline = () => { calls.push('underline'); return chain; };
  const start = vi.spyOn(editor, 'chain').mockReturnValue(chain);
  return { calls, start };
}

describe('rich-text command boundaries', () => {
  it('returns rem to automatic while retaining the other selected style and independent bold mark', () => {
    const ctx = context('<p><strong><span data-g7pb-font="serif" data-g7pb-font-size-rem="2" data-g7pb-tone="accent">sample</span></strong></p>');
    updateRichTextMark(ctx, selectedMark(ctx.editor), { fontSizeRem: undefined });
    expect(selectedMark(ctx.editor)).toEqual({ font: 'serif', size: 'base', weight: 'regular', tone: 'accent' });
    expect(ctx.editor.isActive('bold')).toBe(true);
    expect(ctx.editor.getHTML()).not.toContain('data-g7pb-font-size-rem');
    expect(ctx.editor.getHTML()).toContain('data-g7pb-font="serif"');
    expect(ctx.editor.state.doc.textContent).toBe('sample');
  });

  it('removes an all-default style mark without clearing unrelated marks or text', () => {
    const ctx = context('<p><strong><span data-g7pb-font-size-rem="2">sample</span></strong></p>');
    updateRichTextMark(ctx, selectedMark(ctx.editor), { fontSizeRem: undefined });
    expect(ctx.editor.isActive('g7TextStyle')).toBe(false);
    expect(ctx.editor.getHTML()).toBe('<p><strong>sample</strong></p>');
  });

  it('extends an existing link before replacement and distinguishes unlink from clearing all marks', () => {
    const ctx = context();
    const recorded = recordChain(ctx.editor);
    expect(applyRichTextLink(ctx, ' /next ', true, true)).toBe('applied');
    expect(recorded.calls).toEqual(['focus', ['extend', 'link'], ['link', { href: '/next' }], 'run']);
    recorded.calls.length = 0;
    expect(applyRichTextLink(ctx, 'https://example.test/path', true, false)).toBe('applied');
    expect(recorded.calls).toEqual(['focus', ['link', { href: 'https://example.test/path' }], 'run']);
    recorded.calls.length = 0;
    removeRichTextLink(ctx);
    expect(recorded.calls).toEqual(['focus', ['extend', 'link'], 'unlink', 'run']);
    recorded.calls.length = 0;
    clearRichTextMarks(ctx);
    expect(recorded.calls).toEqual(['focus', 'clear-all', 'run']);
  });

  it('rejects unsafe or malformed destinations before starting an editor transaction', () => {
    const ctx = context();
    const recorded = recordChain(ctx.editor);
    for (const value of ['javascript:alert(1)', 'http://example.test', '//example.test', '/\\example.test', '/two words', 'mailto:no-address', '']) {
      expect(applyRichTextLink(ctx, value, true, false)).toBe('invalid');
    }
    expect(recorded.start).not.toHaveBeenCalled();
    expect(safeEditorLink('mailto:a@example.test')).toBe('mailto:a@example.test');
    expect(safeEditorLink('tel:+82-2-1234')).toBe('tel:+82-2-1234');
  });

  it('blocks every command while readonly or without a range and blocks disallowed links', () => {
    const ctx = context();
    const recorded = recordChain(ctx.editor);
    for (const blocked of [{ ...ctx, readOnly: true }, { ...ctx, rangeActive: false }, { ...ctx, editor: null }]) {
      updateRichTextMark(blocked, selectedMark(ctx.editor), { font: 'serif' });
      toggleRichTextMark(blocked, 'bold');
      removeRichTextLink(blocked);
      clearRichTextMarks(blocked);
      expect(applyRichTextLink(blocked, '/next', true, false)).toBe('blocked');
    }
    expect(applyRichTextLink(ctx, '/next', false, false)).toBe('blocked');
    expect(recorded.start).not.toHaveBeenCalled();
    toggleRichTextMark(ctx, 'italic');
    expect(recorded.calls).toEqual(['focus', 'italic', 'run']);
  });
});
