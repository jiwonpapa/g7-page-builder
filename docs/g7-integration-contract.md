# G7 integration contract

상태: MVP baseline
검증 기준: G7 7.0.7

## 결론

G7 코어와 번들 템플릿을 수정하지 않습니다. Page Builder는 G7의 실제 공개 모듈 표면 중 필요한 최소 기능만 사용하며 문서·리비전·마지막 정상 발행본을 자체 소유합니다.

G7 7.0.7에는 독립 JSON UI 문서를 mount/load/save/publish하는 공개 계약이 없습니다. 따라서 MVP public artifact는 서버에서 정화한 HTML이며, G7 JSON UI compiler는 향후 선택형 target입니다.

## 필수 G7 의존성 예산

| 필수 G7 표면 | Page Builder 사용 |
|---|---|
| `module.php` lifecycle, module Provider 발견 | 설치·활성·비활성·upgrade와 Adapter/View binding 진입점 |
| `src/routes/api.php`, Provider가 선등록하는 Web route | 모듈 API와 독립 editor/preview, `/pages/{slug}`, 선택형 `/` 홈 응답 |
| `database/migrations` | Page Builder 전용 테이블 |
| admin auth, permissions | 관리자 API 접근 제어 |
| `getAdminMenus()`, `resources/routes/admin.json`, module admin layout | 기존 페이지 관리와 분리된 G7 네이티브 Page Builder 문서함 |
| `module.json` asset manifest, public asset route | 사전 빌드 IIFE/CSS를 자체 shell에서만 로드 |

위 항목 외 G7 기능은 기본 제품 의존성이 아닙니다. 특히 `module.json`의 `dependencies.modules`와 `dependencies.plugins`는 빈 객체를 유지합니다.

기본 제품에서 제외:

- User SPA route와 User Template layout
- User Template·Layout Extension·Layout Editor
- `sirsoft-page`, `sirsoft-ecommerce`와 기타 번들 모듈
- G7 Model·Repository·Service·DB table
- G7 Attachment/Media Model
- custom role 등록과 기존 G7·번들 모듈 admin menu 재사용·수정

모듈은 `페이지 빌더` top-level admin menu 하나를 고유 slug `jiwonpapa-page-builder`, 고유 URL `/admin/page-builder`로 선언합니다. 이 문서함·생성 화면은 G7 공개 admin route/layout 계약을 사용해 기존 관리자 외형을 유지합니다. 무거운 drag-and-drop editor만 `/modules/jiwonpapa-page_builder/admin/editor?document={uuid}` 전체화면 shell로 분리합니다. `sirsoft-page`의 `페이지 관리`, slug `sirsoft-page`, URL `/admin/pages`는 그대로 보존하며 Page Builder가 숨기거나 대체하지 않습니다.

로컬 G7 테스트 설치에 번들 모듈이 존재해도 제품 의존성으로 간주하지 않습니다. 기본 모듈은 이들이 비활성·미설치인 환경을 전제로 컴파일되고, 선택 연동은 별도 capability test를 통과할 때만 로드합니다.

금지:

- G7 또는 번들 모듈의 Model, Repository, Service, DB 테이블 직접 접근
- G7 `resources/js/core/**`, `G7Core.__runtime`, private Layout Editor bundle 사용
- 기존 template route/layout JSON 수정
- 기존 `페이지 관리` admin menu·slug·URL 수정 또는 Page Builder 진입점으로 재사용
- Layout Editor의 저장 API를 Page Builder 문서 저장소로 사용

루트 `module.php`는 `App\Extension\AbstractModule`을 연결하는 Composition Root 예외입니다. `src/Providers/*ServiceProvider.php`도 Adapter binding과 `loadViewsFrom`만 허용하며 비즈니스 로직은 두지 않습니다.

## 소유권

