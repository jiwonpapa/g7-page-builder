import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import fixture from '../Contract/site-part-v2.fixture.json';
import behaviors from '../Fixtures/document-v3-cases.json';
import schema from '../../schemas/site-part-v2.schema.json';
import documentSchema from '../../schemas/page-builder-document-v3.schema.json';
import { validateElementSitePart, withSitePartContent } from '../../resources/js/documents/v3/sitePart';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { designPolicyV3 } from '../../resources/js/documents/v3/validate';
import { record } from '../../resources/js/documents/v3/schema';

function patch(value: unknown, path: (string | number)[], replacement: unknown): void {
  const [key, ...tail] = path;
  if (key === undefined || (!record(value) && !Array.isArray(value))) throw new Error('Bad fixture path');
  const fields = value as Record<string | number, unknown>;
  if (tail.length) patch(fields[key], tail, replacement);
  else fields[key] = replacement;
}
const source = () => validateElementSitePart(structuredClone(fixture.source));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('element Site Parts reuse the canonical page tree', () => {
  const check = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).addSchema(documentSchema).compile(schema);
  const semanticErrors = new Set(['site_part_shell', 'site_part_seo', 'asset_reference', 'duplicate_id']);
  for (const entry of fixture.cases) it(entry.name, () => {
    const value: unknown = structuredClone(fixture.source);
    patch(value, entry.path, entry.value);
    const before = JSON.stringify(value);
    expect(check(value), JSON.stringify(check.errors)).toBe(entry.valid || semanticErrors.has(entry.error ?? ''));
    if (entry.valid) expect(validateElementSitePart(value)).toEqual(value);
    else expect(() => validateElementSitePart(value)).toThrow(new RegExp('^' + entry.error + ':'));
    expect(JSON.stringify(value)).toBe(before);
  });

  it.each(['header', 'footer'] as const)('edits an unregistered %s with the same primitive and transaction commands', kind => {
    const original = source(); original.kind = kind;
    const before = JSON.stringify(original), node = createPrimitive('content.heading', id(8), original.content);
    const result = executeDocumentCommand(original.content, { kind: 'transaction', commands: [
      { kind: 'insert', destination: { parentId: id(1), index: 1 }, nodes: [node] },
      { kind: 'content', id: id(8), props: { level: 3, runs: [{ text: '내가 만든 공통영역', bold: true }] } },
      { kind: 'style', id: id(8), viewport: 'mobile', set: { font_size: { value: 19, unit: 'px' } } },
    ] }, () => id(9));
    const changed = withSitePartContent(original, result.document);
    expect(changed.content.blocks[0].slots.content).toHaveLength(3);
    expect(changed.kind).toBe(kind);
    expect(changed.content.blocks[0].slots.content![1].responsive.mobile?.font_size).toEqual({ value: 19, unit: 'px' });
    expect(JSON.stringify(original)).toBe(before);
    expect(changed.content).not.toBe(result.document);
    expect(validateElementSitePart(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
    expect(withSitePartContent(changed, original.content)).toEqual(original);
  });

  it('preserves shared behavior references without a Site Part-specific variant', () => {
    for (const nodes of Object.values(behaviors.behavior_fixtures)) {
      const part = source();
      const content = { ...part.content, blocks: structuredClone(nodes) };
      expect(withSitePartContent(part, content).content.blocks).toEqual(nodes);
    }
  });

  it.each(['document_id', 'locale', 'slug'] as const)('rejects another owner through %s without touching either source', key => {
    const part = source(), content = structuredClone(part.content);
    content[key] = key === 'document_id' ? id(99) : key === 'locale' ? 'en' : 'other-part';
    const before = JSON.stringify([part, content]);
    expect(() => withSitePartContent(part, content)).toThrow('site_part_identity:');
    expect(JSON.stringify([part, content])).toBe(before);
  });

  it('rejects non-JSON and incomplete envelopes without implicit repair', () => {
    for (const value of [null, [], {}, { ...fixture.source, content: null }, { ...fixture.source, content: undefined }]) {
      expect(() => validateElementSitePart(value)).toThrow();
    }
    const part = source();
    const content = { ...part.content, shell_mode: 'builder' };
    expect(() => withSitePartContent(part, content)).toThrow('site_part_shell:');
    const oversize = { ...part, extra: 'a'.repeat(designPolicyV3.limits.utf8_bytes) };
    expect(() => validateElementSitePart(oversize)).toThrow('byte_limit:');
    const accessor = Object.defineProperty({}, 'content', { enumerable: true, get: () => { throw new Error('executed'); } });
    expect(() => validateElementSitePart(accessor)).toThrow('json:');
  });

  it('retains the existing total-node limit for all Site Part layouts', () => {
    const part = source();
    const node = part.content.blocks[0].slots.content![1];
    part.content.blocks = Array.from({ length: 500 }, (_, i) => ({ ...structuredClone(node), instance_id: id(i + 1) }));
    expect(validateElementSitePart(part)).toBe(part);
    part.content.blocks.push({ ...structuredClone(node), instance_id: id(501) });
    expect(() => validateElementSitePart(part)).toThrow();
  });
});
