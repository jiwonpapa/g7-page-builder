# IP7 공통 아이콘의 설치형 출력 검증

공통 아이콘 구현은 `8fc034dc1b84ecdca2b9eda131282e23e9167773`로 공식 제출됐다. 새 기본 요소가 어떤 구성에서도 같은 편집 명령·스타일·저장 경로를 사용하는지 확인하며, 블록 이름별 편집기 등록을 추가하지 않는다. 이 차수는 검사 등록·실제 제품 시험·기존 공통영역 통합 증거 정리에 한정한다.

## 하네스 보완과 제품 시험

사용자가 승인한 하네스 두 파일은 `tools/g7pb/browser_requirements.py`, `tests/Harness/test_browser_requirements.py`다. 기존 선택 목록에서 누락된 독립 아이콘 시험을 추가하고, 공통 Inspector·렌더·PHP 출력 변경에 설치형 v3 시험도 요구한다. 기존 시나리오·재시도 0·1px 비교 기준은 유지한다. 하네스 시험이나 Playwright 수집 결과를 제품 실행 성공으로 보고하지 않는다.

설치형 `structureDocumentProduct.spec.ts`에 세 출력 방식 `none`, `template`, `builder`의 시험을 추가했다. 관리자 UI에서 새 페이지와 공통 아이콘을 만들고, 의미 설명·장식용 구분·크기·모바일 재정의·실제 인증 저장·새로고침·미리보기·명시 확인 후 발행을 검사한다. 세 폭에서 편집/미리보기/공개 SVG와 접근성 속성 및 크기를 비교하고, G7 처리 이후 복원 마커가 남지 않는지 확인한다. 시험이 만든 정확한 문서만 마지막에 보관 처리한다.

task `ip7-icon-product-proof-20261013`은 깨끗한 통합 `59116bfa685959d5eb56bbedc629c8a6053eed12`에서 정확한 파일 8개를 소유한다. 아이콘 제품 소스 제출과 기능적으로 의존하며 파일 소유권은 겹치지 않는다. 공식 batch 통합에서 공유 계약·공개 runtime 변경 사유의 FULL 검증을 수행한다. IP7 상태는 진행 중이며 G7 코어·운영 서버·기존 문서 자동 전환은 범위 밖이다.

## 현재 판정

최종 소스 `11789652d494656f4a77c2816b192a70d1a6152e`와 제품 검사 `b3f534f97ab5bb1cca2c3a3f96b128acabb36a4e`를 `8025bbcec8c3e3d29ad3b4995b264e6326a5a105`로 통합했다. 설치형 21개·독립 264개가 실패·skipped·flaky 없이 통과했다. 공통 아이콘의 구현과 해당 경로 수용 결과이며 IP7 전체·IP8~IP10·전체 UX 최종 승인이나 배포 완료는 아니다. 아래 실패 기록은 보완 전 이력이다.

## 최종 실행 결과

Local `integration-ip7-20261012`의 runtime lease에서 Node 24·PHP 8.5·G7 7.0.11·검증용 `sirsoft-basic` 1.1.4를 사용했다. 공식 `make task-integrate-batch TASKS=ip7-common-icon-element-20261013,ip7-icon-product-proof-20261013 INTEGRATION_TASK=integration-ip7-20261012 FULL=1`을 실행했다. 공유 문서 계약과 공개 runtime 변경에 따른 FULL 검증이며 G7 7.1 호환성 증거로 확대하지 않는다.

- 설치형 21개 결과: `output/playwright/gates/integration-ip7-20261012/e91c139c9518d3b23dadc32ff6a9c6ef35402d5f8829d20d2eedcd425a3740da/a05777c6c44443a3b5ee0c16f1487d05/results.json`. UI 저장·재열기·미리보기·명시 발행과 27개 폭별 측정에서 SVG 크기 최대 차이 0 CSS px, 공개/미리보기 PNG 54개, 생성한 문서 21개 모두 보관 처리 확인.
- 독립 264개 결과: `output/playwright/gates/integration-ip7-20261012/f5e7281bc5039b013ee2ea3e9b112586390da027150ccfba925219f823d9e10e/978301e1b5d04350812620e9eabe1299/results.json`. 빈 카탈로그·같은 빌드의 미등록 구성·23종 공통 아이콘·공통 이력·세 폭의 PHP 비교를 포함한다.
- 기존 구조/테마 6개, 공개 runtime 4개, 제품 흐름 49개, 셸/모바일 메뉴 45개가 통과했다. FULL 하네스 483개 및 프런트·PHP·커버리지·빌드 gate도 통과했다. 전체 제품 흐름 49개는 이번 실행에서 재시도 없이 통과했다.
- FULL Site Part 보호 journal `output/playwright/gates/integration-ip7-20261012/d426803819a9c8bf3f2d43a768943b6059ccf4d7d44f1daabf3707d6ab93a94f/d400d9b8cc1f43f7adc35015665433b2/site-part-state.json`의 16개 세션이 모두 복원되고 `closed=true`다. 종료 trap 후 원래 `jwsoft-business01` 0.3.1 활성·`sirsoft-basic` 비활성을 확인했다.

