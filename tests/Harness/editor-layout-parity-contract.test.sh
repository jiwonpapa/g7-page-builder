#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/g7pb-editor-layout-parity.XXXXXX")"
trap 'rm -rf "$fixture_root"' EXIT

copy_fixture() {
  rm -rf "$fixture_root/fixture"
  mkdir -p "$fixture_root/fixture/scripts" "$fixture_root/fixture/tests/E2E" \
    "$fixture_root/fixture/resources/css" "$fixture_root/fixture/resources/js/editor"
  cp "$repo_root/package.json" "$fixture_root/fixture/package.json"
  cp "$repo_root/resources/css/page-builder-editor.css" \
    "$fixture_root/fixture/resources/css/page-builder-editor.css"
  cp "$repo_root/resources/css/page-builder-public.css" \
    "$fixture_root/fixture/resources/css/page-builder-public.css"
  cp "$repo_root/resources/js/editor/PuckEditorAdapter.tsx" \
    "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
  cp "$repo_root/tests/E2E/editorLayoutParity.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
}

expect_failure() {
  local expected="$1"
  if node "$repo_root/scripts/check-editor-layout-parity.mjs" --root "$fixture_root/fixture" \
    >"$fixture_root/stdout" 2>"$fixture_root/stderr"; then
    echo "Expected editor layout parity contract failure: $expected" >&2
    exit 1
  fi
  grep -Fq "$expected" "$fixture_root/stderr" || {
    echo "Missing failure message: $expected" >&2
    sed -n '1,120p' "$fixture_root/stderr" >&2
    exit 1
  }
}

node "$repo_root/scripts/check-editor-layout-parity.mjs" --root "$repo_root"

copy_fixture
perl -0pi -e 's/"\@puckeditor\/core": "0\.23\.0"/"\@puckeditor\/core": "^0.23.0"/' \
  "$fixture_root/fixture/package.json"
expect_failure '모바일 헤더 흐름은 검증된 Puck 0.23.0 의미 DOM 계약과 함께 고정되어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-header-controls \{\n    position:) static;/${1} fixed;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 제품 header control은 Puck MenuBar 흐름 안에 배치되어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-header-controls \{[^}]*position: static;)/${1}\n    z-index: 80;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 제품 header control에 viewport 고정 좌표나 z-index overlay를 사용하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-header-controls \{[^}]*flex:) 1 1 100%;/${1} 0 0 auto;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 제품 header control은 Puck toggle과 겹치지 않는 줄바꿈 가능한 전체 폭 영역이어야 합니다.'

copy_fixture
perl -0pi -e 's/(> :has\(\.g7pb-header-controls\) \{\n    display:) contents;/${1} flex;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 Puck tools wrapper는 헤더 grid 흐름에 메뉴를 참여시켜야 합니다.'

copy_fixture
perl -0pi -e 's/(> :has\(\.g7pb-header-controls\) \{\n    position:) static;/${1} absolute;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 Puck MenuBar는 절대 배치 overlay가 아닌 헤더 전체 폭 두번째 행이어야 합니다.'

copy_fixture
printf '\n._MenuBar--menuOpen_deadbeef { position: static; }\n' \
  >>"$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'Puck vendor 해시 class를 모바일 메뉴 레이아웃 계약으로 사용하면 안 됩니다.'

copy_fixture
perl -0pi -e "s/data-g7pb-canvas-layout=\{narrowCanvas \? 'narrow' : 'wide'\}/data-g7pb-canvas-layout='wide'/" \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure '선택 블록 ActionBar는 Puck 실제 canvas viewport 상태를 안정적인 제품 래퍼 계약으로 내려야 합니다.'

copy_fixture
perl -0pi -e 's/actionBar\.ownerDocument/globalThis.document/' \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure '좁은 canvas ActionBar는 iframe ownerDocument geometry와 선택 블록 기준으로 실제 포인터 안전영역에 clamp되어야 합니다.'

copy_fixture
perl -0pi -e 's/(body:has\(\.g7pb-selected-block-actionbar\[data-g7pb-canvas-layout=\x27narrow\x27\]\) div:has\(> \.g7pb-selected-block-actionbar\[data-g7pb-canvas-layout=\x27narrow\x27\]\) \{\n  height:) 0;/$1 auto;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '좁은 캔버스의 선택 블록 ActionBar host는 이동 후 빈 hit box를 남기면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-selected-block-actionbar\[data-g7pb-canvas-layout=\x27narrow\x27\] \{[^}]*overflow:) auto hidden;/$1 hidden;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '좁은 캔버스 ActionBar는 줄바꿈 대신 가로 스크롤 strip을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/var\(--g7pb-selected-actionbar-translate-y, 0\)/0px/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '좁은 캔버스 ActionBar는 계산된 iframe 안전영역 위치가 준비된 뒤에만 노출되어야 합니다.'

