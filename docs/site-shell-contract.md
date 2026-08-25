# 출력 Shell·Header·Footer 계약

## 결론

기본 페이지의 content는 활성 G7 User Template이 소유하고 Page Builder 발행 콘텐츠를 받습니다. Page Builder Header·Footer 두 Site Part가 모두 정상 발행되면 호환되는 활성 User Template의 전체 사용자 라우트에도 같은 공통 셸을 적용합니다.

G7 코어·활성 템플릿·기존 페이지 관리 파일과 DB는 수정하지 않습니다. Site Shell API, 컴파일, 템플릿 호환성 중 하나라도 실패하면 원본 G7 Header·Footer가 그대로 렌더됩니다.

## 출력 모드

- `shell_mode=template`(기본): 활성 User Template의 `_user_base`를 사용합니다. 두 Site Part가 발행된 호환 템플릿에서는 Page Builder 공통 셸, 그 외에는 원본 템플릿 셸을 사용합니다.
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

Site Part 변경은 `builder` 공개 페이지와 공통 셸 API의 전체 표현 ETag에 반영됩니다. 활성 User Template은 다음 route 전환부터 마지막 정상 발행본을 받습니다.

## G7 핵심 기능 보존

- 편집 문서는 디자인·브랜드·메뉴 링크만 소유합니다.
- 검색·로그인·회원가입·로그아웃·마이페이지·알림·장바구니·테마·언어·통화는 compiler가 만든 고정 마커와 모듈 runtime adapter가 제공합니다.
- endpoint, method, auth token, handler 이름은 편집 필드로 노출하지 않습니다.
- 원본 G7 layout의 data source·init action·main content·modal은 제거하지 않으며 Header·Footer 표시 노드만 조건부 전환합니다.
- 모바일 원본 overlay·toolbar·drawer도 같은 조건으로 닫아 이중 메뉴와 잔류 overlay를 막습니다.

## API와 경계

- `GET /api/modules/jiwonpapa-page_builder/admin/site-shell?locale=ko`
- `PUT /api/modules/jiwonpapa-page_builder/admin/site-shell`
- `GET|POST|PUT /api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/**`
- `GET /api/modules/jiwonpapa-page_builder/public/site-shell?locale=ko`
- 조회는 documents.read, 저장은 documents.manage 권한을 사용합니다.
- 로고는 모듈 전용 MediaPort 업로드 결과를 사용하며 외부 HTTP/HTTPS URL도 허용합니다.
- Site Part 메뉴는 모든 1·2차 항목에 G7 route 선택기를 사용합니다. G7 메뉴 테이블을 직접 읽거나 쓰지 않습니다.
- G7 서비스 링크는 [User Template·라우트 연결 계약](template-route-integration.md)의 선택기를 사용합니다.
