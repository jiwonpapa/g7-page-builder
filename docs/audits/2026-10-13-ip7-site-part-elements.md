# IP7 공통 요소 기반 Site Part

착수 기준 `04ba68777a0b15dd1f68a3a0c9120b33394f7ea0`, task `ip7-site-part-elements-20261013`. IP7은 진행 중이다. 이 작업은 새 공통영역 계약과 보존 검증이며 UI·서버 저장·세트 발행 완료가 아니다.

## 계약과 연결 순서

- `site-part/v2`는 Header/Footer 소유 종류와 **기존 v3 PageBuilderDocument 하나**만 보관한다. 별도 블록 문법·편집기·Undo·렌더러를 만들지 않는다. ID·locale·요소·자산·스타일은 content가 단일 소유한다.
- 내용 문서는 공통 `StructureEditor`에 전달하고 같은 문서 명령으로 수정한 뒤 원래 Site Part에 돌려준다. 다른 문서 ID·locale·slug의 결과는 거부한다. shell은 `none`이며 페이지 SEO를 갖지 않아 셸 재귀나 페이지 설정 혼동을 막는다.
- 기존 `site-part/v1`은 그대로 보존한다. 새 계약의 validator가 구형 데이터를 읽으면서 바꾸지 않는다. API 연결 때 별도 버전 분기와 명시 전환·revision 복원을 구현한다.
- 이 작업은 새 타입·TS/PHP 공통 fixture·검증만 소유한다. 뒤이어 저장/컴파일 경계, 같은 편집 화면의 Site Part 호스트, Header/Footer 세트 미리보기·발행을 연결한다. 고정 인증/검색 등의 실행은 공통 runtime capability 작업으로 분리하고, 정적인 가짜 UI로 완료 처리하지 않는다.
- 공유 계약 task는 `shared-contract` lease를 보유한다. 새 schema 제출/통합의 FULL 사유는 공통영역 소유 계약 추가다. 기존 기준은 낮추지 않는다.

## 증거 범위

검증 결과는 실행 뒤 기록한다. 양 언어의 원본 불변·거부·동일 요소 명령·출력 검증을 수행하고, 실제 브라우저/서버 증거는 후속 연결 작업에서 확보한다. 진척 원장/표시판은 기존 작업 소유가 끝난 뒤 검증 SHA와 함께 별도 소유 task에서 갱신하며 IP7 완료로 올리지 않는다.

## 관련 검사

초기 관련 검사에서 TS 24개, PHP 6개/66 assertions, 하네스 5개가 통과했다. PHP의 반환 배열 문서 주석 줄바꿈을 바로잡은 뒤 PHPStan·Pint·타입 검사·변경 소스 3개 구조 검사 및 task 소유 범위 검사가 통과했다. PHP에도 공통 동작 참조와 500노드 한도 검사를 추가했다. 두 언어는 같은 16개 수용/거부 fixture를 소비한다. AJV 독립 wire 검사도 같은 외부 문서 schema를 등록하며, 자산·ID·shell·SEO 의미 검사는 각 제품 validator에서 별도 검증한다.

구조 명령 검사는 이름 미등록 Header/Footer에 공통 제목 삽입·내용 변경·모바일 스타일을 한 transaction으로 적용하고 원본 불변·재직렬화·원래 content 복귀를 확인한다. 이 단위 검사만으로 브라우저 Undo 또는 서버 revision 복원을 완료 처리하지 않는다. PHP는 같은 페이지 compiler에 content를 전달한 결과와 완전히 같은 출력임을 확인한다. 실제 Site Part compiler/API 연결은 아직 남아 있다.
