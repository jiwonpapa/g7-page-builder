# IP2 정밀 문서 계약 검증

상태: 승인된 Hero 빈 슬롯 2파일 보완을 통합하고 실제 브라우저 11개를 통과했다. 모바일 높이 차이는 24px에서 0px가 됐고 기존 내부 구성·Undo·저장·발행을 유지했다. IP2 공유 계약의 FULL 통합을 재개한다. 이전 실패 이력은 보존하며 IP3·운영 배포로 진행하지 않는다.

## 소유 범위

- 기준 SHA: 245042b347199e6b9044eba3b519d171cef512ff
- task: ip2-document-contract-20261012
- 정확 20개 파일, PROFILE=scoped, AREAS=shared-contract.
- 새 v3 스키마/정책, 순수 TS/PHP 검증·명시 이행 snapshot 준비, 양쪽 공통 fixture, 검사 등록, 계약/진척/감사 기록만 대상.
- 기존 v1/v2/Site Part/컴파일러·저장 API·G7 코어·제품 의존성·모듈 버전·발행본은 변경하지 않는다.
- [v3 계약](../document-v3-contract.md), [현행 실행 계획](../productization/editor-plan.md)의 IND-02, SPEC-02·05에 연결한다.

## 구현과 필수 증거

공통 JSON Schema와 별도 의미 정책이 수치/단위/enum/한도/기본값/원본 버전을 소유한다. 양쪽 검증기는 그 값을 소비하고 공통 정상 fixture와 48개 변형 사례로 수용/거부 결과를 비교한다. 안정 ID·중복·슬롯·자산 참조·반응형 부모·원자적 override·깊이/용량/500노드·미지 필드 무변경을 확인한다.

기존 문서의 명시 이행은 snapshot 준비까지만 구현한다. 원본 문자열과 revision을 그대로 보존하며 후보/DB/발행은 만들지 않는다. 전체 mapping/복구 UI/영속 전환은 IP7/IP9 범위다.

## 실행

Node 24.19.0, PHP 8.5.3, macOS arm64. worktree PHP 의존성은 기존 composer.lock에서 별도로 설치했다. 신규 dependency나 vendor 업데이트는 없다.

```sh
npm run typecheck
npx --no-install vitest run tests/Unit/documentV3.test.ts
vendor/bin/phpunit tests/UnitPhp/DocumentV3Test.php
vendor/bin/phpstan analyse -c phpstan.neon.dist --no-progress src/Domain/Documents/V3
node scripts/check-design-architecture.mjs --files resources/js/documents/v3/types.ts,resources/js/documents/v3/schema.ts,resources/js/documents/v3/validate.ts,resources/js/documents/v3/migration.ts,src/Domain/Documents/V3/Schema.php,src/Domain/Documents/V3/Validator.php,src/Domain/Documents/V3/Migration.php
make task-submit TASK=ip2-document-contract-20261012 FULL=1
```

공유 스키마 추가이므로 FULL=1이 필수다. fixture 소비자만 등록하고 새 스키마의 full 요구를 면제하지 않는다. 위 명령은 Node/PHP 지정 PATH 환경에서 실행한다.

## 현재 확인 결과

- 최종 TS 관련 58개, PHP 6개/130 assertions 통과. 제출과 Local 임시 통합에서도 확인했다.
- 제품 TypeScript 타입 검사 통과.
- 신규 도메인 7파일 구조 gate: 신규 부채/위반 0.
- 신규 PHP 도메인 PHPStan level 8 통과.
- PHP 100/500노드 검증 관측 4.3/21.6 ms. 1초 예산 내 단일 로컬 관측이며 제품 p95/브라우저 성능 보증은 아니다.
- 첫 PHP 시험에서 JSON regex의 ECMAScript 문자 escape가 PCRE와 달라 실패했다. 공통 regex 표현을 수정하고 양쪽 시험을 통과했다.
- 추가 URL 경계 점검에서 빈 호스트와 BOM 공백 허용 차이를 발견했다. 공통 호스트/port/percent/공백 문법과 13개 회귀 fixture로 보강한다.
- 타입 검사에서 JSON union의 선택 필드와 ES library 범위가 드러나 실제 narrowing/호환 Unicode 검사로 수정했다. unsafe assertion이나 baseline 예외를 추가하지 않았다.

## 최초 제출과 PHP 서식 차단 이력

- 구현 제출 SHA: e85bdf2f8af9a78c66289e0b3dc1ec9c022240d1. 최초 제출 15fe3e8d01904ff35483a4d7cc66a9ffdf9a78ee 뒤 같은 소유 범위에서 URL 회귀를 보강해 task-resubmit으로 제출했다.
- 제출: 정확 20개 경로, 21개 gate, FULL=1. 타입·구조·PHPStan·Pint·관련 단위·하네스 검사를 통과했고 full-product는 정책대로 Local 통합에서 필수 실행했다.
- Local 전체 하네스 460개 통과. 이후 quality-php의 composer check → Pint가 기존 tests/UnitPhp/HeroCompositionTest.php의 class_attributes_separation 규칙 위반으로 실패했다.
- 해당 파일은 IP2 diff에 없다. 자동 통합 원복 후 기준 SHA 245042b347199e6b9044eba3b519d171cef512ff에서도 vendor/bin/pint --test -v tests/UnitPhp/HeroCompositionTest.php로 같은 실패를 재현했다. 메서드 사이/클래스 마지막 빈 줄 서식이며 IP2 수치·문서 계약 오류가 아니다.
- 첫 통합 시도는 명시 PATH에서 /usr/local/bin 누락으로 docker를 찾지 못했다. 경로를 보완한 뒤 재시도하여 위 기존 lint 차단을 확인했다. 제품 소스나 검사 정책을 우회하지 않았다.
- 두 통합 시도 모두 Git은 기준 SHA로 자동 원복됐으며 submitted 구현 커밋은 worktree에 보존한다. 두 번째 Site Part fixture journal은 sessions가 비어 있고 closed=true다. 브라우저 fixture 변경 전 lint에서 멈췄으며 실제 제품 브라우저·전체 coverage·발행 검증에는 도달하지 않았다.
- 두 번째 원본 journal: Local의 output/playwright/gates/integration-ip2-document-contract-20261012/929f6a23354cc0d9ace89649a17ed3b580e9b83f6ad1bd551647cc11baff4641/86405483fd6f489191195947f35ff539/site-part-state.json.

