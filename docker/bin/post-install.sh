#!/usr/bin/env bash
set -euo pipefail

g7_root="${G7PB_G7_ROOT:-/var/www/g7}"
env_file="$g7_root/.env"

[[ -f "$env_file" ]] || { echo 'G7 .env is missing.' >&2; exit 1; }

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$env_file"
  fi
}

set_env APP_ENV local
set_env APP_DEBUG true
set_env APP_URL https://g7pb.test
set_env SESSION_SECURE_COOKIE true
set_env SANCTUM_STATEFUL_DOMAINS g7pb.test
set_env MAIL_MAILER log
set_env REDIS_HOST 127.0.0.1
set_env REDIS_PORT 6379

cd "$g7_root"
php artisan optimize:clear --no-ansi
php artisan storage:link --no-ansi >/dev/null 2>&1 || true
