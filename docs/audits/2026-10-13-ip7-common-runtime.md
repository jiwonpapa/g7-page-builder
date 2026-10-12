# IP7 공통 링크와 콘텐츠 동작 검증

IP7은 진행 중이다. 공통 링크 계약과 기존 접기·탭 실행 코드의 재사용 경계에 이어, v3 공통 동작 계약·명령·Inspector·React/PHP 출력 연결을 제출하고 정식 통합 검증 중이다. 아래의 기존 통합 결과와 새 제출/진단 결과를 구분한다. 이 기록을 전체 카탈로그 또는 공통영역 편집 완료로 합산하지 않는다.

## 공통 링크 계약

`ip7-contact-link-contract-20261012`의 제출 `5ed22ff3f207d38083870dd60e0f86ad330aa5fb`를 `58197df3ae09430aab52f44af8fcedf250924cd7`에 통합했다. 전화·이메일 주소는 공통 링크와 리치텍스트 링크에서 같은 제한을 적용한다. 연락처 전용 편집기 등록이나 기존 문서 변환은 추가하지 않았다.

공유 schema 변경을 이유로 `make task-integrate TASK=ip7-contact-link-contract-20261012 INTEGRATION_TASK=integration-ip7-20261012 FULL=1`을 실행했다. PHP·프런트 전체 gate와 제품 브라우저 49개, Site Shell 브라우저 45개가 통과했다. PHP 실행에 기존 notice 1건이 있었으며 이를 테스트 실패나 notice 없음으로 바꾸어 보고하지 않는다.

