#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.docker.local"

[[ -f "$env_file" ]] || { echo 'Run make dev-bootstrap first.' >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

printf 'URL:      https://g7pb.test/admin/login\n'
printf 'Email:    %s\n' "$G7PB_ADMIN_EMAIL"
printf 'Password: %s\n' "$G7PB_ADMIN_PASSWORD"
