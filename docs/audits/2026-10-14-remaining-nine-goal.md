# 잔여 1~9 목표 추진 — 고정 범위와 종료 원장

2026-10-14 · 사용자 착수 지시 “목표 추진으로 진행해라” · 시작 main ce630099d1d3a2af9a3a84ae17da2434185336db

## 실행 계약

앞서 목록화한 1~9를 한 목표로 추진하며 단계마다 다음 지시를 요구하지 않습니다. 목록 안의 미완료 동작 확인과 최종 감사만 이번 목표에 허용합니다. 이전 검증 확대 금지를 전체 검사 무제한 실행으로 바꾸지 않습니다. 동일 입력 성공은 재사용하고 새로운 실패 원인별 보완은 1회, 재실패는 후보/명령/원인/영향을 보존합니다. 실패를 성공으로 표시하거나 release guard를 우회해 배포하지 않습니다.

기존 사용자 v1/v2/Site Part 전환·삭제, G7 코어/테마 파일 수정, 블록별 편집기 추가, 새 기능/의존성/외부 서비스 도입은 제외합니다. 실제 서비스의 문의/메일/결제·사용자 알림은 온라인에서 시험하지 않습니다. 로컬 시험 소유 문서·구성·미디어만 사용하고 소유 증거/정식 API/복구 가능성을 유지합니다. 기존 지원 호스트 fixture의 원복은 필수이며 운영 테마를 바꾸지 않습니다.

## 고정 작업과 종료 조건

| 번호 | 작업 | 허용 확인 / 종료 조건 | 시작 상태 |
|---|---|---|---|
| 1 | DATA05 빈 이미지 | 공통 데이터 출력 수정, 기존 관련 unit 회귀, 실제 빈 이미지 높이 0·이미지 있는 원형 보존 | source f0fc0573 / main 7da2ec9d 통합, UI 확인 대기 |
| 2 | 동적 6종 | 기존 UI 연결/저장/발행 증거 재사용, 남은 빈/권한/실패/지연 상태·상품 분류/페이지·셸/폭 표시와 참조 보존 | 부분 성공, 미확인 잔여 있음 |
| 3 | 문의폼·고정 G7 실행 컨트롤 | 기존 5개 문의 구성 시험, 계정/검색/알림/카트/화면/언어/통화의 정상·capability 부재·키보드/초점 | 구현·부분 과거 증거, 잔여 확인 |
| 4 | 미디어 | 실제 선택/업로드/교체/alt/fit/초점·단일 Undo·저장/재열기, 취소/지연/선택·권한 전환 보호 | 구현, 실제 흐름 미완료 |
| 5 | 사용자 구성 | 실제 선택 저장/검색/새 ID 재삽입·독립 사본·참조·삭제 무전파, 기존 소유 권한 증거 확인 | 구현, 실제 흐름 미완료 |
| 6 | 저장/복원 | v3 및 새 Site Part 명시 복원·409/지연·다른 영역 입력/Undo·마지막 발행본 보호; 기존 성공은 반복 안 함 | 기본 저장·Site Part 쌍 발행 성공, 복원 미완료 |
| 7 | 구성·출력 UI | 기존 공통 구성/동작·아이콘/임베드 수용 근거 재사용, 남은 문의/미디어/데이터의 PC/태블릿/모바일과 1px 비교·긴 문구/가림/넘침·키보드/IME | 기존 독립/설치형 근거와 현재 변경 영향 구분 |
| 8 | 최종 제품 감사 | SPEC-01~16 및 내장 capability 누락 대조, G7 없는 포트/지원 호스트, 100/500노드 예산·접근성·외부 프레임 초기 교체 영향 판정 | 미완료만 확인, 과거 전체 suite 반복 금지 |
| 9 | 버전/푸시/배포 | 새 SemVer와 changelog·공식 scoped 검증/패키지/푸시/배포/원격 artifact·최소 실환경 확인, 실패 시 배포 보류 | 온라인 기존 a84b8eb4 / 0.37.0-dev.20261014, 최근 수정 미배포 |

이 표는 성공 선언이 아닙니다. 미확보 증거는 미완료/실패/환경 제한으로 구분합니다. 특히 sample 또는 대역 API의 성공을 실제 G7 권한·외부 제공자 가용성으로 바꾸지 않습니다. 상품 표본 부족·지원 테마 제한은 해결/판정 없이 완료로 넘기지 않습니다.

## 실행 순서와 검증 상한

1. DATA05를 정확 3파일 task로 제출/통합하고 변경 자산을 한 번 빌드합니다. 이전 DATA04·기본 작성/발행·Header/Footer 성공은 재사용합니다.
2. 문의는 기존 structureFormCatalogProduct.spec.ts의 5개 desktop 시나리오만 retries=0/workers=1/max-failures=1로 실행합니다. 신규 문의 종류/새 전역 suite를 추가하지 않습니다.
3. 새 동적/미디어/사용자 구성/복원 흐름은 기존 포트·UI·API와 시험 소유 자료로 확인합니다. 자동 새 전체 E2E를 작성하지 않으며 실패 단계/관련 입력만 확인합니다. 로컬의 실제 API와 통제한 지연/오류 대역을 구분합니다.
4. 최종 감사는 기존 성공 receipt/fixture/소스 의존 입력과 이번 결과를 연결합니다. 현재 미완료 100/500노드/호스트/접근성 항목만 확인하고 전체 coverage나 과거 native/legacy suite로 확장하지 않습니다.
5. 기능 실패가 남으면 다른 항목은 계속 판정하되 전체 완료/릴리스 통과를 위조하지 않습니다. 단일한 인증/권한/범위 확장이 필수인 차단만 사용자에게 요청합니다.

## 결과 기록

