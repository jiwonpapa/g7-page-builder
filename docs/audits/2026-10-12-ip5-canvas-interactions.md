# IP5 핸들과 다중 선택 작업면

상태: **IP5 구현·Local 통합·필수 증거·최종 전체 검증 완료, 계획 5/10**. 기존 편집기의 외부 글꼴 CSS 지연을 동일 Inter 4.1의 로컬 배포로 보완했고 `c58a1e83ba0003015cd63eccdba32a0d063332b2`의 `integration-verify FULL=1`이 성공했다. IP4 완료 기준 `b8b90caca345284362fa8b9b65071ea70b63f91d`에서 시작했다. 아래 과거 실패 기록은 보존하며 마지막 절이 최종 결과다. 다음은 IP6이며 아직 구현하지 않았다. G7 코어 수정·운영 배포는 실행하지 않았다.

## 구현 범위

v3 다중 스타일 명령, 측정값 기반 크기·좌표·회전·정렬/분배, 조작 시작 문맥 확인·표시용 초안·취소·한 번 확정을 구현했다. 부모와 자식의 중복 선택은 루트에만 적용한다. 잠금·숨김·다른 부모·상충하는 배치의 좌표 변경은 원자적으로 거부한다. 문서 스키마·PHP 출력 의미·별도 Undo는 추가하지 않았다.

IP1에서 검증한 `react-moveable@0.56.0`, `react-selecto@1.26.3`을 정확 버전으로 승격했다. 기존 의존성 버전은 변경하지 않았고, 새 20개 직접·전이 패키지는 모두 MIT다. 설치 시 감사 결과의 기존 33건(중간 21·높음 12)은 이번 추가 노드에 해당하지 않으며 이번 작업으로 해소했다고 주장하지 않는다. 공유 package/lock 변경을 별도 task와 명시적 FULL 검사 사유로 처리했다.

InteractionAdapter는 공개 Moveable/Selecto API와 Puck의 공개 iframe override·previewMode·명령/이력만 사용한다. Puck private AppStore/zoom API나 G7 내부 API에 접근하지 않는다. 혼합값 Inspector는 명시적으로 고친 속성만 일괄 적용한다. 그룹 리사이즈는 허용된 absolute 묶음의 크기와 요소 간 위치를 함께 비례 변경한다.

## 화면과 입력 설계

기존 캔버스 중심 구성과 좌측 레이어·우측 Inspector를 유지한다. 선택 테두리·핸들·스냅 가이드만 조작 상태를 표시하고 장식 애니메이션은 넣지 않았다. 구조 DnD·정밀 조작·텍스트 입력·화면 이동은 명시적 모드로 입력을 나누며 모두 같은 문서와 Puck 이력을 사용한다. 팬/줌/선택은 문서나 이력을 늘리지 않는다.

50/100/200%에서 핸들의 화면 크기를 유지하고 저장값은 CSS px로 확정한다. 작성 surface의 높이로 iframe·확대 작업면을 계산하여 1,200px 이상의 긴 페이지도 호스트 스크롤에서 편집한다. DOM 참조는 stable ID로 다시 연결하고, 작업면 표시 초안은 문서로 저장하지 않는다. Esc·초점 이탈·문맥/모드 변경·Undo 중단은 현재 정상 문서의 표현으로 복구한다.

반응형 재정의는 IP6, 운영 저장/발행 연결은 IP9이며 이번에 앞당기지 않는다. G7 저장소·코어·테마 파일·운영 서버는 수정하지 않았다.

## 커밋과 통합

