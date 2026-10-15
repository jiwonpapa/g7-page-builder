# 기존 자동 수용 검사 · 2026-10-15

## 직접 승인과 고정 범위

형님의 `2번 진행해라` 지시로 기존 headless Playwright 자동 회귀를 실행합니다. 내장 브라우저의 실제 화면 확인과 구분하며 새로운 spec·전체 suite·전체 coverage를 추가하지 않습니다. 기존 성공 검사는 명령·입력·환경이 같은 경우 재사용하고 실패 검사와 직접 영향만 다시 확인합니다.

앞선 `1번 ... 된다 하고 지나가` 지시는 실제 OS 한글 IME 조합을 이 차수의 진행/배포 차단에서 제외하는 승인으로 반영합니다. 실제 OS 조합을 성공했다고 기록하지 않습니다. 기존 일반 한글 입력/합성 조합 방어 시험과 OS 네이티브 조합 실증은 구분하고, 후자는 **미확인·비차단 예외**로 보존합니다. IME 기능이나 방어 코드를 제거하는 승인은 아닙니다.

## 시험 주체와 실행

- Local integration/runtime task: `integration-acceptance-closeout-20261014`.
- 검증 delta: `c79a463723a574951ffa3d1a2a9a7188455a7492..6cf69bdbd28f11c32d9a7b55eaf7f9eb04316f70`.
- 제품 build fingerprint: `d41ce1689e6d8ff8a71f25fb97d2a81da8c2079fdbbb63ffdd43d23dc31dc3d6`.
- 명령: `make integration-verify TASK=integration-acceptance-closeout-20261014`. `FULL=1`/`IMPLEMENTATION=1`을 사용하지 않습니다.
- scope 계획: changed=8, gates=13, full=false, unresolved=0.

| 기존 spec | 선택 건수 | 목적 | 결과 |
|---|---:|---|---|
| structureDocumentProduct.spec.ts | 13 | 설치 편집기의 편집·저장·재열기와 세 shell 발행 | 첫 실행 13 통과 · 3.6분 |
| structureEditorV3.spec.ts | 90 | 독립 문서·레이어·정밀/반응형·텍스트·구성/출력 비교 | 폭 측정 오류로 중지: 1 통과/10 실패/1 중단/78 미실행 |
| structureSitePartProduct.spec.ts | 2 | 공통영역 이력·저장·출력·쌍 발행/충돌·지연 | 앞 gate 중단으로 미실행 |

빌드는 동일 입력으로 재사용됐습니다. helper/구조/폼/React 단위 검사와 타입·구조 gate는 성공을 재사용했습니다. 두 host 단위 검사는 기존 하네스의 incomplete-input-contract 때문에 성공 재사용이 불가능하여 관련 26건(14+12)만 실행해 통과했습니다. 검사 범위나 기준을 확대하지 않았습니다.

## 결과 해석

자동 실행 결과와 원본 영수증이 확정되기 전에는 105건 성공·제품 수용·배포 성공을 선언하지 않습니다. 외부 Vimeo의 실제 재생 인증 문제는 [고정 잔여 기록](2026-10-14-product-acceptance-closeout.md)의 PB 없는 대조 결과와 함께 보존하며, mock iframe 시험을 실제 제공자 재생 성공으로 바꾸지 않습니다. 코어·기존 문서 전환·무관한 테마·byte 상한은 변경하지 않습니다.

## 첫 실행의 공통 시험 좌표 문제

설치 제품 13건은 첫 실행에서 통과했습니다. 원본 결과는 `output/playwright/gates/integration-acceptance-closeout-20261014/004de92de69235c351f282030f4bd8c215a317d664a47a15346ab188776fecaf/35a9cc75bee64b64ba92744a95bff5b7/`입니다.

