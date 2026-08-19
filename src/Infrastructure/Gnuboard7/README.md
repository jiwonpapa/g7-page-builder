# Gnuboard7 Adapter boundary

G7 관련 구현은 이 디렉터리에만 둡니다.

허용:

- 버전이 명시된 G7 공개 Contract
- 공개 Extension API
- 공개 REST API와 DTO
- `StorageInterface` 등 문서화된 공개 Port

금지:

- `G7Core.__runtime`
- `resources/js/core/**` 직접 import
- `App\\Models` 직접 사용
- `sirsoft-page` Model·Repository 직접 사용
- G7 또는 번들 모듈 테이블 직접 조회
- 템플릿 JSON 파일 수정

