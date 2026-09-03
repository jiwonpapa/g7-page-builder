import type { Config } from '@puckeditor/core';
import type { CatalogEditorComponents } from './catalogEditorTypes';
import { createInlineRichTextField, createRichTextField } from './richTextEditing';
import { createRouteUrlField } from './RouteUrlField';
import { createMediaField } from './MediaPickerField';
import { createMotionField } from './blockMotion';

const SURFACE_OPTIONS = [
  { label: '기본', value: 'default' },
  { label: '부드럽게', value: 'soft' },
  { label: '강조', value: 'contrast' },
];

const SPACING_OPTIONS = [
  { label: '좁게', value: 'compact' },
  { label: '기본', value: 'normal' },
  { label: '넓게', value: 'spacious' },
];

const STAT_ICON_OPTIONS = [
  { label: '상승', value: 'trend' },
  { label: '사용자', value: 'users' },
  { label: '목표', value: 'target' },
  { label: '차트', value: 'chart' },
];

const HERO_SPLIT_LAYOUT_OPTIONS = [
  { label: '균형 분할', value: 'balanced' }, { label: '제품 스크린샷', value: 'screenshot' },
  { label: '이미지 겹침', value: 'overlap' }, { label: '비대칭 오프셋', value: 'offset' },
];

const LOGO_LAYOUT_OPTIONS = [{ label: '가로 띠', value: 'strip' }, { label: '로고 그리드', value: 'grid' }, { label: '신뢰 패널', value: 'panel' }];

const STATS_LAYOUT_OPTIONS = [{ label: '지표 그리드', value: 'grid' }, { label: '가로 띠', value: 'strip' }, { label: '제목 분할', value: 'split' }, { label: '에디토리얼', value: 'editorial' }];

const PRICING_LAYOUT_OPTIONS = [{ label: '요금 카드', value: 'cards' }, { label: '추천 강조', value: 'featured' }, { label: '간결 비교', value: 'compact' }, { label: '에디토리얼', value: 'editorial' }];

const TEAM_LAYOUT_OPTIONS = [{ label: '팀 그리드', value: 'grid' }, { label: '인물 중심', value: 'portraits' }, { label: '에디토리얼', value: 'editorial' }, { label: '대표 인물', value: 'featured' }];

const GALLERY_LAYOUT_OPTIONS = [{ label: '균등 그리드', value: 'grid' }, { label: '벤토', value: 'bento' }, { label: '메이슨리', value: 'masonry' }, { label: '필름 스트립', value: 'filmstrip' }];

export const heroSplitFields: Config<CatalogEditorComponents>['components']['HeroSplit']['fields'] = {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, title: createInlineRichTextField('제목'), body: createRichTextField('본문', 160, true),
      primaryLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, primaryUrl: createRouteUrlField('버튼 연결', 'page-builder-hero-split-primary-url'), imageSrc: createMediaField('대표 이미지', 'hero-split-image'), imageAlt: { type: 'text', label: '이미지 대체 텍스트' },
      mediaPosition: { type: 'radio', label: '이미지 위치', options: [{ label: '왼쪽', value: 'left' }, { label: '오른쪽', value: 'right' }] },
      layout: { type: 'select', label: '레이아웃', options: HERO_SPLIT_LAYOUT_OPTIONS },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS },
      motion: createMotionField(['none', 'reveal', 'parallax-soft']),
    };

export const heroSliderFields: Config<CatalogEditorComponents>['components']['HeroSlider']['fields'] = {
      slides: { type: 'array', label: '슬라이드', min: 2, max: 5, defaultItemProps: (index) => ({ eyebrow: `슬라이드 ${index + 1}`, title: '새로운 메시지', body: '슬라이드 설명을 입력하세요.', buttonLabel: '자세히 보기', buttonUrl: '/', imageSrc: '', imageAlt: '' }), getItemSummary: (item, index) => item.title || `슬라이드 ${(index ?? 0) + 1}`, arrayFields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, title: createInlineRichTextField('제목'), body: createRichTextField('본문', 150), buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, buttonUrl: createRouteUrlField('버튼 연결'), imageSrc: createMediaField('슬라이드 이미지'), imageAlt: { type: 'text', label: '이미지 대체 텍스트' } } },
      autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: 'yes' }, { label: '사용 안 함', value: 'no' }] },
      interval: { type: 'select', label: '자동 재생 간격', options: [{ label: '3초', value: '3000' }, { label: '5초', value: '5000' }, { label: '7초', value: '7000' }] },
      loop: { type: 'radio', label: '무한 반복', options: [{ label: '사용', value: 'yes' }, { label: '사용 안 함', value: 'no' }] },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS },
      motion: createMotionField(['none', 'reveal', 'parallax-soft']),
    };

