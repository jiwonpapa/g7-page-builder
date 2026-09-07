# 편집기 개발 진척

원장 갱신: 2026-09-07 · 기준 SHA: `58ed8a33829fdcb1327d730c6ab6da953f656949`

이 계획의 작업 진척이며 전체 제품 완성률이 아닙니다. 문서 검사와 제품 검증은 다릅니다. 이 명령은 배포를 실행하지 않습니다.

계획 작업 완료 **0/11** · 기존 기반 8개는 분모에서 제외합니다.

[개발 계획](editor-plan.md) · [편집 정책](editing-policy.md) · [진척 원장](editor-progress.json)

## 기존 구현 기반

새 목표의 완료 수와 별개로 이미 있는 기능과 근거를 유지합니다.

| 기반 | 현재 상태 | 구현 소스 | 과거 검증 근거 |
|---|---|---|---|
| BASE-01 · 캔버스 직접 필드·미디어·링크·반복 편집 | 구현됨 | [resources/js/editor/canvasEditingContract.ts](<../../resources/js/editor/canvasEditingContract.ts>) · [resources/js/editor/CanvasContextControls.tsx](<../../resources/js/editor/CanvasContextControls.tsx>) · [resources/js/editor/richTextEditing.tsx](<../../resources/js/editor/richTextEditing.tsx>) | [docs/audits/2026-09-03-structure-phase-3.md](<../audits/2026-09-03-structure-phase-3.md>) |
| BASE-02 · Section/Columns/Stack과 leaf5 제한 중첩 | 구현됨 | [schemas/layout-policy-v1.json](<../../schemas/layout-policy-v1.json>) · [resources/js/documents/layoutPolicy.ts](<../../resources/js/documents/layoutPolicy.ts>) · [resources/js/editor/layoutCatalogBlocks.tsx](<../../resources/js/editor/layoutCatalogBlocks.tsx>) | [docs/productization/phase-4-structure.md](<phase-4-structure.md>) · [docs/audits/2026-09-02-structure-phase-2.md](<../audits/2026-09-02-structure-phase-2.md>) |
| BASE-03 · 제작 단위 분류·위치별 갤러리 후보 | 일부 구현 | [resources/js/editor/blockGalleryModel.ts](<../../resources/js/editor/blockGalleryModel.ts>) · [resources/js/editor/BlockGalleryControls.tsx](<../../resources/js/editor/BlockGalleryControls.tsx>) · [resources/js/editor/puckEditorConfig.tsx](<../../resources/js/editor/puckEditorConfig.tsx>) | [docs/block-library-v2-benchmark.md](<../block-library-v2-benchmark.md>) |
| BASE-04 · 복합 컴포넌트 내부 자식 슬롯 | 미구현 | [schemas/layout-policy-v1.json](<../../schemas/layout-policy-v1.json>) · [resources/js/documents/layoutPolicy.ts](<../../resources/js/documents/layoutPolicy.ts>) · [resources/js/editor/canvasEditingContract.ts](<../../resources/js/editor/canvasEditingContract.ts>) | 별도 기록 없음 |
| BASE-05 · layout/appearance 반응형·PC 편집/기기별 미리보기 | 구현됨 | [resources/js/documents/blockPresentation.ts](<../../resources/js/documents/blockPresentation.ts>) · [resources/js/editor/editorViewportPolicy.ts](<../../resources/js/editor/editorViewportPolicy.ts>) · [resources/js/editor/responsiveBlockStyle.tsx](<../../resources/js/editor/responsiveBlockStyle.tsx>) | [docs/productization/phase-4-responsive.md](<phase-4-responsive.md>) |
| BASE-06 · Undo/저장/선택 기반과 빠른 연속 명령의 전체 보장 | 일부 구현 | [resources/js/editor/PuckEditorAdapter.tsx](<../../resources/js/editor/PuckEditorAdapter.tsx>) · [tests/E2E/editorStructureTheme.spec.ts](<../../tests/E2E/editorStructureTheme.spec.ts>) | [docs/productization/phase-4-editing-save.md](<phase-4-editing-save.md>) · [docs/audits/2026-09-02-structure-phase-2.md](<../audits/2026-09-02-structure-phase-2.md>) |
| BASE-07 · 개인 Section·공통영역 편집과 새 슬롯 연결 | 일부 구현 | [resources/js/editor/SectionPatternControls.tsx](<../../resources/js/editor/SectionPatternControls.tsx>) · [resources/js/editor/FullSiteCanvas.tsx](<../../resources/js/editor/FullSiteCanvas.tsx>) · [src/Domain/Site/SitePartDocument.php](<../../src/Domain/Site/SitePartDocument.php>) | [docs/productization/phase-5-patterns.md](<phase-5-patterns.md>) |
| BASE-08 · 일반 페이지 주소·G7 목록·실제 문의 기반 | 구현됨 | [src/Providers/PageBuilderServiceProvider.php](<../../src/Providers/PageBuilderServiceProvider.php>) · [resources/js/public/publicInquiryForms.ts](<../../resources/js/public/publicInquiryForms.ts>) · [tests/E2E/siteKitInquiry.spec.ts](<../../tests/E2E/siteKitInquiry.spec.ts>) | [docs/audits/2026-09-06-site-phase-2.md](<../audits/2026-09-06-site-phase-2.md>) · [docs/audits/2026-09-06-site-phase-4.md](<../audits/2026-09-06-site-phase-4.md>) · [docs/audits/2026-09-07-site-phase-5.md](<../audits/2026-09-07-site-phase-5.md>) |

