# G7 core contract status

## 결론

MVP에 새 G7 코어 계약이나 코어 수정은 필요하지 않습니다. 이전 문서의 `JsonUiDocumentEditor`, `BlockPresetRegistry`, `JsonUiFragmentRenderer`, `PageDocumentProvider`는 G7 7.0.7에 존재하지 않는 제안 이름이었으며 구현 선행조건에서 제거했습니다.

실제 연동 기준은 [G7 연동 계약](g7-integration-contract.md)입니다.

## MVP가 사용하는 최소 공개 표면

- 모듈 생명주기와 module Provider 자동 발견
- API·Web route, migration, admin auth·permission
- 모듈 소유 관리자 메뉴 선언·동기화와 공개 admin route/layout
- 활성 User Template 식별·merged route 조회, 모듈 소유 user route 2개/layout 3개
- 공개 `core.routes.filter_merged` hook과 모듈 JS/CSS asset manifest·asset serving

기본 출력은 활성 User Template의 `_user_base`를 사용합니다. 모듈은 `/pages/:slug`, preview route와 각각의 layout, 선택형 home layout만 선언하며 기존 템플릿 파일·layout JSON·DB row는 수정하지 않습니다. `builder`와 `none` 출력은 모듈 자체 viewer로 유지합니다. G7 기본 `페이지 관리`와 겹치지 않는 모듈 소유 `페이지 빌더` 메뉴와 admin 문서함 layout도 별도로 제공합니다.

custom role, Layout Extension, Layout Editor, `sirsoft-page` Model/Repository/DB는 사용하지 않습니다. `sirsoft-board`·`sirsoft-ecommerce`는 설치 의존성이 아니라 공개 route/API가 있을 때 선택기와 데이터 블록에 노출되는 capability입니다.

`G7Core.layoutEditor`는 속성 widget, node editor, canvas overlay 등록만 제공합니다. 독립 문서의 mount/load/save/publish API가 아니므로 Page Builder가 사용하지 않습니다.

## 향후 선택형 RFC

G7이 범용 JSON UI fragment renderer와 capability discovery를 공식 제공하면 `src/Infrastructure/Gnuboard7` Adapter에 새 출력 target을 추가할 수 있습니다. `sirsoft-page` metadata mirror와 더 깊은 쇼핑몰 연동도 각각 별도 Adapter·Block Pack 후보입니다. 어느 선택 연동도 HTML 기반 문서 저장·컴파일·마지막 정상 발행본을 바꾸지 않습니다.
