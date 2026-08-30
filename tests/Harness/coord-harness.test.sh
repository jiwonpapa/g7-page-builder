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

replace_meta_field() {
  local meta_file="$1"
  local key="$2"
  local value="$3"
  local staged="$meta_file.test-stage"
  awk -F '\t' -v OFS='\t' -v key="$key" -v value="$value" \
    '$1 == key { $2 = value } { print }' "$meta_file" > "$staged"
  mv "$staged" "$meta_file"
}

setup_batch_fixture() {
  local fixture="$1"
  batch_repo="$temp_root/$fixture-repo"
  batch_first_worktree="$temp_root/$fixture-first"
  batch_second_worktree="$temp_root/$fixture-second"
  batch_state="$batch_repo/.git/g7pb-coordination-v1"

  git init -b main "$batch_repo" >/dev/null
  git -C "$batch_repo" config user.name 'Coord Harness Test'
  git -C "$batch_repo" config user.email 'coord-harness@example.test'
  mkdir -p "$batch_repo/first" "$batch_repo/second"
  printf 'base first\n' > "$batch_repo/first/file.txt"
  printf 'base second\n' > "$batch_repo/second/file.txt"
  git -C "$batch_repo" add .
  git -C "$batch_repo" commit -m "test: $fixture base" >/dev/null
  batch_start_sha="$(git -C "$batch_repo" rev-parse HEAD)"
  git -C "$batch_repo" worktree add --detach "$batch_first_worktree" HEAD >/dev/null
  git -C "$batch_repo" worktree add --detach "$batch_second_worktree" HEAD >/dev/null

  (
    cd "$batch_first_worktree"
    G7PB_COORD_TESTING=1 "$harness" claim \
      --task first-task \
      --paths first \
      --profile harness >/dev/null
    printf 'submitted first\n' > first/file.txt
    G7PB_COORD_TESTING=1 "$harness" submit --task first-task >/dev/null
  )
  (
    cd "$batch_second_worktree"
    G7PB_COORD_TESTING=1 "$harness" claim \
      --task second-task \
      --paths second \
      --profile harness >/dev/null
    printf 'submitted second\n' > second/file.txt
    G7PB_COORD_TESTING=1 "$harness" submit --task second-task >/dev/null
  )
  (
    cd "$batch_repo"
    G7PB_COORD_TESTING=1 "$harness" claim \
      --task integration-task \
      --areas integration,runtime \
      --profile harness >/dev/null
  )
}

assert_submitted_batch_rollback() {
  local context="$1"
  [[ "$(git -C "$batch_repo" rev-parse HEAD)" == "$batch_start_sha" ]] \
    || fail "$context changed main HEAD"
  [[ -z "$(git -C "$batch_repo" status --porcelain)" ]] \
    || fail "$context left the main worktree dirty"
  if git -C "$batch_repo" rev-parse --verify --quiet MERGE_HEAD >/dev/null; then
    fail "$context left MERGE_HEAD"
  fi
  local task
  for task in first-task second-task; do
    local meta="$batch_state/tasks/$task.meta"
    [[ -f "$meta" ]] || fail "$context lost submitted metadata for $task"
    grep -q $'^status\tsubmitted$' "$meta" \
      || fail "$context changed submitted status for $task"
    if find "$batch_state/history" -type f -name "$task.*.meta" -print -quit | grep -q .; then
      fail "$context left integrated history for $task"
    fi
    [[ ! -L "$batch_state/task-locks/$task.lock" ]] \
      || fail "$context left task operation lock for $task"
  done
  [[ ! -L "$batch_state/task-locks/integration-task.lock" ]] \
    || fail "$context left the integration task operation lock"
}

