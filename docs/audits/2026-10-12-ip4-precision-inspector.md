# IP4 정밀 Inspector와 자동 배치

## 상태와 범위

2026-10-12, 기준 `2c82f737b836fb98cfab5077b37d0fe1bc4abce2`.
IP4의 IND-04 unit/browser/parity를 확보했습니다. 최종 제품 수정 통합은 `60c6eac9086b04e31fe86b19eb4eace3f96e6622`, 강화된 입력 시험을 포함한 검증 기준은 `9118103d91f2c5674f555e81667b260ec9aa4cb6`입니다. 독립 편집 모듈·저장 포트·PHP 초안 fragment의 완료이며 G7 화면 전환이나 운영 발행 연결을 뜻하지 않습니다.

첫 task `ip4-design-commands-20261012`는 스타일·본문 변경 명령, 기존 session 연결, CSS 선언 생성, 관련 테스트와 이 기록/진척/변경 기록 11개 파일만 소유합니다.
v3 스키마와 기존 v1/v2·Site Part, G7 코어, 의존성, 품질 기준, 테마는 변경하지 않습니다.

## 설계

- 패널과 캔버스는 같은 불변 문서 명령을 사용합니다. 입력과 결과를 기존 v3 계약으로 검증하며 잠금·stale context·readonly는 기존 session에서 거부합니다.
- 스타일 생략, 명시적 0, reset 삭제를 구분합니다. base 변경은 tablet/mobile override를 지우지 않습니다.
- Flex/Grid, 크기·단위, 박스·배경·타이포그래피는 생성 CSS입니다. 문서에는 raw CSS/HTML/vendor 상태를 저장하지 않습니다.
- 기존 Puck history 포트만 사용합니다. 새 Undo 엔진은 만들지 않습니다.

## 제출·통합 이력

기반 제출 `957d90605efcfd79439c4d00ad7e466cfae9af6f`, Local 통합 `069c5721fb819f690a38de71211578f1ef909adb`에서 관련 47개 단위 테스트와 기존 v3 구조 브라우저 3개를 통과했습니다. 공통 presentation fixture는 모든 기존 스타일 필드를 포괄합니다.

후속 task `ip4-inspector-ui-20261012`는 19개 정확 파일을 claim했습니다. 스키마 기반 Inspector, Puck의 공개 contentEditable/Tiptap 필드와 typed run 변환, 같은 스타일을 쓰는 React 캔버스/미리보기를 연결합니다. 임의 HTML/CSS는 영속 문서 필드가 아닙니다. Inspector 초안은 적용할 때만 한 명령으로 전달하며 0/미지정/reset을 분리합니다.

PHP 별도 제출 `906c32445078053227e8813f52941432b32e0315`의 6개 시험/124개 assertion이 통과했습니다. 이는 독립 초안 fragment이며 운영 발행본이나 G7 컴파일러 교체가 아닙니다.
승인된 검사 등록은 기존 fixture 등록 2개 파일 및 브라우저 등록 2개 파일로 한정합니다. Inspector·본문·부분 서식·편집/미리보기/PHP 1px 치수와 CSS 비교는 기존 독립 시험 파일의 추가 시나리오로 연결합니다.

후속 제출과 통합은 다음과 같습니다. 원본 제출 및 실패 후 보완 이력은 coordinator/Git에 보존합니다.

| 작업 | 제출 SHA | Local 통합 |
|---|---|---|
| Inspector·본문 UI | `b383ab3145d1b82185a9d0f32f828bb37fd1ce09` | `6015bd18eba387892941241ece201e3592536f4c` |
| PHP presentation/초안 renderer | `906c32445078053227e8813f52941432b32e0315` | 같은 batch |
| fixture·브라우저 검사 등록 | `bcff5699348552f8b934a440ab873c0377c78cae` | 같은 batch |
| 독립 v3 벤더 보정 2파일 | `7f1e4e15baaed1955c2ea4bf325efc17f788f111` | 같은 batch |
| 빈 도구 모음·부분 선택 증거 보완 | `4dba4a16a213edadb0d087a30f3d967497b71af2` | `7f153756d2b57a31301ee3f1099d51fe549ec269` |
| 초점 이동의 지연된 글자 선택 동기화 | `2a2596997a886c19ffa8f752d08f7f43f95c2d94` | `60c6eac9086b04e31fe86b19eb4eace3f96e6622` |
| 커서 이동 완료·최종 원문 전체 비교 보강 | `a0185329a123245bd405989e62ebbbdcf04da53d` | `9118103d91f2c5674f555e81667b260ec9aa4cb6` |

