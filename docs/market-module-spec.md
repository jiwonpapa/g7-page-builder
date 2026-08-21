# G7 Page Builder Market 모듈 스펙 주도 개발 명세

상태: **Deferred / 구현 전 승인 명세**  
대상 제품: `G7 Page Builder Market`  
공식 운영 서버: `https://g7devops.com`  
발행자: `jiwonpapa`(지원소프트) 단일 발행자  
최초 상품 정책: 무료 Block Pack과 무료 Page Kit만 제공

## 1. 현재 상태와 정정

현재 `g7-page-builder` 저장소의 Official Store 기능은 독립 마켓이 아니다. 다음 기능만 가진 **정적 배포 시험 하네스**다.

- 저장소 파일로 작성한 정적 catalog
- Page Builder 모듈이 함께 배포하는 preview와 ZIP endpoint
- catalog 조회, 검색, 미리보기
- Block Pack digest·호환성 검증 설치
- Page Kit을 새 미발행 초안으로 적용

다음은 구현되지 않았다.

- 별도 마켓 저장소와 G7 모듈
- 마켓 소유 DB와 migration
- 상품·분류·버전·파일 관리자
- ZIP·미리보기 업로드, 검증, 초안, 게시, 보관 흐름
- 운영 이력과 게시 감사 로그
- G7 기본 Page Builder 관리자에서의 정식 마켓 메뉴와 독립 route

현재 정적 catalog의 상품은 두 개뿐이다.

1. `jiwonpapa/marketing-presets`: 신규 block은 없고 내장 block을 사용하는 preset 두 개만 포함한다.
2. `jiwonpapa/company-launch`: 회사 소개 Page Kit 한 개다.

따라서 현재 기능을 `마켓 완료`로 표시하거나 판매용 마켓으로 설명해서는 안 된다. 독립 마켓 출시 전까지 이 두 상품과 catalog는 개발·회귀시험 fixture로만 취급한다.

## 2. 목표와 제품 경계

마켓은 지원소프트 소유자 한 명이 공식 콘텐츠를 등록·관리·배포하는 단일 발행자 서비스다. 제3자 마켓이 아니다.

### 목표

- `g7devops.com`에서 공식 Block Pack과 Page Kit을 관리한다.
- Page Builder는 원격 catalog를 읽어 `마켓` 메뉴에 상품을 표시한다.
- 관리자는 Page Builder 안에서 미리보기, 호환성 확인, 설치 또는 새 페이지 적용을 수행한다.
- 고객 사이트는 마켓 서버가 중단돼도 이미 설치한 Pack과 적용한 Page를 계속 사용한다.
- 공개 웹 상품 페이지는 검색 노출과 제품 홍보에 활용할 수 있다.

### 최초 범위 제외

- 제3자 판매자·누구나 업로드
- 판매자 가입, 심사, 정산, 수수료
- 구매자 계정과 결제
- 라이선스 키, DRM, 원격 만료
- 리뷰·별점·댓글
- 자동 업데이트와 무단 자동 설치
- 기존 페이지 덮어쓰기 또는 자동 발행

유료 상품은 무료 마켓의 운영 안정성과 상품 규격이 검증된 뒤 별도 결정한다. 최초 버전에 결제용 휴면 코드나 권한 모델을 미리 넣지 않는다.

### 규범 요구사항

