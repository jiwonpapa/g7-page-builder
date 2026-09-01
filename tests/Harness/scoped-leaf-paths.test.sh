#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-scoped-leaf-paths.XXXXXX")"
trap 'rm -rf "$temp_root"' EXIT
repo="$temp_root/repo"
state="$temp_root/state"

git init -q -b main "$repo"
git -C "$repo" config user.name 'Scoped Leaf Paths Test'
git -C "$repo" config user.email 'scoped-leaf-paths@example.test'
mkdir -p "$repo/scripts" "$repo/tests/Unit"
cp "$root/scripts/coord-harness.sh" "$repo/scripts/coord-harness.sh"
printf 'fixture\n' > "$repo/scripts/existing.sh"
git -C "$repo" add .
git -C "$repo" commit -q -m fixture

run_harness() {
  (
    cd "$repo"
    G7PB_COORD_STATE_DIR="$state" ./scripts/coord-harness.sh "$@"
  )
}

run_harness claim --task exact-files --paths scripts/existing.sh,tests/Unit/new.test.ts --profile scoped
run_harness release --task exact-files

if run_harness claim --task directory-scope --paths tests/Unit --profile scoped >"$temp_root/directory.log" 2>&1; then
  printf 'scoped-leaf-paths.test: directory claim was accepted\n' >&2
  exit 1
fi
grep -q '디렉터리 PATHS를 허용하지 않습니다' "$temp_root/directory.log"

paths=''
for index in $(seq 1 25); do
  paths="${paths:+$paths,}tests/Unit/example-${index}.test.ts"
done
if run_harness claim --task oversized-scope --paths "$paths" --profile scoped >"$temp_root/limit.log" 2>&1; then
  printf 'scoped-leaf-paths.test: oversized claim was accepted\n' >&2
  exit 1
fi
grep -q 'PATHS 상한은 24개' "$temp_root/limit.log"

printf 'scoped-leaf-paths.test: PASS\n'
