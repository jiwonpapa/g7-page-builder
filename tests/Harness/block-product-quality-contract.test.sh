#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Preserve manual aliases and explicit full checks without running them.
exec python3 -B "$root/tests/Harness/test_commands.py" ProductCommandTests "$@"
