# 제품 수용 잔여 목표 · 재개 기록

2026-10-14 · 기준 `c79a463723a574951ffa3d1a2a9a7188455a7492` · 목표 진행 중

## 사용자 승인과 완료 조건

사용자가 두 예외를 직접 승인했습니다. 기존 범위의 결함은 1회 뒤에도 재수정할 수 있으나 실패 항목과 직접 영향만 확인합니다. 테마는 현재 jwsoft-business01의 모바일 헤더 넘침만 수정할 수 있습니다. 코어 수정·기존 문서 전환/삭제·블록별 편집기·무관한 기능/검증 확대·byte 크기 제한 부활은 금지합니다.

기존 한정 인계와 현재 제품 완료를 혼동하지 않습니다. IP7~IP10의 필수 미수용과 릴리스/배포 증거가 남으면 목표를 완료 처리하지 않습니다. 기존 [최종 한정 감사](2026-10-14-remaining-nine-final-audit.md)와 실패 후보는 보존합니다. 현재 integration/runtime task는 `integration-acceptance-closeout-20261014`입니다.

## 고정 잔여 범위

| 항목 | 처리 범위 | 상태 |
|---|---|---|
| ACCESS-KBD | 공통 canvas 설명·레이어 구조 명령/정밀 키/Undo | 소스 통합·관련 69 unit·실제 내장 입력 확인 |
| TEXT-IME | OS 네이티브 조합의 실제 입력/Undo 경계; 합성 이벤트와 구분 | 자동화 경계로 미확보, 직접 입력 요청 |
| HOST-CURRENT | 현재 G7 7.1/설치 sirsoft-basic 조합의 공식 연결/원복 | 1.2.0 적용·마지막 발행 쌍 출력·원복 확인 |
| TEMPLATE-OWNER | 승인된 JWsoft 모바일 헤더 넘침만 보완 | 별도 저장소 d3619db3 구현·내장 확인·push, 테마 전체 릴리스 아님 |
| PROVIDER-FRAME | 같은 네 프레임의 생성/해제와 초기 교체 소유권, 유효 Vimeo 표본 | 초기 host 교체 1회 관찰·표본 교체 완료, Vimeo 실재생 실패는 보존 |
| PERF/UI | 현재 100/500노드·긴 페이지와 기존 구성 중 미확보 증거만 | 성능/긴 작업면 확인, 전체 대상 UI 수용은 미완료 |
| RELEASE | 정식 수용·새 SemVer·패키지·push·g7devops 배포와 최소 실환경 확인 | 기존 선택 자동 gate·필수 미수용 해결 전 보류 |

## ACCESS-KBD 공통 입력 안내

`canvas-input-guidance-20261014`는 Puck 0.23.0에 없는 KeyboardSensor를 추가하거나 vendor를 patch하지 않습니다. PB가 소유한 구조 모드의 키보드 경로는 레이어 선택과 속성의 위/아래/선택 위치 이동이며, 정밀 모드의 화살표는 기존 flow 순서 또는 absolute 좌표 명령입니다. Escape 취소·Tiptap 입력·readonly/단일 history 계약을 유지합니다.

현재 캔버스의 부모 문서에서 온 sensor 설명만 PB 입력 안내로 복사합니다. 같은 문서의 작성자 설명과 진짜 미지 참조는 그대로 두고 원본 vendor DOM은 수정하지 않습니다. 해제 시 자신이 소유한 속성/설명만 복구합니다. 관련 helper 회귀·기존 구조 회귀/타입·실제 내장 브라우저의 키보드 경로만 확인하며 자동 전체 E2E/coverage를 추가하지 않습니다. 구현/검사/실동작/배포는 각각 별도 기록합니다.

## 현재 소스와 실제 내장 브라우저 결과

