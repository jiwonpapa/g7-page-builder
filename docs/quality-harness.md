# Quality harness

## 판정 원칙

환경 smoke와 제품 acceptance를 분리합니다. 스크린샷 두 장을 제품 E2E로 부르지 않습니다.

| Gate | 목적 | 실패 시 |
|---|---|---|
| `quality-php` | Composer validate, Pint, PHPStan, PHPUnit | merge 금지 |
| `quality-frontend` | TS strict, Vitest, G7 dependency budget, boundary, production build, asset 검사 | merge 금지 |
| `quality-g7` | module 설치·활성·migration·TLS·DB·Redis·관리자 인증 | 통합 merge 금지 |
| `dev-browser-smoke` | home/login/runtime 기본 assertion | 환경 완료 아님 |
| `dev-product-e2e` | 생성→편집→reload→preview→publish→공개본 보존→재발행 | 수직 기능 완료 금지 |

## PHP

- 개발·필수 CI runtime: PHP 8.5
- PHPUnit 13, Laravel Pint, PHPStan level 8
- `phpstan.neon.dist`는 Domain/Application/Contracts를 G7 bootstrap 없이 검사합니다.
- `phpstan-g7.neon.dist`는 `quality-g7`에서 설치된 G7 autoload를 사용해 module.php, Provider, route, Adapter를 검사합니다.
- G7 Adapter integration test만 설치된 G7 autoload를 사용합니다.
- baseline으로 오류를 숨기지 않습니다.

## Frontend

- Node 24, npm lockfile
- TypeScript strict, Vitest, Vite production build
- Puck ↔ PageBuilderDocument round-trip Fixture
- block별 editor props와 compile Fixture
- `module.json`의 module/plugin 의존성 0개와 optional G7 surface 부재 검사
- editor IIFE, public effects IIFE, CSS output의 존재·경로·sourcemap 부재를 검사합니다.
- motion schema allowlist, Puck 왕복, compiler data attribute, JS-disabled fallback과 reduced-motion을 단위시험합니다.

## Architecture

정적 검사는 다음을 막습니다.

- Domain/Application/Contracts의 `App\`, `Illuminate\`, `Modules\Sirsoft\` import
- 전체 제품의 `G7Core.__runtime`, G7 `resources/js/core/**`
- G7·Sirsoft Model/Repository와 직접 table query
- `module.php`에서 `AbstractModule` 외 host 구현 import
- `src/Providers`에서 Adapter binding·View 등록 외 비즈니스 로직
- Page Builder 소유 2개 이외의 admin route/layout, 모든 user route/layout·resources/extensions 결합
- `module.json`의 번들 module/plugin hard dependency
- `sirsoft-page`, `/admin/pages`, `페이지 관리`를 Page Builder 메뉴에서 재사용하는 선언
- 별도 `페이지 빌더` 메뉴 slug·URL·permission의 누락 또는 중복 선언
- 복구 가능한 archive 계약 없이 문서 hard DELETE route·service·repository를 여는 구현

두 검사는 `npm run check`와 CI frontend job에서 매번 실행합니다.

첫 공개 viewer 구현부터 admin template만 설치한 별도 G7 fixture에서도 생성·발행·공개 route를 검사합니다. 현재 full local fixture에 번들 모듈이 설치되어 있다는 사실만으로 최소 의존성을 통과했다고 판정하지 않습니다.

## Browser

Playwright 프로젝트는 desktop 1440, tablet 768, mobile 390을 사용하고 worker는 1개로 제한합니다. 인프라 test는 기본 실패 artifact 정책을 사용합니다. 관리자 자격증명과 Bearer token을 다루는 제품 test는 비밀 유출을 막기 위해 trace/screenshot/video를 끄며, 공개 URL만 사용하는 별도 결정적 fixture에서 시각 baseline을 추가합니다.

제품 E2E는 다음을 실제 assertion합니다.

1. 관리자 API 인증 뒤 독립 Page Builder 문서함 URL 진입
2. Page Builder 문서함에서 page/document 생성·재진입
3. 좌측 12종 축소 미리보기 노출, block 사이 실드래그 삽입, 상세 미리보기 추가·속성 편집·순서 변경
4. reload 뒤 동일성
5. 편집기 모바일·태블릿·PC iframe 폭 전환과 세 viewport preview
6. publish, 비로그인 public DOM, 반응형 overflow 확인
7. 재편집 중 기존 공개본 보존과 재발행
8. 과거 revision 미리보기, 새 초안 복원 중 공개본 보존, 확인 후 rollback 재발행
9. 공개 해제 뒤 public 404
10. typed motion 저장·미리보기·발행, 조건부 public runtime과 실제 in-view 활성화

현재 제품 E2E는 위 흐름을 검사합니다. 기존 Page Management와 별도 메뉴·권한 공존은 `dev-verify`, 공개 해제 뒤 문서·revision 보존과 오래된 발행 후보 차단은 G7 통합 PHPUnit이 검사합니다. 실제 접근성 자동 검사, 고정 시각 baseline과 compile 실패 뒤 public hash 불변 시나리오는 전체 MVP gate에 추가해야 합니다.

제품 흐름이 미구현이면 test를 `skip`하지 않고 해당 제품 gate를 미통과 상태로 보고합니다.

## CI와 로컬 통합

- `frontend`: Node 24, `npm ci`, frontend gate, dist artifact
- `php`: PHP 8.5, `composer install`, PHP gate
- 현재 G7 설치·TLS·인증·제품 lifecycle 통합은 로컬 고정 checkout의 `make quality-gate`로 검사합니다.
- `g7-contract` CI는 G7 7.0.7 고정 checkout의 autoload로 Adapter PHPStan과 SQLite 통합 test를 실행합니다.
- TLS·관리자 인증·실제 module route를 포함하는 `dev-product-e2e`는 현재 로컬 통합 필수 gate입니다. 재현 가능한 CI secret/fixture가 준비되면 별도 `g7-integration` 필수 job으로 승격합니다.
