#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_SPEC = 'tests/E2E/editorLayoutParity.spec.ts';

async function source(root, path) {
  try {
    return await readFile(resolve(root, path), 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} 파일을 읽을 수 없습니다: ${reason}`);
  }
}

function requirePattern(errors, value, pattern, message) {
  if (!pattern.test(value)) errors.push(message);
}

export async function validateEditorLayoutParity(root) {
  const errors = [];
  const [packageSource, css, publicCss, adapter, spec] = await Promise.all([
    source(root, 'package.json'),
    source(root, 'resources/css/page-builder-editor.css'),
    source(root, 'resources/css/page-builder-public.css'),
    source(root, 'resources/js/editor/PuckEditorAdapter.tsx'),
    source(root, REQUIRED_SPEC),
  ]);
  const packageJson = JSON.parse(packageSource);
  const scripts = packageJson.scripts ?? {};
  const puckVersion = packageJson.dependencies?.['@puckeditor/core'];

  if (puckVersion !== '0.23.0') {
    errors.push('모바일 헤더 흐름은 검증된 Puck 0.23.0 의미 DOM 계약과 함께 고정되어야 합니다.');
  }

  if (scripts['check:editor-layout-parity'] !== 'node scripts/check-editor-layout-parity.mjs') {
    errors.push('package.json에 고정된 check:editor-layout-parity 명령이 필요합니다.');
  }
  if (typeof scripts.check !== 'string' || !scripts.check.includes('npm run check:editor-layout-parity')) {
    errors.push('npm run check가 편집/미리보기 레이아웃 계약 검사를 포함해야 합니다.');
  }
  if (typeof scripts['test:unit'] !== 'string' || !scripts['test:unit'].startsWith('npm run check:editor-layout-parity &&')) {
    errors.push('frontend task-submit의 test:unit가 레이아웃 계약 검사를 먼저 실행해야 합니다.');
  }
  if (typeof scripts['test:e2e:product'] !== 'string' || !scripts['test:e2e:product'].includes(REQUIRED_SPEC)) {
    errors.push(`test:e2e:product가 ${REQUIRED_SPEC}를 반드시 실행해야 합니다.`);
  }

  const cssContract = [
    [/\.g7pb-preview-page,\s*\.g7pb-preview-page \*,\s*\.g7pb-preview-page \*::before,\s*\.g7pb-preview-page \*::after\s*\{\s*box-sizing:\s*border-box;/s,
      'Puck iframe 제품 캔버스의 scoped border-box reset이 필요합니다.'],
    [/--g7pb-preview-content-width:\s*var\(--g7pb-theme-content-width\)/,
      '편집기와 공개 출력이 공유하는 content-width 변수가 필요합니다.'],
    [/\.g7pb-preview-block\s*>\s*\*\s*\{\s*width:\s*100%;\s*max-width:\s*100%;\s*margin-inline:\s*0;/,
      '편집 block wrapper가 공개 block과 다른 inline margin으로 자식을 재배치하면 안 됩니다.'],
    [/padding-inline:\s*max\(1\.25rem,\s*calc\(\(100vw\s*-\s*var\(--g7pb-preview-content-width,\s*var\(--g7pb-theme-content-width\)\)\)\s*\/\s*2\)\)/,
      '편집기 centered content edge는 공개 출력의 100vw 공식을 사용해야 합니다.'],
    [/\.g7pb-preview-block\.g7pb-container-align--left:not\(\.g7pb-container-width--full\)\s*>\s*\*/,
      '왼쪽 container alignment 최종 override가 필요합니다.'],
    [/\.g7pb-preview-block\.g7pb-container-align--right:not\(\.g7pb-container-width--full\)\s*>\s*\*/,
      '오른쪽 container alignment 최종 override가 필요합니다.'],
    [/\.g7pb-preview-block\.g7pb-container-width--full\s*>\s*\*\s*\{\s*padding-inline:\s*0;/,
      'full-width container의 최종 padding reset이 필요합니다.'],
    [/\.g7pb-full-site-page--template\s*\{[^}]*max-width:\s*80rem;[^}]*padding-inline:\s*1rem;/,
      '편집기 template shell은 G7 기본 Container의 모바일 여백과 최대 폭을 재현해야 합니다.'],
    [/@container\s*\(min-width:\s*1024px\)\s*\{\s*\.g7pb-full-site-page--template\s*\{\s*padding-inline:\s*2rem;/,
      '편집기 template shell은 G7 기본 Container의 데스크톱 여백을 재현해야 합니다.'],
    [/@container\s*\(max-width:\s*800px\)[\s\S]*\.g7pb-preview-hero-split\s*\{\s*grid-template-columns:\s*1fr;/,
      '편집기 Hero Split은 768px 경계에서 단일 열로 접혀야 합니다.'],
    [/\.g7pb-preview-gallery__grid--4\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
      '편집기 Gallery grid 열은 이미지 고유 폭보다 작아질 수 있어야 합니다.'],
    [/\.g7pb-preview-gallery figure\s*\{\s*min-width:\s*0;/,
      '편집기 Gallery item은 모바일에서 최소 콘텐츠 폭을 강제하면 안 됩니다.'],
    [/\.g7pb-preview-gallery figure\s*>\s*span\s*\{\s*display:\s*block;\s*overflow:\s*hidden;/,
      '편집기 Gallery media wrapper는 width가 적용되는 block formatting context여야 합니다.'],
    [/\.g7pb-preview-hero-split--layout-overlap\s*\{[^}]*repeat\(12,\s*minmax\(0,\s*1fr\)\)/,
      '편집기 overlap Hero grid는 최소 콘텐츠 폭으로 캔버스를 밀면 안 됩니다.'],
    [/\.g7pb-preview-logo-cloud--layout-grid\s*>\s*div\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
      '편집기 Logo grid 열은 로고 고유 폭보다 작아질 수 있어야 합니다.'],
  ];
  for (const [pattern, message] of cssContract) requirePattern(errors, css, pattern, message);
  const mobileHeaderControls = css.match(
    /@media\s*\(max-width:\s*720px\)\s*\{\s*\.g7pb-header-controls\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  if (!mobileHeaderControls) {
    errors.push('모바일 Puck header action의 전용 반응형 레이아웃이 필요합니다.');
  } else {
    requirePattern(
      errors,
      mobileHeaderControls,
      /position:\s*static;/,
      '모바일 제품 header control은 Puck MenuBar 흐름 안에 배치되어야 합니다.',
    );
    requirePattern(
      errors,
      mobileHeaderControls,
      /flex:\s*1\s+1\s+100%;[\s\S]*max-width:\s*100%;[\s\S]*flex-wrap:\s*wrap;/,
      '모바일 제품 header control은 Puck toggle과 겹치지 않는 줄바꿈 가능한 전체 폭 영역이어야 합니다.',
    );
    if (/(?:z-index|top|right|bottom|left|inset(?:-inline|-block)?):/.test(mobileHeaderControls)) {
      errors.push('모바일 제품 header control에 viewport 고정 좌표나 z-index overlay를 사용하면 안 됩니다.');
    }
  }
  const compactMenuFlow = [
    [
      /@media\s*\(max-width:\s*637px\)[\s\S]*\.g7pb-puck-header-layer\s*>\s*header\s*>\s*div\s*>\s*:has\(\.g7pb-header-controls\)\s*\{[^}]*display:\s*contents;/,
      '모바일 Puck tools wrapper는 헤더 grid 흐름에 메뉴를 참여시켜야 합니다.',
    ],
    [
      /\.g7pb-puck-header-layer\s*>\s*header\s*>\s*div\s*>\s*:has\(\.g7pb-header-controls\)\s*>\s*:has\(>\s*button\[aria-label=['"]Toggle menu bar['"]\]\)\s*\{[^}]*grid-column:\s*3;[^}]*grid-row:\s*1;/,
      'Puck 메뉴 toggle은 모바일 헤더 첫번째 행의 독립 제어여야 합니다.',
    ],
    [
      /\.g7pb-puck-header-layer\s*>\s*header\s*>\s*div\s*>\s*:has\(\.g7pb-header-controls\)\s*>\s*:has\(\.g7pb-header-controls\)\s*\{[^}]*position:\s*static;[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*2;[^}]*width:\s*100%;/,
      '모바일 Puck MenuBar는 절대 배치 overlay가 아닌 헤더 전체 폭 두번째 행이어야 합니다.',
    ],
  ];
  for (const [pattern, message] of compactMenuFlow) requirePattern(errors, css, pattern, message);
  requirePattern(errors, adapter,
    /usePageBuilderPuck\(\(state\)\s*=>\s*state\.appState\.ui\.viewports\.current\.width\)[\s\S]*data-g7pb-selected-block-actionbar=['"]true['"][\s\S]*data-g7pb-canvas-layout=\{narrowCanvas\s*\?\s*['"]narrow['"]\s*:\s*['"]wide['"]\}/,
    '선택 블록 ActionBar는 Puck 실제 canvas viewport 상태를 안정적인 제품 래퍼 계약으로 내려야 합니다.');
  requirePattern(errors, adapter,
    /function visibleOwnerViewport[\s\S]*actionBar\.ownerDocument[\s\S]*ownerWindow\.frameElement[\s\S]*clipByOverflowAncestor[\s\S]*mapHostClipToFrameViewport[\s\S]*intersectOverlayRects/,
    'ActionBar 안전영역은 iframe뿐 아니라 host viewport와 모든 overflow clipping ancestor의 실제 가시 영역을 사용해야 합니다.');
  requirePattern(errors, adapter,
    /function renderedAncestorScale[\s\S]*offsetWidth[\s\S]*rect\.width[\s\S]*function useSelectedActionBarSafeZone[\s\S]*placeEditorOverlay[\s\S]*inverseScaledTranslation/,
    'ActionBar 좌표는 host/canvas/Puck 렌더 scale을 측정하고 역보정해야 합니다.');
  requirePattern(errors, adapter,
    /function currentInteractionRects[\s\S]*getSelection\(\)[\s\S]*!selection\.isCollapsed[\s\S]*activeElement[\s\S]*avoidRects:\s*currentInteractionRects\(actionBar\)/,
    '공간이 부족한 ActionBar는 현재 글자 범위와 활성 편집 요소를 피하는 공통 배치 규칙을 사용해야 합니다.');
  requirePattern(errors, adapter,
    /function useSelectedActionBarSafeZone[\s\S]*visibleOwnerViewport\(actionBar\)[\s\S]*data-g7pb-safe-zone-placement[\s\S]*data-g7pb-safe-zone-ready[\s\S]*hostDocument\?\.addEventListener\(['"]scroll['"],\s*schedulePosition,\s*true\)/,
    'ActionBar는 host 가시영역 변화를 관찰하고 계산 완료 상태와 배치 결과를 명시해야 합니다.');
  requirePattern(errors, adapter,
    /const actionBarRef\s*=\s*useSelectedActionBarSafeZone\(true\)/,
    'ActionBar 안전영역은 PC·태블릿·모바일 모든 canvas에서 공통 적용되어야 합니다.');
  const selectedActionHost = css.match(
    /div:has\(>\s*\.g7pb-selected-block-actionbar\)\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, selectedActionHost,
    /pointer-events:\s*none;/,
    '이동 전 ActionBar host의 빈 hit box는 캔버스 포인터를 가로채면 안 됩니다.');
  if (/height:\s*0;|min-height:\s*0;/.test(selectedActionHost)) {
    errors.push('ActionBar host 높이를 0으로 만들어 실제 컨트롤의 세로 hit area를 잘라내면 안 됩니다.');
  }
  const selectedActionStrip = css.match(
    /\.g7pb-selected-block-actionbar\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  if (!selectedActionStrip) {
    errors.push('선택 블록 ActionBar의 공통 안전 영역이 필요합니다.');
  } else {
    requirePattern(errors, selectedActionStrip,
      /width:\s*max-content;[\s\S]*max-width:\s*var\(--g7pb-selected-actionbar-max-width,[\s\S]*min-width:\s*0;/,
      'ActionBar는 컨트롤 폭을 유지하되 측정된 host 가시 폭 안쪽으로 제한되어야 합니다.');
    requirePattern(errors, selectedActionStrip,
      /overflow:\s*auto\s+hidden;/,
      'ActionBar는 다중 행 줄바꿈 대신 실제 높이를 가진 가로 스크롤 strip을 사용해야 합니다.');
    requirePattern(errors, selectedActionStrip,
      /pointer-events:\s*auto;[\s\S]*transform:\s*translate\(\s*var\(--g7pb-selected-actionbar-translate-x,\s*0\),\s*var\(--g7pb-selected-actionbar-translate-y,\s*0\)\s*\);[\s\S]*visibility:\s*hidden;/,
      'ActionBar는 계산된 host 안전영역 위치가 준비된 뒤 실제 포인터 hit area로 노출되어야 합니다.');
  }
  requirePattern(errors, css,
    /\.g7pb-selected-block-actionbar\[data-g7pb-safe-zone-ready=['"]true['"]\]\s*\{[^}]*visibility:\s*visible;/,
    'ActionBar는 안전영역 계산 완료 상태에서만 표시되어야 합니다.');
  requirePattern(errors, css,
    /\.g7pb-selected-block-actionbar,\s*\.g7pb-selected-block-actionbar \*\s*\{[^}]*pointer-events:\s*auto;/,
    'ActionBar와 실제 자식 컨트롤은 ghost host와 달리 포인터 입력을 받아야 합니다.');
  const selectedActionContent = css.match(
    /\.g7pb-selected-block-actionbar\s*>\s*div\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, selectedActionContent,
    /width:\s*max-content;[\s\S]*min-width:\s*max-content;[\s\S]*flex-wrap:\s*nowrap;/,
    'ActionBar 컨트롤은 텍스트를 덮는 다중 행으로 줄바꿈하면 안 됩니다.');
  const floatingLayer = css.match(
    /\.g7pb-richtext-inline-toolbar__options\.g7pb-richtext-floating-layer,\s*\.g7pb-richtext-inline-toolbar__link\.g7pb-richtext-floating-layer\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, floatingLayer,
    /position:\s*fixed;[\s\S]*z-index:\s*9999;[\s\S]*--g7pb-richtext-floating-top[\s\S]*--g7pb-richtext-floating-left[\s\S]*max-width:\s*var\(--g7pb-richtext-floating-max-width[\s\S]*max-height:\s*var\(--g7pb-richtext-floating-max-height[\s\S]*overflow:\s*auto;/,
    '부분 글자 선택·링크 패널은 ActionBar overflow 밖의 host 안전영역 portal layer로 열려야 합니다.');
  const mobileRichTextMenu = css.match(
    /body:has\(\.g7pb-selected-block-actionbar\)[\s\S]*?\[data-puck-rte-menu\]:has\(\.g7pb-richtext-inline-toolbar\)\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, mobileRichTextMenu,
    /width:\s*max-content;[\s\S]*max-width:\s*none;[\s\S]*min-width:\s*max-content;[\s\S]*flex:\s*0\s+0\s+auto;[\s\S]*flex-wrap:\s*nowrap;/,
    '모바일 Puck RichTextMenu는 가로 스크롤 안의 단일 행 고정 폭 메뉴여야 합니다.');
  const mobileRichTextToolbar = css.match(
    /body:has\(\.g7pb-selected-block-actionbar\)[\s\S]*?\.g7pb-richtext-inline-toolbar\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, mobileRichTextToolbar,
    /width:\s*max-content;[\s\S]*max-width:\s*none;[\s\S]*min-width:\s*max-content;[\s\S]*flex-wrap:\s*nowrap;/,
    '모바일 부분 글자 추가 서식은 한 줄 고정 폭 toolbar여야 합니다.');
  const mobileRichTextChoice = css.match(
    /body:has\(\.g7pb-selected-block-actionbar\)[\s\S]*?\.g7pb-richtext-inline-toolbar__choice\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, mobileRichTextChoice,
    /min-width:\s*0;[\s\S]*flex:\s*0\s+0\s+auto;/,
    '모바일 부분 글자 선택기는 늘어나거나 줄바꿈하지 않는 항목이어야 합니다.');
  const mobileRichTextChoiceButton = css.match(
    /body:has\(\.g7pb-selected-block-actionbar\)[\s\S]*?\.g7pb-richtext-inline-toolbar__choice\s*>\s*button\s*\{([^}]*)\}/s,
  )?.[1] ?? '';
  requirePattern(errors, mobileRichTextChoiceButton,
    /width:\s*auto;[\s\S]*min-width:\s*3\.2rem;[\s\S]*max-width:\s*6\.7rem;/,
    '모바일 부분 글자 선택 버튼은 읽을 수 있는 고정 폭 범위를 유지해야 합니다.');
  if (/_[A-Za-z]*MenuBar(?:--[A-Za-z]+)?_[A-Za-z0-9]+/.test(css)) {
    errors.push('Puck vendor 해시 class를 모바일 메뉴 레이아웃 계약으로 사용하면 안 됩니다.');
  }
  if (/100cqw\s*-\s*var\(--g7pb-theme-content-width\)/.test(css)) {
    errors.push('편집 root padding에 공개 출력과 다른 100cqw theme-width 공식을 사용하면 안 됩니다.');
  }
  if (/\.g7pb-preview-block\.g7pb-container-align--(?:center|left|right)\s*>\s*\*\s*\{[^}]*margin-(?:inline|left|right)/s.test(css)) {
    errors.push('container alignment는 공개 출력처럼 padding으로 처리하고 편집 child margin으로 재배치하면 안 됩니다.');
  }
  requirePattern(errors, adapter,
    /template\s*\?\s*['"] g7pb-full-site-page--template['"]\s*:\s*['"]['"]/,
    'template shell 전용 G7 Container envelope class를 편집 page root에 적용해야 합니다.');
  requirePattern(errors, publicCss,
    /@media\s*\(max-width:\s*800px\)[\s\S]*\.g7pb-hero-split\s*\{\s*grid-template-columns:\s*1fr;/,
    '공개 Hero Split도 768px 경계에서 편집기와 동일하게 단일 열로 접혀야 합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-gallery__grid--4\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/,
    '공개 Gallery grid 열도 이미지 고유 폭보다 작아질 수 있어야 합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-hero-split--layout-overlap\s*\{[^}]*repeat\(12,\s*minmax\(0,\s*1fr\)\)/,
    '공개 overlap Hero grid도 최소 콘텐츠 폭으로 화면을 밀면 안 됩니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-logo-cloud--layout-grid ul\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    '공개 Logo grid 열도 로고 고유 폭보다 작아질 수 있어야 합니다.');

  const requiredEvidence = [
    [/test\.describe\.configure\(\{\s*retries:\s*0\s*\}\)/, '레이아웃 E2E는 retries: 0으로 실행해야 합니다.'],
    [/expect\(builtinManifest\.blocks\.length\)\.toBeGreaterThan\(0\)/, '블록 재고는 manifest 기반 비어 있지 않은 assertion이 필요합니다.'],
    [/expect\(builtinManifest\.presets\.length\)\.toBeGreaterThanOrEqual\(builtinManifest\.blocks\.length\)/, '완성 섹션 재고는 블록 수에서 파생한 assertion이 필요합니다.'],
    [/expect\(\[\.\.\.declaredPageKitSlugs\]\.sort\(\)\)\.toEqual\(sourcePageKitSlugs\)/, 'Page Kit manifest와 source directory 재고 drift assertion이 필요합니다.'],
    [/api\.post\(`\$\{API\}\/store\/page-kits\/apply`/, 'Page Kit은 실제 공식 마켓 적용 API로 생성해야 합니다.'],
    [/not\.toContain\(['"]g7pb-media:\/\/['"]\)/, 'Page Kit portable media가 실제 저장 URL로 해소됐는지 확인해야 합니다.'],
    [/api\.delete\(`\$\{API\}\/media\/\$\{mediaId\}`\)/, 'Page Kit gate가 만든 미디어를 정확한 ID로 정리해야 합니다.'],
    [/ALL_PRESET_LAYOUT_GATE/, '전체 프리셋 편집/미리보기 gate가 필요합니다.'],
    [/PAGE_KIT_LAYOUT_GATE/, '내장 Page Kit 편집/미리보기 gate가 필요합니다.'],
    [/desktop:\s*1280,\s*tablet:\s*768,\s*mobile:\s*360/, 'PC/태블릿/모바일 canvas 폭 계약이 필요합니다.'],
    [/const CANVAS_IFRAME\s*=\s*['"]#puck-canvas-root iframe['"]/, 'Puck canvas 고유 iframe selector가 필요합니다.'],
    [/block\.firstElementChild/, '편집 block의 실제 렌더 child geometry를 측정해야 합니다.'],
    [/block\.scrollWidth\s*-\s*block\.clientWidth/, '각 block의 가로 overflow 측정이 필요합니다.'],
    [/root\.scrollWidth\s*-\s*root\.clientWidth/, 'iframe/preview document 가로 overflow 측정이 필요합니다.'],
    [/editor\.contentLeft\s*-\s*preview\.contentLeft/, '편집기/미리보기 왼쪽 content edge 비교가 필요합니다.'],
    [/editor\.contentRight\s*-\s*preview\.contentRight/, '편집기/미리보기 오른쪽 content edge 비교가 필요합니다.'],
    [/page-builder-preview-link/, '실제 미리보기 ticket 검증이 필요합니다.'],
    [/previewLink\.evaluate\(\(element\)\s*=>\s*element\.tagName\s*===\s*['"]BUTTON['"]\)[\s\S]*await previewLink\.click\(\)/,
      '초안 변경으로 미리보기 ticket이 무효화되면 실제 생성 버튼 흐름을 실행해야 합니다.'],
    [/page-builder-rendered-block/, '실제 컴파일 결과 block 검증이 필요합니다.'],
    [/expect\(previewBlocks\.first\(\)\)\.toBeVisible\(\{\s*timeout:\s*60_000\s*\}\)[\s\S]*expect\(previewBlocks\.last\(\)\)\.toBeVisible/,
      'G7 template route 전환 중 숨은 slot을 측정하지 않도록 preview block 가시 상태를 기다려야 합니다.'],
    [/expectProductCanvasStyles\(editorRoot\)[\s\S]*expectStableVisibleGeometry\(editorBlocks,\s*scenario\.expectedBlockCount\)[\s\S]*layoutMetrics\(editorBlocks,\s*true\)/,
      'Puck iframe은 제품 CSS 적용과 geometry 안정화 뒤에 측정해야 합니다.'],
    [/expectProductPublicStyles\(previewBlocks\)[\s\S]*expectStableVisibleGeometry\(previewBlocks,\s*scenario\.expectedBlockCount\)/,
      'preview는 제품 공개 CSS 적용과 geometry 안정화 뒤에 측정해야 합니다.'],
    [/expectStableVisibleGeometry\(previewBlocks,\s*scenario\.expectedBlockCount\)/,
      'preview DOM 교체가 끝난 뒤 연속 표본으로 geometry 안정화를 확인해야 합니다.'],
    [/standalonePreviewRoot\.count\(\)\s*===\s*1[\s\S]*preview\.locator\(['"]html['"]\)/,
      'template shell 미리보기는 G7 문서 root까지 가로 overflow를 검사해야 합니다.'],
  ];
  for (const [pattern, message] of requiredEvidence) requirePattern(errors, spec, pattern, message);

  if (/\btest\.(?:skip|fixme)\s*\(/.test(spec) || /testInfo\.project\.name\s*!==/.test(spec)) {
    errors.push('레이아웃 E2E는 viewport나 시나리오를 skip/fixme로 우회하면 안 됩니다.');
  }
  return errors;
}

async function main() {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] : process.cwd();
  if (!root) throw new Error('--root 값이 필요합니다.');
  const errors = await validateEditorLayoutParity(root);
  if (errors.length > 0) {
    for (const error of errors) console.error(`EDITOR_LAYOUT_PARITY_CONTRACT\t${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('EDITOR_LAYOUT_PARITY_CONTRACT\tOK');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
