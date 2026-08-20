#!/usr/bin/env bash
set -euo pipefail

g7_root="${G7PB_G7_ROOT:-/var/www/g7}"
session_lifetime="${G7PB_SESSION_LIFETIME:-10080}"
env_file="$g7_root/.env"
drivers_file="$g7_root/storage/app/settings/drivers.json"

[[ "$session_lifetime" =~ ^[0-9]+$ \
  && "$session_lifetime" -ge 60 \
  && "$session_lifetime" -le 43200 ]] \
  || { echo 'G7PB_SESSION_LIFETIME must be an integer between 60 and 43200 minutes.' >&2; exit 1; }

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$env_file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$env_file"
  fi
}

if [[ -f "$env_file" ]]; then
  set_env SESSION_LIFETIME "$session_lifetime"
  set_env SESSION_EXPIRE_ON_CLOSE false
fi

if [[ -f "$drivers_file" ]]; then
  temporary_file="$(mktemp "${drivers_file}.tmp.XXXXXX")"
  cleanup() { rm -f "$temporary_file"; }
  trap cleanup EXIT

  jq --argjson session_lifetime "$session_lifetime" \
    'if type == "object" then .session_lifetime = $session_lifetime else error("drivers settings must be an object") end' \
    "$drivers_file" >"$temporary_file"
  chmod --reference="$drivers_file" "$temporary_file"
  if (( EUID == 0 )); then
    chown --reference="$drivers_file" "$temporary_file"
  fi
  mv "$temporary_file" "$drivers_file"
  trap - EXIT
fi