- 7번 UI 결함: 실제 로컬 화면에서 structure CSS 628개 rule과 Inter/의미 토큰은 적용됐지만 입력 기본 외형·도구 우선순위·우측 삽입/속성 혼재·초기 캔버스 잘림이 남았습니다. 스타일 로드 실패가 아니라 제품 UI 미완성으로 판정합니다. 피그마식 작성 UI/UX는 원래 요구이며 추가 범위가 아닙니다.
- 7번 보완 task `structure-workspace-ui-20261014`: 편집기 chrome·기존 패널 8개와 기존 unit 1개·changelog·이 원장, 정확 11파일만 소유합니다. 시각 방향은 단일 파란 강조색·차분한 중립 표면·촘촘하지만 읽히는 편집 작업면입니다. 콘텐츠는 왼쪽 레이어/삽입 → 중앙 캔버스 → 오른쪽 선택 속성, 문서 저장/발행은 상단, 편집 상태는 하단으로 구분합니다. 상호작용은 기존 선택 강조·빠른 hover/focus·세션 전용 첫 화면 맞춤을 사용하며 장식 모션/새 엔진을 도입하지 않습니다. 원본 문서·명령·저장·발행·테마/코어는 변경하지 않습니다. 실제 화면 검증 전 수용 완료로 표시하지 않습니다.
- UI 첫 제출: 기존 구조 unit 19개 중 18개 통과, 1개는 DOM의 첫 status를 잠금 오류로 가정한 selector가 구성 목록 상태를 읽어 실패했습니다. 잠금 동작을 바꾸지 않고 같은 시험의 대상을 이름 있는 `편집 상태`로 1회 명확히 했습니다. 이 실패와 제출 보고 `submission-c21e9b948a704cba9f56dca96265251c`를 보존하며 성공한 다른 unit은 반복하지 않습니다.
- UI 통합 `bf15c3c5` 뒤 실제 선택 화면에서 제목보다 미지정 자동 배치 17개와 반복 설명이 앞서는 잔여를 확인했습니다. `structure-ui-priority-20261014`에서 이 시각 결함을 1회 보완합니다. 텍스트 속성을 가진 공통 요소는 글자·크기를 우선하고, 구조 명령은 이름/툴팁을 보존한 아이콘 도구, 미지정 속성은 한 행으로 압축합니다. 특정 구성/블록별 편집기를 추가하지 않으며 모든 기존 속성과 명령은 보존합니다. 재실패 시 추가 UI 재작성을 반복하지 않고 해당 결함을 미달로 남깁니다.
- 목표/lease: integration-remaining-nine-20261014.
- 1번 source: f0fc0573943df2cc37ba18a72a8472152568c7ef, main 7da2ec9da21148106d23e610ab7aae12f84f7d45. 관련 unit/type/구조 첫 제출 통과, runtime 자동 검사는 구현 인계로 구분했습니다.
- 나머지 실행 결과·실패·원복·배포 근거는 이 원장에 이어 기록합니다. IP7~IP10 상태는 근거가 확보된 범위에서만 갱신합니다.

### 2026-10-14 UI 지적 후 진행 결과

- 문의 구성 5개: `structureFormCatalogProduct.spec.ts`의 기존 desktop 5개가 첫 실행에 통과했습니다(90.805초, skip/flaky/unexpected 0). 일반 문의·견적·예약·참가·뉴스레터의 실제 UI 작성/저장/재열기/미리보기·공개 출력/로컬 guest 제출 증거입니다. 해당 실행은 UI 변경 전 `ecfe4a88`이며 이후 UI의 전체 수용 근거로 승격하지 않습니다. 증거는 `output/playwright/gates/integration-remaining-nine-20261014/1367ffbbbb499793ed0327fa71edd67b624daed4bb9a1a7c7af2c9b0bb5f9427/d805afd9011e4cbaaff1323ebf5d0f42/{execution.json,results.json,report/}`입니다. 고정 G7 컨트롤 감사는 별도 잔여입니다.
- UI source/통합: `361e3353` / `bf15c3c5`, 시각 우선순위 보완 `4d8bfd94` / `4df19a54`. 관련 unit·type·architecture·CSS 성공이며 전체 browser gate는 구현 인계로 명시했습니다. 브라우저 수용을 거짓 통과시키지 않았습니다.
- 실제 UI: 시험 소유 문서 `0fbfe603-875c-411b-889f-957e6c7251ac`에 구성 템플릿을 실제 삽입하고 제목 레이어 선택·캔버스 한국어 입력·Undo 원문 복귀·Redo 수정문 복귀·저장 HTTP 200·재열기 수정문 보존을 확인했습니다. 첫 입력 직후의 동기 읽기는 상태 반영 전이므로 성공 근거에서 제외하고 원문/수정문 DOM의 도달을 기다려 확인했습니다. 구조 모드의 Puck 선택 경계는 heading 대신 button 역할이므로 재열기 확인의 첫 heading selector 대기는 만료됐지만 실제 원본 텍스트는 저장돼 있었습니다. 이름 없는 전체 status나 vendor 역할을 제품 저장 실패로 오판하지 않습니다.
- 실제 화면 1756×1279와 1440×960: 왼쪽 레이어·삽입, 중앙 작성 캔버스, 오른쪽 현재 요소 속성을 분리했습니다. 제목에는 글자→크기→자동 배치 순서, 구조 명령에는 접근 가능한 이름·툴팁, 정밀 모드에는 선택 핸들 3개가 표시됐습니다. 1440 화면에서 좌/우 패널의 `scrollWidth == clientWidth`(248/288px)였으며 문서 원본은 PC 1280px인 채 세션 확대 61.71875%로 맞췄습니다. 실제 핸들 드래그·세 작업면 출력 일치·전체 키보드 수용은 이 관찰만으로 완료 처리하지 않습니다.
- 잔여 UI 관찰: 1440×960에서 body/제품 root는 960px이지만 html scrollHeight가 1670px로 측정됐습니다. 바깥 스크롤 원인은 미판정이며 UI 최종 수용 결함/환경 구분이 남았습니다. 이미 보완한 화면을 완성으로 선언하거나 임의 CSS 강제로 숨기지 않습니다.
- UISCROLL01 원인 확인: 실제 `g7pb-v3-sr-only`의 offsetParent가 편집 패널이 아니라 BODY였으며 화면 밖 y=1110~1669px에 배치돼 html의 스크롤 범위를 늘렸습니다. 이 신규 UI 결함은 `structure-ui-scroll-20261014`에서 1회 보완합니다. chrome root/패널에 position 기준만 선언하고 접근 가능한 안내를 삭제하거나 문서/iframe 전체 overflow를 강제로 덮지 않습니다. 제품 원본과 Undo는 변경하지 않습니다.
- 화면 증거: `output/playwright/remaining-editor-before-ui-20261014.png` SHA256 `9220dad90b19c135bf083cd48ce0ed2afbeef2eb8ea95599d44f2b62442bb6c4`, `remaining-editor-ui-final-20261014.png` SHA256 `b53985b1fd25aaf39262eb93456ef3f0bb494d68cfaee0796bf0555894648b1d`, `remaining-editor-ui-1440-20261014.png` SHA256 `12800c938bc2a705b58c9534c5026c0e8e60f48bb57742858319fffc13b42610`(뒤 두 파일도 같은 디렉터리).
- 현재 build fingerprint `7346944f4a815ed7097c9590f10f124681bf75800ed55f76973e0c8f1998df33`. 코어/테마·기존 문서·스키마·명령·저장/발행 계약 변경은 없습니다. 로컬 소스 통합/브라우저 관찰과 온라인 배포는 별개이며 현재 UI는 아직 온라인 미배포입니다. 1~9 목표는 계속 진행 중이며 피그마식 작성 UX 전체 완성을 선언하지 않습니다.