| task | 최종 제출 SHA | Local 통합 SHA |
|---|---|---|
| 기반 명령 `ip5-gesture-commands-20261012` | `003b48293a31bf6c41f5c0a3e7ab29efcdbfa061` | `1909959e46571937344fff919a99402e986eaeff` |
| 정확 버전 의존성 `ip5-interaction-deps-20261012` | `5a082e80a32b726cc0b45069b41115935dba0268` | `1d7f14c9044797755eba4f2a907790fbfda71f1b` |
| 그룹 위치 보정 `ip5-group-geometry-20261012` | `4ac58aed3f064d5defe812af298a95c65a059124` | `a3329235bd9073f1796d5b63268901be307fd08e` |
| 조작 UI `ip5-canvas-ui-20261012` | `aff9225883b330777807804b4177e16e2b3fcd13` | `a3329235bd9073f1796d5b63268901be307fd08e` |
| 검사 등록 `ip5-browser-registration-20261012` | `b275e7825577a3e9c4b39de4fa12704c6297cbd1` | `a3329235bd9073f1796d5b63268901be307fd08e` |
| 기존 캡처 준비 `ip5-font-ready-verification-20261012` | `832087adefe73841b7148df307ecfad822065ca8` | `2b2491f397829636752ca4ba2f5f6864e82803c1` |
| far-anchor 크기 조절 `ip5-resize-anchor-20261012` | `06a12036a1531aecad351c94640742579d821353` | `8e0428efc21283ae7d54cfbdd6917f4486841b67` |
| 출력 검사 진입 준비 `ip5-parity-readiness-20261012` | `75cc26db69f08c803f862b8e6a6581a54f4f9e19` | `a27e47c99a1ca8bb20d142a6f861ef40f8660fd5` |
| 진입 요청 진단 `ip5-navigation-diagnostics-20261012` | `92224d10d5f405c7a4f3e60ea0890891ea8619b0` | `bcb3ffba51fe6ec468b4dd59ab59ad804ecba14d` |

정확 파일 claim으로 분리하고 `task-submit`/`task-resubmit`으로 커밋했다. 서로 의존하고 PATHS가 겹치지 않는 그룹 명령·UI·검사 등록은 공식 `task-integrate-batch`로 함께 검증·통합했다. 다른 README task와 보존 worktree는 건드리지 않았다.

## 검증 기록

환경: macOS Local 제어, Node 24·PHP 8.5, 고정 `g7pb-dev`의 Chromium Playwright. 독립 편집 시험은 실제 v3 mount의 production 번들을 메모리에서 빌드하여 G7 없는 페이지와 주입 저장 포트에 연결한다. 아래 초기 기록은 당시 독립 fixture의 글꼴 대체 조건을 포함한다. 마지막 로컬 글꼴 통합부터는 fixture도 제품과 동일한 Inter 자산·빌드 플러그인을 사용하며 시스템 글꼴 대체와 외부 import 제거 전용 fixture를 없앴다.

| 검사 | 명령/범위 | 확인한 결과 |
|---|---|---|
| 명령·조작 세션·UI | 관련 Vitest 4파일 | 38개 통과(geometry 17·gesture 8·adapter 6·structure 7), far-anchor 보완 포함 |
| 타입·구조 | `tsc --noEmit`, 변경 소스 구조 검사 | 통과, 신규 구조 위반 0 |
| 실제 통합 브라우저 | `structureEditorV3.spec.ts --retries=0` | 13개 시나리오 × 3개 Chromium profile = 39 통과, skipped/flaky/unexpected 0 |
| 접근성 | Axe `main`, WCAG 2 A/AA 태그 | 세 profile 모두 위반 0, 규칙 통과 21; 전체 제품의 접근성 인증을 뜻하지 않음 |
| 독립 편집 번들 | 동일 테스트의 gzip 상한 검사 | JS 465,818 / 508,500 bytes, CSS 18,216 / 45,200 bytes |
| 기존 제품 번들 | production build·기존 예산 검사 | JS 508,316 / 508,500 bytes, CSS 45,020 / 45,200 bytes; 상한 변경 없음 |
| 의존성 승격 전체 검사 | `task-integrate-scoped ... FULL=1` | 품질 gate 통과, 기존 제품 브라우저 49·Site Shell 45 통과 |

브라우저의 tablet/mobile profile에서도 편집 host viewport는 1440×1000으로 고정했다. 이는 UA/입력 설정 회귀 확인이며 모바일 기기 자체 편집 UX나 IP6의 세 반응형 캔버스 완료가 아니다.

통합 브라우저 증거:
`output/playwright/gates/integration-ip5-20261012/47b398513168c87bd6d1cd4df4d1cf520fb32704357976a50f26dc88c041f33c/7b4afd9345ef4a44b1844ecf62688bd6/`

이 디렉터리의 `execution.json`, `results.json`, HTML report, 50/100/200% 핸들·화면 맞춤·구조 DnD·본문/출력 스크린샷과 JSON 첨부를 보존한다. 결과 통계는 expected 39, skipped 0, unexpected 0, flaky 0, errors 빈 목록이다. 독립 포트 첨부의 저장 JSON·bundle bytes와 `ip5-accessibility`의 원본 Axe 결과도 확인했다.

