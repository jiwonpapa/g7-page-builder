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
  const [packageSource, makefile, coordinationHarness, spec, fixture, playwrightConfig, richTextSource, adapterSource, canvasSource, canvasContextSource, viewportPolicySource, layoutSpec, sitePartSpec, sitePartEditorSource, sitePartResponsiveSource, sitePartSchema, sitePartCompiler] = await Promise.all([
    text(root, 'package.json'),
    text(root, 'Makefile'),
    text(root, 'scripts/coord-harness.sh'),
    text(root, REQUIRED_SPEC),
    text(root, REQUIRED_FIXTURE),
    text(root, 'playwright.config.ts'),
    text(root, 'resources/js/editor/richTextEditing.tsx'),
    text(root, 'resources/js/editor/PuckEditorAdapter.tsx'),
    text(root, 'resources/js/editor/canvasEditingContract.ts'),
    text(root, 'resources/js/editor/canvasContextState.ts'),
    text(root, 'resources/js/editor/editorViewportPolicy.ts'),
    text(root, 'tests/E2E/editorLayoutParity.spec.ts'),
    text(root, 'tests/E2E/sitePartLifecycle.spec.ts'),
    text(root, 'resources/js/editor/SitePartEditor.tsx'),
    text(root, 'resources/js/editor/sitePartResponsive.ts'),
    text(root, 'schemas/site-part-document.schema.json'),
    text(root, 'src/Application/Compilation/SitePartHtmlCompiler.php'),
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
    [/page\.keyboard\.(?:down|press)\(\s*['"](?:Shift|ArrowLeft|ArrowRight)/, 'Shift/방향키로 선택 범위를 재구성하면 안 됩니다.'],
    [/rangeToolbar[\s\S]{0,180}\.selectOption\s*\(/, '선택 글자 툴바는 selectOption 직접 주입이 아니라 실제 사용자 조작으로 검증해야 합니다.'],
    [/console\.log\s*\(/, '전용 E2E에 임시 진단 로그를 남기면 안 됩니다.'],
    [/page\.evaluate\([\s\S]{0,500}\b(?:fetch|XMLHttpRequest|execCommand|setContent|setMark|toggleBold|toggleItalic|toggleUnderline)\b/, 'evaluate 안에서 편집 API를 직접 주입하면 안 됩니다.'],
    [/\.evaluate\([\s\S]{0,300}(?:innerHTML|textContent)\s*=/, 'evaluate로 편집 DOM 값을 직접 주입하면 안 됩니다.'],
    [/\.evaluate\([^\n]{0,300}\.click\s*\(/, 'evaluate click으로 실제 포인터 경로를 우회하면 안 됩니다.'],
    [/dispatchEvent\s*\([^\n]*(?:beforeinput|input)/, '합성 input 이벤트로 편집 결과를 주입하면 안 됩니다.'],
    [/force\s*:\s*true/, '전용 편집 E2E는 force click/hover로 실제 hit target 검증을 우회하면 안 됩니다.'],
    [/field\.focus\(\)/, '전용 편집 E2E는 프로그램식 focus가 아니라 실제 pointerdown으로 contenteditable focus를 만들어야 합니다.'],
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
  requirePattern(errors, playwrightConfig, /const PC_ONLY_EDITOR_TESTS = \/\(\?:editorInteractionQuality\|editorPerformance\|pageBuilderLifecycle\|sitePartLifecycle\)\\\.spec\\\.ts\//,
    'Playwright가 실제 편집 E2E 목록을 PC 전용 계약으로 고정해야 합니다.');
  for (const project of ['tablet', 'mobile']) {
    requirePattern(errors, playwrightConfig, new RegExp(`name:\\s*['"]${project}['"][\\s\\S]{0,100}testIgnore:\\s*PC_ONLY_EDITOR_TESTS`),
      `Playwright ${project} project는 실제 편집 E2E를 실행하면 안 됩니다.`);
  }

  const responsiveSitePartEvidence = [
    [sitePartResponsiveSource, /viewportFromWidth[\s\S]*?width > 899[\s\S]*?width <= 520/, 'Site Part 기기 폭은 PC·태블릿·모바일 단일 계약으로 분류해야 합니다.'],
    [sitePartResponsiveSource, /resolveHeaderPresentation[\s\S]*?overrides\.tablet[\s\S]*?overrides\.mobile/, 'Header 표시값은 PC→태블릿→모바일 순서로 상속해야 합니다.'],
    [sitePartResponsiveSource, /resetResponsiveViewport[\s\S]*?delete next\[viewport\]/, '기기 설정 초기화는 선택한 화면 재정의만 제거해야 합니다.'],
    [sitePartEditorSource, /usePuck<Config<SitePartComponents>>\(\)[\s\S]*?appState\.ui\.viewports\.current\.width/, '기기별 표시 필드는 실제 Puck viewport 상태를 사용해야 합니다.'],
    [sitePartEditorSource, /page-builder-responsive-reset[\s\S]*?sheet-bottom/, '기기별 표시 UI에 초기화와 하단 시트 메뉴가 필요합니다.'],
    [sitePartSchema, /headerResponsiveOverride[\s\S]*?additionalProperties[\s\S]*?false[\s\S]*?sheet-bottom/, 'Site Part schema가 임의 스타일을 막고 하단 시트 enum을 허용해야 합니다.'],
    [sitePartCompiler, /COMPILER_VERSION = '0\.5\.0'[\s\S]*?data-g7pb-tablet-density[\s\S]*?data-g7pb-mobile-menu-style/, '발행 컴파일러가 새 반응형 계약과 compiler version을 출력해야 합니다.'],
    [sitePartSpec, /page-builder-responsive-menu-style[\s\S]*?selectOption\('sheet-bottom'\)[\s\S]*?page-builder-responsive-reset/, 'Site Part E2E가 실제 viewport 설정 변경과 초기화를 검증해야 합니다.'],
    [sitePartSpec, /data-g7pb-mobile-menu-style[\s\S]*?sheet-bottom[\s\S]*?drawerBox[\s\S]*?viewportSize/, 'Site Part E2E가 공개 하단 시트의 실제 geometry를 검증해야 합니다.'],
    [sitePartSpec, /page-builder-responsive-navigation[\s\S]*?selectOption\('false'\)[\s\S]*?footerNavigation[\s\S]*?toBeHidden/, 'Footer E2E가 모바일 메뉴 표시 재정의를 실제 화면에서 검증해야 합니다.'],
  ];
  for (const [source, pattern, message] of responsiveSitePartEvidence) requirePattern(errors, source, pattern, message);

  const requiredEvidence = [
    [/test\.describe\.configure\(\{\s*retries:\s*0\s*\}\)/, '전용 E2E는 retries: 0으로 실행해야 합니다.'],
    [/test\.use\(\{\s*screenshot:\s*['"]only-on-failure['"]/, '전용 E2E 실패에는 실제 픽셀 상태를 확인할 스크린샷을 남겨야 합니다.'],
    [/page\.mouse\.down\s*\(/, '실제 pointer 선택을 위한 page.mouse.down이 필요합니다.'],
    [/page\.mouse\.move\(pointer\.start\.x, pointer\.start\.y\)/, 'topmost 검증을 통과한 실제 page mouse로 pointer 시작점에 이동해야 합니다.'],
    [/page\.mouse\.move\(pointer\.end\.x, pointer\.end\.y, \{ steps: POINTER_DRAG_STEPS \}\)/, 'force 없이 여러 실제 mouse move 단계로 pointer 종료점에 이동해야 합니다.'],
    [/function dragSelectText\([\s\S]{0,1100}assertTextPointerReachable\(page, field, pointer\)/, 'pointer down 전에 상위 문서와 iframe 내부 start/end hit target을 검증해야 합니다.'],
    [/function dragSelectText\([\s\S]{0,700}attempt > 0\) await collapseSelectionWithPointer\(page, selection\)[\s\S]{0,250}resolveRichTextSelection\(page, selection\)/,
      '선택 재시도는 기존 범위를 실제 포인터 클릭으로 접은 뒤 current locator를 다시 찾아야 합니다.'],
    [/function assertTextPointerReachable\([\s\S]*?document\.elementsFromPoint\(point\.x, point\.y\)[\s\S]*?ariaBusy:[\s\S]*?saveState:[\s\S]*?outlineDragging:[\s\S]*?pointerEvents:[\s\S]*?canvasHits/,
      '텍스트 포인터 실패는 editor·iframe pointer 상태와 실제 hit stack·canvas hit를 보고해야 합니다.'],
    [/function collapseSelectionWithPointer\([\s\S]{0,900}findFieldCollapsePoints\(page, field, targetNode, currentSelection\)[\s\S]{0,180}for \(const point of points\)[\s\S]{0,180}page\.mouse\.click\(point\.x, point\.y\)[\s\S]{0,300}selectedText\(field\) === ['"]['"]/, '선택 해제는 같은 current field의 선택 substring 밖 실제 prefix/suffix 픽셀을 클릭해 빈 범위를 확인해야 합니다.'],
    [/expect\(field\)\.toBeFocused\(\)/, '실제 pointer 드래그 뒤 contenteditable focus를 확인해야 합니다.'],
    [/page\.mouse\.up\s*\(/, '실제 pointer 선택을 위한 page.mouse.up이 필요합니다.'],
    [/expect\.poll\(\(\)\s*=>\s*selectedText\(field\)\)\.toBe\(target\)/, 'mouse up 직후 선택 문자열이 목표 문자열과 정확히 같은지 확인해야 합니다.'],
    [/function findFieldCollapsePoints\([\s\S]*?document\.createRange\(\)[\s\S]*?range\.getClientRects\(\)[\s\S]*?source: ['"]prefix['"][\s\S]*?source: ['"]suffix['"][\s\S]*?document\.elementFromPoint\(point\.x, point\.y\)[\s\S]*?fieldHit: hit === fieldRoot \|\| fieldRoot\.contains\(hit\)[\s\S]*?selectedRectHit:[\s\S]*?toolbarHit: Boolean\(hit\?\.closest\(['"]\[data-puck-rte-menu\]['"]\)\)[\s\S]*?canvasHits\[index\]\?\.selectedRectHit === false[\s\S]*?return reachable/, '선택 해제 좌표는 선택 substring 바깥 prefix/suffix Range rect이면서 field 내부·툴바 밖인 실제 픽셀이어야 합니다.'],
    [/segmentRects\.length > 0[\s\S]{0,120}\? segmentRects[\s\S]{0,180}selectedRects\.map\(\(rect\) => \(\{ rect, source: ['"]selected-fallback['"][\s\S]*?candidates\[index\]\?\.local\.source === ['"]selected-fallback['"][\s\S]{0,140}canvasHits\[index\]\?\.selectedRectHit === true/,
      '필드 전체 선택은 prefix/suffix가 없을 때만 선택 Range 내부의 실제 문자 픽셀 클릭으로 접어야 합니다.'],
    [/const PC_EDIT_CANVAS_WIDTH\s*=\s*1280/, '실제 편집 E2E는 PC canvas 폭을 단일 계약으로 고정해야 합니다.'],
    [/const CANVAS_IFRAME\s*=\s*['"]#puck-canvas-root iframe['"]/, 'Puck canvas 고유 iframe selector를 고정해야 합니다.'],
    [/frameLocator\(CANVAS_IFRAME\)/, '모든 편집 상호작용은 Puck canvas iframe을 사용해야 합니다.'],
    [/page\.locator\(CANVAS_IFRAME\)\)\.toHaveCount\(1\)/, 'Puck canvas iframe이 정확히 하나인지 확인해야 합니다.'],
    [/field\.boundingBox\(\)/, 'iframe 내부 좌표를 실제 화면 좌표로 변환해야 합니다.'],
    [/targetNode\.boundingBox\(\)/, '선택 대상의 실제 렌더링 box를 측정해야 합니다.'],
    [/targetNode\.evaluate\(\(element\)\s*=>\s*\{[\s\S]*?firstCharacter\.getClientRects\(\)[\s\S]*?lastCharacter\.getClientRects\(\)[\s\S]*?caretPositionFromPoint[\s\S]*?targetStart[\s\S]*?targetEnd/,
      '선택 시작·끝은 실제 글자 rect와 정확한 caret offset으로 측정해야 합니다.'],
    [/startCandidate\.x\s*-\s*fieldRect\.left[\s\S]{0,360}endCandidate\.x\s*-\s*fieldRect\.left/,
      '검증된 caret 좌표를 current contenteditable 내부 좌표로 변환해야 합니다.'],
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
    [/PC_ONLY_EDITING_GATE/, '실제 편집 E2E에 PC 전용 편집 모드 gate가 필요합니다.'],
    [/INTERACTIVE_CANVAS_GATE/, '실제 iframe의 상호작용 가능 크기 gate가 필요합니다.'],
    [/iframe\.boundingBox\(\)/, '실제 iframe의 상호작용 가능 크기를 측정해야 합니다.'],
    [/toBeGreaterThan\(1\)/, '실제 iframe의 가로·세로 크기가 0이 아님을 확인해야 합니다.'],
    [/POINTER_CANVAS_GATE/, '실제 글자 드래그 전에 pointer canvas 확보 gate가 필요합니다.'],
    [/page-builder-block-library/, '좁은 화면의 블록 라이브러리를 식별해야 합니다.'],
    [/getByText\(['"]Blocks['"],\s*\{\s*exact:\s*true\s*\}\)/, '좁은 화면에서는 블록 라이브러리를 실제 닫아야 합니다.'],
    [/expect\(library\)\.toBeHidden\(\)/, 'pointer canvas 확보 뒤 블록 라이브러리 닫힘을 확인해야 합니다.'],
    [/RANGE_TOOLBAR_EXCLUSIVE_GATE/, '범위 툴바와 요소 벌룬 상호배타 gate가 필요합니다.'],
    [/RANGE_BALLOON_ANCHOR_GATE/, '선택 글자 툴바가 실제 Range에 붙는 geometry gate가 필요합니다.'],
    [/OFFICIAL_PUCK_MENU_ROOT_GATE/, '공식 Puck menu root 범위 gate가 필요합니다.'],
    [/ROOT_INLINE_RICH_GATE/, 'root inline-rich 실제 편집 gate가 필요합니다.'],
    [/NESTED_INLINE_RICH_GATE/, 'nested array inline-rich 실제 편집 gate가 필요합니다.'],
    [/CANVAS_ONLY_RICH_TEXT_CONTENT_GATE/, 'block-rich 캔버스 직접 편집 gate가 필요합니다.'],
    [/NO_LINK_INLINE_GATE/, '외부 action 내부 inline-rich의 no-link gate가 필요합니다.'],
    [/SIDEBAR_RICH_TEXT_DUPLICATION_REMOVED_GATE/, '우측 sidebar의 중복 richtext 편집기 부재 gate가 필요합니다.'],
    [/COLLAPSED_SELECTION_GATE/, '선택 해제 시 툴바 닫힘 gate가 필요합니다.'],
    [/REPEATED_SELECTION_GATE/, '반복 선택 상태 경쟁 gate가 필요합니다.'],
    [/PERSISTED_SELECTION_MARK_GATE/, '저장·재로드 부분 서식 gate가 필요합니다.'],
    [/PREVIEW_SELECTION_MARK_GATE/, '미리보기 부분 서식 gate가 필요합니다.'],
    [/PUBLIC_SELECTION_MARK_GATE/, '공개 출력 부분 서식 gate가 필요합니다.'],
    [/page-builder-richtext-inline-toolbar/, '글자 범위 툴바 assertion이 필요합니다.'],
    [/locator\(['"]\[data-puck-rte-menu=[\\]?['"]true[\\]?['"]\]:visible['"]\)/, '공식 Puck 원본 data-puck-rte-menu root locator가 필요합니다.'],
    [/menuRoot\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 굵게['"],\s*exact:\s*true\s*\}\)/, '공식 Puck menu root 안 굵게 버튼 검증이 필요합니다.'],
    [/menuRoot\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 기울임['"],\s*exact:\s*true\s*\}\)/, '공식 Puck menu root 안 기울임 버튼 검증이 필요합니다.'],
    [/menuRoot\.getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 밑줄['"],\s*exact:\s*true\s*\}\)/, '공식 Puck menu root 안 밑줄 버튼 검증이 필요합니다.'],
    [/expect\(bold\)\.toHaveCount\(1\)[\s\S]{0,160}expect\(italic\)\.toHaveCount\(1\)[\s\S]{0,160}expect\(underline\)\.toHaveCount\(1\)/,
      '부분 글자 B/I/U control은 공식 Puck menu 안에 각각 하나만 있어야 합니다.'],
    [/getByRole\(['"]button['"],\s*\{\s*name:\s*['"]링크 편집['"],\s*exact:\s*true\s*\}\)\)\.toHaveCount\(0\)/, 'ArticleList title에서 링크 편집 control 부재를 검증해야 합니다.'],
    [/const optionControl = page\.frameLocator\(CANVAS_IFRAME\)\.getByRole\(['"]option['"],\s*\{\s*name:\s*option,\s*exact:\s*true\s*\}\)[\s\S]{0,180}await assertPointerReachable\(page, optionControl\)[\s\S]{0,180}activateControl\(optionControl\)/,
      '선택 글자 portal option은 iframe body에서 도달성 확인 뒤 실제 PC pointer click으로 활성화해야 합니다.'],
    [/const appliedMark = field\.locator\(`span\[data-g7pb-\$\{markAttribute\}="\$\{markValue\}"\]`\)[\s\S]{0,300}expect\(appliedMark\)\.toHaveText\(target\)/,
      '각 선택 글자 option은 다음 tap 전에 해당 범위에 즉시 적용됐는지 검증해야 합니다.'],
    [/function expectNoSidebarRichTextEditor[\s\S]{0,500}\[contenteditable=["']true["']\]:visible[\s\S]{0,220}\[data-puck-rte-menu\]:visible/, '우측 sidebar에서 contenteditable과 서식 메뉴가 모두 제거됐는지 검증해야 합니다.'],
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
    [/SIDEBAR_RICH_TEXT_DUPLICATION_REMOVED_GATE[\s\S]{0,500}expectNoSidebarRichTextEditor\(page\)/,
      '중복 제거 gate가 선택된 richtext 블록의 우측 sidebar 부재를 검증해야 합니다.'],
    [/CANVAS_ONLY_RICH_TEXT_CONTENT_GATE[\s\S]{0,1000}dragSelectText\([\s\S]{0,500}page\.keyboard\.type\([\s\S]{0,300}expectNoSidebarRichTextEditor\(page\)/,
      'block-rich는 실제 pointer 선택과 키 입력으로 캔버스에서만 편집해야 합니다.'],
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
    [richTextSource, /const scheduleCloseAfterPointer[\s\S]{0,500}setTimeout\([\s\S]{0,240}onClose\(\)/,
      '선택 글자 옵션은 compatibility click이 없을 때도 제한된 유예 뒤 닫혀야 합니다.'],
    [richTextSource, /const chooseFromPointer[\s\S]{0,500}pending\.pointerId !== event\.pointerId \|\| pending\.value !== nextValue[\s\S]{0,200}onChange\(nextValue\);[\s\S]{0,80}scheduleCloseAfterPointer\(\)/,
      '선택 글자 옵션은 같은 pointer의 pointerup에서 한 번만 적용하고 compatibility click까지 portal을 유지한 뒤 닫혀야 합니다.'],
    [richTextSource, /onPointerDown=\{\(event\) => armOptionFromPointer\(event, option\.value\)\}[\s\S]{0,180}onPointerUp=\{\(event\) => chooseFromPointer\(event, option\.value\)\}/,
      '선택 글자 옵션은 pointerdown에서 선택과 타깃을 유지하고 같은 pointer의 pointerup에서 한 번만 적용해야 합니다.'],
    [richTextSource, /if \(suppressCompatibilityClick\.current\) \{[\s\S]{0,140}clearPointerActivation\(\);[\s\S]{0,80}onClose\(\);[\s\S]{0,80}return;/,
      '선택 글자 옵션은 compatibility click이 발생해도 중복 적용하지 않아야 합니다.'],
    [richTextSource, /toggleBold\(\)\.run\(\)[\s\S]{0,900}toggleItalic\(\)\.run\(\)[\s\S]{0,900}toggleUnderline\(\)\.run\(\)/, '부분 글자 B/I/U는 Puck editor의 공식 Tiptap 명령을 사용해야 합니다.'],
    [richTextSource, /<RichTextMenu\.Control[\s\S]{0,600}title="링크 편집"/, '사용자 정의 링크 명령은 Puck RichTextMenu.Control을 사용해야 합니다.'],
    [richTextSource, /import\s*\{\s*createPortal\s*\}\s*from\s*['"]react-dom['"]/, '선택 글자 option과 링크 편집기는 ActionBar overflow 밖의 React portal을 사용해야 합니다.'],
    [richTextSource, /function RichTextFloatingLayer[\s\S]*anchorRef\.current[\s\S]*data-g7pb-safe-clip-left[\s\S]*data-g7pb-safe-clip-bottom[\s\S]*ResizeObserver[\s\S]*MutationObserver[\s\S]*createPortal\([\s\S]*data-puck-rte-menu="portal"[\s\S]*ownerDocument\.body/,
      '선택 글자 floating layer는 iframe ownerDocument와 공통 safe clip에 배치되고 Puck RTE 포커스 경계를 유지해야 합니다.'],
    [richTextSource, /const FLOATING_LAYER_STABLE_FRAMES = 3;[\s\S]*let pendingPlacement: string \| null = null;[\s\S]*let stablePlacementFrames = 0;[\s\S]*pendingPlacement === placement[\s\S]*stablePlacementFrames \+= 1[\s\S]*stablePlacementFrames >= FLOATING_LAYER_STABLE_FRAMES[\s\S]*data-g7pb-floating-ready/,
      '선택 글자 floating layer는 연속 세 프레임의 배치가 같을 때만 노출되어야 합니다.'],
    [richTextSource, /const invalidatePlacement = \(\): void => \{[\s\S]*revealed = false;[\s\S]*pendingPlacement = null;[\s\S]*stablePlacementFrames = 0;[\s\S]*removeAttribute\(['"]data-g7pb-floating-ready['"]\)[\s\S]*visibility !== ['"]hidden['"][\s\S]*new ownerWindow\.MutationObserver\(invalidatePlacement\)/,
      '선택 글자 floating layer는 safe-zone 변경 시 즉시 숨기고 안정 배치를 다시 계산해야 합니다.'],
    [richTextSource, /g7pb-richtext-floating-layer[\s\S]*<RichTextFloatingLayer anchorRef=\{triggerRef\}[\s\S]*role="listbox"[\s\S]*<RichTextFloatingLayer anchorRef=\{ref\} align="end"/,
      '글꼴·크기·굵기·색상 option과 링크 form 모두 같은 floating portal 계약을 사용해야 합니다.'],
    [richTextSource, /const rangeActive = Boolean\(editorState\?\.g7HasSelection\)/, 'inline menu 표시는 Puck editorState의 선택 상태만 사용해야 합니다.'],
    [richTextSource, /export function createRichTextField[\s\S]{0,700}contentEditable:\s*true,[\s\S]{0,400}visible:\s*false,/, 'richtext는 캔버스에서만 편집하고 Puck sidebar 중복 필드는 숨겨야 합니다.'],
    [richTextSource, /g7HasSelection:\s*isRichTextRangeActive\(context\.editor\)/, 'Puck selector가 선택 범위 상태를 파생해야 합니다.'],
    [richTextSource, /export function richTextRangeAnchorFromSelection\([\s\S]*getClientRects\(\)[\s\S]*width: right - left, height: bottom - top/, '선택 글자 벌룬은 실제 DOM Range의 렌더링 좌표를 사용해야 합니다.'],
    [richTextSource, /RICH_TEXT_RANGE_STATE_MESSAGE\s*=\s*['"]g7pb:richtext-range-state['"]/, '선택 범위 active/inactive 단일 메시지 계약이 필요합니다.'],
    [adapterSource, /event\.data\?\.type === RICH_TEXT_RANGE_STATE_MESSAGE/, '호스트가 선택 범위 상태 메시지를 수신해야 합니다.'],
    [adapterSource, /acceptRangeState\(event\.data\.active === true, event\.data\.anchor\)/, '호스트 UI는 active와 inactive 및 Range 좌표를 같은 상태 처리기로 동기화해야 합니다.'],
    [adapterSource, /rangeEditingActive\s*\?\s*richTextRangeAnchorFromSelection\(ownerDocument\) \?\? rangeAnchor \?\? selectedOverlay\.getBoundingClientRect\(\)[\s\S]*selectedOverlay\.getBoundingClientRect\(\)/, '범위 선택 중 ActionBar는 블록이 아니라 현재 DOM Range를 기준으로 배치해야 합니다.'],
    [adapterSource, /if \(!canvasUi\?\.textToolsOpen \|\| canvasUi\.rangeEditingActive/, '글자 범위 선택 중 요소 전체 스타일 벌룬을 렌더하면 안 됩니다.'],
    [adapterSource, /const elementStyleTarget =[\s\S]*?const styleActionLabel =[\s\S]*?aria-label=\{styleActionLabel\}[\s\S]*?page-builder-element-style-open[\s\S]*?page-builder-block-style-open/, 'ActionBar는 T 버튼 대신 요소 전체 스타일과 블록 설정을 구분해야 합니다.'],
  ];
  for (const [source, pattern, message] of requiredRangeState) requirePattern(errors, source, pattern, message);
  const updateMarkSource = richTextSource.match(/const updateMark = [\s\S]*?\n  };/)?.[0] ?? '';
  if (!updateMarkSource || /setOpenMenu\(/.test(updateMarkSource)) {
    errors.push('선택 글자 mark 명령은 메뉴 상태를 직접 바꾸지 않고 pointerup 수명주기에서 닫혀야 합니다.');
  }
  requirePattern(errors, spec, /function activateControl\(control: Locator\)[\s\S]{0,120}control\.click\(\{ scroll: ['"]none['"] \}\)/,
    '선택 글자 control은 PC에서 실제 locator click으로 활성화해야 합니다.');
  requirePattern(errors, spec, /function activateCanvasPoint\(page: Page, point: PointerPoint\)[\s\S]{0,160}page\.mouse\.click\(point\.x, point\.y\)[\s\S]*?dismissContextPanelWithPointer[\s\S]{0,900}activateCanvasPoint\(page, point\)/,
    '요소 벌룬 닫기는 PC 캔버스의 검증된 픽셀을 실제 mouse로 활성화해야 합니다.');
  requirePattern(errors, spec, /function expectStableControlGeometry[\s\S]*?expect\(control\)\.toBeVisible\(\)[\s\S]*?g7pb-richtext-floating-layer[\s\S]*?toHaveAttribute\(['"]data-g7pb-floating-ready['"], ['"]true['"]\)[\s\S]*?index < 3[\s\S]*?sample\.ready/,
    '선택 글자 control은 안정 배치가 노출된 뒤 세 프레임의 geometry를 검증해야 합니다.');
  requirePattern(errors, spec, /function expectRangeBalloonAnchored[\s\S]*?data-g7pb-range-anchor['"], ['"]true['"]\)[\s\S]*?getRangeAt\(0\)\.getBoundingClientRect\(\)[\s\S]*?visibleBlockActions[\s\S]*?gap\)\.toBeGreaterThanOrEqual\(4\)[\s\S]*?gap\)\.toBeLessThanOrEqual\(20\)[\s\S]*?visibleBlockActions\)\.toBe\(0\)/,
    '선택 글자 벌룬 E2E는 실제 Range 근접도와 요소 도구 부재를 함께 검증해야 합니다.');
  requirePattern(errors, spec, /const optionControl = page\.frameLocator\(CANVAS_IFRAME\)\.getByRole\(['"]option['"][\s\S]{0,300}expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\)[\s\S]{0,180}activateControl\(optionControl\)[\s\S]{0,180}expect\(optionControl\)\.toBeHidden\(\)[\s\S]{0,180}expect\(menuRoot\)\.toBeVisible\(\)[\s\S]{0,180}expect\.poll\(\(\) => selectedText\(field\)\)\.toBe\(target\)/,
    '선택 글자 portal option의 실제 PC click 뒤 option은 닫히고 Puck 메뉴와 선택 범위는 유지되어야 합니다.');
  requirePattern(errors, spec, /function assertPointerReachable\(page:[\s\S]*?control\.evaluate[\s\S]*?element\.ownerDocument\.elementFromPoint[\s\S]*?const localCenter = localReachability\.points\[0\][\s\S]*?clientLeft:[\s\S]*?borderScaleX[\s\S]*?contentOrigin[\s\S]*?contentScale[\s\S]*?contentOrigin\.x \+ localCenter\.x \* contentScale\.x[\s\S]*?contentOrigin\.y \+ localCenter\.y \* contentScale\.y[\s\S]*?getComputedStyle\(iframe\)\.pointerEvents[\s\S]*?ariaBusy:[\s\S]*?saveState:[\s\S]*?data-puck-outline-dragging[\s\S]*?document\.elementsFromPoint\(point\.x, point\.y\)[\s\S]*?hit: stack\[0\] === iframe[\s\S]*?topDocumentReachability\.points\[0\]\?\.hit === true\) return/,
    '편집 E2E는 iframe 내부 control 중심 hit부터 border·scale 변환과 상위 iframe hit까지 검증해야 합니다.');
  const pointerReachabilitySource = spec.match(/async function assertPointerReachable[\s\S]*?\n}\n\nasync function activateControl/)?.[0] ?? '';
  if (!pointerReachabilitySource || /requestAnimationFrame|waitForTimeout|setTimeout/.test(pointerReachabilitySource)) {
    errors.push('control 도달성은 autosave pointer 차단이 풀리기를 기다려 우회하면 안 됩니다.');
  }
  if (!pointerReachabilitySource || /scrollIntoViewIfNeeded|control\.boundingBox\(\)/.test(pointerReachabilitySource)) {
    errors.push('control 도달성 검증이 레이아웃을 이동시키거나 frame 변환을 Playwright bbox로 대체하면 안 됩니다.');
  }
  const activateControlSource = spec.match(/async function activateControl[\s\S]*?\n}\n\nasync function activateCanvasPoint/)?.[0] ?? '';
  if (!activateControlSource || /page\.(?:touchscreen|mouse)|force\s*:|position\s*:|scroll:\s*['"]auto['"]/.test(activateControlSource) || !/control:\s*Locator/.test(activateControlSource)) {
    errors.push('선택 글자 control은 필수 locator의 실제 tap/click만 사용해야 합니다.');
  }
  requirePattern(errors, spec, /keeps ActionBar and rich-text controls pointer-reachable in the PC editor[\s\S]*for \(const width of \[PC_EDIT_CANVAS_WIDTH\]\)/,
    '부분 텍스트 포인터 E2E는 PC 편집 뷰포트에서 한 번만 실행해야 합니다.');

  const requiredViewportPolicy = [
    [viewportPolicySource, /PC_EDITOR_MIN_HOST_WIDTH\s*=\s*1024/, 'PC 편집 최소 호스트 폭 계약이 필요합니다.'],
    [viewportPolicySource, /PC_EDITOR_VIEWPORT_WIDTH\s*=\s*1280/, 'PC 편집 canvas 폭 계약이 필요합니다.'],
    [viewportPolicySource, /PC_EDITOR_POLICY_NOTICE\s*=\s*['"]편집은 PC에서만 지원합니다\. 모바일·태블릿은 반응형 미리보기 전용입니다\./, 'PC 전용 편집 안내 문구를 고정해야 합니다.'],
    [viewportPolicySource, /const canEdit = !disabled && hostSupported && canvasWidth === PC_EDITOR_VIEWPORT_WIDTH/, '편집 권한은 문서 상태·호스트 폭·PC canvas를 모두 만족할 때만 열려야 합니다.'],
    [viewportPolicySource, /function applyEditorContentPolicy<[\s\S]{0,900}field\.contentEditable === true \? \{ contentEditable: false \}/, '미리보기 모드는 모든 inline-editable 필드를 읽기 전용으로 변환해야 합니다.'],
    [viewportPolicySource, /field\.arrayFields[\s\S]{0,220}field\.objectFields[\s\S]{0,220}field\.filterFields/, '읽기 전용 필드 변환은 array·object·filter 중첩 필드까지 재귀 적용해야 합니다.'],
    [adapterSource, /fields: applyEditorContentPolicy\(component\.fields, false\)/, 'Puck runtime config는 미리보기 모드에 읽기 전용 필드 계약을 적용해야 합니다.'],
    [adapterSource, /permissions=\{\{ edit: viewportPolicy\.canEdit, insert: viewportPolicy\.canEdit, delete: viewportPolicy\.canEdit, duplicate: viewportPolicy\.canEdit, drag: viewportPolicy\.canEdit \}\}/, 'Puck의 모든 mutation 권한은 단일 viewport policy에 연결되어야 합니다.'],
    [adapterSource, /const updateCanonical = \(nextData: PuckEditorData\): void => \{\s*if \(!viewportPolicy\.canEdit\) return;/, '미리보기 모드의 유출된 Puck 변경은 canonical 문서에 반영하면 안 됩니다.'],
    [adapterSource, /data-editing-mode=\{viewportPolicy\.mode\}/, '에디터 루트가 현재 편집·미리보기 모드를 노출해야 합니다.'],
    [adapterSource, /const accept = \(selection: CanvasElementSelection\): void => \{\s*if \(!viewportPolicy\.canEdit\) return;[\s\S]{0,180}transitionCanvasContext\(\{ type: ['"]selection\.accept['"], selection \}\)/, '미리보기 모드에서는 요소·범위 선택 메시지를 수용하면 안 됩니다.'],
    [layoutSpec, /const expectedMode = projectName === ['"]desktop['"] \? ['"]edit['"] : ['"]preview['"]/, '페이지 킷 레이아웃 E2E가 PC 편집과 태블릿·모바일 미리보기를 구분해야 합니다.'],
    [layoutSpec, /viewportMutations[\s\S]{0,220}viewport switch must not persist document data/, '뷰포트 전환이 문서를 저장하지 않는 회귀 gate가 필요합니다.'],
    [layoutSpec, /expectedMode === ['"]preview['"][\s\S]{0,180}locator\(['"]\[contenteditable=['"]true['"]\]['"]\)[\s\S]{0,100}toHaveCount\(0\)/, '태블릿·모바일 미리보기에는 편집 가능한 DOM이 없어야 합니다.'],
  ];
  for (const [source, pattern, message] of requiredViewportPolicy) requirePattern(errors, source, pattern, message);
  const requiredCanvasContextState = [
    [canvasContextSource, /export type CanvasContextTarget =[\s\S]*kind: ['"]none['"][\s\S]*kind: ['"]block['"][\s\S]*kind: ['"]text-element['"][\s\S]*kind: ['"]text-range['"][\s\S]*kind: ['"]media['"][\s\S]*kind: ['"]action['"]/, '캔버스 선택 대상은 단일 판별 상태 계약으로 정의해야 합니다.'],
    [canvasContextSource, /export function reduceCanvasContextState\([\s\S]*action\.type === ['"]selection\.accept['"][\s\S]*action\.type === ['"]selection\.replace['"][\s\S]*action\.type === ['"]range\.change['"][\s\S]*state\.target\.kind !== ['"]text-element['"][\s\S]*state\.target\.kind !== ['"]text-range['"]/, '요소 선택과 글자 범위 전이는 단일 reducer에서 정규화해야 합니다.'],
    [adapterSource, /const \[canvasContextState, setCanvasContextState\] = useState\(INITIAL_CANVAS_CONTEXT_STATE\)[\s\S]*const transitionCanvasContext = useCallback\([\s\S]*reduceCanvasContextState\(canvasContextStateRef\.current, action\)/, '에디터는 단일 캔버스 컨텍스트 상태 커널을 사용해야 합니다.'],
    [adapterSource, /const canvasElementSelection = canvasContextSelection\(canvasContextState\)[\s\S]*const rangeEditingActive = canvasContextRangeActive\(canvasContextState\)/, '요소와 범위 상태는 단일 캔버스 컨텍스트에서 파생해야 합니다.'],
  ];
  for (const [source, pattern, message] of requiredCanvasContextState) requirePattern(errors, source, pattern, message);
  if (/useState<CanvasElementSelection \| null>\(null\)|const \[rangeEditingActive, setRangeEditingActive\] = useState\(false\)/.test(adapterSource)) {
    errors.push('요소 선택과 글자 범위를 별도 React 상태로 중복 관리하면 안 됩니다.');
  }
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
