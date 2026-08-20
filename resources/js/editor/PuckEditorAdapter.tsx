import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ActionBar,
  createUsePuck,
  Puck,
  type Config,
  type Data,
  type PuckAction,
  type Viewports,
} from '@puckeditor/core';
import '@puckeditor/core/puck.css';

import {
  CATALOG_GALLERY_ITEMS,
  CatalogGalleryThumbnail,
  canonicalCatalogBlockToPuck,
  catalogComponentConfigs,
  catalogPuckBlockToCanonical,
  type CatalogEditorComponents,
} from './catalogBlocks';
import {
  createMotionField,
  DEFAULT_BLOCK_MOTION,
  motionPreviewAttributes,
  normalizeBlockMotion,
} from './blockMotion';

import {
  CONTACT_BLOCK_TYPE,
  CTA_BLOCK_TYPE,
  FEATURES_BLOCK_TYPE,
  HERO_BLOCK_TYPE,
  type ContactBlockProps,
  type BlockAppearance,
  type BlockMotion,
  type CtaBlockProps,
  type FeatureItem,
  type FeaturesBlockProps,
  type HeroBlockProps,
  type PageBuilderBlock,
  type PageBuilderDocument,
  type ScalarToken,
} from '../documents/types';

interface HeroEditorProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  imageSrc: string;
  imageAlt: string;
  alignment: 'left' | 'center';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface FeaturesEditorProps {
  title: string;
  items: FeatureItem[];
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface CtaEditorProps {
  eyebrow: string;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  secondaryLabel: string;
  secondaryUrl: string;
  theme: 'light' | 'dark';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface ContactEditorProps {
  heading: string;
  address: string;
  phone: string;
  email: string;
  ctaLabel: string;
  ctaUrl: string;
  mapLabel: string;
  mapUrl: string;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  motion: BlockMotion;
}

interface EditorComponents extends CatalogEditorComponents {
  Hero: HeroEditorProps;
  Features: FeaturesEditorProps;
  Cta: CtaEditorProps;
  Contact: ContactEditorProps;
}

export type PuckEditorData = Data<EditorComponents>;

interface BlockRoundTripMetadata {
  blockVersion: number;
  hadSlots: boolean;
  hadAppearance: boolean;
  hadMotion: boolean;
}

export interface PuckAdapterContext {
  document: {
    schemaVersion: PageBuilderDocument['schema_version'];
    documentId: string;
    slug: string;
    mode: PageBuilderDocument['mode'];
    locale: string;
    tokens: Record<string, ScalarToken>;
    hadTokens: boolean;
  };
  blocks: Record<string, BlockRoundTripMetadata>;
}

export interface PuckEditorSession {
  data: PuckEditorData;
  context: PuckAdapterContext;
}

interface PuckEditorAdapterProps {
  document: PageBuilderDocument;
  revisionKey: number;
  disabled?: boolean;
  iframeEnabled?: boolean;
  onChange: (document: PageBuilderDocument) => void;
  onPublish: (document: PageBuilderDocument) => void | Promise<void>;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const SAFE_ICONS = new Set(['sparkles', 'shield', 'bolt', 'heart']);

const DEFAULT_HERO: HeroEditorProps = {
  eyebrow: '새로운 페이지',
  title: '방문자가 바로 이해하는 한 문장',
  body: '<p>핵심 가치와 다음 행동을 짧고 분명하게 안내해 보세요.</p>',
  primaryLabel: '자세히 보기',
  primaryUrl: '/',
  imageSrc: '',
  imageAlt: '',
  alignment: 'center',
  surface: 'default',
  spacing: 'spacious',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_FEATURES: FeaturesEditorProps = {
  title: '선택해야 하는 이유',
  items: [
    { icon: 'sparkles', title: '빠른 시작', body: '완성 블록을 골라 바로 편집합니다.' },
    { icon: 'shield', title: '안전한 발행', body: '검증된 결과만 공개 페이지에 반영합니다.' },
  ],
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_CTA: CtaEditorProps = {
  eyebrow: '다음 단계',
  heading: '방문자가 바로 행동할 수 있게 안내하세요',
  body: '가장 중요한 행동 하나와 보조 선택지를 짧고 분명하게 제시합니다.',
  primaryLabel: '지금 시작하기',
  primaryUrl: '/',
  secondaryLabel: '자세히 보기',
  secondaryUrl: '/about',
  theme: 'light',
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_CONTACT: ContactEditorProps = {
  heading: '문의 안내',
  address: '서울특별시 중구 세종대로 110',
  phone: '02-1234-5678',
  email: 'hello@example.com',
  ctaLabel: '문의하기',
  ctaUrl: '/contact',
  mapLabel: '지도에서 보기',
  mapUrl: 'https://maps.google.com/',
  surface: 'default',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

export const PAGE_BUILDER_VIEWPORTS: Viewports = [
  { width: 360, height: 'auto', label: '모바일', icon: 'Smartphone' },
  { width: 768, height: 'auto', label: '태블릿', icon: 'Tablet' },
  { width: 1280, height: 'auto', label: 'PC', icon: 'Monitor' },
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeAlignment(value: unknown): HeroEditorProps['alignment'] {
  return value === 'left' ? 'left' : 'center';
}

function normalizeTheme(value: unknown): CtaEditorProps['theme'] {
  return value === 'dark' ? 'dark' : 'light';
}

function normalizeSurface(value: unknown, fallback: BlockAppearance['surface'] = 'default'): BlockAppearance['surface'] {
  return value === 'soft' || value === 'contrast' || value === 'default' ? value : fallback;
}

function normalizeSpacing(value: unknown, fallback: BlockAppearance['spacing'] = 'normal'): BlockAppearance['spacing'] {
  return value === 'compact' || value === 'spacious' || value === 'normal' ? value : fallback;
}

function appearanceToEditorProps(
  value: unknown,
  fallback: BlockAppearance,
): Pick<HeroEditorProps, 'surface' | 'spacing'> {
  const appearance = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};

  return {
    surface: normalizeSurface(appearance.surface, fallback.surface),
    spacing: normalizeSpacing(appearance.spacing, fallback.spacing),
  };
}

function editorAppearance(
  surface: unknown,
  spacing: unknown,
  fallback: BlockAppearance,
): BlockAppearance {
  return {
    surface: normalizeSurface(surface, fallback.surface),
    spacing: normalizeSpacing(spacing, fallback.spacing),
  };
}

function normalizeFeatureItems(value: unknown): FeatureItem[] {
  if (!Array.isArray(value)) {
    return DEFAULT_FEATURES.items.map((item) => ({ ...item }));
  }

  return value.slice(0, 6).map((item) => {
    const record = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
    const icon = asString(record.icon, 'sparkles');

    return {
      icon: SAFE_ICONS.has(icon) ? icon : 'sparkles',
      title: asString(record.title),
      body: asString(record.body),
    };
  });
}

function hasNonEmptySlots(block: PageBuilderBlock): boolean {
  return Boolean(block.slots && Object.values(block.slots).some((slot) => slot.length > 0));
}

function cloneTokens(tokens: Record<string, ScalarToken> | undefined): Record<string, ScalarToken> {
  return tokens ? { ...tokens } : {};
}

function idToUuid(id: unknown): string {
  const source = asString(id, 'page-builder-block');
  const uuid = source.match(UUID_PATTERN)?.[0];
  if (uuid) {
    return uuid.toLowerCase();
  }

  // Stable UUIDv5-shaped fallback for malformed or legacy Puck IDs.
  const bytes = new Uint8Array(16);
  let state = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    state ^= source.charCodeAt(index);
    state = Math.imul(state, 0x01000193);
    bytes[index % 16] = (bytes[index % 16] + (state >>> ((index % 4) * 8))) & 0xff;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function heroToEditorProps(props: Record<string, unknown>): HeroEditorProps {
  const cta = typeof props.primaryCta === 'object' && props.primaryCta !== null
    ? (props.primaryCta as Record<string, unknown>)
    : {};
  const image = typeof props.image === 'object' && props.image !== null
    ? (props.image as Record<string, unknown>)
    : {};

  return {
    eyebrow: asString(props.eyebrow),
    title: asString(props.title),
    body: asString(props.body),
    primaryLabel: asString(cta.label),
    primaryUrl: asString(cta.url),
    imageSrc: asString(image.src),
    imageAlt: asString(image.alt),
    alignment: normalizeAlignment(props.alignment),
    ...appearanceToEditorProps(props.appearance, { surface: 'default', spacing: 'spacious' }),
    motion: { ...DEFAULT_BLOCK_MOTION },
  };
}

function featuresToEditorProps(props: Record<string, unknown>): FeaturesEditorProps {
  return {
    title: asString(props.title),
    items: normalizeFeatureItems(props.items),
    ...appearanceToEditorProps(props.appearance, { surface: 'soft', spacing: 'normal' }),
    motion: { ...DEFAULT_BLOCK_MOTION },
  };
}

function linkToEditorProps(value: unknown): { label: string; url: string } {
  const link = typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};

  return {
    label: asString(link.label),
    url: asString(link.url),
  };
}

function ctaToEditorProps(props: Record<string, unknown>): CtaEditorProps {
  const primary = linkToEditorProps(props.primaryLink);
  const secondary = linkToEditorProps(props.secondaryLink);

  return {
    eyebrow: asString(props.eyebrow),
    heading: asString(props.heading),
    body: asString(props.body),
    primaryLabel: primary.label,
    primaryUrl: primary.url,
    secondaryLabel: secondary.label,
    secondaryUrl: secondary.url,
    theme: normalizeTheme(props.theme),
    ...appearanceToEditorProps(props.appearance, { surface: 'soft', spacing: 'normal' }),
    motion: { ...DEFAULT_BLOCK_MOTION },
  };
}

function contactToEditorProps(props: Record<string, unknown>): ContactEditorProps {
  const cta = linkToEditorProps(props.cta);
  const mapLink = linkToEditorProps(props.mapLink);

  return {
    heading: asString(props.heading),
    address: asString(props.address),
    phone: asString(props.phone),
    email: asString(props.email),
    ctaLabel: cta.label,
    ctaUrl: cta.url,
    mapLabel: mapLink.label,
    mapUrl: mapLink.url,
    ...appearanceToEditorProps(props.appearance, { surface: 'default', spacing: 'normal' }),
    motion: { ...DEFAULT_BLOCK_MOTION },
  };
}

function canonicalBlockToPuck(block: PageBuilderBlock): PuckEditorData['content'][number] {
  if (hasNonEmptySlots(block)) {
    throw new Error(`MVP block cannot contain nested slots: ${block.instance_id}`);
  }

  if (block.type === HERO_BLOCK_TYPE) {
    return {
      type: 'Hero',
      props: {
        id: block.instance_id,
        ...heroToEditorProps(block.props),
        motion: normalizeBlockMotion(block.motion),
      },
    };
  }

  if (block.type === FEATURES_BLOCK_TYPE) {
    return {
      type: 'Features',
      props: {
        id: block.instance_id,
        ...featuresToEditorProps(block.props),
        motion: normalizeBlockMotion(block.motion),
      },
    };
  }

  if (block.type === CTA_BLOCK_TYPE) {
    return {
      type: 'Cta',
      props: {
        id: block.instance_id,
        ...ctaToEditorProps(block.props),
        motion: normalizeBlockMotion(block.motion),
      },
    };
  }

  if (block.type === CONTACT_BLOCK_TYPE) {
    return {
      type: 'Contact',
      props: {
        id: block.instance_id,
        ...contactToEditorProps(block.props),
        motion: normalizeBlockMotion(block.motion),
      },
    };
  }

  const catalogBlock = canonicalCatalogBlockToPuck(block);
  if (catalogBlock) {
    return {
      type: catalogBlock.type,
      props: {
        id: block.instance_id,
        ...catalogBlock.props,
        motion: normalizeBlockMotion(block.motion),
      },
    } as PuckEditorData['content'][number];
  }

  throw new Error(`Unsupported PageBuilder block: ${block.type}`);
}

export function canonicalToPuck(document: PageBuilderDocument): PuckEditorSession {
  const metadata: Record<string, BlockRoundTripMetadata> = {};
  for (const block of document.blocks) {
    metadata[block.instance_id.toLowerCase()] = {
      blockVersion: block.block_version,
      hadSlots: Object.prototype.hasOwnProperty.call(block, 'slots'),
      hadAppearance: Object.prototype.hasOwnProperty.call(block.props, 'appearance'),
      hadMotion: Object.prototype.hasOwnProperty.call(block, 'motion'),
    };
  }

  return {
    data: {
      root: { props: { title: document.slug } },
      content: document.blocks.map(canonicalBlockToPuck),
    },
    context: {
      document: {
        schemaVersion: document.schema_version,
        documentId: document.document_id,
        slug: document.slug,
        mode: document.mode,
        locale: document.locale,
        tokens: cloneTokens(document.tokens),
        hadTokens: Object.prototype.hasOwnProperty.call(document, 'tokens'),
      },
      blocks: metadata,
    },
  };
}

function puckBlockToCanonical(
  block: PuckEditorData['content'][number],
  context: PuckAdapterContext,
): PageBuilderBlock {
  const instanceId = idToUuid(block.props.id);
  const metadata = context.blocks[instanceId] ?? {
    blockVersion: 1,
    hadSlots: true,
    hadAppearance: false,
    hadMotion: false,
  };
  let type: string;
  let props: HeroBlockProps | FeaturesBlockProps | CtaBlockProps | ContactBlockProps | Record<string, unknown>;

  if (block.type === 'Hero') {
    const editorProps = block.props as typeof block.props & HeroEditorProps;
    type = HERO_BLOCK_TYPE;
    const heroProps: HeroBlockProps = {
      eyebrow: asString(editorProps.eyebrow),
      title: asString(editorProps.title),
      body: asString(editorProps.body),
      alignment: normalizeAlignment(editorProps.alignment),
    };
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'default', spacing: 'spacious' });
    if (metadata.hadAppearance || appearance.surface !== 'default' || appearance.spacing !== 'spacious') {
      heroProps.appearance = appearance;
    }
    const primaryLabel = asString(editorProps.primaryLabel);
    const primaryUrl = asString(editorProps.primaryUrl);
    const imageSrc = asString(editorProps.imageSrc);
    const imageAlt = asString(editorProps.imageAlt);
    if (primaryLabel || primaryUrl) {
      heroProps.primaryCta = { label: primaryLabel, url: primaryUrl };
    }
    if (imageSrc || imageAlt) {
      heroProps.image = { src: imageSrc, alt: imageAlt };
    }
    props = heroProps;
  } else if (block.type === 'Features') {
    const editorProps = block.props as typeof block.props & FeaturesEditorProps;
    type = FEATURES_BLOCK_TYPE;
    props = {
      title: asString(editorProps.title),
      items: normalizeFeatureItems(editorProps.items),
    };
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'soft', spacing: 'normal' });
    if (metadata.hadAppearance || appearance.surface !== 'soft' || appearance.spacing !== 'normal') {
      props.appearance = appearance;
    }
  } else if (block.type === 'Cta') {
    const editorProps = block.props as typeof block.props & CtaEditorProps;
    type = CTA_BLOCK_TYPE;
    const ctaProps: CtaBlockProps = {
      eyebrow: asString(editorProps.eyebrow),
      heading: asString(editorProps.heading),
      body: asString(editorProps.body),
      theme: normalizeTheme(editorProps.theme),
    };
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'soft', spacing: 'normal' });
    if (metadata.hadAppearance || appearance.surface !== 'soft' || appearance.spacing !== 'normal') {
      ctaProps.appearance = appearance;
    }
    const primaryLabel = asString(editorProps.primaryLabel);
    const primaryUrl = asString(editorProps.primaryUrl);
    const secondaryLabel = asString(editorProps.secondaryLabel);
    const secondaryUrl = asString(editorProps.secondaryUrl);
    if (primaryLabel || primaryUrl) {
      ctaProps.primaryLink = { label: primaryLabel, url: primaryUrl };
    }
    if (secondaryLabel || secondaryUrl) {
      ctaProps.secondaryLink = { label: secondaryLabel, url: secondaryUrl };
    }
    props = ctaProps;
  } else if (block.type === 'Contact') {
    const editorProps = block.props as typeof block.props & ContactEditorProps;
    type = CONTACT_BLOCK_TYPE;
    const contactProps: ContactBlockProps = {
      heading: asString(editorProps.heading),
      address: asString(editorProps.address),
      phone: asString(editorProps.phone),
      email: asString(editorProps.email),
    };
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'default', spacing: 'normal' });
    if (metadata.hadAppearance || appearance.surface !== 'default' || appearance.spacing !== 'normal') {
      contactProps.appearance = appearance;
    }
    const ctaLabel = asString(editorProps.ctaLabel);
    const ctaUrl = asString(editorProps.ctaUrl);
    const mapLabel = asString(editorProps.mapLabel);
    const mapUrl = asString(editorProps.mapUrl);
    if (ctaLabel || ctaUrl) {
      contactProps.cta = { label: ctaLabel, url: ctaUrl };
    }
    if (mapLabel || mapUrl) {
      contactProps.mapLink = { label: mapLabel, url: mapUrl };
    }
    props = contactProps;
  } else {
    const catalogBlock = catalogPuckBlockToCanonical(
      (block as { type: string }).type,
      block.props as Record<string, unknown>,
      metadata.hadAppearance,
    );
    if (!catalogBlock) {
      throw new Error(`Unsupported Puck component: ${(block as { type: string }).type}`);
    }
    type = catalogBlock.type;
    props = catalogBlock.props;
  }

  const canonical: PageBuilderBlock = {
    instance_id: instanceId,
    type,
    block_version: metadata.blockVersion,
    props: props as unknown as Record<string, unknown>,
  };

  const motion = normalizeBlockMotion(block.props.motion);
  if (metadata.hadMotion || motion.preset !== 'none') {
    canonical.motion = motion;
  }

  if (metadata.hadSlots) {
    canonical.slots = {};
  }

  return canonical;
}