### 미디어·사용자 구성의 실제 흐름

- UI 바깥 스크롤 UISCROLL01: main `2ab43c85` / build `41c7d327dd351c0c48d809b0f50d5f26ceabee653ad3731f429cf63b74b79ad5`에서 1440×960의 html/body scroll 영역도 1440×960, 접근성 안내의 offsetParent도 우측 패널로 확인했습니다. `output/playwright/remaining-editor-ui-local-receipt-20261014.json`과 `remaining-editor-ui-accepted-layout-20261014.png`를 보존했습니다. 이는 전체 UX 수용이 아닙니다.
- 미디어 실제 업로드: `local-business-hero.webp` 107,276 bytes / 1600×900, HTTP 201, 소유 시험 asset `f0177283-bd86-4925-8983-57832d388331`. 실제 이미지 교체·대체 문구, 한 Undo의 원본 복귀/Redo, 저장 뒤 동일 asset 참조를 확인했습니다. PC/태블릿 `cover / 20% 80%`, 모바일만 `contain / 70% 25%`로 저장했고 canonical base/mobile 값과 DOM computed style이 일치했습니다. 저장 lock 4, 실제 재열기와 이미지 로드 2개도 확인했습니다.
- 미디어 지연 보호: 최초 multipart `route.fetch` 전달 시험은 서버의 실제 이미지 검증에서 HTTP 422(`G7PB_MEDIA_INVALID`)였으므로 성공한 지연 업로드로 세지 않습니다. 그 뒤 앞서 실제 업로드된 유효 asset 응답을 지연 재생한 통제 시험에서 선택 변경/취소 두 경우 모두 HTTP 201 응답이 현재 이미지·alt를 바꾸지 않았습니다. 통제 응답과 실제 저장소 업로드 성공을 구별합니다. 첫 이미지 삽입/readonly·세션 계약은 아래 좁은 session 회귀로 별도 확인합니다.
- 사용자 구성 실제 저장 `5d5e8e96-27cd-4b59-ab5f-04b02b62e7f8` / source `a114b15d-825e-4586-9f75-9f3d7360f1af`: 선택한 8개만 새 ID·사용 asset 1개로 저장했습니다. UI 검색·재삽입 뒤 문서 2개 root/16개 고유 ID, 사본 제목 이름만 변경, 원본과 반응형 이미지 참조 보존을 확인했습니다. 삭제 무전파 검증을 위해 이 시험 전용 구성만 UI 삭제 HTTP 200했고 재열기 뒤 두 사본과 원본 이미지 파일 로드는 유지됐습니다. 사용자 기존 구성·페이지·미디어는 삭제하지 않았습니다.
- 참조 구성 실제 저장 `93c1d9bc-39e9-4233-91b0-b1e845c44da8`: FAQ를 UI 삽입→선택 저장→검색→재삽입했습니다. 문서 4 root/44개 고유 ID, 두 disclosure의 18개 item/trigger/panel 참조는 모두 각 사본 안에서 존재하며 서로 공유하지 않았습니다. 해당 시험 구성은 보존합니다. draft lock 9에서도 공개 artifact `8697fd94b209deeff4d211968071db4ec0dea194ecf787ad7062e47c19c0d9c2`는 유지됐습니다.
- 로컬 공개: UI 공개 미리보기→명시 준비 dialog→이 버전 발행으로 위 artifact를 만들었습니다. URL은 `https://g7pb.test/pages/g7pb-goal-nine-20261014-1228`이며 온라인 배포가 아닙니다.
- 출력 비교 미완료 `VIEWPORT01`: PC preview/public의 16개 노드 비교는 통과했으나 tablet에서 최대 114.78125px 차이를 관찰했습니다. iframe 내용 폭 768px / 출력 내용 폭 753px(세로 scrollbar 15px)이 긴 제목을 다르게 줄바꿈했습니다. 동일 frame 높이로 비교 준비를 1회 보완했으나 이후 PC iframe도 innerWidth 1280 / clientWidth 1265로 측정돼 `Unexpected editor viewport`로 중단했습니다. 1px 기준을 완화하거나 임의 overflow 숨김을 넣지 않았으며 제품 소스 보완은 실행하지 않았습니다. 이 환경/프레임 문제를 해소하기 전 세 폭 출력 수용이나 IP8/IP9 완료로 올리지 않습니다. 실패 스크린샷 `remaining-media-tablet-parity-failure-{editor,preview}.png`와 PC 관찰 `remaining-media-{preview,public}-1280-20261014.png`를 보존하고 같은 비교를 반복하지 않습니다.
- `remaining-resource-contracts-20261014`의 정확 3파일: 기존 증거가 없는 v3 미디어/구성/복원의 비동기 문맥을 `tests/Unit/v3ResourceSessions.test.ts`, 현재 v3 구성의 실제 SQL/Controller 사용자 소유권을 `tests/Integration/Gnuboard7/ElementCompositionPersistenceTest.php`에서 확인하고 이 원장만 갱신합니다. 제품 코드·기준·새 전체 E2E·전체 coverage는 바꾸지 않습니다. 테스트 작성만으로 통과를 주장하지 않습니다.
- 위 회귀 첫 제출에서 22개 unit은 통과했지만 테스트 호출 1곳의 필수 alt 인자 누락을 strict 타입 검사가 잡았습니다(`submission-c2dcd44b7a474f7ba08677e260be9ab1`). 테스트 호출만 1회 보완했으며 제품 API/타입/품질 기준은 바꾸지 않았습니다.

### 미디어·구성·복원 후속 판정

