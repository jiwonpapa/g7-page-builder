import type { Node, DocumentV3, Run } from '../../documents/v3/types';
import { record, reject, validateRule } from '../../documents/v3/schema';
import { runPresentation } from '../../documents/v3/presentation';
import { definitions } from './inspectorFields';
export const markKeys = ['bold', 'italic', 'underline', 'strike', 'color', 'font_size', 'link'] as const;
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function runFromAttributes(attrs: unknown): Run {
  if (!record(attrs)) reject('richtext_attributes', '$');
  const run = { text: '', ...Object.fromEntries(markKeys.filter(key => attrs[key] !== null && attrs[key] !== undefined).map(key => [key, attrs[key]])) };
  validateRule(run, definitions.run, definitions);
  return run as Run;
}
export function markHtmlAttributes(run: Run, document: DocumentV3): Record<string, string> {
  return { ...Object.fromEntries(markKeys.filter(key => run[key] !== undefined).map(key => ['data-v3-' + key, JSON.stringify(run[key])])),
    style: Object.entries(runPresentation(run, document)).map(([key, value]) => key + ':' + value).join(';'),
    ...(run.link ? { href: run.link.url, ...(run.link.new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } : {}) };
}
export function textToHtml(node: Node, document: DocumentV3): string {
  if (node.type === 'action.link' || node.type === 'action.button' || node.type === 'form.label') return node.props.label;
  const paragraphs = node.type === 'content.heading' ? [node.props.runs] : node.type === 'content.text' ? node.props.paragraphs : [];
  return paragraphs.map(runs => '<p>' + runs.map(run => {
    const tag = run.link ? 'a' : 'span', attributes = markHtmlAttributes(run, document);
    return '<' + tag + ' ' + Object.entries(attributes).map(([key, value]) => key + '="' + escapeHtml(value) + '"').join(' ') + '>'
      + escapeHtml(run.text).replace(/\n/g, '<br>') + '</' + tag + '>';
  }).join('') + '</p>').join('');
}
export function propsFromHtml(node: Node, html: string): Node['props'] {
  if (node.type === 'action.link' || node.type === 'action.button' || node.type === 'form.label') return { ...node.props, label: html };
  if (node.type !== 'content.heading' && node.type !== 'content.text') {
    if (html !== '') reject('richtext_type', node.instance_id);
    return node.props;
  }
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  if (parsed.head.childNodes.length) reject('richtext_markup', '$');
  const paragraphs: Run[][] = [];
  for (const paragraph of [...parsed.body.childNodes]) {
    if (!(paragraph instanceof Element) || paragraph.tagName !== 'P' || paragraph.attributes.length) reject('richtext_paragraph', '$');
    const runs: Run[] = [];
    const visit = (current: globalThis.Node, inherited: Run): void => {
      if (current.nodeType === 3) {
        const run = { ...inherited, text: current.textContent ?? '' };
        validateRule(run, definitions.run, definitions);
        runs.push(run); return;
      }
      if (!(current instanceof Element) || !['SPAN', 'A', 'BR'].includes(current.tagName)) reject('richtext_markup', '$');
      if (current.tagName === 'BR') {
        if (current.attributes.length) reject('richtext_markup', '$');
        runs.push({ ...inherited, text: '\n' }); return;
      }
      const attrs: Record<string, unknown> = { ...inherited };
      for (const attribute of [...current.attributes]) {
        const key = attribute.name.replace('data-v3-', '');
        if (markKeys.some(allowed => key === allowed) && attribute.name.startsWith('data-v3-')) attrs[key] = JSON.parse(attribute.value);
        else if (!['style', 'href', 'target', 'rel'].includes(attribute.name)) reject('richtext_markup', attribute.name);
      }
      const mark = runFromAttributes(attrs);
      // Presentation attributes may not introduce an unowned URL or event handler.
      if (current.tagName === 'A' && (!mark.link || current.getAttribute('href') !== mark.link.url)) reject('richtext_link', '$');
      for (const child of [...current.childNodes]) visit(child, mark);
    };
    for (const child of [...paragraph.childNodes]) visit(child, { text: '' });
    // Tiptap represents an empty paragraph as <p></p>. Preserve the canonical required run.
    paragraphs.push(runs.length ? runs : [{ text: '' }]);
  }
  if (!paragraphs.length || node.type === 'content.heading' && paragraphs.length !== 1) reject('richtext_paragraph', '$');
  return node.type === 'content.heading' ? { ...node.props, runs: paragraphs[0] } : { paragraphs };
}
