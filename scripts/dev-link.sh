#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
G7_ROOT="${G7_ROOT:-/Users/neojins/workspace/gnuboard7}"
TARGET="$G7_ROOT/modules/jiwonpapa-page_builder"

if [[ -e "$TARGET" || -L "$TARGET" ]]; then
  echo "Target already exists: $TARGET" >&2
  exit 1
fi

ln -s "$ROOT" "$TARGET"
echo "Linked: $TARGET -> $ROOT"