통합본 50%·200% 캔버스 스크린샷을 직접 열어 선택 테두리·고정 크기 핸들·레이어 선택·Inspector 배치와 작업면 clipping을 확인했다. 표시용 테스트 요소는 제품 콘텐츠가 아니며 이 검토를 전체 카탈로그 시각 수용으로 대체하지 않는다.

핵심 시나리오는 다음을 검증한다.

- 리사이즈 표시 초안은 pointer-up 이전 문서를 바꾸지 않고 한 번만 확정한다. 비율 잠금·스냅·Esc·조작 중 Undo/Redo·저장/재열기가 CSS px 값과 일치한다.
- Shift/영역 선택, 그룹 리사이즈의 크기/위치 비례, 그룹 포인터 이동, 회전 핸들/15도 도구, 정렬/간격 분배, 혼합값 단일 속성 변경이 한 Undo로 원본 전체를 복원한다.
- 50/100/200%의 Puck 구조 drop과 긴 페이지 스크롤 좌표, 팬·화면 맞춤, 키보드 이동을 확인한다. 텍스트/Inspector 입력·IME·readonly는 정밀 조작 단축키로 변경되지 않는다.
- 이전 IP3/IP4의 구조·잠금·자산·rich text·부분 서식·한글 조합·미리보기/PHP 초안 1px 출력 일치 검사를 그대로 포함한다.

## 실패 발견과 해소, 원복

개발 중 재현한 DOM 교체 후 핸들 위치 이탈, 부모 안 영역 선택 조기 종료, 그룹 이동 입력 경합, 텍스트 모드의 Puck disabled 의미, 포커스 이탈 확정, 조작 중 Undo 우회와 오래된 표시 초안 복원을 각각 제품 코드에서 수정했다. 회귀 기대값을 낮추지 않았다. Moveable이 이미 max-width를 제한하는 경우는 정상 한 번 변경/Undo로 검증하고, 실제 렌더와 typed 치수가 1px를 넘게 어긋나는 경우는 거부한다.

첫 의존성 FULL 실행은 원래 `jwsoft-business01 0.3.1` 테마에서 16 failed·2 flaky·31 passed였으므로 합격 증거로 사용하지 않는다. 이 테마는 기존 공통영역 adapter의 지원 프로필 밖이다. 이미 승인된 Local 임시 전환 권한으로 `sirsoft-basic 1.1.4`에서 재실행하여 49+45를 통과했다. 제품 지원 조건·테마 파일·검사 기준은 바꾸지 않았다.

공개 `php artisan template:activate`만 사용하고 정상/실패 종료 EXIT trap에서 원래 `jwsoft-business01 0.3.1`을 복구했다. 두 테마 관련 1,667개 파일의 경로+내용 SHA256 집계는 전후 `7f475f534038b988f524bd45f7e7b27fd4eb4df8caa4d012f4841dc03d64f332`로 같다. 성공 FULL의 Site Part journal `bb9d41d52725e7142e491282ad6360ee343f372bd0594503bb1ce084c13c25bb/e8f4f023a36b4b7593c4b6ae18453ddd/site-part-state.json`은 16세션 전부 restored=true, closed=true다.

첫 최종 FULL은 기존 제품 49개 중 47 passed·1 failed·1 flaky였다. Header preset 캡처는 최초/재시도 모두 `waiting for fonts to load`에서 10초를 초과했고, 세트 작업면 캡처도 같은 대기에서 한 번 실패했다. 저장/Undo assertion 실패는 아니지만 해당 시험 전체의 합격으로 집계하지 않는다. 원본 실패 결과·HTML report는 `output/playwright/ip5-final-font-failure-20261012/`에 보존했다. 이 실패 종료에서도 원래 테마와 동일 파일 해시를 확인했다.

동일 Docker Chromium의 격리 읽기 전용 진단에서 Puck 원본 Inter CSS는 약 3.2초, 사용한 SemiBold는 7.9초, Regular는 11.3초에 완료됐다. 외부 글꼴 준비와 캡처 action의 경합을 줄이기 위해 `sitePartLifecycle.spec.ts` 한 파일의 네 캡처에서 현재 host/iframe의 실제 `document.fonts.ready`를 먼저 기다린다. 글꼴 교체·요청 차단·폰트 대기 생략·타임아웃 증가·성능/시각 기준 변경은 하지 않았다. 기존 240초 test 제한과 10초 capture action 제한을 유지했다. 등록/타입/관련 하네스 81개 통과는 제품 실행 성공과 구별하고 최종 FULL에서 실제 시나리오를 다시 확인한다.

