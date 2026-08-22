# Block catalog benchmark

상태: P0 기본 콘텐츠 카탈로그 확장 구현
기준일: 2026-08-22

## 결론

유명 빌더의 화면을 복제하지 않고 반복되는 정보 구조를 표준 block으로 정규화합니다. 현재 카탈로그는 정적 콘텐츠 29종, G7 공개 데이터 6종, 문의 폼 1종, 찾아오기 1종으로 총 37종이며 모든 block은 추가 전에 이름·용도·축약 미리보기를 보여주고 추가 후 모든 콘텐츠 항목과 제한된 style preset을 편집할 수 있습니다. 내장 프리셋 18개는 새 타입을 만들지 않고 검증된 props를 복사하는 빠른 시작점입니다.

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

## P0 기본 6종 선정 근거

사용량 수치를 공개하지 않는 경쟁 제품을 임의 점유율로 순위화하지 않았습니다. 대신 Elementor의 simple widget, Webflow의 element, Framer의 component/property 공식 문서에 반복해서 등장하는 최소 구성 단위를 공통분모로 삼았습니다.

| 공통 구성 단위 | 이번 결정 | 제외한 자유도 |
|---|---|---|
| Heading·Text | 제목과 안전한 리치텍스트를 독립 블록으로 제공 | raw HTML·임의 heading 구조 |
| Image | 대체 텍스트·캡션·연결·비율을 typed props로 제공 | 자유 crop·inline style |
| Button | 1~3개 행동과 정렬·variant를 제공 | 임의 class·JavaScript action |
| Image + Text | 대표 이미지와 설명·주요 행동의 좌우 구성을 제공 | 자유 grid·중첩 slot |
| List | 장점·조건·체크에 쓰는 1·2열 아이콘 목록을 제공 | 임의 SVG·무제한 반복 |

## 제품 콘텐츠 카탈로그 37종

폼·위치 카테고리는 별도 제품 계약으로 추가했습니다.

- Inquiry Form: 문의·견적·예약·신청·뉴스레터, DB 선저장과 관리자 문의함
- Map Directions: 주소·좌표·OSM/Google/숨김 지도·길찾기·운영 및 주차 정보

| Category | 표시 이름 | Canonical block ID | 용도 |
|---|---|---|---|
| 첫 화면 | 중앙 히어로 | `content.hero-centered-01` | 단일 핵심 메시지 |
| 첫 화면 | 분할 히어로 | `content.hero-split-01` | 메시지와 대표 이미지 좌우 배치 |
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

## 다음 후보

4차에서 조건부 표시 규칙의 시각 편집, 반복 콘텐츠 pagination, 다운로드 파일의 MediaPort 자산 선택, 상품·게시글 단건 상세 블록을 구현했습니다. 다음 후보는 이벤트 캘린더 데이터 연동이며, G7 데이터 확장은 화면보다 먼저 capability·권한·빈 상태·실패 처리 계약을 정의합니다.
