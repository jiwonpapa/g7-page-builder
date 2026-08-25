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
  const [packageSource, makefile, coordinationHarness, spec] = await Promise.all([
    text(root, 'package.json'),
    text(root, 'Makefile'),
    text(root, 'scripts/coord-harness.sh'),
    text(root, REQUIRED_SPEC),
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
  ];
  for (const [pattern, message] of forbiddenSyntheticSelection) {
    if (pattern.test(spec)) errors.push(message);
  }

  const requiredEvidence = [
    [/test\.describe\.configure\(\{\s*retries:\s*0\s*\}\)/, '전용 E2E는 retries: 0으로 실행해야 합니다.'],
    [/page\.mouse\.down\s*\(/, '실제 pointer 선택을 위한 page.mouse.down이 필요합니다.'],
    [/page\.mouse\.move\(pointer\.start\.x,\s*pointer\.start\.y\)/, 'iframe 축척을 반영한 실제 pointer 시작 이동이 필요합니다.'],
    [/page\.mouse\.move\(pointer\.end\.x,\s*pointer\.end\.y,\s*\{\s*steps:\s*8\s*\}\)/, 'iframe 축척을 반영한 실제 pointer 범위 드래그가 필요합니다.'],
    [/page\.mouse\.up\s*\(/, '실제 pointer 선택을 위한 page.mouse.up이 필요합니다.'],
    [/page\.mouse\.click\(pointer\.end\.x,\s*pointer\.end\.y\)/, '선택 해제도 iframe 축척을 반영한 실제 pointer click으로 검증해야 합니다.'],
    [/projectName\s*===\s*['"]mobile['"]\s*\?\s*360\s*:\s*projectName\s*===\s*['"]tablet['"]\s*\?\s*768\s*:\s*1280/, '각 browser project에 맞는 360/768/1280 canvas 폭을 선택해야 합니다.'],
    [/const CANVAS_IFRAME\s*=\s*['"]#puck-canvas-root iframe['"]/, 'Puck canvas 고유 iframe selector를 고정해야 합니다.'],
    [/frameLocator\(CANVAS_IFRAME\)/, '모든 편집 상호작용은 Puck canvas iframe을 사용해야 합니다.'],
    [/page\.locator\(CANVAS_IFRAME\)\)\.toHaveCount\(1\)/, 'Puck canvas iframe이 정확히 하나인지 확인해야 합니다.'],
    [/start\.left\s*-\s*fieldRect\.left/, '선택 시작점을 contenteditable 내부 좌표로 계산해야 합니다.'],
    [/end\.right\s*-\s*fieldRect\.left/, '선택 끝점을 contenteditable 내부 좌표로 계산해야 합니다.'],
    [/field\.boundingBox\(\)/, 'iframe 내부 좌표를 실제 화면 좌표로 변환해야 합니다.'],
    [/box\.width\s*\/\s*geometry\.fieldWidth/, 'iframe의 실제 가로 축척을 pointer 좌표에 반영해야 합니다.'],
    [/box\.height\s*\/\s*geometry\.fieldHeight/, 'iframe의 실제 세로 축척을 pointer 좌표에 반영해야 합니다.'],
    [/REAL_POINTER_SELECTION_GATE/, '실제 포인터 선택 gate가 필요합니다.'],
    [/CANVAS_VIEWPORT_GATE/, 'browser project와 내부 canvas viewport 일치 gate가 필요합니다.'],
    [/BLOCK_SELECTION_GATE/, '실제 글자 드래그 전에 편집 블록 선택 gate가 필요합니다.'],
    [/getByText\(['"]Outline['"],\s*\{\s*exact:\s*true\s*\}\)/, '좁은 화면에서는 Outline으로 편집 블록을 실제 선택해야 합니다.'],
    [/\[data-puck-layer-tree-id\] button/, 'Outline의 실제 layer button을 안정 속성으로 선택해야 합니다.'],
    [/ancestor::li\[@data-puck-layer-tree-id\]\[1\]/, 'Outline의 실제 layer 행을 선택 상태 검증 대상으로 사용해야 합니다.'],
    [/toHaveClass\(\/Layer--isSelected\//, 'Outline layer의 실제 선택 class를 확인해야 합니다.'],
    [/RANGE_TOOLBAR_EXCLUSIVE_GATE/, '범위 툴바와 요소 벌룬 상호배타 gate가 필요합니다.'],
    [/COLLAPSED_SELECTION_GATE/, '선택 해제 시 툴바 닫힘 gate가 필요합니다.'],
    [/REPEATED_SELECTION_GATE/, '반복 선택 상태 경쟁 gate가 필요합니다.'],
    [/PERSISTED_SELECTION_MARK_GATE/, '저장·재로드 부분 서식 gate가 필요합니다.'],
    [/PREVIEW_SELECTION_MARK_GATE/, '미리보기 부분 서식 gate가 필요합니다.'],
    [/PUBLIC_SELECTION_MARK_GATE/, '공개 출력 부분 서식 gate가 필요합니다.'],
    [/page-builder-richtext-inline-toolbar/, '글자 범위 툴바 assertion이 필요합니다.'],
    [/page-builder-context-panel/, '요소 전체 벌룬 assertion이 필요합니다.'],
    [/data-g7pb-font/, '선택 글꼴 DOM assertion이 필요합니다.'],
    [/data-g7pb-size/, '선택 크기 DOM assertion이 필요합니다.'],
    [/data-g7pb-tone/, '선택 색상 DOM assertion이 필요합니다.'],
    [/page\.reload\s*\(/, '저장 뒤 실제 에디터 재로드가 필요합니다.'],
    [/page-builder-preview-link/, '미리보기 검증이 필요합니다.'],
    [/page-builder-public-link/, '공개 출력 검증이 필요합니다.'],
  ];
  for (const [pattern, message] of requiredEvidence) requirePattern(errors, spec, pattern, message);

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
