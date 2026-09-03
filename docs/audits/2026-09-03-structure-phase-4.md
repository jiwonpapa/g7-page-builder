# 4차 PHP 컴파일러 개선 기록

[전체 차수와 완료 조건](2026-09-02-structure-remediation-phases.md). **4차 제품 구현·관련 검증·동일 기준 재감사를 완료했다.** 시작 SHA는 3차 정식 마감 `828a11963e895c980f0d7d411256c28c0a88595f`, 제품 통합 SHA는 `ae25c0dec6c8e714fff0ddd5b9c52ed5126ebf37`다. 문서 통합 뒤의 최종 확인·NO_RELEASE 정식 종료는 아래 `phase4-final-close.json` 영수증으로 확인한다.

## 범위와 보존 계약

`HtmlDocumentCompiler.php`의 속성 검증, runtime 외형, 공통 HTML 조각, 블록별 renderer, 등록 조립을 명시적 소유자로 나눈다. 원본 문서 검증·재귀 순회·진단 수집은 하나의 문서 조율 책임으로 유지한다. 새 renderer는 기존 `BlockTypeCompilerPort`를 구현하고 G7·DB·발행 상태·문서 전체·본체를 참조하지 않는다. wrapper/trait나 서비스 묶음으로 큰 본체를 감추지 않는다.

기존 HTML 바이트·공백·태그와 attribute 순서·출력 해시, URL/리치텍스트/escaping 정책, 검증 순서·진단 코드·문구, caller의 compiler 주입 우선권, 마지막 정상 발행본을 보존한다. 공개 constructor와 `COMPILER_VERSION`·`TARGET_ENGINE_VERSION`은 유지한다. 버전 상수는 기존 release 하네스가 읽는 본체에 둔다.

블록 콘텐츠의 문구·이미지·프리셋 상품성 전수 검사는 포함하지 않는다. 합성 입력의 정상/비정상 동작과 출력 계약을 확인한다. 기존 전수 프리셋 검사는 삭제하거나 skip하지 않고 별도 content group으로 보존하며 이 차수의 scoped 코드 검증에서만 제외한다. 운영 배포·G7 Layout Editor 의존·5차 스타일 수정은 범위가 아니다.

## 시작 기준

| 항목 | 시작 |
| --- | ---: |
| 컴파일러 본체 비공백 줄 | 2,504 |
| 본체의 leaf renderer | 45 |
| 전체 제품 소스 정적 검사 파일 | 302 |
| 정적 부채 / 크기 진단 | 1,061 / 2 |
| 신규 위반 / 남은 해소 예외 | 0 / 0 |
| 기존 본체 Xdebug line coverage 하한 | 87% |

구조 기준은 3차 최종 감사 `cbe955a6`에서 시작 SHA까지 실제 diff가 감사 문서 두 파일뿐임을 확인해 재사용했다. 제품·정적 정책 입력이 같은 검사를 반복 실행하지 않았다. 본체는 시작 Git 소스에서 별도로 읽어 비공백 줄과 SHA256을 기록했다. `baseline.json`에 재사용한 보고서·해시·delta와 측정값이 있다.

## 실행 단위

모든 새 compiler 소유자는 `src/Application/Compilation/HtmlDocument/` 아래에 두며 renderer는 그 아래 `Blocks/`에 둔다. 정확 파일 24개 이하의 task와 clean worktree를 사용한다. 제품 단위는 앞 단위 통합 뒤 다음을 시작하며 독립 계약 회귀와 하네스는 겹치지 않는 범위에서 준비한다.

