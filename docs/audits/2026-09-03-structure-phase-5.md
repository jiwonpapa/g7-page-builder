# 5차 스타일·테마 개선 기록

[전체 차수](2026-09-02-structure-remediation-phases.md). **5차 A~F 구현·관련 검증·동일 기준 재감사를 완료했다.** 시작은 4차 정식 마감 `4a943279b834ee91877b489ea20d32da504857a3`, 최종 제품·감사 기준은 `3a747c68f5f6e613f9f1e4a117c4af505aa3621a`다. 문서 통합·최종 확인·NO_RELEASE 종료는 아래 실제 마감 영수증으로 연결한다. 6차는 남아 있다.

## 범위와 보존 조건

코드의 토큰 소유권·재사용·테마 전파·사용자 설정 우선권·CSS 책임 분리와 이를 확인하는 하네스를 개선한다. 기존 블록 문구·이미지·샘플·프리셋의 콘텐츠 품질 전수 평가는 하지 않는다. 합성 문서의 실제 편집·저장/재진입·미리보기·필요한 발행 흐름으로 동작을 확인한다. 배포·제품 기능 재기획·G7 Layout Editor 의존 도입은 범위가 아니다.

페이지 디자인 테마와 편집 UI 테마를 구분한다. primitive→의미 토큰→컴포넌트를 연결하며 색 값마다 이름만 붙여 부채를 숨기지 않는다. 표면의 배경·전경·보조글자·테두리를 함께 정의하고 명시한 사용자 설정을 보존한다. portal/iframe과 페이지 root 밖 Header/Footer에서도 필요한 토큰을 전달한다.

접근성 숨김·reduced-motion·외부 DOM 호환에 필요한 제한된 예외는 실제 이유와 검사로 남긴다. 제거하지 않은 예외는 해소로 계산하지 않는다. 파일 압축이나 이름만 바꾼 이동으로 크기 기준을 통과시키지 않으며 새 CSS owner는 비공백 1,000줄 이내로 제한한다.

## 시작 기준

4차 최종 감사의 제품·규칙 입력과 시작 SHA의 실제 diff가 0임을 확인해 같은 정적 결과를 재사용했다. 현재 CSS 원문은 Git checkout에서 별도로 읽어 비공백 줄과 SHA256을 기록했다. `resources/js/public/mobileNavigation.css`도 포함한다.

| 항목 | 시작 |
| --- | ---: |
| 정적 검사 제품 파일 | 356 |
| CSS 색 리터럴 | 908 |
| important / 반복 selector 진단 | 135 / 16 |
| 크기 진단 / 신규 위반 / 남겨 둔 해소 예외 | 1 / 0 / 0 |
| editor CSS 비공백 줄 | 2,405 |
| core / manager / public CSS 비공백 줄 | 592 / 832 / 920 |

## 실행 단위

각 구현은 깨끗한 기준 SHA와 정확 24파일 이하의 worktree task로 소유한다. 같은 소유 파일이 겹치는 의존 작업은 앞 단계의 통합 검증 뒤 진행한다. 하네스 정의만 변경한 단계의 수집 성공을 제품 브라우저 통과로 계산하지 않는다.

| 단위 | 책임 | 마감 증거 |
| --- | --- | --- |
| 5-A 검사 계약 | important 문자열 강제를 실제 스타일 조건으로 전환·새 CSS 경로의 scoped 검사 연결 | 제목 기본700/regular400·Features 행간·host CSS 충돌·관련 하네스/수집 검사 |
| 5-B 편집 UI | core 의미 토큰의 editor/manager/Site Part 재사용 | 경고/오류/선택/그림자의 전경·배경·테두리, portal 가독성 |
| 5-C 페이지 표면 | 편집/공개 배경·글자·보조글자·테두리 토큰 | light/dark/system·중첩 카드·명시색·iframe/미리보기 일치 |
| 5-D Site Shell | Header/Footer/메뉴의 테마 소유권 | 페이지 root 밖 출력·투명 헤더·불투명 메뉴·숨김/포커스·drawer 위치 |
| 5-E 글자 우선순위 | 기본→블록 외형→사용자 지정→Puck 입력 상속 | 실제 글자·인라인 지정·pointer 편집·보존, 대체 가능한 important/반복 selector 제거 |
| 5-F CSS 분리 | UI chrome·라이브러리·캔버스·블록 외형·글자 책임 | 새 owner 제한·순서/전파 보존·새 경로 검사 연결·크기 예외 제거 |

관련 검사를 찾지 못한 실제 범위에는 합성 코드 검사를 추가한다. 전체 콘텐츠/전체 프런트/E2E로 자동 확대하지 않는다. 같은 입력의 성공 검사는 재사용하고 실패 원인과 downstream만 다시 실행한다.

토큰 소유 파일은 기존 `page-builder-core.css`와 `page-builder-theme.css` 두 개를 유지한다. 공통 primitive는 theme에, 편집 UI 의미는 core에 두고 core가 theme를 import한다. editor의 중복 직접 import는 제거한다. 편집/공개 블록의 다른 selector를 억지로 합치지 않고 같은 표면 의미 토큰을 소비하게 한다.

