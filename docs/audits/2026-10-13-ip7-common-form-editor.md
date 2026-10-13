# IP7 공통 폼 편집과 페이지 문의 연결

공통 입력·라벨과 고정 제출 역할을 독립 편집기·출력에 연결한다. 구성 이름별 편집기는 추가하지 않는다. 기준은 계약 제출 `f015a1dc6244e0e051cef40fc80cfac28611e30b`, 구현 task는 `ip7-common-form-editor-20261013`이다. IP7은 진행 중이며 실제 브라우저 수용과 통합은 후속 검증 대상이다.

## 화면과 명령

시각 방향은 기존 작업면과 Inspector의 중립 표면·의미 토큰을 유지하는 것이다. 내용은 선택 요소의 입력 종류·라벨·안내 문구와 고정 제출 역할로 한정한다. 상호작용은 기존 직접 텍스트 입력, 적용/취소, 선택·명령·Puck 이력을 재사용하며 장식 애니메이션을 추가하지 않는다.

`form.label`은 기존 Puck text 필드로 직접 편집하고, 입력 요소 설정과 컨테이너의 제출 연결은 같은 문서 명령으로 적용한다. 임의 endpoint·raw HTML·스크립트나 사용자 입력값을 원본에 저장하지 않는다. 입력/라벨/버튼/상태 역할은 안정 ID를 참조하며 기존 필수 항목과 종류 검증을 유지한다.

## 출력과 전송

React 편집·미리보기와 PHP 출력은 공통 필드 정책과 노드 ID로 label/ARIA·필수 여부·길이·입력 종류를 만든다. native 입력의 미지정 글꼴은 부모에서 상속하고 사용자 스타일·반응형 override는 보존한다. 공개 HTML은 기존 G7 HtmlContent 허용 marker를 사용하고 runtime에서 native 요소로 복원한다. 복원 시 노드 ID·스타일·반응형 속성·접근성 연결을 유지한다.

공개 페이지의 문의는 기존 `/pages/{slug}/inquiries`, CSRF·최소 작성 시간·honeypot·입력 검증·문의 저장/메일 전달 경로를 재사용한다. 새 v3 요청은 실제 정상 발행 artifact의 폼 소유 ID와 분류가 일치해야 한다. 전송 중 새로 입력한 내용을 보존하고 중복 제출·늦은 응답을 처리하는 기존 runtime을 복제하지 않는다.

편집 화면과 미리보기에서는 전송하지 않는다. 현재 페이지 전용 문의 서비스를 공통영역의 가짜 페이지 주소에 연결하지 않으며, 공통영역에서 가져온 폼은 디자인을 보존한 채 제출을 비활성화하고 이유를 표시한다. 공통영역의 추가 서비스 연결까지 완료했다고 판정하지 않는다. 이 임시 capability 부재는 영구 편집 제외 정책이 아니다.

## 현재 검증

첫 React 이벤트 보정은 단위 시험을 통과했지만 실제 Puck 캔버스에서는 실패했다. Puck의 native 클릭 listener가 React 위임 listener까지의 전파를 중단하기 때문이다. 해당 컨트롤의 ref 수명 안에서만 native 기본 동작을 취소하고 해제하는 것으로 보완한다. 전역 listener·벤더 파일·테마는 수정하지 않는다. 이전 수정과 실패 증거는 보존 replacement로 남긴다.

독립 브라우저 진단에서 Puck drag root는 포인터 선택을 소유하고, readonly checkbox의 native 체크가 발생했다. 공통 입력 renderer는 마우스 기본 입력/클릭만 취소하고 선택 이벤트 전달은 유지하도록 보완한다. 미리보기/공개 입력의 실제 입력 동작은 보존한다. 구성별 예외나 별도 선택/Undo 스택은 추가하지 않는다. 이 수정은 별도 보존 replacement에서 제출하며 브라우저 성공은 통합 후 판정한다.

Node 24에서 `v3FormEditor.test.tsx` 11개와 TypeScript 검사를 통과했다. 실제 편집 컴포넌트의 설정·취소·실패·읽기 전용, Puck 이력과 canonical 저장, 공개 marker 복원, 기존 CSRF/snapshot/reset runtime을 확인했다. upstream Puck을 직접 불러오는 Unit의 250ms 이력 대기는 빌드된 편집기의 즉시 Undo 증거가 아니다.

PHP 8.5.3에서 `V3FormMarkupTest.php` 3개/119 assertions가 세 출력 방식의 안전한 marker, 고정 주소, 필드/라벨 연결, 이스케이프, 미지정 반응형 글꼴 상속을 통과했다. 실제 G7 저장/문의함 검사는 `PublicationPersistenceTest.php`에 추가했으며 runtime lease 아래 별도로 실행한다.

후속 브라우저 수용에는 라벨 직접 입력·즉시 Undo, 필드/연결 변경·취소, PC/태블릿/모바일 디자인/출력 비교, 저장·재열기·발행, 실제 문의 저장, 잘못된 소유 ID/분류와 입력 거부가 필요하다. 최종 통합 및 원장 증거 갱신은 `integration-ip7-20261012`에서 계약·화면·브라우저 증거 task를 함께 다룬다. G7 코어 수정·운영 배포·기존 문서 자동 전환은 포함하지 않는다.

첫 공식 batch 통합에서 기존 G7 통합 26개는 통과했으나 새 `PublicationPersistenceTest`가 구형 `saveDraft`를 호출해 v3를 구형 계약에 넣는 시험 오류가 발생했다(31개 중 오류 1개, 316 assertions). 실제 제품의 `saveDraftJson` 경로로 시험을 수정하는 보존 replacement `ip7-common-form-editor-storage-20261013`을 만들었다. 제품 소스·판정 기준은 바꾸지 않았고 원 제출 SHA를 보존했다. 실패 통합은 기준 `601d18d9b6e1ebd44dc93da22cd99f3586c7a2e6`으로 원복됐고 원래 `jwsoft-business01` 테마도 복구됐다. 브라우저 실행 전 실패이므로 새 브라우저 통과 증거는 없다.

두 번째 통합에서 같은 신규 시험의 fixture 연관 배열 디코딩이 빈 `slots` 객체를 JSON 배열로 바꾸는 오류가 드러났다. 실제 v3 저장 경로의 객체/배열 구분을 유지하도록 fixture를 객체로 읽는다. `ip7-common-form-editor-json-20261013`은 앞선 제출 `10823a878f31d1993776d77380ca300c855cd158`과 worktree를 보존하는 교체다. 서버 validator를 완화하지 않으며 이 실행도 브라우저 전에 원복하고 테마를 복구했다.
