# 편집 정책 보고서 — 출처와 증거 원장

확인일: **2026-09-07**. [현행 편집 정책](editing-policy.md)의 조사 근거다. 경쟁 제품 4종의 공식 문서 20개, Puck 5개, CSS/UI 도구 5개, W3C 1개로 **총 31개 공식 출처**를 검토했다. 페이지에 표시된 갱신일은 기능 출시일이나 모든 설치 환경의 적용일과 같지 않다.

<!-- editor-reference:editor-maturity-20260907 -->

현행 실행 순서는 [editor-plan.md](editor-plan.md), 상태는 [editor-progress.md](editor-progress.md)를 따른다. 이 파일은 조사 시점의 근거이며 기능 완료 원장이 아니다.

## 증거의 사용 원칙

- 경쟁 제품의 확인 사실은 아래 공식 문서의 설명 범위다. 유료 계정에 접속해 직접 조작한 비교 시험은 아니다.
- 현재 G7 상태는 지정한 Git 기준의 소스·계약으로 확인했다. 과거 실행 기록은 당시 결과로 구분한다. 이번에 새 제품 브라우저 검증을 수행했다는 뜻이 아니다.
- 4개 삽입 분류, 기본 요소 8종, 대표 슬롯과 구현 순서는 **G7 설계 제안**이다. 경쟁 제품이 그 숫자나 순서를 표준으로 요구한다는 주장이 아니다.
- 공식 문서의 서로 다른 버전·역할·편집 모드를 합쳐 하나의 제품 기능처럼 취급하지 않는다. 로드맵/미래 기능은 현재 제공 근거로 사용하지 않는다.

## Webflow

