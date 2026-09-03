import type { HeroSplitEditorProps, LogoCloudEditorProps, StatsEditorProps, PricingEditorProps, TeamEditorProps, GalleryEditorProps, HeroSliderEditorProps, BarChartEditorProps, G7RecentPostsEditorProps, G7ProductGridEditorProps, InquiryFormEditorProps, MapDirectionsEditorProps, PricingPlanEditor } from './catalogEditorTypes';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';
import type { HeroSlideItem, LogoItem, StatItem, TeamMemberItem, GalleryImageItem, BarChartItem } from '../documents/builtinBlockContracts';

export function heroSplitLayout(value: unknown): HeroSplitEditorProps['layout'] { return value === 'screenshot' || value === 'overlap' || value === 'offset' ? value : 'balanced'; }

export function logoLayout(value: unknown): LogoCloudEditorProps['layout'] { return value === 'grid' || value === 'panel' ? value : 'strip'; }

export function statsLayout(value: unknown): StatsEditorProps['layout'] { return value === 'editorial' || value === 'strip' || value === 'split' ? value : 'grid'; }

export function pricingLayout(value: unknown): PricingEditorProps['layout'] { return value === 'featured' || value === 'compact' || value === 'editorial' ? value : 'cards'; }

export function teamLayout(value: unknown): TeamEditorProps['layout'] { return value === 'portraits' || value === 'editorial' || value === 'featured' ? value : 'grid'; }

export function galleryLayout(value: unknown): GalleryEditorProps['layout'] { return value === 'bento' || value === 'masonry' || value === 'filmstrip' ? value : 'grid'; }