허용된 로컬 검증 동안 `sirsoft-basic` 1.1.4를 활성화했고 종료 trap에서 `jwsoft-business01` 0.3.1로 복구했다. 템플릿 1,667개 파일의 경로·내용 해시는 전후 모두 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`로 같았다. 테마 원본·G7 코어·운영 서버를 수정하지 않았다.

## 기존 동작 코드의 공통 재사용

`publicContentControls.ts`의 기존 접기·탭 구현을 재사용한다. 공개 페이지 전체 Document뿐 아니라 명시적인 HTMLElement 영역에서도 설치·해제할 수 있다. 독립 미리보기가 이 API를 연결할 수 있으나 이번 제출에서 미리보기 연결 자체를 완료하지는 않았다.

- 중첩된 다른 동작 영역의 자식·상태·이벤트를 인수하지 않는다. 겹치는 root로 호출해도 한 host에 listener를 중복 설치하지 않는다.
- 생성 출력의 `data-g7pb-control-ids="stable"` 모드는 기존 ID와 ARIA 참조를 유지하고, DOM 순서가 다른 패널도 참조 ID로 연결한다. 잘못된 참조는 markup을 변경하지 않고 설치를 거부한다. 이 marker는 생성 HTML의 실행 계약이며 편집 원본이 아니다.
- 숨긴 패널이 작성자의 inline Flex/Grid 때문에 다시 보이지 않도록 일시적인 display를 적용하고, 열기·해제 시 작성값을 복구한다. 공개 화면의 상태를 문서나 별도 Undo로 저장하지 않는다.
- 가로·세로 탭은 해당 축의 화살표, Home/End, 순환 초점을 지원한다. 접기의 Enter/Space는 한 번만 전환하고, 닫힌 내용은 키보드 탐색에서 제외한다. [W3C 탭](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)과 [접기 동작](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)을 기준으로 검증했다.

소스 task `ip7-scoped-content-runtime-20261013`의 제출은 `c968dd50ccbc1a7050c49aa4aa62c5cfb90bdb3e`, 브라우저/등록 task `ip7-content-runtime-browser-20261013`의 제출은 `44c4f7ac8cf925bd2803cb96cfd157afe335b814`다. 두 변경은 공식 `task-integrate-batch`로 `4abafae025255f73f416fd7535e8a18794ee50e6`에 함께 통합했다.

## 검사 결과와 한계

관련 단위 검사 94개, 타입·구조 검사, 브라우저 등록 검사를 통과했다. 첫 batch 시도는 Docker 실행 경로가 빠져 자산 gate에서 실패하고 Local을 원복했다. 실행 PATH에 `/usr/local/bin`을 복구한 재시도는 동일 입력의 성공 검사를 재사용하며 자산 gate 이후를 진행했다. 제품 코드나 합격 기준을 바꾸지 않았다.

실제 Docker Node 24·고정 Chromium의 공개 runtime 시나리오 15개와 기존 공개 페이지 접근성·시각 회귀 3개가 통과했다. 새 시나리오는 번들 빌드 후 생성한 이름·ID로 중첩 탭/접기를 구성하며, 세 프로젝트 각각에서 1280/768/360px를 조작했다. ID/참조, Flex/Grid 복구, 중첩 상태, 키보드 초점과 Enter/Space를 검사한다. fixture HTML을 사용한 실행 코드 검사이며, v3 문서 작성·저장·발행이나 PHP compiler 출력의 증거는 아니다.

- Runtime 증거: `output/playwright/gates/integration-ip7-20261012/0b9b241bb2ba8bf9a01ea6d0600d413bb9a23e87683fed7487c24cbc791b6f3a/0078888413d2457d9bf60d57063a7fa0/`의 `execution.json`, `results.json`, 보고서와 캡처.
- 공개 페이지 회귀: `output/playwright/gates/integration-ip7-20261012/e30dc47924f75ac11c2dde1f5d10c81fc680eb08331af8b04ef373defabc36da/8acf86fe6966488bb3a5d4b39062e85c/`.
- Runtime 결과는 expected 15, unexpected/skipped/flaky 0이다. desktop의 세 폭 캡처를 육안 확인했다. 이는 기본 HTML 컨트롤 fixture로, 최종 편집기 외형이나 선택 상태의 시각적 발견성을 승인하는 화면이 아니다.
- Docker 산출물의 공개 runtime 합계는 gzip 32,444/34,000바이트, 기본 편집기는 508,316/508,500바이트다. 기존 한도를 유지했다. host 산출물과 Docker 산출물의 수치를 혼합하지 않았다.

위 결과 이후 안정 노드 참조를 사용하는 공통 동작 계약과 편집 명령을 아래와 같이 연결했다. 블록별 runtime 분기, 불투명 legacy 요소, 사용자 문서 자동 이행은 추가하지 않는다. 다른 동적 기능·Header/Footer·명시 이행과 IP8~IP10도 남아 있다.

## 공통 동작 문서와 편집 연결 — Local 통합 완료, IP7 일부

기준 Local SHA는 `0c8f0091b911e17aae24525b6a7992d6fecb2d92`다. 다음 네 제출은 공식 FULL batch를 통과해 `22607a6d866b9070425cdf506551650d8024189c`로 Local 통합됐다. 아래에는 실패·중단 이력과 최종 성공을 구분해 보존한다. IP7 전체 및 실제 v3 서버 저장/발행 완료는 아니다.

| 소유 task | 제출 SHA | 범위 |
|---|---|---|
| `ip7-inspector-prop-guard-20261013` | `854c1c12c3e40a948b1d88489a3fe934daa9b9a8` | 링크와 일반 버튼의 속성 판별 |
| `ip7-element-behavior-contract-r2-20261013` | `6301cece1f0d6ed60bc555f56a6e03ae4a4251ec` | PHP/TS 공통 동작 문법·참조 검증·복제·명령 |
| `ip7-common-behavior-ui-runtime-20261013` | `bb884be74482a5714343e785439bc766f041c07f` | 공통 편집 UI·표시·공개 runtime·동작/출력 시험 |
| `ip7-composition-bundle-20261013` | `ea5792aa2e1ca1b368b10a6ddc9286cdae3c09db` | 빌드 시 구성 데이터 중복 축약과 원본 값/독립 사본 검증 |

문서에는 기본 `action.button` 요소와 컨테이너의 선택형 `tabs`·`disclosure`·`carousel` 동작을 제공한다. 동작은 안정 노드 ID로 내부 버튼·내용·트랙을 연결한다. Hero·FAQ·가격표 등의 이름은 일반 편집/삽입/렌더 분기 키가 아니다. 새 조합은 같은 v3 트리 데이터로 전달한다.

- 문서 검증은 참조의 소유자·노드 유형·중복·중첩 경계와 동작 구조를 검사한다. 복제/붙여넣기는 내부 참조를 새 ID로 다시 연결하며 잘못된 변경을 부분 적용하지 않는다.
- 공통 Inspector의 동작 연결과 버튼 문구, 캔버스 직접 입력은 같은 문서 명령/Puck 이력을 사용한다. 미리보기의 탭 전환·접기·슬라이드 위치는 문서 또는 두 번째 Undo에 저장하지 않는다.
- React/PHP는 같은 authored 초기 상태와 ARIA 참조를 출력하고 기존 공개 동작 코드를 재사용한다. 슬라이더는 기존 Embla와 Autoplay를 사용하며 별도 엔진을 만들지 않는다. 문서에 endpoint·handler·실행 코드를 저장하지 않는다.
- 내장 구성 JSON의 빌드 최적화는 반복 문자열/객체 생성 코드만 공유한다. mutable 객체 사본, 값과 순서는 유지하며 동적 디코더·추가 fetch·raw 실행 필드를 넣지 않는다. JS 508,500바이트와 CSS 45,200바이트 등 기존 예산을 유지한다.

### 실패 원인과 보완

초기 Linux 통합에서 독립 번들이 509,782바이트로 508,500바이트 한도를 초과했다. 로컬과 Docker의 Node 버전이 같아도 zlib 버전이 달라 gzip 수치가 달랐으므로, 로컬 수치를 Linux 제품 검증으로 대신하지 않았다. 독립 미리보기에서 기존 슬라이더의 자동 생성 컨트롤을 분리해 tree-shaking하고, 기존 빌드 최적화를 구성 JSON 배열에도 적용했다. 기능·의존성·예산은 변경하지 않았다.

그 다음 공식 실행은 일반 버튼의 직접 입력 시험 4개에서 실패했다. Puck의 일반 문구 필드는 클릭/초점 후 `plaintext-only`로 활성화되는데, 시험이 Tiptap의 `contenteditable=true`만 기다렸다. 실제 포인터 활성화와 일반 문구 입력을 사용하도록 보완했다. 실패 증거는 `output/playwright/gates/integration-ip7-20261012/700c0d3fe8bc277741e7a5dea7811f4e27375f03582558588b99facaea0bbeaa/447ac74c55ea4ab6b963167ed1aa9338/`에 보존한다. 이 실행은 원인 확인 후 시험 runner에 정상 중단 신호를 보내 종료했으며 **37 통과·4 실패·1 중단·219 미실행**이다. 통합 하네스가 Local 후보를 원복했고, 이 실행을 성공으로 합산하지 않는다.

입력 보정 후에는 슬라이더의 실제 접근성 문제가 드러났다. IntersectionObserver가 화면 경계에 면적 없이 닿은 슬라이드도 교차 대상으로 반환하여 `aria-hidden=false`와 포커스 가능 상태가 남았다. 공통 runtime은 실제 viewport 교차 면적을 검사하고 Embla의 `settle`에서도 상태를 갱신한다. 일부가 보이는 슬라이드는 유지하며 완전히 가려진 슬라이드는 `aria-hidden`·`inert`로 제외한다. 해제 시 이벤트와 원래 상태를 복구한다.

macOS 진단에서 빈 카탈로그의 기본 요소 삽입/연결과 탭·접기·슬라이더·중첩 구성 **5개**가 통과했다. 이후 직접 입력 직후 Undo/Redo와 `inert` 비교를 추가한 공통 동작 **4개**도 통과했다. 각 동작 시험은 360/768/1280px에서 주입 저장 포트 재열기와 실제 PHP fragment/배포형 공개 JS의 출력·상태를 비교한다. 수정한 slider 단위 시험은 10개가 통과했다. 이 진단은 Docker 정식 통합 또는 실제 G7 v3 저장/발행 성공을 대신하지 않는다.

### 정식 검증과 남은 경계

실행 중 명령은 `make task-integrate-batch TASKS=ip7-inspector-prop-guard-20261013,ip7-element-behavior-contract-r2-20261013,ip7-common-behavior-ui-runtime-20261013,ip7-composition-bundle-20261013 INTEGRATION_TASK=integration-ip7-20261012 FULL=1`이다. FULL 사유는 공통 문서 schema/계약 변경이다. 같은 입력의 성공 gate는 재사용하고 실패/변경 downstream을 다시 검증한다.

직전 결과 경로는 `output/playwright/gates/integration-ip7-20261012/eaf7caee23d424b69b3b47d4276a132247d3b63b6082c26b819d34d54891d7f5/6318d5b70be94c429c16776b30551f5e/`다. 이 실행은 사용자 방향 점검 요청으로 runner에 정상 중단 신호를 보내 **216 통과·1 중단·44 미실행**으로 종료했으며, Local 후보가 깨끗한 기존 기준 SHA로 복구됐음을 확인했다. 이 수치를 통합 성공으로 보고하지 않는다. 정식 결과와 통합 SHA가 확인되기 전에는 진척 원장에 성공 증거를 추가하지 않는다.

### 화면 비교 누락 재현과 공통 수정

직전 Linux 캡처 육안 검토에서 기본 버튼의 공개 출력은 회색, React 미리보기는 투명인 차이를 발견했다. 기존 동작 시험의 geometry·글꼴·ARIA 비교는 배경을 포함하지 않아 이 차이를 검출하지 못했다. `measure`에 전경색·배경색/이미지·각 변의 테두리·정렬·그림자를 추가하자 변경 전 탭 시나리오가 `rgb(239, 239, 239)` 대 `rgba(0, 0, 0, 0)`로 실패했다. 치수 1px 기준은 변경하지 않았다.

TS/PHP 공통 버튼 표현에서 배경 shorthand가 없는 경우에만 native 배경색을 투명으로 설정했다. 작성한 단색/그라데이션 shorthand 및 이미지 longhand는 유지하며, 화면별 override/reset도 보존한다. 블록 이름별 CSS·벤더 변경·별도 상태를 추가하지 않았다.

- 변경 전 재현: UI task worktree의 `output/playwright/behavior-appearance-before-20261013/`, 탭 1개 실패.
- 변경 후 진단: 같은 worktree의 `output/playwright/behavior-appearance-after-20261013/`, 빈 카탈로그 작성과 공통 동작 5개 통과. 공통 동작 4개는 각각 360/768/1280px에서 작성한 색·테두리·반응형 그라데이션까지 비교한다.
- 관련 TS 9개와 PHP 5개(482 assertions) 통과. 새 테스트는 기본 배경, 작성값, 이미지 longhand, 반응형 초기화와 원본 무변경을 확인한다.
- 1280px 슬라이더의 미리보기/공개 fragment 캡처를 나란히 육안 확인했다. 기능 fixture의 배경 차이 해소이지 최종 제품 UI/UX 승인은 아니다.
- 공식 `task-resubmit` 결과는 `bb884be74482a5714343e785439bc766f041c07f`다. 관련 타입·구조·PHPStan·Pint 및 제출 gate를 통과했다. 동일 네 task의 공식 FULL batch를 재시작했으며, runtime 결과는 별도로 확정한다.
- 재시작한 브라우저 증거는 `output/playwright/gates/integration-ip7-20261012/b3180d136a0e50e48fe4c3d0c7aa330cd954b3af2025c1530a6eae6309e2b2d3/8961583954c440bfa7fcb4e08999b958/`에 기록 중이다. 이 경로가 있다는 사실만으로 성공을 판정하지 않는다.

이후 같은 공식 실행의 `structureEditorV3.spec.ts`는 **261개 통과(23.4분)**로 종료했다. 빈 카탈로그에서 기본 요소만으로 작성한 구성, 빌드 후 처음 추가한 구성의 무등록 편집, 공통 동작과 정밀/반응형 조작을 포함한다. 후속 Inspector 2개와 로컬 글꼴/자산 2개도 통과했고 `full-product` gate에 진입했다. 전체 batch 및 통합 SHA는 아직 확정 전이며, 부분 성공으로 계획 상태를 완료로 바꾸지 않는다.

이 실행의 desktop `primitive-authored-tabs.png`와 `unknown-composition-360.png`를 육안 확인했다. 전자는 구성 카탈로그가 비어 있고 기본 요소 삽입 도구와 작성한 레이어가 보이며, 후자는 360px 작업면의 새 구성과 공통 레이어를 보여 준다. 무선택 상태의 독립 시험 화면 두 장으로서 선택 표시·실제 관리자 화면·최종 UI/UX 감사를 대체하지 않는다.

### FULL 시험 환경 누락과 재검증

후속 FULL에서 하네스 471개, PHP 단위 351개(4,204 assertions), PHP 단위/통합 424개(4,836 assertions; 기존 PHPUnit notice 1건), 프런트 검사·예산을 통과한 뒤 기존 제품 브라우저의 template shell 시험 두 건이 실패했다. 실행자가 승인된 임시 테마 전환을 적용하지 않아 `jwsoft-business01` 0.3.1이 활성 상태였다. 실패 화면은 해당 테마의 NOVA WORKS Header/Footer를 유지했고, `gotoOwnedSiteShell`이 기다린 PB 공개 shell 요청은 발생하지 않았다. 현재 `UserTemplateSiteShellDecorator::supports`는 `sirsoft-basic` 1.1 이상만 허용한다. 이를 v3 공통 편집기 실패나 새 테마 지원으로 보고하지 않는다.

같은 환경의 반복 실패를 확인한 뒤 해당 시험 runner에 SIGINT를 보내 종료했다. 제품 브라우저 결과는 **19 통과·2 실패·28 미실행**이며 Site Shell 후속 suite는 실행하지 않았다. 실패 자료는 `output/playwright/ip7-full-template-failure-20261013.fUPw6E/`에 보존했다. Local은 `0c8f0091b911e17aae24525b6a7992d6fecb2d92`의 깨끗한 상태로 원복됐다. FULL Site Part journal `output/playwright/gates/integration-ip7-20261012/2c90f6a1da63a3b0a26e4f912e97c3307f63a991a3d2304092d703847aac24c5/2b69d792c5c2418daaa468309411cb9c/site-part-state.json`은 closed=true, 10세션 모두 restored=true다.

재검증 전 원래 테마 활성 상태와 템플릿 1,667개 파일 해시 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`을 재확인했다. 승인된 공개 `template:activate`로 `sirsoft-basic`을 활성화한 뒤 동일 공식 batch를 실행 중이다. EXIT trap은 정상/실패 종료 모두 `jwsoft-business01`을 다시 활성화하고 목록을 확인한다. 최종 원복·해시·통합 SHA는 이 실행이 종료된 뒤 별도로 확인한다. 이번 브라우저 증거 경로는 `output/playwright/gates/integration-ip7-20261012/b3180d136a0e50e48fe4c3d0c7aa330cd954b3af2025c1530a6eae6309e2b2d3/67f3295085e844f681e451ca6c5ff117/`다.

