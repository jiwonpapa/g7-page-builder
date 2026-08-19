import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'module.json'), 'utf8'));
const outputs = [manifest.assets?.js?.output, manifest.assets?.css?.output];

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

console.log('Module assets: OK');
