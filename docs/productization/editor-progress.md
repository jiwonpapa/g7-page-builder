# 편집기 개발 진척

원장 갱신: 2026-10-12 · 기준 SHA: `df2aeedbbe016f30999ebeec128757329dd18530`

이 계획의 작업 진척이며 전체 제품 완성률이 아닙니다. 문서 검사와 제품 검증은 다릅니다. 이 명령은 배포를 실행하지 않습니다.

계획 작업 완료 **4/10** · 기존 기반 6개는 분모에서 제외합니다.

[개발 계획](editor-plan.md) · [편집 정책](editing-policy.md) · [진척 원장](editor-progress.json)

## 보존한 이전 계획

아래 완료 이력은 당시 기록이며 현재 계획의 완료 수에 합산하지 않습니다.

- `editor-maturity-20260907`: **4/11** · [보존 원장](<editor-progress-puck-20260907.json>) · [보존 계획](<editor-plan-puck-20260907.md>)
- `native-editor-20260907`: **12/12** · [보존 원장](<editor-progress-native-20261012.json>) · [보존 계획](<editor-plan-native-20261012.md>)

## 기존 구현 기반

새 목표의 완료 수와 별개로 이미 있는 기능과 근거를 유지합니다.

| 기반 | 현재 상태 | 구현 소스 | 과거 검증 근거 |
|---|---|---|---|
| BASE-IP01 · 기존 v1/v2 문서·컴파일·초안/발행 기반 | 구현됨 | [resources/js/documents/types.ts](<../../resources/js/documents/types.ts>) · [src/Application/Compilation/HtmlDocumentCompiler.php](<../../src/Application/Compilation/HtmlDocumentCompiler.php>) | [docs/productization/phase-3-boundaries.md](<phase-3-boundaries.md>) |
| BASE-IP02 · Puck/Tiptap·구조·이력 기반, 새 조작 결합 미검증 | 일부 구현 | [resources/js/editor/PuckEditorAdapter.tsx](<../../resources/js/editor/PuckEditorAdapter.tsx>) · [vite.puck-history.ts](<../../vite.puck-history.ts>) | [docs/audits/2026-09-08-editor-ux4.md](<../audits/2026-09-08-editor-ux4.md>) |
| BASE-IP03 · Hero/ImageText/Card 내부 구성의 제한된 기존 범위 | 일부 구현 | [schemas/layout-policy-v1.json](<../../schemas/layout-policy-v1.json>) | [docs/audits/2026-09-08-editor-ux5.md](<../audits/2026-09-08-editor-ux5.md>) · [docs/audits/2026-09-09-editor-ux6.md](<../audits/2026-09-09-editor-ux6.md>) |
| BASE-IP04 · 프리셋 스타일·반응형 기반, 모바일 캔버스는 미리보기 전용 | 일부 구현 | [resources/js/editor/blockAppearance.ts](<../../resources/js/editor/blockAppearance.ts>) · [resources/js/editor/editorViewportPolicy.ts](<../../resources/js/editor/editorViewportPolicy.ts>) | 별도 기록 없음 |
| BASE-IP05 · 보존 네이티브 확장, 현재 호스트 지원은 별도 확인 | 일부 구현 | [resources/js/adapters/gnuboard7/bootstrap.ts](<../../resources/js/adapters/gnuboard7/bootstrap.ts>) | [docs/productization/native-host-contract.md](<native-host-contract.md>) |
| BASE-IP06 · Moveable/Selecto 정밀 조작과 v3 디자인 계약 | 미구현 | 없음 | 별도 기록 없음 |

## 이번 계획 작업

| 단계 | 작업 | 상태 | 선행 작업 | 담당 task | 완료 근거 |
|---|---|---|---|---|---|
| 기반과 계약 | IP1 · 편집 엔진과 정밀 조작 결합 검증 | 완료 | 없음 | ip1-engine-proof-20261012 | 구현 `e827bf10a1ec65279412b2d86967a749f4469ade`<br>통합 `a4b4fe8b55a22d8be96888b5f3b556d148d94108`<br>필수 증거 3/3<br>[IND-01/unit](<../audits/2026-10-12-ip1-engine-proof.md>) · [IND-01/browser](<../audits/2026-10-12-ip1-engine-proof.md>) · [IND-01/architecture](<../audits/2026-10-12-ip1-engine-proof.md>) |
| 기반과 계약 | IP2 · 정밀 문서와 스타일 계약 | 완료 | IP1 | ip2-document-contract-20261012 | 구현 `e85bdf2f8af9a78c66289e0b3dc1ec9c022240d1`<br>통합 `257dc97c936fecf236482665633c69bea2b604d6`<br>필수 증거 3/3<br>[IND-02/contract](<../audits/2026-10-12-ip2-document-contract.md>) · [IND-02/unit](<../audits/2026-10-12-ip2-document-contract.md>) · [IND-02/compatibility](<../audits/2026-10-12-ip2-document-contract.md>) |
| 세부 편집 | IP3 · 레이어와 재귀 구조 편집 | 완료 | IP2 | ip3-layer-ui-production-20261012 | 구현 `93f861ebe2920e91025dcf5bd7b20984bbcc5b09`<br>통합 `7dc48d130247571ed221717c751ee895b0326bef`<br>필수 증거 2/2<br>[IND-03/unit](<../audits/2026-10-12-ip3-structure-editing.md>) · [IND-03/browser](<../audits/2026-10-12-ip3-structure-editing.md>) |
| 세부 편집 | IP4 · 정밀 Inspector와 자동 배치 | 완료 | IP3 | ip4-richtext-race-20261012 | 구현 `2a2596997a886c19ffa8f752d08f7f43f95c2d94`<br>통합 `9118103d91f2c5674f555e81667b260ec9aa4cb6`<br>필수 증거 3/3<br>[IND-04/unit](<../audits/2026-10-12-ip4-precision-inspector.md>) · [IND-04/browser](<../audits/2026-10-12-ip4-precision-inspector.md>) · [IND-04/parity](<../audits/2026-10-12-ip4-precision-inspector.md>) |
| 세부 편집 | IP5 · 핸들과 다중 선택 작업면 | 차단 | IP4 | ip5-canvas-ui-20261012 | 미완료 |
| 세부 편집 | IP6 · 반응형 상세 편집 | 계획 | IP5 | 미배정 | 미완료 |
| 전체 연결과 수용 | IP7 · 내장 구성 템플릿과 공통영역 | 계획 | IP6 | 미배정 | 미완료 |
| 전체 연결과 수용 | IP8 · 미디어와 재사용 구성 | 계획 | IP7 | 미배정 | 미완료 |
| 전체 연결과 수용 | IP9 · 저장 복구와 공개 출력 일치 | 계획 | IP8 | 미배정 | 미완료 |
| 전체 연결과 수용 | IP10 · 독립성 호환성과 제품 수용 | 계획 | IP9 | 미배정 | 미완료 |

다음 진행 가능: 없음

- 차단 IP5: IP5 독립 브라우저 39개는 통과했으나 최종 FULL의 기존 편집기 진입이 외부 Inter CSS 지연으로 실패했다. 동일 시나리오 10회 중 1회 재현했으며 외부 글꼴 배포 방식 보완 전 완료로 집계하지 않는다.

조회: `make editor-status` · 정합성 검사: `make editor-plan-check`

완료 증거의 경로·형식·충족 관계를 검사하며 실제 시험 결과의 진실성이나 현재 HEAD의 제품 동작을 자동 보증하지 않습니다. Git SHA는 형식과 필수 기록만 검사합니다.
