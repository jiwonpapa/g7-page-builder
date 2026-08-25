#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';

const REQUIRED_SPEC = 'tests/E2E/editorInteractionQuality.spec.ts';

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
  const [packageSource, makefile, coordinationHarness, spec, richTextSource, adapterSource, canvasSource] = await Promise.all([
    text(root, 'package.json'),
    text(root, 'Makefile'),
    text(root, 'scripts/coord-harness.sh'),
    text(root, REQUIRED_SPEC),
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
    [/page\.keyboard\.(?:down|press)\(\s*['"](?:Shift|ArrowLeft|ArrowRight)/, 'Shift/방향키로 선택 범위를 재구성하면 안 됩니다.'],
    [/rangeToolbar[\s\S]{0,180}\.selectOption\s*\(/, '선택 글자 툴바는 selectOption 직접 주입이 아니라 실제 사용자 조작으로 검증해야 합니다.'],
    [/console\.log\s*\(/, '전용 E2E에 임시 진단 로그를 남기면 안 됩니다.'],
  ];
  for (const [pattern, message] of forbiddenSyntheticSelection) {
    if (pattern.test(spec)) errors.push(message);
  }

  const requiredEvidence = [
    [/test\.describe\.configure\(\{\s*retries:\s*0\s*\}\)/, '전용 E2E는 retries: 0으로 실행해야 합니다.'],
    [/page\.mouse\.down\s*\(/, '실제 pointer 선택을 위한 page.mouse.down이 필요합니다.'],
    [/page\.mouse\.move\(pointer\.start\.x,\s*pointer\.start\.y\)/, 'iframe 축척을 반영한 실제 pointer 시작 이동이 필요합니다.'],
    [/page\.mouse\.move\(pointer\.end\.x,\s*pointer\.end\.y,\s*\{\s*steps:\s*8\s*\}\)/, 'iframe 축척을 반영한 실제 pointer 범위 드래그가 필요합니다.'],
    [/field\.focus\(\)/, '범위 선택 전 contenteditable focus가 필요합니다.'],
    [/expect\(field\)\.toBeFocused\(\)/, '실제 pointer 드래그 뒤 contenteditable focus를 확인해야 합니다.'],
    [/page\.mouse\.up\s*\(/, '실제 pointer 선택을 위한 page.mouse.up이 필요합니다.'],
    [/expect\.poll\(\(\)\s*=>\s*selectedText\(field\)\)\.toBe\(target\)/, 'mouse up 직후 선택 문자열이 목표 문자열과 정확히 같은지 확인해야 합니다.'],
    [/page\.mouse\.click\(pointer\.end\.x,\s*pointer\.end\.y\)/, '선택 해제도 실제 화면 좌표의 pointer click으로 검증해야 합니다.'],
    [/projectName\s*===\s*['"]mobile['"]\s*\?\s*360\s*:\s*projectName\s*===\s*['"]tablet['"]\s*\?\s*768\s*:\s*1280/, '각 browser project에 맞는 360/768/1280 canvas 폭을 선택해야 합니다.'],
    [/const CANVAS_IFRAME\s*=\s*['"]#puck-canvas-root iframe['"]/, 'Puck canvas 고유 iframe selector를 고정해야 합니다.'],
    [/frameLocator\(CANVAS_IFRAME\)/, '모든 편집 상호작용은 Puck canvas iframe을 사용해야 합니다.'],
    [/page\.locator\(CANVAS_IFRAME\)\)\.toHaveCount\(1\)/, 'Puck canvas iframe이 정확히 하나인지 확인해야 합니다.'],
    [/start\.left\s*-\s*fieldRect\.left/, '선택 시작점을 contenteditable 내부 좌표로 계산해야 합니다.'],
    [/end\.right\s*-\s*fieldRect\.left/, '선택 끝점을 contenteditable 내부 좌표로 계산해야 합니다.'],
    [/field\.boundingBox\(\)/, 'iframe 내부 좌표를 실제 화면 좌표로 변환해야 합니다.'],
    [/box\.width\s*\/\s*geometry\.fieldWidth/, 'iframe의 실제 가로 축척을 pointer 좌표에 반영해야 합니다.'],
    [/box\.height\s*\/\s*geometry\.fieldHeight/, 'iframe의 실제 세로 축척을 pointer 좌표에 반영해야 합니다.'],
    [/box\.x\s*\+\s*geometry\.startX\s*\*\s*scaleX/, '선택 시작점을 실제 page 좌표로 변환해야 합니다.'],
    [/box\.y\s*\+\s*geometry\.endY\s*\*\s*scaleY/, '선택 끝점을 실제 page 좌표로 변환해야 합니다.'],
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
    [/COLLAPSED_SELECTION_GATE/, '선택 해제 시 툴바 닫힘 gate가 필요합니다.'],
    [/REPEATED_SELECTION_GATE/, '반복 선택 상태 경쟁 gate가 필요합니다.'],
    [/PERSISTED_SELECTION_MARK_GATE/, '저장·재로드 부분 서식 gate가 필요합니다.'],
    [/PREVIEW_SELECTION_MARK_GATE/, '미리보기 부분 서식 gate가 필요합니다.'],
    [/PUBLIC_SELECTION_MARK_GATE/, '공개 출력 부분 서식 gate가 필요합니다.'],
    [/page-builder-richtext-inline-toolbar/, '글자 범위 툴바 assertion이 필요합니다.'],
    [/getByRole\(['"]button['"],\s*\{\s*name:\s*['"]선택한 글자 굵게['"],\s*exact:\s*true\s*\}\)\.click\(\)/, '실제 굵게 버튼 click과 결과 검증이 필요합니다.'],
    [/getByRole\(['"]option['"],\s*\{\s*name:\s*option,\s*exact:\s*true\s*\}\)\.click\(\)/, '선택 글자 메뉴의 실제 option click이 필요합니다.'],
    [/page-builder-context-panel/, '요소 전체 벌룬 assertion이 필요합니다.'],
    [/data-g7pb-font/, '선택 글꼴 DOM assertion이 필요합니다.'],
    [/data-g7pb-size/, '선택 크기 DOM assertion이 필요합니다.'],
    [/data-g7pb-tone/, '선택 색상 DOM assertion이 필요합니다.'],
    [/page\.reload\s*\(/, '저장 뒤 실제 에디터 재로드가 필요합니다.'],
    [/page-builder-preview-link/, '미리보기 검증이 필요합니다.'],
    [/page-builder-public-link/, '공개 출력 검증이 필요합니다.'],
  ];
  for (const [pattern, message] of requiredEvidence) requirePattern(errors, spec, pattern, message);

  const requiredRangeState = [
    [richTextSource, /RICH_TEXT_RANGE_STATE_MESSAGE\s*=\s*['"]g7pb:richtext-range-state['"]/, '선택 범위 active/inactive 단일 메시지 계약이 필요합니다.'],
    [richTextSource, /setTextSelection\(bookmark\)/, '툴바 명령 전에 저장한 선택 범위를 복원해야 합니다.'],
    [richTextSource, /onPointerDownCapture=\{preserveRangeOnPointerDown\}/, '툴바 pointer down에서 선택 범위를 보존해야 합니다.'],
    [richTextSource, /toggleNativeMark\(['"]bold['"]\)/, '선택 범위 굵게 명령을 제품 툴바가 직접 실행해야 합니다.'],
    [adapterSource, /event\.data\?\.type === RICH_TEXT_RANGE_STATE_MESSAGE/, '호스트가 선택 범위 상태 메시지를 수신해야 합니다.'],
    [adapterSource, /acceptRangeState\(event\.data\.active === true\)/, '호스트 UI는 active와 inactive를 같은 상태 처리기로 동기화해야 합니다.'],
  ];
  for (const [source, pattern, message] of requiredRangeState) requirePattern(errors, source, pattern, message);
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
