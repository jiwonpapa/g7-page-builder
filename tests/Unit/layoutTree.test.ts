import { describe, expect, it } from 'vitest';
import cases from '../Fixtures/layout-policy-cases.json';
import manifest from '../../resources/block-packs/builtin-core/manifest.json';
import { compactJsonBytes, layoutAllowsChild, layoutPolicy, LayoutPolicyError, validateLayoutDocument } from '../../resources/js/documents/layoutPolicy';
import type { LayoutDocument } from '../../resources/js/documents/layoutPolicy';
import { cloneLayoutNode, cloneLayoutSubtree, deleteLayoutNode, findLayoutNode, moveLayoutNode, resizeLayoutColumns } from '../../resources/js/documents/layoutTree';
import type { PageBuilderBlock } from '../../resources/js/documents/types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type FixtureDocument = typeof cases.valid & LayoutDocument;
const fresh = (): FixtureDocument => structuredClone(cases.valid) as FixtureDocument;
const leaf = (n: number): PageBuilderBlock => ({ instance_id: id(n), type: 'content.heading-01', block_version: 1, props: { heading: '제목' } });
function mutate(value: unknown, path: Array<string | number>, replacement: unknown): void {
  const [key, ...rest] = path;
  if (typeof value !== 'object' || value === null || key === undefined) throw new Error('Invalid fixture path');
  const record = value as Record<string | number, unknown>;
  if (rest.length === 0) record[key] = replacement;
  else mutate(record[key], rest, replacement);
}

describe('shared layout policy (structure only, not a v2 API enablement)', () => {
  it('pins the compatibility root inventory and accepts the maximum legal depth', () => {
    expect(layoutPolicy.root_types).toEqual(manifest.blocks.map((block) => block.block_id));
    expect(validateLayoutDocument(cases.valid)).toBe(cases.valid);
  });
  it.each(cases.cases)('$name', ({ path, value, error }) => {
    const document = fresh();
    mutate(document, path, value);
    expect(() => validateLayoutDocument(document)).toThrowError(new RegExp(`^${error}:`));
  });
  it.each(cases.byte_cases)('counts compact UTF-8 bytes: $bytes', ({ value, bytes }) => {
    expect(compactJsonBytes(value)).toBe(bytes);
  });
  it('enforces every declared parent against all 45 compatibility types and three layouts', () => {
    const { section, columns, stack } = layoutPolicy.layouts;
    for (const type of [...layoutPolicy.root_types, section, columns, stack]) {
      const basic = layoutPolicy.leaf_types.includes(type);
      expect(layoutAllowsChild(null, type)).toBe(layoutPolicy.root_types.includes(type) || type === section);
      expect(layoutAllowsChild(section, type)).toBe(basic || type === columns || type === stack);
      expect(layoutAllowsChild(columns, type)).toBe(basic || type === stack);
      expect(layoutAllowsChild(stack, type)).toBe(basic);
      expect(layoutAllowsChild('content.heading-01', type)).toBe(false);
    }
  });
  it('allows empty containers, missing legal slots and existing flat compatibility instances', () => {
    for (const type of layoutPolicy.root_types) expect(validateLayoutDocument({ blocks: [{ ...leaf(1), type, slots: {} }] }).blocks).toHaveLength(1);
    expect(validateLayoutDocument({ blocks: [{ ...leaf(1), type: layoutPolicy.layouts.section }] }).blocks).toHaveLength(1);
    const document = { blocks: [{ ...leaf(1), type: layoutPolicy.layouts.section }] };
    expect(moveLayoutNode({ ...document, blocks: [...document.blocks, leaf(2)] }, id(2), { parentId: id(1), slot: 'content', index: 0 }).blocks[0].slots?.content).toHaveLength(1);
  });
  it('accepts exactly 500 total nodes and rejects 501 without a partial result', () => {
    const document = { blocks: Array.from({ length: 500 }, (_, index) => leaf(index + 1)) };
    expect(validateLayoutDocument(document)).toBe(document);
    expect(() => validateLayoutDocument({ blocks: [...document.blocks, leaf(501)] })).toThrow(/^node_limit:/);
  });
  it('accepts 200 slot children and rejects 201', () => {
    const document = { blocks: [{ ...leaf(1), type: layoutPolicy.layouts.section, slots: { content: Array.from({ length: 200 }, (_, index) => leaf(index + 2)) } }] };
    expect(validateLayoutDocument(document)).toBe(document);
    document.blocks[0].slots.content.push(leaf(202));
    expect(() => validateLayoutDocument(document)).toThrow(/^slot_limit:/);
  });
  it('accepts exactly 1 MiB and rejects one additional byte including multilingual content', () => {
    const document = { blocks: [], note: '한글😀/\n' };
    document.note += 'x'.repeat(layoutPolicy.limits.utf8_bytes - compactJsonBytes(document));
    expect(validateLayoutDocument(document)).toBe(document);
    expect(() => validateLayoutDocument({ ...document, note: document.note + 'x' })).toThrow(/^byte_limit:/);
  });
  it('rejects cycles and non-JSON values rather than discarding data', () => {
    const document: { blocks: PageBuilderBlock[]; self?: unknown } = { blocks: [] };
    document.self = document;
    for (const value of [document, { blocks: [], value: undefined }, { blocks: [], value: NaN }, { blocks: [], value: new Date() }, { blocks: [], value: 1n }, { blocks: [], [Symbol('lost')]: 'content' }, { blocks: [], toJSON: () => ({ blocks: [] }) }]) {
      expect(() => validateLayoutDocument(value)).toThrow(LayoutPolicyError);
    }
  });
});

