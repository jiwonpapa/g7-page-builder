import type { DownloadResourceItem, EventScheduleItem, LogoItem, TestimonialItem } from '../documents/types';
import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';

export interface LogoCarouselEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  logos: LogoItem[];
  autoplay: 'yes' | 'no';
  interval: '3000' | '5000' | '7000';
}

export interface TestimonialSliderEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: TestimonialItem[];
  autoplay: 'yes' | 'no';
  interval: '5000' | '7000' | '9000';
}

export interface EventScheduleEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: EventScheduleItem[];
  layout: 'agenda' | 'timeline';
}

export interface DownloadResourcesEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: DownloadResourceItem[];
}

export interface G7BoardArchiveEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: '6' | '8' | '12';
  pageSize: '3' | '4' | '6';
  audience: 'all' | 'guest' | 'member';
  showSearch: boolean;
  showBoardFilter: boolean;
  emptyMessage: string;
}

export interface G7ProductShowcaseEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'latest' | 'new' | 'popular';
  limit: '3' | '4' | '6' | '8';
  pageSize: '3' | '4';
  audience: 'all' | 'guest' | 'member';
  detailBasePath: string;
  layout: 'featured' | 'rail';
  emptyMessage: string;
}

export interface Phase3CatalogEditorComponents {
  LogoCarousel: LogoCarouselEditorProps;
  TestimonialSlider: TestimonialSliderEditorProps;
  EventSchedule: EventScheduleEditorProps;
  DownloadResources: DownloadResourcesEditorProps;
  G7BoardArchive: G7BoardArchiveEditorProps;
  G7ProductShowcase: G7ProductShowcaseEditorProps;
}

export type Phase3ComponentType = keyof Phase3CatalogEditorComponents;

const DEFAULT_LOGOS: LogoItem[] = [
  { name: 'Orbit', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Northstar', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Vertex', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Morrow', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Layer', imageSrc: '', imageAlt: '', url: '/' },
];

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  { quote: '필요한 정보를 찾고 페이지를 운영하는 시간이 크게 줄었습니다.', name: '김민서', role: '브랜드 매니저', company: '오르빗', avatarSrc: '', avatarAlt: '', rating: 5 },
  { quote: '모바일에서도 메시지가 선명하고 수정 흐름이 자연스럽습니다.', name: '이도윤', role: '운영 리드', company: '노스스타', avatarSrc: '', avatarAlt: '', rating: 5 },
  { quote: '정해진 디자인 언어 안에서 빠르게 결과를 만들 수 있습니다.', name: '박서연', role: '디자이너', company: '버텍스', avatarSrc: '', avatarAlt: '', rating: 4 },
];

const DEFAULT_EVENTS: EventScheduleItem[] = [
  { date: '2026-09-03', time: '14:00', title: '제품 소개 웨비나', location: '온라인', description: '핵심 기능과 실제 제작 흐름을 살펴봅니다.', buttonLabel: '참가 신청', buttonUrl: '/' },
  { date: '2026-09-12', time: '11:00', title: '운영자 워크숍', location: '서울 스튜디오', description: '콘텐츠 구조와 발행 운영 방법을 함께 실습합니다.', buttonLabel: '자세히 보기', buttonUrl: '/' },
  { date: '2026-09-24', time: '16:00', title: '업데이트 브리핑', location: '온라인', description: '새로운 블록과 데이터 연결 기능을 소개합니다.', buttonLabel: '일정 확인', buttonUrl: '/' },
];

const DEFAULT_DOWNLOADS: DownloadResourceItem[] = [
  { title: '서비스 소개서', description: '핵심 기능과 적용 사례를 한눈에 확인합니다.', fileType: 'PDF', fileSize: '2.4 MB', buttonLabel: '다운로드', url: '/' },
  { title: '운영 체크리스트', description: '발행 전에 확인할 항목을 정리했습니다.', fileType: 'PDF', fileSize: '780 KB', buttonLabel: '다운로드', url: '/' },
  { title: '브랜드 에셋', description: '로고와 기본 사용 지침을 제공합니다.', fileType: 'ZIP', fileSize: '6.8 MB', buttonLabel: '받기', url: '/' },
];

export const DEFAULT_LOGO_CAROUSEL: LogoCarouselEditorProps = { eyebrow: '함께하는 브랜드', heading: '신뢰받는 팀이 선택했습니다', logos: DEFAULT_LOGOS, autoplay: 'yes', interval: '5000', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION } };

export const DEFAULT_TESTIMONIAL_SLIDER: TestimonialSliderEditorProps = { eyebrow: '고객 이야기', heading: '운영 현장에서 확인한 변화', items: DEFAULT_TESTIMONIALS, autoplay: 'yes', interval: '7000', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };

export const DEFAULT_EVENT_SCHEDULE: EventScheduleEditorProps = { eyebrow: '다가오는 일정', heading: '만나고 배우는 시간', items: DEFAULT_EVENTS, layout: 'agenda', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };

export const DEFAULT_DOWNLOADS_BLOCK: DownloadResourcesEditorProps = { eyebrow: '자료실', heading: '필요한 자료를 바로 받아보세요', items: DEFAULT_DOWNLOADS, surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };

export const DEFAULT_BOARD_ARCHIVE: G7BoardArchiveEditorProps = { eyebrow: '콘텐츠 아카이브', heading: '관심 있는 이야기를 찾아보세요', source: 'recent', period: 'month', limit: '12', pageSize: '6', audience: 'all', showSearch: true, showBoardFilter: true, emptyMessage: '조건에 맞는 게시글이 없습니다.', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };

export const DEFAULT_PRODUCT_SHOWCASE: G7ProductShowcaseEditorProps = { eyebrow: '추천 상품', heading: '지금 주목할 상품', source: 'new', limit: '6', pageSize: '3', audience: 'all', detailBasePath: '/shop/products', layout: 'featured', emptyMessage: '표시할 상품이 없습니다.', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };

export function asRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export function asString(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }

function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>) => T): T[] { return (Array.isArray(value) ? value : fallback).slice(0, max).map((item) => map(asRecord(item))); }

export function normalizeLogos(value: unknown): LogoItem[] { return normalizeArray(value, DEFAULT_LOGOS, 12, (item) => ({ name: asString(item.name), imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt), url: asString(item.url) })); }

export function normalizeTestimonials(value: unknown): TestimonialItem[] { return normalizeArray(value, DEFAULT_TESTIMONIALS, 8, (item) => ({ quote: asString(item.quote), name: asString(item.name), role: asString(item.role), company: asString(item.company), avatarSrc: asString(item.avatarSrc), avatarAlt: asString(item.avatarAlt), rating: ([1, 2, 3, 4, 5].includes(Number(item.rating)) ? Number(item.rating) : 5) as TestimonialItem['rating'] })); }

export function normalizeEvents(value: unknown): EventScheduleItem[] { return normalizeArray(value, DEFAULT_EVENTS, 12, (item) => ({ date: asString(item.date), time: asString(item.time), title: asString(item.title), location: asString(item.location), description: asString(item.description), buttonLabel: asString(item.buttonLabel), buttonUrl: asString(item.buttonUrl) })); }

export function normalizeDownloads(value: unknown): DownloadResourceItem[] { return normalizeArray(value, DEFAULT_DOWNLOADS, 12, (item) => ({ title: asString(item.title), description: asString(item.description), fileType: asString(item.fileType), fileSize: asString(item.fileSize), buttonLabel: asString(item.buttonLabel), url: asString(item.url) })); }
