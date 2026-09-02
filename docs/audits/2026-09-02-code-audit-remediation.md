# 2026-09-02 코드 감사 개선

## 범위와 증거 기준

기준 코드: `08c841b2a84b521e37b9c3354c968e56adb621a7`.

사용자 지시에 따라 **코드 검증**으로 범위를 제한한다. 기존 블록의 문구·이미지·샘플 데이터·프리셋 완성도·카탈로그 상품성은 평가하지 않는다. 저장된 사용자 콘텐츠에 준비/변환 명령을 실행하지 않는다.

단위/통합 검사는 코드 계약용 fixture와 격리 SQLite를 사용한다. 브라우저 검사는 소유권이 확인되는 테스트 문서로 저장·편집 상태·CSS 계산값을 검사한다. 등록/수집과 `DEFERRED`는 실제 브라우저 통과가 아니다. 배포와 기존 문서 이행 완료도 별도 증거가 필요하다.

## 수정 항목

| ID | 확인된 결함 | 코드 조치 | 검증 경로 |
| --- | --- | --- | --- |
| A01 | Puck 기본 복제/이동의 잘못된 후보로 화면·저장 상태 분리 | 공통 후보 검증, 정상 데이터/선택 복구, 기존 히스토리 보존; 저장 요청 직렬화 및 편집 버전 대조 | `editorDocumentBoundary`, 실제 Puck DOM unit, `draftPersistence`, 브라우저 문서 경계 |
| A02 | 환경변수로 정식 coordination 검증 건너뛰기 | 정식 명령에서 테스트 훅/state override 거부; fixture는 별도 임시 Git/state 안에서만 허용 | 격리 coordination 회귀 |
| A03 | 타입 검사·별칭 읽기의 실제 의존 입력 누락 | TS compiler의 실제 입력과 설정/명령 정의 포함; 해석 불가 파일 읽기는 성공 재사용 금지 | typecheck/input/planner/runner 회귀 |
| A04 | only/skip/0개 실행/누락을 브라우저 성공으로 판정 | forbid-only, JSON 실행 결과와 필수 project/case 검증; PC 지원 시나리오는 PC로 등록 | browser verdict/registration 회귀 |
| A05 | Site Part HTML을 버리고 공개 요청마다 재컴파일 | 리비전별 HTML/hash/compiler 영속화, 발행 포인터와 동일 트랜잭션, 공개 compiler 의존 제거 | SitePartArtifacts unit/SQLite/API |
| A06 | 새 문서 쓰기에서 ID/버전/배열/레이아웃·효과·표시 조건·반응형 설정 형식 미검증 | 저장 경계 공통 검증; 문서 스키마와 코드 팩 버전 선언을 사용; 구형 읽기 경로 유지 | PageDocumentWritePolicy/StoredDocumentRecovery/SQLite |
| A07 | Site Part UUID·버전 입력을 느슨하게 수용 | 읽기 복원과 새 쓰기 검증 분리; API와 repository 경계에서 검증 | SitePartDocument/SQLite/API |
| A08 | 보관 문서가 다시 발행되거나 공개 조회됨 | 준비 전 및 DB 잠금 안에서 상태 재검사; 공개 조회와 홈 지정 차단 | PageBuilderService/PublicationLifecycleGuard |
| A09 | Header/Footer가 서로 다른 시점의 활성 세트를 읽음 | 단일 JOIN 문장으로 같은 세트의 양쪽 발행 결과 조회 | 조회 직후 다른 세트를 활성화하는 SQLite 회귀 |
| A10 | 가격 카드의 밝은 배경과 다크 글자색 토큰이 분리됨 | 배경/전경 의미 토큰을 함께 사용; 기존 색상 예외 4개 제거 | CSS 정적 검사/계산 스타일·대비 브라우저 검사 |
| A11 | 배포 ERR 복구 후 실행이 계속되어 성공 처리됨 | 실패 코드 보존, 복구 후 즉시 오류 종료; 준비 검사 실패 시 성공 마커 금지 | 실제 배포 셸을 가짜 PHP와 임시 파일로 실행 |
| A12 | 명시적 smoke 요청도 파일·과거 성공 기록이 같으면 DB 준비 검사 생략; 실패 뒤 과거 성공 재사용 | 명시적 점검은 실제 smoke 실행 전 과거 성공 증거를 무효화; 반복 배포의 재전송·재적용 방지는 유지 | 파일 동일/준비 상태 변경, 실패 후 재시도·회복을 가짜 transport로 검증 |
| A13 | 편집 중 활성 Header/Footer 세트가 바뀌면 다른 세트에 저장될 수 있음 | 읽은 세트 ID를 저장·발행에 고정하고 서버에서 문서 ID·종류·언어 불일치를 거부 | SitePartEditor identity unit, SQLite, 실제 A 편집 중 B 활성화 후 A 저장·B 불변 검사 |
| A14 | 화면 언어와 달리 공통 셸 API가 한국어를 고정 요청 | 고정 쿼리 제거, G7이 결정한 요청 언어 사용; 자동 언어 응답은 공유 캐시 금지 | 요청 언어·명시 쿼리·캐시/ETag 통합 검사, 한국어·영어 브라우저 |
| A15 | 중첩 슬롯에서 글자를 클릭하면 입력창이 교체되어 포커스 유실 | 새로 생성되는 슬롯 함수를 React 컴포넌트 타입으로 쓰지 않고 공개 렌더 콜백으로 호출 | 실제 Adapter에서 수정 전 DOM 제거 재현, 수정 후 DOM·포커스 유지 및 삽입/삭제/갱신 unit, 중첩 편집·저장·복원 브라우저 |