소스 `c6863fc934756b28b27a4cb7afc682cfad29b684`, main 통합 `8d00fe4fb4f0d4fbc93bcddf402353f0d1127f22`, 성공 build fingerprint `d41ce1689e6d8ff8a71f25fb97d2a81da8c2079fdbbb63ffdd43d23dc31dc3d6`입니다. source 제출/통합은 `IMPLEMENTATION=1`로 runtime gate를 보류했으며 제품 수용으로 승격하지 않습니다. 관련 단위 69개·타입·구조는 통과했습니다. source 제출 영수증 `submission-7f6c79c701974b9cbe2902dab68e2197`, 통합 영수증 `integration-5963e2aa885940eebccfb34ddcca436c`입니다.

### ACCESS-KBD

소유 문서 `2259399f-41f3-4800-9b26-aec7ae277e59`의 iframe 내부 8개 요소에서 PB 안내가 iframe-local ID로 연결됐습니다. 실제 Enter로 레이어 선택/위로 이동, 한 번의 Undo로 원래 ID 순서 복귀, 정밀 모드 화살표의 flow 이동/한 Undo를 확인했습니다. 저장 전후 서버 lock 7→8, 원본 JSON은 정확히 일치했습니다. vendor KeyboardSensor나 Space drag 구현 성공을 주장하지 않습니다.

`output/playwright/closeout-keyboard-iab-20261014.{json,png}`에 기록했습니다. Undo가 첫 이미지를 선택한 경계에서는 ArrowUp이 정당한 no-op이므로, 계정 요소를 명시적으로 재선택해 해당 입력을 확인했습니다. disabled Undo를 기다린 도구 오류를 제품 실패로 바꾸지 않습니다.

### 현재 100/500노드와 긴 페이지

| 노드 | 준비 최초 관측 상한 | 포인터 레이어 선택→DOM | 키보드 레이어 선택→DOM | 아래로 명령→DOM |
|---|---:|---:|---:|---:|
| 100 | 1,969.4ms | 37.5ms | 42.5ms | 113.0ms |
| 500 | 3,903.9ms | 150.6ms | 134.8ms | 497.9ms |

실제 설치 편집기/소유 문서/1280×720에서 같은 현 build를 관측했습니다. 기존 준비 10,000ms/조작 1,000ms 기준 안입니다. 최초 관측 상한과 단발 event-to-DOM 측정이며 p95·cold-cache·drag-frame latency·장시간 부하 시험은 아닙니다. 두 경우 한 Undo로 전체 DOM ID 순서가 돌아왔습니다. 500은 저장 후 서버 lock 2→3, 공식 revision 2/3의 재귀 canonical JSON이 정확히 일치했습니다. raw JSON byte 해시 차이는 객체 키 직렬화 순서이며 의미 변경이 아닙니다. 저장 완료 전 도구 대기가 끝났지만 UI `저장됨` 확인 뒤 읽기만 했고 Save를 반복하지 않았습니다.

100/500의 작업면 clientHeight 487px에서 각각 scrollTop 1,455/8,712px로 마지막 요소에 도달했습니다. 마지막 요소 bottom 630.66/629.91px은 작업면 bottom 690px 안이고 바깥 body/html 높이는 720px로 유지됐습니다. `closeout-performance-{100,500}-iab-20261014.json`, `closeout-long-page-iab-20261014.png`에 보존합니다.

캡처에서 2번 레이어 선택과 90번 줄의 파란 강조를 선택 오류 후보로 보았으나, 포인터를 속성 제목으로 옮기자 그 강조만 사라졌습니다. 실제 selected overlay는 2번 좌표 `top:60px`를 유지했고 별도 hover였습니다. 추가 제품 수정은 하지 않았습니다. 이 결과를 전체 구성/모든 zoom의 UI 합격으로 확대하지 않습니다.

### 현재 지원 호스트와 원복

