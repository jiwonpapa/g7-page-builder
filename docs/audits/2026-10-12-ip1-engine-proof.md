# IP1 독립 엔진 결합 검증

상태: IP1 구현·Local 통합·실동작 시험 완료. IND-01, SPEC-01·06·07의 기술 선행 검증만 대상이다. 제품 기능 구현·저장·발행·배포 완료가 아니다.

## 범위

- 기준 SHA: `067decb15880cd71bc0d0859c3d551f942ed790b`
- 소유 task: `ip1-engine-proof-20261012`, scoped 정확 파일 21개.
- `tests/IndependentEditor`의 폐기 가능한 기술 fixture와 해당 검사 등록, 진척·감사 기록만 변경한다.
- 제품 package/lockfile, PHP, v1/v2/schema, 네이티브, G7 코어, DB 및 발행본을 변경하지 않는다.
- 시험의 Box 데이터는 메모리에만 존재하는 기하 실험 값이다. PageBuilderDocument v3 또는 영속 Puck Data 계약이 아니다. v3는 IP2에서 정한다.

## 구성과 입력 소유권

작업면은 차분한 단색 캔버스와 좌측 구조·우측 관찰 상태로 구성한다. 선택·크기 변화는 즉시 표시하고 장식 애니메이션은 넣지 않는다. 실제 제품 UI 디자인은 후속 범위다.

Puck 구조 DnD, Tiptap 텍스트, Selecto 선택, Moveable 리사이즈를 명시적 입력 모드로 분리한다. Puck의 실제 same-origin preview iframe 안에 공개 iframe override로 조작 부품을 연결한다. host portal은 별도 DOM 컨텍스트다.

드래그 중 DOM은 임시 미리보기일 뿐이다. 종료 시 문서 세션/revision/readonly, 전체 선택 ID와 수치 범위를 확인한 뒤 전체 그룹을 Puck 공개 `setData` 한 번으로 반영한다. Escape·무변경·문맥 변경은 커밋하지 않는다. 별도 history/Undo 구현은 없다. 기존 제품의 검토된 `vite.puck-history.ts` 보정을 그대로 호출하며 벤더 원문 지문이 다르면 빌드를 실패시킨다.

## 의존성

제품에 바로 설치하지 않고 독립 private 시험 package/lockfile로 고정한다.

| 역할 | 버전 | 라이선스 |
|---|---|---|
| Puck | 0.23.0 | MIT |
| React / ReactDOM | 19.2.8 | MIT |
| Tiptap 및 하위 확장 | 3.30.2 | MIT |
| react-moveable | 0.56.0 | MIT |
| react-selecto | 1.26.3 | MIT |
| Vite / TypeScript / Playwright | 7.3.6 / 5.9.3 / 1.62.1 | MIT / Apache-2.0 / Apache-2.0 |

