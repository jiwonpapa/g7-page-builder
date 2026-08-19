#!/usr/bin/env bash
set -euo pipefail

mode="${1:-}"
g7_root="${G7PB_G7_ROOT:-/var/www/g7}"

case "$mode" in
  scheduler|queue|reverb) ;;
  *) echo "Unknown managed process: $mode" >&2; exit 64 ;;
esac

while [[ ! -f "$g7_root/.env" ]] || ! grep -Eq '^INSTALLER_COMPLETED=true$' "$g7_root/.env"; do
  sleep 5
done

cd "$g7_root"

case "$mode" in
  scheduler)
    exec php artisan schedule:work
    ;;
  queue)
    queue_connection=''
    drivers_file="$g7_root/storage/app/settings/drivers.json"
    if [[ -f "$drivers_file" ]]; then
      queue_connection="$(php -r '
        $drivers = json_decode(file_get_contents($argv[1]), true);
        echo is_array($drivers) ? ($drivers["queue_driver"] ?? "") : "";
      ' "$drivers_file")"
    fi
    if [[ -z "$queue_connection" ]]; then
      queue_connection="$(sed -n 's/^QUEUE_CONNECTION=//p' .env | tail -n 1 | tr -d '\r\"')"
    fi
    if [[ -z "$queue_connection" || "$queue_connection" == "sync" ]]; then
      while true; do sleep 3600; done
    fi
    exec php artisan queue:work --sleep=1 --tries=3 --timeout=120
    ;;
  reverb)
    if [[ "${G7PB_ENABLE_REVERB:-0}" != "1" ]]; then
      while true; do sleep 3600; done
    fi
    exec php artisan reverb:start --host=127.0.0.1 --port=8080
    ;;
esac