assert_integrated_batch_history() {
  local expected_sha="$1"
  local task
  for task in first-task second-task; do
    [[ ! -e "$batch_state/tasks/$task.meta" ]] \
      || fail "integrated batch kept active metadata for $task"
    local history_meta
    history_meta="$(find "$batch_state/history" -type f -name "$task.*.meta" -print -quit)"
    [[ -n "$history_meta" && -f "$history_meta" ]] \
      || fail "integrated batch lost history metadata for $task"
    grep -q $'^status\tintegrated$' "$history_meta" \
      || fail "batch history status is not integrated for $task"
    grep -q $'^integration_sha\t'"$expected_sha"'$' "$history_meta" \
      || fail "batch history has a divergent integration SHA for $task"
    [[ ! -L "$batch_state/task-locks/$task.lock" ]] \
      || fail "integrated batch left task operation lock for $task"
  done
  [[ ! -L "$batch_state/task-locks/integration-task.lock" ]] \
    || fail 'integrated batch left the integration task operation lock'
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
[[ ! -L "$repo/.git/g7pb-coordination-v1/task-locks/editor-task.lock" ]] \
  || fail 'integration left the submitted task operation lock'

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

same_repo="$temp_root/same-repo"
git init -b main "$same_repo" >/dev/null
git -C "$same_repo" config user.name 'Coord Harness Test'
git -C "$same_repo" config user.email 'coord-harness@example.test'
mkdir -p "$same_repo/owned"
printf 'base\n' > "$same_repo/owned/file.txt"
git -C "$same_repo" add .
git -C "$same_repo" commit -m 'test: same worktree base' >/dev/null
(
  cd "$same_repo"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task same-worktree-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'submitted\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task same-worktree-task >/dev/null
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task same-worktree-integration \
    --areas integration,runtime \
    --profile harness >/dev/null
  printf 'integration\n' > integration.txt
  git add integration.txt
  git commit -m 'test: advance integration branch' >/dev/null
  G7PB_COORD_TESTING=1 "$harness" integrate \
    --task same-worktree-task \
    --integration-task same-worktree-integration >/dev/null
)
same_status="$(cd "$same_repo" && "$harness" status --history)"
printf '%s\n' "$same_status" | grep -q $'HISTORY\tsame-worktree-task\tintegrated' \
  || fail 'same-worktree submitted ancestor was not finalized as integrated'

restack_repo="$temp_root/restack-repo"
restack_worktree="$temp_root/restack-task"
git init -b main "$restack_repo" >/dev/null
git -C "$restack_repo" config user.name 'Coord Harness Test'
git -C "$restack_repo" config user.email 'coord-harness@example.test'
mkdir -p "$restack_repo/owned" "$restack_repo/upstream"
printf 'base task\n' > "$restack_repo/owned/file.txt"
printf 'base upstream\n' > "$restack_repo/upstream/file.txt"
git -C "$restack_repo" add .
git -C "$restack_repo" commit -m 'test: restack base' >/dev/null
restack_old_base="$(git -C "$restack_repo" rev-parse HEAD)"
git -C "$restack_repo" worktree add --detach "$restack_worktree" "$restack_old_base" >/dev/null
(
  cd "$restack_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task restack-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'submitted task\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task restack-task >/dev/null
)
restack_old_submitted="$(git -C "$restack_worktree" rev-parse HEAD)"
printf 'new upstream\n' > "$restack_repo/upstream/file.txt"
git -C "$restack_repo" add upstream/file.txt
git -C "$restack_repo" commit -m 'test: advance restack base' >/dev/null
restack_new_base="$(git -C "$restack_repo" rev-parse HEAD)"

restack_lock_dir="$restack_repo/.git/g7pb-coordination-v1/task-locks"
mkdir -p "$restack_lock_dir"
restack_test_start="$(ps -p "$$" -o lstart= | tr -d '[:space:]')"
ln -s "$(hostname)|$$|$restack_test_start" "$restack_lock_dir/restack-task.lock"
(
  cd "$restack_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_new_base"
)
[[ "$(readlink "$restack_lock_dir/restack-task.lock")" == "$(hostname)|$$|$restack_test_start" ]] \
  || fail 'restack removed another live task operation lock'
rm -f "$restack_lock_dir/restack-task.lock"

(
  cd "$restack_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_old_submitted"
)
[[ "$(git -C "$restack_worktree" rev-parse HEAD)" == "$restack_old_submitted" ]] \
  || fail 'already-contained restack attempt changed HEAD'

ln -s "$(hostname)|999999999|stale" "$restack_lock_dir/restack-task.lock"
(
  cd "$restack_worktree"
  G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_new_base" >/dev/null
)
[[ ! -L "$restack_lock_dir/restack-task.lock" ]] \
  || fail 'restack did not release a recovered stale task operation lock'
restack_new_submitted="$(git -C "$restack_worktree" rev-parse HEAD)"
[[ "$restack_new_submitted" != "$restack_old_submitted" ]] \
  || fail 'restack did not replace the submitted commit'
git -C "$restack_worktree" merge-base --is-ancestor "$restack_new_base" "$restack_new_submitted" \
  || fail 'restacked submission is not based on the requested commit'
[[ "$(git -C "$restack_worktree" diff --name-only "$restack_new_base..$restack_new_submitted")" == 'owned/file.txt' ]] \
  || fail 'restack did not preserve only the task-owned delta'
[[ "$(git -C "$restack_worktree" show "$restack_new_submitted:owned/file.txt")" == 'submitted task' ]] \
  || fail 'restack lost the submitted task content'
[[ "$(git -C "$restack_worktree" show "$restack_new_submitted:upstream/file.txt")" == 'new upstream' ]] \
  || fail 'restack did not inherit the new base content'

restack_meta="$restack_repo/.git/g7pb-coordination-v1/tasks/restack-task.meta"
grep -q $'^base_sha\t'"$restack_new_base"'$' "$restack_meta" \
  || fail 'restack metadata did not update base_sha'
grep -q $'^submitted_sha\t'"$restack_new_submitted"'$' "$restack_meta" \
  || fail 'restack metadata did not update submitted_sha'
grep -q $'^previous_base_sha\t'"$restack_old_base"'$' "$restack_meta" \
  || fail 'restack metadata did not retain previous_base_sha'
grep -q $'^previous_submitted_sha\t'"$restack_old_submitted"'$' "$restack_meta" \
  || fail 'restack metadata did not retain previous_submitted_sha'
grep -q '^restacked_at' "$restack_meta" \
  || fail 'restack metadata did not retain restacked_at evidence'

printf 'dirty\n' >> "$restack_worktree/owned/file.txt"
(
  cd "$restack_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_new_base"
)
[[ "$(git -C "$restack_worktree" rev-parse HEAD)" == "$restack_new_submitted" ]] \
  || fail 'dirty restack attempt changed HEAD'
git -C "$restack_worktree" checkout -- owned/file.txt

git -C "$restack_worktree" commit --allow-empty -m 'test: unexpected task advance' >/dev/null
(
  cd "$restack_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_new_base"
)
git -C "$restack_worktree" reset --hard "$restack_new_submitted" >/dev/null

restack_unrelated="$(printf 'test: unrelated restack base\n' \
  | git -C "$restack_repo" commit-tree "${restack_old_base}^{tree}")"
(
  cd "$restack_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_unrelated"
)
[[ "$(git -C "$restack_worktree" rev-parse HEAD)" == "$restack_new_submitted" ]] \
  || fail 'non-descendant restack attempt changed HEAD'

printf 'second upstream\n' > "$restack_repo/upstream/file.txt"
git -C "$restack_repo" add upstream/file.txt
git -C "$restack_repo" commit -m 'test: advance restack base again' >/dev/null
restack_second_base="$(git -C "$restack_repo" rev-parse HEAD)"
(
  cd "$restack_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_FAIL_SUBMISSION_PROFILE=1 \
    "$harness" restack \
      --task restack-task \
      --new-base-ref "$restack_second_base"
)
[[ "$(git -C "$restack_worktree" rev-parse HEAD)" == "$restack_new_submitted" ]] \
  || fail 'profile-failed restack did not roll HEAD back'
[[ -z "$(git -C "$restack_worktree" status --porcelain)" ]] \
  || fail 'profile-failed restack did not restore a clean worktree'
grep -q $'^base_sha\t'"$restack_new_base"'$' "$restack_meta" \
  || fail 'profile-failed restack changed base metadata'
grep -q $'^submitted_sha\t'"$restack_new_submitted"'$' "$restack_meta" \
  || fail 'profile-failed restack changed submitted metadata'

(
  cd "$restack_worktree"
  G7PB_COORD_TESTING=1 "$harness" restack \
    --task restack-task \
    --new-base-ref "$restack_second_base" >/dev/null
)
restack_second_submitted="$(git -C "$restack_worktree" rev-parse HEAD)"
restack_history="$(awk -F '\t' '$1 == "restack_history" { print $2 }' "$restack_meta")"
[[ "$restack_history" == *"$restack_old_base:$restack_old_submitted:$restack_new_base:$restack_new_submitted:"* ]] \
  || fail 'restack history lost the first transition'
[[ "$restack_history" == *"$restack_new_base:$restack_new_submitted:$restack_second_base:$restack_second_submitted:"* ]] \
  || fail 'restack history lost the second transition'
grep -q $'^previous_base_sha\t'"$restack_new_base"'$' "$restack_meta" \
  || fail 'second restack did not retain its previous base'
grep -q $'^previous_submitted_sha\t'"$restack_new_submitted"'$' "$restack_meta" \
  || fail 'second restack did not retain its previous submitted SHA'

conflict_repo="$temp_root/restack-conflict-repo"
conflict_worktree="$temp_root/restack-conflict-task"
git init -b main "$conflict_repo" >/dev/null
git -C "$conflict_repo" config user.name 'Coord Harness Test'
git -C "$conflict_repo" config user.email 'coord-harness@example.test'
mkdir -p "$conflict_repo/owned"
printf 'base\n' > "$conflict_repo/owned/file.txt"
git -C "$conflict_repo" add .
git -C "$conflict_repo" commit -m 'test: conflict base' >/dev/null
conflict_old_base="$(git -C "$conflict_repo" rev-parse HEAD)"
git -C "$conflict_repo" worktree add --detach "$conflict_worktree" "$conflict_old_base" >/dev/null
(
  cd "$conflict_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task conflict-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'task\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task conflict-task >/dev/null
)
conflict_old_submitted="$(git -C "$conflict_worktree" rev-parse HEAD)"
printf 'upstream\n' > "$conflict_repo/owned/file.txt"
git -C "$conflict_repo" add owned/file.txt
git -C "$conflict_repo" commit -m 'test: conflicting new base' >/dev/null
conflict_new_base="$(git -C "$conflict_repo" rev-parse HEAD)"
(
  cd "$conflict_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task conflict-task \
    --new-base-ref "$conflict_new_base"
)
[[ "$(git -C "$conflict_worktree" rev-parse HEAD)" == "$conflict_old_submitted" ]] \
  || fail 'conflicting restack did not roll HEAD back'
[[ -z "$(git -C "$conflict_worktree" status --porcelain)" ]] \
  || fail 'conflicting restack did not restore a clean worktree'
conflict_meta="$conflict_repo/.git/g7pb-coordination-v1/tasks/conflict-task.meta"
grep -q $'^base_sha\t'"$conflict_old_base"'$' "$conflict_meta" \
  || fail 'conflicting restack changed base metadata'
grep -q $'^submitted_sha\t'"$conflict_old_submitted"'$' "$conflict_meta" \
  || fail 'conflicting restack changed submitted metadata'
[[ ! -d "$(git -C "$conflict_worktree" rev-parse --git-path rebase-merge)" ]] \
  || fail 'conflicting restack left rebase state behind'
[[ ! -d "$(git -C "$conflict_worktree" rev-parse --git-path rebase-apply)" ]] \
  || fail 'conflicting restack left apply state behind'

scope_repo="$temp_root/restack-scope-repo"
scope_worktree="$temp_root/restack-scope-task"
git init -b main "$scope_repo" >/dev/null
git -C "$scope_repo" config user.name 'Coord Harness Test'
git -C "$scope_repo" config user.email 'coord-harness@example.test'
mkdir -p "$scope_repo/owned"
printf 'base\n' > "$scope_repo/owned/file.txt"
git -C "$scope_repo" add .
git -C "$scope_repo" commit -m 'test: scope base' >/dev/null
scope_old_base="$(git -C "$scope_repo" rev-parse HEAD)"
git -C "$scope_repo" worktree add --detach "$scope_worktree" "$scope_old_base" >/dev/null
(
  cd "$scope_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task scope-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'task change\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task scope-task >/dev/null
)
scope_old_submitted="$(git -C "$scope_worktree" rev-parse HEAD)"
mkdir -p "$scope_repo/outside"
git -C "$scope_repo" mv owned/file.txt outside/file.txt
git -C "$scope_repo" commit -m 'test: move owned path outside claim' >/dev/null
scope_new_base="$(git -C "$scope_repo" rev-parse HEAD)"
(
  cd "$scope_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack \
    --task scope-task \
    --new-base-ref "$scope_new_base"
)
grep -q $'OUT_OF_SCOPE\toutside/file.txt' "$temp_root/expected-failure.log" \
  || fail 'post-rebase scope violation was not reported'
[[ "$(git -C "$scope_worktree" rev-parse HEAD)" == "$scope_old_submitted" ]] \
  || fail 'scope-failed restack did not roll HEAD back'
[[ -z "$(git -C "$scope_worktree" status --porcelain)" ]] \
  || fail 'scope-failed restack did not restore a clean worktree'

signal_repo="$temp_root/restack-signal-repo"
signal_worktree="$temp_root/restack-signal-task"
git init -b main "$signal_repo" >/dev/null
git -C "$signal_repo" config user.name 'Coord Harness Test'
git -C "$signal_repo" config user.email 'coord-harness@example.test'
mkdir -p "$signal_repo/owned" "$signal_repo/upstream"
printf 'base\n' > "$signal_repo/owned/file.txt"
printf 'base\n' > "$signal_repo/upstream/file.txt"
git -C "$signal_repo" add .
git -C "$signal_repo" commit -m 'test: signal base' >/dev/null
signal_old_base="$(git -C "$signal_repo" rev-parse HEAD)"
git -C "$signal_repo" worktree add --detach "$signal_worktree" "$signal_old_base" >/dev/null
(
  cd "$signal_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task signal-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'task\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task signal-task >/dev/null
)
signal_old_submitted="$(git -C "$signal_worktree" rev-parse HEAD)"
printf 'upstream\n' > "$signal_repo/upstream/file.txt"
git -C "$signal_repo" add upstream/file.txt
git -C "$signal_repo" commit -m 'test: signal new base' >/dev/null
signal_new_base="$(git -C "$signal_repo" rev-parse HEAD)"
(
  cd "$signal_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_METADATA=1 \
    "$harness" restack \
      --task signal-task \
      --new-base-ref "$signal_new_base"
)
signal_new_submitted="$(git -C "$signal_worktree" rev-parse HEAD)"
[[ "$signal_new_submitted" != "$signal_old_submitted" ]] \
  || fail 'post-metadata termination incorrectly rolled the branch back'
signal_meta="$signal_repo/.git/g7pb-coordination-v1/tasks/signal-task.meta"
grep -q $'^base_sha\t'"$signal_new_base"'$' "$signal_meta" \
  || fail 'post-metadata termination lost the committed base metadata'
grep -q $'^submitted_sha\t'"$signal_new_submitted"'$' "$signal_meta" \
  || fail 'post-metadata termination diverged branch and submitted metadata'
[[ -z "$(git -C "$signal_worktree" status --porcelain)" ]] \
  || fail 'post-metadata termination left a dirty worktree'
[[ ! -L "$signal_repo/.git/g7pb-coordination-v1/task-locks/signal-task.lock" ]] \
  || fail 'post-metadata termination left the task operation lock'

squash_repo="$temp_root/restack-squash-repo"
squash_worktree="$temp_root/restack-squash-task"
git init -b main "$squash_repo" >/dev/null
git -C "$squash_repo" config user.name 'Coord Harness Test'
git -C "$squash_repo" config user.email 'coord-harness@example.test'
mkdir -p "$squash_repo/owned" "$squash_repo/upstream"
printf 'base first\nshared\nbase last\n' > "$squash_repo/owned/file.txt"
printf 'delete me\n' > "$squash_repo/owned/deleted.txt"
printf 'base upstream\n' > "$squash_repo/upstream/file.txt"
git -C "$squash_repo" add .
git -C "$squash_repo" commit -m 'test: squash base' >/dev/null
squash_old_base="$(git -C "$squash_repo" rev-parse HEAD)"
git -C "$squash_repo" worktree add --detach "$squash_worktree" "$squash_old_base" >/dev/null
(
  cd "$squash_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task squash-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'task first\nshared\nbase last\n' > owned/file.txt
  rm owned/deleted.txt
  printf 'first addition\n' > owned/added.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task squash-task >/dev/null
  printf 'task first\nshared\nbase last\nfinal task line\n' > owned/file.txt
  printf 'final addition\n' > owned/added.txt
  G7PB_COORD_TESTING=1 "$harness" resubmit --task squash-task >/dev/null
)
squash_old_submitted="$(git -C "$squash_worktree" rev-parse HEAD)"
[[ "$(git -C "$squash_worktree" rev-list --count "$squash_old_base..$squash_old_submitted")" == 2 ]] \
  || fail 'squash fixture must contain multiple submitted commits'

printf 'new upstream\n' > "$squash_repo/upstream/file.txt"
printf 'outside claim but inherited\n' > "$squash_repo/upstream/new.txt"
git -C "$squash_repo" add .
git -C "$squash_repo" commit -m 'test: advance squash base' >/dev/null
squash_new_base="$(git -C "$squash_repo" rev-parse HEAD)"
(
  cd "$squash_worktree"
  G7PB_COORD_TESTING=1 "$harness" restack-squash \
    --task squash-task \
    --new-base-ref "$squash_new_base" >/dev/null
)
squash_new_submitted="$(git -C "$squash_worktree" rev-parse HEAD)"
[[ "$(git -C "$squash_worktree" rev-list --count "$squash_new_base..$squash_new_submitted")" == 1 ]] \
  || fail 'squash restack did not create exactly one commit'
[[ "$(git -C "$squash_worktree" rev-parse "$squash_new_submitted^")" == "$squash_new_base" ]] \
  || fail 'squash restack commit is not directly based on the requested commit'
[[ "$(git -C "$squash_worktree" diff --name-only "$squash_new_base..$squash_new_submitted")" == $'owned/added.txt\nowned/deleted.txt\nowned/file.txt' ]] \
  || fail 'squash restack did not preserve only the final owned-path delta'
[[ "$(git -C "$squash_worktree" show "$squash_new_submitted:owned/file.txt")" == $'task first\nshared\nbase last\nfinal task line' ]] \
  || fail 'squash restack lost the final submitted file state'
[[ "$(git -C "$squash_worktree" show "$squash_new_submitted:owned/added.txt")" == 'final addition' ]] \
  || fail 'squash restack preserved an intermediate file state instead of the final delta'
if git -C "$squash_worktree" cat-file -e "$squash_new_submitted:owned/deleted.txt" 2>/dev/null; then
  fail 'squash restack lost a submitted deletion'
fi
[[ "$(git -C "$squash_worktree" show "$squash_new_submitted:upstream/new.txt")" == 'outside claim but inherited' ]] \
  || fail 'squash restack did not inherit out-of-claim new-base content'

squash_meta="$squash_repo/.git/g7pb-coordination-v1/tasks/squash-task.meta"
grep -q $'^base_sha\t'"$squash_new_base"'$' "$squash_meta" \
  || fail 'squash restack metadata did not update base_sha'
grep -q $'^submitted_sha\t'"$squash_new_submitted"'$' "$squash_meta" \
  || fail 'squash restack metadata did not update submitted_sha'
grep -q $'^previous_base_sha\t'"$squash_old_base"'$' "$squash_meta" \
  || fail 'squash restack metadata did not retain previous_base_sha'
grep -q $'^previous_submitted_sha\t'"$squash_old_submitted"'$' "$squash_meta" \
  || fail 'squash restack metadata did not retain previous_submitted_sha'
squash_history="$(awk -F '\t' '$1 == "restack_history" { print $2 }' "$squash_meta")"
[[ "$squash_history" == "$squash_old_base:$squash_old_submitted:$squash_new_base:$squash_new_submitted:"* ]] \
  || fail 'squash restack metadata did not append transition history'

printf 'profile gate base\n' > "$squash_repo/upstream/file.txt"
git -C "$squash_repo" add upstream/file.txt
git -C "$squash_repo" commit -m 'test: advance squash profile base' >/dev/null
squash_profile_base="$(git -C "$squash_repo" rev-parse HEAD)"
(
  cd "$squash_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_FAIL_SUBMISSION_PROFILE=1 \
    "$harness" restack-squash \
      --task squash-task \
      --new-base-ref "$squash_profile_base"
)
[[ "$(git -C "$squash_worktree" rev-parse HEAD)" == "$squash_new_submitted" ]] \
  || fail 'profile-failed squash restack did not roll HEAD back'
[[ -z "$(git -C "$squash_worktree" status --porcelain)" ]] \
  || fail 'profile-failed squash restack did not restore a clean worktree'
grep -q $'^base_sha\t'"$squash_new_base"'$' "$squash_meta" \
  || fail 'profile-failed squash restack changed base metadata'
grep -q $'^submitted_sha\t'"$squash_new_submitted"'$' "$squash_meta" \
  || fail 'profile-failed squash restack changed submitted metadata'

(
  cd "$squash_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_SQUASH_COMMIT=1 \
    "$harness" restack-squash \
      --task squash-task \
      --new-base-ref "$squash_profile_base"
)
[[ "$(git -C "$squash_worktree" rev-parse HEAD)" == "$squash_new_submitted" ]] \
  || fail 'pre-metadata signal did not roll squash restack HEAD back'
[[ -z "$(git -C "$squash_worktree" status --porcelain)" ]] \
  || fail 'pre-metadata signal did not restore a clean squash worktree'
grep -q $'^base_sha\t'"$squash_new_base"'$' "$squash_meta" \
  || fail 'pre-metadata signal changed squash base metadata'

(
  cd "$squash_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_METADATA=1 \
    "$harness" restack-squash \
      --task squash-task \
      --new-base-ref "$squash_profile_base"
)
squash_post_metadata_submitted="$(git -C "$squash_worktree" rev-parse HEAD)"
[[ "$squash_post_metadata_submitted" != "$squash_new_submitted" ]] \
  || fail 'post-metadata signal incorrectly rolled squash restack HEAD back'
[[ "$(git -C "$squash_worktree" rev-parse "$squash_post_metadata_submitted^")" == "$squash_profile_base" ]] \
  || fail 'post-metadata squash restack commit lost the requested parent'
grep -q $'^base_sha\t'"$squash_profile_base"'$' "$squash_meta" \
  || fail 'post-metadata signal lost committed squash base metadata'
grep -q $'^submitted_sha\t'"$squash_post_metadata_submitted"'$' "$squash_meta" \
  || fail 'post-metadata signal diverged squash HEAD and submitted metadata'
[[ -z "$(git -C "$squash_worktree" status --porcelain)" ]] \
  || fail 'post-metadata signal left the squash worktree dirty'
[[ ! -L "$squash_repo/.git/g7pb-coordination-v1/task-locks/squash-task.lock" ]] \
  || fail 'post-metadata signal left the squash task operation lock'

conflict_squash_repo="$temp_root/restack-squash-conflict-repo"
conflict_squash_worktree="$temp_root/restack-squash-conflict-task"
git init -b main "$conflict_squash_repo" >/dev/null
git -C "$conflict_squash_repo" config user.name 'Coord Harness Test'
git -C "$conflict_squash_repo" config user.email 'coord-harness@example.test'
mkdir -p "$conflict_squash_repo/owned"
printf 'base\n' > "$conflict_squash_repo/owned/file.txt"
git -C "$conflict_squash_repo" add .
git -C "$conflict_squash_repo" commit -m 'test: squash conflict base' >/dev/null
conflict_squash_old_base="$(git -C "$conflict_squash_repo" rev-parse HEAD)"
git -C "$conflict_squash_repo" worktree add --detach "$conflict_squash_worktree" "$conflict_squash_old_base" >/dev/null
(
  cd "$conflict_squash_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task conflict-squash-task \
    --paths owned \
    --profile harness >/dev/null
  printf 'task\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task conflict-squash-task >/dev/null
)
conflict_squash_old_submitted="$(git -C "$conflict_squash_worktree" rev-parse HEAD)"
printf 'upstream\n' > "$conflict_squash_repo/owned/file.txt"
git -C "$conflict_squash_repo" add owned/file.txt
git -C "$conflict_squash_repo" commit -m 'test: conflicting squash new base' >/dev/null
conflict_squash_new_base="$(git -C "$conflict_squash_repo" rev-parse HEAD)"
(
  cd "$conflict_squash_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" restack-squash \
    --task conflict-squash-task \
    --new-base-ref "$conflict_squash_new_base"
)
[[ "$(git -C "$conflict_squash_worktree" rev-parse HEAD)" == "$conflict_squash_old_submitted" ]] \
  || fail 'conflicting squash restack did not roll HEAD back'
[[ -z "$(git -C "$conflict_squash_worktree" status --porcelain)" ]] \
  || fail 'conflicting squash restack did not restore a clean worktree'
conflict_squash_meta="$conflict_squash_repo/.git/g7pb-coordination-v1/tasks/conflict-squash-task.meta"
grep -q $'^base_sha\t'"$conflict_squash_old_base"'$' "$conflict_squash_meta" \
  || fail 'conflicting squash restack changed base metadata'
grep -q $'^submitted_sha\t'"$conflict_squash_old_submitted"'$' "$conflict_squash_meta" \
  || fail 'conflicting squash restack changed submitted metadata'

replace_repo="$temp_root/replace-submitted-repo"
replace_old_worktree="$temp_root/replace-submitted-old"
replace_new_worktree="$temp_root/replace-submitted-new"
replace_overlap_worktree="$temp_root/replace-submitted-overlap"
git init -b main "$replace_repo" >/dev/null
git -C "$replace_repo" config user.name 'Coord Harness Test'
git -C "$replace_repo" config user.email 'coord-harness@example.test'
mkdir -p "$replace_repo/owned" "$replace_repo/other"
printf 'base\n' > "$replace_repo/owned/file.txt"
printf 'other\n' > "$replace_repo/other/file.txt"
git -C "$replace_repo" add .
git -C "$replace_repo" commit -m 'test: replacement base' >/dev/null
replace_old_base="$(git -C "$replace_repo" rev-parse HEAD)"
git -C "$replace_repo" worktree add --detach "$replace_old_worktree" "$replace_old_base" >/dev/null
(
  cd "$replace_old_worktree"
  G7PB_COORD_TESTING=1 "$harness" claim \
    --task replaced-task \
    --paths owned \
    --areas shared-contract \
    --profile harness >/dev/null
  printf 'submitted\n' > owned/file.txt
  G7PB_COORD_TESTING=1 "$harness" submit --task replaced-task >/dev/null
)
replace_old_submitted="$(git -C "$replace_old_worktree" rev-parse HEAD)"
replace_new_base="$(printf 'test: independent replacement base\n' \
  | git -C "$replace_repo" commit-tree "${replace_old_base}^{tree}")"
git -C "$replace_repo" worktree add -b codex/replacement-task \
  "$replace_new_worktree" "$replace_new_base" >/dev/null

printf 'dirty old\n' >> "$replace_old_worktree/owned/file.txt"
(
  cd "$replace_new_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" replace-submitted \
    --task replacement-task \
    --supersedes replaced-task
)
replace_old_meta="$replace_repo/.git/g7pb-coordination-v1/tasks/replaced-task.meta"
[[ -f "$replace_old_meta" ]] || fail 'dirty old-task rejection removed submitted metadata'
grep -q $'^status\tsubmitted$' "$replace_old_meta" \
  || fail 'dirty old-task rejection changed submitted status'
[[ ! -e "$replace_repo/.git/g7pb-coordination-v1/tasks/replacement-task.meta" ]] \
  || fail 'dirty old-task rejection created replacement metadata'
git -C "$replace_old_worktree" checkout -- owned/file.txt

git -C "$replace_old_worktree" commit --allow-empty -m 'test: move submitted head' >/dev/null
(
  cd "$replace_new_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" replace-submitted \
    --task replacement-task \
    --supersedes replaced-task
)
[[ -f "$replace_old_meta" ]] || fail 'moved old-HEAD rejection removed submitted metadata'
[[ ! -e "$replace_repo/.git/g7pb-coordination-v1/tasks/replacement-task.meta" ]] \
  || fail 'moved old-HEAD rejection created replacement metadata'
git -C "$replace_old_worktree" reset --hard "$replace_old_submitted" >/dev/null

(
  cd "$replace_new_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_FAIL_REPLACE_BEFORE_COMMIT=1 \
    "$harness" replace-submitted \
      --task replacement-task \
      --supersedes replaced-task
)
[[ -f "$replace_old_meta" ]] || fail 'pre-commit replacement failure removed old submitted metadata'
grep -q $'^status\tsubmitted$' "$replace_old_meta" \
  || fail 'pre-commit replacement failure changed old submitted status'
[[ ! -e "$replace_repo/.git/g7pb-coordination-v1/tasks/replacement-task.meta" ]] \
  || fail 'pre-commit replacement failure created new active metadata'

(
  cd "$replace_new_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_REPLACE_ARCHIVE=1 \
    "$harness" replace-submitted \
      --task replacement-task \
      --supersedes replaced-task
)
[[ -f "$replace_old_meta" ]] || fail 'mid-transaction signal did not restore old submitted metadata'
grep -q $'^status\tsubmitted$' "$replace_old_meta" \
  || fail 'mid-transaction signal did not restore old submitted status'
[[ ! -e "$replace_repo/.git/g7pb-coordination-v1/tasks/replacement-task.meta" ]] \
  || fail 'mid-transaction signal left replacement metadata'
if find "$replace_repo/.git/g7pb-coordination-v1/history" -type f \
  -name 'replaced-task.*.meta' -print -quit | grep -q .; then
  fail 'mid-transaction signal left superseded history metadata'
fi

(
  cd "$replace_new_worktree"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_REPLACE_METADATA=1 \
    "$harness" replace-submitted \
      --task replacement-task \
      --supersedes replaced-task
)
replace_new_meta="$replace_repo/.git/g7pb-coordination-v1/tasks/replacement-task.meta"
[[ ! -e "$replace_old_meta" ]] || fail 'committed replacement kept old active metadata'
[[ -f "$replace_new_meta" ]] || fail 'committed replacement lost new active metadata'
grep -q $'^status\tactive$' "$replace_new_meta" \
  || fail 'replacement task is not active'
grep -q $'^base_sha\t'"$replace_new_base"'$' "$replace_new_meta" \
  || fail 'replacement task did not use the requested current base'
grep -q $'^paths\towned$' "$replace_new_meta" \
  || fail 'replacement task weakened or changed inherited PATHS'
grep -q $'^areas\tshared-contract$' "$replace_new_meta" \
  || fail 'replacement task weakened or changed inherited AREAS'
grep -q $'^profile\tharness$' "$replace_new_meta" \
  || fail 'replacement task weakened or changed inherited PROFILE'
replace_history_meta="$(find "$replace_repo/.git/g7pb-coordination-v1/history" -type f \
  -name 'replaced-task.*.meta' -print -quit)"
[[ -n "$replace_history_meta" && -f "$replace_history_meta" ]] \
  || fail 'replacement did not archive old submitted metadata'
grep -q $'^status\tsuperseded$' "$replace_history_meta" \
  || fail 'replacement history status is not superseded'
grep -q $'^submitted_sha\t'"$replace_old_submitted"'$' "$replace_history_meta" \
  || fail 'replacement history lost the old submitted SHA'
grep -q $'^superseded_by\treplacement-task$' "$replace_history_meta" \
  || fail 'replacement history lost superseded_by'
grep -Eq $'^superseded_at\t[0-9]{4}-[0-9]{2}-[0-9]{2}T' "$replace_history_meta" \
  || fail 'replacement history lost superseded_at'
[[ "$(git -C "$replace_old_worktree" rev-parse HEAD)" == "$replace_old_submitted" ]] \
  || fail 'replacement changed the preserved old branch HEAD'
[[ -z "$(git -C "$replace_old_worktree" status --porcelain)" ]] \
  || fail 'replacement changed the preserved old worktree'
[[ ! -L "$replace_repo/.git/g7pb-coordination-v1/task-locks/replaced-task.lock" ]] \
  || fail 'replacement left the old task operation lock'

git -C "$replace_repo" worktree add --detach "$replace_overlap_worktree" "$replace_new_base" >/dev/null
(
  cd "$replace_overlap_worktree"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" claim \
    --task replacement-overlap-task \
    --paths owned \
    --profile harness
)
[[ ! -e "$replace_repo/.git/g7pb-coordination-v1/tasks/replacement-overlap-task.meta" ]] \
  || fail 'replacement did not retain inherited overlap exclusion'

batch_profile_hook="$temp_root/batch-profile-hook.sh"
batch_profile_record="$temp_root/batch-profile-record.tsv"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -euo pipefail' \
  'printf '\''%s\t%s\t%s\n'\'' "$1" "$2" "$3" >> "$G7PB_COORD_TEST_PROFILE_RECORD"' \
  > "$batch_profile_hook"
chmod +x "$batch_profile_hook"

setup_batch_fixture 'batch-success'
mkdir -p "$batch_state/task-locks"
batch_lock_owner="$(hostname)|$$|$(ps -p "$$" -o lstart= | tr -d '[:space:]')"
ln -s "$batch_lock_owner" "$batch_state/task-locks/integration-task.lock"
(
  cd "$batch_repo"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" integrate-batch \
    --tasks first-task,second-task \
    --integration-task integration-task
)
[[ "$(readlink "$batch_state/task-locks/integration-task.lock")" == "$batch_lock_owner" ]] \
  || fail 'competing batch integration removed another live integration lock'
rm -f "$batch_state/task-locks/integration-task.lock"
assert_submitted_batch_rollback 'competing integration lock rejection'

(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_TASK_LOCK_COUNT=2 \
    "$harness" integrate-batch \
      --tasks second-task,first-task \
      --integration-task integration-task
)
assert_submitted_batch_rollback 'partial-lock termination'

(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_TASK_LOCK_COUNT=3 \
    "$harness" integrate-batch \
      --tasks second-task,first-task \
      --integration-task integration-task
)
assert_submitted_batch_rollback 'all-lock termination'

(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_INTEGRATION_PROFILE=1 \
    "$harness" integrate \
      --task first-task \
      --integration-task integration-task
)
assert_submitted_batch_rollback 'single integration profile termination'

replace_meta_field "$batch_state/tasks/first-task.meta" profile frontend
replace_meta_field "$batch_state/tasks/first-task.meta" areas migration
replace_meta_field "$batch_state/tasks/second-task.meta" profile php
replace_meta_field "$batch_state/tasks/second-task.meta" areas version
(
  cd "$batch_repo"
  G7PB_COORD_TESTING=1 \
  G7PB_COORD_TEST_INTEGRATION_PROFILE_HOOK="$batch_profile_hook" \
  G7PB_COORD_TEST_PROFILE_RECORD="$batch_profile_record" \
    "$harness" integrate-batch \
      --tasks second-task,first-task \
      --integration-task integration-task >/dev/null
)
batch_success_sha="$(git -C "$batch_repo" rev-parse HEAD)"
[[ "$batch_success_sha" != "$batch_start_sha" ]] \
  || fail 'successful batch did not create an integration commit'
[[ "$(git -C "$batch_repo" show HEAD:first/file.txt)" == 'submitted first' \
  && "$(git -C "$batch_repo" show HEAD:second/file.txt)" == 'submitted second' ]] \
  || fail 'successful batch did not integrate every submitted tree'
[[ "$(wc -l < "$batch_profile_record" | tr -d ' ')" == 1 ]] \
  || fail 'successful batch did not execute its integration profile exactly once'
grep -q $'^mixed\tintegration-task\tmigration,version$' "$batch_profile_record" \
  || fail 'successful batch did not select the strongest profile with the complete AREA union'
[[ -z "$(git -C "$batch_repo" status --porcelain)" ]] \
  || fail 'successful batch left the main worktree dirty'
if git -C "$batch_repo" rev-parse --verify --quiet MERGE_HEAD >/dev/null; then
  fail 'successful batch left MERGE_HEAD'
fi
assert_integrated_batch_history "$batch_success_sha"

setup_batch_fixture 'batch-profile-failure'
(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_FAIL_INTEGRATION_PROFILE=1 \
    "$harness" integrate-batch \
      --tasks first-task,second-task \
      --integration-task integration-task
)
assert_submitted_batch_rollback 'batch profile failure'

setup_batch_fixture 'batch-finalize-failure'
(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_FAIL_INTEGRATION_FINALIZE=1 \
    "$harness" integrate-batch \
      --tasks first-task,second-task \
      --integration-task integration-task
)
assert_submitted_batch_rollback 'batch metadata finalization failure'

setup_batch_fixture 'batch-partial-archive-signal'
(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_FIRST_INTEGRATION_ARCHIVE=1 \
    "$harness" integrate-batch \
      --tasks first-task,second-task \
      --integration-task integration-task
)
assert_submitted_batch_rollback 'batch partial metadata termination'

setup_batch_fixture 'batch-complete-archive-signal'
(
  cd "$batch_repo"
  expect_fail env \
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_TERMINATE_AFTER_INTEGRATION_METADATA=1 \
    "$harness" integrate-batch \
      --tasks first-task,second-task \
      --integration-task integration-task
)
batch_preserved_sha="$(git -C "$batch_repo" rev-parse HEAD)"
[[ "$batch_preserved_sha" != "$batch_start_sha" ]] \
  || fail 'post-history termination rolled back a complete batch integration'
[[ -z "$(git -C "$batch_repo" status --porcelain)" ]] \
  || fail 'post-history termination left the main worktree dirty'
if git -C "$batch_repo" rev-parse --verify --quiet MERGE_HEAD >/dev/null; then
  fail 'post-history termination left MERGE_HEAD'
fi
assert_integrated_batch_history "$batch_preserved_sha"

setup_batch_fixture 'batch-invalid-contract'
(
  cd "$batch_repo"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" integrate-batch \
    --tasks first-task,first-task \
    --integration-task integration-task
)
grep -q '중복 ID' "$temp_root/expected-failure.log" \
  || fail 'duplicate batch task IDs were not rejected explicitly'
assert_submitted_batch_rollback 'duplicate task rejection'

batch_first_meta="$batch_state/tasks/first-task.meta"
batch_second_meta="$batch_state/tasks/second-task.meta"
replace_meta_field "$batch_first_meta" paths 'first,second'
(
  cd "$batch_repo"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" integrate-batch \
    --tasks first-task,second-task \
    --integration-task integration-task
)
grep -q 'PATHS가 겹칩니다' "$temp_root/expected-failure.log" \
  || {
    sed -n '1,80p' "$temp_root/expected-failure.log" >&2
    fail 'overlapping batch PATHS were not rejected explicitly'
  }
assert_submitted_batch_rollback 'overlapping path rejection'
replace_meta_field "$batch_first_meta" paths first

replace_meta_field "$batch_first_meta" areas version
replace_meta_field "$batch_second_meta" areas version
(
  cd "$batch_repo"
  expect_fail env G7PB_COORD_TESTING=1 "$harness" integrate-batch \
    --tasks first-task,second-task \
    --integration-task integration-task
)
grep -q 'AREAS가 겹칩니다' "$temp_root/expected-failure.log" \
  || {
    sed -n '1,80p' "$temp_root/expected-failure.log" >&2
    fail 'overlapping batch AREAS were not rejected explicitly'
  }
assert_submitted_batch_rollback 'overlapping area rejection'

grep -q '^dev-up: runtime-guard' "$root/Makefile" \
  || fail 'Makefile dev-up runtime guard missing'
grep -q '^task-restack:' "$root/Makefile" \
  || fail 'Makefile task-restack target missing'
grep -q '^task-restack-squash:' "$root/Makefile" \
  || fail 'Makefile task-restack-squash target missing'
grep -q '^task-replace-submitted:' "$root/Makefile" \
  || fail 'Makefile task-replace-submitted target missing'
grep -q '^task-integrate-batch:' "$root/Makefile" \
  || fail 'Makefile task-integrate-batch target missing'
grep -q '^release-package: release-guard' "$root/Makefile" \
  || fail 'Makefile release guard missing'
grep -q '^## Parallel work and integration' "$root/AGENTS.md" \
  || fail 'AGENTS parallel-work contract missing'

if grep -Eqi 'remote-db-backup|database-before|mysqldump|mariadb-dump|pg_dump' \
  "$root/scripts/deploy-staging.sh" "$root/scripts/remote-deploy-staging.sh"; then
  fail 'staging deploy must not create database backups'
fi
grep -q 'trap restore_files ERR' "$root/scripts/remote-deploy-staging.sh" \
  || fail 'staging deploy temporary file rollback trap missing'
grep -q 'trap cleanup_work EXIT' "$root/scripts/remote-deploy-staging.sh" \
  || fail 'staging deploy temporary work cleanup missing'
grep -q 'Previous module retained for recovery: $rollback_path' "$root/scripts/remote-deploy-staging.sh" \
  || fail 'staging deploy must retain the previous release for recovery'
if grep -q 'rm -rf -- "$rollback_path"' "$root/scripts/remote-deploy-staging.sh"; then
  fail 'staging deploy must not delete the recovery release automatically'
fi

printf 'coord-harness.test: PASS\n'
