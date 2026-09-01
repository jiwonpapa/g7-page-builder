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

블록 라이브러리는 별도 `g7pb-block-product-quality/v1` 계약을 사용합니다. 45종 블록·95개 프리셋·140개 renderer 생성물의 정확한 재고, block별 제품/호환 정책, placeholder 문구, 중복 props, 프리셋 구조 차이, 로컬 이미지·대체 텍스트·실제 날짜, 95개 고유 프리셋 썸네일을 자동 판정합니다. G7 동적 데이터 블록은 라이브러리 생성 시 목록형 3~4개·상세형 1개의 결정적 제품 샘플이 실제 공개 renderer DOM에 보여야 하며 빈 제목 껍데기는 실패합니다. 릴리스와 배포는 현재 compiler/CSS/props source 및 썸네일의 자동 기술검증을 요구하며, 과거 사람·Codex 승인 digest는 감사 이력일 뿐 배포 조건이 아닙니다.

`npm run generate:block-library`는 프리셋 동기화→production build→140개 실제 renderer 썸네일 재생성→candidate 품질 검사를 한 흐름으로 실행합니다. Candidate 검사는 생성 오류를 즉시 차단합니다. 정식 릴리스는 `--technical --verify-render-source`와 PC·태블릿·모바일 E2E를 통과하면 되며 `product-quality.json` 승인 갱신을 요구하지 않습니다. 생성 후 props·compiler HTML·공개 CSS·이미지 중 하나라도 바뀌면 자동 source/thumbnail 검사가 stale 산출물을 차단합니다.

## Block quality evidence v2

### 차수 2-A: 분리된 증거 계약

`schemas/block-quality-evidence.schema.json`과 `scripts/lib/blockQualityEvidence.ts`의 `g7pb-block-quality-evidence/v2` 계약은 콘텐츠·자산·렌더·편집 변경 영향과 증거 무결성을 진단하는 선택형 감사 자료입니다. 이전 review 객체와 pending 상태는 이력으로 보존하지만 릴리스 승인이나 배포 차단에 사용하지 않습니다.

이 배치에서는 **기존 v1 검사·릴리스 연결을 제거하거나 대체하지 않습니다.** 순수 TypeScript 판정 코어와 schema를 먼저 고정하고 2-B에서 실제 140개 재고·파일 hash·변경 영향 수집기를 연결합니다. `assessQualityEvidence().errors`가 비어도 `pending`이 있으면 `ready=false`이므로 승인으로 사용할 수 없습니다. 입력 의존성을 누락한 채 이미지를 hash한 것처럼 주장하지 않도록 실제 수집 책임은 후속 collector에 명시적으로 둡니다. 자세한 범위·시험은 [2차 실행 기록](productization/phase-2-evidence.md)에 기록합니다.

### 차수 2-B: 실제 파일 수집과 shadow 원장

Node 24에서 `node scripts/check-block-quality-evidence.mjs --json`을 실행하면 현재 PHP renderer를 새로 실행하고, manifest와 계획 재고를 exact ID로 대조하여 콘텐츠·권리·렌더·편집별 실제 파일 지문을 계산합니다. `--snapshot`은 기존 v1 review 원문을 보존한 **모두 pending인 제안 JSON을 stdout으로만 출력**합니다. 파일 저장이나 승인 생성 명령이 아닙니다.

`SHADOW_OK`는 원장의 ID/지문/참조 파일이 일치한다는 뜻입니다. pending이나 외부/런타임 미확인 자산은 진단값으로 보고하며, 릴리스는 자동 기술검증 결과로 결정합니다. 원장 자체의 누락·변조·stale은 개발 증거 무결성 오류로 계속 실패합니다.

`bash tests/Harness/block-quality-evidence.test.sh`는 실제 140개 현재 renderer와 원장을 비교하고, 별도 고유 임시 디렉터리에서 승인 fixture·변조/삭제된 파일·경로 이탈·stale·재고 누락을 검증합니다. 테스트용 승인 fixture는 추적 원장에 기록하지 않습니다. 새 collector의 Vitest coverage 하한도 95/90/95/95로 적용합니다.

### 차수 2-C: 영향 범위 갱신과 배포 차단