| ID | 요구사항 | 검증 증거 |
|---|---|---|
| MKT-001 | 마켓은 Page Builder와 별도 저장소·별도 G7 모듈이어야 한다. | stock G7 clean install 시험 |
| MKT-002 | 모든 관리 쓰기는 owner permission을 요구해야 한다. | 권한 허용·거부 통합시험 |
| MKT-003 | 관리자는 상품·분류·버전·미리보기·artifact를 초안부터 게시·보관까지 관리할 수 있어야 한다. | Owner browser E2E |
| MKT-004 | 공개 catalog와 artifact API는 versioned·read-only·immutable이어야 한다. | API schema·ETag·digest 시험 |
| MKT-005 | Page Builder는 정식 `마켓` route에서 원격 catalog를 검색·필터·미리보기해야 한다. | Consumer browser E2E |
| MKT-006 | Block Pack은 공식 host·bytes·SHA-256·manifest·호환성 검증 전에는 설치되지 않아야 한다. | package security test |
| MKT-007 | Page Kit은 기존 데이터를 바꾸지 않고 새 미발행 초안으로만 적용돼야 한다. | 적용·rollback 통합시험 |
| MKT-008 | 마켓 장애·상품 보관이 기존 설치본과 공개 페이지를 중단해서는 안 된다. | 장애 주입 회귀시험 |
| MKT-009 | 최초 버전에는 제3자 판매자·결제·정산·DRM을 포함하지 않아야 한다. | route·schema 정적 경계검사 |
| MKT-010 | 정식 전환 뒤 Page Builder가 정적 catalog·artifact 배포 서버 역할을 겸하지 않아야 한다. | release artifact·route 부재 검사 |
| MKT-011 | 공개 상품 페이지는 SEO discovery를 제공하되 설치는 인증된 Page Builder 관리자에서만 실행해야 한다. | public/admin route E2E |
| MKT-012 | 고객 런타임은 PHP 요청 처리와 사전 빌드된 자산만 요구해야 한다. | clean Ubuntu VPS 설치시험 |

요구사항을 구현했다고 판단하려면 표의 검증 증거가 자동화 하네스 또는 실제 staging 증거로 남아야 한다. 화면이나 route 이름만 존재하는 상태는 완료가 아니다.

## 3. 구현 착수 게이트

독립 마켓은 Page Builder 본체보다 먼저 구현하지 않는다. 아래 조건이 모두 충족될 때 별도 구현 승인을 받는다.

- Page Builder의 핵심 편집·저장·미리보기·발행·복구 흐름이 제품 수준으로 확정됐다.
- `PageBuilderDocument`, compiler, Block Pack, Page Kit 계약이 두 번의 연속 릴리스 동안 호환성을 깨지 않았다.
- Block Pack 설치·업데이트·비활성화·사용 중 제거 방지·롤백 시험이 통과한다.
- Page Kit export·import가 media와 route reference를 휴대하고 항상 새 초안만 만든다.
- 최소 3개 선택형 Pack과 5개 Page Kit처럼 실제 배포할 콘텐츠 재고가 준비됐다.
- PC·태블릿·모바일, 접근성, 고정 시각 회귀, 100-block 편집 성능 gate가 통과한다.
- 공식 서버 운영 URL, 보존 정책, 장애·복구 절차가 승인됐다.

게이트 미충족 상태에서는 현재 정적 fixture와 설치 하네스만 유지한다. 마켓 DB·관리자 CRUD를 먼저 만들지 않는다.

## 4. 목표 아키텍처

```text
g7-page-builder-market repository
└─ jiwonpapa-page_builder_market G7 module
   ├─ Owner Admin
   │  ├─ Category
   │  ├─ Product
   │  ├─ Product Version
   │  ├─ Preview / Artifact
   │  └─ Validate / Publish / Archive
   ├─ Market DB
   ├─ Public SEO pages
   └─ Versioned Catalog / Artifact API
                         |
                         | HTTPS + allow-list + digest
                         v
g7-page-builder consumer module
└─ Page Builder 관리자 > 마켓
   ├─ browse / search / filter / preview
   ├─ Block Pack install
   └─ Page Kit apply as a new draft
```

### 저장소와 설치 경계

- 마켓은 `g7-page-builder`와 분리된 새 저장소에서 개발한다.
- 마켓 모듈은 공식 배포 서버 `g7devops.com`에만 필수 설치한다.
- 고객 서버에는 마켓 모듈을 설치하지 않는다.
- 고객 서버의 Page Builder에는 API consumer와 설치·적용 엔진만 포함한다.
- 로컬 `g7pb.test`는 개발 시 공식 서버 sandbox catalog를 보거나, 통합시험에 한해 같은 G7 Docker 안에 마켓 모듈을 추가 설치한다.
- 마켓 전환 후 Page Builder 릴리스에 catalog·공식 artifact를 중복 포함하지 않는다.