## 실행 환경과 명령

- Local controller: macOS, Node `24.19.0`, PHP `8.5.3`. 브라우저/PHP 출력 비교: Local `g7pb-dev` runtime lease, Node `24.19.0`, PHP `8.5.9`, Chromium/Playwright `1.62.1`.
- React `19.2.8`, Puck `0.23.0`, Tiptap `3.30.2`. 의존성 버전·스키마·1px 및 번들 기준은 변경하지 않았습니다.
- 각 worktree의 `make task-submit TASK=<id>` / 동일 기준 보완의 `make task-resubmit TASK=<id>`로 정확 파일 소유·관련 단위·타입·구조 검사를 수행했습니다.
- Local: `make task-integrate-batch TASKS=ip4-php-presentation-20261012,ip4-inspector-ui-20261012,ip4-verification-registration-20261012,ip4-vendor-position-20261012 INTEGRATION_TASK=integration-ip4-20261012`.
- Local 마감 보완: `make task-integrate-scoped TASK=ip4-format-selection-20261012 INTEGRATION_TASK=integration-ip4-20261012`.
- 동일 통합 task로 `ip4-richtext-race-20261012`, `ip4-input-proof-20261012`를 순차 scoped 통합했습니다. 테스트만 변경한 후자는 수집 검사와 실제 동작을 구분하며, 제품 변경을 포함한 `make integration-verify TASK=integration-ip4-20261012`에서 아래 실제 브라우저 실행을 확보했습니다.
- 공통 계획이 `npx --no-install playwright test tests/E2E/structureEditorV3.spec.ts --retries=0`와 기존 `editorInspectorUx.spec.ts --project=desktop --retries=0`를 선택했습니다. 동일 입력의 성공 검사는 재사용하고, 불완전 입력 계약 검사는 재사용하지 않았습니다. 전체 프런트/coverage/E2E로 확대하지 않았습니다.

## IND-04 검증 결과

- Unit: Inspector 4, codec 9, rich text 6, structure UI 7, 벤더 9의 관련 TS 시험 35개 통과. 앞선 기반 명령·presentation 등 47개 통과 기록은 위 기준 SHA에 별도 보존하며 중복 합산하지 않습니다. PHP 6개/124 assertions, 타입 검사·Pint·PHPStan·구조 경계 및 선택된 하네스 검사 통과.
- Browser: 독립 6개 시나리오 × desktop/tablet/mobile 프로젝트 = 18개, 기존 G7 Inspector·빠른 Undo 회귀 2개 통과. retry·skip 성공으로 대체하지 않았습니다.
- Inspector: Flex/Grid typed 트랙, 수치/단위, 공통·개별 여백, 미지정/0/reset, 단일 적용/Undo, 저장·재열기. 기존 responsive 원본 값은 보존합니다.
- 본문: 두 글자 `한글` 전체의 굵기→Undo/Redo→색 `#2255ff`→Undo/Redo→20px→`/about` 링크를 각각 정확한 canonical run으로 비교했습니다. 줄바꿈, Chromium CDP 한글 조합, plain-text paste 후 첫 문단 `한글 정밀 편집`의 원문·부분 서식과 둘째 문단 `Second line한글 조합 붙여넣기` 전체를 비교하고 저장·읽기 전용 재열기로 확인했습니다. raw HTML은 저장하지 않으며 빈 서식 도구 모음은 남지 않습니다.
- Parity: 공통 fixture의 Grid 및 Flex column 각각에서 5개 요소와 부분 서식의 CSS를 비교했습니다. 캔버스/React 미리보기/PHP 초안의 x/y/width/height 최대 차이는 세 프로젝트 모두 `0.0000152587890625px`로 1px 이하입니다. 캔버스 폭은 860px입니다.
- 독립 v3 gzip: JS `374563` bytes, CSS `18216` bytes. 기존 설치 편집기 gzip JS `508316` bytes, CSS `45020` bytes와 기존 상한을 유지합니다.
- 실제 재열기·Inspector·Grid 출력 PNG를 열어 확인했습니다. Grid fixture의 겹침·absolute/회전은 출력 의미 비교용 스트레스 사례이며 판매용 페이지 디자인 품질 증거가 아닙니다.

## 증거 위치

최종 독립 실행(18 passed):

`output/playwright/gates/integration-ip4-20261012/da74897b84d82a5b2bb987fc9b6a37112da15bf4e4ced434b994adebc0a60e08/9d732c5f499c4049be3da56ce7c46485/`

기존 G7 회귀(2 passed, 기준 `9118103`):

