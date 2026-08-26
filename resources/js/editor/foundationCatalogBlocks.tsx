import React from 'react';
import type { Config } from '@puckeditor/core';

import {
  createMotionField,
  DEFAULT_BLOCK_MOTION,
  motionPreviewAttributes,
  normalizeBlockMotion,
} from './blockMotion';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import {
  decorateCanvasElementStyles,
  CanvasCurrentElementStylesContext,
  normalizeElementAppearanceMap,
  notifyCanvasElementSelection,
  useCanvasBlockAppearanceClass,
  useCanvasElementStyles,
} from './canvasEditingContract';
import {
  BUTTONS_BLOCK_TYPE,
  HEADING_BLOCK_TYPE,
  ICON_LIST_BLOCK_TYPE,
  IMAGE_BLOCK_TYPE,
  IMAGE_TEXT_BLOCK_TYPE,
  RICH_TEXT_BLOCK_TYPE,
  type BlockAppearance,
  type BlockMotion,
  type ButtonItem,
  type ElementAppearanceMap,
  type IconListItem,
  type PageBuilderBlock,
} from '../documents/types';

interface AppearanceEditorProps {
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

export interface HeadingEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  level: '2' | '3' | '4';
  anchor: string;
}

export interface RichTextEditorProps extends AppearanceEditorProps {
  content: string;
  measure: 'narrow' | 'standard' | 'wide';
}

export interface ImageEditorProps extends AppearanceEditorProps {
  src: string;
  alt: string;
  caption: string;
  linkUrl: string;
  aspectRatio: 'auto' | '16:9' | '4:3' | '1:1';
}

export interface ButtonsEditorProps extends AppearanceEditorProps {
  items: ButtonItem[];
  alignment: 'left' | 'center' | 'right';
}

export interface ImageTextEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  mediaPosition: 'left' | 'right';
  primaryLabel: string;
  primaryUrl: string;
}

export interface IconListEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: IconListItem[];
  layout: 'single' | 'two-column';
}

export interface FoundationCatalogEditorComponents {
  Heading: HeadingEditorProps;
  RichText: RichTextEditorProps;
  Image: ImageEditorProps;
  Buttons: ButtonsEditorProps;
  ImageText: ImageTextEditorProps;
  IconList: IconListEditorProps;
}

export type FoundationComponentType = keyof FoundationCatalogEditorComponents;

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

const ICON_OPTIONS = [
  { label: '번개', value: 'bolt' },
  { label: '확인', value: 'check' },
  { label: '코드', value: 'code' },
  { label: '글로브', value: 'globe' },
  { label: '하트', value: 'heart' },
  { label: '레이어', value: 'layers' },
  { label: '모바일', value: 'mobile' },
  { label: '팔레트', value: 'palette' },
  { label: '보호', value: 'shield' },
  { label: '반짝임', value: 'sparkles' },
  { label: '별', value: 'star' },
];

const ICON_GLYPHS: Record<string, string> = {
  bolt: '↯', check: '✓', code: '</>', globe: '◎', heart: '♥', layers: '▱',
  mobile: '▯', palette: '◒', shield: '◆', sparkles: '✦', star: '★',
};

