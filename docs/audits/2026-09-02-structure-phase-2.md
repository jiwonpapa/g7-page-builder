# 2차 편집기 조율 개선 기록

[전체 차수와 완료 조건](2026-09-02-structure-remediation-phases.md). **2-A~D 코드·필수 검증·재감사를 완료했다.** 2026-09-02 착수, 2026-09-03 마감 기준이다. 시작 SHA는 `e9a3afb1d18b87e50c5abffc00fc80294764c96d`, 최종 제품 검증 SHA는 `d59bbc07482e878c179ab784a0e301c4c7c5a1e3`다. 문서 통합과 `NO_RELEASE` 정식 종료 영수증은 아래 마감 증거에 별도로 보존한다.

## 범위와 마감 조건

`PuckEditorAdapter.tsx`와 `richTextEditing.tsx`의 책임을 분리한다. 설정·렌더·명령·상태·외부 조회·도구의 소유권이 실제로 나뉘어야 한다. 단순 파일 이동, 거대 파일의 이름 변경, 예외의 새 파일 이전으로 완료 처리하지 않는다.

Puck 기본 히스토리/slot/React 함수 식별자, iframe 포커스, 실제 포인터 편집, 중첩 구조 삽입·삭제, Undo, 문서 경계의 복구와 저장 중 입력 보존을 관련 검사로 확인한다. 모든 단위의 통합 검증, 같은 기준의 정적 재감사, 해소된 예외 제거, 감사 기록 및 `NO_RELEASE` 소유권 종료까지가 2차 마감이다.

기존 블록의 문구·이미지·프리셋 상품성 평가는 범위에 없다. 관련 코드 검사에서 사용하는 fixture와 기대 렌더 값은 콘텐츠 품질 승인으로 취급하지 않는다. 운영 배포·운영 데이터 이행·Visual UI Editor 전체 기능의 상용성 평가는 별도다.

## 변경 전 기준선

| 항목 | 변경 전 |
| --- | ---: |
| Puck Adapter 비공백 줄 / AST | 2,634 / 19,295 |
| 리치텍스트 비공백 줄 / AST | 901 / 6,792 |
| 제품 소스 검사 파일 | 232 |
| 정적 부채 | 1,069 |
| 크기 초과 진단 / 실제 파일 | 10 / 7 |
| TS 우회 단언 / 신규 위반 / 남겨 둔 해소 예외 | 0 / 0 / 0 |
| TS/TSX 정적 runtime 모듈 / 내부 참조 | 68 / 164 |
| runtime 순환 / documents 계층 역참조 / 미해결 local 참조 | 0 / 0 / 0 |

크기 기준은 TS/TSX의 비공백 800줄 및 AST 10,000이다. 정적 부채는 실행 오류 개수가 아니다. CSS 색 908·important 135·specificity 16은 이번 책임 분리에서 해소했다고 계산하지 않는다.

## 선행 하네스 보완

새 설정/렌더 소유자 5파일을 실제 역할에 맞는 코드 브라우저 검사에 연결한다. 기존 Adapter의 문서 경계 검사와 기존 카탈로그 정책은 유지한다. 하네스 검증과 제품 브라우저 실행을 구분한다.

기준 코드의 `check-editor-acceptance-contract.mjs`는 이전 `updateCanonical` 함수 및 `viewportPolicy.canEdit`만을 찾는 두 검사에서 이미 실패했다. 현재의 `PuckDocumentBoundary` 및 `!editingDisabled`는 복구 중 입력 차단까지 담당한다. 이 최초 실패 로그를 보존하고 현재 보호 동작과 실제 코드 소유자를 검사하도록 보완했다.

`editorSourceGraph.mjs`는 TypeScript AST의 실제 runtime import/re-export와 바인딩을 따라 도달 가능한 선언의 소유자를 찾는다. 주석·문자열·사용하지 않는 import·도달하지 않는 지역 선언을 보호 동작의 증거로 사용하지 않는다. 권한은 실제 Puck permissions에 연결된 `editingDisabled` 바인딩, 문서 보호는 reject-before-write·native action/history·복구 경로를 검사한다. parity 검사도 Hero/LogoCloud/Notice의 실제 선언을 검사한다. 입력 파일·tsconfig·검사기 의존성은 범위 선택과 성공 캐시에 포함했다.