## 승인된 서식 수정과 재검증

- 사용자 승인 범위는 tests/UnitPhp/HeroCompositionTest.php의 빈 줄 두 곳이다. 별도 task ip2-hero-format-20261012에서 소유·수정하고 제출 aa92f9da4dcb6e3026654f96437ddbbcc3530a15, Local 통합 fe37e7bbecdc9afe94d6ec4860f5365d6ff565a1로 기록했다. 동작 변경은 없으며 Pint와 관련 PHPUnit 4개/49 assertions가 통과했다.
- IP2 제출 c791e3a4cc2d01c2c97ab6dc42a5fda390a587c8을 integration-ip2-resume-20261012에서 FULL=1로 재검증했다. 관련 TS 58개·타입·구조·PHPStan·Pint의 동일 입력 성공을 재사용했고 PHP 계약 6개/130 assertions를 다시 통과했다.
- 전체 하네스 460개, 전체 Pint 304파일, PHPStan 161파일, PHP 단위 336개/3234 assertions가 통과했다. PHP 단위·통합 coverage는 409개/3866 assertions, PHPUnit notice 1건이며 project 75.70%, compiler-family 89.63%, 서비스 96.37%, repository 94.81%로 각 하한선을 통과했다. Docker PHP는 8.5.9다.
- 프런트엔드 버전·store·편집 계약·타입·CSS 검사는 통과했다. 이후 Vitest coverage 실행은 121파일 중 119파일 통과/2파일 실패, 1009개 중 990개 통과/19개 실패로 중단됐다. 신규 documentV3 58개는 이 전체 실행에서도 통과했다. 프런트엔드 coverage 합격, production build, G7 후속 검사와 제품 브라우저 성공은 확보하지 못했다.

## 이전 품질 차단과 기준 상태 재현

- tests/Unit/blockQualityInventory.test.ts의 18건은 Required state/capability mismatch: preset:jiwonpapa/builtin-core:demo.first로 실패했다. 테스트 fixture는 편집 fields=[]를 선언하면서 preset required_states에 long-copy를 요구한다. 현행 requiredQualityStates는 텍스트 필드가 없는 정의에 long-copy를 포함하지 않는다.
- tests/Unit/blockPackManifest.test.ts의 1건은 썸네일 경로 유일성 148개 기대/147개 실제로 실패했다. content.card-01과 card.empty가 thumbnails/generated/card.svg를 함께 참조한다. 검사 완화나 생성 자산 변경은 수행하지 않았다.
- 두 테스트와 해당 기존 구현·manifest는 IP2 diff에 없다. 실패한 IP2 임시 통합은 자동 원복되어 Local HEAD는 승인된 서식 수정만 포함한 fe37e7bbecdc9afe94d6ec4860f5365d6ff565a1이다. 이 상태의 동일 Docker runtime에서 다음 두 테스트만 다시 실행해 23개 중 4개 통과/19개 실패를 재현했다.

```sh
npx --no-install vitest run tests/Unit/blockPackManifest.test.ts tests/Unit/blockQualityInventory.test.ts --reporter=json --outputFile=output/playwright/ip2-baseline-block-quality-20261012.json
```

기준 상태 재현 결과는 Local의 output/playwright/ip2-baseline-block-quality-20261012.json에 보존한다. 이번 full gate journal은 output/playwright/gates/integration-ip2-resume-20261012/2ab800128551d1571214bdfa391dcc5d1369169e342f811e2602a78605d53972/0a7c9147ad82439ab31846265a2f1d50/site-part-state.json이며 sessions=[]·closed=true다. 하네스의 FIXTURE_RESTORE_FAILED 문구와 별개로 브라우저 fixture 세션은 시작되지 않았다.

위 실패 당시에는 품질 fixture와 Card 썸네일 수정 승인이 필요했다. 아래 후속 승인을 받아 해당 차단을 해소했으며 원본 실패 증거는 보존한다.

## 승인된 품질·하네스 보완

