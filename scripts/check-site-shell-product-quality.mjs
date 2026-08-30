import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const evidencePath = 'output/playwright/site-shell-product.json';
const inputs = [
  'resources/js/public/siteShellControls.ts', 'resources/js/public/pageEffects.ts',
  'resources/js/editor/SitePartEditor.tsx', 'resources/js/editor/sitePartDocumentAdapter.ts',
  'resources/js/editor/SitePartSetEditor.tsx', 'resources/views/editor.blade.php', 'resources/views/site-part-editor.blade.php',
  'resources/css/page-builder-site-shell.css', 'resources/css/page-builder-public.css',
  'src/Application/Compilation/SitePartHtmlCompiler.php', 'src/Infrastructure/Gnuboard7/SiteShellRuntimeConfig.php',
  'src/Infrastructure/Gnuboard7/Http/Controllers/ViewerController.php', 'resources/views/viewer.blade.php',
  'src/Infrastructure/Gnuboard7/Http/Middleware/PageBuilderHomeOverride.php',
  'schemas/site-part-document.schema.json', 'tests/E2E/siteShellProductQuality.spec.ts',
  'tests/Unit/siteShellProductQuality.test.ts', 'tests/UnitPhp/SiteShellProductQualityTest.php',
  'scripts/render-site-shell-quality-fixture.php', 'scripts/check-site-shell-product-quality.mjs',
  'tests/Integration/Gnuboard7/SiteShellRuntimeConfigTest.php',
  'tests/Unit/sitePartEditorPreview.test.tsx',
  'dist/js/page-builder-site-part.iife.js', 'dist/css/page-builder-site-part.css',
  'dist/js/page-builder-editor.iife.js', 'dist/css/page-builder-editor.css',
  'dist/js/page-effects.iife.js', 'dist/css/page-builder-public.css',
];
const fingerprint = () => createHash('sha256').update(inputs.map((file) => `${file}:${createHash('sha256').update(readFileSync(file)).digest('hex')}`).join('\n')).digest('hex');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.scripts['test:e2e:product'].includes('npm run test:e2e:site-shell')) throw new Error('Full product tests must run the Site Shell gate.');
for (const file of ['scripts/release-package.sh', 'scripts/deploy-staging.sh']) {
  if (!readFileSync(file, 'utf8').includes('npm run check:site-shell-product-quality')) throw new Error(`${file} must verify Site Shell evidence before releasing.`);
}
if (process.argv.includes('--run')) {
  const before = fingerprint();
  const result = spawnSync('npx', ['playwright', 'test', 'tests/E2E/siteShellProductQuality.spec.ts', '--retries=0'], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (before !== fingerprint()) throw new Error('Site Shell inputs changed during validation.');
  mkdirSync('output/playwright', { recursive: true });
  writeFileSync(evidencePath, JSON.stringify({ status: 'passed', fingerprint: before, checkedAt: new Date().toISOString(), viewports: ['desktop', 'tablet', 'mobile'], contractPersonas: ['guest', 'member', 'admin', 'unavailable'], realG7: ['administrator', 'admin-route', 'native-logout', 'guest', 'standalone-builder', 'api-logout', 'editor-persona'] }, null, 2));
}
if (!existsSync(evidencePath)) throw new Error('Site Shell release blocked: run npm run test:e2e:site-shell in the local integration runtime.');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
if (evidence.status !== 'passed' || evidence.fingerprint !== fingerprint()) throw new Error('Site Shell release blocked: browser evidence is stale or failed.');
console.log(`Site Shell product gate: PASS · 3 viewports · 4 contract personas · real G7 authentication (${evidence.checkedAt})`);
