# IP3 레이어와 재귀 구조 편집 검증

상태: 진행 중. 첫 task는 v3의 순수 구조 명령 계층이며 UI·저장·실제 브라우저 검증 완료가 아니다. IP3 완료 수는 올리지 않는다.

## 소유 범위

기준 SHA는 `355fec0f39df3ee40ae5a58f3442807a2aac6bbe`다. `ip3-tree-commands-20261012`는 tree/commands/clipboard 소스 3개, 관련 단위 시험 1개, 이 기록·원장·표시판·CHANGELOG 총 8개 파일만 소유한다. 기존 v1/v2, Site Part, schema, PHP 저장소·컴파일러, 제품 번들·의존성·예산은 변경하지 않는다.

## 명령의 책임

삽입·이동·복제·삭제·그룹/해제·복사/붙여넣기·이름·잠금·기본 숨김을 검증된 v3 원본에 대한 불변 트랜잭션으로 제공한다. 부모/자식 중복 선택은 DOM 순서의 최상위 선택으로 정규화한다. 실패는 원본·자산·선택에 부분 쓰기를 남기지 않는다. 선택과 접힘·Undo는 이 계층이 저장하지 않는다.

복사본은 새 노드 ID와 내부 fragment 링크를 연결하며 필요한 자산만 가져온다. 자산 ID 충돌과 문서 간 색 토큰 차이를 보존한다. 파일 삭제나 OS 클립보드 접근은 없다. 잠금은 편집 사고 방지이며 서버 권한이 아니다.

absolute 재부모화는 좌표 변환이 필요하므로 거부한다. 구조만으로 배치를 보존할 수 있는 연속된 block-flow 형제만 중립 Container로 묶으며 styled/semantic Container의 해제와 Flex/Grid 부모의 그룹 변경은 측정 없는 무손실 변환으로 가장하지 않는다. 정밀 배치/좌표 측정 연결은 IP4/IP5 대상이며 이 제한을 영구 제품 제외로 바꾸지 않는다.

## 남은 수용 조건

Puck 단일 이력 연결, 캔버스/레이어 선택·조상 탐색·접힘, 저장/재열기와 실제 입력·DOM 순서 검증이 필요하다. v3는 현재 G7 기존 저장·발행 경로에 연결되지 않았다. 독립 포트 검증과 G7 영속·공개 출력 검증을 구분한다.

## 명령 계층 검증

macOS arm64, Node 24.19.0에서 `npx --no-install vitest run tests/Unit/documentV3Tree.test.ts`의 21개 시험, 제품 전체 TypeScript 검사, `make editor-plan-check`가 통과했다. 동일 시험의 명령 소스 3개 한정 V8 측정은 statements 98.50%, branches 94.92%, functions 98.14%, lines 100%다. 저장·브라우저·제품 전체 coverage 결과가 아니다.

첫 실행의 두 실패는 (1) 501개 root의 wire range 오류와 총 노드 오류 기대 구분, (2) UUID 숫자로 시작한 fragment의 schema 거부였다. 한도·schema를 바꾸지 않고 정확한 기대값과 `node-<UUID>` 안전 fragment를 사용했다. 일반 외부 fragment는 재작성하지 않는다. 새 UUID도 별도 regex가 아니라 기존 wire 명세로 검사한다.