`output/playwright/gates/integration-ip4-20261012/7f859fbd47ff5f7ef31321abfcea84e63e816573e58d7ac0c1b5ee265e44abe0/b3fd4126b5024914b674220274622a3e/`

각 디렉터리의 `results.json`, `execution.json`, `report/`, `results/`를 보존합니다. 독립 JSON의 `canonical-richtext`, `typed-inspector-document`, `independent-port-evidence`, `editor-preview-php-parity` 첨부에 원본·번들·실측 자료가 있습니다. ignored 로컬 산출물이므로 문서 자체나 SHA 형식 검사만으로 이를 대체할 수 없습니다.

## 실패에서 수정한 항목과 한계

- Puck의 `position=relative` 강제 대입이 authored absolute/static을 바꿨습니다. 고정 원본 해시로 확인한 독립 v3 entry에만 보정하고 unstyled vendor wrapper의 기본 relative는 유지합니다.
- 입력 대기 중 Undo는 canonical 문서만 바꾸고 Tiptap 화면 갱신을 놓쳤습니다. 기존 typing timer가 끝나면 최신 외부 내용을 `emitUpdate:false`로 다시 맞춥니다. 새 이력·엔진을 추가하지 않았으며 기존 200ms 입력 대기 창은 유지합니다.
- 패널로 옮긴 서식 도구의 클릭이 캔버스 빈 곳 클릭으로 전파됐습니다. 공개 ActionBar의 경계를 재사용하고 실제 React portal 회귀시험을 추가했습니다.
- 자동 fill 직후 Home은 ProseMirror의 focus-reset 휴리스틱과 충돌했습니다. 실제 포인터 focus 후 연속 키 입력을 사용하며 DOM 선택과 서식별 canonical 두 글자 범위를 검증합니다. 조사 중 넣었던 별도 root-cache 보정은 원인이 아니므로 최종 소스에서 제거했습니다.
- 최종 재검사에서 색상 적용 누락이 재현됐습니다(`b6b172…/96b2af…`). CPU 지연 진단에서는 iframe root가 정상인데 DOM은 두 글자를 선택하고 Tiptap은 마지막 커서 위치를 유지한 사실을 확인했습니다. 공개 Mark `onBlur`와 `setTextSelection`으로 초점 경계에서만 동기화합니다. 매 명령마다 DOM을 다시 읽던 중간안은 서식 렌더 후 축소된 DOM 범위를 잘못 반영하므로 채택하지 않았습니다. 실제 Tiptap 단위 시험으로 원인·iframe 소유·연속 서식·문서 update 횟수를 검증합니다.
- 초기 성공 실행의 전체 저장 원본·PNG에서 줄바꿈 시험이 첫 두 글자를 덮어쓴 사실을 발견했습니다(`c8d6f4…/327845…`). 최종 시험은 공개 Tiptap 선택 상태와 DOM 커서가 실제 키 입력 결과에 도달한 것을 읽기 전용으로 확인하고, 선택·커서를 직접 주입하지 않습니다. 최종 문단 전체 비교를 추가해 해당 성공 실행을 최종 합격 증거로 사용하지 않습니다. 부하 진단 중 선택 입력 실패도 제품 합격 수에 합산하지 않습니다.
- 초기 제출의 패널/iframe 선택 대상, empty paragraph/이미지 decode 시점, preview 기본 색상 및 adapter의 HTML escaping overhead도 보완했습니다. 일시적인 Puck 표현의 제한과 별개로 canonical 문서의 1MiB 제한은 그대로 검증합니다. 실패 실행은 최종 합격 증거에 합산하지 않습니다.
- 세 프로젝트 모두 **1440×1000 데스크톱 host**입니다. 태블릿/모바일은 UA·입력 에뮬레이션이며 반응형 세 폭 편집이나 실기기 증거가 아닙니다. IME는 Chromium 프로토콜이며 실제 OS 키보드 시험이 아닙니다. 저장 검사는 canonical 반영을 기다린 뒤 실행하며 입력 debounce 이전 즉시 저장까지 보장하지 않습니다.
- G7 없는 독립 mount/DraftPort와 PHP draft fragment의 검증입니다. G7 설치 화면 전환·운영 저장/발행·기존 v1/v2/Site Part 이행·원격 배포/푸시는 수행하지 않았습니다. 로컬 테마도 변경하지 않았습니다.
- Moveable/Selecto 핸들·다중 디자인 선택(IP5), 반응형 상세 UI(IP6), 기존 블록 이행(IP7), 운영 저장/발행(IP9)은 이번 범위가 아닙니다. 다음 단계는 IP5이며 아직 착수하지 않았습니다.
