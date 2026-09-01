# 4-A 구조 조작 실행 기록

기준 SHA: `784cf28e65e97cbe466a41028f16d25466e65ad5`  
task: `productization-phase4a-structure-budget-20260901` (`productization-phase4a-structure-editing-20260901` 대체)

## 구현 범위

- Puck 공식 `slot`과 native DnD·레이어·선택·history를 유지합니다. 별도 드래그 엔진을 추가하지 않습니다.
- canonical v2 문법을 `Section → Columns(1/2/3열) → Stack → Heading/RichText/Image/Buttons/Divider`까지 연결합니다.
- Columns 비율은 1열 `1`, 2열 `1:1·1:2·2:1`, 3열 `1:1:1`만 허용합니다. 간격은 `none·compact·normal·spacious`입니다.
- 내부 Columns·Stack은 root 팔레트에서 숨기고 Section/Columns 검사기의 구조 추가 동작으로 정확한 slot에만 삽입합니다. 폼·탭·슬라이더·G7 데이터의 내부 자유 중첩은 열지 않습니다.
- 열 축소로 제거되는 열에 콘텐츠가 있으면 바로 변경하지 않고 확인을 표시합니다. 확인 시 제거 열의 subtree를 마지막 남는 열 끝으로 순서대로 이동하고 취소 시 원본을 유지합니다.
- 자식이 있는 Section·Columns·Stack은 Puck 기본 삭제를 끄고 내부 콘텐츠 수를 표시하는 확인 동작으로만 삭제합니다.

## 계약과 발행

- JSON schema, TypeScript adapter, PHP compiler가 Stack·열 수·비율·slot 수를 같은 canonical 값으로 판정합니다.
- compiler `0.18.0`은 1/2/3열과 Stack을 재귀 출력합니다. Stack은 의미 없는 `section`을 만들지 않고 허용된 `div` root에 기존 block runtime 속성을 적용합니다.
- 저장 원본은 계속 `PageBuilderDocument`이고 Puck data·생성 HTML은 원본으로 저장하지 않습니다.
- v1 문서는 단순 편집만으로 v2가 되지 않습니다. 신규 문서 기본 버전 전환과 사용자 동의 흐름은 4-C 범위입니다.

## 검증 경계

- 순수 열 변경은 3→1 이동 순서·subtree 수·원본 불변, 1→3 빈 slot·비율을 검사합니다.
- canonical↔Puck은 3열과 nested Stack을 왕복하고, PHP는 같은 fixture를 공개 HTML로 컴파일합니다.
- DB 통합의 마지막 정상 발행본 시험은 이제 지원되는 Stack 자체가 아니라 Stack 안의 schema-valid/compile-invalid 이미지 URL로 실패를 발생시켜 publication pointer 불변을 계속 검사합니다.
- 실제 브라우저 흐름은 3열·Stack 문서의 제목 편집→저장→reload→발행→revision 복원→재발행을 확인합니다.
- 구조 검사기 추가 후 editor source CSS는 158,690 bytes입니다. 내부 raw 상한만 별도 task에서 157,000→160,000 bytes로 조정하고 production gzip 45KB·editor JS 500KB 상한은 유지합니다.

4-A는 반응형 override·기기별 상속(4-B), 저장 중 편집·Undo 경계와 v1→v2 전환 UX(4-C), 사람 콘텐츠/권리/시각 승인, 운영 배포를 완료로 표시하지 않습니다.
