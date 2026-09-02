#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$root"

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestedCatalogIds, selectThumbnailItems } from './scripts/lib/thumbnailSelection.mjs';

const items = [
  { catalog_id: 'preset:pack:hero.one' },
  { catalog_id: 'preset:pack:cta.one' },
  { catalog_id: 'block:content.text@1' },
];

assert.deepEqual(selectThumbnailItems(items, []), items);
assert.deepEqual(
  selectThumbnailItems(items, ['--catalog-id', 'preset:pack:hero.one', '--catalog-id=preset:pack:cta.one']),
  items.slice(0, 2),
);
assert.deepEqual([...requestedCatalogIds(['--catalog-id=a', '--catalog-id', 'a'])], ['a']);
assert.throws(() => selectThumbnailItems(items, ['--catalog-id=missing']), /Unknown catalog IDs/);
assert.throws(() => requestedCatalogIds(['--all']), /Unsupported thumbnail generator argument/);
assert.throws(() => requestedCatalogIds(['--catalog-id']), /requires a catalog ID/);
const generator = readFileSync('scripts/generate-block-thumbnails.mjs', 'utf8');
assert(generator.indexOf('const requested = selectThumbnailItems') < generator.indexOf('const fixtureBuild = spawnSync'));
assert(generator.includes("'--ids', requested.map(item => item.catalog_id).join(',')"));
assert(generator.includes('if (paths.has(catalogId)) definition.thumbnail'));
assert(generator.includes('...previousIndex.sources'));
assert(generator.includes("...(scoped ? [] : ['--verify-render-source'])"));
NODE

printf 'scoped-thumbnail-generation.test: PASS\n'
