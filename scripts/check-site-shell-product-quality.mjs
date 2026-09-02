import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readEditorSourceGraph } from './lib/editorSourceGraph.mjs';
import { readCssGraph } from './lib/editorCssSources.mjs';

const evidencePath = 'output/playwright/site-shell-product.json';
const mobileReviewPath = 'output/playwright/mobile-navigation-manual-review.json';
const mobilePlatforms = ['ios-safari-voiceover', 'android-chrome-talkback'];

function validateMobileExclusion(decision, version) {
  if (decision?.release !== version || decision?.status !== 'excluded' || decision?.scope !== 'physical-device-review') throw new Error('Mobile exclusion must target this exact release and physical-device review only.');
  if (decision.authorization?.kind !== 'user-request' || !decision.authorization?.request?.trim() || !decision.reason?.trim()) throw new Error('Mobile exclusion requires an explicit user request and reason, not a test approval.');
  const requestedAt = Date.parse(decision.authorization.requestedAt);
  if (!Number.isFinite(requestedAt) || requestedAt > Date.now()) throw new Error('Invalid mobile exclusion timestamp.');
  if (JSON.stringify([...decision.platforms ?? []].sort()) !== JSON.stringify([...mobilePlatforms].sort())) throw new Error('Mobile exclusion must name exactly the two physical platforms; automated browser gates remain mandatory.');
}

function validateMobileReview(review, expectedFingerprint) {
  if (review?.fingerprint !== expectedFingerprint || review?.status !== 'passed') throw new Error('Mobile manual review is missing, failed, or stale.');
  if (review.reviewer?.kind !== 'human' || !review.reviewer?.name?.trim()) throw new Error('Mobile review requires an identified human reviewer.');
  for (const platform of mobilePlatforms) {
    const item = review.results?.find((result) => result.platform === platform);
    if (!item || item.status !== 'passed' || !item.device?.trim() || !item.os?.trim() || !item.browserVersion?.trim() || !item.evidence?.trim()) throw new Error(`Mobile device review is incomplete: ${platform}`);
    const checkedAt = Date.parse(item.checkedAt);
    if (!Number.isFinite(checkedAt) || checkedAt > Date.now()) throw new Error(`Invalid mobile review timestamp: ${platform}`);
    for (const check of ['navigation', 'account', 'focus-and-reading-order', 'safe-area-and-keyboard', 'scroll-and-back']) {
      if (item.checks?.[check] !== 'passed') throw new Error(`Mobile review missing ${platform}/${check}`);
    }
  }
}

