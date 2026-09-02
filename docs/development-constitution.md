# 개발 헌법

상태: 2026-09-02 설계·검증 기준. 이 문서는 구현 완료 보고서가 아니다. 사용자 지시가 최우선이며, 현재 동작과 목표 요구를 혼동하지 않는다.

## 1. 제품과 기술의 소유권

- 원본은 자체 `PageBuilderDocument`다. Puck 상태, 생성 HTML, G7 JSON 출력은 원본을 대체하지 않는다.
- G7 Layout Editor의 기술 스택·중첩 편집·설정·JSON 활용·편집창·상태 관리 방법을 참조한다. G7 편집기 코드·내부 runtime·문서/저장 엔진에 의존하지 않는다. 기존 G7 호스트 연결은 공개 API를 사용하는 명시적 어댑터 경계에 둔다.
- 기존 완성 블록의 내부 구조 편집과 중첩 삽입·이동·삭제는 목표 요구다. 현 구현의 제한을 영구 제품 정책으로 바꾸거나, 문서/테스트 작성만으로 완료 처리하지 않는다.
- 기능 요구, 문서 계약, 화면 흐름, 구현, 검증 결과를 연결한다. 요구 변경에는 이유·데이터 호환 영향·미완료 항목을 적는다.

## 2. 책임과 의존 방향

| 책임 | 소유 내용 | 의존 제한 |
|---|---|---|
| 문서 도메인 | 노드·설정·검증·트리 명령 | React/Puck/DOM/HTTP/저장소를 모르며 자체 계약과 버전 스키마만 사용 |
| 사용 사례 | 편집 명령 실행·저장/발행 흐름 | 도메인과 포트 사용, 구체 저장소·G7 구현 생성 금지 |
| 편집 UI | 캔버스·트리·선택·필드 표시 | 같은 문서 명령을 호출하며 별도 삽입/삭제 규칙을 만들지 않음 |
| 어댑터 | Puck 변환·HTTP·PHP 저장소·G7 공개 연동 | 검증된 계약으로 경계를 넘기며 역방향 import 금지 |
| 스타일 | 의미 토큰·공통 컨트롤·블록 외형 | 편집/공개 출력이 같은 토큰 의미를 사용 |

`TS-BOUNDARY`: `resources/js/documents`는 문서/스키마만, API 모듈은 문서·API·정해진 리소스 타입만 참조한다. 공개 runtime은 편집기·관리자·관리 API를 참조하지 않는다. 정적 import, re-export, import-equals, literal dynamic import와 require를 TypeScript AST로 검사한다. 보호 계층의 계산된 import는 검사 불가능 상태로 거부한다.

`PHP-BOUNDARY`: Domain→Domain, Contracts→Contracts/Domain, Application→Application/Contracts/Domain 방향만 허용한다. 이 계층에서 Laravel/G7/Sirsoft와 Infrastructure/Providers를 참조하지 않는다. `use`뿐 아니라 완전수식 이름·group use도 PHP lexer로 검사하며 주석/문자열을 import로 오인하지 않는다.

`G7-INTERNAL`: G7 private runtime과 LayoutEditorChrome 직접 참조는 금지한다. 기술 조사에 사용한 샘플은 제품 실행 경로로 가져오지 않는다.

자동 검사 범위 밖의 책임 집중도까지 통과했다고 주장하지 않는다. API를 파일 하나로 옮겼어도 UI가 내부 구조를 알아야 한다면 분리가 끝난 것이 아니다.

## 3. TypeScript와 JavaScript

