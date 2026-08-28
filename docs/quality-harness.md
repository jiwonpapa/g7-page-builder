# Quality harness

## 판정 원칙

환경 smoke와 제품 acceptance를 분리합니다. 스크린샷 두 장을 제품 E2E로 부르지 않습니다.

| Gate | 목적 | 실패 시 |
|---|---|---|
| `quality-coordination` | path lease·범위 차단·제출·통합·runtime/release guard와 편집 상호작용·레이아웃 계약 회귀시험 | 병렬 작업·merge 금지 |
| `quality-php` | Composer validate, Pint, PHPStan, PHPUnit | merge 금지 |
| `quality-php-coverage` | Xdebug 기반 Unit+G7 integration PHP line coverage | merge 금지 |
| `quality-frontend` | SemVer/changelog, TS strict, Vitest+V8 coverage, G7 dependency budget, boundary, production build, asset 검사, 편집기/발행 타이포 계약 | merge 금지 |
| `quality-g7` | module 설치·활성·migration·TLS·DB·Redis·관리자 인증 | 통합 merge 금지 |
| `dev-browser-smoke` | home/login/runtime 기본 assertion | 환경 완료 아님 |
| `dev-product-e2e` | 생성→실제 포인터 편집→reload→preview→publish→공개본 보존→재발행 | 수직 기능 완료 금지 |

## Worktree coordination

- 모든 구현 Worktree는 깨끗한 기준 SHA, 소유 path prefix, 검증 profile을 `coord-start`로 등록합니다.
- coordination state는 Git common directory에만 저장하며 모든 worktree가 같은 active lease를 읽습니다.
- 상·하위 path prefix 중복과 `integration`, `runtime`, `migration`, `shared-contract`, `version` AREA 중복을 시작 단계에서 차단합니다.
- `task-submit`은 기준 SHA 대비 committed·staged·unstaged·untracked 파일을 검사하고 claim 밖 변경이 있으면 커밋하지 않습니다.
- frontend `task-submit`은 타입·단위시험 전에 `check:editor-acceptance`와 `check:editor-layout-parity`를 실행합니다. 기존 상호작용 증거와 함께 Puck iframe의 scoped `border-box`, 공개 출력과 같은 content-width 공식, 편집기·발행 CSS의 동일 WYSIWYG 타이포 규칙, 45종을 모두 포함하는 95개 프리셋과 공식 마켓 적용 API로 미디어까지 해소한 Page Kit 5종의 가로 overflow·좌우 content edge·대표 텍스트 computed style·줄 수 비교가 빠지면 제출을 거부합니다.
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
7. PC에서만 문서를 편집하고 모바일·태블릿 iframe 폭은 저장 없는 반응형 preview로 전환
8. publish, 비로그인 public DOM, 반응형 overflow 확인
9. 재편집 중 기존 공개본 보존과 재발행
10. 과거 revision 미리보기, 새 초안 복원 중 공개본 보존, 확인 후 rollback 재발행
11. 공개 해제 뒤 public 404
12. typed motion 저장·미리보기·발행, 조건부 public runtime과 실제 in-view 활성화
13. 최상위 Header·Footer 통합 관리에서 다중 세트 생성, 두 편집기 동시 표시, 각각 저장·발행, 미발행 쌍 활성화 차단, 완성 쌍 원자 전환·원래 활성 쌍 복원과 공개 렌더를 확인합니다. 개별 Site Part에서는 축소 미리보기, 실제 드래그 삽입, 인라인/속성 편집, Puck 기기 전환에 따른 태블릿·모바일 표시 재정의·초기화와 drawer·dropdown·하단 시트 열기·Escape 닫기·초점 복귀를 확인합니다.
14. 문서별 공통영역 제외 후 재발행 시 Header·Footer가 없는 인트로 렌더
15. 활성 User Template route catalog에서 로그인 route를 선택하고 URL이 저장되는지 확인
16. `template` 문서를 `/pages/{slug}`에서 활성 `_user_base` 안에 렌더하고 Page Builder Site Part가 섞이지 않는지 확인
17. 임시 홈 지정 시 merged `/` route가 Page Builder home layout으로 바뀌며 테스트 종료 뒤 기존 홈 지정을 복원하는지 확인
18. 공통 로그인 전후 표시 조건, G7 목록 pagination, 다운로드 자산 선택, 게시글·상품 상세 블록의 안전한 공개 렌더 확인
19. 45종 전체 블록을 한 문서로 실제 발행하고 manifest 순서와 고유 public block 45개, 각 블록의 비어 있지 않은 가시 콘텐츠·깨진 이미지 0·최소 10px 가독성·무가로넘침·안정된 geometry, axe WCAG A/AA, PC·태블릿·모바일 핵심 10종씩 30개 시각 baseline 확인
20. PC 1280 canvas에서만 contenteditable 내부 문자 좌표를 표시 축척이 적용된 Locator 좌표로 변환해 실제 `mouse.down → mouse.move → mouse.up`으로 목표 문자열과 정확히 같은 글자 범위를 선택합니다. 선택 해제, Tiptap active/inactive 단일 범위 상태와 요소 전체 벌룬의 상호배타, 반복 선택, 바깥 클릭 닫힘, 굵게·기울임·밑줄·글꼴·크기·색상·굵기의 즉시 반영, `요소 전체 스타일`·`블록 설정` Action Bar 역할 분리, 우측 Inspector의 richtext 입력기·서식 메뉴 부재, 캔버스 입력과 저장·reload·preview·public DOM 보존을 확인합니다. 모바일·태블릿에서는 이 편집 spec을 실행하지 않습니다.
21. 45종을 모두 포함하는 내장 완성 섹션 95개와 Page Kit 5종을 PC 1280·태블릿 768·모바일 360 canvas에 실제 로드합니다. PC는 편집 모드, 태블릿·모바일은 contenteditable과 mutation 권한이 없는 미리보기 전용 모드여야 하며 뷰포트 전환은 문서를 저장하지 않아야 합니다. 각 Puck block의 실제 child와 같은 draft의 컴파일 미리보기를 instance/type 순서로 짝지어 문서·블록 가로 넘침 0px, 좌우 content edge 오차 1.25px 이하, 대표 제목의 font family·weight·크기·행간·자간 오차 0.75px 이하와 동일 줄 수를 강제합니다.
22. Header·Footer Site Part는 PC 기준 표시값에 태블릿·모바일 제한형 재정의를 순서대로 합성합니다. 간격·정렬·CTA/내비게이션 표시·열 수·메뉴 방식만 저장하며 임의 class/style은 거부합니다. 기기별 초기화는 해당 재정의만 제거하고, 편집 iframe과 발행 HTML의 data 계약·하단 시트 geometry·무가로넘침을 함께 확인합니다.

