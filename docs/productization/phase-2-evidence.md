# 2차 실행 기록 — 승인과 검증 재사용

일자: 2026-08-31. 2-A task: `productization-phase2a-20260831`.
기준 SHA: `b5de8ddc9d5a5017eb091ca203dc24be70ef576e`. `shared-contract` 독점 lease, frontend profile.

## 2-A 작업 카드

- 요구사항: roadmap 2-A, 2-C의 증거 분리·과거 기록 보존·오래된 승인/삭제된 증거 거부.
- 구현: 버전된 JSON Schema, 순수 TypeScript fingerprint/이행/판정 함수, 실패 회귀시험.
- 재사용: 기존 Ajv 2020/format 검증, Node 24 SHA-256, Vitest/strict/coverage 및 worktree 하네스.
- 변경하지 않음: PageBuilderDocument schema v1, PHP compiler, Puck 0.23.0, 현재 카탈로그/썸네일/기존 approval, v1 릴리스 게이트.
- 배포 영향: 개발/CI용 도구만 추가합니다. 고객 서버에 Node 실행을 요구하거나 runtime에 새 의존성을 추가하지 않습니다.
- 복구: 별도 제출 단위이며 v1 원장/승인과 게이트를 그대로 남깁니다. 사용자 문서 이행이나 데이터 삭제가 없습니다.

## 구현한 판정

| 구분 | 의존성 | 변경 시 |
|---|---|---|
| 콘텐츠 의미 review | 명시된 콘텐츠 payload + 자산/권리 지문 | copy·용도·자산 변화에 재심사 |
| 자산 권리 review | 명시된 자산 bytes/provenance/권리 payload | 교체·출처 변화에 재심사 |
| 렌더 verification | 콘텐츠/권리 + compiler/CSS/출력 payload | 화면 변화에 재검증 |
| 편집 verification | 위 렌더 + editor/fixture payload | 선언·입력·표현 변화에 재검증 |

필드는 JSON object의 키 순서와 무관하게 hash하고 배열 순서는 보존합니다. 알 수 없는 새 dependency도 payload에서 누락하지 않고 hash합니다. CSS가 content/rights payload에 들어가지 않는 수집 계약이라면 CSS-only 변경은 그 두 심사를 무효화하지 않지만 render/editing은 계속 무효화합니다. 실제 dependency를 찾아 네 payload로 배정하는 2-B 수집기가 아직 연결되지 않았으므로, 이 함수 시험을 실제 140개 영향 판정 완료라고 표시하지 않습니다.

`createPendingEvidence`는 기존 review를 값 그대로 복사·분리하고 무결성 digest를 보존합니다. 신규 네 결정은 모두 pending이며 approved/passed를 만들어 주는 운영 함수는 없습니다. 테스트의 `reviewed()`만 합격/실패 검증을 위한 가짜 심사 fixture를 만듭니다.

`assessQualityEvidence`는 schema, 정확한 catalog ID 집합·중복, 현재 source, 개별 결정 source, evidence 파일 digest, 과거 기록 무결성을 검사합니다. 실제 파일의 읽기·hash·경로 제한은 collector가 담당하며 이 함수는 제공된 digest와 비교합니다. evidence 누락/변조, rejected/failed, stale 또는 pending이면 `ready=false`입니다. 오류가 없다는 것과 제품 승인은 별개입니다.

## 실행 증거

- 테스트 파일을 먼저 추가하고 구현 모듈이 없어 로드 실패하는 RED를 확인했습니다. 이후 21개 정상/실패 사례를 구현과 함께 확인했습니다.
- TypeScript strict PASS.
- 전체 Vitest V8: **34 files / 290 tests PASS**, 14.33초(macOS Node 24).
- 새 판정 코어 coverage: **statements 100%, branches 98.3%, functions 100%, lines 100%**. 파일별 하한을 95/90/95/95로 새로 추가했습니다. 기존 coverage 대상·하한은 축소하지 않았습니다.
- Node 24에서 `.ts` 모듈을 빌드 우회/추가 런타임 없이 직접 import하는 실제 실행 PASS: 과거 approved 입력도 새 4개 결정 pending, ready=false.
- 레거시 renderer source 검사나 v1 승인 hash를 갱신하지 않았습니다. 2-A 제출·통합 결과는 Git/coordination 기록으로 확인합니다.

