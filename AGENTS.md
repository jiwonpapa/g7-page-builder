# G7 Page Builder Development Guide

## Communication

- 사용자에게는 존댓말을 사용하고 `형님`이라고 부른다.
- 결과와 영향부터 간결하게 보고한다.

## Architecture boundary

- 제품 저장소는 G7 코어 저장소와 분리한다.
- `src/Domain`, `src/Application`, `src/Contracts`에서는 G7 클래스와 Laravel 구현을 import하지 않는다.
- 모든 G7 연동은 `src/Infrastructure/Gnuboard7` Adapter에서만 수행한다.
- G7 내부 프론트엔드 경로(`resources/js/core/**`)와 `G7Core.__runtime`을 사용하지 않는다.
- G7 또는 번들 모듈의 Model·Repository·DB 테이블을 직접 참조하지 않는다.
- 기존 템플릿 파일과 레이아웃 파일을 수정하지 않는다.
- 페이지 빌더 원본은 `PageBuilderDocument`이며 G7 JSON UI는 생성 결과물이다.
- 생성된 JSON UI를 원본처럼 직접 수정하지 않는다.

## Editor boundary

- 새 편집기 엔진을 복제하지 않는다.
- G7의 공개 `JsonUiDocumentEditor` 계약이 제공되면 이를 Adapter를 통해 사용한다.
- Layout Editor와 Page Builder는 같은 문서를 동시에 소유하지 않는다.
- Layout Editor는 페이지 빌더 콘텐츠를 하나의 원자 영역으로 취급한다.
- Tiptap은 MVP 필수 의존성이 아니다.

## Compatibility

- 공개 계약과 문서 스키마는 SemVer를 따른다.
- 모든 문서는 `schema_version`, 모든 컴파일 결과는 `compiler_version`을 기록한다.
- G7 업데이트 후 과거 Fixture 재컴파일·렌더링 시험을 통과해야 한다.
- 호환되지 않을 때 편집·발행은 중지하되 마지막 정상 발행본은 유지한다.

## Quality gates

- PHP: PHPUnit 및 Laravel Pint.
- Frontend: TypeScript strict, Vitest.
- Browser: Playwright로 생성→편집→미리보기→발행 흐름을 확인한다.
- PC·태블릿·모바일 시각 회귀를 확인한다.
- 코어 내부 import와 직접 테이블 접근은 정적 검사로 차단한다.