추가 점검에서 단일 absolute 요소의 left/top이 없거나 auto이고 right/bottom으로 고정된 경우, 동/남쪽 핸들로 크기만 늘리면 원점이 반대로 밀리는 명령 누락을 회귀 2건으로 재현했다(수정 전 15 passed·2 failed). 해당 축에만 측정된 left/top을 확정하고 충돌하는 far anchor를 해제하도록 보완했다. 기존에 지정된 near anchor와 다른 속성은 보존한다. 수정 후 geometry 17·gesture 8·adapter 6·structure 7, 합계 38개와 타입·구조·관련 하네스 81개가 통과했다. 통합 브라우저 39개도 통과했으며 세 profile에서 실제 우하단 핸들로 160×80→200×120 크기를 바꿀 때 원점 80,80과 한 Undo 복구를 확인했다. 증거는 `output/playwright/gates/integration-ip5-20261012/dcfcf5de5b3130a4d9d0cd802b7895254ae8975cf56828d70b1afa911924b051/6451eb2ac2b14a54ae850dc0a760b989/`에 보존한다.

폰트 준비 보완 뒤 `2b2491f397829636752ca4ba2f5f6864e82803c1`의 품질 gate는 frontend 1,140개·기존 브라우저 49개·Site Shell 45개를 통과했다. 다만 이 검증이 도는 중 위 보완 task를 먼저 제출하여, 종료 단계의 미통합 제출분 검사에서 최종 verified 기록이 거부됐다. 이는 제품 시험 실패가 아닌 작업 순서 실수이며 당시 `integration-verify` 성공으로 보고하지 않는다. 성공 시험과 원복 증거를 보존하고 보완분 통합 뒤 최종 HEAD를 다시 검증한다. 당시 Site Part journal `151c02ab30a28fd6d0a0d73255a78553d0c84e6cda89915668f3595715632725/16159b362c254be3bcc03e6a2263e1dc/site-part-state.json`은 16세션 전부 복구·종료됐고 테마 파일 해시도 같았다. Site Shell 결과와 글꼴 준비 후 생성된 Header·Footer·세트 캡처는 `output/playwright/ip5-font-ready-full-20261012/`에 보존한다. 이 중 Header 프리셋 캡처를 직접 열어 글꼴·레이아웃을 확인했다.

## 초기 최종 검사 실패와 원인 확정

`8e0428efc21283ae7d54cfbdd6917f4486841b67` FULL에서는 기존 언어/치수 비교의 편집기 진입이 `page.goto`의 `load` 대기 20초를 초과했다. 편집기·글꼴·치수의 실제 판정에 들어가기 전 실패였다. 실패가 확정된 실행의 Playwright runner에 정상 SIGINT를 보내 종료했고, 15 passed·1 failed·1 interrupted·32 did not run으로 기록했다. 중단된 Header 시험과 미실행 항목은 합격으로 집계하지 않는다. Site Part 4세션은 controller의 restore-all에서 모두 복구·종료됐고 원래 테마와 파일 해시도 복구됐다. 중단 시각의 fixture 문서 잔존은 공개 API의 active 목록 두 페이지에서 식별된 제목·slug 시간 범위로 확인했으며 일치 항목은 없었다. 실패 결과는 `output/playwright/ip5-navigation-failure-20261012/`에 보존한다.

`editorLayoutParity.spec.ts` 한 파일의 공통 `assertScenario` 진입만 `domcontentloaded`로 변경했다. 그 아래 기존 editor 표시·편집 모드·정확 block 수·제품 스타일·실제 `fonts.ready`·이미지 준비·안정된 치수·1px 출력 비교를 그대로 유지한다. 20초 navigation·전체 test 제한·성능/시각 기준과 대상 27개는 변경하지 않았다. 관련 하네스 81개·수집 27개·타입을 통과했고, Local의 실제 실패 시나리오(ko/en/ja 작성·미리보기·발행)도 1 passed로 확인했다. 해당 JSON·HTML·캡처는 `output/playwright/ip5-parity-readiness-probe-20261012/`에 보존한다.

