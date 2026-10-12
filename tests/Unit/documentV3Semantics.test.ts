import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { documentPresentation } from '../../resources/js/documents/v3/presentation';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { indexTree } from '../../resources/js/documents/v3/tree';

interface TagTree { tag: string; children?: TagTree[] }
const source = (tree: TagTree[]) => {
  let sequence = 0;
  const nodes = (items: TagTree[]): unknown[] => items.map(({ tag, children = [] }) => ({
    instance_id: '00000000-0000-4000-8000-' + String(++sequence).padStart(12, '0'),
    type: tag === 'text' ? 'content.text' : 'layout.container', block_version: 1, name: tag, locked: false,
    props: tag === 'text' ? { paragraphs: [[{ text: '한글 <내용>' }]] } : { tag },
    slots: tag === 'text' ? {} : { content: nodes(children) }, style: {}, responsive: {},
  }));
  return { ...structuredClone(fixture), blocks: nodes(tree) };
};
const displays: Readonly<Record<string, string>> = { li: 'list-item', table: 'table', caption: 'table-caption',
  thead: 'table-header-group', tbody: 'table-row-group', tfoot: 'table-footer-group', tr: 'table-row', th: 'table-cell', td: 'table-cell' };
describe('v3 semantic containers use the shared HTML grammar', () => {
  for (const entry of cases.semantics) it(entry.name, () => {
    const candidate = source(entry.tree), before = JSON.stringify(candidate);
    if (!entry.valid) expect(() => validateDocumentV3(candidate)).toThrow(new RegExp('^' + entry.error + ':'));
    else {
      const document = validateDocumentV3(candidate), rendered = documentPresentation(document);
      for (const { node } of indexTree(document).values()) {
        const tag = 'tag' in node.props ? node.props.tag : '';
        expect(rendered.get(node.instance_id)?.display).toBe(displays[tag] ?? 'block');
      }
    }
    expect(JSON.stringify(candidate)).toBe(before);
  });
  it('rejects an invalid reparent command atomically and retains valid list insertion', () => {
    const document = validateDocumentV3(source([{ tag: 'ul', children: [{ tag: 'li', children: [{ tag: 'text' }] }] }]));
    const before = JSON.stringify(document), list = document.blocks[0], item = list.slots.content![0];
    expect(() => executeTreeCommand(document, { kind: 'move', ids: [item.instance_id], destination: { parentId: null, index: 1 } }, () => '')).toThrow('semantic_parent');
    expect(JSON.stringify(document)).toBe(before);
    const result = executeTreeCommand(document, { kind: 'move', ids: [item.instance_id], destination: { parentId: list.instance_id, index: 0 } }, () => '');
    expect(result.document).toEqual(document);
  });
  it('retains explicit display and responsive hiding instead of forcing the semantic default', () => {
    const document = validateDocumentV3(source([{ tag: 'table', children: [{ tag: 'tbody', children: [{ tag: 'tr', children: [{ tag: 'td' }] }] }] }]));
    document.blocks[0].style.display = 'grid'; document.blocks[0].responsive.mobile = { hidden: true };
    expect(documentPresentation(document).get(document.blocks[0].instance_id)?.display).toBe('grid');
    expect(documentPresentation(document, 'mobile').get(document.blocks[0].instance_id)?.display).toBe('none');
  });
});
