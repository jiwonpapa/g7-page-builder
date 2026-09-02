#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Validate command boundaries, not the implementation text of deploy shells.
exec python3 -B "$root/tests/Harness/test_commands.py" CommandWiringTests "$@"