- source `c02e85b9` / main `6309e521`: session unit 22개와 strict 타입이 통과했습니다. 실제 runtime에서 새 PHP 소유권 검사만 실행하여 3개/25 assertions가 첫 실행에 통과했습니다. 명령은 `python3 -B scripts/g7pb.py run --base 2ab43c85aafb9f264eb4b8cca11e4d2b873ae9c4 --phase verification --task integration-remaining-nine-20261014`; 동일 TS 성공은 재사용했습니다. PHP는 현재 모듈의 실제 Eloquent repository/Controller, 격리 SQLite, 실제 등록 middleware를 사용하며 다른 사용자의 구성 조회/삭제 차단·원본 보존·미호환 원본 보존을 확인했습니다. 별도 실서버 계정 로그인 시험과 혼동하지 않습니다.
- 빈 문서 첫 이미지: 새 시험 소유 문서 `2259399f-41f3-4800-9b26-aec7ae277e59` / `g7pb-goal-first-media-20261014-1317`을 실제 생성했습니다. 초기 assets 0, 취소 후 요소 0, URL 이미지 삽입 후 한 Undo를 저장한 서버 원본도 roots/assets 0/0, Redo 저장은 1/1이고 재열기 대체 문구도 보존됐습니다. 이어 실제 이미지 라이브러리 검색/선택·문서 이미지 선택·alt 저장을 확인했고 같은 URL은 기존 문서 asset ID `3affe315-c067-432d-8d2e-826f8cc7619e`로 합쳐 자산 1개를 유지했습니다(최종 lock 4). 생성 폼의 select는 label text가 옵션 문구까지 포함하므로 최초 자동화의 exact getByLabel 대기는 실패했으며 실제 combobox의 접근 가능한 이름으로 이어 진행했습니다. 제품 변경이나 문서 중복 생성은 없었습니다.
- 실제 readonly UI: 기존 시험 소유·보관 문서 `a63b9060-d8c1-4c9d-a20c-729549bcbc70`를 읽기만 했습니다. 이미지 노드 선택은 가능하고 alt·선택/업로드·맞춤/초점·삽입·저장은 모두 disabled였습니다. 보관 상태/원본은 변경하지 않았습니다. 비동기 문서/세션/revision/readonly 전환은 별도의 22개 session 계약 시험과 연결합니다.
- 페이지 복원: UI에서 revision #4를 명시 확인해 복원 HTTP 200 / 새 lock 10을 얻었습니다. 응답 원본은 revision #4와 JSON 기준 정확히 같고 draft는 8요소/이미지1, 새 세션 Undo는 비활성입니다. 마지막 공개 artifact `8697fd94b209deeff4d211968071db4ec0dea194ecf787ad7062e47c19c0d9c2`가 유지됐고 실제 공개 GET도 HTTP 200 / 16요소/이미지2를 유지했습니다. 복원은 새 초안이며 재발행하지 않았습니다. CLI의 native confirm 알림이 먼저 반환됐지만 사전 accept handler가 이미 확인해 처리했으므로 중복 restore를 실행하지 않고 기존 HTTP 응답 #202/#203과 현재 UI/공개 결과를 읽어 판정했습니다.
- 영속 관찰 요약은 `output/playwright/remaining-resource-local-receipt-20261014.json`입니다. 출력 VIEWPORT01은 여전히 미수용이며 1~9 전체 완료·IP8/IP9 수용 완료·온라인 배포를 선언하지 않습니다. 제품 소스/빌드는 이번 회귀 추가로 변경되지 않았습니다. 남은 실제 Site Part 복원, 동적 데이터/고정 컨트롤, 최종 제품 감사와 release는 계속 추진합니다.

### 재부팅 뒤 VIEWPORT01의 한 번 제품 보완

- `structure-frame-viewport-20261014`는 정확 4파일(Workspace, 기존 structure UI 회귀, changelog, 이 원장)만 소유합니다. 편집기 iframe의 html/body만 `overflow-y: clip`으로 격리하고, 바깥 작업면이 측정된 전체 높이를 스크롤합니다. 작성 요소의 overflow·공개 CSS·문서 폭·원본·Undo·테마/코어를 바꾸지 않습니다. 기존 속성/priority는 자신의 값이 유지된 경우에만 복구합니다.
- 작성 surface 내부의 style/class/hidden 변경도 한 animation frame으로 모아 전체 높이를 재측정합니다. root ResizeObserver만으로 놓치는 absolute 하위 요소의 높이 변화가 대상입니다. 단위 회귀는 이 소유/복구와 root resize 없는 높이 변경에 한정합니다.
- 재부팅 후 main `f0c7b223`와 깨끗한 해당 task lease, 정상 로컬 runtime을 확인했습니다. 사용자 지시에 따라 이후 실제 브라우저 시험은 내장 웹브라우저로 수행합니다. 이는 VIEWPORT01의 첫 제품 보완 후보이며 실제 세 폭·1px 비교 전에는 성공으로 표시하지 않습니다. 재실패 시 후보와 문맥을 보존하고 추가 구현 반복 없이 독립 항목을 이어갑니다.
- 첫 단위 제출은 19/20 통과, 실패 1건은 jsdom CSSOM이 `overflow-y` priority를 설정 즉시 버리는 시험 환경 차이였습니다. 최소 재현에서도 초기 `auto !important`의 priority가 빈 값임을 확인했습니다. 해당 사전조건만 일반 `auto`로 수정하며 priority 복구는 같은 공통 경로의 background important 회귀로 계속 검사합니다. 제품 후보는 추가 변경하지 않았습니다.

### 내장 브라우저 결과 — VIEWPORT01·DATA05와 동적 상태

