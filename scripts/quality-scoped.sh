#!/usr/bin/env bash
set -euo pipefail

fail() {
  printf 'quality-scoped: %s\n' "$*" >&2
  exit 1
}

note() {
  printf 'quality-scoped: %s\n' "$*"
}

[[ $# -ge 2 ]] || fail 'usage: quality-scoped.sh submission BASE_SHA | integration BASE_SHA SUBMITTED_SHA TASK AREAS'

mode="$1"
base_sha="$2"
submitted_sha="${3:-}"
integration_task="${4:-}"
areas="${5:-}"
root="$(git rev-parse --show-toplevel)"
cd "$root"
git cat-file -e "$base_sha^{commit}" 2>/dev/null || fail "base commit not found: $base_sha"

changed=()
while IFS= read -r path; do
  [[ -n "$path" ]] && changed+=("$path")
done < <(
  git diff --name-only "$base_sha" --
  if [[ "$mode" == submission ]]; then
    git ls-files --others --exclude-standard
  fi
)
[[ "${#changed[@]}" -gt 0 ]] || fail 'no changed paths'

php_sources=()
php_tests=()
ts_sources=()
ts_tests=()
css_files=()
harness_tests=()
needs_evidence=0
needs_store=0
needs_version=0
needs_phase7_quality=0
phase7_quality_test_changed=0
for path in "${changed[@]}"; do
  case "$path" in
    tests/UnitPhp/*.php|tests/Integration/*.php|tests/Integration/**/*.php)
      php_tests+=("$path") ;;
    *.php)
      php_sources+=("$path") ;;
    tests/Unit/*.test.ts|tests/Unit/*.test.tsx)
      ts_tests+=("$path") ;;
    *.ts|*.tsx)
      ts_sources+=("$path") ;;
    *.css)
      css_files+=("$path") ;;
  esac
  case "$path" in
    tests/Harness/*.test.sh) harness_tests+=("$path") ;;
    resources/block-packs/*|docs/productization/inventory.json|tests/Fixtures/block-quality-states.json)
      needs_evidence=1 ;;
    resources/store/*|schemas/official-store-catalog.schema.json|schemas/page-kit-manifest.schema.json)
      needs_store=1 ;;
    module.json|package.json|package-lock.json|CHANGELOG.md)
      needs_version=1 ;;
    resources/block-packs/builtin-core/manifest.json|docs/productization/phase-7-ledger.json)
      needs_phase7_quality=1 ;;
    tests/Unit/phase7PresetQuality.test.ts)
      phase7_quality_test_changed=1 ;;
  esac
done

receipt_root="${G7PB_SCOPED_RECEIPT_DIR:-}"
candidate_tree="${G7PB_SCOPED_CANDIDATE_TREE:-}"
gate() {
  local name="$1"
  shift
  local receipt=''
  if [[ "$mode" == integration ]]; then
    [[ "$candidate_tree" =~ ^[a-f0-9]{40,64}$ ]] || fail 'integration candidate tree is missing'
    [[ -n "$receipt_root" ]] || fail 'integration receipt directory is missing'
    mkdir -p "$receipt_root"
    receipt="$receipt_root/$candidate_tree.v1.$name.ok"
    if [[ -f "$receipt" ]]; then
      note "REUSED gate=$name tree=$candidate_tree"
      return 0
    fi
  fi
  "$@"
  if [[ -n "$receipt" ]]; then
    local staged="$receipt.$$.stage"
    printf 'tree\t%s\ngate\t%s\ncompleted_at\t%s\n' \
      "$candidate_tree" "$name" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$staged"
    mv "$staged" "$receipt"
  fi
  note "PASSED gate=$name"
}

run_diff_check() {
  git diff --check "$base_sha" --
}

run_php_submission() {
  composer validate --no-check-publish
  local files=()
  if (( ${#php_sources[@]} > 0 )); then
    files+=("${php_sources[@]}")
  fi
  if (( ${#php_tests[@]} > 0 )); then
    files+=("${php_tests[@]}")
  fi
  [[ "${#files[@]}" == 0 ]] || vendor/bin/pint --test "${files[@]}"
  [[ "${#php_sources[@]}" == 0 ]] \
    || vendor/bin/phpstan analyse -c phpstan.neon.dist --memory-limit=1G --no-progress "${php_sources[@]}"
  [[ "${#php_tests[@]}" == 0 ]] || vendor/bin/phpunit "${php_tests[@]}"
}

run_frontend_submission() {
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" == 24 ]] || fail "Node 24 required; current=$(node --version)"
  [[ "${#ts_sources[@]}" == 0 ]] || npm run typecheck
  [[ "${#ts_sources[@]}" == 0 || "${#ts_tests[@]}" -gt 0 ]] \
    || fail 'changed TypeScript source requires a changed focused unit test in the same task'
  [[ "${#ts_tests[@]}" == 0 ]] || npx vitest run "${ts_tests[@]}"
  [[ "${#css_files[@]}" == 0 ]] || npx stylelint "${css_files[@]}"
}

run_harness_submission() {
  local test_file
  for test_file in "${harness_tests[@]}"; do
    bash "$test_file"
  done
}

compose=(docker compose --project-name g7pb-dev --env-file .env.docker.local -f compose.yaml)
module_dir=/var/www/g7/modules/jiwonpapa-page_builder

run_runtime_sync() {
  make runtime-guard TASK="$integration_task"
  ./scripts/dev-sync-module.sh
}

run_g7_phpstan() {
  [[ "${#php_sources[@]}" -gt 0 ]] || return 0
  "${compose[@]}" exec -T --user "$(id -u):$(id -g)" \
    -w "$module_dir" -e COMPOSER_HOME=/tmp/g7pb-composer-home dev \
    vendor/bin/phpstan analyse --autoload-file=/var/www/g7/vendor/autoload.php \
      -c phpstan-g7.neon.dist --memory-limit=1G --no-progress "${php_sources[@]}"
}

run_g7_tests() {
  [[ "${#php_tests[@]}" -gt 0 ]] || return 0
  "${compose[@]}" exec -T --user "$(id -u):$(id -g)" \
    -w "$module_dir" -e COMPOSER_HOME=/tmp/g7pb-composer-home dev \
    vendor/bin/phpunit --bootstrap tests/Integration/bootstrap.php "${php_tests[@]}"
}

run_evidence_check() {
  /usr/bin/env PATH=/opt/homebrew/opt/node@24/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin \
    npm run check:block-quality-evidence
}

run_store_check() {
  bash scripts/check-official-store-build.sh
}

run_version_check() {
  /usr/bin/env PATH=/opt/homebrew/opt/node@24/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin \
    npm run check:version
}

run_phase7_quality() {
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  [[ "$major" == 24 ]] || fail "Node 24 required; current=$(node --version)"
  npx vitest run tests/Unit/phase7PresetQuality.test.ts
}

case "$mode" in
  submission)
    gate diff-check run_diff_check
    if [[ "${#php_sources[@]}" -gt 0 || "${#php_tests[@]}" -gt 0 ]]; then
      gate php-focused run_php_submission
    fi
    if [[ "${#ts_sources[@]}" -gt 0 || "${#ts_tests[@]}" -gt 0 || "${#css_files[@]}" -gt 0 ]]; then
      gate frontend-focused run_frontend_submission
    fi
    [[ "${#harness_tests[@]}" == 0 ]] || gate harness-focused run_harness_submission
    [[ "$needs_evidence" == 0 ]] || gate evidence run_evidence_check
    [[ "$needs_store" == 0 ]] || gate store run_store_check
    [[ "$needs_version" == 0 ]] || gate version run_version_check
    [[ "$needs_phase7_quality" == 0 || "$phase7_quality_test_changed" == 1 ]] \
      || gate phase7-quality run_phase7_quality
    ;;
  integration)
    [[ -n "$submitted_sha" && -n "$integration_task" ]] \
      || fail 'integration requires submitted SHA and integration task'
    [[ "$(git rev-parse "$submitted_sha^{commit}")" == "$submitted_sha" ]] \
      || fail 'submitted SHA is invalid'
    if [[ "$areas" == *migration* || "$areas" == *shared-contract* || "${#php_sources[@]}" -gt 0 ]]; then
      gate runtime-sync run_runtime_sync
      gate g7-phpstan run_g7_phpstan
      gate g7-focused-tests run_g7_tests
    fi
    [[ "$needs_evidence" == 0 ]] || gate evidence run_evidence_check
    [[ "$needs_store" == 0 ]] || gate store run_store_check
    [[ "$needs_version" == 0 ]] || gate version run_version_check
    ;;
  *) fail "unsupported mode: $mode" ;;
esac

note "OK mode=$mode changed=${#changed[@]} php=${#php_sources[@]} php_tests=${#php_tests[@]} ts=${#ts_sources[@]} ts_tests=${#ts_tests[@]} css=${#css_files[@]}"
