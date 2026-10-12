# IP2 정밀 문서 계약 검증

상태: worktree 구현과 관련 검증 진행 중. 제출·통합·전체 필수 gate 완료 전이며 IP2를 완료로 기록하지 않는다.

## 소유 범위

- 기준 SHA: 245042b347199e6b9044eba3b519d171cef512ff
- task: ip2-document-contract-20261012
- 정확 20개 파일, PROFILE=scoped, AREAS=shared-contract.
- 새 v3 스키마/정책, 순수 TS/PHP 검증·명시 이행 snapshot 준비, 양쪽 공통 fixture, 검사 등록, 계약/진척/감사 기록만 대상.
- 기존 v1/v2/Site Part/컴파일러·저장 API·G7 코어·제품 의존성·모듈 버전·발행본은 변경하지 않는다.
- [v3 계약](../document-v3-contract.md), [현행 실행 계획](../productization/editor-plan.md)의 IND-02, SPEC-02·05에 연결한다.

## 구현과 필수 증거

공통 JSON Schema와 별도 의미 정책이 수치/단위/enum/한도/기본값/원본 버전을 소유한다. 양쪽 검증기는 그 값을 소비하고 공통 정상 fixture와 35개 변형 사례로 수용/거부 결과를 비교한다. 안정 ID·중복·슬롯·자산 참조·반응형 부모·원자적 override·깊이/용량/500노드·미지 필드 무변경을 확인한다.

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

- TS 관련 45개, PHP 6개/104 assertions 통과. 최종 fixture 보강 후 제출 gate에서 다시 확인한다.
- 제품 TypeScript 타입 검사 통과.
- 신규 도메인 7파일 구조 gate: 신규 부채/위반 0.
- 신규 PHP 도메인 PHPStan level 8 통과.
- PHP 100/500노드 검증 관측 4.3/21.6 ms. 1초 예산 내 단일 로컬 관측이며 제품 p95/브라우저 성능 보증은 아니다.
- 첫 PHP 시험에서 JSON regex의 ECMAScript 문자 escape가 PCRE와 달라 실패했다. 공통 regex 표현을 수정하고 양쪽 시험을 통과했다.
- 타입 검사에서 JSON union의 선택 필드와 ES library 범위가 드러나 실제 narrowing/호환 Unicode 검사로 수정했다. unsafe assertion이나 baseline 예외를 추가하지 않았다.

제출·Local 통합 SHA와 최종 판정은 검증 후 기록한다. 실제 편집 UI·저장/발행·브라우저 시각 회귀·운영 배포를 이번 계약 단위 시험으로 주장하지 않는다.
