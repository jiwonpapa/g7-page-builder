import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Contract/document-v3-presentation.json';
import schema from '../../schemas/page-builder-document-v3.schema.json';
import { documentPresentation, runPresentation, DOCUMENT_SURFACE, PARAGRAPH_STYLE } from '../../resources/js/documents/v3/presentation';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import type { Style } from '../../resources/js/documents/v3/types';
function source(style: unknown = {}, parent: unknown = {}) {
  const doc = cloneDocument(validateDocumentV3(fixture));
  const target = doc.blocks[0].slots.content![0];
  doc.blocks[0].slots.content = [target];
  doc.blocks[0].style = parent as Style; doc.blocks[0].responsive = {};
  target.style = style as Style; target.responsive = {};
  return validateDocumentV3(doc);
}
describe('v3 generated presentation shared with the static renderer', () => {
  it.each(cases)('$name preserves typed CSS semantics', entry => {
    const doc = source(entry.style, 'parent' in entry ? entry.parent : {});
    const before = JSON.stringify(doc);
    expect(documentPresentation(doc).get(doc.blocks[0].slots.content![0].instance_id)).toMatchObject(entry.expected);
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('covers every authored style field without persisting generated CSS', () => {
    const covered = new Set(cases.flatMap(entry => Object.keys(entry.style)));
    expect(Object.keys(schema.$defs.style.properties).filter(key => !covered.has(key))).toEqual([]);
    expect(DOCUMENT_SURFACE['box-sizing']).toBe('border-box');
    expect(PARAGRAPH_STYLE.margin).toBe('0');
  });
  it('renders independent breakpoint overrides and explicit zero/false values', () => {
    const doc = validateDocumentV3(fixture), id = doc.blocks[0].slots.content![0].instance_id;
    expect(documentPresentation(doc).get(id)).toMatchObject({ 'font-size': '2rem', opacity: '0.9' });
    expect(documentPresentation(doc, 'tablet').get(id)).toMatchObject({ 'font-size': '24px', opacity: '0.9' });
    expect(documentPresentation(doc, 'mobile').get(id)).toMatchObject({ 'font-size': '18px', opacity: '0', display: 'block' });
  });
  it('retains explicit false inline marks and resolves color, size and combinations', () => {
    const doc = source();
    expect(runPresentation({ text: 'x', bold: false, italic: false, underline: false, strike: false }, doc))
      .toEqual({ 'font-weight': '400', 'font-style': 'normal', 'text-decoration': 'none' });
    expect(runPresentation({ text: 'x', bold: true, italic: true, underline: true, strike: true, color: { kind: 'token', value: 'text' }, font_size: { value: 2, unit: 'rem' } }, doc))
      .toEqual({ 'font-weight': '700', 'font-style': 'italic', 'text-decoration': 'underline line-through', color: '#112233', 'font-size': '2rem' });
    expect(runPresentation({ text: 'x' }, doc)).toEqual({});
  });
  it('uses the default cross-axis stretch, flow reset, and default object position', () => {
    const doc = source({ height: 'fill', position: 'flow', object_x: 0 }, { display: 'flex' });
    expect(documentPresentation(doc).get(doc.blocks[0].slots.content![0].instance_id))
      .toMatchObject({ height: 'auto', 'align-self': 'stretch', position: 'static', 'object-position': '0% 50%' });
  });
  it('rejects CSS image URL quote termination before generating output', () => {
    const doc = source({ background: { kind: 'image', asset_id: fixture.assets[0].asset_id, fit: 'cover', x: 50, y: 50 } });
    doc.assets[0].url = '/storage/a"b.webp';
    expect(() => documentPresentation(doc)).toThrow('value');
  });
});
