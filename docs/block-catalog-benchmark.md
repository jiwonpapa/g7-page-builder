# Block catalog benchmark

상태: 신규 종류 확장 동결, 기존 45종 프로덕트 품질 고도화
기준일: 2026-08-28

## 결론

유명 빌더의 화면이나 유료 소스 코드를 복제하지 않고 반복되는 정보 구조를 typed block으로 정규화합니다. 현재 카탈로그는 기존 문서까지 렌더하는 계약 45종, 신규 삽입용 기본 블록 44종, 한국어 완성 섹션 95종입니다. 라이브러리에는 중복 Hero를 제외한 139개 항목을 노출하고, 호환 블록까지 포함한 140개 실제 렌더 썸네일을 검증 자산으로 유지합니다. 다만 이 수량을 완성도로 보지 않으며, 아래 P000·P0 항목과 45종 전수 하네스가 통과할 때까지 신규 block type 추가를 중단합니다.

이는 경쟁 제품의 수백 개 시각 변형과 동일하다는 뜻이 아닙니다. G7 Page Builder의 프로덕트 기준은 각 타입이 schema, editor, compiler, 공개 renderer, 접근성, 반응형 회귀를 함께 갖추는 것입니다. 수량만 많은 템플릿 변형은 block definition으로 중복 계산하지 않습니다.

## 프로덕트화 우선순위

| 우선순위 | 문제 | 완료 기준 |
|---|---|---|
| P000 | 편집기와 미리보기·발행본의 글꼴 크기·줄바꿈·레이아웃 불일치 | 1280·768·360에서 대표 제목의 computed font family·weight·size·line-height·letter-spacing과 줄 수가 동일하고, 블록 content edge 오차가 1.25px 이하여야 함 |
| P0 | 필수값 표시 없이 원시 compiler 오류 노출 | 우측 설정 label에 필수 표시, 해당 필드 근처 오류, `필수 항목 {항목명}을 입력해야 합니다` 형태의 한국어 안내 |
| P0 | 아이콘 사용 불일치와 문자 기호 대체 | 단일 검증 아이콘 세트와 의미별 크기 토큰을 편집기·발행본·썸네일에서 공통 사용하며 `YT`, `f`, `↯` 같은 문자 대체 제거 |
| P0 | 이미지 직접 선택·빈 상태·지도 이미지 부재 | 캔버스 이미지 선택 시 등록·교체·비우기·대체 텍스트 단축 동작, 우측 전체 설정 동시 제공, 빈 이미지 자리의 점선 placeholder, 문의 안내의 정적 지도 이미지와 외부 지도 링크 병행 |
| P0 | 라이브러리 카드가 동일한 고정 높이 | 제목·리치텍스트 등 저밀도 미리보기는 내용 기반 높이, 복합 블록은 상한 안에서 구조가 식별되는 높이, 카드 설명과 실제 추가 결과의 일치 |
| P0 | Hero와 분할 Hero의 중복 모델 | 대표 Hero 한 타입의 typed layout preset으로 통합하고 기존 문서는 호환 변환, 라이브러리에서 중복 선택 제거 |
| P0 | 추천 효과가 블록마다 같은 reveal로 덮임 | block 의미·순서·문서 내 중복·reduced-motion을 고려한 결정적 추천, 같은 효과의 연속 반복 제한, 기존 수동 선택 보존 |
| P0 | 에디토리얼 magazine 첫 칸 공백과 날짜 text 입력 | 2x2 reading order를 깨는 span 제거 또는 의도된 featured layout으로 명시, 날짜·시간 prop은 의미에 맞는 native picker 제공 |

45종 공통 합격선은 manifest 순서와 1:1 발행, 비어 있지 않은 가시 콘텐츠, 깨진 이미지 0, 최소 10px 가독성, 블록·문서 가로 넘침 0, 안정된 geometry, axe WCAG A/AA입니다. 핵심 10종은 세 viewport의 무허용치 시각 baseline을 추가 유지하며, 장기적으로 baseline을 45종 전체로 확대합니다.

## 공식 제품에서 확인한 공통 구조

