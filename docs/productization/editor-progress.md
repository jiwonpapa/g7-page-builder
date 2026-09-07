# 편집기 개발 진척

원장 갱신: 2026-09-07 · 기준 SHA: `280567cc650253a5d6538696fbc3383c587eaf4e`

이 계획의 작업 진척이며 전체 제품 완성률이 아닙니다. 문서 검사와 제품 검증은 다릅니다. 이 명령은 배포를 실행하지 않습니다.

계획 작업 완료 **1/6** · 기존 기반 8개는 분모에서 제외합니다.

[개발 계획](editor-plan.md) · [편집 정책](editing-policy.md) · [진척 원장](editor-progress.json)

## 보존한 이전 계획

아래 완료 이력은 당시 기록이며 현재 계획의 완료 수에 합산하지 않습니다.

- `editor-maturity-20260907`: **4/11** · [보존 원장](<editor-progress-puck-20260907.json>) · [보존 계획](<editor-plan-puck-20260907.md>)

## 기존 구현 기반

새 목표의 완료 수와 별개로 이미 있는 기능과 근거를 유지합니다.

| 기반 | 현재 상태 | 구현 소스 | 과거 검증 근거 |
|---|---|---|---|
| BASE-01 · 계획 수립 당시 캔버스 직접 필드·미디어·링크·반복 편집 | 구현됨 | [resources/js/editor/canvasEditingContract.ts](<../../resources/js/editor/canvasEditingContract.ts>) · [resources/js/editor/CanvasContextControls.tsx](<../../resources/js/editor/CanvasContextControls.tsx>) · [resources/js/editor/richTextEditing.tsx](<../../resources/js/editor/richTextEditing.tsx>) | [docs/audits/2026-09-03-structure-phase-3.md](<../audits/2026-09-03-structure-phase-3.md>) |
| BASE-02 · 계획 수립 당시 Section/Columns/Stack과 leaf5 제한 중첩 | 구현됨 | [schemas/layout-policy-v1.json](<../../schemas/layout-policy-v1.json>) · [resources/js/documents/layoutPolicy.ts](<../../resources/js/documents/layoutPolicy.ts>) · [resources/js/editor/layoutCatalogBlocks.tsx](<../../resources/js/editor/layoutCatalogBlocks.tsx>) | [docs/productization/phase-4-structure.md](<phase-4-structure.md>) · [docs/audits/2026-09-02-structure-phase-2.md](<../audits/2026-09-02-structure-phase-2.md>) |
| BASE-03 · 계획 수립 당시 제작 단위 분류·위치별 갤러리 후보 | 일부 구현 | [resources/js/editor/blockGalleryModel.ts](<../../resources/js/editor/blockGalleryModel.ts>) · [resources/js/editor/BlockGalleryControls.tsx](<../../resources/js/editor/BlockGalleryControls.tsx>) · [resources/js/editor/puckEditorConfig.tsx](<../../resources/js/editor/puckEditorConfig.tsx>) | [docs/block-library-v2-benchmark.md](<../block-library-v2-benchmark.md>) |
| BASE-04 · 계획 수립 당시 복합 컴포넌트 내부 자식 슬롯 | 미구현 | [schemas/layout-policy-v1.json](<../../schemas/layout-policy-v1.json>) · [resources/js/documents/layoutPolicy.ts](<../../resources/js/documents/layoutPolicy.ts>) · [resources/js/editor/canvasEditingContract.ts](<../../resources/js/editor/canvasEditingContract.ts>) | 별도 기록 없음 |
| BASE-05 · 계획 수립 당시 layout/appearance 반응형·PC 편집/기기별 미리보기 | 구현됨 | [resources/js/documents/blockPresentation.ts](<../../resources/js/documents/blockPresentation.ts>) · [resources/js/editor/editorViewportPolicy.ts](<../../resources/js/editor/editorViewportPolicy.ts>) · [resources/js/editor/responsiveBlockStyle.tsx](<../../resources/js/editor/responsiveBlockStyle.tsx>) | [docs/productization/phase-4-responsive.md](<phase-4-responsive.md>) |
| BASE-06 · 계획 수립 당시 Undo/저장/선택 기반과 빠른 연속 명령의 전체 보장 | 일부 구현 | [resources/js/editor/PuckEditorAdapter.tsx](<../../resources/js/editor/PuckEditorAdapter.tsx>) · [tests/E2E/editorStructureTheme.spec.ts](<../../tests/E2E/editorStructureTheme.spec.ts>) | [docs/productization/phase-4-editing-save.md](<phase-4-editing-save.md>) · [docs/audits/2026-09-02-structure-phase-2.md](<../audits/2026-09-02-structure-phase-2.md>) |
| BASE-07 · 계획 수립 당시 개인 Section·공통영역 편집과 새 슬롯 연결 | 일부 구현 | [resources/js/editor/SectionPatternControls.tsx](<../../resources/js/editor/SectionPatternControls.tsx>) · [resources/js/editor/FullSiteCanvas.tsx](<../../resources/js/editor/FullSiteCanvas.tsx>) · [src/Domain/Site/SitePartDocument.php](<../../src/Domain/Site/SitePartDocument.php>) | [docs/productization/phase-5-patterns.md](<phase-5-patterns.md>) |
| BASE-08 · 계획 수립 당시 일반 페이지 주소·G7 목록·실제 문의 기반 | 구현됨 | [src/Providers/PageBuilderServiceProvider.php](<../../src/Providers/PageBuilderServiceProvider.php>) · [resources/js/public/publicInquiryForms.ts](<../../resources/js/public/publicInquiryForms.ts>) · [tests/E2E/siteKitInquiry.spec.ts](<../../tests/E2E/siteKitInquiry.spec.ts>) | [docs/audits/2026-09-06-site-phase-2.md](<../audits/2026-09-06-site-phase-2.md>) · [docs/audits/2026-09-06-site-phase-4.md](<../audits/2026-09-06-site-phase-4.md>) · [docs/audits/2026-09-07-site-phase-5.md](<../audits/2026-09-07-site-phase-5.md>) |