## 이번 계획 작업

| 단계 | 작업 | 상태 | 선행 작업 | 담당 task | 완료 근거 |
|---|---|---|---|---|---|
| 삽입·선택·설정 | EP1-01 · 제작 분류와 편집 능력 표시 | 계획 | 없음 | 미배정 | 미완료 |
| 삽입·선택·설정 | EP1-02 · 위치별 삽입과 선택 경로 | 계획 | EP1-01 | 미배정 | 미완료 |
| 삽입·선택·설정 | EP1-03 · 직접 편집·문맥 도구·설정 패널 연결 | 계획 | EP1-02 | 미배정 | 미완료 |
| 기본 요소·대표 내부 구성 | EP2-01 · 아이콘·목록·배지 삽입 | 계획 | EP1-03 | 미배정 | 미완료 |
| 기본 요소·대표 내부 구성 | EP2-02 · 단일 카드의 제한된 내부 구성 | 계획 | EP2-01 | 미배정 | 미완료 |
| 기본 요소·대표 내부 구성 | EP2-03 · 대표 Hero·ImageText 슬롯과 호환 이행 | 계획 | EP2-02 | 미배정 | 미완료 |
| 검증된 컴포넌트 조합 | EP3-01 · 탭·FAQ 본문 구성 | 계획 | EP2-03 | 미배정 | 미완료 |
| 검증된 컴포넌트 조합 | EP3-02 · 일반 열의 G7 목록·문의 폼 | 계획 | EP2-03 | 미배정 | 미완료 |
| 공통영역·재사용·통합 검증 | EP4-01 · 공통영역 편집 문맥 마감 | 계획 | EP3-01, EP3-02 | 미배정 | 미완료 |
| 공통영역·재사용·통합 검증 | EP4-02 · 새 구성을 내 패턴으로 재사용 | 계획 | EP3-01, EP3-02 | 미배정 | 미완료 |
| 공통영역·재사용·통합 검증 | EP4-03 · 통합 사용자 흐름 검증 | 계획 | EP4-01, EP4-02 | 미배정 | 미완료 |

다음 진행 가능: EP1-01

조회: `make editor-status` · 정합성 검사: `make editor-plan-check`

완료 증거의 경로·형식·충족 관계를 검사하며 실제 시험 결과의 진실성이나 현재 HEAD의 제품 동작을 자동 보증하지 않습니다. Git SHA는 형식과 필수 기록만 검사합니다.