현재 제품 E2E는 위 흐름을 검사합니다. 기존 Page Management와 별도 메뉴·권한 공존은 `dev-verify`, 공개 해제 뒤 문서·revision 보존과 오래된 발행 후보 차단은 G7 통합 PHPUnit이 검사합니다. 공개 전용 결정적 fixture는 axe WCAG A/AA와 PC·태블릿·모바일 고정 스크린샷을 검사하며, G7 통합 PHPUnit은 compile 실패 뒤 마지막 정상 public artifact·표현 hash 불변을 검사합니다.

최소 G7 fixture는 `module.json`의 module/plugin 의존성이 0개인지 확인하고, `sirsoft-board`·`sirsoft-ecommerce` 구현 클래스를 import하지 않은 상태에서 선택형 공개 API placeholder가 컴파일되는지 검사합니다. capability endpoint 실패는 공개 경량 runtime의 빈 상태로 끝나며 문서 저장·독립 shell 발행을 중단하지 않습니다.

제품 흐름이 미구현이면 test를 `skip`하지 않고 해당 제품 gate를 미통과 상태로 보고합니다.

`scripts/check-editor-acceptance-contract.mjs`는 위 20번·22번과 PC 전용 mutation 권한, `scripts/check-editor-layout-parity.mjs`는 19번·21번을 정적 계약으로 잠급니다. PC 편집 spec을 제품 E2E 목록에서 빼거나 태블릿·모바일에서 다시 실행하도록 바꾸거나 retry/skip을 추가해도 실패합니다. Site Part viewport 상태·상속·초기화·schema enum·compiler data 계약·편집/공개 CSS·실제 하단 시트 E2E 중 하나를 제거해도 실패합니다. Puck iframe의 scoped box model, WYSIWYG 타이포 규칙, 45종 전체 presentation 검사, 95개 프리셋·Page Kit 5종의 세 viewport 가로 overflow·content edge·computed typography·줄 수 비교를 제거해도 `quality-frontend`, `task-submit`, `dev-product-e2e`가 실패합니다. 정적 계약 통과는 브라우저 성공을 대신하지 않으며, 전체 통합에서는 전용 E2E가 실제 runtime에서 다시 실행됩니다.

## 자동화와 로컬 통합

- 필수 판정은 GitHub Actions가 아니라 로컬 `make quality-gate TASK=<integration-id>`와 동일 Docker runtime을 기준으로 합니다.
- `frontend`: Node 24, `npm ci`, frontend gate, dist artifact
- `php`: PHP 8.5, `composer install`, PHP gate
- 현재 G7 설치·TLS·인증·제품 lifecycle 통합은 runtime lease를 가진 로컬 고정 checkout의 `make integration-verify TASK=<integration-id>`로 검사합니다.
- Header Site Part 반응형 검증은 Puck 태블릿·모바일 viewport에서 간격·정렬·메뉴 방식 재정의와 초기화를 실제 조작하고, 하단 시트를 열어 편집 iframe·발행 화면의 바닥 정렬·전체 폭·backdrop·Escape focus 복귀까지 확인합니다. 모바일 폭에서 메뉴를 정적으로 펼쳐 보이는 것만으로 통과시키지 않습니다.
- `quality-g7`은 G7 7.0.8 고정 checkout의 autoload로 Adapter PHPStan, SQLite 통합 test, PHP coverage 하한선을 실행합니다.
- TLS·관리자 인증·실제 module route를 포함하는 `dev-product-e2e`는 로컬 통합 필수 gate입니다. 호스팅형 CI나 외부 secret은 필수조건이 아닙니다.