| 데이터 | 소유자 |
|---|---|
| slug, title, SEO, 공개 여부 | Page Builder |
| builder document, draft lock, revision | Page Builder |
| prepared publication, active publication, compiled HTML | Page Builder |
| Header·Footer Site Part 원본·revision·active 발행본 | Page Builder |
| editor selection/history/sidebar | 브라우저 임시 상태 |
| G7 Layout JSON | G7 template/module, Page Builder 수정 금지 |

`sirsoft-page`의 현재 content row는 draft/published가 분리되지 않으므로 Page Builder 원본이나 last-good 발행 저장소로 사용하지 않습니다. 향후 metadata mirror가 필요하면 별도 선택 Adapter 제품으로 검토하며 기본 모듈에는 포함하지 않습니다.

## 모듈 API

G7가 자동으로 붙이는 prefix를 포함한 MVP endpoint입니다.

| Method | Path | 목적 |
|---|---|---|
| GET | `/api/modules/jiwonpapa-page_builder/admin/documents` | 문서 목록 조회 |
| GET | `/api/modules/jiwonpapa-page_builder/admin/site-shell` | 기존 설정에서 Site Part를 최초 생성하기 위한 호환 fallback 조회 |
| PUT | `/api/modules/jiwonpapa-page_builder/admin/site-shell` | 구버전 호환용 설정 저장. 신규 관리자 UI에서는 직접 사용하지 않음 |
| GET | `/api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}` | 독립 Site Part 초안과 active revision 조회 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/bootstrap` | 기존 SiteShell 또는 기본값에서 최초 revision 생성 |
| PUT | `/api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/draft` | expected lock으로 Site Part 새 revision 저장 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/publish` | compile 검증 후 현재 revision을 active로 전환 |
| GET | `/api/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}/revisions` | 최근 Site Part revision 조회 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents` | slug/title/locale 문서 생성, mode는 canvas 고정 |
| GET | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}` | draft와 lock version 조회 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/duplicate` | expected lock의 현재 draft를 새 UUID·slug·revision 1 초안으로 복제 |
| PATCH | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}` | expected lock으로 title/slug/locale 변경 |
| PUT | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/draft` | expected lock으로 draft 저장 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/preview` | 만료형 preview token 생성 |
| GET | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/revisions` | 최근 immutable revision 조회 |
| GET | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/revisions/{revision}` | revision 문서 조회 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/revisions/{revision}/preview` | 과거 revision 미리보기 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/revisions/{revision}/restore` | expected lock으로 과거 문서를 새 초안 revision으로 복원 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/publications/prepare` | 검증·컴파일 후 비활성 후보 생성 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/publications/unpublish` | expected lock으로 active pointer 해제, 문서·리비전 보존 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/documents/{id}/home` | 발행 문서를 홈으로 지정하거나 해제, expected lock 적용 |
| POST | `/api/modules/jiwonpapa-page_builder/admin/publications/{token}/commit` | 후보를 active publication으로 원자 전환 |
| GET | `/api/modules/jiwonpapa-page_builder/public/pages/{slug}` | active snapshot만 반환 |

관리자 Web 진입점은 G7 네이티브 문서함 `/admin/page-builder`, 페이지 편집기 `/modules/jiwonpapa-page_builder/admin/editor?document={uuid}`, Site Part 편집기 `/modules/jiwonpapa-page_builder/admin/site-parts/{header|footer}`로 분리합니다. G7 기본 페이지 관리와 연결하지 않습니다.

문서는 먼저 archive해야 하며 archive 시 공개본과 홈 지정을 같은 transaction에서 해제합니다. 영구 삭제는 archived 상태, 최신 lock version, 사용자가 직접 입력한 정확한 slug 확인을 모두 통과해야 합니다. 기존 G7 페이지 데이터에는 적용하지 않습니다.

문서 복제는 현재 draft의 blocks·tokens·locale·`shell_mode`만 복사합니다. 새 문서는 다른 UUID와 slug, lock version 1, revision 1의 미발행 초안으로 시작하며 원본의 publication, public URL, home 지정, preview token, 기존 revision 이력을 승계하지 않습니다.

Admin API route에는 `auth:sanctum`, 모듈 permission, 분당 300회 throttle middleware를 명시합니다. autosave·preview를 포함한 한 편집 세션은 허용하되 비정상 반복 요청은 제한합니다. Bearer API 요청에는 CSRF를 요구하지 않습니다. Web form을 추가하는 경우에만 Web middleware의 CSRF를 적용합니다. Public endpoint는 draft, token, 내부 오류를 반환하지 않습니다.

## 페이지 렌더

- canonical 공개 route `/pages/{slug}`가 active artifact를 직접 응답합니다.
- 과거 `/modules/jiwonpapa-page_builder/p/{slug}`는 공개본이 있을 때 `/pages/{slug}`로 HTTP 301 이동합니다.
- 발행 문서 하나를 홈으로 지정하면 GET/HEAD `/`만 Page Builder가 응답합니다. 지정이 없거나 모듈 조회가 실패하면 G7 기본 홈으로 fail-through 합니다.
- G7 SPA layout과 Layout Editor를 전혀 사용하지 않습니다.
- 활성 User Template과 번들 모듈의 존재 여부를 묻지 않습니다.
- 공개 route는 G7 템플릿 Header·Footer를 사용하지 않습니다. 기본 `shell_mode=global`에서는 발행된 Page Builder Site Part를 렌더하며 해당 종류가 아직 미발행이면 기존 SiteShell을 종류별 fallback으로 사용합니다. `none`에서는 콘텐츠 canvas만 렌더합니다.
- module Provider가 `resources/views`를 `loadViewsFrom`으로 등록하고 자체 Controller가 editor/viewer shell을 렌더합니다. G7 `getViews()` 자동 등록을 가정하지 않습니다.
- `module.json` asset strategy는 `lazy`이며 shell이 `/api/modules/assets/jiwonpapa-page_builder/dist/...`를 직접 링크합니다. Puck bundle을 다른 G7 화면에 전역 주입하지 않습니다.
- canonical·Open Graph URL은 `/pages/{slug}` 또는 홈 지정 시 `/`을 사용합니다.

## 발행 순서

1. draft lock version을 확인합니다.
2. PHP가 schema와 block requirements를 검증합니다.
3. candidate HTML을 compile·sanitize하고 inactive publication으로 저장합니다.
4. publication token을 commit해 active pointer만 원자 교체합니다.
5. 어느 단계든 실패하면 직전 active publication을 유지합니다.

리비전 목록·미리보기·복원은 구현되어 있습니다. rollback은 과거 revision 복원만으로 active publication을 바꾸지 않고, 확인 뒤 정상 prepare·commit 발행을 다시 수행하는 흐름입니다.

## Capability doctor

설치·업데이트 시 다음을 확인합니다.

- G7 `>=7.0.7`
- module lifecycle/Provider/routes/migrations/permissions/asset serving 사용 가능
- `module.json`에 필수 번들 module/plugin dependency가 없음
- Page Builder schema/compiler version 지원 여부

선택 Adapter의 capability 실패는 해당 Adapter만 비활성화합니다. 모듈이 활성인 schema/compiler 비호환이면 편집·신규 발행만 막고 기존 active HTML을 계속 제공합니다. 코어 버전 비호환으로 모듈이 비활성화되면 route·asset도 사라지므로 배포 doctor는 해당 G7 업데이트를 금지하고 직전 코어로 롤백합니다.

## 선택 연동 규칙

User Template shell, `sirsoft-page` metadata mirror, `sirsoft-ecommerce` Product Grid, G7 JSON UI target은 기본 모듈 밖의 선택 연동입니다.

- Domain/Application/Contracts에서 선택 연동 type을 import하지 않습니다.
- 별도 Adapter 또는 Block Pack manifest가 capability와 최소 버전을 선언합니다.
- 설치되지 않으면 기본 UI·API·compiler에 관련 메뉴나 block을 등록하지 않습니다.
- 선택 연동의 호출 실패는 active publication을 변경하지 않습니다.
