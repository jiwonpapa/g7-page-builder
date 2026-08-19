# Gnuboard7 Adapter boundary

G7 관련 구현은 이 디렉터리에만 둡니다.

허용:

- 기본 제품: 버전이 명시된 module lifecycle, route, migration, permission, admin menu/layout, asset 공개 표면
- 선택 Adapter: capability와 최소 버전을 검증한 공개 Contract·REST API·DTO

기본 제품은 Page Builder 문서함·생성용 admin route/layout 2개만 사용합니다. User Template, User SPA route/layout, Layout Extension, Layout Editor, 번들 모듈을 요구하지 않습니다. Framework filesystem도 자체 `MediaPort` 뒤에서만 사용합니다.

admin menu는 `페이지 빌더` 전용 진입점 하나만 선언합니다. G7 기본 `페이지 관리`(`sirsoft-page`, `/admin/pages`)의 메뉴·데이터·URL은 수정하거나 대체하지 않습니다.

금지:

- `G7Core.__runtime`
- `resources/js/core/**` 직접 import
- `App\\Models` 직접 사용
- 번들 모듈 Model·Repository·Service 직접 사용
- G7 또는 번들 모듈 테이블 직접 조회
- 템플릿 JSON 파일 수정
