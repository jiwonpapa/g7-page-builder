import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { executeTreeCommand, type TreeCommand } from '../../resources/js/documents/v3/commands';
import { copyTree, freshId } from '../../resources/js/documents/v3/clipboard';
import { cloneDocument, indexTree, nodeAnchor, selectionRoots } from '../../resources/js/documents/v3/tree';
import type { DocumentV3, Node } from '../../resources/js/documents/v3/types';

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
function source(): DocumentV3 {
  const doc = cloneDocument(validateDocumentV3(fixture));
  for (const { node } of indexTree(doc).values()) { node.style = {}; node.responsive = {}; }
  return doc;
}
function ids() { let value = 100; return () => id(value++); }
function apply(doc: DocumentV3, command: TreeCommand) { return executeTreeCommand(doc, command, ids()); }
const content = (doc: DocumentV3) => doc.blocks[0].slots.content!;
const children = (doc: DocumentV3) => content(doc).map(node => node.instance_id);
function leaf(value = 20): Node {
  return { instance_id: id(value), block_version: 1, name: '새 제목', locked: false,
    type: 'content.heading', props: { level: 2, runs: [{ text: '제목' }] }, slots: {}, style: {}, responsive: {} };
}
function unchanged(doc: DocumentV3, command: TreeCommand, code: string): void {
  const before = JSON.stringify(doc);
  expect(() => apply(doc, command)).toThrow(code);
  expect(JSON.stringify(doc)).toBe(before);
}