기존 성공 browser gate의 재사용이 불가능한 원인도 읽기 전용으로 확인했다. `scripts/runtime-state.php`가 현재 DB의 200,000행 자원 한도를 초과해 fingerprint를 반환하지 못했고, 하네스에는 `runtime-proof-unavailable:JSONDecodeError`로 나타났다. 상태 연속성을 증명할 수 없으므로 브라우저 검사는 자동 재사용하지 않는다. 검사 우회, 한도 완화, DB 행 삭제는 실행하지 않았다. 동일 입력이 확인되는 단위/정적 gate와 빌드 산출물은 기존 하네스의 성공 결과를 재사용한다.

### 다음 작업의 제품 연결 경계

2026-10-13 현행 코드를 확인한 결과 `resources/js/editor/main.tsx`는 기존 `PuckEditorAdapter`를 렌더하고, v3는 독립 `mountStructureEditor`와 주입 `DraftPort`에만 연결돼 있다. 서버의 `PageBuilderDocument`·`PageDocumentWritePolicy`·`HtmlDocumentCompiler`는 v1/v2를 처리하며 v3 저장/발행을 제공하지 않는다. 이 사실을 블록 카탈로그 또는 독립 시험 통과로 대체하지 않는다.

다음 제품 연결 작업은 빈 v3 문서의 명시 생성, 버전별 원본 검증/직렬화, 기존 optimistic lock/revision/발행 candidate 흐름 재사용, v3 반응형 공개 renderer, 관리자 버전별 편집기 선택과 실제 저장→재열기→미리보기→발행으로 이어진다. 기존 v1/v2 문서 열기만으로 전환하지 않고, 코어/테마/운영 서버를 수정하지 않는다. 블록별 변환 함수나 시작 구성 추가를 이 경로의 선행조건으로 두지 않는다. IP7 전체, IP8~IP10의 미완료 범위는 그대로 유지한다.