| 단위 | 소유 책임 | 검증 초점 |
| --- | --- | --- |
| 선행 H | compiler family coverage·scoped PHP 선택·browser 매핑 | 새 owner 누락 거부·87% 합산·본체87%·기존 full 기준 보존·콘텐츠 전수 선택 방지 |
| 선행 계약 | constructor/registry·재귀 상태·예외 순서의 합성 회귀 | 사전 등록 우선권·중첩 anchor/Hero·스타일 순서·실패 후 재사용 |
| 4-A | BlockPropertyReader·BlockRuntimeCompiler·BuiltInBlockTypes | 원문/길이/숫자/map 판정·motion/visibility/responsive 순서·고정 해시 |
| 4-B | Heading/RichText/Image/Buttons/ImageText/IconList 6종과 Appearance/Markup/Icon/Escaper | 기존 Port로 독립 렌더·공통 조각 단일 소유·HTML 동등성 |
| 4-C | Hero/HeroSplit/HeroSlider/Features/Cta/Contact 6종 | 비슷한 renderer의 서로 다른 검증/리치텍스트 순서 보존 |
| 4-D | LogoCloud/Stats/Pricing/Team/Gallery/BarChart/LogoCarousel/TestimonialSlider/EventSchedule/DownloadResources 10종 | 목록·숫자·이미지·슬라이더·다운로드의 출력/거부 계약 |
| 4-E | Divider/Blockquote/Notice/CardGrid/Breadcrumbs/AnchorMenu/SocialLinks/ImageCarousel 8종 | plain/rich text·내비게이션 URL·빈 값·항목 순서 |
| 4-F | Testimonials/FaqAccordion/ProcessTimeline/Tabs/ComparisonTable/ArticleList/VideoEmbed 7종 | typed interactive placeholder·리치텍스트·embed allowlist |
| 4-G | G7RecentPosts/G7ProductGrid/InquiryForm/MapDirections/G7BoardArchive/G7ProductShowcase/G7PostDetail/G7ProductDetail 8종 | 공개 capability placeholder·폼/지도 URL·slug 치환, G7 직접 의존 없음 |
| 4-마감 | BuiltInBlockCompilers·TemplateMarkupPolicy와 본체 문서 조율 | 등록 우선권·검증/예외 순서·중첩/진단 상태·최종 크기 예외 제거 |

기존 관련 회귀가 보호하는 renderer마다 구현을 복사한 테스트를 추가하지 않는다. 실제 누락된 계약이나 실패가 확인되면 해당 입력을 보완한다. 기존 합성 문서 9개와 layout 1개의 고정 출력 해시는 변경하지 않으며 실제 artifact를 다시 해시한 값과 반환 metadata도 연결해 확인한다.

## 중요한 호출 순서

본체는 UUID → envelope → layout 분기/leaf slots → registry → Hero/anchor 진단 → 외부 style URL 수집 → schema → renderer → slug 치환 → element appearance → template 호환 검사 → block runtime 순서를 유지한다. 외부 style URL 수집과 runtime 처리는 원래의 try/catch 밖에 있으며, schema/renderer의 일반 Throwable만 `G7PB_BLOCK_RUNTIME_FAILED`로 변환한다. 기존 DocumentCompileException은 그대로 전달한다.

스타일 URL은 첫 등장 순서로 중복을 제거한다. Columns는 입력 map 순서가 아니라 column1부터 N까지 순회하고 누락 슬롯은 빈 배열로 읽는다. anchor·Hero·스타일 상태는 compile 호출마다 새로 시작한다. Reader는 빈 값 판정에만 trim을 쓰고 반환 원문을 바꾸지 않으며 optionalMap의 기존 배열 허용을 유지한다. runtime은 responsive → motion → visibility → root attribute 순서와 tablet → mobile 및 원 입력키 순서를 유지한다.

## 검증과 증거 경계

기존 coverage checker는 본체 하나만 87%로 검사하고 scoped PHP에는 coverage gate가 없었다. 선행 H에서 본체 자체 87%와 본체/추출 소유자 전체 실행문을 합산한 87%를 함께 요구한다. 각 파일의 퍼센트를 평균 내지 않으며 누락·중복·잘못된 수치나 경로로 분모를 줄이지 않는다. 기존 전체 project 61%·service 96%·repository 91%는 보존한다.

필수 coverage는 PHP 8.5/Xdebug 결과로 확인한다. 호스트의 PCOV 존재를 Xdebug 실행 증거로 대신하지 않는다. worktree 제출의 runtime 보류, 실제 Local 실행, hosted CI의 환경 제약을 구분한다. PHPStan level 8·변경 PHP Pint·정적 구조·관련 Unit/Integration·필요한 합성 browser를 같은 scoped 계획으로 연결한다.

