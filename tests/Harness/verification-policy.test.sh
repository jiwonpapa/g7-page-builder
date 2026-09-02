#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
PYTHONPATH=tests/Harness exec python3 -B -m unittest test_planner test_runner
