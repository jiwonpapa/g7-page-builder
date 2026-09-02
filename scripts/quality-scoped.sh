#!/usr/bin/env bash
set -euo pipefail
# Compatibility entry only; Python owns scope and result reuse.
mode="${1:?phase required}"
base="${2:?base required}"
args=(run --phase "$mode" --base "$base")
if [[ "$mode" != submission ]]; then
  args+=(--task "${4:?integration task required}")
fi
exec python3 -B "$(dirname "${BASH_SOURCE[0]}")/g7pb.py" "${args[@]}"
