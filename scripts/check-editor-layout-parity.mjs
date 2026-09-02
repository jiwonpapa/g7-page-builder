#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateEditorTestRegistration, validateFocusedUnitCommand } from './lib/editorContractRegistration.mjs';

const REQUIRED_SPEC = 'tests/E2E/editorLayoutParity.spec.ts';
const CATALOG_VISUAL_SPEC = 'tests/E2E/blockCatalogQuality.spec.ts';

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

function customPropertyValue(css, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*:\\s*([^;]+);`))?.[1].trim() ?? '';
}

export async function validateEditorLayoutParity(root) {
  const errors = [];
  const [packageSource, editorCss, wysiwygCss, publicCss, adapter, catalogSource, productionSource, overlaySource, spec, catalogVisualSpec] = await Promise.all([
    source(root, 'package.json'),
    source(root, 'resources/css/page-builder-editor.css'),
    source(root, 'resources/css/page-builder-editor-wysiwyg.css'),
    source(root, 'resources/css/page-builder-public.css'),
    source(root, 'resources/js/editor/PuckEditorAdapter.tsx'),
    source(root, 'resources/js/editor/catalogBlocks.tsx'),
    source(root, 'resources/js/editor/productionCatalogBlocks.tsx'),
    source(root, 'resources/js/editor/editorOverlaySafeZone.ts'),
    source(root, REQUIRED_SPEC),
    source(root, CATALOG_VISUAL_SPEC),
  ]);
  const css = `${editorCss}\n${wysiwygCss}`;
  const packageJson = JSON.parse(packageSource);
  const scripts = packageJson.scripts ?? {};
  const puckVersion = packageJson.dependencies?.['@puckeditor/core'];

  const editorRadius = customPropertyValue(css, '--g7pb-theme-radius');
  const publicRadius = customPropertyValue(publicCss, '--g7pb-theme-radius');
  if (editorRadius !== '1rem' || publicRadius !== '1rem') {
    errors.push('편집기와 공개 출력의 기본 radius는 동일한 1rem 계약이어야 합니다.');
  }

  if (puckVersion !== '0.23.0') {
    errors.push('모바일 헤더 흐름은 검증된 Puck 0.23.0 의미 DOM 계약과 함께 고정되어야 합니다.');
  }

  if (scripts['check:editor-layout-parity'] !== 'node scripts/check-editor-layout-parity.mjs') {
    errors.push('package.json에 고정된 check:editor-layout-parity 명령이 필요합니다.');
  }
  if (typeof scripts.check !== 'string' || !scripts.check.includes('npm run check:editor-layout-parity')) {
    errors.push('npm run check가 편집/미리보기 레이아웃 계약 검사를 포함해야 합니다.');
  }
  errors.push(...validateFocusedUnitCommand(scripts), ...validateEditorTestRegistration(spec, REQUIRED_SPEC));
  if (typeof scripts['test:e2e:product'] !== 'string' || !scripts['test:e2e:product'].includes(REQUIRED_SPEC)) {
    errors.push(`test:e2e:product가 ${REQUIRED_SPEC}를 반드시 실행해야 합니다.`);
  }

  const cssContract = [
    [/\.g7pb-preview-hero\s+:is\(h1,[^}]*font-size:\s*clamp\(2\.5rem,\s*7vw,\s*5\.75rem\);[^}]*letter-spacing:\s*-\.04em;/s,
      '편집기 Hero 제목은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'],
    [/\.g7pb-preview-hero-split\s+:is\(h1,[^}]*font-size:\s*clamp\(2\.6rem,\s*6vw,\s*5\.25rem\);[^}]*letter-spacing:\s*-\.055em;/s,
      '편집기 Hero Split 제목은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'],
    [/\.g7pb-preview-hero-slider\s+:is\(h2,[^}]*font-size:\s*clamp\(2\.5rem,\s*6vw,\s*5rem\);[^}]*letter-spacing:\s*-\.055em;/s,
      '편집기 Hero Slider 제목은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'],
    [/\.g7pb-preview-features\s*>\s*:is\(h2,[^}]*font-size:\s*clamp\(2rem,\s*4vw,\s*3\.5rem\);[^}]*letter-spacing:\s*-\.03em;/s,
      '편집기 Features 제목은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'],
    [/\.g7pb-preview-cta-split\s+:is\(h2,[\s\S]*?font-size:\s*clamp\(2\.2rem,\s*5vw,\s*4\.75rem\);[^}]*letter-spacing:\s*-\.045em;/,
      '편집기 CTA와 Contact 제목은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'],
    [/\.g7pb-preview-stats article\s*>\s*strong\s*\{[^}]*font-size:\s*clamp\(2\.2rem,\s*5vw,\s*4rem\);/,
      '편집기 Stats 값은 공개 출력과 동일한 WYSIWYG typography를 사용해야 합니다.'],
    [/\[data-g7pb-heading-level\]\.g7pb-element-weight--regular\s*\{[^}]*font-weight:\s*400;/,
      '편집 가능한 semantic heading의 regular 굵기는 공개 HTML의 400 계산값과 같아야 합니다.'],
    [/\[data-g7pb-heading-level\]\.g7pb-element-weight--heading-default\s*\{[^}]*font-weight:\s*700;/,
      '명시적 굵기가 없는 semantic heading은 공개 HTML 기본 제목의 700 계산값과 같아야 합니다.'],
    [/\[data-g7pb-heading-level\]\s+:where\(\*\)\s*\{[^}]*margin:\s*0\s*!important;[^}]*font-family:\s*inherit\s*!important;[^}]*font-feature-settings:\s*inherit\s*!important;[^}]*font-kerning:\s*inherit\s*!important;[^}]*font-size:\s*inherit\s*!important;[^}]*font-variant-ligatures:\s*inherit\s*!important;[^}]*font-weight:\s*inherit\s*!important;[^}]*line-height:\s*inherit\s*!important;[^}]*overflow-wrap:\s*inherit\s*!important;[^}]*white-space:\s*inherit\s*!important;[^}]*word-break:\s*inherit\s*!important;/,
      'Puck의 실제 제목 leaf는 wrapper의 WYSIWYG typography, font shaping과 줄바꿈 규칙을 상속해야 합니다.'],
    [/\.g7pb-preview-features\s*>\s*\[data-g7pb-heading-level="2"\]\s*\{[^}]*max-width:\s*none;[^}]*line-height:\s*normal;/,
      'Features 기본 제목은 공개 출력과 같은 가용 폭과 normal line-height를 사용해야 합니다.'],
    [/:is\(\.g7pb-preview-stats,[^}]+\)\s*>\s*:is\(header,\s*figcaption\)\s*\{[^}]*max-width:\s*48rem;/,
      '공통 섹션 제목 컨테이너는 공개 g7pb-section-heading과 같은 48rem 폭이어야 합니다.'],
    [/:is\(\.g7pb-preview-stats,[^}]+\)\s*>\s*header\s*>\s*\[data-g7pb-heading-level="2"\]\s*\{[^}]*max-width:\s*none;/,
      '공통 섹션 제목 leaf는 편집기 전용 680px 제한 없이 공개 heading 컨테이너 폭을 채워야 합니다.'],
    [/\.g7pb-preview-richtext\.g7pb-preview-rich-text__content\s*\{[^}]*font-size:\s*1rem;[^}]*line-height:\s*1\.8;/,
      '리치텍스트 본문은 편집기와 공개 출력에서 동일한 기본 1rem typography를 사용해야 합니다.'],
    [/\.g7pb-preview-button\s*\{[^}]*font-weight:\s*700;/,
      '편집기 버튼의 기본 굵기는 공개 출력과 동일해야 합니다.'],
    [/:is\(\.g7pb-preview-stats,[^}]*font-size:\s*clamp\(2\.1rem,\s*5vw,\s*4\.25rem\);[^}]*line-height:\s*1\.06;/s,
      '카탈로그 섹션 제목은 공개 section heading과 동일한 typography를 사용해야 합니다.'],
    [/\.g7pb-preview-blockquote\s*>\s*\.g7pb-preview-blockquote__quote\s*\{[^}]*font-family:\s*Georgia,[^}]*font-size:\s*clamp\(1\.5rem,\s*4vw,\s*3rem\);/,
      '편집기 인용문은 Puck wrapper에도 공개 인용문 typography를 적용해야 합니다.'],
    [/\.g7pb-preview-social-links\s+:is\(h2,\s*\[data-g7pb-heading-level="2"\]\)\s*\{[^}]*font-size:\s*\.82rem;/,
      '소셜 링크 제목은 편집 wrapper와 공개 h2가 같은 소형 제목 규칙을 사용해야 합니다.'],
    [/\.g7pb-preview-hero--layout-poster\s+:is\(h1,[^}]*font-size:\s*clamp\(3\.25rem,\s*9vw,\s*8rem\);/s,
      'Hero poster 제목은 공개 preset과 동일한 크기 계약을 사용해야 합니다.'],
    [/\.g7pb-preview-hero--layout-editorial\s+:is\(h1,[^}]*font-family:\s*Georgia,[^}]*font-size:\s*clamp\(3\.4rem,\s*8vw,\s*7rem\);/s,
      'Hero editorial 제목은 공개 preset과 동일한 serif typography를 사용해야 합니다.'],
    [/\.g7pb-preview-cta-split--layout-banner\s+:is\(h2,[^}]*font-size:\s*clamp\(1\.8rem,\s*4vw,\s*3rem\);/s,
      'CTA banner 제목은 공개 preset의 축소 typography를 사용해야 합니다.'],
    [/\.g7pb-preview-page,\s*\.g7pb-preview-page \*,\s*\.g7pb-preview-page \*::before,\s*\.g7pb-preview-page \*::after\s*\{\s*box-sizing:\s*border-box;/s,
      'Puck iframe 제품 캔버스의 scoped border-box reset이 필요합니다.'],
    [/--g7pb-preview-content-width:\s*var\(--g7pb-theme-content-width\)/,
      '편집기와 공개 출력이 공유하는 content-width 변수가 필요합니다.'],
    [/\.g7pb-preview-block\s*>\s*\*\s*\{\s*width:\s*100%;\s*max-width:\s*100%;\s*margin-inline:\s*0;/,
      '편집 block wrapper가 공개 block과 다른 inline margin으로 자식을 재배치하면 안 됩니다.'],
    // The existing parity E2E compares both content edges. A container-based
    // formula is legitimate; pinning its CSS spelling prevented that refactor.
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
    [/\.g7pb-preview-hero-split--layout-overlap\s+\.g7pb-preview-hero-split__copy\s*\{[^}]*padding:\s*clamp\(2rem,\s*5vw,\s*4rem\)/,
      '편집기 overlap Hero copy inset은 공개 preset과 같은 유동 여백이어야 합니다.'],
    [/\.g7pb-preview-logo-cloud--layout-grid\s*>\s*div:not\(\[data-g7pb-richtext-field\]\):last-child\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
      '편집기 Logo grid 열은 로고 고유 폭보다 작아질 수 있어야 합니다.'],
    [/\.g7pb-preview-icon-list\s*>\s*header\s+:is\(h2,[^}]*max-width:\s*48rem;/,
      '편집기 Icon List 제목 폭은 공개 section heading의 48rem 계약을 사용해야 합니다.'],
    [/\.g7pb-preview-icon-list\s*>\s*header\s+:is\(h2,[^}]*font-size:\s*clamp\(2\.1rem,\s*5vw,\s*4\.25rem\);/,
      '편집기 Icon List 제목의 반응형 크기는 공개 section heading과 같아야 합니다.'],
    [/@media\s*\(max-width:\s*700px\)\s*\{\s*\.g7pb-preview-cta-split,\s*\.g7pb-preview-inquiry,\s*\.g7pb-preview-map\s*\{[^}]*grid-template-columns:\s*1fr;\s*\}\s*\.g7pb-preview-faq\s*\{[^}]*grid-template-columns:\s*1fr;/,
      '편집기 FAQ·문의·지도·배너 CTA는 공개본과 같은 700px 기준에서 1열로 전환해야 합니다.'],
    [/\.g7pb-preview-card-grid\s*>\s*header\s+:is\(h2,[\s\S]*?max-width:\s*48rem;/,
      '편집기 Card Grid와 Image Carousel 제목 폭은 공개 section heading과 같아야 합니다.'],
    [/\.g7pb-preview-hero-slider\s+article\s*>\s*div:not\(\[data-g7pb-richtext-field\]\)\s*\{[^}]*padding:\s*clamp\(2rem,\s*6vw,\s*5rem\);/,
      '편집기 Hero Slider copy inset은 공개 슬라이더와 같은 유동 여백이어야 합니다.'],
    [/\.g7pb-preview-bar-chart\s+figcaption\s*>\s*\[data-g7pb-heading-level="2"\]\s*\{[^}]*max-width:\s*48rem;/,
      '편집기 Bar Chart 제목 폭은 공개 section heading의 48rem 계약을 사용해야 합니다.'],
    [/\.g7pb-preview-page\s+\[data-g7pb-heading-level\]\s*\{[^}]*overflow-wrap:\s*normal;[^}]*white-space:\s*normal;[^}]*word-break:\s*normal;/,
      '편집 가능한 제목은 공개 heading과 같은 줄바꿈 규칙을 사용해야 합니다.'],
  ];
  for (const [pattern, message] of cssContract) requirePattern(errors, css, pattern, message);
  requirePattern(errors, publicCss, /\.g7pb-block\s+:where\(h1,\s*h2,\s*h3,\s*h4\)\s*\{[^}]*font-weight:\s*700\s*!important;/,
    '활성 G7 템플릿의 전역 heading 규칙이 블록 기본 제목 굵기를 바꾸지 못하게 격리해야 합니다.');
  requirePattern(errors, publicCss, /\.g7pb-element-weight--regular\s*\{[^}]*font-weight:\s*400\s*!important;/,
    '명시적 regular element style은 활성 템플릿과 무관하게 공개본에서 400이어야 합니다.');
  requirePattern(errors, publicCss, /\.g7pb-features__title\s*\{[^}]*line-height:\s*normal\s*!important;/,
    'Features 공개 제목 행간은 활성 템플릿 전역 h2 규칙으로부터 격리해야 합니다.');
  requirePattern(errors, publicCss, /\.g7pb-logo-cloud\s+h2\s*\{[^}]*font-size:\s*1rem;[^}]*line-height:\s*1\.2;/,
    'Logo Cloud 공개 제목 행간은 활성 템플릿 전역 h2 규칙으로부터 격리해야 합니다.');
  requirePattern(errors, editorCss,
    /\.g7pb-theme-font-modern\s*\{\s*font-family:\s*system-ui,[^}]+\}[\s\S]*\.g7pb-document-theme \[data-g7pb-font='modern'\]\s*\{\s*font-family:\s*system-ui,/,
    '편집 캔버스 modern 글꼴은 호스트가 임의 정의할 수 없는 deterministic system stack이어야 합니다.');
  requirePattern(errors, publicCss,
    /:root\s*\{[^}]*font-family:\s*system-ui,[^}]+\}[\s\S]*\.g7pb-theme-font-modern\s*\{\s*font-family:\s*system-ui,[^}]+\}[\s\S]*\[data-g7pb-font='modern'\]\s*\{\s*font-family:\s*system-ui,/,
    '공개 블록 modern 글꼴은 편집 캔버스와 같은 deterministic system stack이어야 합니다.');
  requirePattern(errors, catalogSource,
    /function LogoCloudPreview(?:(?!\nfunction )[\s\S])*?<RichTextCanvasField as="h2"[^>]*fieldPath="heading">/,
    '로고 목록 제목은 공개 출력과 동일한 h2 semantic 계약을 사용해야 합니다.');
  requirePattern(errors, productionSource,
    /function NoticePreview(?:(?!\nfunction )[\s\S])*?<RichTextCanvasField as="h2" className="g7pb-preview-richtext g7pb-preview-notice__title" fieldPath="title">/,
    '안내 블록 제목은 공개 출력과 동일한 h2 semantic 계약을 사용해야 합니다.');
  const heroPreviewSource = adapter.match(/function HeroPreview[\s\S]*?\n}\n\nfunction FeaturesPreview/)?.[0] ?? '';
  if (heroPreviewSource.includes('g7pb-preview-hero__copy')) {
    errors.push('편집기 Hero는 공개 Hero와 같은 direct grid child 구조를 사용해야 합니다.');
  }
  requirePattern(errors, heroPreviewSource,
    /g7pb-preview-hero[^>]*>[\s\S]*?g7pb-preview-eyebrow[\s\S]*?RichTextCanvasField as="h1"[\s\S]*?RichTextCanvasField fieldPath="body"[\s\S]*?g7pb-preview-hero__media/,
    '편집기 Hero의 제목, 본문, CTA, 이미지는 공개 Hero와 같은 grid 순서를 유지해야 합니다.');
  requirePattern(errors, spec,
    /ancestorTrail:[\s\S]*contentEditable:[\s\S]*height:[\s\S]*maxWidth:[\s\S]*overflowWrap:[\s\S]*scrollWidth:[\s\S]*tagName:[\s\S]*whiteSpace:[\s\S]*width:[\s\S]*wordBreak:/,
    '브라우저 WYSIWYG 실패에는 실제 글자 폭, 줄바꿈 속성, 편집 상태와 semantic DOM 조상 진단값이 포함되어야 합니다.');
  requirePattern(errors, spec,
    /['"]\.g7pb-divider__label['"]/,
    '구분선 label은 편집기와 공개 출력 양쪽에서 typography 후보로 측정해야 합니다.');
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
  requirePattern(errors, overlaySource,
    /function visibleOwnerViewport[\s\S]*actionBar\.ownerDocument[\s\S]*ownerWindow\.frameElement[\s\S]*clipByOverflowAncestor[\s\S]*mapHostClipToFrameViewport[\s\S]*intersectOverlayRects/,
    'ActionBar 안전영역은 iframe뿐 아니라 host viewport와 모든 overflow clipping ancestor의 실제 가시 영역을 사용해야 합니다.');
  requirePattern(errors, overlaySource,
    /function renderedElementScale[\s\S]*offsetWidth[\s\S]*rect\.width[\s\S]*function clearVisibleClipContract[\s\S]*function exposeVisibleClipContract/,
    'ActionBar 좌표는 host/canvas/Puck 렌더 scale을 측정하고 역보정해야 합니다.');
  requirePattern(errors, overlaySource,
    /function currentInteractionRects[\s\S]*getSelection\(\)[\s\S]*!selection\.isCollapsed[\s\S]*activeElement/,
    '공간이 부족한 ActionBar는 현재 글자 범위와 활성 편집 요소를 피하는 공통 배치 규칙을 사용해야 합니다.');
  requirePattern(errors, adapter,
    /placeEditorOverlay\([\s\S]*avoidRects:\s*currentInteractionRects\(actionBar\)/,
    '공간이 부족한 ActionBar는 현재 글자 범위와 활성 편집 요소를 피하는 공통 배치 규칙을 사용해야 합니다.');
  requirePattern(errors, adapter,
    /function useSelectedActionBarSafeZone[\s\S]*visibleOwnerViewport\(actionBar\)[\s\S]*inverseScaledTranslation[\s\S]*data-g7pb-safe-zone-placement[\s\S]*data-g7pb-safe-zone-ready[\s\S]*hostDocument\?\.addEventListener\(['"]scroll['"],\s*schedulePosition,\s*true\)/,
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
    /\.g7pb-richtext-inline-toolbar__options\.g7pb-richtext-floating-layer,\s*\.g7pb-richtext-inline-toolbar__advanced\.g7pb-richtext-floating-layer,\s*\.g7pb-richtext-inline-toolbar__link\.g7pb-richtext-floating-layer\s*\{([^}]*)\}/s,
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
    /\.g7pb-hero__title\s*\{[^}]*font-size:\s*clamp\(2\.5rem,\s*7vw,\s*5\.75rem\);[^}]*letter-spacing:\s*-\.04em;/,
    '공개 Hero 제목의 WYSIWYG typography 계약이 필요합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-hero-split__copy h1\s*\{[^}]*font-size:\s*clamp\(2\.6rem,\s*6vw,\s*5\.25rem\);[^}]*letter-spacing:\s*-\.055em;/,
    '공개 Hero Split 제목의 WYSIWYG typography 계약이 필요합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-hero-slider__copy h2\s*\{[^}]*font-size:\s*clamp\(2\.5rem,\s*6vw,\s*5rem\);[^}]*letter-spacing:\s*-\.055em;/,
    '공개 Hero Slider 제목의 WYSIWYG typography 계약이 필요합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-features__title\s*\{[^}]*font-size:\s*clamp\(2rem,\s*4vw,\s*3\.5rem\);[^}]*letter-spacing:\s*-\.03em;/,
    '공개 Features 제목의 WYSIWYG typography 계약이 필요합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-cta__heading,[^}]*font-size:\s*clamp\(2\.2rem,\s*5vw,\s*4\.75rem\);[^}]*letter-spacing:\s*-\.045em;/,
    '공개 CTA와 Contact 제목의 WYSIWYG typography 계약이 필요합니다.');
  requirePattern(errors, publicCss,
    /\.g7pb-stats article\s*>\s*strong\s*\{[^}]*font-size:\s*clamp\(2\.2rem,\s*5vw,\s*4rem\);/,
    '공개 Stats 값의 WYSIWYG typography 계약이 필요합니다.');
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
    [/typographySelectors[\s\S]*for \(const selector of typographySelectors\)[\s\S]*getComputedStyle\(typographyCandidate\)[\s\S]*createTreeWalker\(typographyCandidate,\s*NodeFilter\.SHOW_TEXT\)[\s\S]*range\.getClientRects\(\)/,
      '각 블록의 대표 텍스트 computed typography와 실제 줄바꿈을 측정해야 합니다.'],
    [/lineCount:\s*Math\.max\([\s\S]*lineClusters\.length,[\s\S]*Math\.round\(typographyRect\.height\s*\/\s*lineHeight\)/,
      'contenteditable과 semantic heading의 줄 수는 range fragment와 실제 line box 높이를 함께 사용해야 합니다.'],
    [/Math\.abs\(editorTypography\.fontSize\s*-\s*previewTypography\.fontSize\)/,
      '편집기/미리보기 대표 텍스트의 실제 font-size 차이를 비교해야 합니다.'],
    [/editorTypography\.lineCount\s*!==\s*previewTypography\.lineCount/,
      '편집기/미리보기 대표 텍스트의 줄바꿈 수가 같아야 합니다.'],
    [/editorTypography\.fontFamily\s*!==\s*previewTypography\.fontFamily[\s\S]*editorTypography\.fontWeight\s*!==\s*previewTypography\.fontWeight/,
      '편집기/미리보기 대표 텍스트의 font family와 weight를 비교해야 합니다.'],
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

  if ((spec.match(/ownerDocument\.fonts\.ready/g) ?? []).length < 2) {
    errors.push('편집 iframe과 공개 미리보기 모두 document.fonts.ready 이후 geometry를 측정해야 합니다.');
  }

  if (/\btest\.(?:skip|fixme)\s*\(/.test(spec) || /testInfo\.project\.name\s*!==/.test(spec)) {
    errors.push('레이아웃 E2E는 viewport나 시나리오를 skip/fixme로 우회하면 안 됩니다.');
  }

  const catalogVisualEvidence = [
    [/test\.describe\.configure\(\{\s*retries:\s*0\s*\}\)/,
      '블록 카탈로그 시각 회귀는 전역 retry로 실패를 숨기면 안 됩니다.'],
    [/window\.visualViewport[\s\S]*window\.devicePixelRatio[\s\S]*Math\.round\([\s\S]*window\.scrollTo\(\{[\s\S]*behavior:\s*['"]auto['"]/,
      '블록 카탈로그 캡처 전에 요소 원점을 device-pixel grid에 고정해야 합니다.'],
    [/await prepareVisualDocument\(publicRoot\)/,
      '블록 카탈로그 시각 비교 전에 전체 문서 media 준비 단계를 실행해야 합니다.'],
    [/const firstCapture\s*=\s*await block\.screenshot[\s\S]*waitForVisualBlockStability\(block\)[\s\S]*const secondCapture\s*=\s*await block\.screenshot[\s\S]*firstCapture\.equals\(secondCapture\)[\s\S]*toMatchSnapshot\(snapshotName\)/,
      '블록 카탈로그 baseline 비교 전에 동일 요소의 연속 캡처가 일치해야 합니다.'],
    [/await expectCatalogPresentationQuality\([\s\S]*renderedTypes[\s\S]*for \(let index = 0; index < builtinManifest\.blocks\.length; index \+= 1\)[\s\S]*waitForVisualBlockStability\(renderedBlocks\.nth\(index\)\)/,
      '전체 내장 블록은 manifest 순서·가시성·미디어·가독성·overflow와 안정화 검사를 통과해야 합니다.'],
  ];
  for (const [pattern, message] of catalogVisualEvidence) {
    requirePattern(errors, catalogVisualSpec, pattern, message);
  }
  const visualDocumentPreparation = catalogVisualSpec.match(
    /async function prepareVisualDocument[\s\S]*?\n}\n\nasync function waitForVisualBlockStability/,
  )?.[0] ?? '';
  requirePattern(
    errors,
    visualDocumentPreparation,
    /root\.locator\(['"]img['"]\)\.evaluateAll[\s\S]*for \(const image of images\)[\s\S]*image\.scrollIntoView[\s\S]*if \(image\.naturalWidth > 0\)[\s\S]*await image\.decode\(\)/,
    '블록 카탈로그 캡처 전에 전체 문서 lazy media를 로드하고 decode해야 합니다.',
  );
  if (/\b(?:maxDiffPixels|maxDiffPixelRatio|threshold)\s*:/.test(catalogVisualSpec)) {
    errors.push('블록 카탈로그 시각 회귀의 허용치 완화는 금지됩니다.');
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
