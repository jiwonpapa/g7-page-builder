/** Explicit one-time migration of the existing starter library to canonical data.
 * Usage: node scripts/lib/exportStarterData.mjs --write
 * Refuses overwrite; does not read or write user documents.
 */
import { build } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const result = await build({ configFile: false, root,
  build: { write: false, minify: false, lib: { entry: resolve(root, 'scripts/lib/exportV3Compositions.ts'), formats: ['es'] } } });
if ('close' in result) throw new Error('Unexpected build watcher');
const output = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
const chunks = output.filter(item => item.type === 'chunk');
if (chunks.length !== 1) throw new Error('The explicit export must be self contained');
const { exportStarterCompositions } = await import('data:text/javascript;base64,' + Buffer.from(chunks[0].code).toString('base64'));
const reference = JSON.parse(await readFile(resolve(root, 'tests/Contract/document-v3.fixture.json'), 'utf8'));
reference.blocks = [];
reference.assets[0].url = '/modules/jiwonpapa-page_builder/store/previews/local-business-hero.webp';
const documents = exportStarterCompositions(reference).map(entry => entry.document);
if (process.argv.includes('--write')) {
  await mkdir(resolve(root, 'resources/compositions'), { recursive: true });
  await writeFile(resolve(root, 'resources/compositions/builtin-v3.json'), JSON.stringify(documents, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ documents: documents.length, written: process.argv.includes('--write') }));
