# 편집기 개발 진척

원장 갱신: 2026-10-14 · 기준 SHA: `df2aeedbbe016f30999ebeec128757329dd18530`

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

- IP7: 공통 요소와 시작 구성 91개를 같은 편집기/명령/이력으로 구현했습니다. 잔여 목표에서 DATA05/SYSTEM01~03/TEMPLATE01을 한 번씩 보완하고 실제 6종 정상/빈 이미지/오류/지연·3셸, 문의 5종, 실행 컨트롤과 popup 3폭을 확인했습니다. 실제 상품은 1개/분류 없음이며 다중 조작 대역을 실제 다중 API 수용으로 바꾸지 않습니다. YouTube 오류 153은 e05db53e에서 한 번 보완해 실제 재생/정지·origin-only Referer를 확인했지만 초기 두 프레임 요청 묶음/Vimeo 표본 없음은 남았습니다. 현재 G7 7.1.0/활성 JWsoft 0.3.1은 Site Shell 지원 밖이고 설치 sirsoft-basic 1.2.0의 현재 적용은 미확보입니다. 외부 테마 모바일 Header 넘침·전체 수용은 미완료입니다. 최종 SPEC 대조와 재감사 경계는 docs/audits/2026-10-14-remaining-nine-final-audit.md, 실행/실패 이력은 목표 원장에 보존합니다. JS/CSS 용량은 경고, 이번 보완은 온라인 미배포입니다. 기존 문서 전환·테마/코어 수정은 없습니다.
- IP8: 잔여 목표에서 실제 업로드 201/선택/교체/alt/3폭 fit·초점/한 Undo·저장·재열기, 빈 문서 첫 이미지 취소/URL/라이브러리 삽입과 자산 중복 방지, 구성 저장/검색/독립 재삽입/새 ID·참조/삭제 무전파를 확인했습니다. 관련 세션 22개와 실제 모듈 영속·권한 회귀 3개/25단언도 통과했습니다. 지연 응답 중 일부는 이전 정상 업로드 201을 브라우저에 재생한 통제이며 새 지연 업로드/두 번째 실제 사용자 로그인 증거로 확대하지 않습니다. 근거는 docs/audits/2026-10-14-remaining-nine-goal.md입니다. 앞선 통합 소스와 현재 제품 전체 수용은 구분하며 IP7 의존성과 최종 감사가 남아 완료 수에 합산하지 않습니다. 파일/기존 문서 삭제는 없습니다.
- IP9: 잔여 목표에서 페이지 리비전 명시 복원·마지막 공개 artifact 유지·readonly를 확인했습니다. 새 미적용 Site Part 세트는 실제 내장 UI로 Header #2를 새 revision 4/lock 5로 복원했고 원본 JSON 정확 일치, Header 새 Undo 비활성, Footer 미저장 입력/Undo 및 발행 #2 포인터 보존을 확인했습니다. 기존 Site Part 409/지연/쌍 발행 성공은 재사용했습니다. 대표 미디어/구성 16요소는 세 폭의 editor/preview/public 6비교에서 최대 0px였지만 전체 카탈로그/현재 외부 테마/모든 시나리오의 1px 합격으로 확대하지 않습니다. 정확한 source/build·환경 제한·재감사 잔여는 docs/audits/2026-10-14-remaining-nine-goal.md에 기록합니다. 기존 문서 전환은 별도이며 전체 수용 완료는 아닙니다.
- IP10: 잔여 1~9의 제한 감사 판정과 SPEC-01~16/49 block·99 preset 누락 0 대조를 마감했습니다. 실제 G7 없는 현 제품의 삽입/한국어 입력/한 Undo/저장/메모리 포트 재열기와 독립 CSS, ACCESS01 역할·설명 및 ACCESS02 6.81:1 대비를 확인했습니다. 현재 Puck의 Space drag 안내/동작 불일치는 동결했고 OS 네이티브 IME·현재 sirsoft-basic 1.2.0 적용·전체 대상/긴 페이지·후속 소스의 성능 수용은 미확보입니다. 과거 실제 100/500 관측 2150/4897.1ms·선택 278/290ms는 당시 소스로만 보존합니다. 실제 YouTube 오류 153 보완/재생을 확인했지만 초기 프레임 교체·외부 표본/테마 제한은 유지합니다. 정확한 미달/재감사 인계는 docs/audits/2026-10-14-remaining-nine-final-audit.md입니다. 이번 한정 구현·감사 처리와 제품 합격/배포를 구별하며 IP10 완료 수에 합산하지 않습니다. 전체 suite/coverage 확대·기존 문서 전환·테마/코어 수정·릴리스 우회는 없습니다.

조회: `make editor-status` · 정합성 검사: `make editor-plan-check`

완료 증거의 경로·형식·충족 관계를 검사하며 실제 시험 결과의 진실성이나 현재 HEAD의 제품 동작을 자동 보증하지 않습니다. Git SHA는 형식과 필수 기록만 검사합니다.