5-F의 새 owner 이름은 `page-builder-editor-chrome.css`, `page-builder-editor-library.css`, `page-builder-editor-controls.css`, `page-builder-editor-canvas.css`, `page-builder-editor-blocks.css`, `page-builder-editor-catalog.css`, `page-builder-editor-appearance.css`다. 기존 `page-builder-editor.css`는 순서가 명시된 진입점으로, `page-builder-editor-wysiwyg.css`는 Puck 글자 상속 소유자로 유지한다. 실제 규칙의 순서·우선권을 검토하며 분리한다.

## 사전 코드 감사에서 확인한 항목

custom palette를 명시하지 않은 문서에서 편집기는 기본 8개 색 변수를 항상 만들지만, PHP 출력은 palette가 null이면 style을 생략한다. 현재 shared theme CSS는 기본 변수 정의 없이 이를 참조하므로 사용자 색상 1~4의 공개 출력이 달라질 수 있다. 5-C에서 공통 기본값과 합성 회귀로 처리하며 PHP 출력 형식·해시 계약 변경은 필요하지 않다. 이 항목은 5-C와 PHP 계약 batch의 실제 편집·저장·미리보기 및 compiler 검사로 마감했다.

요소 단위 사용자 색상 1~4는 실제 선택 UI와 TS 계약에 있지만 PHP `ElementAppearanceCompiler`의 허용 목록 및 editor의 해당 element class CSS에서 빠져 있다. 리치텍스트 span 색과 구분하여 PHP 입력/거부 검사와 실제 편집·미리보기 색 검사로 확인한다. PHP 계약 보완은 별도 exact2 task로 소유하고, editor 색 연결은 페이지 표면 작업에서 처리한다.

편집 UI에는 두 추가 불일치가 있다. 알림 action의 `background: currentColor`가 자기 흰 전경색을 사용하고, `--g7pb-primary`는 Manager/Site Part에서 8번 사용되지만 정의가 없다. 5-B의 상태·선택·focus 의미 토큰으로 처리한다. 두 항목은 5-B의 실제 알림·선택·portal 검사로 마감했다.

공개 CSS의 `:root`/`*`/`body` reset은 전역 asset 등록 때문에 모듈 밖 host까지 선택한다. 모듈 소유 standalone viewer와 삽입 영역을 명시해 제한하고 host sentinel의 computed style로 확인한다. 테마 root를 전역으로 확대하여 해결하지 않는다.

5-A가 명시 inline 글자 형식의 실제 보존 조건을 등록하면 기존 heading 자손의 `inherit !important`가 제품 검사에서 실패할 수 있다. 이 경우 기대값을 낮추지 않고 5-E의 원인 수정을 5-B보다 먼저 진행한다. 실행 순서 변경과 최초 실패/수정/통합 증거를 함께 남긴다.

## 제출·통합 기록

