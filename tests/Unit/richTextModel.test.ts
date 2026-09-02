import { Editor, Node } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { G7SingleLineDocument, G7TextStyleMark, markFromEditorState, selectedMark, selectRichTextEditorState } from '../../resources/js/editor/richTextModel';

class TestResizeObserver { observe(): void {} unobserve(): void {} disconnect(): void {} }
globalThis.ResizeObserver = TestResizeObserver;
const { createRichTextField, G7TextStyleMark: compatibleMark } = await import('../../resources/js/editor/richTextEditing');

const paragraph = Node.create({ name: 'paragraph', group: 'block', content: 'inline*', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
const text = Node.create({ name: 'text', group: 'inline' });
const editors: Editor[] = [];
afterEach(() => { for (const editor of editors.splice(0)) editor.destroy(); });

function open(content: string): Editor {
  const editor = new Editor({ extensions: [G7SingleLineDocument, paragraph, text, G7TextStyleMark], content });
  editors.push(editor);
  editor.commands.setTextSelection({ from: 1, to: editor.state.doc.content.size - 1 });
  return editor;
}

describe('rich-text model ownership and Puck state', () => {
  it('keeps one extension instance and selector across field factories and compatibility imports', () => {
    const first = createRichTextField('first');
    const second = createRichTextField('second');
    expect(compatibleMark).toBe(G7TextStyleMark);
    expect(first.tiptap.extensions[0]).toBe(compatibleMark);
    expect(second.tiptap.extensions[0]).toBe(compatibleMark);
    expect(first.tiptap.selector).toBe(selectRichTextEditorState);
    expect(second.renderInlineMenu).toBe(first.renderInlineMenu);
  });

  it('round-trips selected rem, legacy size and tone through the Puck boolean selector', () => {
    const editor = open('<p><span data-g7pb-font="serif" data-g7pb-font-size-rem="1.5" data-g7pb-size="large" data-g7pb-weight="semibold" data-g7pb-tone="custom3">sample</span></p>');
    const state = selectRichTextEditorState({ editor }, false);
    expect(state.g7HasSelection).toBe(true);
    expect(state.g7CanLink).toBe(true);
    expect(markFromEditorState(state)).toEqual({ font: 'serif', fontSizeRem: 1.5, size: 'large', weight: 'semibold', tone: 'custom3' });
    expect(markFromEditorState(state)).toEqual(selectedMark(editor));
    const html = editor.getHTML();
    expect(html).toContain('data-g7pb-font-size-rem="1.5"');
    expect(html).toContain('g7pb-element-font-size--24');
    expect(html).toContain('data-g7pb-size="large"');
    expect(html).not.toContain('style=');
    expect(selectRichTextEditorState({ editor }, true).g7CanLink).toBe(false);
    editor.commands.setTextSelection(1);
    expect(selectRichTextEditorState({ editor }, false).g7HasSelection).toBe(false);
    expect(selectRichTextEditorState({ editor }, false).g7CanLink).toBe(false);
  });

  it('normalizes unsupported attributes without serializing arbitrary styles or stale font-size bits', () => {
    const editor = open('<p><span data-g7pb-font="other" data-g7pb-font-size-rem="1.4" data-g7pb-tone="red" style="color:red">sample</span></p>');
    const defaults = { font: 'inherit', size: 'base', weight: 'regular', tone: 'default' };
    expect(selectedMark(editor)).toEqual(defaults);
    expect(markFromEditorState(selectRichTextEditorState({ editor }, false))).toEqual(defaults);
    expect(markFromEditorState({ g7FontSizeSet: false, g7FontSizeBit3: true })).toEqual(defaults);
    expect(editor.getHTML()).toBe('<p><span>sample</span></p>');
    expect(selectedMark(null)).toEqual(defaults);
    expect(selectRichTextEditorState({ editor: null }, false).g7CanLink).toBe(false);
  });
});
