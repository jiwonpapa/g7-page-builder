#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

if rg -n -U \
  'Route::(delete|match)\([\s\S]{0,300}(DELETE|documents)|function[[:space:]]+(destroy|delete|purge|forceDelete)[[:space:]]*\(|DocumentRecord::query\(\)[\s\S]{0,300}->[[:space:]]*(delete|forceDelete)\(|[$](record|document|documentRecord)->[[:space:]]*(delete|forceDelete)\(' \
  "$ROOT/src" --glob '*.php'; then
  echo 'Recoverable archive policy is not implemented; hard document deletion must stay closed.' >&2
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

echo 'Architecture boundaries: OK'
