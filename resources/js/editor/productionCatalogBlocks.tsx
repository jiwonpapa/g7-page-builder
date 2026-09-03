import React from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame as Frame } from './CatalogBlockFrame';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import { CatalogIcon } from './catalogIcon';
import { createMotionField } from './blockMotion';
import type { AppearanceEditorProps } from './catalogAppearance';
import {
  type DividerEditorProps,
  type BlockquoteEditorProps,
  type NoticeEditorProps,
  type CardGridEditorProps,
  type BreadcrumbsEditorProps,
  type AnchorMenuEditorProps,
  type SocialLinksEditorProps,
  type ImageCarouselEditorProps,
  type ProductionCatalogEditorComponents,
  SOCIAL_NETWORKS,
  DEFAULT_DIVIDER,
  DEFAULT_BLOCKQUOTE,
  DEFAULT_NOTICE,
  DEFAULT_CARD_GRID,
  DEFAULT_BREADCRUMBS,
  DEFAULT_ANCHOR_MENU,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_IMAGE_CAROUSEL,
  asRecord,
  normalizeCards,
  normalizeBreadcrumbs,
  normalizeAnchors,
  normalizeSocialLinks,
  normalizeImages,
} from './productionCatalogData';
export type {
  DividerEditorProps,
  BlockquoteEditorProps,
  NoticeEditorProps,
  CardGridEditorProps,
  BreadcrumbsEditorProps,
  AnchorMenuEditorProps,
  SocialLinksEditorProps,
  ImageCarouselEditorProps,
  ProductionCatalogEditorComponents,
  ProductionComponentType,
} from './productionCatalogData';
export { canonicalProductionBlockToPuck, productionPuckBlockToCanonical } from './productionCatalogCodec';

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

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback;
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
      <RichTextCanvasField fieldPath="quote" className="g7pb-preview-richtext g7pb-preview-blockquote__quote">{props.quote}</RichTextCanvasField><footer><cite data-g7pb-inline-field="citation">{props.citation}</cite>{props.role ? <span data-g7pb-inline-field="role">{props.role}</span> : null}</footer>
    </blockquote>
  </Frame>;
}

function NoticePreview(props: NoticeEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="notice" motion={props.motion} elementStyles={props.elementStyles}>
    <aside className={`g7pb-preview-notice g7pb-preview-notice--${props.tone} ${surfaceClass(props)}`} role={props.tone === 'critical' ? 'alert' : 'note'}>
      <i aria-hidden="true" /><div><RichTextCanvasField as="h2" className="g7pb-preview-richtext g7pb-preview-notice__title" fieldPath="title">{props.title}</RichTextCanvasField><RichTextCanvasField fieldPath="body" className="g7pb-preview-richtext g7pb-preview-notice__body">{props.body}</RichTextCanvasField></div>
      {props.actionLabel ? <a href={safeLink(props.actionUrl)} data-g7pb-action-field="actionLabel" onClick={(event) => event.preventDefault()}>{props.actionLabel} →</a> : null}
    </aside>
  </Frame>;
}

function CardGridPreview(props: CardGridEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="card-grid" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-card-grid g7pb-preview-card-grid--${props.columns} g7pb-preview-card-grid--${props.variant} g7pb-preview-card-grid--layout-${props.layout} ${surfaceClass(props)}`}>
      <header>{props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}<RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header>
      <div>{normalizeCards(props.items).map((item, index) => <article key={`${item.title}-${index}`}><small data-g7pb-inline-field={`items.${index}.kicker`}>{inlineArrayContent(props.items, index, 'kicker', item.kicker)}</small><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.body`} className="g7pb-preview-richtext g7pb-preview-card-grid__body">{inlineArrayContent(props.items, index, 'body', item.body)}</RichTextCanvasField>{item.linkUrl ? <a href={safeLink(item.linkUrl)} data-g7pb-action-field={`items.${index}.linkLabel`} onClick={(event) => event.preventDefault()}>{inlineArrayContent(props.items, index, 'linkLabel', item.linkLabel)}<span aria-hidden="true"> →</span></a> : null}</article>)}</div>
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
    <nav className={`g7pb-preview-social-links g7pb-preview-social-links--${props.variant} g7pb-preview-social-links--${props.alignment} ${surfaceClass(props)}`} aria-label={typeof props.heading === 'string' ? props.heading : undefined}><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField><ul>{normalizeSocialLinks(props.items).map((item, index) => <li key={`${item.network}-${index}`}><a href={safeLink(item.url)} onClick={(event) => event.preventDefault()} aria-label={item.label}><i aria-hidden="true"><CatalogIcon name={item.network} size={17} /></i><span data-g7pb-inline-field={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</span></a></li>)}</ul></nav>
  </Frame>;
}

