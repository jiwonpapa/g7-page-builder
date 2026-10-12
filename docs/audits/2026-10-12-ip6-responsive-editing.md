# IP6 반응형 상세 편집

상태: **IP6 구현·Local 통합·필수 증거·최종 범위 검증 완료, 계획 6/10**. IP5 완료 기준 `8fb7508484214ec350225596249bd0969f46ce29`에서 시작했고 `29f80fdab86058ce2683343e5ff6e056efca1c27`의 `integration-verify`가 scoped로 통과했다. 다음은 IP7이며 아직 착수하지 않았다.

## 범위

기존 v3 문서의 base·tablet·mobile 독립 상속을 편집 화면에 연결했다. PC 공통값과 태블릿·모바일 전용값을 명시적으로 선택하고, 선택한 화면의 Inspector·다중 속성·핸들·표시 여부를 같은 문서 명령과 Puck 이력으로 변경한다. 속성별 초기화와 현재 화면 스타일 전체 초기화를 구분한다. 구조·텍스트 내용은 모든 화면에서 공유한다.

기존 스키마의 스타일 62개를 typed 컨트롤로 노출한다. 미지정은 공통값에서 상속하고 0·false는 명시적 값으로 유지한다. 재정의 시작값은 상속된 현재 값이며, 패널은 값의 출처와 다른 화면의 영향 범위를 표시한다. 모바일과 태블릿은 서로의 값을 상속하지 않는다. 폭·선택·줌은 문서에 저장하지 않으며 폭 전환 시 미확정 Inspector·핸들 입력을 다른 화면에 적용하지 않는다.

핸들은 선택 폭의 실제 스타일·부모 배치·숨김·잠금을 검사한다. 공통 right/bottom 앵커를 모바일에서 이동할 때는 해당 화면에 auto를 명시하여 공통 앵커가 다시 적용되지 않도록 한다. 다중 속성 적용과 Undo/Redo 뒤에도 사용자가 고른 속성을 유지하며 입력 초안만 현재 문서 값으로 갱신한다. absolute 또는 명시적 Grid 배치에는 시각 순서와 읽기·Tab 순서가 다를 수 있음을 안내한다.

문서 스키마·의존성·G7 코어·기존 문서 전환·운영 저장 및 발행 연결은 변경하지 않았다. IP7 카탈로그 확장과 IP9 운영 저장 연결은 후속 범위다. 독립 mount·주입 저장 포트·PHP 초안 fragment 기준이며 기존 G7 편집 화면과 실제 서버 저장/발행 전환 완료를 뜻하지 않는다.

## 합격 조건

- 공통값 독립 상속, 0·false 재정의, 개별/전체 초기화, 잠금·읽기 전용, 다른 화면 값 보존을 관련 단위 시험으로 검증한다.
- 데스크톱 host에서 360·768·1280px 캔버스를 직접 편집한다. 화면 전환 중 미확정 조작은 다른 화면에 적용하지 않으며 Undo/Redo와 주입 저장 포트의 재열기로 문서 전체를 비교한다.
- 639·640·1023·1024px 경계와 세 대표 폭에서 편집 캔버스·React 미리보기·PHP 초안 출력의 치수와 스타일을 비교한다. 허용 오차는 1 CSS px다.
- Flex 방향·gap·Grid·크기·표시를 화면별로 검증한다. DOM 순서는 공통으로 보존하고 시각 순서와 읽기/키보드 순서가 달라질 수 있는 배치에는 경고를 표시한다.

## 검증 기록

환경은 Node 24·PHP 8.5와 Local runtime lease 아래의 고정 `g7pb-dev` Chromium이다. 실제 v3 mount를 production 빌드하고 G7 없는 시험 host에서 기존 Puck/Tiptap·Moveable/Selecto를 조작했다. 외부 요청은 없는 로컬 자산·주입 포트 시험이며 설치된 G7 운영 경로를 대신하지 않는다. 세 Chromium profile 모두 편집 host는 1440×1000 CSS px이고 그 안의 캔버스 폭을 바꾼다. 모바일 기기 자체의 전체 편집 UX를 검증했다고 주장하지 않는다.

| 검사 | 범위 | 결과 |
|---|---|---|
| 관련 단위 | 명령·geometry·gesture·session·Inspector·codec·rich text·UI 11파일 | 103개 통과, 동일 입력 성공 결과 재사용 포함 |
| 관련 하네스 | 변경한 검사 등록과 의존 하네스 12파일 | 228개 통과 |
| 구조 검사 | 구조 규칙 회귀·변경 제품 소스 | 회귀 29개, 제품 11파일 통과; 신규 위반 없음 |
| 타입·빌드 | TypeScript strict·production build | 통과, 스키마·의존성·예산 상한 변경 없음 |
| 통합 브라우저 | 기존 13 + 신규 4 시나리오 × 3 profile | 51 통과, skipped/unexpected/flaky 모두 0 |
| 최종 범위 확인 | `make integration-verify TASK=integration-ip6-20261012` | scoped 통과; 정적·단위 결과 재사용, 브라우저 51개 재실행 통과 |
| 출력 비교 | 360·639·640·768·1023·1024·1280px, 3 profile | 캔버스·React 미리보기·PHP fragment의 대상 치수 최대 차이 0 CSS px, 기준 1px 이내; CSS·DOM 의미 일치 |
| 독립 편집 번들 | gzip JS / CSS | 467,639 / 18,247 bytes; 기존 상한 508,500 / 45,200 이내 |

