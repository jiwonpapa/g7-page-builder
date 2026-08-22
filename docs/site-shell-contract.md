# 출력 Shell·Header·Footer 계약

## 결론

기본 페이지의 공통 Header·Footer·navigation은 활성 G7 User Template이 소유합니다. Page Builder는 템플릿을 대체하거나 복제하지 않고 발행 콘텐츠만 템플릿의 content slot에 연결합니다.

Page Builder가 별도로 소유하는 Header·Footer Site Part는 브랜드와 공통영역까지 Page Builder가 책임지는 캠페인용 `builder` 출력에서만 사용합니다. G7 코어·활성 템플릿·기존 페이지 관리 파일과 DB는 어떤 모드에서도 수정하지 않습니다.

## 출력 모드

- `shell_mode=template`(기본): 활성 User Template의 `_user_base`를 사용합니다. 템플릿 Header·Footer·navigation과 G7 session UI가 그대로 작동합니다.
- `shell_mode=builder`: Page Builder가 발행한 Header·Footer Site Part와 canvas를 자체 viewer에서 렌더합니다.
- `shell_mode=none`: 공통영역 없이 canvas만 렌더합니다. 인트로·광고 캠페인에 사용합니다.
- 구형 `shell_mode=global`은 `builder`와 같은 의미로 읽고 다음 저장에서 `builder`로 정규화합니다.
- `shell_mode`는 revision과 publication에 snapshot되므로 draft 설정만 바꿔 현재 공개 페이지가 변하지 않습니다. 재발행해야 적용됩니다.

## Page Builder Site Part

언어별 `g7pb_site_shells` 호환 row와 Header·Footer `SitePartDocument`에 다음 값을 저장합니다.

- 사이트 이름, 로고 이미지 URL, 홈 주소
- `solid` 또는 `transparent` Header, sticky 여부
- 최대 10개 1차 메뉴, 메뉴별 최대 8개 2차 메뉴와 선택형 CTA
- 모바일 메뉴 표시 여부와 `dropdown`·`drawer-left`·`drawer-right` 방식
- Footer 문구와 메뉴 반복 여부
- compare-and-swap `lock_version`

같은 typed 메뉴 계약을 PC Header의 hover·focus 드롭다운과 모바일 접힘 하위 메뉴에 사용합니다. 3단 메뉴는 저장·컴파일하지 않습니다. 모바일 메뉴는 좌·우 drawer 또는 dropdown을 선택하며 `aria-expanded`, `hidden`, backdrop·닫기 버튼·Escape 닫기, drawer 내부 Tab 초점 고정과 토글 버튼 초점 복귀를 지원합니다.

Header·Footer는 비즈니스·미니멀/컴팩트·커뮤니티 내장 프리셋으로 시작할 수 있습니다. 프리셋은 편집기 상태를 바꾸는 초안일 뿐이며, 모든 문구·이미지·라우트는 적용 후에도 편집할 수 있습니다.

문서 편집 캔버스는 Header·Page·Footer를 한 화면에 표시합니다. `builder`의 Header·Footer는 같은 작업 화면에서 편집할 수 있고, `template` 공통영역은 G7 소유임을 명시한 읽기 전용 영역으로 표시합니다. `none`에는 공통영역이 나타나지 않습니다.

Site Part 변경은 `builder` 공개 페이지의 전체 표현 ETag에 반영됩니다. `template` 페이지에는 영향을 주지 않습니다.

## API와 경계

- `GET /api/modules/jiwonpapa-page_builder/admin/site-shell?locale=ko`
- `PUT /api/modules/jiwonpapa-page_builder/admin/site-shell`
- `GET|POST|PUT /api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/**`
- 조회는 documents.read, 저장은 documents.manage 권한을 사용합니다.
- 로고는 모듈 전용 MediaPort 업로드 결과를 사용하며 외부 HTTP/HTTPS URL도 허용합니다.
- Site Part 메뉴는 모든 1·2차 항목에 G7 route 선택기를 사용합니다. G7 메뉴 테이블을 직접 읽거나 쓰지 않습니다.
- G7 서비스 링크는 [User Template·라우트 연결 계약](template-route-integration.md)의 선택기를 사용합니다.
