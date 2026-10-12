import { describe, expect, it } from 'vitest';
import { Editor, Node as TiptapNode } from '@tiptap/core';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { textToHtml, propsFromHtml, runFromAttributes } from '../../resources/js/editor/v3/richTextCodec';
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { richTextField, richTextChain } = await import('../../resources/js/editor/v3/richTextField');

const source = () => cloneDocument(validateDocumentV3(fixture));
describe('typed rich-text adapter', () => {
  it('round trips partial marks, explicit false, colors, sizes and link semantics', () => {
    const doc = source(), heading = doc.blocks[0].slots.content![0];
    if (heading.type !== 'content.heading') throw new Error('fixture');
    heading.props.runs = [{ text: '한글 <&>', bold: false, italic: true, underline: true, strike: false,
      color: { kind: 'token', value: 'primary' }, font_size: { value: 1.2, unit: 'rem' }, link: { url: '/about', new_tab: true } }];
    const html = textToHtml(heading, doc);
    expect(html).toContain('&lt;&amp;&gt;');
    expect(propsFromHtml(heading, html)).toEqual(heading.props);
  });
  it('preserves paragraphs, empty paragraphs and line breaks without raw HTML storage', () => {
    const doc = source(), text = doc.blocks[0].slots.content![2];
    if (text.type !== 'content.text') throw new Error('fixture');
    expect(propsFromHtml(text, '<p>한글<br>다음 줄</p><p></p>')).toEqual({ paragraphs: [
      [{ text: '한글' }, { text: '\n' }, { text: '다음 줄' }], [{ text: '' }],
    ] });
    expect(propsFromHtml(text, '<p>&lt;img onerror=x&gt;</p>')).toEqual({ paragraphs: [[{ text: '<img onerror=x>' }]] });
  });
  it('rejects unowned markup, events, changed links and invalid typed marks', () => {
    const doc = source(), node = doc.blocks[0].slots.content![0];
    for (const html of ['<script>x</script>', '<p onclick="x">a</p>', '<p><img src=x></p>',
      '<p><a href="/evil">x</a></p>', '<p><span data-v3-bold="1">x</span></p>', '<p>a</p><p>b</p>']) {
      expect(() => propsFromHtml(node, html)).toThrow();
    }
    expect(() => runFromAttributes({ color: { kind: 'hex', value: 'red' } })).toThrow();
    expect(() => runFromAttributes({ link: { url: 'javascript:alert(1)', new_tab: false } })).toThrow();
    expect(runFromAttributes({ bold: false, italic: null })).toEqual({ text: '', bold: false });
  });
  it('uses Puck richtext and typed mark extensions without a second history engine', () => {
    const doc = source(), field = richTextField(doc, true);
    expect(field.type).toBe('richtext'); expect(field.contentEditable).toBe(true);
    expect(field.tiptap?.extensions?.map(extension => extension.name)).toEqual(['v3Run', 'doc']);
    expect(field.options?.bold).toBe(false);
    expect(richTextField(doc, false).tiptap?.extensions?.map(extension => extension.name)).toEqual(['v3Run']);
  });
  it('reproduces a pending DOM selection and applies the visible range as one document update', () => {
    const paragraph = TiptapNode.create({ name: 'paragraph', group: 'block', content: 'inline*', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
    const text = TiptapNode.create({ name: 'text', group: 'inline' });
    for (const synchronize of [false, true]) {
      const host = document.createElement('div'); document.body.append(host);
      const editor = new Editor({ element: host, extensions: [paragraph, text, ...richTextField(source(), true).tiptap!.extensions!], content: '<p>한글 정밀 편집</p>' });
      try {
        editor.commands.setTextSelection(9);
        const range = document.createRange(), textNode = editor.view.dom.querySelector('p')!.firstChild!;
        range.setStart(textNode, 0); range.setEnd(textNode, 2);
        document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(range);
        expect(editor.state.selection.empty).toBe(true); // Native selectionchange has not reached Tiptap yet.
        let updates = 0; editor.on('update', () => updates++);
        if (synchronize) editor.emit('blur', { editor, event: new FocusEvent('blur'), transaction: editor.state.tr });
        (synchronize ? richTextChain(editor) : editor.chain()).setMark('v3Run', { color: { kind: 'hex', value: '#2255ff' } }).run();
        expect(updates).toBe(synchronize ? 1 : 0);
        expect(editor.getHTML().includes('data-v3-color')).toBe(synchronize);
        if (synchronize) {
          expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe('한글');
          // The iframe DOM range can collapse during a formatted-node replacement while toolbar focus stays outside.
          const collapsed = document.createRange(); collapsed.selectNodeContents(editor.view.dom); collapsed.collapse(true);
          document.getSelection()!.removeAllRanges(); document.getSelection()!.addRange(collapsed);
          richTextChain(editor).setMark('v3Run', { font_size: { value: 20, unit: 'px' } }).run();
          expect(editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)).toBe('한글');
          expect(editor.getHTML()).toContain('data-v3-font_size'); expect(updates).toBe(2);
        }
      } finally { editor.destroy(); host.remove(); document.getSelection()?.removeAllRanges(); }
    }
  });
  it('reads only its iframe selection and ignores selections in another field', () => {
    const iframe = document.createElement('iframe'); document.body.append(iframe);
    const owner = iframe.contentDocument!, host = owner.createElement('div'); owner.body.append(host);
    const paragraph = TiptapNode.create({ name: 'paragraph', group: 'block', content: 'inline*', parseHTML: () => [{ tag: 'p' }], renderHTML: () => ['p', 0] });
    const text = TiptapNode.create({ name: 'text', group: 'inline' });
    const editor = new Editor({ element: host, extensions: [paragraph, text, ...richTextField(source(), true).tiptap!.extensions!], content: '<p>한글 정밀 편집</p>' });
    try {
      editor.commands.setTextSelection(9);
      const selected = owner.createRange(), textNode = editor.view.dom.querySelector('p')!.firstChild!;
      selected.setStart(textNode, 0); selected.setEnd(textNode, 2); owner.getSelection()!.addRange(selected);
      editor.emit('blur', { editor, event: new FocusEvent('blur'), transaction: editor.state.tr });
      richTextChain(editor).setMark('v3Run', { bold: true }).run();
      expect(editor.state.selection.from).toBe(1); expect(editor.state.selection.to).toBe(3);
      const other = owner.createElement('p'); other.textContent = 'other'; owner.body.append(other);
      const outside = owner.createRange(); outside.selectNodeContents(other);
      owner.getSelection()!.removeAllRanges(); owner.getSelection()!.addRange(outside);
      editor.emit('blur', { editor, event: new FocusEvent('blur'), transaction: editor.state.tr });
      richTextChain(editor).setMark('v3Run', { italic: true }).run();
      expect(editor.state.selection.from).toBe(1); expect(editor.state.selection.to).toBe(3);
      expect(editor.getHTML()).toContain('data-v3-italic="true"');
    } finally { editor.destroy(); iframe.remove(); }
  });
});
