// @vitest-environment node
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import config from '../../vite.structure.config';

describe('installed structure entry artifact', () => {
  it('selects one fixed bundle without reading private document state in the Blade view', () => {
    const blade = readFileSync('resources/views/editor.blade.php', 'utf8');
    expect(blade).toContain("request()->query('editor') === 'structure'");
    expect(blade).toContain("$structureEditor ? 'page-builder-structure' : 'page-builder-editor'");
    expect(blade).not.toMatch(/(?:getDocument|documentSource|findOrFail|DB::)/);
    expect(blade.match(/<script defer src=/g)).toHaveLength(1);
  });

  it('builds the authenticated entry without block factories, retaining JS budgets and measuring CSS', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    let result;
    try { result = await build({ ...config, configFile: false, logLevel: 'silent', build: { ...config.build, write: false } }); }
    finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
    if ('close' in result) throw new Error('Unexpected build watcher');
    const output = (Array.isArray(result) ? result : [result]).flatMap(item => item.output);
    const chunks = output.filter(item => item.type === 'chunk');
    const modules = chunks.flatMap(chunk => Object.keys(chunk.modules));
    expect(modules.some(path => path.endsWith('/editor/v3/StructureDocumentHost.tsx'))).toBe(true);
    expect(modules.filter(path => /\/resources\/js\/blocks\/|\/editor\/PuckEditorAdapter|\/native-editor\//.test(path))).toEqual([]);
    const javascript = chunks.map(chunk => chunk.code).join('\n');
    const stylesheet = output.filter(item => item.type === 'asset' && item.fileName.endsWith('.css'))
      .map(item => item.type === 'asset' ? typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source) : '').join('\n');
    const catalog = output.find(item => item.type === 'asset' && /builtin-v3.*\.json$/.test(item.fileName));
    if (!catalog || catalog.type !== 'asset') throw new Error('Missing independently served composition data');
    const source = typeof catalog.source === 'string' ? catalog.source : new TextDecoder().decode(catalog.source);
    expect(catalog.fileName).toMatch(/^data\/builtin-v3-[\w-]+\.json$/);
    expect(source).toBe(JSON.stringify(JSON.parse(readFileSync('resources/compositions/builtin-v3.json', 'utf8'))));
    expect(gzipSync(source).length).toBeLessThanOrEqual(30_000);
    expect(javascript).toContain('/api/modules/assets/jiwonpapa-page_builder/dist/' + catalog.fileName);
    expect(modules.some(path => path.endsWith('/compositions/builtin-v3.json'))).toBe(false);
    expect(gzipSync(javascript).length).toBeLessThanOrEqual(512_000);
    expect(stylesheet.trim()).not.toBe('');
    console.info(JSON.stringify({ asset: 'structure-entry-css', raw: Buffer.byteLength(stylesheet), gzip: gzipSync(stylesheet).length, sizeCeiling: null }));
  });
});