- `strict`를 유지하고 외부 입력은 `unknown`에서 시작해 실행 시 검증한다. DTO를 내부 상태와 구분하고 실패 시 오류를 표시하며 정상 문서를 보존한다.
- union은 판별 필드를 사용하고, 문서·선택·글자 범위·저장 요청·히스토리 상태의 소유권을 분리한다. 새 상태를 더할 때 기존 처리의 누락 여부를 확인한다.
- `TS-UNSAFE`: explicit `any`, unknown/any를 경유한 이중 assertion, 소비자 계약을 우회하는 `as never`를 새로 추가하지 않는다. 기존 벤더 변환 단언은 정확 코드 지문으로만 부채를 인정한다. 정상적인 타입 narrowing과 검증 후 단일 assertion까지 일괄 금지하지 않는다.
- 문서 변경은 동일 명령 계층을 통한다. UI 이벤트가 문서 객체를 직접 임의 변경하거나, 저장 응답이 이후 입력을 덮지 않는다. 한 사용자 명령의 문서·선택·Undo 결과를 함께 설계한다.
- React effect는 외부 동기화에 사용한다. 도메인 계산을 effect와 상호 호출로 감추지 않고, 구독·listener·timer의 정리와 요청 취소/응답 순서를 명확히 한다.
- 파일 크기를 줄이기 위해 `utils`로 임의 이동하지 않는다. 이름과 공개 함수가 책임을 설명하고, 함수 호출자는 변환/저장/렌더의 내부 구현을 알 필요가 없어야 한다.
- JS 빌드·검사 도구도 입력/출력/오류 계약을 가진다. shell 문자열 보간으로 파일·사용자 값을 실행 코드로 만들지 않는다.

## 4. PHP

- Domain/Application/Contracts에 Laravel/Eloquent/G7 구현을 넣지 않는다. Composition Root에서 어댑터를 연결하고 Application은 포트를 받는다.
- 컴파일러는 문서 검증과 블록 렌더 책임을 분리한다. 블록별 출력 함수가 커지면 타입별 compiler/renderer로 옮기되, 변경 순서·escaping·진단·마지막 정상 발행본 계약을 유지한다.
- 저장/발행 트랜잭션, optimistic lock, 재시도 정책을 명시한다. 프런트 타입을 믿고 서버 검증을 생략하지 않는다.
- PHP와 TS가 같은 규칙을 쓰는 경우 공통 버전 명세/fixture로 의미를 검증한다. 두 언어에 필요한 구현이 존재하는 것과 정책 값을 서로 독립적으로 복제하는 것은 다르다.

## 5. 스타일과 테마

- primitive 값→의미 토큰→컴포넌트 순서로 연결한다. 공통 색·간격·반경·글꼴·동작을 각 화면에 복사하지 않는다. 브랜드 색·레이아웃 비율·접근성 크기 같은 도메인 상수는 이름과 소유권이 있으면 합법이다.
- 편집 UI 토큰과 페이지 디자인 토큰을 구분한다. 페이지 light/dark/system을 지원한다고 편집 UI 전체 다크 모드가 완료된 것은 아니다.
- 공통 토큰의 소유 파일은 machine-readable 규칙에 선언한다. 블록 배경에 따라 text/muted/border까지 함께 바뀌어야 하며, 사용자 명시 색은 자동 기본값과 구분한다.
- portal은 자체 theme scope를 가지거나 지정 host 아래에 렌더한다. iframe은 필요한 토큰/CSS 전달과 로딩 완료 조건을 가진다. root 내부에서만 정상인 컴포넌트를 공통 컴포넌트로 취급하지 않는다.
- `CSS-COLOR`: 새 component CSS의 색 관련 속성에 hex/rgb/hsl 등 색 리터럴과 named color를 복제하지 않는다. 정확히 지정된 token source의 custom property 정의는 허용한다. 기존 리터럴은 selector·at-rule·속성·값의 지문으로 제한한다. 이 정적 규칙만으로 모든 CSS 색 표현·접근성을 검증한 것은 아니다.
- `CSS-IMPORTANT`: 새 `!important`는 자동 허용하지 않는다. 외부 DOM 호환처럼 필요한 경우 정확 선언과 이유·해소조건을 검토 가능한 예외로 둔다. selector 반복으로 우선순위를 높이는 `CSS-SPECIFICITY`도 같은 방식으로 관리한다.
- 스타일 계층은 기본값, 컴포넌트, 명시적 사용자 설정, 제한된 vendor 보정으로 구분한다. 보정 규칙을 파일 끝에 계속 추가해 우선순위 경쟁을 키우지 않는다.
- 재사용성은 동일 문자열의 개수로 판정하지 않는다. 다른 화면에서 같은 컴포넌트를 쓰고 테마 변경이 함께 반영되는지 확인한다.

## 6. 크기·부채·예외

