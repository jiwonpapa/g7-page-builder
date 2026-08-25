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
    [/\.g7pb-preview-hero-split--layout-overlap\s*\{[^}]*repeat\(12,\s*minmax\(0,\s*1fr\)\)/,
      '편집기 overlap Hero grid는 최소 콘텐츠 폭으로 캔버스를 밀면 안 됩니다.'],
    [/\.g7pb-preview-logo-cloud--layout-grid\s*>\s*div\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
      '편집기 Logo grid 열은 로고 고유 폭보다 작아질 수 있어야 합니다.'],
  ];
  for (const [pattern, message] of cssContract) requirePattern(errors, css, pattern, message);
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
    [/expect\(builtinManifest\.blocks\)\.toHaveLength\(45\)/, '45개 블록 종류 고정 assertion이 필요합니다.'],
    [/expect\(builtinManifest\.presets\)\.toHaveLength\(95\)/, '95개 완성 섹션 고정 assertion이 필요합니다.'],
    [/expect\(pageKitScenarios\)\.toHaveLength\(5\)/, '내장 Page Kit 5종 고정 assertion이 필요합니다.'],
    [/api\.post\(`\$\{API\}\/store\/page-kits\/apply`/, 'Page Kit은 실제 공식 마켓 적용 API로 생성해야 합니다.'],
    [/not\.toContain\(['"]g7pb-media:\/\/['"]\)/, 'Page Kit portable media가 실제 저장 URL로 해소됐는지 확인해야 합니다.'],
    [/api\.delete\(`\$\{API\}\/media\/\$\{mediaId\}`\)/, 'Page Kit gate가 만든 미디어를 정확한 ID로 정리해야 합니다.'],
    [/ALL_95_PRESET_LAYOUT_GATE/, '95개 프리셋 편집/미리보기 gate가 필요합니다.'],
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
