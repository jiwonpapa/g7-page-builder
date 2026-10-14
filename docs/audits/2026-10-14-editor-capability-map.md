# 내장 구성 capability 및 미완료 인계

2026-10-14 · 49개 block / 99개 preset · 기준 제품 소스 ead0f89d30c65bc2fc7c1e9ae93179e3d6888160

기준은 기존 builtin-core manifest입니다. 아래 대응은 기존 문서 변환 매핑 코드가 아니라 요구 누락을 확인하는 보고입니다. 기존 문서 전환은 이번에 실행하지 않습니다. 현재 v3 시작 데이터는 91개이며 기존 일반 구성 63개 + 문의 5개 + 추가 일반 구성 17개 + 동적 6개입니다. **공통 편집 기능 존재와 전용 시작 데이터 제공 및 실제 제품 수용을 구분합니다.** 표 작성/이름 대응으로 전체 완료를 선언하지 않습니다.

새 구성에 블록별 편집/삽입/렌더 코드를 추가하지 않습니다. 기존 11개 공통 요소, 문서 데이터, 공통 명령·Puck history·paste를 사용합니다. 기존 preset의 모든 디자인을 옮겼다는 주장이나 G7 서비스 내부 편집을 지원한다는 뜻은 아닙니다.

## 전체 block

