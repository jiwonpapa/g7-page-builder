#!/usr/bin/env bash
set -euo pipefail

readonly PROGRAM="coord-harness"
readonly SCOPED_MAX_PATHS=24

fail() {
  printf '%s: %s\n' "$PROGRAM" "$*" >&2
  exit 1
}

note() {
  printf '%s: %s\n' "$PROGRAM" "$*"
}

usage() {
  cat <<'EOF'
Usage:
  coord-harness.sh claim --task ID [--paths CSV] [--areas CSV] --profile PROFILE [--base-ref REF]
  coord-harness.sh status [--history]
  coord-harness.sh check --task ID
  coord-harness.sh submit --task ID [--message MESSAGE]
  coord-harness.sh resubmit --task ID [--message MESSAGE]
  coord-harness.sh restack --task ID --new-base-ref REF
  coord-harness.sh restack-squash --task ID --new-base-ref REF
  coord-harness.sh replace-submitted --task NEW_ID --supersedes OLD_ID [--base-ref REF]
  coord-harness.sh replace-submitted-expanded --task NEW_ID --supersedes OLD_ID --paths CSV [--base-ref REF]
  coord-harness.sh integrate --task ID --integration-task ID
  coord-harness.sh integrate-scoped --task ID --integration-task ID
  coord-harness.sh integrate-batch --tasks ID1,ID2[,IDN...] --integration-task ID
  coord-harness.sh verify --task ID [--full]
  coord-harness.sh finish --task ID
  coord-harness.sh release --task ID
  coord-harness.sh runtime-guard --task ID
  coord-harness.sh release-guard --task ID

Profiles: scoped, frontend, php, mixed, g7, docs, full
Scoped profile: PATHS must contain 1-24 leaf files; directory claims are rejected.
Exclusive areas: integration, runtime, migration, shared-contract, version
EOF
}

[[ $# -gt 0 ]] || {
  usage
  exit 2
}

command_name="$1"
shift

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail 'Git worktree 안에서 실행해야 합니다.'

repo_root="$(git rev-parse --show-toplevel)"
repo_root="$(cd "$repo_root" && pwd -P)"
common_git_dir="$(git rev-parse --git-common-dir)"
if [[ "$common_git_dir" != /* ]]; then
  common_git_dir="$(cd "$repo_root/$common_git_dir" && pwd -P)"
else
  common_git_dir="$(cd "$common_git_dir" && pwd -P)"
fi

main_worktree="$(git worktree list --porcelain | sed -n '1s/^worktree //p')"
[[ -n "$main_worktree" ]] || fail '기본 Git worktree를 찾지 못했습니다.'
main_worktree="$(cd "$main_worktree" && pwd -P)"

state_root="${G7PB_COORD_STATE_DIR:-$common_git_dir/g7pb-coordination-v1}"
tasks_dir="$state_root/tasks"
history_dir="$state_root/history"
mutex_dir="$state_root/mutex"
mutex_held=0
task_locks_dir="$state_root/task-locks"
task_lock_records=()
integration_temp_files=()
integration_merge_active=0
integration_start_sha=''
integration_finalize_active=0
integration_finalize_sha=''
integration_finalize_task_ids=()
integration_finalize_expected_submitted=()
integration_finalize_expected_meta_hashes=()
integration_finalize_expected_worktrees=()
integration_finalize_expected_branches=()
integration_finalize_expected_heads=()
integration_finalize_meta_files=()
integration_finalize_backups=()
integration_finalize_history_files=()
integration_finalize_stages=()
restack_rollback_active=0
restack_rollback_sha=''
restack_meta_file=''
restack_committed_base_sha=''
restack_committed_sha=''
replace_rollback_active=0
replace_old_meta=''
replace_old_backup=''
replace_history_meta=''
replace_history_stage=''
replace_new_meta=''
replace_new_stage=''
replace_expected_old_task=''
replace_expected_new_task=''

integration_finalize_is_committed() {
  local count="${#integration_finalize_task_ids[@]}"
  local index
  [[ "$count" -gt 0 ]] || return 1
  for ((index=0; index<count; index++)); do
    [[ ! -e "${integration_finalize_meta_files[$index]}" \
      && -f "${integration_finalize_history_files[$index]}" \
      && "$(field "${integration_finalize_history_files[$index]}" task)" \
        == "${integration_finalize_task_ids[$index]}" \
      && "$(field "${integration_finalize_history_files[$index]}" status)" == integrated \
      && "$(field "${integration_finalize_history_files[$index]}" submitted_sha)" \
        == "${integration_finalize_expected_submitted[$index]}" \
      && "$(field "${integration_finalize_history_files[$index]}" integration_sha)" \
        == "$integration_finalize_sha" ]] || return 1
  done
}

rollback_integration_finalize() {
  [[ "$integration_finalize_active" == 1 ]] || return 0
  local count="${#integration_finalize_task_ids[@]}"
  local index
  if integration_finalize_is_committed; then
    for ((index=0; index<count; index++)); do
      rm -f -- "${integration_finalize_backups[$index]}" \
        "${integration_finalize_stages[$index]}" \
        "${integration_finalize_stages[$index]}.tmp.$$"
    done
    integration_finalize_active=0
    integration_merge_active=0
    return 0
  fi

  for ((index=0; index<count; index++)); do
    rm -f -- "${integration_finalize_history_files[$index]}" \
      "${integration_finalize_stages[$index]}" \
      "${integration_finalize_stages[$index]}.tmp.$$"
  done
  for ((index=count - 1; index>=0; index--)); do
    if [[ -f "${integration_finalize_backups[$index]}" ]]; then
      if ! mv "${integration_finalize_backups[$index]}" \
        "${integration_finalize_meta_files[$index]}"; then
        printf '%s: integration metadata rollback failed; expected metadata=%s\n' \
          "$PROGRAM" "${integration_finalize_meta_files[$index]}" >&2
      fi
    fi
  done
  integration_finalize_active=0
}

rollback_integration_merge() {
  [[ "$integration_merge_active" == 1 && -n "$integration_start_sha" ]] || return 0
  git merge --abort >/dev/null 2>&1 || true
  if ! git reset --hard "$integration_start_sha" >/dev/null 2>&1; then
    printf '%s: integration rollback failed; expected HEAD=%s\n' \
      "$PROGRAM" "$integration_start_sha" >&2
  fi
  integration_merge_active=0
}

rollback_replace_submitted() {
  [[ "$replace_rollback_active" == 1 ]] || return 0

  if [[ -n "$replace_new_meta" && -f "$replace_new_meta" \
    && -n "$replace_history_meta" && -f "$replace_history_meta" \
    && ! -e "$replace_old_meta" \
    && "$(field "$replace_new_meta" task)" == "$replace_expected_new_task" \
    && "$(field "$replace_new_meta" status)" == active \
    && "$(field "$replace_history_meta" task)" == "$replace_expected_old_task" \
    && "$(field "$replace_history_meta" status)" == superseded \
    && "$(field "$replace_history_meta" superseded_by)" == "$replace_expected_new_task" ]]; then
    rm -f -- "$replace_old_backup" "$replace_new_stage" "$replace_new_stage.tmp.$$" \
      "$replace_history_stage" "$replace_history_stage.tmp.$$"
    replace_rollback_active=0
    return 0
  fi

  [[ -z "$replace_new_meta" ]] || rm -f -- "$replace_new_meta"
  [[ -z "$replace_history_meta" ]] || rm -f -- "$replace_history_meta"
  [[ -z "$replace_new_stage" ]] || rm -f -- "$replace_new_stage" "$replace_new_stage.tmp.$$"
  [[ -z "$replace_history_stage" ]] \
    || rm -f -- "$replace_history_stage" "$replace_history_stage.tmp.$$"
  if [[ -n "$replace_old_backup" && -f "$replace_old_backup" ]]; then
    if ! mv "$replace_old_backup" "$replace_old_meta"; then
      printf '%s: submitted-task replacement rollback failed; expected metadata=%s\n' \
        "$PROGRAM" "$replace_old_meta" >&2
    fi
  fi
  replace_rollback_active=0
}

rollback_restack() {
  [[ "$restack_rollback_active" == 1 && -n "$restack_rollback_sha" ]] || return 0
  if [[ -n "$restack_meta_file" && -f "$restack_meta_file" \
    && -n "$restack_committed_base_sha" && -n "$restack_committed_sha" \
    && "$(field "$restack_meta_file" base_sha)" == "$restack_committed_base_sha" \
    && "$(field "$restack_meta_file" submitted_sha)" == "$restack_committed_sha" ]]; then
    restack_rollback_active=0
    return 0
  fi
  git rebase --abort >/dev/null 2>&1 || true
  if ! git reset --hard "$restack_rollback_sha" >/dev/null 2>&1; then
    printf '%s: restack rollback failed; expected HEAD=%s\n' \
      "$PROGRAM" "$restack_rollback_sha" >&2
  fi
  restack_rollback_active=0
}

cleanup_mutex() {
  if [[ "$mutex_held" == 1 ]]; then
    rmdir "$mutex_dir" 2>/dev/null || true
    mutex_held=0
  fi
}

cleanup_integration_temp_files() {
  local temp_file
  if (( ${#integration_temp_files[@]} > 0 )); then
    for temp_file in "${integration_temp_files[@]}"; do
      [[ -n "$temp_file" ]] && rm -f -- "$temp_file"
    done
  fi
  integration_temp_files=()
}

cleanup() {
  rollback_integration_finalize
  rollback_integration_merge
  rollback_restack
  rollback_replace_submitted
  cleanup_mutex
  release_task_lock
  cleanup_integration_temp_files
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ensure_state() {
  mkdir -p "$tasks_dir" "$history_dir"
}

acquire_mutex() {
  ensure_state
  local attempt=0
  while (( attempt < 100 )); do
    if mkdir "$mutex_dir" 2>/dev/null; then
      mutex_held=1
      return
    fi
    attempt=$((attempt + 1))
    sleep 0.05
  done
  fail 'coordination state 잠금을 5초 안에 얻지 못했습니다.'
}

release_mutex() {
  cleanup_mutex
}

acquire_task_lock() {
  local task="$1"
  ensure_state
  mkdir -p "$task_locks_dir"
  local lock_path="$task_locks_dir/$task.lock"
  local process_start
  process_start="$(ps -p "$$" -o lstart= | tr -d '[:space:]')"
  [[ -n "$process_start" ]] || fail '현재 process 시작 시각을 확인하지 못했습니다.'
  local lock_owner
  lock_owner="$(hostname)|$$|$process_start"
  local attempt=0
  local max_attempts=100
  local existing_owner
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 ]]; then
    max_attempts=2
  fi
  while (( attempt < max_attempts )); do
    local lock_record="$lock_path"$'\t'"$lock_owner"
    local lock_index="${#task_lock_records[@]}"
    task_lock_records[$lock_index]="$lock_record"
    if ln -s "$lock_owner" "$lock_path" 2>/dev/null; then
      if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
        && "${G7PB_COORD_TEST_TERMINATE_AFTER_TASK_LOCK_COUNT:-}" \
          == "${#task_lock_records[@]}" ]]; then
        kill -TERM "$$"
      fi
      return
    fi
    unset 'task_lock_records[$lock_index]'

    existing_owner="$(readlink "$lock_path" 2>/dev/null || true)"
    if [[ -n "$existing_owner" ]] && ! task_lock_owner_is_live "$existing_owner"; then
      acquire_mutex
      if [[ "$(readlink "$lock_path" 2>/dev/null || true)" == "$existing_owner" ]] \
        && ! task_lock_owner_is_live "$existing_owner"; then
        rm -f "$lock_path"
      fi
      release_mutex
      continue
    fi
    attempt=$((attempt + 1))
    sleep 0.05
  done
  fail "task 작업 잠금을 얻지 못했습니다: $task owner=${existing_owner:-unknown}"
}

release_task_lock() {
  local index
  local lock_record
  local lock_path
  local lock_owner
  for ((index=${#task_lock_records[@]} - 1; index >= 0; index--)); do
    lock_record="${task_lock_records[$index]-}"
    [[ -n "$lock_record" ]] || continue
    lock_path="${lock_record%%$'\t'*}"
    lock_owner="${lock_record#*$'\t'}"
    if [[ "$(readlink "$lock_path" 2>/dev/null || true)" == "$lock_owner" ]]; then
      rm -f "$lock_path"
    fi
  done
  task_lock_records=()
}

task_lock_owner_is_live() {
  local owner="$1"
  local owner_host
  local owner_pid
  local owner_start
  local extra
  local current_start
  IFS='|' read -r owner_host owner_pid owner_start extra <<< "$owner"
  [[ -n "$owner_host" && "$owner_pid" =~ ^[0-9]+$ && -n "$owner_start" && -z "$extra" ]] \
    || return 1
  [[ "$owner_host" == "$(hostname)" ]] || return 0
  kill -0 "$owner_pid" 2>/dev/null || return 1
  current_start="$(ps -p "$owner_pid" -o lstart= 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$current_start" && "$current_start" == "$owner_start" ]]
}

validate_task_id() {
  local value="$1"
  [[ "$value" =~ ^[a-z0-9][a-z0-9._-]{1,62}$ ]] \
    || fail "TASK는 2~63자의 소문자·숫자·점·밑줄·하이픈만 허용합니다: $value"
}

validate_profile() {
  case "$1" in
    scoped|frontend|php|mixed|g7|docs|full) ;;
    harness)
      [[ "${G7PB_COORD_TESTING:-0}" == 1 ]] || fail 'harness profile은 하네스 자체 시험에서만 허용합니다.'
      ;;
    *) fail "지원하지 않는 PROFILE입니다: $1" ;;
  esac
}

csv_has() {
  local csv="$1"
  local wanted="$2"
  local item
  local old_ifs="$IFS"
  IFS=','
  for item in $csv; do
    if [[ "$item" == "$wanted" ]]; then
      IFS="$old_ifs"
      return 0
    fi
  done
  IFS="$old_ifs"
  return 1
}

csv_contains_all_exact() {
  local required_csv="$1"
  local candidate_csv="$2"
  local item
  local old_ifs="$IFS"
  [[ -n "$required_csv" ]] || return 0
  IFS=','
  for item in $required_csv; do
    if ! csv_has "$candidate_csv" "$item"; then
      IFS="$old_ifs"
      return 1
    fi
  done
  IFS="$old_ifs"
  return 0
}

csv_has_addition() {
  local candidate_csv="$1"
  local inherited_csv="$2"
  local item
  local old_ifs="$IFS"
  [[ -n "$candidate_csv" ]] || return 1
  IFS=','
  for item in $candidate_csv; do
    if ! csv_has "$inherited_csv" "$item"; then
      IFS="$old_ifs"
      return 0
    fi
  done
  IFS="$old_ifs"
  return 1
}

csv_has_duplicate() {
  local csv="$1"
  local seen=''
  local item
  local old_ifs="$IFS"
  [[ -n "$csv" ]] || return 1
  IFS=','
  for item in $csv; do
    if csv_has "$seen" "$item"; then
      IFS="$old_ifs"
      return 0
    fi
    seen="${seen:+$seen,}$item"
  done
  IFS="$old_ifs"
  return 1
}

validate_areas() {
  local csv="$1"
  local item
  local old_ifs="$IFS"
  [[ -n "$csv" ]] || return 0
  IFS=','
  for item in $csv; do
    case "$item" in
      integration|runtime|migration|shared-contract|version) ;;
      *)
        IFS="$old_ifs"
        fail "지원하지 않는 독점 AREA입니다: $item"
        ;;
    esac
  done
  IFS="$old_ifs"
}

validate_paths() {
  local csv="$1"
  local item
  local old_ifs="$IFS"
  [[ -n "$csv" ]] || return 0
  IFS=','
  for item in $csv; do
    if [[ -z "$item" || "$item" == /* || "$item" == '.' || "$item" == '..' \
      || "$item" == ../* || "$item" == */../* || "$item" == */.. \
      || "$item" == *'*'* || "$item" == *'?'* || "$item" == *'['* \
      || "$item" == *','* || "$item" =~ [[:space:]] ]]; then
      IFS="$old_ifs"
      fail "PATHS에는 공백·glob·상위경로가 없는 저장소 상대 prefix만 허용합니다: $item"
    fi
  done
  IFS="$old_ifs"
}