현재 `test:unit`·제품 E2E 전 검사·`check`는 v2 shadow 무결성을 검사합니다. `check`에서는 production build **뒤에** 현재 렌더/원장 검사를 실행합니다. `quality-coordination`은 배포 스크립트를 실행하지 않고 gate 연결 자체를 검사하며, actual evidence 하네스는 build 이후 frontend check에 포함합니다.

패키징과 온라인 배포는 `check:block-product-quality -- --technical --verify-render-source`, 기본 evidence 무결성 검사, Site Shell 자동 브라우저 검사와 최종 SHA guard를 실행합니다. 사람 승인 digest, 560개 review/verification 준비상태, 물리 iOS·Android 검수는 릴리스 조건이 아닙니다.

`node scripts/check-block-quality-evidence.mjs --refresh`는 **변경 없는 결정은 보존하고 영향 범위만 pending으로 되돌린 제안 JSON**을 stdout으로 출력합니다. 소스 변경이 없는 rejected/failed는 유지하며 증거 삭제/변조·과거 기록 변조를 reset으로 숨기지 않습니다. 새/삭제된 ID도 제안 diff로 확인하고 Git에 기록해야 합니다. `--snapshot`은 초기 이행용이며 반복 갱신에 쓰지 않습니다. 어느 명령도 approved/passed를 생성하거나 원장 파일을 자동 저장하지 않습니다.

### 차수 2-D: 상태 자료와 샘플 격리

`tests/Fixtures/block-quality-states.json`의 9개 상태를 `schemas/block-quality-states.schema.json`으로 검증하고 `scripts/lib/blockQualityStates.ts`가 canonical props·기존 편집 metadata에서 결정적으로 공급합니다. 각 catalog에 적용/비적용 이유·fixture ID·공급자·시험 파일을 연결합니다. 실제 fixture/schema/provider/test 파일 누락이나 계획 상태와 현재 capability 불일치는 실패이며, 해당 파일 변화는 render/editing 증거의 재검증 원인입니다.

반응형 시험 입력은 canvas 1280/768/360과 window 1440/768/390을 구분합니다. 미디어/동적 오류는 canonical 문서를 훼손하는 대신 별도 응답 입력으로 둡니다. 동적 공급기는 지정된 G7 읽기 endpoint의 GET만 처리하고 다른 요청은 거부하며 전역 fetch를 교체하거나 실제 API로 fallback하지 않습니다.

CLI의 `state_fixtures` 수치는 적용 관계이며 실제 브라우저 실행·심사 합격 수가 아닙니다. 저장/발행은 실제 제품 E2E, 외부 데이터 연동은 별도 G7 통합 시험이 계속 필요합니다. [2-D 증거와 제한](productization/phase-2-states.md)을 참고합니다.

Worktree의 제출 준비에는 Node 24뿐 아니라 PHP 8.5·Composer 의존성과 현재 `npm run build` 결과가 필요합니다. 소스/시험 변경 후 build→변경 영향 확인→`--refresh` 제안 diff 검토/적용→shadow 및 단위시험→`task-submit` 순서입니다. 원장을 최신화한 것과 실제 화면/심사의 완료는 구분하며, 최종 제품 심사 때까지 pending을 유지합니다.

## Worktree coordination

