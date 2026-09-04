import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'module.json'), 'utf8'));
const outputs = [
  manifest.assets?.js?.output,
  manifest.assets?.css?.output,
  'dist/js/page-builder-editor.iife.js',
  'dist/js/page-builder-manager.iife.js',
  'dist/js/page-builder-site-part.iife.js',
  'dist/js/page-sliders.iife.js',
  'dist/css/page-builder-editor.css',
  'dist/css/page-builder-manager.css',
  'dist/css/page-builder-site-part.css',
  'dist/meta/editor-modules.json',
  'dist/meta/manager-modules.json',
  'dist/meta/site-part-modules.json',
  'dist/meta/public-effects-modules.json',
  'dist/meta/public-sliders-modules.json',
];

for (const output of outputs) {
  if (typeof output !== 'string' || !output.startsWith('dist/')) {
    throw new Error(`Invalid module asset output: ${String(output)}`);
  }

  const path = normalize(join(root, output));
  if (!path.startsWith(join(root, 'dist')) || !existsSync(path) || statSync(path).size === 0) {
    throw new Error(`Missing or empty module asset: ${output}`);
  }
}

const readInventory = (name) => JSON.parse(readFileSync(join(root, `dist/meta/${name}-modules.json`), 'utf8')).modules;
const editorModules = readInventory('editor');
const managerModules = readInventory('manager');
const sitePartModules = readInventory('site-part');
const publicEffectsModules = readInventory('public-effects');
const publicSliderModules = readInventory('public-sliders');
const forbiddenEditorDependencies = /(?:^|\/)(?:@puckeditor|@tiptap)(?:\/|$)/;

if (!editorModules.some((id) => forbiddenEditorDependencies.test(id))) {
  throw new Error('Editor bundle inventory is missing Puck/Tiptap dependencies.');
}
if (!sitePartModules.some((id) => forbiddenEditorDependencies.test(id))) {
  throw new Error('Site Part bundle inventory is missing its editor-only Puck/Tiptap dependencies.');
}
const managerBoundaryLeaks = managerModules.filter((id) =>
  forbiddenEditorDependencies.test(id) || id.includes('/resources/js/editor/'),
);
if (managerBoundaryLeaks.length > 0) {
  throw new Error(`Manager bundle crossed the editor dependency boundary: ${managerBoundaryLeaks.join(', ')}`);
}
const sliderDependencies = /(?:^|\/)(?:embla-carousel|embla-carousel-autoplay)(?:\/|$)/;
if (publicEffectsModules.some((id) => sliderDependencies.test(id) || id.endsWith('/publicSliders.ts'))) {
  throw new Error('Public effects bundle must lazy-load the optional slider runtime.');
}
if (!publicSliderModules.some((id) => id.endsWith('/publicSliders.ts'))
  || !publicSliderModules.some((id) => sliderDependencies.test(id))) {
  throw new Error('Public slider bundle is missing its slider owner or Embla dependency.');
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const sourcemaps = walk(join(root, 'dist')).filter((path) => path.endsWith('.map'));
if (sourcemaps.length > 0) {
  throw new Error(`Production sourcemaps are forbidden: ${sourcemaps.join(', ')}`);
}

const storeRoot = join(root, 'resources/store/dist');
const storeCatalogPath = join(storeRoot, 'catalog.json');
if (!existsSync(storeCatalogPath)) throw new Error('Missing official store catalog.');
const storeCatalog = JSON.parse(readFileSync(storeCatalogPath, 'utf8'));
if (storeCatalog.catalog_version !== 'g7pb-store/v1'
  || storeCatalog.publisher?.id !== 'jiwonpapa'
  || !Array.isArray(storeCatalog.products)
  || storeCatalog.products.length === 0) {
  throw new Error('Invalid official free store catalog identity.');
}
for (const product of storeCatalog.products) {
  if (product.license !== 'free' || typeof product.artifact?.url !== 'string'
    || typeof product.artifact?.sha256 !== 'string' || !Number.isInteger(product.artifact?.bytes)) {
    throw new Error(`Invalid official store product: ${String(product.product_id)}`);
  }
  const artifactName = new URL(product.artifact.url).pathname.split('/').at(-1);
  const artifactPath = join(storeRoot, 'artifacts', artifactName ?? '');
  if (!artifactName || !existsSync(artifactPath)) {
    throw new Error(`Missing official store artifact: ${String(product.product_id)}`);
  }
  const artifact = readFileSync(artifactPath);
  const digest = createHash('sha256').update(artifact).digest('hex');
  if (artifact.byteLength !== product.artifact.bytes || digest !== product.artifact.sha256) {
    throw new Error(`Official store artifact digest mismatch: ${String(product.product_id)}`);
  }
  const previewName = new URL(product.preview?.thumbnail_url).pathname.split('/').at(-1);
  if (!previewName || !existsSync(join(storeRoot, 'previews', previewName))) {
    throw new Error(`Missing official store preview: ${String(product.product_id)}`);
  }
  if (product.product_type === 'page_kit') {
    if (!Array.isArray(product.preview?.screenshots) || product.preview.screenshots.length !== 3) {
      throw new Error(`Page Kit needs desktop, tablet, and mobile screenshots: ${String(product.product_id)}`);
    }
    for (const screenshotUrl of product.preview.screenshots) {
      const screenshotName = new URL(screenshotUrl).pathname.split('/').at(-1);
      if (!screenshotName || !existsSync(join(storeRoot, 'previews', screenshotName))) {
        throw new Error(`Missing Page Kit screenshot: ${String(product.product_id)}`);
      }
    }
    const slug = String(product.product_id).split('/').at(-1);
    const demoPath = new URL(product.preview?.demo_url).pathname;
    if (!slug || !demoPath.endsWith(`/store/demos/${slug}`)
      || !existsSync(join(storeRoot, 'demos', `${slug}.html`))) {
      throw new Error(`Missing Page Kit demo: ${String(product.product_id)}`);
    }
  }
}

console.log(`Module assets and ${storeCatalog.products.length} official store products: OK`);
