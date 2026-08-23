import React from 'react';
import type { Config } from '@puckeditor/core';

import { createMotionField, DEFAULT_BLOCK_MOTION, motionPreviewAttributes, normalizeBlockMotion } from './blockMotion';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import {
  decorateCanvasElementStyles,
  normalizeElementAppearanceMap,
  notifyCanvasElementSelection,
  useCanvasElementStyles,
} from './canvasEditingContract';
import {
  ANCHOR_MENU_BLOCK_TYPE,
  BLOCKQUOTE_BLOCK_TYPE,
  BREADCRUMBS_BLOCK_TYPE,
  CARD_GRID_BLOCK_TYPE,
  DIVIDER_BLOCK_TYPE,
  IMAGE_CAROUSEL_BLOCK_TYPE,
  NOTICE_BLOCK_TYPE,
  SOCIAL_LINKS_BLOCK_TYPE,
  type AnchorMenuItem,
  type BlockAppearance,
  type BlockMotion,
  type BreadcrumbItem,
  type CardGridItem,
  type ElementAppearanceMap,
  type ImageCarouselItem,
  type PageBuilderBlock,
  type SocialLinkItem,
  type SocialNetwork,
} from '../documents/types';

interface AppearanceEditorProps {
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

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

const SOCIAL_NETWORKS: Array<{ label: string; value: SocialNetwork }> = [
  { label: 'Instagram', value: 'instagram' }, { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' }, { label: 'LinkedIn', value: 'linkedin' },
  { label: 'X', value: 'x' }, { label: 'Kakao', value: 'kakao' },
  { label: '블로그', value: 'blog' }, { label: '웹사이트', value: 'website' },
];

const SOCIAL_GLYPHS: Record<SocialNetwork, string> = {
  instagram: 'IG', youtube: 'YT', facebook: 'f', linkedin: 'in', x: 'X', kakao: 'K', blog: 'B', website: '↗',
};

const DEFAULT_DIVIDER: DividerEditorProps = {
  variant: 'solid', width: 'standard', label: '', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_BLOCKQUOTE: BlockquoteEditorProps = {
  quote: '고객이 기억할 한 문장의 경험을 인용문으로 보여주세요.', citation: '홍길동', role: '고객', alignment: 'left', variant: 'mark',
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_NOTICE: NoticeEditorProps = {
  tone: 'info', title: '방문 전 확인해 주세요', body: '운영 시간, 신청 조건처럼 놓치면 안 되는 내용을 간결하게 안내합니다.',
  actionLabel: '자세히 보기', actionUrl: '/guide', surface: 'soft', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_CARD_GRID: CardGridEditorProps = {
  eyebrow: 'SERVICES', heading: '필요한 서비스를 선택하세요',
  items: [
    { kicker: '01', title: '상담', body: '목표와 상황을 함께 정리해 적합한 방향을 제안합니다.', linkLabel: '상담 보기', linkUrl: '/consulting' },
    { kicker: '02', title: '구축', body: '검증된 구조와 일정으로 실제 사용할 결과물을 완성합니다.', linkLabel: '구축 보기', linkUrl: '/build' },
    { kicker: '03', title: '운영', body: '발행 이후의 개선과 유지관리까지 안정적으로 지원합니다.', linkLabel: '운영 보기', linkUrl: '/operation' },
  ],
  columns: '3', variant: 'outlined', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_BREADCRUMBS: BreadcrumbsEditorProps = {
  items: [{ label: '홈', url: '/' }, { label: '서비스', url: '/services' }], currentLabel: '상세 안내',
  surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_ANCHOR_MENU: AnchorMenuEditorProps = {
  label: '이 페이지에서', items: [{ label: '소개', anchor: 'intro' }, { label: '서비스', anchor: 'services' }, { label: '문의', anchor: 'contact' }],
  sticky: false, alignment: 'left', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_SOCIAL_LINKS: SocialLinksEditorProps = {
  heading: '공식 채널', items: [{ network: 'instagram', label: '인스타그램', url: 'https://instagram.com/' }, { network: 'youtube', label: '유튜브', url: 'https://youtube.com/' }],
  variant: 'icons', alignment: 'left', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_IMAGE_CAROUSEL: ImageCarouselEditorProps = {
  eyebrow: 'GALLERY', heading: '장면을 넘겨보세요',
  images: [{ src: '', alt: '첫 번째 장면', caption: '첫 번째 장면' }, { src: '', alt: '두 번째 장면', caption: '두 번째 장면' }, { src: '', alt: '세 번째 장면', caption: '세 번째 장면' }],
  autoplay: false, interval: '5000', controls: 'both', aspectRatio: '16:9',
  surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>) => T): T[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, max).map((item) => map(asRecord(item)));
}

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback;
}

function normalizeCards(value: unknown): CardGridItem[] {
  return normalizeArray(value, DEFAULT_CARD_GRID.items, 6, (item) => ({
    kicker: asString(item.kicker), title: asString(item.title), body: asString(item.body),
    linkLabel: asString(item.linkLabel), linkUrl: asString(item.linkUrl),
  }));
}

function normalizeBreadcrumbs(value: unknown): BreadcrumbItem[] {
  return normalizeArray(value, DEFAULT_BREADCRUMBS.items, 6, (item) => ({ label: asString(item.label), url: asString(item.url) }));
}

function normalizeAnchor(value: unknown): string {
  const normalized = asString(value).trim().toLocaleLowerCase('en-US').replace(/^#+/, '')
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  if (!normalized) return 'section';
  return (/^[a-z]/.test(normalized) ? normalized : `section-${normalized}`).slice(0, 80).replace(/-+$/g, '');
}

function normalizeAnchors(value: unknown): AnchorMenuItem[] {
  return normalizeArray(value, DEFAULT_ANCHOR_MENU.items, 8, (item) => ({ label: asString(item.label), anchor: normalizeAnchor(item.anchor) }));
}

function normalizeSocialLinks(value: unknown): SocialLinkItem[] {
  return normalizeArray(value, DEFAULT_SOCIAL_LINKS.items, 8, (item) => {
    const network = asString(item.network) as SocialNetwork;
    return { network: SOCIAL_NETWORKS.some((option) => option.value === network) ? network : 'website', label: asString(item.label), url: asString(item.url) };
  });
}

function normalizeImages(value: unknown): ImageCarouselItem[] {
  return normalizeArray(value, DEFAULT_IMAGE_CAROUSEL.images, 8, (item) => ({ src: asString(item.src), alt: asString(item.alt), caption: asString(item.caption) }));
}

function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } {
  const record = asRecord(value);
  const resolved: BlockAppearance = {
    surface: record.surface === 'soft' || record.surface === 'contrast' ? record.surface : fallback.surface,
    spacing: record.spacing === 'compact' || record.spacing === 'spacious' ? record.spacing : fallback.spacing,
  };
  if (record.textScale === 'compact' || record.textScale === 'large') resolved.textScale = record.textScale;
  if (record.textAlign === 'center' || record.textAlign === 'right') resolved.textAlign = record.textAlign;
  const elements = normalizeElementAppearanceMap(record.elementStyles ?? record.elements);
  return Object.keys(elements).length > 0 ? { ...resolved, elementStyles: elements } : resolved;
}

function common(block: PageBuilderBlock, fallback: BlockAppearance): Pick<AppearanceEditorProps, 'surface' | 'spacing' | 'textScale' | 'textAlign' | 'elementStyles' | 'motion'> {
  return { ...appearance(block.props.appearance, fallback), motion: normalizeBlockMotion(block.motion) };
}

function attachAppearance(props: Record<string, unknown>, raw: Record<string, unknown>, fallback: BlockAppearance, include: boolean): Record<string, unknown> {
  const next = { ...props };
  const editor = appearance({ surface: raw.surface, spacing: raw.spacing, textScale: raw.textScale, textAlign: raw.textAlign, elementStyles: raw.elementStyles }, fallback);
  const { elementStyles, ...resolved } = editor;
  const canonical: BlockAppearance = { ...resolved, ...(elementStyles && Object.keys(elementStyles).length > 0 ? { elements: elementStyles } : {}) };
  if (include || canonical.surface !== fallback.surface || canonical.spacing !== fallback.spacing || canonical.textScale || canonical.textAlign || canonical.elements) next.appearance = canonical;
  return next;
}

function safeLink(value: string): string {
  const trimmed = value.trim();
  if (/[\\\u0000-\u0020\u007f]/.test(trimmed)) return '#';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (trimmed.startsWith('#') && /^#[a-z][a-z0-9-]{0,79}$/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (['https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return trimmed;
  } catch {
    // Invalid values remain editable but inert in the canvas.
  }
  return '#';
}

function safeImage(value: string): string | null {
  const link = safeLink(value);
  return link === '#' || link.startsWith('mailto:') || link.startsWith('tel:') ? null : link;
}

function surfaceClass(props: AppearanceEditorProps): string {
  return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`;
}

function Frame({ id, type, motion, elementStyles, children }: { id: string; type: string; motion: BlockMotion; elementStyles?: ElementAppearanceMap; children: React.ReactNode }): React.ReactElement {
  const resolved = useCanvasElementStyles(id, elementStyles);
  return <section className="g7pb-preview-block" data-testid="page-builder-block" data-block-id={id} data-block-type={type}
    onPointerDownCapture={(event) => notifyCanvasElementSelection(event, id, type)} {...motionPreviewAttributes(motion)}>
    {decorateCanvasElementStyles(children, resolved)}
  </section>;
}

function DividerPreview(props: DividerEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="divider" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-divider g7pb-preview-divider--${props.variant} g7pb-preview-divider--${props.width} ${surfaceClass(props)}`}>
      <span aria-hidden="true" />{props.label ? <small data-g7pb-inline-field="label">{props.label}</small> : null}<span aria-hidden="true" />
    </div>
  </Frame>;
}

function BlockquotePreview(props: BlockquoteEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="blockquote" motion={props.motion} elementStyles={props.elementStyles}>
    <blockquote className={`g7pb-preview-blockquote g7pb-preview-blockquote--${props.variant} g7pb-preview-blockquote--${props.alignment} ${surfaceClass(props)}`}>
      <p data-g7pb-inline-field="quote">{props.quote}</p><footer><cite data-g7pb-inline-field="citation">{props.citation}</cite>{props.role ? <span data-g7pb-inline-field="role">{props.role}</span> : null}</footer>
    </blockquote>
  </Frame>;
}

function NoticePreview(props: NoticeEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="notice" motion={props.motion} elementStyles={props.elementStyles}>
    <aside className={`g7pb-preview-notice g7pb-preview-notice--${props.tone} ${surfaceClass(props)}`} role={props.tone === 'critical' ? 'alert' : 'note'}>
      <i aria-hidden="true" /><div><strong data-g7pb-inline-field="title">{props.title}</strong><p data-g7pb-inline-field="body">{props.body}</p></div>
      {props.actionLabel ? <a href={safeLink(props.actionUrl)} data-g7pb-action-field="actionLabel" onClick={(event) => event.preventDefault()}>{props.actionLabel} →</a> : null}
    </aside>
  </Frame>;
}

function CardGridPreview(props: CardGridEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="card-grid" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-card-grid g7pb-preview-card-grid--${props.columns} g7pb-preview-card-grid--${props.variant} ${surfaceClass(props)}`}>
      <header>{props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}<h2 data-g7pb-inline-field="heading">{props.heading}</h2></header>
      <div>{normalizeCards(props.items).map((item, index) => <article key={`${item.title}-${index}`}><small data-g7pb-inline-field={`items.${index}.kicker`}>{inlineArrayContent(props.items, index, 'kicker', item.kicker)}</small><h3 data-g7pb-inline-field={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</h3><p data-g7pb-inline-field={`items.${index}.body`}>{inlineArrayContent(props.items, index, 'body', item.body)}</p>{item.linkLabel ? <a href={safeLink(item.linkUrl)} data-g7pb-action-field={`items.${index}.linkLabel`} onClick={(event) => event.preventDefault()}>{inlineArrayContent(props.items, index, 'linkLabel', item.linkLabel)} →</a> : null}</article>)}</div>
    </div>
  </Frame>;
}

function BreadcrumbsPreview(props: BreadcrumbsEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="breadcrumbs" motion={props.motion} elementStyles={props.elementStyles}>
    <nav className={`g7pb-preview-breadcrumbs ${surfaceClass(props)}`} aria-label="경로"><ol>{normalizeBreadcrumbs(props.items).map((item, index) => <li key={`${item.label}-${index}`}><a href={safeLink(item.url)} data-g7pb-action-field={`items.${index}.label`} onClick={(event) => event.preventDefault()}>{inlineArrayContent(props.items, index, 'label', item.label)}</a></li>)}<li aria-current="page" data-g7pb-inline-field="currentLabel">{props.currentLabel}</li></ol></nav>
  </Frame>;
}

function AnchorMenuPreview(props: AnchorMenuEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="anchor-menu" motion={props.motion} elementStyles={props.elementStyles}>
    <nav className={`g7pb-preview-anchor-menu g7pb-preview-anchor-menu--${props.alignment}${props.sticky ? ' g7pb-preview-anchor-menu--sticky' : ''} ${surfaceClass(props)}`} aria-label={props.label}><strong data-g7pb-inline-field="label">{props.label}</strong><ul>{normalizeAnchors(props.items).map((item, index) => <li key={`${item.anchor}-${index}`}><a href={`#${item.anchor}`} data-g7pb-action-field={`items.${index}.label`} onClick={(event) => event.preventDefault()}>{inlineArrayContent(props.items, index, 'label', item.label)}</a></li>)}</ul></nav>
  </Frame>;
}

function SocialLinksPreview(props: SocialLinksEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="social-links" motion={props.motion} elementStyles={props.elementStyles}>
    <nav className={`g7pb-preview-social-links g7pb-preview-social-links--${props.variant} g7pb-preview-social-links--${props.alignment} ${surfaceClass(props)}`} aria-label={props.heading}><h2 data-g7pb-inline-field="heading">{props.heading}</h2><ul>{normalizeSocialLinks(props.items).map((item, index) => <li key={`${item.network}-${index}`}><a href={safeLink(item.url)} onClick={(event) => event.preventDefault()} aria-label={item.label}><i aria-hidden="true">{SOCIAL_GLYPHS[item.network]}</i><span data-g7pb-inline-field={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</span></a></li>)}</ul></nav>
  </Frame>;
}

function ImageCarouselPreview(props: ImageCarouselEditorProps & { id: string }): React.ReactElement {
  const images = normalizeImages(props.images);
  return <Frame id={props.id} type="image-carousel" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-image-carousel g7pb-preview-image-carousel--${props.aspectRatio.replace(':', '-')} ${surfaceClass(props)}`}>
      <header>{props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}<h2 data-g7pb-inline-field="heading">{props.heading}</h2></header>
      <div className="g7pb-preview-image-carousel__stage">{images.map((item, index) => <figure key={`${item.src}-${index}`} aria-hidden={index > 0}>{safeImage(item.src) ? <img src={safeImage(item.src) ?? undefined} alt={item.alt} data-g7pb-media-field={`images.${index}.src`} /> : <span role="img" aria-label={`${index + 1}번 이미지를 선택하세요`}>{String(index + 1).padStart(2, '0')}</span>}<figcaption data-g7pb-inline-field={`images.${index}.caption`}>{inlineArrayContent(props.images, index, 'caption', item.caption)}</figcaption></figure>)}</div>
      <div className="g7pb-preview-image-carousel__controls" aria-hidden="true"><button type="button" tabIndex={-1}>←</button><span>{images.map((_, index) => <i key={index} />)}</span><button type="button" tabIndex={-1}>→</button></div>
    </div>
  </Frame>;
}

const appearanceFields = {
  elementStyles: { type: 'custom' as const, label: '캔버스 요소 스타일', render: () => <></> },
  surface: { type: 'select' as const, label: '배경 프리셋', options: SURFACE_OPTIONS },
  spacing: { type: 'select' as const, label: '세로 여백', options: SPACING_OPTIONS },
};

const alignmentOptions = [{ label: '왼쪽', value: 'left' }, { label: '가운데', value: 'center' }];

export const productionCatalogComponentConfigs: Config<ProductionCatalogEditorComponents>['components'] = {
  Divider: {
    label: '구분선', defaultProps: DEFAULT_DIVIDER,
    fields: { label: { type: 'text', label: '선택 문구', contentEditable: true }, variant: { type: 'radio', label: '선 모양', options: [{ label: '실선', value: 'solid' }, { label: '점선', value: 'dashed' }, { label: '그라데이션', value: 'gradient' }] }, width: { type: 'radio', label: '너비', options: [{ label: '좁게', value: 'narrow' }, { label: '기본', value: 'standard' }, { label: '전체', value: 'full' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <DividerPreview {...props} />,
  },
  Blockquote: {
    label: '인용문', defaultProps: DEFAULT_BLOCKQUOTE,
    fields: { quote: { type: 'textarea', label: '인용문', contentEditable: true }, citation: { type: 'text', label: '인용자', contentEditable: true }, role: { type: 'text', label: '역할·소속', contentEditable: true }, alignment: { type: 'radio', label: '정렬', options: alignmentOptions }, variant: { type: 'radio', label: '표현', options: [{ label: '선', value: 'line' }, { label: '큰 따옴표', value: 'mark' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <BlockquotePreview {...props} />,
  },
  Notice: {
    label: '알림·안내', defaultProps: DEFAULT_NOTICE,
    fields: { tone: { type: 'select', label: '안내 성격', options: [{ label: '정보', value: 'info' }, { label: '완료', value: 'success' }, { label: '주의', value: 'warning' }, { label: '중요', value: 'critical' }] }, title: { type: 'text', label: '제목', contentEditable: true }, body: { type: 'textarea', label: '내용', contentEditable: true }, actionLabel: { type: 'text', label: '링크 문구', contentEditable: true }, actionUrl: createRouteUrlField('안내 연결'), ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <NoticePreview {...props} />,
  },
  CardGrid: {
    label: '카드 그리드', defaultProps: DEFAULT_CARD_GRID,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, items: { type: 'array', label: '카드', min: 2, max: 6, defaultItemProps: (index) => ({ kicker: String(index + 1).padStart(2, '0'), title: `카드 ${index + 1}`, body: '카드 설명을 입력하세요.', linkLabel: '자세히 보기', linkUrl: '/' }), getItemSummary: (item) => item.title, arrayFields: { kicker: { type: 'text', label: '보조 문구', contentEditable: true }, title: { type: 'text', label: '제목', contentEditable: true }, body: { type: 'textarea', label: '설명', contentEditable: true }, linkLabel: { type: 'text', label: '링크 문구', contentEditable: true }, linkUrl: createRouteUrlField('카드 연결') } }, columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }] }, variant: { type: 'radio', label: '카드 표현', options: [{ label: '여백 중심', value: 'plain' }, { label: '테두리', value: 'outlined' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
    render: (props) => <CardGridPreview {...props} />,
  },
  Breadcrumbs: {
    label: '경로 탐색', defaultProps: DEFAULT_BREADCRUMBS,
    fields: { items: { type: 'array', label: '상위 경로', min: 1, max: 6, defaultItemProps: (index) => ({ label: `경로 ${index + 1}`, url: '/' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, url: createRouteUrlField('경로 연결') } }, currentLabel: { type: 'text', label: '현재 페이지', contentEditable: true }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <BreadcrumbsPreview {...props} />,
  },
  AnchorMenu: {
    label: '섹션 바로가기', defaultProps: DEFAULT_ANCHOR_MENU,
    fields: { label: { type: 'text', label: '메뉴 이름', contentEditable: true }, items: { type: 'array', label: '바로가기', min: 2, max: 8, defaultItemProps: (index) => ({ label: `섹션 ${index + 1}`, anchor: `section-${index + 1}` }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '이름', contentEditable: true }, anchor: { type: 'text', label: '섹션 앵커' } } }, sticky: { type: 'radio', label: '스크롤 고정', options: [{ label: '사용', value: true }, { label: '사용 안 함', value: false }] }, alignment: { type: 'radio', label: '정렬', options: alignmentOptions }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <AnchorMenuPreview {...props} />,
  },
  SocialLinks: {
    label: '소셜 링크', defaultProps: DEFAULT_SOCIAL_LINKS,
    fields: { heading: { type: 'text', label: '제목', contentEditable: true }, items: { type: 'array', label: '채널', min: 1, max: 8, defaultItemProps: (index) => ({ network: 'website', label: `채널 ${index + 1}`, url: 'https://' }), getItemSummary: (item) => item.label, arrayFields: { network: { type: 'select', label: '채널 종류', options: SOCIAL_NETWORKS }, label: { type: 'text', label: '채널 이름', contentEditable: true }, url: createRouteUrlField('채널 연결') } }, variant: { type: 'radio', label: '표현', options: [{ label: '아이콘', value: 'icons' }, { label: '이름 표시', value: 'labels' }] }, alignment: { type: 'radio', label: '정렬', options: [...alignmentOptions, { label: '오른쪽', value: 'right' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
    render: (props) => <SocialLinksPreview {...props} />,
  },
  ImageCarousel: {
    label: '이미지 캐러셀', defaultProps: DEFAULT_IMAGE_CAROUSEL,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, images: { type: 'array', label: '이미지', min: 2, max: 8, defaultItemProps: (index) => ({ src: '', alt: `${index + 1}번 이미지`, caption: `${index + 1}번 장면` }), getItemSummary: (item, index) => item.caption || `이미지 ${(index ?? 0) + 1}`, arrayFields: { src: createMediaField('캐러셀 이미지'), alt: { type: 'text', label: '대체 텍스트' }, caption: { type: 'text', label: '캡션', contentEditable: true } } }, autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: true }, { label: '사용 안 함', value: false }] }, interval: { type: 'select', label: '자동 재생 간격', options: [{ label: '3초', value: '3000' }, { label: '5초', value: '5000' }, { label: '7초', value: '7000' }] }, controls: { type: 'radio', label: '탐색 버튼', options: [{ label: '화살표', value: 'arrows' }, { label: '점', value: 'dots' }, { label: '모두', value: 'both' }] }, aspectRatio: { type: 'select', label: '이미지 비율', options: [{ label: '16:9', value: '16:9' }, { label: '4:3', value: '4:3' }, { label: '1:1', value: '1:1' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'parallax-soft']) },
    render: (props) => <ImageCarouselPreview {...props} />,
  },
};

export function canonicalProductionBlockToPuck(block: PageBuilderBlock): { type: ProductionComponentType; props: ProductionCatalogEditorComponents[ProductionComponentType] } | null {
  const props = block.props;
  if (block.type === DIVIDER_BLOCK_TYPE) return { type: 'Divider', props: { variant: props.variant === 'dashed' || props.variant === 'gradient' ? props.variant : 'solid', width: props.width === 'narrow' || props.width === 'full' ? props.width : 'standard', label: asString(props.label), ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === BLOCKQUOTE_BLOCK_TYPE) return { type: 'Blockquote', props: { quote: asString(props.quote), citation: asString(props.citation), role: asString(props.role), alignment: props.alignment === 'center' ? 'center' : 'left', variant: props.variant === 'line' ? 'line' : 'mark', ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  if (block.type === NOTICE_BLOCK_TYPE) return { type: 'Notice', props: { tone: props.tone === 'success' || props.tone === 'warning' || props.tone === 'critical' ? props.tone : 'info', title: asString(props.title), body: asString(props.body), actionLabel: asString(props.actionLabel), actionUrl: asString(props.actionUrl), ...common(block, { surface: 'soft', spacing: 'compact' }) } };
  if (block.type === CARD_GRID_BLOCK_TYPE) return { type: 'CardGrid', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeCards(props.items), columns: props.columns === 2 || props.columns === '2' ? '2' : '3', variant: props.variant === 'plain' ? 'plain' : 'outlined', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === BREADCRUMBS_BLOCK_TYPE) return { type: 'Breadcrumbs', props: { items: normalizeBreadcrumbs(props.items), currentLabel: asString(props.currentLabel), ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === ANCHOR_MENU_BLOCK_TYPE) return { type: 'AnchorMenu', props: { label: asString(props.label), items: normalizeAnchors(props.items), sticky: props.sticky === true, alignment: props.alignment === 'center' ? 'center' : 'left', ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === SOCIAL_LINKS_BLOCK_TYPE) return { type: 'SocialLinks', props: { heading: asString(props.heading), items: normalizeSocialLinks(props.items), variant: props.variant === 'labels' ? 'labels' : 'icons', alignment: props.alignment === 'center' || props.alignment === 'right' ? props.alignment : 'left', ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === IMAGE_CAROUSEL_BLOCK_TYPE) return { type: 'ImageCarousel', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), images: normalizeImages(props.images), autoplay: props.autoplay === true, interval: props.interval === 3000 ? '3000' : props.interval === 7000 ? '7000' : '5000', controls: props.controls === 'arrows' || props.controls === 'dots' ? props.controls : 'both', aspectRatio: props.aspectRatio === '4:3' || props.aspectRatio === '1:1' ? props.aspectRatio : '16:9', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  return null;
}

export function productionPuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'Divider') return { type: DIVIDER_BLOCK_TYPE, props: attachAppearance({ variant: raw.variant === 'dashed' || raw.variant === 'gradient' ? raw.variant : 'solid', width: raw.width === 'narrow' || raw.width === 'full' ? raw.width : 'standard', label: asString(raw.label) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'Blockquote') return { type: BLOCKQUOTE_BLOCK_TYPE, props: attachAppearance({ quote: asString(raw.quote), citation: asString(raw.citation), role: asString(raw.role), alignment: raw.alignment === 'center' ? 'center' : 'left', variant: raw.variant === 'line' ? 'line' : 'mark' }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Notice') return { type: NOTICE_BLOCK_TYPE, props: attachAppearance({ tone: raw.tone === 'success' || raw.tone === 'warning' || raw.tone === 'critical' ? raw.tone : 'info', title: asString(raw.title), body: asString(raw.body), actionLabel: asString(raw.actionLabel), actionUrl: asString(raw.actionUrl) }, raw, { surface: 'soft', spacing: 'compact' }, includeAppearance) };
  if (type === 'CardGrid') return { type: CARD_GRID_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeCards(raw.items), columns: raw.columns === '2' ? 2 : 3, variant: raw.variant === 'plain' ? 'plain' : 'outlined' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'Breadcrumbs') return { type: BREADCRUMBS_BLOCK_TYPE, props: attachAppearance({ items: normalizeBreadcrumbs(raw.items), currentLabel: asString(raw.currentLabel) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'AnchorMenu') return { type: ANCHOR_MENU_BLOCK_TYPE, props: attachAppearance({ label: asString(raw.label), items: normalizeAnchors(raw.items), sticky: raw.sticky === true, alignment: raw.alignment === 'center' ? 'center' : 'left' }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'SocialLinks') return { type: SOCIAL_LINKS_BLOCK_TYPE, props: attachAppearance({ heading: asString(raw.heading), items: normalizeSocialLinks(raw.items), variant: raw.variant === 'labels' ? 'labels' : 'icons', alignment: raw.alignment === 'center' || raw.alignment === 'right' ? raw.alignment : 'left' }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'ImageCarousel') return { type: IMAGE_CAROUSEL_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), images: normalizeImages(raw.images), autoplay: raw.autoplay === true, interval: raw.interval === '3000' ? 3000 : raw.interval === '7000' ? 7000 : 5000, controls: raw.controls === 'arrows' || raw.controls === 'dots' ? raw.controls : 'both', aspectRatio: raw.aspectRatio === '4:3' || raw.aspectRatio === '1:1' ? raw.aspectRatio : '16:9' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  return null;
}
