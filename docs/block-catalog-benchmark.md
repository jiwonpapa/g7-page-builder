# Block catalog benchmark

상태: 1차 테스트 카탈로그 구현
기준일: 2026-08-19

## 결론

유명 빌더의 화면을 복제하지 않고 반복되는 정보 구조를 표준 block으로 정규화합니다. 현재 카탈로그는 정적 콘텐츠 12종과 G7 공개 데이터 2종, 총 14종이며 모든 block은 추가 전에 이름·용도·축약 미리보기를 보여주고 추가 후 모든 콘텐츠 항목과 제한된 style preset을 편집할 수 있습니다.

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

## 1차 구현 카탈로그 12종

| Category | 표시 이름 | Canonical block ID | 용도 |
|---|---|---|---|
| 첫 화면 | 중앙 히어로 | `content.hero-centered-01` | 단일 핵심 메시지 |
| 첫 화면 | 분할 히어로 | `content.hero-split-01` | 메시지와 대표 이미지 좌우 배치 |
| 첫 화면 | 히어로 슬라이더 | `content.hero-slider-01` | 2~5개 핵심 장면 |
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

## UX와 시각 원칙

- 카탈로그는 block 이름만 나열하지 않고 축약된 실제 구조와 설명을 먼저 보여줍니다.
- 시각 체계는 밝은 편집면, warm gray/slate, 단일 cobalt accent로 통일합니다.
- 공개 block은 의미 구조·타이포그래피·간격을 우선하고 과도한 card 중첩을 피합니다.
- Slider는 브라우저 scroll-snap, 그래프는 semantic `progress`를 기본 구조로 사용합니다. 동적 효과를 선택한 페이지에서만 별도 경량 runtime을 조건부 로드합니다.
- 이미지 필드는 자체 `MediaPort`의 직접 업로드·최근 미디어 선택을 기본으로 하고 외부 URL은 고급 입력으로 유지합니다. 발행/리비전에서 참조 중인 파일은 삭제를 거부합니다.
- Hero Slider는 MIT 라이선스 `embla-carousel` 8.6.0과 Autoplay plugin을 사용하며, 서버 렌더 결과는 JS 실패 시 첫 슬라이드를 그대로 노출합니다.

## 편집 경계

- 제목·본문·버튼·링크·이미지·반복 item은 모두 편집합니다.
- 구조, breakpoint, 접근성 속성은 block이 소유합니다.
- 관리자는 `surface`, `spacing`, 열 수, 색상 tone과 블록별 motion 같은 allowlist preset만 선택합니다.
- Tailwind class, inline style, raw HTML/CSS/JS는 저장하지 않습니다.
- Monaco 기반 Custom Code는 별도 고급 Block Pack과 sandbox·CSP·권한 계약이 생기기 전에는 제공하지 않습니다.

## 다음 후보

2차 우선순위는 Testimonials, FAQ Accordion, Process/Timeline, Tabs, Comparison Table, Article/CMS List, Video, Map, Form입니다. Form·CMS·Map은 화면 block보다 먼저 데이터·권한·실패 처리 계약을 정의합니다.
