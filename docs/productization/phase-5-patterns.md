# 5차 사용자 Section 패턴 실행 기록

기준 SHA: `175b46acdb96484d321fa780d8db02d528e5e3dc`  
task: `productization-phase5-patterns-20260901`

## 저장 계약

- `g7-page-builder/section-pattern/v1`은 v2 문서의 `layout.section-01` subtree 하나만 원본으로 저장합니다. HTML, Puck Data, 실행 코드, 전역 동기 상태는 저장하지 않습니다.
- 패턴은 actor ID, 제목, 분류, source document schema, canonical Section, 필수 `block@version`, 자산 참조, block 수 요약과 생성/수정 시각을 가집니다.
- 모듈 소유 `g7pb_section_patterns` 테이블에 저장하며 기존 문서·revision·publication·G7 데이터에는 쓰지 않습니다.
- 현재 compiler와 구조 정책이 Section 전체를 통과해야 저장합니다. v1 문서·Section이 아닌 일부 요소·불법 구조·미지원 props는 원자적으로 거부합니다.

## 삽입·독립성

- `내 패턴`은 현재 actor 소유 항목만 조회합니다. 필수 Block capability가 없으면 원본은 보존하고 이유와 함께 삽입만 비활성화합니다.
- 삽입 전 subtree 모든 `instance_id`를 새 UUID로 교체하고 전체 문서 구조를 다시 검증합니다. 한 번의 Puck `setData` public action을 사용해 패턴 삽입을 한 Undo 단위로 기록합니다.
- 삽입 결과는 패턴과 다른 문서의 완전한 복사본입니다. 한쪽 문구·사진·스타일 변경과 패턴 삭제는 다른 복사본이나 이미 발행된 페이지를 바꾸지 않습니다.
- 패턴 자산 참조는 삭제 연쇄 동작이 아니라 호환·보존 판단용 명시 정보입니다. 미디어 원본의 기존 보존 정책을 우회하지 않습니다.

## 라이브러리 경계

- 기본 요소와 레이아웃 틀은 typed editor component, 완성 섹션은 Block Pack preset, 시작 페이지는 Page Kit, 내 패턴은 actor 소유 canonical Section입니다.
- 내 패턴은 Code Pack이나 외부 마켓 상품으로 취급하지 않으며 타 사이트 동기화·유료 거래·전역 동기 패턴은 범위 밖입니다.

## 검증

- JSON schema, PHP service와 actor-scoped Eloquent 저장, API client, canonical subtree ID 재발급을 각각 검증합니다.
- 편집 surface는 패턴 목록→한 번의 삽입→새 ID→원본과 독립 수정을 확인합니다.
- 사람 콘텐츠/권리/시각 승인과 운영 배포는 이 차수에서 수행하지 않습니다.
