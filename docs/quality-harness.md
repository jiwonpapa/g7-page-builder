# Quality harness

## 판정 원칙

환경 smoke와 제품 acceptance를 분리합니다. 스크린샷 두 장을 제품 E2E로 부르지 않습니다.

| Gate | 목적 | 실패 시 |
|---|---|---|
| `quality-coordination` | path lease·범위 차단·제출·통합·runtime/release guard와 편집 상호작용 계약 회귀시험 | 병렬 작업·merge 금지 |
| `quality-php` | Composer validate, Pint, PHPStan, PHPUnit | merge 금지 |
| `quality-php-coverage` | Xdebug 기반 Unit+G7 integration PHP line coverage | merge 금지 |
| `quality-frontend` | SemVer/changelog, TS strict, Vitest+V8 coverage, G7 dependency budget, boundary, production build, asset 검사 | merge 금지 |
| `quality-g7` | module 설치·활성·migration·TLS·DB·Redis·관리자 인증 | 통합 merge 금지 |
| `dev-browser-smoke` | home/login/runtime 기본 assertion | 환경 완료 아님 |
| `dev-product-e2e` | 생성→실제 포인터 편집→reload→preview→publish→공개본 보존→재발행 | 수직 기능 완료 금지 |

## Worktree coordination

- 모든 구현 Worktree는 깨끗한 기준 SHA, 소유 path prefix, 검증 profile을 `coord-start`로 등록합니다.
- coordination state는 Git common directory에만 저장하며 모든 worktree가 같은 active lease를 읽습니다.
- 상·하위 path prefix 중복과 `integration`, `runtime`, `migration`, `shared-contract`, `version` AREA 중복을 시작 단계에서 차단합니다.
- `task-submit`은 기준 SHA 대비 committed·staged·unstaged·untracked 파일을 검사하고 claim 밖 변경이 있으면 커밋하지 않습니다.
- frontend `task-submit`은 타입·단위시험 전에 `check:editor-acceptance`를 실행합니다. 전용 E2E가 iframe 내부 locator의 실제 `hover → mouse.down → hover → mouse.up` 선택과 실제 `click` 해제, browser project와 360/768/1280 내부 canvas 일치, 활성 canvas iframe 고정, 재시도 0회, 세 viewport, 툴바 상호배타, 저장·미리보기·공개 DOM 서식 증거를 잃거나 합성 Selection으로 바뀌면 제출을 거부합니다.
- `task-integrate`는 Local integration task만 실행하며 merge-tree 사전검사, `--no-commit` 임시 병합, profile gate를 통과한 경우에만 merge commit을 만듭니다.
- 고정 `g7pb-dev`를 사용하는 모든 Docker 품질 명령은 Local의 `integration,runtime` lease와 `TASK=`를 요구합니다.
- `integration-verify`는 다른 active/submitted task가 없는 상태에서 전체 `quality-gate`를 실행합니다. 검증 SHA 이후 변경이 있으면 release guard가 패키징과 스테이징을 중지합니다.
- shell 회귀시험은 격리된 임시 Git 저장소와 3개 worktree를 만들어 lease 중복, 범위 밖 변경, 자동 제출, runtime 차단, 순차 병합, 검증·완료 history를 확인합니다.

명령과 장애 처리는 [Worktree coordination 하네스](worktree-coordination.md)에 정의합니다.

## PHP

- 개발·필수 CI runtime: PHP 8.5
- PHPUnit 13, Laravel Pint, PHPStan level 8
- `phpstan.neon.dist`는 Domain/Application/Contracts를 G7 bootstrap 없이 검사합니다.
- `phpstan-g7.neon.dist`는 `quality-g7`에서 설치된 G7 autoload를 사용해 module.php, Provider, route, Adapter를 검사합니다.
- G7 Adapter integration test만 설치된 G7 autoload를 사용합니다.
- baseline으로 오류를 숨기지 않습니다.
- Unit+G7 integration을 한 coverage session으로 실행해 전체 PHP line 61%를 최저선으로 강제합니다.
- 핵심 컴파일러 87%·서비스 96%·Eloquent 저장소 91% line coverage를 각각 별도 최저선으로 강제합니다.
- PHPUnit warning도 실패로 처리하고 Clover 보고서는 `output/coverage/php-clover.xml`에 생성합니다.

