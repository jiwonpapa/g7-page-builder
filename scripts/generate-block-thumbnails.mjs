import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { selectThumbnailItems } from './lib/thumbnailSelection.mjs';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const fixtureRoot = resolve(root, 'output/playwright/block-thumbnail-fixtures');
const thumbnailRoot = resolve(root, 'resources/block-packs/builtin-core/thumbnails/generated');
const manifestPath = resolve(root, 'resources/block-packs/builtin-core/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const available = [
  ...manifest.blocks.map(item => ({ catalog_id: `block:${item.block_id}@${item.block_version}` })),
  ...manifest.presets.map(item => ({ catalog_id: `preset:${manifest.pack_id}:${item.preset_id}` })),
];
const requested = selectThumbnailItems(available, process.argv.slice(2));
const scoped = requested.length !== available.length;

await mkdir(fixtureRoot, { recursive: true });
await mkdir(thumbnailRoot, { recursive: true });

const fixtureBuild = spawnSync('php', [resolve(root, 'scripts/render-block-thumbnail-fixtures.php'), fixtureRoot,
  '--ids', requested.map(item => item.catalog_id).join(',')], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (fixtureBuild.status !== 0) {
  throw new Error(`Thumbnail fixture build failed:\n${fixtureBuild.stdout}${fixtureBuild.stderr}`);
}

const index = JSON.parse(await readFile(resolve(fixtureRoot, 'index.json'), 'utf8'));
const expectedCount = requested.length;
if (!Array.isArray(index) || index.length !== expectedCount) {
  throw new Error(`Expected ${expectedCount} thumbnail fixtures, received ${Array.isArray(index) ? index.length : 'invalid index'}.`);
}
const selectedItems = index;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 / 3 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  for (const item of selectedItems) {
    await page.goto(pathToFileURL(resolve(fixtureRoot, item.fixture)).href, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.evaluate(() => {
      const stage = document.querySelector('.g7pb-thumbnail-stage');
      if (!(stage instanceof HTMLElement)) throw new Error('Thumbnail stage is missing.');
      const width = 960;
      const cropHeight = 600;
      const height = Math.max(stage.scrollHeight, 1);
      const offsetX = 0;
      const offsetY = Math.max(0, (cropHeight - height) / 2);
      stage.style.transformOrigin = 'top left';
      stage.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      document.documentElement.style.width = `${width}px`;
      document.documentElement.style.height = `${cropHeight}px`;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.width = `${width}px`;
      document.body.style.height = `${cropHeight}px`;
    });
    await page.screenshot({ path: resolve(thumbnailRoot, item.filename), type: 'png', animations: 'disabled' });
  }
} finally {
  await browser.close();
}

const paths = new Map(index.map((item) => [item.catalog_id, `thumbnails/generated/${item.filename}`]));
for (const definition of manifest.blocks) {
  const catalogId = `block:${definition.block_id}@${definition.block_version}`;
  if (paths.has(catalogId)) definition.thumbnail = paths.get(catalogId);
}
for (const preset of manifest.presets) {
  const catalogId = `preset:${manifest.pack_id}:${preset.preset_id}`;
  if (paths.has(catalogId)) preset.thumbnail = paths.get(catalogId);
}
manifest.pack_version = '0.15.0';
manifest.files = { ...manifest.files, ...Object.fromEntries(await Promise.all(index.map(async (item) => {
  const path = `thumbnails/generated/${item.filename}`;
  const contents = await readFile(resolve(thumbnailRoot, item.filename));
  return [path, createHash('sha256').update(contents).digest('hex')];
}))) };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const previousIndex = scoped ? JSON.parse(await readFile(resolve(thumbnailRoot, 'index.json'), 'utf8')) : {};
await writeFile(resolve(thumbnailRoot, 'index.json'), `${JSON.stringify({
  viewport: '960px',
  output: '320x200 PNG from a fixed 960x600 public-renderer crop',
  count: available.length,
  sources: { ...previousIndex.sources, ...Object.fromEntries(index.map((item) => [item.catalog_id, item.source_hash])) },
  dynamic_samples: { ...Object.fromEntries(Object.entries(previousIndex.dynamic_samples ?? {}).filter(([id]) => !paths.has(id))), ...Object.fromEntries(index
    .filter((item) => item.dynamic_sample_count > 0)
    .map((item) => [item.catalog_id, item.dynamic_sample_count])) },
}, null, 2)}\n`);

const productQuality = spawnSync(process.execPath, [
  resolve(root, 'scripts/check-block-product-quality.mjs'),
  '--candidate',
  ...(scoped ? [] : ['--verify-render-source']),
], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (productQuality.status !== 0) {
  throw new Error(`Generated block library failed the product quality candidate gate:\n${productQuality.stdout}${productQuality.stderr}`);
}

process.stdout.write(productQuality.stdout);
process.stdout.write(`Generated ${selectedItems.length}/${available.length} renderer-backed block thumbnails.\n`);