공통 최소 경로의 다음 합격 증거는 카탈로그를 비운 실제 관리자 화면에서 시작한다. 이미지·제목·본문·버튼을 기본 요소로 넣고 중첩·순서·정밀 스타일·모바일 재정의와 한 번의 Undo/Redo를 조작한다. 기존 API의 DB 저장, 화면을 닫은 뒤 재열기, preview, 발행본을 비교한다. 빌드 후 처음 만든 구성에도 같은 도구가 적용되어야 하며 구성 이름별 편집기 등록·재빌드는 허용하지 않는다. 주입 저장 포트와 독립 mount의 검증을 이 실제 제품 경로의 증거로 재사용하지 않는다.

### 실제 공개 연결의 추가 확인 사항

로컬 시험 호스트 `.runtime/gnuboard7/.env`의 `APP_VERSION`은 `7.0.11`이며 `config/app.php`의 fallback도 같다. 현재 runtime 검증을 G7 7.1 호환 검증으로 보고하지 않는다. G7 7.1 기준의 별도 호환 증거와 현재 시험 호스트 결과를 구분하고, 진행 중인 runtime을 임의 업그레이드하거나 코어를 수정하지 않는다.

`sirsoft-basic/src/components/composite/HtmlContent.tsx`의 현재 구현에서 `button`, `style`, `link`는 항상 금지 목록에 포함된다. 설정 override도 기존 금지 목록을 제거하지 못한다. PB의 `TemplateMarkupPolicy` 및 기존 sanitizer 호환 정책도 같은 경계를 가진다. 따라서 현재 `V3/DraftRenderer`의 button·inline 스타일 fragment가 독립 시험을 통과했다고 template shell 공개 출력까지 같다고 볼 수 없다. 기존 `ensureSiteShellButtons`가 제공하는 제한된 `data-g7pb-runtime-button` 복원 경로를 재사용하고, 반응형 CSS는 HtmlContent 내부의 제거되는 style/link 태그에 의존하지 않는 모듈 소유 전달 경로로 검증해야 한다. 보안 필터 완화나 G7 내부 API 사용으로 해결하지 않는다.