- 모든 구현 Worktree는 깨끗한 기준 SHA, 소유 path prefix, 검증 profile을 `coord-start`로 등록합니다.
- coordination state는 Git common directory에만 저장하며 모든 worktree가 같은 active lease를 읽습니다.
- 상·하위 path prefix 중복과 `integration`, `runtime`, `migration`, `shared-contract`, `version` AREA 중복을 시작 단계에서 차단합니다.
- `task-submit`은 기준 SHA 대비 committed·staged·unstaged·untracked 파일을 검사하고 claim 밖 변경이 있으면 커밋하지 않습니다.
- frontend `task-submit`은 타입·단위시험 전에 `check:editor-acceptance`와 `check:editor-layout-parity`를 실행합니다. 기존 상호작용 증거와 함께 Puck iframe의 scoped `border-box`, 공개 출력과 같은 content-width 공식, 편집기·발행 CSS의 동일 WYSIWYG 타이포 규칙, 45종을 모두 포함하는 95개 프리셋과 공식 마켓 적용 API로 미디어까지 해소한 Page Kit 5종의 가로 overflow·좌우 content edge·대표 텍스트 computed style·줄 수 비교가 빠지면 제출을 거부합니다.
- `task-integrate`는 Local integration task만 실행하며 merge-tree 사전검사, `--no-commit` 임시 병합, profile gate를 통과한 경우에만 merge commit을 만듭니다.
- 고정 `g7pb-dev`를 사용하는 모든 Docker 품질 명령은 Local의 `integration,runtime` lease와 `TASK=`를 요구합니다.
- `integration-verify`는 다른 active/submitted task가 없는 상태에서 최신 신뢰 검증 SHA와 현재 HEAD의 실제 변경 경로를 판정합니다. 문서·조정 하네스·릴리스 오케스트레이션은 `scoped`, JS·CSS는 `frontend`, 순수 PHP 도메인·애플리케이션은 `php`, 양쪽 변경은 `mixed`, G7 Adapter는 `g7` profile을 사용합니다. migration·route/layout·module lifecycle·교차 runtime·미분류 핵심 경로, 신뢰 가능한 기준 SHA 부재 또는 `make integration-verify ... FULL=1`인 명시적 RC만 전체 `quality-gate`를 실행합니다. 동일 HEAD는 이전 검증을 재사용하며 release guard는 위험도 판정을 거치지 않은 새 HEAD만 중지합니다.
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
- `page-builder-editor-wysiwyg.css`는 Puck의 편집용 `contentEditable` DOM을 발행 HTML의 semantic typography에 연결합니다. 제목 래퍼와 내부 실제 `h1`~`h4`의 computed font family·size·weight·line-height·letter-spacing 및 줄 수가 발행본과 다르면 레이아웃 E2E가 실패하며, 사용자가 지정한 요소별 글꼴·크기·굵기·색상은 이 기본 브리지보다 우선합니다.
- 로고 목록과 안내 블록처럼 편집기 DOM이 발행 HTML과 다른 태그를 사용해 브라우저 기본 글꼴 규칙이 개입하지 않도록 제목 semantic을 `h2`로 고정합니다. Hero·CTA·섹션 preset은 같은 layout class와 typography 계약을 공유하며, 패리티 실패에는 양쪽 태그·실제 폭·최대 폭·조상 DOM 경로를 함께 출력합니다.
- Hero 편집 렌더는 제목·본문·CTA·이미지를 발행 Hero와 같은 direct grid child 순서로 유지합니다. 일반 섹션 제목은 공개 `.g7pb-section-heading`의 48rem 폭을 공유하고, contenteditable 줄 수는 Range fragment와 실제 line-box 높이 중 큰 값을 사용해 편집 DOM 특성 때문에 줄바꿈 실패를 놓치거나 오탐하지 않습니다.
- 패리티 실패 증거에는 제목의 실제 높이·scrollWidth·`white-space`·`overflow-wrap`·`word-break`·contenteditable 상태를 포함합니다. 편집 제목은 공개 제목과 동일한 일반 줄바꿈을 강제하며 Hero Slider 내부 여백과 Bar Chart 제목 폭도 공개 계산식과 공유합니다.
- 편집 iframe과 공개 미리보기의 `document.fonts.ready`가 완료된 뒤 geometry를 비교하고, 실패 증거에는 font readiness·canvas 측정폭·원문 code point를 남겨 fallback 글꼴과 숨은 공백 차이를 구분합니다.
- 블록의 `modern` 글꼴은 번들하지 않은 `Inter`·`Pretendard` 이름에 의존하지 않고 `system-ui` 우선 스택을 사용합니다. 관리자와 공개 G7 템플릿이 같은 이름의 서로 다른 font face를 제공해도 편집·발행 glyph 폭이 달라지지 않아야 합니다.
- Puck이 richtext 제목 내부에 생성하는 leaf 태그는 특정 `h1`~`h4` 형태라고 가정하지 않습니다. 실제 leaf의 기본 margin을 제거하고 wrapper의 font family·size·weight·line-height·letter-spacing을 강제 상속해 편집 캔버스에 보이는 글자 자체를 발행 제목과 맞춥니다.
- `regular` 제목은 발행본의 계산값인 400을 사용합니다. Features와 공통 섹션 제목은 편집기 전용 richtext의 680px 제한을 받지 않고 발행 CSS의 실제 가용 폭·48rem 컨테이너·line-height를 그대로 사용합니다.
- 제목 굵기를 설정하지 않은 문서는 semantic heading 기본값 700을, 사용자가 `regular`를 명시한 문서는 400을 사용합니다. 편집 wrapper가 둘을 같은 class로 축약해 사용자 선택과 기본 디자인을 섞지 못하게 합니다.
- Features 제목은 편집기와 공개본 모두 `normal` 행간을 명시해 외부 template CSS에 따라 높이가 달라지지 않게 합니다.
- 공개 블록의 semantic heading 기본 굵기와 Features 행간은 활성 G7 템플릿의 전역 `h1`~`h4` CSS로부터 격리합니다. 기본 제목은 700, 명시적 `regular`는 400으로 고정되어 shell 종류가 바뀌어도 편집기와 발행본 계산값이 같습니다.
- Logo Cloud의 소형 `h2`도 공개본에서 `1rem/1.2`를 명시해 활성 템플릿의 전역 행간이 편집기와 다른 높이를 만들지 못하게 합니다.
- FAQ·문의·지도·배너 CTA의 1열 전환은 공개본과 편집기 모두 700px에서 적용합니다. Icon List 제목의 모바일 clamp도 공개 section heading과 같아야 합니다.
- 이미지 대체 텍스트 필드는 우측 설정 라벨에 `(필수)`를 표시합니다. 누락·길이 오류는 내부 property key나 문의 번호 대신 사용자가 바로 고칠 수 있는 한국어 항목명으로 안내합니다.
- 이미지가 비어 있어도 편집 캔버스에는 점선 이미지 자리를 유지하고, 해당 자리를 직접 눌러 이미지 선택·교체·비우기를 수행한 뒤 저장·발행할 수 있어야 합니다. 우측 설정의 미디어 선택기는 동일 값을 편집하는 보조 경로로 유지합니다.
- 블록 라이브러리의 제목·리치텍스트·버튼·구분선처럼 짧은 블록은 compact 미리보기 비율을 사용하고, 이미지·Hero·복합 섹션은 regular 비율을 유지합니다. 브라우저 E2E는 compact 카드가 regular 카드보다 실제로 낮게 렌더되는지 확인합니다.
- 편집기 UI와 콘텐츠 아이콘은 `lucide-react`를 기본 세트로 사용합니다. UI 15~20px, 소셜 17px, 지표 28px, 특징 34px 단계로 구분하고, 공개 compiler도 같은 Lucide geometry의 인라인 SVG를 출력합니다. `YT`·`IG`·`◆`·`↯` 같은 문자 또는 CSS pseudo-element는 아이콘으로 인정하지 않습니다.
- 렌더 계약은 기존 문서 호환용 Split Hero를 포함해 45종을 유지하되, 신규 라이브러리의 기본 블록 탭은 중복 항목을 제외한 44종이어야 합니다. Split Hero 프리셋은 일반 Hero의 typed 분할 레이아웃으로 삽입되어야 합니다.
- 지도 이미지 모드는 빈 슬롯·업로드·대체 텍스트·외부 길찾기 링크를 함께 검사합니다. Article List의 매거진 모드는 균등 2열 reading order를 유지하고 날짜 필드는 native `date` input과 실제 `YYYY-MM-DD` 검증을 통과해야 합니다.
- 추천 효과는 입력 문서가 같으면 결과가 같아야 하며, 지원 가능한 block family 안에서 parallax·stagger·counter·chart-draw·reveal을 분산하고 같은 타입의 반복에서도 단일 효과로 고정되지 않아야 합니다.
- Puck의 `.rich-text * { white-space: pre-wrap }` 및 ProseMirror의 `font-feature-settings: "liga" 0` 기본값이 제목 안쪽 leaf에 남지 않도록 wrapper의 줄바꿈 규칙과 font shaping을 강제 상속합니다. 같은 폭·폰트에서도 편집기 글자가 16~19% 넓어져 한 줄 더 생기는 회귀를 차단합니다.

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
3. 좌측 9개 분류·신규 삽입 44종 블록·95개 프리셋·6개 Quick Add 축소 미리보기 노출, 기존 45종 렌더 호환, block 사이 실드래그 삽입, 상세 미리보기 추가·속성 편집·순서 변경
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

