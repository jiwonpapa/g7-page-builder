# User Template·라우트 연결 계약

## 결론

Page Builder는 사이트 템플릿을 대체하지 않습니다. 기본 출력은 현재 활성 G7 User Template이 Header·Footer·navigation·로그인 상태 UI를 맡고, Page Builder는 콘텐츠 artifact만 제공합니다.

연동은 G7 코어나 기존 템플릿 파일을 수정하지 않고 다음 모듈 소유 선언으로 제한합니다.

- `resources/routes/user.json`: `/pages/:slug`, Page Builder preview 두 route
- `resources/layouts/user/page_builder_public.json`: 공개 콘텐츠 layout
- `resources/layouts/user/page_builder_home.json`: 선택형 홈 콘텐츠 layout
- `resources/layouts/user/page_builder_preview.json`: noindex preview layout
- `core.routes.filter_merged`: `template` 공개본이 홈으로 지정된 동안에만 `/` layout 교체

세 layout은 활성 템플릿의 `_user_base`를 `extends`하고 G7 `HtmlContent`에 서버가 검증한 마지막 정상 발행 HTML만 전달합니다. Puck·React·compiler는 공개 요청에서 실행하지 않습니다.

## 공개 주소와 홈

- canonical 문서 주소: `/pages/{slug}`
- canonical 홈 주소: 홈으로 지정된 문서만 `/`
- legacy 모듈 주소: `/modules/jiwonpapa-page_builder/p/{slug}`에서 canonical 주소로 301
- 홈 연결 조건: active publication, home 지정, `shell_mode=template`
- 홈 해제·공개 해제·문서 보관·조회 실패: 원래 활성 템플릿의 `/` route를 그대로 사용
- `builder`와 `none`은 모듈 자체 viewer를 사용하므로 활성 템플릿 route를 바꾸지 않음

Page Builder는 기존 `페이지 관리`, `sirsoft-page`, 템플릿 route/layout JSON과 템플릿 DB row를 읽기 원본이나 발행 저장소로 사용하지 않습니다.

## 링크 선택기

편집기 링크 필드는 직접 URL 입력과 `G7 서비스 연결` 선택기를 함께 제공합니다. 선택기는 현재 활성 User Template의 merged route catalog를 읽어 다음 범주를 검색합니다.

Page Builder Site Part의 Header 1·2차 메뉴, CTA, Footer 기본 메뉴와 다단 Footer의 각 링크도 같은 선택기를 사용합니다. `이름|URL` 형식의 대량 텍스트 입력은 사용하지 않습니다.

- 사이트: 홈
- 회원: 로그인, 회원가입, 비밀번호 찾기, 로그아웃
- 게시판: 목록, 인기글, 게시판·게시물·작성 화면
- 쇼핑몰: 상품 목록·카테고리·상세, 장바구니, 주문
- 마이페이지: 프로필, 주문, 마일리지, 찜, 배송지
- Page Builder: 현재 발행 문서
- 활성 템플릿이나 설치 모듈이 추가한 기타 공개 route

`:slug`, `:product_code`, `:order_number` 같은 parameter가 있으면 다음 순서로 값을 완성합니다.

1. Page Builder 문서는 모듈 문서함의 active 문서 목록
2. 게시판은 G7 공개 boards API
3. 카테고리·상품은 G7 공개 ecommerce API
4. 목록 API가 없거나 비어 있으면 명시적 직접 입력

최종 문서에는 vendor route 객체가 아니라 완성된 상대 URL 또는 허용된 외부 URL만 저장합니다. 따라서 컴파일러의 기존 URL allowlist와 last-good 발행 원칙을 그대로 적용합니다.

로그아웃은 GET 링크로 위장하지 않고 `#g7-action-logout` typed action으로 저장합니다. 공개 runtime이 정확히 이 action만 G7 logout API에 POST하고 성공 뒤 홈으로 이동합니다. 다른 hash action, JavaScript URL, inline handler는 허용하지 않습니다.

## 장애와 호환

- active template route catalog를 읽지 못하면 선택기에 오류를 표시하되 기존 URL 직접 입력과 draft는 보존합니다.
- `sirsoft-board`·`sirsoft-ecommerce`가 없으면 관련 route·target만 노출하지 않습니다. `module.json` hard dependency는 추가하지 않습니다.
- user route/layout은 모듈 namespace로만 선언하며 설치·upgrade 시 G7가 sync합니다.
- 템플릿 변경 후에는 새 active template catalog를 다시 읽습니다. 이미 저장된 URL은 관리자가 명시적으로 바꾸기 전까지 유지합니다.
- public CSS와 effects는 `.g7pb-page` 아래로 scope하며 활성 템플릿의 전역 typography·layout selector를 덮지 않습니다.

## 회귀 게이트

- 정적 검사: user route 2개, user layout 3개, namespace와 asset scope를 정확히 검사
- PHP: route 정규화·동적 shop prefix·admin route 제거·URL/action allowlist
- Vitest: 검색·parameter 해석·게시판·카테고리·상품 target 변환·logout runtime
- Playwright: 활성 template 확인, 로그인 route 선택, `/pages/{slug}` template render, 임시 `/` home 연결과 원상 복구
- 로컬·스테이징 smoke: route catalog/public APIs, module user route/layout sync, public CSS asset 확인