export function puckToCanonical(
  data: PuckEditorData,
  context: PuckAdapterContext,
): PageBuilderDocument {
  const document: PageBuilderDocument = {
    schema_version: context.document.schemaVersion,
    document_id: context.document.documentId,
    slug: context.document.slug,
    mode: context.document.mode,
    locale: context.document.locale,
    blocks: data.content.map((block) => puckBlockToCanonical(block, context)),
  };

  if (context.document.hadTokens) {
    document.tokens = cloneTokens(context.document.tokens);
  }

  return document;
}

function safeLink(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (['https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return trimmed;
    }
  } catch {
    // Invalid values stay visible in the inspector but are inert in the preview.
  }

  return '#';
}

function safeImage(value: string): string | null {
  const link = safeLink(value);
  return link === '#' || link.startsWith('mailto:') || link.startsWith('tel:') ? null : link;
}

function safePhoneLink(value: string): string {
  const trimmed = value.trim();
  if (!/^\+?[0-9][0-9 .()\-]{2,39}$/.test(trimmed)) {
    return '#';
  }

  return safeLink(`tel:${trimmed.replace(/[ .()\-]/g, '')}`);
}

function safeEmailLink(value: string): string {
  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return '#';
  }

  return safeLink(`mailto:${trimmed}`);
}