const DEFAULT_HEADING: HeadingEditorProps = {
  eyebrow: '섹션 안내', heading: '이 섹션의 핵심을 한 문장으로', level: '2', anchor: '',
  surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_RICH_TEXT: RichTextEditorProps = {
  content: '<p>방문자가 이해해야 할 내용을 읽기 편한 문단으로 작성해 주세요.</p><p><strong>중요한 문장</strong>은 굵게 강조하고 목록이나 링크를 활용할 수 있습니다.</p>',
  measure: 'standard', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_IMAGE: ImageEditorProps = {
  src: '', alt: '', caption: '이미지를 설명하는 캡션을 입력하세요.', linkUrl: '', aspectRatio: 'auto',
  surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_BUTTONS: ButtonsEditorProps = {
  items: [
    { label: '자세히 보기', url: '/', variant: 'primary' },
    { label: '문의하기', url: '/contact', variant: 'secondary' },
  ],
  alignment: 'left', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_IMAGE_TEXT: ImageTextEditorProps = {
  eyebrow: '핵심 소개', heading: '이미지와 설명을 함께 전달하세요',
  body: '<p>제품, 서비스, 공간처럼 시각 자료와 설명을 함께 봐야 이해가 빠른 내용을 구성합니다.</p>',
  imageSrc: '', imageAlt: '', mediaPosition: 'left', primaryLabel: '자세히 보기', primaryUrl: '/',
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_ICON_LIST: IconListEditorProps = {
  eyebrow: '핵심 포인트', heading: '빠르게 훑어보는 주요 내용',
  items: [
    { icon: 'check', title: '분명한 정보', body: '한 항목에는 하나의 핵심만 담아 이해를 돕습니다.' },
    { icon: 'bolt', title: '빠른 탐색', body: '짧은 제목과 설명으로 필요한 내용을 바로 찾습니다.' },
    { icon: 'shield', title: '일관된 품질', body: '검증된 구조와 디자인 토큰으로 페이지 흐름을 지킵니다.' },
  ],
  layout: 'two-column', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function normalizeButtons(value: unknown): ButtonItem[] {
  return normalizeArray(value, DEFAULT_BUTTONS.items, 3, (item) => ({
    label: asString(item.label),
    url: asString(item.url),
    variant: item.variant === 'secondary' || item.variant === 'text' ? item.variant : 'primary',
  }));
}

function normalizeIconItems(value: unknown): IconListItem[] {
  return normalizeArray(value, DEFAULT_ICON_LIST.items, 8, (item) => {
    const icon = asString(item.icon);
    return {
      icon: ICON_OPTIONS.some((option) => option.value === icon) ? icon : 'check',
      title: asString(item.title),
      body: asString(item.body),
    };
  });
}

function normalizeAnchor(value: unknown): string {
  const normalized = asString(value).trim().toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!normalized) return '';
  const anchored = /^[a-z]/.test(normalized) ? normalized : `section-${normalized}`;
  return anchored.slice(0, 80).replace(/-+$/g, '');
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
  const editor = appearance({
    surface: raw.surface, spacing: raw.spacing, textScale: raw.textScale, textAlign: raw.textAlign,
    elementStyles: raw.elementStyles,
  }, fallback);
  const { elementStyles, ...resolved } = editor;
  const canonical: BlockAppearance = {
    ...resolved,
    ...(elementStyles && Object.keys(elementStyles).length > 0 ? { elements: elementStyles } : {}),
  };
  if (include || canonical.surface !== fallback.surface || canonical.spacing !== fallback.spacing
    || canonical.textScale || canonical.textAlign || canonical.elements) next.appearance = canonical;
  return next;
}

function safeLink(value: string): string {
  const trimmed = value.trim();
  if (/[\\\u0000-\u0020\u007f]/.test(trimmed)) return '#';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:') return trimmed;
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
  const resolvedElementStyles = useCanvasElementStyles(id, elementStyles);
  const containerClassName = useCanvasBlockAppearanceClass(id);
  return <section className={`g7pb-preview-block ${containerClassName}`.trim()} data-testid="page-builder-block" data-block-id={id} data-block-type={type}
    onPointerDownCapture={(event) => notifyCanvasElementSelection(event, id, type)}
    {...motionPreviewAttributes(motion)}><CanvasCurrentElementStylesContext.Provider value={resolvedElementStyles}>{decorateCanvasElementStyles(children, resolvedElementStyles)}</CanvasCurrentElementStylesContext.Provider></section>;
}

function Media({ src, alt, label }: { src: string; alt: string; label: string }): React.ReactElement {
  const safe = safeImage(src);
  return safe
    ? <img src={safe} alt={alt} />
    : <span className="g7pb-preview-media-placeholder" role="img" aria-label={label}>{label}</span>;
}

function HeadingPreview(props: HeadingEditorProps & { id: string }): React.ReactElement {
  const Tag = `h${props.level}` as 'h2' | 'h3' | 'h4';
  return <Frame id={props.id} type="heading" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-heading ${surfaceClass(props)}`}>
      {props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}
      <RichTextCanvasField as={Tag} className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField>
    </div>
  </Frame>;
}

function RichTextPreview(props: Omit<RichTextEditorProps, 'content'> & { id: string; content: React.ReactNode }): React.ReactElement {
  return <Frame id={props.id} type="rich-text" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-rich-text ${surfaceClass(props)}`}>
      <RichTextCanvasField fieldPath="content"
        className={`g7pb-preview-richtext g7pb-preview-rich-text__content g7pb-preview-rich-text__content--${props.measure}`}>
        {props.content}
      </RichTextCanvasField>
    </div>
  </Frame>;
}

function ImagePreview(props: ImageEditorProps & { id: string }): React.ReactElement {
  const media = <span className="g7pb-preview-image__media" data-g7pb-media-field="src">
    <Media src={props.src} alt={props.alt} label="이미지를 선택하세요" />
  </span>;
  return <Frame id={props.id} type="image" motion={props.motion} elementStyles={props.elementStyles}>
    <figure className={`g7pb-preview-image g7pb-preview-image--${props.aspectRatio.replace(':', '-')} ${surfaceClass(props)}`}>
      {props.linkUrl.trim() ? <a className="g7pb-preview-image__link" href={safeLink(props.linkUrl)}
        onClick={(event) => event.preventDefault()}>{media}</a> : media}
      {props.caption ? <figcaption data-g7pb-inline-field="caption">{props.caption}</figcaption> : null}
    </figure>
  </Frame>;
}

function ButtonsPreview(props: ButtonsEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="buttons" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-buttons g7pb-preview-buttons--${props.alignment} ${surfaceClass(props)}`} role="group" aria-label="페이지 행동">
      {normalizeButtons(props.items).map((item, index) => <a key={`${item.label}-${index}`}
        className={`g7pb-preview-button g7pb-preview-button--${item.variant}`} href={safeLink(item.url)}
        data-g7pb-action-field={`items.${index}.label`} onClick={(event) => event.preventDefault()}>{inlineArrayContent(props.items, index, 'label', item.label)}</a>)}
    </div>
  </Frame>;
}

function ImageTextPreview(props: Omit<ImageTextEditorProps, 'body'> & { id: string; body: React.ReactNode }): React.ReactElement {
  return <Frame id={props.id} type="image-text" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-image-text g7pb-preview-image-text--${props.mediaPosition} ${surfaceClass(props)}`}>
      <figure data-g7pb-media-field="imageSrc"><Media src={props.imageSrc} alt={props.imageAlt} label="대표 이미지를 선택하세요" /></figure>
      <div className="g7pb-preview-image-text__copy">
        {props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}
        <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField>
        <RichTextCanvasField fieldPath="body">{props.body}</RichTextCanvasField>
        {props.primaryLabel ? <a className="g7pb-preview-button g7pb-preview-button--primary" href={safeLink(props.primaryUrl)}
          data-g7pb-action-field="primaryLabel" onClick={(event) => event.preventDefault()}>{props.primaryLabel}</a> : null}
      </div>
    </div>
  </Frame>;
}

function IconListPreview(props: IconListEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="icon-list" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-icon-list g7pb-preview-icon-list--${props.layout} ${surfaceClass(props)}`}>
      <header>{props.eyebrow ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}
        <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header>
      <ul>{normalizeIconItems(props.items).map((item, index) => <li key={`${item.title}-${index}`}>
        <i aria-hidden="true">{ICON_GLYPHS[item.icon] ?? ICON_GLYPHS.check}</i>
        <div><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</RichTextCanvasField>
          <RichTextCanvasField fieldPath={`items.${index}.body`}>{inlineArrayContent(props.items, index, 'body', item.body)}</RichTextCanvasField></div>
      </li>)}</ul>
    </div>
  </Frame>;
}

const appearanceFields = {
  elementStyles: { type: 'custom' as const, label: '캔버스 요소 스타일', render: () => <></> },
  surface: { type: 'select' as const, label: '배경 프리셋', options: SURFACE_OPTIONS },
  spacing: { type: 'select' as const, label: '세로 여백', options: SPACING_OPTIONS },
};

export const foundationCatalogComponentConfigs: Config<FoundationCatalogEditorComponents>['components'] = {
  Heading: {
    label: '제목', defaultProps: DEFAULT_HEADING,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true },
      heading: createInlineRichTextField('제목'),
      level: { type: 'select', label: '제목 단계', options: [{ label: 'H2', value: '2' }, { label: 'H3', value: '3' }, { label: 'H4', value: '4' }] },
      anchor: { type: 'text', label: '섹션 앵커' }, ...appearanceFields,
      motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <HeadingPreview {...props} />,
  },
  RichText: {
    label: '리치텍스트', defaultProps: DEFAULT_RICH_TEXT,
    fields: {
      content: createRichTextField('본문', 220, true),
      measure: { type: 'radio', label: '본문 폭', options: [{ label: '좁게', value: 'narrow' }, { label: '기본', value: 'standard' }, { label: '넓게', value: 'wide' }] },
      ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <RichTextPreview {...props} />,
  },
  Image: {
    label: '단일 이미지', defaultProps: DEFAULT_IMAGE,
    fields: {
      src: createMediaField('이미지', 'foundation-image'), alt: { type: 'text', label: '대체 텍스트' },
      caption: { type: 'text', label: '캡션', contentEditable: true }, linkUrl: createRouteUrlField('이미지 연결'),
      aspectRatio: { type: 'select', label: '이미지 비율', options: [{ label: '원본', value: 'auto' }, { label: '16:9', value: '16:9' }, { label: '4:3', value: '4:3' }, { label: '1:1', value: '1:1' }] },
      ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <ImagePreview {...props} />,
  },
  Buttons: {
    label: '버튼 묶음', defaultProps: DEFAULT_BUTTONS,
    fields: {
      items: { type: 'array', label: '버튼', min: 1, max: 3,
        defaultItemProps: (index) => ({ label: `버튼 ${index + 1}`, url: '/', variant: index === 0 ? 'primary' : 'secondary' }),
        getItemSummary: (item) => item.label,
        arrayFields: {
          label: { type: 'text', label: '버튼 문구', contentEditable: true },
          url: createRouteUrlField('버튼 연결'),
          variant: { type: 'select', label: '버튼 모양', options: [{ label: '주 버튼', value: 'primary' }, { label: '보조 버튼', value: 'secondary' }, { label: '텍스트 링크', value: 'text' }] },
        } },
      alignment: { type: 'radio', label: '정렬', options: [{ label: '왼쪽', value: 'left' }, { label: '가운데', value: 'center' }, { label: '오른쪽', value: 'right' }] },
      ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <ButtonsPreview {...props} />,
  },
  ImageText: {
    label: '이미지 + 텍스트', defaultProps: DEFAULT_IMAGE_TEXT,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true },
      heading: createInlineRichTextField('제목'),
      body: createRichTextField('본문', 170, true),
      imageSrc: createMediaField('대표 이미지', 'foundation-image-text'), imageAlt: { type: 'text', label: '대체 텍스트' },
      mediaPosition: { type: 'radio', label: '이미지 위치', options: [{ label: '왼쪽', value: 'left' }, { label: '오른쪽', value: 'right' }] },
      primaryLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, primaryUrl: createRouteUrlField('버튼 연결'),
      ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <ImageTextPreview {...props} />,
  },
  IconList: {
    label: '아이콘 목록', defaultProps: DEFAULT_ICON_LIST,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true },
      heading: createInlineRichTextField('제목'),
      items: { type: 'array', label: '항목', min: 2, max: 8,
        defaultItemProps: (index) => ({ icon: 'check', title: `항목 ${index + 1}`, body: '항목 설명을 입력하세요.' }),
        getItemSummary: (item) => item.title,
        arrayFields: {
          icon: { type: 'select', label: '아이콘', options: ICON_OPTIONS },
          title: createInlineRichTextField('제목'),
          body: createRichTextField('설명', 130),
        } },
      layout: { type: 'radio', label: '배치', options: [{ label: '1열', value: 'single' }, { label: '2열', value: 'two-column' }] },
      ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']),
    },
    render: (props) => <IconListPreview {...props} />,
  },
};

export function canonicalFoundationBlockToPuck(block: PageBuilderBlock): { type: FoundationComponentType; props: FoundationCatalogEditorComponents[FoundationComponentType] } | null {
  const props = block.props;
  if (block.type === HEADING_BLOCK_TYPE) return { type: 'Heading', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), level: props.level === 3 ? '3' : props.level === 4 ? '4' : '2', anchor: asString(props.anchor), ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === RICH_TEXT_BLOCK_TYPE) return { type: 'RichText', props: { content: asString(props.content), measure: props.measure === 'narrow' || props.measure === 'wide' ? props.measure : 'standard', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === IMAGE_BLOCK_TYPE) return { type: 'Image', props: { src: asString(props.src), alt: asString(props.alt), caption: asString(props.caption), linkUrl: asString(props.linkUrl), aspectRatio: props.aspectRatio === '16:9' || props.aspectRatio === '4:3' || props.aspectRatio === '1:1' ? props.aspectRatio : 'auto', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === BUTTONS_BLOCK_TYPE) return { type: 'Buttons', props: { items: normalizeButtons(props.items), alignment: props.alignment === 'center' || props.alignment === 'right' ? props.alignment : 'left', ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === IMAGE_TEXT_BLOCK_TYPE) {
    const image = asRecord(props.image); const link = asRecord(props.primaryLink);
    return { type: 'ImageText', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), body: asString(props.body), imageSrc: asString(image.src), imageAlt: asString(image.alt), mediaPosition: props.mediaPosition === 'right' ? 'right' : 'left', primaryLabel: asString(link.label), primaryUrl: asString(link.url), ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  }
  if (block.type === ICON_LIST_BLOCK_TYPE) return { type: 'IconList', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeIconItems(props.items), layout: props.layout === 'single' ? 'single' : 'two-column', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  return null;
}

export function foundationPuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'Heading') return { type: HEADING_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), level: raw.level === '3' ? 3 : raw.level === '4' ? 4 : 2, anchor: normalizeAnchor(raw.anchor) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'RichText') return { type: RICH_TEXT_BLOCK_TYPE, props: attachAppearance({ content: asString(raw.content), measure: raw.measure === 'narrow' || raw.measure === 'wide' ? raw.measure : 'standard' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'Image') return { type: IMAGE_BLOCK_TYPE, props: attachAppearance({ src: asString(raw.src), alt: asString(raw.alt), caption: asString(raw.caption), linkUrl: asString(raw.linkUrl), aspectRatio: raw.aspectRatio === '16:9' || raw.aspectRatio === '4:3' || raw.aspectRatio === '1:1' ? raw.aspectRatio : 'auto' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'Buttons') return { type: BUTTONS_BLOCK_TYPE, props: attachAppearance({ items: normalizeButtons(raw.items), alignment: raw.alignment === 'center' || raw.alignment === 'right' ? raw.alignment : 'left' }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'ImageText') {
    const props: Record<string, unknown> = { eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), body: asString(raw.body), image: { src: asString(raw.imageSrc), alt: asString(raw.imageAlt) }, mediaPosition: raw.mediaPosition === 'right' ? 'right' : 'left' };
    if (asString(raw.primaryLabel) || asString(raw.primaryUrl)) props.primaryLink = { label: asString(raw.primaryLabel), url: asString(raw.primaryUrl) };
    return { type: IMAGE_TEXT_BLOCK_TYPE, props: attachAppearance(props, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  }
  if (type === 'IconList') return { type: ICON_LIST_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeIconItems(raw.items), layout: raw.layout === 'single' ? 'single' : 'two-column' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  return null;
}