- 품질 task ip2-quality-blockers-20261012: fixture의 heading 필드와 long-copy 조건을 일치시키고 Card 블록/기본 프리셋 썸네일을 각각의 PNG 주소로 생성했다. 기존 SVG 파일·품질 하한선·과거 승인 원장은 보존했다. 관련 24개 시험, 타입, production build, 지정 두 항목의 현재 렌더 source 검사가 통과했다. 제출 0dac5763253829df2f0aac63f8aa4910d2a6ba3b, Local 통합 f6e14a13316843e65926774a47b4261e3d47ab6f. 상세는 Local의 docs/audits/2026-10-12-ip2-quality-blockers.md에 기록했다.
- 사용자 추가 승인에 따라 ip2-thumbnail-scope-20261012는 tools/g7pb/content.py와 tests/Harness/test_content.py만 보완했다. 교체 전·후 썸네일 소유자를 함께 추적하되 미등록·삭제된 소유자는 계속 거부한다. 관련 39개 시험과 선택된 회귀가 통과했다. 제출 9e241ef477334c158f9ba9a7e48548095bc6b83e, 통합 0dbe4c3689a5b6c7a5427ef6fe0f5758db826896.
- 첫 재검증에서 새 회귀 fixture에 소유자 삭제와 orphan hash 오류가 동시에 있어 해시 순서에 따라 예상 메시지가 달라졌다. 같은 승인 파일의 별도 task ip2-thumbnail-fixture-20261012에서 신규 hash도 제거하여 거부 원인을 분리했다. 해시 seed 0~9 및 관련 39개 시험 통과. 제출 c506cf46086db61f3cac6d806395852d4b8edb5f, 통합 45befb49ee7140650cc489f714dd7310d76737ed. 제품 선택기나 거부 조건은 추가 변경하지 않았다.
- 위 첫 재검증 원본 로그는 Local output/playwright/ip2-full-after-quality-20261012.log에 보존한다.

## 전체 검증과 레이아웃 커버리지 차단 이력

45befb49ee7140650cc489f714dd7310d76737ed 기준에서 제출 5bcac07d63e1e53cca663ad7cc722937fea0a4eb의 IP2를 FULL=1로 다시 임시 통합했다.

- 전체 하네스 463개 통과. IP2 관련 TS 58개 성공 입력 재사용, PHP 6개/130 assertions 재통과.
- 전체 PHP 서식 304파일, PHPStan 161파일, 단위 336개/3234 assertions 통과. coverage 409개/3866 assertions와 PHPUnit notice 1건, project 75.70%·compiler-family 89.63%·서비스 96.37%·repository 94.81%로 하한선을 통과했다.
- 프런트엔드 버전·store·편집 계약·타입·CSS 검사 통과. Vitest 121파일/1,010개 전부 통과했다. 기존 실패 19건은 해소됐다.
- 전체 프런트엔드 coverage 집계는 statements 84.57%, branches 78.99%, functions 81.02%, lines 87.85%다. 다만 resources/js/documents/layoutPolicy.ts의 functions 93.33%가 파일별 하한선 95%에 미달하여 quality-frontend가 실패했다. 미실행 지점은 66행의 component slot 미지정 허용 여부를 찾는 some callback이다.
- layoutPolicy.ts, 기존 tests/Unit/layoutTree.test.ts, vite.config.ts는 당시 IP2와 승인된 수정의 diff에 없다. Git 자동 원복 후 같은 Docker runtime에서 아래 관련 4파일/76개 시험은 통과했고 동일 함수 커버리지 93.33% 실패를 재현했다. 당시 output/coverage/ip2-layout-policy-baseline-20261012/ 보고서는 후속 전체 coverage 실행으로 갱신됐으므로 현재 남은 증거로 인용하지 않는다. 위 원본 전체 실행 로그에는 같은 미달 수치와 실패가 보존돼 있다.

```sh
npx --no-install vitest run tests/Unit/layoutTree.test.ts tests/Unit/heroComposition.test.ts tests/Unit/cardComposition.test.ts tests/Unit/basicElementContracts.test.ts --coverage --coverage.include=resources/js/documents/layoutPolicy.ts --coverage.reportsDirectory=output/coverage/ip2-layout-policy-baseline-20261012
```

전체 재검증 로그: Local output/playwright/ip2-full-after-fixture-20261012.log. journal: output/playwright/gates/integration-ip2-resume-20261012/1f2a4ab8d5f11a5993e0a95b1d209f76f3585f75e810a6c6024a54629d11501b/3558cf54d4ed4e6fb5cbf8f43a81eaea/site-part-state.json. sessions=[]·closed=true로 제품 브라우저 fixture는 시작되지 않았다. 이 전체 실행은 production build·G7 후속 검사·제품 브라우저에 도달하지 않았다. 별도 Card task의 build 통과와 혼동하지 않는다.

사용자가 tests/Unit/layoutTree.test.ts 한 파일의 회귀 추가를 승인했다. 별도 task ip2-layout-policy-coverage-20261012에서 Hero·ImageText·Card의 슬롯 미지정 허용, 명시 슬롯 제한, 미등록 슬롯/구조/상속 속성 거부를 검증했다. 관련 4파일/77개 시험이 통과했고 해당 파일의 함수·줄 coverage는 100%, statements 98.98%, branches 99.03%로 기존 하한선을 통과했다. 제품 소스와 coverage 기준은 변경하지 않았다. 제출 e3c19af3efe89b5506ffb0adaefc0a62805a8d53, Local 통합 95deae4720ec08d3a07d330366e225468448136d.

위 관련 커버리지 성공 뒤 다음 전체 검증을 수행했다. 이전 실패는 이력으로 유지하며 현재 차단과 구분한다.

## 이전 차단: 기존 썸네일 source 불일치

95deae4720ec08d3a07d330366e225468448136d 기준에서 IP2 재제출 b06b8de7590fc21bae83fa3604291e53e0933059를 FULL=1로 임시 통합했다. 원본 로그는 Local output/playwright/ip2-full-after-layout-coverage-20261012.log다.