| 단위 | 현재 상태 | 근거 |
| --- | --- | --- |
| 5-A 검사 계약 | 통합 완료 | 제출 `f8e8871c604ad8dd4ba2fb0d516f25bf9b91e7ad` → 통합 `c39b43c66133e0c96d8c713cdf9c1141d8a1a751`. 정확 9파일. 19 gate 중 2실행·17재사용, 합성 desktop 4개 수집. 제품 브라우저 미실행 |
| 공유 스타일 검사 범위 | 통합 완료 | 제출 `4ec4a6b1088bcca32c12e759cc6663ab09a6df6a` → 통합 `852295077ffd44f43c467381b2f5cd09e9732ec0`. 정확 4파일, 12 gate 입력 동일 재사용. theme/UI/Shell의 합성 역할과 viewer 정적 root class 한 곳 추가만 허용하는 scoped 검사 연결 |
| modern font 소유 규칙 | 통합 완료 | 제출 `0c9800003ae5d190112e47d2a95f86ce8d4b55f5` → 통합 `499cac6818f79dd61fc2661d7f26aee5b556e8d2`. 정확 2파일, 10 gate 중 1실행·9재사용. 관련 Harness 27검사 성공. E scoped class/data 및 C standalone root의 system-ui 조건을 유지하고 dummy/조건부/미연결 규칙 거부. 제품 runtime 없음 |
| 명시 regular TS 계약 | E와 batch 통합 완료 | `cd384f2843f02c0b87e2418ca0daf212a85deed0`, 정확 4파일. 제품 허용 목록 1줄. 최종 제출 41 gate: 33실행·6재사용·runtime 2보류. 이번 제출에서 실행한 관련 Unit 31파일/271검사이며 이전 실행·재사용 수와 합산하지 않음 |
| 5-E 글자 우선순위 | 후속 포함 통합 완료 | 원본 E는 공식 active replacement로 보존, 교체 제출 `41a636b7637b368ced05eb32d6573e193aaa422b`와 TS 제출을 `d140ce6be40fb933638b8ce05784d7121c08837e`에 batch 통합. 49 gate: 14실행·35재사용. 실제 브라우저 7개(StructureTheme 4·합성 CatalogCode 2·pointer controls 1) 성공/skip 0/flaky 0. 부채 1,060→940(COLOR 893·IMPORTANT 46·SPEC 0·SIZE 1), editor 2,395줄. strong 후속 전 수치 |
| 비교표 strong 우선순위 | 통합 완료 | `3f281b2204377f0cbacf7323a52ee144c5e06be1`, 정확 8파일. 기본 파생 표식을 명시값과 분리, 일반 strong 기본 800·비교표 기본 900·명시 400/500/800. 중복 display 규칙 제거로 editor cap 2,395 유지, IMPORTANT 46→45. 최종 제출 33 gate 중 9실행·19재사용·runtime 5보류, 실제 새 Unit 6파일/68검사 성공. 원본 저장 기대 보완 재제출 `8bed7745b1edcfd8f9556e22bf119559e8b4ef69` → 통합 `f3caab8c303686306f5f3697e0aa5048ed078d08`. 최종 통합 33 gate: 7실행·26재사용, 실제 브라우저 6개(StructureTheme 4·pointer/실제 text save-publish 2) 성공. 재진입 확인, skip/flaky 0, 동일 제품 자산 재사용 |
| 5-B UI 토큰 | 통합 완료 | 최초 제출 `0dd4f10`과 두 실패를 보존, 최종 재제출 `3ac6c0aa190bee3022760b7e0fd5bd7b8418c9aa` → 통합 `6f5afcd8de8b0f11a45625e08d96d31f0e5f1134`. 정확 10파일, 16 gate 중 13실행·3재사용. 실제 브라우저 14개(테마/글자/중첩/portal 4·관리 PC/태블릿/모바일 6·pointer 1·문서 생명주기 1·공개 shell 1·Header 1) 성공, skip/flaky 0. COLOR 893→506·IMPORTANT 45→44, 신규 지문 0. |
| editor CSS family 예산 | 통합 완료 | 제출 `89467e70a01dac865a5b8375cb49bc47e0808414` → 통합 `96c1f33b2c39e4dea4003eee64e1f9f4029ba565`, 정확 4파일. 12 gate 중 1실행·11재사용. entry와 새 7 owner의 raw 합산 한도 180,000을 유지하고 미연결 owner·미분류 import·Manager selector 우회를 거부한다. source 전용 확인이며 실제 제품/browser와 전체 dist budget 성공을 뜻하지 않는다. |
| CSS 변조 fixture 소유권 | 통합 완료 | 제출 `960e1aa8e60409c7424e88fc51e9888115c41524` → 통합 `6ec16ab64e75a7aec1223e77bfb9c5e780e22d84`, 정확 2파일. 기존 CSS 변조 39개를 연결된 owner와 명시 변경 횟수로 검증한다. 관련 32검사 성공, 통합 10 gate 입력 동일 재사용. whole compatibility·제품 runtime 미실행. |
| 셸 스타일 검사 범위 보완 | 통합 완료 | 제출 `597be69d42509eed412a14240dca83321c1d5b7c` → 통합 `618f4403c30e959ca778ff5ce91438797de0a371`, 정확 3파일. public/theme/editor/responsive 각 소유 파일이 실제 Header·공개 셸·모바일 메뉴 소비자를 선택한다. 관련 Harness 97검사·6 spec/18 test 수집 성공, 통합 11 gate 동일 입력 재사용. 제품 브라우저 실행 증거와 구분한다. |
| 사용자 element tone PHP 계약 + 5-C 페이지 표면 | batch 통합 완료 | PHP `904937fcb52aa1c18d38fe1212932b48725621cf` 정확 2파일 + C `0d54603395531b9a14ab1511d2b4aae3b3de233d` 정확 8파일 → `52cd3a64a62f7d65637001637603de8c562000ef`. 34 gate 중 28실행·6재사용, 실제 브라우저 30개(Structure 4·공개 코드 12·pointer 1·Manager 2·모바일 메뉴 9·문서 생명주기 1·Header 1), skip/flaky 0. COLOR 506→429, 전체 잔여 474. PHP 합성 compiler 정상 4경로·잘못된 값/키 거부 6경로, 10검사/54단언 성공. |
| 5-D 셸 소유권 | 통합 완료 | 최초 `bec22d0`, 후속 `2c957a9`를 보존하고 최종 제출 `92b6fc5a80dbbe94a383e485f669241fe181affd` → `ae0016b26dbb70fd81d94ced100deb8af1a6ffce`. 정확 10파일. 15 gate 중 10실행·5재사용, 실제 브라우저 47개(모바일 27·공개 12·pointer 1·Structure 4·Manager 2·Header 1), skip/flaky 0. 공통 기본 규칙 14개 공유, COLOR 154·IMPORTANT 8 감소, editor 2,377줄. |
| 5-F CSS 분리 | 통합 완료 | 제출 `070569b12bd7dd64512b16779c21e5ee91caaa88` → `b7d8e9462936156fb938b734ca2708f92b44664b`. 정확 14파일. 14 gate 중 11실행·3재사용, 실제 브라우저 22개(카탈로그 코드 3·실제 글자/pointer 2·Structure 4·모바일 9·문서 생성/중첩 생명주기 2·공개 셸 1·Header 1), 실패/skip/flaky 0. COLOR 91·SIZE 1 감소. |
| F 감사 설명 보완 | 통합 완료 | 제출 `d9c09c11a8140807cc6984b9992c31a798e1ebf0` → `52883ebee691e47f47bdbc5c4477d56d5219fad5`. 정확 1파일. 색상 relocation 130개의 잘못된 일괄 이유를 실제 선언과 미해소 조건으로 수정했다. 지문·상한·규칙·소유자·IMPORTANT 이유는 동일하며, 통합 정적 2 gate는 동일 입력 재사용했다. |

