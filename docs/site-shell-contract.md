# 출력 Shell·Header·Footer 계약

## 제품 상태·검증 계약

- Header의 계정 패널은 `currentUser.uuid`가 있는 경우만 회원 메뉴를 보이며 `is_admin === true`인 회원에게만 `/admin` 링크를 제공합니다. 실제 접근 권한은 G7 서버가 검증합니다.
- 검색은 보이는 input과 submit을 사용합니다. 검색·계정·알림·설정은 disclosure 패널이며 Escape·바깥 클릭·포커스 이탈로 닫힙니다. 모바일에서도 회원·관리자 기능을 제거하지 않습니다.
- template 셸은 공개 G7 state/dispatch에 연결합니다. 독립 builder 셸은 공개 `/api/auth/user`, 알림·장바구니·활성 언어 API를 사용합니다. 자격증명·회원 정보는 HTML 캐시나 문서에 들어가지 않습니다.
- `use_site_settings`는 선택적인 boolean입니다. 미지정한 기존 문서는 기본 브랜드 `사이트 이름`이면서 로고가 없을 때만 자동 연결합니다. 직접 입력한 브랜드·메뉴·법적 문구는 변경하지 않습니다. 소셜 URL은 HTTPS만 렌더합니다.
- 편집기 접속 상태는 명시적인 예시이며 저장되지 않습니다. 실제 G7 인증 검증과 분리해 보고합니다.
- `npm run test:e2e:site-shell`은 실제 compiler와 배포 JS/CSS의 4상태×3화면 계약, 키보드·포인터·접근성 및 실제 G7 관리자 로그인/라우트/로그아웃을 검증합니다. `output/playwright/site-shell-product.json`은 검증 당시 소스와 편집기·공개 번들 fingerprint를 기록합니다.
- 패키징과 온라인 배포는 해당 증거가 없거나 오래되면 차단합니다. 본문 140개 블록 품질 게이트도 그대로 유지합니다. 자동 검사 통과를 별도의 사람 디자인 승인으로 표현하지 않습니다.

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

언어별로 이름이 있는 Header·Footer 세트를 여러 개 보관할 수 있습니다. 각 세트는 Header와 Footer의 독립 revision을 한 쌍으로 묶으며, 둘 다 한 번 이상 발행된 세트만 `사용 중`으로 원자 전환할 수 있습니다. 기존 단일 Site Part는 마이그레이션에서 활성 `기본 세트`로 보존합니다. 활성 세트를 바꿔도 다른 세트의 초안·발행 이력은 삭제하지 않습니다.

문서 편집 캔버스는 Header·Page·Footer를 한 화면에 표시합니다. `builder`의 Header·Footer는 같은 작업 화면에서 편집할 수 있고, `template` 공통영역은 G7 소유임을 명시한 읽기 전용 영역으로 표시합니다. `none`에는 공통영역이 나타나지 않습니다.

최상위 관리자 진입점 `/modules/jiwonpapa-page_builder/admin/site-parts`는 세트 목록과 선택한 Header·Footer 편집기를 한 화면에 표시합니다. 기존 `/site-parts/{header|footer}`는 호환 진입점으로 유지하지만 문서함의 기본 동선에서는 노출하지 않습니다.

Site Part 변경은 `builder` 공개 페이지와 공통 셸 API의 전체 표현 ETag에 반영됩니다. 활성 User Template은 다음 route 전환부터 마지막 정상 발행본을 받습니다.

## G7 핵심 기능 보존

### 모바일 통합 메뉴

모바일 변경에 따른 공통 CSS fingerprint 갱신으로 140개 썸네일을 다시 생성했습니다. 139개 PNG는 기존 승인본과 byte-identical입니다. 유일하게 바뀐 `preset-89-articles-grid.png`는 이전·현재 이미지를 직접 비교했으며 콘텐츠·구성 변화는 없습니다. 기존 기준을 유지하는 Codex-assisted 증분 검토이며 새로운 사람 승인으로 표시하지 않습니다.