export function sanitizeRichTextForPreview(value: string): string {
  if (typeof DOMParser === 'undefined') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  const allowedTags = new Set([
    'P', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'A', 'OL', 'UL', 'LI', 'BLOCKQUOTE', 'BR',
  ]);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root) {
    return '';
  }

  const clean = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      clean(child);
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      const href = child.tagName === 'A' ? child.getAttribute('href') ?? '' : '';
      for (const attribute of Array.from(child.attributes)) {
        child.removeAttribute(attribute.name);
      }
      if (child.tagName === 'A' && safeLink(href) !== '#') {
        child.setAttribute('href', safeLink(href));
        child.setAttribute('rel', 'noopener noreferrer');
      }
    }
  };
  clean(root);

  return root.innerHTML;
}

function StableInputField({
  value,
  onChange,
  readOnly,
  testId,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId: string;
  multiline?: boolean;
}): React.ReactElement {
  if (multiline) {
    return (
      <textarea
        className="g7pb-field-control g7pb-field-control--textarea"
        data-testid={testId}
        value={value ?? ''}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="g7pb-field-control"
      data-testid={testId}
      type="text"
      value={value ?? ''}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function StableSelectField<TValue extends string>({
  value,
  onChange,
  readOnly,
  testId,
  options,
}: {
  value: TValue;
  onChange: (value: TValue) => void;
  readOnly?: boolean;
  testId: string;
  options: Array<{ label: string; value: TValue }>;
}): React.ReactElement {
  return (
    <select
      className="g7pb-field-control"
      data-testid={testId}
      value={value}
      disabled={readOnly}
      onChange={(event) => onChange(event.target.value as TValue)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function FeaturesItemsField({
  value,
  onChange,
  readOnly,
}: {
  value: FeatureItem[];
  onChange: (value: FeatureItem[]) => void;
  readOnly?: boolean;
}): React.ReactElement {
  const items = normalizeFeatureItems(value);
  const update = (index: number, patch: Partial<FeatureItem>): void => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  return (
    <div className="g7pb-feature-fields">
      {items.map((item, index) => (
        <fieldset key={index}>
          <legend>항목 {index + 1}</legend>
          <label>
            아이콘
            <select
              value={item.icon}
              disabled={readOnly}
              onChange={(event) => update(index, { icon: event.target.value })}
            >
              <option value="sparkles">반짝임</option>
              <option value="shield">보호</option>
              <option value="bolt">속도</option>
              <option value="heart">관심</option>
            </select>
          </label>
          <label>
            제목
            <StableInputField
              value={item.title}
              onChange={(title) => update(index, { title })}
              readOnly={readOnly}
              testId={`page-builder-features-item-${index}-title`}
            />
          </label>
          <label>
            설명
            <StableInputField
              value={item.body}
              onChange={(body) => update(index, { body })}
              readOnly={readOnly}
              multiline
              testId={`page-builder-features-item-${index}-body`}
            />
          </label>
          {items.length > 2 && (
            <button type="button" disabled={readOnly} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
              항목 삭제
            </button>
          )}
        </fieldset>
      ))}
      {items.length < 6 && (
        <button
          type="button"
          className="g7pb-feature-fields__add"
          disabled={readOnly}
          onClick={() => onChange([
            ...items,
            { icon: 'sparkles', title: `기능 ${items.length + 1}`, body: '기능 설명을 입력하세요.' },
          ])}
        >
          항목 추가
        </button>
      )}
    </div>
  );
}

function BlockFrame({
  id,
  type,
  motion,
  children,
}: {
  id: string;
  type: string;
  motion: BlockMotion;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section
      className="g7pb-preview-block"
      data-testid="page-builder-block"
      data-block-id={idToUuid(id)}
      data-block-type={type}
      {...motionPreviewAttributes(motion)}
    >
      {children}
    </section>
  );
}

function HeroPreview({
  id,
  eyebrow,
  title,
  body,
  primaryLabel,
  primaryUrl,
  imageSrc,
  imageAlt,
  alignment,
  surface,
  spacing,
  motion,
}: Omit<HeroEditorProps, 'body'> & { id: string; body: React.ReactNode }): React.ReactElement {
  const image = safeImage(imageSrc);

  return (
    <BlockFrame id={id} type="hero" motion={motion}>
      <div className={`g7pb-preview-hero g7pb-preview-hero--${alignment} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing}`}>
        <div className="g7pb-preview-hero__copy">
          {eyebrow && <p className="g7pb-preview-eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          <div className="g7pb-preview-richtext">{body}</div>
          {primaryLabel && (
            <a className="g7pb-preview-cta" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>
              {primaryLabel}
            </a>
          )}
        </div>
        {image && (
          <figure className="g7pb-preview-hero__media">
            <img src={image} alt={imageAlt} />
          </figure>
        )}
      </div>
    </BlockFrame>
  );
}

function FeaturesPreview({ id, title, items, surface, spacing, motion }: FeaturesEditorProps & { id: string }): React.ReactElement {
  const glyphs: Record<string, string> = {
    sparkles: '✦',
    shield: '◆',
    bolt: '↯',
    heart: '♥',
  };

  return (
    <BlockFrame id={id} type="features" motion={motion}>
      <div className={`g7pb-preview-features g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing}`}>
        <h2>{title}</h2>
        <div className="g7pb-preview-features__grid">
          {normalizeFeatureItems(items).map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <span aria-hidden="true">{glyphs[item.icon] ?? glyphs.sparkles}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </BlockFrame>
  );
}

function CtaPreview({
  id,
  eyebrow,
  heading,
  body,
  primaryLabel,
  primaryUrl,
  secondaryLabel,
  secondaryUrl,
  theme,
  surface,
  spacing,
  motion,
}: CtaEditorProps & { id: string }): React.ReactElement {
  return (
    <BlockFrame id={id} type="cta" motion={motion}>
      <div className={`g7pb-preview-cta-split g7pb-preview-cta-split--${normalizeTheme(theme)} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing}`}>
        <div className="g7pb-preview-cta-split__copy">
          {eyebrow && <p className="g7pb-preview-eyebrow">{eyebrow}</p>}
          <h2>{heading}</h2>
          {body && <p>{body}</p>}
        </div>
        {(primaryLabel || secondaryLabel) && (
          <div className="g7pb-preview-cta-split__actions">
            {primaryLabel && (
              <a className="g7pb-preview-cta" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>
                {primaryLabel}
              </a>
            )}
            {secondaryLabel && (
              <a className="g7pb-preview-cta g7pb-preview-cta--secondary" href={safeLink(secondaryUrl)} onClick={(event) => event.preventDefault()}>
                {secondaryLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </BlockFrame>
  );
}

function ContactPreview({
  id,
  heading,
  address,
  phone,
  email,
  ctaLabel,
  ctaUrl,
  mapLabel,
  mapUrl,
  surface,
  spacing,
  motion,
}: ContactEditorProps & { id: string }): React.ReactElement {
  return (
    <BlockFrame id={id} type="contact" motion={motion}>
      <div className={`g7pb-preview-contact g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing}`}>
        <div className="g7pb-preview-contact__heading">
          <p className="g7pb-preview-eyebrow">Contact</p>
          <h2>{heading}</h2>
        </div>
        <address className="g7pb-preview-contact__details">
          {address && <p>{address}</p>}
          {phone && (
            <a href={safePhoneLink(phone)} onClick={(event) => event.preventDefault()}>{phone}</a>
          )}
          {email && (
            <a href={safeEmailLink(email)} onClick={(event) => event.preventDefault()}>{email}</a>
          )}
        </address>
        {(ctaLabel || mapLabel) && (
          <div className="g7pb-preview-contact__actions">
            {ctaLabel && (
              <a className="g7pb-preview-cta" href={safeLink(ctaUrl)} onClick={(event) => event.preventDefault()}>
                {ctaLabel}
              </a>
            )}
            {mapLabel && (
              <a className="g7pb-preview-cta g7pb-preview-cta--secondary" href={safeLink(mapUrl)} onClick={(event) => event.preventDefault()}>
                {mapLabel}
              </a>
            )}
          </div>
        )}
      </div>
    </BlockFrame>
  );
}

export const pageBuilderPuckConfig: Config<EditorComponents> = {
  categories: {
    content: {
      title: '콘텐츠 블록',
      components: ['Hero', 'HeroSplit', 'HeroSlider', 'Features', 'Cta', 'Contact'],
      defaultExpanded: true,
    },
    business: {
      title: '비즈니스·신뢰',
      components: ['LogoCloud', 'Pricing', 'Team'],
      defaultExpanded: true,
    },
    dataMedia: {
      title: '데이터·미디어',
      components: ['Stats', 'BarChart', 'Gallery'],
      defaultExpanded: true,
    },
  },
  components: {
    ...catalogComponentConfigs,
    Hero: {
      label: 'Hero',
      defaultProps: DEFAULT_HERO,
      fields: {
        eyebrow: {
          type: 'custom',
          label: '보조 문구',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-hero-subtitle"
            />
          ),
        },
        title: {
          type: 'custom',
          label: '제목',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-hero-title"
            />
          ),
        },
        body: {
          type: 'richtext',
          label: '본문',
          initialHeight: 150,
          options: {
            code: false,
            codeBlock: false,
            horizontalRule: false,
            strike: false,
            textAlign: false,
            underline: false,
            heading: { levels: [2, 3, 4] },
          },
        },
        primaryLabel: { type: 'text', label: '버튼 문구' },
        primaryUrl: { type: 'text', label: '버튼 URL' },
        imageSrc: { type: 'text', label: '이미지 URL' },
        imageAlt: { type: 'text', label: '이미지 대체 텍스트' },
        alignment: {
          type: 'radio',
          label: '정렬',
          options: [
            { label: '왼쪽', value: 'left' },
            { label: '가운데', value: 'center' },
          ],
        },
        surface: {
          type: 'select',
          label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select',
          label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal', 'parallax-soft']),
      },
      render: ({ id, eyebrow, title, body, primaryLabel, primaryUrl, imageSrc, imageAlt, alignment, surface, spacing, motion }) => (
        <HeroPreview
          id={id}
          eyebrow={eyebrow}
          title={title}
          body={body}
          primaryLabel={primaryLabel}
          primaryUrl={primaryUrl}
          imageSrc={imageSrc}
          imageAlt={imageAlt}
          alignment={alignment}
          surface={surface}
          spacing={spacing}
          motion={motion}
        />
      ),
    },
    Features: {
      label: 'Features',
      defaultProps: DEFAULT_FEATURES,
      fields: {
        title: {
          type: 'custom',
          label: '제목',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-features-heading"
            />
          ),
        },
        items: {
          type: 'custom',
          label: '항목',
          render: ({ value, onChange, readOnly }) => (
            <FeaturesItemsField value={value} onChange={onChange} readOnly={readOnly} />
          ),
        },
        surface: {
          type: 'select', label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select', label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal', 'stagger']),
      },
      render: ({ id, title, items, surface, spacing, motion }) => (
        <FeaturesPreview id={id} title={title} items={items} surface={surface} spacing={spacing} motion={motion} />
      ),
    },
    Cta: {
      label: 'CTA',
      defaultProps: DEFAULT_CTA,
      fields: {
        eyebrow: {
          type: 'custom',
          label: '보조 문구',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-eyebrow" />
          ),
        },
        heading: {
          type: 'custom',
          label: '제목',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-heading" />
          ),
        },
        body: {
          type: 'custom',
          label: '본문',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly} multiline
              testId="page-builder-cta-body" />
          ),
        },
        primaryLabel: {
          type: 'custom',
          label: '주 버튼 문구',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-primary-label" />
          ),
        },
        primaryUrl: {
          type: 'custom',
          label: '주 버튼 URL',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-primary-url" />
          ),
        },
        secondaryLabel: {
          type: 'custom',
          label: '보조 링크 문구',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-secondary-label" />
          ),
        },
        secondaryUrl: {
          type: 'custom',
          label: '보조 링크 URL',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-secondary-url" />
          ),
        },
        theme: {
          type: 'custom',
          label: '테마',
          render: ({ value, onChange, readOnly }) => (
            <StableSelectField
              value={normalizeTheme(value)}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-cta-theme"
              options={[
                { label: '밝게', value: 'light' },
                { label: '어둡게', value: 'dark' },
              ]}
            />
          ),
        },
        surface: {
          type: 'select', label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select', label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal']),
      },
      render: (props) => <CtaPreview {...props} theme={normalizeTheme(props.theme)} />,
    },
    Contact: {
      label: 'Contact',
      defaultProps: DEFAULT_CONTACT,
      fields: {
        heading: {
          type: 'custom',
          label: '제목',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-heading" />
          ),
        },
        address: {
          type: 'custom',
          label: '주소',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly} multiline
              testId="page-builder-contact-address" />
          ),
        },
        phone: {
          type: 'custom',
          label: '전화번호',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-phone" />
          ),
        },
        email: {
          type: 'custom',
          label: '이메일',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-email" />
          ),
        },
        ctaLabel: {
          type: 'custom',
          label: '문의 링크 문구',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-cta-label" />
          ),
        },
        ctaUrl: {
          type: 'custom',
          label: '문의 링크 URL',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-cta-url" />
          ),
        },
        mapLabel: {
          type: 'custom',
          label: '지도 링크 문구',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-map-label" />
          ),
        },
        mapUrl: {
          type: 'custom',
          label: '지도 링크 URL',
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-map-url" />
          ),
        },
        surface: {
          type: 'select', label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select', label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal']),
      },
      render: (props) => <ContactPreview {...props} />,
    },
  },
  root: {
    fields: {},
    render: ({ children }) => <div className="g7pb-preview-page">{children}</div>,
  },
};

