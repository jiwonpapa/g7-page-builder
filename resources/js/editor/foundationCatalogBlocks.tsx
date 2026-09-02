import React from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame as Frame } from './CatalogBlockFrame';
import { type HeadingEditorProps, type RichTextEditorProps, type ImageEditorProps, type ButtonsEditorProps, type ImageTextEditorProps, type IconListEditorProps, type FoundationCatalogEditorComponents, ICON_OPTIONS, DEFAULT_HEADING, DEFAULT_RICH_TEXT, DEFAULT_IMAGE, DEFAULT_BUTTONS, DEFAULT_IMAGE_TEXT, DEFAULT_ICON_LIST, asRecord, normalizeButtons, normalizeIconItems } from './foundationCatalogData';
export type { HeadingEditorProps, RichTextEditorProps, ImageEditorProps, ButtonsEditorProps, ImageTextEditorProps, IconListEditorProps, FoundationCatalogEditorComponents, FoundationComponentType } from './foundationCatalogData';
export { canonicalFoundationBlockToPuck, foundationPuckBlockToCanonical } from './foundationCatalogCodec';
import { createMotionField } from './blockMotion';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import { CatalogIcon, type CatalogIconName } from './catalogIcon';
import type { AppearanceEditorProps } from './catalogAppearance';

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

/** Puck replaces inline strings with elements; truthiness is not content presence. */
export function canvasTextValue(value: unknown, format: 'richtext' | 'plain' = 'richtext'): string {
  if (typeof value === 'string') {
    return (format === 'plain' ? value : value.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')).trim();
  }
  if (!React.isValidElement(value)) return '';
  const props = value.props as { value?: unknown; content?: unknown; children?: unknown };
  if ('value' in props) return canvasTextValue(props.value, format);
  if ('content' in props) return canvasTextValue(props.content, format);
  return canvasTextValue(props.children, format);
}

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback;
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
      {canvasTextValue(props.eyebrow, 'plain') ? <small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small> : null}
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
        <span className="g7pb-preview-catalog-icon"><CatalogIcon name={(item.icon || 'check') as CatalogIconName} size={25} /></span>
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