## 다음: 2-B 실제 재고와 의존성 수집

1. manifest 45개 정의·95개 preset과 기존 inventory의 공급 유형/처리 상태를 exact ID로 연결합니다.
2. props·문구·이미지 bytes/출처·compiler/CSS·편집기/fixture 파일의 실제 내용을 수집합니다. 원격 자산/미정 dependency는 명시적으로 불완전 처리하며 조용히 제외하지 않습니다.
3. v2 shadow 원장을 만들되 기존 검토를 새 기준 합격으로 승격하지 않습니다. 기존 전체 검사와 병행해 변경 이유·영향 항목 수·소요 시간을 보고합니다.
4. CSS-only, copy, 자산 교체, 공통 compiler, 삭제된 증거 fixture를 실제 collector 입력에서 검증합니다.
5. 2-C에서 CLI/전체 gate 연결과 실패 차단을 확정한 뒤에만 실제 검증 재사용을 적용합니다. 미통합 `rich-boundary` CSS의 140개 stale source는 검증 대상이며 이 배치로 해소됐다고 표시하지 않습니다.

2차 전체 완료·140개 제품 심사 합격·3차 중첩 구현·릴리스 승인은 아직 아닙니다.

## 2-B 실제 재고 수집 결과

Task `productization-phase2b-20260831`, 기준 SHA `4558235c0345f9b227521a74933dbd9831872112`(2-A 통합), mixed/shared-contract. Node 24 개발 도구이며 PHP 요청 경로나 고객 서버 실행 요건은 바꾸지 않습니다.

- `blockQualityInventory.ts`는 manifest와 계획 inventory의 exact ID·버전·공급 유형을 대조하고 실제 파일 bytes를 수집합니다. 경로 이탈·누락·외부 symlink·중복·알 수 없는 renderer 계약·빈 의존성은 실패합니다.
- PHP fixture index에 CSS 제외 semantic digest, CSS digest, 실제 HTML의 자산 주소를 추가했습니다. v1 `source_hash` 식과 HTML/이미지 출력은 그대로입니다. CSS URL/srcset/inline background URL은 구현되지 않은 의존성으로 fail-closed합니다. 아직 수집하지 못하는 자산을 조용히 빼지 않습니다.
- `src`, `resources/css` 전체는 렌더, `resources/js`·Unit/E2E와 문서 schema·lock은 편집 의존성으로 보수적으로 포함합니다. 특정 블록별로 더 줄이는 것은 영향 증거가 쌓인 뒤의 최적화이며 이번에 달성한 것으로 표시하지 않습니다.
- 권리 판단은 실제 로컬 bytes와 URL을 기록할 뿐입니다. 로컬 파일은 `local-unreviewed`, 외부 URL은 `external-unverified`, 다운로드 등 런타임 주소는 `runtime-unverified`이며 출처·저작권 합격을 추정하지 않습니다. 원격 자산을 내려받지 않습니다.
- 새 CLI는 매 실행 현재 PHP compiler를 돌립니다. `--snapshot`은 pending 제안 JSON을 stdout으로 내보낼 뿐 원장을 수정하지 않습니다. 추적 원장은 apply/review 가능한 별도 변경으로 생성했습니다. 기존 `codex-assisted` review 객체는 값 그대로 보존했고 새 review로 승격하지 않았습니다.
- 실제 evidence 파일의 SHA-256, 경로 안전성과 과거 review 일치를 검사합니다. 합격 fixture는 임시 테스트 디렉터리에만 존재합니다. `SHADOW_OK`와 `ready=true`는 다른 결과입니다.

### 실측과 실패 증거