validate_scoped_leaf_paths() {
  local profile="$1"
  local csv="$2"
  local worktree="$3"
  local item
  local count=0
  local old_ifs="$IFS"
  [[ "$profile" == scoped ]] || return 0
  [[ -n "$csv" ]] || fail 'scoped PROFILE은 정확한 파일 PATHS가 필요합니다.'
  IFS=','
  for item in $csv; do
    count=$((count + 1))
    if [[ -d "$worktree/$item" ]]; then
      IFS="$old_ifs"
      fail "scoped PROFILE은 디렉터리 PATHS를 허용하지 않습니다: $item"
    fi
  done
  IFS="$old_ifs"
  [[ "$count" -le "$SCOPED_MAX_PATHS" ]] \
    || fail "scoped PROFILE의 PATHS 상한은 ${SCOPED_MAX_PATHS}개입니다: actual=$count"
}

field() {
  local file="$1"
  local key="$2"
  awk -F '\t' -v wanted="$key" '$1 == wanted { print substr($0, index($0, "\t") + 1); exit }' "$file"
}

task_file() {
  printf '%s/%s.meta' "$tasks_dir" "$1"
}

load_task() {
  local task="$1"
  local file
  file="$(task_file "$task")"
  [[ -f "$file" ]] || fail "활성 task를 찾지 못했습니다: $task"

  META_FILE="$file"
  META_TASK="$(field "$file" task)"
  META_STATUS="$(field "$file" status)"
  META_WORKTREE="$(field "$file" worktree)"
  META_BRANCH="$(field "$file" branch)"
  META_BASE_SHA="$(field "$file" base_sha)"
  META_PATHS="$(field "$file" paths)"
  META_AREAS="$(field "$file" areas)"
  META_PROFILE="$(field "$file" profile)"
  META_CREATED_AT="$(field "$file" created_at)"
  META_SUBMITTED_SHA="$(field "$file" submitted_sha)"
  META_SUBMITTED_AT="$(field "$file" submitted_at)"
  META_INTEGRATION_SHA="$(field "$file" integration_sha)"
  META_INTEGRATED_AT="$(field "$file" integrated_at)"
  META_VERIFIED_SHA="$(field "$file" verified_sha)"
  META_VERIFIED_AT="$(field "$file" verified_at)"
  META_VERIFIED_MODE="$(field "$file" verified_mode)"
  META_VERIFIED_BASE_SHA="$(field "$file" verified_base_sha)"
  META_PREVIOUS_BASE_SHA="$(field "$file" previous_base_sha)"
  META_PREVIOUS_SUBMITTED_SHA="$(field "$file" previous_submitted_sha)"
  META_RESTACKED_AT="$(field "$file" restacked_at)"
  META_RESTACK_HISTORY="$(field "$file" restack_history)"
  META_SUPERSEDED_BY="$(field "$file" superseded_by)"
  META_SUPERSEDED_AT="$(field "$file" superseded_at)"
}

write_task() {
  local target="$1"
  local temp="$target.tmp.$$"
  {
    printf 'version\t1\n'
    printf 'task\t%s\n' "$META_TASK"
    printf 'status\t%s\n' "$META_STATUS"
    printf 'worktree\t%s\n' "$META_WORKTREE"
    printf 'branch\t%s\n' "$META_BRANCH"
    printf 'base_sha\t%s\n' "$META_BASE_SHA"
    printf 'paths\t%s\n' "$META_PATHS"
    printf 'areas\t%s\n' "$META_AREAS"
    printf 'profile\t%s\n' "$META_PROFILE"
    printf 'created_at\t%s\n' "$META_CREATED_AT"
    printf 'submitted_sha\t%s\n' "$META_SUBMITTED_SHA"
    printf 'submitted_at\t%s\n' "$META_SUBMITTED_AT"
    printf 'integration_sha\t%s\n' "$META_INTEGRATION_SHA"
    printf 'integrated_at\t%s\n' "$META_INTEGRATED_AT"
    printf 'verified_sha\t%s\n' "$META_VERIFIED_SHA"
    printf 'verified_at\t%s\n' "$META_VERIFIED_AT"
    printf 'verified_mode\t%s\n' "$META_VERIFIED_MODE"
    printf 'verified_base_sha\t%s\n' "$META_VERIFIED_BASE_SHA"
    printf 'previous_base_sha\t%s\n' "$META_PREVIOUS_BASE_SHA"
    printf 'previous_submitted_sha\t%s\n' "$META_PREVIOUS_SUBMITTED_SHA"
    printf 'restacked_at\t%s\n' "$META_RESTACKED_AT"
    printf 'restack_history\t%s\n' "$META_RESTACK_HISTORY"
    printf 'superseded_by\t%s\n' "$META_SUPERSEDED_BY"
    printf 'superseded_at\t%s\n' "$META_SUPERSEDED_AT"
  } > "$temp"
  mv "$temp" "$target"
}

path_prefix_overlaps() {
  local left="$1"
  local right="$2"
  [[ "$left" == "$right" || "$left" == "$right/"* || "$right" == "$left/"* ]]
}

csv_paths_overlap() {
  local left_csv="$1"
  local right_csv="$2"
  local left
  local right
  local old_ifs="$IFS"
  [[ -n "$left_csv" && -n "$right_csv" ]] || return 1
  IFS=','
  for left in $left_csv; do
    for right in $right_csv; do
      if path_prefix_overlaps "$left" "$right"; then
        IFS="$old_ifs"
        return 0
      fi
    done
  done
  IFS="$old_ifs"
  return 1
}

csv_areas_overlap() {
  local left_csv="$1"
  local right_csv="$2"
  local left
  local right
  local old_ifs="$IFS"
  [[ -n "$left_csv" && -n "$right_csv" ]] || return 1
  IFS=','
  for left in $left_csv; do
    for right in $right_csv; do
      if [[ "$left" == "$right" ]]; then
        IFS="$old_ifs"
        return 0
      fi
    done
  done
  IFS="$old_ifs"
  return 1
}

path_is_owned() {
  local path="$1"
  local allowed_csv="$2"
  local allowed
  local old_ifs="$IFS"
  [[ -n "$allowed_csv" ]] || return 1
  IFS=','
  for allowed in $allowed_csv; do
    if [[ "$path" == "$allowed" || "$path" == "$allowed/"* ]]; then
      IFS="$old_ifs"
      return 0
    fi
  done
  IFS="$old_ifs"
  return 1
}

assert_task_owner() {
  [[ "$META_WORKTREE" == "$repo_root" ]] \
    || fail "task 소유 worktree가 아닙니다. owner=$META_WORKTREE current=$repo_root"
  local current_branch
  current_branch="$(git symbolic-ref --quiet --short HEAD || true)"
  [[ "$current_branch" == "$META_BRANCH" ]] \
    || fail "task branch가 바뀌었습니다. expected=$META_BRANCH current=${current_branch:-detached}"
}

collect_and_check_changed_paths_at() {
  local worktree="$1"
  local base_sha="$2"
  local allowed_csv="$3"
  validate_scoped_leaf_paths "${META_PROFILE:-}" "$allowed_csv" "$worktree"
  local path
  local failed=0
  while IFS= read -r -d '' path; do
    if ! path_is_owned "$path" "$allowed_csv"; then
      printf 'OUT_OF_SCOPE\t%s\n' "$path" >&2
      failed=1
    fi
  done < <(
    git -C "$worktree" diff --name-only -z "$base_sha" --
    git -C "$worktree" ls-files --others --exclude-standard -z
  )
  [[ "$failed" == 0 ]] || fail 'claim한 PATHS 밖의 변경이 있어 제출을 중단했습니다.'
}

collect_and_check_changed_paths() {
  local base_sha="$1"
  local allowed_csv="$2"
  collect_and_check_changed_paths_at "$repo_root" "$base_sha" "$allowed_csv"
}

require_node_24() {
  command -v node >/dev/null 2>&1 || fail 'Node 24가 필요합니다.'
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" == 24 ]] || fail "Node 24가 필요합니다. current=$(node --version)"
  command -v npm >/dev/null 2>&1 || fail 'npm이 필요합니다.'
}

require_php_85() {
  command -v php >/dev/null 2>&1 || fail 'PHP 8.5가 필요합니다.'
  php -r 'exit(PHP_MAJOR_VERSION === 8 && PHP_MINOR_VERSION === 5 ? 0 : 1);' \
    || fail "PHP 8.5가 필요합니다. current=$(php -r 'echo PHP_VERSION;')"
  command -v composer >/dev/null 2>&1 || fail 'Composer가 필요합니다.'
}

