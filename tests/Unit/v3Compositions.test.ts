import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { compositionChoices, compositionClipboard } from '../../resources/js/editor-application/v3/compositions';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { nodeAnchor } from '../../resources/js/documents/v3/tree';

const id = (n: number) => '20000000-0000-4000-8000-' + String(n).padStart(12, '0');
describe('composition data uses the common document and paste command', () => {
  it('needs no known name or registry and edits an independent tree with new identities', () => {
    const source = validateDocumentV3(structuredClone(fixture));
    source.blocks[0].name = '처음 보는 자유 구성';
    source.blocks[0].style.display = 'grid';
    source.blocks[0].style.columns = [{ fr: 2 }, { fr: 3 }];
    const link = [...indexTree(source).values()].find(({ node }) => node.type === 'action.link')!.node;
    if (link.type !== 'action.link') throw new Error('Missing fixture link');
    link.props.link.url = '#' + nodeAnchor(source.blocks[0].instance_id);
    const [choice] = compositionChoices([source]);
    source.blocks[0].name = '외부 변경';
    expect(choice.label).toBe('처음 보는 자유 구성');
    const target = validateDocumentV3(structuredClone(fixture));
    target.tokens.primary = { kind: 'hex', value: '#123456' };
    target.assets[0].url = '/different.webp';
    let sequence = 0;
    const next = () => id(++sequence);
    const before = JSON.stringify(target);
    const command = { kind: 'paste' as const, clipboard: compositionClipboard(choice), destination: { parentId: null, index: 1 } };
    const inserted = executeTreeCommand(target, command, next).document;
    expect(JSON.stringify(target)).toBe(before);
    expect(inserted.document_id).toBe(target.document_id);
    expect(inserted.slug).toBe(target.slug);
    expect(inserted.shell_mode).toBe(target.shell_mode);
    expect(inserted.blocks[0]).toEqual(target.blocks[0]);
    const added = inserted.blocks[1];
    const tree = indexTree({ ...inserted, blocks: [added] });
    expect([...tree.keys()].every(key => !indexTree(choice.source).has(key))).toBe(true);
    const pastedLink = [...tree.values()].find(({ node }) => node.type === 'action.link')!.node;
    if (pastedLink.type !== 'action.link') throw new Error('Missing pasted link');
    expect(pastedLink.props.link.url).toBe('#' + nodeAnchor(added.instance_id));
    expect(inserted.assets).toHaveLength(2);
    const edited = executeDocumentCommand(inserted, { kind: 'style', id: added.instance_id, viewport: 'mobile',
      set: { columns: [{ fr: 1 }], row_gap: { value: 37, unit: 'px' } } }, next).document;
    expect(edited.blocks[1].responsive.mobile?.row_gap?.value).toBe(37);
    expect(validateDocumentV3(JSON.parse(JSON.stringify(edited)))).toEqual(edited);
    expect(choice.source.blocks[0].responsive).not.toEqual(edited.blocks[1].responsive);
  });
  it('refuses malformed, empty, duplicate and executable data without editing a source', () => {
    const source = validateDocumentV3(structuredClone(fixture));
    const original = JSON.stringify(source);
    expect(compositionChoices([])).toEqual([]);
    expect(() => compositionChoices([source, source])).toThrow('duplicate_composition');
    expect(() => compositionChoices([{ ...source, blocks: [] }])).toThrow('empty_composition');
    expect(() => compositionChoices([{ ...source, handler: 'execute()' }])).toThrow();
    expect(() => compositionChoices([{ ...source, assets: [] }])).toThrow('asset_reference');
    expect(() => compositionChoices([{ ...source, blocks: [{ ...source.blocks[0], type: 'legacy.block' }] }])).toThrow();
    expect(JSON.stringify(source)).toBe(original);
  });
  it('preserves all roots and delegates locked destinations and document limits to the same command', () => {
    const source = validateDocumentV3(structuredClone(fixture));
    source.blocks = source.blocks[0].slots.content!.filter(node => node.style.position !== 'absolute');
    const clipboard = compositionClipboard(compositionChoices([source])[0]);
    expect(clipboard.ids).toEqual(source.blocks.map(node => node.instance_id));
    const target = validateDocumentV3(structuredClone(fixture));
    target.blocks[0].locked = true;
    const before = JSON.stringify(target);
    expect(() => executeTreeCommand(target, { kind: 'paste', clipboard,
      destination: { parentId: target.blocks[0].instance_id, index: 0 } }, () => id(1))).toThrow('locked');
    expect(JSON.stringify(target)).toBe(before);
  });
});
