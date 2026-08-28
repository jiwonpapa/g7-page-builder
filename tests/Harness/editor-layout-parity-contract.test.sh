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
  cp "$repo_root/resources/css/page-builder-editor-wysiwyg.css" \
    "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
  cp "$repo_root/resources/css/page-builder-public.css" \
    "$fixture_root/fixture/resources/css/page-builder-public.css"
  cp "$repo_root/resources/js/editor/PuckEditorAdapter.tsx" \
    "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
  cp "$repo_root/resources/js/editor/catalogBlocks.tsx" \
    "$fixture_root/fixture/resources/js/editor/catalogBlocks.tsx"
  cp "$repo_root/resources/js/editor/productionCatalogBlocks.tsx" \
    "$fixture_root/fixture/resources/js/editor/productionCatalogBlocks.tsx"
  cp "$repo_root/resources/js/editor/editorOverlaySafeZone.ts" \
    "$fixture_root/fixture/resources/js/editor/editorOverlaySafeZone.ts"
  cp "$repo_root/tests/E2E/editorLayoutParity.spec.ts" \
    "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
  cp "$repo_root/tests/E2E/blockCatalogQuality.spec.ts" \
    "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
}

expect_failure() {
  local expected="$1"
  if node "$repo_root/scripts/check-editor-layout-parity.mjs" --root "$fixture_root/fixture" \
    >"$fixture_root/stdout" 2>"$fixture_root/stderr"; then
    echo "Expected editor layout parity contract failure: $expected" >&2
    exit 1
  fi
  grep -Fq -- "$expected" "$fixture_root/stderr" || {
    echo "Missing failure message: $expected" >&2
    sed -n '1,120p' "$fixture_root/stderr" >&2
    exit 1
  }
}

node "$repo_root/scripts/check-editor-layout-parity.mjs" --root "$repo_root"

copy_fixture
perl -0pi -e 's/(function LogoCloudPreview[\s\S]*?<RichTextCanvasField )as="h2"/${1}as="p"/' \
  "$fixture_root/fixture/resources/js/editor/catalogBlocks.tsx"
expect_failure '로고 목록 제목은 공개 출력과 동일한 h2 semantic 계약을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(function NoticePreview[\s\S]*?<RichTextCanvasField )as="h2"/${1}as="strong"/' \
  "$fixture_root/fixture/resources/js/editor/productionCatalogBlocks.tsx"
expect_failure '안내 블록 제목은 공개 출력과 동일한 h2 semantic 계약을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/ancestorTrail/removedTrail/g' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '브라우저 WYSIWYG 실패에는 실제 글자 폭, 줄바꿈 속성, 편집 상태와 semantic DOM 조상 진단값이 포함되어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-page \[data-g7pb-heading-level\] \{[^}]*white-space:) normal;/${1} nowrap;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '편집 가능한 제목은 공개 heading과 같은 줄바꿈 규칙을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-hero-slider article > div \{[^}]*padding:) clamp\(2rem, 6vw, 5rem\);/${1} 72px;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Hero Slider copy inset은 공개 슬라이더와 같은 유동 여백이어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-bar-chart figcaption > \[data-g7pb-heading-level="2"\] \{ max-width:) 48rem;/${1} 680px;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Bar Chart 제목 폭은 공개 section heading의 48rem 계약을 사용해야 합니다.'

copy_fixture
perl -0pi -e "s/const image = safeImage\(imageSrc\);/const legacyClass = 'g7pb-preview-hero__copy'; const image = safeImage(imageSrc);/" \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure '편집기 Hero는 공개 Hero와 같은 direct grid child 구조를 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-icon-list > header :is\(h2, \[data-g7pb-heading-level="2"\]\) \{ max-width:) 48rem;/${1} 18ch;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Icon List 제목 폭은 공개 section heading의 48rem 계약을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-logo-cloud--layout-grid > div):last-child/${1}/g' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Logo grid 열은 로고 고유 폭보다 작아질 수 있어야 합니다.'

copy_fixture
perl -0pi -e 's/lineCount: Math\.max\(/lineCount: Math.min(/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'contenteditable과 semantic heading의 줄 수는 range fragment와 실제 line box 높이를 함께 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-hero :is\(h1,[^}]*font-size: clamp\(2\.5rem, 7vw, )5\.75rem/${1}4rem/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기 Hero 제목은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(--g7pb-theme-radius:) 1rem;/${1} .75rem;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '편집기와 공개 출력의 기본 radius는 동일한 1rem 계약이어야 합니다.'

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
  "$fixture_root/fixture/resources/js/editor/editorOverlaySafeZone.ts"
expect_failure 'ActionBar 안전영역은 iframe뿐 아니라 host viewport와 모든 overflow clipping ancestor의 실제 가시 영역을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/const frameElement = ownerWindow\.frameElement as HTMLElement;/const frameElement = ownerDocument.documentElement;/' \
  "$fixture_root/fixture/resources/js/editor/editorOverlaySafeZone.ts"