현재 `V3/DraftRenderer`는 선택한 viewport의 숨긴 노드를 HTML에서 제외한다. 정적 공개 출력은 같은 구조 트리의 숨김/복구가 breakpoint 변경에 따라 동작해야 하므로, 이 fragment를 한 폭에서 렌더해 그대로 발행하는 방식은 수용하지 않는다. 한 트리를 유지하며 세 폭과 경계 폭의 실제 출력·키보드/동작 상태를 비교해야 한다. 이 확인은 아직 제품 수정이나 공개 출력 성공을 뜻하지 않는다.

서버 연결 준비 task `ip7-canonical-storage-20261013`은 `src/Domain/Documents/V3/ValidatedDocument.php`와 `tests/UnitPhp/ValidatedDocumentV3Test.php` 두 파일만 소유한다. 기존 v3 Validator를 주입받는 불변 JSON 값으로, 새 wire 문법·HTTP API·DB 테이블·블록 변환을 추가하지 않는다. `toArray()`는 중첩 객체/목록 구분을 유지한 새로운 사본을 반환한다. 잘못된 JSON/구조·구형 포맷·미지 필드·위험한 URL은 원본을 보정하지 않고 기존 검증기로 거부한다.

공식 제출은 `7673a1758235a5ed213ad2c54b8dce944af76a14`이며 관련 PHP 12개(35 assertions), 구조·Pint·PHPStan 검사를 통과했다. 통합 및 lifecycle 브라우저 gate는 대기 중이다. 이 값은 아직 기존 저장소/서비스에 연결하지 않았으므로 실제 DB 저장 성공이나 IP7 완료 증거로 올리지 않는다. 이어지는 연결에서는 JSON 객체를 associative array로 읽었다가 빈 객체를 목록으로 저장하는 문제, 문서 ID·버전 변경, 기존 SEO·revision·발행본 보존을 함께 검증한다.

