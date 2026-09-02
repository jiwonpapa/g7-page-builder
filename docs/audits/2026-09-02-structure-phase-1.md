# 1차 타입·문서 경계 개선 기록

[전체 차수와 완료 조건](2026-09-02-structure-remediation-phases.md). **1차 전체(1-A/1-B/1-C/1-D1/1-D2/1-D3)의 코드 개선·관련 검증·재감사를 완료했다.** 기준 SHA는 `0a6fcbae69ad0c0ad93aea145c8899c4b001ecfb`, 최종 제품 검증 SHA는 `38ec067ed6dbb68c3ac09ce4c8572f1ec6524edc`다.

- 우회 단언 9→0, 문서/API/기본 블록/공통 표현/레이아웃 계약의 실제 소유권 분리.
- 정적 재감사 232파일: 신규 위반 0, 기존 부채 1,079→1,069. `types.ts` 크기 예외 제거.
- 전체 프런트 TS/TSX 68모듈: 정적 런타임 순환 0, 문서 계층 역참조 0.
- 마지막 단위는 Unit 374개와 실제 브라우저 6개 통과. 이전 단위의 실제 검사·실패 보완은 아래에 별도 기록했다.

이 결과는 1차 코드 정비의 완료다. 2~6차, 기존 블록 콘텐츠 품질 평가, 운영 배포와 데이터 이행, Visual UI Editor 기능 전체 완성은 포함하지 않는다. 문서 통합과 `NO_RELEASE` 정식 종료 결과는 아래 마감 증거 경로에 별도로 보존한다.

## 1-A — 입력 검증과 명시 타입 구성

### 구현

- `normalizeCanvasRangeAnchor`는 외부 입력의 객체 여부와 6개 유한 숫자를 확인한 뒤 명시 좌표 객체를 만든다. 배열·NaN·무한대 등 부적합 입력과 기존 기하 조건을 거부한다.
- `mergeBlockContainerAppearance`는 알려진 속성별로 값을 좁혀 타입이 있는 결과를 만든다. 구형 명시 기본값, 요소 스타일, 확장 키, 상속값 생략과 원본 불변을 보존한다. 정규화 과정에서 해당 정보를 지우는 기존 함수를 무조건 재사용하지 않는다.
- 두 우회 단언과 해당 부채 지문만 제거했다. 상한이나 다른 예외를 늘리지 않았다.
- 이 코드의 브라우저 연결은 기존 프리셋 전체 비교에서 합성 문서의 구조·테마 및 실제 글자 편집 시나리오로 좁혔다. 다른 카탈로그/반응형 렌더러의 검사 정책은 유지했다.

| 작업 | 제출 SHA | 통합 SHA |
| --- | --- | --- |
| 차수 기본 계획 | `80a3d3768f3f0ea7e806505a5390d3bf5e5f6070` | `654b236c141d1da57b85b99c9a9fbbd6367c5162` |
| 입력 코드 검사 연결 | `c80ee62fa4b2dfec1b400cb0b276aa2f00d29c2e` | `d3356cc7330174cc5d318ffc662e7b66d91e9d61` |
| 입력 타입 개선 | `675b2fa46d6b73dccfad1037c7cb604f7e3b5372` | `066bf8e2f61bd076784ed38103c217bf438e86f7` |
| 입력 helper 소유 검사 연결 | `76010f40e4ccc3e0945dcf8c1c785515e48f671e` | `cabdb0a21ff10685567f369d1dae1c699b437e27` |
| 실제 입력 준비 절차 공통화 | `f46f446876a2f66ed8c9a6f60718cb87227b0fb5` | `41a8ada28dd518d0353b4142569d9fc5a259314f` |
| 실제 입력 준비 순서 보완 | `9e60ad9dbb00ff4512afdae52ff29a19c227f2d3` | `a2836a4199cad1147f2c5d3bd5182cb2d3539001` |