새 반응형 시험은 세 폭의 Puck 구조 드래그·직접 본문 입력, 기기별 크기·간격·방향·2열 Grid 편집, 상속/개별 및 전체 초기화, 0·false, 숨김/표시, readonly, 다중 속성, 모바일 리사이즈·폭 전환 중 취소·한 Undo/Redo, 저장/재열기를 확인한다. 일곱 폭에서 heading/link/image 의미와 공통 DOM 순서, 실제 Tab 이동을 비교했다. 기존 IP3~IP5의 잠금·IME·부분 서식·50/100/200% 조작 회귀도 유지했다.

통합 증거:
`output/playwright/gates/integration-ip6-20261012/47e0e5e6275e008e10ba924ead3e979e20c8d003ad74d800b7f853553359f531/df7375ffec19459fad1b26e0126e527d/`

최종 검증 증거:
`output/playwright/gates/integration-ip6-20261012/47e0e5e6275e008e10ba924ead3e979e20c8d003ad74d800b7f853553359f531/e0358cb4683941049f2c8d3d0f1a9e20/`

각 디렉터리의 `execution.json`, `results.json`, HTML report, JSON 첨부와 스크린샷을 보존한다. 최종 결과는 expected 51·skipped 0·unexpected 0·flaky 0·errors 빈 목록이다. 360px 다중 핸들, 360·768·1280px 미리보기 및 PHP 출력 캡처를 직접 열어 기기 표시·선택 윤곽·2열/세로/가로 배치·읽기 순서 안내를 확인했다. 이는 해당 fixture 검증이며 전체 카탈로그의 시각 수용을 대신하지 않는다.

## 실패와 보완

첫 브라우저 실행은 시험 파일에서 validator를 직접 import하면서 Node ESM의 JSON import 조건에 걸려 시나리오 수집 전에 실패했다. 제품 validator는 그대로 두고 시험은 타입만 import하며 기대 breakpoint를 독립적으로 판정한다. 수정 후 17개 시나리오 수집과 실제 실행을 확인했다.

다음 실행은 46 passed·5 failed였다. 다중 패널을 문서 변경마다 다시 mount하여 선택한 속성이 너비로 초기화되는 제품 문제 3건과, PHP 비교용 HTML host에 viewport 선언이 없어 모바일 profile이 980px로 렌더링된 시험 문제 2건이었다. 패널의 속성 선택은 유지하고 문서 값만 갱신했으며 관련 단위 회귀를 추가했다. 시험 host에는 viewport 선언과 실제 innerWidth 검사를 추가했다. 1px 기준·검사 대상·timeout을 완화하지 않았다.

실패 증거는 `output/playwright/gates/integration-ip6-20261012/f5995ed613e671694e3e692546df2799132643f00f7f0972a69e70ca032ea68a/5c5426e8ebaf429da9a4c5d11c7fc4cc/`에 보존한다. 수정 후 통합 및 최종 검증 각각 51개 모두 통과했다. 최종 브라우저 재실행은 runtime 연속성 기록을 재사용할 수 없다는 하네스 판정에 따른 것이며, 같은 입력의 단위·타입·구조 검사는 재사용했다.

## 커밋과 범위

| task | 최종 제출 SHA | Local 통합 SHA |
|---|---|---|
| 착수 기록 `ip6-scope-20261012` | `6d3dabb9c7ccdce91c2326f2314d170bed9d1135` | `2385b8567dc6432283a6f89e29288f7c9ad744ac` |
| 반응형 구현 `ip6-responsive-editor-20261012` | `b23d204f8183c971b5b093e5736bb30b5da36630` | `29f80fdab86058ce2683343e5ff6e056efca1c27` |
| typed 필드 `ip6-responsive-fields-20261012` | `3a757338bd78df9461a4a13a44f6c38bbaea95bf` | `29f80fdab86058ce2683343e5ff6e056efca1c27` |
| 필수 검사 등록 `ip6-browser-registration-20261012` | `b7e6fe2cb608c9c19b91dc6a198af6155c38df51` | `29f80fdab86058ce2683343e5ff6e056efca1c27` |

정확 파일 claim과 공식 제출/재제출을 사용했고, 의존하는 세 작업을 `task-integrate-batch`로 검증·통합했다. 착수 시 Local main은 깨끗했고 기존 managed worktree를 재사용했다. 별도 README task와 보존 dirty worktree는 수정하지 않았다. 테마 전환·운영 배포·push·삭제를 실행하지 않았다. 다음 범위는 IP7 내장 구성 템플릿과 공통영역이며 이번 작업에 포함하지 않았다.
