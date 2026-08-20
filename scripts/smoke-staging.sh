#!/usr/bin/env bash
set -euo pipefail

ssh_target="${G7PB_STAGING_SSH:-g7devops}"
base_url="${G7PB_STAGING_URL:-https://www.g7devops.com}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
expected_version="$(jq -r '.version' "$root/module.json")"
expected_commit="$(git -C "$root" rev-parse --short=12 HEAD)"

status() {
  curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$1"
}

[[ "$(status "$base_url/up")" == 200 ]] || { echo 'Staging /up failed.' >&2; exit 1; }
[[ "$(status "$base_url/admin/login")" == 200 ]] || { echo 'Staging admin login failed.' >&2; exit 1; }
[[ "$(status "$base_url/admin/page-builder")" == 200 ]] || { echo 'Staging native manager shell failed.' >&2; exit 1; }
[[ "$(status "$base_url/api/modules/assets/jiwonpapa-page_builder/dist/js/page-builder.iife.js")" == 200 ]] || { echo 'Staging Page Builder JS failed.' >&2; exit 1; }
[[ "$(status "$base_url/api/modules/assets/jiwonpapa-page_builder/dist/js/page-effects.iife.js")" == 200 ]] || { echo 'Staging Page Effects JS failed.' >&2; exit 1; }
[[ "$(status "$base_url/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder.css")" == 200 ]] || { echo 'Staging Page Builder CSS failed.' >&2; exit 1; }
[[ "$(status "$base_url/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder-public.css")" == 200 ]] || { echo 'Staging Page Builder public CSS failed.' >&2; exit 1; }

store_catalog_url="$base_url/modules/jiwonpapa-page_builder/store/catalog.json"
store_catalog="$(curl --fail --silent --show-error "$store_catalog_url")"
jq -e --arg origin "$base_url" '
  (.catalog_version == "g7pb-store/v1")
  and (.publisher.id == "jiwonpapa")
  and (.products | length == 2)
  and (.products | any(.product_type == "block_pack" and .license == "free"))
  and (.products | any(.product_type == "page_kit" and .license == "free"))
  and (.products | all(.artifact.url | startswith($origin + "/modules/jiwonpapa-page_builder/store/artifacts/")))
' <<<"$store_catalog" >/dev/null || { echo 'Staging Official Store catalog contract failed.' >&2; exit 1; }

store_tmp="$(mktemp -d)"
trap 'rm -rf -- "$store_tmp"' EXIT
while IFS=$'\t' read -r artifact_url artifact_sha artifact_bytes; do
  artifact_path="$store_tmp/$(basename "$artifact_url")"
  curl --fail --silent --show-error --output "$artifact_path" "$artifact_url"
  [[ "$(wc -c < "$artifact_path" | tr -d ' ')" == "$artifact_bytes" ]] \
    || { echo "Staging Store artifact size mismatch: $artifact_url" >&2; exit 1; }
  [[ "$(shasum -a 256 "$artifact_path" | awk '{print $1}')" == "$artifact_sha" ]] \
    || { echo "Staging Store artifact digest mismatch: $artifact_url" >&2; exit 1; }
done < <(jq -r '.products[] | [.artifact.url, .artifact.sha256, (.artifact.bytes | tostring)] | @tsv' <<<"$store_catalog")
while IFS= read -r preview_url; do
  [[ "$(status "$preview_url")" == 200 ]] || { echo "Staging Store preview failed: $preview_url" >&2; exit 1; }
done < <(jq -r '.products[].preview.thumbnail_url' <<<"$store_catalog")

ssh -o BatchMode=yes "$ssh_target" "sudo -n -u g7devops bash -lc 'set -e; cd /home/g7devops/public_html; php artisan module:list --status=active --hidden --no-ansi | grep -q jiwonpapa-page_builder; php artisan route:list --json | jq -e '\''([.[] | select(.uri == \"pages/{slug}\")] | length == 1) and ([.[] | select(.uri == \"modules/jiwonpapa-page_builder/p/{slug}\")] | length == 1) and ([.[] | select(.uri == \"api/modules/jiwonpapa-page_builder/admin/routes/catalog\")] | length == 1) and ([.[] | select(.uri == \"api/modules/jiwonpapa-page_builder/admin/store/catalog\")] | length == 1) and ([.[] | select(.uri == \"api/modules/jiwonpapa-page_builder/admin/store/block-packs/install\")] | length == 1) and ([.[] | select(.uri == \"api/modules/jiwonpapa-page_builder/admin/store/page-kits/apply\")] | length == 1) and ([.[] | select(.uri == \"modules/jiwonpapa-page_builder/store/catalog.json\")] | length == 1) and ([.[] | select(.uri == \"api/modules/jiwonpapa-page_builder/public/home\")] | length == 1)'\'' >/dev/null; ! php artisan migrate:status --path=modules/jiwonpapa-page_builder/database/migrations --pending=true --no-ansi | grep -q Pending'"
remote_identity="$(ssh -o BatchMode=yes "$ssh_target" "sudo -n -u g7devops bash -lc 'cd /home/g7devops/public_html && php -r '\''\$manifest=json_decode(file_get_contents(\"modules/jiwonpapa-page_builder/module.json\"), true); echo \$manifest[\"version\"].\"|\";'\'' && php artisan tinker --execute='\''\$record=app(\\App\\Contracts\\Repositories\\ModuleRepositoryInterface::class)->findByIdentifier(\"jiwonpapa-page_builder\"); echo \$record?->version ?? \"absent\";'\'' --no-ansi && printf \"|\" && sed -n \"s/^git_commit=//p\" modules/jiwonpapa-page_builder/BUILD-INFO'" | tr -d '\r\n')"
[[ "$remote_identity" == "$expected_version|$expected_version|$expected_commit" ]] || {
  echo "Staging release identity mismatch: $remote_identity" >&2
  exit 1
}

rm -rf -- "$store_tmp"
trap - EXIT
echo "Staging smoke passed: $base_url (Official Store catalog + artifacts verified)"