Local integration/runtime lease 아래 G7 공개 `TemplateManagerInterface::activateTemplate()`로 sirsoft-basic 1.2.0을 잠시 활성화했습니다. 기존 소유 세트 `e49fd4b4-45fc-4a08-93ec-a9fc23e079c0`의 마지막 정상 발행 Header/Footer를 공식 활성화 API로 연결했습니다. 실제 공개 DOM에 semantic `header`/`footer`와 `data-g7pb-element-site-part` 두 개가 나타났고 공개 Site Shell API는 HTTP 200이었습니다. v1 전용 test ID가 없는 v2 요소 공통영역을 누락으로 오판하지 않습니다. Header는 draft revision 4와 별도로 active revision 2가 유지됐습니다.

확인 직후 원래 활성 세트 `f55abc1f-fb1d-47df-8bec-753b6f165b7d`와 jwsoft-business01 0.3.1을 공개 경로로 복구했습니다. JWsoft 원본 헤더가 다시 표시되고 PB 요소 공통영역 DOM은 0이었습니다. API의 enabled 값 자체와 호환 프로필 적용 여부는 다릅니다. 원본 페이지/테마 layout/초안은 편집하지 않았고 미저장 Footer 탭은 보존했습니다. `closeout-supported-host-iab-20261014.{json,png}`에 기록했습니다.

### 승인된 테마 모바일 헤더만 수정

별도 저장소 `/Users/neojins/workspace/jwsoft-g7-themes`의 commit `d3619db3d1f700d78509bfc85c0595310fc38213`을 push했습니다. 정확 변경은 `assets/public/css/mobile-header.css`, 그 생성 자산 `dist/css/mobile-header.css`, template manifest의 CSS 항목 한 개입니다. 기존 다른 dirty 소스/생성 번들과 staged rename 두 건은 보존했습니다. 새 static 원본은 기존 Vite publicDir에서 고유 임시 outDir로 빌드하고 해당 출력만 반영했으며 다른 번들을 덮지 않았습니다. 현재 배포한 테마 버전을 재발행하거나 테마 전체 상품 완료를 주장하지 않습니다.

345px에서 중복 관리자/마이페이지 anchor는 기존 모바일 메뉴 안에 유지하고 헤더의 logout/menu 버튼은 남겼습니다. menu right 396.52→314px, logout right 348.52→266px, 두 버튼 높이 44px, document scrollWidth 330px/client viewport 345px입니다. 모바일 메뉴의 두 목적지와 닫기, PC에서 기존 계정 링크 표시를 확인했습니다. PB 전역 CSS나 G7 코어를 고치지 않았습니다. `closeout-theme-header-iab-20261014.json`, `closeout-theme-mobile-{header,menu}-iab-20261014.png`를 보존합니다.

### 작성 프레임과 Vimeo