const usePageBuilderPuck = createUsePuck<Config<EditorComponents>>();

const BLOCK_GALLERY_ITEMS: ReadonlyArray<{
  type: keyof EditorComponents;
  testId: string;
  category: string;
  title: string;
  description: string;
}> = [
  { type: 'Hero', testId: 'page-builder-block-option-hero', category: '첫 화면', title: '히어로', description: '핵심 제목, 설명, 버튼과 대표 이미지를 배치합니다.' },
  { type: 'Features', testId: 'page-builder-block-option-features', category: '콘텐츠', title: '특징 목록', description: '장점과 기능을 아이콘이 있는 항목으로 설명합니다.' },
  { type: 'Cta', testId: 'page-builder-block-option-cta', category: '전환', title: '행동 유도', description: '주요 행동과 보조 링크를 선명하게 안내합니다.' },
  { type: 'Contact', testId: 'page-builder-block-option-contact', category: '안내', title: '연락처', description: '주소, 전화, 이메일과 문의 동선을 제공합니다.' },
  ...CATALOG_GALLERY_ITEMS,
];

function BlockGalleryThumbnail({ type }: { type: keyof EditorComponents }): React.ReactElement {
  if (type === 'Hero') {
    return <div className="g7pb-block-thumb g7pb-block-thumb--hero" data-block-preview="hero" aria-hidden="true"><i /><b /><span /><em /></div>;
  }
  if (type === 'Features') {
    return <div className="g7pb-block-thumb g7pb-block-thumb--features" data-block-preview="features" aria-hidden="true"><b /><span><i /><i /><i /></span></div>;
  }
  if (type === 'Cta') {
    return <div className="g7pb-block-thumb g7pb-block-thumb--cta" data-block-preview="cta" aria-hidden="true"><span><i /><b /></span><em /></div>;
  }
  if (type === 'Contact') {
    return <div className="g7pb-block-thumb g7pb-block-thumb--contact" data-block-preview="contact" aria-hidden="true"><span><i /><b /></span><em><i /><i /><i /></em></div>;
  }

  return <CatalogGalleryThumbnail type={type as keyof CatalogEditorComponents} />;
}