## 5. 사용자와 권한

| Actor | 권한 |
|---|---|
| Owner | 모든 마켓 관리, 검증, 게시, 보관 |
| Page Builder Admin | 공개 catalog 조회, 호환 상품 설치·적용 |
| Public Visitor | 공개 상품 목록·상세·미리보기 조회 |

마켓에 custom seller role을 만들지 않는다. G7 관리자 인증과 마켓 전용 permission 하나를 사용하며 공식 owner 계정에만 부여한다. Public API에는 쓰기 기능을 노출하지 않는다.

## 6. 도메인 모델

### Category

- `id`, `slug`, `name_ko`, `name_en`
- `product_type`: `block_pack`, `page_kit`, `all`
- `description`, `sort_order`, `is_active`

### Product

- `id`, `product_id` (`jiwonpapa/*`)
- `product_type`: `block_pack` 또는 `page_kit`
- `category_id`
- 한국어·영문 제목과 설명
- tags, thumbnail, 공개 상세 설명
- `status`: `draft`, `ready`, `published`, `archived`
- `created_by`, `updated_by`, timestamps

### ProductVersion

- `id`, `product_id`, SemVer `version`
- Page Builder·G7·PHP 호환 범위
- changelog와 release notes
- artifact storage key, bytes, SHA-256
- preview assets와 screenshots
- validation status와 validation report
- `published_at`, `archived_at`

게시된 `product_id + version`의 artifact와 digest는 불변이다. 수정이 필요하면 새 SemVer를 발행한다.

### PublishAudit

- actor, action, product/version
- before/after status
- validation correlation id
- timestamp와 실패 사유

다운로드 통계가 필요해질 때에는 개인정보 없는 일 단위 집계만 별도 결정한다. 최초 버전은 사용자 추적 telemetry를 저장하지 않는다.

## 7. 관리자 정보 구조

공식 서버의 G7 관리자에 `Page Builder Market` 전용 메뉴 하나를 등록한다.

```text
Page Builder Market
├─ 대시보드
├─ 상품
│  ├─ Block Packs
│  └─ Page Kits
├─ 분류
├─ 배포 버전
├─ 검증 실패
└─ 게시 이력
```

### 필수 관리자 기능

- 제목·설명·분류·태그·호환 범위 작성
- ZIP artifact 직접 업로드와 교체
- thumbnail·screenshots 업로드, 정렬, 삭제
- 저장 즉시 `draft`
- 수동 `검증` 실행과 오류별 상세 보고
- 검증 통과한 버전만 `published` 전환
- 게시 전 실제 상품 상세·Page Builder 카드 미리보기
- 게시본 보관 처리와 새 버전 생성
- 상품·버전 검색, 상태·종류·분류 필터
- 게시 이력과 검증 보고서 조회

게시된 artifact 파일은 관리자 UI에서도 덮어쓰지 않는다. 삭제가 필요한 경우 공개 중단과 보존 정책을 별도 확인한다.

## 8. 상품 상태 전이

```text
draft -> validating -> ready -> published -> archived
             |           |
             +-> failed <-+
```

- `draft`: 메타데이터와 파일 편집 가능
- `validating`: 같은 버전에 대한 중복 검증·게시 금지
- `failed`: 오류 수정 후 재검증
- `ready`: 검증 완료, 게시 전 최종 확인 가능
- `published`: 공개 catalog 노출, artifact 불변
- `archived`: 신규 노출과 설치는 중단하되 이미 설치한 고객 사이트에는 영향을 주지 않음

## 9. 패키지 검증 계약

마켓 모듈은 Page Builder와 동일한 공개 schema package 또는 고정된 계약 fixture를 사용한다. 브라우저가 보낸 URL이나 manifest 값만 신뢰하지 않는다.

### 공통 검증