하네스 작업은 제출 `3407f61d3333f6cac6d100c490b7575c558bc07a`, 통합·최종 검증 `47876afaa0acfd7e02c322bf86bf31106b957972`다. 제출 16개 통과, 통합 8개 실행·8개 재사용, 최종 확인 16개 재사용이며 실패·연기 0이다. 관련 Python 127개와 architecture 24개, syntax 8개가 포함된다. 제품 브라우저 실행은 이 하네스 변경의 증거로 계산하지 않는다. 최초 관련 Python 53개 중 fixture 2개 실패도 보존했고 fixture 경로·검사 환경을 수정한 뒤 실패 검사만 재실행했다.

독립 검토에서는 callback receiver를 같은 철자의 다른 객체로 바꾸거나 안전한 객체를 spread 후 덮어쓰는 경우, 타입 참조만으로 선언 소유자를 찾는 경우의 거짓 통과도 발견했다. 실제 6개 약화 fixture로 기존 거짓 통과를 재현한 뒤 hook 반환과 Puck mutation/복구 대상의 동일 바인딩을 검사하고 타입 노드를 runtime 도달성에서 제외했다. 정상 alias·소유자 이동·내부 Session 경로는 계속 통과한다. 이는 검사기 결함이며 제품에 해당 우회 코드가 있었다는 뜻은 아니다.

원 제출 `5177d8a47b889fdb3f1ac83cee93651119456fd9`의 import alias fixture는 2-B가 바꾼 한 줄 import와 충돌했다. 통합 전에 독립 읽기 검토로 확인하고 공식 `task-replace-submitted`로 원본을 `superseded` 보존했다. 교체 제출 `94f529a1221870734c018eef4a94bfd6a9ad1416`은 AST import 위치를 사용하며, macOS 임시 경로의 realpath 불일치도 fixture에서 정규화했다. 원본과 교체본 최초 실패 로그를 모두 보존했다. 교체본은 통합·최종 검증 `ef83bad88c92bd46d1282aa72b219e0270ba71f3`에서 5개 gate를 마쳤다. editor 계약 17개·planner 40개·구문 검사가 통과했고 브라우저 실행은 없다.

## 실행 단위

| 단위 | 상태 | 책임과 필수 증거 |
| --- | --- | --- |
| 2-A | 완료 | 설정·기본 preview·캔버스·context. 통합·최종 확인에서 각각 실제 브라우저 9개 통과 |
| 2-B | 완료 | 도구·명령 소유권, 범위 밖 컬렉션 index 거부. 통합·최종 확인에서 각각 실제 브라우저 8개 통과 |
| 2-C | 완료 | 세션·viewport·선택 이벤트·API와 배치 차단 보완. 최종 실제 브라우저 8개 통과 |
| 2-D | 완료 | 리치텍스트 모델·선택·명령·메뉴. 통합·최종 확인에서 각각 실제 브라우저 2개 통과 |
| 재감사 | 완료 | 255파일/신규 위반 0, 크기 초과 10→7건, 순환·문서 역참조 0 |
| 정식 종료 | 마감 영수증 참조 | 문서 통합·검증 및 NO_RELEASE. 제품 검증 SHA와 문서 마감 SHA를 구분 |

## 2-A — 설정과 렌더 소유권

`puckEditorConfig.tsx`가 설정·필드 생성과 기본값, `puckBuiltinPreviews.tsx`가 기본 블록의 표시, `previewContent.ts`가 preview 입력의 기존 정규화, `FullSiteCanvas.tsx`가 shell/locale/Header/Footer 캔버스, `puckEditorContexts.ts`가 편집 정책/선택 도구 context와 typed Puck hook을 소유한다. 본체의 기존 설정·sanitizer 진입점은 새 실제 소유자를 재수출한다. 새 소유자가 본체를 역참조하지 않는다.

이동한 27개 선언은 TypeScript AST를 출력해 기준 코드와 대조했다. 주석·export 한정자를 제외한 선언이 모두 같았다. 별도 제품 회귀에서는 실제 Hero/Features ProseMirror DOM·포커스 유지, 부모 rerender와 다른 필드 변경, CTA 빈 본문의 편집/disabled 표시를 확인했다. 공식 Page Kit JSON 5개의 고정 문구 검사 대신 동일한 14개 renderer/field 경로에 합성 입력을 사용하고 서식 보존도 검사한다.

| 소유자 | 비공백 줄 | AST |
| --- | ---: | ---: |
| PuckEditorAdapter.tsx | 1,755 | 13,718 |
| puckEditorConfig.tsx | 513 | 2,625 |
| puckBuiltinPreviews.tsx | 224 | 1,674 |
| previewContent.ts | 93 | 695 |
| FullSiteCanvas.tsx | 46 | 668 |
| puckEditorContexts.ts | 28 | 178 |