브라우저 저장 연결 task `ip7-v3-api-storage-20261013`은 별도 managed worktree에서 다음 5개 파일만 소유했다: `resources/js/api/pageBuilderApi.ts`, `resources/js/api/v3DocumentResource.ts`, `resources/js/editor/v3/apiDraftPort.ts`, `tests/Unit/v3DocumentApi.test.ts`, `tests/Unit/v3ApiDraftPort.test.ts`. 공식 제출 SHA는 `7e19b05c4482b82d149dfebebce2ebb6ec674f1f`다. 기존 인증·HTTP 오류 처리와 문서 GET/초안 PUT endpoint를 재사용하며 새 endpoint·블록별 분기·문서 문법을 만들지 않는다.

- 공통 API client에는 버전 중립적인 원본 전송만 추가했다. v3 응답 검증과 DraftPort 연결은 v3 전용 모듈에서 수행하여 기존 manager/editor import graph에 v3 schema를 추가하지 않는다.
- 요청의 v3 원본·ID·잠금 번호와 응답의 문서 버전·ID·metadata·증가한 잠금 번호를 검사한다. 구형 응답이나 잘못된 빈 객체를 v3로 보정하지 않는다. CAS에는 `lock_version`을 사용하며 문서 `revision`과 혼동하지 않는다.
- API/어댑터의 관련 진단 71개, 타입·변경 소스 구조 검사를 통과했다. 공식 scoped 제출에서도 관련 API 소비자 시험과 타입·구조 검사를 통과했다. 저장 중 새 입력·세션 전환·readonly 전환 시 기존 session이 최신 원본/Undo를 유지하는 시험을 포함한다.
- 자산 빌드와 `pageBuilderLifecycle.spec.ts`, `structureEditorV3.spec.ts`는 통합 gate로 남아 있다. 서버 v3 수용과 실제 관리자 mount는 아직 연결 전이며, 이 제출의 mock HTTP 시험을 실제 DB 저장·재열기·발행 성공으로 보고하지 않는다.