직접 입력 경계 단위 검사 2파일 45개와 제출 시 관련 단위 검사 16파일 181개가 통과했다. 제출에서는 19개 gate가 통과했고 runtime gate 4개는 연기했으므로 제출만으로 제품 검증을 통과했다고 보지 않는다. 정적 진단은 1,079→1,077, 우회 단언은 9→7이며, 정적 오류·이미 해소했으나 남겨 둔 예외는 0이다.

### 최초 통합 검증 실패와 보완

통합 단계의 실제 브라우저 5개는 통과했으나, 후속 `integration-verify`에서는 구조·테마 3개 중 중첩 편집 1개가 실패했다. 입력 후 열을 추가했을 때 제목이 원래 값으로 보였다. 이 실패를 통과 기록으로 덮지 않는다.

실패한 검사는 Puck의 임시 `contenteditable` 영역과 실제 ProseMirror 입력기를 구별하지 않고 `fill()`했다. 실제 입력기 로딩 전에 DOM 텍스트만 바꾸는 경로가 있어, 제품 상태 반영을 보장하지 못했다. 기존 lifecycle 시나리오의 입력기 준비·실제 포인터 활성화·키보드 전체 선택·전체 문자열 확인 절차를 공통 helper로 추출한다. 구조 시나리오의 삽입 후 제목·형제·슬롯 검사와 timeout은 유지하고, 강제 상태 주입·저장 완료 대기로 실패를 가리지 않는다.

보완 작업은 타입 검사와 두 spec의 데스크톱 6개 수집을 거쳐 정식 제출·통합했다. 새 support 파일을 소유 시나리오에 연결하는 하네스 누락도 정확한 두 spec 매핑으로 보완했다. 미등록 support 경로 거부와 제품 변경 시 runtime 검사 의무를 유지했다. 매핑 제출은 Python 106개와 구조 검사 24개를 포함한 8개 gate를 통과했고, 통합에서는 동일 입력의 성공 결과를 재사용했다.

원래 입력 보완 worktree는 `task-replace-active`로 SHA·index·dirty 파일·증거를 보존한 채 새 기준으로 이관했다. 정식 helper 통합은 검사 수집만 수행한 것이다.

두 번째 실제 검증에서는 입력 전 `scrollIntoViewIfNeeded`가 임시 DOM 교체와 겹쳐 `Element is not attached to the DOM`으로 실패했다. 기존 공통 helper도 준비 확인 전에 스크롤을 수행하는 순서 문제가 있었다. Puck vendor에서 hover 없이 실제 입력기가 마운트됨을 확인하고 ProseMirror 준비 확인을 첫 DOM 동작 앞으로 옮겼다. 이 보완도 정식 제출·통합했다. 두 번째 실패 로그 역시 보존했다.

### 최종 확인 — 1-A 완료

`a2836a4199cad1147f2c5d3bd5182cb2d3539001`에서 `integration-verify`가 통과했다. 정확한 변경 14파일에 대해 34개 gate 중 13개를 실행하고 동일 입력의 성공 21개를 재사용했다. 실패·연기 gate는 0이다.

실제 데스크톱 브라우저 결과는 다음과 같다. 모두 `retries=0`, skip·unexpected·flaky 0이며 수집 결과와 구분한다.

| 시나리오 | 실제 통과 |
| --- | ---: |
| 테마 상속·중첩 편집/삽입·불투명 모달 | 3 |
| 문서 저장/발행/복원·템플릿 출력·중첩 3열 저장/재로드/발행 | 3 |
| 실제 포인터로 도구 접근·리치텍스트 편집/저장/발행 | 2 |
| 합계 | 8 |

최초 실패 로그와 성공했던 제출·통합 로그는 다음 디렉터리에 SHA-256과 함께 보존했다.

`/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/structure-remediation`

## 1-B — Puck 선택·슬롯·필드 경계

**1-B 완료.** 1-A 검증 SHA `a2836a4199cad1147f2c5d3bd5182cb2d3539001`에서 정확 16파일을 소유한 `structure-1b-puck-types-20260902`로 구현했다.

