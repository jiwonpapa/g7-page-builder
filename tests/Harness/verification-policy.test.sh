#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
harness="$root/scripts/coord-harness.sh"
quality_scoped="$root/scripts/quality-scoped.sh"
temp_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-verification-policy.XXXXXX")"
trap 'rm -rf -- "$temp_root"' EXIT
repo="$temp_root/repo"
hook="$temp_root/scoped-hook.sh"
hook_record="$temp_root/scoped-hook.tsv"
profile_hook="$temp_root/profile-hook.sh"
profile_record="$temp_root/profile-hook.tsv"

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
    G7PB_COORD_TEST_INTEGRATION_PROFILE_HOOK="$profile_hook" \
    G7PB_COORD_TEST_PROFILE_RECORD="$profile_record" \
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
mkdir -p "$repo/docs" "$repo/src/Application" "$repo/resources/js" "$repo/database/migrations"
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

cat > "$profile_hook" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\t%s\t%s\n' "$1" "$2" "$3" >> "$G7PB_COORD_TEST_PROFILE_RECORD"
HOOK
chmod +x "$profile_hook"

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
printf '%s\n' "$runtime_output" | grep -q 'mode=php.*changed=1' \
  || fail 'application PHP change did not select the PHP profile'
[[ "$(wc -l < "$hook_record" | tr -d ' ')" == 1 ]] \
  || fail 'PHP verification incorrectly executed the scoped hook'
[[ "$(awk -F '\t' 'NR == 1 { print $1 }' "$profile_record")" == php ]] \
  || fail 'PHP verification did not execute the PHP profile hook'
runtime_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-runtime.meta"
[[ "$(meta_field "$runtime_meta" verified_mode)" == php ]] \
  || fail 'PHP verification mode was not recorded'
run_harness finish --task integration-runtime >/dev/null

printf 'export const editor = true;\n' > "$repo/resources/js/editor.ts"
git -C "$repo" add resources/js/editor.ts
git -C "$repo" commit -m 'feat: frontend verification candidate' >/dev/null
run_harness claim --task integration-frontend --areas integration,runtime --profile harness >/dev/null
frontend_output="$(run_harness_with_hook verify --task integration-frontend)"
printf '%s\n' "$frontend_output" | grep -q 'mode=frontend.*changed=1' \
  || fail 'frontend-only change did not select the frontend profile'
[[ "$(awk -F '\t' 'NR == 2 { print $1 }' "$profile_record")" == frontend ]] \
  || fail 'frontend verification did not execute the frontend profile hook'
frontend_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-frontend.meta"
[[ "$(meta_field "$frontend_meta" verified_mode)" == frontend ]] \
  || fail 'frontend verification mode was not recorded'
run_harness finish --task integration-frontend >/dev/null

printf '<?php return [];\n' > "$repo/database/migrations/0001.php"
git -C "$repo" add database/migrations/0001.php
git -C "$repo" commit -m 'feat: migration verification candidate' >/dev/null
run_harness claim --task integration-migration --areas integration,runtime --profile harness >/dev/null
migration_output="$(run_harness_with_hook verify --task integration-migration)"
printf '%s\n' "$migration_output" | grep -q 'mode=full.*trigger=database/migrations/0001.php' \
  || fail 'migration change did not escalate to full verification'
[[ "$(wc -l < "$profile_record" | tr -d ' ')" == 2 ]] \
  || fail 'full migration verification executed a narrower profile hook'
migration_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-migration.meta"
[[ "$(meta_field "$migration_meta" verified_mode)" == full ]] \
  || fail 'migration full verification mode was not recorded'
run_harness finish --task integration-migration >/dev/null

run_harness claim --task integration-reuse --areas integration,runtime --profile harness >/dev/null
reuse_output="$(run_harness_with_hook verify --task integration-reuse)"
printf '%s\n' "$reuse_output" | grep -q 'VERIFY_REUSED.*source_mode=full' \
  || fail 'identical HEAD did not reuse the latest verification'
[[ "$(wc -l < "$hook_record" | tr -d ' ')" == 1 ]] \
  || fail 'verification reuse executed another scoped gate'
run_harness release-guard --task integration-reuse >/dev/null
run_harness finish --task integration-reuse >/dev/null

run_harness claim --task integration-explicit-full --areas integration,runtime --profile harness >/dev/null
explicit_output="$(run_harness_with_hook verify --task integration-explicit-full --full)"
printf '%s\n' "$explicit_output" | grep -q 'mode=full.*trigger=explicit-full' \
  || fail 'explicit full verification did not override HEAD reuse'
explicit_meta="$repo/.git/g7pb-coordination-v1/tasks/integration-explicit-full.meta"
[[ "$(meta_field "$explicit_meta" verified_mode)" == full ]] \
  || fail 'explicit full verification mode was not recorded'
run_harness finish --task integration-explicit-full >/dev/null

receipt_repo="$temp_root/receipt-repo"
receipt_dir="$temp_root/receipts"
git init -b main "$receipt_repo" >/dev/null
git -C "$receipt_repo" config user.name 'Verification Receipt Test'
git -C "$receipt_repo" config user.email 'verification-receipt@example.test'
mkdir -p "$receipt_repo/scripts" "$receipt_dir"
printf '#!/usr/bin/env bash\ntrue\n' > "$receipt_repo/scripts/sample.sh"
chmod +x "$receipt_repo/scripts/sample.sh"
git -C "$receipt_repo" add .
git -C "$receipt_repo" commit -m 'test: receipt base' >/dev/null
receipt_base="$(git -C "$receipt_repo" rev-parse HEAD)"
printf '#!/usr/bin/env bash\nset -euo pipefail\ntrue\n' > "$receipt_repo/scripts/sample.sh"
git -C "$receipt_repo" add scripts/sample.sh
git -C "$receipt_repo" commit -m 'test: receipt candidate' >/dev/null
receipt_head="$(git -C "$receipt_repo" rev-parse HEAD)"
receipt_tree="$(git -C "$receipt_repo" rev-parse HEAD^{tree})"
integration_receipt_output="$(
  cd "$receipt_repo"
  G7PB_SCOPED_RECEIPT_DIR="$receipt_dir" \
  G7PB_SCOPED_CANDIDATE_TREE="$receipt_tree" \
    bash "$quality_scoped" integration "$receipt_base" "$receipt_head" receipt-task ''
)"
printf '%s\n' "$integration_receipt_output" | grep -q 'PASSED gate=script-syntax' \
  || fail 'integration did not create the focused gate receipt'
verification_receipt_output="$(
  cd "$receipt_repo"
  G7PB_SCOPED_RECEIPT_DIR="$receipt_dir" \
  G7PB_SCOPED_CANDIDATE_TREE="$receipt_tree" \
    bash "$quality_scoped" verification "$receipt_base" "$receipt_head" receipt-task ''
)"
printf '%s\n' "$verification_receipt_output" | grep -q 'REUSED gate=script-syntax' \
  || fail 'verification repeated an already successful candidate-tree gate'

printf 'verification-policy.test: PASS full-baseline scoped-docs php-application frontend-resource full-migration reuse-head explicit-full receipt-reuse\n'