본체 예외 상한은 실제 값으로 낮췄다. 아직 기준 초과이므로 해소 건수에는 포함하지 않는다. 정적 검사 237파일/신규 위반 0, 부채 1,069건이다.

| 작업 | 제출 SHA | 통합 SHA |
| --- | --- | --- |
| 2-A 코드 검사 연결 | `36d2c0cff4a154fd3939773f86f5b602de41cbfe` | `959005a168953cb11c8faf60791fcface1e2c356` |
| 2-B/C/D 코드 검사 연결 | `6d191d947e62adb925e8ebc12efc46d0f8eba709` | `89d535c8f8cb07ac2d03f203fbc08102b3cea0bb` |
| 2-A 설정·렌더 분리 | `1293d4df714e6f5b7f7eaed15a1180227decff0a` | `bf33d1af34f97ee28af7aaba8ba4931ef9f2071d` |

제품 제출은 21개 gate 중 15개 통과, runtime 6개 연기다. 관련 Vitest 12파일/113개, architecture 하네스 24개, strict 타입 검사가 통과했다. 통합에서는 9개 gate 실행·12개 성공 재사용, 실패·연기 0이었다. 실제 브라우저는 문서 경계 2·포인터 글자 편집과 도구 접근 2·구조/테마/모달 3·저장/발행과 템플릿 출력 2로 9개 통과했으며 skip·unexpected·flaky 0이다.

선행 2-B/C/D 매핑의 개별 검증은 당시 이미 제출된 2-A가 남아 있어 미통합 task guard가 중지했다. 소유권이나 metadata를 우회하지 않고 2-A를 정식 통합한 뒤 합쳐진 변경을 검증한다.

최종 `integration-verify`는 `bf33d1af34f97ee28af7aaba8ba4931ef9f2071d`에서 통과했다. 직전 검증 기준 `959005a` 이후 매핑과 제품 변경을 함께 검사했으며 실패·연기 0이다. 위 실제 브라우저 9개가 이 단계에서도 통과했고 두 단계 실행을 서로 다른 18개 시나리오로 합산하지 않는다. 이후 2-B 구현을 시작했다.

### 검사에서 드러난 세션 교체 경계

최초 직접 Unit은 30개 중 29개 통과, CTA 조건에서 1개 실패했다. 동일 mount에서 빈 본문을 비어 있지 않은 새 revision으로 교체한 경우의 실패다. CTA context의 표시 회귀는 빈/비어 있지 않은 문서를 각각 독립 mount하고 disabled 전환을 확인해 통과했다. 세션 교체 결함을 이 테스트 변경으로 해결했다고 보지 않는다.

Puck 0.23은 data를 최초 store 생성 입력으로 사용한다. 기존 본체도 revision 변경 때 boundary만 새로 만들고 Puck store는 유지했다. Puck만 key로 교체해도 boundary data/context가 effect까지 이전 값을 유지하므로 충분하지 않다. 2-C에서 canonical 초기화·context·boundary·Puck을 함께 소유한 세션을 문서 ID/명시 revision으로 교체하고, 일반 저장·rerender에서는 유지한다. 폐기한 boundary의 지연 callback 차단과 재활성화 연결도 같은 수명주기 회귀로 확인한다. 현재 운영에서 지연 callback 경합이 관찰됐다는 주장은 아니다.

## 2-B — 도구와 명령 소유권

라이브러리는 검색·정규화 모델, 카탈로그 context, 표시 UI로 나눴다. 헤더·문맥 패널·선택 작업 표시줄은 각각 UI를 소유하고, 표시줄 위치의 observer/RAF는 별도 hook이 관리한다. `canvasItemCommands.ts`가 삽입·preset 적용·이동·속성·컬렉션 변경의 Puck 명령을 만들고, `blockMotionCommands.ts`가 효과 계획과 적용·초기화를 소유한다. 공유 context나 Puck hook을 복제하지 않으며 실제 명령 소유자가 본체를 역참조하지 않는다.

삽입의 native history 뒤에 preset 적용과 선택 이동을 `recordHistory: false`로 연결하고, 기존 ID·zone 및 외부 원본 payload/metadata를 보존한다. 컬렉션 명령은 기존 min/max와 요소 스타일 remap을 유지하면서 정수가 아니거나 범위를 벗어난 index를 거부한다. 기존 UI가 배열 변경 뒤 남은 선택의 유효범위를 보장하지 못했기 때문에 이 검증은 명령 소유자에 둔다.