function ImageCarouselPreview(props: ImageCarouselEditorProps & { id: string }): React.ReactElement {
  const images = normalizeImages(props.images);
  const [selected, setSelected] = React.useState(0);
  const active = Math.min(selected, Math.max(0, images.length - 1));
  const move = (step: number) => setSelected((active + step + images.length) % Math.max(1, images.length));
  return <Frame id={props.id} type="image-carousel" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-image-carousel g7pb-preview-image-carousel--${props.aspectRatio.replace(':', '-')} ${surfaceClass(props)}`}>
      <header>{props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}<RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header>
      <div className="g7pb-preview-image-carousel__stage">{images.map((item, index) => <figure key={`${item.src}-${index}`} hidden={index !== active}>{safeImage(item.src) ? <img src={safeImage(item.src) ?? undefined} alt={item.alt} data-g7pb-media-field={`images.${index}.src`} /> : <span role="img" data-g7pb-media-field={`images.${index}.src`} aria-label={`${index + 1}번 이미지를 선택하세요`}>{String(index + 1).padStart(2, '0')}</span>}<figcaption data-g7pb-inline-field={`images.${index}.caption`}>{inlineArrayContent(props.images, index, 'caption', item.caption)}</figcaption></figure>)}</div>
      <div className="g7pb-preview-image-carousel__controls">
        {props.controls !== 'dots' ? <button type="button" aria-label="이전 이미지" onClick={() => move(-1)}>←</button> : null}
        {props.controls !== 'arrows' ? <span>{images.map((_, index) => <button type="button" key={index} aria-label={`${index + 1}번 이미지`} aria-pressed={index === active} onClick={() => setSelected(index)} />)}</span> : null}
        {props.controls !== 'dots' ? <button type="button" aria-label="다음 이미지" onClick={() => move(1)}>→</button> : null}
      </div>
      <p className="g7pb-preview-image-carousel__status" aria-live="polite">{active + 1} / {images.length}</p>
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
    fields: { quote: createRichTextField('인용문', 150), citation: { type: 'text', label: '인용자', contentEditable: true }, role: { type: 'text', label: '역할·소속', contentEditable: true }, alignment: { type: 'radio', label: '정렬', options: alignmentOptions }, variant: { type: 'radio', label: '표현', options: [{ label: '선', value: 'line' }, { label: '큰 따옴표', value: 'mark' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <BlockquotePreview {...props} />,
  },
  Notice: {
    label: '알림·안내', defaultProps: DEFAULT_NOTICE,
    fields: { tone: { type: 'select', label: '안내 성격', options: [{ label: '정보', value: 'info' }, { label: '완료', value: 'success' }, { label: '주의', value: 'warning' }, { label: '중요', value: 'critical' }] }, title: createInlineRichTextField('제목'), body: createRichTextField('내용', 130), actionLabel: { type: 'text', label: '링크 문구', contentEditable: true }, actionUrl: createRouteUrlField('안내 연결'), ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <NoticePreview {...props} />,
  },
  CardGrid: {
    label: '카드 그리드', defaultProps: DEFAULT_CARD_GRID,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), items: { type: 'array', label: '카드', min: 2, max: 6, defaultItemProps: (index) => ({ kicker: String(index + 1).padStart(2, '0'), title: `카드 ${index + 1}`, body: '카드 설명을 입력하세요.', linkLabel: '자세히 보기', linkUrl: '/' }), getItemSummary: (item) => item.title, arrayFields: { kicker: { type: 'text', label: '보조 문구', contentEditable: true }, title: createInlineRichTextField('제목'), body: createRichTextField('설명', 130), linkLabel: { type: 'text', label: '링크 문구', contentEditable: true }, linkUrl: createRouteUrlField('카드 연결') } }, columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }, { label: '3열', value: '3' }] }, variant: { type: 'radio', label: '카드 표현', options: [{ label: '여백 중심', value: 'plain' }, { label: '테두리', value: 'outlined' }] }, layout: { type: 'select', label: '레이아웃', options: [{ label: '벤토', value: 'bento' }, { label: '균등 그리드', value: 'grid' }, { label: '가로 레일', value: 'rail' }, { label: '에디토리얼', value: 'editorial' }, { label: '번호 목록', value: 'numbered' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
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
    fields: { heading: createInlineRichTextField('제목'), items: { type: 'array', label: '채널', min: 1, max: 8, defaultItemProps: (index) => ({ network: 'website', label: `채널 ${index + 1}`, url: 'https://' }), getItemSummary: (item) => item.label, arrayFields: { network: { type: 'select', label: '채널 종류', options: SOCIAL_NETWORKS }, label: { type: 'text', label: '채널 이름', contentEditable: true }, url: createRouteUrlField('채널 연결') } }, variant: { type: 'radio', label: '표현', options: [{ label: '아이콘', value: 'icons' }, { label: '이름 표시', value: 'labels' }] }, alignment: { type: 'radio', label: '정렬', options: [...alignmentOptions, { label: '오른쪽', value: 'right' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
    render: (props) => <SocialLinksPreview {...props} />,
  },
  ImageCarousel: {
    label: '이미지 캐러셀', defaultProps: DEFAULT_IMAGE_CAROUSEL,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), images: { type: 'array', label: '이미지', min: 2, max: 8, defaultItemProps: (index) => ({ src: '', alt: `${index + 1}번 이미지`, caption: `${index + 1}번 장면` }), getItemSummary: (item, index) => item.caption || `이미지 ${(index ?? 0) + 1}`, arrayFields: { src: createMediaField('캐러셀 이미지'), alt: { type: 'text', label: '대체 텍스트' }, caption: { type: 'text', label: '캡션', contentEditable: true } } }, autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: true }, { label: '사용 안 함', value: false }] }, interval: { type: 'select', label: '자동 재생 간격', options: [{ label: '3초', value: '3000' }, { label: '5초', value: '5000' }, { label: '7초', value: '7000' }] }, controls: { type: 'radio', label: '탐색 버튼', options: [{ label: '화살표', value: 'arrows' }, { label: '점', value: 'dots' }, { label: '모두', value: 'both' }] }, aspectRatio: { type: 'select', label: '이미지 비율', options: [{ label: '16:9', value: '16:9' }, { label: '4:3', value: '4:3' }, { label: '1:1', value: '1:1' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'parallax-soft']) },
    render: (props) => <ImageCarouselPreview {...props} />,
  },
};