- VIEWPORT01 source `4d146a45` / main `892e8ca0`, build `c9a5a9b8e8c04eb7815fd82bd71e1058fabaf96bd84ffd4c805e9f6737a17a6e`. 관련 unit 67개·strict 타입·구조 검사가 통과했습니다. 내장 브라우저에서 동일 시험 원본 16요소의 PC 1280×2242 / 태블릿 768×1611 / 모바일 360×1147을 편집기→새 미리보기→기존 공개 출력으로 비교한 6개 비교 모두 최대 0px였습니다. font·line-height·display·이미지 fit/초점도 일치했고 모바일 두 이미지의 `contain / 70% 25%`를 유지했습니다. 공개 CSS/1px 기준/문서 원본은 변경하지 않았습니다. 이 장면의 프레임 문제는 해소됐으며 전체 UX 수용으로 확대하지 않습니다.
- 비교 준비 한계: 내장 브라우저의 native confirm 후 해당 탭이 응답하지 않아 확인하지 않고 닫았습니다. 새 탭/정식 API에서 lock 10이 유지됨을 확인한 뒤, 시험 소유 revision 8만 정식 API로 새 lock 11에 복원해 기존 두 Hero 장면을 준비했습니다. 마지막 공개 hash는 유지됐습니다. 이는 UI 복원 성공 증거가 아니며 앞선 별도 UI 복원 근거와 구분합니다. viewport 제어가 새 탭의 높이를 자동 승계하지 않아 첫 PC 공개 관찰은 15px scrollbar 차이를 보였습니다. 탭별 실제 폭/높이를 맞춘 뒤 비교했으며 출력 스타일을 덮어쓰지 않았습니다. 임시 크기는 시험 뒤 해제했습니다.
- DATA05: 보관 상태의 시험 원본 `a63b9060-d8c1-4c9d-a20c-729549bcbc70`은 revision 6/lock 7을 유지하고 정식 revision preview만 새로 만들었습니다. 실제 G7 6종 응답에서 빈 이미지 22개 모두 hidden/none/높이 0이었습니다. 별도 통제 응답에서는 6종의 이미지 있는 첫 항목이 기존 소유 실제 WebP로 정상 로드되고, 나머지 빈 항목은 계속 0높이였습니다. 원형의 작성 display와 실제 이미지를 함께 보존합니다.
- 동적 6종 통제 시험: 403은 권한 안내/빈 출력/조작 비활성, 500은 오류 안내/빈 출력/aria-busy=false, 빈 200은 빈 안내/0개, 26,294ms 확인된 보류 요청 중에는 busy=true/0개/조작 비활성이고 해제 뒤 정상 완료했습니다. 초기 shell 세션 갱신은 첫 요청 세대를 폐기하므로 현재 두 번째 세대까지 확인했습니다. 처음 서버 오류 관찰의 busy=true는 두 번째 요청이 실제 보류 중인 중간값이었으며 최종 성공으로 세지 않았습니다.
- 상품 다중 조작은 브라우저에만 재생한 8개/두 분류 표본으로 확인했습니다. products 1/3→2/3, 분류 A 1/2(3개); showcase 1/2→2/2, 분류 A 1/1(4개), 초기화 복귀가 동작했습니다. datalist가 붙은 분류 입력은 textbox가 아닌 combobox 역할이므로 첫 자동화 locator만 바로잡았습니다. 키보드 Tab은 다음 읽기 순서인 첫 상품 링크로 갔습니다. PC/태블릿/모바일에서 scrollWidth==clientWidth, DOM ID 261개 모두 고유/끊어진 참조 0개였습니다. 실제 저장된 상품 표본은 여전히 1개/분류 없음이므로 통제 UI 동작과 실제 다중 상품 API 증거를 혼동하지 않습니다.
- 근거: `output/playwright/remaining-frame-iab-receipt-20261014.json`, `remaining-frame-iab-editor-20261014.png`, `remaining-frame-iab-mobile-public-20261014.png`, `remaining-data-iab-receipt-20261014.json`, `remaining-data05-iab-20261014.png`, `remaining-data-iab-mobile-20261014.png`. 브라우저에만 설정한 데이터 Fetch 통제와 viewport override는 모두 해제하고 실제 페이지로 원복했습니다. 온라인 변경은 없습니다.
- SYSTEM01 신규 실패: 시험 소유 첫 이미지 문서 `2259399f-41f3-4800-9b26-aec7ae277e59`에 공통 G7 컨트롤 7종을 실제 UI로 삽입/연결/이름 지정/저장/미리보기 준비했습니다. 공개 DOM에 7개의 올바른 system/shell-options 속성이 있지만 script 0개/실제 컨트롤 0개입니다. `viewer.blade.php`의 조건에 `data-g7pb-system-controls`가 누락된 원인을 확인했습니다. 제품 보완은 아직 0회입니다. `remaining-controls-iab-failure-20261014.{json,png}`에 보존하며 정상/실행 성공으로 세지 않습니다. 한 공통 predicate 보완과 관련 회귀만 대상이고 테마/코어/컨트롤별 구현을 추가하지 않습니다.

### 실제 제품 100/500노드 성능 관찰과 정책 차단

- main `8e6fbcfe` / 위와 동일 제품 build에서 기술 Box 데모가 아닌 실제 `StructureDocumentHost`/`StructureEditor`/Puck iframe을 내장 브라우저로 확인했습니다. 정식 API로 새 시험 소유 v3 초안을 각각 만들고 공통 heading 100개/500개를 저장했습니다. 이는 성능 장면 준비이며 실제 UI로 수백 요소를 작성한 증거가 아닙니다. 기존 문서·운영 데이터는 변경하지 않았습니다.
- 100노드: 문서 `b6ee2e25-6113-430e-a236-9e5bfa05d997`, revision 2/lock 2, canonical 23,762 bytes. 새 탭 진입→100번째 요소 도달은 2,150ms, 첫 레이어 실제 클릭→이름 Inspector는 278ms였습니다. 기존 10,000ms/1,000ms 예산 이내입니다.
- 500노드: 문서 `bb08ca95-6920-4727-b3e7-171694734fca`, revision 2/lock 2, canonical 117,762 bytes. 최초 관측이 내장 도구의 Runtime.evaluate 3,000ms 제한에 걸렸고, 4.654초 도구 반환의 진단에는 500번째 제목이 존재/visible로 표시됐습니다. 정확한 readiness 값은 확보하지 못했으므로 로딩 합격으로 승격하지 않습니다. 동일 세션의 별도 현재 상태 읽기에서 500요소/초안 저장됨을 확인했고 첫 레이어 실제 선택은 290ms, 이름도 `부하 500 - 1`이었습니다. 로딩을 다시 실행하거나 예산을 완화하지 않았습니다. p95·포인터 드래그·최종 제품 성능 전체의 합격이 아닙니다.
- 근거 `output/playwright/remaining-product-performance-iab-20261014.json`과 `remaining-product-performance-iab-500-20261014.png`. 100/500 장면의 로딩 실행은 각각 1회입니다. 초안은 보존하며 발행하지 않았습니다.
- SYSTEM01의 정상적인 viewer 보완을 현행 planner가 `Explicit shared runtime/contract scope required`로 분류하는 것을 소스에서 확인했습니다. 사용자 지시상 전체 검사로 확대하지 않습니다. 정확한 한 줄 runtime predicate 추가만 scoped로 인식하고 다른 viewer 변경의 전체 검사 조건을 유지하도록 `tools/g7pb/planner.py`, `tests/Harness/test_planner.py` 두 파일의 범위 등록 보완을 사용자에게 한 번 요청했습니다. 응답 전 해당 두 파일/제품 viewer를 변경하지 않습니다. 다른 독립 잔여 작업은 계속하며 이 정책 확인을 제품 수정 실패로 세지 않습니다.

### SYSTEM01 한 번 제품 보완