PHP 최초 fixture는 잘못된 pack ID 때문에 바깥 schema 경계에서 실패했다. 이를 바로잡은 다음 원본 제품의 tone 거부 4건을 별도 재현했고 수정 후 10검사가 통과했다. 입력 작성 실패와 제품 결함 재현을 혼합하지 않고 `custom-tone-contract`에 각각 보존했다.

5-A는 CSS의 important 철자만 제거한 격리 입력에서 기존 checker의 4조건 실패를 보존한 뒤, 실행 가능한 합성 typography 등록과 실제 computed style 기대를 연결했다. 관련 Harness 최초 113검사 중 신규 planner 회귀의 4개 phase가 실제 gate명 `css`를 `stylelint`로 잘못 예상해 실패했다. 해당 기대만 수정해 4phase를 다시 확인했다. 제품 기대나 gate를 제거한 결과가 아니다. 제출 로그에 있는 격리 runner fixture의 실패/skip 문자열은 실제 제품 브라우저 결과가 아니며, 최상위 gate·수집 증거로 분리했다.

5-A 통합 뒤 typography 단일 브라우저를 처음 실행한 결과, 명시 regular 제목의 편집 wrapper가 기대 400 대신 700으로 표시되었다. `normalizeElementAppearance`가 명시 regular를 제거하여 후속 `RichTextCanvasField`가 heading-default를 추가하는 경로를 확인했다. 이 최초 실패에서는 inline 서식 기대까지 도달하지 않았다. 원본 입력·자산 재사용 지문·브라우저 결과·스크린샷을 `typography-red-first`에 보존했다. TS 정규화와 관련 Unit은 별도 task로 시작했고, 아래 기존 Unit 기대 보완을 포함한 exact4 범위로 정식 다시 소유하여 E와 함께 통합했다. 클래스 충돌을 CSS로 감추는 수정은 하지 않는다.

TS 제출에서 기존 `catalogAppearance.test.ts`의 regular 생략 기대가 발견되었다. 검사를 약화하지 않고 소유 범위를 정확 4파일로 다시 시작했다. 기존 task는 baseline 이후 커밋이 없고 본인 3파일 변경만 있음을 확인하고 원문·binary patch·index·해시·최초 실패를 `explicit-weight-contract/scope-handoff`에 보존했다. 별도 임시 index로 복원과 역적용을 검증한 후 본인 3파일만 baseline으로 복원하고 clean 상태에서 정식 release했다. 원본 worktree와 증거는 삭제하지 않았다. 새 `structure-5-explicit-weight-complete-20260903` task는 기존 3파일과 catalog Unit을 claim하고 동일 해시로 변경을 복원했다. regular 보존과 진짜 빈값 생략을 각각 검증한다.

## 5-E 보완과 검사 경계

첫 typography 제품 실패를 처리하기 위해 실제 순서는 A → E → B → C → D → F로 조정했다. E는 사용자 형식의 규칙을 family 기본값 뒤에 배치하고 Puck heading 상속을 편집 container와 직계 paragraph로 제한한다. 사용자 span까지 `inherit !important`로 덮지 않는다. 후기 첫 quote·통계 첫 value·CTA 본문·대비 본문·선택 tab 기본 selector가 새 사용자 규칙보다 강한 다섯 경로도 읽기 검토로 찾아 기본 selector를 낮췄다. 기존 비교표 `as=strong`의 무조건 bold 및 900 important는 별도 strong 후속에서 처리했다.

E 첫 제출은 architecture/planner를 통과한 뒤 `test_editor_contracts`에서 modern font의 옛 exact selector를 요구하여 실패했다. system-ui 조건을 없애거나 제품에 사용하지 않는 dummy CSS를 추가하지 않고 별도 하네스 task로 실제 연결된 class/data 규칙을 읽도록 보완했다. 원본 E 작업·최초 실패를 보존하고 필요한 기준 갱신은 정식 `task-replace-active`로 처리했다.

비교표 원본 외부 진단은 실제 소유 문서 4열을 저장한 후 UI 저장 전에 미리보기를 컴파일했다. 첫 관측에서 공개 strong 기본 900·명시 regular 400·medium 500·bold 800과 canonical 불변·소유 문서 정리를 확인했다. 편집기 앞 두 열은 iframe CSS가 로드되는 중 Times/700에서 system-ui/900으로 바뀌었으므로 안정된 기본값 증거로 쓰지 않는다. 입력을 보존하고 CSS 준비 조건을 보완하여 아래 두 번째 실행에서 재측정했다. 이 진단의 pass는 제품 굵기 계약 통과와 구분한다.