## Frontend

- Node 24, npm lockfile
- `module.json`·`package.json`·`package-lock.json` 버전 일치와 SemVer 2.0.0 문법
- Keep a Changelog의 `Unreleased`, 현재 버전, ISO 날짜, 허용 카테고리 검사
- TypeScript strict, Vitest, V8 coverage, Vite production build
- 전체 frontend 실행 코드의 statements 54%·branches 54%·functions 47%·lines 56%를 최저선으로 강제합니다.
- 핵심 `PuckEditorAdapter.tsx`는 statements 80%·branches 77%·functions 76%·lines 81%를 별도 최저선으로 강제합니다.
- `main.tsx`와 React/Puck Site Part orchestration은 브라우저 수직 E2E가 담당하므로 V8 단위 coverage 분모에서 제외합니다. 순수 Site Part document adapter는 별도 Vitest로 왕복·검증하며, coverage HTML/JSON은 `output/coverage`에 생성합니다.
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
- Page Builder 소유 2개 이외의 admin route/layout, 정확히 허용한 user route 2개·user layout 3개 이외의 User Template 결합
- 기존 User Template 파일·layout JSON·DB row 수정, 모듈 namespace 밖 user route/layout 선언
- G7 TemplateService·ModuleSettingsService·HookManager를 `Infrastructure/Gnuboard7` Adapter 밖에서 사용하는 코드
- `module.json`의 번들 module/plugin hard dependency
- `sirsoft-page`, `/admin/pages`, `페이지 관리`를 Page Builder 메뉴에서 재사용하는 선언
- 별도 `페이지 빌더` 메뉴 slug·URL·permission의 누락 또는 중복 선언
- archive 선행·공개 해제·lock version·typed slug 확인 없이 문서 purge를 여는 구현

두 검사는 `npm run check`와 CI frontend job에서 매번 실행합니다.

첫 공개 viewer 구현부터 admin template만 설치한 별도 G7 fixture에서도 생성·발행·공개 route를 검사합니다. 현재 full local fixture에 번들 모듈이 설치되어 있다는 사실만으로 최소 의존성을 통과했다고 판정하지 않습니다.

## Browser

Playwright 프로젝트는 desktop 1440, tablet 768, mobile 390을 사용하고 worker는 1개로 제한합니다. 인프라 test는 기본 실패 artifact 정책을 사용합니다. 관리자 자격증명과 Bearer token을 다루는 제품 test는 비밀 유출을 막기 위해 trace/screenshot/video를 끄며, 공개 URL만 사용하는 별도 결정적 fixture에서 시각 baseline을 추가합니다.

제품 E2E는 다음을 실제 assertion합니다.