- 선택 항목을 넓은 `string + Record`로 바꾸지 않고 실제 Puck component union으로 유지한다. 열 조작은 ID가 있는 LayoutColumns props를 받아 같은 타입으로 돌려준다. 기본 Slot에서만 ID 생성을 Puck에 맡긴다.
- `puckLayoutData.ts`가 Section/Columns/Stack의 알려진 slot을 읽는다. 문서 metadata 수집과 구조 조작이 같은 판별을 사용한다. 열 비율은 기존 도메인 계약과 정책을 재사용한다.
- 문서 envelope는 항목·props만 얕게 복사한다. 변환기 원본을 변경하거나 중첩 참조/함수 metadata를 불필요한 깊은 복사로 손상시키지 않는다.
- `blockInspectorFields.tsx`는 공통 설정 field 조합·필수 label·선택 입력을 소유한다. component별 props 타입과 render/resolver/defaultProps 참조, Layout 설정을 유지한다. DOM에서 주어진 값도 현재 선택 옵션에 있는 값을 찾아 전달한다.
- 새 두 모듈에는 PAGE 또는 NESTED/STRUCTURE_THEME의 정확한 코드 검사를 연결한다. preset/Page Kit 전수 선택으로 확대하지 않는다.

독립 코드 리뷰에서는 설정 기본값·읽기 전용 처리·옵션·함수 참조의 확정 회귀가 발견되지 않았다. 실제 Puck의 열 합치기와 Undo 이후 canonical 원문서의 전체 일치를 단위 회귀로 확인했다. Puck이 비활성 slot을 빈 배열로 정규화하는 동작은 유지하되 원본 저장 계약으로 되돌린 전체 문서는 정확히 같아야 한다.

| 작업 | 제출 SHA | 통합 SHA |
| --- | --- | --- |
| Puck 타입·필드 경계 | `f73f3434b10041c59f532463de9020fa6f83ece6` | `b4fb157b4ce591db5cadf96c1be3a26a618e9ad9` |

정식 제출은 32개 gate 중 26개가 통과했고 runtime 6개는 통합으로 연기했다. 관련 Vitest 15파일 151개와 Harness 136개가 통과했다. 제출 stdout을 파일로 남기기 위한 재실행은 하지 않았으며, 정식 제출 이력과 통합 검사의 동일 입력 재사용 기록을 보존한다.

통합에서는 32개 gate 중 8개를 실행하고 24개 성공 결과를 재사용했다. 실제 브라우저 8개(문서 경계 2, 글자 편집 1, 구조·테마 3, 문서/중첩 발행 흐름 2)가 통과했다. 모두 skip·unexpected·flaky 0이다.

`b4fb157b4ce591db5cadf96c1be3a26a618e9ad9`의 `integration-verify`도 통과했다. 검증 범위는 이미 완료한 1-A SHA 이후 16파일이며, 전체 초기 감사 범위로 확대하지 않았다. 32개 gate 중 8개 실행·24개 성공 재사용, 실패·연기 0이다. 동적 브라우저 검사는 이 단계에서도 실제 8개가 통과했다. 단계별 실행을 합산해 서로 다른 16개 시나리오를 검증했다고 보고하지 않는다.

정적 검사는 225파일, 기존 부채 1,071건, 신규 위반 0, 해소했으나 남은 예외 0이다. 1-B에서 우회 단언 6개를 제거해 전체 9→1개가 됐다. PuckEditorAdapter는 실제 비어 있지 않은 줄 2,728→2,645, AST 19,924→19,349로 줄었고 허용 상한도 낮췄다. 아직 큰 파일 기준 아래로 내려가지 않았으므로 크기 예외를 해소했다고 계산하지 않는다.

## 1-A/1-B 완료 당시 남았던 범위

- **1-C:** 외부 Block Pack codec의 우회 단언 1개와 실제 등록 타입 경계.
- **1-D1~D3:** API DTO, 기본 블록 계약, 공통 표현/구조 계약 소유권 분리.

배포·운영 데이터 변경·기존 블록 콘텐츠 품질 검사는 수행하지 않았다. 이후 차수는 앞 단위의 통합 검증이 통과한 뒤 순서대로 진행한다.

### 1-C 사전 확인에서 발견한 보존 경계

