# 잔여 1~9 한정 추진 · 최종 감사 인계

2026-10-14 · 제품 소스 `e05db53e7fde43e1b2a8bc23bcea16dea3d51a70`

## 판정

승인된 잔여 구현·제한 동작 확인·감사 판정을 마감합니다. **제품 수용 미완료이며 온라인 배포는 보류합니다.** IP1~IP6의 완료 기록은 유지하고 IP7~IP10은 진행 상태로 둡니다. 이 결과를 피그마 동등성·전체 카탈로그 합격·새 릴리스 승인으로 바꾸지 않습니다.

이번 감사는 새 전체 suite/coverage를 실행한 것이 아닙니다. 기존 성공의 소스·입력 경계를 유지하고 새 결함마다 제품 보완 1회만 수행했습니다. 남은 실패/미확보 항목은 아래 별도 재감사 범위로 인계합니다. 기존 문서 전환·삭제, 테마/코어 수정, 블록명별 편집기, 의존성 추가, byte 용량 기준 강화는 하지 않았습니다.

작업별 source/merge/검사/오류/원복 이력은 [목표 실행 원장](2026-10-14-remaining-nine-goal.md)에 보존합니다. 아래 판정은 앞선 기록의 미해결 상태를 지우지 않고 후속 증거와 연결한 결과입니다.

## 1~9 결과

| 항목 | 구현·확인한 결과 | 완료를 제한하는 경계 |
|---|---|---|
| 1 DATA05 | 공통 빈 이미지 표시 수정; 실제 22개 hidden/display none/높이 0 | 작성 원본과 다음 정상 이미지 표시 보존; 기존 실패 후보 보존 |
| 2 동적 6종 | 실제 6/12/1/1/1/1 응답, none/template/builder, 빈·권한·오류·지연, ID/참조 보존 | 실제 상품 1개/분류 없음; 다중 상품 조작은 명시적 브라우저 대역 |
| 3 문의·G7 컨트롤 | 문의 5종 기존 제품 시험, 실행 컨트롤 7종 mount, 계정·검색·통화·화면 모드, popup 3폭/Escape | 실운영 문의/메일/결제·알림 읽음 미실행; 언어 capability 없음, 전체 권한 조합 미확보 |
| 4 미디어 | 실제 업로드 201, 첫 이미지/취소/교체/alt/3폭 fit·초점, 한 Undo·저장/재열기 | 일부 지연은 정상 201의 통제 재생; 두 번째 실제 사용자 미확보 |
| 5 사용자 구성 | 저장/검색/독립 재삽입, 새 ID/참조 재연결, 복사본 편집, 라이브러리 삭제 무전파 | 연결형 컴포넌트 기능은 이번 계약이 아님 |
| 6 복원·저장 | 페이지 명시 복원/공개 artifact 유지, 새 비활성 Site Part의 Header 복원/다른 Footer 입력·Undo/발행 포인터 보존 | 과거 CAS/지연·쌍 발행의 당시 증거와 현재 전체 수용을 구분 |
| 7 UI·출력 | 레이어/작업면/속성 분리, 독립 mount CSS 누락 수정, 대표 16요소 세 폭 editor/preview/public 최대 0px, PB template 폭 보완 | 외부 테마 모바일 header 넘침; 전체 카탈로그/현재 UI 키보드·OS IME는 미수용 |
| 8 최종 감사 | SPEC-01~16 대조, 49 block/99 preset 누락·소유 불일치 0, 실제 독립 편집, 접근성 결함·대비 보완, 제공자 실제 요청/화면 | 아래 미달·환경 제한을 성공 처리하지 않음 |
| 9 커밋·푸시·배포 | 공식 task별 제출/통합, scoped 구현 인계와 최종 푸시 대상 확정 | release guard 미충족: 새 버전/패키지/온라인 배포/새 원격 증거 없음 |

## SPEC-01~16 대조

