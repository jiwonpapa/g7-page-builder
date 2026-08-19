#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if rg -n \
  'G7Core\.__runtime|resources/js/core/|App\\\\Models|Modules\\\\Sirsoft\\\\Page\\\\(Models|Repositories)' \
  "$ROOT/src" "$ROOT/resources" \
  --glob '!**/Infrastructure/Gnuboard7/README.md'; then
  echo 'Forbidden G7 internal dependency found.' >&2
  exit 1
fi

echo 'Architecture boundaries: OK'