서버 직렬화/빈 문서 생성 task `ip7-document-storage-20261013`은 canonical storage 제출 SHA 위에서 정확한 4개 파일(`src/Application/Documents/DocumentStorageCodec.php`, `src/Application/Documents/EmptyStructureDocument.php`, 대응하는 `tests/UnitPhp/*Test.php` 두 파일)만 변경했다. 공식 제출 SHA는 `073407f04f0038e74594ef68e76679722753ce14`이며 관련 PHP 24개(77 assertions), 구조·Pint·PHPStan 및 제출 gate 6개를 통과했다.

- 버전 분기와 검증은 기존 v1/v2 원본 및 v3 불변 값으로 연결한다. v3 JSON을 연관 배열로 평문화하지 않고, 과거 값의 읽기 전용 복구를 새 리비전 쓰기 허용으로 확대하지 않는다. 요청 경로와 다른 문서 ID를 덮어쓰거나 구형 문서를 자동 전환하지 않는다.
- 새 v3 빈 문서는 catalog/Block Registry/렌더러/G7 없이 생성한다. 블록·자산 목록은 비어 있고, 필수 6개 의미 색상 토큰은 호출자가 제공하며 공통 스키마로 검증한다. 첫 시험에서 빈 토큰 객체가 공통 스키마의 필수 토큰을 충족하지 못한 것을 확인해 생성 입력을 바로잡았다. 스키마를 완화하거나 블록별 기본값을 추가하지 않았다.
- 두 Application 클래스는 아직 기존 Repository/Service/Controller에 연결 전이다. 따라서 이 제출은 실제 DB 저장 또는 관리자 화면 연결의 증거가 아니며, IP7 완료 상태를 변경하지 않는다. 진행 중인 공통 계약 batch 통합 후 공유 계약 lease 아래 실제 저장 경로에 연결한다.