iframe CSS 준비를 기다린 두 번째 실행의 현재 진단은 편집기 wrapper/ProseMirror/paragraph 모두 900, 공개 기본 900·명시 400/500/800을 확인했다. 원본 문서 불변과 fixture 정리도 성공했다. 같은 폴더에 보존한 이전 spec까지 수집된 진단 1개는 중복 실행으로 명시하고 제품 검사 수에 합산하지 않는다. 실제 실행 config·보고서를 보존하고 외부 진단만 정확 root spec 경로로 제한했다. 보완 이후 추가 재실행은 하지 않았다.

strong 후속의 최초 Unit은 명시 regular에도 무조건 bold 클래스가 붙는 기존 경로를 재현했다. 수정 후 Native 19개를 통과했지만 정식 관련 검사에서 `puckEditorSurface`의 기존 default=bold 클래스 기대가 발견됐다. 태그·role·기본 실제 900은 유지하면서 파생 기본 클래스만 기대하도록 수정해야 하므로 정확 7파일 범위를 8파일 새 task로 다시 소유했다. 원본 delta·index·해시·최초 제출 실패를 `strong-weight-fix/scope-handoff`에 보존하며, 이전 작업·실패를 삭제하거나 테스트를 제외하지 않는다.

strong 첫 통합에서 굵기·inline·preview 기대는 통과하고, 저장 후 비교표 전체 props 기대만 빈 eyebrow/description 5값의 `""` 대 `null` 차이로 실패했다. Laravel `ConvertEmptyStringsToNull`과 API 입력 전달 경로를 확인했다. 제품을 바꾸지 않고 editor 로드 전 seed GET 원본을 callback에 전달하여 저장 후 전체 props의 exact 동등성을 검사한다. 사용자 appearance는 seed가 원fixture와 같은지 별도로 exact 확인한다. 첫 실패 당시 재진입은 아직 도달하지 않았으며 최초 브라우저 보고서·실행 spec·스크린샷 4개 등 12파일을 보존했다. 공식 재제출 `8bed7745b1edcfd8f9556e22bf119559e8b4ef69`는 원 제출 후손이며 E2E 1파일만 수정했다.

## 5-B 실제 상속 경계

첫 통합의 UI 변수 부재 기대는 첫 canvas에서 실패했다. 고정 Puck 0.23.0의 `CopyHostStyles`는 style뿐 아니라 host html/body의 속성도 iframe으로 복사하므로 `body.g7pb-editor-shell`이 편집 캔버스에도 존재했다. 처음 읽기 검토는 이 속성 복사를 놓쳤다. UI 변수의 존재만으로 페이지 색 오염이 입증되는 것은 아니지만, 페이지 root 무상속 경계를 유지하도록 실제 `.g7pb-root` 앱을 포함하는 shell body만 UI 의미를 공급한다. iframe의 floating/inline 도구와 portal은 각자 소유 root로 공급을 유지한다. 기존 typography 흐름에서 실제 글자 선택 후 native 글꼴 메뉴를 열어 UI 토큰 및 선택 옵션의 4.5 이상 대비를 확인하도록 보강했다. 기대값을 삭제하지 않고 실제 수정·재진입·알림/선택 회귀에서 확인한다.

B 재제출 뒤 두 번째 통합은 새 editor family gate에서 중지했다. core에서 editor로 옮긴 Puck bridge에 실제로 소비되지 않는 `body.g7pb-manager-shell` 선택자가 함께 남아 있었다. editor의 해당 한 줄만 제거하고 Manager의 core 의미 공급은 유지했다. 검사기와 금지 규칙을 바꾸지 않았으며 이 실패에서는 브라우저에 도달하지 않았다.

## 5-D 셸·메뉴 보완

페이지 디자인 root와 별개로 Header/Footer·메뉴에 light 및 host class/data dark 역할을 공급했다. Footer의 고정 dark와 밝은 공지의 고정 전경/배경을 보존했다. 실제 동일한 Header/Footer 기본 규칙 14개는 shared shell로 이동했으며, FullSiteCanvas에서도 이 소유 파일을 import한다. 편집기 기본값 네 곳은 공통·모바일 규칙의 우선권을 유지하도록 제한했다. 메뉴·검색·select 표면은 투명 헤더의 글자 reset에서 제외하여 불투명한 배경을 유지한다.

알림 4개와 하위 메뉴 4개의 important를 제거하고 PC 및 모바일의 실제 글자 크기·메뉴 위치·focus 복귀를 확인했다. 읽기 검토에서 페이지 appearance 기본색 네 곳이 shell 역할로 잘못 바뀐 후보를 찾아 원래 page 역할로 복원했다. 남은 미정의 page-fg 두 곳은 페이지의 page-text 역할로 연결하여 밝고 어두운 인용·breadcrumb에서 확인했다. 첫 CSS 검사에서 dark selector 철자 규칙이 실패한 기록을 보존하고 기존 허용 표기로 수정했다.