본체는 1,755→484 비공백 줄, AST 13,718→3,254다. 새 소유자 9개 중 최대는 261줄/AST 2,359이며 두 본체 크기 예외를 제거했다. 246개 제품 파일 검사에서 신규 위반 0, 정적 부채 1,067이다. 독립 읽기 검토는 이전 선언 26개와 session/API의 AST 보존, 실제 연결과 순환 부재를 확인했으며 제품 테스트 실행으로 계산하지 않는다.

제출 SHA는 `85d1d4e671de56a221b1582c1b4edbd1a4863545`다. 제출 gate 23개 중 17개 통과·runtime 6개 연기, 관련 Vitest 14파일/118개·architecture 하네스 24개·strict 타입 검사가 통과했다. 추가 회귀는 실제 Puck에서 검색 input의 DOM/포커스 유지, 중첩 preset 삽입과 Undo, 같은 zone 이동과 Undo, 컬렉션 스타일과 min/max 및 전체 원본 Undo를 확인한다. 순수 명령 경계에서는 외부 payload/metadata 보존을 확인한다.

통합·최종 검증 SHA `2baf7feea6dccdd89fdee84555c9f33b51ad9dc4`에서 실제 브라우저 8개가 각각 통과했다. 문서 경계 2·포인터 편집/도구 접근 2·구조/테마/모달 3·저장/발행/복원 1개이며 skip·unexpected·flaky 0이다. 두 단계의 실행을 16개 별도 시나리오로 합산하지 않는다. 통합은 9개 gate 실행·14개 재사용, 최종 확인도 실패·연기 없이 마쳤다. 이후 2-C 구현을 시작했다.

최초 타입 검사 실패와 합성 fixture 실패를 `2b-submission`에 보존한다. 허용하지 않는 Features 중첩, editor 전용 스타일을 canonical props에 넣은 오류, 기존 복사 동작의 참조 동일성 기대를 수정했다. 원본 전체 Undo 비교는 유지했다. 이 과정에서 기존 `foundationCatalogBlocks.tsx`의 명시 `spacing=normal`→기본 `compact` 변환을 확인했다. 이 파일은 2-B에서 바뀌지 않았으며 [3차 카탈로그 코드 처리 항목](2026-09-02-structure-remediation-phases.md)에 이관했다. 이 기존 결함을 해소했다고 보고하지 않는다.

## 2-C — 세션과 비동기 수명

Adapter는 문서 ID와 명시적 revisionKey를 key로 가진 내부 Session을 연결한다. 초기 canonical 변환·context·문서 boundary·Puck store가 같은 수명 안에서 생성되고 교체된다. 일반 저장 응답·부모 rerender·disabled 전환에서는 Session을 교체하지 않는다. `usePageBuilderSession`은 원본 경계·구조 전환·경고를, `useEditorViewport`는 화면 폭과 편집 정책을, `useCanvasEditingUi`는 선택 이벤트·예약 프레임·표시 상태를, `usePageBuilderResources`는 API 자원과 후속 응답의 유효 수명을 소유한다. runtime 설정 생성은 기존 `puckEditorConfig`로 모았다.

폐기한 boundary의 onChange/onAction/publish/connect/복구 콜백은 변경을 전달하지 않으며 발행은 null을 반환한다. Puck 연결 컴포넌트의 같은 effect에서 활성화와 현재 API 재연결을 수행해 StrictMode의 setup/cleanup 재실행에도 복구 연결을 유지한다. API는 언어 scope·unmount 이후 응답을 거부하고, 선택 RAF는 취소·현재 권한·선택 상태·예약 ID를 확인한다. 취소한 옛 callback이 새 예약을 지우는 경로도 막았다.

| 소유자 | 비공백 줄 | AST |
| --- | ---: | ---: |
| PuckEditorAdapter.tsx | 178 | 1,147 |
| usePageBuilderSession.ts | 68 | 522 |
| useEditorViewport.ts | 25 | 170 |
| useCanvasEditingUi.ts | 172 | 1,194 |
| usePageBuilderResources.ts | 62 | 692 |
| puckEditorConfig.tsx | 538 | 2,788 |
| PuckDocumentBoundary.tsx | 144 | 1,065 |

제출 `9586948328f666ae1393c1c9df188f4f6fd21626`은 실제 변경 13파일이다. 27개 gate 중 22개 통과·브라우저 관련 5개 연기, Vitest 20파일/149개·strict·변경 제품 8파일의 구조 검사가 통과했다. 변경 8파일의 부채가 0이라는 결과를 전체 제품의 정적 부채 0으로 확대하지 않는다.