describe('v3 tree identity and immutable commands', () => {
  it('indexes ancestors and normalizes parent/child duplicates in DOM order', () => {
    const tree = indexTree(source());
    expect(tree.get(id(2))?.ancestors.map(node => node.instance_id)).toEqual([id(1)]);
    expect(selectionRoots(tree, [id(5), id(2), id(2)]).map(item => item.node.instance_id)).toEqual([id(2), id(5)]);
    expect(selectionRoots(tree, [id(2), id(1)]).map(item => item.node.instance_id)).toEqual([id(1)]);
    expect(() => selectionRoots(tree, [])).toThrow('empty_selection');
    expect(() => selectionRoots(tree, [id(999)])).toThrow('missing_node');
  });
  it('inserts into root and recursive content without modifying supplied objects', () => {
    const doc = source(), node = leaf();
    const added = apply(doc, { kind: 'insert', destination: { parentId: id(1), index: 2 }, nodes: [node] });
    expect(children(added.document)).toEqual([id(2), id(3), id(20), id(4), id(5)]);
    expect(added.selection).toEqual([id(20)]);
    expect(added.changed).toBe(true);
    expect(content(doc)).toHaveLength(4);
    expect(content(added.document)[2]).not.toBe(node);
    expect(apply(doc, { kind: 'insert', destination: { parentId: null, index: 1 }, nodes: [node] }).document.blocks).toHaveLength(2);
  });
  it.each([-1, 99, 0.5, NaN])('rejects invalid insertion index %s', index => {
    unchanged(source(), { kind: 'insert', destination: { parentId: id(1), index }, nodes: [leaf()] }, 'destination_index');
  });
  it('rejects leaves, duplicate IDs, empty insertion and invalid names', () => {
    unchanged(source(), { kind: 'insert', destination: { parentId: id(2), index: 0 }, nodes: [leaf()] }, 'leaf_parent');
    unchanged(source(), { kind: 'insert', destination: { parentId: null, index: 0 }, nodes: [leaf(2)] }, 'duplicate_id');
    unchanged(source(), { kind: 'insert', destination: { parentId: null, index: 0 }, nodes: [] }, 'empty_selection');
    unchanged(source(), { kind: 'rename', id: id(2), name: 'x'.repeat(201) }, 'value');
  });
  it('moves using the pre-removal destination index and preserves reading order', () => {
    const doc = source();
    const result = apply(doc, { kind: 'move', ids: [id(4), id(2)], destination: { parentId: id(1), index: 4 } });
    expect(children(result.document)).toEqual([id(3), id(5), id(2), id(4)]);
    expect(result.selection).toEqual([id(2), id(4)]);
    expect(children(doc)).toEqual([id(2), id(3), id(4), id(5)]);
    const noOp = apply(doc, { kind: 'move', ids: [id(2)], destination: { parentId: id(1), index: 1 } });
    expect(noOp.changed).toBe(false);
    expect(noOp.document).toBe(doc);
  });
  it('reparents and removes redundant descendant selections once', () => {
    const doc = source();
    const result = apply(doc, { kind: 'move', ids: [id(4), id(2)], destination: { parentId: null, index: 1 } });
    expect(result.document.blocks.map(node => node.instance_id)).toEqual([id(1), id(2), id(4)]);
    expect(children(result.document)).toEqual([id(3), id(5)]);
    const deleted = apply(doc, { kind: 'delete', ids: [id(1), id(2), id(1)] });
    expect(deleted.document.blocks).toEqual([]);
    expect(deleted.document.assets).toEqual(doc.assets);
  });
  it('rejects parent cycles and new absolute parents without measured coordinates', () => {
    unchanged(source(), { kind: 'move', ids: [id(1)], destination: { parentId: id(1), index: 0 } }, 'parent_cycle');
    const doc = cloneDocument(validateDocumentV3(fixture));
    unchanged(doc, { kind: 'move', ids: [id(3)], destination: { parentId: null, index: 1 } }, 'coordinate_conversion_required');
    expect(apply(doc, { kind: 'move', ids: [id(3)], destination: { parentId: id(1), index: 4 } }).changed).toBe(true);
    doc.blocks[0].style = { position: 'relative' };
    content(doc)[0].responsive.mobile = { position: 'absolute' };
    unchanged(doc, { kind: 'move', ids: [id(2)], destination: { parentId: null, index: 1 } }, 'coordinate_conversion_required');
  });
  it('locks children through ancestors, permits explicit self-unlock, and rejects partial batches', () => {
    const doc = source();
    content(doc)[1].locked = true;
    for (const kind of ['delete', 'duplicate', 'group'] as const) unchanged(doc, { kind, ids: [id(2), id(3)] }, 'locked');
    unchanged(doc, { kind: 'delete', ids: [id(1)] }, 'locked');
    const unlocked = apply(doc, { kind: 'lock', ids: [id(3)], locked: false }).document;
    expect(content(unlocked)[1].locked).toBe(false);
    const parentLocked = apply(unlocked, { kind: 'lock', ids: [id(1)], locked: true }).document;
    unchanged(parentLocked, { kind: 'rename', id: id(2), name: '불가' }, 'locked');
    unchanged(parentLocked, { kind: 'lock', ids: [id(2)], locked: false }, 'locked');
    unchanged(parentLocked, { kind: 'insert', nodes: [leaf()], destination: { parentId: id(1), index: 0 } }, 'locked');
  });
  it('renames and hides without losing explicit responsive values; unchanged rename has no history entry', () => {
    const doc = source();
    content(doc)[0].responsive.mobile = { hidden: false };
    const named = apply(doc, { kind: 'rename', id: id(2), name: '주요 제목' });
    expect(content(named.document)[0].name).toBe('주요 제목');
    expect(apply(named.document, { kind: 'rename', id: id(2), name: '주요 제목' }).changed).toBe(false);
    const hidden = apply(named.document, { kind: 'hide', ids: [id(2)], hidden: true });
    expect(content(hidden.document)[0].style.hidden).toBe(true);
    expect(content(hidden.document)[0].responsive.mobile).toEqual({ hidden: false });
    expect(apply(hidden.document, { kind: 'hide', ids: [id(2)], hidden: false }).document.blocks[0].slots.content![0].style.hidden).toBe(false);
  });
  it('groups contiguous siblings and ungroups as one reversible transaction with stable child IDs', () => {
    const doc = source();
    const grouped = apply(doc, { kind: 'group', ids: [id(3), id(2)] });
    expect(grouped.selection).toEqual([id(100)]);
    expect(children(grouped.document)).toEqual([id(100), id(4), id(5)]);
    expect(content(grouped.document)[0].slots.content!.map(node => node.instance_id)).toEqual([id(2), id(3)]);
    const ungrouped = apply(grouped.document, { kind: 'ungroup', ids: grouped.selection });
    expect(ungrouped.document).toEqual(doc);
    expect(ungrouped.selection).toEqual([id(2), id(3)]);
  });
  it('rejects unsafe group transformations without consuming or mutating source', () => {
    const doc = source();
    unchanged(doc, { kind: 'group', ids: [id(2), id(5)] }, 'non_contiguous_selection');
    unchanged(doc, { kind: 'ungroup', ids: [id(1)] }, 'non_neutral_group');
    doc.blocks[0].style.display = 'flex';
    unchanged(doc, { kind: 'group', ids: [id(2), id(3)] }, 'group_layout_requires_measurement');
    doc.blocks[0].style = {};
    doc.blocks[0].responsive.mobile = { display: 'grid' };
    unchanged(doc, { kind: 'group', ids: [id(2), id(3)] }, 'group_layout_requires_measurement');
  });
  it('rejects mixed-parent grouping/duplication and styled wrapper ungrouping', () => {
    const doc = source();
    doc.blocks.push(leaf());
    unchanged(doc, { kind: 'group', ids: [id(2), id(20)] }, 'mixed_parents');
    unchanged(doc, { kind: 'duplicate', ids: [id(2), id(20)] }, 'mixed_parents');
    const group = apply(doc, { kind: 'group', ids: [id(2), id(3)] }).document;
    content(group)[0].style.opacity = 1;
    unchanged(group, { kind: 'ungroup', ids: [id(100)] }, 'non_neutral_group');
  });
  it('enforces 500-node and 16-depth limits after atomic changes', () => {
    const doc = source();
    doc.blocks = Array.from({ length: 500 }, (_, index) => leaf(index + 1000));
    unchanged(doc, { kind: 'insert', nodes: [leaf()], destination: { parentId: null, index: 0 } }, 'range');
    const deep = source();
    let parent = deep.blocks[0];
    parent.slots.content = [];
    for (let index = 2; index <= 16; index++) {
      const child: Node = { ...parent, instance_id: id(index), slots: { content: [] } };
      parent.slots.content!.push(child);
      parent = child;
    }
    unchanged(deep, { kind: 'insert', nodes: [leaf()], destination: { parentId: id(16), index: 0 } }, 'depth_limit');
  });
});

