import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { Plugin } from 'vite';

export const INTER_SOURCE = 'resources/css/vendor/inter-4.1';
const MANIFEST_SHA = 'ce3810bd4fe9fa9bd8179d8ddb4dc3c0c197ed2f30ba6bee6402076aafc1a958';
export const INTER_DIST = 'fonts/inter-4.1-' + MANIFEST_SHA.slice(0, 12);
const PUCK_CSS_SHA = 'ef5960dd42d17e7f2c6e62273f4758b33e85a720b76ad7127b927374de65e284';
const REMOTE_IMPORT = /@import\s*(?:url\(\s*)?["']https:\/\/rsms\.me\/inter\/inter\.css["']\s*\)?\s*;/g;
const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
type Read = (path: string) => Buffer;

/** Validate before emitting: builds are offline and never repair vendor inputs. */
export function interFontAssets(root: string, read: Read = readFileSync): Map<string, Buffer> {
  const manifestBytes = read(join(root, INTER_SOURCE, 'manifest.json'));
  if (digest(manifestBytes) !== MANIFEST_SHA) throw Error('Unreviewed Inter manifest');
  const manifest: unknown = JSON.parse(manifestBytes.toString());
  if (!object(manifest) || !object(manifest.files)) throw Error('Invalid Inter manifest');
  const assets = new Map<string, Buffer>([['manifest.json', manifestBytes]]);
  for (const [name, metadata] of Object.entries(manifest.files)) {
    if (!/^(?:Inter-[A-Za-z]+\.woff2|LICENSE\.txt|upstream\.css\.txt)$/.test(name) || !object(metadata)) throw Error('Invalid Inter asset entry');
    const bytes = read(join(root, INTER_SOURCE, name));
    if (metadata.bytes !== bytes.length || metadata.sha256 !== digest(bytes)) throw Error('Inter asset checksum mismatch: ' + name);
    assets.set(name, bytes);
  }
  const source = assets.get('upstream.css.txt')?.toString();
  if (!source) throw Error('Missing Inter stylesheet');
  // Preserve every declared Inter static face and its feature aliases. Other
  // upstream families (InterVariable/InterDisplay) are not used by PB/Puck.
  const faces = source.match(/@font-face \{ font-family:Inter;[^\n]*\}/g) ?? [];
  const start = source.indexOf('@font-feature-values Inter {');
  const end = source.indexOf('@font-feature-values InterDisplay {', start);
  if (faces.length !== 18 || start < 0 || end < start) throw Error('Unreviewed Inter CSS declarations');
  const css = faces.join('\n').replace(/font-files\/(Inter-[A-Za-z]+\.woff2)\?v=4\.1/g, '$1') + '\n' + source.slice(start, end);
  const files = [...css.matchAll(/url\("([^"]+)"\)/g)].map(match => match[1]);
  if (files.length !== 18 || new Set(files).size !== 18 || files.some(name => !assets.has(name)) || /https?:|data:|@import/.test(css)) throw Error('Non-local or missing Inter face');
  assets.set('inter.css', Buffer.from('/* Inter 4.1, OFL-1.1. See LICENSE.txt. Original font bytes unchanged. */\n' + css));
  return assets;
}

export function rewriteInterImport(css: string, cssFile: string): string {
  if ([...css.matchAll(REMOTE_IMPORT)].length !== 1) throw Error('Expected one Puck Inter import');
  const local = posix.relative(posix.dirname(cssFile), INTER_DIST + '/inter.css');
  return css.replace(REMOTE_IMPORT, `@import"${local}";`);
}

export function localInterFonts(): Plugin {
  let root = '', used = false;
  return {
    name: 'g7pb-local-inter-41', apply: 'build', enforce: 'post',
    configResolved(config) { root = config.root; },
    // Hash ORIGINAL vendor bytes, before Vite transforms its CSS.
    buildStart() {
      const path = join(root, 'node_modules/@puckeditor/core/dist/index.css');
      if (digest(readFileSync(path)) !== PUCK_CSS_SHA) throw Error('Unreviewed Puck 0.23.0 stylesheet');
    },
    transform(_source, id) { if (id.replaceAll('\\', '/').endsWith('/@puckeditor/core/dist/index.css')) used = true; },
    generateBundle(_options, bundle) {
      if (!used) throw Error('Local Inter plugin requires the Puck stylesheet');
      let count = 0;
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue;
        const css = typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source);
        if (!css.includes('https://rsms.me/inter/inter.css')) continue;
        asset.source = rewriteInterImport(css, asset.fileName); count++;
      }
      if (count !== 1) throw Error('Puck stylesheet was not localized exactly once');
      for (const [name, source] of interFontAssets(root)) this.emitFile({ type: 'asset', fileName: INTER_DIST + '/' + name, source });
    },
  };
}

export function checkInterFontDist(root: string): void {
  for (const [name, bytes] of interFontAssets(root)) {
    if (!readFileSync(join(root, 'dist', INTER_DIST, name)).equals(bytes)) throw Error('Built Inter asset mismatch: ' + name);
  }
  const css = readFileSync(join(root, 'dist/css/page-builder-editor.css'), 'utf8');
  if (css.includes('rsms.me') || !css.includes(`@import"../${INTER_DIST}/inter.css";`)) throw Error('Editor must import the local pinned Inter stylesheet');
}