expect_failure 'ActionBar 안전영역은 iframe뿐 아니라 host viewport와 모든 overflow clipping ancestor의 실제 가시 영역을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/function renderedElementScale/function renderedScaleWithoutCompensation/' \
  "$fixture_root/fixture/resources/js/editor/editorOverlaySafeZone.ts"
expect_failure 'ActionBar 좌표는 host/canvas/Puck 렌더 scale을 측정하고 역보정해야 합니다.'

copy_fixture
perl -0pi -e 's/avoidRects: currentInteractionRects\(actionBar\)/avoidRects: []/' \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure '공간이 부족한 ActionBar는 현재 글자 범위와 활성 편집 요소를 피하는 공통 배치 규칙을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/useSelectedActionBarSafeZone\(true\)/useSelectedActionBarSafeZone(narrowCanvas)/' \
  "$fixture_root/fixture/resources/js/editor/PuckEditorAdapter.tsx"
expect_failure 'ActionBar 안전영역은 PC·태블릿·모바일 모든 canvas에서 공통 적용되어야 합니다.'

copy_fixture
perl -0pi -e 's/(div:has\(> \.g7pb-selected-block-actionbar\) \{)/$1 height: 0; min-height: 0;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'ActionBar host 높이를 0으로 만들어 실제 컨트롤의 세로 hit area를 잘라내면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(div:has\(> \.g7pb-selected-block-actionbar\) \{ pointer-events:) none;/$1 auto;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '이동 전 ActionBar host의 빈 hit box는 캔버스 포인터를 가로채면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-selected-block-actionbar \{[^}]*overflow:) auto hidden;/$1 hidden;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'ActionBar는 다중 행 줄바꿈 대신 실제 높이를 가진 가로 스크롤 strip을 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/var\(--g7pb-selected-actionbar-translate-y, 0\)/0px/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'ActionBar는 계산된 host 안전영역 위치가 준비된 뒤 실제 포인터 hit area로 노출되어야 합니다.'

copy_fixture
perl -0pi -e 's/(data-g7pb-safe-zone-ready=\x27true\x27\] \{ visibility:) visible;/$1 hidden;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'ActionBar는 안전영역 계산 완료 상태에서만 표시되어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-selected-block-actionbar > div \{[^}]*flex-wrap:) nowrap;/$1 wrap;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure 'ActionBar 컨트롤은 텍스트를 덮는 다중 행으로 줄바꿈하면 안 됩니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-richtext-inline-toolbar__options\.g7pb-richtext-floating-layer,[^}]*position:) fixed;/$1 absolute;/s' \
  "$fixture_root/fixture/resources/css/page-builder-editor.css"
expect_failure '부분 글자 선택·링크 패널은 ActionBar overflow 밖의 host 안전영역 portal layer로 열려야 합니다.'

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
perl -0pi -e 's/(\[data-g7pb-heading-level\]\.g7pb-element-weight--regular \{ font-weight:) 400;/${1} 700;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '편집 가능한 semantic heading의 regular 굵기는 공개 HTML의 400 계산값과 같아야 합니다.'

copy_fixture
perl -0pi -e 's/(\[data-g7pb-heading-level\]\.g7pb-element-weight--heading-default \{ font-weight:) 700;/${1} 400;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '명시적 굵기가 없는 semantic heading은 공개 HTML 기본 제목의 700 계산값과 같아야 합니다.'

copy_fixture
perl -0pi -e 's/(\[data-g7pb-heading-level\] :where\(\*\) \{[^}]*white-space:) inherit !important;/${1} pre-wrap !important;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure 'Puck의 실제 제목 leaf는 wrapper의 WYSIWYG typography, font shaping과 줄바꿈 규칙을 상속해야 합니다.'

cp "$repo_root/resources/css/page-builder-editor-wysiwyg.css" \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
perl -0pi -e 's/font-feature-settings: inherit !important;/font-feature-settings: "liga" 0 !important;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure 'Puck의 실제 제목 leaf는 wrapper의 WYSIWYG typography, font shaping과 줄바꿈 규칙을 상속해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-features > \[data-g7pb-heading-level="2"\] \{[^}]*max-width:) none;/${1} 780px;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure 'Features 기본 제목은 공개 출력과 같은 가용 폭과 normal line-height를 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-block :where\(h1, h2, h3, h4\) \{ font-weight:) 700 !important;/${1} 400 !important;/' \
  "$fixture_root/fixture/resources/css/page-builder-public.css"
expect_failure '활성 G7 템플릿의 전역 heading 규칙이 블록 기본 제목 굵기를 바꾸지 못하게 격리해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-element-weight--regular \{ font-weight:) 400 !important;/${1} 700 !important;/' \
  "$fixture_root/fixture/resources/css/page-builder-public.css"
expect_failure '명시적 regular element style은 활성 템플릿과 무관하게 공개본에서 400이어야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-features__title \{[^}]*line-height:) normal !important;/${1} 1.5;/' \
  "$fixture_root/fixture/resources/css/page-builder-public.css"
expect_failure 'Features 공개 제목 행간은 활성 템플릿 전역 h2 규칙으로부터 격리해야 합니다.'

