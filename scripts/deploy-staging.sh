#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ssh_target="${G7PB_STAGING_SSH:-g7devops}"

"$root/scripts/staging-doctor.sh"

artifact="${G7PB_RELEASE_ARTIFACT:-}"
if [[ -z "$artifact" ]]; then
  artifact="$(find "$root/output/releases" -maxdepth 1 -type f -name 'g7-page-builder-v*.tar.gz' -print | sort | tail -1)"
fi
[[ -n "$artifact" && -f "$artifact" ]] || { echo 'No release artifact found. Run make release-package.' >&2; exit 2; }

release_id="$(basename "$artifact" .tar.gz)"
artifact_sha="$(shasum -a 256 "$artifact" | awk '{print $1}')"
remote_root="/tmp/$release_id"
remote_artifact="$remote_root/$(basename "$artifact")"
remote_helper="$remote_root/remote-db-backup.php"
remote_deployer="$remote_root/remote-deploy-staging.sh"

ssh -o BatchMode=yes "$ssh_target" "test ! -e '$remote_root' && mkdir -m 700 '$remote_root'"
scp -q "$artifact" "$root/scripts/remote-db-backup.php" "$root/scripts/remote-deploy-staging.sh" "$ssh_target:$remote_root/"

ssh -o BatchMode=yes "$ssh_target" "sudo -n chown -R g7devops:g7devops '$remote_root' && sudo -n -u g7devops bash '$remote_deployer' '$remote_artifact' '$artifact_sha' '$release_id' '$remote_helper'"
ssh -o BatchMode=yes "$ssh_target" 'sudo -n systemctl reload php8.5-fpm && sudo -n -u g7devops bash -lc '\''cd /home/g7devops/public_html && php artisan route:list --no-ansi >/dev/null'\'''

"$root/scripts/smoke-staging.sh"
echo "Online staging deployment completed: $release_id"
