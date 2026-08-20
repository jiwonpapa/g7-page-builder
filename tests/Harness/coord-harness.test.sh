#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
harness="$root/scripts/coord-harness.sh"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-coord-test.XXXXXX")"

cleanup() {
  case "$temp_root" in
    "${TMPDIR:-/tmp}"/g7pb-coord-test.*) rm -rf "$temp_root" ;;
    *) printf 'Refusing unsafe test cleanup: %s\n' "$temp_root" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

fail() {
  printf 'coord-harness.test: %s\n' "$*" >&2
  exit 1
}

expect_fail() {
  if "$@" >"$temp_root/expected-failure.log" 2>&1; then
    fail "command unexpectedly passed: $*"
  fi
}

repo="$temp_root/repo"
editor_worktree="$temp_root/editor"
domain_worktree="$temp_root/domain"
overlap_worktree="$temp_root/overlap"

git init -b main "$repo" >/dev/null
git -C "$repo" config user.name 'Coord Harness Test'
git -C "$repo" config user.email 'coord-harness@example.test'
mkdir -p "$repo/editor" "$repo/domain"
printf 'base\n' > "$repo/shared.txt"
printf 'base editor\n' > "$repo/editor/base.txt"
printf 'base domain\n' > "$repo/domain/base.txt"
git -C "$repo" add .
git -C "$repo" commit -m 'test: base' >/dev/null

git -C "$repo" worktree add --detach "$editor_worktree" HEAD >/dev/null
git -C "$repo" worktree add --detach "$domain_worktree" HEAD >/dev/null
git -C "$repo" worktree add --detach "$overlap_worktree" HEAD >/dev/null

(
  cd "$editor_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task editor-task \
    --paths editor \
    --profile harness >/dev/null
)

(
  cd "$overlap_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" claim \
    --task overlap-task \
    --paths editor/panel \
    --profile harness
)

(
  cd "$domain_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task domain-task \
    --paths domain \
    --profile harness >/dev/null
)

printf 'feature\n' > "$editor_worktree/editor/feature.txt"
printf 'out of scope\n' > "$editor_worktree/shared.txt"
(
  cd "$editor_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" check --task editor-task
  git checkout -- shared.txt
  G7PB_COORD_TESTING=1 "$harness" check --task editor-task >/dev/null
  G7PB_COORD_TESTING=1 "$harness" submit --task editor-task >/dev/null
)

status_before="$(cd "$repo" && "$harness" status)"
status_after="$(cd "$repo" && "$harness" status)"
[[ "$status_before" == "$status_after" ]] || fail 'status command changed coordination state'
printf '%s\n' "$status_after" | grep -q $'ACTIVE\teditor-task\tsubmitted' \
  || fail 'submitted editor task missing from status'

(
  cd "$repo"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task integration-task \
    --areas integration,runtime \
    --profile harness >/dev/null
  G7PB_COORD_TESTING=1 "$harness" runtime-guard --task integration-task >/dev/null
)

(
  cd "$editor_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" runtime-guard --task integration-task
)

(
  cd "$repo"
  G7PB_COORD_TESTING=1 "$harness" integrate \
    --task editor-task \
    --integration-task integration-task >/dev/null
)
[[ -f "$repo/editor/feature.txt" ]] || fail 'integrated file missing from main worktree'
git -C "$repo" log -1 --format=%s | grep -q '^merge(editor-task):' \
  || fail 'integration merge commit missing'

(
  cd "$domain_worktree"
  G7PB_COORD_TESTING=1 "$harness" release --task domain-task >/dev/null
)

(
  cd "$repo"
  G7PB_COORD_TESTING=1 "$harness" verify --task integration-task >/dev/null
  G7PB_COORD_TESTING=1 "$harness" release-guard --task integration-task >/dev/null
  G7PB_COORD_TESTING=1 "$harness" finish --task integration-task >/dev/null
)

final_status="$(cd "$repo" && "$harness" status --history)"
printf '%s\n' "$final_status" | grep -q $'HISTORY\teditor-task\tintegrated' \
  || fail 'integrated task missing from history'
printf '%s\n' "$final_status" | grep -q $'HISTORY\tdomain-task\tcancelled' \
  || fail 'cancelled task missing from history'
printf '%s\n' "$final_status" | grep -q $'HISTORY\tintegration-task\tcomplete' \
  || fail 'completed integration task missing from history'
if printf '%s\n' "$final_status" | grep -q '^ACTIVE'; then
  fail 'active task remained after finish'
fi

grep -q '^dev-up: runtime-guard' "$root/Makefile" \
  || fail 'Makefile dev-up runtime guard missing'
grep -q '^release-package: release-guard' "$root/Makefile" \
  || fail 'Makefile release guard missing'
grep -q '^## Parallel work and integration' "$root/AGENTS.md" \
  || fail 'AGENTS parallel-work contract missing'

printf 'coord-harness.test: PASS\n'