| ID·공식 문서 | 표시 날짜 | 확인한 사실 | 적용과 해석 한계 |
|---|---|---|---|
| W1 [The Add panel](https://help.webflow.com/hc/en-us/articles/33961270096659-The-Add-panel) | 갱신 2025-06-27 | 요소 분류, 클릭/드래그 삽입, 캔버스/Navigator의 위치 지정 | 분류와 문맥 삽입의 근거. Webflow의 목록을 G7의 최적 목록으로 복제하지 않음 |
| W2 [Components overview](https://help.webflow.com/hc/en-us/articles/33961303934611-Components-overview) | 갱신 2026-09-02 | 원본 구조와 인스턴스 props·slots·variants 구분, 원본 변경의 공유 영향 | 노출 옵션/영향 구분을 도입. 원본 제작기나 동기화 엔진을 G7에 즉시 추가한다는 뜻이 아님 |
| W3 [Slots](https://help.webflow.com/hc/en-us/articles/33961195339923-Slots) | 갱신 2026-08-28 | 이름 있는 삽입 영역, 슬롯별 허용 컴포넌트, 제약 변경/삭제의 영향 | 허용목록의 역할 범위는 문서상 Marketer에 관한 설명. 모든 역할의 강제 제한으로 확대하지 않음 |
| W4 [Text block](https://help.webflow.com/hc/en-us/articles/33961346059027-Text-block) | 갱신 2026-05-19 | 캔버스에서 텍스트를 직접 편집하고 의미에 맞는 텍스트 요소를 사용 | 직접 입력의 근거. 텍스트 편집과 부모 구조 변경은 별개 |
| W5 [Variables](https://help.webflow.com/hc/en-us/articles/33961268146323-Variables) | 갱신 2026-03-26 | 색·크기·글꼴 등 공통 변수와 연결/변경, 반응형 모드 | 토큰과 override 표시의 근거. 기존 G7 기기별 상속을 Webflow 방식으로 교체하지 않음 |

## Framer

| ID·공식 문서 | 표시 날짜 | 확인한 사실 | 적용과 해석 한계 |
|---|---|---|---|
| F1 [Insert Panel](https://www.framer.com/dictionary/insert-panel) | 날짜 미표시 | elements·components·sections·assets를 삽입 대상으로 설명 | 공식 사전의 개념 구분이다. 현행 UI의 정확한 탭 4개를 실측한 결과가 아님 |
| F2 [Intro to components in Framer](https://www.framer.com/academy/lessons/framer-fundamentals-components) | 과정 2025-04-06 | 컴포넌트/변형과 인스턴스, 노출 variables, 원본 변경의 영향 | 과정에 2026-06-16 UI 변경 전 영상이라는 안내가 있음. 현재 화면 배치의 증거로 사용하지 않음 |
| F3 [Unlinking components](https://www.framer.com/help/articles/unlink-components/) | 갱신 2026-08-07 | 외부 연결 컴포넌트를 로컬 컴포넌트로 복사하고 인스턴스를 교체 | 외부 연결 해제다. 모든 요소를 자유 트리로 해체하는 Webflow detach와 동일시하지 않음 |
| F4 [Using text styles](https://www.framer.com/help/articles/how-to-use-text-styles/) | 갱신 2026-08-07 | 재사용 타이포그래피, 기기별 설정과 일부 개별 변경 | 공통값/개별값 UX 근거. 무제한 스타일을 노출해야 한다는 근거가 아님 |
| F5 [Using layout templates](https://www.framer.com/help/articles/using-layout-templates/) | 갱신 2026-08-07 | 공통 header/footer와 페이지 content slot, template 변수/기기 설정 | 페이지 레이아웃 슬롯이다. 모든 컴포넌트의 arbitrary child slot/allowlist 근거로 사용하지 않음 |

## Elementor

| ID·공식 문서 | 표시 날짜 | 확인한 사실 | 적용과 해석 한계 |
|---|---|---|---|
| E1 [Version 4 FAQs](https://elementor.com/products/website-builder/v4-faq/) | 확인일 기준 현행 FAQ | V4의 운영 사용 상태, V3와의 혼용, Atomic 체계 | V4 전체를 실험 기능이라고 단정하지 않음. V3의 모든 위젯이 V4 클래스/변수를 지원한다고도 주장하지 않음 |
| E2 [Add elements to a page](https://elementor.com/help/add-elements-to-a-page/) | 갱신 2024-10-28 | 드래그와 클릭 삽입, 컨테이너/선택 대상에 따른 위치 | 드래그 대안과 문맥 삽입 근거. 구현한 G7 경로의 성공 증거는 아님 |
| E3 [Tabs widget with nested elements](https://elementor.com/help/tabs-with-nested-containers/) | 갱신 2026-06-19 | 탭 본문 컨테이너에 다른 요소를 삽입하고 제목/스타일/내용을 구분 | classic nested widget 문서의 실험 기능 안내를 V4 전체 상태로 확대하지 않음 |
| E4 [Components](https://elementor.com/help/components-2/) | 갱신 2026-02-02 | 원본/인스턴스, 공개 속성, 페이지 문맥의 원본 편집과 공유 영향 | 같은 화면에서 편집 초점을 바꾸는 사례. G7 독립 복사 문서가 동기화 원본과 같은 모델이라는 뜻이 아님 |
| E5 [How to sync variables and global elements](https://elementor.com/help/how-to-sync-variables-and-global-elements/) | 갱신 2026-03-30 | V3 globals와 V4 variables/classes의 차이, 명시적 색/글꼴 연결 | 세대 간 자동 호환을 가정하지 않는 근거. 모든 타이포그래피의 동등 지원으로 확대하지 않음 |

## WordPress 블록 편집기

| ID·공식 문서 | 표시 날짜/버전 | 확인한 사실 | 적용과 해석 한계 |
|---|---|---|---|
| WP1 [Nested Blocks: Using InnerBlocks](https://developer.wordpress.org/block-editor/how-to-guides/block-tutorial/nested-blocks-inner-blocks/) | 현행 개발자 Handbook | parent·ancestor·allowedBlocks, 삽입/템플릿 제한 | 부모/직계 자식/조상 규칙의 범위가 다름. G7도 하나의 불명확한 editable 값으로 합치지 않음 |
| WP2 [Block Locking API](https://developer.wordpress.org/block-editor/how-to-guides/curating-the-editor-experience/block-locking/) | 갱신 2026-06-26 | 이동/삭제 잠금, contentOnly의 설계 도구 제한, Modify/잠금 해제 | 콘텐츠 기본 모드의 근거. UI 잠금은 서버 보안/권한 경계가 아님 |
| WP3 [Block Patterns](https://wordpress.org/documentation/article/block-pattern/) | 갱신 2026-08-31 | 패턴/동기화 패턴, 삽입·미리보기, 복사와 공유 편집의 차이 | 내 패턴 독립 복사와 SitePart 공유 영향을 구분. WP7의 내용 우선 편집과 확장 편집 경로도 구별 |
| WP4 [Pattern Overrides in WP 7.0: Support for Custom Blocks](https://make.wordpress.org/core/2026/03/16/pattern-overrides-in-wp-7-0-support-for-custom-blocks/) | 공식 개발 노트 2026-03-16 | Block Bindings 지원 속성 및 custom block의 override 지원 방식 | 오래된 4개 블록 한도를 현행 제한으로 사용하지 않음. 속성 override는 자유 구조 수정이 아님 |
| WP5 [Global Settings & Styles — theme.json](https://developer.wordpress.org/block-editor/how-to-guides/themes/global-settings-and-styles/) | schema 3 문서 | 공통/블록별 설정과 preset, 지원 선언을 통한 편집/출력 스타일 연결 | 같은 토큰과 타입별 지원 정책의 근거. G7가 theme.json을 원본으로 채택한다는 뜻이 아님 |

## Puck: 현재 커널로 구현 가능한 경로

| ID·공식 문서 | 확인 내용 | G7 적용 한계 |
|---|---|---|
| P1 [Slot field](https://puckeditor.com/docs/api-reference/fields/slot) | field의 allow/disallow와 render prop 제한의 적용 범위를 구별 | 현재 공식 문서의 설명이다. 설치 0.23.0의 선언 존재를 추가 확인했으나, 모든 G7 삽입/저장 경로의 실행 성공은 향후 검증 대상 |
| P2 [Permissions](https://puckeditor.com/docs/api-reference/permissions) | 전역/컴포넌트/동적 권한으로 편집·삽입·복제·이동 등의 UI 제어 | 서버 인증/권한과 canonical 검증을 대체하지 않음 |
| P3 [Config](https://puckeditor.com/docs/api-reference/configuration/config) | categories와 컴포넌트 목록/표시 설정 | 드로어와 갤러리 분류 원천을 합칠 수 있는 기반. 현재 통일돼 있다는 뜻이 아님 |
| P4 [Text field](https://puckeditor.com/docs/api-reference/fields/text) | contentEditable을 사용하는 캔버스 텍스트 편집 | 기존 직접 입력을 확장하는 근거. HTML을 영속 원본으로 삼는 근거가 아님 |
| P5 [Richtext field](https://puckeditor.com/docs/api-reference/fields/richtext) | 리치텍스트 필드와 구성 가능한 편집 옵션 | 문서 필드 편집의 역할이다. 리치텍스트를 전체 페이지 레이아웃 엔진으로 확대하지 않음 |

Puck 문서는 확인일의 현행 문서다. 저장소의 정확한 설치 버전 **0.23.0** 및 공개 타입 선언에서 `contentEditable`, `SlotField.allow/disallow`, `resolvePermissions`, categories를 대조했다. 엔진 API 존재와 제품 기능 완료를 분리한다.

## CSS·UI 구성 및 접근성

| ID·공식 문서 | 확인 내용 | 정책에 적용한 범위 |
|---|---|---|
| C1 [Tailwind CSS — Styling with utility classes](https://tailwindcss.com/docs/styling-with-utility-classes) | utility 조합을 통한 스타일링 | 개발 도구와 고객 편집 계약을 구분. 전체 class 입력 기능을 제공할 이유로 삼지 않음 |
| C2 [Bootstrap 5.3 — JavaScript](https://getbootstrap.com/docs/5.3/getting-started/javascript/) | JS 플러그인과 React 등에서의 DOM 소유권 충돌 주의 | 필요한 의미/동작을 검토하되 편집 캔버스에 중복 동작 엔진을 넣지 않음 |
| C3 [Bootstrap 5.3 — Accessibility](https://getbootstrap.com/docs/5.3/getting-started/accessibility/) | 최종 접근성이 마크업·스타일·스크립트 작성에 의존 | UI 라이브러리 채택만으로 최종 페이지의 접근성 합격을 선언하지 않음 |
| C4 [shadcn/ui — Introduction](https://ui.shadcn.com/docs) | 개발자가 소유하고 조합하는 공개 컴포넌트 코드 접근 | 코드 컴포넌트와 빌더의 저장/편집/PHP 출력 계약은 별도로 설계 |
| C5 [Tailwind Plus License](https://tailwindcss.com/plus/license) | website builder와 재배포 UI kit 등에 관한 사용 제한 사례 | Tailwind CSS와 별도 상품. 유료 소스/파생물을 빌더 재료로 재포장하는 계획을 채택하지 않음 |
| Q1 [W3C — Understanding SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | 드래그 없는 단일 포인터 대안 | 클릭 추가/이동 위치 선택과 별도의 키보드 경로를 수용 기준에 반영 |

## 현재 저장소 근거

기준 SHA: `58ed8a33829fdcb1327d730c6ab6da953f656949`. 아래 현재 소스와 과거 실행 기록의 시점을 구분한다.

| 근거 | 확인에 사용한 범위 |
|---|---|
| [내장 manifest](../../resources/block-packs/builtin-core/manifest.json) | 45개 정의·95개 preset·현재 ID/버전/용도 분류. CSV의 정의 행을 원본에서 추출 |
| [블록 descriptor](../../resources/js/blocks/types.ts) | definition category와 preset props의 형태. preset이 하위 트리 계약이라는 가정을 배제 |
| [갤러리 모델](../../resources/js/editor/blockGalleryModel.ts) · [갤러리 UI](../../resources/js/editor/BlockGalleryControls.tsx) | 현재 분류/필터, HeroSplit 숨김, 삽입 후보 처리 |
| [Puck config](../../resources/js/editor/puckEditorConfig.tsx) | 드로어 분류와 구조 편집의 표시 경로 |
| [레이아웃 정책](../../schemas/layout-policy-v1.json) | 3개 구조 노드, 5개 leaf, 부모/자식 관계, 현재 한도 |
| [캔버스 편집 계약](../../resources/js/editor/canvasEditingContract.ts) · [항목 명령](../../resources/js/editor/canvasItemCommands.ts) | 직접 필드와 반복 항목을 구조 노드 편집과 구분 |
| [내 패턴](../../resources/js/editor/SectionPatternControls.tsx) | root Section 보관과 독립 삽입 경로 |
| [이전 블록 조사](../../docs/block-catalog-benchmark.md) · [이전 라이브러리 조사](../../docs/block-library-v2-benchmark.md) | 기존 조사 존재와 preset 중심 범위. 과거 경쟁사 숫자를 현행 사실로 재사용하지 않음 |
| [현재 편집 정책](../../docs/productization/editing-policy.md) · [개발 헌법](../../docs/development-constitution.md) | 현재 제한/미래 목표 구분 및 오래된 차수 문구의 충돌 |
| [일반 페이지 1차](../../docs/audits/2026-09-05-site-phase-1.md) · [2차](../../docs/audits/2026-09-06-site-phase-2.md) · [3차](../../docs/audits/2026-09-06-site-phase-3.md) · [4차](../../docs/audits/2026-09-06-site-phase-4.md) · [5차](../../docs/audits/2026-09-07-site-phase-5.md) | 이전 연동·운영·킷 작업의 성격. 과거 실행 기록을 이번 새 검증으로 표시하지 않음 |

## 정책과 근거의 연결

| 제안 정책 | 외부 근거 | 현재 제품 근거 |
|---|---|---|
| P-01 제작 단위 분류 | W1, F1, E2 | definition/preset 구분과 실제 제작 단위 불일치 |
| P-02 위치에 맞는 삽입 | W3, WP1, P1 | leaf 5종과 위치 후보 필터의 분리 |
| P-03~04 직접 편집과 내부 구성 | W2, W4, F2, E3~4, WP2, P4~5 | 기존 인라인/항목 편집은 있고 복합 블록 슬롯은 없음 |
| P-05 드래그 대안 | E2, Q1 | 기존 명령과 엔진 조작을 재사용하는 정책 |
| P-06 공개 필드·슬롯·고정 동작 | W3, E3, WP1~2, P1~2 | canonical 부모/자식 제한 및 G7 Adapter 경계 |
| P-07 UI 개념과 CSS 도구 구분 | C1~5 | 원본 문서·TS 편집·PHP 출력이 분리된 제품 구조 |
| P-08 타입별 토큰/반응형 | W5, F4, WP5, E5 | 기존 PC 공통값과 tablet/mobile override 보존 |
| P-09 복사와 공유 구분 | W2, F3, WP3~4 | 개인 패턴과 SitePart의 현재 소유 범위 |
| P-10 원본·호환·실행 경계 | P1~3, WP2 | PageBuilderDocument/SitePartDocument와 마지막 정상 발행본 |

기본 요소 8종·신규 후보 3종·단일 카드 및 첫 대표 슬롯은 **위 근거를 바탕으로 한 최소 제품 범위 판단**이다. 사용 빈도 조사나 고객 행동 데이터로 최적 수량을 입증한 결과는 아니다.