독립 90건에서는 공통 `canvasWidth()`가 문서 폭 360을 확대 변환 뒤 `getBoundingClientRect().width`와 비교했습니다. 새 작업면의 정상 초기 화면 맞춤 0.6375배에서는 화면 폭이 229.5px이므로 서로 다른 좌표계를 비교한 실패였습니다. 실제 스냅샷의 문서 폭/모바일 구분은 360px로 일치했습니다. 같은 helper에서 10건이 실패했고, 원인 확인 후 해당 Playwright 프로세스에 SIGINT를 전달해 반복을 중지했습니다. 1건 통과/10건 실패/1건 interrupted/78건 미실행을 성공으로 바꾸지 않습니다. reporter의 skipped 79는 interrupted/미실행을 포함하며, 제품 미구현을 skip으로 바꾼 것이 아닙니다.

보존 경로는 `output/playwright/gates/integration-acceptance-closeout-20261014/6dc7042a25b0f536b0366a109195c194d953f05c06316e0ba7e620fb13b2da98/2c35315dd3044711b1aebb6a364bd947/`입니다. 제품 코드/초기 화면 맞춤은 유지하고, 후속 task에서 이 한 test helper만 문서 CSS 좌표와 배율 적용 화면 좌표로 구분합니다. 문서 폭은 정확 일치, 화면 폭은 배율을 반영한 1px 이내를 확인하며 기존 렌더/스타일/Undo/출력 기준을 지우지 않습니다. 성공한 설치 제품 13건은 같은 입력일 때 재사용하고 변경한 helper의 직접 영향인 90건 및 미실행 Site Part 2건만 이어갑니다.

`test-canvas-coordinates-20261015`는 위 helper 한 곳의 측정만 보완합니다. iframe `clientWidth`는 요청 문서 폭과 정확 일치시켜 breakpoint 검사를 유지하고, 화면 `getBoundingClientRect().width`는 실제 workspace transform 배율을 적용한 폭과 1px 이내인지 별도로 확인합니다. 초기 0.6375배 맞춤을 100%로 강제하거나 기존 50/100/200% 시나리오를 제거하지 않습니다. 제품 소스는 변경하지 않으며, 제출의 수집 검사 성공을 실제 90건의 제품 실행 성공으로 세지 않습니다.

## 두 번째 실행 · 좌표 기준과 project 선택 보완

`bd623e0e820aad296b6e12426fd366710ac53d85`에서 폭 helper는 통과했지만, 기존 fixture의 렌더 비교는 iframe 내부의 비변환 CSS 좌표와 외부 preview의 0.6375배 화면 좌표를 그대로 비교했습니다. 첫 form 사례의 차이 8.700012px은 24px origin 간격의 배율 차이(24 × 0.3625)와 일치합니다. 이 결과를 제품 렌더 불일치 확정이나 통과로 기록하지 않습니다.

동시에 하네스는 수정한 spec에 product delta가 함께 있으면 기존 source mapping의 desktop project를 무시하고 세 project 270건을 선택했습니다. 승인된 90건을 넘겼으므로 실행을 SIGINT로 중지했습니다. 결과는 1 통과/4 실패/1 중단/264 미실행이며 추가 project의 수용 증거가 아닙니다. 원본은 `output/playwright/gates/integration-acceptance-closeout-20261014/162fd0f4ecc823736f4778f25a943cf24faa73a49722d31c46d7eedebcc63793/3f91aa18232a48efad93d19961ffb256/`에 보존합니다.

`acceptance-test-scope-20261015`는 시험 fixture 시작 시 공개 확대 selector로 중립 100% 좌표를 명시합니다. 제품 초기 맞춤은 그대로이고 전용 50/100/200% 시험은 이후 자기 배율을 선택합니다. 기존 1px·폭·구조·출력·Undo 기준은 유지합니다. planner는 수정 spec의 모든 title을 유지하되 해당 product source mapping에 선언된 project만 선택합니다. 미등록 spec은 기존 configured project 동작을 유지하며, 등록만 고친 제출 검사를 제품 90건 성공으로 보고하지 않습니다. 총 수용 범위는 여전히 설치 13 + 독립 90 + Site Part 2건입니다.