describe('v3 scoped clipboard and references', () => {
  it('copies an immutable snapshot and duplicates with fresh IDs and internal fragment rewiring', () => {
    const doc = source();
    const link = content(doc)[3];
    if (link.type !== 'action.link') throw new Error('fixture');
    link.props.link.url = '#' + nodeAnchor(id(2));
    const heading = content(doc)[0];
    if (heading.type !== 'content.heading') throw new Error('fixture');
    heading.props.runs[0].link = { url: '#' + nodeAnchor(id(5)), new_tab: false };
    const clipboard = copyTree(doc, [id(5), id(2)]);
    heading.name = '이후 변경';
    const result = apply(doc, { kind: 'paste', clipboard, destination: { parentId: id(1), index: 4 } });
    const [a, b] = content(result.document).slice(4);
    expect(a.instance_id).toBe(id(100));
    expect(a.name).not.toBe('이후 변경');
    expect(a.type === 'content.heading' && a.props.runs[0].link?.url).toBe('#' + nodeAnchor(id(101)));
    expect(b.type === 'action.link' && b.props.link.url).toBe('#' + nodeAnchor(id(100)));
    const dup = apply(source(), { kind: 'duplicate', ids: [id(1), id(2)] });
    expect(dup.document.blocks).toHaveLength(2);
    expect(indexTree(dup.document).size).toBe(10);
    expect(dup.document.assets).toEqual(doc.assets);
  });
  it('imports referenced assets and reconnects conflicting image/background asset IDs', () => {
    const doc = source(), target = source();
    const asset = doc.assets[0];
    content(doc)[1].style.background = { kind: 'image', asset_id: asset.asset_id, fit: 'cover', x: 50, y: 50 };
    target.assets[0].url = '/different.webp';
    const result = apply(target, { kind: 'paste', clipboard: copyTree(doc, [id(3)]), destination: { parentId: null, index: 1 } });
    expect(result.document.assets).toEqual([target.assets[0], { ...asset, asset_id: id(101) }]);
    const image = result.document.blocks[1];
    expect(image.type === 'media.image' && image.props.asset_id).toBe(id(101));
    expect(image.style.background?.kind === 'image' && image.style.background.asset_id).toBe(id(101));
    target.blocks = []; target.assets = [];
    const empty = apply(target, { kind: 'paste', clipboard: copyTree(doc, [id(3)]), destination: { parentId: null, index: 0 } });
    expect(empty.document.assets).toEqual(doc.assets);
  });
  it('preserves explicit source token colors across documents and same-token identity within one document', () => {
    const doc = source(), target = source();
    const clipboard = copyTree(doc, [id(2)]);
    target.tokens.text = { kind: 'hex', value: '#000000' };
    const pasted = apply(target, { kind: 'paste', clipboard, destination: { parentId: null, index: 1 } }).document.blocks[1];
    expect(pasted.type === 'content.heading' && pasted.props.runs[0].color).toEqual(doc.tokens.text);
    const same = apply(doc, { kind: 'duplicate', ids: [id(2)] }).document.blocks[0].slots.content![1];
    expect(same.type === 'content.heading' && same.props.runs[0].color).toEqual({ kind: 'token', value: 'text' });
  });
  it('validates clipboard and generated IDs without partial target asset writes', () => {
    const doc = source(), before = JSON.stringify(doc);
    expect(() => executeTreeCommand(doc, { kind: 'duplicate', ids: [id(1)] }, () => id(1))).toThrow('generated_id');
    expect(() => freshId(new Set(), () => 'bad')).toThrow('generated_id');
    const clipboard = copyTree(doc, [id(3)]);
    clipboard.source.assets = [];
    unchanged(doc, { kind: 'paste', clipboard, destination: { parentId: null, index: 1 } }, 'asset_reference');
    const next = copyTree(doc, [id(1)]);
    expect(() => executeTreeCommand(doc, { kind: 'paste', clipboard: next, destination: { parentId: null, index: 1 } }, () => id(100))).toThrow('generated_id');
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('rejects copying unknown IDs and pasting an absolute root without coordinate conversion', () => {
    const doc = cloneDocument(validateDocumentV3(fixture));
    expect(() => copyTree(doc, [id(900)])).toThrow('missing_node');
    unchanged(doc, { kind: 'paste', clipboard: copyTree(doc, [id(3)]), destination: { parentId: id(1), index: 0 } }, 'coordinate_conversion_required');
  });
});