// Isolated test interface: never records approval or runs release/browser actions.
if (process.argv.includes('--validate-mobile-review')) {
  const index = process.argv.indexOf('--validate-mobile-review');
  validateMobileReview(JSON.parse(readFileSync(process.argv[index + 1], 'utf8')), process.argv[index + 2]);
  console.log('Mobile manual review contract: PASS');
  process.exit(0);
}
if (process.argv.includes('--validate-mobile-exclusion')) {
  const index = process.argv.indexOf('--validate-mobile-exclusion');
  validateMobileExclusion(JSON.parse(readFileSync(process.argv[index + 1], 'utf8')), process.argv[index + 2]);
  console.log('Mobile release exclusion contract: PASS (not device approval)');
  process.exit(0);
}
const inputs = [
  'resources/js/public/siteShellControls.ts', 'resources/js/public/pageEffects.ts',
  'resources/js/public/mobileNavigation.ts', 'tests/Unit/mobileNavigation.test.ts', 'tests/E2E/mobileNavigationQuality.spec.ts',
  'resources/js/public/mobileNavigation.css', 'tests/Unit/mobileReleaseGate.test.ts',
  'docker/Dockerfile', 'scripts/check-editor-acceptance-contract.mjs',
  'resources/js/editor/SitePartEditor.tsx', 'resources/js/editor/sitePartDocumentAdapter.ts',
  'resources/js/editor/SitePartSetEditor.tsx', 'resources/views/editor.blade.php', 'resources/views/site-part-editor.blade.php',
  'resources/js/editor/SitePartSetLayout.tsx', 'resources/js/editor/useSitePartHistory.ts',
  'resources/js/editor/SitePartEditorCommands.tsx', 'tests/Unit/sitePartEditorHistory.test.tsx',
  'resources/js/editor/SitePartActionBarPosition.ts', 'resources/js/editor/editorOverlaySafeZone.ts',
  'resources/css/page-builder-site-part-controls.css', 'resources/css/page-builder-site-part-workspace.css',
  'tests/E2E/sitePartLifecycle.spec.ts', 'tests/Unit/sitePartHistory.test.tsx', 'tests/Unit/sitePartEditor.test.tsx',
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
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const exclusionPath = `docs/release-exclusions/${pkg.version}.json`;
const exclusion = existsSync(exclusionPath) ? JSON.parse(readFileSync(exclusionPath, 'utf8')) : null;
if (exclusion) validateMobileExclusion(exclusion, pkg.version);
// The public entry is shared by all three receipts. Follow its real emitted
// imports/reexports and CSS imports so extracted owners cannot leave a receipt
// unchanged while an older dist is still present. This reads code, never renders
// catalog content or selects additional browser scenarios.
const publicGraph = await readEditorSourceGraph(process.cwd(), ['resources/js/public/pageEffects.ts']);
const publicCss = await readCssGraph(process.cwd(), publicGraph.files.filter(file => file.endsWith('.css')));
const shared = [...publicGraph.files, ...publicCss.files,
  'scripts/check-site-shell-product-quality.mjs', 'scripts/lib/editorSourceGraph.mjs', 'scripts/lib/editorCssSources.mjs',
  'dist/js/page-effects.iife.js',
  'resources/css/page-builder-public.css', 'dist/css/page-builder-public.css', 'playwright.config.ts',
  'src/Application/Compilation/SitePartHtmlCompiler.php', 'schemas/site-part-document.schema.json',
  'scripts/render-site-shell-quality-fixture.php'];
const productInputs = inputs.filter(file => !['docker/Dockerfile', 'scripts/check-editor-acceptance-contract.mjs',
  'scripts/check-site-shell-product-quality.mjs', 'dist/js/page-builder-editor.iife.js', 'dist/css/page-builder-editor.css'].includes(file));
const scopeInputs = {
  shell: [...new Set([...shared, ...productInputs.filter(file => !/mobileNavigation|mobileRelease|\/editor\/|SitePartEditor|sitePartEditor|sitePartHistory|sitePartLifecycle|site-part/i.test(file))])].sort(),
  mobile: [...new Set([...shared, ...productInputs.filter(file => /mobileNavigation|siteShellControls|site-shell|SiteShellRuntime/.test(file))])].sort(),
  editor: [...new Set([...shared, ...productInputs.filter(file => /\/editor\/|SitePart|sitePart|site-part|editor\.blade/.test(file))])].sort(),
};
let selected = Object.keys(scopeInputs);
let run = false;
let describe = false;
let printFingerprints = false;
let explicitIds = false;
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === '--run' && !run) { run = true; continue; }
  if (argument === '--describe-inputs' && !describe) { describe = true; continue; }
  if (argument === '--fingerprints' && !printFingerprints) { printFingerprints = true; continue; }
  if (argument === '--ids' && !explicitIds) { selected = (process.argv[++index] ?? '').split(','); explicitIds = true; continue; }
  throw new Error(`Unknown Site Shell argument: ${argument}`);
}
if (!selected.length || new Set(selected).size !== selected.length || selected.some(id => !Object.hasOwn(scopeInputs, id))) throw new Error('Unknown, duplicate or empty Site Shell target.');
if (run && (describe || printFingerprints)) throw new Error('Diagnostics cannot be combined with --run.');
if (describe) { console.log(JSON.stringify(Object.fromEntries(selected.map(id => [id, scopeInputs[id]])))); process.exit(0); }
const dependencyLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
delete dependencyLock.version;
if (dependencyLock.packages?.['']) delete dependencyLock.packages[''].version;
const fingerprint = (id) => createHash('sha256').update(JSON.stringify({
  policy: 'site-shell-scopes/v2', scope: id, baseUrl: process.env.G7PB_BASE_URL ?? 'https://g7pb.test',
  dependencies: pkg.dependencies, devDependencies: pkg.devDependencies, dependencyLock,
  inputs: scopeInputs[id].map(file => [file, createHash('sha256').update(readFileSync(file)).digest('hex')]),
})).digest('hex');
const fingerprints = () => Object.fromEntries(selected.map(id => [id, fingerprint(id)]));
if (printFingerprints) { console.log(JSON.stringify({ current_sources_checked: true, browser_executed: false, fingerprints: fingerprints() })); process.exit(0); }
if (run) {
  const before = fingerprints();
  if (selected.includes('mobile')) {
    if (readFileSync('resources/js/public/mobileNavigation.css').byteLength > 6000) throw new Error('Mobile navigation CSS exceeds its 6000-byte source budget.');
    const lint = spawnSync('npx', ['stylelint', 'resources/js/public/mobileNavigation.css'], { stdio: 'inherit', env: process.env });
    if (lint.status !== 0) process.exit(lint.status ?? 1);
  }
  const specs = [...new Set(selected.map(id => id === 'mobile' ? 'tests/E2E/mobileNavigationQuality.spec.ts' : 'tests/E2E/siteShellProductQuality.spec.ts'))];
  const result = spawnSync('npx', ['playwright', 'test', ...specs, '--retries=0'], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (JSON.stringify(before) !== JSON.stringify(fingerprints())) throw new Error('Site Shell inputs changed during validation.');
  mkdirSync('output/playwright', { recursive: true });
  const previous = existsSync(evidencePath) ? JSON.parse(readFileSync(evidencePath, 'utf8')) : {};
  const checkedAt = new Date().toISOString();
  writeFileSync(evidencePath, JSON.stringify({ policy: 'site-shell-scopes/v2', scopes: {
    ...(previous.policy === 'site-shell-scopes/v2' ? previous.scopes : {}),
    ...Object.fromEntries(selected.map(id => [id, { status: 'passed', fingerprint: before[id], checkedAt, specs }])),
  } }, null, 2));
}
if (!existsSync(evidencePath)) throw new Error(`Site Shell evidence missing for ${selected.join(',')}; request those scopes in the local integration runtime.`);
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
if (evidence.policy !== 'site-shell-scopes/v2') throw new Error('Site Shell receipt uses the legacy input policy; no current scoped browser success is inferred.');
for (const id of selected) {
  if (evidence.scopes?.[id]?.status !== 'passed' || evidence.scopes[id].fingerprint !== fingerprint(id)) throw new Error(`Site Shell evidence stale or failed: ${id}`);
}
console.log(`Site Shell scoped gate: PASS (${selected.join(',')}); release version is metadata, not a product input. Physical-device review remains optional.`);
