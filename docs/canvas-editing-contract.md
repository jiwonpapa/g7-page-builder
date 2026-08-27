# Canvas Editing Contract

## 목적

가운데 캔버스는 결과를 보는 미리보기가 아니라 선택 요소 중심의 구조화된 WYSIWYG입니다. 45개 내장 블록은 같은 선택·편집 규칙을 사용하며, 우측 Inspector는 고급 구조와 데이터 설정만 보완합니다. `richtext` 내용과 서식은 우측에 중복 편집기를 만들지 않고 캔버스에서만 편집합니다.

## 편집 우선순위

1. 화면 문구는 캔버스에서 직접 선택하고 입력합니다.
2. 버튼·링크 문구를 선택하면 G7 route 선택기를 같은 문맥에서 엽니다.
3. 이미지를 선택하면 업로드와 미디어 라이브러리를 같은 문맥에서 엽니다.
4. 반복 항목의 문구나 이미지를 선택하면 해당 항목을 이동·복제·삭제할 수 있습니다.
5. 문장 일부를 드래그하면 선택 범위 바로 위·아래의 Puck/Tiptap 인라인 도구로 그 범위에만 글꼴·크기·굵기·밑줄·색상·링크를 적용합니다. 클릭만 한 요소 전체의 공통 글꼴·정렬은 Action Bar의 `요소 전체 스타일`에서 조정합니다.
6. 데이터 source, 노출 조건, slider 동작, 이미지 대체 텍스트 같은 고급 값은 Inspector에서 설정합니다.

## 안전 경계

- 임의 class, Tailwind class, inline style, raw HTML, JavaScript는 문서에 저장하지 않습니다.
- 요소 스타일은 `appearance.elements[fieldPath]`에 글꼴·크기·굵기·정렬·색상 typed token만 저장하며, 블록 배경·여백과 섞지 않습니다.
- Puck/Tiptap의 임시 상태와 브라우저 `style` 속성은 원본이 아니며 compiler가 같은 `fieldPath` token을 공개 HTML class로 생성합니다.
- 반복 항목은 블록별 최소·최대 계약 안에서만 변경합니다.
- 미디어 URL은 기존 미디어 API와 허용 URL 검증을, 링크는 기존 G7 route catalog와 URL 정책을 그대로 사용합니다.
- G7 동적 데이터 블록은 편집용 sample과 공개 API 결과를 구분하며, canvas sample을 원본 데이터로 저장하지 않습니다.

## 45개 블록 계약

`resources/js/editor/canvasEditingContract.ts`의 `BUILTIN_CANVAS_EDITING_CONTRACT`가 단일 목록입니다. 모든 블록은 직접 텍스트 편집을 지원하고, 다음 선택 기능은 블록 특성에 따라 활성화됩니다.

- 이미지: Image, Image Text, Hero, Hero Split, Hero Slider, Logo Cloud, Logo Carousel, Team, Gallery, Testimonials, Testimonial Slider, Article List
- 경로: Image, Buttons, Image Text, Hero 계열, CTA, Contact, Logo 계열, Pricing, Team, Process, Article List, Event Schedule, Download Resources, Map Directions
- 반복 구조: Buttons, Icon List, Features, Slider, Logo, Stats, Pricing, Team, Gallery, Chart, Testimonials, FAQ, Process, Tabs, Comparison, Article, Event, Download
- 동적 데이터: G7 Recent Posts, G7 Board Archive, G7 Post Detail, G7 Product Grid, G7 Product Showcase, G7 Product Detail

## UX 기준

- 선택 요소는 파란 outline 한 번만 표시하며 콘텐츠 자체를 가리지 않습니다.
- Action Bar에는 이미지·경로·반복 항목·블록 이동처럼 즉시 필요한 작업만 둡니다. 모호한 `T` 버튼을 사용하지 않고 텍스트·버튼 선택에는 `요소 전체 스타일`, 블록 선택에는 `블록 설정`을 구분해 표시합니다.
- 텍스트·버튼을 클릭한 뒤 `요소 전체 스타일`을 누르면 요소 경계 위에 작은 벌룬을 표시하고, 바깥 영역 클릭이나 `Escape`에서 닫습니다.
- rich text 안의 글자 범위를 선택하면 요소 전체 벌룬을 닫고 선택 범위 인라인 도구만 표시합니다. 선택 범위 표시는 typed mark로 저장하며 같은 필드의 나머지 글자에도 전파하지 않습니다.
- Puck `visible: false` 계약으로 우측 Inspector의 richtext 입력기와 서식 메뉴를 숨기되 `contentEditable`, 공식 inline menu, typed document 변환은 그대로 유지합니다.
- 현재 선택값은 `aria-pressed` 또는 현재 select 값으로 노출하고, 벌룬 변경은 선택한 `fieldPath`에만 적용합니다.
- 저장되지 않은 변경이 있으면 문서함 이동과 브라우저 이탈을 차단하고 `계속 편집`, `저장 안 함`, `저장하고 나가기`를 제공합니다.
- 블록 라이브러리는 실제 16:10 썸네일, 읽을 수 있는 제목·설명, 블록 종류·완성 섹션·출처 필터를 사용하며 hover 확대 복제 화면은 만들지 않습니다.
- 매개변수 없는 기본 route는 한 번 선택해 즉시 적용하고, 게시판·페이지·상품처럼 대상이 필요한 route만 상세 입력 후 적용합니다.
- 반복 항목 삭제가 최소 개수에 걸리면 버튼을 비활성화하고 이유를 접근 가능한 label로 제공합니다.

## 회귀 게이트

- Unit: 45개 계약의 유일성, route/media path 해석, 요소 token allowlist, 중첩 값 불변 갱신, 최소·최대 메타데이터
- Component: 실제 캔버스 선택, 우측 richtext 중복 필드 부재, 범위 편집과 요소 벌룬 분리·닫힘, route/media overlay 유지·적용, 선택 요소 token 변경, 형제 요소 비전파, 즉시 dirty 전환과 이탈 방지, 반복 항목 복제 후 canonical document 반영
- Browser: 생성 → 캔버스 직접 편집 → 범위 서식 → 우측 richtext 중복 부재 → 이탈 방지 → 이미지/경로 → 반복 구조 → 미리보기 → 발행 흐름
- Visual: PC·태블릿·모바일 캔버스와 문맥 패널의 겹침 및 overflow 확인