export const logoCloudFields: Config<CatalogEditorComponents>['components']['LogoCloud']['fields'] = { heading: createInlineRichTextField('제목'), logos: { type: 'array', label: '로고', min: 2, max: 12, defaultItemProps: (index) => ({ name: `파트너 ${index + 1}`, imageSrc: '', imageAlt: '', url: '' }), getItemSummary: (item) => item.name, arrayFields: { name: { type: 'text', label: '이름', contentEditable: true }, imageSrc: createMediaField('로고 이미지'), imageAlt: { type: 'text', label: '대체 텍스트' }, url: createRouteUrlField('연결 경로') } }, layout: { type: 'select', label: '레이아웃', options: LOGO_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) };

export const statsFields: Config<CatalogEditorComponents>['components']['Stats']['fields'] = { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), items: { type: 'array', label: '지표', min: 2, max: 6, defaultItemProps: (index) => ({ icon: 'chart', value: '0', label: `지표 ${index + 1}`, detail: '지표 설명' }), getItemSummary: (item) => `${item.value} ${item.label}`, arrayFields: { icon: { type: 'select', label: '아이콘', options: STAT_ICON_OPTIONS }, value: { type: 'text', label: '값', contentEditable: true }, label: createInlineRichTextField('이름'), detail: createRichTextField('설명', 120) } }, layout: { type: 'select', label: '레이아웃', options: STATS_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger', 'counter']) };

export const pricingFields: Config<CatalogEditorComponents>['components']['Pricing']['fields'] = { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), plans: { type: 'array', label: '플랜', min: 2, max: 4, defaultItemProps: (index) => ({ name: `Plan ${index + 1}`, price: '₩0', period: '/월', description: '플랜 설명', features: [{ text: '기능 1' }, { text: '기능 2' }], buttonLabel: '선택하기', buttonUrl: '/', featured: 'no' }), getItemSummary: (item) => `${item.name} · ${item.price}`, arrayFields: { name: createInlineRichTextField('플랜명'), price: { type: 'text', label: '가격', contentEditable: true }, period: { type: 'text', label: '기간', contentEditable: true }, description: createRichTextField('설명', 130), features: { type: 'array', label: '기능 목록', min: 1, max: 12, defaultItemProps: (index) => ({ text: `기능 ${index + 1}` }), getItemSummary: (item) => item.text, arrayFields: { text: createInlineRichTextField('기능') } }, buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, buttonUrl: createRouteUrlField('버튼 연결'), featured: { type: 'radio', label: '추천 플랜', options: [{ label: '일반', value: 'no' }, { label: '추천', value: 'yes' }] } } }, layout: { type: 'select', label: '레이아웃', options: PRICING_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) };

export const teamFields: Config<CatalogEditorComponents>['components']['Team']['fields'] = { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), members: { type: 'array', label: '구성원', min: 2, max: 8, defaultItemProps: (index) => ({ name: `구성원 ${index + 1}`, role: '역할', bio: '소개를 입력하세요.', imageSrc: '', imageAlt: '', profileUrl: '' }), getItemSummary: (item) => `${item.name} · ${item.role}`, arrayFields: { name: { type: 'text', label: '이름', contentEditable: true }, role: { type: 'text', label: '역할', contentEditable: true }, bio: createRichTextField('소개', 130), imageSrc: createMediaField('프로필 사진'), imageAlt: { type: 'text', label: '대체 텍스트' }, profileUrl: createRouteUrlField('프로필 연결') } }, layout: { type: 'select', label: '레이아웃', options: TEAM_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) };

export const galleryFields: Config<CatalogEditorComponents>['components']['Gallery']['fields'] = { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }, { label: '4열', value: '4' }] }, images: { type: 'array', label: '이미지', min: 2, max: 12, defaultItemProps: (index) => ({ src: '', alt: `갤러리 이미지 ${index + 1}`, caption: `장면 ${index + 1}` }), getItemSummary: (item, index) => item.caption || `이미지 ${(index ?? 0) + 1}`, arrayFields: { src: createMediaField('갤러리 이미지'), alt: { type: 'text', label: '대체 텍스트' }, caption: { type: 'text', label: '캡션', contentEditable: true } } }, layout: { type: 'select', label: '레이아웃', options: GALLERY_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger', 'parallax-soft']) };

export const barChartFields: Config<CatalogEditorComponents>['components']['BarChart']['fields'] = { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), description: createRichTextField('설명', 130), unit: { type: 'text', label: '단위', contentEditable: true }, items: { type: 'array', label: '데이터', min: 2, max: 8, defaultItemProps: (index) => ({ label: `항목 ${index + 1}`, value: 50, tone: 'blue' }), getItemSummary: (item) => `${item.label} · ${item.value}`, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, value: { type: 'number', label: '값(0~100)', min: 0, max: 100 }, tone: { type: 'select', label: '색상 프리셋', options: [{ label: '파랑', value: 'blue' }, { label: '남색', value: 'indigo' }, { label: '초록', value: 'emerald' }, { label: '노랑', value: 'amber' }] } } }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'chart-draw']) };

