#!/usr/bin/env bash
set -euo pipefail

readonly PROGRAM="coord-harness"

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
  coord-harness.sh integrate --task ID --integration-task ID
  coord-harness.sh verify --task ID
  coord-harness.sh finish --task ID
  coord-harness.sh release --task ID
  coord-harness.sh runtime-guard --task ID
  coord-harness.sh release-guard --task ID

Profiles: frontend, php, mixed, g7, docs, full
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

cleanup_mutex() {
  if [[ "$mutex_held" == 1 ]]; then
    rmdir "$mutex_dir" 2>/dev/null || true
    mutex_held=0
  fi
}

trap cleanup_mutex EXIT INT TERM

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

validate_task_id() {
  local value="$1"
  [[ "$value" =~ ^[a-z0-9][a-z0-9._-]{1,62}$ ]] \
    || fail "TASK는 2~63자의 소문자·숫자·점·밑줄·하이픈만 허용합니다: $value"
}

validate_profile() {
  case "$1" in
    frontend|php|mixed|g7|docs|full) ;;
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

collect_and_check_changed_paths() {
  local base_sha="$1"
  local allowed_csv="$2"
  local path
  local failed=0
  while IFS= read -r -d '' path; do
    if ! path_is_owned "$path" "$allowed_csv"; then
      printf 'OUT_OF_SCOPE\t%s\n' "$path" >&2
      failed=1
    fi
  done < <(
    git diff --name-only -z "$base_sha" --
    git ls-files --others --exclude-standard -z
  )
  [[ "$failed" == 0 ]] || fail 'claim한 PATHS 밖의 변경이 있어 제출을 중단했습니다.'
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
  case "$profile" in
    frontend)
      require_node_24
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