추가·관련 직접 회귀는 실제 boundary 8개, 비동기 hook 4개, 실제 Adapter 수명 3개, 기존 Surface 28개다. 같은 ID의 새 revision과 다른 문서 ID는 표시 데이터·boundary·metadata를 함께 교체하고, 일반 저장/disabled는 DOM·boundary·history와 Undo 원본을 유지한다. 폐기 후 검사는 서로 다른 Earlier/Latest 실데이터를 사용해 늦은 입력이 바뀐 값을 쓰지 못함을 확인했다. 기존 Surface 28개는 파일 수정 없이 통과했다.

최초 비동기 검사 수집은 ResizeObserver shim의 로딩 순서, 최초 수명 회귀 3개는 합성 CTA의 필수 `eyebrow: ''` 누락 때문에 실패했다. fixture를 보완하고 실패 파일/시나리오만 재실행했으며 본문·metadata·전체 Undo 기대값은 유지했다. 최초 로그는 `2c-submission`에 보존한다. 최종 제출 결과와 통합 브라우저 결과는 구분한다.

검사기도 Session에 전달한 단일 canEdit 입력을 실제 호출 인수와 `resolveEditorViewportPolicy` 결과까지 추적하도록 보완했다. 정상 alias/shorthand는 허용하고, 인수를 true로 바꾸거나 뒤의 spread로 덮어쓰면 거부한다. C 실소스 복사본에서도 정상 통과와 인수 true 변조 거부를 확인했다. 원 제출 `021fe674a867b59e056d573f65d2104115f257df`은 위치 인수에 spread가 있으면 실제 인수 위치를 확정할 수 없는 경우를 추가 거부한 `6ca09f529bcad27036f873cdb229988a015a7839`로 공식 교체했다. 원본은 `superseded` 상태로 보존했고 관련 계약 18개·planner 40개가 통과했다.

첫 제품·검사기 batch 통합은 현재 entrypoint를 검사하는 회귀 1개에서 실패해 자동 원복됐다. 최종 C의 선택 hook은 `canEdit`를 직접 받지만, 선택 수용 검사 한 곳이 이전 `viewportPolicy.canEdit` 표기를 요구했다. 앞선 입력 provenance 검사만으로 전체 acceptance CLI 성공을 주장할 수 없다는 검증 누락이다. 제품의 권한 조건은 유지하고 실제 선택 hook 인수를 따라 검사하는 `66d5cb6a4ee2e3857b015d528f5973f4a7bfbb5e`로 정식 보존 교체했다. 관련 계약 20개·planner 40개와 최종 C SHA 전체 acceptance CLI가 통과했다. 첫 batch 실패는 runtime 실행 전이며 로그는 `g7pb-phase2-c-batch-integrate-first-failed.log`다. 실패 실행을 제품 통합·브라우저 성공으로 계산하지 않는다.

제품과 검사기는 공식 batch로 `7cddd8bece2e8e1d14d009439eeff687432642b3`에 통합됐다. 32개 gate 중 9개 실행·23개 재사용, 실패·연기 0이다. 실제 브라우저는 문서 경계 2·포인터 글자 편집/접근 2·중첩 구조/테마/모달 3·저장/발행/복원 1개로 모두 8개 통과했으며 skip·unexpected·flaky 0이다.

같은 SHA의 첫 정식 `integration-verify`는 글자 편집 시나리오에서 실패했다. 루트 글꼴 옵션의 3프레임 위치 확인 직후 iframe 내부 hit-test의 다섯 점 모두 옵션 대신 본문 P를 맞췄다. 이 실행은 gate 4개 통과·25개 재사용·1개 실패에서 중지했고, 브라우저는 문서 경계 2개와 도구 접근 1개 통과·글자 편집 1개 실패다. `2c-verification-first-failed`에 원본 결과와 오류 문맥을 보존한다. 앞선 통합 성공을 최종 검증 성공으로 대체하지 않는다.

독립 읽기 검토에서는 기존 floating layer가 style·clip·resize·scroll 통지마다 표시를 숨기는 경로를 확인했다. 하지만 첫 실패에는 visibility·ready·DOM 연결 상태가 없어 정확한 원인은 아직 확정하지 않았다. 같은 hit-test 안에서 실패일 때만 표시·겹침 상태를 기록하는 진단은 제출 `06910073e0ada66d0d0d64ff96f98417f1f499fa`, 통합 `a0c2500153db181d36b1f2e9ca5164996c2f4715`다. 2개 수집·strict 타입 검사·acceptance 계약이 통과했으며 수집 성공을 제품 실행으로 계산하지 않는다.

