import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { executeDocumentCommand, type DocumentCommand } from '../../resources/js/documents/v3/designCommands';
const source = () => cloneDocument(validateDocumentV3(fixture));
const id = fixture.blocks[0].slots.content[0].instance_id;
const apply = (command: DocumentCommand, doc = source()) => executeDocumentCommand(doc, command, () => '00000000-0000-4000-8000-000000000100');
const child = (doc: ReturnType<typeof source>) => doc.blocks[0].slots.content![0];

describe('v3 atomic design commands', () => {
  it('sets typed values in one immutable transaction preserving units, identities and overrides', () => {
    const doc = source(), before = JSON.stringify(doc);
    const result = apply({ kind: 'style', id, set: { width: 'fill', padding_top: { value: 0, unit: 'px' }, opacity: 0 } }, doc);
    expect(result.changed).toBe(true);
    expect(result.selection).toEqual([id]);
    expect(child(result.document).style).toMatchObject({ width: 'fill', padding_top: { value: 0, unit: 'px' }, opacity: 0 });
    expect(child(result.document).responsive).toEqual(child(doc).responsive);
    expect(result.document.assets).toEqual(doc.assets);
    expect(child(result.document).instance_id).toBe(id);
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('distinguishes omitted, zero and reset without clearing responsive values', () => {
    const zero = apply({ kind: 'style', id, set: { opacity: 0 } }).document;
    expect(child(zero).style.opacity).toBe(0);
    const reset = apply({ kind: 'style', id, set: {}, reset: ['opacity'] }, zero).document;
    expect(Object.hasOwn(child(reset).style, 'opacity')).toBe(false);
    expect(child(reset).responsive.mobile?.opacity).toBe(0);
    expect(apply({ kind: 'style', id, set: {}, reset: ['opacity'] }, reset).changed).toBe(false);
    expect(apply({ kind: 'style', id, set: { opacity: 0 } }, zero).document).toBe(zero);
  });
  it('rejects invalid values, contradictory resets and unknown fields atomically', () => {
    for (const command of [
      { kind: 'style', id, set: { opacity: -1 } },
      { kind: 'style', id, set: { min_width: { value: 50, unit: 'px' }, max_width: { value: 10, unit: 'px' } } },
      { kind: 'style', id, set: { opacity: 0 }, reset: ['opacity'] },
      { kind: 'style', id, set: { opacity: 0 }, reset: ['bogus'] },
      { kind: 'style', id, set: { css: 'background:red' } },
      { kind: 'style', id, set: JSON.parse('{"__proto__":{"polluted":true}}') },
    ]) {
      const doc = source(), before = JSON.stringify(doc);
      expect(() => apply(command as DocumentCommand, doc)).toThrow();
      expect(JSON.stringify(doc)).toBe(before);
      expect(Object.hasOwn({}, 'polluted')).toBe(false);
    }
  });
  it('rejects own or ancestor locks and unknown identity', () => {
    const doc = source(); child(doc).locked = true;
    expect(() => apply({ kind: 'style', id, set: { opacity: 0 } }, doc)).toThrow('locked');
    child(doc).locked = false; doc.blocks[0].locked = true;
    expect(() => apply({ kind: 'content', id, props: { level: 2, runs: [{ text: '불가' }] } }, doc)).toThrow('locked');
    expect(() => apply({ kind: 'style', id: 'missing', set: {} })).toThrow('missing_node');
  });
  it('updates only canonical primitive properties, rejects unsafe or type-changing content', () => {
    const props = { level: 2, runs: [{ text: '<script>문자</script>', bold: false }] };
    const result = apply({ kind: 'content', id, props });
    expect(child(result.document).props).toEqual(props);
    expect(child(result.document).props).not.toBe(props);
    expect(child(result.document).style).toEqual(child(source()).style);
    expect(apply({ kind: 'content', id, props }, result.document).changed).toBe(false);
    expect(() => apply({ kind: 'content', id, props: { level: 2, runs: [{ text: 'x', link: { url: 'javascript:alert(1)', new_tab: false } }] } })).toThrow();
    expect(() => apply({ kind: 'content', id, props: { label: 'x' } })).toThrow();
    expect(apply({ kind: 'content', id: fixture.blocks[0].instance_id, props: { tag: 'header' } }).document.blocks[0].props).toEqual({ tag: 'header' });
    expect(() => apply({ kind: 'content', id: fixture.blocks[0].instance_id, props: { tag: 'script' } })).toThrow();
  });
  it('keeps tree commands on the same dispatcher', () => {
    expect(child(apply({ kind: 'rename', id, name: '통합 명령' }).document).name).toBe('통합 명령');
  });
});