function StableAddBlockControls({
  dispatch,
  contentLength,
  selectedIndex,
  selectedZone,
  disabled,
}: {
  dispatch: (action: PuckAction) => void;
  contentLength: number;
  selectedIndex: number | null;
  selectedZone: string;
  disabled: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = globalThis.document?.body.style.overflow ?? '';
    if (globalThis.document) {
      globalThis.document.body.style.overflow = 'hidden';
    }
    firstItemRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    globalThis.document?.addEventListener('keydown', closeOnEscape);

    return () => {
      globalThis.document?.removeEventListener('keydown', closeOnEscape);
      if (globalThis.document) {
        globalThis.document.body.style.overflow = previousOverflow;
      }
    };
  }, [open]);

  const insert = (componentType: keyof EditorComponents): void => {
    const destinationIndex = selectedZone === 'root:default-zone' && selectedIndex !== null
      ? selectedIndex + 1
      : contentLength;

    dispatch({
      type: 'insert',
      componentType,
      destinationIndex,
      destinationZone: 'root:default-zone',
    });
    dispatch({
      type: 'setUi',
      ui: {
        itemSelector: {
          index: destinationIndex,
          zone: 'root:default-zone',
        },
      },
      recordHistory: false,
    });
    setOpen(false);
  };

  return (
    <div className="g7pb-add-block">
      <button
        type="button"
        data-testid="page-builder-add-block"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        전체 미리보기
      </button>
      {open && globalThis.document && createPortal(
        <div className="g7pb-block-gallery-backdrop" data-testid="page-builder-block-gallery"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false);
            }
          }}>
          <section className="g7pb-block-gallery" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-block-gallery-title">
            <header className="g7pb-block-gallery__header">
              <div>
                <p>블록 라이브러리</p>
                <h2 id="g7pb-block-gallery-title">화면을 보고 블록을 선택하세요</h2>
                <span>선택하면 현재 블록 바로 뒤에 추가됩니다. 정확한 위치는 좌측 라이브러리에서 끌어 놓으세요.</span>
              </div>
              <button type="button" className="g7pb-block-gallery__close" aria-label="블록 갤러리 닫기"
                onClick={() => setOpen(false)}>×</button>
            </header>
            <div className="g7pb-block-gallery__grid">
              {BLOCK_GALLERY_ITEMS.map((item, index) => (
                <button key={item.type} type="button" className="g7pb-block-gallery__item"
                  ref={index === 0 ? firstItemRef : undefined}
                  data-testid={item.testId} onClick={() => insert(item.type)}>
                  <BlockGalleryThumbnail type={item.type} />
                  <span className="g7pb-block-gallery__copy">
                    <small>{item.category}</small>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                    <em>이 블록 추가 →</em>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>,
        globalThis.document.body,
      )}
    </div>
  );
}

