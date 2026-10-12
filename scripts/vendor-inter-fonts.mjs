// One-time, offline import of reviewed upstream assets. Not run in builds or on
// customer servers. Requires the official v4.1 ZIP and the reviewed CDN CSS.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const archiveSha = '9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e';
const cssSha = '46d01c7807f64a24c1b2853b756ef15f3a2facdf4a9f066eaf5d39c0c9935441';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const [archive, cssFile, verify] = process.argv.slice(2);
if (!archive || !cssFile || (verify && verify !== '--verify-cdn')) throw Error('Usage: vendor-inter-fonts.mjs Inter-4.1.zip inter.css [--verify-cdn]');
const css = readFileSync(cssFile);
if (sha256(readFileSync(archive)) !== archiveSha || sha256(css) !== cssSha) throw Error('Unreviewed Inter archive or stylesheet');
const names = [...css.toString().matchAll(/@font-face \{ font-family:Inter;[^\n]*src:url\("font-files\/(Inter-[A-Za-z]+\.woff2)\?v=4\.1"\)/g)].map(match => match[1]);
if (names.length !== 18 || new Set(names).size !== 18) throw Error('Expected all 18 static Inter faces');
const files = new Map([['LICENSE.txt', execFileSync('unzip', ['-p', archive, 'LICENSE.txt'])], ['upstream.css.txt', css]]);
for (const name of names) {
  const bytes = execFileSync('unzip', ['-p', archive, 'web/' + name]);
  if (bytes.toString('ascii', 0, 4) !== 'wOF2') throw Error('Invalid font: ' + name);
  if (verify) {
    const cdn = execFileSync('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '45', `https://rsms.me/inter/font-files/${name}?v=4.1`]);
    if (sha256(cdn) !== sha256(bytes)) throw Error('CDN/release mismatch: ' + name);
  }
  files.set(name, bytes);
}
const manifest = {
  family: 'Inter', version: '4.1', license: 'OFL-1.1',
  archive: 'https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip', archive_sha256: archiveSha,
  stylesheet: 'https://rsms.me/inter/inter.css',
  files: Object.fromEntries([...files].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha256(bytes) }])),
};
files.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
const directory = fileURLToPath(new URL('../resources/css/vendor/inter-4.1/', import.meta.url));
for (const [name, bytes] of files) {
  const path = join(directory, name);
  if (existsSync(path) && !readFileSync(path).equals(bytes)) throw Error('Refusing to overwrite changed asset: ' + path);
}
mkdirSync(directory, { recursive: true });
for (const [name, bytes] of files) if (!existsSync(join(directory, name))) writeFileSync(join(directory, name), bytes, { flag: 'wx' });
console.log(`Imported ${names.length} unchanged Inter 4.1 fonts with license, source CSS and checksums${verify ? '; CDN/release bytes identical' : ''}.`);