| 요구 | 근거와 판정 | 재감사 경계 |
|---|---|---|
| 01 독립성 | 실제 v3 mount/302 runtime modules, G7 adapter/native/block entry 0; 빈 구성 목록에서 중첩 삽입·한국어 입력·한 Undo/Redo·canonical 저장·메모리 포트 재열기 | d3fe713b/e462ce2c 당시 장면이며 실제 G7 인증/영속/발행 대체가 아님 |
| 02 레이어 | IP3의 안정 ID/재귀 트리/선택·잠금·숨김/조상 명령 및 이번 실제 제목 레이어·Site Part 독립 선택 | 모든 새 구성의 키보드 탐색을 현재 SHA에서 전수 수행한 것은 아님 |
| 03 구조 | IP3의 삽입/이동/복제/삭제/그룹/붙여넣기·원자 거부/한 Undo, 실제 새 구성의 중첩·재삽입 | vendor 설명의 Space 구조 drag는 현재 실제 동작과 불일치 |
| 04 자동 배치 | IP4 typed Flex/Grid/트랙과 PHP/TS fixture·Inspector 증거 재사용 | 각 기존 preset 디자인의 전환·전수 시각 수용은 미실행 |
| 05 정밀 스타일 | IP2/IP4 typed 값·reset/개별 변·출력 비교와 이번 이미지 fit·초점·3폭 | raw CSS/HTML/JS 입력은 추가하지 않음 |
| 06 직접 조작 | IP5 50/100/200% 핸들/스냅/취소/한 Undo 증거 | 검증된 배치 문맥 밖 회전 조상·재부모화 등의 안전 거부를 피그마 전체 지원으로 설명하지 않음 |
| 07 다중 선택 | IP5 Shift/영역·혼합값·정렬/분배/그룹/원자 거부 증거 | 부모·자식 중복/상충 문맥은 안전 거부; 현재 전체 시각 수용과 구분 |
| 08 작업면 | IP5 팬/줌/맞춤·좌표 증거, 이번 실제 workbench 배치/초기 맞춤 | 독립 style 누락 한 번 보완됨; 모든 긴 페이지 외부 스크롤 판정은 미확보 |
| 09 반응형 | IP6 세 폭 직접 편집/경계 639/640/1023/1024/override·reset 증거, 이번 대표 3폭 0px/이미지 값 | 모바일 기기 터치 전체 편집 UX는 계약 밖; 전체 카탈로그 현재 수용 미확보 |
| 10 텍스트 | IP4/IP5 직접 입력/부분 서식/링크/단일 history 증거; 이번 실제 한국어 입력/Undo/저장 | OS 네이티브 한글 IME 실입력 증거 없음; 합성 composition 시험과 구분 |
| 11 미디어 | 실제 업로드/재사용/교체/alt/비율·fit·초점·취소/한 Undo·재열기 | 지연/오류/권한 일부는 통제 또는 관련 단위/영속 시험 |
| 12 구성 | 91개 시작 구성은 11개 공통 요소/트리·명령·Puck history 사용; 기존 capability map 49/99 전 항목 대조 | 누락 0은 문서 inventory 판정이지 전수 브라우저 합격이나 기존 문서 변환이 아님 |
| 13 공통영역 | 기존 별도 Header/Footer·쌍 발행/CAS 2건, 이번 비활성 새 세트 복원/원본·다른 영역/발행 포인터 유지 | 현재 sirsoft-basic 1.2.0 실제 적용 시험 미실행; 현재 JWsoft는 적용 지원 밖 |
| 14 재사용 | 실제 저장/검색/재삽입/독립 복사본·새 ID/참조·삭제 무전파 | library 삭제가 사용 문서나 파일을 삭제하지 않음; 연결형 propagation 없음 |
| 15 저장/복구 | 기존 저장 세션/충돌·지연 회귀, 실제 명시 복원·미저장 영역 보존·마지막 정상 발행본 | 환경/대역/원본 시점을 명시; 전체 실제 다중 사용자 수용으로 확대하지 않음 |
| 16 출력/접근성 | 대표 16요소 6비교 max 0px, DATA05/VIEWPORT01/TEMPLATE01, ACCESS01 역할/설명·ACCESS02 대비 보완 | 키보드 안내·OS IME·현재 지원 테마·전수 대상·외부 template header는 미수용 |

IP1~IP6의 원본 근거는 [진척 표시판](../productization/editor-progress.md)의 당시 source/merge 및 각 감사 기록을 사용합니다. 예전 전체 suite/번들 byte 상한의 통과 기록은 현재 재실행이나 현행 용량 차단 정책으로 재사용하지 않습니다.

