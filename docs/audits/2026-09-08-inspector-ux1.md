# 독립 PB 우측 설정 개선 1차

상태: 구현·로컬 통합·관련 동작 검증 완료. 운영 배포는 이번 범위에 포함하지 않았다.

기준 SHA: `499e8361052ace420b1ed7e750bcd2177908d767`. 통합 task: `integration-inspector-ux1-20260908`.

## 결과와 범위

- PAGE 주요 6개 설정을 간결한 선택 버튼과 색상 견본으로 통일했다. 현재 색상명, 보충 툴팁·접근성 설명을 유지하고 반복 박스·설명 간격을 줄였다.
- 공통 배치 4개 설정의 기능명을 표시한다. 짧은 가로·세로 정렬은 아이콘 라디오, 선택지가 5개인 폭·높이는 라벨이 있는 Select를 사용한다.
- 반복 배경·여백·제목 단계는 같은 선택 컴포넌트를 사용한다. 선언된 옵션 값과 기존 Puck 명령·문서 저장 계약을 유지한다.
- 태블릿·모바일 공통 스타일을 접고 별도 지정 개수를 요약한다. 기존 기기별 값 변경·초기화·Undo 동작을 유지한다.
- 편집기 JS/CSS 주소에 실제 파일 SHA-256을 넣어 이전 파일의 장기 캐시와 구분한다. G7 코어와 공개 페이지 자산 정책은 변경하지 않았다.

![PAGE 공통 설정](../../output/playwright/gates/integration-inspector-ux1-20260908/3e543c4e77c76f2fcf05195ca05f00e75b66ea9d767944675df1721163ebf671/e48611962ab7478ea31340a1b5e9428d/results/editorInspectorUx-inspecto-00510-stent-after-undo-and-reopen-desktop/page-inspector.png)

![블록 설정과 기기별 요약](../../output/playwright/gates/integration-inspector-ux1-20260908/3e543c4e77c76f2fcf05195ca05f00e75b66ea9d767944675df1721163ebf671/e48611962ab7478ea31340a1b5e9428d/results/editorInspectorUx-inspecto-00510-stent-after-undo-and-reopen-desktop/block-inspector.png)

## 구현·통합

| 대상 | 제출 SHA | 통합 SHA |
|---|---|---|
| 우측 UI | `11bff407a1f657dfe90c90f53d5dba49cfc8756e` | `fcd9419a3730042130d8db395774e1cb30347797` |
| 기존 브라우저 시험의 새 컨트롤 연결 | `edcb8c2885e91b07942fc67a48c1bac37838ad1c` | `fcd9419a3730042130d8db395774e1cb30347797` |
| 자산 해시 변경의 한정 검사 분류 | `73708c735b3b136ac4694e911dddc8bad380cf94` | `12c9407e7055541d516eec1650e8580deee28b5d` |
| 자산 해시와 캐시 시험 | `8aa75064aeab072149becf217051d8667a3e51e1` | `095ea5d2eca2d10fc60b217348d0115997358c52` |

자산 분류 보완은 editor.blade.php에 정해진 해시 계산과 두 URL만 정확히 추가할 때 적용한다. 인증·마크업·임의 PHP 변경, 부분 적용, 시험 부재, 심볼릭 링크는 기존 거부/전체 검증 경계를 유지한다. 긍정·부정 4개 하네스 시험 및 관련 planner 시험 78개가 통과했다. 범용 view 검사 면제는 추가하지 않았다.

## 검증

환경: Node 24, 로컬 `g7pb-dev`, `https://g7pb.test`, Playwright desktop. PC 전용 편집 정책은 유지한다.

- TypeScript strict, 변경 CSS·구조 검사, production build·asset 검사 통과. 신규 구조 부채 없음.
- 직접 관련 단위 5개 파일 46개 시험 통과. 이후 scoped 하네스가 의존 관계에 맞는 26개 단위 파일을 선택해 검사하거나 동일 입력 성공 결과를 재사용했다.
- CSS 편집기 계열 원본 크기 179,897/180,100 bytes. 한도 증액 없음.
- 빌드 fingerprint: `64df4ee30e2aef98011c085d636527294d8ee7210c15c28bcea36afacaee865b`.

| 실제 브라우저 시나리오 | 결과 | 확인한 동작 |
|---|---:|---|
| editorInspectorUx | 1 통과 | 키보드 선택, 라벨·패널 폭, 기기별 요약, Undo/Redo, 저장·재열기 |
| editorCatalogCode | 6 통과 | 중첩 요소, 반복 항목, 반응형 상속·초기화, 편집값 유지 |
| pageBuilderLifecycle | 3 통과 | 문서 흐름, 템플릿 미리보기, 중첩 배치 |
| editorInteractionQuality | 2 통과 | 포인터 접근과 리치텍스트 유지 |
| editorStructureTheme | 6 통과 | 테마, 중첩 선택·삽입·이동·복제·삭제, 모달 불투명성 |
| editorAssetIdentity.editorInteractionQuality | 1 통과 | 실제 view의 내용 해시 주소와 이전 immutable 캐시 분리 |

총 19개 브라우저 시나리오 통과. UI 화면은 위 첨부 PNG로 직접 확인했다. 최종 검사에서 Undo 뒤 contenteditable 재진입을 사이에 넣은 시험의 Redo가 비활성화되는 경우를 발견했다. 해당 시험은 두 이력 명령 사이에 추가 편집 클릭을 넣지 않고 캔버스의 실제 반응형 클래스 소멸·복원을 검사한다. Redo 뒤 패널 값과 저장·재열기 확인도 유지한다. 이 차수에서 Puck 선택 이력을 변경하지 않았다.

캐시 시험은 실제 G7 편집기가 렌더한 URL을 읽어 dist 파일 해시와 비교한다. 로컬 G7의 응답은 `no-cache, private`이므로, 별도 루프백 HTTP fixture에서 운영의 `public,max-age=31536000,immutable` 조건을 재현했다. 이전 무버전 JS/CSS를 먼저 로딩한 동일 브라우저에서 새 해시 URL로 진입·일반 새로고침할 때 새 파일이 사용됨을 검증했다. 운영 브라우저 재검증이나 배포 성공을 뜻하지 않는다.

실행: 각 task의 `make task-submit`, UI와 시험의 `make task-integrate-batch`, 캐시 작업의 `make task-integrate-scoped`. 하네스가 선택한 Playwright spec은 desktop/retries=0으로 실행했다. 성공 입력을 재사용하며 전체 검증으로 확장하지 않았다.

로컬 증거 루트: `output/playwright/gates/integration-inspector-ux1-20260908/`.

- UI: `3e543c4e77c76f2fcf05195ca05f00e75b66ea9d767944675df1721163ebf671/e48611962ab7478ea31340a1b5e9428d`.
- 캐시: `4382a9a2be97209537caa3d19312afda81ba40ca2280016b43ce08964ff64b11/8a9e6ab9359d46dd93b1e75407e47371`.

## 남은 범위

이 기록은 우측 설정 개선 1차의 수용 결과다. 편집기 전체의 상용 완성 판정이 아니다. Hero 모바일 출력 불일치, 슬라이더 HTML 라벨, 내부 자식 구조 확장, 콘텐츠/킷 증설, 발행·운영 배포는 이번에 처리하지 않았다. 다음 차수는 편집값과 실제 출력의 일치 문제를 대상으로 별도 진행한다.