문서/프리셋 schema는 외부 props를 일반 객체로 받고, 서버의 BlockSchemaRegistry는 pack validator에 원본 속성을 넘긴다. 모듈 문서에는 `id`, `motion`, `containerWidth`, `responsiveOverrides`, `__g7pb*`를 외부 데이터에서 임의로 덮거나 삭제해도 된다는 규정이 없다. 반면 당시 편집기 변환은 원본 props와 Puck ID·공통 스타일·내부 metadata를 같은 평면에 섞었다. 이는 이름에 접두사만 붙여서 해결되는 문제가 아니다.

외부 payload 분리와 ComponentConfig adapter를 먼저 정의해야 한다. 특히 초기 문서 context에만 원값을 보관하면 신규 삽입·복제·Undo 보존을 보장할 수 없으므로 편집 항목과 함께 이동하는 경계가 필요하다. 이 확인은 당시 코드 계약 감사이며 운영 문서나 기존 콘텐츠를 검사·변환한 결과가 아니다. 이후의 실제 구현과 완료 결과는 아래 1-C 기록에 구분한다.

## 이전 실행 범위 종료 — 1-A/1-B 당시 기록

이전 실행은 1-A와 1-B의 제품 변경·하네스 연결·필수 검증까지만 완료했다. 당시에는 1-C/1-D와 2~6차가 남아 있었다. 결과 문서를 `5865fb59f2ccdf79974d8105b9d1c73948fc435f`로 통합한 뒤 `integration-verify`로 문서 delta를 확인하고 `integration-finish NO_RELEASE=1`로 이전 통합 소유권을 종료했다. 배포나 운영 검증 성공을 의미하지 않는다. 아래 기록은 이번에 이어서 완료하는 1-C/1-D와 1차 전체 마감 증거다.


## 1-C/1-D 선행 보완 — 타입 가정과 검사 선택

두 기존 테스트에서 외부 타입이 추가되면 잘못된 가정이 드러났다. motion fixture는 Hero임을 판별한 뒤 속성을 읽고, Puck 설정 합성은 `Config<EditorComponents, PageDesignProps>`로 명시한다. 기존 값·행동 기대를 약화하지 않았다. Unit 34개+28개와 strict 타입 검사가 통과했다. 최초 제출은 새 worktree의 Node 의존 경로가 없어 실행하지 못했으며, 의존 경로 연결 후 정상 실행했다.

타입 경로 이동만으로 기존 콘텐츠/프리셋 검사를 확장하지 않도록 별도 하네스 4파일을 보완했다. TypeScript AST에서 type-only import/export만 제거해 나머지 구문이 동일한 기존 소비 파일만 브라우저 선택에서 제외한다. Unit·타입·계층 검사는 원래 변경 목록을 사용한다. 새 파일·도메인 파일·파싱 실패·값 import·JSX·실행 본문 변경은 기존 매핑을 유지한다. 혼합 import의 type 항목만 남는 경우도 module 경로를 보존해 `verbatimModuleSyntax`의 side effect를 무시하지 않는다.

독립 리뷰에서 `@__PURE__` 주석의 위치 이동과 TypeScript 버전의 캐시 입력 누락을 발견했다. 최초 제출 `9e478f0`은 정식 replacement로 보존하고, 주석의 실제 구문상 위치 비교 및 `package-lock.json` 캐시 입력/회귀를 추가했다. 회귀 4개와 관련 Harness 검사에 통과했다. 이는 브라우저 검사 선택기의 검증이며 제품 브라우저 실행으로 계산하지 않는다.

| 작업 | 제출 SHA | 통합 SHA |
| --- | --- | --- |
| 기존 Puck 테스트의 타입 가정 | `a6bc220ece8d18a84a95fea8f5a62fbc7bbba695` | `6a0bbd19e30904414054fc884bd3b987fe5bf9fe` |
| 타입 import 변경의 검사 선택 v2 | `1240442552fc31d8449ff04a6eeb416ab9675d19` | `dd41045d5dc9b61fc88a6406a00f05dd691773ba` |

