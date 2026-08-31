#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$root/output/releases"
export COPYFILE_DISABLE=1
version="$(node -p "require('$root/module.json').version")"
commit="$(git -C "$root" rev-parse --short=12 HEAD)"
dirty='false'

node "$root/scripts/check-version-policy.mjs" --release
(cd "$root" && npm run check:block-product-quality -- --verify-render-source --release)
(cd "$root" && npm run check:block-quality-evidence -- --require-ready)
(cd "$root" && npm run check:site-shell-product-quality)

if ! git -C "$root" diff --quiet || ! git -C "$root" diff --cached --quiet; then
  dirty='true'
fi

if [[ "$dirty" == true && "${ALLOW_DIRTY:-}" != '1' ]]; then
  echo 'Release packaging requires a clean Git worktree. Commit the verified release first.' >&2
  exit 2
fi

for required in \
  CHANGELOG.md module.json module.php composer.json composer.lock package.json package-lock.json \
  config/block-packs.php config/official-store.php \
  dist/js/page-builder-editor.iife.js dist/js/page-builder-manager.iife.js \
  dist/js/page-builder-site-part.iife.js dist/js/page-effects.iife.js \
  dist/css/page-builder-editor.css dist/css/page-builder-manager.css \
  dist/css/page-builder-site-part.css dist/css/page-builder-public.css \
  resources/store/dist/catalog.json \
  resources/store/dist/artifacts/jiwonpapa-marketing-presets-1.0.0.zip \
  resources/store/dist/previews/marketing-presets.svg \
  schemas/official-store-catalog.schema.json schemas/page-kit-manifest.schema.json; do
  [[ -f "$root/$required" ]] || { echo "Missing release input: $required" >&2; exit 2; }
done

while IFS= read -r required; do
  [[ -f "$root/resources/store/dist/$required" ]] \
    || { echo "Missing Page Kit release input: resources/store/dist/$required" >&2; exit 2; }
done < <(jq -r '.products[] | select(.product_type == "page_kit") | "artifacts/" + (.artifact.url | split("/")[-1]), "previews/" + (.preview.thumbnail_url | split("/")[-1]), (.preview.screenshots[] | "previews/" + (split("/")[-1]))' \
  "$root/resources/store/dist/catalog.json")

release_id="g7-page-builder-v${version}-${commit}"
if [[ "$dirty" == true ]]; then
  release_id="${release_id}-dirty"
fi

mkdir -p "$output_dir"
stage_root="$(mktemp -d)"
trap 'rm -rf "$stage_root"' EXIT
module_stage="$stage_root/jiwonpapa-page_builder"
mkdir -p "$module_stage"

for file in CHANGELOG.md module.json module.php composer.json composer.lock package.json package-lock.json; do
  cp "$root/$file" "$module_stage/$file"
done

for directory in config database dist resources schemas src; do
  rsync -a "$root/$directory/" "$module_stage/$directory/"
done

if find "$module_stage" -type f \( -name '*.map' -o -name '.env' -o -name '.env.*' \) -print -quit | grep -q .; then
  echo 'Release package contains a sourcemap or environment file.' >&2
  exit 2
fi

compiler_version="$(sed -n "s/.*COMPILER_VERSION = '\([^']*\)'.*/\1/p" "$root/src/Application/Compilation/HtmlDocumentCompiler.php" | head -1)"
schema_version="$(jq -r '."$id" // "g7-page-builder/v1"' "$root/schemas/page-builder-document.schema.json")"
created_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

{
  printf 'release_id=%s\n' "$release_id"
  printf 'version=%s\n' "$version"
  printf 'git_commit=%s\n' "$commit"
  printf 'git_dirty=%s\n' "$dirty"
  printf 'schema_version=%s\n' "$schema_version"
  printf 'compiler_version=%s\n' "$compiler_version"
  printf 'g7_version=>=7.0.7\n'
  printf 'php_version=^8.5\n'
  printf 'node_version=%s\n' "$(node --version)"
  printf 'npm_version=%s\n' "$(npm --version)"
  printf 'created_at=%s\n' "$created_at"
} > "$module_stage/BUILD-INFO"

(
  cd "$module_stage"
  find . -type f ! -name SHA256SUMS -print0 \
    | sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS
  shasum -a 256 -c SHA256SUMS >/dev/null
)

artifact="$output_dir/${release_id}.tar.gz"
tar --no-xattrs -C "$stage_root" -czf "$artifact" jiwonpapa-page_builder
shasum -a 256 "$artifact" > "$artifact.sha256"

verify_root="$(mktemp -d)"
trap 'rm -rf "$stage_root" "$verify_root"' EXIT
tar -C "$verify_root" -xzf "$artifact"
(
  cd "$verify_root/jiwonpapa-page_builder"
  shasum -a 256 -c SHA256SUMS >/dev/null
)

printf '%s\n' "$artifact"