## 실행 기록

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 시작 소유권 | 확보 | `structure-phase4-integration-20260903`, integration/runtime 독점. README 소개 작업은 범위 밖으로 보존 |
| 감사 문서 | 마감 기록 참조 | `structure-phase4-ledger-20260903`, 정확 두 문서. 문서 통합·종료 SHA는 최종 영수증에 기록 |
| 선행 H | 통합 완료 | 제출 `8569d4c`, 통합 `d7bcda2`; 16 gate 재사용, 실제 Xdebug gate 통과 |
| 선행 계약 | 통합 완료 | 제출 `e2bc147`, 통합 `f1cac192`; 12 tests / 145 assertions, 합성 Unit 한 파일 |
| 전수 검사 구분 | 통합 완료 | `structure-4-store-scope-20260903`: 제출 `123a53b`, 통합 `60aedb8`; 나머지 8 tests / 472 assertions 통과 |
| 4-A | 통합 완료 | 제출 `d0e479d`, 통합 `0ad5bf5`; 본체 2,504→2,075줄, 정확 7파일 |
| 4-B | 통합 완료 | 제출 `673b901`, 통합 `137fd44`; 기본 renderer 6개, 본체 1,796줄, 정확 14파일 |
| 4-C | 통합 완료 | 제출 `3f1ea57`, 통합 `4003002`; 마케팅 renderer 6개, 본체 1,504줄, 정확 9파일 |
| 4-D | 통합 완료 | 제출 `3c47be9`, 통합 `8a1e7fb`; 데이터 renderer 10개, 본체 1,119줄, 정확 13파일 |
| 4-E | 통합 완료 | 제출 `392129e`, 통합 `dfa2276`; 탐색 renderer 8개, 본체 897줄, 정확 11파일 |
| 4-F | 통합 완료 | 제출 `1b94dae`, 통합 `30fc1ce`; interactive renderer 7개, 본체 636줄, 크기 예외 제거, 정확 10파일 |
| 4-G | 통합 완료 | 제출 `6e4c3f0`, 통합 `28c592c`; capability renderer 8개, 본체 409줄, 총 45종 독립 Port, 정확 10파일 |
| 4-마감 제품 | 통합 완료 | 제출 `68e4ca3`, 통합 `ae25c0d`; 본체 297줄·등록 119줄·템플릿 23줄, 정확 4파일 |

## 증거 위치

`/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/structure-remediation/phase4-close`

각 작업의 첫 명령·입력 SHA·실패·수정 결과를 분리해 보존한다. 구조 검사 통과, 코드 동작, 실제 브라우저, 배포는 각각의 증거로만 판정하며 차수 전체 완료는 최종 검증·정식 종료 후 기록한다.

### 선행 계약 결과

공개 constructor의 모든 주입 인자, 기존 registry의 등록 우선권, 외부 팩 스타일의 첫 등장 순서와 중복 제거, 중첩 anchor 경로, schema/runtime 예외 변환과 기존 예외 보존, 실패 후 같은 compiler 인스턴스 재사용을 합성 입력으로 확인했다. 최초 fixture가 v2의 외부 블록/부모 제한에 맞지 않아 실패한 기록은 보존했으며, 정책을 우회하지 않고 실제 허용 구조로 fixture를 수정했다. 이 실패를 제품 결함으로 집계하지 않는다. `contracts-summary.json`과 `contracts/summary.json`에 제출·통합 실행을 구분했다.

### 추출 비교 기준

원본 SHA의 PHP 토큰을 PHP 8.5.3 `token_get_all(TOKEN_PARSE)`로 읽어 renderer 45개, helper 31개, 조율 메서드 7개와 상수 53개를 `extraction-audit/`에 기록했다. 공백·주석만 제거한 본문/문자열 토큰 및 원본/도구 해시를 보존했다. 이 자료는 최종 이동 동등성 검토용이며 제품 실행 증거를 대신하지 않는다.

### 선행 H 결과

Clover에서 새 실행 owner가 빠지거나 잘못된 수치·중복을 전달해 분모를 줄이는 경우를 거부하도록 보완했다. 상수 전용 파일은 실행문 0을 추측하지 않고 PHP 토큰으로 제한된 상수 선언 형태를 확인하며 결과에 따로 표시한다. 본체와 전체 family의 각각 87%를 요구하고 기존 전체 검사 하한은 유지한다. scoped 계획은 실제 영향받는 PHP 계약을 한 Xdebug 실행에 모으며, compiler의 브라우저는 기존 합성 발행·중첩·구조/테마 시나리오를 선택한다.