`dd41045` 통합 검증은 6파일/14 gate, 1개 실행·13개 성공 재사용, 실패·연기 0이다. 이후 1-C active task는 원본 dirty 파일·index·SHA를 보존하는 정식 replacement로 이 검증 기준을 상속했다.


## 1-C — 외부 Block Pack 데이터 경계

외부 등록 이름과 canonical 블록 ID는 그대로 두고, 편집기 내부에서는 `External_${string}` 이름 및 별도 payload를 사용한다. 기본 블록 union의 정확도를 유지하고 마지막 우회 단언을 제거했다. 외부 payload는 기본 블록의 컨테이너 보강·삭제 경로를 지나지 않는다.

- 원본 props의 `id`, `puck`, `editMode`, `motion`, 컨테이너·반응형·내부 필드와 같은 이름의 값도 보존한다. 렌더에는 Puck의 `id`·`puck`·`editMode`를 전달하고 같은 이름의 원본 값은 payload에 따로 남긴다. resolver data에서는 `id`만 Puck 식별자로 전달하며 나머지 payload 값은 보존한다.
- ComponentConfig의 기본값·object field·render·세 resolver를 명시적으로 연결한다. 기존 문서에서 빠진 기본 필드는 표시용으로만 채우고, 값이 그대로이면 원본 JSON의 키 생략을 유지한다. 실제 편집값은 저장한다.
- 원본의 motion/visibility/responsive와 빈 slot 이름·존재 여부도 항목 metadata에 보관한다. 초기 context에만 보관하지 않아 복제·Undo·신규 삽입을 따라 이동한다. 전체 효과 적용·해제와 표시 대상 버튼도 해당 저장 위치를 갱신한다.
- resolver가 보는 공개 이름·flat props·changed·readOnly·appState의 항목을 변환한다. 일반 JSON 안에 편집기 항목과 같은 모양이나 문자열 `$$typeof`가 있어도 데이터로 보존한다. 콜백의 일반 JSON 수정은 원본으로 새지 않는다.

독립 리뷰에서 누락 기본값, resolver의 ID와 appState, 깊은 복사, 일반 JSON 오해석, React marker 오인에 따른 참조 누출을 확인해 보완했다. 마지막 순수 probe는 구조 보존·원본 불변·콜백 복사 경계를 확인했으며, 이를 제품 브라우저 실행 결과와 혼동하지 않는다.

직접 합성 회귀 12개가 통과했다. 실제 Puck을 마운트해 누락된 contentEditable 기본값 표시, 정확한 전체 원문서 왕복, 실제 field 수정, native duplicate→raw id 수정→Undo→Redo→insert, 헤더의 효과 적용·해제를 확인했다. `toMatchObject`만으로 추가 속성 오염을 놓치지 않도록 전체 동등성을 검사한다.

정식 제출은 `structure-1c-external-v2-20260902`, SHA `2d888447f1e60e912acd9eef3bd7dffbac0f6c3b`다. 24 gate 중 18개 통과(관련 Vitest 137개), runtime 6개는 Local 통합으로 연기했다. Puck Adapter는 비어 있지 않은 2,645→2,635줄/AST 19,349→19,295, codec은 556→547줄로 줄었다. 새 예외나 상한 증가는 없다.

외부 팩의 v2 중첩 지원은 기존 layout policy가 허용하지 않는다. 이번에 v1 외부 데이터 보존과 편집기 연동을 검증했으며, 외부 중첩 지원·제품 기능 완성으로 확대해 보고하지 않는다.

### 1-C 최종 확인

통합 및 제품 검증 SHA는 `4ad854a41f55636ecd929248d84834da6b879b70`다. 통합·최종 확인에서 실제 브라우저 7개(문서 경계 2, 글자 편집 1, 구조·테마 3, 저장/발행/복원 흐름 1)가 각각 통과했다. 서로 다른 14개 검사를 수행했다고 합산하지 않는다. skip·unexpected·flaky·retry는 0이다.

최종 확인은 13파일/24 gate, 8개 실행·16개 성공 재사용, 실패·연기 0이다. 정적 결과는 228파일/기존 부채 1,070건/신규 위반 0/남겨 둔 해소 예외 0이며 TS-UNSAFE는 전체 시작 9→0이다. 1-C 완료 후에 1-D1 구현을 시작했다.