## 이번 계획 작업

| 단계 | 작업 | 상태 | 선행 작업 | 담당 task | 완료 근거 |
|---|---|---|---|---|---|
| 1차 · 공식 연동 계약과 원본 보존 | NE1 · 공식 연동 계약과 원본 보존 | 완료 | 없음 | native-ne1-browser-fix-20260907 | 구현 `b39de138d563d384dd3c92fe701f76f88ff16e87`<br>통합 `e075b8149ce9b73d7397a9eaa89ea0c867979bb4`<br>필수 증거 3/3<br>[NAT-01/host-contract](<../audits/2026-09-07-native-editor-ne1.md>) · [NAT-01/unit](<../audits/2026-09-07-native-editor-ne1.md>) · [NAT-01/browser](<../audits/2026-09-07-native-editor-ne1.md>) |
| 2차 · 내용·스타일·미디어 편집 | NE2 · 내용·스타일·미디어 편집 | 진행 | NE1 | native-ne2-content-r4-20260907 | 미완료 |
| 3차 · 내부 트리·반복·동적 요소 편집 | NE3 · 내부 트리·반복·동적 요소 편집 | 계획 | NE2 | 미배정 | 미완료 |
| 4차 · 사용자 조합 저장과 재삽입 | NE4 · 사용자 조합 저장과 재삽입 | 계획 | NE3 | 미배정 | 미완료 |
| 5차 · 삽입·설정·미리보기·저장 흐름 연결 | NE5 · 삽입·설정·미리보기·저장 흐름 연결 | 계획 | NE4 | 미배정 | 미완료 |
| 6차 · 호환·회귀·릴리스 | NE6 · 호환·회귀·릴리스 | 계획 | NE5 | 미배정 | 미완료 |

다음 진행 가능: NE2

조회: `make editor-status` · 정합성 검사: `make editor-plan-check`

완료 증거의 경로·형식·충족 관계를 검사하며 실제 시험 결과의 진실성이나 현재 HEAD의 제품 동작을 자동 보증하지 않습니다. Git SHA는 형식과 필수 기록만 검사합니다.