copy_fixture
perl -0pi -e 's/(> :is\(header, figcaption\) \{[^}]*max-width:) 48rem;/${1} 760px;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '공통 섹션 제목 컨테이너는 공개 g7pb-section-heading과 같은 48rem 폭이어야 합니다.'

copy_fixture
perl -0pi -e 's/(> header > \[data-g7pb-heading-level="2"\] \{[^}]*max-width:) none;/${1} 680px;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '공통 섹션 제목 leaf는 편집기 전용 680px 제한 없이 공개 heading 컨테이너 폭을 채워야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-richtext\.g7pb-preview-rich-text__content \{[^}]*font-size:) 1rem;/${1} 1.25rem;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '리치텍스트 본문은 편집기와 공개 출력에서 동일한 기본 1rem typography를 사용해야 합니다.'

copy_fixture
perl -0pi -e 's/(\.g7pb-preview-button \{[^}]*font-weight:) 700;/${1} 800;/' \
  "$fixture_root/fixture/resources/css/page-builder-editor-wysiwyg.css"
expect_failure '편집기 버튼의 기본 굵기는 공개 출력과 동일해야 합니다.'

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
perl -0pi -e 's/ALL_PRESET_LAYOUT_GATE/ALL_PRESET_LAYOUT_REMOVED/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '전체 프리셋 편집/미리보기 gate가 필요합니다.'

copy_fixture
perl -0pi -e 's#\$\{API\}/store/page-kits/apply#\$\{API\}/store/page-kits/bypassed#' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'Page Kit은 실제 공식 마켓 적용 API로 생성해야 합니다.'

copy_fixture
perl -0pi -e 's/editor\.contentLeft - preview\.contentLeft/editor.contentLeft - editor.contentLeft/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '편집기/미리보기 왼쪽 content edge 비교가 필요합니다.'

copy_fixture
perl -0pi -e 's/Math\.abs\(editorTypography\.fontSize - previewTypography\.fontSize\)/0/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '편집기/미리보기 대표 텍스트의 실제 font-size 차이를 비교해야 합니다.'

copy_fixture
perl -0pi -e 's/editorTypography\.lineCount !== previewTypography\.lineCount/false/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '편집기/미리보기 대표 텍스트의 줄바꿈 수가 같아야 합니다.'

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
perl -0pi -e 's/\n\s*await editorRoot\.evaluate\(async \(element\) => \{ await element\.ownerDocument\.fonts\.ready; \}\);//' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure '편집 iframe과 공개 미리보기 모두 document.fonts.ready 이후 geometry를 측정해야 합니다.'

copy_fixture
perl -0pi -e 's/expectProductPublicStyles\(previewBlocks\)/Promise.resolve()/' \
  "$fixture_root/fixture/tests/E2E/editorLayoutParity.spec.ts"
expect_failure 'preview는 제품 공개 CSS 적용과 geometry 안정화 뒤에 측정해야 합니다.'

copy_fixture
perl -0pi -e 's# ?tests/E2E/editorLayoutParity\.spec\.ts##' "$fixture_root/fixture/package.json"
expect_failure 'test:e2e:product가 tests/E2E/editorLayoutParity.spec.ts를 반드시 실행해야 합니다.'

copy_fixture
perl -0pi -e 's/test\.describe\.configure\(\{ retries: 0 \}\);/test.describe.configure({ retries: 1 });/' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '블록 카탈로그 시각 회귀는 전역 retry로 실패를 숨기면 안 됩니다.'

copy_fixture
perl -0pi -e 's/window\.devicePixelRatio/1/' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '블록 카탈로그 캡처 전에 요소 원점을 device-pixel grid에 고정해야 합니다.'

copy_fixture
perl -0pi -e 's/await image\.decode\(\)/await Promise.resolve()/' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '블록 카탈로그 캡처 전에 전체 문서 lazy media를 로드하고 decode해야 합니다.'

copy_fixture
perl -0pi -e 's/await prepareVisualDocument\(publicRoot\)/await Promise.resolve()/' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '블록 카탈로그 시각 비교 전에 전체 문서 media 준비 단계를 실행해야 합니다.'

copy_fixture
perl -0pi -e 's/await expectCatalogPresentationQuality\(/await Promise.resolve\(/' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '전체 내장 블록은 manifest 순서·가시성·미디어·가독성·overflow와 안정화 검사를 통과해야 합니다.'

copy_fixture
perl -0pi -e 's/firstCapture\.equals\(secondCapture\)/true/g' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '블록 카탈로그 baseline 비교 전에 동일 요소의 연속 캡처가 일치해야 합니다.'

copy_fixture
perl -0pi -e 's/caret: '\''hide'\'',/caret: '\''hide'\'', threshold: 0.2,/' \
  "$fixture_root/fixture/tests/E2E/blockCatalogQuality.spec.ts"
expect_failure '블록 카탈로그 시각 회귀의 허용치 완화는 금지됩니다.'

echo 'editor-layout-parity-contract: PASS'
