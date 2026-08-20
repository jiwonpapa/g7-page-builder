import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'module.json'), 'utf8'));
const outputs = [
  manifest.assets?.js?.output,
  manifest.assets?.css?.output,
  'dist/js/page-builder.iife.js',
  'dist/css/page-builder.css',
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
}

console.log(`Module assets and ${storeCatalog.products.length} official store products: OK`);
