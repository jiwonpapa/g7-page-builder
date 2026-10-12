import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { effectiveStyle, validateDocumentV3, viewportAt, type Viewport } from '../../resources/js/documents/v3/validate';
import { cloneDocument, indexTree } from '../../resources/js/documents/v3/tree';
import { executeDocumentCommand, type DocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { geometryCommand, geometryTargets, selectedStyle } from '../../resources/js/documents/v3/geometry';
import { documentPresentation } from '../../resources/js/documents/v3/presentation';

const px = (value: number) => ({ value, unit: 'px' as const });
function setup() {
  const doc = cloneDocument(validateDocumentV3(fixture));
  for (const { node } of indexTree(doc).values()) { node.style = {}; node.responsive = {}; }
  const parent = doc.blocks[0], child = parent.slots.content![0], id = child.instance_id;
  const apply = (command: DocumentCommand) => executeDocumentCommand(doc, command, () => { throw Error('no new identity'); });
  return { doc, parent, child, id, apply };
}
describe('v3 responsive command contract', () => {
  it.each([[360, 'mobile'], [639, 'mobile'], [640, 'tablet'], [768, 'tablet'], [1023, 'tablet'], [1024, 'base'], [1280, 'base']] as const)(
    'selects the existing independent breakpoint at %i', (width, viewport) => expect(viewportAt(width)).toBe(viewport));
  it('preserves zero and false as explicit overrides and never cascades tablet into mobile', () => {
    const s = setup(); s.child.style = { width: px(400), opacity: .8, hidden: true };
    s.child.responsive.tablet = { width: px(300), opacity: .5 };
    const result = s.apply({ kind: 'style', id: s.id, viewport: 'mobile', set: { opacity: 0, hidden: false } });
    const node = result.document.blocks[0].slots.content![0];
    expect(node.style).toEqual(s.child.style);
    expect(node.responsive.tablet).toEqual(s.child.responsive.tablet);
    expect(effectiveStyle(node, 'mobile')).toEqual({ width: px(400), opacity: 0, hidden: false });
    expect(documentPresentation(result.document, 'mobile').get(s.id)?.opacity).toBe('0');
    expect(documentPresentation(result.document, 'base').get(s.id)?.display).toBe('none');
    expect(s.child.responsive.mobile).toBeUndefined();
  });
  it('resets individual and whole layers to current common values without losing other widths', () => {
    const s = setup(); s.child.style = { width: px(400), opacity: .8 };
    s.child.responsive = { tablet: { opacity: .7 }, mobile: { width: px(200), opacity: 0 } };
    let result = s.apply({ kind: 'style', id: s.id, viewport: 'mobile', set: {}, reset: ['width'] });
    let node = result.document.blocks[0].slots.content![0];
    expect(effectiveStyle(node, 'mobile')).toEqual({ width: px(400), opacity: 0 });
    result = executeDocumentCommand(result.document, { kind: 'style', id: s.id, viewport: 'mobile', set: {}, reset: ['opacity'] }, () => '');
    node = result.document.blocks[0].slots.content![0];
    expect(node.responsive).toEqual({ tablet: { opacity: .7 } });
    expect(effectiveStyle(node, 'mobile')).toEqual(node.style);
    expect(s.apply({ kind: 'style', id: s.id, viewport: 'tablet', set: { opacity: .7 } }).document).toBe(s.doc);
  });
  it('applies batches atomically and respects inherited locks and invalid effective combinations', () => {
    const s = setup(), second = s.parent.slots.content![1];
    s.child.style = { min_width: px(200), max_width: px(500) };
    const before = JSON.stringify(s.doc);
    expect(() => s.apply({ kind: 'styles', viewport: 'mobile', updates: [
      { id: second.instance_id, set: { opacity: 0 } }, { id: s.id, set: { max_width: px(100) } },
    ] })).toThrow('size_order');
    expect(JSON.stringify(s.doc)).toBe(before);
    s.parent.locked = true;
    expect(() => s.apply({ kind: 'style', viewport: 'tablet', id: s.id, set: { opacity: 0 } })).toThrow('locked');
    s.parent.locked = false;
    expect(() => s.apply({ kind: 'style', viewport: 'mobile', id: s.id, set: { opacity: 0 }, reset: ['opacity'] })).toThrow('style_reset');
    // Runtime input must not bypass the typed viewport boundary.
    expect(() => s.apply(JSON.parse(JSON.stringify({ kind: 'style', viewport: 'desktop', id: s.id, set: {} })))).toThrow('viewport');
  });
  it('reads mixed effective values and writes only the requested layer for selection roots', () => {
    const s = setup(), second = s.parent.slots.content![1], ids = [s.id, second.instance_id];
    s.child.style.opacity = .4; second.style.opacity = .4;
    s.child.responsive.mobile = { opacity: 0 };
    expect(selectedStyle(s.doc, ids, 'opacity', 'base')).toEqual({ mixed: false, value: .4 });
    expect(selectedStyle(s.doc, ids, 'opacity', 'mobile')).toEqual({ mixed: true, value: 0 });
    const result = s.apply({ kind: 'styles', viewport: 'mobile', updates: ids.map(id => ({ id, set: { opacity: 0 } })) });
    expect(selectedStyle(result.document, ids, 'opacity', 'mobile')).toEqual({ mixed: false, value: 0 });
    expect(selectedStyle(result.document, ids, 'opacity', 'base')).toEqual({ mixed: false, value: .4 });
    expect(s.apply({ kind: 'style', viewport: 'tablet', id: s.id, set: {} }).document).toBe(s.doc);
    s.child.responsive.tablet = {};
    expect(s.apply({ kind: 'style', viewport: 'tablet', id: s.id, set: {} }).document).toBe(s.doc);
  });
  it.each(['tablet', 'mobile'] as const)('uses effective constraints, rotation and far anchors for %s geometry', viewport => {
    const s = setup();
    s.parent.style = { position: 'relative' };
    s.parent.responsive[viewport] = { display: 'flex' };
    s.child.style = { position: 'absolute', hidden: true, inset_right: px(30), inset_bottom: px(40), rotation: 10 };
    s.child.responsive[viewport] = { hidden: false, rotation: 20 };
    const boxes = [{ id: s.id, left: 50, top: 60, width: 100, height: 80 }];
    const before = JSON.stringify(s.child.style);
    const resize = s.apply(geometryCommand(s.doc, [s.id], boxes, { kind: 'resize', width: 140, height: 90, keepRatio: false }, viewport));
    const node = resize.document.blocks[0].slots.content![0];
    expect(node.responsive[viewport]).toMatchObject({ inset_left: px(50), inset_top: px(60), inset_right: 'auto', inset_bottom: 'auto',
      width: px(140), height: px(90), grow: 0, shrink: 0, basis: 'auto' });
    expect(JSON.stringify(node.style)).toBe(before);
    const rotated = s.apply(geometryCommand(s.doc, [s.id], boxes, { kind: 'rotate', degrees: 15 }, viewport));
    expect(effectiveStyle(rotated.document.blocks[0].slots.content![0], viewport).rotation).toBe(35);
    expect(() => geometryTargets(s.doc, [s.id], boxes)).toThrow('hidden');
    s.parent.responsive[viewport]!.hidden = true;
    expect(() => geometryTargets(s.doc, [s.id], boxes, viewport)).toThrow('hidden');
  });
  it('neutralizes common far anchors on translation and group resize without resetting base', () => {
    const s = setup(), second = s.parent.slots.content![1];
    s.parent.style.position = 'relative';
    for (const child of [s.child, second]) child.style = { position: 'absolute', inset_right: px(10), inset_bottom: px(20) };
    const ids = [s.id, second.instance_id], boxes = ids.map((id, i) => ({ id, left: i * 150, top: 50, width: 100, height: 80 }));
    for (const operation of [{ kind: 'translate', x: 10, y: 20 }, { kind: 'resize', width: 200, height: 160, keepRatio: true }] as const) {
      const result = s.apply(geometryCommand(s.doc, ids, boxes, operation, 'mobile'));
      for (const child of result.document.blocks[0].slots.content!.slice(0, 2)) {
        expect(child.style).toEqual(s.child.style);
        expect(child.responsive.mobile).toMatchObject({ inset_right: 'auto', inset_bottom: 'auto' });
      }
    }
  });
  it('keeps every node identity and DOM tree common while changing Flex and Grid independently', () => {
    const s = setup();
    s.parent.style = { display: 'flex', direction: 'row', column_gap: px(20) };
    s.parent.responsive = { tablet: { direction: 'column', row_gap: px(12) }, mobile: { display: 'grid', columns: [{ fr: 1 }, { fr: 1 }], column_gap: px(0) } };
    validateDocumentV3(s.doc);
    const expected: Record<Viewport, string> = { base: 'flex', tablet: 'flex', mobile: 'grid' };
    for (const viewport of ['base', 'tablet', 'mobile'] as const) {
      const map = documentPresentation(s.doc, viewport);
      expect(map.get(s.parent.instance_id)?.display).toBe(expected[viewport]);
      expect([...map.keys()]).toEqual([...documentPresentation(s.doc).keys()]);
    }
    expect(documentPresentation(s.doc, 'mobile').get(s.parent.instance_id)?.['grid-template-columns']).toBe('1fr 1fr');
  });
});
