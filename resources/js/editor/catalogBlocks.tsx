import React, { useState } from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame as BlockFrame } from './CatalogBlockFrame';
import {
  createMotionField,
} from './blockMotion';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import { CatalogIcon, type CatalogIconName } from './catalogIcon';
import { DEFAULT_BLOCK_MOTION, normalizeBlockMotion } from './blockMotionData';
import { appearance as normalizeCatalogAppearance, attachAppearance } from './catalogAppearance';
import {
  canonicalPhase2BlockToPuck,
  phase2CatalogComponentConfigs,
  phase2PuckBlockToCanonical,
  type Phase2CatalogEditorComponents,
} from './phase2CatalogBlocks';
import {
  canonicalPhase3BlockToPuck,
  phase3CatalogComponentConfigs,
  phase3PuckBlockToCanonical,
  type Phase3CatalogEditorComponents,
} from './phase3CatalogBlocks';
import {
  canonicalPhase4BlockToPuck,
  phase4CatalogComponentConfigs,
  phase4PuckBlockToCanonical,
  type Phase4CatalogEditorComponents,
} from './phase4CatalogBlocks';
import {
  foundationCatalogComponentConfigs,
  type FoundationCatalogEditorComponents,
} from './foundationCatalogBlocks';
import { canonicalFoundationBlockToPuck, foundationPuckBlockToCanonical } from './foundationCatalogCodec';
import {
  canonicalProductionBlockToPuck,
  productionCatalogComponentConfigs,
  productionPuckBlockToCanonical,
  type ProductionCatalogEditorComponents,
} from './productionCatalogBlocks';

import {
  BAR_CHART_BLOCK_TYPE,
  GALLERY_BLOCK_TYPE,
  G7_PRODUCT_GRID_BLOCK_TYPE,
  G7_RECENT_POSTS_BLOCK_TYPE,
  HERO_SLIDER_BLOCK_TYPE,
  HERO_SPLIT_BLOCK_TYPE,
  INQUIRY_FORM_BLOCK_TYPE,
  LOGO_CLOUD_BLOCK_TYPE,
  MAP_DIRECTIONS_BLOCK_TYPE,
  PRICING_BLOCK_TYPE,
  STATS_BLOCK_TYPE,
  TEAM_BLOCK_TYPE,
  type BarChartItem,
  type BlockAppearance,
  type BlockMotion,
  type ElementAppearanceMap,
  type GalleryImageItem,
  type HeroSlideItem,
  type InquiryFormKind,
  type LogoItem,
  type PageBuilderBlock,
  type PricingPlanItem,
  type StatItem,
  type TeamMemberItem,
} from '../documents/types';

interface AppearanceEditorProps {
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
}