같은 소유 제공자 문서 `34911321-7bf9-4175-b819-79cbc52f594a`의 Vimeo ID만 [공식 Vimeo 예제](https://help.vimeo.com/hc/en-us/articles/30021987305873-How-do-I-embed-parameters-to-a-Vimeo-com-URL) `76979871`로 UI에서 변경·저장하고 미리보기를 준비했습니다. 기존 404 표본을 실제 성공으로 취급하지 않습니다.

navigation 476.2ms에 작성 iframe 0개인 상태부터 관찰했습니다. 1,497ms에 네 프레임이 생겼고 1,741.8ms에 host `jw-html-content`/`page_builder_preview_content` subtree에서 네 개가 제거됐습니다. 새 marker에 대한 PB hydration으로 1,744ms에 네 프레임이 다시 생겼습니다. 이후 216.8초 관찰 끝에도 작성 프레임 4개/기록 9건으로 유지됐습니다. 소스와 mutation target에 따른 host HTML 교체 소유권 판정이며 정확한 auth trigger나 memory leak 부재까지 증명한 것은 아닙니다. PB의 주기적 중복 생성으로 판정해 코어/테마 본문 renderer를 고치지 않았습니다.

Vimeo player는 유효 표본의 컨트롤/01:02 길이를 표시했지만 실제 재생 시 내장 브라우저에서 `동영상 재생 불가`를 표시했고 time 0/readyState 0입니다. H264/VP9 지원 응답은 probably였으며, 네트워크 버퍼가 truncated라 전송 원인을 확정하지 않았습니다. 실제 재생 성공이나 완전한 provider 수용을 주장하지 않습니다. YouTube의 이전 실재생/정지·origin-only Referer 근거는 그대로 보존합니다. `closeout-provider-iab-20261014.{json,png}`에 실패와 수명 관찰을 함께 남깁니다.

### 실제 OS IME와 정식 gate의 남은 경계

네이티브 앱 제어는 환경 안전 제한으로 거부됐습니다. 지원된 내장 브라우저 키 입력은 trusted `insertText`만 발생했으며 compositionstart/update/end는 발생하지 않았습니다. 이것은 OS 한글 IME 실증이 아닙니다. 소유 문서의 두 시험 입력은 각각 Undo로 되돌려 두 제목 원문을 확인·저장했습니다. `closeout-ime-environment-iab-20261014.json`에 사실과 복구 범위를 기록하고 사용자 직접 한글 조합 입력을 요청했습니다. 합성 이벤트·붙여넣기·CDP 조합 주입으로 성공을 꾸미지 않습니다.

현재 `c79a4637..8d00fe4f`의 공식 verification 계획은 full=false/unresolved=0입니다. 기존 자동 브라우저는 `structureDocumentProduct` 13건, `structureEditorV3` 90건, `structureSitePartProduct` 2건, 합계 105건을 선택합니다. 새 시험/전체 coverage를 추가하지 않았습니다. 이 자동 gate는 별도 headless Chromium을 사용하므로 사용자에게 해당 자동 경로만의 허용을 요청했으며, 응답 전 실행하지 않았습니다. 내장 수동 영수증을 자동 gate 통과 JSON으로 위조하거나 docs-only 차수로 검증 기준 SHA를 승격하지 않습니다.

OS IME, 전체 대상의 미확보 UI/출력 수용, provider 실제 재생 한계, 정식 gate/새 버전 배포는 남아 있습니다. 완료 수는 여전히 6/10이며 목표 진행 중입니다. 원본 v1/v2 자동 전환, 코어 변경, 무관한 테마 변경과 비차단 파일 삭제는 없습니다.

## 제공자 단독 대조와 이어가기 경계

PB·G7·JWsoft 코드가 없는 동일 내장 브라우저의 `https://player.vimeo.com/video/76979871`에서도 실제 재생을 눌렀습니다. 최종 UI는 `저작권 문제`와 재생 인증 문제를 표시했고 media는 paused=true/time=0/readyState=0이었습니다. `output/playwright/closeout-vimeo-control-iab-20261014.{json,png}`에 보존했습니다. 따라서 현재 실패는 PB를 거치지 않아도 발생하며 PB만의 원인으로 확정할 수 없습니다. 이것은 제공자 전송/인증의 세부 원인을 확정하거나 Vimeo 실재생 성공으로 바꾸는 근거는 아닙니다. 임의 provider 우회·DRM/보호 해제·샘플 순회·host renderer 변경은 하지 않았습니다.

이어가기에서 원래 한글 시험 탭을 다시 읽었을 때 같은 28개 자동화 입력 이벤트와 composition 이벤트 0개, `저장됨`/구조 선택 상태였습니다. 실제 OS 조합의 새 증거가 생기지 않았으므로 이를 반복 입력하거나 합성하여 메우지 않았습니다. 기존 자동 gate의 별도 headless 경로 허용도 아직 사용자 응답이 없습니다. 제품 수용·release 검증 SHA를 승격하지 않고, 기존 활성 integration/runtime lease와 시험 세션을 보존합니다. 이 보충 기록은 정책 확정·코드 구현·제품 수용·배포 중 어떤 미완료 단계도 완료로 바꾸지 않습니다.