run_integration_profile() {
  local profile="$1"
  local integration_task="$2"
  case "$profile" in
    frontend) make quality-frontend TASK="$integration_task" ;;
    php) make quality-php TASK="$integration_task" ;;
    mixed) make dev-check TASK="$integration_task" ;;
    g7) make quality-g7 TASK="$integration_task" ;;
    docs) make quality-coordination TASK="$integration_task" && make quality-frontend TASK="$integration_task" ;;
    full) make quality-gate TASK="$integration_task" ;;
    harness)
      [[ "${G7PB_COORD_TESTING:-0}" == 1 ]] || fail 'harness profile은 시험 전용입니다.'
      ;;
    *) fail "지원하지 않는 PROFILE입니다: $profile" ;;
  esac
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
  PATHS_CSV=''
  AREAS_CSV=''
  PROFILE=''
  BASE_REF='HEAD'
  MESSAGE=''
  INTEGRATION_TASK=''
  SHOW_HISTORY=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --task) [[ $# -ge 2 ]] || fail '--task 값이 필요합니다.'; TASK_ID="$2"; shift 2 ;;
      --paths) [[ $# -ge 2 ]] || fail '--paths 값이 필요합니다.'; PATHS_CSV="$2"; shift 2 ;;
      --areas) [[ $# -ge 2 ]] || fail '--areas 값이 필요합니다.'; AREAS_CSV="$2"; shift 2 ;;
      --profile) [[ $# -ge 2 ]] || fail '--profile 값이 필요합니다.'; PROFILE="$2"; shift 2 ;;
      --base-ref) [[ $# -ge 2 ]] || fail '--base-ref 값이 필요합니다.'; BASE_REF="$2"; shift 2 ;;
      --message) [[ $# -ge 2 ]] || fail '--message 값이 필요합니다.'; MESSAGE="$2"; shift 2 ;;
      --integration-task) [[ $# -ge 2 ]] || fail '--integration-task 값이 필요합니다.'; INTEGRATION_TASK="$2"; shift 2 ;;
      --history) SHOW_HISTORY=1; shift ;;
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

assert_integration_owner() {
  local task="$1"
  load_task "$task"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail '통합 task가 active 상태가 아닙니다.'
  csv_has "$META_AREAS" integration || fail '통합 task가 integration AREA를 소유하지 않습니다.'
}

finalize_integrated_task() {
  local task="$1"
  local integration_sha="$2"
  acquire_mutex
  load_task "$task"
  [[ "$META_STATUS" == submitted ]] || fail '통합 완료 기록 전 task 상태가 변경되었습니다.'
  META_INTEGRATION_SHA="$integration_sha"
  META_INTEGRATED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  archive_loaded_task integrated
  release_mutex
}

command_integrate() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  validate_task_id "$INTEGRATION_TASK"

  assert_integration_owner "$INTEGRATION_TASK"
  local integration_profile="$META_PROFILE"
  [[ "$repo_root" == "$main_worktree" ]] || fail '통합은 기본 Local worktree에서만 허용합니다.'
  [[ -z "$(git status --porcelain)" ]] || fail '깨끗한 통합 worktree에서만 병합할 수 있습니다.'

  load_task "$TASK_ID"
  [[ "$META_STATUS" == submitted ]] || fail "submitted task만 병합할 수 있습니다: $META_STATUS"
  local task_profile="$META_PROFILE"
  local submitted_sha="$META_SUBMITTED_SHA"
  local task_worktree="$META_WORKTREE"
  local task_base="$META_BASE_SHA"
  [[ -n "$submitted_sha" ]] || fail 'submitted SHA가 없습니다.'
  git cat-file -e "$submitted_sha^{commit}" 2>/dev/null || fail 'submitted commit을 찾지 못했습니다.'
  git merge-base --is-ancestor "$task_base" "$submitted_sha" || fail 'submitted commit의 ancestry가 올바르지 않습니다.'
  [[ -d "$task_worktree" ]] || fail '제출 worktree가 없습니다. Codex snapshot을 복구한 뒤 통합하십시오.'
  [[ -z "$(git -C "$task_worktree" status --porcelain)" ]] || fail '제출 worktree에 미커밋 변경이 남아 있습니다.'
  [[ "$(git -C "$task_worktree" rev-parse HEAD)" == "$submitted_sha" ]] \
    || fail '제출 뒤 task branch HEAD가 변경되었습니다. 새 변경을 별도 task로 제출하십시오.'

  if git merge-base --is-ancestor "$submitted_sha" HEAD; then
    run_integration_profile "$task_profile" "$INTEGRATION_TASK"
    [[ -d "$task_worktree" ]] || fail '통합 검증 중 제출 Worktree가 사라졌습니다.'
    [[ -z "$(git -C "$task_worktree" status --porcelain)" \
      && "$(git -C "$task_worktree" rev-parse HEAD)" == "$submitted_sha" ]] \
      || fail '통합 검증 중 제출 Worktree가 변경되었습니다.'
    finalize_integrated_task "$TASK_ID" "$(git rev-parse HEAD)"
    note "ALREADY_INTEGRATED task=$TASK_ID sha=$submitted_sha"
    return
  fi

  local merge_tree_output
  merge_tree_output="$(mktemp "${TMPDIR:-/tmp}/g7pb-merge-tree.XXXXXX")"
  if ! git merge-tree --write-tree --messages HEAD "$submitted_sha" >"$merge_tree_output" 2>&1; then
    sed -n '1,200p' "$merge_tree_output" >&2
    rm -f "$merge_tree_output"
    fail 'merge-tree 충돌 사전검사가 실패했습니다. 자동 의미 충돌 해결은 하지 않습니다.'
  fi
  rm -f "$merge_tree_output"

  if ! git merge --no-ff --no-commit "$submitted_sha"; then
    git merge --abort >/dev/null 2>&1 || true
    fail 'Git 임시 병합이 실패했습니다.'
  fi

  if ! run_integration_profile "$task_profile" "$INTEGRATION_TASK"; then
    git merge --abort >/dev/null 2>&1 || fail '검증 실패 뒤 merge abort도 실패했습니다. 수동 복구가 필요합니다.'
    fail '통합 검증이 실패해 병합을 중단하고 원상복구했습니다.'
  fi

  if [[ ! -d "$task_worktree" \
    || -n "$(git -C "$task_worktree" status --porcelain 2>/dev/null || printf 'missing')" \
    || "$(git -C "$task_worktree" rev-parse HEAD 2>/dev/null || true)" != "$submitted_sha" ]]; then
    git merge --abort >/dev/null 2>&1 || fail '제출 Worktree 변경 감지 뒤 merge abort가 실패했습니다.'
    fail '통합 검증 중 제출 Worktree가 변경되어 병합을 중단했습니다.'
  fi

  git commit -m "merge($TASK_ID): integrate submitted worktree"
  local integration_sha
  integration_sha="$(git rev-parse HEAD)"
  finalize_integrated_task "$TASK_ID" "$integration_sha"
  note "INTEGRATED task=$TASK_ID submitted=$submitted_sha integration=$integration_sha integration_profile=$integration_profile"
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
  command_runtime_guard --task "$TASK_ID"
  local file
  for file in "$tasks_dir"/*.meta; do
    [[ -e "$file" ]] || continue
    [[ "$(field "$file" task)" == "$TASK_ID" ]] || fail "미완료 task가 남아 있어 전체 검증을 중단합니다: $(field "$file" task)"
  done
  [[ -z "$(git status --porcelain)" ]] || fail '전체 검증 전 통합 worktree가 깨끗해야 합니다.'

  if [[ "${G7PB_COORD_TESTING:-0}" == 1 ]]; then
    note 'TEST_MODE quality-gate skipped'
  else
    make quality-gate TASK="$TASK_ID"
  fi

  acquire_mutex
  load_task "$TASK_ID"
  META_VERIFIED_SHA="$(git rev-parse HEAD)"
  META_VERIFIED_AT="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  write_task "$META_FILE"
  release_mutex
  note "VERIFIED task=$TASK_ID sha=$META_VERIFIED_SHA"
}

command_release_guard() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  command_runtime_guard --task "$TASK_ID"
  load_task "$TASK_ID"
  [[ -n "$META_VERIFIED_SHA" ]] || fail 'integration-verify 기록이 없습니다.'
  [[ "$META_VERIFIED_SHA" == "$(git rev-parse HEAD)" ]] || fail '검증 이후 HEAD가 바뀌었습니다. integration-verify를 다시 실행하십시오.'
  [[ -z "$(git status --porcelain)" ]] || fail '릴리스 전 worktree가 깨끗해야 합니다.'
  note "RELEASE_OK task=$TASK_ID sha=$META_VERIFIED_SHA"
}

command_finish() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
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
  note "FINISHED task=$TASK_ID"
}

command_release() {
  parse_common_args "$@"
  validate_task_id "$TASK_ID"
  load_task "$TASK_ID"
  assert_task_owner
  [[ "$META_STATUS" == active ]] || fail 'submitted task는 release할 수 없습니다. 통합하거나 보존해야 합니다.'
  [[ -z "$(git status --porcelain)" ]] || fail '미커밋 변경이 있어 lease를 해제하지 않습니다.'
  [[ "$(git rev-parse HEAD)" == "$META_BASE_SHA" ]] || fail '기준 SHA 이후 커밋이 있어 lease를 해제하지 않습니다.'
  acquire_mutex
  load_task "$TASK_ID"
  archive_loaded_task cancelled
  release_mutex
  note "RELEASED task=$TASK_ID"
}

case "$command_name" in
  claim) command_claim "$@" ;;
  status) command_status "$@" ;;
  check) command_check "$@" ;;
  submit) command_submit "$@" ;;
  integrate) command_integrate "$@" ;;
  verify) command_verify "$@" ;;
  finish) command_finish "$@" ;;
  release) command_release "$@" ;;
  runtime-guard) command_runtime_guard "$@" ;;
  release-guard) command_release_guard "$@" ;;
  -h|--help|help) usage ;;
  *) usage; fail "알 수 없는 command입니다: $command_name" ;;
esac
