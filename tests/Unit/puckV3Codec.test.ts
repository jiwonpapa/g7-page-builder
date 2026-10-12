import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { cloneDocument, indexTree } from '../../resources/js/documents/v3/tree';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { executeTreeCommand } from '../../resources/js/documents/v3/commands';
import { documentToPuck, documentFromPuck, puckMoveCommand, assessPuckMove, assessPuckEdit, sameDocument } from '../../resources/js/editor/v3/codec';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function source() { return cloneDocument(validateDocumentV3(fixture)); }

describe('v3 Puck codec isolates the vendor representation', () => {
  it('round trips the full typed schema and does not alias the original or vendor state', () => {
    const doc = source(), data = documentToPuck(doc);
    const restored = documentFromPuck(data);
    expect(data.content[0].props.content.map(item => item.type)).toEqual(['Heading', 'Node', 'Text', 'Link']);
    expect(restored).toEqual(doc);
    expect(restored).not.toBe(doc);
    expect(sameDocument(restored, doc)).toBe(true);
    restored.blocks[0].name = 'changed';
    expect(data.content[0].props.node.name).not.toBe('changed');
    data.content[0].props.node.name = 'vendor change';
    expect(doc.blocks[0].name).not.toBe('vendor change');
  });
  it('preserves absent vs explicit empty content slots and permits normalized empty vendor zones', () => {
    const doc = source();
    doc.blocks[0].slots = {};
    const data = documentToPuck(doc);
    data.zones = {};
    expect(documentFromPuck(data)).toEqual(doc);
    doc.blocks[0].slots.content = [];
    expect(documentFromPuck(documentToPuck(doc))).toEqual(doc);
  });
  it('rejects raw legacy zones, unexpected fields, mismatched payload IDs and leaf slot contents', () => {
    const data = documentToPuck(source());
    expect(() => documentFromPuck({ ...data, zones: { other: [] } })).toThrow('puck_legacy_zones');
    expect(() => documentFromPuck({ ...data, extra: true })).toThrow('puck_unknown_field');
    expect(() => documentFromPuck({ ...data, content: [{ ...data.content[0], type: 'Alien' }] })).toThrow('puck_type');
    const first = data.content[0].props;
    expect(() => documentFromPuck({ ...data, content: [{ type: 'Node', props: { ...first, node: { ...first.node, instance_id: id(9) } } }] })).toThrow('puck_duplicate_source');
    first.content[0].props.slotPresent = true;
    expect(() => documentFromPuck(data)).toThrow('leaf_slots');
  });
  it('validates wire constraints, cycles, malformed slot data and metadata without coercion', () => {
    const data = documentToPuck(source());
    expect(() => documentFromPuck({ ...data, content: null })).toThrow('puck_content');
    expect(() => documentFromPuck({ ...data, root: [] })).toThrow('puck_shape');
    expect(() => documentFromPuck({ ...data, root: { props: { metadata: { ...data.root.props?.metadata, blocks: [] } } } })).toThrow('puck_duplicate_source');
    data.content[0].props.slotPresent = false;
    expect(documentFromPuck(data).blocks[0].slots.content).toHaveLength(4);
    data.content[0].props.node.name = 'x'.repeat(201);
    expect(() => documentFromPuck(data)).toThrow('value');
    const cycle: { content?: unknown } = {};
    cycle.content = cycle;
    expect(() => documentFromPuck(cycle)).toThrow('json');
  });
});

describe('v3 Puck structure actions use canonical commands', () => {
  it('accepts inline replace only as a canonical content command and rejects design or locked edits', () => {
    const doc = source(), data = documentToPuck(doc);
    const heading = data.content[0].props.content[0];
    heading.props.body = '<p>새 입력</p>';
    const action = { type: 'replace', destinationIndex: 0, destinationZone: id(1) + ':content', data: heading } as const;
    const result = assessPuckEdit(doc, data, action);
    expect(result.blocks[0].slots.content![0].props).toEqual({ level: 1, runs: [{ text: '새 입력' }] });
    expect(result).not.toHaveProperty('body');
    heading.props.node.style.opacity = 0.5;
    expect(() => assessPuckEdit(doc, data, action)).toThrow('puck_unexpected_change');
    delete heading.props.node.style.opacity;
    doc.blocks[0].locked = true;
    expect(() => assessPuckEdit(doc, data, action)).toThrow('locked');
  });
  it('translates final reorder positions to pre-removal domain positions and accepts only that change', () => {
    const doc = source();
    const action = { type: 'reorder', sourceIndex: 0, destinationIndex: 3, destinationZone: id(1) + ':content' } as const;
    const command = puckMoveCommand(doc, action);
    expect(command).toEqual({ kind: 'move', ids: [id(2)], destination: { parentId: id(1), index: 4 } });
    const moved = executeTreeCommand(doc, command, () => id(100)).document;
    expect(assessPuckMove(doc, documentToPuck(moved), action)).toEqual(moved);
    moved.blocks[0].name = 'unrelated';
    expect(() => assessPuckMove(doc, documentToPuck(moved), action)).toThrow('puck_unexpected_change');
  });
  it('handles root-to-container and reverse structural moves with stable canonical IDs', () => {
    const doc = source();
    const leaf = doc.blocks[0].slots.content!.shift()!;
    doc.blocks.push(leaf);
    const action = { type: 'move', sourceIndex: 1, sourceZone: 'root:default-zone', destinationIndex: 0, destinationZone: id(1) + ':content' } as const;
    const result = executeTreeCommand(doc, puckMoveCommand(doc, action), () => id(100));
    expect(assessPuckMove(doc, documentToPuck(result.document), action)).toEqual(result.document);
    expect(indexTree(result.document).get(id(2))?.parent?.instance_id).toBe(id(1));
  });
  it('rejects unknown actions/zones, missing source, locked nodes and absolute reparenting', () => {
    const doc = source();
    expect(() => puckMoveCommand(doc, { type: 'setUi', ui: {} })).toThrow('puck_action');
    expect(() => puckMoveCommand(doc, { type: 'reorder', sourceIndex: 0, destinationIndex: 0, destinationZone: 'bad' })).toThrow('puck_zone');
    expect(() => puckMoveCommand(doc, { type: 'reorder', sourceIndex: 99, destinationIndex: 0, destinationZone: 'root:default-zone' })).toThrow('puck_source');
    const action = { type: 'move', sourceIndex: 1, sourceZone: id(1) + ':content', destinationIndex: 1, destinationZone: 'root:default-zone' } as const;
    expect(() => assessPuckMove(doc, documentToPuck(doc), action)).toThrow('coordinate_conversion_required');
    doc.blocks[0].locked = true;
    expect(() => assessPuckMove(doc, documentToPuck(doc), { type: 'reorder', sourceIndex: 0, destinationIndex: 3, destinationZone: id(1) + ':content' })).toThrow('locked');
  });
});