run_submission_profile() {
  local profile="$1"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_FAIL_SUBMISSION_PROFILE:-0}" == 1 ]]; then
    fail 'TEST_MODE submission profile failure'
  fi
  case "$profile" in
    scoped)
      bash scripts/quality-scoped.sh submission "$META_BASE_SHA"
      ;;
    frontend)
      require_node_24
      npm run check:editor-acceptance
      npm run typecheck
      npm run test:unit
      ;;
    php)
      require_php_85
      composer check
      ;;
    mixed|full)
      run_submission_profile php
      run_submission_profile frontend
      ;;
    g7)
      run_submission_profile php
      ;;
    docs)
      require_node_24
      npm run check:version
      bash scripts/check-boundaries.sh
      bash tests/Harness/coord-harness.test.sh
      ;;
    harness)
      [[ "${G7PB_COORD_TESTING:-0}" == 1 ]] || fail 'harness profile은 시험 전용입니다.'
      ;;
    *) fail "지원하지 않는 PROFILE입니다: $profile" ;;
  esac
}

run_scoped_integration_profile() {
  local task_base="$1"
  local submitted_sha="$2"
  local integration_task="$3"
  local task_areas="${4:-}"
  local candidate_tree="$5"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 ]]; then
    if [[ -n "${G7PB_COORD_TEST_SCOPED_INTEGRATION_HOOK:-}" ]]; then
      [[ -x "$G7PB_COORD_TEST_SCOPED_INTEGRATION_HOOK" ]] \
        || fail 'TEST_MODE scoped integration hook is not executable'
      "$G7PB_COORD_TEST_SCOPED_INTEGRATION_HOOK" \
        "$task_base" "$submitted_sha" "$integration_task" "$task_areas" "$candidate_tree"
    fi
    return 0
  fi
  G7PB_SCOPED_RECEIPT_DIR="$state_root/gate-receipts" \
  G7PB_SCOPED_CANDIDATE_TREE="$candidate_tree" \
    bash scripts/quality-scoped.sh integration \
      "$task_base" "$submitted_sha" "$integration_task" "$task_areas"
}

