# Required Gnuboard7 public contracts

판매 가능한 구현 전에 G7 코어에 다음 공개 계약이 필요합니다.

## JsonUiDocumentEditor

- 임의 문서 Provider를 통해 load/save/publish
- `simple-page`와 `advanced-layout` 편집 Profile
- 문서별 독립 lock version
- 내부 `G7Core.__runtime`을 외부 제품에 노출하지 않는 공개 진입점

## BlockPresetRegistry

- 하나의 컴포넌트에 여러 완성 블록 프리셋 등록
- 중첩 `defaultNode` 지원
- 분류·검색 태그·썸네일·호환성·필요 기능 선언
- 활성 모듈·플러그인의 Block Pack 병합

## JsonUiFragmentRenderer

- 전체 Template이 아닌 페이지 콘텐츠 조각 렌더링
- 지원 JSON UI 스키마·기능 조회
- 격리된 상태·데이터소스·DOM ID 범위
- 실패 시 마지막 정상 발행본 유지

## PageDocumentProvider

- Page ID·slug·locale 전달
- draft/published 분리
- 버전·복원·낙관적 잠금
- Page 삭제·복제·언어 변경 생명주기 이벤트

## Compatibility rule

제품은 코어 버전 문자열만 보지 않고 다음 기능을 확인해야 합니다.

```text
jsonui.document-editor >= 1
jsonui.fragment-renderer >= 1
page.document-provider >= 1
page.block-preset-registry >= 1
```

