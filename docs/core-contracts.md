# G7 core contract status

## 결론

MVP에 새 G7 코어 계약이나 코어 수정은 필요하지 않습니다. 이전 문서의 `JsonUiDocumentEditor`, `BlockPresetRegistry`, `JsonUiFragmentRenderer`, `PageDocumentProvider`는 G7 7.0.7에 존재하지 않는 제안 이름이었으며 구현 선행조건에서 제거했습니다.

실제 연동 기준은 [G7 연동 계약](g7-integration-contract.md)입니다.

## MVP가 사용하는 최소 공개 표면

- 모듈 생명주기와 module Provider 자동 발견
- API·Web route, migration, admin auth·permission
- 모듈 소유 관리자 메뉴 선언·동기화와 공개 admin route/layout
- 모듈 JS/CSS asset manifest와 개별 asset serving

기본 MVP는 custom role, User SPA route, User Template, Layout Extension, `sirsoft-page`·`sirsoft-ecommerce`를 사용하지 않습니다. G7 기본 `페이지 관리`와 겹치지 않는 모듈 소유 `페이지 빌더` 메뉴와 admin 문서함 layout만 공개 계약으로 추가합니다. drag-and-drop 편집기와 공개 viewer는 모듈 Web route의 자체 shell/viewer로 제공합니다.

`G7Core.layoutEditor`는 속성 widget, node editor, canvas overlay 등록만 제공합니다. 독립 문서의 mount/load/save/publish API가 아니므로 Page Builder가 사용하지 않습니다.

## 향후 선택형 RFC

G7이 범용 JSON UI fragment renderer와 capability discovery를 공식 제공하면 `src/Infrastructure/Gnuboard7` Adapter에 새 출력 target을 추가할 수 있습니다. User Template shell, 페이지 metadata mirror, 쇼핑몰 Product Grid도 각각 별도 Adapter·Block Pack 후보입니다. 어느 선택 연동도 HTML 기반 MVP의 설치·편집·발행을 막는 필수조건이 아닙니다.