## 현재 호스트·실제 외부 제공자

Local integration/runtime lease 아래 G7 공개 `TemplateManagerInterface`와 effective config만 읽었습니다. G7 7.1.0/PHP 8.5.9, 활성 User Template `jwsoft-business01 0.3.1`, 설치된 `sirsoft-basic 1.2.0`입니다. 과거 기록의 1.1.4와 다르며 이번에 테마를 전환/수정하지 않았습니다.

현재 Site Shell adapter는 `sirsoft-basic`, user, major 1/minor >=1 프로필만 허용합니다. JWsoft에서는 원래 G7 Header/Footer가 남는 fallback을 실제 화면에서 확인했습니다. 1.2.0은 코드상 프로필에 들어가지만 현재 실제 적용/원복 수용은 미확보입니다. 과거 4eff6d58의 지원 호스트 2건/closed journal/restored=true는 당시 증거로만 보존합니다. 오래된 compatibility.md의 0.35.0/네이티브 조합을 현행 독립 제품 합격으로 가져오지 않습니다.

PROVIDER01 source `e0a6dc798b74e3b58aae240c7ad3fbac0e7207f9` / merge `e05db53e7fde43e1b2a8bc23bcea16dea3d51a70`: YouTube의 no-referrer를 한 번 보완했습니다. [공식 필수 식별 정책](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity)에 따라 YouTube에만 `strict-origin-when-cross-origin`을 사용하고 다른 제공자는 유지합니다. React/PHP/public hydration의 관련 223 JS unit·71 PHP unit/3,235 assertions·타입·구조·Pint·PHPStan을 통과했습니다. runtime 자동 gate는 구현 인계로 defer했으며 이를 제품 browser 합격으로 세지 않습니다.

build `11cb5e9c7e0ec17f6ed6c45093ee191d623803bed56fc36348b40ad68905d80d`의 같은 소유 preview-only v3 원본 revision 2/lock 2를 내장 브라우저에서 재확인했습니다. 실제 YouTube 요청 Referer는 `https://g7pb.test/`만 있고 경로/query/preview token은 없습니다. 오류 153이 사라졌고 UI 재생 후 currentTime 12.309726s/paused=false/readyState=4/error=null을 확인했습니다. 종료 때 paused=true/33.664317s였으며 재생을 남기지 않았습니다. Vimeo의 기존 fixture 123456789는 제공자 404이므로 재생 성공이 아닙니다. Google/OSM 지도는 표시됐습니다.

초기 프레임 교체는 남아 있습니다. actual parent CDP에서 제공자별 두 Document 요청 묶음과 취소가 관찰됐습니다. 최종 작성 iframe은 4개이며 이 관찰로 단일 생성·메모리 leak 부재·모든 provider network 완료를 주장하지 않습니다. 원인 소유권과 변경 필요성은 재감사 대상으로 남기고 G7/테마 내부 렌더를 우회하지 않습니다.

## 실패·미확보 인계: 다음 범위만

