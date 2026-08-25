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
expect_failure '선택 해제도 iframe 축척을 반영한 실제 pointer click으로 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/CANVAS_VIEWPORT_GATE/CANVAS_VIEWPORT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'browser project와 내부 canvas viewport 일치 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/BLOCK_SELECTION_GATE/BLOCK_SELECTION_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 글자 드래그 전에 편집 블록 선택 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/toHaveClass\(\/Layer--isSelected\/\)/toBeVisible()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Outline layer의 실제 선택 class를 확인해야 합니다.'

copy_fixture
perl -0pi -e "s/projectName === 'mobile' \? 360 : projectName === 'tablet' \? 768 : 1280/1280/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '각 browser project에 맞는 360/768/1280 canvas 폭을 선택해야 합니다.'

copy_fixture
perl -0pi -e "s/#puck-canvas-root iframe/iframe/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Puck canvas 고유 iframe selector를 고정해야 합니다.'

copy_fixture
perl -0pi -e 's/field\.hover\(\{ position: pointer\.end \}\)/field.focus()/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'iframe 축척을 반영한 실제 pointer 범위 드래그가 필요합니다.'

copy_fixture
perl -0pi -e 's/field\.click\(\{ position: pointer\.start \}\)/field.focus()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '범위 선택 전 contenteditable을 실제 pointer click으로 활성화해야 합니다.'

copy_fixture
perl -0pi -e 's/INTERACTIVE_CANVAS_GATE/INTERACTIVE_CANVAS_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 iframe의 상호작용 가능 크기 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/const scaleX = box\.width \/ geometry\.fieldWidth;/const scaleX = 1;/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'iframe의 실제 가로 축척을 pointer 좌표에 반영해야 합니다.'

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