function StableHeaderControls({
  dispatch,
  contentLength,
  selectedIndex,
  selectedZone,
  currentViewportWidth,
  viewportState,
  disabled,
}: {
  dispatch: (action: PuckAction) => void;
  contentLength: number;
  selectedIndex: number | null;
  selectedZone: string;
  currentViewportWidth: number | '100%';
  viewportState: {
    current: { width: number | '100%'; height: number | 'auto' };
    controlsVisible: boolean;
    options: Viewports;
  };
  disabled: boolean;
}): React.ReactElement {
  const setViewport = (width: number): void => {
    const viewport = PAGE_BUILDER_VIEWPORTS.find((candidate) => candidate.width === width);
    if (!viewport) {
      return;
    }

    dispatch({
      type: 'setUi',
      ui: {
        viewports: {
          ...viewportState,
          current: {
            width: viewport.width,
            height: viewport.height ?? 'auto',
          },
        },
      },
      recordHistory: false,
    });
  };

  return (
    <div className="g7pb-header-controls">
      <div className="g7pb-viewport-switcher" role="group" aria-label="캔버스 기기 미리보기">
        {PAGE_BUILDER_VIEWPORTS.map((viewport) => (
          <button
            key={viewport.width}
            type="button"
            data-testid={`page-builder-viewport-${viewport.width}`}
            aria-pressed={currentViewportWidth === viewport.width}
            disabled={disabled}
            onClick={() => setViewport(viewport.width as number)}
          >
            {viewport.label}
          </button>
        ))}
      </div>
      <StableAddBlockControls
        dispatch={dispatch}
        contentLength={contentLength}
        selectedIndex={selectedIndex}
        selectedZone={selectedZone}
        disabled={disabled}
      />
    </div>
  );
}

