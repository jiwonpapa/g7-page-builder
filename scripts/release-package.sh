#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$root/output/releases"
version="$(node -p "require('$root/module.json').version")"
commit="$(git -C "$root" rev-parse --short=12 HEAD)"
dirty='false'

if ! git -C "$root" diff --quiet || ! git -C "$root" diff --cached --quiet; then
  dirty='true'
fi

if [[ "$dirty" == true && "${ALLOW_DIRTY:-}" != '1' ]]; then
  echo 'Release packaging requires a clean Git worktree. Commit the verified release first.' >&2
  exit 2
fi

for required in \
  module.json module.php composer.json composer.lock package.json package-lock.json \
  dist/js/page-builder.iife.js dist/css/page-builder.css; do
  [[ -f "$root/$required" ]] || { echo "Missing release input: $required" >&2; exit 2; }
done

release_id="g7-page-builder-v${version}-${commit}"
if [[ "$dirty" == true ]]; then
  release_id="${release_id}-dirty"
fi

mkdir -p "$output_dir"
stage_root="$(mktemp -d)"
trap 'rm -rf "$stage_root"' EXIT
module_stage="$stage_root/jiwonpapa-page_builder"
mkdir -p "$module_stage"

for file in module.json module.php composer.json composer.lock package.json package-lock.json; do
  cp "$root/$file" "$module_stage/$file"
done

for directory in database dist resources schemas src; do
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
tar -C "$stage_root" -czf "$artifact" jiwonpapa-page_builder
shasum -a 256 "$artifact" > "$artifact.sha256"

verify_root="$(mktemp -d)"
trap 'rm -rf "$stage_root" "$verify_root"' EXIT
tar -C "$verify_root" -xzf "$artifact"
(
  cd "$verify_root/jiwonpapa-page_builder"
  shasum -a 256 -c SHA256SUMS >/dev/null
)

printf '%s\n' "$artifact"
