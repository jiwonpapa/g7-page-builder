// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import { builtinCatalogLiterals, compileBuiltinCatalog, compileBuiltinCompositions } from '../../vite.config';

function evaluate(source: string): Record<string, unknown> {
  const code = transformSync(compileBuiltinCatalog(source), { format: 'cjs', target: 'es2022' }).code;
  const result: { exports: Record<string, unknown> } = { exports: {} };
  runInNewContext(code, { module: result });
  return result.exports;
}

describe('builtin catalog build encoding', () => {
  it('preserves canonical composition data and independent mutable instances in the Vite pipeline', async () => {
    const path = fileURLToPath(new URL('../../resources/compositions/builtin-v3.json', import.meta.url));
    const source = readFileSync(path, 'utf8'), original = JSON.parse(source);
    const result = await build({ configFile: false, root: fileURLToPath(new URL('../..', import.meta.url)), logLevel: 'silent',
      plugins: [builtinCatalogLiterals()], build: { write: false, minify: true, lib: { entry: path, formats: ['cjs'] } } });
    const chunks = (Array.isArray(result) ? result : [result]).flatMap(output => 'output' in output ? output.output : []).filter(output => output.type === 'chunk');
    expect(chunks).toHaveLength(1);
    const module = { exports: {} }; runInNewContext(chunks[0].code, { module });
    expect(JSON.stringify(module.exports)).toBe(JSON.stringify(original));
    expect(chunks[0].code).not.toMatch(/\b(?:eval|fetch|atob)\(/);
    const shared = { instance_id: 'repeated value example', style: { size: 3, color: 'neutral', enabled: true }, slots: { content: [] } };
    const code = transformSync(compileBuiltinCompositions(JSON.stringify([shared, shared, shared])), { format: 'cjs' }).code;
    const exported: { exports: { default?: typeof shared[] } } = { exports: {} }; runInNewContext(code, { module: exported });
    const entries = exported.exports.default!;
    expect(entries).toEqual([shared, shared, shared]);
    entries[0].style.size = 9;
    expect(entries[1].style.size).toBe(3); expect(entries[2].style.size).toBe(3);
    expect(entries[0].slots.content).not.toBe(entries[1].slots.content);
    for (const invalid of ['{}', 'null', '1', '"text"']) expect(() => compileBuiltinCompositions(invalid)).toThrow();
  });
  it('preserves every real manifest field, value and insertion order', () => {
    const source = readFileSync(new URL('../../resources/block-packs/builtin-core/manifest.json', import.meta.url), 'utf8');
    const original: Record<string, unknown> = JSON.parse(source);
    const result = evaluate(source);
    expect(JSON.stringify(result.default)).toBe(JSON.stringify(original));
    for (const [key, value] of Object.entries(original)) {
      expect(result[key]).toEqual(value);
    }
    expect(compileBuiltinCatalog(source)).toBe(compileBuiltinCatalog(source));
    expect(compileBuiltinCatalog(source)).toContain('const o0=');
    expect(compileBuiltinCatalog(source)).toContain('const s0=');
  });

  it('creates fresh mutable objects and arrays for identical entries and nested props', () => {
    const item = { title: '반복되는 충분히 긴 문자열', props: { color: 'neutral', size: 2, tags: ['tag'] }, enabled: true };
    const result = evaluate(JSON.stringify({ items: [item, item, item] }));
    const items = result.items;
    if (!Array.isArray(items)) throw new Error('Missing catalog items');
    expect(items[0]).not.toBe(items[1]);
    expect(items[0].props).not.toBe(items[1].props);
    expect(items[0].props.tags).not.toBe(items[1].props.tags);
    items[0].props.tags.push('changed');
    items[0].title = 'changed';
    expect(items[1]).toEqual(item);
    expect(items[2]).toEqual(item);
  });

  it('preserves own prototype keys, property order, escaped strings and numeric values', () => {
    const special = '한글 🙂 " \\ \n \u0000 \u2028 \u2029 </script>';
    const source = `{"odd-name":${JSON.stringify(special)},"default":false,"__proto__":{"safe":true},"items":[
      {"__proto__":{"polluted":true},"constructor":${JSON.stringify(special)},"n":-0},
      {"__proto__":{"polluted":true},"constructor":${JSON.stringify(special)},"n":1e300},
      {"__proto__":{"polluted":true},"constructor":${JSON.stringify(special)},"n":1e999}],"empty":[],"nullable":null}`;
    const original: Record<string, unknown> = JSON.parse(source);
    const result = evaluate(source);
    expect(JSON.stringify(result.default)).toBe(JSON.stringify(original));
    expect(result['odd-name']).toBe(special);
    expect(Object.hasOwn(result.default as object, '__proto__')).toBe(true);
    const items = result.items;
    if (!Array.isArray(items)) throw new Error('Missing catalog items');
    expect(Object.hasOwn(items[0], '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(items[0]).polluted).toBeUndefined();
    expect(Object.is(items[0].n, -0)).toBe(true);
    expect(items[2].n).toBe(Infinity);
  });

  it('rejects invalid JSON or a non-object manifest without rewriting other inputs', () => {
    for (const source of ['{', 'null', '[]', '1', '"text"']) {
      expect(() => compileBuiltinCatalog(source)).toThrow();
    }
    expect(evaluate('{}').default).toEqual({});
  });

  it('runs in the real Vite JSON pipeline and keeps unused exports tree-shakeable', async () => {
    const manifest = fileURLToPath(new URL('../../resources/block-packs/builtin-core/manifest.json', import.meta.url));
    const original: Record<string, unknown> = JSON.parse(readFileSync(manifest, 'utf8'));
    const result = await build({
      configFile: false,
      root: fileURLToPath(new URL('../..', import.meta.url)),
      logLevel: 'silent',
      plugins: [builtinCatalogLiterals(), {
        name: 'catalog-test-entry',
        resolveId(id) { if (id.startsWith('virtual:catalog-test')) return id; },
        load(id) {
          if (id === 'virtual:catalog-test.json') return '{"unchanged":"other JSON"}';
          if (id === 'virtual:catalog-test') return `export { blocks, presets } from ${JSON.stringify(manifest)}; export { default as other } from 'virtual:catalog-test.json';`;
        },
      }],
      build: {
        write: false, minify: false,
        lib: { entry: 'virtual:catalog-test', formats: ['cjs'] },
        rollupOptions: { input: 'virtual:catalog-test' },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunk = outputs.flatMap((output) => 'output' in output ? output.output : []).find((output) => output.type === 'chunk');
    if (!chunk || chunk.type !== 'chunk') throw new Error('Missing Vite output');
    const exports: Record<string, unknown> = {};
    runInNewContext(chunk.code, { exports });
    expect(JSON.stringify(exports.blocks)).toBe(JSON.stringify(original.blocks));
    expect(JSON.stringify(exports.presets)).toBe(JSON.stringify(original.presets));
    expect(exports.other).toEqual({ unchanged: 'other JSON' });
    expect(chunk.code).not.toContain('g7pb-block-pack/v1');
    expect(chunk.code).toContain('const o0');
  });
});