모든 제품 소스 제출분을 통합한 `a27e47c99a1ca8bb20d142a6f861ef40f8660fd5`의 `make integration-verify TASK=integration-ip5-20261012 FULL=1`은 기존 제품 48 passed·1 failed로 종료했다. 회사 소개 Page Kit의 editor 진입에서 이번에는 `DOMContentLoaded` 자체가 20초를 초과했다. Site Shell 후속 45개는 이 실행에서 실행되지 않았다. 실패 report와 결과 디렉터리는 `output/playwright/ip5-dcl-failure-20261012/`에 보존했다. Site Part journal `41934846e152ab4ce6c7009871f74a606fc600af28d5e2c5a9841f7625eb1699/95172ba93cdb4de2879a8de15ade33c3/site-part-state.json`은 closed=true, 10세션 모두 restored=true다. 원래 테마와 동일 1,667파일 해시도 복구됐다. 의존성 delta가 요구하는 FULL gate와 성공 receipt 규칙을 우회하지 않았으며 최종 verified 기준은 IP4에 남아 있다.

최종 제품 소스의 관련 Vitest 77개(동일 입력 성공 재사용 포함)와 독립 브라우저 39개(재시도/건너뜀/실패 0)는 통과했다. 위 FULL 품질 검사에서는 하네스 466개, PHP 일반 342개/3,358 assertion·coverage 415개/3,990 assertion과 G7 integration 73개/632 assertion이 통과했다. PHPUnit의 기존 notice 1개는 남아 있다. 프런트엔드 133파일·1,142시험과 전체 커버리지/타입/CSS/구조/build/asset/budget도 통과했다. V8 집계는 statements 82.75%, branches 77.81%, functions 78.71%, lines 86.14%다. 기존 100블록 성능 시험도 상한 내였지만 이를 새 v3 편집기의 성능 수용으로 주장하지 않는다. 기준을 낮추거나 검사를 제외하지 않았다.

최종 제품 소스의 독립 브라우저 증거는 `output/playwright/gates/integration-ip5-20261012/c50fe7f5ca207478470ec739d41ff9a627211493ba57b7bd7a3505ac6abc75c2/8b8cba85e8ab46529f84ad413235e67f/`에 보존했다.

### 외부 글꼴 CSS 차단의 실제 재현

`editorLayoutParity.spec.ts` 한 파일에 page 진입 동안의 request/finished/failed 계측만 추가했다. URL은 origin/path만 보존하고 query·자격정보·headers·body는 기록하지 않는다. 원래 오류는 그대로 실패하며 navigation 20초·시각/성능 기준·대상은 유지했다. 관련 하네스 81개·타입·27개 수집 검사를 통과한 뒤 공식 제출/통합했다. 이는 제품 코드 변경이나 외부 글꼴 문제의 수정이 아니다.

통합 `bcb3ffba51fe6ec468b4dd59ab59ad804ecba14d`에서 실제 회사 소개 시나리오를 `--project=desktop --repeat-each=10 --retries=0 --forbid-only`로 한정 실행했다. **9 passed·1 failed**, 여섯 번째 실행에서 같은 진입 실패가 재현됐다. 증거는 `output/playwright/ip5-navigation-diagnostics-20261012/results.json`, `report/`, `results/`에 보존한다. 각 실행의 `entry-navigation-network` JSON 첨부에 요청별 시간과 완료/잔류가 기록됐다.

실패 순간 elapsed=20,009ms였다. 로컬 HTML은 시작 후 약 100ms, editor CSS는 약 220ms, JS는 약 273ms에 모두 완료됐다. 미완료 요청은 220ms에 시작된 `https://rsms.me/inter/inter.css` 단 하나였다. 성공한 아홉 실행에서는 같은 외부 CSS가 1,229~11,612ms 걸렸다. 고정 Puck 0.23.0의 `dist/index.css` 첫 줄과 실제 PB production CSS의 외부 `@import`를 대조했다. 이 재현에서는 외부 CSS가 stylesheet/실행 준비를 막아 DCL 제한을 넘겼음을 확인했으며 IP5 문서 명령 실패로 분류하지 않는다. 단, 외부 서버·네트워크 중 어느 구간의 지연인지는 이번 증거만으로 단정하지 않는다.

