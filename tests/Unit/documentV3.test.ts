import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import schema from '../../schemas/page-builder-document-v3.schema.json';
import legacyV1 from '../Contract/document-v1.fixture.json';
import legacyV2 from '../Contract/document-layout-v2.fixture.json';
import { designPolicyV3, effectiveStyle, validateDocumentV3, viewportAt } from '../../resources/js/documents/v3/validate';
import { prepareMigration } from '../../resources/js/documents/v3/migration';
import { jsonBytes, record, validateRule, type Rule } from '../../resources/js/documents/v3/schema';
import type { DocumentV3, Node } from '../../resources/js/documents/v3/types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function patch(value: unknown, path: (string | number)[], replacement: unknown): void {
  const [key, ...tail] = path;
  if (key === undefined || (!record(value) && !Array.isArray(value))) throw new Error('Bad fixture path');
  const fields = value as Record<string | number, unknown>;
  if (tail.length) patch(fields[key], tail, replacement);
  else fields[key] = replacement;
}
const valid = () => validateDocumentV3(structuredClone(fixture));
describe('IP2 v3 document contract', () => {
  it('matches independent Ajv wire validation and roundtrips without mutation', () => {
    const ajv = new Ajv2020({ strict: true, multipleOfPrecision: 8 });
    const check = ajv.compile(schema);
    expect(check(fixture), JSON.stringify(check.errors)).toBe(true);
    const before = JSON.stringify(fixture);
    expect(JSON.stringify(validateDocumentV3(fixture))).toBe(before);
    expect(JSON.stringify(validateDocumentV3(JSON.parse(before)))).toBe(before);
  });
  for (const entry of cases.cases) it(entry.name, () => {
    const document: unknown = structuredClone(fixture);
    patch(document, entry.path, entry.value);
    const before = JSON.stringify(document);
    if (entry.valid) expect(validateDocumentV3(document)).toEqual(document);
    else expect(() => validateDocumentV3(document)).toThrow(new RegExp('^' + entry.error + ':'));
    expect(JSON.stringify(document)).toBe(before);
  });
  it('keeps missing, zero, false and reset distinct without chained inheritance', () => {
    const node = valid().blocks[0].slots.content![0];
    expect(effectiveStyle(node, 'mobile').opacity).toBe(0);
    expect(effectiveStyle(node, 'mobile').hidden).toBe(false);
    delete node.responsive.mobile!.font_size;
    expect(effectiveStyle(node, 'mobile').font_size).toEqual({ value: 2, unit: 'rem' });
    expect(effectiveStyle(node, 'tablet').font_size).toEqual({ value: 24, unit: 'px' });
    delete node.responsive.mobile!.opacity;
    expect(effectiveStyle(node, 'mobile').opacity).toBe(0.9);
    for (const entry of cases.breakpoints) expect(viewportAt(entry.width)).toBe(entry.value);
    for (const width of [-1, NaN, Infinity]) expect(() => viewportAt(width)).toThrow('viewport:');
  });
  it.each([100, 500])('validates %i nodes within the fixed budget', count => {
    const doc = valid(), leaf = doc.blocks[0].slots.content![0];
    doc.blocks = Array.from({ length: count }, (_, i) => ({ ...structuredClone(leaf), instance_id: id(i + 1) }));
    const start = performance.now();
    validateDocumentV3(doc);
    const elapsed = performance.now() - start;
    console.log(JSON.stringify({ engine: 'TS', count, validation_ms: elapsed }));
    expect(elapsed).toBeLessThan(designPolicyV3.performance.validation_ms);
  });
  it('enforces total nodes and depth, not just each slot length', () => {
    const doc = valid(), root = doc.blocks[0], leaf = root.slots.content![0];
    root.slots.content = Array.from({ length: 500 }, (_, i) => ({ ...structuredClone(leaf), instance_id: id(i + 2) }));
    expect(() => validateDocumentV3(doc)).toThrow('node_limit:');
    doc.blocks = [root]; root.slots.content = [];
    let last: Node = root;
    for (let depth = 2; depth <= 16; depth++) {
      const next: Node = { ...structuredClone(root), instance_id: id(depth), slots: {} };
      last.slots.content = [next]; last = next;
    }
    validateDocumentV3(doc);
    last.slots.content = [{ ...structuredClone(leaf), instance_id: id(17) }];
    expect(() => validateDocumentV3(doc)).toThrow('depth_limit:');
  });
  it('rejects non-JSON values, cycles, excessive bytes and unpaired surrogates', () => {
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    for (const value of [NaN, Infinity, undefined, 1n, () => 1, new Date(), cycle, { x: '\ud800' }, { toJSON: () => ({}) }, Array(1)]) {
      expect(() => jsonBytes(value, 128)).toThrow('json:');
    }
    const oversized = { ...fixture, extra: '한'.repeat(400000) };
    expect(() => validateDocumentV3(oversized)).toThrow('byte_limit:');
    const object = Object.defineProperty({}, 'value', { enumerable: true, get: () => { throw new Error('must not execute'); } });
    expect(() => jsonBytes(object, 128)).toThrow('json:');
  });
  it('checks every schema keyword against the implemented subset', () => {
    const allowed = new Set(['$schema', '$id', '$defs', '$ref', 'type', 'const', 'enum', 'anyOf', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'multipleOf']);
    function check(rule: Rule): void {
      for (const key of Object.keys(rule)) expect(allowed.has(key), key).toBe(true);
      Object.values(rule.$defs ?? {}).forEach(check);
      Object.values(rule.properties ?? {}).forEach(child => { if (child) check(child); });
      rule.anyOf?.forEach(check);
      if (rule.items) check(rule.items);
    }
    check(schema);
    expect(() => validateRule({}, { $ref: '#/$defs/absent' }, {})).toThrow('schema:');
    expect(() => validateRule({}, { type: 'unsupported' }, {})).toThrow('schema:');
  });
});
describe('explicit migration preparation only', () => {
  it.each([legacyV1, legacyV2])('retains exact bytes, unknown fields and source revision', legacy => {
    const source = JSON.stringify({ ...legacy, unknown_extension: { actions: ['$x'], nested: { x: false } } }, null, 2);
    const snapshot = prepareMigration(source, 7, 7, true);
    expect(snapshot.source_json).toBe(source);
    expect(snapshot.source_revision).toBe(7);
    expect(snapshot.publish).toBe(false);
    expect(snapshot).not.toHaveProperty('candidate');
    expect(() => prepareMigration(source, 7, 7, false)).toThrow('explicit_choice:');
    expect(() => prepareMigration(source, 7, 8, true)).toThrow('source_revision:');
  });
  it('does not convert Site Parts, future schemas or old documents by reading', () => {
    for (const schema_version of ['g7-page-builder/site-part/v1', 'g7-page-builder/v99', 'g7-page-builder/v3']) {
      const source = JSON.stringify({ schema_version, untouched: 'source' });
      expect(() => prepareMigration(source, 1, 1, true)).toThrow('source_schema:');
    }
    expect(() => validateDocumentV3(legacyV1)).toThrow();
    expect(() => validateDocumentV3(legacyV2)).toThrow();
    expect(() => prepareMigration('{', 1, 1, true)).toThrow('json:');
  });
});
