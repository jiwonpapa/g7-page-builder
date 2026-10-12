import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { CompositionBuilder, outline, px, token } from '../../resources/js/blocks/v3/compositionBuilder';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { indexTree } from '../../resources/js/documents/v3/tree';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = () => { let count = 100; return () => id(count++); };
describe('canonical composition builder', () => {
  it('does not mutate input and imports only referenced assets through the existing paste transaction', () => {
    const document = validateDocumentV3(structuredClone(fixture)), before = JSON.stringify(document), next = ids();
    const builder = new CompositionBuilder(document, next);
    const first = builder.image('사진', '/images/new.webp', '사진 설명');
    const second = builder.image('사진 2', '/images/new.webp', '다른 설명');
    const root = builder.frame('구성', [first, second]);
    const clipboard = builder.finish(root);
    expect(first.type === 'media.image' && second.type === 'media.image' && first.props.asset_id === second.props.asset_id).toBe(true);
    expect(clipboard.source.assets).toHaveLength(document.assets.length + 1);
    const result = executeTreeCommand(document, { kind: 'paste', clipboard, destination: { parentId: null, index: document.blocks.length } }, next);
    expect(result.document.assets).toHaveLength(document.assets.length + 1);
    expect(JSON.stringify(document)).toBe(before);
    expect(result.selection[0]).not.toBe(root.instance_id);
    root.name = '외부 변경';
    expect(clipboard.source.blocks[0].name).toBe('구성');
  });
  it('keeps authored styles and template instances detached', () => {
    const document = validateDocumentV3(structuredClone(fixture)), b = new CompositionBuilder(document, ids());
    const style = { ...outline(), width: px(100), color: token('primary') };
    const one = b.frame('하나', [], style), two = b.frame('둘', [], style), text = b.text('문구', '<escaped>', style);
    one.style.width = px(200); style.width.value = 300;
    expect(two.style.width).toEqual(px(100)); expect(text.style.width).toEqual(px(100));
    const nodes = b.finish(b.frame('루트', [one, two, text])).source.blocks[0].slots.content!;
    expect(nodes[2].type === 'content.text' && nodes[2].props.paragraphs[0][0].text).toBe('<escaped>');
  });
  it('supports placeholders, optional links, default headings and responsive grids without inventing URLs', () => {
    const document = validateDocumentV3(structuredClone(fixture)), b = new CompositionBuilder(document, ids());
    const source = b.finish(b.section('구성', '', '', [b.grid('열', [b.image('이미지', '', ''), b.link('문구', '링크 없음', ''),
      b.heading('제목', '기본 제목'), b.link('일반 링크', '보기', '/view'), b.link('보조 링크', '더 보기', '/more', 'secondary')], 3)])).source;
    const nodes = [...indexTree(source).values()].map(item => item.node);
    expect(nodes.some(node => node.type === 'media.image')).toBe(false);
    expect(nodes.find(node => node.name === '문구')?.type).toBe('content.text');
    expect(nodes.find(node => node.name === '열')?.responsive.tablet?.columns).toHaveLength(2);
    expect(nodes.find(node => node.name === '열')?.responsive.mobile?.columns).toHaveLength(1);
    expect(nodes.find(node => node.name === '제목')?.style.font_size).toEqual(px(28));
  });
  it('rejects unsafe assets, IDs, and over-limit trees without changing the target', () => {
    const document = validateDocumentV3(structuredClone(fixture)), before = JSON.stringify(document);
    const collision = new CompositionBuilder(document, () => document.blocks[0].instance_id);
    expect(() => collision.text('중복', '')).toThrow('generated_id');
    const b = new CompositionBuilder(document, ids());
    expect(() => b.finish(b.image('안전하지 않은 이미지', 'javascript:alert(1)', ''))).toThrow('value');
    const large = new CompositionBuilder(document, ids());
    expect(() => large.finish(large.frame('루트', Array.from({ length: 500 }, () => large.text('본문', ''))))).toThrow('node_limit');
    expect(JSON.stringify(document)).toBe(before);
  });
});
