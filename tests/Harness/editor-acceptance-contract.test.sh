#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-editor-acceptance.XXXXXX")"
trap 'rm -rf "$fixture_root"' EXIT

copy_fixture() {
  rm -rf "$fixture_root/fixture"
  mkdir -p "$fixture_root/fixture/scripts" "$fixture_root/fixture/tests/E2E/support" \
    "$fixture_root/fixture/resources/js/editor"
  cp "$repo_root/package.json" "$fixture_root/fixture/package.json"
  cp "$repo_root/playwright.config.ts" "$fixture_root/fixture/playwright.config.ts"
  cp "$repo_root/Makefile" "$fixture_root/fixture/Makefile"
  cp "$repo_root/scripts/coord-harness.sh" "$fixture_root/fixture/scripts/coord-harness.sh"
  cp "$repo_root/tests/E2E/editorInteractionQuality.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
  cp "$repo_root/tests/E2E/editorLayoutParity.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
  cp "$repo_root/tests/E2E/support/editorInteractionFixture.ts" \
    "$fixture_root/fixture/tests/E2E/support/editorInteractionFixture.ts"
  cp "$repo_root/resources/js/editor/richTextEditing.tsx" \
    "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
  cp "$repo_root/resources/js/editor/PuckEditorAdapter.tsx" \
    "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
  cp "$repo_root/resources/js/editor/canvasEditingContract.ts" \
    "$fixture_root/fixture/resources/js/editor/canvasEditingContract.ts"
  cp "$repo_root/resources/js/editor/editorViewportPolicy.ts" \
    "$fixture_root/fixture/resources/js/editor/editorViewportPolicy.ts"
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
perl -0pi -e "s/screenshot: 'only-on-failure'/screenshot: 'off'/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '전용 E2E 실패에는 실제 픽셀 상태를 확인할 스크린샷을 남겨야 합니다.'

copy_fixture
perl -0pi -e 's/page\.mouse\.down\s*\(/page.mouse.click(/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 pointer 선택을 위한 page.mouse.down이 필요합니다.'

copy_fixture
perl -0pi -e 's/(function collapseSelectionWithPointer[\s\S]*?)await page\.mouse\.click\(point\.x, point\.y\);/$1await field.focus();/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 해제는 같은 current field의 선택 substring 밖 실제 prefix/suffix 픽셀을 클릭해 빈 범위를 확인해야 합니다.'

copy_fixture
perl -0pi -e 's/PC_ONLY_EDITING_GATE/PC_ONLY_EDITING_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 편집 E2E에 PC 전용 편집 모드 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/POINTER_CANVAS_GATE/POINTER_CANVAS_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 글자 드래그 전에 pointer canvas 확보 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/expect\(library\)\.toBeHidden\(\)/expect(library).toBeVisible()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'pointer canvas 확보 뒤 블록 라이브러리 닫힘을 확인해야 합니다.'

copy_fixture
perl -0pi -e "s/#puck-canvas-root iframe/iframe/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Puck canvas 고유 iframe selector를 고정해야 합니다.'

copy_fixture
perl -0pi -e 's/page\.mouse\.move\(pointer\.end\.x, pointer\.end\.y, \{ steps: POINTER_DRAG_STEPS \}\)/field.focus()/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'force 없이 여러 실제 mouse move 단계로 pointer 종료점에 이동해야 합니다.'

copy_fixture
perl -0pi -e 's/await assertTextPointerReachable\(page, field, pointer\);/await Promise.resolve();/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'pointer down 전에 상위 문서와 iframe 내부 start/end hit target을 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/if \(attempt > 0\) await collapseSelectionWithPointer\(page, selection\);/if (attempt > 0) await field.focus();/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 재시도는 기존 범위를 실제 포인터 클릭으로 접은 뒤 current locator를 다시 찾아야 합니다.'

copy_fixture
perl -0pi -e 's/document\.elementsFromPoint\(point\.x, point\.y\)/[document.body]/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '텍스트 포인터 실패는 editor·iframe pointer 상태와 실제 hit stack·canvas hit를 보고해야 합니다.'

copy_fixture
perl -0pi -e 's/(function collapseSelectionWithPointer[\s\S]*?)await findFieldCollapsePoints\(page, field, targetNode, currentSelection\)/$1await Promise.resolve([{ x: 0, y: 0 }])/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 해제는 같은 current field의 선택 substring 밖 실제 prefix/suffix 픽셀을 클릭해 빈 범위를 확인해야 합니다.'

copy_fixture
perl -0pi -e 's/: canvasHits\[index\]\?\.selectedRectHit === false/: canvasHits[index]?.selectedRectHit === true/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 해제 좌표는 선택 substring 바깥 prefix/suffix Range rect이면서 field 내부·툴바 밖인 실제 픽셀이어야 합니다.'

copy_fixture
perl -0pi -e "s/source: 'selected-fallback' as const/source: 'suffix' as const/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '필드 전체 선택은 prefix/suffix가 없을 때만 선택 Range 내부의 실제 문자 픽셀 클릭으로 접어야 합니다.'

copy_fixture
printf '\nfield.click({ force: true });\n' >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '전용 편집 E2E는 force click/hover로 실제 hit target 검증을 우회하면 안 됩니다.'

copy_fixture
printf '\nfield.focus();\n' >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '전용 편집 E2E는 프로그램식 focus가 아니라 실제 pointerdown으로 contenteditable focus를 만들어야 합니다.'

copy_fixture
perl -0pi -e 's/INTERACTIVE_CANVAS_GATE/INTERACTIVE_CANVAS_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '실제 iframe의 상호작용 가능 크기 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/targetNode\.boundingBox\(\)/field.boundingBox()/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 대상의 실제 렌더링 box를 측정해야 합니다.'

copy_fixture
perl -0pi -e 's/firstCharacter\.getClientRects\(\)/[]/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 시작·끝은 실제 글자 rect와 정확한 caret offset으로 측정해야 합니다.'

copy_fixture
perl -0pi -e 's/startCandidate\.x - fieldRect\.left/0/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '검증된 caret 좌표를 current contenteditable 내부 좌표로 변환해야 합니다.'

copy_fixture
perl -0pi -e 's/fieldBox\.width \/ fieldRect\.width/1/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Puck iframe transform scale을 X/Y 좌표에 각각 반영해야 합니다.'

copy_fixture
perl -0pi -e 's/resolveRichTextSelection\(page, selection\)/selection.cachedLocators/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'Puck iframe 교체에 대응해 실제 포인터 선택 매 시도마다 현재 field와 target locator를 다시 찾아야 합니다.'

copy_fixture
perl -0pi -e 's/(function collapseSelectionWithPointer[\s\S]*?)resolveRichTextSelection\(page, selection\)/$1selection.cachedLocators/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 해제 재클릭도 현재 Puck iframe의 field와 target locator를 다시 찾아야 합니다.'

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
perl -0pi -e 's/expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\)/expect.poll(() => selectedText(field)).toContain(target)/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'mouse up 직후 선택 문자열이 목표 문자열과 정확히 같은지 확인해야 합니다.'

copy_fixture
perl -0pi -e 's/(function findFieldCollapsePoints[\s\S]*?)range\.getClientRects\(\)/${1}[]/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 해제 좌표는 선택 substring 바깥 prefix/suffix Range rect이면서 field 내부·툴바 밖인 실제 픽셀이어야 합니다.'

copy_fixture
printf '\npage.evaluate(() => document.execCommand("bold"));\n' \
  >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'evaluate 안에서 편집 API를 직접 주입하면 안 됩니다.'

copy_fixture
printf '\npublishButton.evaluate((element) => element.click());\n' \
  >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'evaluate click으로 실제 포인터 경로를 우회하면 안 됩니다.'

copy_fixture
printf '\npage.evaluate(() => { document.body.innerHTML = "injected"; });\n' \
  >>"$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'evaluate로 편집 DOM 값을 직접 주입하면 안 됩니다.'

copy_fixture
perl -0pi -e "s/test\('/test.skip('/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '전용 편집 E2E는 viewport를 skip/fixme로 우회하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/content\.heading-01/content.heading-removed/' \
  "$fixture_root/fixture/tests/E2E/support/editorInteractionFixture.ts"
expect_failure '대표 fixture에 root inline-rich Heading 블록이 필요합니다.'

copy_fixture
perl -0pi -e 's/content\.features-grid-01/content.features-removed/' \
  "$fixture_root/fixture/tests/E2E/support/editorInteractionFixture.ts"
expect_failure '대표 fixture에 nested array rich-text Features 블록이 필요합니다.'

copy_fixture
perl -0pi -e 's/content\.rich-text-01/content.rich-text-removed/' \
  "$fixture_root/fixture/tests/E2E/support/editorInteractionFixture.ts"
expect_failure '대표 fixture에 block-rich RichText 블록이 필요합니다.'

copy_fixture
perl -0pi -e 's/content\.article-list-01/content.article-list-removed/' \
  "$fixture_root/fixture/tests/E2E/support/editorInteractionFixture.ts"
expect_failure '대표 fixture에 no-link ArticleList 블록이 필요합니다.'

copy_fixture
perl -0pi -e 's/data-g7pb-richtext-field/data-g7pb-text-field/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'rich-text canvas selector는 중앙 rich-text marker를 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/\[data-puck-rte-menu="true"\]:visible/\[data-testid="legacy-range-toolbar"\]:visible/g' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '공식 Puck 원본 data-puck-rte-menu root locator가 필요합니다.'

copy_fixture
perl -0pi -e 's/ROOT_INLINE_RICH_GATE/ROOT_INLINE_RICH_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'root inline-rich 실제 편집 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/await applySelectedFormatting\(page, menuRoot/await assertSelectedFormatting(page, menuRoot/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'root inline-rich gate가 공식 B/I/U와 G7 선택 서식을 실제 적용해야 합니다.'

copy_fixture
perl -0pi -e 's/NESTED_INLINE_RICH_GATE/NESTED_INLINE_RICH_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'nested array inline-rich 실제 편집 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/await applySelectedFormatting\(page, nestedMenuRoot/await assertSelectedFormatting(page, nestedMenuRoot/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'nested inline-rich gate가 공식 B/I/U와 G7 선택 서식을 실제 적용해야 합니다.'

copy_fixture
perl -0pi -e 's/BLOCK_RICH_GATE/BLOCK_RICH_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'block-rich 실제 편집 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/NO_LINK_INLINE_GATE/NO_LINK_INLINE_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '외부 action 내부 inline-rich의 no-link gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/BIDIRECTIONAL_SIDEBAR_TO_CANVAS_GATE/BIDIRECTIONAL_SIDEBAR_TO_CANVAS_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'sidebar richtext에서 canvas로 즉시 반영되는 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/BIDIRECTIONAL_CANVAS_TO_SIDEBAR_GATE/BIDIRECTIONAL_CANVAS_TO_SIDEBAR_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'canvas richtext에서 sidebar로 즉시 반영되는 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's/expect\(sidebarField\)\.toHaveText\(EDITOR_INTERACTION_COPY\.canvasToSidebar\)/expect(sidebarField).toContainText(EDITOR_INTERACTION_COPY.canvasToSidebar)/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'canvas-to-sidebar gate가 저장 전 즉시 반영을 검증해야 합니다.'

copy_fixture
perl -0pi -e "s/선택한 글자 기울임/선택한 글자 회전/g" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '공식 Puck menu root 안 기울임 버튼 검증이 필요합니다.'

copy_fixture
perl -0pi -e "s/name: '링크 편집'/name: '주소 편집'/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'ArticleList title에서 링크 편집 control 부재를 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/sidebarField\.fill\(/sidebarField.pressSequentially(/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'sidebar richtext를 실제 입력으로 변경해야 합니다.'

copy_fixture
perl -0pi -e 's/page\.keyboard\.type\(/page.keyboard.insertText(/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'canvas 선택 범위를 실제 키 입력으로 변경해야 합니다.'

copy_fixture
perl -0pi -e "s/name: 'mobile'/name: 'handheld'/" \
  "$fixture_root/fixture/playwright.config.ts"
expect_failure 'Playwright mobile project가 필요합니다.'

copy_fixture
perl -0pi -e 's/g7pb:richtext-range-state/g7pb:richtext-range-active/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 범위 active/inactive 단일 메시지 계약이 필요합니다.'

copy_fixture
perl -0pi -e 's/RichTextMenu/RichTextToolbar/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '공식 Puck RichTextMenu를 직접 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/function G7RichTextInlineMenu\(\{ editor,/function G7RichTextInlineMenu({ children, editor,/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '이동 중 click을 잃는 Puck 기본 inline B/I/U children을 중복 렌더하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/onPointerDownCapture=\{applyFromPointer\}/onClick={applyFromPointer}/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '부분 글자 B/I/U는 이동하는 Puck ActionBar의 click 유실 전 pointerdown capture에서 적용해야 합니다.'

copy_fixture
perl -0pi -e 's/onPointerUp=\{\(event\) => chooseFromPointer\(event, option\.value\)\}/onClick={(event) => chooseFromPointer(event, option.value)}/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 옵션은 pointerdown에서 선택과 타깃을 유지하고 같은 pointer의 pointerup에서 한 번만 적용해야 합니다.'

copy_fixture
perl -0pi -e 's/scheduleCloseAfterPointer\(\);/onClose();/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 옵션은 같은 pointer의 pointerup에서 한 번만 적용하고 compatibility click까지 portal을 유지한 뒤 닫혀야 합니다.'

copy_fixture
perl -0pi -e 's/activateControl\(optionControl\)/optionControl.focus()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 portal option은 iframe body에서 도달성 확인 뒤 실제 PC pointer click으로 활성화해야 합니다.'

copy_fixture
perl -0pi -e 's#(await assertPointerReachable\(page, optionControl\);\n)  await expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\);#$1  await expect(field).toBeVisible();#' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 portal option의 실제 PC click 뒤 option은 닫히고 Puck 메뉴와 선택 범위는 유지되어야 합니다.'

copy_fixture
perl -0pi -e 's/expect\(optionControl\)\.toBeHidden\(\)/expect(optionControl).toBeVisible()/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 portal option의 실제 PC click 뒤 option은 닫히고 Puck 메뉴와 선택 범위는 유지되어야 합니다.'

copy_fixture
perl -0pi -e 's/(function assertPointerReachable[\s\S]*?)hit: stack\[0\] === iframe/$1hit: true/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '편집 E2E는 iframe 내부 control 중심 hit부터 border·scale 변환과 상위 iframe hit까지 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/(async function assertPointerReachable[^\{]+\{)/$1\n  await page.waitForTimeout(750);/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'control 도달성은 autosave pointer 차단이 풀리기를 기다려 우회하면 안 됩니다.'

copy_fixture
perl -0pi -e "s/control\\.click\\(\\{ scroll: 'none' \\}\\)/control.click({ force: true })/" \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 control은 PC에서 실제 locator click으로 활성화해야 합니다.'

copy_fixture
perl -0pi -e 's/contentOrigin\.x \+ localCenter\.x \* contentScale\.x/contentOrigin.x + 1/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '편집 E2E는 iframe 내부 control 중심 hit부터 border·scale 변환과 상위 iframe hit까지 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/(async function activateControl\([\s\S]*?control): Locator/$1?: Locator/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 control은 필수 locator의 실제 tap/click만 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/await expect\(control\)\.toBeVisible\(\);/await expect(control).toBeAttached();/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '선택 글자 control은 안정 배치가 노출된 뒤 세 프레임의 geometry를 검증해야 합니다.'

copy_fixture
perl -0pi -e 's/(async function assertPointerReachable[^\{]+\{)/$1\n  await control.scrollIntoViewIfNeeded();/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure 'control 도달성 검증이 레이아웃을 이동시키거나 frame 변환을 Playwright bbox로 대체하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/for \(const width of \[PC_EDIT_CANVAS_WIDTH\]\)/for (const width of [360, 768, PC_EDIT_CANVAS_WIDTH])/' \
  "$fixture_root/fixture/tests/E2E/editorInteractionQuality.spec.ts"
expect_failure '부분 텍스트 포인터 E2E는 PC 편집 뷰포트에서 한 번만 실행해야 합니다.'

copy_fixture
perl -0pi -e 's/toggleBold\(\)\.run\(\)/toggleStrike().run()/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '부분 글자 B/I/U는 Puck editor의 공식 Tiptap 명령을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/title="링크 편집"/title="주소 편집"/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '사용자 정의 링크 명령은 Puck RichTextMenu.Control을 사용해야 합니다.'

copy_fixture
perl -0pi -e "s/import \{ createPortal \} from 'react-dom';//" \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 option과 링크 편집기는 ActionBar overflow 밖의 React portal을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/data-g7pb-safe-clip-left/data-g7pb-unsafe-left/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 floating layer는 iframe ownerDocument와 공통 safe clip에 배치되고 Puck RTE 포커스 경계를 유지해야 합니다.'

copy_fixture
perl -0pi -e 's/data-puck-rte-menu="portal"/data-g7pb-rte-menu="portal"/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 floating layer는 iframe ownerDocument와 공통 safe clip에 배치되고 Puck RTE 포커스 경계를 유지해야 합니다.'

copy_fixture
perl -0pi -e 's/FLOATING_LAYER_STABLE_FRAMES = 3/FLOATING_LAYER_STABLE_FRAMES = 1/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 floating layer는 연속 세 프레임의 배치가 같을 때만 노출되어야 합니다.'

copy_fixture
perl -0pi -e 's/new ownerWindow\.MutationObserver\(invalidatePlacement\)/new ownerWindow.MutationObserver(schedule)/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '선택 글자 floating layer는 safe-zone 변경 시 즉시 숨기고 안정 배치를 다시 계산해야 합니다.'

copy_fixture
perl -0pi -e 's/<RichTextFloatingLayer anchorRef=\{ref\} align="end"/<div/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '글꼴·크기·굵기·색상 option과 링크 form 모두 같은 floating portal 계약을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/editorState\?\.g7HasSelection/editorState?.legacySelection/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure 'inline menu 표시는 Puck editorState의 선택 상태만 사용해야 합니다.'

copy_fixture
printf '\nconst bookmarkRef = { current: { from: 1, to: 2 } };\n' \
  >>"$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure 'Puck selection 외 별도 bookmark 상태를 두면 안 됩니다.'

copy_fixture
printf '\neditor.chain().setTextSelection({ from: 1, to: 2 }).run();\n' \
  >>"$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '툴바 명령에서 선택 범위를 수동 복원하면 안 됩니다.'

copy_fixture
printf '\neditor.on("selectionUpdate", () => undefined);\n' \
  >>"$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure 'inline menu가 Tiptap selection/transaction을 직접 구독하면 안 됩니다.'

copy_fixture
printf '\nwindow.addEventListener("blur", () => undefined);\n' \
  >>"$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure 'inline menu가 window blur로 선택 범위를 접으면 안 됩니다.'

copy_fixture
perl -0pi -e 's/data-g7pb-richtext-field="true"/data-g7pb-richtext-field="true" data-puck-overlay-portal="true"/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '제품 rich-text wrapper가 Puck의 overlay portal 속성을 복제하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/data-g7pb-richtext-field="true"/data-g7pb-richtext-field="true" onPointerDown={(event) => event.stopPropagation()}/' \
  "$fixture_root/fixture/resources/js/editor/richTextEditing.tsx"
expect_failure '제품 rich-text wrapper가 Puck의 drag isolation을 복제하면 안 됩니다.'

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

copy_fixture
perl -0pi -e "s/(name: 'tablet',[\\s\\S]{0,100})testIgnore: PC_ONLY_EDITOR_TESTS,/\$1/" \
  "$fixture_root/fixture/playwright.config.ts"
expect_failure 'Playwright tablet project는 실제 편집 E2E를 실행하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/ && canvasWidth === PC_EDITOR_VIEWPORT_WIDTH//' \
  "$fixture_root/fixture/resources/js/editor/editorViewportPolicy.ts"
expect_failure '편집 권한은 문서 상태·호스트 폭·PC canvas를 모두 만족할 때만 열려야 합니다.'

copy_fixture
perl -0pi -e 's/edit: viewportPolicy\.canEdit/edit: true/' \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure 'Puck의 모든 mutation 권한은 단일 viewport policy에 연결되어야 합니다.'

copy_fixture
perl -0pi -e 's/(const updateCanonical = \(nextData: PuckEditorData\): void => \{)\n    if \(!viewportPolicy\.canEdit\) return;/$1/' \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure '미리보기 모드의 유출된 Puck 변경은 canonical 문서에 반영하면 안 됩니다.'

copy_fixture
perl -0pi -e "s/projectName === 'desktop' \? 'edit' : 'preview'/'edit'/" \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '페이지 킷 레이아웃 E2E가 PC 편집과 태블릿·모바일 미리보기를 구분해야 합니다.'

copy_fixture
perl -0pi -e 's/viewport switch must not persist document data/viewport switch may persist document data/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '뷰포트 전환이 문서를 저장하지 않는 회귀 gate가 필요합니다.'

echo 'editor-acceptance-contract: PASS'