지원 테마로 전환한 공식 재검증에서 `structureEditorV3.spec.ts` **261개가 23.8분에 통과**했다. 증거는 앞서 기록한 `67f3295085e844f681e451ca6c5ff117` 경로이며, 빈 카탈로그·빌드 후 미등록 구성 편집 시나리오를 포함한다. 같은 실행의 Inspector 2개, 자산 2개, 전체 제품 브라우저 49개(8.8분), Site Shell 45개(1.7분)도 모두 통과했다. FULL PHP 단위/통합은 424개·4,836 assertions(기존 PHPUnit notice 1건), PHP coverage는 76.48%였고 프런트·빌드·예산 gate도 통과했다. 최종 공식 batch 통합 SHA는 `22607a6d866b9070425cdf506551650d8024189c`다.

종료 후 `jwsoft-business01` 0.3.1 활성·`sirsoft-basic` 1.1.4 비활성을 확인했다. 템플릿 1,667개 파일 해시는 시작 전과 같은 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`이다. FULL fixture journal `output/playwright/gates/integration-ip7-20261012/2c90f6a1da63a3b0a26e4f912e97c3307f63a991a3d2304092d703847aac24c5/0793c6fabc5a433689f394c57a1ece27/site-part-state.json`은 closed=true, 16세션 모두 restored=true다. Local Git 작업 트리도 깨끗했다. 이 성공을 실제 관리자 v3 API 연결 성공으로 합산하지 않는다.

제품 진입점도 재확인했다. `ViewerController::editor`는 문서 ID/언어/runtime 설정을 Blade에 전달하고 `editor.blade.php`는 기존 편집기 IIFE/CSS만 로드한다. v3 시험은 `structureEditorV3.spec.ts`의 `beforeAll`에서 실제 `mount.tsx`를 Vite `write:false`로 빌드해 주입한다. 따라서 후속 연결에는 제품용 v3 번들과 인증된 버전별 진입도 포함해야 한다. 시험용 빌드 성공을 배포 자산 제공으로 보지 않으며 두 편집기 커널을 한 화면에 중첩하지 않는다.

다음은 아직 입증하지 않은 요구이며 지원 제외로 변경하지 않는다.

- 반응형으로 동작 참여 요소를 숨김/복구할 때 참조·초기 상태·키보드 동작의 일관성.
- 작성자가 바꾼 슬라이드 폭·간격·다중 표시/배치와 안정 ID 기반 초기 슬라이드의 의미.
- 미디어/폼/서비스 데이터/고정 G7 컨트롤의 공통 기능 계약, PB Header/Footer 상세 편집과 shell preview.
- 기존 문서·Site Part의 명시 이행/거부/복원, 실제 G7 v3 저장·발행, IP8~IP10과 최종 E2E·UI/UX 감사.

진단 캡처의 360px 탭과 슬라이더 전환 화면을 확인했지만, 이는 기능 fixture이며 최종 편집기 외형·발견성·전체 접근성 승인이 아니다. G7 코어·테마 원본·운영 서버를 변경하거나 배포하지 않았다.
