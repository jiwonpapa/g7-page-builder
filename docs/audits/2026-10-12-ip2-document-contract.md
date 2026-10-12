# IP2 정밀 문서 계약 검증

상태: 구현 제출 완료, 기존 파일의 전체 lint 실패로 Local 통합 차단. IP2 완료와 IP3 착수를 보류한다.

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

## 제출과 통합 차단

- 구현 제출 SHA: e85bdf2f8af9a78c66289e0b3dc1ec9c022240d1. 최초 제출 15fe3e8d01904ff35483a4d7cc66a9ffdf9a78ee 뒤 같은 소유 범위에서 URL 회귀를 보강해 task-resubmit으로 제출했다.
- 제출: 정확 20개 경로, 21개 gate, FULL=1. 타입·구조·PHPStan·Pint·관련 단위·하네스 검사를 통과했고 full-product는 정책대로 Local 통합에서 필수 실행했다.
- Local 전체 하네스 460개 통과. 이후 quality-php의 composer check → Pint가 기존 tests/UnitPhp/HeroCompositionTest.php의 class_attributes_separation 규칙 위반으로 실패했다.
- 해당 파일은 IP2 diff에 없다. 자동 통합 원복 후 기준 SHA 245042b347199e6b9044eba3b519d171cef512ff에서도 vendor/bin/pint --test -v tests/UnitPhp/HeroCompositionTest.php로 같은 실패를 재현했다. 메서드 사이/클래스 마지막 빈 줄 서식이며 IP2 수치·문서 계약 오류가 아니다.
- 첫 통합 시도는 명시 PATH에서 /usr/local/bin 누락으로 docker를 찾지 못했다. 경로를 보완한 뒤 재시도하여 위 기존 lint 차단을 확인했다. 제품 소스나 검사 정책을 우회하지 않았다.
- 두 통합 시도 모두 Git은 기준 SHA로 자동 원복됐으며 submitted 구현 커밋은 worktree에 보존한다. 두 번째 Site Part fixture journal은 sessions가 비어 있고 closed=true다. 브라우저 fixture 변경 전 lint에서 멈췄으며 실제 제품 브라우저·전체 coverage·발행 검증에는 도달하지 않았다.
- 두 번째 원본 journal: Local의 output/playwright/gates/integration-ip2-document-contract-20261012/929f6a23354cc0d9ace89649a17ed3b580e9b83f6ad1bd551647cc11baff4641/86405483fd6f489191195947f35ff539/site-part-state.json.

다음 필수 조치는 기존 HeroCompositionTest.php 서식 수정의 별도 범위 승인이다. 승인 전에는 소유 밖 파일을 고치거나 full gate를 제외하지 않는다. 그 뒤 전체 필수 검증과 통합을 완료해야 IP2를 done으로 바꾸고 IP3 레이어/재귀 구조 편집으로 진행할 수 있다. 실제 편집 UI·저장/발행·브라우저 시각 회귀·운영 배포를 이번 계약 단위 시험으로 주장하지 않는다.