- 전체 하네스 463개, PHP 단위 336개/3234 assertions, coverage 409개/3866 assertions 및 기존 하한선 통과. PHPUnit notice 1건은 유지됐다.
- 프런트엔드 121파일/1,011개 시험 모두 통과. 전체 coverage statements 84.58%, branches 79.00%, functions 81.06%, lines 87.86%. layoutPolicy.ts 함수·줄 100%로 파일별 기준을 포함해 통과했다.
- G7 의존 예산과 442파일 구조 검사 통과. 기존 구조 부채 220건을 늘리지 않았다. production 8개 번들과 블록 카탈로그 candidate 기술 검사 통과.
- 이후 check:content -- --kind block --all에서 Card 외 블록 48개의 stale-thumbnail을 검출했다. 소스 hash는 카탈로그 ID·props·공개 렌더 HTML·전체 공개 CSS hash를 포함한다. 과거 품질 원장의 저장 무결성은 유효하며 해당 승인 기록을 현재 렌더 증거로 바꾸지 않았다.
- 통합은 자동 원복됐다. IP2 소스가 없는 Local 기준 95deae4720ec08d3a07d330366e225468448136d의 같은 Docker runtime에서 기존 collectCurrentEvidence로 148개 ID를 명시해 읽기 전용 수집했다. 블록 48개·프리셋 98개, 합계 146개의 같은 source 불일치를 확인했다. 이번에 생성한 Card 두 항목은 일치한다. 정확 ID 목록은 output/playwright/ip2-baseline-stale-thumbnails-20261012.json에 보존한다. PNG·manifest·index·품질 승인 원장은 변경하지 않았다.
- IP2 변경에는 기존 썸네일 renderer·공개 CSS·컴파일러·블록 manifest/index가 없다. 이 기록은 저장된 hash와 현재 결과의 불일치를 확인한 것이며 과거 변경 원인을 한 파일로 단정하지 않는다.
- journal은 output/playwright/gates/integration-ip2-resume-20261012/a693de8ea703a1df64ddacd3544fe69be9eab1cd1931117fa0e01180abe04a6b/0e30a35c6d7b421fbf96c28bae50a2e9/site-part-state.json이다. sessions=[]·closed=true이며 G7 후속 검사와 실제 제품 브라우저에는 도달하지 않았다.

당시 불일치한 146개 썸네일의 재생성·육안/기술 검증과 결합 manifest/index 반영을 별도 범위로 요청했다. 사용자의 후속 진행 승인에 따라 아래와 같이 수행했다. 품질 승인 원장·제품 기능·검사 기준은 변경하지 않는다.

## 승인된 썸네일 재생성과 통합

- 기준 SHA: 95deae4720ec08d3a07d330366e225468448136d. 정확한 대상은 보존한 ip2-baseline-stale-thumbnails-20261012.json의 블록 48개·프리셋 98개다. 정상 Card 두 항목은 다시 생성하지 않았다.
- 기존 scripts/generate-block-thumbnails.mjs의 --catalog-id 선택 생성만 사용했다. 각 task는 manifest/index와 최대 22개 PNG, 합계 최대 24개 정확 파일을 claim했다. 블록과 canonical 첫 프리셋은 같은 task에서 생성했다.
- 146개를 모두 실제 PHP renderer·공개 CSS·Playwright로 재생성했다. 그중 5개 PNG는 기존 bytes와 동일하며 전체 Git delta는 PNG 141개와 manifest/index 2개다. hash만 임의 교체하지 않았다.
- 아래 7개 task의 제출·통합 gate가 모두 통과했다. 카탈로그 148개 candidate 기술 검사와 각 선택 항목의 현재 source 검사를 통과했으며 release_authorized=false, ledger_written=false를 유지했다.

| 차수 | 생성 항목 | 제출 SHA | 통합 SHA |
|---|---:|---|---|
| 1 | 22 | `64b25a6f3b661253d15c952b5b59d7b5a687667b` | `6106f07dfd7067da841d8540f49f33e619ff4e28` |
| 2 | 22 | `c106e8b1a82bcce5509e28ddc45161dc66518898` | `081a6b91e2d2518f218eda0c1ca07fb12eac966e` |
| 3 | 19 | `e593745369800d2d973dc1f67f977a6b690ae25e` | `a1f5392888b77253cdd5879bfa447b50411a49c3` |
| 4 | 19 | `56c18512a642f2de8c092b99100912f802d063ea` | `6a2f6cc04f8407f6ce391ef7cf31d87924c49edb` |
| 5 | 22 | `af762c93174a5ef40e49fae0a607fabadbbeda46` | `3d7c15b27e8c78573f7e71e8a6e676515a572477` |
| 6 | 22 | `56f12d9182798b3d097e164f090f1d742bc09f46` | `9646d7f495d8e2d18c954df86a0050c9c4902917` |
| 7 | 20 | `963e20f5220d28bf33340f478f63933e81f78de7` | `85c353a01a5d424f31716d8a156dc0a5e05dfbef` |

