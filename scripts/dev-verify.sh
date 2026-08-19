#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.docker.local"
compose=(docker compose --project-name g7pb-dev --env-file "$env_file" -f "$root/compose.yaml")
base_url=https://g7pb.test
ca_file="$(mkcert -CAROOT)/rootCA.pem"

[[ -f "$env_file" ]] || { echo 'Missing .env.docker.local.' >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

failures=0
ok() { printf 'OK   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; failures=$((failures + 1)); }

container_count="$(docker ps --filter label=com.docker.compose.project=g7pb-dev --format '{{.Names}}' | wc -l | tr -d ' ')"
if [[ "$container_count" == 1 ]] && docker ps --format '{{.Names}}' | grep -qx g7pb-dev; then
  ok 'Exactly one integrated g7pb-dev container'
else
  fail "Expected one g7pb-dev container, found $container_count"
fi

for _ in $(seq 1 30); do
  health="$(docker inspect --format '{{.State.Health.Status}}' g7pb-dev 2>/dev/null || true)"
  [[ "$health" == healthy ]] && break
  sleep 2
done
if [[ "${health:-}" == healthy ]]; then ok 'Docker healthcheck'; else fail "Container health is ${health:-unknown}"; fi

versions="$("${compose[@]}" exec -T dev bash -lc 'printf "PHP=%s Node=%s Composer=%s MariaDB=%s Redis=%s" "$(php -r '\''echo PHP_VERSION;'\'')" "$(node --version)" "$(composer --version --no-ansi | awk '\''{print $3}'\'')" "$(mariadb --version | awk '\''{print $5}'\'' | tr -d ,)" "$(redis-server --version | sed -n '\''s/.*v=\([^ ]*\).*/\1/p'\'')"')"
if grep -q 'PHP=8.5.9' <<<"$versions"; then ok "$versions"; else fail "$versions"; fi

required_extensions=(ctype curl dom fileinfo filter hash json mbstring openssl pcre pdo pdo_mysql session tokenizer xml zip)
missing_extensions=()
for extension in "${required_extensions[@]}"; do
  if ! "${compose[@]}" exec -T dev php -r "exit(extension_loaded('$extension') ? 0 : 1);"; then
    missing_extensions+=("$extension")
  fi
done
if (( ${#missing_extensions[@]} == 0 )); then ok 'All 16 required PHP extensions'; else fail "Missing PHP extensions: ${missing_extensions[*]}"; fi

if "${compose[@]}" exec -T -e MYSQL_PWD="$G7PB_DB_PASSWORD" dev \
  mariadb-admin -h 127.0.0.1 -u "$G7PB_DB_USERNAME" ping --silent >/dev/null 2>&1; then
  db_meta="$("${compose[@]}" exec -T -e MYSQL_PWD="$G7PB_DB_PASSWORD" dev \
    mariadb -N -h 127.0.0.1 -u "$G7PB_DB_USERNAME" \
    -e "SELECT CONCAT(VERSION(), ' ', DEFAULT_CHARACTER_SET_NAME, '/', DEFAULT_COLLATION_NAME) FROM information_schema.SCHEMATA WHERE SCHEMA_NAME='$G7PB_DB_DATABASE';")"
  if grep -q 'utf8mb4/utf8mb4_unicode_ci' <<<"$db_meta"; then ok "MariaDB $db_meta"; else fail "Unexpected database metadata: $db_meta"; fi
else
  fail 'MariaDB application account'
fi

if [[ "$("${compose[@]}" exec -T dev redis-cli -h 127.0.0.1 ping)" == PONG ]]; then ok 'Redis PONG'; else fail 'Redis'; fi

if "${compose[@]}" exec -T dev bash -lc \
  "grep -qx 'INSTALLER_COMPLETED=true' /var/www/g7/.env && test -f /var/www/g7/storage/app/g7_installed && test ! -e /var/www/g7/storage/installer/runtime.php && test ! -e /var/www/g7/storage/installer-state.json"; then
  ok 'G7 install marker and secret cleanup'
else
  fail 'G7 installer finalization'
fi

curl_common=(--silent --show-error --cacert "$ca_file")
home_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' "$base_url/")"
up_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' "$base_url/up")"
admin_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' "$base_url/admin/login")"
page_builder_manager_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' \
  "$base_url/modules/jiwonpapa-page_builder/admin")"
page_builder_native_manager_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' \
  "$base_url/admin/page-builder")"
install_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' "$base_url/install/" || true)"
if [[ "$home_status" == 200 && "$up_status" == 200 && "$admin_status" == 200 && "$page_builder_manager_status" == 200 && "$page_builder_native_manager_status" == 200 && "$install_status" == 410 ]]; then
  ok "HTTPS routes home=$home_status up=$up_status admin=$admin_status page-builder=$page_builder_manager_status native-manager=$page_builder_native_manager_status install=$install_status"
else
  fail "HTTPS routes home=$home_status up=$up_status admin=$admin_status page-builder=$page_builder_manager_status native-manager=$page_builder_native_manager_status install=$install_status"
fi

asset_js_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' \
  "$base_url/api/modules/assets/jiwonpapa-page_builder/dist/js/page-builder.iife.js")"
asset_css_status="$(curl "${curl_common[@]}" --output /dev/null --write-out '%{http_code}' \
  "$base_url/api/modules/assets/jiwonpapa-page_builder/dist/css/page-builder.css")"
if [[ "$asset_js_status" == 200 && "$asset_css_status" == 200 ]]; then
  ok 'Lazy module JS/CSS asset serving'
else
  fail "Module asset serving js=$asset_js_status css=$asset_css_status"
fi

if openssl x509 -in "$root/.runtime/tls/g7pb.test.pem" -noout -ext subjectAltName | grep -q 'DNS:g7pb.test'; then
  ok 'TLS SAN g7pb.test and trusted CA request'
else
  fail 'TLS SAN'
fi

active_modules="$("${compose[@]}" exec -T --user www-data dev \
  php artisan module:list --status=active --hidden --no-ansi)"
if grep -q 'jiwonpapa-page_builder' <<<"$active_modules"; then
  ok 'Page Builder module active'
else
  fail 'Page Builder module is not active'
fi

module_routes="$("${compose[@]}" exec -T --user www-data dev php artisan route:list --json)"
if jq -e '
  ([.[] | select(.uri == "api/modules/jiwonpapa-page_builder/admin/documents/{document}/publications/unpublish" and (.method | contains("POST")))] | length == 1)
  and
  ([.[] | select(.uri == "pages/{slug}" and (.method | contains("GET")))] | length == 1)
  and
  ([.[] | select(.uri == "modules/jiwonpapa-page_builder/p/{slug}" and (.method | contains("GET")))] | length == 1)
  and
  ([.[] | select((.uri | startswith("api/modules/jiwonpapa-page_builder/")) and (.method | contains("DELETE")))] | length == 0)
' <<<"$module_routes" >/dev/null; then
  ok 'Recoverable publication route present and hard document deletion absent'
else
  fail 'Page Builder route safety contract'
fi

menu_rows="$("${compose[@]}" exec -T -e MYSQL_PWD="$G7PB_DB_PASSWORD" dev \
  mariadb -N -h 127.0.0.1 -u "$G7PB_DB_USERNAME" "$G7PB_DB_DATABASE" \
  -e "SELECT CONCAT(slug, '|', url, '|', extension_identifier, '|', is_active) FROM g7_menus WHERE slug IN ('sirsoft-page', 'jiwonpapa-page-builder') ORDER BY slug;")"
if grep -qx 'jiwonpapa-page-builder|/admin/page-builder|jiwonpapa-page_builder|1' <<<"$menu_rows" \
  && grep -qx 'sirsoft-page|/admin/pages|sirsoft-page|1' <<<"$menu_rows" \
  && [[ "$(wc -l <<<"$menu_rows" | tr -d ' ')" == 2 ]]; then
  ok 'Bundled Page Management and separate Page Builder menus coexist'
else
  fail 'Page Builder menu must coexist without replacing bundled Page Management'
fi

menu_role_rows="$("${compose[@]}" exec -T -e MYSQL_PWD="$G7PB_DB_PASSWORD" dev \
  mariadb -N -h 127.0.0.1 -u "$G7PB_DB_USERNAME" "$G7PB_DB_DATABASE" \
  -e "SELECT CONCAT(m.slug, '|', rm.permission_type) FROM g7_role_menus rm JOIN g7_menus m ON m.id = rm.menu_id JOIN g7_roles r ON r.id = rm.role_id WHERE m.slug IN ('sirsoft-page', 'jiwonpapa-page-builder') AND JSON_UNQUOTE(JSON_EXTRACT(r.name, '$.en')) = 'Administrator' ORDER BY m.slug;")"
if grep -qx 'jiwonpapa-page-builder|read' <<<"$menu_role_rows" \
  && grep -qx 'sirsoft-page|read' <<<"$menu_role_rows"; then
  ok 'Administrator can read both independent admin menus'
else
  fail 'Administrator role menu synchronization'
fi

if "${compose[@]}" exec -T dev node \
  /var/www/g7/modules/jiwonpapa-page_builder/scripts/check-g7-dependency-budget.mjs >/dev/null; then
  ok 'Page Builder G7 core-only dependency budget'
else
  fail 'Page Builder G7 dependency budget'
fi

if "${compose[@]}" exec -T --user www-data dev php artisan migrate:status --no-ansi >/dev/null; then
  ok 'Laravel migrations readable'
else
  fail 'Laravel migration status'
fi

module_pending="$("${compose[@]}" exec -T --user www-data dev bash -lc \
  'cd /var/www/g7 && php artisan migrate:status --path=modules/jiwonpapa-page_builder/database/migrations --pending=true --no-ansi' || true)"
if grep -q 'Pending' <<<"$module_pending"; then
  fail 'Page Builder has pending module migrations; run make dev-sync'
else
  ok 'Page Builder module migrations applied'
fi

login_response="$(printf '{"email":"%s","password":"%s"}' "$G7PB_ADMIN_EMAIL" "$G7PB_ADMIN_PASSWORD" \
  | curl "${curl_common[@]}" --header 'Content-Type: application/json' --data-binary @- "$base_url/api/auth/admin/login" || true)"
if jq -e '(.success == true) and (.data.user.is_admin == true)' <<<"$login_response" >/dev/null 2>&1; then
  ok 'Admin API authentication'

  auth_token="$(jq -r '.data.token // empty' <<<"$login_response")"
  page_builder_response="$(curl "${curl_common[@]}" \
    --header 'Accept: application/json' \
    --header "Authorization: Bearer $auth_token" \
    "$base_url/api/modules/jiwonpapa-page_builder/admin/documents?per_page=1" || true)"
  if jq -e '(.success == true) and (.data.items | type == "array")' <<<"$page_builder_response" >/dev/null 2>&1; then
    ok 'Page Builder protected API, permission, Provider, and tables'
  else
    fail 'Page Builder protected API or permission synchronization'
  fi

  unset auth_token page_builder_response
else
  fail 'Admin API authentication'
fi

if (( failures > 0 )); then
  printf '%d verification check(s) failed.\n' "$failures" >&2
  exit 1
fi

echo 'Local Docker environment verification passed.'
