# IP7 공통 요소 Site Part 저장과 발행

IP7은 진행 중이다. 기준 SHA `f1f84194d212bdcc4aed944654116199bdf89e8b`에서 `ip7-site-part-persistence-20261013` task가 저장·컴파일·관리 API 연결과 관련 검사를 맡는다. 공통 `PageBuilderDocument v3` 요소를 기존 Site Part 리비전·잠금·세트 발행 경로에 연결하며 Header/Footer 전용 편집기나 블록별 렌더러는 추가하지 않는다.

## 변경 범위

- `SitePartSource`는 종류·ID·locale·버전의 읽기 전용 공통 인터페이스다. 구형 v1과 요소 v2는 각 원본을 유지한다.
- 저장 codec은 버전별 검증을 분기하며 객체와 목록을 구별한다. 일반 저장에서 버전·ID·종류·locale·v3 slug 변경을 거부한다. 기존 v1 세트 템플릿의 ID 연결 의미는 유지한다.
- 세트 생성 API의 명시적인 `schema_version=g7-page-builder/site-part/v2` 선택만 빈 요소 문서를 만든다. 기본 생성과 기존 문서 읽기는 v1 의미를 유지한다. 새 요소 세트는 자동 활성화하지 않는다.
- 새 문서는 기존 v3 페이지 compiler로 출력하고 Header/Footer 의미 요소로 감싼다. 공개 요청은 저장된 발행본만 읽는다.
- 새 요소 공통영역은 Header/Footer 세트로만 발행한다. 다른 세트 문서 혼입, 잠금 충돌, 두 번째 발행본 기록 실패는 부분 변경 없이 거부한다.

이번 변경의 `shared-contract` lease와 FULL 검증 사유는 Site Part repository 입력 계약과 관리 API의 v2 지원 추가다. G7 코어·테마 원본·migration·의존성·운영 배포·기존 문서 자동 이행은 범위에 없다. 공통 편집 화면 연결·명시 이행/복원·고정 runtime capability·최종 UX 수용은 후속 구현이다.

## 검증

초기 관련 검사에서 기존 계약/발행 단위 시험 20개·107 assertions와 새 codec/factory/compiler 시험 16개·50 assertions가 통과했다. 새 시험은 raw JSON 왕복, 객체/목록·0/false 보존, 신원과 버전 변경 거부, 구형 기록 보존, 같은 요소 compiler 출력 및 누락 capability 거부를 포함한다.

DB와 controller 검사는 임시 SQLite에서 생성·저장·재조회·리비전·세트 발행/활성화·충돌·오류 rollback·마지막 정상 발행본·과거 발행본 준비를 확인한다. 공식 제출에서 runtime 검사를 보류하고 Local 통합에서 실행한다. 시험 정의만으로 DB/API 동작 성공 또는 브라우저 편집 성공을 주장하지 않는다.

원장에는 이 작업을 진행 기록으로 연결한다. 통합 SHA와 실행 결과를 확보한 뒤 부분 증거를 별도 기록하며 IP7을 완료로 올리지 않는다.