- 사용자 승인 “두 파일의 정확한 범위 등록 보완 승인” 후 harness source `69535c71` / main `4cce2412`를 통합했습니다. 정확한 predicate 1개 추가 외 다른 바이트는 거부하며, 필수 실제 Blade 렌더 회귀와 기존 PAGE/STRUCTURE_THEME 브라우저 gate를 유지합니다. 관련 planner 84개를 포함한 공식 하네스 검사가 통과했고 통합 시 동일 입력 성공을 재사용했습니다. 하네스 성공을 제품 브라우저 성공으로 세지 않습니다.
- `system-viewer-runtime-20261014`는 viewer 한 줄·새 실제 Blade 렌더 회귀·changelog·이 원장만 소유합니다. 기존 `data-g7pb-system-controls` 생성 표시가 있으면 동일한 고정 public runtime을 로드합니다. 7종별 편집기/새 runtime/의존성이나 무조건 script 로딩은 추가하지 않습니다. 새 회귀는 preview/public root에서 7종 단독 표시에 runtime 1개, 정적 문서 0개, 기존 interactive 표시의 runtime 유지에 한정합니다. 소스 보완 1회이며 실제 내장 브라우저 재확인 전 성공으로 표시하지 않습니다.
- SYSTEM01 source `0291a70c` / main `632b23eb`: 실제 PHP 8.5.9의 Blade 회귀 3개/81 assertions가 첫 실행 통과했습니다. 같은 선택 계획의 실행 결과 `(0, receipts)` tuple을 임시 Python 호출자가 그대로 sys.exit에 넘겨 셸은 exit 1이었지만 내부 두 gate는 모두 PASSED였습니다. 제품 실패로 오판하거나 성공한 PHP를 반복하지 않습니다. 이후 호출자는 반환 코드만 사용해야 합니다. 선택 대상은 새 PHP 파일뿐이었으며 기존 제품 전체 browser gate는 여전히 별도 미수용입니다.
- 내장 브라우저에서 동일 미리보기를 다시 열어 public runtime script 1개, 7종 모두 mounted=true를 확인했습니다. 실제 관리자 계정 메뉴와 검색 입력을 열고 Escape로 닫아 각 trigger로 초점이 돌아왔습니다. 실제 통화 5개 선택지는 제공됐고 언어 선택지는 0개였습니다. 실제 사용자 알림/메일·결제·logout은 변경하지 않았습니다. SYSTEM01의 스크립트 누락은 한 번 보완으로 해소됐습니다.
- SYSTEM02 별도 표시 결함: v3 system host에는 `data-g7pb-system-controls`가 있으나 기존 `.g7pb-system-controls` 스타일 scope class가 없어, hidden=true인 cart 0 badge도 computed display=grid/높이 18.390625px였습니다. 언어 미지원 영역도 기존 hidden 보정 범위 밖입니다. 이는 스크립트 누락과 다른 원인입니다. `system-style-scope-20261014`의 정확 4파일에서 공통 mount에 기존 scope class만 연결합니다. 모든 종류가 같은 경로를 사용하며 작성 style/기존 class/단일 mount를 보존하는 회귀를 기존 파일에 추가합니다. 새 CSS·important·문서 필드·컨트롤별 보정은 추가하지 않습니다. 제품 보완 1회이고 실제 재확인 전 성공으로 표시하지 않습니다.
- SYSTEM02 source `2538863d` / main `9210e5a7` / build `b3227ea1d3751f37a551b6918280993097ba99647336b0d6543e2a465f43c061`: 공통 mount의 스타일 scope 연결은 관련 기존 회귀·새 회귀·strict 타입·구조 검사를 통과했습니다. 기존 Site Shell product 시험은 10개 전부 첫 통과이며 선택 계획 45 gate 중 정적/관련 unit만 실행하고 3개 runtime gate는 구현 인계로 유지했습니다. 통합 시 동일 성공 입력은 재사용했습니다. 실제 새 미리보기에서 7종 scope=true, 작성한 42×42 크기 유지, hidden cart 0 badge와 미지원 언어 영역은 모두 display=none/높이 0입니다. 한 번 보완으로 해당 표시 결함은 해소됐습니다. 원래 없던 scope class를 연결한 것이며 CSS/기준/문서 원본은 바꾸지 않았습니다.
- SYSTEM03 미해결 위치 결함: 기본 1280×720의 페이지 왼쪽 42px 컨트롤에서 설정 popup은 x=-254,width=320, 버튼은 x=-237~ -139.484375px로 화면 밖입니다. 실제 캡처에도 왼쪽 경계에서 잘립니다. 화면 모드 클릭 3회는 DOM 상태/문구를 바꾸지 않았으며, 이를 theme 기능 성공이나 handler 결함으로 세지 않습니다. 화면 밖 버튼 위치가 확인된 다음 직접 원인이며 제품 보완은 아직 0회입니다. 통화는 DOM 선택 KRW→USD→KRW만 관찰했고 실제 저장/온전한 사용자 조작 수용으로 올리지 않습니다. 사용자 알림 읽음/메일/결제/logout은 실행하지 않았습니다.
- `output/playwright/remaining-system-controls-iab-receipt-20261014.json`, `remaining-system02-iab-before-20261014.json`, `remaining-system03-iab-popup-clipped-20261014.png`에 결과와 다음 실패 장면을 보존했습니다. 다음 구현 대상은 공통 팝업의 화면 안 배치이며 컨트롤별 처방을 추가하지 않습니다. Site Part 복원·지원 호스트/최종 SPEC·접근성/IME/성능의 남은 판정과 공식 release/푸시/배포도 아직 미완료입니다. 앞선 성공을 현재 전체 제품 수용/배포 합격으로 승격하지 않습니다.

### SYSTEM03 공통 팝업 배치의 한 번 보완

