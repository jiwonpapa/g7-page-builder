import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { basicCompositionOptions, createBasicComposition, isBasicCompositionKey } from '../../resources/js/blocks/v3/basicCompositions';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function ids() { let value = 100; return () => id(value++); }
describe('independent basic composition instances', () => {
  for (const [key, label] of basicCompositionOptions) it(`${label}: inserts editable nodes without vendor or legacy originals`, () => {
    const doc = validateDocumentV3(structuredClone(fixture)); doc.blocks = [];
    const before = JSON.stringify(doc), nextId = ids();
    const template = createBasicComposition(key, doc, nextId);
    expect(JSON.stringify(doc)).toBe(before);
    const inserted = executeTreeCommand(doc, { kind: 'insert', nodes: [template], destination: { parentId: null, index: 0 } }, nextId);
    expect(inserted.selection).toEqual([template.instance_id]);
    const tree = indexTree(inserted.document);
    expect(tree.size).toBe(8);
    expect([...tree.values()].every(({ node }) => !node.locked)).toBe(true);
    const heading = [...tree.values()].find(({ node }) => node.type === 'content.heading')!.node;
    const styled = executeDocumentCommand(inserted.document, { kind: 'style', id: heading.instance_id, viewport: 'mobile', set: { font_size: { value: 27, unit: 'px' } } }, nextId).document;
    expect(indexTree(styled).get(heading.instance_id)!.node.responsive.mobile?.font_size).toEqual({ value: 27, unit: 'px' });
    expect(validateDocumentV3(JSON.parse(JSON.stringify(styled)))).toEqual(styled);
    expect(doc.assets).toEqual(inserted.document.assets);
    expect(isBasicCompositionKey(key)).toBe(true);
  });
  it('creates independent fresh identities for each insertion and preserves an empty media area', () => {
    const doc = validateDocumentV3(structuredClone(fixture)); doc.blocks = []; doc.assets = [];
    const nextId = ids(), first = createBasicComposition('card.plain', doc, nextId);
    doc.blocks.push(first);
    const second = createBasicComposition('card.plain', doc, nextId);
    doc.blocks.push(second);
    const tree = indexTree(validateDocumentV3(doc));
    expect(tree.size).toBe(18);
    expect([...tree.values()].filter(({ node }) => node.name === '이미지 영역')).toHaveLength(2);
    expect([...tree.values()].some(({ node }) => node.type === 'media.image')).toBe(false);
    expect(first).not.toBe(second);
    expect(isBasicCompositionKey('unknown')).toBe(false);
  });
  it('rejects colliding IDs and document-limit overflow without partial mutation', () => {
    const doc = validateDocumentV3(structuredClone(fixture)), before = JSON.stringify(doc);
    expect(() => createBasicComposition('hero.poster', doc, () => doc.blocks[0].instance_id)).toThrow('generated_id');
    expect(JSON.stringify(doc)).toBe(before);
    const leaf = doc.blocks[0].slots.content![0];
    doc.blocks = Array.from({ length: 495 }, (_, i) => ({ ...structuredClone(leaf), instance_id: id(i + 1000) }));
    expect(() => createBasicComposition('hero.poster', doc, ids())).toThrow('node_limit');
    expect(doc.blocks).toHaveLength(495);
  });
});
