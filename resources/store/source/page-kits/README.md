# Official Page Kit benchmark and scope

조사일: 2026-08-22

공식 Page Kit은 블록을 임의로 나열하지 않고, 경쟁 제품의 공식 템플릿 분류와 반복되는 페이지 흐름을 근거로 선정한다. 경쟁사 디자인이나 자산은 복제하지 않으며 G7 Page Builder의 기존 블록 계약으로 다시 구성한다.

## Benchmark evidence

| 공식 제품 자료 | 확인한 제품 패턴 | 이 저장소에 반영한 범위 |
| --- | --- | --- |
| [Elementor Template Library](https://elementor.com/help/adding-templates/) | 단일 Block과 전체 Page를 구분 | Page Kit은 여러 블록을 조합한 완성 초안으로 제공 |
| [Elementor Website Kits](https://elementor.com/help/selecting-an-elementor-site-kit/) · [Kit parts](https://elementor.com/help/apply-selected-parts-kit/) | 전체 사이트 킷은 페이지, 사이트 파트, 글로벌 설정을 선택 적용 | MVP Page Kit은 페이지 문서와 묶음 이미지만 포함하고 G7 사이트 파트는 덮어쓰지 않음 |
| [Elementor local services wireframe](https://library.elementor.com/local-services-wireframe-3-flexbox/) | 서비스 소개, 핵심 장점, 선택 이유, 후기, 문의 CTA가 반복 | 전문 서비스 상담 랜딩 |
| [Wix Events templates](https://www.wix.com/website/templates/html/events) | 행사 소개, 일정, 연사, 참가 신청이 핵심 흐름 | 컨퍼런스·행사 랜딩 |
| [Wix Blog templates](https://www.wix.com/website/templates/html/blog) | 대표 콘텐츠, 분류·최신 콘텐츠, 구독 유도가 반복 | 에디토리얼·커뮤니티 홈 |
| [Wix local business example](https://www.wix.com/website-template/view/html/2687) · [Squarespace Local Business](https://www.squarespace.com/templates/browse/v7/local-business) | 서비스, 공간·사진, 사업 정보, 위치, 예약 행동이 결합 | 로컬 비즈니스 방문 안내 |
| [Webflow template categories](https://webflow.com/templates/categories) · [Framer template categories](https://www.framer.com/community/marketplace/templates/categories/) | Business, portfolio, event, blog 등 목적별 진입이 공통 | 범용 업종 수집 대신 재사용성이 높은 목적 5종으로 제한 |

## Selected inventory

| Page Kit | Visual thesis | Content plan | Interaction thesis |
| --- | --- | --- | --- |
| 회사 소개 랜딩 | 밝고 신뢰감 있는 팀 사진과 파란 계열의 구조적 화면 | 가치 제안 → 일하는 방식 → 성과 → 팀 → 후기 → 문의 | 히어로의 약한 시차, 지표 카운트, 목록 순차 노출 |
| 전문 서비스 상담 랜딩 | 차분한 상담 장면과 절제된 슬레이트 화면 | 문제 정의 → 제공 가치 → 진행 방식 → 후기 → FAQ → 상담 | 상담 CTA를 처음과 끝에 두고 FAQ만 사용자가 펼침 |
| 로컬 비즈니스 방문 안내 | 따뜻한 공간 사진과 에메랄드 계열의 친근한 화면 | 서비스 → 이용 순서 → 후기 → 위치 → 예약 | 길찾기와 예약을 핵심 행동으로 제한 |
| 컨퍼런스·행사 랜딩 | 무대 사진, 큰 제목, 로즈 포인트의 역동적 화면 | 행사 가치 → 핵심 수치 → 일정 → 연사 → 파트너 → FAQ → 신청 | 일정과 연사를 순차 노출하고 참가 신청으로 수렴 |
| 에디토리얼·커뮤니티 홈 | 다큐멘터리형 편집 사진과 세리프 중심의 읽기 화면 | 대표 이야기 → 기사 → 지역 일정 → 자료 → 뉴스레터 | 콘텐츠 탐색 링크와 구독 행동만 남김 |

## Product boundary

- 각 Page Kit은 적용 시 새 미발행 초안을 만든다. 기존 페이지와 Header·Footer Site Part를 덮어쓰지 않는다.
- 기존 내장 블록만 사용하며 새 런타임 의존성, 범용 폼 빌더, 업종별 앱 기능을 추가하지 않는다.
- 버튼은 별도 디자인 시스템 상품으로 확장하지 않고 Hero, CTA, 일정, 자료, 폼 등 실제 문맥의 경로 필드로 제공한다.
- 로컬 비즈니스의 지도는 기존 지도·오시는 길 블록과 외부 길찾기 URL만 사용하며 예약 엔진을 포함하지 않는다.

## Asset provenance

- Hero 이미지는 이 저장소의 공식 무료 Page Kit용으로 OpenAI 내장 ImageGen에서 새로 생성했다.
- 경쟁사 이미지, 로고, 문구 또는 레이아웃을 복사하지 않았다.
- 최종 자산은 텍스트와 로고가 없는 1600×900 WebP이며 각 Page Kit ZIP에 한 장씩 포함한다.
