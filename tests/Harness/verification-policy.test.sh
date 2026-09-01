#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
harness="$root/scripts/coord-harness.sh"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-verification-policy.XXXXXX")"
trap 'rm -rf -- "$temp_root"' EXIT
repo="$temp_root/repo"
hook="$temp_root/scoped-hook.sh"
hook_record="$temp_root/scoped-hook.tsv"

fail() {
  printf 'verification-policy.test: %s\n' "$*" >&2
  exit 1
}

run_harness() {
  (
    cd "$repo"
    G7PB_COORD_TESTING=1 "$harness" "$@"
  )
}

run_harness_with_hook() {
  (
    cd "$repo"
    G7PB_COORD_TESTING=1 \
    G7PB_COORD_TEST_SCOPED_VERIFY_HOOK="$hook" \
    G7PB_COORD_TEST_SCOPED_VERIFY_RECORD="$hook_record" \
      "$harness" "$@"
  )
}

meta_field() {
  local file="$1"
  local key="$2"
  awk -F '\t' -v wanted="$key" '$1 == wanted { print $2; exit }' "$file"
}

git init -b main "$repo" >/dev/null
git -C "$repo" config user.name 'Verification Policy Test'
git -C "$repo" config user.email 'verification-policy@example.test'
mkdir -p "$repo/docs" "$repo/src/Application"
printf 'base\n' > "$repo/docs/guide.md"
printf 'base\n' > "$repo/src/Application/runtime.php"
git -C "$repo" add .
git -C "$repo" commit -m 'test: base' >/dev/null

cat > "$hook" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" >> "$G7PB_COORD_TEST_SCOPED_VERIFY_RECORD"
HOOK
chmod +x "$hook"

run_harness claim --task integration-full --areas integration,runtime --profile harness >/dev/null
first_output="$(run_harness verify --task integration-full)"
printf '%s\n' "$first_output" | grep -q 'mode=full.*reason=no-trusted-baseline' \
  || fail 'first verification did not require a full baseline'
first_sha="$(git -C "$repo" rev-parse HEAD)"
first_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-full.meta"
[[ "$(meta_field "$first_meta" verified_mode)" == full ]] \
  || fail 'full verification mode was not recorded'
run_harness finish --task integration-full >/dev/null

printf 'docs-only\n' >> "$repo/docs/guide.md"
git -C "$repo" add docs/guide.md
git -C "$repo" commit -m 'docs: scoped verification candidate' >/dev/null
run_harness claim --task integration-docs --areas integration,runtime --profile harness >/dev/null
docs_output="$(run_harness_with_hook verify --task integration-docs)"
printf '%s\n' "$docs_output" | grep -q 'mode=scoped.*changed=1' \
  || fail 'docs-only change did not select scoped verification'
[[ "$(wc -l < "$hook_record" | tr -d ' ')" == 1 ]] \
  || fail 'scoped verification hook did not run exactly once'
docs_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-docs.meta"
[[ "$(meta_field "$docs_meta" verified_mode)" == scoped ]] \
  || fail 'scoped verification mode was not recorded'
[[ "$(meta_field "$docs_meta" verified_base_sha)" == "$first_sha" ]] \
  || fail 'scoped verification did not bind to the latest trusted SHA'
run_harness release-guard --task integration-docs >/dev/null
run_harness finish --task integration-docs >/dev/null

printf '<?php return true;\n' > "$repo/src/Application/runtime.php"
git -C "$repo" add src/Application/runtime.php
git -C "$repo" commit -m 'feat: runtime verification candidate' >/dev/null
run_harness claim --task integration-runtime --areas integration,runtime --profile harness >/dev/null
runtime_output="$(run_harness_with_hook verify --task integration-runtime)"
printf '%s\n' "$runtime_output" | grep -q 'mode=full.*trigger=src/Application/runtime.php' \
  || fail 'runtime change did not escalate to full verification'
[[ "$(wc -l < "$hook_record" | tr -d ' ')" == 1 ]] \
  || fail 'full verification incorrectly executed the scoped hook'
runtime_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-runtime.meta"
[[ "$(meta_field "$runtime_meta" verified_mode)" == full ]] \
  || fail 'runtime full verification mode was not recorded'
run_harness finish --task integration-runtime >/dev/null

run_harness claim --task integration-reuse --areas integration,runtime --profile harness >/dev/null
reuse_output="$(run_harness_with_hook verify --task integration-reuse)"
printf '%s\n' "$reuse_output" | grep -q 'VERIFY_REUSED.*source_mode=full' \
  || fail 'identical HEAD did not reuse the latest verification'
[[ "$(wc -l < "$hook_record" | tr -d ' ')" == 1 ]] \
  || fail 'verification reuse executed another scoped gate'
run_harness release-guard --task integration-reuse >/dev/null
run_harness finish --task integration-reuse >/dev/null

printf 'verification-policy.test: PASS full-baseline scoped-docs full-runtime reuse-head\n'