| ID | 현재 판정 | 다음 독립 프로세스의 정확 범위 |
|---|---|---|
| ACCESS-KBD | 실제 Space 구조 drag 없음; 제공 설명은 Space/화살표 drag를 안내 | 보존 ACCESS01 후보의 안내/실제 입력 계약 감사. vendor sensor/새 엔진 도입 없이 가능한 공통 안내 정합성부터 결정; 이번 추가 수정 없음 |
| TEXT-IME | 실제 한국어 입력은 성공, OS 네이티브 조합은 미확보 | 데스크톱 OS IME의 한 입력/Undo 경계만 실증; 합성 이벤트를 실입력으로 둔갑시키지 않음 |
| HOST-CURRENT | 기본 테마 설치 버전이 1.2.0으로 달라짐, 활성 JWsoft 지원 밖 | 현재 버전의 공식 연결/원복 범위 확정 후 지원 호스트 수용만 확인; 테마 파일 수정·광범위 재검사 없음 |
| TEMPLATE-OWNER | PB 본문 폭은 해결, 외부 테마 모바일 Header right 396.5px/문서 345px | 별도 테마 소유자에게 전달; PB에서 전역 CSS로 가리지 않음 |
| PROVIDER-FRAME | 실제 초기 두 묶음 요청/교체, Vimeo 표본 없음 | 동일 작성 4프레임의 생성/해제 소유권 판정과 실제 사용 가능한 공개 Vimeo 표본 확정. 무한 재생/전수 network 시험 금지 |
| PERF-SOURCE | 실제 100/500 당시 2,150/4,897.1ms, 선택 278/290ms 예산 이내 | 후속 canvas helper/renderer 변경 이후의 현재 성능 전체 수용은 미확보. 기존 결과는 p95/포인터 성능 증거가 아님; 필요 범위/입력만 확정 |
| UI-COVERAGE | 대표 16요소/기존 차수 근거만 있음 | SPEC-12/16 전수 및 긴 페이지 스크롤의 남은 증거 필요성을 먼저 판정. 이번 전체 suite/coverage 확대 없음 |
| RELEASE | 구현 인계 acceptance=false, 새 릴리스 미허용 | 위 미수용과 공식 릴리스 조건을 별도 승인 범위에서 해결한 뒤 새 SemVer/패키지/온라인 배포. guard/기준 우회 금지 |

ACCESS01의 중첩 역할/폐기 grabbed/chrome 이름 역할/iframe description 문제는 보완됐습니다. ACCESS02 breadcrumb는 실패 규칙만 재확인해 6.81:1/violation 0/incomplete 0입니다. 접기 glyph는 흰 작업면 배경에서 4.97:1로 비문자 3:1을 충족하지만 전체 접근성 인증은 아닙니다. 키보드 불일치를 새 task 이름으로 바꿔 무한 재구현하지 않습니다.

새 테스트 준비 실패도 숨기지 않습니다. React static markup을 jsdom property로 읽은 assertion은 HTML attribute로 한 번 명확히 했습니다. PHP의 첫 worktree 출력은 공유 vendor가 main 클래스를 읽은 잘못된 시험 주체였으며, Reflection으로 확인 후 symlink를 보존하고 고정 vendor를 task-local에 복사했습니다. 제품 추가 수정 없이 정확한 worktree PHP와 통합 main PHP를 확인했습니다. 이전 잘못된 주체 결과는 새 PHP 변경의 성공 근거에서 제외합니다. 관련 하네스의 동적 입력 계약 미확정 gate는 cache 재사용이 불가하여 공식 단계에서 실행됐으며 검증 병목으로 기록합니다. 이번 범위에 하네스 최적화를 더 추가하지 않습니다.

## 증거·배포 경계

- `output/playwright/remaining-independent-iab-before-20261014.json`, `remaining-access01-iab-after-20261014.json`, `remaining-access-final-iab-20261014.json`, `remaining-independent-iab-after-20261014.png`: 실제 G7 없는 명령/저장, 독립 CSS/접근성·키보드 제한.
- `output/playwright/remaining-provider-iab-{before,after}-20261014.{json,png}`: 실제 제공자 실패/한 번 보완/재생/정지·Referer. 새 공개 페이지 발행 증거가 아닙니다.
- `output/playwright/remaining-frame-iab-receipt-20261014.json`, `remaining-template01-iab-receipt-20261014.json`, `remaining-template01-owner-boundary-20261014.json`: 대표 세 폭 치수와 PB/외부 테마 경계.
- 다른 문의/데이터/미디어/재사용/복원·성능 evidence 경로와 source/build는 목표 실행 원장에 연결되어 있습니다. 모든 생성 증거는 보존하며 비차단 삭제를 하지 않습니다.

독립 시험의 고유 loopback 서버는 종료했습니다. 고정 g7pb-dev/runtime, 기존 활성 테마/세트, 미저장 Footer 세션과 시험 자료는 보존합니다. 새 생산 데이터·운영 문의·메일·결제는 만들지 않았습니다. 온라인의 마지막 기록은 0.37.0-dev.20261014/a84b8eb4이며 이번 보완의 온라인 배포는 수행하지 않았습니다. 이 보고서의 이후 공식 검증/푸시/NO_RELEASE 종료 영수증은 coordination 이력과 목표 실행 원장에 기록합니다.
