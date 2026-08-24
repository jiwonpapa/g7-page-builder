import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const fixtureRoot = resolve(root, 'output/block-thumbnail-fixtures');
const thumbnailRoot = resolve(root, 'resources/block-packs/builtin-core/thumbnails/generated');
const manifestPath = resolve(root, 'resources/block-packs/builtin-core/manifest.json');

await mkdir(fixtureRoot, { recursive: true });
await mkdir(thumbnailRoot, { recursive: true });

const fixtureBuild = spawnSync('php', [resolve(root, 'scripts/render-block-thumbnail-fixtures.php'), fixtureRoot], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});
if (fixtureBuild.status !== 0) {
  throw new Error(`Thumbnail fixture build failed:\n${fixtureBuild.stdout}${fixtureBuild.stderr}`);
}

const index = JSON.parse(await readFile(resolve(fixtureRoot, 'index.json'), 'utf8'));
if (!Array.isArray(index) || index.length !== 100) {
  throw new Error(`Expected 100 thumbnail fixtures, received ${Array.isArray(index) ? index.length : 'invalid index'}.`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 200 }, deviceScaleFactor: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  for (const item of index) {
    await page.goto(pathToFileURL(resolve(fixtureRoot, item.fixture)).href, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.evaluate(() => {
      const stage = document.querySelector('.g7pb-thumbnail-stage');
      if (!(stage instanceof HTMLElement)) throw new Error('Thumbnail stage is missing.');
      const width = 960;
      const height = Math.max(stage.scrollHeight, 1);
      const scale = Math.min(320 / width, 200 / height);
      const offsetX = Math.max(0, (320 - width * scale) / 2);
      const offsetY = Math.max(0, (200 - height * scale) / 2);
      stage.style.transformOrigin = 'top left';
      stage.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
      document.body.style.width = '320px';
      document.body.style.height = '200px';
    });
    await page.screenshot({ path: resolve(thumbnailRoot, item.filename), type: 'png', animations: 'disabled' });
  }
} finally {
  await browser.close();
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const paths = new Map(index.map((item) => [item.catalog_id, `thumbnails/generated/${item.filename}`]));
for (const definition of manifest.blocks) {
  const catalogId = `block:${definition.block_id}@${definition.block_version}`;
  definition.thumbnail = paths.get(catalogId);
}
for (const preset of manifest.presets) {
  const catalogId = `preset:${manifest.pack_id}:${preset.preset_id}`;
  preset.thumbnail = paths.get(catalogId);
}
manifest.pack_version = '0.14.0';
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(resolve(thumbnailRoot, 'index.json'), `${JSON.stringify({
  viewport: '960px',
  output: '320x200 PNG',
  count: index.length,
  sources: Object.fromEntries(index.map((item) => [item.catalog_id, item.source_hash])),
}, null, 2)}\n`);

process.stdout.write(`Generated ${index.length} renderer-backed block thumbnails.\n`);
