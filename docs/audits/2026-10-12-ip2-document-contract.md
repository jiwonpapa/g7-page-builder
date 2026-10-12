# IP2 정밀 문서 계약 검증

상태: 승인된 PHP 서식·품질 fixture·Card 썸네일·범위 하네스·레이아웃 회귀 보완은 별도 통합 완료. 기존 커버리지 미달을 관련 검사에서 해소했으며 IP2 FULL 재검증을 진행한다. 전체 통합 전 IP3 착수는 보류한다.

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
- layoutPolicy.ts, 기존 tests/Unit/layoutTree.test.ts, vite.config.ts는 IP2와 승인된 수정의 diff에 없다. Git 자동 원복 후 같은 Docker runtime에서 아래 관련 4파일/76개 시험은 통과했고 동일 함수 커버리지 93.33% 실패를 재현했다. 보고서는 Local output/coverage/ip2-layout-policy-baseline-20261012/에 보존한다.

```sh
npx --no-install vitest run tests/Unit/layoutTree.test.ts tests/Unit/heroComposition.test.ts tests/Unit/cardComposition.test.ts tests/Unit/basicElementContracts.test.ts --coverage --coverage.include=resources/js/documents/layoutPolicy.ts --coverage.reportsDirectory=output/coverage/ip2-layout-policy-baseline-20261012
```

전체 재검증 로그: Local output/playwright/ip2-full-after-fixture-20261012.log. journal: output/playwright/gates/integration-ip2-resume-20261012/1f2a4ab8d5f11a5993e0a95b1d209f76f3585f75e810a6c6024a54629d11501b/3558cf54d4ed4e6fb5cbf8f43a81eaea/site-part-state.json. sessions=[]·closed=true로 제품 브라우저 fixture는 시작되지 않았다. 이 전체 실행은 production build·G7 후속 검사·제품 브라우저에 도달하지 않았다. 별도 Card task의 build 통과와 혼동하지 않는다.

사용자가 tests/Unit/layoutTree.test.ts 한 파일의 회귀 추가를 승인했다. 별도 task ip2-layout-policy-coverage-20261012에서 Hero·ImageText·Card의 슬롯 미지정 허용, 명시 슬롯 제한, 미등록 슬롯/구조/상속 속성 거부를 검증했다. 관련 4파일/77개 시험이 통과했고 해당 파일의 함수·줄 coverage는 100%, statements 98.98%, branches 99.03%로 기존 하한선을 통과했다. 제품 소스와 coverage 기준은 변경하지 않았다. 제출 e3c19af3efe89b5506ffb0adaefc0a62805a8d53, Local 통합 95deae4720ec08d3a07d330366e225468448136d.

이제 IP2 FULL 재검증을 진행한다. 관련 커버리지 성공은 전체 통합 성공이 아니다. IP2 submitted 원본은 worktree에 보존하며 미통합 제출이 남아 있는 동안 integration lease를 강제 해제하거나 완료로 바꾸지 않는다. 전체 필수 검증과 통합을 완료해야 IP2를 done으로 바꾸고 IP3로 진행한다. 실제 정밀 편집 UI·저장/발행·브라우저 시각 회귀·배포를 계약 단위 시험으로 주장하지 않는다.