function ConnectedHeaderControls({ disabled }: { disabled: boolean }): React.ReactElement {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const contentLength = usePageBuilderPuck((state) => state.appState.data.content.length);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const viewportState = usePageBuilderPuck((state) => state.appState.ui.viewports);

  return (
    <StableHeaderControls
      dispatch={dispatch}
      contentLength={contentLength}
      selectedIndex={selectedIndex}
      selectedZone={selectedZone}
      currentViewportWidth={viewportState.current.width}
      viewportState={viewportState}
      disabled={disabled}
    />
  );
}

function SelectedBlockActionBar({
  children,
  label,
  parentAction,
  disabled,
}: {
  children: React.ReactNode;
  label?: string;
  parentAction?: React.ReactNode;
  disabled: boolean;
}): React.ReactElement {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const contentLength = usePageBuilderPuck((state) => state.appState.data.content.length);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');

  const move = (destinationIndex: number): void => {
    if (selectedIndex === null || destinationIndex < 0 || destinationIndex >= contentLength) {
      return;
    }

    dispatch({
      type: 'reorder',
      sourceIndex: selectedIndex,
      destinationIndex,
      destinationZone: selectedZone,
      recordHistory: false,
    });
    dispatch({
      type: 'setUi',
      ui: { itemSelector: { index: destinationIndex, zone: selectedZone } },
      recordHistory: true,
    });
  };

  return (
    <ActionBar>
      <ActionBar.Group>
        {parentAction}
        {label && <ActionBar.Label label={label} />}
      </ActionBar.Group>
      <ActionBar.Group>
        <ActionBar.Action
          label="블록 위로 이동"
          disabled={disabled || selectedIndex === null || selectedIndex === 0}
          onClick={() => move((selectedIndex ?? 0) - 1)}
        >
          <span data-testid="page-builder-block-move-up" aria-hidden="true">↑</span>
        </ActionBar.Action>
        <ActionBar.Action
          label="블록 아래로 이동"
          disabled={disabled || selectedIndex === null || selectedIndex >= contentLength - 1}
          onClick={() => move((selectedIndex ?? -1) + 1)}
        >
          <span data-testid="page-builder-block-move-down" aria-hidden="true">↓</span>
        </ActionBar.Action>
        {children}
      </ActionBar.Group>
    </ActionBar>
  );
}

