# 4-B 반응형·공통 스타일 실행 기록

상태: 기술 구현 및 영향 범위 검증 완료. 최종 실제 화면 회귀·사람 승인은 8-A 이후 별도입니다.

## 적용 범위

- canonical block 최상위에 `responsive.tablet`·`responsive.mobile`만 허용합니다.
- 공통값과 각 기기 override는 독립입니다. 모바일은 태블릿 값을 연쇄 상속하지 않습니다.
- 초기화는 override를 삭제합니다. 이후 공통값 변경을 그대로 상속하며 다른 기기의 override는 유지합니다.
- 일반 블록은 유한 appearance 값, Section·Columns·Stack은 역할별 layout 값만 허용합니다.
- 모바일 Columns는 1열, 태블릿은 최대 2열입니다. DOM·읽기·키보드 순서는 바꾸지 않습니다.
- 임의 breakpoint·콘텐츠·미디어·링크·children·slot·class·inline style은 거부하거나 정규화에서 제거합니다.

## 구현 연결

- 공통 순수 로직과 재사용 Puck field: `responsiveBlockStyle.tsx`
- canonical 계약: TypeScript type과 JSON Schema `blockResponsive`
- Puck 왕복: vendor `responsiveOverrides`를 canonical block 최상위 값으로만 변환
- 편집/공개 출력: 동일한 `g7pb-{tablet|mobile}-...` 유한 class 이름
- PHP 발행: compiler `0.19.0`이 block 역할별 허용값을 다시 검사하고 같은 class를 출력

## 실행 결과

- TypeScript strict: 통과
- 반응형·schema·Puck adapter Vitest: 61 tests 통과
- `HtmlDocumentCompilerTest`: 64 tests, 582 assertions 통과
- production build와 CSS lint: 통과
- 배포 번들: editor CSS gzip 43,179/45,000 bytes, public CSS gzip 17,631/18,000 bytes
- 원본 개발 CSS 상한만 editor 180,000 bytes, public 105,000 bytes로 조정했습니다. 배포 gzip 상한은 올리지 않았습니다.

## 미완료 경계

- 이 기록은 실제 PC 조작·태블릿/모바일 화면·배포 승인을 뜻하지 않습니다.
- 4-C에서 v1→v2 전환과 저장 응답/Undo 경계를 닫고, 8-A에서 실제 화면 회귀를 한 번 수행합니다.