- ZIP path traversal, absolute path, symlink, 중복 entry 차단
- 압축 파일·해제 크기, 파일 수, 개별 파일 크기 제한
- MIME 확장자뿐 아니라 실제 파일 signature 확인
- schema version, SemVer, product identity 검증
- 선언하지 않은 파일과 중복 identity 차단
- SHA-256 생성 및 게시 후 불변 저장
- 외부 URL, raw HTML, JavaScript, 임의 class/style 계약 차단

### Block Pack

- `g7pb-block-pack/v1` manifest
- pack id/version과 상품 id/version 일치
- Data Pack preset과 Code Pack을 구분
- Code Pack은 신뢰 발행자 서명·파일 digest·등록 허용 목록 검증
- 내장 component 덮어쓰기 금지

### Page Kit

- `g7pb-page-kit/v1` manifest와 canonical `PageBuilderDocument`
- media digest·MIME·크기 검증
- 필요한 block id/version 선언
- 지원하는 `g7pb-media://`, `g7pb-route://` reference만 허용
- import 전에 compiler dry-run
- 발행·revision·작성자·원래 UUID·홈 지정 상태를 상품에 포함하지 않음

## 10. 공개 웹과 API

### 공개 웹

- `/page-builder/market`
- `/page-builder/market/{product-slug}`

공개 페이지는 검색엔진이 이해할 제목·설명·대표 이미지·canonical·구조화 데이터를 제공한다. 설치는 웹페이지에서 고객 서버로 원격 명령을 보내지 않고 Page Builder 관리자에서만 수행한다.

### Public API v1

```text
GET /api/page-builder-market/v1/catalog
GET /api/page-builder-market/v1/products/{product-id}
GET /api/page-builder-market/v1/products/{product-id}/versions/{version}
GET /page-builder-market/artifacts/{immutable-file}
GET /page-builder-market/previews/{file}
```

catalog 응답에는 다음을 포함한다.

- catalog version과 생성 시각
- publisher identity
- product id/type/version/license
- 제목·설명·분류·태그
- 호환성 제약
- preview URL
- artifact URL, bytes, SHA-256

API는 cursor pagination, ETag, Cache-Control을 제공한다. artifact URL은 allow-list된 공식 HTTPS host만 사용하고 redirect 정책을 명시적으로 제한한다.

### Owner API

Owner API는 G7 관리자 auth·permission·CSRF를 적용한다.

```text
GET|POST|PATCH /api/admin/page-builder-market/products
POST           /api/admin/page-builder-market/products/{id}/versions
POST           /api/admin/page-builder-market/versions/{id}/artifact
POST           /api/admin/page-builder-market/versions/{id}/validate
POST           /api/admin/page-builder-market/versions/{id}/publish
POST           /api/admin/page-builder-market/versions/{id}/archive
GET|POST|PATCH /api/admin/page-builder-market/categories
GET            /api/admin/page-builder-market/audits
```

실제 G7 공개 route 규칙에 맞게 prefix는 구현 시 확정하되 기능 경계를 합치지 않는다.

## 11. Page Builder 소비자 계약

Page Builder 관리자에 `마켓`을 일급 메뉴와 독립 route로 제공한다.

```text
/admin/page-builder/store
```

필수 UX:

- 전체, Block Pack, Page Kit, 분류 필터
- 이름·설명·태그 검색
- thumbnail과 상세 미리보기
- 호환/비호환 사유
- 설치됨·업데이트 가능 상태
- 명시적 설치 또는 새 페이지 적용
- 네트워크·검증·설치 오류를 구분한 메시지
- 키보드, 초점, PC·태블릿·모바일 접근성

Page Builder 서버는 catalog의 id/version을 다시 조회하고 공식 host·bytes·digest를 검증한다. 브라우저가 artifact URL을 직접 지정하지 못한다.

### 설치 후 보존

- 설치된 Pack은 원격 마켓 장애와 무관하게 동작한다.
- Page Kit은 새 로컬 문서로 변환되며 마켓 서버에 런타임 의존하지 않는다.
- 마켓의 archive는 고객 서버의 기존 Pack·Page를 삭제하거나 비활성화하지 않는다.
- 업데이트는 자동 수행하지 않고 관리자가 버전과 변경사항을 확인한 뒤 실행한다.

