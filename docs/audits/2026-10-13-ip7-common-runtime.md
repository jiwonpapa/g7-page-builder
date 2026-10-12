# IP7 공통 링크와 콘텐츠 동작 검증

IP7은 진행 중이다. 이번 작업은 구성 이름별 편집 코드를 추가하지 않고, 공통 링크 계약과 기존 접기·탭 실행 코드의 재사용 경계를 보완했다. v3 동작 문서 계약·명령·Inspector·React/PHP 출력 연결은 후속 구현이며, 이 기록을 전체 카탈로그 또는 공통영역 편집 완료로 합산하지 않는다.

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

다음은 안정 노드 참조를 사용하는 공통 동작 계약과 편집 명령을 연결하고 동일 트리의 React/PHP 출력 및 저장 재열기를 확인하는 작업이다. 블록별 runtime 분기, 불투명 legacy 요소, 사용자 문서 자동 이행은 추가하지 않는다. 슬라이드·다른 동적 기능·Header/Footer·명시 이행과 IP8~IP10도 남아 있다.
