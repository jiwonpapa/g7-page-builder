import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const budgets = [
  { path: 'resources/css/page-builder-core.css', raw: 18_000 },
  { path: 'resources/css/page-builder-manager.css', raw: 20_000 },
  { path: 'resources/css/page-builder-editor.css', raw: 157_000 },
  { path: 'resources/css/page-builder-editor-wysiwyg.css', raw: 2_000 },
  { path: 'resources/css/page-builder-site-part.css', raw: 1_000 },
  { path: 'resources/css/page-builder-public.css', raw: 90_000 },
  { path: 'resources/css/page-builder-site-shell.css', raw: 9_000 },
  { path: 'dist/css/page-builder-manager.css', gzip: 8_000 },
  { path: 'dist/css/page-builder-editor.css', gzip: 45_000 },
  { path: 'dist/css/page-builder-site-part.css', gzip: 32_000 },
  { path: 'dist/css/page-builder-public.css', gzip: 18_000 },
  { path: 'dist/js/page-builder-manager.iife.js', gzip: 90_000 },
  { path: 'dist/js/page-builder-editor.iife.js', gzip: 500_000 },
  { path: 'dist/js/page-builder-site-part.iife.js', gzip: 410_000 },
  { path: 'dist/js/page-effects.iife.js', gzip: 24_000 },
];

const report = [];
for (const budget of budgets) {
  const bytes = readFileSync(join(root, budget.path));
  const actual = budget.gzip === undefined ? bytes.byteLength : gzipSync(bytes).byteLength;
  const limit = budget.gzip ?? budget.raw;
  const unit = budget.gzip === undefined ? 'raw' : 'gzip';
  report.push(`${budget.path}=${actual}/${limit} ${unit} bytes`);
  if (actual > limit) throw new Error(`Frontend budget exceeded: ${report.at(-1)}`);
}

const viewer = readFileSync(join(root, 'resources/views/viewer.blade.php'), 'utf8');
if (/<style(?:\s|>)/i.test(viewer)) {
  throw new Error('Public viewer CSS must not be embedded in Blade.');
}

const managerCss = readFileSync(join(root, 'resources/css/page-builder-manager.css'), 'utf8');
const editorCss = readFileSync(join(root, 'resources/css/page-builder-editor.css'), 'utf8');
if (!managerCss.includes('@media (max-width: 720px)')
  || !managerCss.includes('.g7pb-store-card {')) {
  throw new Error('Manager responsive CSS must stay in the Manager bundle.');
}
if (/\.g7pb-(?:store|manager|document-(?:row|list)|revision-row)/.test(editorCss)) {
  throw new Error('Manager-only selectors must not leak into the Editor CSS bundle.');
}

console.log(`Frontend budgets: OK\n${report.join('\n')}`);