D의 실제 빌드에서 Site Part CSS는 32,801/32,000 byte, 공개 CSS는 18,376/18,000 byte였다. 이 수치는 F 전에 남은 CSS 문제이며 통과로 처리하지 않았다. 실제 합성 화면의 검사는 셸 동작과 상속을 입증하며 전체 페이지 디자인 품질 승인은 아니다.

## 검사 소유권과 별도 잔여

5-C는 사용자 팔레트를 저장하지 않은 경우의 기본 8색을 shared theme에서 공급하고, element tone custom1~4를 실제 PHP 허용 목록과 editor selector에 연결했다. 유효 문서의 Features/Pricing 카드와 명시 사용자색을 편집·저장·미리보기에서 확인했다. contrast 부모 아래 default/soft 표면 및 문의 폼의 보조글자 상속 보완은 별도 합성 CSS 조합으로 검증했다. LayoutSection이 appearance props를 지원한다는 증거로 쓰지 않는다. 공개 standalone root class는 viewer 한 곳에 추가했으며, host sentinel의 글꼴·색·margin·box-sizing은 PC/태블릿/모바일에서 유지했다. 사용자 지정색 자체의 보편적 대비 적합성을 승인한 것은 아니다.

F의 원 파일만 읽는 source byte budget과 Manager selector 금지가 분리된 owner를 놓치는 경로를 발견했다. 기존 editor family 180,000 byte 한도를 유지하면서 연결된 entry·7개 owner 전체를 읽는 별도 하네스 작업으로 처리했다. 기존 core/Manager/공개 CSS 및 dist gzip 한도를 높이지 않는다. legacy compatibility fixture의 기존 파일 직접 변조도 실제 owner와 변경 횟수를 확인하도록 보완했으며, 전체 compatibility suite를 일반 scoped 검사로 다시 끌어오지 않는다.

`f3caab8`의 실제 public effects JS는 gzipSync 29,539 byte로 기존 전체 CLI 한도 24,000보다 크다. 이번 차수의 스타일 수정과 별도로 public JS/build 입력의 기준 대비 동일성을 확인하고 6차 잔여로 기록한다. 이 한도를 높이거나 source 전용 gate가 전체 dist 한도를 검증한 것처럼 보고하지 않는다. 최종 스타일 CSS 자산의 한도는 최종 산출물에서 따로 확인한다. B 첫 실제 빌드의 Site Part CSS gzipSync는 32,293 byte로 기존 32,000 한도를 넘는다. 앞 단계 로그에도 32KB를 넘는 값이 있으므로 B만의 증가로 단정하지 않는다. CSS 중복 제거·공통 소유 정리를 마친 최종 5차 산출물에서 이 한도를 회복해야 하며 잔여 JS와 함께 녹색 처리하지 않는다.

H1의 첫 두 red fixture는 분리 파일을 포함하면 180,000 byte를 넘는 CSS와 새 owner 안 Manager selector를 원 검사기가 놓치는 점을 재현했다. 첫 green fixture는 macOS `/var`와 `/private/var` 경로 차이 때문에 CLI main이 호출되지 않아 실패했으며, 실제 경로 비교로 수정한 뒤 실패 frontend 8검사와 planner 56검사를 확인했다. 최초 실패를 삭제하거나 파일 한도를 높이지 않았다.

## 5-F CSS 소유권과 용량

최종 F 브라우저 22개가 통과했고, 실제 생성한 불투명 portal과 어두운 페이지의 스크린샷을 직접 확인했다. 이는 합성 코드 동작의 증거이며 현재 제품 전체 기능이나 콘텐츠 디자인의 완성 판정이 아니다.

편집기 원본 1,234개 CSS atom을 본문·조건·해시로 대조해 7개 소유 파일로 분리했다. 공통 geometry 등 교차 family 규칙은 31줄의 진입점에 남겼다. 새 파일은 비공백 203~526줄이며 core/theme/wysiwyg와 shared shell의 import를 유지한다. 14개의 구체적인 cascade 순서 조건을 확인했지만 이 정적 비교만으로 모든 시각 동등성을 주장하지 않는다. 실제 관련 브라우저 결과는 통합 기록으로 구분한다.

Site Part에서만 생성되는 설정 UI 13개와 persona 2개 규칙이 공개 CSS에도 들어가 있었다. 해당 15개는 editor controls 소유자로 옮겼다. Site Part의 진입점은 필요한 chrome/library/controls/canvas와 공통 자산만 import하도록 정리했다. 페이지 전용 blocks/catalog/appearance를 함께 싣지 않는다. 실제 Puck bridge·Media/Route 입력·숨김 input·thumbnail·Header preview의 연결과 ActionBar/persona 후행 규칙은 독립 읽기 검토로 확인했다.

