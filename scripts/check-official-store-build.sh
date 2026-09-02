#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ $# == 0 ]]; then set -- --all; fi
exec python3 "$root/tools/g7pb/content.py" check --kind kit --root "$root" "$@"