### WYSIWYG 검사 확대 중인 범위와 미통과 조건

`editorLayoutParity.spec.ts`는 대표 제목·외곽 폭 비교에 더해 가시 리치텍스트 필드 전체와 이미지·영상 프레임의 크기, 글꼴·굵기·행간·색상을 비교합니다. 편집 iframe과 출력 화면의 폭뿐 아니라 높이도 맞추며, 양쪽 모두 reduced motion 상태에서 안정된 geometry를 측정합니다. 애니메이션 재생 자체는 별도 효과 검사 대상입니다.

후보 번들은 선택형 `G7PB_PARITY_CANDIDATE_DIST` / `G7PB_PARITY_CANDIDATE_PUBLIC_CSS` 경로로 독립 브라우저에만 제공할 수 있습니다. 템플릿의 모듈 CSS bundle을 대체할 때는 설치된 원본과의 정확한 일치를 먼저 확인하며 실제 설치 파일을 덮어쓰지 않습니다. 기본 실행에는 후보 대체가 없습니다.

내부 항목 비교 통과를 전체 레이아웃 통과로 해석하면 안 됩니다. 전체 블록 높이·여백 비교는 현재 `output/playwright/parity-elements`의 진단 정보이고, 동적 G7 데이터 블록의 편집 샘플과 실제 데이터 동기화도 미완료입니다. 모든 슬라이드·빈 미디어·사용자 서식·저장 이후 상태, 세 뷰포트와 Page Kit 전체 검증을 끝내기 전에는 전체 WYSIWYG 품질 완료를 선언하지 않습니다.