- `system-popover-viewport-20261014`의 정확 6파일은 공통 placement helper·기존 disclosure 연결·직접 회귀·기존 제품 회귀·changelog·이 원장입니다. 시각 방향/내용은 기존 popover를 그대로 유지하며, 화면 안 배치·기존 120ms 등장·Escape 초점 복귀/밖 클릭 닫기를 유지합니다. 새 컨트롤별 editor/처방, 외부 dependency, 테마/코어/문서 계약 변경은 없습니다.
- 팝업은 같은 원본 DOM/이벤트/토큰 상속을 유지하고 지원 브라우저에서 native manual popover의 top layer를 사용합니다. 화면 가용 폭/높이에 맞춰 위치/내부 스크롤을 제한하고 아래 공간이 부족하면 위에 배치합니다. 부모 transform/overflow를 수정하거나 기존 G7 원본을 인수하지 않습니다. 미지원 환경에는 기존 DOM의 fixed 배치를 유지하며 이를 동일한 transform 호환성 증거로 주장하지 않습니다.
- 사전 확인: 내장 브라우저의 읽기 전용 DOM proxy는 showPopover를 노출하지 않아 false였지만 실제 개발 API 확인은 Chrome 155에서 show/hide 지원 true였습니다. [HTML 표준의 manual/top-layer 계약](https://html.spec.whatwg.org/multipage/popover.html#the-popover-attribute)을 확인했습니다. 단위 환경과 실제 플랫폼 기능을 구분합니다.
- 단위 범위는 왼쪽/아래/짧은 화면 배치·원래 스타일/priority/DOM 부모 보존·나중 소유자 보호·스크롤/해제·기존 Escape 입니다. 브라우저는 기존 SYSTEM03 장면과 남은 정상 컨트롤 조작만 확인합니다. 제품 보완은 1회이며 재실패 시 후보/문맥을 동결합니다. 첫 제품 시험 전에는 성공으로 표시하지 않습니다.
- 첫 직접 회귀는 4/5 통과, 실패는 jsdom이 `position:absolute !important`의 priority를 설정 즉시 버리는 사전조건 차이였습니다. 최소 재현은 position/max-width priority가 빈 값이고 left/margin-left/background-color는 important를 유지함을 확인했습니다. 제품 코드는 그대로 두고 회귀의 priority 소유/복구 대상만 지원되는 left로 명확히 했습니다. 테스트 준비 보완 1회이며 성공한 같은 입력은 재사용합니다. 실패 보고서 `submission-bbab8f9bb8b244d29d9753d18da30967`을 보존합니다.

### SYSTEM03 실제 보완과 새 Site Part 복원 결과

- SYSTEM03 source `9a44fe48` / main `e9a52bb3`, build `dbe6695a2cee776a03ace3f66d765061a6f92ab0598bc8aad63410cd3477263d`: 직접 배치 회귀 5개와 관련 unit·타입·구조 검사를 통과했습니다. 제출 보고 `submission-abbf2d7c3176481f87803d031d344258`, 통합 보고 `integration-cdbef238964b45c994e49d974afe742b`는 구현 인계이며 자동 browser acceptance가 아닙니다. 최초 통합 호출이 Node 24 PATH를 누락해 기본 Node 26.7.0의 localStorage 환경에서 기존 6건이 실패했습니다(`integration-f9ca0f1807d940f99ea9e2520a299a9a`). Node 24.19.0 환경만 복구했고 소스 변경/제품 재구현 없이 해당 실패/downstream을 확인하고 나머지 같은 입력 성공은 재사용했습니다. 과거 ENV02의 실행 환경 실수를 반복한 기록이며 숨기지 않습니다.
- 실제 내장 브라우저의 동일 시험 문서에서 설정 popup은 native top layer에 있고, 1280px에서 x=16/width=320/y=448.765625/height=108.796875로 화면 안에 배치됩니다. 768px은 x=16/width=352, 360px은 x=16/width=328이며 둘 다 화면 안입니다. 폭 변경 시 기존 runtime이 열린 disclosure를 닫으므로 각 폭에서 다시 열어 측정했습니다. 재설정 뒤 닫힌 버튼에 Escape를 시도한 locator 실패는 제품 실패/테마 handler 실패로 세지 않습니다.
- 실제 마우스 클릭으로 밝게→어둡게→시스템 상태/문구가 바뀌고 Escape 후 trigger의 aria-expanded=false/초점 복귀/열린 popup 0개를 확인했습니다. 통화는 정식 select에서 KRW→USD→KRW로 원복했고 검색 제출은 실제 `/search?q=g7pb-goal-probe`와 결과 0건 화면에 도달했습니다. 관리자 계정 메뉴·실제 알림 목록/주소도 읽기만 확인했습니다. 알림 읽음/메일/결제/logout은 실행하지 않았고, 실제 호스트의 언어 선택지 없음은 비활성/숨김 capability 경계로 남깁니다. API-없는 fallback의 transform/clip 동등성이나 전체 컨트롤 권한 조합의 합격으로 확대하지 않습니다.
- 근거: `output/playwright/remaining-system03-iab-receipt-20261014.json`, `remaining-system03-iab-mobile-20261014.png`. 모바일 캡처는 도구가 360×203px로 축소한 이미지이며 원래 CSS viewport 360×720 측정값과 혼동하지 않습니다. 임시 viewport는 모두 해제했습니다.
- 새 Site Part 세트 `e49fd4b4-45fc-4a08-93ec-a9fc23e079c0`(목표추진 복원 전용 20261014-1455)를 실제 UI로 만들었습니다. Header/ Footer를 각자 작성·저장하고 두 리비전 #2를 함께 발행했으나 사이트에 적용하지 않았습니다. 기존 활성 세트/테마/코어는 변경하지 않았습니다. 내장 브라우저의 click 후 native confirm이 입력 반환을 막았지만 지원되는 `tab.pressKey(null, 'Return')`로 처리됐습니다. 이후 복원은 Page dialog-opening 이벤트를 확인하고 동일한 기본 키 동작으로 명시 승인했으며 window.confirm을 덮어쓰거나 제품 확인 절차를 우회하지 않았습니다.
- Header 변경본 #3 저장 뒤 Footer에 미저장 이름을 입력하고 Header #2를 새 초안으로 복원했습니다. 성공 메시지 도달 후 Header의 문서 JSON은 원래 #2와 정확히 같고 새 revision=4/lock=5/active_revision=2, Header Undo 비활성입니다. Footer의 미저장 이름/Undo는 유지됐고 실제 Undo로 저장된 이름으로 돌아왔습니다. 서버 Footer는 revision=2/lock=3/active_revision=2 그대로입니다. 두 published_at도 원래 `2026-10-14T05:52:44+00:00`이며 세트는 is_active=false/is_ready=true입니다. 마지막 발행 포인터·다른 영역 보존의 실제 증거이며 발행 artifact hash의 사전/사후 비교를 추가로 했다고 주장하지 않습니다.
- 근거: `output/playwright/remaining-sitepart-restore-iab-20261014.{json,png}`. 첫 서버 읽기 도구의 3초 관측 제한은 데이터/복원 실패가 아니며 조회를 병렬화하고 명시된 10초 도구 제한 아래 읽기만 보완했습니다. 복원/발행을 다시 실행하지 않았습니다. 새 시험 자료는 보존합니다.
- 500노드의 최초 도구 관측 실패는 제품 수정 없이 관측 제한만 한 번 보완했습니다. 같은 소유 초안을 한 번 reload한 뒤 문서 시작 시점→500개 렌더 노드/글꼴 loaded/마지막 노드 양수 치수를 관측한 값은 4,897.1ms입니다. 기존 10,000ms 기준 안이며 최초 readiness 시점의 상한 관측값입니다. 기존 100노드 2,150ms/선택 278ms 및 500노드 선택 290ms 근거는 반복하지 않았습니다. p95·포인터 성능·최초 paint의 정확값은 아닙니다. `remaining-product-performance-iab-500-observation-20261014.json`에 관측 정의/환경 보완/한계를 기록하고 최초 실패도 보존합니다.
- 동적 6종의 미확인 template/builder preview를 남은 대상만 확인했습니다. 기존 시험 소유 archived v3 revision #6은 읽기만 하고, 새 v3 문서 `c7484ed7-6149-42d5-b69c-b591a042c728`(template), `17ccb4cc-58f4-489f-a5c6-2fcec1763948`(builder)를 정식 API로 준비했습니다. 두 문서 모두 revision=2/lock=2의 미발행 초안이며 기존 문서 전환/변경·활성 셸 변경이 아닙니다. 시험 장면의 API 준비를 UI 작성 성공으로 세지 않습니다.
- 두 셸에서 실제 응답은 posts 6, archive 12, post-detail/products/showcase/product-detail 각 1개로 모두 ready=true였습니다. 빈 이미지 22개는 hidden/display=none/높이 0입니다. template은 기존 NOVA WORKS 테마 Header/Footer, builder는 기존 PB 활성 발행 Header/Footer를 유지했습니다. raw 대역/실제 상품 추가/알림 변경/메일/결제는 없습니다. template 초기 locator의 내장 3초 deadline은 로딩 중 관측 제한이며 현재 상태에서 실제 6종 도달을 읽었고 navigation·저장·발행을 반복하지 않았습니다.
- TEMPLATE01 신규 출력 결함: 기본 1280×720에서 builder는 clientWidth=scrollWidth=1265이지만 template은 clientWidth=1265/scrollWidth=1273입니다. 로딩 완료 뒤 PB class 소유 영역은 x=-7.5,width=1280/right=1272.5이며 모듈의 `.g7pb-template-body:has([data-g7pb-v3-public]) { width:100vw; ... }` 규칙이 고전 스크롤바 폭을 포함합니다. 테마 자체를 고쳤다고 주장하지 않고 제품 보완은 아직 0회입니다. 전체 출력 합격/배포를 선언하지 않습니다. `remaining-data-shells-iab-20261014.json`, `remaining-data-template-iab-20261014.png`, `remaining-data-builder-iab-20261014.png`에 원본·새 장면·관찰을 보존했습니다.
- TEMPLATE01의 한 번 보완 task `template-viewport-width-20261014`는 정확 6파일입니다. 기존 public runtime lifecycle에서 PB v3 template wrapper만 실제 document.clientWidth로 측정하며, 소유 CSS 변수로 기존 전체 폭/중앙 정렬을 유지합니다. 늦은 mount·문서 폭 변경·dispose·다른 style 소유자를 다루고 테마/코어/문서 계약/legacy 여백은 바꾸지 않습니다. 직접 회귀 5개와 선택된 기존 관련 검사, 실제 실패 template 장면의 세 폭만 확인합니다. 새 전역 suite/coverage/지원 호스트 전환은 추가하지 않습니다. 실제 재확인 전에는 성공으로 표시하지 않습니다.
- TEMPLATE01 source `2729b3cf` / main `f7cfe1ed`, build `fb8db970115f13b3931bb78be0f25372f0c7c4266ce96d3bce413953da407c66`: 직접 5개·관련 unit·타입·구조·CSS 검사를 첫 통과했습니다. 선택 계획은 19 gate/full=false이며 자동 runtime 7개는 구현 인계 상태로 남깁니다. 실제 같은 template preview에서 PB 폭/x/right는 PC 1265/0/1265, tablet 753/0/753, mobile 345/0/345입니다. 본문의 6종 출력 영역도 mobile에서 x=40/right=305/clientWidth=scrollWidth=265로 넘치지 않습니다. 한 번 보완으로 PB 자체의 스크롤바 포함 폭 결함은 해소됐고 테마·코어·원본·legacy 여백은 변경하지 않았습니다.
- 현재 전체 template 페이지의 남은 넘침은 별도로 보존합니다. PC는 clientWidth=scrollWidth=1265, tablet은 753/765, mobile은 345/397입니다. mobile의 외부 테마 `jw-business-header__account` 로그아웃 버튼 right=348.515625, `jw-business-header__menu-button` right=396.515625를 확인했습니다. PB 본문 범위와 다른 소유 영역이며 이를 숨기거나 테마를 임의 수정해 전체 합격으로 바꾸지 않습니다. 현재 jwsoft-business01에서의 전체 template UI 수용은 미완료입니다. `remaining-template01-iab-receipt-20261014.json`, `remaining-template01-owner-boundary-20261014.json`, 360×720의 실제 캡처 `remaining-template01-iab-mobile-20261014.png`를 직접 확인했습니다. 임시 viewport는 해제했습니다.

### 진척 원장 반영과 다음 고정 작업

- `remaining-goal-progress-20261014`는 이 원장과 editor-progress.json/md, 정확 3개 문서만 소유합니다. IP7~IP9의 새 부분 증거·실제 수행한 흐름·대역/환경/외부 소유 한계를 반영하고 IP10은 계획에서 진행으로 옮깁니다. 제품 전체 완료 수는 6/10 그대로이며 표시판만으로 기능 수용을 만들지 않습니다.
- 다음은 잔여 목록 8번의 SPEC-01~16 최종 대조와 미확인 실제 외부 제공자 초기 프레임 영향·현재 지원 호스트/접근성·OS IME 경계 판정입니다. 기존 IP1~IP6/지원 호스트/통제 제공자 성공과 이번 제품 로딩/선택·UI/복원/세 폭 근거를 재사용하며 원래 전체 suite·coverage를 다시 실행하지 않습니다. 비확인·외부 소유 한계는 재감사 필요성으로 남기고 범위 밖 수정이나 기준 완화를 하지 않습니다.
- 9번의 공식 최종확인·푸시·새 버전/배포는 여전히 별도입니다. 구현 인계 `acceptance=false`를 릴리스 합격으로 바꾸거나 release guard를 우회하지 않습니다. 현재 온라인 버전은 기존 0.37.0-dev.20261014/a84b8eb4이며 이번 목표의 제품 보완은 온라인 미배포입니다. 비차단 삭제·기존 문서 전환·테마/코어 수정은 계속 제외합니다.
