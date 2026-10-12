import React, { useState } from 'react';
import { Mark, Node as TiptapNode, type Editor } from '@tiptap/core';
import { RichTextMenu, type RichtextField } from '@puckeditor/core';
import type { DocumentV3, Run } from '../../documents/v3/types';
import { markHtmlAttributes, markKeys, runFromAttributes } from './richTextCodec';
import { InputButton } from './TypedInput';

const name = 'v3Run';
/** Capture the visible range at the canvas-to-toolbar focus boundary, without storing a second selection. */
function syncVisibleSelection(editor: Editor) {
  const dom = editor.view.dom, selection = dom.ownerDocument.getSelection();
  if (selection?.anchorNode && selection.focusNode && dom.contains(selection.anchorNode) && dom.contains(selection.focusNode)) {
    const anchor = editor.view.posAtDOM(selection.anchorNode, selection.anchorOffset);
    const head = editor.view.posAtDOM(selection.focusNode, selection.focusOffset);
    const from = Math.min(anchor, head), to = Math.max(anchor, head);
    if (editor.state.selection.from !== from || editor.state.selection.to !== to) editor.commands.setTextSelection({ from, to });
  }
}
export function richTextChain(editor: Editor) {
  // Once blurred, Tiptap owns the captured range: later markup changes can collapse the DOM range.
  if (editor.isFocused) syncVisibleSelection(editor);
  return editor.chain();
}
function toggle(editor: Editor, key: 'bold' | 'italic' | 'underline' | 'strike') {
  return richTextChain(editor).setMark(name, { [key]: editor.getAttributes(name)[key] !== true }).run();
}
function Menu({ editor, readOnly }: { editor: Editor | null; readOnly: boolean }) {
  const [color, setColor] = useState('#112233'), [size, setSize] = useState('16'), [unit, setUnit] = useState('px');
  const [url, setUrl] = useState(''), [error, setError] = useState('');
  if (!editor) return null;
  const apply = (attributes: Partial<Run>) => {
    // Keep focus in toolbar inputs while synchronizing the owning canvas selection;
    // do not schedule a focus callback that can steal the next field's input across the iframe.
    try { runFromAttributes(attributes); richTextChain(editor).setMark(name, attributes).run(); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : '서식을 확인해 주세요.'); }
  };
  return <RichTextMenu><div className="g7pb-portal-surface" role="toolbar" aria-label="부분 서식" style={{ display: 'flex', gap: 5, flexWrap: 'wrap', maxWidth: 420,
    padding: 8, background: 'var(--g7pb-surface-strong)', color: 'var(--g7pb-text)', border: '1px solid var(--g7pb-border)' }}>
    {(['bold', 'italic', 'underline', 'strike'] as const).map((key, index) => <InputButton key={key} disabled={readOnly}
      aria-pressed={editor.getAttributes(name)[key] === true} onMouseDown={event => event.preventDefault()}
      onClick={() => toggle(editor, key)}>{['굵게', '기울임', '밑줄', '취소선'][index]}</InputButton>)}
    <input aria-label="부분 색상" value={color} onChange={event => setColor(event.target.value)} style={{ width: 90 }} />
    <InputButton disabled={readOnly} onClick={() => apply({ color: { kind: 'hex', value: color } })}>색상 적용</InputButton>
    <input aria-label="부분 크기" type="number" value={size} onChange={event => setSize(event.target.value)} style={{ width: 70 }} />
    <select aria-label="부분 크기 단위" value={unit} onChange={event => setUnit(event.target.value)}><option>px</option><option>rem</option></select>
    <InputButton disabled={readOnly} onClick={() => apply({ font_size: { value: Number(size), unit: unit === 'rem' ? 'rem' : 'px' } })}>크기 적용</InputButton>
    <input aria-label="부분 링크" value={url} onChange={event => setUrl(event.target.value)} />
    <InputButton disabled={readOnly} onClick={() => apply({ link: { url, new_tab: false } })}>링크 적용</InputButton>
    <InputButton disabled={readOnly} onClick={() => richTextChain(editor).setMark(name, { link: null }).run()}>링크 제거</InputButton>
    <InputButton disabled={readOnly} onClick={() => richTextChain(editor).unsetMark(name).run()}>부분 초기화</InputButton>
    {error && <span role="alert">{error}</span>}
  </div></RichTextMenu>;
}
/** Puck owns Tiptap creation and history; this adapter only describes typed run marks. */
export function richTextField(document: DocumentV3, singleLine: boolean): RichtextField {
  const mark = Mark.create({
    name,
    addAttributes() {
      return Object.fromEntries(markKeys.map(key => [key, { default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-v3-' + key);
          if (value === null) return null;
          try { const parsed: unknown = JSON.parse(value); runFromAttributes({ [key]: parsed }); return parsed; } catch { return null; }
        },
        renderHTML: () => ({}),
      }]));
    },
    parseHTML() { return [{ tag: 'span' }, { tag: 'a[data-v3-link]' }]; },
    renderHTML({ mark }) {
      const run = runFromAttributes(mark.attrs);
      return [run.link ? 'a' : 'span', markHtmlAttributes(run, document), 0];
    },
    onBlur() { syncVisibleSelection(this.editor); },
    // Puck's public rich-text wrapper routes Mod-i through this Tiptap command.
    addCommands() { return { toggleItalic: () => ({ commands, editor }) => commands.setMark(name, { italic: editor.getAttributes(name).italic !== true }) }; },
    addKeyboardShortcuts() { return { 'Mod-b': () => toggle(this.editor, 'bold'), 'Mod-i': () => toggle(this.editor, 'italic'), 'Mod-u': () => toggle(this.editor, 'underline') }; },
  });
  return { type: 'richtext', label: '본문', contentEditable: true, visible: false,
    options: { bold: false, italic: false, underline: false, strike: false, link: false, code: false, codeBlock: false,
      blockquote: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, heading: false,
      horizontalRule: false, textAlign: false, ...(singleLine ? { document: false } : {}) },
    tiptap: { extensions: [mark, ...(singleLine ? [TiptapNode.create({ name: 'doc', topNode: true, content: 'paragraph' })] : [])],
      selector: ({ editor }) => ({ v3Bold: editor?.getAttributes(name).bold === true, v3Italic: editor?.getAttributes(name).italic === true }) },
    renderInlineMenu: props => <Menu editor={props.editor} readOnly={props.readOnly} />,
  };
}