반복 실행 뒤에도 원래 `jwsoft-business01 0.3.1`과 동일 1,667파일 해시를 확인했다. 임시 파일 삭제·증거 삭제·운영 배포는 하지 않았다. 원인을 찾기 위한 FULL 반복은 여기서 중단했다. 외부 font 차단으로 시험만 녹색화하거나 timeout을 올리지 않는다. 동일 글꼴의 버전 고정 자체 배포는 추가 자산·라이선스/배포 검토가 필요하고, 시스템 글꼴 교체는 기존 편집 UI의 시각 변경이므로 이번 IP5 범위에서 임의 적용하지 않았다. 후속 범위 확정 뒤 관련 회귀와 최종 FULL을 통과해야 IP5 완료 처리와 IP6 착수가 가능하다.

현재 직접 좌표 이동·회전·정렬/분배와 그룹 크기 조절은 검증된 같은 부모 absolute 문맥에서 사용한다. flow는 구조 순서를 바꾸며, 회전된 조상의 좌표 변환·회전된 묶음의 그룹 리사이즈·absolute 부모 변경은 안전하게 거부한다. 이를 영구 제외 정책이나 전체 피그마 동등성으로 주장하지 않는다. typed Inspector의 기존 값과 원본은 보존한다.

독립 v3 mount·주입 초안 포트 기준의 구현이다. 기존 G7 진입 화면/서버 저장·발행 전환, 기존 문서 자동 이행, IP6 반응형 override, IP7 전체 카탈로그/Site Part 확장, IP9 운영 저장·발행, IP10 최종 제품 수용과 배포는 미실행이다. 다음 차수는 IP6이며 범위를 앞당기지 않는다.

## 승인된 Inter 로컬 배포 보완

