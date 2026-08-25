#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-editor-acceptance.XXXXXX")"
trap 'rm -rf "$fixture_root"' EXIT

copy_fixture() {
  rm -rf "$fixture_root/fixture"
  mkdir -p "$fixture_root/fixture/scripts" "$fixture_root/fixture/tests/E2E" \
    "$fixture_root/fixture/resources/js/editor"
  cp "$repo_root/package.json" "$fixture_root/fixture/package.json"
  cp "$repo_root/Makefile" "$fixture_root/fixture/Makefile"
  cp "$repo_root/scripts/coord-harness.sh" "$fixture_root/fixture/scripts/coord-harness.sh"
  cp "$repo_root/tests/E2E/editorInteractionQuality.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
  cp "$repo_root/resources/js/editor/richTextEditing.tsx" \
    "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
  cp "$repo_root/resources/js/editor/PuckEditorAdapter.tsx" \
    "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
  cp "$repo_root/resources/js/editor/canvasEditingContract.ts" \
    "$fixture_root/fixture/resources/js/editor/canvasEditingContract.ts"
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
expect_failure '선택 해제도 실제 locator 좌표의 pointer click으로 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/CANVAS_VIEWPORT_GATE/CANVAS_VIEWPORT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'browser project와 내부 canvas viewport 일치 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/POINTER_CANVAS_GATE/POINTER_CANVAS_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 글자 드래그 전에 pointer canvas 확보 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/expect\(library\)\.toBeHidden\(\)/expect(library).toBeVisible()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'pointer canvas 확보 뒤 블록 라이브러리 닫힘을 확인해야 합니다.'

copy_fixture
perl -0pi -e 's/TABLET_HEADER_HEIGHT_GATE/TABLET_HEADER_HEIGHT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '태블릿 Puck header 높이 회귀 gate가 필요합니다.'

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
expect_failure 'iframe 축척을 반영한 locator pointer 범위 드래그가 필요합니다.'

copy_fixture
perl -0pi -e 's/await field\.focus\(\);/await page.keyboard.press("Tab");/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '범위 선택 전 contenteditable focus가 필요합니다.'

copy_fixture
perl -0pi -e 's/INTERACTIVE_CANVAS_GATE/INTERACTIVE_CANVAS_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 iframe의 상호작용 가능 크기 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/const scaleX = box\.width \/ geometry\.fieldWidth;/const scaleX = 1;/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'iframe의 실제 가로 축척을 pointer 좌표에 반영해야 합니다.'

copy_fixture
perl -0pi -e 's/x: geometry\.startX \* scaleX/x: geometry.startX/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 시작점을 실제 locator 좌표로 변환해야 합니다.'

copy_fixture
printf '\nconsole.log("temporary geometry");\n' >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '전용 E2E에 임시 진단 로그를 남기면 안 됩니다.'

copy_fixture
printf '\nselection.addRange(range);\n' >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Selection.addRange로 선택 범위를 합성하면 안 됩니다.'

copy_fixture
printf '\nnormalizePointerRangeWithKeyboard();\n' >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'pointer 범위를 키보드로 보정하면 안 됩니다.'

copy_fixture
printf '\nrangeToolbar.getByTestId("page-builder-richtext-font").selectOption("serif");\n' \
  >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 툴바는 selectOption 직접 주입이 아니라 실제 사용자 조작으로 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\)/expect.poll(() => selectedText(field)).toContain(target)/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'mouse up 직후 선택 문자열이 목표 문자열과 정확히 같은지 확인해야 합니다.'

copy_fixture
perl -0pi -e 's/g7pb:richtext-range-state/g7pb:richtext-range-active/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 범위 active/inactive 단일 메시지 계약이 필요합니다.'

copy_fixture
perl -0pi -e 's/setTextSelection\(bookmark\)/setTextSelection(editor.state.selection.to)/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '툴바 명령 전에 저장한 선택 범위를 복원해야 합니다.'

copy_fixture
perl -0pi -e 's/onMouseDownCapture=\{preserveRangeBeforeToolbarAction\}//' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '툴바 mouse down에서 선택 범위 붕괴를 차단해야 합니다.'

copy_fixture
printf '\nconst rangeEditing = window.getSelection();\n' \
  >>"$fixture_root/fixture/resources/js/editor/canvasEditingContract.ts"
expect_failure '요소 선택 계약에서 DOM Selection으로 범위 상태를 중복 추론하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/PUBLIC_SELECTION_MARK_GATE/PUBLIC_MARK_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '공개 출력 부분 서식 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's# ?tests/E2E/editorInteractionQuality\.spec\.ts##' "$fixture_root/fixture/package.json"
expect_failure 'test:e2e:product가 tests/E2E/editorInteractionQuality.spec.ts를 반드시 실행해야 합니다.'

echo 'editor-acceptance-contract: PASS'
