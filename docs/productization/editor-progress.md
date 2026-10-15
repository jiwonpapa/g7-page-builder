# 편집기 개발 진척

원장 갱신: 2026-10-15 · 기준 SHA: `df2aeedbbe016f30999ebeec128757329dd18530`

이 계획의 작업 진척이며 전체 제품 완성률이 아닙니다. 문서 검사와 제품 검증은 다릅니다. 이 명령은 배포를 실행하지 않습니다.

계획 작업 완료 **6/10** · 기존 기반 6개는 분모에서 제외합니다.

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
| 세부 편집 | IP5 · 핸들과 다중 선택 작업면 | 완료 | IP4 | ip5-canvas-ui-20261012 | 구현 `aff9225883b330777807804b4177e16e2b3fcd13`<br>통합 `c58a1e83ba0003015cd63eccdba32a0d063332b2`<br>필수 증거 3/3<br>[IND-05/unit](<../audits/2026-10-12-ip5-canvas-interactions.md>) · [IND-05/browser](<../audits/2026-10-12-ip5-canvas-interactions.md>) · [IND-05/accessibility](<../audits/2026-10-12-ip5-canvas-interactions.md>) |
| 세부 편집 | IP6 · 반응형 상세 편집 | 완료 | IP5 | ip6-responsive-editor-20261012 | 구현 `b23d204f8183c971b5b093e5736bb30b5da36630`<br>통합 `29f80fdab86058ce2683343e5ff6e056efca1c27`<br>필수 증거 3/3<br>[IND-06/contract](<../audits/2026-10-12-ip6-responsive-editing.md>) · [IND-06/browser](<../audits/2026-10-12-ip6-responsive-editing.md>) · [IND-06/parity](<../audits/2026-10-12-ip6-responsive-editing.md>) |
| 전체 연결과 수용 | IP7 · 내장 구성 템플릿과 공통영역 | 진행 | IP6 | integration-acceptance-closeout-20261014 | 소스 `52aec0b00cfc5991e5b52506c510345337ca9c98`<br>통합 `4098aacd8fc9efd90b73c99060aa38fd22879d48`<br>수용 미완료·재감사 인계 |
| 전체 연결과 수용 | IP8 · 미디어와 재사용 구성 | 진행 | IP7 | integration-acceptance-closeout-20261014 | 소스 `54b3f3e77402de34cca4401b9c1393555a92ec82`<br>통합 `fc752e9180f4846eed3572b602c1ccc20c9ee539`<br>수용 미완료·재감사 인계 |
| 전체 연결과 수용 | IP9 · 저장 복구와 공개 출력 일치 | 진행 | IP8 | integration-acceptance-closeout-20261014 | 소스 `a570d746f178f995700bf8d65ed94506383183c5`<br>통합 `728e0e1fc800dfa27ab9277d43debb5e8fdf5c51`<br>수용 미완료·재감사 인계 |
| 전체 연결과 수용 | IP10 · 독립성 호환성과 제품 수용 | 진행 | IP9 | integration-acceptance-closeout-20261014 | 소스 `dbc0d6c3961dde837d158949e7455e1cd7e91d21`<br>통합 `e7c5b2d25ffc85e37bbeceadc857be103e952492`<br>수용 미완료·재감사 인계 |

다음 진행 가능: IP7

## 구현과 수용을 분리한 인계

아래 소스/통합 기록은 제품 수용 완료 수에 합산하지 않습니다.

- IP7: 시작 구성 91개와 공통 요소 편집 구현 및 이전 6종 데이터/문의/실행 컨트롤 근거는 보존합니다. 현 8d00fe4f에서 실제 키보드 경로·현재 sirsoft-basic 1.2.0의 마지막 발행 Header/Footer 적용·원래 테마/세트 복구를 확인했습니다. 승인된 JWsoft 모바일 헤더 넘침만 별도 테마 저장소 d3619db3에서 보완·push했습니다. 초기 작성 프레임은 host HtmlContent 교체 1회 뒤 4개로 안정됐으며 PB 반복 생성으로 판정하지 않습니다. 공식 Vimeo 표본은 표시되지만 내장 브라우저 실제 재생은 실패했습니다. 2026-10-15 f0d11d19에서 기존 자동 gate 105건은 전부 통과했습니다. 이를 전체 대상의 사람 시각 수용·제공자 실제 재생의 완료로 확대하지 않습니다. 정확 범위·실패·증거는 docs/audits/2026-10-15-acceptance-gates.md와 기존 closeout에 보존합니다. 코어/기존 문서/무관한 테마는 변경하지 않았으며 새 온라인 배포는 없습니다.
- IP8: 이전 실제 업로드·교체·alt·3폭 fit/초점·한 Undo·저장/재열기와 독립 구성 저장/검색/재삽입/참조/삭제 무전파 근거는 docs/audits/2026-10-14-remaining-nine-goal.md에 보존합니다. 새 차수는 현 제공자 작성 프레임의 host 초기 교체 소유권과 공식 Vimeo 표본만 확인했습니다. Vimeo 실제 재생 실패/네트워크 원인 미확정은 숨기지 않고 docs/audits/2026-10-14-product-acceptance-closeout.md에 기록했습니다. IP7 의존성과 최종 수용이 남아 완료 수에 합산하지 않습니다. 파일/기존 문서를 삭제하지 않았습니다.
- IP9: 이전 페이지/Site Part 복원·발행본 보존·409/지연·3폭 대표 16요소 0px 근거는 docs/audits/2026-10-14-remaining-nine-goal.md에 보존합니다. 현 500노드의 이동을 한 Undo로 되돌린 뒤 서버 revision 2/3의 재귀 canonical JSON이 동일했고 lock 2→3 저장을 확인했습니다. raw JSON 해시 차이는 객체 키 직렬화 순서였습니다. 현재 sirsoft-basic 1.2.0의 공통영역 마지막 발행 쌍 출력과 원래 세트/테마 복구를 확인했고 미저장 Footer 탭은 보존했습니다. 전체 대상/모든 시나리오의 1px 합격으로 확대하지 않습니다. 고정 잔여와 한계는 docs/audits/2026-10-14-product-acceptance-closeout.md이며 기존 문서 전환은 별도입니다.
- IP10: 현 소스의 키보드 경로·100/500 성능·긴 작업면 및 현재 지원 호스트 적용/원복 근거는 보존합니다. 2026-10-15 직접 승인으로 OS 한글 IME는 미확인·비차단 예외입니다. f0d11d19532f5e42af2801e3a8b27d22abf36e14에서 기존 headless 자동 gate 105건(독립 90·설치 13·Site Part 2)이 실패/skip/flaky/재시도 없이 통과했고 공식 scoped verification이 완료됐습니다. 공통영역 시험 두 session의 원복도 확인했습니다. 제품 소스는 유지하고 공통 시험 좌표/초기 배율·선택 표시 조회와 하네스 project 선택만 보완했습니다. 과거 실패·중단과 파일 단위 재실행 병목은 docs/audits/2026-10-15-acceptance-gates.md에 보존합니다. 자동 합격과 전체 사람 시각 수용·Vimeo 실제 재생·새 버전/온라인 배포는 구별하며 후자의 미완료를 완료 수에 합산하지 않습니다.

조회: `make editor-status` · 정합성 검사: `make editor-plan-check`

완료 증거의 경로·형식·충족 관계를 검사하며 실제 시험 결과의 진실성이나 현재 HEAD의 제품 동작을 자동 보증하지 않습니다. Git SHA는 형식과 필수 기록만 검사합니다.