외부 글꼴의 버전 고정 자체 배포 제안에 대한 사용자의 후속 진행 지시로 이 범위를 시작했다. 기존 글꼴을 다른 글꼴로 바꾸지 않는다. [공식 Inter 4.1 릴리스](https://github.com/rsms/inter/releases/tag/v4.1)의 원본 WOFF2 18개(100~900, normal/italic)를 가져와 기존 CDN 4.1 파일과 각각 바이트 일치를 확인했다. 원본 [OFL-1.1 LICENSE.txt](https://github.com/rsms/inter/blob/v4.1/LICENSE.txt)와 저작권 표시를 수정 없이 함께 배포한다. 서브셋·변환·이름 변경은 하지 않았다. Puck/PB가 사용하지 않는 InterVariable·InterDisplay family를 새로 포함하지 않는다.

| 항목 | 고정값/검증 |
|---|---|
| 공식 ZIP SHA256 | `9883fdd4a49d4fb66bd8177ba6625ef9a64aa45899767dde3d36aa425756b11e` |
| 기존 CDN CSS SHA256 | `46d01c7807f64a24c1b2853b756ef15f3a2facdf4a9f066eaf5d39c0c9935441` |
| 자산 manifest SHA256 | `ce3810bd4fe9fa9bd8179d8ddb4dc3c0c197ed2f30ba6bee6402076aafc1a958` |
| 추가 원본 글꼴 크기 | 18개, 합계 2,093,804 bytes; JS/CSS gzip 예산과 별도 명시 |
| 소스/빌드 자산 | 원본 21파일, 배포 출력 22파일(생성 CSS 포함); 기존 payload 목록에 양쪽 LICENSE 포함 확인 |

`scripts/vendor-inter-fonts.mjs`는 고정 원본 ZIP/CSS를 검증하는 일회성 생성기다. 빌드나 고객 서버에서 다운로드하지 않는다. `vite.inter-fonts.ts`는 고정 Puck 0.23.0 CSS 해시와 모든 파일의 해시/크기를 확인한 뒤 원래 18개 font-face와 Inter feature alias를 유지하고 URL만 로컬 상대 경로로 바꾼다. 내용 해시가 들어간 `fonts/inter-4.1-ce3810bd4fe9/`에 출력하여 기존 immutable 캐시와 구분한다. 누락·변조·미검토 벤더 CSS는 빌드 실패이며 fallback으로 숨기지 않는다. 기존 자산 검사에서 배포 파일과 import를 재확인한다. 기존 release payload의 포함 목록만 읽기 전용 점검했으며 릴리스 패키징·배포는 실행하지 않았다.

| task | 제출 SHA | 통합 SHA |
|---|---|---|
| 검사 범위 등록 `ip5-font-scope-20261012` | `3757d057e0e29581f6c554103286d9a741a5dc6f` | `402bd6c79f71996f17d68726b1a013a50a91fd20` |
| 원본 자산·무결성 `ip5-local-font-assets-current-20261012` | `b271e688e6bdcb52db0ccfd5c402ffa0baeff02d` | `c58a1e83ba0003015cd63eccdba32a0d063332b2` |
| 제품/fixture 연결 `ip5-local-font-runtime-current-20261012` | `8f1320c9a3b96b1927bdb7b7d881d67e7f5aa9c4` | `c58a1e83ba0003015cd63eccdba32a0d063332b2` |

자산 작업은 정확 24파일, 연결 작업은 별도 소유 범위로 나눴다. 새 검사 등록과 새 자산 기준을 상속할 때에는 공식 active-replacement로 이전 dirty 작업과 이력을 보존했다. 서로 의존하는 두 최종 제출은 공식 batch로 통합했다. 검사 기준·타임아웃·의존성 버전은 바꾸지 않았다.

통합 batch에서 글꼴 무결성 unit 3개·기존 Puck 보정 unit 9개·타입·자산 빌드와 관련 브라우저 43개가 통과했다. 브라우저는 실제 관리자 편집기의 로컬 글꼴/캐시 2개, 실제 Inter를 사용한 독립 v3 39개, 기존 Inspector 2개다. 실제 편집기에서 18개 face 모두 decode/loaded, 동일 origin HTTP 200, 원본 바이트 일치와 외부 글꼴 요청 0건을 확인했다. `rsms.me` 요청이 발생하면 시험에서 실패하며 외부 차단을 글꼴 대체 수단으로 사용하지 않는다. 편집기 PNG를 직접 열어 렌더도 확인했다.

증거는 `output/playwright/gates/integration-ip5-fonts-20261012/` 아래에 보존한다.

- 글꼴/캐시: `f0639ef36fbb547e1db29f75343d60f036da43b2197e03602a94d08d76b24e04/f02c4eaabd514aeeb12b816d4dabe551/`
- 독립 v3: `9049f18c01dbb0901ca5e0bc1266e72d826a0f5c428c72deba80a28a7d318603/bd39f1fdf2d0420fb416ced44aeb44ad/`
- 기존 Inspector: `5a59bfc6f892a116fd165f7baf414bafd5330a6c0c16905734f01da40d6ccd65/e97d867c7dc14f22b52202806701e573/`

이 통합 종료에서도 원래 `jwsoft-business01 0.3.1`을 복구했고 1,667파일 집계 해시가 같았다. IP5의 아직 미검증인 의존성 승격과 이전 FULL 실패를 마감하기 위해 최종 전체 검증을 명시적으로 실행한다. 단순 글꼴 변경만으로 전체 검사를 반복하는 것은 아니며, 실행 중 문서 task는 제출하지 않는다.

### 동일 실패 시나리오 10회 재검증

`c58a1e83ba0003015cd63eccdba32a0d063332b2`에서 같은 회사 소개 Page Kit를 `--project=desktop --repeat-each=10 --retries=0 --forbid-only`로 실행하여 **10 passed, skipped/unexpected/flaky 0**을 확인했다. `entry-navigation-network`의 DCL 진입은 349~472ms였고 로컬 Inter CSS 요청은 78~124ms에 완료됐다. 10회 모두 미완료 요청과 외부 origin 요청이 0건이었다. 이는 이 로컬 반복 시나리오의 관찰값이며 모든 고객 환경의 성능 보장은 아니다. 증거는 `output/playwright/ip5-local-font-navigation-20261012/results.json`, `report/`, `results/`다.

실제 Inter로 다시 생성된 독립 v3의 50%·200% 화면도 직접 열어 선택 테두리·핸들·레이어/Inspector와 확대 작업면의 clipping을 확인했다. 본문의 테스트 도형은 기능 검증 fixture이며 최종 제품 UI 디자인이나 전체 카탈로그 시각 승인으로 집계하지 않는다.

## 최종 전체 검증과 차수 마감

`make integration-verify TASK=integration-ip5-fonts-20261012 FULL=1`은 2026-10-12 11:15:22 UTC에 정상 종료하고 **`c58a1e83ba0003015cd63eccdba32a0d063332b2`를 full verified**로 기록했다. 기준은 마지막 신뢰 IP4 SHA `b8b90caca345284362fa8b9b65071ea70b63f91d`다. 모든 제품 제출분을 통합한 뒤 실행했으며 검사 중 새로운 task를 제출하지 않았다.

| 최종 검사 | 결과 |
|---|---|
| Python 검사 하네스 | 469개 통과 |
| PHP 일반 / 커버리지 실행 / G7 통합 | 342개·3,358 assertion / 415개·3,990 assertion / 73개·632 assertion; 커버리지 기준 통과, 기존 PHPUnit notice 1개 유지; 서로 중복되는 시험을 합산하지 않음 |
| Frontend 전체 | 134파일·1,145개 통과; V8 statements 82.75%, branches 77.81%, functions 78.71%, lines 86.14%; 기존 기준 유지 |
| 정적/빌드/자산 | 타입·CSS·PHPStan·Pint·구조·production build·manifest·글꼴 무결성·기존 예산 통과; 블록 품질은 기술 검사이며 사람의 상품 승인/배포가 아님 |
| 관련 실제 브라우저 | 로컬 글꼴/캐시 2개 + 독립 v3 39개 + 기존 Inspector 2개 통과; skipped/flaky/unexpected 0 |
| 기존 전체 브라우저 | 제품 49개 + Site Shell 45개 통과; 원래 실패했던 회사 소개 진입·Header 캡처도 성공 |
| 독립 v3 접근성 | 세 profile 모두 Axe main WCAG 2 A/AA 자동 위반 0·통과 규칙 21·자동 판정 불가 2; 키보드/IME/readonly 별도 동작 시험 통과; 전체 접근성 인증을 뜻하지 않음 |
| 최종 번들 gzip | 독립 v3 JS 465,818 / 508,500, CSS 18,247 / 45,200 bytes; 기존 제품 JS 508,316 / 508,500, CSS 45,028 / 45,200 bytes |
| 추가 글꼴 자산 | 원본 WOFF2 합계 2,093,804 bytes와 생성 CSS 약 4.05KB를 별도 배포; 기존 JS/CSS 예산 수치에 숨겨 합산하지 않음 |
| 기존 100블록 성능 | 준비 1,235.9ms, 입력 p95 105.9ms, drag 952.4ms; 기존 상한 내이며 새 v3 전체 성능 수용으로 대체하지 않음 |

최종 관련 브라우저의 재실행 증거는 같은 `output/playwright/gates/integration-ip5-fonts-20261012/` 아래에 있다.

- 로컬 글꼴/캐시: `f0639ef36fbb547e1db29f75343d60f036da43b2197e03602a94d08d76b24e04/fd707144ac0049d69507b73a8701639b/`
- 독립 v3: `9049f18c01dbb0901ca5e0bc1266e72d826a0f5c428c72deba80a28a7d318603/8397b3de2fef4f0e9107c78b2166345f/`
- 기존 Inspector: `5a59bfc6f892a116fd165f7baf414bafd5330a6c0c16905734f01da40d6ccd65/e7b6a611dc7c4b7eb959b743c90b96e0/`

전체 제품 49개와 Site Shell 45개의 HTML report를 각각 `output/playwright/ip5-local-font-full-20261012/product-report/`, `site-shell-report/`에 복사 보존했다. 같은 디렉터리에 `site-shell-product.json`의 source fingerprint 성공 기록도 보존했다. FULL Site Part journal `1ff129ae6d8d518e9c3c1978a2e1a3986d6b561608b81cfa7ab08281f163381d/6d8dde8dbae14622b997cd9453512593/site-part-state.json`은 16세션 모두 restored=true이고 closed=true다. EXIT trap 뒤 `jwsoft-business01 0.3.1` 복구와 1,667개 테마 파일의 동일 SHA256 집계를 다시 확인했다.

이 근거로 IP5를 완료하고 원장·표시판·계획을 5/10으로 일치시킨다. 완료 문서 통합 후에는 검증된 제품 소스를 반복 검사하지 않고 문서 delta만 확인한다. 다음 IP6는 데스크톱 host에서 PC/태블릿/모바일 폭의 직접 편집과 base/override/reset·경계 폭·출력 일치이며 이번 차수에 구현하지 않았다. 독립 v3의 G7 운영 진입/저장·발행 연결, 기존 문서 자동 이행, 전체 피그마 동등성, 배포 완료를 주장하지 않는다. 임시파일·보존 worktree 삭제와 원격 push도 하지 않았다.
