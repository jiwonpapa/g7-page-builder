import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

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
if (existsSync(exclusionPath)) inputs.push(exclusionPath);
const fingerprint = () => createHash('sha256').update(`release:${pkg.version}\n${inputs.map((file) => `${file}:${createHash('sha256').update(readFileSync(file)).digest('hex')}`).join('\n')}`).digest('hex');
if (!pkg.scripts['test:e2e:product'].includes('npm run test:e2e:site-shell')) throw new Error('Full product tests must run the Site Shell gate.');
for (const file of ['scripts/release-package.sh', 'scripts/deploy-staging.sh']) {
  if (!readFileSync(file, 'utf8').includes('npm run check:site-shell-product-quality')) throw new Error(`${file} must verify Site Shell evidence before releasing.`);
}
if (process.argv.includes('--run')) {
  const before = fingerprint();
  if (readFileSync('resources/js/public/mobileNavigation.css').byteLength > 6000) throw new Error('Mobile navigation CSS exceeds its 6000-byte source budget.');
  const lint = spawnSync('npx', ['stylelint', 'resources/js/public/mobileNavigation.css'], { stdio: 'inherit', env: process.env });
  if (lint.status !== 0) process.exit(lint.status ?? 1);
  const result = spawnSync('npx', ['playwright', 'test', 'tests/E2E/siteShellProductQuality.spec.ts', 'tests/E2E/mobileNavigationQuality.spec.ts', '--retries=0'], { stdio: 'inherit', env: process.env });
  if (result.status !== 0) process.exit(result.status ?? 1);
  if (before !== fingerprint()) throw new Error('Site Shell inputs changed during validation.');
  mkdirSync('output/playwright', { recursive: true });
  writeFileSync(evidencePath, JSON.stringify({ status: 'passed', fingerprint: before, checkedAt: new Date().toISOString(), viewports: ['desktop', 'tablet', 'mobile'], contractPersonas: ['guest', 'member', 'admin', 'unavailable'], mobileWidths: [320, 360, 390, 430, 768, 899, 900], browserEngines: ['chromium', 'webkit'], physicalDeviceReview: exclusion ? { status: 'excluded', release: pkg.version, decision: exclusionPath, platforms: exclusion.platforms } : { status: 'required', evidence: mobileReviewPath }, realG7: ['administrator', 'admin-route', 'native-logout', 'guest', 'standalone-builder', 'api-logout', 'editor-persona', 'editor-mobile-menu'] }, null, 2));
}
if (!existsSync(evidencePath)) throw new Error('Site Shell release blocked: run npm run test:e2e:site-shell in the local integration runtime.');
const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
if (evidence.status !== 'passed' || evidence.fingerprint !== fingerprint()) throw new Error('Site Shell release blocked: browser evidence is stale or failed.');
if (!process.argv.includes('--run') && !exclusion) {
  if (!existsSync(mobileReviewPath)) throw new Error(`Site Shell release blocked: physical iOS/Android and screen-reader review required at ${mobileReviewPath}. Automated engine tests do not substitute for this approval.`);
  validateMobileReview(JSON.parse(readFileSync(mobileReviewPath, 'utf8')), evidence.fingerprint);
}
console.log(`Site Shell automated gate: PASS · 3 viewports · Chromium/WebKit · real G7 authentication (${evidence.checkedAt}). ${exclusion ? `Physical iOS/Android review EXCLUDED by user for ${pkg.version} only; no device approval claimed.` : 'Release additionally requires current physical-device review.'}`);
