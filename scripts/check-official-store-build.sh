#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
before="$(mktemp)"
after="$(mktemp)"
trap 'rm -f "$before" "$after"' EXIT

hash_dist() {
  (
    cd "$root"
    find resources/store/dist -type f -print0 \
      | sort -z \
      | xargs -0 shasum -a 256
  )
}

hash_dist > "$before"
php "$root/scripts/build-official-store.php" >/dev/null
hash_dist > "$after"
if ! diff -u "$before" "$after"; then
  echo 'Official Store dist was stale or the build was not deterministic.' >&2
  exit 1
fi

echo 'Official Store deterministic build: OK'
