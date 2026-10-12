// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { INTER_DIST, interFontAssets, rewriteInterImport } from '../../vite.inter-fonts';

const root = fileURLToPath(new URL('../..', import.meta.url));
describe('pinned local Inter font assets', () => {
  it('keeps all 18 original static faces with license and manifest', () => {
    const assets = interFontAssets(root);
    const fonts = [...assets].filter(([name]) => name.endsWith('.woff2'));
    expect(fonts).toHaveLength(18);
    for (const [, bytes] of fonts) expect(bytes.toString('ascii', 0, 4)).toBe('wOF2');
    expect(assets.get('LICENSE.txt')?.toString()).toContain('SIL OPEN FONT LICENSE Version 1.1');
    const css = assets.get('inter.css')!.toString();
    expect(css).not.toMatch(/https?:|data:|@import/);
    for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      for (const style of ['normal', 'italic']) expect(css).toContain(`font-style:${style}; font-weight:${weight}; font-display:swap;`);
    }
    expect(css).toContain('@font-feature-values Inter {');
    expect(css).not.toContain('InterVariable');
    expect(css).not.toContain('InterDisplay');
  });
  it('rejects changed manifest, missing font and changed license bytes', () => {
    for (const name of ['manifest.json', 'Inter-Regular.woff2', 'LICENSE.txt']) {
      expect(() => interFontAssets(root, path => path.endsWith('/' + name) ? Buffer.from('changed') : readFileSync(path))).toThrow();
    }
    expect(() => interFontAssets(root, path => { if (path.endsWith('.woff2')) throw Error('missing'); return readFileSync(path); })).toThrow('missing');
  });
  it('rewrites only the external import with a portable, content-versioned relative URL', () => {
    const source = '@import"https://rsms.me/inter/inter.css";body{font-family:Inter}';
    expect(rewriteInterImport(source, 'css/editor.css')).toBe(`@import"../${INTER_DIST}/inter.css";body{font-family:Inter}`);
    expect(rewriteInterImport(source, 'editor.css')).toContain(`@import"${INTER_DIST}/inter.css";`);
    expect(() => rewriteInterImport('body{}', 'editor.css')).toThrow();
    expect(() => rewriteInterImport(source + source, 'editor.css')).toThrow();
  });
});
