import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { geometryCommand, geometryTargets, selectedStyle, type GeometryBox } from '../../resources/js/documents/v3/geometry';

function setup() {
  const doc = cloneDocument(validateDocumentV3(fixture));
  const parent = doc.blocks[0]; parent.style = { position: 'relative' }; parent.responsive = {};
  const template = parent.slots.content![0];
  parent.slots.content = [0, 1, 2].map(index => ({ ...JSON.parse(JSON.stringify(template)), instance_id: '00000000-0000-4000-8000-' + String(index + 20).padStart(12, '0'),
    style: { position: 'absolute', width: { value: 100, unit: 'px' }, height: { value: 50, unit: 'px' } }, responsive: {} }));
  const ids = parent.slots.content.map(node => node.instance_id);
  const boxes: GeometryBox[] = ids.map((id, i) => ({ id, left: i * 200, top: i * 30, width: 100, height: 50 }));
  const apply = (command: Parameters<typeof executeDocumentCommand>[1]) => executeDocumentCommand(doc, command, () => { throw Error('no ID allocation'); });
  return { doc, parent, ids, boxes, apply };
}
describe('v3 atomic multiple design edits', () => {
  it('applies multiple fields once and leaves source and overrides intact', () => {
    const s = setup(), before = JSON.stringify(s.doc);
    const result = s.apply({ kind: 'styles', updates: s.ids.map(id => ({ id, set: { opacity: 0, width: { value: 12, unit: 'rem' } } })) });
    expect(result.selection).toEqual(s.ids);
    expect(result.document.blocks[0].slots.content!.every(node => node.style.opacity === 0)).toBe(true);
    expect(JSON.stringify(s.doc)).toBe(before);
    expect(s.apply({ kind: 'styles', updates: s.ids.map(id => ({ id, set: {} })) }).document).toBe(s.doc);
  });
  it('deduplicates parent and descendant selection without double application', () => {
    const s = setup();
    const result = s.apply({ kind: 'styles', updates: [s.parent.instance_id, s.ids[0]].map(id => ({ id, set: { opacity: .4 } })) });
    expect(result.selection).toEqual([s.parent.instance_id]);
    expect(result.document.blocks[0].style.opacity).toBe(.4);
    expect(result.document.blocks[0].slots.content![0].style.opacity).toBeUndefined();
  });
  it('rejects empty, repeated, locked, missing or invalid members without a partial write', () => {
    const s = setup(), before = JSON.stringify(s.doc);
    for (const updates of [[], [s.ids[0], s.ids[0]].map(id => ({ id, set: {} })), [{ id: 'missing', set: {} }],
      [{ id: s.ids[0], set: { opacity: .5 } }, { id: s.ids[1], set: { opacity: -1 } }]]) {
      expect(() => s.apply({ kind: 'styles', updates })).toThrow();
      expect(JSON.stringify(s.doc)).toBe(before);
    }
    s.parent.slots.content![1].locked = true;
    expect(() => s.apply({ kind: 'styles', updates: s.ids.map(id => ({ id, set: { opacity: .1 } })) })).toThrow('locked');
    expect(s.parent.slots.content![0].style.opacity).toBeUndefined();
  });
  it('distinguishes mixed values, zero and omission in the Inspector', () => {
    const s = setup();
    expect(selectedStyle(s.doc, s.ids, 'opacity')).toEqual({ mixed: false, value: undefined });
    s.parent.slots.content![0].style.opacity = 0;
    expect(selectedStyle(s.doc, s.ids, 'opacity')).toEqual({ mixed: true, value: 0 });
    expect(selectedStyle(s.doc, s.ids, 'width').mixed).toBe(false);
  });
});
describe('v3 measured geometry commands', () => {
  it('resizes proportionally and preserves non-edited fields', () => {
    const s = setup();
    const result = s.apply(geometryCommand(s.doc, s.ids, s.boxes, { kind: 'resize', width: 150, height: 99, keepRatio: true }));
    expect(result.document.blocks[0].slots.content![0].style).toMatchObject({ width: { value: 150, unit: 'px' }, height: { value: 75, unit: 'px' }, aspect_ratio: 2 });
    expect(result.document.blocks[0].slots.content![1].style).toMatchObject({ inset_left: { value: 300, unit: 'px' }, inset_top: { value: 45, unit: 'px' } });
    expect(result.selection).toEqual(s.ids);
  });
  it('scales group offsets around the top-left anchor and rejects incompatible groups atomically', () => {
    const s = setup(), operation = { kind: 'resize', width: 200, height: 50, keepRatio: false } as const;
    s.boxes.forEach(box => { box.left += 80; box.top += 40; });
    s.parent.slots.content![1].style.inset_right = { value: 20, unit: '%' };
    const result = s.apply(geometryCommand(s.doc, s.ids, s.boxes, operation));
    expect(result.document.blocks[0].slots.content![1].style).toMatchObject({ inset_left: { value: 480, unit: 'px' }, inset_top: { value: 70, unit: 'px' } });
    expect(result.document.blocks[0].slots.content![1].style.inset_right).toBeUndefined();
    s.parent.slots.content![1].style.rotation = 15;
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, operation)).toThrow('rotated_group_resize');
    delete s.parent.slots.content![1].style.rotation;
    s.parent.slots.content![1].style.position = 'flow';
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, operation)).toThrow('absolute_required');
    expect(s.parent.slots.content![0].style.width).toEqual({ value: 100, unit: 'px' });
  });
  it('resets aspect ratio when unlocked and neutralizes Flex grow and shrink', () => {
    const s = setup(); s.parent.style.display = 'flex';
    s.parent.slots.content![0].style.aspect_ratio = 2;
    const result = s.apply(geometryCommand(s.doc, [s.ids[0]], s.boxes, { kind: 'resize', width: 150, height: 90, keepRatio: false }));
    const style = result.document.blocks[0].slots.content![0].style;
    expect(style).toMatchObject({ height: { value: 90, unit: 'px' }, grow: 0, shrink: 0, basis: 'auto' });
    expect(style.aspect_ratio).toBeUndefined();
  });
  it('moves absolute nodes by CSS pixels and resets conflicting far anchors', () => {
    const s = setup(); s.parent.slots.content![0].style.inset_right = { value: 10, unit: '%' };
    const result = s.apply(geometryCommand(s.doc, s.ids, s.boxes, { kind: 'translate', x: 10, y: -5 }));
    expect(result.document.blocks[0].slots.content![0].style).toMatchObject({ inset_left: { value: 10, unit: 'px' }, inset_top: { value: -5, unit: 'px' } });
    expect(result.document.blocks[0].slots.content![0].style.inset_right).toBeUndefined();
  });
  it('rotates each allowed element through the typed contract', () => {
    const s = setup();
    const result = s.apply(geometryCommand(s.doc, s.ids, s.boxes, { kind: 'rotate', degrees: 15 }));
    expect(result.document.blocks[0].slots.content!.map(node => node.style.rotation)).toEqual([15, 15, 15]);
    expect(() => s.apply(geometryCommand(s.doc, s.ids, s.boxes, { kind: 'rotate', degrees: 99999 }))).toThrow();
  });
  it.each(['x', 'y'] as const)('aligns all three edges in the same %s context', axis => {
    const s = setup();
    for (const edge of ['start', 'center', 'end'] as const) {
      const result = s.apply(geometryCommand(s.doc, s.ids, s.boxes, { kind: 'align', axis, edge }));
      const field = axis === 'x' ? 'inset_left' : 'inset_top';
      expect(new Set(result.document.blocks[0].slots.content!.map(node => JSON.stringify(node.style[field]))).size).toBe(1);
    }
  });
  it.each(['x', 'y'] as const)('distributes equal gaps along %s, preserving endpoints', axis => {
    const s = setup();
    s.boxes.forEach((box, i) => { box.left = [0, 110, 500][i]; box.top = [0, 70, 300][i]; });
    const result = s.apply(geometryCommand(s.doc, s.ids, s.boxes, { kind: 'distribute', axis }));
    expect(result.document.blocks[0].slots.content![1].style[axis === 'x' ? 'inset_left' : 'inset_top']).toEqual({ value: axis === 'x' ? 250 : 150, unit: 'px' });
  });
  it('rejects incompatible flow, parent, rotation, overlap and too few distribution targets', () => {
    const s = setup(), align = { kind: 'align', axis: 'x', edge: 'start' } as const;
    expect(() => geometryCommand(s.doc, s.ids.slice(0, 2), s.boxes, { kind: 'distribute', axis: 'x' })).toThrow('distribution_count');
    expect(() => geometryCommand(s.doc, s.ids, s.boxes.map(box => ({ ...box, left: 0 })), { kind: 'distribute', axis: 'x' })).toThrow('distribution_overlap');
    s.parent.slots.content![0].style.rotation = 30;
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, align)).toThrow('rotated_alignment');
    delete s.parent.slots.content![0].style.rotation;
    s.parent.style.rotation = 15;
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, align)).toThrow('rotated_parent');
    delete s.parent.style.rotation;
    s.parent.slots.content![0].style.position = 'flow';
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, align)).toThrow('absolute_required');
    s.parent.slots.content![0].style.position = 'absolute';
    const other = JSON.parse(JSON.stringify(s.parent)); other.instance_id = '00000000-0000-4000-8000-000000000099';
    other.slots.content = [s.parent.slots.content!.pop()]; s.doc.blocks.push(other);
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, align)).toThrow('mixed_parents');
  });
  it('rejects bad measurements and nonfinite operations before creating a command', () => {
    const s = setup();
    expect(() => geometryTargets(s.doc, s.ids, [])).toThrow('geometry_measurement');
    expect(() => geometryTargets(s.doc, s.ids, [...s.boxes, s.boxes[0]])).toThrow('geometry_duplicate');
    expect(() => geometryTargets(s.doc, s.ids, s.boxes.map(box => ({ ...box, width: NaN })))).toThrow('geometry_measurement');
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, { kind: 'resize', width: 0, height: 1, keepRatio: false })).toThrow('geometry_size');
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, { kind: 'translate', x: Infinity, y: 0 })).toThrow('geometry_offset');
    expect(() => geometryCommand(s.doc, s.ids, s.boxes, { kind: 'rotate', degrees: NaN })).toThrow('geometry_rotation');
    s.parent.slots.content![0].style.hidden = true;
    expect(() => geometryTargets(s.doc, s.ids, s.boxes)).toThrow('hidden');
  });
});