function PuckHeaderLayer({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="g7pb-puck-header-layer">{children}</div>;
}

function PuckDrawerLibrary({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="g7pb-puck-drawer-library" data-testid="page-builder-block-library">
      <header className="g7pb-puck-drawer-library__header">
        <strong>블록 라이브러리</strong>
        <p>미리보기를 끌어 캔버스의 원하는 위치에 놓으세요.</p>
      </header>
      {children}
    </div>
  );
}

function PuckDrawerItem({ children, name }: { children: React.ReactNode; name: string }): React.ReactElement {
  const item = BLOCK_GALLERY_ITEMS.find((candidate) => candidate.type === name);

  if (!item) {
    return <>{children}</>;
  }

  return (
    <div className="g7pb-puck-drawer-card" data-library-block={item.type}>
      <div className="g7pb-puck-drawer-card__preview">
        <BlockGalleryThumbnail type={item.type} />
      </div>
      <div className="g7pb-puck-drawer-card__copy">
        <small>{item.category}</small>
        <strong>{item.title}</strong>
        <span>{item.description}</span>
        <em>끌어서 배치</em>
      </div>
      <span className="g7pb-puck-drawer-card__handle" aria-hidden="true">⠿</span>
    </div>
  );
}

export function PuckEditorAdapter({
  document,
  revisionKey,
  disabled = false,
  iframeEnabled = true,
  onChange,
  onPublish,
}: PuckEditorAdapterProps): React.ReactElement {
  const initialSession = useMemo(() => canonicalToPuck(document), [document.document_id, revisionKey]);
  const contextRef = useRef(initialSession.context);
  const [data, setData] = useState(initialSession.data);

  useEffect(() => {
    const session = canonicalToPuck(document);
    contextRef.current = session.context;
    setData(session.data);
  }, [document.document_id, revisionKey]);

  const overrides = useMemo(() => ({
    header: PuckHeaderLayer,
    headerActions: () => <ConnectedHeaderControls disabled={disabled} />,
    drawer: PuckDrawerLibrary,
    drawerItem: PuckDrawerItem,
    actionBar: (props: { children: React.ReactNode; label?: string; parentAction?: React.ReactNode }) => (
      <SelectedBlockActionBar {...props} disabled={disabled} />
    ),
  }), [disabled]);

  const updateCanonical = (nextData: PuckEditorData): PageBuilderDocument => {
    setData(nextData);
    const nextDocument = puckToCanonical(nextData, contextRef.current);
    onChange(nextDocument);
    return nextDocument;
  };

  return (
    <div className="g7pb-editor" data-testid="page-builder-editor" aria-busy={disabled}>
      <Puck
        config={pageBuilderPuckConfig}
        data={data}
        height="100%"
        iframe={{ enabled: iframeEnabled, syncHostStyles: true, waitForStyles: false }}
        viewports={PAGE_BUILDER_VIEWPORTS}
        ui={{
          viewports: {
            current: { width: 1280, height: 'auto' },
            controlsVisible: false,
            options: PAGE_BUILDER_VIEWPORTS,
          },
        }}
        permissions={{ edit: !disabled, insert: !disabled, delete: !disabled, duplicate: !disabled, drag: !disabled }}
        overrides={overrides}
        headerTitle="페이지 블록"
        headerPath={document.slug}
        onChange={updateCanonical}
        onPublish={(nextData) => onPublish(updateCanonical(nextData))}
      />
    </div>
  );
}