- 7개 묶음 모두 이미지 contact sheet를 직접 확인했다. 한글, 로컬 사진, 아이콘, canonical 쌍과 기존 변형을 확인했다. 증거 경로는 /Users/neojins/.codex/worktrees/ip2-hero-format/g7-page-builder/output/playwright/ip2-thumbnails-01-20261012-sheet.png부터 ip2-thumbnails-07-20261012-sheet.png까지다.
- 기존 960×600 고정 crop을 320×200 PNG로 만드는 계약은 유지했다. 긴 가격·팀·갤러리·목록의 하단은 crop될 수 있으며 전체 페이지 노출을 보증하지 않는다. 문의·지도·영상·G7 데이터는 기존 안전 placeholder/sample을 사용하며 외부 실행 성공으로 보고하지 않는다.
- 4차 갤러리 기본 블록/첫 프리셋의 최초 PNG bytes가 달라 canonical 검사와 고유 이미지 수 검사가 실패했다. 두 ID만 기존 생성기로 재생성한 뒤 동일 기준을 통과하고 최종 이미지를 다시 확인했다. 생성기나 허용 기준을 변경하지 않았다.
- Playwright 스킬의 실제 렌더 확인과 write-page의 증거 경계에 따라 생성 이미지·기술 검사·제품 동작·배포를 구분했다. 제품 코드·생성기·스타일·버전·품질 승인 원장에는 변경이 없다.

IP2 재통합 기준은 85c353a01a5d424f31716d8a156dc0a5e05dfbef다. 공유 문서 계약에 필요한 FULL=1은 유지했으며 아래 결과를 확인했다.

## 이전 차단: 기존 편집기 번들 용량

IP2 재제출 184c4231c800d196e58662aab27c797d26b1d493을 위 기준에 임시 통합했다. 원본 로그는 Local output/playwright/ip2-full-after-thumbnails-20261012.log에 보존한다.

- 전체 하네스 463개 통과. PHP Pint 304파일·PHPStan 161파일·단위 336개/3234 assertions 통과. coverage 409개/3866 assertions와 기존 PHPUnit notice 1건이며 project 75.70%·compiler-family 89.63%·서비스 96.37%·repository 94.81%로 기준을 통과했다.
- 프런트엔드 121파일/1,011개 통과. coverage statements 84.58%·branches 79.00%·functions 81.06%·lines 87.86%, layoutPolicy 함수/줄 100%로 기준을 통과했다. v3 도메인 함수/줄도 100%다.
- 타입·CSS·G7 의존 예산·442파일 구조·production 8번들·카탈로그 candidate 기술 검사 통과. 블록 49개·프리셋 99개, 전체 148개의 현재 렌더 source 검사 통과로 stale-thumbnail 차단을 해소했다.
- 보존 품질 원장은 stored-integrity-valid이며 592개 pending 결정과 release_authorized=false를 유지했다. command 하네스 11개 및 asset manifest/공식 Store 6개 검사도 통과했다.
- 이후 npm run check:frontend-budgets가 dist/js/page-builder-editor.iife.js=510030/508500 gzip bytes로 실패했다. 초과는 1530 bytes(약 0.30%)이며 기준을 변경하거나 성공으로 취급하지 않았다.
- 통합은 자동 원복되어 Local HEAD 85c353a01a5d424f31716d8a156dc0a5e05dfbef가 유지됐다. IP2가 없는 이 기준에서 make dev-build-assets TASK=integration-ip2-resume-20261012가 일치하는 입력 fingerprint f7d1fc7508846d71a6f155dff124d43fa0731418d676129cf2ceede351083432의 build를 재사용한 뒤, 같은 Docker Node 24.19.0에서 npm run check:frontend-budgets만 실행해 동일 510030/508500 실패를 재현했다.
- dist/meta/editor-modules.json에는 신규 documents/v3 파일이 없으며 이번 IP2는 편집기 entry에 연결되지 않았다. 원인 분석 중 현재 썸네일 files hash 148개는 편집기 번들에서 발견되지 않아 해시 테이블 포함이 원인이라고 단정하지 않았다. 과거 508050 측정값과 현재 차이의 세부 원인은 미확정이다.
- fixture journal: output/playwright/gates/integration-ip2-resume-20261012/80a552312572c430effab3f5a6f6ab26c25bf06fbb9b7581c1021109d2703003/f1b3568f6fba41e3953f889b5d77d602/site-part-state.json. sessions=[]·closed=true다. G7 후속 검증과 제품 브라우저 시나리오에는 도달하지 않았다.

새 번들 최적화는 자산 재생성 승인과 별도 범위이므로 착수하지 않았다. 용량 기준·제품 기능·의존성 버전을 유지한 별도 작업 승인을 요청했다. 정확 수정 경로와 관련 회귀검사를 착수 시 확정하고, 성공한 검사 입력의 불필요한 반복이나 FULL 게이트 우회는 하지 않는다.

IP2 submitted 원본은 worktree에 보존한다. 미통합 제출이 남아 있으므로 integration lease를 강제 해제하거나 완료로 바꾸지 않는다. 전체 필수 검증과 통합 후에만 IP2를 done으로 바꾸고 IP3로 진행한다. 정밀 편집 UI·저장/발행·브라우저 시각 회귀·배포 성공을 주장하지 않는다.

## 승인된 번들 최적화와 재개

