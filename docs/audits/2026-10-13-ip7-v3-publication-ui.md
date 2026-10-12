# IP7 공통 요소 편집기의 공개 미리보기·발행 UI

상태: 공개 미리보기·발행 UI 및 화면 감사에서 발견한 작업면 배경 보완의 Local 통합 검증 완료. IP7 전체와 IP8~IP10 완료 또는 운영 배포를 뜻하지 않는다.

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

## 공식 통합과 검증 경계

제출 `b9550443598894635ea87fae0045ff7679900c0d`와 검사 등록 `57d1aaa388f5002de746b0d04f7221f627c4f52c`를 공식 batch로 통합했다. Local 통합 SHA는 `04ba68777a0b15dd1f68a3a0c9120b33394f7ea0`다. Node 24·PHP 8.5·고정 Docker Chromium의 scoped 계획 16개 변경/69개 gate를 통과했다. 입력이 같은 성공 검사는 재사용했고 기준을 완화하지 않았다.

- 제품 UI 12개 통과, 실패/skip/flaky 0: `output/playwright/gates/integration-ip7-20261012/9b4549dad24243eeaf32ce152cd04d8ff5bbbe208249c39ce513df6314b73136/0c8edc1871364ceeb84a54d2f7590701/results.json`.
- 기존 문서 생성·발행·복원·재발행·발행 해제 1개 통과: `output/playwright/gates/integration-ip7-20261012/88f590fab00709173e5f2f0aeabdd56904188e2d3aaeb9f8f571dffa7d74d3ab/0d38c228714e4a2f8ed56913a821e5b0/results.json`.
- 독립 편집 회귀 87개 통과, 실패/skip/flaky 0: `output/playwright/gates/integration-ip7-20261012/ab4bd5ae9f2d4a51f9aae30a121645ff29e0d3216848c7f7e62eefc7f01060fa/cedee46b4e4f4c058a1cfba3e95ce833/results.json`.
- 임시 테마는 `jwsoft-business01 0.3.1` 활성으로 원복했다. 관련 테마 원본 1,667개 파일의 집계 SHA256은 전후 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`로 같다.

제품 시나리오는 빈 문서에 제목을 직접 삽입하고 PC/모바일 글자 크기를 다르게 지정한 뒤 인증 저장·미리보기·Esc 취소·명시 발행·공개 조회를 수행한다. none/template/builder의 미리보기와 공개 출력에서 같은 요소 텍스트/글자 크기/표시와 치수 1px 기준을 비교했다. 후속 본문 초안을 저장해도 공개 hash와 출력은 그대로이며 재열기에 새 초안이 남는다. 이는 전체 요소의 canvas/public 치수 수용이나 미디어·Site Part·동시성 전체 완료를 뜻하지 않는다.

확인창과 3개 출력 방식의 3개 폭 공개 화면을 육안 확인했다. 제목 및 해당 화면에 보이는 공통영역은 가림/잘림 없이 표시됐다. 캡처 추출본은 `output/playwright/publication-passed-review-3NpHk0/`이며 원본은 제품 JSON 보고서의 첨부다. UI 과밀도·전체 긴 내용·전체 접근성 등 최종 UX 감사는 남아 있다.

## 작업면 배경 후속 보완

같은 제품 캡처의 768/360px 편집 작업면에서는 흰 페이지 배경이 사라졌다. 기능 시험 성공을 이 화면의 UX 합격으로 바꾸지 않았다. Local의 별도 소유 진단 문서로 재현한 결과 Puck가 호스트 `g7pb-editor-shell` 클래스와 스타일시트를 iframe에 복사한 뒤 html/body 배경이 투명에서 `rgb(243, 241, 237)`로 바뀌었다. 스타일시트 수는 초기 2개에서 3개로 증가했다. 폭 자체의 반응형 디자인 문제가 아니라 지연된 호스트 스타일 복사에 의한 작업면 덮임이다.

진단 중 iframe html/body 배경만 투명하게 바꾸자 360px 작업면 경계가 정상 표시됐다. 근거: `output/playwright/workspace-background-diagnostic-pUz4zn/measurements.json`, `before-360.png`, `transparent-frame-360.png`. 진단 문서는 소유 slug를 확인해 보관 처리했고 사용자 문서와 테마 파일은 변경하지 않았다.

`ip7-workspace-surface-20261013`은 `WorkspaceFrame`의 공개 iframe 문맥 안에서 배경색만 격리하고 해제 시 원래 inline 값/우선순위를 복구한다. 작성한 요소 배경·문서 값·Undo는 변경하지 않는다. 관련 단위 시험과 실제 호스트 스타일 로딩 이후 세 폭의 배경/화면 검사를 추가하며, 화면 캡처는 진행 중 애니메이션을 끝낸 상태로 수집한다. 후속 보완의 제출/통합/실제 회귀 결과는 확보 후 기록한다.

## 작업면 수정 검증 완료

제출 `15f027537710471dcedadb324e69733ba10c4fe2`, Local 통합 `7c1fad72eb4f26e2d2632877e59423a3d56fb551`. 공식 `make task-integrate-scoped TASK=ip7-workspace-surface-20261013 INTEGRATION_TASK=integration-ip7-20261012`가 6개 변경/11개 gate를 통과했다. Node 24·PHP 8.5·고정 Docker Chromium이며 동일 입력 성공 검사는 재사용했다.

- 실제 제품 UI **12/12 통과**: `output/playwright/gates/integration-ip7-20261012/9f014c4b7ae4fc79d641e2e490c6db752ca437a9ef9d7fd54d112dbf7b1f56fb/5ed4d8ae0a49445ea55ba99502ea3cb3/results.json`.
- 독립 구조 편집 **87/87 통과**: `output/playwright/gates/integration-ip7-20261012/d9061f22b4b2b70b8cfcc0e4528eab44498a3f32841d02c7ea6f2eb9f75793b2/648d191c658a4286947a2eae57e90549/results.json`.
- 두 보고서 모두 실패·skip·flaky 0. 실제 UI 시험은 호스트 스타일시트 복사가 완료된 뒤 iframe html/body 투명 및 작업면 흰 배경을 확인한다. 단위 시험은 원래 inline 값/priority·높이 복구와 작성 요소 배경 불변을 확인한다.
- 원본 보고서의 360/768/1280px 캡처 추출본 `output/playwright/workspace-fixed-review-XccuCA/`를 육안 확인했다. 작업면과 주변 배경 경계가 보이고 입력한 제목이 유지된다. 이 간단한 문서의 가독성 확인을 전체 UI·UX 감사로 확대하지 않는다.
- 실행 종료 시 `jwsoft-business01 0.3.1` 활성·`sirsoft-basic 1.1.4` 비활성으로 복구됐다. 관련 테마 1,667개 파일의 집계 SHA256은 `0245183e355cb1e96851ee005d6718e825bb8969bd2686dad42bda4c2b3c6981`로 이전과 같다. G7 코어·테마 원본·운영 서버를 수정하지 않았다.