육안 검토는 이번 설치형 결과의 `icons-none-public-1280`, `icons-template-public-360`, `icons-builder-public-768` PNG에서 별·체크·표적의 표시와 크기·가로 넘침 부재를 확인한 범위다. 23종의 모든 화면을 육안 승인하거나 전체 작업면 UX 수용을 완료한 것으로 확대하지 않는다. 기존 사용자 문서 자동 전환·운영 서버 변경·배포는 수행하지 않았다.

## 통합 실패와 보완

첫 실행은 21개 중 기존 12개 통과·새 아이콘 9개 실패였다. 발행 HTML에 직접 포함된 SVG를 기존 G7 마크업 정책이 거부했다. 정책을 완화하지 않고 발행 결과에는 검증된 복원 마커만 생성하도록 공통 출력 소스를 보완했다. 실제 HtmlCompiler로 23개 아이콘과 3개 출력 방식의 조합을 회귀 검사했다. 증거는 `output/playwright/gates/integration-ip7-20261012/7104f021141b938d1e84bd07a0c4dcfff407de3017d0a6b0750aa5e02d472caa/c5a68cdb7b8c43e69a28535195bc4908/results.json`이다.

두 번째 실행은 실제 미리보기 생성·발행을 통과한 뒤 편집 캔버스의 접근성 역할 비교에서 9개가 실패했다. 편집 중 Puck이 부여하는 선택 버튼 역할과 장식용 공개 아이콘을 같은 것으로 비교한 오류와, 선택 대상을 `aria-hidden`으로 감추던 소스 문제를 함께 보완했다. 편집 시 장식용 아이콘은 이름 있는 선택 버튼이고, React 미리보기·PHP 출력·공개 페이지에서는 장식 요소로 숨긴다. 의미 있는 아이콘은 모든 화면에서 설명을 가진 이미지 역할을 유지한다. 증거는 `output/playwright/gates/integration-ip7-20261012/1134fe7733e07ba24453151b4e6db2ca3435ccaf45385dcc5d1f10d7475e2111/eaab882ae047471b89663bf31a1e784e/results.json`이다.

공통 소스 보완은 `09d06f0dd70782d5d4fe875884b72bd35e571b5f`로 재제출했다. 제품 시험은 편집·미리보기·공개 의미를 각각 명시적으로 검사하며, 도형·색상·크기 1px 기준을 유지한다. 두 통합 실패는 Local 기준 `59116bfa685959d5eb56bbedc629c8a6053eed12`로 원복됐고 임시 검증 테마도 원래 테마로 복구됐다. 다음 공식 batch 실행이 최종 판정을 결정한다.

세 번째 실행은 21개 중 20개 통과·1개 실패, skipped/flaky 0이었다. 모바일 프로젝트의 template 출력에서 DOM 교체 시점에 분리된 SVG를 측정해 계산 스타일이 빈 문자열로 나왔다. 같은 파일의 기존 공개 측정 조건과 같이 연결된 3개 아이콘·유효한 계산 스타일·두 프레임 안정성을 확보한 뒤 한 번 출력 비교하도록 보완했다. 불안정한 측정 대상만 다시 찾으며, 색상·의미·도형·1px 불일치는 재시도하지 않는다. 증거는 `output/playwright/gates/integration-ip7-20261012/aea0d7a3f8ad680088c6723b2cefb3000174a2f9f1773564f42758cb633a7e70/613ece745e344a71aa6fb13a4e928308/results.json`이다. 이 실행에서도 시험 문서 21개 보관, Local 기준과 원래 테마 복구를 확인했다.