| block ID | 이름 | 공통 capability | 현재 시작 데이터 | 미완료·보호 경계 |
|---|---|---|---|---|
| content.hero-centered-01 | 히어로 | 공통 요소/트리/typed 스타일/반응형/한 Undo | hero-* (9) | 추가 제품 수용 미확인 |
| content.hero-split-01 | 기존 분할 히어로 | 공통 요소/트리/typed 스타일/반응형/한 Undo | 새 삽입용 legacy sample 없음; hero-* 일반 구성 | 추가 제품 수용 미확인 |
| content.hero-slider-01 | 슬라이더 히어로 | 공통 요소 + BehaviorInspector/안정 ID 동작 | hero-slider-starter | 추가 제품 동작/출력 수용 미확인 |
| content.heading-01 | 제목 | 공통 요소/트리/typed 스타일/반응형/한 Undo | heading-* (2) | 추가 제품 수용 미확인 |
| content.rich-text-01 | 리치텍스트 | 공통 요소/트리/typed 스타일/반응형/한 Undo | rich-text-starter | 추가 제품 동작/출력 수용 미확인 |
| media.image-01 | 단일 이미지 | 공통 요소/트리/typed 스타일/반응형/한 Undo | image-* (2) | 추가 제품 수용 미확인 |
| action.buttons-01 | 버튼 묶음 | 공통 요소/트리/typed 스타일/반응형/한 Undo | buttons-* (2) | 추가 제품 수용 미확인 |
| media.image-text-01 | 이미지 + 텍스트 | 공통 요소/트리/typed 스타일/반응형/한 Undo | image-text-* (2) | 추가 제품 수용 미확인 |
| content.icon-list-01 | 아이콘 목록 | 공통 요소/트리/typed 스타일/반응형/한 Undo | icon-list-starter | 추가 제품 동작/출력 수용 미확인 |
| content.features-grid-01 | 특징 목록 | 공통 요소/트리/typed 스타일/반응형/한 Undo | features-starter | 추가 제품 동작/출력 수용 미확인 |
| content.cta-split-01 | 행동 유도 | 공통 요소/트리/typed 스타일/반응형/한 Undo | cta-* (4) | 추가 제품 수용 미확인 |
| content.contact-info-01 | 연락처 | 공통 요소/트리/typed 스타일/반응형/한 Undo | contact-starter | 추가 제품 동작/출력 수용 미확인 |
| trust.logo-cloud-01 | 로고 클라우드 | 공통 요소/트리/typed 스타일/반응형/한 Undo | logo-cloud-* (3) | 추가 제품 수용 미확인 |
| data.stats-icons-01 | 숫자·아이콘 지표 | 공통 요소/트리/typed 스타일/반응형/한 Undo | stats-starter | 추가 제품 동작/출력 수용 미확인 |
| commerce.pricing-tiers-01 | 요금제 | 공통 요소/트리/typed 스타일/반응형/한 Undo | pricing-* (4) | 추가 제품 수용 미확인 |
| company.team-grid-01 | 팀 소개 | 공통 요소/트리/typed 스타일/반응형/한 Undo | team-* (4) | 추가 제품 수용 미확인 |
| media.gallery-grid-01 | 갤러리 그리드 | 공통 요소/트리/typed 스타일/반응형/한 Undo | gallery-* (4) | 추가 제품 수용 미확인 |
| data.bar-chart-01 | 막대그래프 | 공통 요소/트리/typed 스타일/반응형/한 Undo | bar-chart-quarterly | 추가 제품 수용 미확인 |
| g7.board-recent-posts-01 | G7 최근 게시글 | 공통 data 연결·원형 트리·검색/필터/페이지 | data-posts-starter | 실제 응답/권한/저장·출력/UX 수용 미확인 |
| g7.ecommerce-product-grid-01 | G7 상품 그리드 | 공통 data 연결·원형 트리·검색/필터/페이지 | data-products-starter | 실제 응답/권한/저장·출력/UX 수용 미확인 |
| form.inquiry-01 | 문의·신청 폼 | 공통 입력·라벨·스타일 + 고정 문의 binding | inquiry-* (5) | 실행/실제 입력값 외부 소유; 추가 제출 감사 필요 |
| location.map-directions-01 | 지도·오시는 길 | 공통 media.embed + typed provider/스타일 | map-starter | 외부 iframe 내부 보호; 추가 제품 수용 미확인 |
| trust.testimonials-01 | 고객 후기 | 공통 요소/트리/typed 스타일/반응형/한 Undo | testimonials-* (5) | 추가 제품 수용 미확인 |
| content.faq-accordion-01 | FAQ 아코디언 | 공통 요소 + BehaviorInspector/안정 ID 동작 | faq-starter | 추가 제품 동작/출력 수용 미확인 |
| content.process-timeline-01 | 프로세스·타임라인 | 공통 요소/트리/typed 스타일/반응형/한 Undo | process-four-step | 추가 제품 수용 미확인 |
| content.tabs-01 | 탭 콘텐츠 | 공통 요소 + BehaviorInspector/안정 ID 동작 | tabs-starter | 추가 제품 동작/출력 수용 미확인 |
| commerce.comparison-table-01 | 비교표 | 공통 요소/트리/typed 스타일/반응형/한 Undo | comparison-plans | 추가 제품 수용 미확인 |
| content.article-list-01 | 에디토리얼 목록 | 공통 요소/트리/typed 스타일/반응형/한 Undo | articles-* (5) | 추가 제품 수용 미확인 |
| media.video-embed-01 | 영상 | 공통 media.embed + typed provider/스타일 | video-starter | 외부 iframe 내부 보호; 추가 제품 수용 미확인 |
| trust.logo-carousel-01 | 로고 캐러셀 | 공통 요소 + BehaviorInspector/안정 ID 동작 | logo-carousel-starter | 추가 제품 동작/출력 수용 미확인 |
| trust.testimonial-slider-01 | 후기 슬라이더 | 공통 요소 + BehaviorInspector/안정 ID 동작 | testimonial-slider-starter | 추가 제품 동작/출력 수용 미확인 |
| content.event-schedule-01 | 이벤트 일정 | 공통 요소/트리/typed 스타일/반응형/한 Undo | events-upcoming | 추가 제품 수용 미확인 |
| content.download-resources-01 | 다운로드 자료 | 공통 요소/트리/typed 스타일/반응형/한 Undo | downloads-resource-center | 추가 제품 수용 미확인 |
| g7.board-content-archive-01 | G7 콘텐츠 아카이브 | 공통 data 연결·원형 트리·검색/필터/페이지 | data-post-archive-starter | 실제 응답/권한/저장·출력/UX 수용 미확인 |
| g7.ecommerce-product-showcase-01 | G7 상품 쇼케이스 | 공통 data 연결·원형 트리·검색/필터/페이지 | data-product-showcase-starter | 실제 응답/권한/저장·출력/UX 수용 미확인 |
| g7.board-post-detail-01 | G7 게시글 상세 | 공통 data 연결·원형 트리·상세 필드 | data-post-detail-starter | 실제 응답/권한/저장·출력/UX 수용 미확인 |
| g7.ecommerce-product-detail-01 | G7 상품 상세 | 공통 data 연결·원형 트리·상세 필드 | data-product-detail-starter | 실제 응답/권한/저장·출력/UX 수용 미확인 |
| content.divider-01 | 구분선 | 공통 요소/트리/typed 스타일/반응형/한 Undo | divider-section-break | 추가 제품 수용 미확인 |
| content.blockquote-01 | 인용문 | 공통 요소/트리/typed 스타일/반응형/한 Undo | blockquote-customer-voice | 추가 제품 수용 미확인 |
| content.notice-01 | 알림·안내 | 공통 요소/트리/typed 스타일/반응형/한 Undo | notice-service-info | 추가 제품 수용 미확인 |
| content.card-grid-01 | 카드 그리드 | 공통 요소/트리/typed 스타일/반응형/한 Undo | card-grid-* (5) | 추가 제품 수용 미확인 |
| navigation.breadcrumbs-01 | 경로 탐색 | 공통 요소/트리/typed 스타일/반응형/한 Undo | breadcrumbs-detail-page | 추가 제품 수용 미확인 |
| navigation.anchor-menu-01 | 섹션 바로가기 | 공통 요소/트리/typed 스타일/반응형/한 Undo | anchor-menu-starter | 추가 제품 동작/출력 수용 미확인 |
| navigation.social-links-01 | 소셜 링크 | 공통 요소/트리/typed 스타일/반응형/한 Undo | social-links-starter | 추가 제품 동작/출력 수용 미확인 |
| media.image-carousel-01 | 이미지 캐러셀 | 공통 요소 + BehaviorInspector/안정 ID 동작 | image-carousel-starter | 추가 제품 동작/출력 수용 미확인 |
| content.icon-01 | 아이콘 | 공통 요소/트리/typed 스타일/반응형/한 Undo | icon-starter | 추가 제품 동작/출력 수용 미확인 |
| content.list-01 | 목록 | 공통 요소/트리/typed 스타일/반응형/한 Undo | list-simple | 추가 제품 수용 미확인 |
| content.badge-01 | 배지 | 공통 요소/트리/typed 스타일/반응형/한 Undo | badge-starter | 추가 제품 동작/출력 수용 미확인 |
| content.card-01 | 카드 | 공통 요소/트리/typed 스타일/반응형/한 Undo | card-* (2) | 추가 제품 수용 미확인 |