## 12. Page Kit 적용 불변조건

- 항상 새로운 document id와 block instance id를 생성한다.
- 관리자가 새 title과 slug를 확정한다.
- 기본 `shell_mode=template`의 미발행 초안 한 개만 생성한다.
- 적용 전에 media, route, block compatibility와 compile을 완료한다.
- 실패 시 문서가 생기지 않으며 이번 시도에서 만든 media만 정리한다.
- 기존 문서·공개본·홈·Header·Footer·User Template·G7 코어 데이터는 변경하지 않는다.

## 13. 보안 경계

- Owner 쓰기는 G7 admin auth, market permission, CSRF를 모두 요구한다.
- Public API는 읽기 전용이며 rate limit과 cache를 적용한다.
- 업로드 파일은 웹루트 밖 임시 격리 영역에서 검증한다.
- artifact는 content-disposition, MIME, nosniff 정책으로 제공한다.
- preview HTML을 허용해야 하는 요구가 생기면 별도 sandbox·CSP 계약 전에는 구현하지 않는다.
- 외부 URL fetch는 공식 allow-list와 DNS/IP 재검증으로 SSRF를 차단한다.
- 로그에 세션, 비밀번호, token, 원본 IP를 남기지 않는다.
- 검증 실패는 correlation id와 안전한 관리자 설명을 남긴다.

## 14. 호환성과 버전 정책

- 마켓 모듈, catalog, Block Pack, Page Kit은 각각 독립 SemVer를 가진다.
- 공개 API major는 URL로 고정한다.
- Page Builder 소비자는 지원하지 않는 catalog/API major를 fail-closed한다.
- 이미 게시된 버전은 수정하지 않는다.
- G7 또는 Page Builder 업데이트 전 과거 catalog와 package fixture를 재검증한다.
- schema/compiler 비호환 시 설치·적용만 중지하고 고객의 기존 발행본은 유지한다.

## 15. TDD와 품질 하네스

### Domain unit test

- 상태 전이와 게시 불변성
- 단일 발행자 namespace
- SemVer·중복 버전·호환 범위
- free-only 정책
- category와 product validation

### Package security test

- zip-slip, symlink, absolute path, duplicate entry
- MIME 위장, digest 불일치, 과다 파일·크기
- foreign publisher, 임의 URL, 선언되지 않은 asset
- Block Pack id/version 불일치
- Page Kit media/route/block 누락과 compiler 실패

### G7 integration test

- owner permission 허용·거부
- upload -> validate -> publish -> catalog 노출
- published artifact 불변
- archive 후 신규 catalog 제외
- Page Builder catalog fetch, install, update, Page Kit apply
- market 장애 뒤 기존 설치본·발행본 유지
- G7 기본 Page Management와 별도 메뉴·데이터 공존

### Browser E2E

- Owner: 상품 생성 -> ZIP 업로드 -> 오류 확인 -> 검증 -> 게시
- Public: 목록 -> 검색 -> 상세 -> preview
- Consumer: 마켓 열기 -> 필터 -> 상세 -> 설치/적용 -> 편집기 진입
- 비호환·digest 실패·network 실패의 이해 가능한 오류
- PC·태블릿·모바일과 키보드 접근성

### 필수 gate

- PHP 8.5, PHPUnit, Pint, PHPStan, Xdebug coverage
- TypeScript strict, Vitest coverage, production build
- JSON Schema fixtures와 deterministic artifact build
- Playwright product E2E와 고정 시각 회귀
- G7 코어·모델·테이블 직접 참조 차단
- clean package 설치와 `g7devops.com` staging smoke

미구현 제품 흐름을 `skip`으로 녹색 처리하지 않는다.

## 16. 구현 배치

### M0. 착수 승인과 계약 동결