최초 synthetic 회귀 중 coverage 7개 실패는 macOS `/var`→`/private/var` 정규 경로 처리 차이였다. 실제 root 내부 파일의 realpath로 제한해 수정했고 11개 coverage 회귀를 통과했다. 제출 전 자체 입력 감사에서 회귀가 읽는 `Makefile`/CI 입력 누락도 보완했다. 첫 결과와 재개 결과는 `harness/`에 보존하며 제품 실패와 구분한다.

통합에서 PHP 8.5.9/Xdebug 3.5.3으로 compiler Unit 64개·403 assertions를 실행했다. 본체 및 family는 1,467/1,676 실행문, 87.53%다. coverage 원본과 입력·해시는 `coverage-baseline/`에 보존했다. hosted CI의 Xdebug 설정 연결은 코드/하네스 검증이며 실제 hosted 실행 성공으로 표현하지 않는다.

### Store 전수 검사 구분

`OfficialStoreContractTest::test_page_kit_archives_round_trip_and_compile_every_bundled_document`에만 `content-catalog` 그룹을 지정했다. import와 annotation 두 줄 외 함수 본문·다른 계약은 바뀌지 않았다. PHPUnit 수집 기준 전체 9개는 유지되고 scoped 코드 검증에서는 해당 1개만 제외한다. `store-scope/selection-summary.json`에 수집 목록·명령·비교를 남겼다. 콘텐츠 전수를 실행하지 않는 것과 코드 검증을 생략하는 것을 구분한다.

### 4-A 속성·runtime 소유권

`BlockPropertyReader`는 속성의 문자열/수/참·거짓/map·허용 키와 리치텍스트 길이·오류 문구를 소유한다. `BlockRuntimeCompiler`는 기존 responsive/motion/visibility 적용과 markup root 검사를 소유하고, `BuiltInBlockTypes`는 기존 타입 ID 48개를 보존한다. 본체에 같은 이름의 전달 래퍼를 남기지 않고 해당 객체를 직접 호출한다. 본체 2,075줄, Reader 220줄, Runtime 187줄, Types 53줄이며 기존 크기 상한만 실제 값으로 낮췄다.

첫 Unit 76개/578 assertions와 제출의 구조·Pint·PHPStan 검사가 통과했다. 기존 기대 해시 10개는 바꾸지 않았고 실제 HTML 재해시·반환 metadata·경고를 함께 검사한다. 4-A는 아직 renderer 분리 완료가 아니며 나머지 단위를 같은 차수에서 계속한다.

4-A 통합은 관련 PHP 187 tests/2,093 assertions, 본체 89.44%(1,305/1,459)·family 88.21%(1,482/1,680), 실제 브라우저 5개(skip/flaky 0)가 통과했다. assets는 입력 일치로 재사용했다. 실행·원본 Clover·브라우저 verdict는 `4a-summary.json`과 `4a/`에 보존했다.

4-A 별도 토큰 감사는 원본 renderer 45개와 helper 31개의 정확한 이동 mapping으로 본문·서명·접근제어·상수 값을 대조했다. 지정 receiver/constant owner 치환 외 차이는 0이며 상수 53개도 보존됐다. 이 단계의 renderer는 아직 본체에 있으므로 추출 renderer 0으로 기록했다. `extraction-audit/renderer-comparison/phase4a-first/report.json`은 추가 메서드·constructor 조립·registry 도달성까지 증명하지 않으며 그 부분은 별도 리뷰/계약 테스트로 확인한다.

### 4-B 기본 renderer와 공통 HTML

Heading·RichText·Image·Buttons·ImageText·IconList 6개는 기존 `BlockTypeCompilerPort`의 `key()`/`compile(props)`를 구현한다. 문서 본체·registry·발행 상태를 주입하지 않으며 필요한 공통 객체만 받는다. Appearance 1메서드, Markup 5메서드, Icon 1메서드·상수 2개, Escaper 3메서드는 각 소유자로 옮겼다. 같은 속성/URL/richtext 인스턴스를 공유하고 Runtime의 임시 escaping 중복도 제거했다. 등록은 사전 존재 여부 확인을 유지한 39 callback+6 Port 과도 단계다.