| 항목 | 결과 |
|---|---|
| 실제 catalog | 45 definitions + 95 presets = 140, 누락/중복 0 |
| 자산 주소 / 읽은 파일 | 24 / 437 |
| 기존 v1 fresh source 변화 | 0/140 — 썸네일 재생성·approval 변경 없음 |
| 새 심사·검증 결정 | 140 × 4 = 560 pending, ready=false |
| CLI 표본 1회 | renderer 149ms + collector 33.67ms, 전체 199ms(macOS, warm cache, 벤치마크/보장값 아님) |
| 전체 Vitest V8 | 35 files / 301 tests PASS, 13.64초 |
| collector coverage | 99.37% statements / 99% branches / 100% functions / 100% lines |
| 타입·PHP lint/Pint | PASS |
| 새 contract harness | 실제 140개, 변조/삭제/경로 이탈/stale/재고 누락, pending strict 실패 PASS |

테스트는 실제 파일 fixture에서 CSS-only→render/editing, copy→소유 preset content/render/editing, 동일 URL 자산 교체→권리와 종속 범위, 공통 compiler→render/editing, editor→editing 변화를 확인합니다. 이는 영향 분류 시험이며 140개 완성 화면의 시각 심사나 모든 제품 입력 시나리오 합격 증거는 아닙니다. `rich-boundary` CSS는 아직 미통합이고 v1 140개 stale 이슈도 계속 별도 보존합니다.

확인한 미정 자산 3종은 OpenStreetMap iframe, YouTube iframe, `/` 다운로드 링크입니다. `/` 링크는 실제 다운로드 대상이 아니므로 콘텐츠 개선 때 교체 또는 제공 제외할 항목입니다. 두 iframe도 현재 네트워크 재생/외부 제공 조건을 확인한 것이 아닙니다. 이들은 경고와 `ready=false`로 남습니다.

### 2-C로 이어갈 범위

새 shadow 판정은 현재 수동 CLI/하네스이고 기존 v1 제출/릴리스 gate를 아직 대체하지 않습니다. 다음 배치에서 source 변경 시 영향 범위의 결정만 pending으로 되돌리고 나머지를 보존하는 이행, 개발 검사·release 차단 연결, 실패 fixture와 전체 게이트 검증을 수행합니다. 후속 6~7차의 콘텐츠 심사/권리 검토·실제 화면 검증을 자동으로 만들어 통과시키지 않습니다.

## 2-C 작업 카드 — 갱신과 gate 연결

기준 SHA `58933d5873d8a4575c2510dfc74c7e396a5a650e`(2-B main 통합), task `productization-phase2c-20260831`, mixed/shared-contract/version. 2-B 제출 `e25409b`와 main 통합에서 PHPUnit 134개·Vitest 301개·frontend production build/기존 v1 fresh source를 통과했고, 통합 후 Docker에서도 새 evidence contract harness 140개를 다시 통과했습니다.

- QA-01/QA-02: 변경 범위만 pending으로 재설정하는 순수 TS 함수와 읽기 전용 `--refresh` 제안 출력. 변경 없는 결정·과거 기록을 보존하고 파일 삭제/변조·모순된 source를 갱신으로 숨기지 않습니다.
- 제출의 단위시험 및 전체 frontend 검사에 v2 shadow 검사를 추가하고, 패키징·온라인 배포 전 `--require-ready`를 추가합니다. 기존 v1·site-shell·integration/release guard는 제거하거나 우회하지 않습니다. 실제 배포 명령은 실행하지 않습니다.
- 재사용: 2-A schema/판정 함수, 2-B 현재 PHP/파일 collector와 artifact 검사, 기존 Node 24/PHP 8.5/worktree gate. 새 원장/버전/서버 API를 추가하지 않습니다.
- RED→GREEN: CSS·copy·자산·editor 변경, 새/삭제 ID, 불변성, 거부/실패 보존, 증거 삭제/변조, gate 연결을 먼저 시험합니다.
- 사용자 데이터·발행본 변화 없음. 갱신 제안은 파일에 자동 저장하지 않으며 이전 원장/결정은 Git 변경 검토·history로 보존합니다. 후속 상태별 실제 화면 fixture/기술 검증은 별도 근거이며 560개 pending을 자동 합격시키지 않습니다.

