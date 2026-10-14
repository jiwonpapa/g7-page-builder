# 공통 데이터 목록 조작 구현

2026-10-14 잔여 부분 진행 지시. 기준 `f5104797b17e77df714b55f41b9d525e73ea95d8`, 구현 task `editor-data-controls-20261014`, 통합 task `integration-data-controls-20261014`.

## 고정 범위

- 공통 data 계약의 선택형 controls에 검색/분류 텍스트 입력·이전/다음 버튼·페이지 본문 요소의 안정 ID와 페이지당 개수를 저장합니다. 반복 원형 밖의 기존 일반 요소를 연결하며 블록 이름별 편집/렌더 코드를 추가하지 않습니다.
- 동일 schema/policy로 PHP/TS가 역할·참조·단일 소유·반복/문의/시스템/behavior 소유 경합·상세 페이지 오용·불완전 페이지 연결을 거부합니다. 복사/복제/사용자 구성은 같은 paste의 ID 재배정으로 연결 요소를 함께 처리하며 일부만 복사하면 원자적으로 거부합니다.
- 편집기는 같은 data 명령/Undo로 연결을 적용합니다. 검색·필터·버튼·페이지 표시의 위치·문구·정밀 스타일·반응형은 기존 공통 편집기를 사용합니다. 실제 값/검색어/현재 페이지/분류 목록은 원본에 저장하지 않습니다.
- 공개 runtime은 같은 문서 surface 안에서 연결 요소를 찾아 기존 로드 목록을 검색·분류·로컬 페이지로 조작합니다. 분류는 일반 텍스트 입력의 네이티브 datalist 제안이며 게시판/상품 분류를 실제 응답에서 얻습니다. 별도 select 요소나 새로운 레이아웃 엔진을 만들지 않습니다.
- 검색/필터 변경은 첫 페이지로 돌아가며 결과 없음·이전/다음 비활성·Enter의 외부 form 제출 차단을 처리합니다. fetch 중/권한 실패/해제 시 캡처한 조작 요소를 비활성화하고 listener·datalist를 정리합니다. 다른 surface/교체된 요소에 늦은 정리를 적용하지 않습니다.

기존 6종 data 소스·API·조회 limit·권한·레거시 고정 위젯·페이지 문서·Site Part·테마·코어는 인수하거나 변환하지 않습니다. 검색/필터/페이지는 응답으로 받은 목록 안의 기존 공개 runtime 동등 범위이며 서버 전체 게시글/상품 검색·페이지 API는 추가하지 않습니다.

## 제한된 확인과 인계

새 계약에 직접 필요한 공통 fixture 7개를 기존 TS/PHP 소비 시험에 추가하고 기존 archive control 시험 파일에 작성 요소/동일 surface/해제 단위 사례 1개를 추가합니다. 기존 사례는 제거하거나 기준을 낮추지 않습니다. 선택된 관련 unit·타입·구조·PHP 검사만 실행하며 동일 입력 성공을 재사용합니다. 공유 schema/policy의 FULL 분류는 명시하되 IMPLEMENTATION=1로 새 E2E/UX/성능/전체 제품 수용은 실행하지 않습니다.

현재 상태는 구현 작성 후 공식 제출 검사 전입니다. 실패는 문제별 추가 보완 최대 1회이며 재발 시 동결·최종 보고합니다. 신규 6종 시작 데이터는 별도 data-only task에서 추가하며 이 파일의 구현 성공과 제품 수용을 구분합니다. 기존 문서 전환·운영 배포·검증 확대는 없습니다.

CTRL-FIXTURE01: 첫 제출은 새 page_size=0 거부 사례의 기대 오류를 value로 기록했으나 기존 숫자 범위 검증은 range를 반환하여 중단했습니다. 0 거부와 기존 검사 기준/제품 로직은 유지하고 기대 코드만 기존 PHP/TS Schema 의미에 맞게 range로 한 번 보완했습니다(1/1). 실패 보고서 submission-22f7118c6af3471cb1affebe1652d385.json을 보존하며 같은 문제 재발 시 추가 보완하지 않습니다. 페이지 상태는 공개 runtime에서만 role=status/aria-live=polite를 부여하고 해제 시 원래 속성을 복원하도록 초기 구현을 마무리했습니다.

CTRL-TYPE01: 다음 downstream 타입 검사는 input/select union의 공통 listener가 Event를 받는데 KeyboardEvent 전용 콜백을 전달한 두 위치를 거부했습니다. Event에서 key 존재와 Enter를 실행 시 좁히도록 동일 콜백 한 곳만 보완했습니다(1/1). 우회 단언/any나 타입 기준 변경은 없습니다. 실패 보고서 submission-6e4d71975a2a4ba6beeb65e91ad1065e.json을 보존하고 변경 입력과 실패/downstream만 처리합니다.

ENV-PHP01: PHP 공통 사례에서 새 missing reference를 허용한 원인은 제품 소스가 아니라 main/vendor 공유 symlink의 Composer baseDir였습니다. ReflectionClass가 DataBindings를 main/src에서 읽는 사실을 확인했습니다. 자체 생성한 47바이트 symlink를 `.runtime/vendor-shared-link-data-controls`로 보존 이동하고 같은 vendor를 worktree-local에 복사하여 의존성 버전/lock/제품 소스 변경 없이 autoload 기준을 바로잡았습니다(환경 보완 1회). 이 환경에서의 앞선 PHP 통과는 새 소스의 증거로 사용하지 않습니다. 실패 보고서 submission-ff14d5bbd2e04ae89c8f5c1b6b9e0220.json을 보존합니다. 기존 main/vendor와 사용자 파일은 변경/삭제하지 않았습니다.

CTRL-IME01: 새 검색/필터 Enter의 외부 form 제출 방지가 한글 조합 확정까지 가로채지 않도록 isComposing=true를 제외하는 한 곳의 보완을 별도 3파일 task `editor-data-controls-ime-20261014`로 처리합니다(1/1). 기존 새 조작 단위 사례 안에 조합 중/일반 Enter 차이만 확인하며 새 브라우저/IME 감사는 실행하지 않습니다. 이는 CTRL-TYPE01의 listener 타입 문제와 다른 입력 소유권 보완이며 동일 문제의 추가 보완을 허용하지 않습니다.