첫 Pint는 추출 후 공백·줄바꿈 형식을 지적했고 해당 정리 후 통과했다. 본문 변경으로 보완한 제품 실패는 없었다. 관련 Unit 76/578, 정식 source/static 4 gate, 통합 PHP 187/2,093과 실제 브라우저 5개(skip/flaky 0)를 통과했다. 본체 89.98%(1,167/1,297)·family 88.34%(1,500/1,698)이며 source/static 성공 4개와 프런트 assets는 입력 일치로 재사용했다. `4b-summary.json`·`4b/`에 원본 로그·Clover·브라우저 verdict가 있다.

제출 SHA를 대상으로 한 두 번째 token 감사도 76 mapped body·서명·상수 53개의 동등성을 확인했다. 새 6 renderer의 접근제어·Port도 확인했고 추출 6/잔류 39를 구분했다. source-measurements의 12개 제품 입력 해시는 제출 파일과 일치했다. `extraction-audit/renderer-comparison/phase4b-first/report.json`에 mapping과 도구·입력 해시를 남겼다.

### 4-C 마케팅 renderer

Hero·HeroSplit·HeroSlider·Features·Cta·Contact 6종을 독립 Port로 옮겨 총 12종을 분리했다. 본체는 1,796→1,504줄, 새 파일은 57~101줄이다. Hero의 split 표현과 독립 HeroSplit을 합치지 않고 각 길이·richtext 판정·이미지 검증·공개 type을 보존했다. Features에 없던 키 검증, Contact의 URL/이메일 순서, Slider의 기본값·이미지 loading 순서를 변경하지 않았다.

초기 추출 스크립트의 치환/JSON 키 오류 2개는 작업 도구 실패로 별도 보존했다. 제품 관련 Unit 76/578과 정식 source/static 4 gate는 최초 통과했으며 고정 해시는 변경하지 않았다. `4c-marketing-renderers/`에 최초 입력·출력·정식 제출을 보존했다.

4-C 통합 PHP 187/2,093, 본체 89.74%(962/1,072)·family 88.42%(1,512/1,710), 실제 브라우저 5개(skip/flaky 0)가 통과했다. `4c-summary.json`과 원본 `4c/`에 보존했다.

### 4-D 목록·가격·데이터 renderer

LogoCloud·Stats·Pricing·Team·Gallery·BarChart·LogoCarousel·TestimonialSlider·EventSchedule·DownloadResources 10종을 옮겼다. 각 owner는 58~83줄이며 본체 1,504→1,119줄, 총 22 renderer가 독립 Port다. Stats의 문자열 값과 로컬 icon 4종, Pricing의 URL→feature 검증 순서, Gallery의 숫자/레이아웃 판정, BarChart 숫자 출력, Slider 간격·EventSchedule의 기존 날짜 문자열 판정을 보존했다. 필요한 직접 의존만 주입하며 Gallery에는 URL/richtext 객체를 추가하지 않았다.

제품·추출 도구 실패 없이 기존 Unit 76/578과 정식 source/static 4 gate가 통과했다. `4d-data-renderers/`에 시작 원문·본문 hash·제품 파일 hash·최초 Unit/제출을 보존했다.

4-D 통합 PHP 187/2,093, 본체 90.31%(699/774)·family 88.55%(1,532/1,730), 실제 브라우저 5개(skip/flaky 0)가 통과했다. `4d-summary.json`과 `4d/`에 원본 실행·Clover·브라우저 결과를 보존했다.

### 4-E 탐색·안내 renderer

Divider·Blockquote·Notice·CardGrid·Breadcrumbs·AnchorMenu·SocialLinks·ImageCarousel 8종을 분리했다. 본체 1,119→897줄, 새 owner 36~72줄이며 총 30 Port+15 잔류 callback이다. 일반 URL과 페이지/HTTPS 전용 정책의 차이, anchor 문법, 누락 layout의 class 생략, critical Notice의 alert, carousel 이미지 loading·interval·bool 판정을 그대로 유지했다. helper API·공개 생성자·등록 순서는 바뀌지 않았다.

첫 Pint의 본체 공백/정렬 지적만 정리했으며 제품 Unit 76/578과 정식 정적 gate 4개는 통과했다. `4e/`의 입력 hash·method mapping·최초 로그에 구분해 보존했다.