copy_fixture
perl -0pi -e 's/(data-g7pb-safe-zone-ready=\x27true\x27\] \{\n  visibility:) visible;/$1 hidden;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '좁은 캔버스 ActionBar는 안전영역 계산 완료 상태에서만 표시되어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-selected-block-actionbar\[data-g7pb-canvas-layout=\x27narrow\x27\] > div \{[^}]*flex-wrap:) nowrap;/$1 wrap;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '좁은 캔버스 ActionBar 컨트롤은 텍스트를 덮는 다중 행으로 줄바꿈하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-richtext-inline-toolbar \{ width:) max-content;/${1} 100%;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 부분 글자 추가 서식은 한 줄 고정 폭 toolbar여야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-richtext-inline-toolbar__choice \{ min-width: 0; flex:) 0 0 auto;/${1} 1 1 4rem;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 부분 글자 선택기는 늘어나거나 줄바꿈하지 않는 항목이어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-richtext-inline-toolbar__choice > button \{ width: auto; min-width:) 3\.2rem;/${1} 0;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '모바일 부분 글자 선택 버튼은 읽을 수 있는 고정 폭 범위를 유지해야 합니다.'

copy_fixture
perl -0pi -e 's/box-sizing: border-box;/box-sizing: content-box;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'Puck iframe 제품 캔버스의 scoped border-box reset이 필요합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-block > \* \{ width: 100%; max-width: 100%; )margin-inline: 0;/${1}margin-inline: auto;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집 block wrapper가 공개 block과 다른 inline margin으로 자식을 재배치하면 안 됩니다.'

copy_fixture
perl -0pi -e "s/ g7pb-full-site-page--template/ g7pb-full-site-page--removed/" \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure 'template shell 전용 G7 Container envelope class를 편집 page root에 적용해야 합니다.'

copy_fixture
perl -0pi -e 's/(@container \(max-width: )800px/${1}767px/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Hero Split은 768px 경계에서 단일 열로 접혀야 합니다.'

copy_fixture
perl -0pi -e 's/(@media \(max-width: )800px/${1}767px/' \
  "$fixture_root/fixture/resources/css/page-builder-public.css"
expect_failure '공개 Hero Split도 768px 경계에서 편집기와 동일하게 단일 열로 접혀야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-gallery__grid--4 \{ grid-template-columns: repeat\(4, )minmax\(0, 1fr\)/${1}1fr/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Gallery grid 열은 이미지 고유 폭보다 작아질 수 있어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-gallery figure > span \{ )display: block/${1}display: inline/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Gallery media wrapper는 width가 적용되는 block formatting context여야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-hero-split--layout-overlap \{ grid-template-columns: repeat\(12, )minmax\(0, 1fr\)/${1}1fr/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 overlap Hero grid는 최소 콘텐츠 폭으로 캔버스를 밀면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-logo-cloud--layout-grid ul \{ display: grid; grid-template-columns: repeat\(4, )minmax\(0, 1fr\)/${1}1fr/' \
  "$fixture_root/fixture/resources/css/page-builder-public.css"
expect_failure '공개 Logo grid 열도 로고 고유 폭보다 작아질 수 있어야 합니다.'

copy_fixture
perl -0pi -e 's/ALL_95_PRESET_LAYOUT_GATE/ALL_PRESET_LAYOUT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '95개 프리셋 편집/미리보기 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's#\$\{API\}/store/page-kits/apply#\$\{API\}/store/page-kits/bypassed#' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'Page Kit은 실제 공식 마켓 적용 API로 생성해야 합니다.'

copy_fixture
perl -0pi -e 's/editor\.contentLeft - preview\.contentLeft/editor.contentLeft - editor.contentLeft/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '편집기/미리보기 왼쪽 content edge 비교가 필요합니다.'

copy_fixture
perl -0pi -e 's/await previewLink\.click\(\)/await previewLink.isVisible()/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '초안 변경으로 미리보기 ticket이 무효화되면 실제 생성 버튼 흐름을 실행해야 합니다.'

copy_fixture
perl -0pi -e 's/root\.scrollWidth - root\.clientWidth/0/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'iframe/preview document 가로 overflow 측정이 필요합니다.'

copy_fixture
perl -0pi -e "s/preview\.locator\('html'\)/preview.locator('body')/" \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'template shell 미리보기는 G7 문서 root까지 가로 overflow를 검사해야 합니다.'

copy_fixture
perl -0pi -e 's/expect\(previewBlocks\.first\(\)\)\.toBeVisible/expect(previewBlocks.first()).toHaveCount/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'G7 template route 전환 중 숨은 slot을 측정하지 않도록 preview block 가시 상태를 기다려야 합니다.'

copy_fixture
perl -0pi -e 's/expectProductCanvasStyles\(editorRoot\)/Promise.resolve()/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'Puck iframe은 제품 CSS 적용과 geometry 안정화 뒤에 측정해야 합니다.'

copy_fixture
perl -0pi -e 's/expectProductPublicStyles\(previewBlocks\)/Promise.resolve()/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'preview는 제품 공개 CSS 적용과 geometry 안정화 뒤에 측정해야 합니다.'

copy_fixture
perl -0pi -e 's# ?tests/E2E/editorLayoutParity\.spec\.ts##' "$fixture_root/fixture/package.json"
expect_failure 'test:e2e:product가 tests/E2E/editorLayoutParity.spec.ts를 반드시 실행해야 합니다.'

echo 'editor-layout-parity-contract: PASS'