| 제품 | 확인한 구조 | 적용 원칙 |
|---|---|---|
| [Elementor widgets](https://elementor.com/help/simple-widgets/) | widget을 페이지 구성의 기본 단위로 사용하고 content/style/advanced 속성을 분리 | block 콘텐츠와 검증된 appearance preset을 분리 |
| [Elementor Carousel](https://elementor.com/help/carousel-widget/) | slide 안에 text·image·button을 중첩하고 표시 수·pagination을 설정 | Hero Slider를 정형 slide 배열로 정의 |
| [Webflow Elements](https://help.webflow.com/hc/en-us/sections/33776384489363-Elements) | Slider·Navbar·Image·List 같은 반복 가능한 element 카탈로그 | 용도 기반 category와 검색 가능한 이름 사용 |
| [Webflow Collection List](https://help.webflow.com/hc/en-us/articles/33961294051347-Collection-list) | 동일 구조의 item을 데이터 목록으로 반복 | 가격표·팀·로고·통계·그래프를 제한된 item 배열로 정의 |
| [Webflow accessibility](https://help.webflow.com/hc/en-us/articles/33961346219923-Accessible-elements-in-Webflow) | Slider·Tabs 등에 keyboard와 focus 계약 필요 | Slider는 focus 가능한 scroll-snap 영역으로 제공 |
| [Framer Components](https://www.framer.com/help/articles/using-components/) | 재사용 component와 노출된 property로 변형 | raw CSS 대신 재사용 block+typed property 채택 |
| [Framer CMS Components](https://www.framer.com/updates/cms-components) | property·variant·responsive breakpoint 조합 | surface·spacing·열 수를 제한된 variant로 제공 |
| [Tailwind CSS utility classes](https://tailwindcss.com/docs/styling-with-utility-classes) | 단일 목적 utility를 조합해 컴포넌트를 만드는 CSS 도구 | Tailwind 자체에 완성 버튼 세트가 있다고 간주하지 않음 |
| [Tailwind Plus UI Blocks](https://tailwindcss.com/plus/ui-blocks) | Button 8, Button Group 5, Breadcrumb 4, Card 10, Divider 8, Alert 6 등 완성 예제를 별도 제품으로 제공 | 자주 쓰는 구조의 독립 제공 필요성만 참고하고 코드·디자인은 복제하지 않음 |
| [daisyUI Button](https://daisyui.com/components/button/) · [Alert](https://daisyui.com/components/alert/) · [Breadcrumbs](https://daisyui.com/components/breadcrumbs/) · [Carousel](https://daisyui.com/components/carousel/) | Tailwind 위에 버튼 상태·알림 tone·경로·캐러셀을 명시적 component로 추가 | 버튼·알림·탐색·미디어를 typed block으로 제공 |
| [Squarespace blocks](https://support.squarespace.com/hc/en-us/articles/206543757-Add-content-to-your-site-with-blocks) | Button, Form, Gallery, Line, Quote, Social links 등 페이지 제작의 반복 단위를 block으로 제공 | 전체 폼 빌더보다 페이지 연결에 필요한 기본 자산을 우선 |

Tailwind Plus는 공식 라이선스 안내에서 해당 컴포넌트를 재포장한 page builder·UI kit 파생 제품을 허용하지 않습니다. 따라서 분류와 정보 구조만 비교했으며 markup, CSS, 예제 문구는 사용하지 않았습니다.

## P0 기본 6종과 프로덕션 보강 8종 선정 근거

사용량 수치를 공개하지 않는 경쟁 제품을 임의 점유율로 순위화하지 않았습니다. 대신 Elementor의 simple widget, Webflow의 element, Framer의 component/property 공식 문서에 반복해서 등장하는 최소 구성 단위를 공통분모로 삼았습니다.

| 공통 구성 단위 | 이번 결정 | 제외한 자유도 |
|---|---|---|
| Heading·Text | 제목과 안전한 리치텍스트를 독립 블록으로 제공 | raw HTML·임의 heading 구조 |
| Image | 대체 텍스트·캡션·연결·비율을 typed props로 제공 | 자유 crop·inline style |
| Button | 1~3개 행동과 정렬·variant를 제공 | 임의 class·JavaScript action |
| Image + Text | 대표 이미지와 설명·주요 행동의 좌우 구성을 제공 | 자유 grid·중첩 slot |
| List | 장점·조건·체크에 쓰는 1·2열 아이콘 목록을 제공 | 임의 SVG·무제한 반복 |

기본 6종만으로도 조합은 가능하지만, 실제 사이트의 상세 페이지·공지·회사 소개·작품 소개에서 반복되는 연결 자산이 빠져 있었습니다. 공식 카탈로그에 교차 등장하고 기존 타입으로 의미를 왜곡하지 않고는 만들기 어려운 구조만 다음 8종으로 보강했습니다.

| 반복 구조 | 추가 block | typed 범위 |
|---|---|---|
| 내용 구획 | Divider | solid·dashed·gradient, 폭, 선택 label |
| 인용·권위 | Blockquote | 인용문, 출처, 역할, line·mark variant |
| 상태·운영 안내 | Notice | info·success·warning·critical, 선택 action |
| 서비스·링크 묶음 | Card Grid | 2·3열, 2~6개 카드, 선택 route |
| 현재 경로 | Breadcrumbs | 1~6개 상위 경로와 현재 페이지 |
| 긴 페이지 이동 | Anchor Menu | 2~8개 검증 anchor, 선택 sticky |
| 외부 채널 | Social Links | 허용 network, icon·label variant |
| 작품·공간 탐색 | Image Carousel | 2~8개 이미지, alt·caption, 제어·reduced motion |

## 제품 콘텐츠 카탈로그 45종

폼·위치 카테고리는 별도 제품 계약으로 추가했습니다.

- Inquiry Form: 문의·견적·예약·신청·뉴스레터, DB 선저장과 관리자 문의함
- Map Directions: 지도 이미지 업로드·주소·좌표·OSM/Google/숨김 지도·외부 길찾기·운영 및 주차 정보

| Category | 표시 이름 | Canonical block ID | 용도 |
|---|---|---|---|
| 첫 화면 | 중앙 히어로 | `content.hero-centered-01` | 단일 핵심 메시지 |
| 첫 화면 | 기존 분할 히어로 | `content.hero-split-01` | 기존 문서 호환 전용, 신규 삽입은 Hero의 분할 레이아웃 사용 |
| 첫 화면 | 히어로 슬라이더 | `content.hero-slider-01` | 2~5개 핵심 장면 |
| 콘텐츠 | 제목 | `content.heading-01` | 섹션 제목·보조 문구·H2~H4 단계 |
| 콘텐츠 | 리치텍스트 | `content.rich-text-01` | 문단·소제목·목록·안전한 링크 본문 |
| 미디어 | 단일 이미지 | `media.image-01` | 대체 텍스트·캡션·연결·고정 비율 이미지 |
| 행동 | 버튼 묶음 | `action.buttons-01` | 1~3개 주요·보조·텍스트 행동 |
| 미디어 | 이미지 + 텍스트 | `media.image-text-01` | 이미지·설명·주요 행동 좌우 배치 |
| 콘텐츠 | 아이콘 목록 | `content.icon-list-01` | 장점·조건·체크 항목 1·2열 목록 |
| 콘텐츠 | 기능 소개 | `content.features-grid-01` | 아이콘·제목·설명 반복 |
| 행동 | CTA | `content.cta-split-01` | 다음 행동 유도 |
| 연락처 | 문의 안내 | `content.contact-info-01` | 주소·전화·메일·지도 링크 |
| 신뢰 | 로고 클라우드 | `trust.logo-cloud-01` | 고객사·파트너 로고 |
| 데이터 | 핵심 통계 | `data.stats-icons-01` | 아이콘·수치·설명 |
| 비즈니스 | 가격표 | `commerce.pricing-tiers-01` | 2~4개 요금제 비교 |
| 회사 | 팀 소개 | `company.team-grid-01` | 인물·역할·소개·프로필 |
| 미디어 | 갤러리 | `media.gallery-grid-01` | 2~12개 이미지 격자 |
| G7 데이터 | 최근 게시글 | `g7.board-recent-posts-01` | 최신·인기 게시글 자동 목록 |
| G7 데이터 | 상품 그리드 | `g7.ecommerce-product-grid-01` | 최신·신규·인기 상품 자동 목록 |
| 데이터 | 막대그래프 | `data.bar-chart-01` | 0~100 값 비교 |
| 신뢰 | 고객 후기 | `trust.testimonials-01` | 평가·이름·역할·회사·프로필 반복 |
| 콘텐츠 | FAQ 아코디언 | `content.faq-accordion-01` | 접근 가능한 질문·답변 접기 |
| 콘텐츠 | 프로세스·타임라인 | `content.process-timeline-01` | 순서가 있는 절차·이력 설명 |
| 콘텐츠 | 탭 콘텐츠 | `content.tabs-01` | 키보드 탐색 가능한 관련 정보 구분 |
| 비즈니스 | 비교표 | `commerce.comparison-table-01` | 2~4개 제품·플랜의 의미 있는 표 비교 |
| 콘텐츠 | 에디토리얼 목록 | `content.article-list-01` | 사람이 선별한 글·사례·소식 목록 |
| 미디어 | 영상 | `media.video-embed-01` | 허용된 YouTube·Vimeo 영상 식별자 임베드 |
| 신뢰 | 로고 캐러셀 | `trust.logo-carousel-01` | 파트너 로고의 접근 가능한 가로 탐색 |
| 신뢰 | 후기 슬라이더 | `trust.testimonial-slider-01` | 고객 경험을 한 장면씩 집중 전달 |
| 콘텐츠 | 이벤트 일정 | `content.event-schedule-01` | 행사 날짜·장소·설명·신청 동선 |
| 콘텐츠 | 다운로드 자료 | `content.download-resources-01` | 소개서·가이드·에셋 파일 연결 |
| G7 데이터 | 콘텐츠 아카이브 | `g7.board-content-archive-01` | 공개 게시글 제목 검색·게시판 필터·상세 연결 |
| G7 데이터 | 상품 쇼케이스 | `g7.ecommerce-product-showcase-01` | 공개 상품 대표 강조·가로 목록·상세 연결 |
| G7 데이터 | 게시글 상세 | `g7.board-post-detail-01` | 지정한 공개 게시글의 메타 정보·본문 요약·상세 연결 |
| G7 데이터 | 상품 상세 | `g7.ecommerce-product-detail-01` | 지정한 공개 상품의 이미지·가격·설명·상세 연결 |
| 콘텐츠 | 구분선 | `content.divider-01` | 섹션 구획과 선택 label |
| 콘텐츠 | 인용문 | `content.blockquote-01` | 인용·출처·역할 표시 |
| 콘텐츠 | 알림 | `content.notice-01` | 상태별 안내와 선택 행동 |
| 콘텐츠 | 카드 그리드 | `content.card-grid-01` | 서비스·자료·링크 카드 반복 |
| 탐색 | 경로 | `navigation.breadcrumbs-01` | 상위 경로와 현재 위치 |
| 탐색 | 앵커 메뉴 | `navigation.anchor-menu-01` | 긴 페이지 내부 이동 |
| 탐색 | 소셜 링크 | `navigation.social-links-01` | 허용된 외부 채널 연결 |
| 미디어 | 이미지 캐러셀 | `media.image-carousel-01` | 여러 이미지의 접근 가능한 순차 탐색 |

## UX와 시각 원칙

- 카탈로그는 block 이름만 나열하지 않고 축약된 실제 구조와 설명을 먼저 보여줍니다.
- 시각 체계는 밝은 편집면, warm gray/slate, 단일 cobalt accent로 통일합니다.
- 공개 block은 의미 구조·타이포그래피·간격을 우선하고 과도한 card 중첩을 피합니다.
- Hero·로고·후기 Slider는 동일한 Embla 접근성·재생 제어 계약을 사용하고 그래프는 semantic `progress`를 기본 구조로 사용합니다. 동적 효과를 선택한 페이지에서만 별도 경량 runtime을 조건부 로드합니다.
- 이미지 필드는 자체 `MediaPort`의 직접 업로드·최근 미디어 선택을 기본으로 하고 외부 URL은 고급 입력으로 유지합니다. 발행/리비전에서 참조 중인 파일은 삭제를 거부합니다.
- Hero Slider는 MIT 라이선스 `embla-carousel` 8.6.0과 Autoplay plugin을 사용하며, 서버 렌더 결과는 JS 실패 시 첫 슬라이드를 그대로 노출합니다.
- FAQ는 native `details`, 비교표는 semantic `table`, 탭은 ARIA tab pattern과 방향키·Home·End 탐색을 사용합니다.
- 에디토리얼 목록은 관리자가 선별하는 정적 콘텐츠입니다. 자동 최신글·인기글은 기존 G7 Recent Posts가 공개 API capability를 통해 담당합니다.
- 영상은 임의 iframe URL을 받지 않고 YouTube·Vimeo provider와 검증된 ID만 저장하며 공개 CSP도 두 host만 추가 허용합니다.

## 편집 경계

- 제목·본문·버튼·링크·이미지·반복 item은 모두 편집합니다.
- 구조, breakpoint, 접근성 속성은 block이 소유합니다.
- 관리자는 `surface`, `spacing`, 열 수, 색상 tone과 블록별 motion 같은 allowlist preset만 선택합니다.
- Tailwind class, inline style, raw HTML/CSS/JS는 저장하지 않습니다.
- Monaco 기반 Custom Code는 별도 고급 Block Pack과 sandbox·CSP·권한 계약이 생기기 전에는 제공하지 않습니다.

## 이번 범위의 경계

- 버튼은 기존 `Buttons`의 primary·secondary·text 3개 variant와 1~3개 route 묶음으로 유지합니다. Tailwind utility를 문서에 노출하거나 별도 CSS 프레임워크를 런타임 의존성으로 넣지 않습니다.
- 전체 폼 제품군, 결제·체크아웃, 로그인 UI, 모달·토스트·대시보드 앱 shell은 페이지 콘텐츠 블록 범위를 넘으므로 추가하지 않습니다.
- 이벤트 캘린더와 고급 메뉴는 향후 G7 capability·권한·빈 상태·실패 처리 계약이 먼저 정의될 때 별도 후보로 평가합니다.
- 완료 증거는 45/45 preset compile, 45/45 실제 발행, PC·태블릿·모바일 30개 시각 baseline, axe WCAG A/AA, 무가로넘침입니다.