## 1-D1 — API 응답 계약 소유권

응답 DTO 24개/184줄을 `resources/js/api/resources.ts`로 옮기고 소비 코드 21파일을 연결했다. 문서 도메인은 API 타입을 다시 export하거나 import하지 않는다. API 클라이언트는 Manager·Puck에서 필요한 응답 타입 5개만 명시적으로 재수출하며 실제 정의를 소유하지 않는다. store 타입은 응답 정의에 직접 연결해 API 클라이언트를 역참조하지 않는다.

독립 대조에서 DTO 24개의 선택 필드·null·union·schema literal을 포함한 AST와 소비자 21개의 실행 본문이 같았다. TS/TSX 146개에서 이동 DTO의 옛 경로 참조와 도메인→API 역참조가 0이었다. 카탈로그나 콘텐츠를 변경하지 않았다.

`types.ts`는 910→726줄로 줄어 크기 예외를 제거했다. Puck Adapter는 2,634줄/AST 19,295로 상한을 낮췄다. Manager의 1,597줄/AST 11,987 상한은 유지했다. 작은 타입 이동을 위해 카탈로그나 Manager의 실행 코드를 고치지 않았다.

정식 제출 SHA `d113e5562e25a37d3f1d72595d86a9876728ff7f`는 42개 gate 중 39개 통과, runtime 3개 연기다. 관련 Unit 36파일/364개, 구조 회귀 24개, strict 타입과 정적 검사가 통과했다. 정적 결과는 229파일/부채 1,069건/신규 위반 0/남겨 둔 해소 예외 0이다. 브라우저는 PAGE 합성 흐름 하나만 선택하고 store·프리셋·parity로 확대하지 않았다.

### 1-D1 최종 확인

통합·검증 SHA는 `ca5004ac7e4d99811393cdab76a259af7d8a212d`다. 통합과 최종 확인에서 저장·발행·복원·발행 해제 브라우저 1개가 각각 통과했고 skip·unexpected·flaky·retry 0이다. 최종 확인은 24파일/42 gate, 7개 실행·35개 성공 재사용, 실패·연기 0이다. 이후 1-D2 구현을 시작했다.


## 1-D2 — 기본 블록 계약 소유권

기본 블록 식별자 45개, Props/Item 및 구체 블록 타입, 기존 판별 함수를 포함한 선언 124개를 `documents/builtinBlockContracts.ts`로 옮겼다. 실제 정의의 소유자를 바꾸고 codec·Puck 타입·API의 직접 소비를 연결했다. 카탈로그 6파일은 기존 도메인 진입점을 유지하므로 상한 증가나 관련 없는 렌더 변경이 없다.

독립 AST 대조에서 124개 선언과 나머지 원본 도메인 선언이 같았다. 값 49개·타입 75개의 호환 재수출에 누락·추가가 없고 소비자 실행 본문도 동일했다. `builtinBlockContracts.ts`가 범용 노드를 조합할 때는 `import type`을 사용하므로 호환 재수출과 런타임 순환을 만들지 않는다. 이 단계의 실제 emitted JS 모듈 66개/로컬 참조 163개에서 런타임 순환은 0이었다.

새 합성 계약 검사 7개는 모든 기본 ID, 기존/신규 경로의 같은 guard 함수 참조, 판별의 true/false와 입력 불변, 구체 타입 narrowing 및 생략된 선택 속성을 확인한다. 기존 codec 회귀 34개와 함께 직접 41개를 확인했다. 최초 새 fixture의 타입 검사는 Props를 넓은 Record 교차 타입에 대입한 표기 때문에 실패했다. 단언을 추가하지 않고 `satisfies`로 좁은 실제 값을 유지해 수정했으며 최초 실패와 성공 로그를 모두 보존했다.

