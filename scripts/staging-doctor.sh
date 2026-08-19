#!/usr/bin/env bash
set -euo pipefail

ssh_target="${G7PB_STAGING_SSH:-g7devops}"
app_root="${G7PB_STAGING_ROOT:-/home/g7devops/public_html}"
base_url="${G7PB_STAGING_URL:-https://www.g7devops.com}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ssh -o BatchMode=yes "$ssh_target" \
  "sudo -n -u g7devops bash -s -- '$app_root'" \
  < "$root/scripts/remote-staging-doctor.sh"

apex_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' https://g7devops.com/)"
final_url="$(curl --silent --show-error --location --output /dev/null --write-out '%{url_effective}' https://g7devops.com/)"
up_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$base_url/up")"

[[ "$apex_status" == 301 || "$apex_status" == 308 ]] || { echo "Unexpected apex status: $apex_status" >&2; exit 1; }
[[ "$final_url" == "$base_url/" ]] || { echo "Unexpected canonical URL: $final_url" >&2; exit 1; }
[[ "$up_status" == 200 ]] || { echo "Staging /up failed: $up_status" >&2; exit 1; }

echo "Staging doctor passed: ssh=$ssh_target root=$app_root canonical=$final_url php>=8.5"