작업 중 발견한 미제출 작업의 기준 갱신 공백도 보완했다. `task-replace-active`는 원본 branch·index·수정 파일과 증거를 보존하고 동일 소유 범위를 새 작업에 전달한다. 충돌·중간 종료·metadata 쓰기 실패 시 새 작업만 복구하며, 교체 자체를 제출·검증 성공으로 처리하지 않는다.

브라우저 하네스도 보완했다. 기존 Site Part가 발행되어 있다는 전제 대신 시험마다 전용 합성 세트를 API로 만들고 발행한다. Local runtime·task·spec·일회성 토큰을 확인하는 메타데이터 journal로 활성 세트를 복원하며, 동시 변경이나 복원 실패·빈 실행 기록을 성공으로 처리하지 않는다. PHP 실행은 공용 PsySH 캐시에 의존하지 않는다. 모바일 메뉴 위치는 등장 애니메이션 후에도 기존 2px 기준을 만족해야 한다. 리치텍스트는 실제 전체 선택 키 입력, 해당 입력창의 전체 선택 확인, 입력, 최종 문자열·저장 결과를 검사한다.

## 통합 검증

제품 코드 통합 SHA: `9014ac203ed814ea71d38df6bbc987fc286ee437`. 시작 기준 대비 85개 파일의 변경을 scoped 계획으로 검증했다. 전체 콘텐츠 검사나 전체 coverage 통과를 의미하지 않는다.

`make integration-verify TASK=code-audit-integration-20260902`가 **91개 선택 gate의 요구조건을 충족하고 VERIFIED로 종료했다**. 같은 명령·의존 입력의 성공 검사는 정식 하네스가 재사용했고, 입력이 달라진 관련 PHP/TypeScript/하네스 검사는 다시 실행했다. Pint, PHPStan, TypeScript 타입, 의존 경계, 빌드 자산 검사도 이 계획에 포함된다.

실제 Local 브라우저의 desktop project에서 아래 **6개 spec / 16건이 통과**했다. JSON 결과의 skip·예상 밖 실패·flaky는 모두 0이다. Site Part fixture journal 3개가 닫혔고, 시험 세션 10개의 활성 상태 복원과 복원 프로세스 종료 코드 0을 확인했다.

| 실제 브라우저 코드 시나리오 | 통과 |
| --- | ---: |
| 잘못된 구조 거부·히스토리 보존·저장 중 새 편집 보존 | 2 |
| 테마 계산값·중첩 선택/삽입·모달 배경 | 3 |
| 공통 셸 경로·한국어/영어·fallback | 1 |
| 문서 저장/발행/복원·템플릿·중첩 입력 | 3 |
| Header/Footer 편집·발행·세트 전환 | 5 |
| 도구 조작·루트/중첩 리치텍스트 입력과 발행 | 2 |

223개 정적 감사 대상 파일의 SHA-256도 최종 통합 코드와 대조해 모두 일치했다. 검사 중 하네스가 의도적으로 실패를 주입한 로그는 실패 판정 기능의 회귀 증거이며, 실제 제품 브라우저 결과와 구분한다.

실행 증거는 `output/playwright/gates/code-audit-integration-20260902/`의 실행별 JSON 결과·복원 journal과 로컬 감사 산출물 `constitution-audit/code-remediation/`에 보존한다. [최종 검증 요약과 증거 경로](/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/constitution-audit/code-remediation/final-code-verification-summary.json), [통합 검증 로그](/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/constitution-audit/code-remediation/g7pb-code-final-verify-20260902.log), [정적 감사 집계](/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/constitution-audit/code-remediation/final-design-summary-v2.json)를 함께 보존하며 실패 기록도 삭제하지 않는다.