describe('atomic canonical tree operations', () => {
  it('finds a stable parent path and moves content/styles/metadata without changing IDs', () => {
    const document = fresh();
    const before = structuredClone(document);
    expect(findLayoutNode(document, id(5))?.ancestors).toEqual([id(2), id(3), id(4)]);
    const result = moveLayoutNode(document, id(5), { parentId: id(3), slot: 'column2', index: 1 });
    expect(result.blocks[0].slots.content[0].slots.column2[1]).toEqual(findLayoutNode(document, id(5))?.node);
    expect(result.seo).toEqual(document.seo);
    expect(result.tokens).toEqual(document.tokens);
    expect(document).toEqual(before);
  });
  it('defines same-slot target index after source removal', () => {
    const document = { blocks: [leaf(1), leaf(2), leaf(3)] };
    expect(moveLayoutNode(document, id(1), { parentId: null, slot: 'blocks', index: 2 }).blocks.map((node) => node.instance_id)).toEqual([id(2), id(3), id(1)]);
  });
  it('rejects a self/descendant target, unknown node, illegal slot and invalid index atomically', () => {
    const document = fresh();
    const before = structuredClone(document);
    for (const [source, target] of [[id(2), { parentId: id(4), slot: 'content', index: 0 }], [id(2), { parentId: id(2), slot: 'content', index: 0 }], [id(99), { parentId: null, slot: 'blocks', index: 0 }], [id(5), { parentId: id(3), slot: 'column3', index: 0 }], [id(5), { parentId: null, slot: 'blocks', index: -1 }]] as const) {
      expect(() => moveLayoutNode(document, source, target)).toThrow();
      expect(document).toEqual(before);
    }
  });
  it('clones the complete subtree with new IDs and preserved values', () => {
    let sequence = 100;
    const document = fresh();
    const result = cloneLayoutNode(document, id(2), { parentId: null, slot: 'blocks', index: 1 }, () => id(sequence++));
    expect(result.blocks).toHaveLength(2);
    expect(findLayoutNode(result, id(103))?.node.props).toEqual(findLayoutNode(document, id(5))?.node.props);
    expect(findLayoutNode(result, id(103))?.node).toHaveProperty('responsive');
    expect(() => cloneLayoutNode(document, id(2), { parentId: null, slot: 'blocks', index: 1 }, () => id(2))).toThrow(/^duplicate_id:/);
    expect(document.blocks).toHaveLength(1);
  });
  it('clones a stored Section pattern independently without a source document envelope', () => {
    let sequence = 200;
    const source = structuredClone(fresh().blocks[0]);
    const cloned = cloneLayoutSubtree(source, () => id(sequence++));
    expect(cloned.instance_id).toBe(id(200));
    expect(cloned.slots?.content[0]?.instance_id).toBe(id(201));
    expect(cloned.slots?.content[0]?.slots?.column1[0]?.props).toEqual(source.slots?.content[0]?.slots?.column1[0]?.props);
    (cloned.slots!.content[0]!.slots!.column1[0]!.props as Record<string, unknown>).heading = '독립 수정';
    expect((source.slots?.content[0]?.slots?.column1[0]?.props as Record<string, unknown>).heading).not.toBe('독립 수정');
  });
  it('requires structural deletion confirmation and keeps the original reference when declined', () => {
    const document = fresh();
    const pending = deleteLayoutNode(document, id(3));
    expect(pending).toMatchObject({ status: 'confirmation-required', affectedNodes: 4 });
    expect(pending.document).toBe(document);
    const applied = deleteLayoutNode(document, id(3), true);
    expect(applied.status).toBe('applied');
    expect(applied.document.blocks[0].slots.content).toEqual([]);
    expect(document.blocks[0].slots.content).toHaveLength(1);
    expect(deleteLayoutNode({ blocks: [leaf(1)] }, id(1))).toEqual({ status: 'applied', document: { blocks: [] } });
  });
  it('merges removed columns in order only after confirmation; expansion adds empty stable slots', () => {
    const document = fresh();
    const pending = resizeLayoutColumns(document, id(3), 1, '1');
    expect(pending).toMatchObject({ status: 'confirmation-required', affectedNodes: 1, targetSlot: 'column1' });
    expect(pending.document).toBe(document);
    const applied = resizeLayoutColumns(document, id(3), 1, '1', true);
    const columns = findLayoutNode(applied.document, id(3))!.node;
    expect(columns.props).toMatchObject({ columns: 1, ratio: '1' });
    expect(Object.keys(columns.slots!)).toEqual(['column1']);
    expect(columns.slots!.column1.map((node) => node.instance_id)).toEqual([id(4), id(6)]);
    const expanded = resizeLayoutColumns(applied.document, id(3), 3, '1:1:1');
    expect(findLayoutNode(expanded.document, id(3))!.node.slots).toMatchObject({ column2: [], column3: [] });
  });
  it('rejects overflow during clone and column merge without modifying the document', () => {
    const full = { blocks: Array.from({ length: 500 }, (_, index) => leaf(index + 1)) };
    expect(() => cloneLayoutNode(full, id(1), { parentId: null, slot: 'blocks', index: 500 }, () => id(999))).toThrow(/^node_limit:/);
    const document = fresh();
    const columns = findLayoutNode(document, id(3))!.node;
    columns.slots!.column1 = Array.from({ length: 200 }, (_, index) => leaf(index + 100));
    const before = structuredClone(document);
    expect(() => resizeLayoutColumns(document, id(3), 1, '1', true)).toThrow(/^slot_limit:/);
    expect(document).toEqual(before);
  });
  it('rejects malformed destinations and column commands without dropping data', () => {
    const document = fresh();
    expect(findLayoutNode(document, id(999))).toBeUndefined();
    for (const target of [{ parentId: null, slot: 'wrong', index: 0 }, { parentId: id(999), slot: 'content', index: 0 }, { parentId: null, slot: 'blocks', index: 9 }, { parentId: null, slot: 'blocks', index: 0.5 }]) {
      expect(() => moveLayoutNode(document, id(5), target)).toThrow();
    }
    expect(() => resizeLayoutColumns(document, id(5), 1, '1')).toThrow(/^columns:/);
    expect(() => resizeLayoutColumns(document, id(3), 3, '1:2')).toThrow(/^columns:/);
    expect(() => cloneLayoutNode(document, id(5), { parentId: null, slot: 'blocks', index: 1 }, () => 'invalid')).toThrow(/^id:/);
  });
});