정식 제출 `structure-1d2-block-contracts-20260902`의 SHA는 `251721ee3ad34593d05f57cf47fa61e38d1044dd`다. 정확 7파일/43 gate 중 39개 통과, runtime 4개는 Local 통합으로 연기했다. 관련 Unit 37파일/371개, strict 타입과 구조 검사가 통과했다. `types.ts`는 비어 있지 않은 726→258줄, 새 실제 계약 파일은 598줄로 제한 이내다.

### 1-D2 최종 확인

통합·검증 SHA는 `1d674e5ed59ca76a9ff93ec522cfe734853b3aa0`다. 통합과 최종 확인에서 실제 글자 편집 1개·구조/테마/모달 3개·저장/발행/복원 흐름 1개, 합계 5개가 각각 통과했다. skip·unexpected·flaky 0이다. 최종 확인은 7파일/43 gate 중 8개 실행·35개 성공 재사용, 실패·연기 0이다. 이후에 1-D3 구현을 시작했다.


## 1-D3 — 공통 표현·레이아웃 계약 소유권

공통 외형·요소 스타일·반응형·동작 타입 9개를 `documents/blockPresentation.ts`, 레이아웃 ID 3개와 Props 3개를 `documents/layoutContracts.ts`로 옮겼다. 외형·동작·반응형·레이아웃 소비자는 해당 실제 소유자를 참조한다. `types.ts`는 Page/Site Part 원본 문서와 범용 블록·링크·가시성의 실선언 및 기존 도메인 진입점의 호환성을 담당한다.

독립 대조에서 이동 선언 15개, 남은 도메인 선언, 소비자 9개 실행 본문이 모두 같았다. 타입을 조합하는 참조는 `import type`으로 표시하고 값 재수출은 레이아웃 상수 3개만 사용한다. 값/타입 호환 재수출에 누락·추가가 없었다. 기존 카탈로그 6파일과 Puck/Manager는 수정하지 않았으며, `layoutCatalogBlocks.tsx`는 타입 import만 변경했다.

관련 합성 검사 2파일/26개와 strict 타입 검사가 최초 실행부터 통과했다. 기존 별칭과 ID, 기본 열 수 1/2/3과 반응형 열 수 1/2의 구분, 구형 요소 크기, 동작 간격, null 토큰, 생략된 override, `global` 셸 값 및 Page/Site Part JSON 형식을 확인했다. `CHANGELOG.md`에는 1-D 전체의 계약 분리와 저장 형식 호환을 기록했다.

후보의 비어 있지 않은 줄/AST는 `types.ts` 204/560, `builtinBlockContracts.ts` 599, `blockPresentation.ts` 54/377, `layoutContracts.ts` 15/100이다. 기존 큰 파일의 상한을 늘리거나 새 예외를 추가하지 않았다.

정식 제출 `structure-1d3-presentation-contracts-20260902`의 SHA는 `8e763bf72e0cfeee5a55b6ccbe364fa0df08f668`다. 정확 14파일/43 gate 중 39개 통과, runtime 4개는 Local 통합으로 연기했다. 관련 Unit 37파일/374개와 strict 타입 검사가 통과했으며 직접 변경된 제품 11파일의 구조 위반은 0이었다. 제출 결과를 실제 브라우저 검증으로 대신하지 않는다.

### 1-D3 최종 확인

통합·제품 검증 SHA는 `38ec067ed6dbb68c3ac09ce4c8572f1ec6524edc`다. 통합과 최종 확인에서 글자 편집 1개, 구조·테마·모달 3개, 저장·발행·복원 흐름과 중첩 3열 저장·재열기·발행 2개로 실제 브라우저 6개가 각각 통과했다. skip·unexpected·flaky 0이며 두 단계 결과를 12개 서로 다른 시나리오로 합산하지 않는다.

최종 확인은 직전 1-D2 검증 SHA 이후 정확 14파일/43 gate, 8개 실행·35개 성공 재사용, 실패·연기 0이다. 이로써 1차의 1-A/1-B/1-C/1-D1/1-D2/1-D3 제품 구현과 관련 검증을 모두 완료했다.


## 1차 최종 재감사와 마감