- 900px 미만에서는 로고·검색·선택형 장바구니·전체 메뉴를 사용합니다. 계정·알림·설정은 별도 모바일 팝업으로 중복 노출하지 않습니다. 사용자 메뉴가 비어 있어도 활성 시스템 기능이 있으면 전체 메뉴를 제공합니다. `mobile_menu=false`는 기존 동작을 보존합니다.
- 계정/관리자/주문/알림 → 사이트 메뉴와 하위 목록 → 선택 CTA → 테마·언어·통화·로그아웃 순서입니다. 링크와 상태는 PC와 동일한 고정 adapter를 사용하며 사용자·token·handler를 문서에 저장하지 않습니다.
- 기본 오른쪽 drawer와 기존 왼쪽 drawer·dropdown·bottom sheet를 유지합니다. 360px 이하 drawer는 전체 폭입니다. 최소 터치 영역은 44px, 일반 행은 48px 이상이며 safe area와 reduced motion을 반영합니다.
- drawer/sheet는 dialog로서 배경을 inert 처리하고 Tab/Shift+Tab, Escape, 포커스 복귀, 스크롤 잠금을 지원합니다. dropdown은 일반 disclosure region으로 배경을 잠그지 않습니다. 내부 사이트 링크는 semantic nav이며 ARIA menu가 아닙니다.
- 화면 크기 변경·browser navigation·페이지 이탈 때 메뉴와 잠금을 해제합니다. 브라우저 history에 별도 가상 항목을 삽입하지 않습니다. G7 HtmlContent 교체는 동일 URL에서 열린 하위 메뉴·스크롤·포커스를 복구하고 이전 DOM의 listener를 정리합니다.
- PC 편집 화면의 모바일/태블릿 캔버스는 동일 컨트롤러와 계정/설정 markup을 사용하며 persona 전환은 저장되지 않습니다. 실제 인증·라우트 이동은 공개 runtime에서만 실행합니다.
- `npm run test:e2e:site-shell`은 기존 인증 검증과 `mobileNavigationQuality.spec.ts`를 함께 실행합니다. Chromium의 320/360/390/430/768/899/900px 경계와 WebKit 모바일 엔진을 검사하며, 실패/누락/오래된 fingerprint는 패키징·배포를 차단합니다. WebKit 설치가 없으면 `npx playwright install webkit` 후 재검증합니다.
- 자동화 엔진 검증은 물리 iPhone/Android와 VoiceOver/TalkBack 실제 사용 검증을 대신하지 않습니다. `--run`은 자동 검사만 완료하고, 패키징·배포에서 실행하는 일반 check는 `output/playwright/mobile-navigation-manual-review.json`까지 요구합니다. 수동 검증이 없으면 릴리스는 계속 차단됩니다.
- 수동 기록은 자동 결과와 같은 `fingerprint`, `status=passed`, `reviewer.kind=human`과 검토자 이름, `results`의 `ios-safari-voiceover`·`android-chrome-talkback` 두 항목이 필요합니다. 각 항목은 실제 `device`, `os`, `browserVersion`, `evidence`, `checkedAt`, `status=passed` 및 `checks`의 `navigation`·`account`·`focus-and-reading-order`·`safe-area-and-keyboard`·`scroll-and-back` 통과 기록을 포함합니다. AI나 테스트 fixture로 사람 검토를 대신 작성하지 않습니다.
- 예외: 2026-08-31 사용자의 명시적 요청에 따라 **0.30.0만** iOS·Android 실기기/스크린리더 검증을 제외합니다. `docs/release-exclusions/0.30.0.json`에 원문·날짜·대상·사유를 기록하며 자동 결과도 `physicalDeviceReview.status=excluded`로 남깁니다. 이 결정과 버전은 소스 fingerprint에 포함되며, 다른 버전으로 재사용할 수 없습니다. Chromium/WebKit·반응형·접근성·실제 G7 인증 자동 검사와 본문 블록 품질 게이트는 그대로 필수입니다. 제외는 실기기 통과나 지원 보증이 아닙니다.

- 편집 문서는 디자인·브랜드·메뉴 링크만 소유합니다.
- 검색·로그인·회원가입·로그아웃·마이페이지·알림·장바구니·테마·언어·통화는 compiler가 만든 고정 마커와 모듈 runtime adapter가 제공합니다.
- endpoint, method, auth token, handler 이름은 편집 필드로 노출하지 않습니다.
- 원본 G7 layout의 data source·init action·main content·modal은 제거하지 않으며 Header·Footer 표시 노드만 조건부 전환합니다.
- 모바일 원본 overlay·toolbar·drawer도 같은 조건으로 닫아 이중 메뉴와 잔류 overlay를 막습니다.

## API와 경계

### 0.29.0 기존 블록 검토 범위

공통 셸 CSS 추가로 전체 140개 썸네일의 source fingerprint를 다시 생성했습니다. 139개 PNG는 기존 승인본과 byte-identical이며, 변경된 `preset-89-articles-grid.png`는 기존 화면과 직접 비교했습니다. 본문 콘텐츠·정책 변경은 없습니다. 이 증분 검토는 Codex-assisted이며 새로운 사람 승인으로 표시하지 않습니다. 별도로 전체 반응형·편집·발행 품질게이트를 통과해야 릴리스할 수 있습니다.

- `GET /api/modules/jiwonpapa-page_builder/admin/site-shell?locale=ko`
- `PUT /api/modules/jiwonpapa-page_builder/admin/site-shell`
- `GET|POST|PUT /api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/**`
- `GET|POST /api/modules/jiwonpapa-page_builder/admin/site-part-sets`
- `POST /api/modules/jiwonpapa-page_builder/admin/site-part-sets/{uuid}/activate`
- `GET /api/modules/jiwonpapa-page_builder/public/site-shell?locale=ko`
- 조회는 documents.read, 저장은 documents.manage 권한을 사용합니다.
- 로고는 모듈 전용 MediaPort 업로드 결과를 사용하며 외부 HTTP/HTTPS URL도 허용합니다.
- Site Part 메뉴는 모든 1·2차 항목에 G7 route 선택기를 사용합니다. G7 메뉴 테이블을 직접 읽거나 쓰지 않습니다.
- G7 서비스 링크는 [User Template·라우트 연결 계약](template-route-integration.md)의 선택기를 사용합니다.