4-E 통합 PHP 187/2,093, 본체 91.42%(554/606)·family 88.66%(1,548/1,746), 실제 브라우저 5개(skip/flaky 0)가 통과했다. `4e-summary.json`과 `4e/`에 보존했다.

### 4-F 탭·FAQ·미디어 renderer

Testimonials·FaqAccordion·ProcessTimeline·Tabs·ComparisonTable·ArticleList·VideoEmbed 7종을 분리했다. 본체 897→636줄, 새 owner 47~74줄이며 37 Port+8 잔류 callback이다. 컴파일러 본체가 800줄 기준을 충족해 `SOURCE-SIZE` 예외를 제거했다. 남은 CSS 예외는 수정하지 않았다. typed placeholder, 리치텍스트·동영상 URL 검증, 태그·attribute·문자열 순서를 보존했다.

관련 Unit 76/578과 정식 정적 gate 4개가 통과했다. `4f/`에 제출 로그·method mapping·입력 hash를 보존했다. 통합 PHP 187/2,093, 본체 94.04%(379/403)·family 88.75%(1,562/1,760), 실제 브라우저 5개(skip/flaky 0)가 통과했다. `4f-summary.json`과 원본 Clover·browser verdict를 함께 보존했다.

### 4-G 공개 데이터·문의·지도 renderer

G7RecentPosts·G7ProductGrid·InquiryForm·MapDirections·G7BoardArchive·G7ProductShowcase·G7PostDetail·G7ProductDetail 8종을 분리했다. 본체 636→409줄, 새 owner 45~73줄이며 총 45종 모두 독립 Port다. 문서가 임의 endpoint를 소유하게 하지 않고 기존 고정 공개 API·정적 placeholder만 출력한다. 게시판/상품의 서로 다른 pageSize 기본값, 누락과 명시 null의 판정, slug/ID/경로 검사, 지도 좌표·zoom·URL의 검증 순서, 폼의 slug 치환을 보존했다.

첫 제출의 Pint import 순서 실패는 두 import의 정렬만 고쳐 마감했다. 함수 본문·연산자는 바뀌지 않았으며 최초 로그와 `pint-only.diff`를 `4g-capability-renderers/`에 보존했다. Unit 76/578, 제출 정적 3 gate 통과·runtime 4개 보류 뒤 정식 통합에서 PHP 187/2,093, 본체 94.91%(205/216)·family 88.85%(1,578/1,776), 브라우저 5개(skip/flaky 0)가 통과했다. `4g-summary.json`과 원본 실행·coverage·browser 자료를 보존했다.

## 동일 기준 최종 재감사

최종 제출 `68e4ca3ec2306203a62876dddf6133b705630867`의 깨끗한 worktree와 Git 소스를 대상으로 전체 정적 검사와 owner graph를 각각 한 번 실행했다. 제품 통합 `ae25c0d`와 제출 SHA의 Git tree diff가 0임을 확인했다. 시작 `828a119`와 헌법·정적 규칙·검사기·package/lock 입력이 동일하며, 기존 부채 장부는 컴파일러의 크기 예외 하나만 제거했다. 남은 예외의 내용·상한·지문은 바꾸지 않았다.

| 항목 | 시작 | 최종 |
| --- | ---: | ---: |
| 본체 비공백 줄 | 2,504 | 297 |
| 본체 내부 leaf renderer / 독립 Port renderer | 45 / 0 | 0 / 45 |
| 컴파일러 책임 소유 파일 | 1 | 55 |
| compiler family 최대 비공백 줄 | 2,504 | 297 |
| 전체 제품 소스 정적 검사 파일 | 302 | 356 |
| 전체 정적 부채 | 1,061 | 1,060 |
| 크기 진단 / 실제 파일 | 2 / 2 | 1 / 1 |
| 신규 위반 / 남겨 둔 해소 예외 | 0 / 0 | 0 / 0 |

45종 renderer는 각각 31~101줄이다. 공통 owner는 속성 220줄·runtime 186줄·등록 119줄·아이콘 63줄·마크업 59줄·타입 53줄·외형 52줄·템플릿 23줄·escaping 17줄이며 전부 기본 800줄 제한 이내다. 파일 이동을 위해 제한을 늘리거나 새 예외를 만들지 않았다.

