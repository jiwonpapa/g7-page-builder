# Canvas Editing Contract

## 목적

가운데 캔버스는 결과를 보는 미리보기가 아니라 선택 요소 중심의 구조화된 WYSIWYG입니다. 35개 내장 블록은 같은 선택·편집 규칙을 사용하며, 우측 Inspector는 고급 구조와 데이터 설정을 보완합니다.

## 편집 우선순위

1. 화면 문구는 캔버스에서 직접 선택하고 입력합니다.
2. 버튼·링크 문구를 선택하면 G7 route 선택기를 같은 문맥에서 엽니다.
3. 이미지를 선택하면 업로드와 미디어 라이브러리를 같은 문맥에서 엽니다.
4. 반복 항목의 문구나 이미지를 선택하면 해당 항목을 이동·복제·삭제할 수 있습니다.
5. 선택 문구의 글꼴·크기·굵기·정렬·색상은 선택 요소 가까이의 벌룬 도구에서, 블록 배경·세로 여백은 블록 설정에서 조정합니다.
6. 데이터 source, 노출 조건, slider 동작, 이미지 대체 텍스트 같은 고급 값은 Inspector에서 설정합니다.

## 안전 경계

- 임의 class, Tailwind class, inline style, raw HTML, JavaScript는 문서에 저장하지 않습니다.
- 요소 스타일은 `appearance.elements[fieldPath]`에 글꼴·크기·굵기·정렬·색상 typed token만 저장하며, 블록 배경·여백과 섞지 않습니다.
- Puck/Tiptap의 임시 상태와 브라우저 `style` 속성은 원본이 아니며 compiler가 같은 `fieldPath` token을 공개 HTML class로 생성합니다.
- 반복 항목은 블록별 최소·최대 계약 안에서만 변경합니다.
- 미디어 URL은 기존 미디어 API와 허용 URL 검증을, 링크는 기존 G7 route catalog와 URL 정책을 그대로 사용합니다.
- G7 동적 데이터 블록은 편집용 sample과 공개 API 결과를 구분하며, canvas sample을 원본 데이터로 저장하지 않습니다.

## 35개 블록 계약

`resources/js/editor/canvasEditingContract.ts`의 `BUILTIN_CANVAS_EDITING_CONTRACT`가 단일 목록입니다. 모든 블록은 직접 텍스트 편집을 지원하고, 다음 선택 기능은 블록 특성에 따라 활성화됩니다.

- 이미지: Image, Image Text, Hero, Hero Split, Hero Slider, Logo Cloud, Logo Carousel, Team, Gallery, Testimonials, Testimonial Slider, Article List
- 경로: Image, Buttons, Image Text, Hero 계열, CTA, Contact, Logo 계열, Pricing, Team, Process, Article List, Event Schedule, Download Resources, Map Directions
- 반복 구조: Buttons, Icon List, Features, Slider, Logo, Stats, Pricing, Team, Gallery, Chart, Testimonials, FAQ, Process, Tabs, Comparison, Article, Event, Download
- 동적 데이터: G7 Recent Posts, G7 Board Archive, G7 Product Grid, G7 Product Showcase

## UX 기준

- 선택 요소는 파란 outline 한 번만 표시하며 콘텐츠 자체를 가리지 않습니다.
- Action Bar에는 이미지·경로·반복 항목·블록 이동처럼 즉시 필요한 작업만 둡니다.
- 텍스트·버튼을 선택하면 요소 경계 위에 벌룬 도구를 표시하고, 현재 선택값을 `aria-pressed`로 표시합니다.
- 벌룬 도구 변경은 선택한 `fieldPath`에만 적용되며 같은 블록의 제목·본문·버튼으로 전파하지 않습니다.
- 매개변수 없는 기본 route는 한 번 선택해 즉시 적용하고, 게시판·페이지·상품처럼 대상이 필요한 route만 상세 입력 후 적용합니다.
- 반복 항목 삭제가 최소 개수에 걸리면 버튼을 비활성화하고 이유를 접근 가능한 label로 제공합니다.

## 회귀 게이트

- Unit: 35개 계약의 유일성, route/media path 해석, 요소 token allowlist, 중첩 값 불변 갱신, 최소·최대 메타데이터
- Component: 실제 캔버스 선택, route/media overlay 유지·적용, 선택 요소 token 변경, 형제 요소 비전파, 반복 항목 복제 후 canonical document 반영
- Browser: 생성 → 직접 편집 → 이미지/경로 → 반복 구조 → 미리보기 → 발행 흐름
- Visual: PC·태블릿·모바일 캔버스와 문맥 패널의 겹침 및 overflow 확인
