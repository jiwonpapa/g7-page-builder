#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';

const REQUIRED_SPEC = 'tests/E2E/editorInteractionQuality.spec.ts';
const REQUIRED_FIXTURE = 'tests/E2E/support/editorInteractionFixture.ts';

async function text(root, path) {
  try {
    return await readFile(resolve(root, path), 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} 파일을 읽을 수 없습니다: ${reason}`);
  }
}

function requirePattern(errors, source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

export async function validateEditorAcceptanceContract(root) {
  const errors = [];
  const [packageSource, makefile, coordinationHarness, spec, fixture, playwrightConfig, richTextSource, adapterSource, canvasSource] = await Promise.all([
    text(root, 'package.json'),
    text(root, 'Makefile'),
    text(root, 'scripts/coord-harness.sh'),
    text(root, REQUIRED_SPEC),
    text(root, REQUIRED_FIXTURE),
    text(root, 'playwright.config.ts'),
    text(root, 'resources/js/editor/richTextEditing.tsx'),
    text(root, 'resources/js/editor/PuckEditorAdapter.tsx'),
    text(root, 'resources/js/editor/canvasEditingContract.ts'),
  ]);
  const packageJson = JSON.parse(packageSource);
  const scripts = packageJson.scripts ?? {};

  if (scripts['check:editor-acceptance'] !== 'node scripts/check-editor-acceptance-contract.mjs') {
    errors.push('package.json에 고정된 check:editor-acceptance 명령이 필요합니다.');
  }
  if (typeof scripts['test:e2e:product'] !== 'string' || !scripts['test:e2e:product'].includes(REQUIRED_SPEC)) {
    errors.push(`test:e2e:product가 ${REQUIRED_SPEC}를 반드시 실행해야 합니다.`);
  }
  if (typeof scripts.check !== 'string' || !scripts.check.includes('npm run check:editor-acceptance')) {
    errors.push('npm run check가 편집 상호작용 계약 검사를 포함해야 합니다.');
  }

  requirePattern(errors, makefile, /quality-coordination:[^\n]*\n(?:\t[^\n]*\n)*\tnpm run check:editor-acceptance/m,
    'quality-coordination이 편집 상호작용 계약 검사를 실행해야 합니다.');
  requirePattern(errors, makefile, /dev-product-e2e:[\s\S]*?npm run check:editor-acceptance && npm run test:e2e:product/,
    'dev-product-e2e가 제품 E2E 전에 편집 상호작용 계약을 검사해야 합니다.');
  requirePattern(errors, coordinationHarness, /frontend\)[\s\S]*?npm run check:editor-acceptance[\s\S]*?npm run typecheck[\s\S]*?npm run test:unit/,
    'frontend task-submit profile이 편집 상호작용 계약을 먼저 검사해야 합니다.');

  const forbiddenSyntheticSelection = [
    [/\.addRange\s*\(/, 'Selection.addRange로 선택 범위를 합성하면 안 됩니다.'],
    [/\.removeAllRanges\s*\(/, 'Selection.removeAllRanges로 실제 선택을 우회하면 안 됩니다.'],
    [/dispatchEvent\s*\([^\n]*(?:selectionchange|MouseEvent)/, '합성 selectionchange/mouse 이벤트를 사용하면 안 됩니다.'],
    [/normalizePointerRangeWithKeyboard/, 'pointer 범위를 키보드로 보정하면 안 됩니다.'],
    [/caretTextOffset/, 'pointer 선택을 caret offset 키보드 보정으로 대체하면 안 됩니다.'],
    [/(?:\.createRange|\bnew\s+Range)\s*\(/, 'DOM Range를 evaluate로 계산하거나 선택에 주입하면 안 됩니다.'],
    [/page\.keyboard\.(?:down|press)\(\s*['"](?:Shift|ArrowLeft|ArrowRight)/, 'Shift/방향키로 선택 범위를 재구성하면 안 됩니다.'],
    [/rangeToolbar[\s\S]{0,180}\.selectOption\s*\(/, '선택 글자 툴바는 selectOption 직접 주입이 아니라 실제 사용자 조작으로 검증해야 합니다.'],
    [/console\.log\s*\(/, '전용 E2E에 임시 진단 로그를 남기면 안 됩니다.'],
    [/page\.evaluate\([\s\S]{0,500}\b(?:fetch|XMLHttpRequest|execCommand|setContent|setMark|toggleBold|toggleItalic|toggleUnderline)\b/, 'evaluate 안에서 편집 API를 직접 주입하면 안 됩니다.'],
    [/\.evaluate\([\s\S]{0,300}(?:innerHTML|textContent)\s*=/, 'evaluate로 편집 DOM 값을 직접 주입하면 안 됩니다.'],
    [/dispatchEvent\s*\([^\n]*(?:beforeinput|input)/, '합성 input 이벤트로 편집 결과를 주입하면 안 됩니다.'],
    [/force\s*:\s*true/, '전용 편집 E2E는 force click/hover로 실제 hit target 검증을 우회하면 안 됩니다.'],
  ];
  for (const [pattern, message] of forbiddenSyntheticSelection) {
    if (pattern.test(spec)) errors.push(message);
  }

  const requiredFixtureBlocks = [
    [/type:\s*['"]content\.heading-01['"]/, '대표 fixture에 root inline-rich Heading 블록이 필요합니다.'],
    [/type:\s*['"]content\.features-grid-01['"]/, '대표 fixture에 nested array rich-text Features 블록이 필요합니다.'],
    [/type:\s*['"]content\.rich-text-01['"]/, '대표 fixture에 block-rich RichText 블록이 필요합니다.'],
    [/type:\s*['"]content\.article-list-01['"]/, '대표 fixture에 no-link ArticleList 블록이 필요합니다.'],
  ];
  for (const [pattern, message] of requiredFixtureBlocks) requirePattern(errors, fixture, pattern, message);
  for (const project of ['desktop', 'tablet', 'mobile']) {
    requirePattern(errors, playwrightConfig, new RegExp(`name:\\s*['"]${project}['"]`),
      `Playwright ${project} project가 필요합니다.`);
  }

  const requiredEvidence = [
    [/test\.describe\.configure\(\{\s*retries:\s*0\s*\}\)/, '전용 E2E는 retries: 0으로 실행해야 합니다.'],
    [/page\.mouse\.down\s*\(/, '실제 pointer 선택을 위한 page.mouse.down이 필요합니다.'],
    [/page\.mouse\.move\(pointer\.start\.x, pointer\.start\.y\)/, 'topmost 검증을 통과한 실제 page mouse로 pointer 시작점에 이동해야 합니다.'],
    [/page\.mouse\.move\(pointer\.end\.x, pointer\.end\.y, \{ steps: POINTER_DRAG_STEPS \}\)/, 'force 없이 여러 실제 mouse move 단계로 pointer 종료점에 이동해야 합니다.'],
    [/function dragSelectText\([\s\S]{0,1100}assertTextPointerReachable\(page, field, pointer\)/, 'pointer down 전에 상위 문서와 iframe 내부 start/end hit target을 검증해야 합니다.'],
    [/function collapseSelectionWithPointer\([\s\S]{0,600}assertTextPointerEndReachable\(page, field, pointer\)/, '선택 해제 click 전에는 실제 클릭하는 end가 상위 문서와 iframe 내부의 현재 field에 도달하는지 검증해야 합니다.'],
    [/field\.focus\(\)/, '범위 선택 전 contenteditable focus가 필요합니다.'],
    [/expect\(field\)\.toBeFocused\(\)/, '실제 pointer 드래그 뒤 contenteditable focus를 확인해야 합니다.'],
    [/page\.mouse\.up\s*\(/, '실제 pointer 선택을 위한 page.mouse.up이 필요합니다.'],
    [/expect\.poll\(\(\)\s*=>\s*selectedText\(field\)\)\.toBe\(target\)/, 'mouse up 직후 선택 문자열이 목표 문자열과 정확히 같은지 확인해야 합니다.'],
    [/page\.mouse\.click\(pointer\.end\.x, pointer\.end\.y\)/, '선택 해제도 검증된 실제 page mouse 좌표로 클릭해야 합니다.'],
    [/projectName\s*===\s*['"]mobile['"]\s*\?\s*360\s*:\s*projectName\s*===\s*['"]tablet['"]\s*\?\s*768\s*:\s*1280/, '각 browser project에 맞는 360/768/1280 canvas 폭을 선택해야 합니다.'],
    [/const CANVAS_IFRAME\s*=\s*['"]#puck-canvas-root iframe['"]/, 'Puck canvas 고유 iframe selector를 고정해야 합니다.'],
    [/frameLocator\(CANVAS_IFRAME\)/, '모든 편집 상호작용은 Puck canvas iframe을 사용해야 합니다.'],
    [/page\.locator\(CANVAS_IFRAME\)\)\.toHaveCount\(1\)/, 'Puck canvas iframe이 정확히 하나인지 확인해야 합니다.'],
    [/field\.boundingBox\(\)/, 'iframe 내부 좌표를 실제 화면 좌표로 변환해야 합니다.'],
    [/targetNode\.boundingBox\(\)/, '선택 대상의 실제 렌더링 box를 측정해야 합니다.'],
    [/targetBox\.x\s*-\s*fieldBox\.x/, '선택 대상을 contenteditable 내부 실제 좌표로 변환해야 합니다.'],
    [/const scaleX = fieldBox\.width \/ fieldRect\.width[\s\S]{0,180}const scaleY = fieldBox\.height \/ fieldRect\.height/,
      'Puck iframe transform scale을 X/Y 좌표에 각각 반영해야 합니다.'],
    [/fieldBox\.x \+ local\.start\.x \* scaleX[\s\S]{0,180}fieldBox\.y \+ local\.end\.y \* scaleY/,
      'iframe offset과 transform scale을 실제 page mouse 좌표로 변환해야 합니다.'],
    [/function dragSelectText\([\s\S]{0,500}for \(let attempt = 0; attempt < 3; attempt \+= 1\)[\s\S]{0,260}resolveRichTextSelection\(page, selection\)/,
      'Puck iframe 교체에 대응해 실제 포인터 선택 매 시도마다 현재 field와 target locator를 다시 찾아야 합니다.'],
    [/function collapseSelectionWithPointer\([\s\S]{0,500}resolveRichTextSelection\(page, selection\)/,
      '선택 해제 재클릭도 현재 Puck iframe의 field와 target locator를 다시 찾아야 합니다.'],
    [/data-g7pb-richtext-field/, 'rich-text canvas selector는 중앙 rich-text marker를 사용해야 합니다.'],
    [/data-g7pb-inline-field/, 'rich-text canvas selector는 정확한 fieldPath marker를 사용해야 합니다.'],
    [/REAL_POINTER_SELECTION_GATE/, '실제 포인터 선택 gate가 필요합니다.'],
    [/CANVAS_VIEWPORT_GATE/, 'browser project와 내부 canvas viewport 일치 gate가 필요합니다.'],
    [/INTERACTIVE_CANVAS_GATE/, '실제 iframe의 상호작용 가능 크기 gate가 필요합니다.'],
    [/iframe\.boundingBox\(\)/, '실제 iframe의 상호작용 가능 크기를 측정해야 합니다.'],
    [/toBeGreaterThan\(1\)/, '실제 iframe의 가로·세로 크기가 0이 아님을 확인해야 합니다.'],
    [/POINTER_CANVAS_GATE/, '실제 글자 드래그 전에 pointer canvas 확보 gate가 필요합니다.'],
    [/page-builder-block-library/, '좁은 화면의 블록 라이브러리를 식별해야 합니다.'],
    [/getByText\(['"]Blocks['"],\s*\{\s*exact:\s*true\s*\}\)/, '좁은 화면에서는 블록 라이브러리를 실제 닫아야 합니다.'],
    [/expect\(library\)\.toBeHidden\(\)/, 'pointer canvas 확보 뒤 블록 라이브러리 닫힘을 확인해야 합니다.'],
    [/TABLET_HEADER_HEIGHT_GATE/, '태블릿 Puck header 높이 회귀 gate가 필요합니다.'],
    [/g7pb-puck-header-layer/, '태블릿 Puck header의 안정 selector가 필요합니다.'],
    [/toBeLessThanOrEqual\(100\)/, '태블릿 Puck header 높이 예산을 100px 이하로 강제해야 합니다.'],
    [/RANGE_TOOLBAR_EXCLUSIVE_GATE/, '범위 툴바와 요소 벌룬 상호배타 gate가 필요합니다.'],
    [/OFFICIAL_PUCK_MENU_ROOT_GATE/, '공식 Puck menu root 범위 gate가 필요합니다.'],
    [/ROOT_INLINE_RICH_GATE/, 'root inline-rich 실제 편집 gate가 필요합니다.'],
    [/NESTED_INLINE_RICH_GATE/, 'nested array inline-rich 실제 편집 gate가 필요합니다.'],
    [/BLOCK_RICH_GATE/, 'block-rich 실제 편집 gate가 필요합니다.'],
    [/NO_LINK_INLINE_GATE/, '외부 action 내부 inline-rich의 no-link gate가 필요합니다.'],
    [/BIDIRECTIONAL_SIDEBAR_TO_CANVAS_GATE/, 'sidebar richtext에서 canvas로 즉시 반영되는 gate가 필요합니다.'],
    [/BIDIRECTIONAL_CANVAS_TO_SIDEBAR_GATE/, 'canvas richtext에서 sidebar로 즉시 반영되는 gate가 필요합니다.'],
    [/COLLAPSED_SELECTION_GATE/, '선택 해제 시 툴바 닫힘 gate가 필요합니다.'],
    [/REPEATED_SELECTION_GATE/, '반복 선택 상태 경쟁 gate가 필요합니다.'],
    [/PERSISTED_SELECTION_MARK_GATE/, '저장·재로드 부분 서식 gate가 필요합니다.'],
    [/PREVIEW_SELECTION_MARK_GATE/, '미리보기 부분 서식 gate가 필요합니다.'],
    [/PUBLIC_SELECTION_MARK_GATE/, '공개 출력 부분 서식 gate가 필요합니다.'],
    [/page-builder-richtext-inline-toolbar/, '글자 범위 툴바 assertion이 필요합니다.'],
    [/locator\(['"]\[data-puck-rte-menu\]:visible['"]\)/, '공식 Puck data-puck-rte-menu root locator가 필요합니다.'],
    [/menuRoot\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 굵게['"],\s*exact:\s*true\s*\}\)/, '공식 Puck menu root 안 굵게 버튼 검증이 필요합니다.'],
    [/menuRoot\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 기울임['"],\s*exact:\s*true\s*\}\)/, '공식 Puck menu root 안 기울임 버튼 검증이 필요합니다.'],
    [/menuRoot\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 밑줄['"],\s*exact:\s*true\s*\}\)/, '공식 Puck menu root 안 밑줄 버튼 검증이 필요합니다.'],
    [/expect\(bold\)\.toHaveCount\(1\)[\s\S]{0,160}expect\(italic\)\.toHaveCount\(1\)[\s\S]{0,160}expect\(underline\)\.toHaveCount\(1\)/,
      '부분 글자 B/I/U control은 공식 Puck menu 안에 각각 하나만 있어야 합니다.'],
    [/getByRole\(['"]button['"],\s*\{\s*name:\s*['"]링크 편집['"],\s*exact:\s*true\s*\}\)\)\.toHaveCount\(0\)/, 'ArticleList title에서 링크 편집 control 부재를 검증해야 합니다.'],
    [/const optionControl = menuRoot\.getByRole\(['"]option['"],\s*\{\s*name:\s*option,\s*exact:\s*true\s*\}\)[\s\S]{0,180}assertPointerReachable\(page, optionControl\)[\s\S]{0,180}activateControl\(optionControl, projectName\)/,
      '선택 글자 메뉴 option은 도달성 확인 뒤 실제 click 또는 touch tap으로 활성화해야 합니다.'],
    [/const appliedMark = field\.locator\(`span\[data-g7pb-\$\{markAttribute\}="\$\{markValue\}"\]`\)[\s\S]{0,300}expect\(appliedMark\)\.toHaveText\(target\)/,
      '각 선택 글자 option은 다음 tap 전에 해당 범위에 즉시 적용됐는지 검증해야 합니다.'],
    [/sidebarField\.fill\(/, 'sidebar richtext를 실제 입력으로 변경해야 합니다.'],
    [/page\.keyboard\.type\(/, 'canvas 선택 범위를 실제 키 입력으로 변경해야 합니다.'],
    [/page-builder-context-panel/, '요소 전체 벌룬 assertion이 필요합니다.'],
    [/data-g7pb-font/, '선택 글꼴 DOM assertion이 필요합니다.'],
    [/data-g7pb-size/, '선택 크기 DOM assertion이 필요합니다.'],
    [/data-g7pb-tone/, '선택 색상 DOM assertion이 필요합니다.'],
    [/page\.reload\s*\(/, '저장 뒤 실제 에디터 재로드가 필요합니다.'],
    [/page-builder-preview-link/, '미리보기 검증이 필요합니다.'],
    [/page-builder-public-link/, '공개 출력 검증이 필요합니다.'],
  ];
  for (const [pattern, message] of requiredEvidence) requirePattern(errors, spec, pattern, message);

  const scopedRichTextEvidence = [
    [/ROOT_INLINE_RICH_GATE[\s\S]{0,1200}applySelectedFormatting\(/,
      'root inline-rich gate가 공식 B/I/U와 G7 선택 서식을 실제 적용해야 합니다.'],
    [/NESTED_INLINE_RICH_GATE[\s\S]{0,1400}applySelectedFormatting\(/,
      'nested inline-rich gate가 공식 B/I/U와 G7 선택 서식을 실제 적용해야 합니다.'],
    [/NO_LINK_INLINE_GATE[\s\S]{0,1200}getByRole\(['"]button['"],\s*\{\s*name:\s*['"]링크 편집['"],\s*exact:\s*true\s*\}\)\)\.toHaveCount\(0\)/,
      'no-link gate 안에서 링크 편집 control 부재를 검증해야 합니다.'],
    [/BIDIRECTIONAL_SIDEBAR_TO_CANVAS_GATE[\s\S]{0,900}sidebarField\.fill\([\s\S]{0,300}expect\(blockField\)\.toHaveText/,
      'sidebar-to-canvas gate가 저장 전 즉시 반영을 검증해야 합니다.'],
    [/BLOCK_RICH_GATE[\s\S]{0,1000}dragSelectText\([\s\S]{0,500}page\.keyboard\.type\(/,
      'block-rich gate가 실제 pointer 선택 뒤 실제 키 입력을 사용해야 합니다.'],
    [/BIDIRECTIONAL_CANVAS_TO_SIDEBAR_GATE[\s\S]{0,500}expect\(sidebarField\)\.toHaveText/,
      'canvas-to-sidebar gate가 저장 전 즉시 반영을 검증해야 합니다.'],
    [/PREVIEW_SELECTION_MARK_GATE[\s\S]{0,200}assertPublishedState\(preview\)/,
      '미리보기에서 root, nested, block-rich와 no-link 출력 상태를 함께 검증해야 합니다.'],
    [/PUBLIC_SELECTION_MARK_GATE[\s\S]{0,200}assertPublishedState\(published\)/,
      '공개 화면에서 root, nested, block-rich와 no-link 출력 상태를 함께 검증해야 합니다.'],
  ];
  for (const [pattern, message] of scopedRichTextEvidence) requirePattern(errors, spec, pattern, message);

  const requiredRangeState = [
    [richTextSource, /import\s*\{[^}]*RichTextMenu[^}]*\}\s*from\s*['"]@puckeditor\/core['"]/, '공식 Puck RichTextMenu를 직접 사용해야 합니다.'],
    [richTextSource, /function G7RichTextInlineMenu\(\{\s*editor,\s*editorState,\s*readOnly,/, '이동 중 click을 잃는 Puck 기본 inline B\/I\/U children을 중복 렌더하면 안 됩니다.'],
    [richTextSource, /function NativeRangeControl[\s\S]{0,1800}<RichTextMenu\.Control/, '부분 글자 B/I/U는 공식 Puck Control을 사용하는 pointer-first control이어야 합니다.'],
    [richTextSource, /onPointerDownCapture=\{applyFromPointer\}/, '부분 글자 B/I/U는 이동하는 Puck ActionBar의 click 유실 전 pointerdown capture에서 적용해야 합니다.'],
    [richTextSource, /const pendingOptionPointer = React\.useRef<\{ pointerId: number; value: T \} \| null>\(null\)/,
      '선택 글자 옵션은 pointerdown에서 선택과 타깃을 유지하고 같은 pointer의 pointerup에서 한 번만 적용해야 합니다.'],
    [richTextSource, /const armOptionFromPointer[\s\S]{0,500}pendingOptionPointer\.current = \{ pointerId: event\.pointerId, value: nextValue \}/,
      '선택 글자 옵션은 pointerdown에서 선택과 타깃을 유지하고 같은 pointer의 pointerup에서 한 번만 적용해야 합니다.'],
    [richTextSource, /const chooseFromPointer[\s\S]{0,500}pending\.pointerId !== event\.pointerId \|\| pending\.value !== nextValue[\s\S]{0,200}onChange\(nextValue\)/,
      '선택 글자 옵션은 pointerdown에서 선택과 타깃을 유지하고 같은 pointer의 pointerup에서 한 번만 적용해야 합니다.'],
    [richTextSource, /onPointerDown=\{\(event\) => armOptionFromPointer\(event, option\.value\)\}[\s\S]{0,180}onPointerUp=\{\(event\) => chooseFromPointer\(event, option\.value\)\}/,
      '선택 글자 옵션은 pointerdown에서 선택과 타깃을 유지하고 같은 pointer의 pointerup에서 한 번만 적용해야 합니다.'],
    [richTextSource, /if \(suppressCompatibilityClick\.current\) \{[\s\S]{0,140}clearPointerActivation\(\);[\s\S]{0,80}onClose\(\);[\s\S]{0,80}return;/,
      '선택 글자 옵션은 실제 compatibility click까지 타깃을 유지해 click을 소비한 뒤 메뉴를 닫아야 합니다.'],
    [richTextSource, /toggleBold\(\)\.run\(\)[\s\S]{0,900}toggleItalic\(\)\.run\(\)[\s\S]{0,900}toggleUnderline\(\)\.run\(\)/, '부분 글자 B/I/U는 Puck editor의 공식 Tiptap 명령을 사용해야 합니다.'],
    [richTextSource, /<RichTextMenu\.Control[\s\S]{0,600}title="링크 편집"/, '사용자 정의 링크 명령은 Puck RichTextMenu.Control을 사용해야 합니다.'],
    [richTextSource, /const rangeActive = Boolean\(editorState\?\.g7HasSelection\)/, 'inline menu 표시는 Puck editorState의 선택 상태만 사용해야 합니다.'],
    [richTextSource, /g7HasSelection:\s*isRichTextRangeActive\(context\.editor\)/, 'Puck selector가 선택 범위 상태를 파생해야 합니다.'],
    [richTextSource, /RICH_TEXT_RANGE_STATE_MESSAGE\s*=\s*['"]g7pb:richtext-range-state['"]/, '선택 범위 active/inactive 단일 메시지 계약이 필요합니다.'],
    [adapterSource, /event\.data\?\.type === RICH_TEXT_RANGE_STATE_MESSAGE/, '호스트가 선택 범위 상태 메시지를 수신해야 합니다.'],
    [adapterSource, /acceptRangeState\(event\.data\.active === true\)/, '호스트 UI는 active와 inactive를 같은 상태 처리기로 동기화해야 합니다.'],
  ];
  for (const [source, pattern, message] of requiredRangeState) requirePattern(errors, source, pattern, message);
  const updateMarkSource = richTextSource.match(/const updateMark = [\s\S]*?\n  };/)?.[0] ?? '';
  if (!updateMarkSource || /setOpenMenu\(/.test(updateMarkSource)) {
    errors.push('선택 글자 mark 적용 중 option을 제거하지 말고 compatibility click 소비 뒤 닫아야 합니다.');
  }
  requirePattern(errors, spec, /projectName === ['"]mobile['"][\s\S]{0,100}control\.tap\(\)/,
    'mobile 편집 E2E는 선택 글자 control을 실제 touch tap으로 검증해야 합니다.');
  requirePattern(errors, spec, /const optionControl = menuRoot\.getByRole\(['"]option['"][\s\S]{0,260}expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\)[\s\S]{0,180}activateControl\(optionControl, projectName\)[\s\S]{0,260}expect\(menuRoot\)\.toBeVisible\(\)[\s\S]{0,180}expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\)/,
    '선택 글자 option의 실제 click 또는 touch tap 전후에 Puck 메뉴와 선택 범위를 유지해야 합니다.');
  requirePattern(errors, spec, /function assertPointerReachable\(page:[\s\S]{0,1400}document\.elementFromPoint\(x, y\)[\s\S]{0,300}frameHit: hit === iframe/,
    '편집 E2E는 상위 문서에서 control 중심점이 canvas iframe에 도달하는지 검증해야 합니다.');
  requirePattern(errors, spec, /function assertPointerReachable\(page:[\s\S]{0,200}control\.scrollIntoViewIfNeeded\(\)[\s\S]{0,240}control\.boundingBox\(\)/,
    '편집 E2E는 control을 실제 scroll into view한 뒤 현재 bbox와 topmost를 다시 검증해야 합니다.');
  requirePattern(errors, spec, /mobile viewport switcher must not overlap the Puck menu toggle[\s\S]{0,900}mobile Puck menu toggle must remain pointer-reachable[\s\S]{0,300}menuToggle\.click\(\)[\s\S]{0,200}viewportSwitcher\)\.toBeHidden\(\)/,
    'mobile 편집 E2E는 viewport switcher 비겹침과 실제 menu 닫기를 검증해야 합니다.');
  const forbiddenDuplicateRangeState = [
    [/\bTextRangeBookmark\b|\bbookmarkRef\b/, 'Puck selection 외 별도 bookmark 상태를 두면 안 됩니다.'],
    [/\buseRichTextEditorRevision\b/, 'Puck editorState와 별도 revision 구독을 두면 안 됩니다.'],
    [/\.setTextSelection\s*\(/, '툴바 명령에서 선택 범위를 수동 복원하면 안 됩니다.'],
    [/\.on\(\s*['"](?:selectionUpdate|transaction)['"]/, 'inline menu가 Tiptap selection/transaction을 직접 구독하면 안 됩니다.'],
    [/addEventListener\(\s*['"]blur['"]/, 'inline menu가 window blur로 선택 범위를 접으면 안 됩니다.'],
    [/on(?:Pointer|Mouse)DownCapture=\{preserveRangeBeforeToolbarAction\}/, '툴바 capture handler로 선택 범위를 수동 보존하면 안 됩니다.'],
  ];
  for (const [pattern, message] of forbiddenDuplicateRangeState) {
    if (pattern.test(richTextSource)) errors.push(message);
  }
  const forbiddenPuckInlineOwnership = [
    [/data-puck-overlay-portal/, '제품 rich-text wrapper가 Puck의 overlay portal 속성을 복제하면 안 됩니다.'],
    [/onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/, '제품 rich-text wrapper가 Puck의 drag isolation을 복제하면 안 됩니다.'],
  ];
  for (const [pattern, message] of forbiddenPuckInlineOwnership) {
    if (pattern.test(richTextSource)) errors.push(message);
  }
  if (/rangeEditing|getSelection\(\)/.test(canvasSource.slice(canvasSource.indexOf('export function notifyCanvasElementSelection')))) {
    errors.push('요소 선택 계약에서 DOM Selection으로 범위 상태를 중복 추론하면 안 됩니다.');
  }

  if (/\btest\.(?:skip|fixme)\s*\(/.test(spec) || /testInfo\.project\.name\s*!==/.test(spec)) {
    errors.push('전용 편집 E2E는 viewport를 skip/fixme로 우회하면 안 됩니다.');
  }
  return errors;
}

async function main() {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] : process.cwd();
  if (!root) throw new Error('--root 값이 필요합니다.');
  const errors = await validateEditorAcceptanceContract(root);
  if (errors.length > 0) {
    for (const error of errors) console.error(`EDITOR_ACCEPTANCE_CONTRACT\t${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('EDITOR_ACCEPTANCE_CONTRACT\tOK');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) await main();