정확한 55파일 inventory와 PHP import·property type·static owner 참조의 family graph에서 238개 내부 연결, 순환 0·본체 역참조 0·renderer의 문서/registry 소유 0을 확인했다. 기존 Port를 사용하고 별도 서비스 묶음·본체 wrapper를 만들지 않았다. 이 판정은 해당 family의 정적 소스 그래프이며 전체 제품의 동적 실행 증명으로 확대하지 않는다.

최종 token 감사는 같은 PHP 8.5.3 parser와 변경하지 않은 비교기로 renderer 45개·helper 31개 및 상수 53개를 대조했다. 승인된 정확 receiver/constant owner 치환 후 ordered body 차이는 0이다. 각 renderer의 실제 FQCN·공개 nonstatic 서명·기존 Port와 helper 서명도 일치한다. 기대 문자열·검증·배열·호출 순서를 임의 정규화해 차이를 숨기지 않았다. 최초 실행 결과·원문·mapping·해시는 `extraction-audit/renderer-comparison/final-first/`에 있다.

별도 조립 리뷰는 공개 생성자 8인자와 공개 메서드/상수, 45개 key·등록 순서·클래스 연결·인수 순서, caller 사전 등록 우선권, URL/RichText 등의 동일 인스턴스, 문서 순회·진단·try/catch·template 검사 두 위치를 확인했다. renderer 생성자는 의존 저장만 수행한다. `final-composition-review.json`에 근거와 한계를 남겼으며 G7·Laravel·DB·발행 상태의 새 의존이나 차단 결함은 발견하지 않았다.

최종 제품 작업은 등록 조립을 `BuiltInBlockCompilers`, 템플릿 검사만 `TemplateMarkupPolicy`로 옮겼다. `CallbackBlockTypeCompiler`의 기존 외부 사용 계약은 삭제하지 않았고 본체의 불필요한 fallback만 제거했다. 사전 Pint와 Unit 76/578 및 정식 제출 정적 3 gate는 최초 통과했다. 정식 통합은 관련 PHP 187/2,093, 본체 93.49%(158/169)·family 88.91%(1,588/1,786), 실제 브라우저 5개(skip/flaky 0)가 통과했다. `final-product-integration-summary.json`과 `final-product/`에 원본 증거를 연결했다.

`phase4-final-architecture-68e4ca3.json`, `phase4-final-static-comparison.json`, `phase4-final-owner-graph-68e4ca3.json`에 입력·도구·결과 해시와 실제 수치를 보존했다. 정적 결과의 최초 후처리에서 존재하지 않는 규칙 파일 경로를 지정한 작업 도구 오류는 실제 `config/design-architecture.json`으로 교정했다. 성공한 정적/graph 검사를 반복 실행하지 않았고 이 교정은 후처리 기록에 구분했다.

잔여 1,060건은 CSS 색 908·important 135·specificity 16과 편집기 CSS 크기 1건이다. 5차 스타일·테마 및 6차 종합 재감사는 남아 있으며, 이 차수 완료를 기존 블록 콘텐츠 품질 승인이나 Visual UI Editor 전체 완성으로 표현하지 않는다.

## 정식 마감 증거

제품 통합과 재감사 이후 이 문서와 전체 차수 문서만 별도 소유 task로 제출·통합한다. 모든 제출분 통합 뒤 `make integration-verify TASK=structure-phase4-integration-20260903`으로 최종 확인하고 `make integration-finish TASK=structure-phase4-integration-20260903 NO_RELEASE=1`로 소유권을 종료한다. 동일 입력의 성공 정적 검사는 재사용하며 runtime은 하네스 정책에 따라 검사한다. 단위별 반복 실행을 서로 다른 시나리오 개수로 합산하지 않는다.

최종 SHA를 문서에 다시 써 검증 입력을 바꾸지 않도록, 문서 통합 SHA·최종 검증·제품 감사 이후의 문서 전용 diff·정식 종료 이력·clean 상태는 증거 폴더의 `phase4-final-close.json`에 기록한다. 그 영수증의 검증 및 종료 성공이 차수 전체 마감 근거다. 기존 실패와 원본 제출 이력은 보존하며 README 작업의 파일·소유권은 변경하지 않는다. 배포·release 검증 SHA 승격은 수행하지 않는다.
