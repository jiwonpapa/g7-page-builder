#!/usr/bin/env bash
set -euo pipefail

CONTROLLER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$CONTROLLER_ROOT"
design_args=()
while (($#)); do
  case "$1" in
    --root)
      [[ $# -ge 2 && "$2" == /* && -d "$2" ]] || { echo '--root requires an existing absolute subject directory.' >&2; exit 2; }
      ROOT="$(cd "$2" && pwd -P)"
      shift 2
      ;;
    --files)
      [[ $# -ge 2 && -n "$2" ]] || { echo '--files requires explicit source paths.' >&2; exit 2; }
      design_args+=(--files "$2")
      shift 2
      ;;
    *) echo "Unknown boundary option: $1" >&2; exit 2 ;;
  esac
done
if [[ "$ROOT" != "$CONTROLLER_ROOT" ]]; then
  design_args+=(--root "$ROOT")
fi

if ! command -v rg >/dev/null 2>&1; then
  echo 'Architecture boundary check requires ripgrep (rg).' >&2
  exit 2
fi

contract_paths=("$ROOT/src/Domain" "$ROOT/src/Application" "$ROOT/src/Contracts")
existing_contract_paths=()
for path in "${contract_paths[@]}"; do
  [[ -d "$path" ]] && existing_contract_paths+=("$path")
done

if ((${#existing_contract_paths[@]} > 0)) && rg -n \
  '^[[:space:]]*use[[:space:]]+(App|Illuminate|Modules\\Sirsoft)\\' \
  "${existing_contract_paths[@]}" --glob '*.php'; then
  echo 'Domain/Application/Contracts may not import G7, Laravel, or Sirsoft implementations.' >&2
  exit 1
fi

if rg -n \
  'G7Core\.__runtime|resources/js/core/|G7Core\.__LayoutEditorChrome' \
  "$ROOT/src" "$ROOT/resources" --glob '!**/Infrastructure/Gnuboard7/README.md'; then
  echo 'Forbidden G7 frontend internal dependency found.' >&2
  exit 1
fi

if rg -n \
  '^[[:space:]]*use[[:space:]]+(App\\Models|Modules\\Sirsoft\\[^;]+\\(Models|Repositories|Services))\\' \
  "$ROOT/src" --glob '*.php'; then
  echo 'Direct G7 or bundled-module implementation dependency found.' >&2
  exit 1
fi

if rg -n 'Modules\\Sirsoft\\' "$ROOT/src" "$ROOT/module.php" --glob '*.php'; then
  echo 'Base module may not import any Sirsoft bundled module.' >&2
  exit 1
fi

if rg -n \
  "(DB|Schema)::table\\([^)]*['\"](?:g7_|pages|page_versions)|->[[:space:]]*(from|join)\\([[:space:]]*['\"](?:g7_|pages|page_versions)" \
  "$ROOT/src" --glob '*.php'; then
  echo 'Direct G7 table access found.' >&2
  exit 1
fi

if rg -n 'forceDelete\(|truncate\(' "$ROOT/src" --glob '*.php'; then
  echo 'Unrecoverable force delete or truncate is forbidden.' >&2
  exit 1
fi

if ! rg -q "Route::delete\('documents/\{document\}'" "$ROOT/src/routes/api.php" \
  || ! rg -q 'confirmation_slug' "$ROOT/src/Infrastructure/Gnuboard7/Http/Controllers/AdminDocumentController.php" \
  || ! rg -q 'if \(\$record->archived_at === null' "$ROOT/src/Infrastructure/Gnuboard7/Persistence/EloquentPageBuilderRepository.php"; then
  echo 'Document purge must require an archived document and typed slug confirmation.' >&2
  exit 1
fi

module_imports="$(rg -n '^[[:space:]]*use[[:space:]]+' "$ROOT/module.php" | rg -v 'use App\\Extension\\AbstractModule;' || true)"
if [[ -n "$module_imports" ]]; then
  printf '%s\n' "$module_imports" >&2
  echo 'module.php may import only G7 AbstractModule.' >&2
  exit 1
fi

if rg -n 'function[[:space:]]+getRoles[[:space:]]*\(' "$ROOT/module.php"; then
  echo 'Base module must not define custom roles.' >&2
  exit 1
fi

if ! rg -q 'function[[:space:]]+getAdminMenus[[:space:]]*\(' "$ROOT/module.php"; then
  echo 'Base module must expose one separate Page Builder admin menu.' >&2
  exit 1
fi

if rg -n "sirsoft-page|/admin/pages|페이지 관리" "$ROOT/module.php"; then
  echo 'Page Builder must not reuse or replace the bundled Page Management menu.' >&2
  exit 1
fi

for required_menu_contract in \
  "'slug' => 'jiwonpapa-page-builder'" \
  "'url' => '/admin/page-builder'" \
  "'permission' => 'jiwonpapa-page_builder.documents.read'"; do
  if ! rg -Fq "$required_menu_contract" "$ROOT/module.php"; then
    echo "Missing separate Page Builder admin menu contract: $required_menu_contract" >&2
    exit 1
  fi
done

for required_route_contract in \
  "get('pages/{slug}'" \
  "->get('pages/{slug}'" \
  "PageBuilderHomeOverride::class"; do
  if ! rg -Fq -- "$required_route_contract" "$ROOT/src/Providers/PageBuilderServiceProvider.php"; then
    echo "Missing clean public route or home override contract: $required_route_contract" >&2
    exit 1
  fi
done

admin_menu_count="$(rg -c "'slug' => 'jiwonpapa-page-builder'" "$ROOT/module.php")"
if [[ "$admin_menu_count" != '1' ]]; then
  echo 'Base module must declare exactly one Page Builder admin menu.' >&2
  exit 1
fi

if [[ -d "$ROOT/src/Providers" ]] && rg -n \
  '^[[:space:]]*use[[:space:]]+App\\' "$ROOT/src/Providers" --glob '*.php'; then
  echo 'Module providers may use Laravel composition only, not G7 App implementations.' >&2
  exit 1
fi

if rg -n 'releases/latest' "$ROOT/src" "$ROOT/resources"; then
  echo 'Block Pack updates must select a verified SemVer release instead of trusting GitHub releases/latest.' >&2
  exit 1
fi

for signed_pack_contract in \
  "manifest.sig" \
  "\$this->signatures->verify"; do
  if ! rg -Fq "$signed_pack_contract" "$ROOT/src/Infrastructure/BlockPacks/ZipBlockPackArchiveAdapter.php"; then
    echo "Missing signed Code Pack archive contract: $signed_pack_contract" >&2
    exit 1
  fi
done

if ! rg -Fq "publisher_id" "$ROOT/src/Infrastructure/BlockPacks/Ed25519BlockPackSignatureVerifier.php"; then
  echo 'Code Pack trust must bind keys to publishers and prevent builtin editor component overrides.' >&2
  exit 1
fi

node "$CONTROLLER_ROOT/scripts/lib/blockPackRegistryBoundary.mjs" --root "$ROOT"

if ! rg -Fq "['digest']" "$ROOT/src/Infrastructure/BlockPacks/GitHubReleaseSourceAdapter.php" \
  || ! rg -Fq "expectedSha256: \$release->sha256" "$ROOT/src/Application/Blocks/GitHubBlockPackService.php"; then
  echo 'GitHub Block Pack installation must preserve the release SHA-256 digest chain.' >&2
  exit 1
fi

if (("${#design_args[@]}" > 0)); then
  node "$CONTROLLER_ROOT/scripts/check-design-architecture.mjs" "${design_args[@]}"
else
  node "$CONTROLLER_ROOT/scripts/check-design-architecture.mjs"
fi
echo 'Architecture boundaries: OK'