최종 제품 검증 SHA에서 `node scripts/check-design-architecture.mjs --json`을 한 번 실행해 전체 제품 소스 232파일을 다시 검사했다. 신규 위반과 이미 해소했으나 남겨 둔 예외는 각각 0이다. 다음은 같은 규칙에 따른 전후 진단 수이며 실행 오류 개수가 아니다.

| 규칙 | 시작 | 최종 |
| --- | ---: | ---: |
| TS 우회 단언 | 9 | 0 |
| 크기 초과 진단 / 파일 | 11 / 8 | 10 / 7 |
| CSS 색 리터럴 | 908 | 908 |
| CSS important | 135 | 135 |
| CSS selector 우선순위 | 16 | 16 |
| 기존 부채 합계 | 1,079 | 1,069 |

`types.ts`는 910→204줄이며 새 API 응답 186줄·기본 블록 599줄·표현 54줄·레이아웃 15줄 파일이 정의를 실제로 소유한다. 기존 도메인 진입점의 재수출 때문에 프로젝트 전체 줄 수가 같은 양만큼 줄었다는 뜻은 아니다. Puck Adapter는 2,728→2,634줄로 줄었지만 아직 크기 제한을 넘으므로 해소 파일로 계산하지 않는다. 남은 큰 파일 7개와 스타일 부채는 2~5차 대상이다.

별도 정적 감사는 Git snapshot의 `resources/js` 전체 TS/TSX를 대상으로 했다. 시작 59모듈/실행 참조 선언 147개, 최종 68모듈/참조 선언 164개(중복을 제외한 모듈 간 연결 162개)이며 TypeScript 5.9.3의 실제 JS emit에서 type-only 의존을 제거한 정적 ESM 그래프에 순환은 전후 모두 0이다. 새 모듈 9개의 순환 참여와 새 순환 참조도 0이며, 문서 계층의 타입 참조를 포함한 역방향 의존도 0이다. 파싱/emit 누락·미해결 정적 로컬 참조도 없었다.

이 그래프는 entrypoint 도달 범위만 검사한 것이 아니며 타입 전용 파일도 모두 노드에 포함한다. 외부 package·CSS/JSON·동적 import는 정적 ESM 순환 판정에서 제외한다. 기존 literal dynamic import 2개는 모두 외부 Puck 모듈이며 별도 목록에 남겼다. Vite plugin의 생성 import·eval·실행 시 script 주입까지 검증한 결과로 확대하지 않는다. 실제 타입 검사와 브라우저 결과는 위의 정식 gate 증거를 사용한다.

마감 과정의 보고서 독립 검토에서는 외부 resolver에 대한 설명 한 곳을 수정했다. 렌더와 달리 resolver data에서는 `id`만 Puck 식별자로 바꾸며 `puck`·`editMode`를 포함한 나머지 payload는 보존한다. 코드·검사 실패를 문구 수정으로 가린 것이 아니라 구현과 보고서의 설명을 일치시킨 수정이다.

최종 증거 디렉터리는 다음과 같다.

`/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/structure-remediation/phase1-close`

- `phase1-final-architecture.json`: 최종 전체 정적 진단 원본.
- `static-runtime-baseline-0a6fcbae.json`, `static-runtime-final-38ec067e.json`: 전후 소스 지문·정적 그래프·한계.
- `phase1-source-evidence.json`: 기준 대비 변경 65파일의 지문과 최종 파일 크기.
- `1c-*`, `1d1-*`, `1d2-*`, `1d3-*`: 단계별 실제 브라우저 원본 결과와 실행 gate 기록.
- `phase1-completion.json`, `phase1-evidence-manifest.json`: 제품 검증 SHA와 문서만 변경된 마지막 SHA를 구분한 정식 종료 영수증 및 증거 SHA-256 목록.

마감은 결과 문서 2파일을 정식 제출·통합하고 문서 delta의 `integration-verify`를 거친 뒤 `integration-finish TASK=structure-phase1-complete-integration-20260902 NO_RELEASE=1`로 종료한다. release 검증 SHA를 승격하거나 배포 성공을 주장하지 않는다. 다른 작업의 활성 worktree·소유권과 보존 replacement·실패 증거는 그대로 유지한다.