1. 관리자 API 인증 뒤 독립 Page Builder 문서함 URL 진입
2. Page Builder 문서함에서 page/document 생성·재진입
3. 좌측 9개 분류·45종 블록·95개 프리셋·6개 Quick Add 축소 미리보기 노출, block 사이 실드래그 삽입, 상세 미리보기 추가·속성 편집·순서 변경
4. 라이트·다크·기기 테마, Header·Page·Footer 전체 사이트 캔버스와 embedded Site Part 전환
5. 선택 블록 글자 크기·정렬, 버튼 route·Hero media 문맥 편집과 문의 폼 제출·모바일 drawer 초점 순환
6. reload 뒤 동일성
7. 편집기 모바일·태블릿·PC iframe 폭 전환과 세 viewport preview
8. publish, 비로그인 public DOM, 반응형 overflow 확인
9. 재편집 중 기존 공개본 보존과 재발행
10. 과거 revision 미리보기, 새 초안 복원 중 공개본 보존, 확인 후 rollback 재발행
11. 공개 해제 뒤 public 404
12. typed motion 저장·미리보기·발행, 조건부 public runtime과 실제 in-view 활성화
13. Header·Footer Site Part의 축소 미리보기, 실제 드래그 삽입, 인라인/속성 편집, 저장·발행, 공개 렌더와 모바일 메뉴 열기·Escape 닫기·초점 복귀
14. 문서별 공통영역 제외 후 재발행 시 Header·Footer가 없는 인트로 렌더
15. 활성 User Template route catalog에서 로그인 route를 선택하고 URL이 저장되는지 확인
16. `template` 문서를 `/pages/{slug}`에서 활성 `_user_base` 안에 렌더하고 Page Builder Site Part가 섞이지 않는지 확인
17. 임시 홈 지정 시 merged `/` route가 Page Builder home layout으로 바뀌며 테스트 종료 뒤 기존 홈 지정을 복원하는지 확인
18. 공통 로그인 전후 표시 조건, G7 목록 pagination, 다운로드 자산 선택, 게시글·상품 상세 블록의 안전한 공개 렌더 확인
19. 45종 전체 블록을 한 문서로 실제 발행하고 고유 public block 45개, axe WCAG A/AA, 무가로넘침, PC·태블릿·모바일 핵심 10종씩 30개 시각 baseline 확인
20. PC·태블릿·모바일에서 활성 canvas iframe의 contenteditable 내부 문자 좌표를 기준으로 실제 `hover → mouse.down → hover → mouse.up` 글자 범위를 선택하고, 본문 위 실제 locator `click`으로 선택을 해제해 범위 툴바와 요소 전체 벌룬의 상호배타·선택 해제·반복 선택을 확인한 뒤 부분 글꼴·크기·색상·굵기가 저장·reload·preview·public DOM까지 유지되는지 확인

현재 제품 E2E는 위 흐름을 검사합니다. 기존 Page Management와 별도 메뉴·권한 공존은 `dev-verify`, 공개 해제 뒤 문서·revision 보존과 오래된 발행 후보 차단은 G7 통합 PHPUnit이 검사합니다. 공개 전용 결정적 fixture는 axe WCAG A/AA와 PC·태블릿·모바일 고정 스크린샷을 검사하며, G7 통합 PHPUnit은 compile 실패 뒤 마지막 정상 public artifact·표현 hash 불변을 검사합니다.

최소 G7 fixture는 `module.json`의 module/plugin 의존성이 0개인지 확인하고, `sirsoft-board`·`sirsoft-ecommerce` 구현 클래스를 import하지 않은 상태에서 선택형 공개 API placeholder가 컴파일되는지 검사합니다. capability endpoint 실패는 공개 경량 runtime의 빈 상태로 끝나며 문서 저장·독립 shell 발행을 중단하지 않습니다.

제품 흐름이 미구현이면 test를 `skip`하지 않고 해당 제품 gate를 미통과 상태로 보고합니다.

`scripts/check-editor-acceptance-contract.mjs`는 위 20번을 정적 계약으로도 잠급니다. 전용 spec을 제품 E2E 목록에서 빼거나, retry/viewport skip을 추가하거나, `Selection.addRange`·합성 `selectionchange`로 실제 포인터 순서를 우회하면 `quality-coordination`, `quality-frontend`, `task-submit`, `dev-product-e2e`가 모두 실패합니다. 정적 계약 통과는 브라우저 성공을 대신하지 않으며, 전체 통합에서는 전용 E2E가 실제 runtime에서 다시 실행됩니다.

## 자동화와 로컬 통합

- 필수 판정은 GitHub Actions가 아니라 로컬 `make quality-gate TASK=<integration-id>`와 동일 Docker runtime을 기준으로 합니다.
- `frontend`: Node 24, `npm ci`, frontend gate, dist artifact
- `php`: PHP 8.5, `composer install`, PHP gate
- 현재 G7 설치·TLS·인증·제품 lifecycle 통합은 runtime lease를 가진 로컬 고정 checkout의 `make integration-verify TASK=<integration-id>`로 검사합니다.
- `quality-g7`은 G7 7.0.8 고정 checkout의 autoload로 Adapter PHPStan, SQLite 통합 test, PHP coverage 하한선을 실행합니다.
- TLS·관리자 인증·실제 module route를 포함하는 `dev-product-e2e`는 로컬 통합 필수 gate입니다. 호스팅형 CI나 외부 secret은 필수조건이 아닙니다.
