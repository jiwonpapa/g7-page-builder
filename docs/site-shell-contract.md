# 공통 Header·Footer 계약

## 결론

공통 Header·Footer와 메뉴는 G7 템플릿이 아니라 Page Builder 모듈이 소유합니다. G7 코어·활성 템플릿·기존 페이지 관리 파일과 DB는 수정하지 않습니다.

## 설정 모델

언어별 `g7pb_site_shells` 한 행에 다음 값을 저장합니다.

- 사이트 이름, 로고 이미지 URL, 홈 주소
- `solid` 또는 `transparent` Header, sticky 여부
- 최대 10개 1단 메뉴와 선택형 CTA
- Footer 문구와 메뉴 반복 여부
- compare-and-swap `lock_version`

같은 메뉴 배열을 데스크톱 Header, 모바일 drawer와 선택형 Footer 메뉴에 사용합니다. 모바일 메뉴는 `aria-expanded`, `hidden`, Escape 닫기, 첫 링크 초점과 토글 버튼 초점 복귀를 지원합니다.

## 페이지 연결

- `shell_mode=global`: 미리보기·`/pages/{slug}`·선택형 홈(`/`)에 공통영역을 렌더합니다.
- `shell_mode=none`: 인트로·캠페인 페이지처럼 Page Builder 콘텐츠만 렌더합니다.
- `shell_mode`는 revision과 publication에 snapshot되므로 초안 설정 변경만으로 현재 공개 페이지가 바뀌지 않습니다. 재발행해야 적용됩니다.
- 공통영역 설정 변경은 즉시 모든 `global` 공개 페이지에 반영되며 ETag도 함께 변경됩니다.

## API와 경계

- `GET /api/modules/jiwonpapa-page_builder/admin/site-shell?locale=ko`
- `PUT /api/modules/jiwonpapa-page_builder/admin/site-shell`
- 조회는 documents.read, 저장은 documents.manage 권한을 사용합니다.
- 로고는 기존 모듈 전용 MediaPort 업로드 결과를 사용하며 외부 HTTP/HTTPS URL도 허용합니다.
- 현재 메뉴는 1단 구조입니다. 다단 메뉴, mega menu, G7 게시판 자동 메뉴는 다음 호환 기능이며 기존 G7 메뉴 테이블을 직접 읽거나 쓰지 않습니다.