export interface HeroSplitEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  imageSrc: string;
  imageAlt: string;
  mediaPosition: 'left' | 'right';
  layout: 'balanced' | 'screenshot' | 'overlap' | 'offset';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface HeroSliderEditorProps extends AppearanceEditorProps {
  slides: HeroSlideItem[];
  autoplay: 'yes' | 'no';
  interval: '3000' | '5000' | '7000';
  loop: 'yes' | 'no';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface LogoCloudEditorProps extends AppearanceEditorProps {
  heading: string;
  logos: LogoItem[];
  layout: 'strip' | 'grid' | 'panel';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface StatsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: StatItem[];
  layout: 'grid' | 'strip' | 'split' | 'editorial';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface PricingFeatureEditor {
  text: string;
}

interface PricingPlanEditor extends Omit<PricingPlanItem, 'features' | 'featured'> {
  features: PricingFeatureEditor[];
  featured: 'yes' | 'no';
}

export interface PricingEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  plans: PricingPlanEditor[];
  layout: 'cards' | 'featured' | 'compact' | 'editorial';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface TeamEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  members: TeamMemberItem[];
  layout: 'grid' | 'portraits' | 'editorial' | 'featured';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface GalleryEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  images: GalleryImageItem[];
  columns: '2' | '3' | '4';
  layout: 'grid' | 'bento' | 'masonry' | 'filmstrip';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface BarChartEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  unit: string;
  items: BarChartItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface G7RecentPostsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: '3' | '4' | '6' | '8' | '12';
  pageSize: '3' | '4' | '6';
  audience: 'all' | 'guest' | 'member';
  emptyMessage: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface G7ProductGridEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'latest' | 'new' | 'popular';
  limit: '2' | '3' | '4' | '6' | '8' | '12';
  columns: '2' | '3' | '4';
  pageSize: '2' | '3' | '4' | '6';
  audience: 'all' | 'guest' | 'member';
  detailBasePath: string;
  emptyMessage: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface InquiryFormEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  formKind: InquiryFormKind;
  submitLabel: string;
  successMessage: string;
  privacyLabel: string;
  showPhone: boolean;
  showSubject: boolean;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface MapDirectionsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  zoom: '12' | '14' | '16' | '18';
  provider: 'image' | 'openstreetmap' | 'google' | 'none';
  mapImageSrc: string;
  mapImageAlt: string;
  directionsLabel: string;
  directionsUrl: string;
  phone: string;
  hours: string;
  parking: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface CatalogEditorComponents extends FoundationCatalogEditorComponents, Phase2CatalogEditorComponents, Phase3CatalogEditorComponents, Phase4CatalogEditorComponents, ProductionCatalogEditorComponents {
  HeroSplit: HeroSplitEditorProps;
  HeroSlider: HeroSliderEditorProps;
  LogoCloud: LogoCloudEditorProps;
  Stats: StatsEditorProps;
  Pricing: PricingEditorProps;
  Team: TeamEditorProps;
  Gallery: GalleryEditorProps;
  BarChart: BarChartEditorProps;
  G7RecentPosts: G7RecentPostsEditorProps;
  G7ProductGrid: G7ProductGridEditorProps;
  InquiryForm: InquiryFormEditorProps;
  MapDirections: MapDirectionsEditorProps;
}

type CatalogComponentType = keyof CatalogEditorComponents;

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

function heroSplitLayout(value: unknown): HeroSplitEditorProps['layout'] { return value === 'screenshot' || value === 'overlap' || value === 'offset' ? value : 'balanced'; }
function logoLayout(value: unknown): LogoCloudEditorProps['layout'] { return value === 'grid' || value === 'panel' ? value : 'strip'; }
function statsLayout(value: unknown): StatsEditorProps['layout'] { return value === 'editorial' || value === 'strip' || value === 'split' ? value : 'grid'; }
function pricingLayout(value: unknown): PricingEditorProps['layout'] { return value === 'featured' || value === 'compact' || value === 'editorial' ? value : 'cards'; }
function teamLayout(value: unknown): TeamEditorProps['layout'] { return value === 'portraits' || value === 'editorial' || value === 'featured' ? value : 'grid'; }
function galleryLayout(value: unknown): GalleryEditorProps['layout'] { return value === 'bento' || value === 'masonry' || value === 'filmstrip' ? value : 'grid'; }

const DEFAULT_HERO_SPLIT: HeroSplitEditorProps = {
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

const DEFAULT_HERO_SLIDER: HeroSliderEditorProps = {
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

const DEFAULT_LOGO_CLOUD: LogoCloudEditorProps = {
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

const DEFAULT_STATS: StatsEditorProps = {
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

const DEFAULT_PRICING: PricingEditorProps = {
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

const DEFAULT_TEAM: TeamEditorProps = {
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

const DEFAULT_GALLERY: GalleryEditorProps = {
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

const DEFAULT_BAR_CHART: BarChartEditorProps = {
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

const DEFAULT_G7_RECENT_POSTS: G7RecentPostsEditorProps = {
  eyebrow: '커뮤니티', heading: '최근 게시글', source: 'recent', period: 'week', limit: '6', pageSize: '3', audience: 'all',
  emptyMessage: '표시할 게시글이 없습니다.', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_G7_PRODUCT_GRID: G7ProductGridEditorProps = {
  eyebrow: '스토어', heading: '새로운 상품', source: 'new', limit: '4', columns: '4', pageSize: '4', audience: 'all',
  detailBasePath: '/shop/products', emptyMessage: '표시할 상품이 없습니다.',
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_INQUIRY_FORM: InquiryFormEditorProps = {
  eyebrow: '문의하기', heading: '무엇을 도와드릴까요?', description: '내용을 남겨주시면 확인 후 연락드리겠습니다.',
  formKind: 'inquiry', submitLabel: '문의 보내기', successMessage: '문의가 접수되었습니다. 빠르게 확인하겠습니다.',
  privacyLabel: '문의 처리를 위한 개인정보 수집 및 이용에 동의합니다.', showPhone: true, showSubject: true,
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_MAP_DIRECTIONS: MapDirectionsEditorProps = {
  eyebrow: '오시는 길', heading: '방문을 환영합니다', description: '아래 주소와 교통 정보를 확인해 주세요.',
  address: '서울특별시 중구 세종대로 110', latitude: 37.5665, longitude: 126.978, zoom: '16', provider: 'image',
  mapImageSrc: '', mapImageAlt: '',
  directionsLabel: '길찾기', directionsUrl: 'https://www.openstreetmap.org/', phone: '02-0000-0000', hours: '평일 09:00–18:00', parking: '방문객 주차 가능',
  surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } {
  return normalizeCatalogAppearance(asRecord(value), fallback);
}

function safeUrl(value: string): string | null {
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

function normalizeHeroSlides(value: unknown): HeroSlideItem[] {
  return normalizeArray(value, DEFAULT_HERO_SLIDER.slides, 5, (item) => ({
    eyebrow: asString(item.eyebrow), title: asString(item.title), body: asString(item.body),
    buttonLabel: asString(item.buttonLabel), buttonUrl: asString(item.buttonUrl),
    imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt),
  }));
}

type HeroSlidePreviewItem = Omit<HeroSlideItem, 'eyebrow' | 'title' | 'body' | 'buttonLabel'> & {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  buttonLabel: React.ReactNode;
};

function inlineContent(value: unknown, fallback: string): React.ReactNode {
  return React.isValidElement(value) || typeof value === 'string' ? value : fallback;
}

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  return inlineContent(item[key], fallback);
}

function inlineArrayText(value: unknown, index: number, key: string, fallback = ''): string {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  if (React.isValidElement(candidate)) {
    const elementValue = (candidate.props as { value?: unknown }).value;
    return typeof elementValue === 'string' ? elementValue : fallback;
  }
  return asString(candidate, fallback);
}

function inlineNestedArrayContent(
  value: unknown,
  outerIndex: number,
  collection: string,
  innerIndex: number,
  key: string,
  fallback: string,
): React.ReactNode {
  const outer = Array.isArray(value) ? asRecord(value[outerIndex]) : {};
  const nested = Array.isArray(outer[collection]) ? outer[collection] as unknown[] : [];
  return inlineContent(asRecord(nested[innerIndex])[key], fallback);
}

function previewHeroSlides(value: unknown): HeroSlidePreviewItem[] {
  const source = Array.isArray(value) ? value : DEFAULT_HERO_SLIDER.slides;

  return source.slice(0, 5).map((raw, index) => {
    const item = asRecord(raw);
    const fallback = DEFAULT_HERO_SLIDER.slides[index] ?? DEFAULT_HERO_SLIDER.slides[0];

    return {
      eyebrow: inlineContent(item.eyebrow, fallback.eyebrow),
      title: inlineContent(item.title, fallback.title),
      body: inlineContent(item.body, fallback.body),
      buttonLabel: inlineContent(item.buttonLabel, fallback.buttonLabel),
      buttonUrl: asString(item.buttonUrl),
      imageSrc: asString(item.imageSrc),
      imageAlt: asString(item.imageAlt),
    };
  });
}

function normalizeLogos(value: unknown): LogoItem[] {
  return normalizeArray(value, DEFAULT_LOGO_CLOUD.logos, 12, (item) => ({
    name: asString(item.name), imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt), url: asString(item.url),
  }));
}

function normalizeStats(value: unknown): StatItem[] {
  return normalizeArray(value, DEFAULT_STATS.items, 6, (item) => ({
    icon: ['trend', 'users', 'target', 'chart'].includes(asString(item.icon)) ? asString(item.icon) : 'chart',
    value: asString(item.value), label: asString(item.label), detail: asString(item.detail),
  }));
}

function normalizePricingEditor(value: unknown): PricingPlanEditor[] {
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

function normalizeMembers(value: unknown): TeamMemberItem[] {
  return normalizeArray(value, DEFAULT_TEAM.members, 8, (item) => ({
    name: asString(item.name), role: asString(item.role), bio: asString(item.bio), imageSrc: asString(item.imageSrc),
    imageAlt: asString(item.imageAlt), profileUrl: asString(item.profileUrl),
  }));
}

function normalizeImages(value: unknown): GalleryImageItem[] {
  return normalizeArray(value, DEFAULT_GALLERY.images, 12, (item) => ({
    src: asString(item.src), alt: asString(item.alt), caption: asString(item.caption),
  }));
}

function normalizeBars(value: unknown): BarChartItem[] {
  return normalizeArray(value, DEFAULT_BAR_CHART.items, 8, (item) => ({
    label: asString(item.label),
    value: typeof item.value === 'number' && Number.isFinite(item.value) ? Math.min(100, Math.max(0, item.value)) : 0,
    tone: item.tone === 'indigo' || item.tone === 'emerald' || item.tone === 'amber' ? item.tone : 'blue',
  }));
}

function ImageOrPlaceholder({ src, alt, label }: { src: string; alt: string; label: string }): React.ReactElement {
  const safe = safeUrl(src);
  return safe
    ? <img src={safe} alt={alt} />
    : <span className="g7pb-preview-media-placeholder" aria-label={`${label} 이미지 자리`}>{label}</span>;
}

function surfaceClass(surface: string, spacing: string, textScale = 'balanced', textAlign = 'left'): string {
  return `g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`;
}

function HeroSplitPreview(props: Omit<HeroSplitEditorProps, 'body'> & { id: string; body: React.ReactNode }): React.ReactElement {
  return (
    <BlockFrame id={props.id} type="hero-split" motion={props.motion} elementStyles={props.elementStyles}>
      <div className={`g7pb-preview-hero-split g7pb-preview-hero-split--${props.mediaPosition} g7pb-preview-hero-split--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
        <div className="g7pb-preview-hero-split__copy"><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h1" className="g7pb-preview-richtext" fieldPath="title">{props.title}</RichTextCanvasField><RichTextCanvasField fieldPath="body">{props.body}</RichTextCanvasField>{props.primaryLabel && <a data-g7pb-inline-field="primaryLabel" href={safeUrl(props.primaryUrl) ?? '#'} onClick={(event) => event.preventDefault()}>{props.primaryLabel}</a>}</div>
        <figure data-g7pb-media-field="imageSrc"><ImageOrPlaceholder src={props.imageSrc} alt={props.imageAlt} label="대표" /></figure>
      </div>
    </BlockFrame>
  );
}

function HeroSliderPreview(props: HeroSliderEditorProps & { id: string }): React.ReactElement {
  const slides = previewHeroSlides(props.slides);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = Math.min(selectedIndex, Math.max(0, slides.length - 1));

  const navigate = (target: 'previous' | 'next' | number): void => {
    if (typeof target === 'number') {
      setSelectedIndex(Math.min(Math.max(target, 0), slides.length - 1));
      return;
    }

    setSelectedIndex((current) => {
      const next = target === 'previous' ? current - 1 : current + 1;
      if (props.loop === 'yes') {
        return (next + slides.length) % slides.length;
      }
      return Math.min(Math.max(next, 0), slides.length - 1);
    });
  };

  return (
    <BlockFrame id={props.id} type="hero-slider" motion={props.motion} elementStyles={props.elementStyles}>
      <div className={`g7pb-preview-hero-slider ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
        <div className="g7pb-preview-hero-slider__viewport">
          <div className="g7pb-preview-hero-slider__track">
            {slides.map((slide, index) => <article key={index} data-slide-index={index} style={{ order: index === activeIndex ? -1 : index }}>
              <div className="g7pb-preview-hero-slider__copy">
                <small data-g7pb-inline-field={`slides.${index}.eyebrow`}>{slide.eyebrow}</small>
                <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath={`slides.${index}.title`}>{slide.title}</RichTextCanvasField>
                <RichTextCanvasField className="g7pb-preview-richtext g7pb-preview-hero-slider__body" fieldPath={`slides.${index}.body`}>{slide.body}</RichTextCanvasField>
                {inlineArrayText(props.slides, index, 'buttonLabel', slide.buttonLabel as string) && <a className="g7pb-preview-hero-slider__cta" data-g7pb-inline-field={`slides.${index}.buttonLabel`} href={safeUrl(slide.buttonUrl) ?? '#'} onClick={(event) => event.preventDefault()}>{slide.buttonLabel}</a>}
              </div>
              <figure data-g7pb-media-field={`slides.${index}.imageSrc`}><ImageOrPlaceholder src={slide.imageSrc} alt={slide.imageAlt} label={`슬라이드 ${index + 1}`} /></figure>
            </article>)}
          </div>
        </div>
        <div
          className="g7pb-preview-hero-slider__controls"
          data-puck-overlay-portal="true"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" aria-label="이전 슬라이드" data-testid="page-builder-slider-previous" onClick={() => navigate('previous')}>←</button>
          <div className="g7pb-preview-hero-slider__dots" aria-label="편집할 슬라이드">
            {slides.map((_, index) => <button type="button" aria-label={`${index + 1}번 슬라이드 편집`} aria-pressed={activeIndex === index} className={activeIndex === index ? 'is-active' : ''} data-testid={`page-builder-slider-slide-${index}`} key={index} onClick={() => navigate(index)} />)}
          </div>
          <span>{activeIndex + 1} / {slides.length}</span>
          <button type="button" aria-label="다음 슬라이드" data-testid="page-builder-slider-next" onClick={() => navigate('next')}>→</button>
        </div>
        {props.autoplay === 'yes' && <p className="g7pb-preview-hero-slider__editing-note">편집 중 자동 재생은 멈추며 발행 화면에서만 적용됩니다.</p>}
      </div>
    </BlockFrame>
  );
}

function LogoCloudPreview(props: LogoCloudEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="logo-cloud" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-logo-cloud g7pb-preview-logo-cloud--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><div>{normalizeLogos(props.logos).map((logo, index) => <span key={`${logo.name}-${index}`} data-g7pb-media-field={`logos.${index}.imageSrc`}>{safeUrl(logo.imageSrc) ? <img src={safeUrl(logo.imageSrc) ?? ''} alt={logo.imageAlt} /> : <b data-g7pb-inline-field={`logos.${index}.name`}>{inlineArrayContent(props.logos, index, 'name', logo.name)}</b>}</span>)}</div></div></BlockFrame>;
}

function StatsPreview(props: StatsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="stats" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-stats g7pb-preview-stats--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeStats(props.items).map((item, index) => <article key={`${item.label}-${index}`}><i aria-hidden="true"><CatalogIcon name={item.icon as CatalogIconName} size={28} /></i><strong data-g7pb-inline-field={`items.${index}.value`}>{inlineArrayContent(props.items, index, 'value', item.value)}</strong><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.detail`}>{inlineArrayContent(props.items, index, 'detail', item.detail)}</RichTextCanvasField></article>)}</div></div></BlockFrame>;
}

function PricingPreview(props: PricingEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="pricing" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-pricing g7pb-preview-pricing--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizePricingEditor(props.plans).map((plan, index) => <article className={plan.featured === 'yes' ? 'is-featured' : ''} key={`${plan.name}-${index}`}><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`plans.${index}.name`}>{inlineArrayContent(props.plans, index, 'name', plan.name)}</RichTextCanvasField><p><strong data-g7pb-inline-field={`plans.${index}.price`}>{inlineArrayContent(props.plans, index, 'price', plan.price)}</strong><span data-g7pb-inline-field={`plans.${index}.period`}>{inlineArrayContent(props.plans, index, 'period', plan.period)}</span></p><RichTextCanvasField fieldPath={`plans.${index}.description`}>{inlineArrayContent(props.plans, index, 'description', plan.description)}</RichTextCanvasField><ul>{plan.features.map((feature, featureIndex) => <li key={featureIndex}><RichTextCanvasField as="span" className="g7pb-preview-richtext" fieldPath={`plans.${index}.features.${featureIndex}`}>{inlineNestedArrayContent(props.plans, index, 'features', featureIndex, 'text', feature.text)}</RichTextCanvasField></li>)}</ul><b data-g7pb-inline-field={`plans.${index}.buttonLabel`}>{inlineArrayContent(props.plans, index, 'buttonLabel', plan.buttonLabel)}</b></article>)}</div></div></BlockFrame>;
}

function TeamPreview(props: TeamEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="team" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-team g7pb-preview-team--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeMembers(props.members).map((member, index) => <article key={`${member.name}-${index}`}><figure data-g7pb-media-field={`members.${index}.imageSrc`}><ImageOrPlaceholder src={member.imageSrc} alt={member.imageAlt} label={member.name.slice(0, 1)} /></figure><h3 data-g7pb-inline-field={`members.${index}.name`}>{inlineArrayContent(props.members, index, 'name', member.name)}</h3><strong data-g7pb-inline-field={`members.${index}.role`}>{inlineArrayContent(props.members, index, 'role', member.role)}</strong><RichTextCanvasField fieldPath={`members.${index}.bio`}>{inlineArrayContent(props.members, index, 'bio', member.bio)}</RichTextCanvasField></article>)}</div></div></BlockFrame>;
}

function GalleryPreview(props: GalleryEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="gallery" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-gallery g7pb-preview-gallery--layout-${props.layout} ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className={`g7pb-preview-gallery__grid g7pb-preview-gallery__grid--${props.columns}`}>{normalizeImages(props.images).map((image, index) => <figure key={`${image.caption}-${index}`}><span data-g7pb-media-field={`images.${index}.src`}><ImageOrPlaceholder src={image.src} alt={image.alt} label={`이미지 ${index + 1}`} /></span><figcaption data-g7pb-inline-field={`images.${index}.caption`}>{inlineArrayContent(props.images, index, 'caption', image.caption)}</figcaption></figure>)}</div></div></BlockFrame>;
}

function BarChartPreview(props: BarChartEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="bar-chart" motion={props.motion} elementStyles={props.elementStyles}><figure className={`g7pb-preview-bar-chart ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><figcaption><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><RichTextCanvasField fieldPath="description">{props.description}</RichTextCanvasField></figcaption><div>{normalizeBars(props.items).map((item, index) => <label key={`${item.label}-${index}`}><span><span data-g7pb-inline-field={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</span><b>{item.value}<span data-g7pb-inline-field="unit">{props.unit}</span></b></span><progress max={100} value={item.value} data-tone={item.tone}>{item.value}</progress></label>)}</div></figure></BlockFrame>;
}

function G7RecentPostsPreview(props: G7RecentPostsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="g7-recent-posts" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-g7-data ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><em>G7 게시판 · {props.source === 'recent' ? '최신순' : '인기순'} · {props.limit}개</em></header><div className="g7pb-preview-post-list">{['페이지 제작 소식을 전합니다', '새로운 기능 업데이트 안내', '자주 묻는 질문을 확인하세요'].map((title, index) => <article key={title}><span>{index + 1}</span><div><strong>{title}</strong><small>게시판 이름 · 방금 전</small></div><b>→</b></article>)}</div><p className="g7pb-preview-data-note">실제 공개 게시글은 미리보기·발행 화면에서 G7 공개 API로 불러옵니다.</p></div></BlockFrame>;
}

function G7ProductGridPreview(props: G7ProductGridEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="g7-product-grid" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-g7-data ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><em>G7 쇼핑몰 · {props.source === 'new' ? '신상품' : props.source === 'popular' ? '인기 상품' : '최신순'} · {props.limit}개</em></header><div className={`g7pb-preview-product-grid g7pb-preview-product-grid--${props.columns}`}>{['상품 A', '상품 B', '상품 C', '상품 D'].slice(0, Number(props.columns)).map((name, index) => <article key={name}><span aria-hidden="true">상품 이미지</span><strong>{name}</strong><small>{(29000 + index * 10000).toLocaleString()}원</small></article>)}</div><p className="g7pb-preview-data-note">실제 상품은 미리보기·발행 화면에서 G7 공개 API로 불러옵니다.</p></div></BlockFrame>;
}

function InquiryFormPreview(props: InquiryFormEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="inquiry-form" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-inquiry ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
    <div><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><RichTextCanvasField fieldPath="description">{props.description}</RichTextCanvasField></div>
    <form onSubmit={(event) => event.preventDefault()} aria-label="문의 폼 미리보기"><label><span>이름</span><input readOnly placeholder="홍길동" /></label><label><span>이메일</span><input readOnly placeholder="hello@example.com" /></label>{props.showPhone ? <label><span>전화번호</span><input readOnly placeholder="010-0000-0000" /></label> : null}{props.showSubject ? <label><span>문의 제목</span><input readOnly placeholder="문의 제목" /></label> : null}<label className="is-wide"><span>문의 내용</span><textarea readOnly rows={5} placeholder="문의 내용을 입력하세요." /></label><label className="is-consent"><input type="checkbox" readOnly /><span data-g7pb-inline-field="privacyLabel">{props.privacyLabel}</span></label><button type="button" data-g7pb-inline-field="submitLabel">{props.submitLabel}</button></form>
  </div></BlockFrame>;
}

function MapDirectionsPreview(props: MapDirectionsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="map-directions" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-map ${surfaceClass(props.surface, props.spacing, props.textScale, props.textAlign)}`}>
    <div><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><RichTextCanvasField fieldPath="description">{props.description}</RichTextCanvasField><address><strong data-g7pb-inline-field="address">{props.address}</strong><span data-g7pb-inline-field="phone">{props.phone}</span><span data-g7pb-inline-field="hours">{props.hours}</span><span data-g7pb-inline-field="parking">{props.parking}</span><b data-g7pb-inline-field="directionsLabel">{props.directionsLabel} →</b></address></div>
    <figure aria-label="지도 미리보기" data-g7pb-media-field={props.provider === 'image' ? 'mapImageSrc' : undefined}>
      {props.provider === 'image'
        ? <ImageOrPlaceholder src={props.mapImageSrc} alt={props.mapImageAlt} label="지도 이미지 등록" />
        : <><span className="g7pb-preview-map__grid" /><i aria-hidden="true">●</i><figcaption>{props.provider === 'none' ? '지도 숨김' : props.provider === 'google' ? 'Google 지도' : 'OpenStreetMap'} · {props.latitude.toFixed(4)}, {props.longitude.toFixed(4)}</figcaption></>}
    </figure>
  </div></BlockFrame>;
}

export const catalogComponentConfigs: Config<CatalogEditorComponents>['components'] = {
  ...foundationCatalogComponentConfigs,
  ...phase2CatalogComponentConfigs,
  ...phase3CatalogComponentConfigs,
  ...phase4CatalogComponentConfigs,
  ...productionCatalogComponentConfigs,
  HeroSplit: {
    label: '분할 히어로', defaultProps: DEFAULT_HERO_SPLIT,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, title: createInlineRichTextField('제목'), body: createRichTextField('본문', 160, true),
      primaryLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, primaryUrl: createRouteUrlField('버튼 연결', 'page-builder-hero-split-primary-url'), imageSrc: createMediaField('대표 이미지', 'hero-split-image'), imageAlt: { type: 'text', label: '이미지 대체 텍스트' },
      mediaPosition: { type: 'radio', label: '이미지 위치', options: [{ label: '왼쪽', value: 'left' }, { label: '오른쪽', value: 'right' }] },
      layout: { type: 'select', label: '레이아웃', options: HERO_SPLIT_LAYOUT_OPTIONS },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS },
      motion: createMotionField(['none', 'reveal', 'parallax-soft']),
    }, render: (props) => <HeroSplitPreview {...props} />,
  },
  HeroSlider: {
    label: '슬라이더 히어로', defaultProps: DEFAULT_HERO_SLIDER,
    fields: {
      slides: { type: 'array', label: '슬라이드', min: 2, max: 5, defaultItemProps: (index) => ({ eyebrow: `슬라이드 ${index + 1}`, title: '새로운 메시지', body: '슬라이드 설명을 입력하세요.', buttonLabel: '자세히 보기', buttonUrl: '/', imageSrc: '', imageAlt: '' }), getItemSummary: (item, index) => item.title || `슬라이드 ${(index ?? 0) + 1}`, arrayFields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, title: createInlineRichTextField('제목'), body: createRichTextField('본문', 150), buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, buttonUrl: createRouteUrlField('버튼 연결'), imageSrc: createMediaField('슬라이드 이미지'), imageAlt: { type: 'text', label: '이미지 대체 텍스트' } } },
      autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: 'yes' }, { label: '사용 안 함', value: 'no' }] },
      interval: { type: 'select', label: '자동 재생 간격', options: [{ label: '3초', value: '3000' }, { label: '5초', value: '5000' }, { label: '7초', value: '7000' }] },
      loop: { type: 'radio', label: '무한 반복', options: [{ label: '사용', value: 'yes' }, { label: '사용 안 함', value: 'no' }] },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS },
      motion: createMotionField(['none', 'reveal', 'parallax-soft']),
    }, render: (props) => <HeroSliderPreview {...props} />,
  },
  LogoCloud: {
    label: '로고 클라우드', defaultProps: DEFAULT_LOGO_CLOUD,
    fields: { heading: createInlineRichTextField('제목'), logos: { type: 'array', label: '로고', min: 2, max: 12, defaultItemProps: (index) => ({ name: `파트너 ${index + 1}`, imageSrc: '', imageAlt: '', url: '' }), getItemSummary: (item) => item.name, arrayFields: { name: { type: 'text', label: '이름', contentEditable: true }, imageSrc: createMediaField('로고 이미지'), imageAlt: { type: 'text', label: '대체 텍스트' }, url: createRouteUrlField('연결 경로') } }, layout: { type: 'select', label: '레이아웃', options: LOGO_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <LogoCloudPreview {...props} />,
  },
  Stats: {
    label: '숫자·아이콘 지표', defaultProps: DEFAULT_STATS,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), items: { type: 'array', label: '지표', min: 2, max: 6, defaultItemProps: (index) => ({ icon: 'chart', value: '0', label: `지표 ${index + 1}`, detail: '지표 설명' }), getItemSummary: (item) => `${item.value} ${item.label}`, arrayFields: { icon: { type: 'select', label: '아이콘', options: STAT_ICON_OPTIONS }, value: { type: 'text', label: '값', contentEditable: true }, label: createInlineRichTextField('이름'), detail: createRichTextField('설명', 120) } }, layout: { type: 'select', label: '레이아웃', options: STATS_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger', 'counter']) }, render: (props) => <StatsPreview {...props} />,
  },
  Pricing: {
    label: '요금제', defaultProps: DEFAULT_PRICING,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), plans: { type: 'array', label: '플랜', min: 2, max: 4, defaultItemProps: (index) => ({ name: `Plan ${index + 1}`, price: '₩0', period: '/월', description: '플랜 설명', features: [{ text: '기능 1' }, { text: '기능 2' }], buttonLabel: '선택하기', buttonUrl: '/', featured: 'no' }), getItemSummary: (item) => `${item.name} · ${item.price}`, arrayFields: { name: createInlineRichTextField('플랜명'), price: { type: 'text', label: '가격', contentEditable: true }, period: { type: 'text', label: '기간', contentEditable: true }, description: createRichTextField('설명', 130), features: { type: 'array', label: '기능 목록', min: 1, max: 12, defaultItemProps: (index) => ({ text: `기능 ${index + 1}` }), getItemSummary: (item) => item.text, arrayFields: { text: createInlineRichTextField('기능') } }, buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, buttonUrl: createRouteUrlField('버튼 연결'), featured: { type: 'radio', label: '추천 플랜', options: [{ label: '일반', value: 'no' }, { label: '추천', value: 'yes' }] } } }, layout: { type: 'select', label: '레이아웃', options: PRICING_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <PricingPreview {...props} />,
  },
  Team: {
    label: '팀 소개', defaultProps: DEFAULT_TEAM,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), members: { type: 'array', label: '구성원', min: 2, max: 8, defaultItemProps: (index) => ({ name: `구성원 ${index + 1}`, role: '역할', bio: '소개를 입력하세요.', imageSrc: '', imageAlt: '', profileUrl: '' }), getItemSummary: (item) => `${item.name} · ${item.role}`, arrayFields: { name: { type: 'text', label: '이름', contentEditable: true }, role: { type: 'text', label: '역할', contentEditable: true }, bio: createRichTextField('소개', 130), imageSrc: createMediaField('프로필 사진'), imageAlt: { type: 'text', label: '대체 텍스트' }, profileUrl: createRouteUrlField('프로필 연결') } }, layout: { type: 'select', label: '레이아웃', options: TEAM_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <TeamPreview {...props} />,
  },
  Gallery: {
    label: '갤러리 그리드', defaultProps: DEFAULT_GALLERY,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }, { label: '4열', value: '4' }] }, images: { type: 'array', label: '이미지', min: 2, max: 12, defaultItemProps: (index) => ({ src: '', alt: `갤러리 이미지 ${index + 1}`, caption: `장면 ${index + 1}` }), getItemSummary: (item, index) => item.caption || `이미지 ${(index ?? 0) + 1}`, arrayFields: { src: createMediaField('갤러리 이미지'), alt: { type: 'text', label: '대체 텍스트' }, caption: { type: 'text', label: '캡션', contentEditable: true } } }, layout: { type: 'select', label: '레이아웃', options: GALLERY_LAYOUT_OPTIONS }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger', 'parallax-soft']) }, render: (props) => <GalleryPreview {...props} />,
  },
  BarChart: {
    label: '막대그래프', defaultProps: DEFAULT_BAR_CHART,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), description: createRichTextField('설명', 130), unit: { type: 'text', label: '단위', contentEditable: true }, items: { type: 'array', label: '데이터', min: 2, max: 8, defaultItemProps: (index) => ({ label: `항목 ${index + 1}`, value: 50, tone: 'blue' }), getItemSummary: (item) => `${item.label} · ${item.value}`, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, value: { type: 'number', label: '값(0~100)', min: 0, max: 100 }, tone: { type: 'select', label: '색상 프리셋', options: [{ label: '파랑', value: 'blue' }, { label: '남색', value: 'indigo' }, { label: '초록', value: 'emerald' }, { label: '노랑', value: 'amber' }] } } }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'chart-draw']) }, render: (props) => <BarChartPreview {...props} />,
  },
  G7RecentPosts: {
    label: 'G7 최근 게시글', defaultProps: DEFAULT_G7_RECENT_POSTS,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'),
      source: { type: 'radio', label: '게시글 기준', options: [{ label: '최신글', value: 'recent' }, { label: '인기글', value: 'popular' }] },
      period: { type: 'select', label: '인기글 기간', options: [{ label: '오늘', value: 'today' }, { label: '이번 주', value: 'week' }, { label: '이번 달', value: 'month' }, { label: '최근 1년', value: 'year' }] },
      limit: { type: 'select', label: '불러올 개수', options: ['3', '4', '6', '8', '12'].map((value) => ({ label: `${value}개`, value })) },
      pageSize: { type: 'select', label: '페이지당 개수', options: ['3', '4', '6'].map((value) => ({ label: `${value}개`, value })) },
      audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] },
      emptyMessage: { type: 'text', label: '빈 상태 문구' }, elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']),
    }, render: (props) => <G7RecentPostsPreview {...props} />,
  },
  G7ProductGrid: {
    label: 'G7 상품 그리드', defaultProps: DEFAULT_G7_PRODUCT_GRID,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'),
      source: { type: 'select', label: '상품 기준', options: [{ label: '최신순', value: 'latest' }, { label: '신상품', value: 'new' }, { label: '인기 상품', value: 'popular' }] },
      limit: { type: 'select', label: '불러올 개수', options: ['2', '3', '4', '6', '8', '12'].map((value) => ({ label: `${value}개`, value })) },
      pageSize: { type: 'select', label: '페이지당 개수', options: ['2', '3', '4', '6'].map((value) => ({ label: `${value}개`, value })) },
      columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }, { label: '4열', value: '4' }] },
      audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] },
      detailBasePath: { type: 'text', label: '상품 상세 기본 경로' }, emptyMessage: { type: 'text', label: '빈 상태 문구' },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']),
    }, render: (props) => <G7ProductGridPreview {...props} />,
  },
  InquiryForm: {
    label: '문의·신청 폼', defaultProps: DEFAULT_INQUIRY_FORM,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), description: createRichTextField('설명', 140),
      formKind: { type: 'select', label: '폼 용도', options: [{ label: '일반 문의', value: 'inquiry' }, { label: '견적 요청', value: 'quote' }, { label: '예약', value: 'reservation' }, { label: '신청', value: 'application' }, { label: '뉴스레터', value: 'newsletter' }] },
      submitLabel: { type: 'text', label: '제출 버튼 문구', contentEditable: true }, successMessage: { type: 'text', label: '접수 완료 문구' }, privacyLabel: { type: 'textarea', label: '개인정보 동의 문구', contentEditable: true },
      showPhone: { type: 'radio', label: '전화번호', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] }, showSubject: { type: 'radio', label: '문의 제목', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal']),
    }, render: (props) => <InquiryFormPreview {...props} />,
  },
  MapDirections: {
    label: '지도·오시는 길', defaultProps: DEFAULT_MAP_DIRECTIONS,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), description: createRichTextField('설명', 140), address: { type: 'text', label: '주소', contentEditable: true },
      latitude: { type: 'number', label: '위도', min: -90, max: 90 }, longitude: { type: 'number', label: '경도', min: -180, max: 180 }, zoom: { type: 'select', label: '지도 확대', options: ['12', '14', '16', '18'].map((value) => ({ label: `${value} 단계`, value })) },
      provider: { type: 'radio', label: '지도 표시 방식', options: [{ label: '지도 이미지 (권장)', value: 'image' }, { label: 'OpenStreetMap', value: 'openstreetmap' }, { label: 'Google', value: 'google' }, { label: '표시 안 함', value: 'none' }] },
      mapImageSrc: createMediaField('지도 이미지', 'map-directions-image'), mapImageAlt: { type: 'text', label: '지도 이미지 대체 텍스트' },
      directionsLabel: { type: 'text', label: '길찾기 버튼 문구', contentEditable: true }, directionsUrl: createRouteUrlField('길찾기 연결'), phone: { type: 'text', label: '전화번호', contentEditable: true }, hours: { type: 'textarea', label: '운영 시간', contentEditable: true }, parking: { type: 'textarea', label: '주차 안내', contentEditable: true },
      elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal']),
    }, render: (props) => <MapDirectionsPreview {...props} />,
  },
};

export function canonicalCatalogBlockToPuck(block: PageBuilderBlock): { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] } | null {
  const foundationBlock = canonicalFoundationBlockToPuck(block);
  if (foundationBlock) return foundationBlock as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const phase2Block = canonicalPhase2BlockToPuck(block);
  if (phase2Block) return phase2Block as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const phase3Block = canonicalPhase3BlockToPuck(block);
  if (phase3Block) return phase3Block as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const phase4Block = canonicalPhase4BlockToPuck(block);
  if (phase4Block) return phase4Block as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const productionBlock = canonicalProductionBlockToPuck(block);
  if (productionBlock) return productionBlock as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const props = block.props;
  if (block.type === HERO_SPLIT_BLOCK_TYPE) {
    const cta = asRecord(props.primaryCta); const image = asRecord(props.image);
    return { type: 'HeroSplit', props: { eyebrow: asString(props.eyebrow), title: asString(props.title), body: asString(props.body), primaryLabel: asString(cta.label), primaryUrl: asString(cta.url), imageSrc: asString(image.src), imageAlt: asString(image.alt), mediaPosition: props.mediaPosition === 'left' ? 'left' : 'right', layout: heroSplitLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  }
  if (block.type === HERO_SLIDER_BLOCK_TYPE) return { type: 'HeroSlider', props: { slides: normalizeHeroSlides(props.slides), autoplay: props.autoplay === false ? 'no' : 'yes', interval: props.interval === 3000 ? '3000' : props.interval === 7000 ? '7000' : '5000', loop: props.loop === false ? 'no' : 'yes', ...appearance(props.appearance, { surface: 'contrast', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === LOGO_CLOUD_BLOCK_TYPE) return { type: 'LogoCloud', props: { heading: asString(props.heading), logos: normalizeLogos(props.logos), layout: logoLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'compact' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === STATS_BLOCK_TYPE) return { type: 'Stats', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeStats(props.items), layout: statsLayout(props.layout), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === PRICING_BLOCK_TYPE) return { type: 'Pricing', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), plans: normalizePricingEditor(props.plans), layout: pricingLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === TEAM_BLOCK_TYPE) return { type: 'Team', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), members: normalizeMembers(props.members), layout: teamLayout(props.layout), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === GALLERY_BLOCK_TYPE) return { type: 'Gallery', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), images: normalizeImages(props.images), columns: props.columns === 2 || props.columns === '2' ? '2' : props.columns === 4 || props.columns === '4' ? '4' : '3', layout: galleryLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === BAR_CHART_BLOCK_TYPE) return { type: 'BarChart', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), unit: asString(props.unit), items: normalizeBars(props.items), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === G7_RECENT_POSTS_BLOCK_TYPE) return { type: 'G7RecentPosts', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' ? 'popular' : 'recent', period: ['today', 'month', 'year'].includes(asString(props.period)) ? asString(props.period) as G7RecentPostsEditorProps['period'] : 'week', limit: ['3', '4', '8', '12'].includes(String(props.limit)) ? String(props.limit) as G7RecentPostsEditorProps['limit'] : '6', pageSize: ['4', '6'].includes(String(props.pageSize)) ? String(props.pageSize) as G7RecentPostsEditorProps['pageSize'] : '3', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', emptyMessage: asString(props.emptyMessage, '표시할 게시글이 없습니다.'), ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === G7_PRODUCT_GRID_BLOCK_TYPE) return { type: 'G7ProductGrid', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' || props.source === 'latest' ? props.source : 'new', limit: ['2', '3', '6', '8', '12'].includes(String(props.limit)) ? String(props.limit) as G7ProductGridEditorProps['limit'] : '4', columns: props.columns === 2 || props.columns === '2' ? '2' : props.columns === 3 || props.columns === '3' ? '3' : '4', pageSize: ['2', '3', '6'].includes(String(props.pageSize)) ? String(props.pageSize) as G7ProductGridEditorProps['pageSize'] : '4', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', detailBasePath: asString(props.detailBasePath, '/shop/products'), emptyMessage: asString(props.emptyMessage, '표시할 상품이 없습니다.'), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === INQUIRY_FORM_BLOCK_TYPE) return { type: 'InquiryForm', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), formKind: ['quote', 'reservation', 'application', 'newsletter'].includes(asString(props.formKind)) ? asString(props.formKind) as InquiryFormKind : 'inquiry', submitLabel: asString(props.submitLabel, '문의 보내기'), successMessage: asString(props.successMessage, '문의가 접수되었습니다.'), privacyLabel: asString(props.privacyLabel, '개인정보 수집 및 이용에 동의합니다.'), showPhone: props.showPhone !== false, showSubject: props.showSubject !== false, ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === MAP_DIRECTIONS_BLOCK_TYPE) return { type: 'MapDirections', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), address: asString(props.address), latitude: typeof props.latitude === 'number' ? props.latitude : 37.5665, longitude: typeof props.longitude === 'number' ? props.longitude : 126.978, zoom: ['12', '14', '18'].includes(String(props.zoom)) ? String(props.zoom) as MapDirectionsEditorProps['zoom'] : '16', provider: props.provider === 'image' || props.provider === 'google' || props.provider === 'none' ? props.provider : 'openstreetmap', mapImageSrc: asString(props.mapImageSrc), mapImageAlt: asString(props.mapImageAlt), directionsLabel: asString(props.directionsLabel, '길찾기'), directionsUrl: asString(props.directionsUrl, 'https://www.openstreetmap.org/'), phone: asString(props.phone), hours: asString(props.hours), parking: asString(props.parking), ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  return null;
}

export function catalogPuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean, includeSliderSettings = false): { type: string; props: Record<string, unknown> } | null {
  const foundationBlock = foundationPuckBlockToCanonical(type, raw, includeAppearance);
  if (foundationBlock) return foundationBlock;
  const phase2Block = phase2PuckBlockToCanonical(type, raw, includeAppearance);
  if (phase2Block) return phase2Block;
  const phase3Block = phase3PuckBlockToCanonical(type, raw, includeAppearance);
  if (phase3Block) return phase3Block;
  const phase4Block = phase4PuckBlockToCanonical(type, raw, includeAppearance);
  if (phase4Block) return phase4Block;
  const productionBlock = productionPuckBlockToCanonical(type, raw, includeAppearance);
  if (productionBlock) return productionBlock;
  if (type === 'HeroSplit') {
    const props: Record<string, unknown> = { eyebrow: asString(raw.eyebrow), title: asString(raw.title), body: asString(raw.body), mediaPosition: raw.mediaPosition === 'left' ? 'left' : 'right', layout: heroSplitLayout(raw.layout) };
    if (asString(raw.primaryLabel) || asString(raw.primaryUrl)) props.primaryCta = { label: asString(raw.primaryLabel), url: asString(raw.primaryUrl) };
    if (asString(raw.imageSrc) || asString(raw.imageAlt)) props.image = { src: asString(raw.imageSrc), alt: asString(raw.imageAlt) };
    return { type: HERO_SPLIT_BLOCK_TYPE, props: attachAppearance(props, raw, { surface: 'default', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'HeroSlider') {
    const props: Record<string, unknown> = { slides: normalizeHeroSlides(raw.slides) };
    if (includeSliderSettings || raw.autoplay === 'no' || raw.interval === '3000' || raw.interval === '7000' || raw.loop === 'no') {
      props.autoplay = raw.autoplay !== 'no';
      props.interval = raw.interval === '3000' ? 3000 : raw.interval === '7000' ? 7000 : 5000;
      props.loop = raw.loop !== 'no';
    }
    return { type: HERO_SLIDER_BLOCK_TYPE, props: attachAppearance(props, raw, { surface: 'contrast', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'LogoCloud') return { type: LOGO_CLOUD_BLOCK_TYPE, props: attachAppearance({ heading: asString(raw.heading), logos: normalizeLogos(raw.logos), layout: logoLayout(raw.layout) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'Stats') return { type: STATS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeStats(raw.items), layout: statsLayout(raw.layout) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Pricing') {
    const plans: PricingPlanItem[] = normalizePricingEditor(raw.plans).map((plan) => ({ name: plan.name, price: plan.price, period: plan.period, description: plan.description, features: plan.features.map((feature) => feature.text.trim()).filter(Boolean), buttonLabel: plan.buttonLabel, buttonUrl: plan.buttonUrl, featured: plan.featured === 'yes' }));
    return { type: PRICING_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), plans, layout: pricingLayout(raw.layout) }, raw, { surface: 'default', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'Team') return { type: TEAM_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), members: normalizeMembers(raw.members), layout: teamLayout(raw.layout) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Gallery') return { type: GALLERY_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), images: normalizeImages(raw.images), columns: raw.columns === '2' ? 2 : raw.columns === '4' ? 4 : 3, layout: galleryLayout(raw.layout) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'BarChart') return { type: BAR_CHART_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), unit: asString(raw.unit), items: normalizeBars(raw.items) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7RecentPosts') return { type: G7_RECENT_POSTS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' ? 'popular' : 'recent', period: ['today', 'month', 'year'].includes(asString(raw.period)) ? raw.period : 'week', limit: Number(raw.limit) || 6, pageSize: Number(raw.pageSize) || 3, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', emptyMessage: asString(raw.emptyMessage, '표시할 게시글이 없습니다.') }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7ProductGrid') return { type: G7_PRODUCT_GRID_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' || raw.source === 'latest' ? raw.source : 'new', limit: Number(raw.limit) || 4, columns: Number(raw.columns) || 4, pageSize: Number(raw.pageSize) || 4, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', detailBasePath: asString(raw.detailBasePath, '/shop/products'), emptyMessage: asString(raw.emptyMessage, '표시할 상품이 없습니다.') }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'InquiryForm') return { type: INQUIRY_FORM_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), formKind: ['quote', 'reservation', 'application', 'newsletter'].includes(asString(raw.formKind)) ? raw.formKind : 'inquiry', submitLabel: asString(raw.submitLabel), successMessage: asString(raw.successMessage), privacyLabel: asString(raw.privacyLabel), showPhone: raw.showPhone !== false, showSubject: raw.showSubject !== false }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'MapDirections') {
    const provider = raw.provider === 'image' || raw.provider === 'google' || raw.provider === 'none' ? raw.provider : 'openstreetmap';
    const mapProps: Record<string, unknown> = {
      eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), address: asString(raw.address),
      latitude: typeof raw.latitude === 'number' ? raw.latitude : 37.5665, longitude: typeof raw.longitude === 'number' ? raw.longitude : 126.978,
      zoom: Number(raw.zoom) || 16, provider, directionsLabel: asString(raw.directionsLabel), directionsUrl: asString(raw.directionsUrl),
      phone: asString(raw.phone), hours: asString(raw.hours), parking: asString(raw.parking),
    };
    const mapImageSrc = asString(raw.mapImageSrc);
    const mapImageAlt = asString(raw.mapImageAlt);
    if (provider === 'image' || mapImageSrc || mapImageAlt) {
      mapProps.mapImageSrc = mapImageSrc;
      mapProps.mapImageAlt = mapImageAlt;
    }
    return { type: MAP_DIRECTIONS_BLOCK_TYPE, props: attachAppearance(mapProps, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  }
  return null;
}

export function CatalogGalleryThumbnail({ type }: { type: CatalogComponentType }): React.ReactElement {
  return <span className="g7pb-block-thumb g7pb-block-thumb--unavailable" data-block-preview={type}
    data-g7pb-thumbnail-state="unavailable">
    <span>미리보기를 불러오지 못했습니다</span>
  </span>;
}
