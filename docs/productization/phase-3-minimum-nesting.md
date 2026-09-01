# 3-B 최소 중첩 실행 기록

기준 SHA: `5386cd8`. Task: `productization-phase3b-minimum-nesting-20260901`. Profile: `full`, AREA: `shared-contract`.

## 구현 경계

- 원본은 `PageBuilderDocument`이며 Puck `Data`는 저장하지 않습니다.
- v2 최소 문법은 `Section.content → Columns.column1/column2 → Heading 또는 RichText`입니다.
- Section은 폭 3종·세로 여백 3종, Columns는 2열·비율 3종·간격 3종만 제공합니다.
- Puck의 `slot` field와 `allow`를 사용합니다. 드래그앤드롭·히스토리·반응형 캔버스는 재구현하지 않습니다.
- 일반 신규 문서와 기존 문서의 기본은 v1입니다. v1을 읽거나 문구만 편집해도 v2로 바꾸지 않습니다.
- LayoutSection만 v2 구조 진입점으로 노출하고 LayoutColumns는 Section slot 안에서만 생성합니다. 45종 복합 블록의 내부 중첩, Stack·1/3열, 사용자 Section 저장은 후속 차수입니다.

## 연결한 실행 경로

| 층 | 구현·검증 |
|---|---|
| 계약 | schema v1/v2 조건, 공통 layout policy, v2 fixture |
| 편집기 | canonical 재귀 metadata·slot 왕복, Section/Columns renderer, leaf 직접 편집 |
| 서버 | `PageBuilderDocument` v2 구조 검증, 전체 노드/ID/부모 정책 적용 |
| 발행 | compiler 0.17.0 재귀 출력, 전역 Hero/heading-anchor 검사와 외부 asset 수집 유지 |
| 수명주기 | DB 저장·preview·prepare/commit·revision restore 통합 시험과 실제 브라우저 흐름 추가 |

## 현재 실행 증거

- `npm run typecheck`: 통과.
- `npm run lint:css`: 통과.
- TS schema/정책/adapter 시험: 89개 통과.
- 실제 Puck renderer 단위 시험: 24개 통과.
- PHP Domain/Layout/Compiler: 87개, 888 assertions 통과.
- PHPStan: 오류 0. Pint 대상 파일: 통과.
- DB/G7 통합 시험은 Laravel/G7 의존성이 있는 full profile에서 실행하도록 추가했습니다. 독립 작업트리의 최소 Composer 의존성만으로는 실행할 수 있으므로 통과로 기록하지 않습니다.
- 실제 브라우저 시험은 PC 지원 화면에서 중첩 제목 편집→저장→reload→발행→revision 2 복원→마지막 발행본 유지→재발행을 검사하도록 추가했습니다. 통합 runtime 실행 전에는 통과로 기록하지 않습니다.

전체 `npm test` 직접 실행은 이 로컬 Node의 격리된 jsdom `localStorage` 미제공으로 기존 runtime 시험 36개가 실패했습니다. 이번 변경 관련 89+24 시험은 별도 통과했으며, 공식 frontend/full profile에서 전체 결과를 다시 판정합니다. 실패를 skip·재시도·승인으로 바꾸지 않습니다.

## 다음 차수

3-C에서 빈 slot·불법 부모/자식·깊이·중복 ID·501번째 노드·1 MiB 초과·이동/복제/삭제·v1 SEO/shell/revision 보존·compiler 실패 시 active hash 불변을 닫습니다. 사람의 콘텐츠·권리·시각 승인과 운영 배포는 마지막 승인 단계까지 보류합니다.