## 전체 preset

모든 preset의 실행/편집 capability와 보호 경계는 위 소유 block 행을 따릅니다. 이름별 정밀 편집기를 만드는 계획이 아닙니다. 아래 항목들은 이번에 기존 문서로부터 변환하거나 실제 출력 감사를 수행한 목록이 아닙니다.

| preset ID | 소유 block | 인계 판정 |
|---|---|---|
| heading.section-intro | content.heading-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| heading.compact-title | content.heading-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| rich-text.article-intro | content.rich-text-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| rich-text.policy | content.rich-text-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| image.landscape | media.image-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| image.square | media.image-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| buttons.primary-secondary | action.buttons-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| buttons.centered-actions | action.buttons-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| image-text.product-story | media.image-text-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| image-text.company-story | media.image-text-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| icon-list.benefits | content.icon-list-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| icon-list.checklist | content.icon-list-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| hero.service-intro | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| features.core-benefits | content.features-grid-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| cta.contact | content.cta-split-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| contact.office | content.contact-info-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| faq.basic | content.faq-accordion-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| process.four-step | content.process-timeline-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero-split.product-focus | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero-slider.campaign | content.hero-slider-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| logo-cloud.partners | trust.logo-cloud-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| stats.business-proof | data.stats-icons-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| pricing.three-tier | commerce.pricing-tiers-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| team.leadership | company.team-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| gallery.project-scenes | media.gallery-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| bar-chart.quarterly | data.bar-chart-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| g7-posts.latest | g7.board-recent-posts-01 | 공통 capability 시작 데이터 제공; 기존 preset 디자인 이행·실제 수용 미확인 |
| g7-products.new | g7.ecommerce-product-grid-01 | 공통 capability 시작 데이터 제공; 기존 preset 디자인 이행·실제 수용 미확인 |
| inquiry.general | form.inquiry-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| map.office | location.map-directions-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| testimonials.customer-proof | trust.testimonials-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| tabs.service-guide | content.tabs-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| comparison.plans | commerce.comparison-table-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| articles.insights | content.article-list-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| video.product-tour | media.video-embed-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| logo-carousel.customers | trust.logo-carousel-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| testimonial-slider.spotlight | trust.testimonial-slider-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| events.upcoming | content.event-schedule-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| downloads.resource-center | content.download-resources-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| g7-archive.searchable | g7.board-content-archive-01 | 공통 capability 시작 데이터 제공; 기존 preset 디자인 이행·실제 수용 미확인 |
| g7-showcase.featured | g7.ecommerce-product-showcase-01 | 공통 capability 시작 데이터 제공; 기존 preset 디자인 이행·실제 수용 미확인 |
| g7-post-detail.featured | g7.board-post-detail-01 | 공통 capability 시작 데이터 제공; 기존 preset 디자인 이행·실제 수용 미확인 |
| g7-product-detail.featured | g7.ecommerce-product-detail-01 | 공통 capability 시작 데이터 제공; 기존 preset 디자인 이행·실제 수용 미확인 |
| divider.section-break | content.divider-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| blockquote.customer-voice | content.blockquote-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| notice.service-info | content.notice-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| card-grid.services | content.card-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| breadcrumbs.detail-page | navigation.breadcrumbs-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| anchor-menu.long-page | navigation.anchor-menu-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| social-links.official | navigation.social-links-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| image-carousel.space-tour | media.image-carousel-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| inquiry.quote | form.inquiry-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| inquiry.reservation | form.inquiry-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| inquiry.application | form.inquiry-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| inquiry.newsletter | form.inquiry-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero.poster | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero.backdrop | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero.editorial | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero.device | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero-split.balanced | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero-split.overlap | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| hero-split.offset | content.hero-centered-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| features.grid | content.features-grid-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| features.editorial | content.features-grid-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| features.panel | content.features-grid-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| features.list | content.features-grid-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| cta.centered | content.cta-split-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| cta.banner | content.cta-split-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| cta.panel | content.cta-split-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| logo-cloud.grid | trust.logo-cloud-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| logo-cloud.panel | trust.logo-cloud-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| stats.grid | data.stats-icons-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| stats.strip | data.stats-icons-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| stats.split | data.stats-icons-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| pricing.cards | commerce.pricing-tiers-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| pricing.compact | commerce.pricing-tiers-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| pricing.editorial | commerce.pricing-tiers-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| team.grid | company.team-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| team.editorial | company.team-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| team.featured | company.team-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| gallery.grid | media.gallery-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| gallery.masonry | media.gallery-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| gallery.filmstrip | media.gallery-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| testimonials.grid | trust.testimonials-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| testimonials.spotlight | trust.testimonials-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| testimonials.split | trust.testimonials-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| testimonials.quote-hero | trust.testimonials-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| articles.list | content.article-list-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| articles.grid | content.article-list-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| articles.featured | content.article-list-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| articles.editorial | content.article-list-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| card-grid.grid | content.card-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| card-grid.rail | content.card-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| card-grid.editorial | content.card-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| card-grid.numbered | content.card-grid-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| icon.simple | content.icon-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| list.simple | content.list-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |
| badge.simple | content.badge-01 | 공통 capability/시작 데이터 있음; 기존 preset 디자인/제품 수용 미확인 |
| card.empty | content.card-01 | 공통 capability 있음; 모든 preset 디자인/제품 수용은 미확인 |

## 감사 우선순위

DATA02 해소 후 검색/필터/페이지 조작 UI와 동적 6종 시작 데이터까지 소스 통합했습니다. 남은 것은 실제 데이터/UX·저장/출력 수용과 공개 runtime JS 예산 미달입니다. 검증은 확대하지 않았으며 현재 결과·실패·재감사 필요성은 [잔여 결과](2026-10-14-editor-remaining-implementation.md), 전체 이전 통합·독립 프로세스는 [종합 인계](2026-10-14-editor-implementation-handoff.md)에 있습니다.

17개 누락 시작 구성의 순수 문서 데이터 보완은 [구현 기록](2026-10-14-editor-starter-data.md)을 참고합니다. 블록별 편집 코드와 기존 문서 전환은 추가하지 않았습니다.