- 사용자가 별도 번들 최적화를 승인했다. `ip2-bundle-optimization-20261012`는 빌드 설정·동등성 회귀·감사 기록 3개 파일만 claim했다. 제출 `ef7c5ce3abc9950aeec1436a187a3bd9caa46e72`, 통합 `0ad15fdfe1ddd4b40ac9822d83fb58180f348894`.
- 같은 JS bytes의 gzip 차이를 확인했다. Node 24.19.0에서 macOS zlib 1.2.12는 508,054 bytes, Linux zlib 1.3.2.1-motley-3246f1b는 510,030 bytes였다. Linux 검사 환경·압축 옵션·508,500 bytes 기준은 유지했다.
- 내장 카탈로그의 반복 문자열과 같은 키 순서의 객체 생성 코드만 빌드 시 공유한다. 모든 JSON 필드/값/순서·개별 객체 참조·검색 문구·프리셋·썸네일을 보존한다. 기능·의존성 버전·manifest 원본은 변경하지 않았다.
- 실제 Vite 파이프라인을 포함한 동등성 5개, 기존 Puck 이력 4개, 타입, production 8번들, asset/Store 6개 검사 통과. Linux 전체 frontend budget 검사 통과: 편집기 raw 1,729,505 bytes, gzip 508,253 bytes로 1,777 bytes 감소, 한도 여유 247 bytes다. 후속 기능의 추가 용량까지 확보됐다는 뜻은 아니다.
- 실제 desktop `editorInspectorUx.spec.ts` 2개 통과(16.7초). Inspector 변경·키보드·빠른 Undo/Redo·저장·재열기를 확인했다. page/block Inspector 스크린샷을 직접 확인했으며 신규 정밀 편집 UI의 완료 증거로 사용하지 않는다.
- 브라우저 증거: Local `output/playwright/gates/integration-ip2-resume-20261012/defd9246db079eb3dbb877a769e188a249dcbafc751aa8cd8b9521a397cf660f/0ec869e6a82c452fb8729eba27ba7654/`.
- 위 통합 SHA를 기준으로 IP2 공유 계약의 `FULL=1` 통합을 재개한다. 성공 전까지 상태는 진행 중이며 운영 배포는 하지 않는다.

## 이전 차단: 기존 E2E 계약과 로컬 활성 테마

제출 `f1eb26eed7b137db21ca31f156162eed048b1789`를 `0ad15fdfe1ddd4b40ac9822d83fb58180f348894`에 임시 통합했다. 첫 전체 실행 로그는 Local `output/playwright/ip2-full-after-bundle-20261012.log`다. 하네스 463개·PHP 단위 336개/3234 assertions·coverage 409개/3866 assertions·프런트엔드 122파일/1,016개·전체 coverage 하한·production 8번들·전체 148개 썸네일·frontend budget은 통과했으나 로컬 모듈 registry 0.35.1 / manifest 0.36.0 불일치로 환경 검사에서 멈췄다.

기존 `python3 -B scripts/g7pb.py environment sync --runtime docker --task integration-ip2-resume-20261012 --paths module.json --apply`로 로컬 등록 메타데이터와 캐시를 동기화했다. `make dev-verify TASK=integration-ip2-resume-20261012`가 registry 0.36.0을 포함하여 통과했다. 제품 버전 파일·G7 코어·테마 파일·운영 서버는 수정하지 않았다.

동기화 후 같은 제출로 정식 통합 게이트를 다시 실행했다. 원본 로그는 Local `output/playwright/ip2-full-after-runtime-sync-20261012.log`다.

- 하네스 463개, PHP 서식 304파일·PHPStan 161파일·단위 336개/3234 assertions, coverage 409개/3866 assertions 통과. 기존 PHPUnit notice 1건은 유지됐다.
- 프런트엔드 122파일/1,016개와 coverage statements 84.58%·branches 79.00%·functions 81.06%·lines 87.86% 통과. 기존 파일별 하한과 v3·layoutPolicy 함수/줄 100% 유지.
- 442파일 구조 검사·기존 부채 220건 상한·production 8번들·카탈로그 148개 현재 source·asset/Store·Linux frontend budget 통과. 편집기 gzip은 508,253/508,500 bytes다.
- G7 환경·composer manifest·migration 상태·PHPStan 연동 검사 및 통합 시험 73개/632 assertions 통과. PHPUnit notice 1건은 같은 기존 notice다.
- 제품 Playwright 49개는 **27개 통과·22개 실패**(11.0분). 생성/편집/발행/복원/재발행/발행 해제, 중첩 3열, 독립 Header/Footer 프리셋·workspace, 직접 리치텍스트·링크 보호, 공개 접근성·Store 등의 통과를 확인했으나 전체 수용으로 보고하지 않는다. 뒤에 연결된 `test:e2e:site-shell`은 앞 명령 실패로 실행되지 않았다.

실패는 아래 두 범주다. 검사 수·하한을 줄이거나 기존 결과를 승인으로 바꾸지 않았다.

| 범주 | 실패 수 | 확인한 근거 |
|---|---:|---|
| Card/목록 시험 전제 | 7 | 3기기 catalog 시험이 의도된 `card.empty`를 일반 비어 있음 위반으로 판정. 3기기 layout 시험은 편집기의 내부 article(좌우 padding 12px)과 공개 외부 section(0px)을 비교. 성능 시험은 구조 편집이 꺼져 Card 블록/프리셋을 숨기는 현재 목록 145개에 대해 전체 147개를 기대하여 시간 예산 판정 전에 실패 |
| 활성 테마 전제 | 15 | G7 공통영역 관련 desktop 3개는 public/site-shell 요청을 기다리다 실패. tablet/mobile의 언어 분리 및 Page Kit 12개는 `jw-business-mobile__surface` 등 현재 테마 모바일 메뉴의 9px 루트 overflow를 검출 |

