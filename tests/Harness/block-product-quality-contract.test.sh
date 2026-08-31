#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$root"
# Development validates technical contracts; it does not renew the frozen v1
# approval. Release scripts below still require that approval and v2 readiness.
node scripts/check-block-product-quality.mjs --technical
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const run = args => spawnSync(process.execPath, ['scripts/check-block-product-quality.mjs', ...args], { encoding: 'utf8' });
const technical = run(['--technical']);
assert.equal(technical.status, 0, technical.stderr);
assert.match(technical.stdout, /TECHNICAL_OK.*approval_checked=false release_authorized=false/);
for (const args of [
  ['--technical', '--release'], ['--candidate', '--release'], ['--technical', '--candidate'],
  ['--relase'], ['--technical', '--technical'], ['--root'], ['--root', '--release'],
]) {
  const result = run(args);
  assert.notEqual(result.status, 0, `unexpected success: ${args.join(' ')}`);
  assert(!result.stdout.includes('_OK'), `invalid mode reported success: ${args.join(' ')}`);
}
console.log('BLOCK_PRODUCT_QUALITY_MODES OK: technical is not approval; invalid/ambiguous modes fail');
JS

for required in \
  'generate:block-library' \
  'check:block-product-quality' \
  'pretest:e2e:product'; do
  node -e 'const scripts=require(process.argv[1]).scripts; if (!(process.argv[2] in scripts)) process.exit(1)' \
    "$root/package.json" "$required"
done

grep -Fq 'npm run check:block-product-quality -- --verify-render-source --release' scripts/release-package.sh
grep -Fq 'npm run check:block-product-quality -- --verify-render-source --release' scripts/deploy-staging.sh
grep -Fq '$artifactSourceHtml = $artifactHtml;' scripts/render-block-thumbnail-fixtures.php
grep -Fq 'json_encode($item['"'"'props'"'"'], JSON_THROW_ON_ERROR)."\n".$artifactSourceHtml' scripts/render-block-thumbnail-fixtures.php

echo 'BLOCK_PRODUCT_QUALITY_CONTRACT OK'