검증 한계:

- 실제 브라우저는 runtime lease를 가진 Local G7에서 실행한다. GitHub hosted CI에는 인증된 G7 브라우저 환경이 없어 해당 계획을 명시적으로 실패시키는 상태다. 클라우드 CI 브라우저 통과로 보고하지 않는다.
- Site Part 복원 helper는 기존 문서 JSON 대신 세트 활성 상태·감사 메타데이터만 조회·복원한다. 기존 PageLifecycle의 홈 지정 복원은 공개 API를 사용하므로 원래 홈의 lock version·감사 시각이 증가할 수 있다. Local DB 전체가 변경 전과 동일하다고 주장하지 않는다.
- Local에는 additive migration과 시험용 기록이 생긴다. 운영 배포·운영 DB 점검·기존 발행본 준비/변환은 실행하지 않았다.

## Site Part 최초 이행 경계

이번 변경은 additive artifact 테이블과 준비 명령을 제공한다. 기존 시스템은 발행 HTML을 저장하지 않았으므로 과거 발행 리비전의 HTML이 자동으로 존재하는 것은 아니다. 최초 준비는 과거 발행 JSON을 현재 compiler로 생성하는 작업이며, 과거 화면과 바이트 단위로 같은 HTML의 복구를 보장하지 않는다.

- `php artisan page-builder:site-part-artifacts`는 기본 읽기 검사다. 누락/손상된 발행 결과가 있으면 실패한다.
- `--prepare --limit=100`은 **명시적인 쓰기 작업**이다. 부족한 발행 결과를 제한된 수만큼 생성하며 원본 JSON, 리비전, 활성 포인터와 lock version을 바꾸지 않는다. 실패/잔여분이 있으면 준비 완료로 처리하지 않는다.
- 배포 apply와 smoke에서 읽기 검사를 강제한다. apply 실패는 이전 코드 파일을 복구하고 오류로 종료하며 성공 마커를 쓰지 않는다. smoke 실패는 오류로 종료하고 과거 성공 증거를 무효화한다. smoke 자체는 파일을 복구하지 않으며 DB migration도 자동으로 되돌리지 않는다.
- 최초 운영 이행은 승인된 점검 시간에 공개/쓰기 트래픽을 중지한 상태에서 신규 코드·additive migration·명시적 준비·readiness 성공을 확인한 뒤 재개해야 한다. 파일 교체 후 검사만으로 무중단 전환을 보장하지 않는다.
- 이번 작업에서는 배포, 운영 readiness, 기존 콘텐츠 준비 명령을 실행하지 않는다. 기존 문서 변환 완료나 운영 화면 개선 완료로 보고하지 않는다.

## 남는 구조 부채

이 수정은 재현된 코드 결함과 검증 허점을 닫는 범위다. 대형 Puck renderer, 광범위한 기존 CSS 리터럴, 제품 편집 기능 범위의 재정의까지 완료한 것은 아니다. 신규 위반 차단·기존 부채 상한과 실제 코드 동작 검증을 함께 유지해야 한다. 상용 출시 판정과 블록 콘텐츠 품질 판정은 이 코드 감사 결과로 대신하지 않는다.

기존 부채의 우선순위는 편집기 변환·렌더링·상태 조율 분리, PHP 컴파일러의 블록 렌더러 분리, CSS 의미 토큰 전환 순이다. 단순히 파일을 잘게 나누거나 기존 부채를 예외 목록에 추가하는 것으로 해소 처리하지 않는다.

최종 제품 소스 정적 감사는 223개 파일에서 **새 차단 위반 0개, 등록된 기존 부채 1,079건, 해소됐지만 장부에 남은 지문 0개**를 확인했다. 이는 실행 오류 1,079개라는 뜻이 아니라 정적 규칙의 진단 건수다.

| 기존 부채 | 건수 |
| --- | ---: |
| CSS 색상 직접 지정 | 908 |
| CSS `!important` | 135 |
| CSS 선택자 우선순위 | 16 |
| TypeScript 우회 단언 | 9 |
| 소스 크기 초과 | 11개 진단 / 8개 파일 |

대표 대형 파일은 `PuckEditorAdapter.tsx` 2,728 비어 있지 않은 줄, `HtmlDocumentCompiler.php` 2,504줄, 편집기 CSS 2,405줄이다. 이번 결함 수정과 별도로 책임 분리·타입 경계·테마 토큰 전환을 계속해야 한다. 따라서 판정은 **재현된 코드 결함 개선이며, 설계 부채 해소 완료나 상용 준비 완료가 아니다.**
