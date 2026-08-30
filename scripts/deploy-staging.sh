#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ssh_target="${G7PB_STAGING_SSH:-g7devops}"

(cd "$root" && npm run check:block-product-quality -- --verify-render-source --release)
(cd "$root" && npm run check:site-shell-product-quality)
"$root/scripts/staging-doctor.sh"

if ! git -C "$root" diff --quiet || ! git -C "$root" diff --cached --quiet; then
  echo 'Staging deployment requires a clean Git worktree.' >&2
  exit 2
fi

artifact="${G7PB_RELEASE_ARTIFACT:-}"
if [[ -z "$artifact" ]]; then
  version="$(node -p "require('$root/module.json').version")"
  commit="$(git -C "$root" rev-parse --short=12 HEAD)"
  artifact="$root/output/releases/g7-page-builder-v${version}-${commit}.tar.gz"
fi
[[ -n "$artifact" && -f "$artifact" ]] || { echo 'No release artifact found. Run make release-package.' >&2; exit 2; }

if [[ "$(basename "$artifact")" == *-dirty.tar.gz ]]; then
  echo 'Dirty release artifacts cannot be deployed.' >&2
  exit 2
fi

build_info="$(tar -xOf "$artifact" jiwonpapa-page_builder/BUILD-INFO)"
grep -qx 'git_dirty=false' <<< "$build_info" || { echo 'Release BUILD-INFO is not clean.' >&2; exit 2; }

release_id="$(basename "$artifact" .tar.gz)"
[[ "$release_id" =~ ^g7-page-builder-v[0-9A-Za-z][0-9A-Za-z.+-]*-[0-9a-f]{12}$ ]] \
  || { echo "Invalid release id: $release_id" >&2; exit 2; }
artifact_sha="$(shasum -a 256 "$artifact" | awk '{print $1}')"
remote_root="/tmp/$release_id"
remote_artifact="$remote_root/$(basename "$artifact")"
remote_deployer="$remote_root/remote-deploy-staging.sh"

ssh -o BatchMode=yes "$ssh_target" "test ! -e '$remote_root' && mkdir -m 700 '$remote_root'"
cleanup_remote() {
  ssh -o BatchMode=yes "$ssh_target" "rm -rf -- '$remote_root'" >/dev/null 2>&1 || true
}
trap cleanup_remote EXIT

scp -q "$artifact" "$root/scripts/remote-deploy-staging.sh" "$ssh_target:$remote_root/"

ssh -o BatchMode=yes "$ssh_target" "sudo -n chown -R g7devops:g7devops '$remote_root' && sudo -n -u g7devops bash '$remote_deployer' '$remote_artifact' '$artifact_sha' '$release_id'"
ssh -o BatchMode=yes "$ssh_target" 'sudo -n systemctl reload php8.5-fpm && sudo -n -u g7devops bash -lc '\''cd /home/g7devops/public_html && php artisan route:list --no-ansi >/dev/null'\'''

"$root/scripts/smoke-staging.sh"
cleanup_remote
trap - EXIT
echo "Online staging deployment completed: $release_id"