export const DEFAULT_HERO_SPLIT: HeroSplitEditorProps = {
  eyebrow: '제품 소개',
  title: '설명과 이미지를 균형 있게 보여주세요',
  body: '한쪽에는 핵심 메시지와 행동을, 다른 쪽에는 제품이나 공간 이미지를 배치합니다.',
  primaryLabel: '자세히 보기',
  primaryUrl: '/',
  imageSrc: '',
  imageAlt: '',
  mediaPosition: 'right',
  layout: 'screenshot',
  surface: 'default',
  spacing: 'spacious',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_HERO_SLIDER: HeroSliderEditorProps = {
  slides: [
    { eyebrow: '첫 번째 이야기', title: '대표 메시지를 선명하게', body: '핵심 캠페인이나 상품을 한 장면으로 소개합니다.', buttonLabel: '살펴보기', buttonUrl: '/', imageSrc: '', imageAlt: '' },
    { eyebrow: '두 번째 이야기', title: '다음 장면으로 이어지는 흐름', body: '서로 다른 메시지를 스크롤 가능한 슬라이드로 연결합니다.', buttonLabel: '더 알아보기', buttonUrl: '/about', imageSrc: '', imageAlt: '' },
  ],
  autoplay: 'yes',
  interval: '5000',
  loop: 'yes',
  surface: 'contrast',
  spacing: 'spacious',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_LOGO_CLOUD: LogoCloudEditorProps = {
  heading: '함께하는 브랜드와 파트너',
  logos: [
    { name: 'Acme', imageSrc: '', imageAlt: 'Acme 로고', url: '' },
    { name: 'Orbit', imageSrc: '', imageAlt: 'Orbit 로고', url: '' },
    { name: 'Northstar', imageSrc: '', imageAlt: 'Northstar 로고', url: '' },
    { name: 'Vertex', imageSrc: '', imageAlt: 'Vertex 로고', url: '' },
  ],
  layout: 'strip',
  surface: 'default',
  spacing: 'compact',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_STATS: StatsEditorProps = {
  eyebrow: '한눈에 보는 성과',
  heading: '숫자로 증명하는 핵심 지표',
  items: [
    { icon: 'users', value: '12,400+', label: '누적 사용자', detail: '서비스를 경험한 전체 사용자' },
    { icon: 'trend', value: '38%', label: '전환 증가', detail: '최근 분기 평균 개선 폭' },
    { icon: 'target', value: '99.9%', label: '가용성', detail: '지난 12개월 서비스 기준' },
  ],
  layout: 'editorial',
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_PRICING: PricingEditorProps = {
  eyebrow: '요금 안내',
  heading: '필요한 규모에 맞는 플랜',
  plans: [
    { name: 'Starter', price: '₩29,000', period: '/월', description: '작게 시작하는 팀', features: [{ text: '페이지 3개' }, { text: '기본 블록' }, { text: '이메일 지원' }], buttonLabel: '시작하기', buttonUrl: '/', featured: 'no' },
    { name: 'Growth', price: '₩79,000', period: '/월', description: '성장 중인 비즈니스', features: [{ text: '페이지 무제한' }, { text: '전체 블록' }, { text: '우선 지원' }], buttonLabel: 'Growth 선택', buttonUrl: '/', featured: 'yes' },
    { name: 'Business', price: '문의', period: '', description: '맞춤 운영이 필요한 조직', features: [{ text: '전용 설치' }, { text: '교육 지원' }, { text: '맞춤 계약' }], buttonLabel: '상담하기', buttonUrl: '/contact', featured: 'no' },
  ],
  layout: 'featured',
  surface: 'default',
  spacing: 'spacious',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_TEAM: TeamEditorProps = {
  eyebrow: '우리 팀',
  heading: '문제를 해결하는 사람들',
  members: [
    { name: '김하늘', role: '대표 · 제품', bio: '고객 문제를 제품 전략과 실행으로 연결합니다.', imageSrc: '', imageAlt: '', profileUrl: '' },
    { name: '이로운', role: '디자인', bio: '복잡한 흐름을 분명하고 편안한 경험으로 만듭니다.', imageSrc: '', imageAlt: '', profileUrl: '' },
    { name: '박지수', role: '개발', bio: '안전하게 확장되는 서비스 기반을 만듭니다.', imageSrc: '', imageAlt: '', profileUrl: '' },
  ],
  layout: 'portraits',
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_GALLERY: GalleryEditorProps = {
  eyebrow: '프로젝트',
  heading: '장면으로 살펴보는 작업',
  images: [
    { src: '', alt: '갤러리 이미지 1', caption: '프로젝트 장면 01' },
    { src: '', alt: '갤러리 이미지 2', caption: '프로젝트 장면 02' },
    { src: '', alt: '갤러리 이미지 3', caption: '프로젝트 장면 03' },
    { src: '', alt: '갤러리 이미지 4', caption: '프로젝트 장면 04' },
  ],
  columns: '3',
  layout: 'bento',
  surface: 'default',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_BAR_CHART: BarChartEditorProps = {
  eyebrow: '데이터',
  heading: '분기별 핵심 지표',
  description: '검증된 숫자 데이터를 간단한 막대그래프로 비교합니다.',
  unit: '%',
  items: [
    { label: '1분기', value: 42, tone: 'blue' },
    { label: '2분기', value: 61, tone: 'indigo' },
    { label: '3분기', value: 74, tone: 'emerald' },
    { label: '4분기', value: 88, tone: 'amber' },
  ],
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_G7_RECENT_POSTS: G7RecentPostsEditorProps = {
  eyebrow: '커뮤니티', heading: '최근 게시글', source: 'recent', period: 'week', limit: '6', pageSize: '3', audience: 'all',
  emptyMessage: '표시할 게시글이 없습니다.', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_G7_PRODUCT_GRID: G7ProductGridEditorProps = {
  eyebrow: '스토어', heading: '새로운 상품', source: 'new', limit: '4', columns: '4', pageSize: '4', audience: 'all',
  detailBasePath: '/shop/products', emptyMessage: '표시할 상품이 없습니다.',
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_INQUIRY_FORM: InquiryFormEditorProps = {
  eyebrow: '문의하기', heading: '무엇을 도와드릴까요?', description: '내용을 남겨주시면 확인 후 연락드리겠습니다.',
  formKind: 'inquiry', submitLabel: '문의 보내기', successMessage: '문의가 접수되었습니다. 빠르게 확인하겠습니다.',
  privacyLabel: '문의 처리를 위한 개인정보 수집 및 이용에 동의합니다.', showPhone: true, showSubject: true,
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_MAP_DIRECTIONS: MapDirectionsEditorProps = {
  eyebrow: '오시는 길', heading: '방문을 환영합니다', description: '아래 주소와 교통 정보를 확인해 주세요.',
  address: '서울특별시 중구 세종대로 110', latitude: 37.5665, longitude: 126.978, zoom: '16', provider: 'image',
  mapImageSrc: '', mapImageAlt: '',
  directionsLabel: '길찾기', directionsUrl: 'https://www.openstreetmap.org/', phone: '02-0000-0000', hours: '평일 09:00–18:00', parking: '방문객 주차 가능',
  surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

export function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') return trimmed;
  } catch {
    return null;
  }
  return null;
}

function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>) => T): T[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, max).map((item) => map(asRecord(item)));
}

export function normalizeHeroSlides(value: unknown): HeroSlideItem[] {
  return normalizeArray(value, DEFAULT_HERO_SLIDER.slides, 5, (item) => ({
    eyebrow: asString(item.eyebrow), title: asString(item.title), body: asString(item.body),
    buttonLabel: asString(item.buttonLabel), buttonUrl: asString(item.buttonUrl),
    imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt),
  }));
}

export function normalizeLogos(value: unknown): LogoItem[] {
  return normalizeArray(value, DEFAULT_LOGO_CLOUD.logos, 12, (item) => ({
    name: asString(item.name), imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt), url: asString(item.url),
  }));
}

export function normalizeStats(value: unknown): StatItem[] {
  return normalizeArray(value, DEFAULT_STATS.items, 6, (item) => ({
    icon: ['trend', 'users', 'target', 'chart'].includes(asString(item.icon)) ? asString(item.icon) : 'chart',
    value: asString(item.value), label: asString(item.label), detail: asString(item.detail),
  }));
}

export function normalizePricingEditor(value: unknown): PricingPlanEditor[] {
  const fallback = DEFAULT_PRICING.plans;
  return normalizeArray(value, fallback, 4, (item) => ({
    name: asString(item.name), price: asString(item.price), period: asString(item.period), description: asString(item.description),
    features: Array.isArray(item.features)
      ? item.features.slice(0, 12).map((feature) => typeof feature === 'string'
        ? { text: feature }
        : { text: asString(asRecord(feature).text) })
      : asString(item.featuresText).split('\n').map((text) => ({ text: text.trim() })).filter((feature) => feature.text),
    buttonLabel: asString(item.buttonLabel), buttonUrl: asString(item.buttonUrl),
    featured: item.featured === true || item.featured === 'yes' ? 'yes' : 'no',
  }));
}

export function normalizeMembers(value: unknown): TeamMemberItem[] {
  return normalizeArray(value, DEFAULT_TEAM.members, 8, (item) => ({
    name: asString(item.name), role: asString(item.role), bio: asString(item.bio), imageSrc: asString(item.imageSrc),
    imageAlt: asString(item.imageAlt), profileUrl: asString(item.profileUrl),
  }));
}

export function normalizeImages(value: unknown): GalleryImageItem[] {
  return normalizeArray(value, DEFAULT_GALLERY.images, 12, (item) => ({
    src: asString(item.src), alt: asString(item.alt), caption: asString(item.caption),
  }));
}

export function normalizeBars(value: unknown): BarChartItem[] {
  return normalizeArray(value, DEFAULT_BAR_CHART.items, 8, (item) => ({
    label: asString(item.label),
    value: typeof item.value === 'number' && Number.isFinite(item.value) ? Math.min(100, Math.max(0, item.value)) : 0,
    tone: item.tone === 'indigo' || item.tone === 'emerald' || item.tone === 'amber' ? item.tone : 'blue',
  }));
}