공개 TemplateService를 읽어 현재 활성 User Template이 `jwsoft-business01 0.3.1`임을 확인했다. 기존 UserTemplateSiteShellDecorator의 지원 조건은 `sirsoft-basic 1.1+`다. 설치된 `sirsoft-basic 1.1.4`도 확인했으나 테마를 전환하거나 지원 조건을 넓히지 않았다. 현재 테마의 소스 수정·호환 지원 확대는 이번 승인 밖이다.

전체 실패 후 하네스는 Git을 자동 원복했다. 번들 감사 기록 제출 `2e9192e27eafb53cd71235999f3fe7a78d4633e4`만 추가 통합하여 Local 기준은 `9b379d59cd22841e693c3e1b19ca674dc46e6f08`이다. IP2가 없고 승인된 번들 최적화는 포함된 이 기준에서 일치하는 build fingerprint `ca6ecbdb3bf42ea81db59d6af26871f41005dcb6c26e1ca0bb6625daeee5e858`를 재사용했다. `blockCatalogQuality`, `editorLayoutParity`의 `card.empty`만 선택한 parity, `editorPerformance`의 desktop 3개 실패만 재실행하여 같은 빈 Card·12px 비교·147/145 불일치를 재현했다. 원본은 `output/playwright/ip2-baseline-browser-20261012.log`와 `output/playwright/ip2-baseline-browser-20261012/results.json`에 보존한다. 이를 최적화 전 기준 재현으로 과장하지 않는다.

전체 실행의 Site Part journal은 `output/playwright/gates/integration-ip2-resume-20261012/8985aa263e113cdc34f5d5a64c892b5ed61e066aac6a75ed0d7141f7d72b4599/6ecea6534fce4b9a87ff29df9a0f8bb2/site-part-state.json`이다. 12개 세션 모두 restored=true, 전체 closed=true다. 이전 registry 차단 journal의 sessions=[]·closed=true도 확인했다. 현재 활성 테마는 유지했으며 미통합 IP2 제출과 integration lease를 보존한다.

위 E2E 3파일 보완과 지원 테마 임시 사용·원복은 이후 사용자 승인을 받아 아래와 같이 수행했다. 제품 기능·성능/시각 하한·검사 범위는 유지했다.

## 승인된 E2E 보완과 테마 검증

- task `ip2-browser-contracts-20261012`, 기준 `9b379d59cd22841e693c3e1b19ca674dc46e6f08`, 정확 3개 E2E 파일만 소유했다. 제출 `5442fb734e01411fc85e3f4a892ce2be03e62c52`, 통합 `af8a2e06dfffd99bfc77b365376d31b7c0b21367`.
- `blockCatalogQuality.spec.ts`: 첫 Card fixture가 정확히 `card.empty`·outlined인지 확인하고 동일 instance의 article·media/body/actions 빈 슬롯 3개를 별도로 검증한다. 이 fixture만 일반 비어 있음 판정과 구분하며 전체 49종·크기·overflow·이미지·글꼴·접근성·기존 시각 snapshot 검사는 유지했다.
- `editorLayoutParity.spec.ts`: Card 양쪽의 실제 padding 소유자인 내부 article을 비교한다. 다른 블록의 측정 대상, 1.25px 치수·0.75px 글꼴 허용치는 유지했다.
- `editorPerformance.spec.ts`: 구조 편집이 꺼진 v1 fixture에서 제외되는 Card 정의/프리셋을 manifest 기반 기대 목록에 반영한다. 전체 목록 145개·초기 렌더 24개와 기존 모든 시간/Long Task 예산을 유지했다.
- 타입·관련 하네스 81개·31개 브라우저 정의 수집 검사를 통과했다. 수집 성공은 실제 브라우저 성공과 구분한다.
- Local runtime lease 아래 공개 `php artisan template:activate`로 `jwsoft-business01 0.3.1`에서 `sirsoft-basic 1.1.4`로 전환했다. 정상/오류 종료 공통 EXIT trap에서 원래 테마로 복구하고 공개 TemplateService로 identifier/version을 재확인했다. 두 테마의 설치·bundled·pending 파일 총 1,667개 전후 SHA256은 모두 `926656b06c0724ccde5eaeac5b8f493432153613e364533ae0f2ebeb710e33a3`다. 테마 파일·G7 코어·운영 서버는 수정하지 않았다.

IP2 제출 `3f187551709e048559e354ec73c3a3582527a628`을 위 통합 기준에서 `make task-integrate-scoped TASK=ip2-document-contract-20261012 INTEGRATION_TASK=integration-ip2-resume-20261012 FULL=1`로 검증했다. 원본 로그는 Local `output/playwright/ip2-full-after-browser-contracts-20261012.log`다.

- 하네스 463개, PHP 단위 336개/3,234 assertions, PHP coverage 409개/3,866 assertions와 기존 하한선 통과. PHPUnit notice 1건 유지.
- 프런트엔드 122파일/1,016개, coverage 84.58/79.00/81.06/87.86%, 타입·구조·production 8번들·카탈로그 148개 source·편집기 gzip 508,253/508,500 bytes 통과.
- G7 통합 73개/632 assertions 통과. 제품 브라우저는 재시도 없이 **48개 통과/1개 실패**(9.5분). PC·태블릿 전체 프리셋, 3기기 카탈로그 시각 회귀와 5개 Page Kit, 지원 테마의 페이지/임시 홈·Header/Footer·대표 경로 연결이 통과했다.
- 100블록 성능: 준비 1,685.8ms, 타이핑 p95/max 82.6ms, 드래그 965.5ms, 목록 열기 111.2ms, Long Task 7개/max 135ms/총 570ms로 기존 예산 통과.
- 실패 때문에 뒤에 연결된 `test:e2e:site-shell`은 실행되지 않았다. Site Part journal `output/playwright/gates/integration-ip2-resume-20261012/c7fc8ec71511fc2231c63a89b9c48caf55436fef9f77b3b0d92d069cdd4b9898/b068046e52624e0c805e4dfaf8a8f118/site-part-state.json`은 10세션 모두 restored=true·closed=true다.

