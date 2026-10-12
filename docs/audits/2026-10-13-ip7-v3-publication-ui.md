# IP7 공통 요소 편집기의 공개 미리보기·발행 UI

상태: 구현·검증 진행 중. IP7 전체와 IP8~IP10 완료 또는 운영 배포를 뜻하지 않는다.

- task: `ip7-v3-publication-ui-20261013`, scoped 14개 정확 파일, 기준 `0566243557d238736e222d4b92850853b48ff35d`.
- 기존 단일 Puck 문서/이력과 DraftPort로 현재 입력을 저장한다. 같은 편집 epoch의 저장 성공만 공개 미리보기·발행 준비로 전달한다. 블록 이름별 분기·등록·새 원본·새 Undo를 추가하지 않는다.
- 서버의 기존 preview/prepare/commit API를 공통 인증 transport로 재사용한다. 응답의 token/hash/시각/경고/동일 출처 URL을 검증한다. 서버 프로토콜과 DB는 변경하지 않는다.
- 준비 이후 변경/Undo/세션 전환/readonly는 확정을 거부한다. 명시 확인 전에는 commit하지 않으며, 전송 후 새 입력은 별도 초안으로 남긴다. 실패 응답은 자동 재시도하거나 발행되지 않았다고 단정하지 않는다.
- native dialog의 초점·Esc·취소와 같은 스타일 토큰을 사용한다. 구조 미리보기는 유지하고 공개 미리보기 링크를 구분한다. frontend 스킬은 작업면 중심의 기존 UI와 상태·확인 동작에만 적용했다.
- 실제 제품 E2E에 세 출력 방식 none/template/builder의 UI 생성→편집→저장→미리보기→취소/확정→공개→새 초안→재열기를 추가한다. 세 폭 글자 크기와 공개/미리보기 노드·치수(1px)를 비교한다. 전체 정밀 편집/최종 UX 수용을 대신하지 않는다.
- 초기 단위 검증에서 테스트 mock의 union 타입과 jsdom의 미제공 native dialog API를 확인했다. 타입 분기와 시험용 dialog shim을 보완하며 실제 브라우저 초점·Esc 시험은 별도로 유지한다.
- 관련 API/세션/호스트 기존·신규 시험에서 최초 81개 통과, dialog shim 보완 뒤 UI 8개 통과, 발행 후 원본/세션/dirty 보존 회귀를 포함한 호스트 14개 통과. 타입 검사와 변경 소스 7개의 구조 검사가 통과했다. 실제 제품 E2E는 아직 실행 전이다.
- 검증 결과·제출/통합 SHA는 확보 후 추가한다. 진척 원장/표시판은 후속 소유 proof task에서 통합 증거와 함께 갱신하며 IP7을 완료로 올리지 않는다.

## 최초 제출과 브라우저 선택자 보완

최초 제출 `08153bacf873948138a6baa66f934649657af84e`는 관련 55개 계획 gate 중 제출 대상 검사를 통과했다. 새 사용 사례 17개·API 24개·UI 8개 및 호스트 14개가 통과했으며, 브라우저 실행은 통합으로 이관했다. 검사 등록 제출 `57d1aaa388f5002de746b0d04f7221f627c4f52c`와 함께 실행한 Local 통합에서 빌드·타입·구조는 통과했으나 새 E2E가 생성 폼의 출력 방식 `getByLabel(... exact: true)`를 찾지 못했다. 실제 combobox는 존재하며 옵션 텍스트를 포함하는 label 조회와 접근성 이름 조회의 차이다. 기존 3개 제품 생성·저장 시험은 통과했고 새 9개는 생성 요청 전에 실패했다. 통합은 원복되고 로컬 원래 테마도 복구됐다.

원 제출·증거를 보존하는 `ip7-v3-publication-ui-selector-20261013` replacement에서 기존 성공 시험과 같은 combobox role/name 선택자로 수정한다. 시나리오·기준을 줄이지 않는다. 확인 문구도 내부 CAS 숫자를 사용자가 보는 문서 revision처럼 표시하지 않도록 바꾼다. 실패 증거: `output/playwright/gates/integration-ip7-20261012/4d2db1ce1c8bf925ff58eeacb393b02473f2e7a6a22f3deac43f0f30d0ddcc30/94e6cd58fedf4f4f895a6e67672b7db3/`.

선택자 보완 제출 `0420dd5cc5bc7a85cd83802e14b8da1978edcc56`의 다음 통합은 12개 중 11개 브라우저 시나리오를 통과했다. mobile 프로젝트의 template 출력 비교 1건에서 직전 27px CSS 확인은 성공했지만 이어진 샘플의 font/display가 빈 문자열로 읽혔다. Chromium에서 SSR 표면을 같은 clone으로 교체하고 이전 element를 측정하는 진단으로 연결 전 `{27px, block}`, 분리 후 `{'',''}`, 현재 노드 `{27px}`를 재현했다. 최초 측정은 연결 상태를 검사하지 않아 교체 중인 표면도 비교에 사용했다.

`ip7-v3-publication-ui-ready-20261013` replacement는 글꼴·이미지 준비, DOM 연결, 두 animation frame의 동일 치수를 확인한 표면만 측정한다. 준비되지 않은 측정만 다시 수집하며 서로 다른 출력의 비교 실패를 재시도하지 않는다. 텍스트·computed style 동일성과 1px 치수 기준, 12개 시나리오는 유지한다. 두 번째 실패 증거는 `output/playwright/gates/integration-ip7-20261012/50f5a52ffee94fefcf2ce370b66f0594a9c2447baffee4fa1f134eb735189198/65d8307221304fa0848b43767bcb6efc/`에 보존했다. 통합은 원복됐고 jwsoft-business01 0.3.1 활성 상태로 복구했다.