공개 근거: [Puck API](https://puckeditor.com/docs/api-reference/puck-api), [Puck actions](https://puckeditor.com/docs/api-reference/actions), [Moveable](https://www.npmjs.com/package/react-moveable), [Selecto](https://www.npmjs.com/package/react-selecto). 실제 API와 버전은 설치 패키지의 선언·lockfile로 재확인한다.

Puck의 외부 Inter CSS import는 시험 빌드에서 정확 문자열을 확인하고 제거하여 시스템 글꼴을 사용한다. 외부/G7 요청은 브라우저 시험에서 실패한다. 최초 설치 때 Tiptap transitive 범위가 3.31.4로 혼합됐으며 전체 3.30.2 override와 dedupe 후 lockfile 검사를 추가했다.

## 사전 예산과 판정 경계

- 시험 번들 전체 JS/CSS gzip 합계: 900 KiB 이하. 제품 번들의 증분 비용과 동일하지 않다.
- 100/500노드: 로컬 production build의 첫 캔버스 준비 10초 미만, 단일 선택 응답 1초 미만.
- 기하 값: 시험 범위 24~4096 CSS px. 제품 v3 한도는 IP2 계약에서 결정한다.
- 50/100/200%에서 실제 포인터의 화면 이동을 CSS 크기로 검증하고, 드래그 중 history 증가 0 및 종료 후 1을 확인한다.
- 이 수치는 IP1 실패 감지 상한이다. 제품 전체 p95, 저성능 기기, 내장 블록 전체·반응형·OS 네이티브 IME 수용을 대신하지 않는다.

## 실행과 결과

Node 24를 사용한다. 시험 패키지는 자기 node_modules만 설치하고 고정 G7 runtime을 사용하지 않는다.

```sh
env PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin node tests/IndependentEditor/verify.mjs unit
env PATH=/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:/usr/bin:/bin node tests/IndependentEditor/verify.mjs browser
python3 -B -m unittest tests.Harness.test_independent_probe
make editor-plan-check
```

제출 시 정적/단위 검사를 수행하고 실제 브라우저는 Local 통합 lease에서 필수 실행한다. 신규 fixture의 정확 파일만 등록하며 알 수 없는 경로와 제품 의존성 변경의 기존 FULL 요구는 유지한다. 동적 Chrome/OS 상태를 정적 성공 캐시로 취급하지 않는다.

## Worktree 검증 결과

2026-10-12, macOS arm64, Node 24.19.0, Chrome 154.0.8037.99에서 다음을 확인했다.

| 검사 | 결과 |
|---|---|
| 격리 fixture strict 타입·거래 단위 | 17/17 통과 |
| 제품 루트 TypeScript 타입 검사 | 통과, 제품 소스 변경 없음 |
| 기존 Puck history 보정 회귀 | 4/4 통과 |
| planner 및 신규 범위 하네스 | 84/84 통과 |
| 제품 정적 구조 | 435파일 통과, 기존 부채 220개, 신규 위반 0 |
| 실제 브라우저 | 9/9 통과, skip/retry/flaky 0 |
| 전체 시험 JS/CSS gzip 합계 | 459,775 bytes, 900 KiB 상한 이내 |
| 100노드 준비 / 단일 선택 | 253 / 85 ms |
| 500노드 준비 / 단일 선택 | 620 / 292 ms |

브라우저 원본은 worktree의 `output/playwright/ip1/2026-10-12T01-22-37.366Z/`에 있다. 3개 줌 스크린샷, JSON 결과, 성능 첨부 및 bundle.json을 포함한다. 시험 package-lock SHA256은 `ddcb479fd9f12236b041a438a269677274676c205bca93f6df2e56091571f0be`다. 성능은 이 로컬 단일 실행 관측값이며 p95 보증이 아니다.

## 제출·Local 통합 증거

- 구현 제출: `e827bf10a1ec65279412b2d86967a749f4469ade`
- Local 통합: `a4b4fe8b55a22d8be96888b5f3b556d148d94108`
- 제출/통합: `make task-submit TASK=ip1-engine-proof-20261012`, `make task-integrate-scoped TASK=ip1-engine-proof-20261012 INTEGRATION_TASK=integration-ip1-engine-proof-20261012`
- 두 명령 모두 Node 24 PATH 환경에서 실행했다. 정확 21개 변경 경로, scoped 16개 gate이며 FULL 확대는 없다.
- 제출에서 Python 하네스 215개, 구조 검사 하네스 29개, fixture 단위 17개가 통과했다. 입력이 같은 성공 검사는 통합에서 재사용했다.
- 실제 브라우저는 제출에서 보류하고 Local runtime lease 아래 독립 loopback preview로 필수 실행했다. G7 컨테이너·제품 asset·DB를 준비하거나 변경하지 않았다.
- Local 브라우저 9/9 통과, skip/retry/flaky 0. 100노드 준비/선택 264/96 ms, 500노드 628/304 ms. 번들 gzip 459,775 bytes. 환경은 위 worktree 시험과 같다.
- Local 원본: `output/playwright/ip1/2026-10-12T01-24-46.069Z/`. `results.json` SHA256은 `69b37f7ccc3eeb2cb2fb8e5b51802c3137749d901721f7ace9508dc358619037`, `bundle.json`은 `ed66a9de6d06e90195f39005346a013d8c60a22b1bf185976a708f0f266b3fdc`다.

IND-01의 unit 근거는 거래·취소·문맥·동일 data 이력 병합 테스트, browser 근거는 실제 iframe 입력 9개, architecture 근거는 격리 패키지/AST 경계·정확 파일 planner·제품 정적 구조 검사와 위 결합 결정이다. 원장 완료 기록은 위 통합 SHA를 기준으로 별도 문서 task `ip1-engine-proof-record-20261012`에서 처리한다. 이 문서 기록은 제품 기능 변경을 추가하지 않는다. 최종 integration-verify 및 NO_RELEASE 종료 결과는 coordination 이력에 남긴다.

## 재현한 실패와 수정

1. 기본 headless binary가 설치되지 않아 첫 실행이 실패했다. 설치된 Chrome을 명시하고 실제 버전을 기록한다. 외부 Inter 폰트 요청도 차단 실패로 검출해 시험 빌드를 오프라인화했다.
2. Selecto의 iframe 선택 대상과 모드/Undo 후 DOM 교체가 문제였다. 공개 callback으로 매 gesture의 현재 iframe 요소를 조회하고 선택 의미는 안정 ID로 보존한다. Undo/Redo 뒤 핸들 재표시까지 회귀 시험에 포함한다.
3. Puck DnD는 insert와 UI 선택에 동일 data의 history를 두 번 기록했다. Puck 공개 `history.setHistories`로 현재 끝의 연속 동일 data만 합친다. 새 history 엔진은 없으며 다른 변경·Undo 중간 index·Redo는 합치지 않는다. 삽입→Undo→Redo→리사이즈→두 번 Undo를 같은 인스턴스에서 검증했다.
4. Tiptap 준비 전 fallback contenteditable을 타이핑 대상으로 삼아 입력 손실/노드 삭제가 재현됐다. 실제 `ProseMirror`와 포커스를 기다리며, 텍스트 모드는 노드 삭제 권한을 갖지 않는다. 소유 텍스트 요소의 native bubbling 경계에서 Delete/Backspace/조합 입력이 노드 단축키로 전달되지 않게 한다. 문자 삭제를 직접 구현하지 않는다.
5. ArrowLeft 직후 아직 ProseMirror의 비동기 selectionchange가 반영되지 않은 Delete 시험도 실패했다. 두 animation frame 후 문자 삭제 및 정확한 HTML, 키보드 Undo/Redo를 확인한다. OS 네이티브 IME 및 무지연 연속 키 스트레스의 수용 증거는 아니다.

## 채택 판정과 다음 경계

이 고정 조합에서 React 19·Puck iframe·Moveable·Selecto·Tiptap의 결합을 막는 구조적 차단은 발견하지 않았다. **Moveable 0.56.0 / Selecto 1.26.3을 후속 제품 어댑터 구현 후보로 채택**한다. 실제 제품 의존성 승격은 IP5 소유 범위/검사와 IP2 문서 명령 계약 뒤에 한다.

이번 성공은 단순 기술 Box에 한정된다. v3 원본/컴파일러, 내장 전체 블록, Flex/Grid, 반응형 세부 편집, 다중 정렬·회전, 저장·발행·재열기, OS IME 및 G7 호환은 후속 IP2~IP10 범위다. 루트 제품 의존성·DB·마이그레이션·운영 배포는 실행하지 않았다.

다음 단계는 IP2 정밀 문서와 스타일 계약이다. 안정 노드/typed 단위·스타일/검증 fixture/명시 이행을 정하며 v1/v2를 자동 변환하지 않는다. IP2 구현은 이번 IP1 커밋에 포함하지 않는다.
