#!/usr/bin/env bash
set -euo pipefail

app_root="${1:?application root is required}"
cd "$app_root"

test -f artisan
test -d modules
test -w modules
php -r 'exit(version_compare(PHP_VERSION, "8.5.0", ">=") ? 0 : 1);'
php artisan --version
command -v mysqldump >/dev/null
command -v sha256sum >/dev/null
command -v flock >/dev/null
command -v jq >/dev/null

available_kb="$(df -Pk "$app_root" | awk 'NR == 2 {print $4}')"
[[ "$available_kb" =~ ^[0-9]+$ && "$available_kb" -ge 1048576 ]]
