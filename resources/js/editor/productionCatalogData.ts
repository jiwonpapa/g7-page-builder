import type { AnchorMenuItem, BreadcrumbItem, CardGridItem, ImageCarouselItem, SocialLinkItem, SocialNetwork } from '../documents/types';
import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';

export interface DividerEditorProps extends AppearanceEditorProps {
  variant: 'solid' | 'dashed' | 'gradient';
  width: 'narrow' | 'standard' | 'full';
  label: string;
}

export interface BlockquoteEditorProps extends AppearanceEditorProps {
  quote: string;
  citation: string;
  role: string;
  alignment: 'left' | 'center';
  variant: 'line' | 'mark';
}

export interface NoticeEditorProps extends AppearanceEditorProps {
  tone: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
}

export interface CardGridEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: CardGridItem[];
  columns: '2' | '3';
  variant: 'plain' | 'outlined';
  layout: 'grid' | 'bento' | 'rail' | 'editorial' | 'numbered';
}

export interface BreadcrumbsEditorProps extends AppearanceEditorProps {
  items: BreadcrumbItem[];
  currentLabel: string;
}

export interface AnchorMenuEditorProps extends AppearanceEditorProps {
  label: string;
  items: AnchorMenuItem[];
  sticky: boolean;
  alignment: 'left' | 'center';
}

export interface SocialLinksEditorProps extends AppearanceEditorProps {
  heading: string;
  items: SocialLinkItem[];
  variant: 'icons' | 'labels';
  alignment: 'left' | 'center' | 'right';
}

export interface ImageCarouselEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  images: ImageCarouselItem[];
  autoplay: boolean;
  interval: '3000' | '5000' | '7000';
  controls: 'arrows' | 'dots' | 'both';
  aspectRatio: '16:9' | '4:3' | '1:1';
}

export interface ProductionCatalogEditorComponents {
  Divider: DividerEditorProps;
  Blockquote: BlockquoteEditorProps;
  Notice: NoticeEditorProps;
  CardGrid: CardGridEditorProps;
  Breadcrumbs: BreadcrumbsEditorProps;
  AnchorMenu: AnchorMenuEditorProps;
  SocialLinks: SocialLinksEditorProps;
  ImageCarousel: ImageCarouselEditorProps;
}

export type ProductionComponentType = keyof ProductionCatalogEditorComponents;

export const SOCIAL_NETWORKS: Array<{ label: string; value: SocialNetwork }> = [
  { label: 'Instagram', value: 'instagram' }, { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' }, { label: 'LinkedIn', value: 'linkedin' },
  { label: 'X', value: 'x' }, { label: 'Kakao', value: 'kakao' },
  { label: '블로그', value: 'blog' }, { label: '웹사이트', value: 'website' },
];

export const DEFAULT_DIVIDER: DividerEditorProps = {
  variant: 'solid', width: 'standard', label: '', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_BLOCKQUOTE: BlockquoteEditorProps = {
  quote: '고객이 기억할 한 문장의 경험을 인용문으로 보여주세요.', citation: '홍길동', role: '고객', alignment: 'left', variant: 'mark',
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_NOTICE: NoticeEditorProps = {
  tone: 'info', title: '방문 전 확인해 주세요', body: '운영 시간, 신청 조건처럼 놓치면 안 되는 내용을 간결하게 안내합니다.',
  actionLabel: '자세히 보기', actionUrl: '/guide', surface: 'soft', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_CARD_GRID: CardGridEditorProps = {
  eyebrow: 'SERVICES', heading: '필요한 서비스를 선택하세요',
  items: [
    { kicker: '01', title: '상담', body: '목표와 상황을 함께 정리해 적합한 방향을 제안합니다.', linkLabel: '상담 보기', linkUrl: '/consulting' },
    { kicker: '02', title: '구축', body: '검증된 구조와 일정으로 실제 사용할 결과물을 완성합니다.', linkLabel: '구축 보기', linkUrl: '/build' },
    { kicker: '03', title: '운영', body: '발행 이후의 개선과 유지관리까지 안정적으로 지원합니다.', linkLabel: '운영 보기', linkUrl: '/operation' },
  ],
  columns: '3', variant: 'outlined', layout: 'bento', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_BREADCRUMBS: BreadcrumbsEditorProps = {
  items: [{ label: '홈', url: '/' }, { label: '서비스', url: '/services' }], currentLabel: '상세 안내',
  surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_ANCHOR_MENU: AnchorMenuEditorProps = {
  label: '이 페이지에서', items: [{ label: '소개', anchor: 'intro' }, { label: '서비스', anchor: 'services' }, { label: '문의', anchor: 'contact' }],
  sticky: false, alignment: 'left', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_SOCIAL_LINKS: SocialLinksEditorProps = {
  heading: '공식 채널', items: [{ network: 'instagram', label: '인스타그램', url: 'https://instagram.com/' }, { network: 'youtube', label: '유튜브', url: 'https://youtube.com/' }],
  variant: 'icons', alignment: 'left', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_IMAGE_CAROUSEL: ImageCarouselEditorProps = {
  eyebrow: 'GALLERY', heading: '장면을 넘겨보세요',
  images: [{ src: '', alt: '첫 번째 장면', caption: '첫 번째 장면' }, { src: '', alt: '두 번째 장면', caption: '두 번째 장면' }, { src: '', alt: '세 번째 장면', caption: '세 번째 장면' }],
  autoplay: false, interval: '5000', controls: 'both', aspectRatio: '16:9',
  surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>) => T): T[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, max).map((item) => map(asRecord(item)));
}

export function normalizeCards(value: unknown): CardGridItem[] {
  return normalizeArray(value, DEFAULT_CARD_GRID.items, 6, (item) => ({
    kicker: asString(item.kicker), title: asString(item.title), body: asString(item.body),
    linkLabel: asString(item.linkLabel), linkUrl: asString(item.linkUrl),
  }));
}

export function normalizeBreadcrumbs(value: unknown): BreadcrumbItem[] {
  return normalizeArray(value, DEFAULT_BREADCRUMBS.items, 6, (item) => ({ label: asString(item.label), url: asString(item.url) }));
}

function normalizeAnchor(value: unknown): string {
  const normalized = asString(value).trim().toLocaleLowerCase('en-US').replace(/^#+/, '')
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  if (!normalized) return 'section';
  return (/^[a-z]/.test(normalized) ? normalized : `section-${normalized}`).slice(0, 80).replace(/-+$/g, '');
}

export function normalizeAnchors(value: unknown): AnchorMenuItem[] {
  return normalizeArray(value, DEFAULT_ANCHOR_MENU.items, 8, (item) => ({ label: asString(item.label), anchor: normalizeAnchor(item.anchor) }));
}

export function normalizeSocialLinks(value: unknown): SocialLinkItem[] {
  return normalizeArray(value, DEFAULT_SOCIAL_LINKS.items, 8, (item) => {
    const network = asString(item.network) as SocialNetwork;
    return { network: SOCIAL_NETWORKS.some((option) => option.value === network) ? network : 'website', label: asString(item.label), url: asString(item.url) };
  });
}

export function normalizeImages(value: unknown): ImageCarouselItem[] {
  return normalizeArray(value, DEFAULT_IMAGE_CAROUSEL.images, 8, (item) => ({ src: asString(item.src), alt: asString(item.alt), caption: asString(item.caption) }));
}
