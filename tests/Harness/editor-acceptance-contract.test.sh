#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-editor-acceptance.XXXXXX")"
trap 'rm -rf "$fixture_root"' EXIT

copy_fixture() {
  rm -rf "$fixture_root/fixture"
  mkdir -p "$fixture_root/fixture/scripts" "$fixture_root/fixture/tests/E2E"
  cp "$repo_root/package.json" "$fixture_root/fixture/package.json"
  cp "$repo_root/Makefile" "$fixture_root/fixture/Makefile"
  cp "$repo_root/scripts/coord-harness.sh" "$fixture_root/fixture/scripts/coord-harness.sh"
  cp "$repo_root/tests/E2E/editorInteractionQuality.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
}

expect_failure() {
  local expected="$1"
  if node "$repo_root/scripts/check-editor-acceptance-contract.mjs" --root "$fixture_root/fixture" \
    >"$fixture_root/stdout" 2>"$fixture_root/stderr"; then
    echo "Expected editor acceptance contract failure: $expected" >&2
    exit 1
  fi
  grep -Fq "$expected" "$fixture_root/stderr" || {
    echo "Missing failure message: $expected" >&2
    sed -n '1,120p' "$fixture_root/stderr" >&2
    exit 1
  }
}

node "$repo_root/scripts/check-editor-acceptance-contract.mjs" --root "$repo_root"

copy_fixture
perl -0pi -e 's/page\.mouse\.down\s*\(/page.mouse.click(/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 pointer 선택을 위한 page.mouse.down이 필요합니다.'

copy_fixture
perl -0pi -e 's/field\.click\(\{ position: pointer\.end \}\)/field.focus()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 해제도 iframe 내부 실제 pointer click으로 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/CANVAS_VIEWPORT_GATE/CANVAS_VIEWPORT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'browser project와 내부 canvas viewport 일치 gate가 필요합니다.'

copy_fixture
perl -0pi -e "s/projectName === 'mobile' \? 360 : projectName === 'tablet' \? 768 : 1280/1280/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '각 browser project에 맞는 360/768/1280 canvas 폭을 선택해야 합니다.'

copy_fixture
perl -0pi -e "s/frameLocator\\('iframe'\\)\\.first\\(\\)/frameLocator('iframe')/g" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '활성 편집 canvas iframe을 명시적으로 고정해야 합니다.'

copy_fixture
perl -0pi -e 's/field\.hover\(\{ position: pointer\.end \}\)/field.focus()/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'iframe 내부 선택 끝점에 실제 pointer hover가 필요합니다.'

copy_fixture
printf '\nselection.addRange(range);\n' >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Selection.addRange로 선택 범위를 합성하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/PUBLIC_SELECTION_MARK_GATE/PUBLIC_MARK_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '공개 출력 부분 서식 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's# ?tests/E2E/editorInteractionQuality\.spec\.ts##' "$fixture_root/fixture/package.json"
expect_failure 'test:e2e:product가 tests/E2E/editorInteractionQuality.spec.ts를 반드시 실행해야 합니다.'

echo 'editor-acceptance-contract: PASS'
