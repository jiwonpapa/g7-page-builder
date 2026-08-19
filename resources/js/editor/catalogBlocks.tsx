import React from 'react';
import type { Config } from '@puckeditor/core';
import {
  createMotionField,
  DEFAULT_BLOCK_MOTION,
  motionPreviewAttributes,
  normalizeBlockMotion,
} from './blockMotion';

import {
  BAR_CHART_BLOCK_TYPE,
  GALLERY_BLOCK_TYPE,
  HERO_SLIDER_BLOCK_TYPE,
  HERO_SPLIT_BLOCK_TYPE,
  LOGO_CLOUD_BLOCK_TYPE,
  PRICING_BLOCK_TYPE,
  STATS_BLOCK_TYPE,
  TEAM_BLOCK_TYPE,
  type BarChartItem,
  type BlockAppearance,
  type BlockMotion,
  type GalleryImageItem,
  type HeroSlideItem,
  type LogoItem,
  type PageBuilderBlock,
  type PricingPlanItem,
  type StatItem,
  type TeamMemberItem,
} from '../documents/types';

export interface HeroSplitEditorProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  imageSrc: string;
  imageAlt: string;
  mediaPosition: 'left' | 'right';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface HeroSliderEditorProps {
  slides: HeroSlideItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface LogoCloudEditorProps {
  heading: string;
  logos: LogoItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface StatsEditorProps {
  eyebrow: string;
  heading: string;
  items: StatItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface PricingPlanEditor extends Omit<PricingPlanItem, 'features' | 'featured'> {
  featuresText: string;
  featured: 'yes' | 'no';
}

export interface PricingEditorProps {
  eyebrow: string;
  heading: string;
  plans: PricingPlanEditor[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface TeamEditorProps {
  eyebrow: string;
  heading: string;
  members: TeamMemberItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface GalleryEditorProps {
  eyebrow: string;
  heading: string;
  images: GalleryImageItem[];
  columns: '2' | '3' | '4';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface BarChartEditorProps {
  eyebrow: string;
  heading: string;
  description: string;
  unit: string;
  items: BarChartItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

export interface CatalogEditorComponents {
  HeroSplit: HeroSplitEditorProps;
  HeroSlider: HeroSliderEditorProps;
  LogoCloud: LogoCloudEditorProps;
  Stats: StatsEditorProps;
  Pricing: PricingEditorProps;
  Team: TeamEditorProps;
  Gallery: GalleryEditorProps;
  BarChart: BarChartEditorProps;
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

const DEFAULT_HERO_SPLIT: HeroSplitEditorProps = {
  eyebrow: '제품 소개',
  title: '설명과 이미지를 균형 있게 보여주세요',
  body: '한쪽에는 핵심 메시지와 행동을, 다른 쪽에는 제품이나 공간 이미지를 배치합니다.',
  primaryLabel: '자세히 보기',
  primaryUrl: '/',
  imageSrc: '',
  imageAlt: '',
  mediaPosition: 'right',
  surface: 'default',
  spacing: 'spacious',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_HERO_SLIDER: HeroSliderEditorProps = {
  slides: [
    { eyebrow: '첫 번째 이야기', title: '대표 메시지를 선명하게', body: '핵심 캠페인이나 상품을 한 장면으로 소개합니다.', buttonLabel: '살펴보기', buttonUrl: '/', imageSrc: '', imageAlt: '' },
    { eyebrow: '두 번째 이야기', title: '다음 장면으로 이어지는 흐름', body: '서로 다른 메시지를 스크롤 가능한 슬라이드로 연결합니다.', buttonLabel: '더 알아보기', buttonUrl: '/about', imageSrc: '', imageAlt: '' },
  ],
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
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_PRICING: PricingEditorProps = {
  eyebrow: '요금 안내',
  heading: '필요한 규모에 맞는 플랜',
  plans: [
    { name: 'Starter', price: '₩29,000', period: '/월', description: '작게 시작하는 팀', featuresText: '페이지 3개\n기본 블록\n이메일 지원', buttonLabel: '시작하기', buttonUrl: '/', featured: 'no' },
    { name: 'Growth', price: '₩79,000', period: '/월', description: '성장 중인 비즈니스', featuresText: '페이지 무제한\n전체 블록\n우선 지원', buttonLabel: 'Growth 선택', buttonUrl: '/', featured: 'yes' },
    { name: 'Business', price: '문의', period: '', description: '맞춤 운영이 필요한 조직', featuresText: '전용 설치\n교육 지원\n맞춤 계약', buttonLabel: '상담하기', buttonUrl: '/contact', featured: 'no' },
  ],
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

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function normalizeSurface(value: unknown, fallback: BlockAppearance['surface']): BlockAppearance['surface'] {
  return value === 'default' || value === 'soft' || value === 'contrast' ? value : fallback;
}

function normalizeSpacing(value: unknown, fallback: BlockAppearance['spacing']): BlockAppearance['spacing'] {
  return value === 'compact' || value === 'normal' || value === 'spacious' ? value : fallback;
}

function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance {
  const record = asRecord(value);
  return {
    surface: normalizeSurface(record.surface, fallback.surface),
    spacing: normalizeSpacing(record.spacing, fallback.spacing),
  };
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
    featuresText: Array.isArray(item.features)
      ? item.features.filter((feature): feature is string => typeof feature === 'string').join('\n')
      : asString(item.featuresText),
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

function BlockFrame({ id, type, motion, children }: { id: string; type: string; motion: BlockMotion; children: React.ReactNode }): React.ReactElement {
  return <section className="g7pb-preview-block" data-testid="page-builder-block" data-block-id={id} data-block-type={type} {...motionPreviewAttributes(motion)}>{children}</section>;
}

function ImageOrPlaceholder({ src, alt, label }: { src: string; alt: string; label: string }): React.ReactElement {
  const safe = safeUrl(src);
  return safe
    ? <img src={safe} alt={alt} />
    : <span className="g7pb-preview-media-placeholder" aria-label={`${label} 이미지 자리`}>{label}</span>;
}

function surfaceClass(surface: string, spacing: string): string {
  return `g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing}`;
}

function HeroSplitPreview(props: HeroSplitEditorProps & { id: string }): React.ReactElement {
  return (
    <BlockFrame id={props.id} type="hero-split" motion={props.motion}>
      <div className={`g7pb-preview-hero-split g7pb-preview-hero-split--${props.mediaPosition} ${surfaceClass(props.surface, props.spacing)}`}>
        <div className="g7pb-preview-hero-split__copy"><small>{props.eyebrow}</small><h1>{props.title}</h1><p>{props.body}</p>{props.primaryLabel && <a href={safeUrl(props.primaryUrl) ?? '#'} onClick={(event) => event.preventDefault()}>{props.primaryLabel}</a>}</div>
        <figure><ImageOrPlaceholder src={props.imageSrc} alt={props.imageAlt} label="대표" /></figure>
      </div>
    </BlockFrame>
  );
}

function HeroSliderPreview(props: HeroSliderEditorProps & { id: string }): React.ReactElement {
  const slides = normalizeHeroSlides(props.slides);
  return (
    <BlockFrame id={props.id} type="hero-slider" motion={props.motion}>
      <div className={`g7pb-preview-hero-slider ${surfaceClass(props.surface, props.spacing)}`}>
        <div className="g7pb-preview-hero-slider__track">
          {slides.map((slide, index) => <article key={`${slide.title}-${index}`}><div><small>{slide.eyebrow}</small><h2>{slide.title}</h2><p>{slide.body}</p>{slide.buttonLabel && <span>{slide.buttonLabel} →</span>}</div><ImageOrPlaceholder src={slide.imageSrc} alt={slide.imageAlt} label={`슬라이드 ${index + 1}`} /></article>)}
        </div><div className="g7pb-preview-hero-slider__dots" aria-hidden="true">{slides.map((_, index) => <i key={index} />)}</div>
      </div>
    </BlockFrame>
  );
}

function LogoCloudPreview(props: LogoCloudEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="logo-cloud" motion={props.motion}><div className={`g7pb-preview-logo-cloud ${surfaceClass(props.surface, props.spacing)}`}><p>{props.heading}</p><div>{normalizeLogos(props.logos).map((logo, index) => <span key={`${logo.name}-${index}`}>{safeUrl(logo.imageSrc) ? <img src={safeUrl(logo.imageSrc) ?? ''} alt={logo.imageAlt} /> : logo.name}</span>)}</div></div></BlockFrame>;
}

function StatsPreview(props: StatsEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="stats" motion={props.motion}><div className={`g7pb-preview-stats ${surfaceClass(props.surface, props.spacing)}`}><header><small>{props.eyebrow}</small><h2>{props.heading}</h2></header><div>{normalizeStats(props.items).map((item, index) => <article key={`${item.label}-${index}`}><i aria-hidden="true">{item.icon === 'users' ? '●●' : item.icon === 'trend' ? '↗' : item.icon === 'target' ? '◎' : '▥'}</i><strong>{item.value}</strong><h3>{item.label}</h3><p>{item.detail}</p></article>)}</div></div></BlockFrame>;
}

function PricingPreview(props: PricingEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="pricing" motion={props.motion}><div className={`g7pb-preview-pricing ${surfaceClass(props.surface, props.spacing)}`}><header><small>{props.eyebrow}</small><h2>{props.heading}</h2></header><div>{normalizePricingEditor(props.plans).map((plan, index) => <article className={plan.featured === 'yes' ? 'is-featured' : ''} key={`${plan.name}-${index}`}><h3>{plan.name}</h3><p><strong>{plan.price}</strong>{plan.period}</p><span>{plan.description}</span><ul>{plan.featuresText.split('\n').filter(Boolean).map((feature) => <li key={feature}>{feature}</li>)}</ul><b>{plan.buttonLabel}</b></article>)}</div></div></BlockFrame>;
}

function TeamPreview(props: TeamEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="team" motion={props.motion}><div className={`g7pb-preview-team ${surfaceClass(props.surface, props.spacing)}`}><header><small>{props.eyebrow}</small><h2>{props.heading}</h2></header><div>{normalizeMembers(props.members).map((member, index) => <article key={`${member.name}-${index}`}><figure><ImageOrPlaceholder src={member.imageSrc} alt={member.imageAlt} label={member.name.slice(0, 1)} /></figure><h3>{member.name}</h3><strong>{member.role}</strong><p>{member.bio}</p></article>)}</div></div></BlockFrame>;
}

function GalleryPreview(props: GalleryEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="gallery" motion={props.motion}><div className={`g7pb-preview-gallery ${surfaceClass(props.surface, props.spacing)}`}><header><small>{props.eyebrow}</small><h2>{props.heading}</h2></header><div className={`g7pb-preview-gallery__grid g7pb-preview-gallery__grid--${props.columns}`}>{normalizeImages(props.images).map((image, index) => <figure key={`${image.caption}-${index}`}><ImageOrPlaceholder src={image.src} alt={image.alt} label={`이미지 ${index + 1}`} /><figcaption>{image.caption}</figcaption></figure>)}</div></div></BlockFrame>;
}

function BarChartPreview(props: BarChartEditorProps & { id: string }): React.ReactElement {
  return <BlockFrame id={props.id} type="bar-chart" motion={props.motion}><figure className={`g7pb-preview-bar-chart ${surfaceClass(props.surface, props.spacing)}`}><figcaption><small>{props.eyebrow}</small><h2>{props.heading}</h2><p>{props.description}</p></figcaption><div>{normalizeBars(props.items).map((item, index) => <label key={`${item.label}-${index}`}><span>{item.label}<b>{item.value}{props.unit}</b></span><progress max={100} value={item.value} data-tone={item.tone}>{item.value}</progress></label>)}</div></figure></BlockFrame>;
}

export const catalogComponentConfigs: Config<CatalogEditorComponents>['components'] = {
  HeroSplit: {
    label: '분할 히어로', defaultProps: DEFAULT_HERO_SPLIT,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구' }, title: { type: 'text', label: '제목' }, body: { type: 'textarea', label: '본문' },
      primaryLabel: { type: 'text', label: '버튼 문구' }, primaryUrl: { type: 'text', label: '버튼 URL' }, imageSrc: { type: 'text', label: '이미지 URL' }, imageAlt: { type: 'text', label: '이미지 대체 텍스트' },
      mediaPosition: { type: 'radio', label: '이미지 위치', options: [{ label: '왼쪽', value: 'left' }, { label: '오른쪽', value: 'right' }] },
      surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS },
      motion: createMotionField(['none', 'reveal', 'parallax-soft']),
    }, render: (props) => <HeroSplitPreview {...props} />,
  },
  HeroSlider: {
    label: '슬라이더 히어로', defaultProps: DEFAULT_HERO_SLIDER,
    fields: {
      slides: { type: 'array', label: '슬라이드', min: 2, max: 5, defaultItemProps: (index) => ({ eyebrow: `슬라이드 ${index + 1}`, title: '새로운 메시지', body: '슬라이드 설명을 입력하세요.', buttonLabel: '자세히 보기', buttonUrl: '/', imageSrc: '', imageAlt: '' }), getItemSummary: (item, index) => item.title || `슬라이드 ${(index ?? 0) + 1}`, arrayFields: { eyebrow: { type: 'text', label: '보조 문구' }, title: { type: 'text', label: '제목' }, body: { type: 'textarea', label: '본문' }, buttonLabel: { type: 'text', label: '버튼 문구' }, buttonUrl: { type: 'text', label: '버튼 URL' }, imageSrc: { type: 'text', label: '이미지 URL' }, imageAlt: { type: 'text', label: '이미지 대체 텍스트' } } },
      surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS },
      motion: createMotionField(['none', 'reveal', 'parallax-soft']),
    }, render: (props) => <HeroSliderPreview {...props} />,
  },
  LogoCloud: {
    label: '로고 클라우드', defaultProps: DEFAULT_LOGO_CLOUD,
    fields: { heading: { type: 'text', label: '제목' }, logos: { type: 'array', label: '로고', min: 2, max: 12, defaultItemProps: (index) => ({ name: `파트너 ${index + 1}`, imageSrc: '', imageAlt: '', url: '' }), getItemSummary: (item) => item.name, arrayFields: { name: { type: 'text', label: '이름' }, imageSrc: { type: 'text', label: '로고 URL' }, imageAlt: { type: 'text', label: '대체 텍스트' }, url: { type: 'text', label: '연결 URL' } } }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <LogoCloudPreview {...props} />,
  },
  Stats: {
    label: '숫자·아이콘 지표', defaultProps: DEFAULT_STATS,
    fields: { eyebrow: { type: 'text', label: '보조 문구' }, heading: { type: 'text', label: '제목' }, items: { type: 'array', label: '지표', min: 2, max: 6, defaultItemProps: (index) => ({ icon: 'chart', value: '0', label: `지표 ${index + 1}`, detail: '지표 설명' }), getItemSummary: (item) => `${item.value} ${item.label}`, arrayFields: { icon: { type: 'select', label: '아이콘', options: STAT_ICON_OPTIONS }, value: { type: 'text', label: '값' }, label: { type: 'text', label: '이름' }, detail: { type: 'textarea', label: '설명' } } }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger', 'counter']) }, render: (props) => <StatsPreview {...props} />,
  },
  Pricing: {
    label: '요금제', defaultProps: DEFAULT_PRICING,
    fields: { eyebrow: { type: 'text', label: '보조 문구' }, heading: { type: 'text', label: '제목' }, plans: { type: 'array', label: '플랜', min: 2, max: 4, defaultItemProps: (index) => ({ name: `Plan ${index + 1}`, price: '₩0', period: '/월', description: '플랜 설명', featuresText: '기능 1\n기능 2', buttonLabel: '선택하기', buttonUrl: '/', featured: 'no' }), getItemSummary: (item) => `${item.name} · ${item.price}`, arrayFields: { name: { type: 'text', label: '플랜명' }, price: { type: 'text', label: '가격' }, period: { type: 'text', label: '기간' }, description: { type: 'textarea', label: '설명' }, featuresText: { type: 'textarea', label: '기능 목록(줄바꿈)' }, buttonLabel: { type: 'text', label: '버튼 문구' }, buttonUrl: { type: 'text', label: '버튼 URL' }, featured: { type: 'radio', label: '추천 플랜', options: [{ label: '일반', value: 'no' }, { label: '추천', value: 'yes' }] } } }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <PricingPreview {...props} />,
  },
  Team: {
    label: '팀 소개', defaultProps: DEFAULT_TEAM,
    fields: { eyebrow: { type: 'text', label: '보조 문구' }, heading: { type: 'text', label: '제목' }, members: { type: 'array', label: '구성원', min: 2, max: 8, defaultItemProps: (index) => ({ name: `구성원 ${index + 1}`, role: '역할', bio: '소개를 입력하세요.', imageSrc: '', imageAlt: '', profileUrl: '' }), getItemSummary: (item) => `${item.name} · ${item.role}`, arrayFields: { name: { type: 'text', label: '이름' }, role: { type: 'text', label: '역할' }, bio: { type: 'textarea', label: '소개' }, imageSrc: { type: 'text', label: '사진 URL' }, imageAlt: { type: 'text', label: '대체 텍스트' }, profileUrl: { type: 'text', label: '프로필 URL' } } }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <TeamPreview {...props} />,
  },
  Gallery: {
    label: '갤러리 그리드', defaultProps: DEFAULT_GALLERY,
    fields: { eyebrow: { type: 'text', label: '보조 문구' }, heading: { type: 'text', label: '제목' }, columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }, { label: '4열', value: '4' }] }, images: { type: 'array', label: '이미지', min: 2, max: 12, defaultItemProps: (index) => ({ src: '', alt: `갤러리 이미지 ${index + 1}`, caption: `장면 ${index + 1}` }), getItemSummary: (item, index) => item.caption || `이미지 ${(index ?? 0) + 1}`, arrayFields: { src: { type: 'text', label: '이미지 URL' }, alt: { type: 'text', label: '대체 텍스트' }, caption: { type: 'text', label: '캡션' } } }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'stagger', 'parallax-soft']) }, render: (props) => <GalleryPreview {...props} />,
  },
  BarChart: {
    label: '막대그래프', defaultProps: DEFAULT_BAR_CHART,
    fields: { eyebrow: { type: 'text', label: '보조 문구' }, heading: { type: 'text', label: '제목' }, description: { type: 'textarea', label: '설명' }, unit: { type: 'text', label: '단위' }, items: { type: 'array', label: '데이터', min: 2, max: 8, defaultItemProps: (index) => ({ label: `항목 ${index + 1}`, value: 50, tone: 'blue' }), getItemSummary: (item) => `${item.label} · ${item.value}`, arrayFields: { label: { type: 'text', label: '이름' }, value: { type: 'number', label: '값(0~100)', min: 0, max: 100 }, tone: { type: 'select', label: '색상 프리셋', options: [{ label: '파랑', value: 'blue' }, { label: '남색', value: 'indigo' }, { label: '초록', value: 'emerald' }, { label: '노랑', value: 'amber' }] } } }, surface: { type: 'select', label: '배경 프리셋', options: SURFACE_OPTIONS }, spacing: { type: 'select', label: '세로 여백', options: SPACING_OPTIONS }, motion: createMotionField(['none', 'reveal', 'chart-draw']) }, render: (props) => <BarChartPreview {...props} />,
  },
};

export function canonicalCatalogBlockToPuck(block: PageBuilderBlock): { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] } | null {
  const props = block.props;
  if (block.type === HERO_SPLIT_BLOCK_TYPE) {
    const cta = asRecord(props.primaryCta); const image = asRecord(props.image);
    return { type: 'HeroSplit', props: { eyebrow: asString(props.eyebrow), title: asString(props.title), body: asString(props.body), primaryLabel: asString(cta.label), primaryUrl: asString(cta.url), imageSrc: asString(image.src), imageAlt: asString(image.alt), mediaPosition: props.mediaPosition === 'left' ? 'left' : 'right', ...appearance(props.appearance, { surface: 'default', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  }
  if (block.type === HERO_SLIDER_BLOCK_TYPE) return { type: 'HeroSlider', props: { slides: normalizeHeroSlides(props.slides), ...appearance(props.appearance, { surface: 'contrast', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === LOGO_CLOUD_BLOCK_TYPE) return { type: 'LogoCloud', props: { heading: asString(props.heading), logos: normalizeLogos(props.logos), ...appearance(props.appearance, { surface: 'default', spacing: 'compact' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === STATS_BLOCK_TYPE) return { type: 'Stats', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeStats(props.items), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === PRICING_BLOCK_TYPE) return { type: 'Pricing', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), plans: normalizePricingEditor(props.plans), ...appearance(props.appearance, { surface: 'default', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === TEAM_BLOCK_TYPE) return { type: 'Team', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), members: normalizeMembers(props.members), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === GALLERY_BLOCK_TYPE) return { type: 'Gallery', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), images: normalizeImages(props.images), columns: props.columns === 2 || props.columns === '2' ? '2' : props.columns === 4 || props.columns === '4' ? '4' : '3', ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === BAR_CHART_BLOCK_TYPE) return { type: 'BarChart', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), unit: asString(props.unit), items: normalizeBars(props.items), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  return null;
}

function attachAppearance(props: Record<string, unknown>, raw: Record<string, unknown>, fallback: BlockAppearance, include: boolean): Record<string, unknown> {
  const next = { ...props };
  const resolved = appearance({ surface: raw.surface, spacing: raw.spacing }, fallback);
  if (include || resolved.surface !== fallback.surface || resolved.spacing !== fallback.spacing) next.appearance = resolved;
  return next;
}

export function catalogPuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'HeroSplit') {
    const props: Record<string, unknown> = { eyebrow: asString(raw.eyebrow), title: asString(raw.title), body: asString(raw.body), mediaPosition: raw.mediaPosition === 'left' ? 'left' : 'right' };
    if (asString(raw.primaryLabel) || asString(raw.primaryUrl)) props.primaryCta = { label: asString(raw.primaryLabel), url: asString(raw.primaryUrl) };
    if (asString(raw.imageSrc) || asString(raw.imageAlt)) props.image = { src: asString(raw.imageSrc), alt: asString(raw.imageAlt) };
    return { type: HERO_SPLIT_BLOCK_TYPE, props: attachAppearance(props, raw, { surface: 'default', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'HeroSlider') return { type: HERO_SLIDER_BLOCK_TYPE, props: attachAppearance({ slides: normalizeHeroSlides(raw.slides) }, raw, { surface: 'contrast', spacing: 'spacious' }, includeAppearance) };
  if (type === 'LogoCloud') return { type: LOGO_CLOUD_BLOCK_TYPE, props: attachAppearance({ heading: asString(raw.heading), logos: normalizeLogos(raw.logos) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'Stats') return { type: STATS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeStats(raw.items) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Pricing') {
    const plans: PricingPlanItem[] = normalizePricingEditor(raw.plans).map((plan) => ({ name: plan.name, price: plan.price, period: plan.period, description: plan.description, features: plan.featuresText.split('\n').map((feature) => feature.trim()).filter(Boolean), buttonLabel: plan.buttonLabel, buttonUrl: plan.buttonUrl, featured: plan.featured === 'yes' }));
    return { type: PRICING_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), plans }, raw, { surface: 'default', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'Team') return { type: TEAM_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), members: normalizeMembers(raw.members) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Gallery') return { type: GALLERY_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), images: normalizeImages(raw.images), columns: raw.columns === '2' ? 2 : raw.columns === '4' ? 4 : 3 }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'BarChart') return { type: BAR_CHART_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), unit: asString(raw.unit), items: normalizeBars(raw.items) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  return null;
}

export const CATALOG_GALLERY_ITEMS: ReadonlyArray<{ type: CatalogComponentType; testId: string; category: string; title: string; description: string }> = [
  { type: 'HeroSplit', testId: 'page-builder-block-option-hero-split', category: '첫 화면', title: '분할 히어로', description: '메시지와 대표 이미지를 좌우로 나눠 소개합니다.' },
  { type: 'HeroSlider', testId: 'page-builder-block-option-hero-slider', category: '첫 화면', title: '슬라이더 히어로', description: '여러 캠페인 장면을 스크롤 가능한 흐름으로 보여줍니다.' },
  { type: 'LogoCloud', testId: 'page-builder-block-option-logo-cloud', category: '신뢰', title: '로고 클라우드', description: '고객사와 파트너 이름 또는 로고를 정돈해 보여줍니다.' },
  { type: 'Stats', testId: 'page-builder-block-option-stats', category: '데이터', title: '숫자·아이콘 지표', description: '핵심 수치와 설명을 아이콘 조합으로 강조합니다.' },
  { type: 'Pricing', testId: 'page-builder-block-option-pricing', category: '전환', title: '요금제', description: '2~4개 플랜의 가격, 기능과 추천안을 비교합니다.' },
  { type: 'Team', testId: 'page-builder-block-option-team', category: '회사 소개', title: '팀 소개', description: '구성원의 사진, 역할과 전문성을 소개합니다.' },
  { type: 'Gallery', testId: 'page-builder-block-option-gallery', category: '미디어', title: '갤러리 그리드', description: '2~4열 이미지와 캡션으로 프로젝트를 전시합니다.' },
  { type: 'BarChart', testId: 'page-builder-block-option-bar-chart', category: '데이터', title: '막대그래프', description: '0~100 범위의 데이터를 접근 가능한 그래프로 비교합니다.' },
];

export function CatalogGalleryThumbnail({ type }: { type: CatalogComponentType }): React.ReactElement {
  return <div className={`g7pb-block-thumb g7pb-block-thumb--catalog g7pb-block-thumb--${type.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`).replace(/^-/, '')}`} data-block-preview={type} aria-hidden="true"><b /><span><i /><i /><i /><i /></span><em /></div>;
}