`SOURCE-SIZE`: 새 TS/JS/PHP 제품 파일은 비어 있지 않은 800줄, CSS는 1,000줄을 구조 검토 경계로 둔다. TS/JS는 추가로 AST 노드 10,000개를 상한으로 검사해 한 줄 압축으로 크기 검사를 피하지 못하게 한다. 이 수치는 좋은 설계의 증명이나 업계 표준이 아니다. 제한 초과 파일은 책임을 분리하거나 정확한 근거와 상한을 검토해야 한다. 주석 제거·압축·무의미한 파일 이동으로 통과시키지 않는다.

기존 초과 파일은 현재 상한을 더 늘릴 수 없다. 기존 위반은 `config/design-architecture-debt.json`에 파일, 규칙, 정확 지문/수치 상한, 이유, 해소조건을 기록한다. 다른 파일의 감소를 신규 위반의 허용량으로 사용하지 않는다. 동일 위반을 복제해도 개수 상한으로 실패한다.

- 무제한 directory 면제, wildcard, 비어 있는 사유, 자동 baseline 승격을 금지한다.
- 코드를 옮길 때도 기존 위반의 새 위치를 명시적으로 검토한다. 이전 위치와 새 위치 양쪽을 동시에 늘리는 예외를 만들지 않는다.
- 서로 다른 소유 task가 순서대로 통합되는 이전 작업은 동일 코드 지문의 정확 원본/목적 경로를 `relocations`에 기록할 수 있다. 두 위치를 합산해 기존 개수 상한을 적용하며, 어느 한 위치 변경도 양쪽 소스를 검사한다. 코드가 달라지면 이전 예외가 적용되지 않는다.
- 해소된 지문은 retired candidate로 보고하고 부채 장부에서 제거한다. 예외가 남았다는 사실을 구조 개선 완료로 표현하지 않는다.
- machine-readable 규칙과 이 문서를 함께 검토한다. 규칙 ID가 문서에 없거나 예외 형식이 잘못되면 검사 자체가 실패한다.

## 7. 하네스와 완료 판정

| 확인 대상 | 증거 | 판정 한계 |
|---|---|---|
| 타입·계층·새 위반·기존 상한 | `check-design-architecture`, 타입 검사, PHP 정적 검사, Stylelint | 사용자 편집 성공의 증거가 아님 |
| 문서·명령 의미 | 관련 Unit/Integration fixture | 실제 포인터·키보드 UX의 증거가 아님 |
| 편집 흐름 | 삽입→이동→삭제→Undo→저장→재열기 | API로 초기화한 트리를 UI에서 만든 것으로 보고하지 않음 |
| 스타일·테마 | 실제 computed style·대비·스크린샷 | 클래스 추가나 CSS 문자열 존재만으로 완료 아님 |
| 배포 | 승인된 패키지·원격 버전·실제 화면 | 로컬 build 성공과 구분 |

정적 검사 명령:

```sh
node scripts/check-design-architecture.mjs
node scripts/check-design-architecture.mjs --files resources/js/documents/layoutTree.ts
node --test tests/Harness/design-architecture.test.mjs
```

파일 선택은 기존 scoped planner를 사용한다. 규범 문서/규칙/분석기 변경은 전체 제품 소스를 정적으로 다시 평가하되, 그것만으로 전체 browser/build/배포를 실행하지 않는다. 검사 실패 시 해당 원인과 downstream만 재실행한다. 선언되지 않은 경로를 조용히 무시하거나 성공 결과를 다른 입력에 재사용하지 않는다.

검증된 controller가 별도 worktree를 제출 검사할 때는 `--root /absolute/subject-worktree`를 사용한다. 이때 실행되는 분석기·규칙·부채는 controller 소유이며 제품 소스만 대상 worktree에서 읽는다. 규칙 자체 변경은 소유 task의 회귀와 최종 통합 후 Local 검사로 확인한다.

구조 검사는 TypeScript·PHP lexer·PostCSS를 사용한다. CSS parser와 value parser는 현재 고정된 Stylelint dependency tree에 존재하며 lockfile을 검사 입력에 포함한다. 의존성 변경으로 parser가 없어지면 검사 실패로 처리한다.

이번 기준 적용은 내부 편집 기능·상용 품질·모든 기존 부채 해소를 뜻하지 않는다. 각 개선의 실제 diff와 관련 검증을 별도로 보고한다.