export const g7RecentPostsFields: Config<CatalogEditorComponents>['components']['G7RecentPosts']['fields'] = {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'),
      source: { type: 'radio', label: '게시글 기준', options: [{ label: '최신글', value: 'recent' }, { label: '인기글', value: 'popular' }] },
      period: { type: 'select', label: '인기글 기간', options: [{ label: '오늘', value: 'today' }, { label: '이번 주', value: 'week' }, { label: '이번 달', value: 'month' }, { label: '최근 1년', value: 'year' }] },
      limit: { type: 'select', label: '불러올 개수', options: ['3', '4', '6', '8', '12'].map((value) => ({ label: `${value}개`, value })) },
      pageSize: { type: 'select', label: '페이지당 개수', options: ['3', '4', '6'].map((value) => ({ label: `${value}개`, value })) },
      audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] },
      emptyMessage: { type: 'text', label: '빈 상태 문구' }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']),
    };

export const g7ProductGridFields: Config<CatalogEditorComponents>['components']['G7ProductGrid']['fields'] = {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'),
      source: { type: 'select', label: '상품 기준', options: [{ label: '최신순', value: 'latest' }, { label: '신상품', value: 'new' }, { label: '인기 상품', value: 'popular' }] },
      limit: { type: 'select', label: '불러올 개수', options: ['2', '3', '4', '6', '8', '12'].map((value) => ({ label: `${value}개`, value })) },
      pageSize: { type: 'select', label: '페이지당 개수', options: ['2', '3', '4', '6'].map((value) => ({ label: `${value}개`, value })) },
      columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }, { label: '4열', value: '4' }] },
      audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] },
      detailBasePath: { type: 'text', label: '상품 상세 기본 경로' }, emptyMessage: { type: 'text', label: '빈 상태 문구' },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']),
    };

export const inquiryFormFields: Config<CatalogEditorComponents>['components']['InquiryForm']['fields'] = {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), description: createRichTextField('설명', 140),
      formKind: { type: 'select', label: '폼 용도', options: [{ label: '일반 문의', value: 'inquiry' }, { label: '견적 요청', value: 'quote' }, { label: '예약', value: 'reservation' }, { label: '신청', value: 'application' }, { label: '뉴스레터', value: 'newsletter' }] },
      submitLabel: { type: 'text', label: '제출 버튼 문구', contentEditable: true }, successMessage: { type: 'text', label: '접수 완료 문구' }, privacyLabel: { type: 'textarea', label: '개인정보 동의 문구', contentEditable: true },
      showPhone: { type: 'radio', label: '전화번호', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] }, showSubject: { type: 'radio', label: '문의 제목', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal']),
    };

export const mapDirectionsFields: Config<CatalogEditorComponents>['components']['MapDirections']['fields'] = {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), description: createRichTextField('설명', 140), address: { type: 'text', label: '주소', contentEditable: true },
      latitude: { type: 'number', label: '위도', min: -90, max: 90 }, longitude: { type: 'number', label: '경도', min: -180, max: 180 }, zoom: { type: 'select', label: '지도 확대', options: ['12', '14', '16', '18'].map((value) => ({ label: `${value} 단계`, value })) },
      provider: { type: 'radio', label: '지도 표시 방식', options: [{ label: '지도 이미지 (권장)', value: 'image' }, { label: 'OpenStreetMap', value: 'openstreetmap' }, { label: 'Google', value: 'google' }, { label: '표시 안 함', value: 'none' }] },
      mapImageSrc: createMediaField('지도 이미지', 'map-directions-image'), mapImageAlt: { type: 'text', label: '지도 이미지 대체 텍스트' },
      directionsLabel: { type: 'text', label: '길찾기 버튼 문구', contentEditable: true }, directionsUrl: createRouteUrlField('길찾기 연결'), phone: { type: 'text', label: '전화번호', contentEditable: true }, hours: { type: 'textarea', label: '운영 시간', contentEditable: true }, parking: { type: 'textarea', label: '주차 안내', contentEditable: true },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal']),
    };