find_latest_verified_ancestor() {
  local head_sha="$1"
  LATEST_VERIFIED_SHA=''
  LATEST_VERIFIED_MODE=''
  local best_distance=''
  local directory
  local file
  local candidate
  local distance
  local mode
  for directory in "$tasks_dir" "$history_dir"; do
    [[ -d "$directory" ]] || continue
    for file in "$directory"/*.meta; do
      [[ -e "$file" ]] || continue
      candidate="$(field "$file" verified_sha)"
      [[ -n "$candidate" ]] || continue
      git cat-file -e "$candidate^{commit}" 2>/dev/null || continue
      git merge-base --is-ancestor "$candidate" "$head_sha" || continue
      distance="$(git rev-list --count "$candidate..$head_sha")"
      if [[ -z "$best_distance" || "$distance" -lt "$best_distance" ]]; then
        mode="$(field "$file" verified_mode)"
        LATEST_VERIFIED_SHA="$candidate"
        LATEST_VERIFIED_MODE="${mode:-full}"
        best_distance="$distance"
      fi
    done
  done
}

is_scoped_verification_path() {
  local path="$1"
  case "$path" in
    *.md|docs/*|tests/Harness/*|Makefile|AGENTS.md|\
    scripts/coord-harness.sh|scripts/quality-scoped.sh|\
    scripts/release-package.sh|scripts/deploy-staging.sh|\
    scripts/staging-doctor.sh|scripts/remote-deploy-staging.sh|scripts/smoke-staging.sh|\
    scripts/check-block-product-quality.mjs|scripts/check-block-quality-evidence.mjs|\
    scripts/check-site-shell-product-quality.mjs|scripts/check-version-policy.mjs)
      return 0
      ;;
    *) return 1 ;;
  esac
}

classify_verification_range() {
  local base_sha="$1"
  local head_sha="$2"
  VERIFICATION_MODE='reuse'
  VERIFICATION_CHANGED_COUNT=0
  VERIFICATION_FULL_PATH=''
  local has_scoped=0
  local has_frontend=0
  local has_php=0
  local has_g7=0
  local has_full=0
  local path
  while IFS= read -r -d '' path; do
    VERIFICATION_CHANGED_COUNT=$((VERIFICATION_CHANGED_COUNT + 1))
    if is_scoped_verification_path "$path"; then
      has_scoped=1
      continue
    fi
    case "$path" in
      resources/js/*|resources/css/*|tests/Unit/*|vite.config.ts|vite.*.config.ts|\
      tsconfig.json|tsconfig.*.json|stylelint.config.*)
        has_frontend=1
        ;;
      src/Domain/*|src/Application/*|src/Contracts/*|tests/UnitPhp/*)
        has_php=1
        ;;
      src/Infrastructure/Gnuboard7/*|src/Providers/*|tests/Integration/*)
        has_g7=1
        ;;
      database/*|module.php|module.json|resources/routes/*|resources/layouts/*|\
      resources/views/*|routes/*|compose.yaml|Dockerfile|docker/*|tests/E2E/*|\
      package.json|package-lock.json|composer.json|composer.lock|schemas/*|config/*)
        has_full=1
        [[ -n "$VERIFICATION_FULL_PATH" ]] || VERIFICATION_FULL_PATH="$path"
        ;;
      *)
        has_full=1
        [[ -n "$VERIFICATION_FULL_PATH" ]] || VERIFICATION_FULL_PATH="$path"
        ;;
    esac
  done < <(git diff --name-only -z "$base_sha" "$head_sha" --)
  if [[ "$VERIFICATION_CHANGED_COUNT" == 0 ]]; then
    VERIFICATION_MODE='reuse'
  elif [[ "$has_full" == 1 || "$has_g7" == 1 && "$has_frontend$has_php" != 00 ]]; then
    VERIFICATION_MODE='full'
    [[ -n "$VERIFICATION_FULL_PATH" ]] || VERIFICATION_FULL_PATH='cross-runtime-profile'
  elif [[ "$has_g7" == 1 ]]; then
    VERIFICATION_MODE='g7'
  elif [[ "$has_frontend$has_php" == 11 ]]; then
    VERIFICATION_MODE='mixed'
  elif [[ "$has_frontend" == 1 ]]; then
    VERIFICATION_MODE='frontend'
  elif [[ "$has_php" == 1 ]]; then
    VERIFICATION_MODE='php'
  elif [[ "$has_scoped" == 1 ]]; then
    VERIFICATION_MODE='scoped'
  fi
}

run_scoped_verification_profile() {
  local base_sha="$1"
  local head_sha="$2"
  local integration_task="$3"
  local task_areas="${4:-}"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 ]]; then
    if [[ -n "${G7PB_COORD_TEST_SCOPED_VERIFY_HOOK:-}" ]]; then
      [[ -x "$G7PB_COORD_TEST_SCOPED_VERIFY_HOOK" ]] \
        || fail 'TEST_MODE scoped verification hook is not executable'
      "$G7PB_COORD_TEST_SCOPED_VERIFY_HOOK" \
        "$base_sha" "$head_sha" "$integration_task" "$task_areas"
    fi
    return 0
  fi
  G7PB_SCOPED_RECEIPT_DIR="$state_root/gate-receipts" \
  G7PB_SCOPED_CANDIDATE_TREE="$(git rev-parse "$head_sha^{tree}")" \
    bash scripts/quality-scoped.sh verification \
      "$base_sha" "$head_sha" "$integration_task" "$task_areas"
}

run_integration_profile() {
  local profile="$1"
  local integration_task="$2"
  local task_areas="${3:-}"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 ]]; then
    if [[ "${G7PB_COORD_TEST_FAIL_INTEGRATION_PROFILE:-0}" == 1 ]]; then
      fail 'TEST_MODE integration profile failure'
    fi
    if [[ -n "${G7PB_COORD_TEST_INTEGRATION_PROFILE_HOOK:-}" ]]; then
      [[ -x "$G7PB_COORD_TEST_INTEGRATION_PROFILE_HOOK" ]] \
        || fail 'TEST_MODE integration profile hook is not executable'
      "$G7PB_COORD_TEST_INTEGRATION_PROFILE_HOOK" "$profile" "$integration_task" "$task_areas" \
        || fail 'TEST_MODE integration profile hook failure'
    fi
    if [[ "${G7PB_COORD_TEST_TERMINATE_INTEGRATION_PROFILE:-0}" == 1 ]]; then
      kill -TERM "$$"
    fi
    return 0
  fi
  local needs_runtime_sync=0
  if csv_has "$task_areas" migration || csv_has "$task_areas" version; then
    needs_runtime_sync=1
  fi
  case "$profile" in
    frontend) make quality-frontend TASK="$integration_task" ;;
    php) make quality-php TASK="$integration_task" ;;
    mixed) make dev-check TASK="$integration_task" ;;
    g7)
      [[ "$needs_runtime_sync" == 0 ]] || make dev-sync TASK="$integration_task"
      make quality-g7 TASK="$integration_task"
      ;;
    docs) make quality-coordination TASK="$integration_task" && make quality-frontend TASK="$integration_task" ;;
    full)
      [[ "$needs_runtime_sync" == 0 ]] || make dev-sync TASK="$integration_task"
      make quality-gate TASK="$integration_task"
      ;;
    harness)
      [[ "${G7PB_COORD_TESTING:-0}" == 1 ]] || fail 'harness profile은 시험 전용입니다.'
      ;;
    *) fail "지원하지 않는 PROFILE입니다: $profile" ;;
  esac
}

select_batch_integration_profile() {
  local profile
  local has_full=0
  local has_mixed=0
  local has_g7=0
  local has_php=0
  local has_frontend=0
  local has_docs=0
  local has_harness=0
  for profile in "$@"; do
    case "$profile" in
      full) has_full=1 ;;
      mixed) has_mixed=1 ;;
      g7) has_g7=1 ;;
      php) has_php=1 ;;
      frontend) has_frontend=1 ;;
      docs) has_docs=1 ;;
      harness) has_harness=1 ;;
      *) fail "지원하지 않는 batch PROFILE입니다: $profile" ;;
    esac
  done

  if [[ "$has_harness" == 1 ]]; then
    [[ "$has_full$has_mixed$has_g7$has_php$has_frontend$has_docs" == 000000 ]] \
      || fail 'harness PROFILE은 실제 integration PROFILE과 batch로 섞을 수 없습니다.'
    printf 'harness\n'
  elif [[ "$has_full" == 1 ]]; then
    printf 'full\n'
  elif [[ "$has_mixed" == 1 ]]; then
    if [[ "$has_g7" == 1 ]]; then printf 'full\n'; else printf 'mixed\n'; fi
  elif [[ "$has_g7" == 1 ]]; then
    if [[ "$has_php$has_frontend$has_docs" == 000 ]]; then printf 'g7\n'; else printf 'full\n'; fi
  elif [[ "$has_php$has_frontend$has_docs" == 100 ]]; then
    printf 'php\n'
  elif [[ "$has_php$has_frontend$has_docs" == 010 ]]; then
    printf 'frontend\n'
  elif [[ "$has_php$has_frontend$has_docs" == 001 ]]; then
    printf 'docs\n'
  else
    printf 'mixed\n'
  fi
}

archive_loaded_task() {
  local final_status="$1"
  local stamp
  stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  META_STATUS="$final_status"
  local archived="$history_dir/$META_TASK.$stamp.meta"
  write_task "$archived"
  rm -f "$META_FILE"
}

parse_common_args() {
  TASK_ID=''
  TASKS_CSV=''
  PATHS_CSV=''
  AREAS_CSV=''
  PROFILE=''
  BASE_REF='HEAD'
  MESSAGE=''
  INTEGRATION_TASK=''
  NEW_BASE_REF=''
  SUPERSEDES_TASK=''
  SHOW_HISTORY=0
  FORCE_FULL=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --task) [[ $# -ge 2 ]] || fail '--task 값이 필요합니다.'; TASK_ID="$2"; shift 2 ;;
      --tasks) [[ $# -ge 2 ]] || fail '--tasks 값이 필요합니다.'; TASKS_CSV="$2"; shift 2 ;;
      --paths) [[ $# -ge 2 ]] || fail '--paths 값이 필요합니다.'; PATHS_CSV="$2"; shift 2 ;;
      --areas) [[ $# -ge 2 ]] || fail '--areas 값이 필요합니다.'; AREAS_CSV="$2"; shift 2 ;;
      --profile) [[ $# -ge 2 ]] || fail '--profile 값이 필요합니다.'; PROFILE="$2"; shift 2 ;;
      --base-ref) [[ $# -ge 2 ]] || fail '--base-ref 값이 필요합니다.'; BASE_REF="$2"; shift 2 ;;
      --message) [[ $# -ge 2 ]] || fail '--message 값이 필요합니다.'; MESSAGE="$2"; shift 2 ;;
      --integration-task) [[ $# -ge 2 ]] || fail '--integration-task 값이 필요합니다.'; INTEGRATION_TASK="$2"; shift 2 ;;
      --new-base-ref) [[ $# -ge 2 ]] || fail '--new-base-ref 값이 필요합니다.'; NEW_BASE_REF="$2"; shift 2 ;;
      --supersedes) [[ $# -ge 2 ]] || fail '--supersedes 값이 필요합니다.'; SUPERSEDES_TASK="$2"; shift 2 ;;
      --history) SHOW_HISTORY=1; shift ;;
      --full) FORCE_FULL=1; shift ;;
      *) fail "알 수 없는 인자입니다: $1" ;;
    esac
  done
}

command_claim() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  [[ -n "$PROFILE" ]] || fail 'PROFILE이 필요합니다.'
  validate_profile "$PROFILE"
  validate_paths "$PATHS_CSV"
  validate_areas "$AREAS_CSV"
  validate_scoped_leaf_paths "$PROFILE" "$PATHS_CSV" "$repo_root"
  [[ -n "$PATHS_CSV" || -n "$AREAS_CSV" ]] || fail 'PATHS 또는 독점 AREAS 중 하나는 필요합니다.'
  [[ -z "$(git status --porcelain)" ]] || fail '깨끗한 worktree에서만 task를 시작할 수 있습니다.'

  local base_sha
  base_sha="$(git rev-parse "$BASE_REF^{commit}")"
  [[ "$(git rev-parse HEAD)" == "$base_sha" ]] \
    || fail '현재 HEAD와 BASE_REF가 다릅니다. 정확한 기준 checkout에서 다시 시작하십시오.'

  acquire_mutex
  [[ ! -e "$(task_file "$TASK_ID")" ]] || fail "이미 활성 task가 있습니다: $TASK_ID"

  local existing
  local existing_paths
  local existing_areas
  for existing in "$tasks_dir"/*.meta; do
    [[ -e "$existing" ]] || continue
    existing_paths="$(field "$existing" paths)"
    existing_areas="$(field "$existing" areas)"
    if csv_paths_overlap "$PATHS_CSV" "$existing_paths"; then
      fail "PATHS가 task $(field "$existing" task)와 겹칩니다: $existing_paths"
    fi
    if csv_areas_overlap "$AREAS_CSV" "$existing_areas"; then
      fail "AREAS가 task $(field "$existing" task)와 겹칩니다: $existing_areas"
    fi
  done

  local branch
  branch="$(git symbolic-ref --quiet --short HEAD || true)"
  if [[ -z "$branch" ]]; then
    branch="codex/$TASK_ID"
    git show-ref --verify --quiet "refs/heads/$branch" \
      && fail "task branch가 이미 존재합니다: $branch"
    git switch -c "$branch"
  fi

  META_TASK="$TASK_ID"
  META_STATUS='active'
  META_WORKTREE="$repo_root"
  META_BRANCH="$branch"
  META_BASE_SHA="$base_sha"
  META_PATHS="$PATHS_CSV"
  META_AREAS="$AREAS_CSV"
  META_PROFILE="$PROFILE"
  META_CREATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  META_SUBMITTED_SHA=''
  META_SUBMITTED_AT=''
  META_INTEGRATION_SHA=''
  META_INTEGRATED_AT=''
  META_VERIFIED_SHA=''
  META_VERIFIED_AT=''
  META_VERIFIED_MODE=''
  META_VERIFIED_BASE_SHA=''
  META_PREVIOUS_BASE_SHA=''
  META_PREVIOUS_SUBMITTED_SHA=''
  META_RESTACKED_AT=''
  META_RESTACK_HISTORY=''
  META_SUPERSEDED_BY=''
  META_SUPERSEDED_AT=''
  write_task "$(task_file "$TASK_ID")"
  release_mutex
  note "CLAIMED task=$TASK_ID branch=$branch base=$base_sha paths=${PATHS_CSV:-none} areas=${AREAS_CSV:-none} profile=$PROFILE"
}

print_status_files() {
  local directory="$1"
  local label="$2"
  local file
  for file in "$directory"/*.meta; do
    [[ -e "$file" ]] || continue
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$label" \
      "$(field "$file" task)" \
      "$(field "$file" status)" \
      "$(field "$file" profile)" \
      "$(field "$file" branch)" \
      "$(field "$file" areas)" \
      "$(field "$file" paths)" \
      "$(field "$file" worktree)"
  done
}

command_status() {
  parse_common_args "$@"
  printf 'KIND\tTASK\tSTATUS\tPROFILE\tBRANCH\tAREAS\tPATHS\tWORKTREE\n'
  if [[ -d "$tasks_dir" ]]; then
    print_status_files "$tasks_dir" ACTIVE
  fi
  if [[ "$SHOW_HISTORY" == 1 && -d "$history_dir" ]]; then
    print_status_files "$history_dir" HISTORY
  fi
}

command_check() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail "active task만 편집 범위를 검사할 수 있습니다: $META_STATUS"
  collect_and_check_changed_paths "$META_BASE_SHA" "$META_PATHS"
  note "SCOPE_OK task=$TASK_ID"
}

command_submit() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail "active task만 제출할 수 있습니다: $META_STATUS"
  collect_and_check_changed_paths "$META_BASE_SHA" "$META_PATHS"
  run_submission_profile "$META_PROFILE"
  collect_and_check_changed_paths "$META_BASE_SHA" "$META_PATHS"

  if [[ -n "$(git status --porcelain)" ]]; then
    git add -A -- .
    git commit -m "${MESSAGE:-task($TASK_ID): submit worktree changes}"
  fi
  [[ -z "$(git status --porcelain)" ]] || fail '제출 커밋 뒤 worktree가 깨끗하지 않습니다.'

  local submitted_sha
  submitted_sha="$(git rev-parse HEAD)"
  [[ "$submitted_sha" != "$META_BASE_SHA" ]] || fail '기준 SHA 이후 제출할 변경이 없습니다.'
  git merge-base --is-ancestor "$META_BASE_SHA" "$submitted_sha" \
    || fail '제출 SHA가 task 기준 SHA의 후손이 아닙니다.'

  acquire_mutex
  load_task "$TASK_ID"
  [[ "$META_STATUS" == active ]] || fail 'task 상태가 제출 도중 변경되었습니다.'
  META_STATUS='submitted'
  META_SUBMITTED_SHA="$submitted_sha"
  META_SUBMITTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  write_task "$META_FILE"
  release_mutex
  note "SUBMITTED task=$TASK_ID sha=$submitted_sha profile=$META_PROFILE"
}

command_resubmit() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  acquire_task_lock "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == submitted ]] || fail "submitted task만 재제출할 수 있습니다: $META_STATUS"

  local previous_sha="$META_SUBMITTED_SHA"
  [[ -n "$previous_sha" ]] || fail '기존 submitted SHA가 없습니다.'
  [[ "$(git rev-parse HEAD)" == "$previous_sha" ]] \
    || fail '재제출 전 task branch HEAD가 기존 submitted SHA와 일치해야 합니다.'

  collect_and_check_changed_paths "$META_BASE_SHA" "$META_PATHS"
  run_submission_profile "$META_PROFILE"
  collect_and_check_changed_paths "$META_BASE_SHA" "$META_PATHS"

  [[ -n "$(git status --porcelain)" ]] || fail '재제출할 변경이 없습니다.'
  git add -A -- .
  git commit -m "${MESSAGE:-task($TASK_ID): revise submitted changes}"
  [[ -z "$(git status --porcelain)" ]] || fail '재제출 커밋 뒤 worktree가 깨끗하지 않습니다.'

  local resubmitted_sha
  resubmitted_sha="$(git rev-parse HEAD)"
  git merge-base --is-ancestor "$previous_sha" "$resubmitted_sha" \
    || fail '재제출 SHA가 기존 submitted SHA의 후손이 아닙니다.'
  git merge-base --is-ancestor "$META_BASE_SHA" "$resubmitted_sha" \
    || fail '재제출 SHA가 task 기준 SHA의 후손이 아닙니다.'

  acquire_mutex
  load_task "$TASK_ID"
  [[ "$META_STATUS" == submitted ]] || fail 'task 상태가 재제출 도중 변경되었습니다.'
  [[ "$META_SUBMITTED_SHA" == "$previous_sha" ]] || fail 'submitted SHA가 재제출 도중 변경되었습니다.'
  META_SUBMITTED_SHA="$resubmitted_sha"
  META_SUBMITTED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  write_task "$META_FILE"
  release_mutex
  release_task_lock
  note "RESUBMITTED task=$TASK_ID previous=$previous_sha sha=$resubmitted_sha profile=$META_PROFILE"
}

command_restack() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  [[ -n "$NEW_BASE_REF" ]] || fail '--new-base-ref가 필요합니다.'
  acquire_task_lock "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == submitted ]] || fail "submitted task만 재적층할 수 있습니다: $META_STATUS"
  [[ -z "$(git status --porcelain)" ]] || fail '깨끗한 submitted worktree만 재적층할 수 있습니다.'

  local previous_base_sha="$META_BASE_SHA"
  local previous_submitted_sha="$META_SUBMITTED_SHA"
  local previous_submitted_at="$META_SUBMITTED_AT"
  [[ -n "$previous_base_sha" && -n "$previous_submitted_sha" ]] \
    || fail '기존 base/submitted SHA가 없습니다.'
  [[ "$(git rev-parse HEAD)" == "$previous_submitted_sha" ]] \
    || fail '재적층 전 task branch HEAD가 기존 submitted SHA와 일치해야 합니다.'
  git merge-base --is-ancestor "$previous_base_sha" "$previous_submitted_sha" \
    || fail '기존 submitted commit의 ancestry가 올바르지 않습니다.'
  collect_and_check_changed_paths "$previous_base_sha" "$META_PATHS"

  local new_base_sha
  new_base_sha="$(git rev-parse --verify "$NEW_BASE_REF^{commit}" 2>/dev/null)" \
    || fail "새 기준 commit을 찾지 못했습니다: $NEW_BASE_REF"
  [[ "$new_base_sha" != "$previous_base_sha" ]] \
    || fail '새 기준 SHA가 기존 기준 SHA와 같습니다.'
  git merge-base --is-ancestor "$previous_base_sha" "$new_base_sha" \
    || fail '새 기준 commit은 기존 base SHA의 후손이어야 합니다.'
  if git merge-base --is-ancestor "$previous_submitted_sha" "$new_base_sha"; then
    fail '새 기준 commit에 기존 submitted SHA가 이미 포함되어 있습니다.'
  fi

  restack_rollback_sha="$previous_submitted_sha"
  restack_rollback_active=1
  restack_meta_file="$META_FILE"
  if ! git rebase --onto "$new_base_sha" "$previous_base_sha"; then
    fail '재적층 충돌이 발생해 task branch를 기존 submitted SHA로 복구했습니다.'
  fi

  local restacked_sha
  restacked_sha="$(git rev-parse HEAD)"
  [[ "$restacked_sha" != "$new_base_sha" ]] \
    || fail '재적층 결과 task delta가 비었습니다.'
  git merge-base --is-ancestor "$new_base_sha" "$restacked_sha" \
    || fail '재적층 SHA가 새 기준 SHA의 후손이 아닙니다.'
  collect_and_check_changed_paths "$new_base_sha" "$META_PATHS"
  run_submission_profile "$META_PROFILE"
  collect_and_check_changed_paths "$new_base_sha" "$META_PATHS"
  [[ "$(git rev-parse HEAD)" == "$restacked_sha" ]] \
    || fail '재적층 검증 중 task branch HEAD가 변경되었습니다.'
  [[ -z "$(git status --porcelain)" ]] \
    || fail '재적층 검증 뒤 worktree가 깨끗하지 않습니다.'

  local restacked_at
  local history_entry
  restacked_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  history_entry="$previous_base_sha:$previous_submitted_sha:$new_base_sha:$restacked_sha:$restacked_at"

  acquire_mutex
  load_task "$TASK_ID"
  [[ "$META_STATUS" == submitted ]] || fail 'task 상태가 재적층 도중 변경되었습니다.'
  [[ "$META_BASE_SHA" == "$previous_base_sha" ]] || fail 'base SHA가 재적층 도중 변경되었습니다.'
  [[ "$META_SUBMITTED_SHA" == "$previous_submitted_sha" ]] \
    || fail 'submitted SHA가 재적층 도중 변경되었습니다.'
  [[ "$META_SUBMITTED_AT" == "$previous_submitted_at" ]] \
    || fail 'submitted 시각이 재적층 도중 변경되었습니다.'
  [[ "$(git rev-parse HEAD)" == "$restacked_sha" ]] \
    || fail 'metadata 갱신 전 task branch HEAD가 변경되었습니다.'

  META_PREVIOUS_BASE_SHA="$previous_base_sha"
  META_PREVIOUS_SUBMITTED_SHA="$previous_submitted_sha"
  META_RESTACKED_AT="$restacked_at"
  META_RESTACK_HISTORY="${META_RESTACK_HISTORY:+$META_RESTACK_HISTORY;}$history_entry"
  META_BASE_SHA="$new_base_sha"
  META_SUBMITTED_SHA="$restacked_sha"
  META_SUBMITTED_AT="$restacked_at"
  restack_committed_base_sha="$new_base_sha"
  restack_committed_sha="$restacked_sha"
  write_task "$META_FILE"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_METADATA:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi
  restack_rollback_active=0
  release_mutex
  release_task_lock
  note "RESTACKED task=$TASK_ID previous_base=$previous_base_sha previous=$previous_submitted_sha base=$new_base_sha sha=$restacked_sha profile=$META_PROFILE"
}

command_restack_squash() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  [[ -n "$NEW_BASE_REF" ]] || fail '--new-base-ref가 필요합니다.'
  acquire_task_lock "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == submitted ]] || fail "submitted task만 squash 재적층할 수 있습니다: $META_STATUS"
  [[ -z "$(git status --porcelain)" ]] || fail '깨끗한 submitted worktree만 squash 재적층할 수 있습니다.'

  local previous_base_sha="$META_BASE_SHA"
  local previous_submitted_sha="$META_SUBMITTED_SHA"
  local previous_submitted_at="$META_SUBMITTED_AT"
  [[ -n "$previous_base_sha" && -n "$previous_submitted_sha" ]] \
    || fail '기존 base/submitted SHA가 없습니다.'
  [[ "$(git rev-parse HEAD)" == "$previous_submitted_sha" ]] \
    || fail 'squash 재적층 전 task branch HEAD가 기존 submitted SHA와 일치해야 합니다.'
  git merge-base --is-ancestor "$previous_base_sha" "$previous_submitted_sha" \
    || fail '기존 submitted commit의 ancestry가 올바르지 않습니다.'
  collect_and_check_changed_paths "$previous_base_sha" "$META_PATHS"
  git diff --quiet "$previous_base_sha" "$previous_submitted_sha" -- \
    && fail '기존 submitted SHA에 재적층할 최종 task delta가 없습니다.'

  local new_base_sha
  new_base_sha="$(git rev-parse --verify "$NEW_BASE_REF^{commit}" 2>/dev/null)" \
    || fail "새 기준 commit을 찾지 못했습니다: $NEW_BASE_REF"
  [[ "$new_base_sha" != "$previous_base_sha" ]] \
    || fail '새 기준 SHA가 기존 기준 SHA와 같습니다.'
  git merge-base --is-ancestor "$previous_base_sha" "$new_base_sha" \
    || fail '새 기준 commit은 기존 base SHA의 후손이어야 합니다.'
  if git merge-base --is-ancestor "$previous_submitted_sha" "$new_base_sha"; then
    fail '새 기준 commit에 기존 submitted SHA가 이미 포함되어 있습니다.'
  fi

  restack_rollback_sha="$previous_submitted_sha"
  restack_rollback_active=1
  restack_meta_file="$META_FILE"
  git reset --hard "$new_base_sha" >/dev/null
  if ! git diff --binary --full-index --no-ext-diff \
    "$previous_base_sha" "$previous_submitted_sha" -- \
    | git apply --index --3way --whitespace=nowarn; then
    fail 'squash 재적층 충돌이 발생해 task branch를 기존 submitted SHA로 복구했습니다.'
  fi
  git diff --cached --quiet \
    && fail 'squash 재적층 결과 task delta가 비었습니다.'
  [[ -z "$(git diff --name-only)" ]] \
    || fail 'squash delta 적용 후 index와 worktree가 일치하지 않습니다.'
  collect_and_check_changed_paths "$new_base_sha" "$META_PATHS"
  git commit -m "task($TASK_ID): squash restack submitted delta" >/dev/null

  local restacked_sha
  restacked_sha="$(git rev-parse HEAD)"
  [[ "$(git rev-parse "$restacked_sha^")" == "$new_base_sha" ]] \
    || fail 'squash 재적층 결과가 새 기준 위의 단일 commit이 아닙니다.'
  [[ "$(git rev-list --count "$new_base_sha..$restacked_sha")" == 1 ]] \
    || fail 'squash 재적층 결과 commit 수가 1개가 아닙니다.'
  collect_and_check_changed_paths "$new_base_sha" "$META_PATHS"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_SQUASH_COMMIT:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi
  run_submission_profile "$META_PROFILE"
  collect_and_check_changed_paths "$new_base_sha" "$META_PATHS"
  [[ "$(git rev-parse HEAD)" == "$restacked_sha" ]] \
    || fail 'squash 재적층 검증 중 task branch HEAD가 변경되었습니다.'
  [[ -z "$(git status --porcelain)" ]] \
    || fail 'squash 재적층 검증 뒤 worktree가 깨끗하지 않습니다.'

  local restacked_at
  local history_entry
  restacked_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  history_entry="$previous_base_sha:$previous_submitted_sha:$new_base_sha:$restacked_sha:$restacked_at"

  acquire_mutex
  load_task "$TASK_ID"
  [[ "$META_STATUS" == submitted ]] || fail 'task 상태가 squash 재적층 도중 변경되었습니다.'
  [[ "$META_BASE_SHA" == "$previous_base_sha" ]] || fail 'base SHA가 squash 재적층 도중 변경되었습니다.'
  [[ "$META_SUBMITTED_SHA" == "$previous_submitted_sha" ]] \
    || fail 'submitted SHA가 squash 재적층 도중 변경되었습니다.'
  [[ "$META_SUBMITTED_AT" == "$previous_submitted_at" ]] \
    || fail 'submitted 시각이 squash 재적층 도중 변경되었습니다.'
  [[ "$(git rev-parse HEAD)" == "$restacked_sha" ]] \
    || fail 'metadata 갱신 전 task branch HEAD가 변경되었습니다.'

  META_PREVIOUS_BASE_SHA="$previous_base_sha"
  META_PREVIOUS_SUBMITTED_SHA="$previous_submitted_sha"
  META_RESTACKED_AT="$restacked_at"
  META_RESTACK_HISTORY="${META_RESTACK_HISTORY:+$META_RESTACK_HISTORY;}$history_entry"
  META_BASE_SHA="$new_base_sha"
  META_SUBMITTED_SHA="$restacked_sha"
  META_SUBMITTED_AT="$restacked_at"
  restack_committed_base_sha="$new_base_sha"
  restack_committed_sha="$restacked_sha"
  write_task "$META_FILE"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_TERMINATE_AFTER_RESTACK_METADATA:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi
  restack_rollback_active=0
  release_mutex
  release_task_lock
  note "RESTACKED_SQUASH task=$TASK_ID previous_base=$previous_base_sha previous=$previous_submitted_sha base=$new_base_sha sha=$restacked_sha profile=$META_PROFILE"
}

command_replace_submitted() {
  local scope_mode="$1"
  shift
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  validate_task_id "$SUPERSEDES_TASK"
  [[ "$TASK_ID" != "$SUPERSEDES_TASK" ]] \
    || fail '새 task ID와 supersedes task ID는 달라야 합니다.'
  case "$scope_mode" in
    inherited)
      [[ -z "$PATHS_CSV" && -z "$AREAS_CSV" && -z "$PROFILE" ]] \
        || fail '일반 교체는 PATHS·AREAS·PROFILE을 정확히 상속합니다.'
      ;;
    expanded)
      [[ -n "$PATHS_CSV" ]] \
        || fail '승인된 범위확장 교체에는 PATHS가 필요합니다.'
      [[ -z "$AREAS_CSV" && -z "$PROFILE" ]] \
        || fail '범위확장 교체도 AREAS·PROFILE은 정확히 상속합니다.'
      validate_paths "$PATHS_CSV"
      csv_has_duplicate "$PATHS_CSV" \
        && fail '범위확장 PATHS에는 중복 prefix를 허용하지 않습니다.'
      ;;
    *) fail "지원하지 않는 submitted-task 교체 모드입니다: $scope_mode" ;;
  esac
  [[ -z "$(git status --porcelain)" ]] \
    || fail '깨끗한 새 worktree에서만 submitted task를 교체할 수 있습니다.'
  [[ "$repo_root" != "$main_worktree" ]] \
    || fail '기본 Local worktree에서는 submitted task를 교체할 수 없습니다.'

  local new_branch
  new_branch="$(git symbolic-ref --quiet --short HEAD || true)"
  [[ -n "$new_branch" ]] || fail '새 task의 명시적 Git branch가 필요합니다.'
  local new_base_sha
  new_base_sha="$(git rev-parse --verify "$BASE_REF^{commit}" 2>/dev/null)" \
    || fail "새 task 기준 commit을 찾지 못했습니다: $BASE_REF"
  [[ "$(git rev-parse HEAD)" == "$new_base_sha" ]] \
    || fail '현재 HEAD와 BASE_REF가 다릅니다. 정확한 새 기준 checkout에서 다시 실행하십시오.'

  acquire_task_lock "$SUPERSEDES_TASK"
  load_task "$SUPERSEDES_TASK"
  [[ "$META_STATUS" == submitted ]] \
    || fail "submitted task만 교체할 수 있습니다: $META_STATUS"

  local old_meta_file="$META_FILE"
  local old_worktree="$META_WORKTREE"
  local old_branch="$META_BRANCH"
  local old_base_sha="$META_BASE_SHA"
  local old_paths="$META_PATHS"
  local old_areas="$META_AREAS"
  local old_profile="$META_PROFILE"
  local old_submitted_sha="$META_SUBMITTED_SHA"
  local old_submitted_at="$META_SUBMITTED_AT"
  local replacement_paths="$old_paths"
  if [[ "$scope_mode" == expanded ]]; then
    csv_contains_all_exact "$old_paths" "$PATHS_CSV" \
      || fail '범위확장 PATHS는 기존 PATHS 항목을 정확히 모두 포함해야 합니다.'
    csv_has_addition "$PATHS_CSV" "$old_paths" \
      || fail '범위확장 PATHS에는 기존 PATHS 이외의 새 항목이 필요합니다.'
    replacement_paths="$PATHS_CSV"
  fi
  [[ -n "$old_worktree" && -d "$old_worktree" ]] \
    || fail "교체할 submitted task worktree를 찾지 못했습니다: $old_worktree"
  old_worktree="$(cd "$old_worktree" && pwd -P)"
  [[ "$old_worktree" != "$repo_root" ]] \
    || fail '기존 submitted task와 다른 새 worktree에서 교체해야 합니다.'
  [[ "$old_branch" != "$new_branch" ]] \
    || fail '기존 submitted task와 다른 새 branch에서 교체해야 합니다.'
  [[ "$(git -C "$old_worktree" rev-parse --is-inside-work-tree 2>/dev/null)" == true ]] \
    || fail '기존 submitted task worktree가 유효한 Git worktree가 아닙니다.'
  local old_common_git_dir
  old_common_git_dir="$(git -C "$old_worktree" rev-parse --path-format=absolute --git-common-dir)"
  old_common_git_dir="$(cd "$old_common_git_dir" && pwd -P)"
  [[ "$old_common_git_dir" == "$common_git_dir" ]] \
    || fail '기존 submitted task worktree가 같은 Git 저장소에 속하지 않습니다.'
  [[ "$(git -C "$old_worktree" symbolic-ref --quiet --short HEAD || true)" == "$old_branch" ]] \
    || fail '기존 submitted task branch가 metadata와 일치하지 않습니다.'
  [[ -z "$(git -C "$old_worktree" status --porcelain)" ]] \
    || fail '기존 submitted task worktree가 깨끗하지 않습니다.'
  [[ "$(git -C "$old_worktree" rev-parse HEAD)" == "$old_submitted_sha" ]] \
    || fail '기존 submitted task HEAD가 기록된 submitted SHA와 일치하지 않습니다.'
  git -C "$old_worktree" merge-base --is-ancestor "$old_base_sha" "$old_submitted_sha" \
    || fail '기존 submitted task ancestry가 올바르지 않습니다.'
  validate_paths "$old_paths"
  validate_areas "$old_areas"
  validate_profile "$old_profile"
  collect_and_check_changed_paths_at "$old_worktree" "$old_base_sha" "$old_paths"

  acquire_mutex
  [[ ! -e "$(task_file "$TASK_ID")" ]] || fail "새 task ID가 이미 활성 상태입니다: $TASK_ID"
  load_task "$SUPERSEDES_TASK"
  [[ "$META_FILE" == "$old_meta_file" \
    && "$META_STATUS" == submitted \
    && "$META_WORKTREE" == "$old_worktree" \
    && "$META_BRANCH" == "$old_branch" \
    && "$META_BASE_SHA" == "$old_base_sha" \
    && "$META_PATHS" == "$old_paths" \
    && "$META_AREAS" == "$old_areas" \
    && "$META_PROFILE" == "$old_profile" \
    && "$META_SUBMITTED_SHA" == "$old_submitted_sha" \
    && "$META_SUBMITTED_AT" == "$old_submitted_at" ]] \
    || fail '기존 submitted task metadata가 교체 검증 도중 변경되었습니다.'
  [[ "$(git -C "$old_worktree" symbolic-ref --quiet --short HEAD || true)" == "$old_branch" \
    && "$(git -C "$old_worktree" rev-parse HEAD)" == "$old_submitted_sha" \
    && -z "$(git -C "$old_worktree" status --porcelain)" ]] \
    || fail '기존 submitted task worktree가 교체 검증 도중 변경되었습니다.'
  [[ "$(git rev-parse HEAD)" == "$new_base_sha" \
    && -z "$(git status --porcelain)" ]] \
    || fail '새 task worktree가 교체 검증 도중 변경되었습니다.'

  local existing
  local existing_task
  local existing_paths
  local existing_areas
  for existing in "$tasks_dir"/*.meta; do
    [[ -e "$existing" ]] || continue
    existing_task="$(field "$existing" task)"
    [[ "$existing_task" == "$SUPERSEDES_TASK" ]] && continue
    existing_paths="$(field "$existing" paths)"
    existing_areas="$(field "$existing" areas)"
    csv_paths_overlap "$replacement_paths" "$existing_paths" \
      && fail "교체 PATHS가 task ${existing_task}와 겹칩니다: $existing_paths"
    csv_areas_overlap "$old_areas" "$existing_areas" \
      && fail "상속 AREAS가 task ${existing_task}와 겹칩니다: $existing_areas"
    [[ "$(field "$existing" worktree)" != "$repo_root" ]] \
      || fail "새 worktree를 task ${existing_task}가 이미 소유하고 있습니다."
    [[ "$(field "$existing" branch)" != "$new_branch" ]] \
      || fail "새 branch를 task ${existing_task}가 이미 소유하고 있습니다."
  done

  local replaced_at
  local history_stamp
  replaced_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  history_stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  replace_old_meta="$old_meta_file"
  replace_old_backup="$tasks_dir/.$SUPERSEDES_TASK.replace.$$.backup"
  replace_history_meta="$history_dir/$SUPERSEDES_TASK.$history_stamp.meta"
  replace_history_stage="$history_dir/.$SUPERSEDES_TASK.replace.$$.history"
  replace_new_meta="$(task_file "$TASK_ID")"
  replace_new_stage="$tasks_dir/.$TASK_ID.replace.$$.new"
  replace_expected_old_task="$SUPERSEDES_TASK"
  replace_expected_new_task="$TASK_ID"
  [[ ! -e "$replace_old_backup" && ! -e "$replace_history_meta" \
    && ! -e "$replace_history_stage" && ! -e "$replace_new_meta" \
    && ! -e "$replace_new_stage" ]] \
    || fail 'submitted task 교체 metadata 경로가 이미 존재합니다.'
  replace_rollback_active=1

  META_STATUS='superseded'
  META_SUPERSEDED_BY="$TASK_ID"
  META_SUPERSEDED_AT="$replaced_at"
  write_task "$replace_history_stage"

  META_TASK="$TASK_ID"
  META_STATUS='active'
  META_WORKTREE="$repo_root"
  META_BRANCH="$new_branch"
  META_BASE_SHA="$new_base_sha"
  META_PATHS="$replacement_paths"
  META_AREAS="$old_areas"
  META_PROFILE="$old_profile"
  META_CREATED_AT="$replaced_at"
  META_SUBMITTED_SHA=''
  META_SUBMITTED_AT=''
  META_INTEGRATION_SHA=''
  META_INTEGRATED_AT=''
  META_VERIFIED_SHA=''
  META_VERIFIED_AT=''
  META_VERIFIED_MODE=''
  META_VERIFIED_BASE_SHA=''
  META_PREVIOUS_BASE_SHA=''
  META_PREVIOUS_SUBMITTED_SHA=''
  META_RESTACKED_AT=''
  META_RESTACK_HISTORY=''
  META_SUPERSEDED_BY=''
  META_SUPERSEDED_AT=''
  write_task "$replace_new_stage"

  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_FAIL_REPLACE_BEFORE_COMMIT:-0}" == 1 ]]; then
    fail 'TEST_MODE submitted-task replacement failure before commit'
  fi
  mv "$replace_old_meta" "$replace_old_backup"
  mv "$replace_history_stage" "$replace_history_meta"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_TERMINATE_AFTER_REPLACE_ARCHIVE:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi
  mv "$replace_new_stage" "$replace_new_meta"
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_TERMINATE_AFTER_REPLACE_METADATA:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi
  rm -f -- "$replace_old_backup"
  replace_rollback_active=0
  release_mutex
  release_task_lock
  if [[ "$scope_mode" == expanded ]]; then
    note "REPLACED_SUBMITTED_EXPANDED task=$TASK_ID supersedes=$SUPERSEDES_TASK base=$new_base_sha paths=${replacement_paths:-none} areas=${old_areas:-none} profile=$old_profile"
  else
    note "REPLACED_SUBMITTED task=$TASK_ID supersedes=$SUPERSEDES_TASK base=$new_base_sha paths=${replacement_paths:-none} areas=${old_areas:-none} profile=$old_profile"
  fi
}

assert_integration_owner() {
  local task="$1"
  load_task "$task"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail '통합 task가 active 상태가 아닙니다.'
  csv_has "$META_AREAS" integration || fail '통합 task가 integration AREA를 소유하지 않습니다.'
}

assert_integration_owner_unchanged() {
  local task="$1"
  local expected_meta_file="$2"
  local expected_meta_hash="$3"
  [[ -f "$expected_meta_file" \
    && "$(git hash-object "$expected_meta_file")" == "$expected_meta_hash" ]] \
    || fail '통합 검증 중 integration task metadata가 변경되었습니다.'
  load_task "$task"
  assert_task_owner
  [[ "$META_STATUS" == active ]] \
    || fail '통합 검증 중 integration task가 active 상태를 잃었습니다.'
  csv_has "$META_AREAS" integration \
    || fail '통합 검증 중 integration AREA 소유권이 사라졌습니다.'
}

finalize_integrated_tasks() {
  local integration_sha="$1"
  local count="${#integration_finalize_task_ids[@]}"
  local index
  [[ "$count" -gt 0 ]] || fail '통합 완료할 task가 없습니다.'
  acquire_mutex
  for ((index=0; index<count; index++)); do
    [[ -f "${integration_finalize_meta_files[$index]}" \
      && "$(git hash-object "${integration_finalize_meta_files[$index]}")" \
        == "${integration_finalize_expected_meta_hashes[$index]}" ]] \
      || fail "통합 완료 전 task metadata가 변경되었습니다: ${integration_finalize_task_ids[$index]}"
    load_task "${integration_finalize_task_ids[$index]}"
    [[ "$META_STATUS" == submitted \
      && "$META_SUBMITTED_SHA" == "${integration_finalize_expected_submitted[$index]}" \
      && "$META_WORKTREE" == "${integration_finalize_expected_worktrees[$index]}" \
      && "$META_BRANCH" == "${integration_finalize_expected_branches[$index]}" ]] \
      || fail "통합 완료 전 task 계약이 변경되었습니다: ${integration_finalize_task_ids[$index]}"
    [[ -d "$META_WORKTREE" \
      && -z "$(git -C "$META_WORKTREE" status --porcelain 2>/dev/null || printf 'missing')" \
      && "$(git -C "$META_WORKTREE" rev-parse HEAD 2>/dev/null || true)" \
        == "${integration_finalize_expected_heads[$index]}" \
      && "$(git -C "$META_WORKTREE" symbolic-ref --quiet --short HEAD 2>/dev/null || true)" \
        == "${integration_finalize_expected_branches[$index]}" ]] \
      || fail "통합 완료 전 제출 worktree가 변경되었습니다: ${integration_finalize_task_ids[$index]}"
  done

  local integrated_at
  local history_stamp
  integrated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  history_stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
  integration_finalize_sha="$integration_sha"
  integration_finalize_backups=()
  integration_finalize_history_files=()
  integration_finalize_stages=()
  for ((index=0; index<count; index++)); do
    integration_finalize_backups[$index]="$tasks_dir/.${integration_finalize_task_ids[$index]}.integrate.$$.backup"
    integration_finalize_history_files[$index]="$history_dir/${integration_finalize_task_ids[$index]}.$history_stamp.meta"
    integration_finalize_stages[$index]="$history_dir/.${integration_finalize_task_ids[$index]}.integrate.$$.stage"
    [[ ! -e "${integration_finalize_backups[$index]}" \
      && ! -e "${integration_finalize_history_files[$index]}" \
      && ! -e "${integration_finalize_stages[$index]}" ]] \
      || fail "통합 metadata 경로가 이미 존재합니다: ${integration_finalize_task_ids[$index]}"
  done
  integration_finalize_active=1
  for ((index=0; index<count; index++)); do
    load_task "${integration_finalize_task_ids[$index]}"
    META_STATUS='integrated'
    META_INTEGRATION_SHA="$integration_sha"
    META_INTEGRATED_AT="$integrated_at"
    write_task "${integration_finalize_stages[$index]}"
  done
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_FAIL_INTEGRATION_FINALIZE:-0}" == 1 ]]; then
    fail 'TEST_MODE integration metadata finalization failure'
  fi
  for ((index=0; index<count; index++)); do
    mv "${integration_finalize_meta_files[$index]}" "${integration_finalize_backups[$index]}"
  done
  for ((index=0; index<count; index++)); do
    mv "${integration_finalize_stages[$index]}" "${integration_finalize_history_files[$index]}"
    if [[ "$index" == 0 \
      && "${G7PB_COORD_TESTING:-0}" == 1 \
      && "${G7PB_COORD_TEST_TERMINATE_AFTER_FIRST_INTEGRATION_ARCHIVE:-0}" == 1 ]]; then
      kill -TERM "$$"
    fi
  done
  if [[ "${G7PB_COORD_TESTING:-0}" == 1 \
    && "${G7PB_COORD_TEST_TERMINATE_AFTER_INTEGRATION_METADATA:-0}" == 1 ]]; then
    kill -TERM "$$"
  fi
  for ((index=0; index<count; index++)); do
    rm -f -- "${integration_finalize_backups[$index]}"
  done
  integration_finalize_active=0
  integration_merge_active=0
  release_mutex
}

command_integrate() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  validate_task_id "$INTEGRATION_TASK"
  [[ "$TASK_ID" != "$INTEGRATION_TASK" ]] \
    || fail '통합 task 자신을 submitted task로 병합할 수 없습니다.'

  assert_integration_owner "$INTEGRATION_TASK"
  [[ "$repo_root" == "$main_worktree" ]] || fail '통합은 기본 Local worktree에서만 허용합니다.'
  acquire_task_lock "$INTEGRATION_TASK"
  assert_integration_owner "$INTEGRATION_TASK"
  [[ -z "$(git status --porcelain)" ]] || fail '깨끗한 통합 worktree에서만 병합할 수 있습니다.'
  local integration_profile="$META_PROFILE"
  local integration_mode="${INTEGRATION_MODE:-standard}"
  local integration_owner_meta_file="$META_FILE"
  local integration_owner_meta_hash
  integration_owner_meta_hash="$(git hash-object "$integration_owner_meta_file")"

  acquire_task_lock "$TASK_ID"
  load_task "$TASK_ID"
  [[ "$META_STATUS" == submitted ]] || fail "submitted task만 병합할 수 있습니다: $META_STATUS"
  local task_profile="$META_PROFILE"
  local task_areas="$META_AREAS"
  local submitted_sha="$META_SUBMITTED_SHA"
  local task_worktree="$META_WORKTREE"
  local task_base="$META_BASE_SHA"
  local task_branch="$META_BRANCH"
  local task_meta_file="$META_FILE"
  local task_meta_hash
  task_meta_hash="$(git hash-object "$task_meta_file")"
  [[ -n "$submitted_sha" ]] || fail 'submitted SHA가 없습니다.'
  git cat-file -e "$submitted_sha^{commit}" 2>/dev/null || fail 'submitted commit을 찾지 못했습니다.'
  git merge-base --is-ancestor "$task_base" "$submitted_sha" || fail 'submitted commit의 ancestry가 올바르지 않습니다.'
  [[ -d "$task_worktree" ]] || fail '제출 worktree가 없습니다. Codex snapshot을 복구한 뒤 통합하십시오.'
  [[ -z "$(git -C "$task_worktree" status --porcelain)" ]] || fail '제출 worktree에 미커밋 변경이 남아 있습니다.'

  integration_finalize_task_ids=("$TASK_ID")
  integration_finalize_expected_submitted=("$submitted_sha")
  integration_finalize_expected_meta_hashes=("$task_meta_hash")
  integration_finalize_expected_worktrees=("$task_worktree")
  integration_finalize_expected_branches=("$task_branch")
  integration_finalize_expected_heads=("$submitted_sha")
  integration_finalize_meta_files=("$task_meta_file")

  if git merge-base --is-ancestor "$submitted_sha" HEAD; then
    if [[ "$task_worktree" != "$repo_root" ]]; then
      [[ "$(git -C "$task_worktree" rev-parse HEAD)" == "$submitted_sha" ]] \
        || fail '제출 뒤 task branch HEAD가 변경되었습니다. 새 변경을 별도 task로 제출하십시오.'
    fi
    if [[ "$task_worktree" == "$repo_root" ]]; then
      integration_finalize_expected_heads[0]="$(git rev-parse HEAD)"
    fi
    if [[ "$integration_mode" == scoped ]]; then
      run_scoped_integration_profile \
        "$task_base" "$submitted_sha" "$INTEGRATION_TASK" "$task_areas" "$(git write-tree)"
    else
      run_integration_profile "$task_profile" "$INTEGRATION_TASK" "$task_areas"
    fi
    assert_integration_owner_unchanged \
      "$INTEGRATION_TASK" "$integration_owner_meta_file" "$integration_owner_meta_hash"
    [[ -f "$task_meta_file" && "$(git hash-object "$task_meta_file")" == "$task_meta_hash" ]] \
      || fail '통합 검증 중 제출 task metadata가 변경되었습니다.'
    [[ -d "$task_worktree" ]] || fail '통합 검증 중 제출 Worktree가 사라졌습니다.'
    [[ -z "$(git -C "$task_worktree" status --porcelain)" ]] \
      || fail '통합 검증 중 제출 Worktree가 변경되었습니다.'
    if [[ "$task_worktree" == "$repo_root" ]]; then
      git merge-base --is-ancestor "$submitted_sha" HEAD \
        || fail '통합 검증 중 이미 포함된 submitted commit이 사라졌습니다.'
    else
      [[ "$(git -C "$task_worktree" rev-parse HEAD)" == "$submitted_sha" ]] \
        || fail '통합 검증 중 제출 Worktree가 변경되었습니다.'
    fi
    finalize_integrated_tasks "$(git rev-parse HEAD)"
    release_task_lock
    note "ALREADY_INTEGRATED task=$TASK_ID sha=$submitted_sha"
    return
  fi

  [[ "$(git -C "$task_worktree" rev-parse HEAD)" == "$submitted_sha" ]] \
    || fail '제출 뒤 task branch HEAD가 변경되었습니다. 새 변경을 별도 task로 제출하십시오.'

  local merge_tree_output
  merge_tree_output="$(mktemp "${TMPDIR:-/tmp}/g7pb-merge-tree.XXXXXX")"
  integration_temp_files[${#integration_temp_files[@]}]="$merge_tree_output"
  if ! git merge-tree --write-tree --messages HEAD "$submitted_sha" >"$merge_tree_output" 2>&1; then
    sed -n '1,200p' "$merge_tree_output" >&2
    rm -f "$merge_tree_output"
    fail 'merge-tree 충돌 사전검사가 실패했습니다. 자동 의미 충돌 해결은 하지 않습니다.'
  fi
  rm -f "$merge_tree_output"

  integration_start_sha="$(git rev-parse HEAD)"
  integration_merge_active=1
  git merge --no-ff --no-commit "$submitted_sha" \
    || fail 'Git 임시 병합이 실패했습니다.'

  local candidate_tree
  candidate_tree="$(git write-tree)"
  if [[ "$integration_mode" == scoped ]]; then
    run_scoped_integration_profile \
      "$integration_start_sha" "$submitted_sha" "$INTEGRATION_TASK" "$task_areas" "$candidate_tree" \
      || fail '범위 통합 검증이 실패해 병합을 중단합니다.'
  elif ! run_integration_profile "$task_profile" "$INTEGRATION_TASK" "$task_areas"; then
    fail '통합 검증이 실패해 병합을 중단합니다.'
  fi

  if [[ ! -d "$task_worktree" \
    || -n "$(git -C "$task_worktree" status --porcelain 2>/dev/null || printf 'missing')" \
    || "$(git -C "$task_worktree" rev-parse HEAD 2>/dev/null || true)" != "$submitted_sha" ]]; then
    fail '통합 검증 중 제출 Worktree가 변경되어 병합을 중단했습니다.'
  fi
  [[ -f "$task_meta_file" && "$(git hash-object "$task_meta_file")" == "$task_meta_hash" ]] \
    || fail '통합 검증 중 제출 task metadata가 변경되었습니다.'
  assert_integration_owner_unchanged \
    "$INTEGRATION_TASK" "$integration_owner_meta_file" "$integration_owner_meta_hash"

  git commit -m "merge($TASK_ID): integrate submitted worktree"
  local integration_sha
  integration_sha="$(git rev-parse HEAD)"
  finalize_integrated_tasks "$integration_sha"
  release_task_lock
  note "INTEGRATED task=$TASK_ID submitted=$submitted_sha integration=$integration_sha integration_profile=$integration_profile validation_mode=$integration_mode"
}

command_integrate_batch() {
  parse_common_args "$@"
  validate_task_id "$INTEGRATION_TASK"
  [[ -n "$TASKS_CSV" ]] || fail '--tasks 값이 필요합니다.'
  [[ "$TASKS_CSV" != ,* && "$TASKS_CSV" != *, && "$TASKS_CSV" != *,,* \
    && ! "$TASKS_CSV" =~ [[:space:]] ]] \
    || fail 'TASKS는 공백·빈 항목이 없는 쉼표 구분 task ID여야 합니다.'

  local old_ifs="$IFS"
  local requested_tasks=()
  IFS=',' read -r -a requested_tasks <<< "$TASKS_CSV"
  IFS="$old_ifs"
  [[ "${#requested_tasks[@]}" -ge 2 ]] \
    || fail 'batch 통합에는 서로 다른 submitted task가 2개 이상 필요합니다.'

  local task
  for task in "${requested_tasks[@]}"; do
    validate_task_id "$task"
    [[ "$task" != "$INTEGRATION_TASK" ]] \
      || fail '통합 task 자신을 batch 제출물로 지정할 수 없습니다.'
  done

  local sorted_tasks=()
  while IFS= read -r task; do
    [[ -n "$task" ]] && sorted_tasks[${#sorted_tasks[@]}]="$task"
  done < <(printf '%s\n' "${requested_tasks[@]}" | LC_ALL=C sort)
  local index
  for ((index=1; index<${#sorted_tasks[@]}; index++)); do
    [[ "${sorted_tasks[$((index - 1))]}" != "${sorted_tasks[$index]}" ]] \
      || fail "batch TASKS에 중복 ID가 있습니다: ${sorted_tasks[$index]}"
  done

  assert_integration_owner "$INTEGRATION_TASK"
  [[ "$repo_root" == "$main_worktree" ]] \
    || fail 'batch 통합은 기본 Local worktree에서만 허용합니다.'
  acquire_task_lock "$INTEGRATION_TASK"
  assert_integration_owner "$INTEGRATION_TASK"
  [[ -z "$(git status --porcelain)" ]] \
    || fail '깨끗한 통합 worktree에서만 batch 병합할 수 있습니다.'
  local integration_owner_meta_file="$META_FILE"
  local integration_owner_meta_hash
  integration_owner_meta_hash="$(git hash-object "$integration_owner_meta_file")"

  for task in "${sorted_tasks[@]}"; do
    acquire_task_lock "$task"
  done

  local task_profiles=()
  local task_paths=()
  local task_areas_list=()
  local submitted_shas=()
  local combined_areas=''
  local previous_index
  integration_finalize_task_ids=()
  integration_finalize_expected_submitted=()
  integration_finalize_expected_meta_hashes=()
  integration_finalize_expected_worktrees=()
  integration_finalize_expected_branches=()
  integration_finalize_expected_heads=()
  integration_finalize_meta_files=()

  for ((index=0; index<${#sorted_tasks[@]}; index++)); do
    task="${sorted_tasks[$index]}"
    load_task "$task"
    [[ "$META_STATUS" == submitted ]] \
      || fail "submitted task만 batch 병합할 수 있습니다: task=$task status=$META_STATUS"
    validate_profile "$META_PROFILE"
    validate_paths "$META_PATHS"
    validate_areas "$META_AREAS"
    [[ -n "$META_SUBMITTED_SHA" ]] \
      || fail "submitted SHA가 없습니다: task=$task"
    git cat-file -e "$META_SUBMITTED_SHA^{commit}" 2>/dev/null \
      || fail "submitted commit을 찾지 못했습니다: task=$task"
    git merge-base --is-ancestor "$META_BASE_SHA" "$META_SUBMITTED_SHA" \
      || fail "submitted commit ancestry가 올바르지 않습니다: task=$task"
    git merge-base --is-ancestor "$META_SUBMITTED_SHA" HEAD \
      && fail "이미 HEAD에 포함된 task는 batch가 아닌 단일 통합으로 정리하십시오: task=$task"
    [[ -d "$META_WORKTREE" ]] \
      || fail "제출 worktree가 없습니다: task=$task worktree=$META_WORKTREE"
    [[ "$META_WORKTREE" != "$repo_root" ]] \
      || fail "batch 제출 task는 별도 worktree여야 합니다: task=$task"
    [[ "$(git -C "$META_WORKTREE" rev-parse --is-inside-work-tree 2>/dev/null)" == true \
      && "$(git -C "$META_WORKTREE" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" \
        == "$common_git_dir" \
      && "$(git -C "$META_WORKTREE" symbolic-ref --quiet --short HEAD 2>/dev/null || true)" \
        == "$META_BRANCH" \
      && "$(git -C "$META_WORKTREE" rev-parse HEAD 2>/dev/null || true)" \
        == "$META_SUBMITTED_SHA" \
      && -z "$(git -C "$META_WORKTREE" status --porcelain 2>/dev/null || printf 'missing')" ]] \
      || fail "제출 worktree 계약이 metadata와 일치하지 않습니다: task=$task"
    collect_and_check_changed_paths_at "$META_WORKTREE" "$META_BASE_SHA" "$META_PATHS"

    for ((previous_index=0; previous_index<index; previous_index++)); do
      csv_paths_overlap "$META_PATHS" "${task_paths[$previous_index]}" \
        && fail "batch task PATHS가 겹칩니다: $task <-> ${sorted_tasks[$previous_index]}"
      csv_areas_overlap "$META_AREAS" "${task_areas_list[$previous_index]}" \
        && fail "batch task AREAS가 겹칩니다: $task <-> ${sorted_tasks[$previous_index]}"
    done

    task_profiles[$index]="$META_PROFILE"
    task_paths[$index]="$META_PATHS"
    task_areas_list[$index]="$META_AREAS"
    submitted_shas[$index]="$META_SUBMITTED_SHA"
    integration_finalize_task_ids[$index]="$task"
    integration_finalize_expected_submitted[$index]="$META_SUBMITTED_SHA"
    integration_finalize_expected_meta_hashes[$index]="$(git hash-object "$META_FILE")"
    integration_finalize_expected_worktrees[$index]="$META_WORKTREE"
    integration_finalize_expected_branches[$index]="$META_BRANCH"
    integration_finalize_expected_heads[$index]="$META_SUBMITTED_SHA"
    integration_finalize_meta_files[$index]="$META_FILE"
    if [[ -n "$META_AREAS" ]]; then
      combined_areas="${combined_areas:+$combined_areas,}$META_AREAS"
    fi
  done

  if [[ -n "$combined_areas" ]]; then
    local combined_area_items=()
    IFS=',' read -r -a combined_area_items <<< "$combined_areas"
    IFS="$old_ifs"
    combined_areas=''
    local area
    while IFS= read -r area; do
      [[ -n "$area" ]] || continue
      combined_areas="${combined_areas:+$combined_areas,}$area"
    done < <(printf '%s\n' "${combined_area_items[@]}" | LC_ALL=C sort -u)
  fi

  local batch_profile
  batch_profile="$(select_batch_integration_profile "${task_profiles[@]}")"
  local merge_tree_output
  merge_tree_output="$(mktemp "${TMPDIR:-/tmp}/g7pb-batch-merge-tree.XXXXXX")"
  integration_temp_files[${#integration_temp_files[@]}]="$merge_tree_output"
  local synthetic_commit
  local synthetic_tree
  synthetic_commit="$(git rev-parse HEAD)"
  for ((index=0; index<${#submitted_shas[@]}; index++)); do
    if ! git merge-tree --write-tree --messages "$synthetic_commit" "${submitted_shas[$index]}" \
      >"$merge_tree_output" 2>&1; then
      sed -n '1,200p' "$merge_tree_output" >&2
      rm -f "$merge_tree_output"
      fail "batch 결합 트리 충돌 사전검사가 실패했습니다: ${sorted_tasks[$index]}"
    fi
    synthetic_tree="$(sed -n '1p' "$merge_tree_output")"
    git cat-file -e "$synthetic_tree^{tree}" 2>/dev/null \
      || fail "batch 결합 트리 사전검사 결과가 유효하지 않습니다: ${sorted_tasks[$index]}"
    synthetic_commit="$(printf 'g7pb batch preflight: %s\n' "${sorted_tasks[$index]}" \
      | git commit-tree "$synthetic_tree" -p "$synthetic_commit" -p "${submitted_shas[$index]}")"
  done
  rm -f "$merge_tree_output"

  integration_start_sha="$(git rev-parse HEAD)"
  integration_merge_active=1
  git merge --no-ff --no-commit "${submitted_shas[@]}" \
    || fail 'Git batch 임시 병합이 실패했습니다.'
  [[ "$(git write-tree)" == "$synthetic_tree" ]] \
    || fail 'Git batch 임시 병합 결과가 사전검사한 결합 트리와 다릅니다.'

  if ! run_integration_profile "$batch_profile" "$INTEGRATION_TASK" "$combined_areas"; then
    fail 'batch 통합 검증이 실패해 전체 병합을 중단합니다.'
  fi

  for ((index=0; index<${#sorted_tasks[@]}; index++)); do
    [[ -f "${integration_finalize_meta_files[$index]}" \
      && "$(git hash-object "${integration_finalize_meta_files[$index]}")" \
        == "${integration_finalize_expected_meta_hashes[$index]}" \
      && -d "${integration_finalize_expected_worktrees[$index]}" \
      && -z "$(git -C "${integration_finalize_expected_worktrees[$index]}" \
        status --porcelain 2>/dev/null || printf 'missing')" \
      && "$(git -C "${integration_finalize_expected_worktrees[$index]}" \
        rev-parse HEAD 2>/dev/null || true)" \
        == "${integration_finalize_expected_heads[$index]}" \
      && "$(git -C "${integration_finalize_expected_worktrees[$index]}" \
        symbolic-ref --quiet --short HEAD 2>/dev/null || true)" \
        == "${integration_finalize_expected_branches[$index]}" ]] \
      || fail "batch 검증 중 제출 계약이 변경되었습니다: ${sorted_tasks[$index]}"
  done
  assert_integration_owner_unchanged \
    "$INTEGRATION_TASK" "$integration_owner_meta_file" "$integration_owner_meta_hash"

  local task_list
  task_list="$(IFS=','; printf '%s' "${sorted_tasks[*]}")"
  git commit -m 'merge(batch): integrate submitted worktrees' -m "Tasks: $task_list"
  local integration_sha
  integration_sha="$(git rev-parse HEAD)"
  finalize_integrated_tasks "$integration_sha"
  release_task_lock
  note "INTEGRATED_BATCH tasks=$task_list integration=$integration_sha profile=$batch_profile"
}

command_runtime_guard() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  [[ "$repo_root" == "$main_worktree" ]] || fail '고정 g7pb-dev runtime은 기본 Local worktree에서만 사용할 수 있습니다.'
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail 'active integration task만 runtime을 사용할 수 있습니다.'
  csv_has "$META_AREAS" integration || fail 'integration AREA가 필요합니다.'
  csv_has "$META_AREAS" runtime || fail 'runtime AREA가 필요합니다.'
  note "RUNTIME_OK task=$TASK_ID"
}

command_verify() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  local force_full="$FORCE_FULL"
  acquire_task_lock "$TASK_ID"
  command_runtime_guard --task "$TASK_ID"
  local file
  for file in "$tasks_dir"/*.meta; do
    [[ -e "$file" ]] || continue
    [[ "$(field "$file" task)" == "$TASK_ID" ]] || fail "미완료 task가 남아 있어 전체 검증을 중단합니다: $(field "$file" task)"
  done
  [[ -z "$(git status --porcelain)" ]] || fail '전체 검증 전 통합 worktree가 깨끗해야 합니다.'

  local head_sha
  local verification_base=''
  local verification_mode='full'
  local changed_count='unknown'
  head_sha="$(git rev-parse HEAD)"
  find_latest_verified_ancestor "$head_sha"
  if [[ -n "$LATEST_VERIFIED_SHA" ]]; then
    verification_base="$LATEST_VERIFIED_SHA"
    classify_verification_range "$verification_base" "$head_sha"
    verification_mode="$VERIFICATION_MODE"
    changed_count="$VERIFICATION_CHANGED_COUNT"
  fi
  if [[ "$force_full" == 1 ]]; then
    verification_mode='full'
    VERIFICATION_FULL_PATH='explicit-full'
  fi

  case "$verification_mode" in
    reuse)
      note "VERIFY_REUSED task=$TASK_ID sha=$head_sha source_mode=$LATEST_VERIFIED_MODE"
      ;;
    scoped)
      note "VERIFY_SELECTED task=$TASK_ID mode=scoped base=$verification_base head=$head_sha changed=$changed_count"
      run_scoped_verification_profile \
        "$verification_base" "$head_sha" "$TASK_ID" "$META_AREAS"
      ;;
    frontend|php|mixed|g7)
      note "VERIFY_SELECTED task=$TASK_ID mode=$verification_mode base=$verification_base head=$head_sha changed=$changed_count"
      run_integration_profile "$verification_mode" "$TASK_ID" "$META_AREAS"
      ;;
    full)
      if [[ -n "${VERIFICATION_FULL_PATH:-}" ]]; then
        note "VERIFY_SELECTED task=$TASK_ID mode=full base=$verification_base head=$head_sha changed=$changed_count trigger=$VERIFICATION_FULL_PATH"
      else
        note "VERIFY_SELECTED task=$TASK_ID mode=full base=${verification_base:-none} head=$head_sha reason=no-trusted-baseline"
      fi
      if [[ "${G7PB_COORD_TESTING:-0}" == 1 ]]; then
        note 'TEST_MODE quality-gate skipped'
      else
        make quality-gate TASK="$TASK_ID"
      fi
      ;;
    *) fail "지원하지 않는 검증 mode입니다: $verification_mode" ;;
  esac

  acquire_mutex
  load_task "$TASK_ID"
  META_VERIFIED_SHA="$head_sha"
  META_VERIFIED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  META_VERIFIED_MODE="$verification_mode"
  META_VERIFIED_BASE_SHA="$verification_base"
  write_task "$META_FILE"
  release_mutex
  release_task_lock
  note "VERIFIED task=$TASK_ID sha=$META_VERIFIED_SHA mode=$META_VERIFIED_MODE base=${META_VERIFIED_BASE_SHA:-none} changed=$changed_count"
}

command_release_guard() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  command_runtime_guard --task "$TASK_ID"
  load_task "$TASK_ID"
  [[ -n "$META_VERIFIED_SHA" ]] || fail 'integration-verify 기록이 없습니다.'
  [[ "$META_VERIFIED_SHA" == "$(git rev-parse HEAD)" ]] || fail '검증 이후 HEAD가 바뀌었습니다. 위험도 자동 판정을 위해 integration-verify를 실행하십시오.'
  [[ -z "$(git status --porcelain)" ]] || fail '릴리스 전 worktree가 깨끗해야 합니다.'
  note "RELEASE_OK task=$TASK_ID sha=$META_VERIFIED_SHA mode=${META_VERIFIED_MODE:-legacy-full}"
}

command_finish() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  acquire_task_lock "$TASK_ID"
  command_release_guard --task "$TASK_ID"
  local file
  for file in "$tasks_dir"/*.meta; do
    [[ -e "$file" ]] || continue
    [[ "$(field "$file" task)" == "$TASK_ID" ]] || fail "미완료 task가 남아 있습니다: $(field "$file" task)"
  done
  acquire_mutex
  load_task "$TASK_ID"
  archive_loaded_task complete
  release_mutex
  release_task_lock
  note "FINISHED task=$TASK_ID"
}

command_release() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  acquire_task_lock "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail 'submitted task는 release할 수 없습니다. 통합하거나 보존해야 합니다.'
  [[ -z "$(git status --porcelain)" ]] || fail '미커밋 변경이 있어 lease를 해제하지 않습니다.'
  [[ "$(git rev-parse HEAD)" == "$META_BASE_SHA" ]] || fail '기준 SHA 이후 커밋이 있어 lease를 해제하지 않습니다.'
  acquire_mutex
  load_task "$TASK_ID"
  archive_loaded_task cancelled
  release_mutex
  release_task_lock
  note "RELEASED task=$TASK_ID"
}

case "$command_name" in
  claim) command_claim "$@" ;;
  status) command_status "$@" ;;
  check) command_check "$@" ;;
  submit) command_submit "$@" ;;
  resubmit) command_resubmit "$@" ;;
  restack) command_restack "$@" ;;
  restack-squash) command_restack_squash "$@" ;;
  replace-submitted) command_replace_submitted inherited "$@" ;;
  replace-submitted-expanded) command_replace_submitted expanded "$@" ;;
  integrate) INTEGRATION_MODE=standard command_integrate "$@" ;;
  integrate-scoped) INTEGRATION_MODE=scoped command_integrate "$@" ;;
  integrate-batch) command_integrate_batch "$@" ;;
  verify) command_verify "$@" ;;
  finish) command_finish "$@" ;;
  release) command_release "$@" ;;
  runtime-guard) command_runtime_guard "$@" ;;
  release-guard) command_release_guard "$@" ;;
  -h|--help|help) usage ;;
  *) usage; fail "알 수 없는 command입니다: $command_name" ;;
esac