### 2-C 실행 증거

- 새 refresh 시험 9건을 먼저 실패시킨 뒤 통과시켰습니다. 전체 Vitest V8 **35 files / 310 tests PASS**, 21.82초(macOS Node 24). 판정 코어 coverage **100/98.63/100/100%**, collector **99.37/99/100/100%**이며 기존 하한을 유지합니다.
- 갱신 로직은 CSS/렌더 변경 시 content/rights 결정을 보존하고 render/editing만 pending으로 만듭니다. copy·자산·editor·새/삭제 ID도 시험하고 원본 객체를 변경하지 않습니다. 자동 approved/passed 생성은 없습니다.
- 실제 140개 원장의 이번 변경은 **content 0 / rights 0 / render 0 / editing 140**입니다. 단위시험 파일 변경을 보수적으로 편집 검증 전체에 반영했으며 다른 세 범위의 지문·과거 review는 그대로입니다. 갱신 후에도 560개 pending입니다.
- current PHP/실파일 하네스에서 정상 proof·변조·삭제·경로 이탈·stale·legacy 변조 및 refresh 거부를 검사했습니다. native Node CLI `--refresh`는 현재 추적 원장과 같고 `--require-ready`는 현재 pending 원장을 exit 1로 차단합니다.
- gate wiring 시험은 연결 누락 상태의 RED를 확인한 뒤 통과했습니다. 개발 shadow 연결 삭제, release의 `|| true` 추가, strict 옵션 제거, v1 gate 제거 등 6개 변조 fixture를 모두 거부합니다. 패키징·배포 스크립트는 실행하지 않았습니다.
- 전체 frontend check는 build 뒤 새 증거 검사를 실행합니다. Local `quality-coordination`에는 정적 wiring 시험만 넣어 아직 새 build 전의 dist 때문에 검사가 순환 차단되지 않도록 했습니다.

### 2차에서 아직 남은 수락 항목

이번 구현은 승인 분리/영향 수집/안전 갱신/배포 차단의 기반입니다. 계획의 G7R-05 상태별 fixture ID·적용/제외 이유를 실제 시험 공급자와 연결하는 작업, 필수 상태 fixture 삭제·샘플 API 누출 부정 시험, `rich-boundary`의 오래된 렌더 증거 해소는 아직 남아 있습니다. 계획 inventory에는 기본/긴 문구/반응형/저장재진입 각95, 미디어 없음39, 목록 경계57, 동적 empty/error/capability 부재 각6의 요구가 있으나, 선언 수를 실행 합격 수로 세지 않습니다. 이 수락 항목을 닫기 전에는 2차 전체 완료 또는 3차 중첩 완료를 선언하지 않습니다.

## 2-D 상태 fixture와 격리 공급자 연결

후속 task `productization-phase2d-20260831`, 기준 `330f3bd`에서 위 상태 fixture 연결과 누락/샘플 누출 부정 시험을 구현했습니다. 9개 버전된 상태, 140개 catalog의 필수 731/비적용 529 관계와 실제 공급/시험 파일을 연결하고 current editor metadata와 대조합니다. 6개 동적 runtime의 18개 빈 데이터/오류/endpoint 부재 처리를 시험했으며, 전역 fetch·인증 상태를 교체하지 않습니다.

전체 37 files/329 tests와 strict·실파일 하네스를 통과했고, fixture 변경은 content/rights를 유지하며 render/editing만 무효화합니다. 560개 결정은 여전히 pending이며 등록된 사례 수로 제품 합격을 주장하지 않습니다. 상세 증거와 저장/발행·시각 심사의 구분은 [2-D 실행 기록](phase-2-states.md)에 있습니다. 남은 선행 작업은 `rich-boundary` CSS의 실제 영향 검증과 stale 렌더 증거 처리입니다.