## 이전 차단 모바일 Hero 빈 슬롯 간격

모바일 `ALL_PRESET_LAYOUT_GATE`의 `hero.backdrop` 이미지 높이는 편집 462.59375px, 미리보기 438.59375px로 정확히 24px 다르다. 저장된 geometry에서 두 영역의 padding은 80px 20px로 같고 모든 텍스트/버튼 높이도 같다. 편집기에만 높이 0인 빈 Puck DropZone이 Grid 자식으로 남아 gap 1.5rem(24px)을 하나 추가한다. `puckEditorConfig.tsx`의 Hero render는 빈 extra도 호출하고 공개 Hero compiler는 내용이 없는 extra를 출력하지 않는다. 이는 Card 측정 오판과 다른 제품 렌더링 차이다.

통합 실패 후 Git은 자동으로 `af8a2e06dfffd99bfc77b365376d31b7c0b21367`로 원복됐다. IP2 없는 기준·원래 테마·동일 build에서 `G7PB_PRESET_IDS=hero.backdrop`, mobile, `--retries=0`로 해당 시나리오만 실행하여 같은 차이를 재현했다. 로그/JSON/DOM 치수/두 화면은 `output/playwright/ip2-baseline-hero-backdrop-20261012.log` 및 `output/playwright/ip2-baseline-hero-backdrop-20261012/`에 보존했다. 원본 전체 실행의 두 화면도 직접 확인했다.

모바일 전체 검사에서는 Hero 실패가 후속 블록 치수 assertion을 막으므로 `G7PB_PRESET_IDS=card.empty`의 모바일 비교만 별도로 실행해 통과했다(4.2초). 증거는 `output/playwright/ip2-card-mobile-20261012.log`와 해당 이름의 디렉터리다. 제품/시각 기준이나 snapshot을 바꾸지 않았다.

이후 사용자가 `resources/js/editor/puckEditorConfig.tsx`와 `tests/Unit/puckEditorConfig.test.tsx`의 별도 보완을 승인했다. 기존 E2E의 전체 프리셋 및 내부 구성/이력 시나리오를 재사용하며 시각·성능 기준은 유지한다.

## 승인된 Hero 빈 슬롯 보완

- task `ip2-hero-empty-slot-20261012`, 기준 `af8a2e06dfffd99bfc77b365376d31b7c0b21367`, 승인된 정확 2파일만 소유했다. 제출 `9c30ecbc9213db359c2fe8198d4f4829365d81d2`.
- Puck의 공개 `getItemById` selector로 현재 Hero의 extra 내용 유무를 읽는다. 일반 편집과 읽기 전용 미리보기에서는 빈 슬롯을 렌더하지 않으며, 채운 슬롯과 v2 구조 편집의 빈 삽입 대상·기존 CTA 소유권을 유지한다. 문서·명령·Undo·CSS·공개 compiler는 변경하지 않는다.
- 추가한 빈 슬롯 회귀는 수정 전 0개 기대/1개 실제로 실패했고 수정 후 통과했다. v1/v2 편집↔읽기 전용 전환, 채운 배지/목록·CTA 표시와 문서 무변경을 확인했다. 관련 3파일 18개 시험·타입 검사 및 제출 scoped gate가 통과했다.
- Local 통합 `03ff36d2004c2c870d1c7c22a0a89693f47d9d4b`. scoped 브라우저 8개(직접 텍스트 1·구조/테마 6·페이지 lifecycle 1)가 통과했다. 로그는 `output/playwright/ip2-hero-empty-slot-integration-20261012.log`. Site Part 세션 1개 restored=true·closed=true이며 원래 `jwsoft-business01 0.3.1` 원복과 테마 1,667파일 해시 동일을 확인했다.
- 원래 테마로 복구한 뒤 mobile `hero.backdrop` 비교를 재시도 없이 통과했다(4.4초). 편집/미리보기 높이 모두 438.59375px, delta=0이며 빈 DropZone이 없는 DOM을 확인했다. 증거는 `output/playwright/ip2-hero-empty-slot-proof-20261012/parity/`와 `parity-results.json`이다.
- desktop Hero 내부 구성 2개를 재시도 없이 통과했다(26.4초). 빈 구역의 배지/목록 삽입·편집·이동·삭제·Undo·재열기·미리보기·발행과 CTA의 원자적 이전/Undo·빈 actions 저장을 확인했다. 증거는 같은 디렉터리의 `composition-results.json`, 화면과 `output/playwright/ip2-hero-composition-proof-20261012.log`다. 최초 선택 명령의 `^hero` 정규식은 전체 test 이름과 맞지 않아 0개를 선택했으며, 선택자를 바로잡은 후 위 2개를 실행했다.
- Linux frontend budget 전체 통과. 편집기 gzip 508,316/508,500 bytes, 편집기 CSS 계열 180,077/180,100 bytes로 기준은 유지했다. IP2 공유 계약의 FULL 통합은 별도 필수 검증이다.