- 3장의 착수 게이트 증거를 기록한다.
- repository, module id, API origin, storage 정책을 확정한다.
- 현재 fixture를 새 계약의 회귀 입력으로 보존한다.

완료 기준: 승인된 명세와 실패하는 계약 시험이 먼저 존재한다.

### M1. 독립 모듈·DB·권한

- 새 저장소와 G7 모듈 skeleton
- category, product, version, asset, audit migration
- owner 전용 관리자 메뉴·permission

완료 기준: stock G7에서 core 수정 없이 설치·활성·비활성·제거된다.

### M2. 관리자와 검증 파이프라인

- 상품·분류·버전 CRUD
- ZIP·preview upload
- 격리 검증, 상세 report, 상태 전이

완료 기준: 잘못된 package는 게시할 수 없고 저장 흔적이 안전하게 정리된다.

### M3. 공개 웹·catalog·artifact

- SEO 목록·상세 페이지
- Public API v1
- immutable artifact와 cache 정책

완료 기준: catalog의 모든 URL·bytes·digest가 staging에서 검증된다.

### M4. Page Builder 정식 연결

- `/admin/page-builder/store`
- browse/search/filter/detail/install/apply/update 상태
- 정적 fixture endpoint 의존 제거

완료 기준: Page Builder가 마켓 DB가 생성한 catalog만 소비해 E2E를 통과한다.

### M5. 콘텐츠 이관과 출시

- 기존 두 fixture를 관리자에서 다시 등록
- 승인된 실제 Block Pack과 Page Kit 재고 등록
- g7devops.com 배포와 장애·복구 훈련

완료 기준: 정적 catalog 생성 스크립트 없이 관리자가 등록·검증·게시할 수 있다.

## 17. 현재 프로토타입 폐기·이관 계획

독립 마켓이 M4를 통과하기 전에는 현재 기능을 내부 fixture로 유지한다. 전환 시 다음 순서로 제거한다.

1. 새 마켓에 현재 두 fixture를 owner 관리 흐름으로 재등록한다.
2. Page Builder의 catalog URL을 새 Public API v1로 전환한다.
3. 동일 상품의 id/version/digest 호환성을 확인한다.
4. Page Builder 릴리스에서 `resources/store/dist`와 모듈 내 catalog/artifact 공개 endpoint를 제거한다.
5. 관리자 UI의 `무료 마켓` 모달을 정식 `/admin/page-builder/store` 화면으로 교체한다.
6. 기존 설치된 Pack과 적용된 Page가 그대로 동작하는지 회귀시험한다.

## 18. Definition of Done

아래를 모두 만족하기 전에는 `마켓 완료`로 보고하지 않는다.

- 독립 저장소와 독립 G7 모듈이 존재한다.
- 공식 서버 owner 관리자에서 상품을 등록·검증·게시·보관할 수 있다.
- 마켓 DB에서 생성한 versioned catalog와 immutable artifact가 제공된다.
- Page Builder의 정식 마켓 route가 해당 API를 소비한다.
- 실제 신규 Block Pack과 Page Kit 재고가 등록됐다.
- 설치·적용·업데이트·장애 유지 E2E가 통과한다.
- 보안·호환성·접근성·시각 회귀 gate가 통과한다.
- 현재 정적 Page Builder 내장 catalog endpoint가 제거됐다.
- 문서, Changelog, 배포·복구 운영 절차가 현재 구현과 일치한다.

## 19. 구현 시 열어야 할 결정

다음은 지금 미리 구현하지 않고 M0에서 증거와 함께 확정한다.

- artifact storage를 G7 로컬 디스크로 시작할지 R2 같은 object storage를 사용할지
- 공개 상품 페이지의 광고·제휴 영역과 제품 콘텐츠의 시각적 경계
- 다운로드 익명 집계를 실제로 저장할지
- 유료 ZIP 판매를 마켓 밖 SIR 콘텐츠몰로 유지할지
- 유료 entitlement를 장래 마켓에 추가할지

이 결정들은 무료 단일 발행자 마켓의 최초 데이터·API 계약을 복잡하게 만들지 않아야 한다.