2026-08-31 재검증에서 `service-conversion` 템플릿 출력의 SVG·`details` 구조 손실을 확인했고, compiler 0.16.0에서 내장 블록을 G7 sanitizer 안전 표식으로 전환했습니다. 브라우저 런타임은 고정 SVG 자식/속성, 정확한 HTTPS 임베드 host, 고정 폼 control과 button만 복원합니다. 95개 프리셋 compiler 단위 검사는 제거 대상 구조 태그 0을 강제하며 외부 compiler의 금지 태그는 fail-closed입니다. 정적·단위 통과를 전체 해결로 해석하지 않고 95개 프리셋과 Page Kit 5종의 세 viewport 편집→저장→reload→preview 비교 및 별도 public 검사를 다시 통과해야 합니다. 외부 Code Pack stylesheet의 `<link>` 전달은 이번 내장 카탈로그 범위 밖이며 지원으로 선언하지 않습니다.

- 필수 판정은 GitHub Actions가 아니라 로컬 `make quality-gate TASK=<integration-id>`와 동일 Docker runtime을 기준으로 합니다.
- `frontend`: Node 24, `npm ci`, frontend gate, dist artifact
- `php`: PHP 8.5, `composer install`, PHP gate
- 현재 G7 설치·TLS·인증·제품 lifecycle 전체 확인은 migration·route/layout·module lifecycle 변경 또는 명시적 RC에서만 `make integration-verify TASK=<integration-id> FULL=1`로 실행합니다. 일반 프런트·PHP·G7 Adapter 변경은 자동 선택된 해당 profile을 사용하며 무관한 coverage와 제품 E2E를 다시 실행하지 않습니다.
- Header Site Part 반응형 검증은 Puck 태블릿·모바일 viewport에서 간격·정렬·메뉴 방식 재정의와 초기화를 실제 조작하고, 하단 시트를 열어 편집 iframe·발행 화면의 바닥 정렬·전체 폭·backdrop·Escape focus 복귀까지 확인합니다. 모바일 폭에서 메뉴를 정적으로 펼쳐 보이는 것만으로 통과시키지 않습니다.
- `quality-g7`은 G7 7.0.8 고정 checkout의 autoload로 Adapter PHPStan, SQLite 통합 test, PHP coverage 하한선을 실행합니다.
- TLS·관리자 인증·실제 module route를 포함하는 `dev-product-e2e`는 로컬 통합 필수 gate입니다. 호스팅형 CI나 외부 secret은 필수조건이 아닙니다.