공개 문서 compiler는 모든 block 결과를 `g7pb-document-theme`로 감싸고 theme CSS는 page-bg/text/muted/panel/border를 항상 공급한다. 이 다섯 필수 역할과 정확히 같은 기본 literal fallback 91개를 제거했다. 선택자·조건·역할값·중요도는 바꾸지 않았고 선택적/사용자색/동적 조절 변수의 fallback은 유지했다. 이 변경은 지원되는 컴파일 문서에 대한 공급 계약에 근거한다.

부채 지문 147개의 소유 파일 이동은 기존 지문과 상한을 유지한 relocation으로 기록했으며 해소량에서 제외했다. 실제 제거한 public COLOR 91건과 editor SOURCE-SIZE 1건만 줄였다. editor family의 원문 합계는 174,335/180,000 byte다. source 개별 파일 축소를 전체 전송량 감소로 대신하지 않으며, 실제 CSS gzip은 최종 빌드 해시와 결합한 별도 표로 확인한다.

## 화면 확인에서 발견한 기본 강조 글자 보완

F의 실제 어두운 화면에서 기본 indigo의 자동 THEME/CONTACT 글자가 기존 accent fill 값을 그대로 사용했다. 원래 색 #4f46e5는 기본 배경 #101620 위 2.885:1, 부드러운 배경 #192231 위 2.541:1이었다. 기존 theme 검사 첫 흐름은 본문·주소·카드만 비교하고 이 두 작은 강조 글자를 누락했다.

자동 eyebrow의 `--g7pb-theme-accent-text`를 fill과 분리하고, 기본 indigo의 dark/system-dark에서 기존 contrast-accent 역할로 연결했다. 다른 팔레트 정의·버튼 배경·사용자의 명시 tone/custom·dark CTA 우선 규칙은 유지했다. 기존 test1의 네 상태 흐름에 THEME/Contact/FIXTURE의 편집/미리보기 색·배경 일치와 4.5 이상 대비 조건을 추가했다. 새 기대값 #9ab2ff는 위 배경에서 각각 8.799:1·7.749:1이다. 전체 팔레트·사용자 지정색의 대비 승인으로 확대하지 않는다.

정확 6파일 task `structure-5-eyebrow-contrast-20260903`은 `b7d8e946`에서 시작했고 제출 SHA는 `7f50f848e85947dd7e238f5c7bcb4e5b85a52da6`다. 제출은 관련 6 gate 성공·runtime 9보류였으며, `0599f4913a2ef9fc7281dee70f2fd112c8533f74`에 통합했다. 통합 15 gate는 12실행·3재사용, 실제 브라우저 19개 성공/skip·flaky 0이며 `eyebrow-integration-summary.json`에 연결한다. root와 PHP 담당의 좁은 읽기 검토에서도 원래 명시색/CTA 우선권이 유지됨을 확인했다.

## 최종 원문 예산에서 발견한 소유권 보완

강조 글자 보완 후 첫 최종 숫자 비교(`0599f491`)에서 생성 CSS 4개는 모두 통과했지만 `page-builder-editor-wysiwyg.css` 원문은 2,173/2,000 byte였다. 생성 gzip과 원문 예산을 구분하지 않고 전체 CSS가 통과했다고 보고할 수 없으며, 이 첫 결과는 `phase5-first-final-0599f491-budget-review.json`에 보존했다.

원인 파일 마지막의 리치텍스트 블록 외형과 버튼 크기/배치 두 규칙을 원문 그대로 `editor-blocks.css`의 시작으로 옮겼다. 글자 입력의 상속·명시 굵기·설명 주석은 보존했다. 관련 variant/focus/반응형 규칙은 기존과 같이 후행 catalog/appearance에서 적용한다. 소비자는 `foundationCatalogBlocks.tsx`의 RichText/Buttons/ImageText이며, 독립 읽기 검토에서 Site Part의 실제 5종 렌더·시스템/모바일 markup에는 두 클래스가 없음을 확인했다. 단순 공백·주석 삭제나 한도 상향으로 맞추지 않았다.

정확 3파일 task `structure-5-wysiwyg-owner-20260903`의 제출 `1f2813d88d6742185943a38a10c488319ddf6646`을 최종 제품 SHA `3a747c68f5f6e613f9f1e4a117c4af505aa3621a`에 통합했다. 7 gate 중 5실행·2재사용, 실제 브라우저 5개 성공/skip·flaky 0이며 `wysiwyg-integration-summary.json`에 연결한다. 원문 1,804/2,000 byte와 최종 editor family 174,715/180,000 byte를 확인한 뒤 최종 숫자 감사를 마쳤다.

## 잔여 예외의 의미

5-F 이후 남은 COLOR 184개는 토큰화와 실제 테마 검증이 더 필요한 부채이며 품질 승인으로 바꾸지 않았다. IMPORTANT 36개는 접근성 이름 보존 6·reduced-motion 13·vendor pointer 2·runtime hidden 2·native file input 1·preview 상태 1·responsive 상태 2·표현 우선권 9로 분류했다. 기능상 역할이 있다는 사실과 그 구현에 important가 반드시 유일한 방법이라는 판단은 다르다. 표현 우선권 9개를 포함한 추가 단순화 여부는 6차 재감사의 잔여다.

