import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { textToHtml, propsFromHtml, runFromAttributes } from '../../resources/js/editor/v3/richTextCodec';
import { richTextField } from '../../resources/js/editor/v3/richTextField';

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
});