runtime lease 아래 실패했던 글자 편집 시나리오만 진단 목적으로 1회 실행했으나 재현되지 않았다. `2c-pointer-diagnostics`에 이 결과를 보존하며 최초 실패나 정식 검증을 대신하지 않는다. 위치가 그대로여도 표시를 숨기는 코드 경로를 별도의 합성 회귀로 확인하고, 실제 배치 소유자의 책임 분리와 함께 2-C 차단 보완으로 처리했다. 이 보완과 최종 검증을 완료한 뒤 나머지 리치텍스트 책임을 분리하는 2-D를 시작했다.

원본 제품 코드에서 합성 회귀 2개가 실제로 실패했다. 하나는 위치가 같은 actionbar 색상 style 통지 뒤 옵션이 숨는 경우이고, 다른 하나는 anchor·layer가 함께 바뀐 resize의 안정화 후 같은 entries가 다시 전달될 때 숨는 경우다. 후자는 `entries.some()`이 첫 변경에서 멈춰 뒤 target의 크기 기록을 갱신하지 않는 경로다. 공개 필드 생성부터 실제 메뉴·portal DOM을 사용한 검사이며 내부 배치 함수를 흉내 내지 않는다. 이 두 재현을 첫 브라우저 실패 시점의 동일 이벤트가 입증됐다는 뜻으로 확대하지 않는다.

보완 제출 `a84339a569c2047aa389a4fc10ee8f1c9c420005`는 실제 배치를 `richTextFloatingLayer.tsx`로 분리하고 anchor·layer·viewport·clip의 같은 기하 상태를 한 번에 비교한다. 위치가 같으면 표시와 진행 중인 안정화 횟수를 유지한다. 실제 위치가 달라지면 즉시 숨기고 기존 3프레임 안정화를 거친다. 첫 너비 측정 전 최대 크기 설정, ownerDocument portal, clip 및 해제 시 observer/RAF 정리는 유지했다.

새 배치 회귀 9개와 기존 native 11개가 통과했다. 새 초안의 첫 측정 순서가 기존 회귀에서 실패해 제품 순서를 수정했으며 기대값은 약화하지 않았다. unmount 뒤 실제 기하를 바꾸고 이벤트를 보내도 예약이 생기지 않는 정리 회귀도 포함했다. 제출은 29개 gate 중 26개 통과·runtime 3개 연기, 관련 Vitest 175개·strict·acceptance 계약 통과다. 최초 재현·수정 중 실패·최종 제출 11개 로그를 `2c-floating-submission`에 보존한다.

본체는 901→706 비공백 줄, 새 배치 소유자는 195줄이다. AST는 각각 5,338·1,379로 기본 제한 이내이며 리치텍스트 크기 예외 1개를 제거했다. 이 시점 전체 정적 부채는 1,066건이다. 통합 SHA `4f603c6c1314b4b8ada7145df751056b3d4e9395`는 gate 5개 실행·24개 재사용, 실패·연기 0이다. 실제 포인터 글자 편집과 도구 접근 2개가 통과했고 skip·unexpected·flaky 0이다.

같은 SHA에서 세션·검사기·배치 보완을 함께 검사한 정식 `integration-verify`가 통과했다. 37개 gate 중 22개 실행·15개 재사용, 실패·연기 0이다. 실제 글자 편집/도구 접근 2·문서 복구/저장 경계 2·중첩 구조/테마/모달 3·저장/발행/복원 1개, 모두 8개가 통과했으며 skip·unexpected·flaky 0이다. `2c-verification`에 최종 실행을 따로 보존했고 이후 2-D 구현을 시작했다. 앞선 간헐 실패의 정확한 이벤트 원인이 입증됐다고 확대하지 않는다.

## 2-D — 리치텍스트 책임 분리

2-C 검증 SHA를 기준으로 실제 소유자 4개를 분리했다. `richTextModel`은 Tiptap extension 단일 인스턴스·서식 모델과 현재 서식 읽기를, `richTextSelection`은 선택 활성 상태·DOM anchor·범위 메시지를, `richTextCommands`는 권한을 확인한 서식·안전한 링크 명령을, `richTextInlineMenu`는 메뉴·입력·timer 수명을 소유한다. 이미 추출한 배치 소유자를 재사용하고 기존 엔트리는 필드 생성과 CanvasField의 실구현·공개 export 호환을 유지한다. 카탈로그와 문서 계약은 변경하지 않았다.

