# 3-C 경계·복구 실행 기록

기준 SHA: `c01a876`. Task: `productization-phase3c-boundaries-recovery-20260901`. Profile: `full`, AREA: `shared-contract`.

## 닫은 경계

- 공통 `layout-policy`와 같은 fixture로 잘못된 부모/자식, 불법 slot, 깊이, 중복 UUID, 전체 501번째 노드, slot 201번째 자식, compact UTF-8 1 MiB 초과를 TS/PHP에서 거부합니다.
- Puck 변환 결과에도 같은 검사를 적용합니다. 빈 Section에 첫 Columns를 넣는 경로와 명시적인 빈 본문을 보존하고, 불법 root·중복 ID·slot overflow는 원본 문서를 바꾸지 않은 채 거부합니다.
- 기본 Buttons 목록의 첫 항목을 수정해도 화면에 있던 두 항목 전체가 canonical 원본에 저장되는지 검사합니다.
- 이동은 UUID·props·responsive 값을 보존하고, 복제는 subtree 전체 UUID를 다시 만들며, 자기 하위 이동·부분 삭제·한도 초과 작업은 원자적으로 거부합니다.
- DB 저장 전 v2 검증 실패는 lock/revision/document/publication hash/revision history를 모두 유지합니다.
- 과거 v1 revision 복원은 schema·SEO·slug·locale·shell mode·block version을 보존하고 새 revision만 만듭니다.
- 구조 정책에는 있으나 4차에서만 편집 지원할 Stack을 현재 compiler가 받으면 prepare 단계에서 실패하며 마지막 정상 발행 HTML·artifact hash·representation hash를 유지합니다.

## 지원 범위 구분

- 3-B의 일반 편집 UI는 계속 `Section → 2열 Columns → Heading/RichText`만 노출합니다.
- Stack·1/3열·열 축소 확인·구조 오류 안내·실제 drop 표시는 4-A 범위입니다. 공통 정책 fixture에 있다는 이유로 현재 UI 지원을 주장하지 않습니다.
- v1→v2 전환 동의 UI와 v2 기본 문서 전환도 4차 결정입니다. v1 문서를 열거나 평면 내용을 수정해도 schema version을 올리지 않습니다.
- 사람 콘텐츠·권리·시각 승인, 패키징, 배포는 이 차수에 포함하지 않습니다.

## 검증

- 독립 worktree에서 adapter 경계 시험과 TypeScript strict 검사를 실행합니다.
- PHP DB 원자성·v1 복원·v2 마지막 정상본 시험은 Laravel/G7 의존성을 가진 full 통합 profile에서 판정합니다.
- 제출 전 자동 검증과 통합 후 실제 결과를 Git/coordination 기록으로 구분합니다. 실행 전 결과를 통과로 기록하지 않습니다.
