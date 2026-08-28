#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

cd "$root"
node scripts/check-block-product-quality.mjs --release

for required in \
  'generate:block-library' \
  'check:block-product-quality' \
  'pretest:e2e:product'; do
  node -e 'const scripts=require(process.argv[1]).scripts; if (!(process.argv[2] in scripts)) process.exit(1)' \
    "$root/package.json" "$required"
done

grep -Fq 'npm run check:block-product-quality -- --verify-render-source --release' scripts/release-package.sh
grep -Fq 'npm run check:block-product-quality -- --verify-render-source --release' scripts/deploy-staging.sh

echo 'BLOCK_PRODUCT_QUALITY_CONTRACT OK'
