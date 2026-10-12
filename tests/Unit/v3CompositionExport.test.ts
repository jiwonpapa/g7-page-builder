import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { exportStarterCompositions } from '../../scripts/lib/exportV3Compositions';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { copyTree } from '../../resources/js/documents/v3/clipboard';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';

describe('explicit starter data export, not runtime registration or user migration', () => {
  it('exports every existing starter deterministically as a self-contained canonical document', () => {
    const base = validateDocumentV3(structuredClone(fixture));
    const before = JSON.stringify(base);
    const first = exportStarterCompositions(base);
    expect(first).toHaveLength(63);
    expect(new Set(first.map(entry => entry.key)).size).toBe(first.length);
    expect(new Set(first.map(entry => entry.document.document_id)).size).toBe(first.length);
    expect(exportStarterCompositions(base)).toEqual(first);
    expect(JSON.stringify(base)).toBe(before);
    for (const entry of first) {
      const document = validateDocumentV3(JSON.parse(JSON.stringify(entry.document)));
      expect(document.blocks[0].name).toBe(entry.label);
      expect(document.blocks).toHaveLength(1);
      expect(document.shell_mode).toBe('none');
      expect([...indexTree(document).values()].every(({ node }) => [
        'layout.section', 'layout.container', 'content.text', 'content.heading', 'action.link', 'media.image',
      ].includes(node.type))).toBe(true);
    }
  });
  it('exports data that inserts with the existing paste command and retains independent source identities', () => {
    const target = validateDocumentV3(structuredClone(fixture));
    for (const entry of exportStarterCompositions(target)) {
      let sequence = 0;
      const before = JSON.stringify(entry);
      const source = entry.document;
      const clipboard = copyTree(source, source.blocks.map(node => node.instance_id));
      const result = executeTreeCommand(target, { kind: 'paste', clipboard,
        destination: { parentId: null, index: target.blocks.length } },
      () => '20000000-0000-4000-8000-' + String(++sequence).padStart(12, '0')).document;
      const sourceIds = new Set(indexTree(source).keys());
      expect([...indexTree(result).keys()].every(id => !sourceIds.has(id))).toBe(true);
      expect(result.document_id).toBe(target.document_id);
      expect(result.slug).toBe(target.slug);
      expect(result.blocks.slice(0, target.blocks.length)).toEqual(target.blocks);
      expect(JSON.stringify(entry)).toBe(before);
    }
  });
  it('validates its explicit reference and never overwrites or converts its blocks', () => {
    const base = validateDocumentV3(structuredClone(fixture));
    base.blocks[0].name = '사용자 원본 보존';
    base.assets = [];
    base.blocks = [];
    const before = JSON.stringify(base);
    const output = exportStarterCompositions(base);
    expect(output[0].document.blocks[0].slots.content?.some(node => node.name === '이미지 영역')).toBe(true);
    expect(JSON.stringify(base)).toBe(before);
    expect(() => exportStarterCompositions({ ...base, slug: 'invalid slug' })).toThrow();
  });
});
