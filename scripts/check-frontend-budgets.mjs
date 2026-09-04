import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { readCssGraph } from './lib/editorCssSources.mjs';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgets = [
  { path: 'resources/css/page-builder-core.css', raw: 18_000 },
  { path: 'resources/css/page-builder-manager.css', raw: 20_000 },
  { path: 'resources/css/page-builder-editor.css', raw: 180_000 },
  { path: 'resources/css/page-builder-editor-wysiwyg.css', raw: 2_000 },
  { path: 'resources/css/page-builder-site-part.css', raw: 1_000 },
  { path: 'resources/css/page-builder-public.css', raw: 105_000 },
  { path: 'resources/css/page-builder-site-shell.css', raw: 9_000 },
  { path: 'dist/css/page-builder-manager.css', gzip: 8_000 },
  { path: 'dist/css/page-builder-editor.css', gzip: 45_000 },
  { path: 'dist/css/page-builder-site-part.css', gzip: 32_000 },
  { path: 'dist/css/page-builder-public.css', gzip: 18_000 },
  { path: 'dist/js/page-builder-manager.iife.js', gzip: 90_000 },
  { path: 'dist/js/page-builder-editor.iife.js', gzip: 500_000 },
  { path: 'dist/js/page-builder-site-part.iife.js', gzip: 410_000 },
  { path: 'dist/js/page-effects.iife.js', gzip: 24_000 },
  { path: 'dist/js/page-sliders.iife.js', gzip: 12_000 },
];

const PUBLIC_RUNTIME_BUNDLES = [
  'dist/js/page-effects.iife.js',
  'dist/js/page-sliders.iife.js',
];
const PUBLIC_RUNTIME_COMBINED_LIMIT = 34_000;

const EDITOR_ENTRY = 'resources/css/page-builder-editor.css';
const EDITOR_OWNERS = ['chrome', 'library', 'controls', 'canvas', 'blocks', 'catalog', 'appearance']
  .map(role => `resources/css/page-builder-editor-${role}.css`);
const EDITOR_FAMILY = [EDITOR_ENTRY, ...EDITOR_OWNERS];
// These existing shared sources were never part of the editor entry's raw cap.
const EDITOR_SHARED = new Set([
  'resources/css/page-builder-core.css', 'resources/css/page-builder-theme.css',
  'resources/css/page-builder-editor-wysiwyg.css', 'resources/css/page-builder-site-shell.css',
  'resources/js/public/mobileNavigation.css',
]);
const EDITOR_LIMIT = budgets.find(budget => budget.path === EDITOR_ENTRY).raw;

export async function editorStyleSources(root) {
  const graph = await readCssGraph(root, [EDITOR_ENTRY]);
  const family = new Set(EDITOR_FAMILY);
  for (const file of graph.files) {
    if (!family.has(file) && !EDITOR_SHARED.has(file)) throw new Error(`Unclassified editor CSS import: ${file}`);
  }
  for (const file of EDITOR_FAMILY) {
    if ((file === EDITOR_ENTRY || existsSync(join(root, file))) && !graph.files.includes(file)) {
      throw new Error(`Editor CSS owner is not connected to its entry: ${file}`);
    }
  }
  return { sources: graph.files.filter(file => family.has(file)),
    // Missing approved owners are inputs too: creating an unconnected owner
    // must invalidate a receipt even though no existing import was changed.
    inputs: [...new Set([...graph.files, ...EDITOR_FAMILY])].sort() };
}

export async function checkEditorStyleSources(root) {
  const inventory = await editorStyleSources(root);
  let bytes = 0;
  for (const file of inventory.sources) {
    const source = readFileSync(join(root, file));
    bytes += source.byteLength;
    postcss.parse(source.toString('utf8'), { from: file }).walkRules(rule => {
      selectorParser(selectors => selectors.walkClasses(node => {
        if (/^g7pb-(?:store|manager|document-(?:row|list)|revision-row)/.test(node.value)) {
          throw new Error(`Manager-only selectors must not leak into the Editor CSS bundle: ${file}: ${rule.selector}`);
        }
      })).processSync(rule.selector);
    });
  }
  if (bytes > EDITOR_LIMIT) throw new Error(`Editor CSS family budget exceeded: ${bytes}/${EDITOR_LIMIT} raw bytes`);
  return { ...inventory, bytes, limit: EDITOR_LIMIT };
}

async function main(args) {
  let root = defaultRoot;
  let mode = 'full';
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--root' && args[index + 1]) { root = resolve(args[++index]); continue; }
    if (mode === 'full' && ['--editor-source-only', '--editor-source-inputs'].includes(arg)) { mode = arg; continue; }
    throw new Error(`Unknown frontend budget argument: ${arg}`);
  }
  if (mode === '--editor-source-inputs') {
    console.log(JSON.stringify((await editorStyleSources(root)).inputs));
    return;
  }
  if (mode === '--editor-source-only') {
    console.log(JSON.stringify(await checkEditorStyleSources(root)));
    return;
  }
  const report = [];
  for (const budget of budgets) {
    const bytes = readFileSync(join(root, budget.path));
    const actual = budget.gzip === undefined ? bytes.byteLength : gzipSync(bytes).byteLength;
    const limit = budget.gzip ?? budget.raw;
    const unit = budget.gzip === undefined ? 'raw' : 'gzip';
    report.push(`${budget.path}=${actual}/${limit} ${unit} bytes`);
    if (actual > limit) throw new Error(`Frontend budget exceeded: ${report.at(-1)}`);
  }

  const publicRuntimeBytes = PUBLIC_RUNTIME_BUNDLES.map(path =>
    gzipSync(readFileSync(join(root, path))).byteLength);
  const publicRuntimeCombined = publicRuntimeBytes.reduce((total, bytes) => total + bytes, 0);
  report.push(`Public runtime combined=${publicRuntimeCombined}/${PUBLIC_RUNTIME_COMBINED_LIMIT} gzip bytes (${PUBLIC_RUNTIME_BUNDLES.join(' + ')})`);
  if (publicRuntimeCombined > PUBLIC_RUNTIME_COMBINED_LIMIT) {
    throw new Error(`Public runtime combined budget exceeded: ${publicRuntimeCombined}/${PUBLIC_RUNTIME_COMBINED_LIMIT} gzip bytes`);
  }

  const viewer = readFileSync(join(root, 'resources/views/viewer.blade.php'), 'utf8');
  if (/<style(?:\s|>)/i.test(viewer)) {
    throw new Error('Public viewer CSS must not be embedded in Blade.');
  }

  const managerCss = readFileSync(join(root, 'resources/css/page-builder-manager.css'), 'utf8');
  if (!managerCss.includes('@media (max-width: 720px)')
    || !managerCss.includes('.g7pb-store-card {')) {
    throw new Error('Manager responsive CSS must stay in the Manager bundle.');
  }

  const family = await checkEditorStyleSources(root);
  report.push(`Editor CSS family=${family.bytes}/${family.limit} raw bytes (${family.sources.length} files)`);
  console.log(`Frontend budgets: OK\n${report.join('\n')}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
