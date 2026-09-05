#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.docker.local"
compose=(docker compose --project-name g7pb-dev --env-file "$env_file" -f "$root/compose.yaml")
base_url=https://g7pb.test
ca_file="$(mkcert -CAROOT)/rootCA.pem"

[[ -f "$env_file" ]] || { echo 'Run make dev-bootstrap first.' >&2; exit 1; }
[[ -f "$ca_file" ]] || { echo 'mkcert root CA is missing.' >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

for name in \
  G7PB_DB_DATABASE \
  G7PB_DB_USERNAME \
  G7PB_DB_PASSWORD \
  G7PB_ADMIN_NAME \
  G7PB_ADMIN_EMAIL \
  G7PB_ADMIN_PASSWORD; do
  [[ -n "${!name:-}" ]] || { echo "$name is missing." >&2; exit 1; }
done

[[ "$G7PB_DB_DATABASE" =~ ^[A-Za-z0-9_]+$ ]] || { echo 'Unsafe database name.' >&2; exit 1; }
[[ "$G7PB_DB_USERNAME" =~ ^[A-Za-z0-9_]+$ ]] || { echo 'Unsafe database user.' >&2; exit 1; }
[[ "$G7PB_DB_PASSWORD" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'DB password must use the generated safe character set.' >&2; exit 1; }
[[ "$G7PB_ADMIN_PASSWORD" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Admin password must use the generated safe character set.' >&2; exit 1; }
[[ "$G7PB_ADMIN_EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$ ]] || { echo 'Unsafe admin email.' >&2; exit 1; }
[[ "$G7PB_ADMIN_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo 'Unsafe admin name.' >&2; exit 1; }

if ! "${compose[@]}" ps --status running --services | grep -qx dev; then
  echo 'g7pb-dev is not running. Run make dev-up first.' >&2
  exit 1
fi

echo 'Waiting for integrated container processes...'
for _ in $(seq 1 90); do
  if "${compose[@]}" exec -T dev supervisorctl status mariadb redis php-fpm nginx 2>/dev/null \
    | awk 'NF && $2 != "RUNNING" { exit 1 }'; then
    break
  fi
  sleep 1
done
"${compose[@]}" exec -T dev supervisorctl status mariadb redis php-fpm nginx

php_version="$("${compose[@]}" exec -T dev php -r 'echo PHP_VERSION;')"
if [[ "$php_version" != 8.5.9 ]]; then
  echo "Expected PHP 8.5.9, found $php_version" >&2
  exit 1
fi
echo "PHP $php_version confirmed."

echo 'Installing Gnuboard7 Composer development dependencies inside Docker...'
"${compose[@]}" exec -T --user www-data \
  -e COMPOSER_HOME=/var/www/.composer \
  dev composer install --no-interaction --no-progress --prefer-dist --optimize-autoloader

cookie_jar="$(mktemp -t g7pb-install-cookie.XXXXXX)"
trap 'rm -f "$cookie_jar"' EXIT
curl_common=(
  --silent
  --show-error
  --fail-with-body
  --location
  --cacert "$ca_file"
  --cookie "$cookie_jar"
  --cookie-jar "$cookie_jar"
)

get_request() {
  curl "${curl_common[@]}" "$1"
}

post_form() {
  local path="$1"
  local body="$2"
  printf '%s' "$body" | curl "${curl_common[@]}" \
    --header 'Content-Type: application/x-www-form-urlencoded' \
    --data-binary @- \
    "$base_url$path"
}

post_json() {
  local path="$1"
  curl "${curl_common[@]}" \
    --header 'Content-Type: application/json' \
    --data-binary @- \
    "$base_url$path"
}

installed="$("${compose[@]}" exec -T dev bash -lc "grep -qx 'INSTALLER_COMPLETED=true' /var/www/g7/.env && test -f /var/www/g7/storage/app/g7_installed && echo yes || true")"

if [[ "$installed" != yes ]]; then
  echo 'Running the official Gnuboard7 /install flow...'
  get_request "$base_url/install/" >/dev/null
  post_form '/install/' 'language=ko' >/dev/null
  post_form '/install/' 'agree=1' >/dev/null

  requirements="$(get_request "$base_url/install/api/check-configuration.php?action=requirements")"
  if ! jq -e '.all_required_passed == true' <<<"$requirements" >/dev/null; then
    jq '{all_required_passed, php_version, php_extensions, disabled_functions, directories, https}' <<<"$requirements" >&2
    exit 1
  fi
  post_form '/install/' 'proceed=1' >/dev/null

  db_test="$(printf '{"type":"write","host":"127.0.0.1","port":"3306","database":"%s","username":"%s","password":"%s","db_prefix":"g7_"}' \
    "$G7PB_DB_DATABASE" "$G7PB_DB_USERNAME" "$G7PB_DB_PASSWORD" \
    | post_json '/install/api/check-configuration.php?action=test-db')"
  if ! jq -e '.success == true' <<<"$db_test" >/dev/null; then
    jq '{success, message, error}' <<<"$db_test" >&2
    exit 1
  fi

  config_body="db_type=mysql&db_write_host=127.0.0.1&db_write_port=3306"
  config_body+="&db_write_database=$G7PB_DB_DATABASE&db_prefix=g7_"
  config_body+="&db_write_username=$G7PB_DB_USERNAME&db_write_password=$G7PB_DB_PASSWORD"
  config_body+="&app_name=G7%20Page%20Builder%20Dev&app_url=https%3A%2F%2Fg7pb.test&app_env=local"
  config_body+="&admin_email=$G7PB_ADMIN_EMAIL&admin_name=$G7PB_ADMIN_NAME&admin_language=ko"
  config_body+="&admin_password=$G7PB_ADMIN_PASSWORD&admin_password_confirm=$G7PB_ADMIN_PASSWORD"
  config_body+="&core_update_pending_path=&core_update_github_url=https%3A%2F%2Fgithub.com%2Fgnuboard%2Fg7"
  config_body+="&php_binary=php&composer_binary=composer&vendor_mode=composer&asset_url_mode=extension"
  post_form '/install/' "$config_body" >/dev/null

  extension_result="$(printf '%s' \
    '{"admin_templates":["sirsoft-admin_basic"],"user_templates":["sirsoft-basic"],"modules":["sirsoft-board","sirsoft-ecommerce","sirsoft-page"],"plugins":["sirsoft-daum_postcode"],"language_packs":[]}' \
    | post_json '/install/api/save-extensions.php')"
  if ! jq -e '.success == true' <<<"$extension_result" >/dev/null; then
    jq '{success, error, message}' <<<"$extension_result" >&2
    exit 1
  fi

  printf '%s' '{"installation_mode":"polling","existing_db_action":"skip"}' \
    | post_json '/install/api/install-process.php' >/dev/null

  last_task=''
  status=running
  for _ in $(seq 1 360); do
    state="$(get_request "$base_url/install/api/state-management.php?action=get")"
    status="$(jq -r '.status // "unknown"' <<<"$state")"
    current_task="$(jq -r '.current_task // "waiting"' <<<"$state")"
    if [[ "$current_task" != "$last_task" ]]; then
      printf 'G7 install: %s\n' "$current_task"
      last_task="$current_task"
    fi
    case "$status" in
      completed) break ;;
      failed|aborted)
        jq '{status, failed_task, error, error_message_key, error_detail, manual_commands}' <<<"$state" >&2
        exit 1
        ;;
    esac
    sleep 2
  done
  [[ "$status" == completed ]] || { echo 'G7 installation timed out.' >&2; exit 1; }

  printf '{}' | post_json '/install/api/finalize-env.php' >/dev/null
  for _ in $(seq 1 60); do
    if "${compose[@]}" exec -T dev bash -lc \
      "grep -qx 'INSTALLER_COMPLETED=true' /var/www/g7/.env && test ! -f /var/www/g7/storage/installer/runtime.php"; then
      break
    fi
    sleep 1
  done
fi

"${compose[@]}" exec -T --user www-data dev g7pb-post-install
"${compose[@]}" exec -T --user www-data dev g7pb-sync-session-settings

echo 'Installing and activating the mounted Page Builder module...'
installed_modules="$("${compose[@]}" exec -T --user www-data dev \
  php artisan module:list --status=installed --hidden --no-ansi)"
if ! grep -q 'jiwonpapa-page_builder' <<<"$installed_modules"; then
  "${compose[@]}" exec -T --user www-data dev \
    php artisan module:install jiwonpapa-page_builder --vendor-mode=composer --no-ansi
fi
active_modules="$("${compose[@]}" exec -T --user www-data dev \
  php artisan module:list --status=active --hidden --no-ansi)"
if ! grep -q 'jiwonpapa-page_builder' <<<"$active_modules"; then
  "${compose[@]}" exec -T --user www-data dev \
    php artisan module:activate jiwonpapa-page_builder --no-ansi
fi

case "${G7PB_INSTALL_ASSETS:-build}" in
  build)
    echo 'Producing the module browser bundle with reusable dependency/build evidence...'
    python3 "$root/scripts/g7pb.py" environment build --root "$root" --runtime docker --task "${TASK:?runtime task required}" --apply
    ;;
  defer) echo 'Module assets deferred to the selected browser-assets gate; not build acceptance.' ;;
  *) echo 'G7PB_INSTALL_ASSETS must be build or defer.' >&2; exit 2 ;;
esac

"${compose[@]}" exec -T --user www-data dev php artisan optimize:clear --no-ansi >/dev/null
echo 'Gnuboard7 and Page Builder local installation completed.'