변경 전 제품에 추가한 선택 회귀 4개가 모두 실패했다. font 메뉴의 50ms 닫기가 나중에 연 tone 메뉴를 닫고, 편집기 A의 pointerdown 이후 B로 바꾸고 pointerup하면 B에 명령이 적용됐다. 읽기 전용 전환 뒤 옵션이 남고, 편집기 교체 뒤 이전 링크 입력도 남았다. `2d-submission/g7pb-structure-2d-rich-text-red-first-20260902.log`에 원본 실패를 보존한다. 이 최초 실행은 새 회귀 4개만 선택했으며 기존 native 11개도 이후 최종 관련 실행에서 통과했다.

이름이 같은 메뉴만 닫도록 제한하고, 열린 상태 변경에서는 timer·대기 pointer를 정리하면서 touch compatibility click 억제는 유지한다. editor·읽기 전용·선택 활성/해제 전환에서는 이전 입력과 메뉴 상태를 함께 폐기한다. 같은 Editor의 서로 다른 비어 있지 않은 범위까지 모두 폐기한다고 확대하지 않는다. 새 selection store나 Tiptap 직접 구독은 추가하지 않았다.

독립 리뷰에서 좁은 화면의 추가 서식 버튼이 읽기 전용에서도 keyboard click으로 다시 열리는 공백을 찾아 버튼과 handler를 보완했다. 같은 회귀를 편집 가능 상태로 복귀한 뒤 첫 키보드 입력까지 확장했을 때, 이전 advanced pointer 억제 플래그가 남는 실패도 확인했다. 소유자 수명 변경 때 이 플래그를 초기화해 해결했으며 두 단계의 실패를 보존한다. 후속 읽기 검토에서 보완을 확인했고 추가 차단 결함은 발견하지 못했다.

관련 Model 3·Commands 5·Selection 3·Native 16개가 통과했다. 기본 크기로 돌아갈 때 다른 G7 속성을 유지하고 모든 속성이 기본일 때만 해당 mark를 제거한다. 링크의 focus→extend→set/run 순서, 불허 URL에서 명령 없음, unlink와 전체 서식 초기화의 차이를 확인한다. Native 회귀는 editor 명령 대역과 실제 DOM 이벤트의 코드 검사이며, 실제 Tiptap/Puck의 브라우저 편집 성공은 별도 통합 단계로 확인한다. 최초 Model 수집의 ResizeObserver 부재는 기존 fixture shim을 적용해 보완했고 실패 로그를 보존했다.

실제 분리 후보의 acceptance·layout parity 전체 CLI와 strict 타입, 변경 제품 5파일의 구조 검사가 통과했다. 제출 `9e044e5716182529aa1e3e2f15885b332910c791`은 정확 10파일이며, 30개 gate 중 28개 통과·브라우저 관련 2개 연기, 관련 Unit 26파일/191개가 통과했다. 제출의 변경 5파일에서 부채가 0이라는 결과를 전체 제품의 부채 0으로 계산하지 않는다.

통합·최종 검증 SHA `d59bbc07482e878c179ab784a0e301c4c7c5a1e3`는 각각 gate 4개 실행·26개 재사용, 실패·연기 0이다. 실제 도구 접근과 루트/중첩/블록/링크 없는 글자 편집·저장·발행 2개 시나리오가 두 단계 모두 통과했으며 skip·unexpected·flaky 0이다. 같은 두 시나리오의 반복 실행을 별도 4개 기능으로 합산하지 않는다.

| 소유자 | 비공백 줄 | AST |
| --- | ---: | ---: |
| richTextEditing.tsx | 99 | 515 |
| richTextModel.ts | 161 | 1,226 |
| richTextSelection.tsx | 48 | 493 |
| richTextCommands.ts | 55 | 509 |
| richTextInlineMenu.tsx | 402 | 3,136 |
| richTextFloatingLayer.tsx — 2-C 보완에서 분리 | 195 | 1,379 |

## 최종 재감사와 마감

최종 제품 SHA의 실제 Git 소스를 시작 SHA와 같은 기준으로 다시 측정했다. 새 소유자 23개와 변경된 기존 파일을 합한 editor 27파일 모두 비공백 800줄/AST 10,000 기본 제한 안에 있다. 새 파일 중 줄 수 최대는 설정 소유자의 538줄, AST 최대는 메뉴 소유자의 3,136개다. 기존 두 거대 파일의 예외를 새 파일로 이전하지 않았다.

