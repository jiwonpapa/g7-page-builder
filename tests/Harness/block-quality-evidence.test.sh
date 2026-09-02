#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Compatibility entry only; isolated Unit tests own ledger behavior.
exec python3 -B "$root/tests/Harness/test_commands.py" EvidenceCommandTests "$@"