CSS에서만 정의가 보이지 않는 변수 14종은 동적 TS 소유자 13종과 선택적 host font-family 1종으로 연결했고 모두 fallback이 있다. CSS import 순환과 미정의 primary/page-fg 참조가 없는지 최종 코드 목록에서도 확인했다. 이 소스 증거만으로 모든 DOM 위치의 computed style을 검증했다고 주장하지 않는다.

독립 감사에서 F의 COLOR relocation에도 owner별 reduced-motion 설명이 일괄 적용된 기록을 발견했다. 실제 color 선언 130개의 이유만 바로잡고 원 지문·상한·resolveWhen은 보존했다. 색상 이동을 접근성 필수 예외나 토큰화 완료로 오인하지 않도록 정정한 것이다.

## 최종 재감사와 마감 증거

최종 제품·감사 기준 SHA는 `3a747c68f5f6e613f9f1e4a117c4af505aa3621a`다. 동일한 구조 규칙으로 제품 363파일을 확인했으며, 신규 위반·해소 후 남겨 둔 예외·CSS import 순환은 0이다. 이전의 숫자 기준과 색상/중요도 검사 규칙을 바꾸지 않았다.

| 규칙 | 5차 시작 | 최종 | 실제 감소 |
| --- | ---: | ---: | ---: |
| CSS-COLOR | 908 | 184 | 724 |
| CSS-IMPORTANT | 135 | 36 | 99 |
| CSS-SPECIFICITY | 16 | 0 | 16 |
| SOURCE-SIZE | 1 | 0 | 1 |
| 합계 | 1,060 | 220 | 840 |

편집기 진입점은 2,405→31줄이며 새 소유 파일 최대 528줄, 검사한 모든 CSS 최대 879줄이다. 지문 147개의 이동은 감소량에 포함하지 않았다. 모든 새 소유 파일이 import와 관련 검사에 연결되어 있다.

F의 최종 실제 브라우저 22개와 자동 강조 글자 보완의 관련 브라우저 19개, WYSIWYG 소유 보완의 관련 브라우저 5개가 각각 통과했다. 이는 서로 중복될 수 있는 단계별 실행 수이며 고유 제품 기능 수로 합산하지 않는다. 각 실행의 skip/flaky/실패는 0이고 최초 실패 기록은 별도 보존했다. 편집·저장/재진입·미리보기·발행, 기본 글자/명시 서식, portal, 페이지 light/dark/system, Header와 모바일 메뉴를 변경에 관련된 합성 시나리오로 검증했다.

최종 생성 자산을 기존 성공 build receipt와 현재 소스·산출물 SHA256으로 결합했다. Build fingerprint는 `7fe09fedc20c5050e7e860ea7eb427ad2b5122c6eceaef676bbf59810c9a62f5`다. 원문 CSS 한도와 editor family 합계 한도, 아래 CSS gzip 한도는 전부 기존 숫자를 유지하여 통과했다.

| 생성 CSS | gzipSync byte | 기존 한도 | 결과 |
| --- | ---: | ---: | --- |
| manager | 7,493 | 8,000 | 통과 |
| editor | 43,871 | 45,000 | 통과 |
| site-part | 18,795 | 32,000 | 통과 |
| public | 17,987 | 18,000 | 통과 |

공개 effects JS는 `d10c1a838b7c9c5653337be2fe6205f6219c6ae79263742b1bd1a24e16e8e6fd`로 기존 기록과 동일하며 29,539/24,000 byte 초과가 남아 있다. 공개 JS 소유 소스 15개도 차수 시작 대비 동일하다. 전체 frontend budget CLI가 모두 통과했다고 표시하지 않고 6차 잔여로 명시한다. 동일 소스라도 worktree/Local 절대 경로가 달라 검사 캐시를 재사용하지 못하는 경우와 hosted CI의 인증 runtime 미구성도 별도 6차/운영 경계다.

제품 감사 뒤 변경은 이 차수 문서 두 개로 제한한다. 문서 통합 뒤 `make integration-verify TASK=structure-phase5-integration-20260903`와 `make integration-finish TASK=structure-phase5-integration-20260903 NO_RELEASE=1`의 실제 결과는 같은 증거 폴더의 `final-verification-summary.json`, `phase5-final-close.json`에 최종 SHA·종료 시각·남은 task와 함께 기록한다. 이 기록은 배포나 전체 제품 상용 완성 판정이 아니다. 6차는 별도로 남는다.

## 증거 위치

`/Users/neojins/.codex/visualizations/2026/09/02/01a05fc9-d667-79f2-99c8-6a6a8a69f73c/structure-remediation/phase5-close`

`baseline.json`에 원문 해시·기존 정적 결과의 입력 동일성·파일별 진단 분포를 남겼다. 최초 실패·수정·제출/통합 SHA·실제 runtime·최종 감사를 단계별 영수증과 함께 보존했다. 정식 마감은 최종 영수증의 확인 성공과 소유권 종료로 판정한다.