| 항목 | 2차 시작 | 2차 제품 마감 |
| --- | ---: | ---: |
| Puck Adapter 비공백 줄 / AST | 2,634 / 19,295 | 178 / 1,147 |
| 리치텍스트 비공백 줄 / AST | 901 / 6,792 | 99 / 515 |
| 전체 제품 검사 파일 | 232 | 255 |
| 크기 초과 진단 / 실제 파일 | 10 / 7 | 7 / 5 |
| 전체 정적 부채 | 1,069 | 1,066 |
| TS 우회 단언 규칙 위반 | 0 | 0 |
| 신규 위반 / 남겨 둔 해소 예외 | 0 / 0 | 0 / 0 |
| 정적 runtime 순환 / 문서 계층 역참조 | 0 / 0 | 0 / 0 |

해소한 정적 진단은 Adapter의 줄 수·AST와 리치텍스트 줄 수, 3개다. 기능 수나 수정한 실행 결함 개수와 다르다. 남은 1,066건은 CSS 색 908·important 135·specificity 16과 크기 진단 7건이다. 크기 대상은 카탈로그·Manager·공개 효과·PHP HTML compiler·편집기 CSS, 실제 5파일이며 계획된 3~5차에서 처리한다. 기존 `normal`→`compact` 카탈로그 왕복 결함의 3차 이관도 유지한다.

정적 ESM 분석은 시작 68모듈/내부 참조 선언 164개에서 최종 91모듈/243개로 바뀌었다. 중복을 제외한 모듈 연결은 162→239개다. 실제 TypeScript JS emit의 순환은 전후 0이며 새 소유자의 순환 참여, 문서 계층의 타입 참조를 포함한 역방향 의존, 미해결 local 참조, parse/syntax/emit 누락도 모두 0이다. Node 24.19.0·TypeScript 5.9.3과 lockfile·tsconfig 지문이 전후 동일하다.

이 그래프는 전체 `resources/js`의 정적 import/re-export를 검사한다. 기존 외부 Puck dynamic import 2개는 별도 기록하며, 외부 package·CSS/JSON·동적 참조를 정적 ESM 순환 노드로 취급하지 않는다. Vite plugin 생성 코드·eval·실행 시 주입까지 검증한 것으로 확대하지 않는다. 실제 타입·브라우저 성공은 위 정식 gate 기록을 사용한다.

독립 읽기 감사에서 A/B/C의 설정·명령·세션 연결, Float 배치, D 모델·선택·명령·입력 수명을 검토했다. 확인된 readonly UI 공백을 보완하고 후속 검토를 마쳤다. 소스 읽기를 새 테스트 실행으로 계산하지 않으며 최초 실패의 정확한 원인을 확인한 범위 이상으로 주장하지 않는다.

마감은 이 결과 문서 2파일을 정식 제출·통합하고 문서 delta의 `integration-verify`를 마친 뒤 `integration-finish TASK=structure-phase2-integration-20260902 NO_RELEASE=1`로 종료한다. 제품 검증 SHA와 문서만 추가된 최종 SHA를 영수증에서 구분한다. 운영 배포·기존 콘텐츠 승인·Visual UI Editor 전체 기능 완성은 이 2차 결과에 포함하지 않는다. 3~6차는 다음 실행 범위다.

## 증거 위치

최초 실패·제출·통합·검증 로그와 구조 감사 JSON은 다음 외부 디렉터리에 보존한다.

`/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/structure-remediation/phase2-close`

주요 증거는 다음과 같다.

- `phase2-baseline-architecture.json`, `phase2-final-architecture.json`: 같은 규칙의 전체 제품 정적 진단.
- `source-owners-final-d59bbc07.json`: 기존/신규 editor 27파일의 실제 소스 SHA-256과 줄 수·AST·기본 한도.
- `static-runtime-baseline-e9a3afb.json`, `static-runtime-final-d59bbc07.json`, `phase2-audit-summary.json`: 전후 graph·소스·도구 지문 및 분석 한계.
- `2a-*`, `2b-*`, `2c-*`, `2d-*`: 최초 실패·제출·통합·최종 확인을 나눈 실행 로그와 브라우저 execution/results.
- `phase2-independent-review.md`: 소스/증거 읽기 검토와 보완 기록.
- `phase2-completion.json`, `phase2-evidence-manifest.json`: 문서 마감 SHA와 정식 NO_RELEASE 종료 영수증, 보존 증거의 SHA-256 목록.
