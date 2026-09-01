import { canonicalDocumentToPuck, puckDocumentToCanonical, type PuckAdapterContext, type PuckEditorSession } from './puckDocumentAdapter';
export type { PuckAdapterContext, PuckEditorSession } from './puckDocumentAdapter';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Ban,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Blocks,
  Copy,
  ImageOff,
  ImagePlus,
  Link2,
  Monitor,
  Paintbrush,
  Plus,
  Moon,
  Sun,
  Smartphone,
  Sparkles,
  Star,
  Settings2,
  Tablet,
  Trash2,
  X,
} from 'lucide-react';
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
  CatalogGalleryThumbnail,
  canonicalCatalogBlockToPuck,
  catalogComponentConfigs,
  catalogPuckBlockToCanonical,
  type CatalogEditorComponents,
} from './catalogBlocks';
import {
  layoutCatalogComponentConfigs,
  type LayoutCatalogEditorComponents,
} from './layoutCatalogBlocks';
import { BLOCK_CATEGORY_LABELS, blockCatalogTestId, BUILTIN_BLOCK_DEFINITIONS, BUILTIN_BLOCK_PRESETS, BUILTIN_CORE_MANIFEST } from '../blocks/builtinCatalog';
import type { BlockCatalogItem } from '../blocks/types';
import {
  externalBlockForComponent,
  externalBlockForDocument,
  externalEditorComponents,
  isEditorComponentRegistered,
} from '../blocks/runtimeRegistry';
import { ADMIN_AUTH_TOKEN_KEY, PageBuilderApiClient } from '../api/pageBuilderApi';
import {
  createMotionField,
  DEFAULT_BLOCK_MOTION,
  motionPreviewAttributes,
  normalizeBlockMotion,
} from './blockMotion';
import { CanvasMediaPicker, createMediaField } from './MediaPickerField';
import { CatalogIcon, type CatalogIconName } from './catalogIcon';
import { FONT_SIZE_REM_OPTIONS, normalizeFontSizeRem } from './fontSize';
import { CanvasRoutePicker, createRouteUrlField } from './RouteUrlField';
import { canvasTextValue } from './foundationCatalogBlocks';
import {
  createInlineRichTextField,
  createRichTextField,
  richTextRangeAnchorFromSelection,
  RICH_TEXT_RANGE_STATE_MESSAGE,
  RichTextCanvasField,
} from './richTextEditing';
import {
  CANVAS_ELEMENT_MESSAGE,
  collectionLimit,
  notifyCanvasElementSelection,
  resolveMediaFieldPath,
  resolveRouteFieldPath,
  decorateCanvasElementStyles,
  normalizeElementAppearance,
  normalizeElementAppearanceMap,
  remapCollectionElementAppearanceMap,
  shouldAutoOpenCanvasTextTools,
  CanvasBlockAppearanceContext,
  CanvasCurrentElementStylesContext,
  CanvasElementStylesContext,
  useCanvasBlockAppearanceClass,
  useCanvasElementStyles,
  setValueAtPath,
  valueAtPath,
  type CanvasElementSelection,
} from './canvasEditingContract';
import {
  INITIAL_CANVAS_CONTEXT_STATE,
  canvasContextRangeAnchor,
  canvasContextRangeActive,
  canvasContextSelection,
  normalizeCanvasRangeAnchor,
  reduceCanvasContextState,
  type CanvasRangeAnchor,
  type CanvasContextAction,
} from './canvasContextState';
import { SitePartEditor, AnnouncementPreview, FooterColumnsPreview, FooterSimplePreview, HeaderNavigationPreview } from './SitePartEditor';
import { sitePartCanonicalToPuck, type SitePartComponents } from './sitePartDocumentAdapter';
import {
  pageDesignClassName,
  pageDesignCustomCss,
  type PageDesignProps,
} from './pageDesignTokens';
import {
  BLOCK_CONTAINER_FIELDS,
  blockContainerEditorProps,
  blockContainerClassName,
  mergeBlockContainerAppearance,
} from './blockAppearance';
import {
  createResponsiveAppearanceField,
  hasResponsiveOverrides,
  normalizeResponsiveOverrides,
  responsiveClassName,
} from './responsiveBlockStyle';
import {
  clearVisibleClipContract,
  currentInteractionRects,
  exposeVisibleClipContract,
  inverseScaledTranslation,
  placeEditorOverlay,
  quantizeOverlayPixel,
  renderedElementScale,
  visibleOwnerViewport,
} from './editorOverlaySafeZone';
import {
  applyEditorContentPolicy,
  initialEditorCanvasWidth,
  PC_EDITOR_MIN_HOST_WIDTH,
  PC_EDITOR_VIEWPORT_WIDTH,
  PC_EDITOR_POLICY_NOTICE,
  resolveEditorViewportPolicy,
  type EditorFieldContract,
  type EditorViewportPolicy,
} from './editorViewportPolicy';

import {
  CONTACT_BLOCK_TYPE,
  CTA_BLOCK_TYPE,
  FEATURES_BLOCK_TYPE,
  HERO_BLOCK_TYPE,
  LAYOUT_COLUMNS_BLOCK_TYPE,
  LAYOUT_SECTION_BLOCK_TYPE,
  LAYOUT_STACK_BLOCK_TYPE,
  type ContactBlockProps,
  type BlockAppearance,
  type BlockMotion,
  type CtaBlockProps,
  type FeatureItem,
  type FeaturesBlockProps,
  type HeroBlockProps,
  type PageBuilderBlock,
  type PageBuilderDocument,
  type SectionPatternResource,
  type ElementAppearance,
  type ElementAppearanceMap,
  type SitePartResource,
} from '../documents/types';
import { validateLayoutDocument } from '../documents/layoutPolicy';
import { cloneLayoutSubtree } from '../documents/layoutTree';

interface HeroEditorProps {
  eyebrow: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryUrl: string;
  imageSrc: string;
  imageAlt: string;
  alignment: 'left' | 'center';
  mediaPosition: 'left' | 'right';
  layout: NonNullable<HeroBlockProps['layout']> | 'classic';
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

interface FeaturesEditorProps {
  title: string;
  items: FeatureItem[];
  layout: NonNullable<FeaturesBlockProps['layout']>;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
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
  layout: NonNullable<CtaBlockProps['layout']>;
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
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
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

interface EditorComponents extends CatalogEditorComponents, LayoutCatalogEditorComponents {
  Hero: HeroEditorProps;
  Features: FeaturesEditorProps;
  Cta: CtaEditorProps;
  Contact: ContactEditorProps;
}

interface FullSiteCanvasValue {
  locale: PageBuilderDocument['locale'];
  shellMode: PageBuilderDocument['shell_mode'];
  header: SitePartResource | null;
  footer: SitePartResource | null;
  canEdit: boolean;
  edit: (kind: 'header' | 'footer') => void;
}

const FullSiteCanvasContext = React.createContext<FullSiteCanvasValue>({ locale: 'ko', shellMode: 'none', header: null, footer: null, canEdit: false, edit: () => undefined });
const EditorViewportPolicyContext = React.createContext<EditorViewportPolicy>({
  canEdit: false,
  canvasWidth: PC_EDITOR_VIEWPORT_WIDTH,
  hostSupported: false,
  mode: 'preview',
  status: '현재 기기에서는 편집할 수 없습니다.',
});

interface CanvasEditingUiValue {
  selection: CanvasElementSelection | null;
  setSelection: React.Dispatch<React.SetStateAction<CanvasElementSelection | null>>;
  rangeEditingActive: boolean;
  rangeAnchor: CanvasRangeAnchor | null;
  mediaDialogOpen: boolean;
  setMediaDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  routeDialogOpen: boolean;
  setRouteDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  textToolsOpen: boolean;
  setTextToolsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const CanvasEditingUiContext = React.createContext<CanvasEditingUiValue | null>(null);

function SitePartCanvasContent({ resource }: { resource: SitePartResource }): React.ReactElement {
  const data = sitePartCanonicalToPuck(resource.document);
  return <>{data.content.map((block, index) => {
    const props = block.props as SitePartComponents[keyof SitePartComponents] & { id?: string };
    if (block.type === 'HeaderNavigation') return <HeaderNavigationPreview key={props.id ?? index} {...props as SitePartComponents['HeaderNavigation']} />;
    if (block.type === 'Announcement') return <AnnouncementPreview key={props.id ?? index} {...props as SitePartComponents['Announcement']} />;
    if (block.type === 'FooterSimple') return <FooterSimplePreview key={props.id ?? index} {...props as SitePartComponents['FooterSimple']} />;
    return <FooterColumnsPreview key={props.id ?? index} {...props as SitePartComponents['FooterColumns']} />;
  })}</>;
}

function FullSiteCanvasPart({ kind, resource, template }: { kind: 'header' | 'footer'; resource: SitePartResource | null; template: boolean }): React.ReactElement {
  const canvas = React.useContext(FullSiteCanvasContext);
  return <section className={`g7pb-full-site-part g7pb-full-site-part--${kind}`} data-testid={`page-builder-canvas-${kind}`}>
    {resource ? <SitePartCanvasContent resource={resource} /> : <div className="g7pb-full-site-part__placeholder"><strong>{template ? `G7 활성 템플릿 ${kind === 'header' ? 'Header' : 'Footer'}` : `${kind === 'header' ? 'Header' : 'Footer'}가 아직 없습니다.`}</strong><span>{template ? '템플릿 공통 영역은 공개 미리보기에서 정확히 확인합니다.' : '공통 Site Part를 만들어 전체 사이트 흐름을 완성하세요.'}</span></div>}
    {!template ? <button type="button" className="g7pb-full-site-part__edit" disabled={!canvas.canEdit}
      onClick={() => canvas.edit(kind)}>{kind === 'header' ? 'Header' : 'Footer'} 편집</button> : null}
  </section>;
}

function FullSiteRoot({ children, design }: { children: React.ReactNode; design: PageDesignProps }): React.ReactElement {
  const canvas = React.useContext(FullSiteCanvasContext);
  const template = canvas.shellMode === 'template';
  const builder = canvas.shellMode === 'builder' || canvas.shellMode === 'global';

  // Puck's iframe language is independent of the canonical document. Set the
  // content language here so font fallback/normal line boxes match publication.
  return <div lang={canvas.locale} className={`g7pb-preview-page ${pageDesignClassName(design)}`}>
    <style data-g7pb-custom-palette="true">{pageDesignCustomCss(design)}</style>
    {(template || builder) ? <FullSiteCanvasPart kind="header" resource={builder ? canvas.header : null} template={template} /> : null}
    <div className={`g7pb-full-site-page${template ? ' g7pb-full-site-page--template' : ''}`} data-testid="page-builder-canvas-page">{children}</div>
    {(template || builder) ? <FullSiteCanvasPart kind="footer" resource={builder ? canvas.footer : null} template={template} /> : null}
  </div>;
}

export type PuckEditorData = Data<EditorComponents, PageDesignProps>;

const MOTION_PRESET_FAMILIES: Readonly<Record<string, readonly BlockMotion['preset'][]>> = Object.freeze({
  Hero: ['parallax-soft', 'reveal'],
  HeroSplit: ['parallax-soft', 'reveal'],
  HeroSlider: ['parallax-soft', 'reveal'],
  Gallery: ['parallax-soft', 'stagger', 'reveal'],
  ImageCarousel: ['parallax-soft', 'reveal'],
  Features: ['stagger', 'reveal'],
  IconList: ['stagger', 'reveal'],
  CardGrid: ['stagger', 'reveal'],
  LogoCloud: ['stagger', 'reveal'],
  Pricing: ['stagger', 'reveal'],
  Team: ['stagger', 'reveal'],
  Testimonials: ['stagger', 'reveal'],
  ProcessTimeline: ['stagger', 'reveal'],
  ArticleList: ['stagger', 'reveal'],
  G7RecentPosts: ['stagger', 'reveal'],
  G7ProductGrid: ['stagger', 'reveal'],
  Stats: ['counter', 'stagger', 'reveal'],
  BarChart: ['chart-draw', 'reveal'],
});

export function recommendedMotionPlan(types: readonly string[]): BlockMotion[] {
  let previous: BlockMotion['preset'] | null = null;
  const occurrences = new Map<string, number>();
  const intensities: BlockMotion['intensity'][] = ['subtle', 'normal', 'normal', 'strong'];
  const staggers: BlockMotion['stagger_ms'][] = [60, 100, 160];

  return types.map((type, index) => {
    const options = MOTION_PRESET_FAMILIES[type] ?? ['reveal'];
    const occurrence = occurrences.get(type) ?? 0;
    occurrences.set(type, occurrence + 1);
    let preset = options[occurrence % options.length] ?? 'reveal';
    if (options.length > 1 && preset === previous) {
      preset = options[(options.indexOf(preset) + 1) % options.length] ?? preset;
    }
    previous = preset;
    return {
      ...DEFAULT_BLOCK_MOTION,
      preset,
      intensity: intensities[index % intensities.length] ?? 'normal',
      stagger_ms: staggers[index % staggers.length] ?? 100,
    };
  });
}

interface PuckEditorAdapterProps {
  document: PageBuilderDocument;
  revisionKey: number;
  disabled?: boolean;
  iframeEnabled?: boolean;
  onDirty?: () => void;
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
  mediaPosition: 'right',
  layout: 'product',
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
  layout: 'bento',
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
  layout: 'split',
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

function normalizeHeroLayout(value: unknown): HeroEditorProps['layout'] {
  return value === 'product' || value === 'poster' || value === 'backdrop' || value === 'editorial' || value === 'device'
    || value === 'balanced' || value === 'screenshot' || value === 'overlap' || value === 'offset'
    ? value
    : 'classic';
}

function isSplitHeroLayout(layout: HeroEditorProps['layout']): layout is 'balanced' | 'screenshot' | 'overlap' | 'offset' {
  return layout === 'balanced' || layout === 'screenshot' || layout === 'overlap' || layout === 'offset';
}

function normalizeFeaturesLayout(value: unknown): FeaturesEditorProps['layout'] {
  return value === 'bento' || value === 'editorial' || value === 'panel' || value === 'list' ? value : 'grid';
}

function normalizeCtaLayout(value: unknown): CtaEditorProps['layout'] {
  return value === 'centered' || value === 'banner' || value === 'panel' ? value : 'split';
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
): Pick<HeroEditorProps, 'surface' | 'spacing' | 'textScale' | 'textAlign' | 'elementStyles'> {
  const appearance = typeof value === 'object' && value !== null
    ? value as Record<string, unknown>
    : {};

  return {
    surface: normalizeSurface(appearance.surface, fallback.surface),
    spacing: normalizeSpacing(appearance.spacing, fallback.spacing),
    textScale: appearance.textScale === 'compact' || appearance.textScale === 'large' ? appearance.textScale : 'balanced',
    textAlign: appearance.textAlign === 'center' || appearance.textAlign === 'right' ? appearance.textAlign : 'left',
    elementStyles: normalizeElementAppearanceMap(appearance.elements),
  };
}

function editorAppearance(
  surface: unknown,
  spacing: unknown,
  fallback: BlockAppearance,
  textScale?: unknown,
  textAlign?: unknown,
  elementStyles?: unknown,
): BlockAppearance {
  const appearance: BlockAppearance = {
    surface: normalizeSurface(surface, fallback.surface),
    spacing: normalizeSpacing(spacing, fallback.spacing),
  };
  if (textScale === 'compact' || textScale === 'large') appearance.textScale = textScale;
  if (textAlign === 'center' || textAlign === 'right') appearance.textAlign = textAlign;
  const elements = normalizeElementAppearanceMap(elementStyles);
  if (Object.keys(elements).length > 0) appearance.elements = elements;
  return appearance;
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

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) && typeof value[index] === 'object' && value[index] !== null
    ? value[index] as Record<string, unknown>
    : {};
  const candidate = item[key];
  return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback;
}

function hasNonEmptySlots(block: PageBuilderBlock): boolean {
  return Boolean(block.slots && Object.values(block.slots).some((slot) => slot.length > 0));
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
    mediaPosition: props.mediaPosition === 'left' ? 'left' : 'right',
    layout: normalizeHeroLayout(props.layout),
    ...appearanceToEditorProps(props.appearance, { surface: 'default', spacing: 'spacious' }),
    motion: { ...DEFAULT_BLOCK_MOTION },
  };
}

function featuresToEditorProps(props: Record<string, unknown>): FeaturesEditorProps {
  return {
    title: asString(props.title),
    items: normalizeFeatureItems(props.items),
    layout: normalizeFeaturesLayout(props.layout),
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
    layout: normalizeCtaLayout(props.layout),
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

function canonicalBlockToPuckRaw(block: PageBuilderBlock): PuckEditorData['content'][number] {
  if (block.type === LAYOUT_SECTION_BLOCK_TYPE) {
    const width = block.props.width === 'wide' || block.props.width === 'full' ? block.props.width : 'standard';
    const spacing = block.props.spacing === 'compact' || block.props.spacing === 'spacious' ? block.props.spacing : 'normal';
    return {
      type: 'LayoutSection',
      props: {
        id: block.instance_id,
        width,
        spacing,
        content: (block.slots?.content ?? []).map(canonicalBlockToPuck),
      },
    } as unknown as PuckEditorData['content'][number];
  }

  if (block.type === LAYOUT_COLUMNS_BLOCK_TYPE) {
    const columns = block.props.columns === 1 || block.props.columns === 3 ? block.props.columns : 2;
    const ratios = columns === 1 ? ['1'] : columns === 3 ? ['1:1:1'] : ['1:1', '1:2', '2:1'];
    const ratio = typeof block.props.ratio === 'string' && ratios.includes(block.props.ratio)
      ? block.props.ratio : ratios[0]!;
    const gap = block.props.gap === 'none' || block.props.gap === 'compact' || block.props.gap === 'spacious'
      ? block.props.gap : 'normal';
    return {
      type: 'LayoutColumns',
      props: {
        id: block.instance_id,
        columns: String(columns),
        ratio,
        gap,
        column1: (block.slots?.column1 ?? []).map(canonicalBlockToPuck),
        ...(columns >= 2 ? { column2: (block.slots?.column2 ?? []).map(canonicalBlockToPuck) } : {}),
        ...(columns >= 3 ? { column3: (block.slots?.column3 ?? []).map(canonicalBlockToPuck) } : {}),
      },
    } as unknown as PuckEditorData['content'][number];
  }

  if (block.type === LAYOUT_STACK_BLOCK_TYPE) {
    const gap = block.props.gap === 'none' || block.props.gap === 'compact' || block.props.gap === 'spacious'
      ? block.props.gap : 'normal';
    return {
      type: 'LayoutStack',
      props: {
        id: block.instance_id,
        gap,
        content: (block.slots?.content ?? []).map(canonicalBlockToPuck),
      },
    } as unknown as PuckEditorData['content'][number];
  }

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
    } as unknown as PuckEditorData['content'][number];
  }

  const externalBlock = externalBlockForDocument(block.type, block.block_version);
  if (externalBlock) {
    return {
      type: externalBlock.editor_component,
      props: {
        ...block.props,
        id: block.instance_id,
        motion: normalizeBlockMotion(block.motion),
        __g7pbBlockVersion: block.block_version,
      },
    } as unknown as PuckEditorData['content'][number];
  }

  throw new Error(`Unsupported PageBuilder block: ${block.type}`);
}

function canonicalBlockToPuck(block: PageBuilderBlock): PuckEditorData['content'][number] {
  const converted = canonicalBlockToPuckRaw(block);
  return {
    ...converted,
    props: {
      ...converted.props,
      ...blockContainerEditorProps(block.props.appearance),
      responsiveOverrides: normalizeResponsiveOverrides(block.responsive),
      __g7pbVisibilityAudience: block.visibility?.audience ?? 'all',
    },
  } as unknown as PuckEditorData['content'][number];
}

export function canonicalToPuck(document: PageBuilderDocument): PuckEditorSession {
  if (document.schema_version === 'g7-page-builder/v2') validateLayoutDocument(document);
  return canonicalDocumentToPuck(document, canonicalBlockToPuck);
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
    hadVisibility: false,
    hadResponsive: false,
    hadLayout: true,
    initialLayout: null,
    hadPageSize: true,
    hadSliderSettings: false,
  };
  let type: string;
  let blockVersion = metadata.blockVersion;
  let supportsContainerAppearance = true;
  let props: HeroBlockProps | FeaturesBlockProps | CtaBlockProps | ContactBlockProps | Record<string, unknown>;

  if (block.type === 'LayoutSection') {
    type = LAYOUT_SECTION_BLOCK_TYPE;
    blockVersion = 1;
    supportsContainerAppearance = false;
    props = {
      width: block.props.width === 'wide' || block.props.width === 'full' ? block.props.width : 'standard',
      spacing: block.props.spacing === 'compact' || block.props.spacing === 'spacious' ? block.props.spacing : 'normal',
    };
  } else if (block.type === 'LayoutColumns') {
    type = LAYOUT_COLUMNS_BLOCK_TYPE;
    blockVersion = 1;
    supportsContainerAppearance = false;
    const columns = block.props.columns === '1' ? 1 : block.props.columns === '3' ? 3 : 2;
    const ratios = columns === 1 ? ['1'] : columns === 3 ? ['1:1:1'] : ['1:1', '1:2', '2:1'];
    props = {
      columns,
      ratio: typeof block.props.ratio === 'string' && ratios.includes(block.props.ratio) ? block.props.ratio : ratios[0],
      gap: block.props.gap === 'none' || block.props.gap === 'compact' || block.props.gap === 'spacious'
        ? block.props.gap : 'normal',
    };
  } else if (block.type === 'LayoutStack') {
    type = LAYOUT_STACK_BLOCK_TYPE;
    blockVersion = 1;
    supportsContainerAppearance = false;
    props = {
      gap: block.props.gap === 'none' || block.props.gap === 'compact' || block.props.gap === 'spacious'
        ? block.props.gap : 'normal',
    };
  } else if (block.type === 'Hero') {
    const editorProps = block.props as typeof block.props & HeroEditorProps;
    type = HERO_BLOCK_TYPE;
    const heroProps: HeroBlockProps = {
      eyebrow: asString(editorProps.eyebrow),
      title: asString(editorProps.title),
      body: asString(editorProps.body),
      alignment: normalizeAlignment(editorProps.alignment),
    };
    const layout = normalizeHeroLayout(editorProps.layout);
    if (layout !== 'classic') heroProps.layout = layout;
    if (isSplitHeroLayout(layout)) heroProps.mediaPosition = editorProps.mediaPosition === 'left' ? 'left' : 'right';
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'default', spacing: 'spacious' }, editorProps.textScale, editorProps.textAlign, editorProps.elementStyles);
    if (metadata.hadAppearance || appearance.surface !== 'default' || appearance.spacing !== 'spacious' || appearance.textScale || appearance.textAlign || appearance.elements) {
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
      layout: normalizeFeaturesLayout(editorProps.layout),
    };
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'soft', spacing: 'normal' }, editorProps.textScale, editorProps.textAlign, editorProps.elementStyles);
    if (metadata.hadAppearance || appearance.surface !== 'soft' || appearance.spacing !== 'normal' || appearance.textScale || appearance.textAlign || appearance.elements) {
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
      layout: normalizeCtaLayout(editorProps.layout),
    };
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'soft', spacing: 'normal' }, editorProps.textScale, editorProps.textAlign, editorProps.elementStyles);
    if (metadata.hadAppearance || appearance.surface !== 'soft' || appearance.spacing !== 'normal' || appearance.textScale || appearance.textAlign || appearance.elements) {
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
    const appearance = editorAppearance(editorProps.surface, editorProps.spacing, { surface: 'default', spacing: 'normal' }, editorProps.textScale, editorProps.textAlign, editorProps.elementStyles);
    if (metadata.hadAppearance || appearance.surface !== 'default' || appearance.spacing !== 'normal' || appearance.textScale || appearance.textAlign || appearance.elements) {
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
      metadata.hadSliderSettings,
    );
    if (!catalogBlock) {
      const externalBlock = externalBlockForComponent((block as { type: string }).type);
      if (!externalBlock) {
        throw new Error(`Unsupported Puck component: ${(block as { type: string }).type}`);
      }
      const externalProps = { ...block.props } as Record<string, unknown>;
      delete externalProps.id;
      delete externalProps.motion;
      delete externalProps.__g7pbBlockVersion;
      delete externalProps.__g7pbVisibilityAudience;
      type = externalBlock.block_id;
      blockVersion = externalBlock.block_version;
      supportsContainerAppearance = false;
      props = externalProps;
    } else {
      type = catalogBlock.type;
      props = catalogBlock.props;
    }
  }

  const canonical: PageBuilderBlock = {
    instance_id: instanceId,
    type,
    block_version: blockVersion,
    props: props as unknown as Record<string, unknown>,
  };

  if (supportsContainerAppearance) {
    const appearance = mergeBlockContainerAppearance(canonical.props.appearance, block.props as Record<string, unknown>);
    if (appearance) canonical.props.appearance = appearance;
    else delete canonical.props.appearance;
  }

  if (!metadata.hadPageSize) {
    delete canonical.props.pageSize;
  }
  if (!metadata.hadLayout && canonical.props.layout === metadata.initialLayout) {
    delete canonical.props.layout;
  }

  const motion = normalizeBlockMotion(block.props.motion);
  if (metadata.hadMotion || motion.preset !== 'none') {
    canonical.motion = motion;
  }

  const internalProps = block.props as Record<string, unknown>;
  const responsive = normalizeResponsiveOverrides(internalProps.responsiveOverrides);
  delete canonical.props.responsiveOverrides;
  if (hasResponsiveOverrides(responsive)) canonical.responsive = responsive;
  const visibilityAudience = internalProps.__g7pbVisibilityAudience === 'guest'
    || internalProps.__g7pbVisibilityAudience === 'member'
    ? internalProps.__g7pbVisibilityAudience
    : 'all';
  if (metadata.hadVisibility || visibilityAudience !== 'all') {
    canonical.visibility = { audience: visibilityAudience };
  }

  if (block.type === 'LayoutSection') {
    const children = Array.isArray(block.props.content) ? block.props.content : [];
    canonical.slots = { content: children.map((child) => puckBlockToCanonical(child as PuckEditorData['content'][number], context)) };
  } else if (block.type === 'LayoutColumns') {
    const columns = canonical.props.columns === 1 || canonical.props.columns === 3 ? canonical.props.columns : 2;
    const blockProps = block.props as Record<string, unknown>;
    canonical.slots = Object.fromEntries(Array.from({ length: columns }, (_, index) => {
      const name = `column${index + 1}`;
      const children = Array.isArray(blockProps[name]) ? blockProps[name] as unknown[] : [];
      return [name, children.map((child) => puckBlockToCanonical(child as PuckEditorData['content'][number], context))];
    }));
  } else if (block.type === 'LayoutStack') {
    const children = Array.isArray(block.props.content) ? block.props.content : [];
    canonical.slots = { content: children.map((child) => puckBlockToCanonical(child as PuckEditorData['content'][number], context)) };
  } else if (metadata.hadSlots) {
    canonical.slots = {};
  }

  return canonical;
}

export function puckToCanonical(data: PuckEditorData, context: PuckAdapterContext): PageBuilderDocument {
  return puckDocumentToCanonical(data, context, puckBlockToCanonical);
}

export function activateStructureEditing(
  data: PuckEditorData,
  context: PuckAdapterContext,
): { document: PageBuilderDocument; context: PuckAdapterContext } {
  const nextContext: PuckAdapterContext = {
    ...context,
    document: {
      ...context.document,
      schemaVersion: 'g7-page-builder/v2',
    },
  };
  const nextDocument = puckToCanonical(data, nextContext);

  return { document: nextDocument, context: nextContext };
}

function flattenPuckBlocks(blocks: PuckEditorData['content']): PuckEditorData['content'] {
  const flattened: PuckEditorData['content'] = [];
  const visit = (block: PuckEditorData['content'][number]): void => {
    flattened.push(block);
    for (const candidate of Object.values(block.props as Record<string, unknown>)) {
      if (!Array.isArray(candidate)) continue;
      for (const child of candidate) {
        if (typeof child !== 'object' || child === null) continue;
        const item = child as Record<string, unknown>;
        if (typeof item.type === 'string' && typeof item.props === 'object' && item.props !== null) {
          visit(child as PuckEditorData['content'][number]);
        }
      }
    }
  };
  blocks.forEach(visit);
  return flattened;
}

function safeLink(value: unknown): string {
  if (typeof value !== 'string') return '#';
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

function safeImage(value: unknown): string | null {
  const link = safeLink(value);
  return link === '#' || link.startsWith('mailto:') || link.startsWith('tel:') ? null : link;
}

function safePhoneLink(value: unknown): string {
  if (typeof value !== 'string') return '#';
  const trimmed = value.trim();
  if (!/^\+?[0-9][0-9 .()\-]{2,39}$/.test(trimmed)) {
    return '#';
  }

  return safeLink(`tel:${trimmed.replace(/[ .()\-]/g, '')}`);
}

function safeEmailLink(value: unknown): string {
  if (typeof value !== 'string') return '#';
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
    'P', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'A', 'OL', 'UL', 'LI', 'BLOCKQUOTE', 'BR',
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
      const typedMarks = child.tagName === 'SPAN' ? {
        font: child.getAttribute('data-g7pb-font') ?? '',
        fontSizeRem: child.getAttribute('data-g7pb-font-size-rem') ?? '',
        size: child.getAttribute('data-g7pb-size') ?? '',
        weight: child.getAttribute('data-g7pb-weight') ?? '',
        tone: child.getAttribute('data-g7pb-tone') ?? '',
      } : null;
      for (const attribute of Array.from(child.attributes)) {
        child.removeAttribute(attribute.name);
      }
      if (child.tagName === 'A' && safeLink(href) !== '#') {
        child.setAttribute('href', safeLink(href));
        child.setAttribute('rel', 'noopener noreferrer');
      }
      if (typedMarks) {
        if (['modern', 'serif', 'mono'].includes(typedMarks.font)) child.setAttribute('data-g7pb-font', typedMarks.font);
        const fontSizeRem = normalizeFontSizeRem(Number(typedMarks.fontSizeRem));
        if (fontSizeRem !== undefined) child.setAttribute('data-g7pb-font-size-rem', String(fontSizeRem));
        if (['small', 'large', 'xlarge'].includes(typedMarks.size)) child.setAttribute('data-g7pb-size', typedMarks.size);
        if (['medium', 'semibold', 'bold'].includes(typedMarks.weight)) child.setAttribute('data-g7pb-weight', typedMarks.weight);
        if (['muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'].includes(typedMarks.tone)) child.setAttribute('data-g7pb-tone', typedMarks.tone);
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
  label,
  help,
}: {
  value: TValue;
  onChange: (value: TValue) => void;
  readOnly?: boolean;
  testId: string;
  options: Array<{ label: string; value: TValue }>;
  label?: string;
  help?: string;
}): React.ReactElement {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);

  return (
    <label className={label ? 'g7pb-design-field' : undefined}>
      {label ? <span>{label}</span> : null}
      {help ? <small>{help}</small> : null}
      <select
        className="g7pb-field-control"
        data-testid={testId}
        value={draftValue}
        disabled={readOnly}
        onChange={(event) => {
          const nextValue = event.target.value as TValue;
          setDraftValue(nextValue);
          onChange(nextValue);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function StableColorField({
  value,
  onChange,
  readOnly,
  testId,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId: string;
  label: string;
}): React.ReactElement {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);
  return <label className="g7pb-design-field g7pb-design-field--color">
    <span>{label}</span>
    <input className="g7pb-field-control" type="color" value={draftValue} disabled={readOnly}
      data-testid={testId} onChange={(event) => {
        const next = event.currentTarget.value.toLowerCase();
        setDraftValue(next);
        onChange(next);
      }} />
  </label>;
}

function createPageColorField(label: string, testId: string) {
  return {
    type: 'custom' as const,
    label,
    render: ({ value, onChange, readOnly }: {
      value: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) => <StableColorField value={value} onChange={onChange} readOnly={readOnly} testId={testId} label={label} />,
  };
}

const REQUIRED_INSPECTOR_FIELD_NAMES = new Set(['alt', 'imageAlt', 'avatarAlt']);

function markRequiredInspectorFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([name, field]) => {
    if (!field || typeof field !== 'object' || Array.isArray(field)) return [name, field];
    const next = { ...(field as Record<string, unknown>) };
    if (REQUIRED_INSPECTOR_FIELD_NAMES.has(name) && typeof next.label === 'string' && !next.label.includes('(필수)')) {
      next.label = `${next.label} (필수)`;
    }
    if (next.arrayFields && typeof next.arrayFields === 'object' && !Array.isArray(next.arrayFields)) {
      next.arrayFields = markRequiredInspectorFields(next.arrayFields as Record<string, unknown>);
    }
    return [name, next];
  }));
}

function withBlockContainerFields<TComponents extends Record<string, { fields?: Record<string, unknown> }>>(
  components: TComponents,
): TComponents {
  const containerFields = Object.fromEntries(Object.entries(BLOCK_CONTAINER_FIELDS).map(([name, field]) => [name, {
    type: 'custom' as const,
    label: field.label,
    render: ({ value, onChange, readOnly }: {
      value: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) => <StableSelectField
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      testId={`page-builder-block-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`}
      options={field.options}
    />,
  }]));
  const stableFields = { ...containerFields, responsiveOverrides: createResponsiveAppearanceField() };
  return Object.fromEntries(Object.entries(components).map(([name, component]) => [name, name.startsWith('Layout') ? component : {
    ...component,
    fields: markRequiredInspectorFields({
      ...(component.fields ?? {}),
      ...stableFields,
    }),
  }])) as unknown as TComponents;
}

function BlockFrame({
  id,
  type,
  motion,
  elementStyles,
  children,
}: {
  id: string;
  type: string;
  motion: BlockMotion;
  elementStyles?: ElementAppearanceMap;
  children: React.ReactNode;
}): React.ReactElement {
  const resolvedElementStyles = useCanvasElementStyles(id, elementStyles);
  const containerClassName = useCanvasBlockAppearanceClass(id);
  return (
    <section
      className={`g7pb-preview-block ${containerClassName}`.trim()}
      data-testid="page-builder-block"
      data-block-id={idToUuid(id)}
      data-block-type={type}
      onPointerDownCapture={(event) => notifyCanvasElementSelection(event, idToUuid(id), type)}
      {...motionPreviewAttributes(motion)}
    >
      <CanvasCurrentElementStylesContext.Provider value={resolvedElementStyles}>
        {decorateCanvasElementStyles(children, resolvedElementStyles)}
      </CanvasCurrentElementStylesContext.Provider>
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
  mediaPosition,
  layout,
  surface,
  spacing,
  textScale = 'balanced',
  textAlign = 'left',
  elementStyles,
  motion,
}: Omit<HeroEditorProps, 'body' | 'title'> & { id: string; body: React.ReactNode; title: React.ReactNode }): React.ReactElement {
  const image = safeImage(imageSrc);

  if (isSplitHeroLayout(layout)) {
    return (
      <BlockFrame id={id} type="hero" motion={motion} elementStyles={elementStyles}>
        <div className={`g7pb-preview-hero-split g7pb-preview-hero-split--${mediaPosition} g7pb-preview-hero-split--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
          <div className="g7pb-preview-hero-split__copy">
            {canvasTextValue(eyebrow, 'plain') && <small data-g7pb-inline-field="eyebrow">{eyebrow}</small>}
            <RichTextCanvasField as="h1" className="g7pb-preview-richtext" fieldPath="title">{title}</RichTextCanvasField>
            <RichTextCanvasField fieldPath="body">{body}</RichTextCanvasField>
            {canvasTextValue(primaryLabel, 'plain') && <a data-g7pb-inline-field="primaryLabel" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>{primaryLabel}</a>}
          </div>
          <figure data-g7pb-media-field="imageSrc">
            {image
              ? <img src={image} alt={imageAlt} />
              : <span className="g7pb-preview-media-placeholder" role="img" aria-label="대표 이미지를 선택하세요">대표 이미지를 선택하세요</span>}
          </figure>
        </div>
      </BlockFrame>
    );
  }

  return (
    <BlockFrame id={id} type="hero" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-hero g7pb-preview-hero--${alignment} g7pb-preview-hero--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        {canvasTextValue(eyebrow, 'plain') && <p className="g7pb-preview-eyebrow" data-g7pb-inline-field="eyebrow">{eyebrow}</p>}
        <RichTextCanvasField as="h1" className="g7pb-preview-richtext g7pb-preview-hero__title" fieldPath="title">{title}</RichTextCanvasField>
        <RichTextCanvasField fieldPath="body">{body}</RichTextCanvasField>
        {canvasTextValue(primaryLabel, 'plain') && (
          <a className="g7pb-preview-cta" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>
            <span data-g7pb-inline-field="primaryLabel">{primaryLabel}</span>
          </a>
        )}
        <figure className="g7pb-preview-hero__media" data-g7pb-media-field="imageSrc">
          {image
            ? <img src={image} alt={imageAlt} />
            : <span className="g7pb-preview-media-placeholder" role="img" aria-label="대표 이미지를 선택하세요">대표 이미지를 선택하세요</span>}
        </figure>
      </div>
    </BlockFrame>
  );
}

function FeaturesPreview({ id, title, items, layout, surface, spacing, textScale = 'balanced', textAlign = 'left', elementStyles, motion }: Omit<FeaturesEditorProps, 'title'> & { id: string; title: React.ReactNode }): React.ReactElement {
  return (
    <BlockFrame id={id} type="features" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-features g7pb-preview-features--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="title">{title}</RichTextCanvasField>
        <div className="g7pb-preview-features__grid">
          {normalizeFeatureItems(items).map((item, index) => (
            <article key={`${item.title}-${index}`}>
              <span aria-hidden="true"><CatalogIcon name={(item.icon || 'sparkles') as CatalogIconName} size={34} /></span>
              <RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>
                {inlineArrayContent(items, index, 'title', item.title)}
              </RichTextCanvasField>
              <RichTextCanvasField fieldPath={`items.${index}.body`}>
                {inlineArrayContent(items, index, 'body', item.body)}
              </RichTextCanvasField>
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
  layout,
  surface,
  spacing,
  textScale = 'balanced',
  textAlign = 'left',
  elementStyles,
  motion,
}: Omit<CtaEditorProps, 'heading' | 'body'> & { id: string; heading: React.ReactNode; body: React.ReactNode }): React.ReactElement {
  const { canEdit } = React.useContext(EditorViewportPolicyContext);
  return (
    <BlockFrame id={id} type="cta" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-cta-split g7pb-preview-cta-split--${normalizeTheme(theme)} g7pb-preview-cta-split--layout-${layout} g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        <div className="g7pb-preview-cta-split__copy">
          {canvasTextValue(eyebrow, 'plain') && <p className="g7pb-preview-eyebrow" data-g7pb-inline-field="eyebrow">{eyebrow}</p>}
          <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{heading}</RichTextCanvasField>
          {(canEdit || canvasTextValue(body)) && <RichTextCanvasField fieldPath="body">{body}</RichTextCanvasField>}
        </div>
        {(canvasTextValue(primaryLabel, 'plain') || canvasTextValue(secondaryLabel, 'plain')) && (
          <div className="g7pb-preview-cta-split__actions">
            {canvasTextValue(primaryLabel, 'plain') && (
              <a className="g7pb-preview-cta" href={safeLink(primaryUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="primaryLabel">{primaryLabel}</span>
              </a>
            )}
            {canvasTextValue(secondaryLabel, 'plain') && (
              <a className="g7pb-preview-cta g7pb-preview-cta--secondary" href={safeLink(secondaryUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="secondaryLabel">{secondaryLabel}</span>
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
  textScale = 'balanced',
  textAlign = 'left',
  elementStyles,
  motion,
}: Omit<ContactEditorProps, 'heading'> & { id: string; heading: React.ReactNode }): React.ReactElement {
  return (
    <BlockFrame id={id} type="contact" motion={motion} elementStyles={elementStyles}>
      <div className={`g7pb-preview-contact g7pb-preview-surface--${surface} g7pb-preview-spacing--${spacing} g7pb-text-scale--${textScale} g7pb-text-align--${textAlign}`}>
        <div className="g7pb-preview-contact__heading">
          <p className="g7pb-preview-eyebrow">Contact</p>
          <RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{heading}</RichTextCanvasField>
        </div>
        <address className="g7pb-preview-contact__details">
          {canvasTextValue(address, 'plain') && <p data-g7pb-inline-field="address">{address}</p>}
          {phone && (
            <a href={safePhoneLink(phone)} onClick={(event) => event.preventDefault()}><span data-g7pb-inline-field="phone">{phone}</span></a>
          )}
          {email && (
            <a href={safeEmailLink(email)} onClick={(event) => event.preventDefault()}><span data-g7pb-inline-field="email">{email}</span></a>
          )}
        </address>
        {(canvasTextValue(ctaLabel, 'plain') || canvasTextValue(mapLabel, 'plain')) && (
          <div className="g7pb-preview-contact__actions">
            {canvasTextValue(ctaLabel, 'plain') && (
              <a className="g7pb-preview-cta" href={safeLink(ctaUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="ctaLabel">{ctaLabel}</span>
              </a>
            )}
            {canvasTextValue(mapLabel, 'plain') && (
              <a className="g7pb-preview-cta g7pb-preview-cta--secondary" href={safeLink(mapUrl)} onClick={(event) => event.preventDefault()}>
                <span data-g7pb-inline-field="mapLabel">{mapLabel}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </BlockFrame>
  );
}

export const pageBuilderPuckConfig: Config<EditorComponents, PageDesignProps> = {
  categories: {
    layout: {
      title: '구조 레이아웃',
      components: ['LayoutSection'],
      defaultExpanded: true,
    },
    layoutInternal: {
      components: ['LayoutColumns', 'LayoutStack'],
      visible: false,
    },
    content: {
      title: '콘텐츠 블록',
      components: ['Heading', 'RichText', 'ImageText', 'IconList', 'Hero', 'HeroSlider', 'Features', 'Cta', 'Buttons', 'Contact', 'FaqAccordion', 'ProcessTimeline', 'Tabs', 'ArticleList', 'EventSchedule', 'DownloadResources', 'InquiryForm', 'MapDirections'],
      defaultExpanded: true,
    },
    business: {
      title: '비즈니스·신뢰',
      components: ['LogoCloud', 'LogoCarousel', 'Testimonials', 'TestimonialSlider', 'Pricing', 'ComparisonTable', 'Team'],
      defaultExpanded: true,
    },
    dataMedia: {
      title: '데이터·미디어',
      components: ['Image', 'Stats', 'BarChart', 'Gallery', 'VideoEmbed'],
      defaultExpanded: true,
    },
    g7Data: {
      title: 'G7 데이터',
      components: ['G7RecentPosts', 'G7BoardArchive', 'G7PostDetail', 'G7ProductGrid', 'G7ProductShowcase', 'G7ProductDetail'],
      defaultExpanded: true,
    },
    legacy: {
      components: ['HeroSplit'],
      visible: false,
    },
  },
  components: withBlockContainerFields({
    ...layoutCatalogComponentConfigs,
    ...catalogComponentConfigs,
    Hero: {
      label: 'Hero',
      defaultProps: DEFAULT_HERO,
      fields: {
        eyebrow: {
          type: 'custom',
          label: '보조 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-hero-subtitle"
            />
          ),
        },
        title: createInlineRichTextField('제목'),
        body: createRichTextField('본문', 150, true),
        primaryLabel: {
          type: 'custom', label: '버튼 문구', contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-hero-primary-label" />
          ),
        },
        primaryUrl: createRouteUrlField('버튼 연결', 'page-builder-hero-primary-url'),
        imageSrc: createMediaField('대표 이미지', 'hero-image'),
        imageAlt: { type: 'text', label: '이미지 대체 텍스트' },
        alignment: {
          type: 'radio',
          label: '정렬',
          options: [
            { label: '왼쪽', value: 'left' },
            { label: '가운데', value: 'center' },
          ],
        },
        mediaPosition: {
          type: 'radio',
          label: '이미지 위치',
          options: [
            { label: '왼쪽', value: 'left' },
            { label: '오른쪽', value: 'right' },
          ],
        },
        layout: {
          type: 'select', label: '레이아웃', options: [
            { label: '기존 기본', value: 'classic' },
            { label: '제품 소개', value: 'product' }, { label: '포스터', value: 'poster' },
            { label: '배경 이미지', value: 'backdrop' }, { label: '에디토리얼', value: 'editorial' },
            { label: '디바이스 쇼케이스', value: 'device' },
            { label: '균형 분할', value: 'balanced' }, { label: '제품 스크린샷', value: 'screenshot' },
            { label: '이미지 겹침', value: 'overlap' }, { label: '세로 오프셋', value: 'offset' },
          ],
        },
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
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
      render: (props) => <HeroPreview {...props} />,
    },
    Features: {
      label: 'Features',
      defaultProps: DEFAULT_FEATURES,
      fields: {
        title: createInlineRichTextField('제목'),
        items: {
          type: 'array',
          label: '항목',
          min: 2,
          max: 6,
          defaultItemProps: (index) => ({ icon: 'sparkles', title: `기능 ${index + 1}`, body: '기능 설명을 입력하세요.' }),
          getItemSummary: (item) => item.title,
          arrayFields: {
            icon: { type: 'select', label: '아이콘', options: [
              { label: '반짝임', value: 'sparkles' }, { label: '보호', value: 'shield' },
              { label: '속도', value: 'bolt' }, { label: '관심', value: 'heart' },
            ] },
            title: createInlineRichTextField('제목'),
            body: createRichTextField('설명', 130),
          },
        },
        layout: { type: 'select', label: '레이아웃', options: [
          { label: '벤토', value: 'bento' }, { label: '균등 그리드', value: 'grid' },
          { label: '에디토리얼', value: 'editorial' }, { label: '패널', value: 'panel' },
          { label: '세로 목록', value: 'list' },
        ] },
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
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
      render: ({ id, title, items, layout, surface, spacing, motion }) => (
        <FeaturesPreview id={id} title={title} items={items} layout={layout} surface={surface} spacing={spacing} motion={motion} />
      ),
    },
    Cta: {
      label: 'CTA',
      defaultProps: DEFAULT_CTA,
      fields: {
        eyebrow: {
          type: 'custom',
          label: '보조 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-eyebrow" />
          ),
        },
        heading: createInlineRichTextField('제목'),
        body: createRichTextField('본문', 150, true),
        primaryLabel: {
          type: 'custom',
          label: '주 버튼 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-primary-label" />
          ),
        },
        primaryUrl: createRouteUrlField('주 버튼 연결', 'page-builder-cta-primary-url'),
        secondaryLabel: {
          type: 'custom',
          label: '보조 링크 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-secondary-label" />
          ),
        },
        secondaryUrl: createRouteUrlField('보조 링크 연결', 'page-builder-cta-secondary-url'),
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
        layout: { type: 'select', label: '레이아웃', options: [
          { label: '분할', value: 'split' }, { label: '가운데 집중', value: 'centered' },
          { label: '가로 배너', value: 'banner' }, { label: '강조 패널', value: 'panel' },
        ] },
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
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
        heading: createInlineRichTextField('제목'),
        address: {
          type: 'custom',
          label: '주소',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly} multiline
              testId="page-builder-contact-address" />
          ),
        },
        phone: {
          type: 'custom',
          label: '전화번호',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-phone" />
          ),
        },
        email: {
          type: 'custom',
          label: '이메일',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-email" />
          ),
        },
        ctaLabel: {
          type: 'custom',
          label: '문의 링크 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-cta-label" />
          ),
        },
        ctaUrl: createRouteUrlField('문의 링크 연결', 'page-builder-contact-cta-url'),
        mapLabel: {
          type: 'custom',
          label: '지도 링크 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-map-label" />
          ),
        },
        mapUrl: createRouteUrlField('지도 링크 연결', 'page-builder-contact-map-url'),
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
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
  }),
  root: {
    fields: {
      colorMode: {
        type: 'custom', label: '화면 테마',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="화면 테마" help="공개 페이지와 편집 캔버스의 밝기를 정합니다."
            testId="page-builder-design-color-mode" options={[
              { label: '라이트', value: 'light' }, { label: '다크', value: 'dark' }, { label: '기기 설정', value: 'system' },
            ]} />
        ),
      },
      palette: {
        type: 'custom', label: '브랜드 색상',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="브랜드 색상" help="버튼, 링크, 강조 요소에 공통 적용됩니다."
            testId="page-builder-design-palette" options={[
              { label: '인디고', value: 'indigo' }, { label: '블루', value: 'blue' },
              { label: '에메랄드', value: 'emerald' }, { label: '앰버', value: 'amber' },
              { label: '로즈', value: 'rose' }, { label: '슬레이트', value: 'slate' },
            ]} />
        ),
      },
      font: {
        type: 'custom', label: '글꼴 분위기',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="글꼴 분위기" help="페이지 전체 타이포그래피 계열을 선택합니다."
            testId="page-builder-design-font" options={[
              { label: '시스템', value: 'system' }, { label: '모던', value: 'modern' }, { label: '명조', value: 'serif' },
            ]} />
        ),
      },
      radius: {
        type: 'custom', label: '모서리',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="모서리" help="카드, 이미지, 버튼의 둥근 정도입니다."
            testId="page-builder-design-radius" options={[
              { label: '각지게', value: 'sharp' }, { label: '부드럽게', value: 'soft' }, { label: '둥글게', value: 'round' },
            ]} />
        ),
      },
      width: {
        type: 'custom', label: '콘텐츠 폭',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="콘텐츠 폭" help="본문이 차지하는 최대 가로 폭입니다."
            testId="page-builder-design-width" options={[
              { label: '좁게', value: 'narrow' }, { label: '기본', value: 'standard' }, { label: '넓게', value: 'wide' },
            ]} />
        ),
      },
      scale: {
        type: 'custom', label: '글자 크기',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="기본 글자 크기" help="전체 글자 비율을 한 번에 조절합니다."
            testId="page-builder-design-scale" options={[
              { label: '작게', value: 'compact' }, { label: '기본', value: 'balanced' }, { label: '크게', value: 'large' },
            ]} />
        ),
      },
      customColor1Light: createPageColorField('사용자색 1 · 라이트', 'page-builder-design-custom-1-light'),
      customColor1Dark: createPageColorField('사용자색 1 · 다크', 'page-builder-design-custom-1-dark'),
      customColor2Light: createPageColorField('사용자색 2 · 라이트', 'page-builder-design-custom-2-light'),
      customColor2Dark: createPageColorField('사용자색 2 · 다크', 'page-builder-design-custom-2-dark'),
      customColor3Light: createPageColorField('사용자색 3 · 라이트', 'page-builder-design-custom-3-light'),
      customColor3Dark: createPageColorField('사용자색 3 · 다크', 'page-builder-design-custom-3-dark'),
      customColor4Light: createPageColorField('사용자색 4 · 라이트', 'page-builder-design-custom-4-light'),
      customColor4Dark: createPageColorField('사용자색 4 · 다크', 'page-builder-design-custom-4-dark'),
    },
    render: ({ children, ...design }) => <FullSiteRoot design={design}>{children}</FullSiteRoot>,
  },
};

const usePageBuilderPuck = createUsePuck<Config<EditorComponents, PageDesignProps>>();

interface BlockGalleryItem {
  catalogId: string;
  kind: 'definition' | 'preset';
  type: keyof EditorComponents;
  testId: string;
  category: string;
  title: string;
  description: string;
  searchText: string;
  blockId: string;
  blockVersion: number;
  favorite: boolean;
  presetProps: Record<string, unknown> | null;
  thumbnail: string;
  packId: string;
  packLabel: string;
}

type BlockPreviewDensity = 'compact' | 'regular';

const COMPACT_BLOCK_PREVIEWS = new Set<keyof EditorComponents>([
  'Heading',
  'RichText',
  'Buttons',
  'Divider',
  'Blockquote',
  'Notice',
  'Breadcrumbs',
  'AnchorMenu',
  'SocialLinks',
]);

function blockPreviewDensity(type: keyof EditorComponents): BlockPreviewDensity {
  return COMPACT_BLOCK_PREVIEWS.has(type) ? 'compact' : 'regular';
}

function blockPackAssetUrl(packId: string, packVersion: string, path: string): string {
  const [publisher, pack] = packId.split('/', 2);
  if (!publisher || !pack || !path || path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return '';
  }
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `/modules/jiwonpapa-page_builder/block-packs/${encodeURIComponent(publisher)}/${encodeURIComponent(pack)}/${encodeURIComponent(packVersion)}/${encodedPath}`;
}

const BLOCK_SEARCH_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  Heading: '제목 헤딩 섹션 타이틀', RichText: '본문 글 문단 에디터', Image: '사진 이미지 배너', Buttons: '버튼 링크 행동 전환',
  Divider: '구분선 선 여백 분리', Blockquote: '인용문 후기 명언', Hero: '히어로 첫 화면 랜딩', HeroSplit: '분할 히어로 이미지',
  HeroSlider: '슬라이더 캠페인 배너', Features: '기능 특징 장점', Cta: '행동 유도 전환 문의', Notice: '알림 안내 주의 공지',
  ImageText: '이미지 텍스트 소개', IconList: '아이콘 목록 체크', CardGrid: '카드 서비스 목록', FaqAccordion: 'FAQ 질문 답변',
  ProcessTimeline: '절차 단계 과정', Tabs: '탭 정보 분류', ArticleList: '글 기사 소식', EventSchedule: '행사 일정 이벤트', DownloadResources: '자료 다운로드 파일',
  Gallery: '갤러리 사진 그리드', VideoEmbed: '영상 유튜브 비메오', ImageCarousel: '이미지 캐러셀 슬라이드',
  Breadcrumbs: '경로 탐색 브레드크럼', AnchorMenu: '앵커 메뉴 목차 바로가기', SocialLinks: '소셜 SNS 채널',
  Contact: '연락처 회사 안내', LogoCloud: '로고 고객사 파트너', LogoCarousel: '로고 캐러셀 고객사', Testimonials: '고객 후기 리뷰',
  TestimonialSlider: '후기 슬라이더 리뷰', Team: '팀 구성원 회사', Stats: '통계 수치 지표', BarChart: '막대 그래프 데이터',
  Pricing: '가격 요금제 플랜', ComparisonTable: '비교 표 기능', InquiryForm: '문의 견적 예약 신청 구독 폼', MapDirections: '지도 오시는 길 위치',
});

const BLOCK_CATEGORY_ORDER = ['기본', '첫 화면·전환', '콘텐츠', '미디어', '탐색', '신뢰·회사', '데이터·비교', '문의·방문', 'G7 데이터'] as const;
const QUICK_ADD_COMPONENTS = ['Heading', 'RichText', 'Image', 'Buttons', 'Hero', 'Cta'] as const;
const OPEN_BLOCK_GALLERY_EVENT = 'g7pb:open-block-gallery';
const LEGACY_LIBRARY_DEFINITION_IDS = new Set(['content.hero-split-01']);
export const BLOCK_GALLERY_WINDOW_SIZE = 24;

function blockPackLabel(packId: string): string {
  if (packId === BUILTIN_CORE_MANIFEST.pack_id) return '기본 제공';
  return packId.split('/').at(-1)?.replace(/[-_]+/g, ' ') || packId;
}

const BUILTIN_DEFINITION_GALLERY_ITEMS: ReadonlyArray<BlockGalleryItem> = BUILTIN_BLOCK_DEFINITIONS
  .filter((definition) => !LEGACY_LIBRARY_DEFINITION_IDS.has(definition.block_id))
  .map((definition) => {
  const type = definition.editor_component;
  if (!Object.prototype.hasOwnProperty.call(pageBuilderPuckConfig.components, type)) {
    throw new Error(`Builtin Block Pack editor component is not registered: ${type}`);
  }

  return {
    catalogId: `block:${definition.block_id}@${definition.block_version}`,
    kind: 'definition',
    type: type as keyof EditorComponents,
    testId: blockCatalogTestId(type),
    category: BLOCK_CATEGORY_LABELS[definition.category] ?? definition.category,
    title: definition.label.ko,
    description: definition.description.ko,
    searchText: [definition.block_id, definition.category, BLOCK_CATEGORY_LABELS[definition.category], type, BLOCK_SEARCH_ALIASES[type], ...Object.values(definition.label), ...Object.values(definition.description)].join(' '),
    blockId: definition.block_id,
    blockVersion: definition.block_version,
    favorite: false,
    presetProps: null,
    thumbnail: blockPackAssetUrl(BUILTIN_CORE_MANIFEST.pack_id, BUILTIN_CORE_MANIFEST.pack_version, definition.thumbnail),
    packId: BUILTIN_CORE_MANIFEST.pack_id,
    packLabel: blockPackLabel(BUILTIN_CORE_MANIFEST.pack_id),
  };
});

const BUILTIN_PRESET_GALLERY_ITEMS: ReadonlyArray<BlockGalleryItem> = BUILTIN_BLOCK_PRESETS.map((preset) => {
  const definition = BUILTIN_BLOCK_DEFINITIONS.find((candidate) =>
    candidate.block_id === preset.block_id && candidate.block_version === preset.block_version);
  if (!definition) {
    throw new Error(`Builtin preset references an unavailable definition: ${preset.preset_id}`);
  }
  const type = definition.editor_component;
  if (!Object.prototype.hasOwnProperty.call(pageBuilderPuckConfig.components, type)) {
    throw new Error(`Builtin preset editor component is not registered: ${type}`);
  }

  return {
    catalogId: `preset:${BUILTIN_CORE_MANIFEST.pack_id}:${preset.preset_id}`,
    kind: 'preset',
    type: type as keyof EditorComponents,
    testId: `page-builder-preset-${preset.preset_id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    category: BLOCK_CATEGORY_LABELS[preset.category] ?? preset.category,
    title: preset.label.ko,
    description: preset.description.ko,
    searchText: [preset.block_id, preset.preset_id, preset.category, BLOCK_CATEGORY_LABELS[preset.category], type, BLOCK_SEARCH_ALIASES[type], ...Object.values(preset.label), ...Object.values(preset.description)].join(' '),
    blockId: preset.block_id,
    blockVersion: preset.block_version,
    favorite: false,
    presetProps: preset.props,
    thumbnail: blockPackAssetUrl(BUILTIN_CORE_MANIFEST.pack_id, BUILTIN_CORE_MANIFEST.pack_version, preset.thumbnail),
    packId: BUILTIN_CORE_MANIFEST.pack_id,
    packLabel: blockPackLabel(BUILTIN_CORE_MANIFEST.pack_id),
  };
});

const BLOCK_GALLERY_ITEMS: ReadonlyArray<BlockGalleryItem> = Object.freeze([
  ...BUILTIN_DEFINITION_GALLERY_ITEMS,
  ...BUILTIN_PRESET_GALLERY_ITEMS,
]);

interface BlockCatalogContextValue {
  items: ReadonlyArray<BlockGalleryItem>;
  toggleFavorite: (catalogId: string, favorite: boolean) => Promise<void>;
}

const BlockCatalogContext = React.createContext<BlockCatalogContextValue>({
  items: BLOCK_GALLERY_ITEMS,
  toggleFavorite: async () => undefined,
});

function apiCatalogItemToGalleryItem(item: BlockCatalogItem, locale: string): BlockGalleryItem | null {
  if (item.kind === 'definition' && LEGACY_LIBRARY_DEFINITION_IDS.has(item.block_id)) return null;
  if (!Object.prototype.hasOwnProperty.call(pageBuilderPuckConfig.components, item.editor_component)
    && !isEditorComponentRegistered(item.editor_component)) {
    return null;
  }
  const staticItem = BLOCK_GALLERY_ITEMS.find((candidate) => candidate.catalogId === item.catalog_id);
  const safeLocale = locale === 'en' ? 'en' : 'ko';

  return {
    catalogId: item.catalog_id,
    kind: item.kind,
    type: item.editor_component as keyof EditorComponents,
    testId: staticItem?.testId ?? `page-builder-block-${item.catalog_id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    category: BLOCK_CATEGORY_LABELS[item.category] ?? item.category,
    title: item.label[safeLocale] ?? item.label.ko,
    description: item.description[safeLocale] ?? item.description.ko,
    searchText: [item.block_id, item.category, BLOCK_CATEGORY_LABELS[item.category], item.editor_component, BLOCK_SEARCH_ALIASES[item.editor_component], ...Object.values(item.label), ...Object.values(item.description)].join(' '),
    blockId: item.block_id,
    blockVersion: item.block_version,
    favorite: item.favorite,
    presetProps: item.preset_props,
    thumbnail: blockPackAssetUrl(item.pack_id, item.pack_version, item.thumbnail),
    packId: staticItem?.packId ?? item.pack_id,
    packLabel: staticItem?.packLabel ?? blockPackLabel(item.pack_id),
  };
}

function BlockGalleryThumbnail({ item }: { item: BlockGalleryItem }): React.ReactElement {
  const [failed, setFailed] = useState(false);
  if (item.thumbnail && !failed) {
    return <span className="g7pb-block-thumb g7pb-block-thumb--image" data-block-preview={item.type} aria-hidden="true">
      <img src={item.thumbnail} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>;
  }

  return <CatalogGalleryThumbnail type={item.type as keyof CatalogEditorComponents} />;
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
  const { items, toggleFavorite } = React.useContext(BlockCatalogContext);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [packId, setPackId] = useState('');
  const [kind, setKind] = useState<'all' | 'definition' | 'preset'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [renderLimit, setRenderLimit] = useState(BLOCK_GALLERY_WINDOW_SIZE);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const loadMoreRef = useRef<HTMLButtonElement>(null);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort((left, right) => {
    const leftIndex = BLOCK_CATEGORY_ORDER.indexOf(left as typeof BLOCK_CATEGORY_ORDER[number]);
    const rightIndex = BLOCK_CATEGORY_ORDER.indexOf(right as typeof BLOCK_CATEGORY_ORDER[number]);
    if (leftIndex === -1 || rightIndex === -1) return left.localeCompare(right, 'ko');
    return leftIndex - rightIndex;
  }), [items]);
  const packs = useMemo(() => Array.from(new Map(items.map((item) => [item.packId, item.packLabel])).entries()), [items]);
  const quickItems = useMemo(() => QUICK_ADD_COMPONENTS.map((component) => items.find((item) => item.kind === 'definition' && item.type === component)).filter((item): item is BlockGalleryItem => Boolean(item)), [items]);
  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko');
    return items.filter((item) => {
      if (favoritesOnly && !item.favorite) return false;
      if (category && item.category !== category) return false;
      if (packId && item.packId !== packId) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (!normalizedQuery) return true;
      return item.searchText.toLocaleLowerCase('ko').includes(normalizedQuery);
    });
  }, [category, favoritesOnly, items, kind, packId, query]);
  const renderedItems = visibleItems.slice(0, renderLimit);

  useEffect(() => {
    setRenderLimit(BLOCK_GALLERY_WINDOW_SIZE);
  }, [category, favoritesOnly, kind, open, packId, query]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!open || !target || renderLimit >= visibleItems.length || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setRenderLimit((current) => Math.min(current + BLOCK_GALLERY_WINDOW_SIZE, visibleItems.length));
      }
    }, { root: target.closest('.g7pb-block-gallery'), rootMargin: '240px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, renderLimit, visibleItems.length]);

  useEffect(() => {
    const openGallery = (): void => setOpen(true);
    window.addEventListener(OPEN_BLOCK_GALLERY_EVENT, openGallery);
    return () => window.removeEventListener(OPEN_BLOCK_GALLERY_EVENT, openGallery);
  }, []);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = globalThis.document?.body.style.overflow ?? '';
    if (globalThis.document) {
      globalThis.document.body.style.overflow = 'hidden';
    }
    firstItemRef.current?.focus({ preventScroll: true });

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

  const insert = (item: BlockGalleryItem): void => {
    const destinationIndex = selectedZone === 'root:default-zone' && selectedIndex !== null
      ? selectedIndex + 1
      : contentLength;
    const instanceId = idToUuid(`${item.catalogId}:${Date.now()}:${Math.random()}`);

    dispatch({
      type: 'insert',
      componentType: item.type,
      destinationIndex,
      destinationZone: 'root:default-zone',
      id: instanceId,
    });
    if (item.presetProps) {
      const presetBlock = canonicalBlockToPuck({
        instance_id: instanceId,
        type: item.blockId,
        block_version: item.blockVersion,
        props: item.presetProps,
        slots: {},
      });
      dispatch({
        type: 'replace',
        destinationIndex,
        destinationZone: 'root:default-zone',
        data: presetBlock,
      });
    }
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
        <Blocks size={16} aria-hidden="true" /><span>블록 추가</span>
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
                <span>선택하면 현재 블록 바로 뒤에 추가됩니다.</span>
              </div>
              <button type="button" className="g7pb-block-gallery__close" aria-label="블록 갤러리 닫기"
                onClick={() => setOpen(false)}><X size={20} aria-hidden="true" /></button>
            </header>
            <div className="g7pb-block-gallery__tabs" role="tablist" aria-label="블록 라이브러리 형식">
              {([['all', '전체'], ['definition', '블록 종류'], ['preset', '완성 섹션']] as const).map(([value, label]) => (
                <button type="button" role="tab" key={value} aria-selected={kind === value}
                  onClick={() => setKind(value)}>{label}<span>{value === 'all' ? items.length : items.filter((item) => item.kind === value).length}</span></button>
              ))}
            </div>
            <div className="g7pb-block-gallery__tools" aria-label="블록 찾기">
              <input
                type="search"
                value={query}
                placeholder="이름, 용도 또는 분류 검색"
                aria-label="블록 검색"
                onChange={(event) => setQuery(event.target.value)}
              />
              <select value={category} aria-label="블록 분류" onChange={(event) => setCategory(event.target.value)}>
                <option value="">전체 분류</option>
                {categories.map((itemCategory) => <option key={itemCategory} value={itemCategory}>{itemCategory}</option>)}
              </select>
              <select value={packId} aria-label="블록 팩" onChange={(event) => setPackId(event.target.value)}>
                <option value="">모든 출처</option>
                {packs.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)}>
                <Star size={15} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" /> 즐겨찾기
              </button>
            </div>
            {!query.trim() && !category && !packId && kind === 'all' && !favoritesOnly ? <section className="g7pb-block-gallery__quick" aria-labelledby="g7pb-quick-add-title">
              <div><small>QUICK ADD</small><h3 id="g7pb-quick-add-title">자주 쓰는 기본 블록</h3></div>
              <div>{quickItems.map((item) => <button key={item.catalogId} type="button" data-testid={`page-builder-quick-add-${String(item.type).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`} onClick={() => insert(item)}><Plus size={15} aria-hidden="true" />{item.title}</button>)}</div>
            </section> : null}
            <div className="g7pb-block-gallery__grid"
              data-total-items={visibleItems.length}
              data-rendered-items={renderedItems.length}>
              {renderedItems.map((item, index) => (
                <article key={item.catalogId} className="g7pb-block-gallery__item"
                  data-preview-density={blockPreviewDensity(item.type)}>
                  <button type="button" className="g7pb-block-gallery__add"
                    ref={index === 0 ? firstItemRef : undefined}
                    data-testid={item.testId} onClick={() => insert(item)}>
                    <BlockGalleryThumbnail item={item} />
                    <span className="g7pb-block-gallery__copy">
                      <small>{item.category} · {item.packLabel}{item.kind === 'preset' ? ' · 완성 섹션' : ''}</small>
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                      <em>이 블록 추가 →</em>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="g7pb-block-gallery__favorite"
                    aria-label={`${item.title} ${item.favorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}`}
                    aria-pressed={item.favorite}
                    onClick={() => void toggleFavorite(item.catalogId, !item.favorite)}
                  >
                    <Star size={18} fill={item.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                </article>
              ))}
              {visibleItems.length === 0 && <p className="g7pb-block-gallery__empty">조건에 맞는 블록이 없습니다.</p>}
              {renderedItems.length < visibleItems.length && (
                <button
                  ref={loadMoreRef}
                  type="button"
                  className="g7pb-block-gallery__load-more"
                  data-testid="page-builder-gallery-load-more"
                  onClick={() => setRenderLimit((current) => Math.min(current + BLOCK_GALLERY_WINDOW_SIZE, visibleItems.length))}
                >
                  더 보기 <span>{renderedItems.length} / {visibleItems.length}</span>
                </button>
              )}
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
  data,
  contentLength,
  selectedIndex,
  selectedZone,
  currentViewportWidth,
  viewportState,
  editingDisabled,
  viewportDisabled,
  onViewportChange,
}: {
  dispatch: (action: PuckAction) => void;
  data: PuckEditorData;
  contentLength: number;
  selectedIndex: number | null;
  selectedZone: string;
  currentViewportWidth: number | '100%';
  viewportState: {
    current: { width: number | '100%'; height: number | 'auto' };
    controlsVisible: boolean;
    options: Viewports;
  };
  editingDisabled: boolean;
  viewportDisabled: boolean;
  onViewportChange: (width: number | '100%') => void;
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
    onViewportChange(width);
  };

  const applyRecommendedMotions = (): void => {
    const motionPlan = recommendedMotionPlan(data.content.map((block) => block.type));

    dispatch({
      type: 'setData',
      data: {
        ...data,
        content: data.content.map((block, index) => ({
          ...block,
          props: {
            ...block.props,
            motion: motionPlan[index] ?? { ...DEFAULT_BLOCK_MOTION, preset: 'reveal' },
          },
        })),
      } as never,
      recordHistory: true,
    });
  };

  const clearMotions = (): void => {
    dispatch({
      type: 'setData',
      data: {
        ...data,
        content: data.content.map((block) => ({
          ...block,
          props: { ...block.props, motion: { ...DEFAULT_BLOCK_MOTION } },
        })),
      } as never,
      recordHistory: true,
    });
  };

  const selectPageDesign = (): void => {
    dispatch({
      type: 'setUi',
      ui: { itemSelector: null },
      recordHistory: false,
    });
  };

  const setColorMode = (colorMode: PageDesignProps['colorMode']): void => {
    dispatch({
      type: 'setData',
      data: { ...data, root: { ...data.root, props: { ...data.root.props, colorMode } } } as never,
      recordHistory: true,
    });
  };

  const viewportIcon = (width: number): React.ReactNode => {
    if (width === 360) return <Smartphone size={15} aria-hidden="true" />;
    if (width === 768) return <Tablet size={15} aria-hidden="true" />;
    return <Monitor size={15} aria-hidden="true" />;
  };

  return (
    <div className="g7pb-header-controls">
      <button type="button" className="g7pb-design-button" data-testid="page-builder-page-design"
        disabled={editingDisabled} onClick={selectPageDesign}>
        <Paintbrush size={16} aria-hidden="true" /><span>페이지 디자인</span>
      </button>
      <div className="g7pb-theme-switcher" role="group" aria-label="라이트·다크 테마 미리보기">
        <button type="button" aria-label="라이트 테마" aria-pressed={(data.root.props?.colorMode ?? 'light') === 'light'} disabled={editingDisabled} onClick={() => setColorMode('light')}><Sun size={15} aria-hidden="true" /></button>
        <button type="button" aria-label="다크 테마" aria-pressed={data.root.props?.colorMode === 'dark'} disabled={editingDisabled} onClick={() => setColorMode('dark')}><Moon size={15} aria-hidden="true" /></button>
        <button type="button" aria-label="기기 테마" aria-pressed={data.root.props?.colorMode === 'system'} disabled={editingDisabled} onClick={() => setColorMode('system')}><Monitor size={15} aria-hidden="true" /></button>
      </div>
      <div className="g7pb-motion-batch" role="group" aria-label="페이지 효과 일괄 설정">
        <button type="button" disabled={editingDisabled || contentLength === 0}
          data-testid="page-builder-auto-motion" onClick={applyRecommendedMotions}><Sparkles size={15} aria-hidden="true" /><span>추천 효과</span></button>
        <button type="button" disabled={editingDisabled || contentLength === 0}
          data-testid="page-builder-clear-motion" onClick={clearMotions}><Ban size={15} aria-hidden="true" /><span>효과 없음</span></button>
      </div>
      <div className="g7pb-viewport-switcher" role="group" aria-label="캔버스 기기 미리보기">
        {PAGE_BUILDER_VIEWPORTS.map((viewport) => (
          <button
            key={viewport.width}
            type="button"
            data-testid={`page-builder-viewport-${viewport.width}`}
            aria-pressed={currentViewportWidth === viewport.width}
            disabled={viewportDisabled}
            onClick={() => setViewport(viewport.width as number)}
          >
            {viewportIcon(viewport.width as number)}<span>{viewport.label}</span>
          </button>
        ))}
      </div>
      <StableAddBlockControls
        dispatch={dispatch}
        contentLength={contentLength}
        selectedIndex={selectedIndex}
        selectedZone={selectedZone}
        disabled={editingDisabled}
      />
    </div>
  );
}

function ConnectedHeaderControls({
  editingDisabled,
  onViewportChange,
  viewportDisabled,
}: {
  editingDisabled: boolean;
  onViewportChange: (width: number | '100%') => void;
  viewportDisabled: boolean;
}): React.ReactElement {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const contentLength = usePageBuilderPuck((state) => state.appState.data.content.length);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const viewportState = usePageBuilderPuck((state) => state.appState.ui.viewports);

  useEffect(() => {
    onViewportChange(viewportState.current.width);
  }, [onViewportChange, viewportState.current.width]);

  return (
    <StableHeaderControls
      dispatch={dispatch}
      data={data}
      contentLength={contentLength}
      selectedIndex={selectedIndex}
      selectedZone={selectedZone}
      currentViewportWidth={viewportState.current.width}
      viewportState={viewportState}
      editingDisabled={editingDisabled}
      viewportDisabled={viewportDisabled}
      onViewportChange={onViewportChange}
    />
  );
}

function ConnectedSectionPatternControls({
  disabled,
  resolveSection,
}: {
  disabled: boolean;
  resolveSection: (block: PuckEditorData['content'][number]) => PageBuilderBlock;
}): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const selectedSection = selectedZone === 'root:default-zone' && selectedIndex !== null
    && data.content[selectedIndex]?.type === 'LayoutSection'
    ? data.content[selectedIndex] : null;
  const [dialog, setDialog] = useState<'save' | 'library' | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('custom');
  const [patterns, setPatterns] = useState<SectionPatternResource[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPatterns = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      setPatterns((await api.listSectionPatterns()).items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '내 패턴을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [api]);

  const openLibrary = (): void => {
    setDialog('library');
    void loadPatterns();
  };
  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedSection) return;
    setBusy(true);
    setError(null);
    try {
      const pattern = await api.createSectionPattern({
        title: title.trim(),
        category,
        source_document_schema: 'g7-page-builder/v2',
        section: resolveSection(selectedSection),
      });
      setPatterns((current) => [pattern, ...current.filter((item) => item.pattern_id !== pattern.pattern_id)]);
      setTitle('');
      setDialog('library');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '선택한 구역을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };
  const insertPattern = (pattern: SectionPatternResource): void => {
    if (!pattern.compatible) return;
    const freshSection = cloneLayoutSubtree(pattern.section, () => (
      globalThis.crypto?.randomUUID?.() ?? idToUuid(`pattern:${pattern.pattern_id}:${Date.now()}:${Math.random()}`)
    ));
    const puckSection = canonicalBlockToPuck(freshSection);
    const destinationIndex = selectedZone === 'root:default-zone' && selectedIndex !== null
      ? selectedIndex + 1 : data.content.length;
    const content = [...data.content];
    content.splice(destinationIndex, 0, puckSection);
    dispatch({
      type: 'setData',
      data: { ...data, content } as never,
      recordHistory: true,
    });
    dispatch({
      type: 'setUi',
      ui: { itemSelector: { index: destinationIndex, zone: 'root:default-zone' } },
      recordHistory: false,
    });
    setDialog(null);
  };
  const deletePattern = async (patternId: string): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteSectionPattern(patternId);
      setPatterns((current) => current.filter((item) => item.pattern_id !== patternId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '내 패턴을 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" className="g7pb-button g7pb-button--quiet"
      data-testid="page-builder-save-section-pattern" disabled={disabled || !selectedSection}
      title={selectedSection ? '선택한 Section 전체를 저장합니다.' : '저장할 Section을 먼저 선택하세요.'}
      onClick={() => { setError(null); setDialog('save'); }}>선택 구역 저장</button>
    <button type="button" className="g7pb-button g7pb-button--quiet"
      data-testid="page-builder-section-patterns" disabled={disabled} onClick={openLibrary}>내 패턴</button>
    {dialog && createPortal(
      <div className="g7pb-dialog-backdrop" data-testid="page-builder-section-pattern-dialog">
        <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-pattern-heading">
          <p className="g7pb-kicker">{dialog === 'save' ? '선택한 Section' : '재사용 구역'}</p>
          <h2 id="g7pb-pattern-heading">{dialog === 'save' ? '내 패턴으로 저장' : '내 패턴'}</h2>
          {error && <p role="alert">{error}</p>}
          {dialog === 'save' ? <form onSubmit={(event) => void save(event)}>
            <label>패턴 이름<input value={title} required maxLength={120} autoFocus
              data-testid="page-builder-pattern-title" onChange={(event) => setTitle(event.currentTarget.value)} /></label>
            <label>분류<select value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
              <option value="custom">사용자 구역</option><option value="hero">첫 화면</option>
              <option value="content">본문</option><option value="conversion">전환</option>
            </select></label>
            <p>HTML이 아니라 현재 canonical Section subtree를 저장합니다. 이미 삽입한 구역과 이후 수정은 서로 동기화되지 않습니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setDialog(null)}>취소</button>
              <button type="submit" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-pattern-save-confirm" disabled={busy}>{busy ? '저장 중' : '저장'}</button>
            </div>
          </form> : <>
            {busy && patterns.length === 0 ? <p role="status">내 패턴을 불러오는 중입니다.</p> : null}
            {!busy && patterns.length === 0 ? <p>저장한 구역이 없습니다. Section을 선택한 뒤 `선택 구역 저장`을 사용하세요.</p> : null}
            {patterns.map((pattern) => <article key={pattern.pattern_id} data-testid="page-builder-pattern-item">
              <div><strong>{pattern.title}</strong><span>{pattern.category} · {pattern.preview.block_count}개 블록</span></div>
              {!pattern.compatible ? <p role="status">{pattern.compatibility_error}</p> : null}
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet" disabled={busy}
                  onClick={() => void deletePattern(pattern.pattern_id)}>삭제</button>
                <button type="button" className="g7pb-button g7pb-button--primary" disabled={busy || !pattern.compatible}
                  data-testid="page-builder-pattern-insert" onClick={() => insertPattern(pattern)}>독립 복사본 삽입</button>
              </div>
            </article>)}
            <div className="g7pb-dialog__actions"><button type="button" className="g7pb-button g7pb-button--quiet"
              onClick={() => setDialog(null)}>닫기</button></div>
          </>}
        </section>
      </div>,
      globalThis.document.body,
    )}
  </>;
}

function ConnectedContextPanel({ disabled }: { disabled: boolean }): React.ReactElement | null {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const canvasUi = React.useContext(CanvasEditingUiContext);
  const selectionIndex = canvasUi?.selection
    ? data.content.findIndex((block) => idToUuid(asString(block.props.id)) === canvasUi.selection?.blockId)
    : -1;
  const blockIndex = selectionIndex >= 0 ? selectionIndex : selectedZone === 'root:default-zone' ? selectedIndex : null;
  const selectedBlock = blockIndex !== null ? data.content[blockIndex] : null;
  if (!canvasUi?.textToolsOpen || canvasUi.rangeEditingActive || canvasUi.mediaDialogOpen || canvasUi.routeDialogOpen || !selectedBlock || blockIndex === null) return null;
  const currentSurface = selectedBlock.props.surface === 'soft' || selectedBlock.props.surface === 'contrast'
    ? selectedBlock.props.surface : 'default';
  const currentSpacing = selectedBlock.props.spacing === 'compact' || selectedBlock.props.spacing === 'spacious'
    ? selectedBlock.props.spacing : 'normal';
  const selectedInternalProps = selectedBlock.props as Record<string, unknown>;
  const currentVisibility = selectedInternalProps.__g7pbVisibilityAudience === 'guest'
    || selectedInternalProps.__g7pbVisibilityAudience === 'member'
    ? selectedInternalProps.__g7pbVisibilityAudience
    : 'all';
  const fieldPath = canvasUi.selection?.fieldPath ?? null;
  const isTextElement = fieldPath !== null && (canvasUi.selection?.role === 'text' || canvasUi.selection?.role === 'action');
  const elementStyles = normalizeElementAppearanceMap(selectedBlock.props.elementStyles);
  const currentElement = normalizeElementAppearance(fieldPath ? elementStyles[fieldPath] : undefined);
  const currentFontSize = currentElement.fontSizeRem === undefined
    ? currentElement.size ? 'legacy' : 'auto'
    : String(currentElement.fontSizeRem);
  const routeFieldPath = fieldPath ? resolveRouteFieldPath(selectedBlock.type, fieldPath) : null;
  const update = (patch: Record<string, unknown>): void => {
    dispatch({
      type: 'replace', destinationIndex: blockIndex, destinationZone: 'root:default-zone',
      data: { ...selectedBlock, props: { ...selectedBlock.props, ...patch } } as never,
      ui: { itemSelector: { index: blockIndex, zone: 'root:default-zone' } }, recordHistory: true,
    });
  };

  const updateElement = (patch: Partial<ElementAppearance>): void => {
    if (!fieldPath) return;
    const nextStyle = normalizeElementAppearance({ ...currentElement, ...patch });
    const nextStyles = { ...elementStyles };
    if (Object.keys(nextStyle).length === 0) delete nextStyles[fieldPath];
    else nextStyles[fieldPath] = nextStyle;
    update({ elementStyles: nextStyles });
  };
  const resetElement = (): void => {
    if (!fieldPath) return;
    const nextStyles = { ...elementStyles };
    delete nextStyles[fieldPath];
    update({ elementStyles: nextStyles });
  };
  const anchor = canvasUi.selection?.anchor;
  const balloonPlacement = isTextElement && anchor && anchor.top >= 360 ? 'above' : 'below';
  const balloonStyle = isTextElement && anchor ? {
    '--g7pb-balloon-left': `${Math.max(
      Math.min(284, globalThis.innerWidth / 2),
      Math.min(anchor.left + anchor.width / 2, globalThis.innerWidth - Math.min(284, globalThis.innerWidth / 2)),
    )}px`,
    '--g7pb-balloon-top': `${balloonPlacement === 'above'
      ? anchor.top - 12
      : Math.max(12, Math.min(anchor.bottom + 12, globalThis.innerHeight - 156))}px`,
  } as React.CSSProperties : undefined;

  return createPortal(
    <section className={`g7pb-context-panel${isTextElement ? ` g7pb-element-balloon g7pb-element-balloon--${balloonPlacement}` : ''}`} style={balloonStyle}
      role="dialog" aria-label={isTextElement ? '선택 요소 스타일' : '선택 블록 스타일'} data-testid="page-builder-context-panel">
      <header><div><strong>{canvasUi.selection?.label ?? '블록 전체'} 스타일</strong><span>{isTextElement ? '요소 전체 · 부분 선택은 글자 위 툴바' : '블록 배경·여백·표시 대상을 조정합니다.'}</span></div><button type="button" aria-label="스타일 도구 닫기" onClick={() => canvasUi.setTextToolsOpen(false)}><X size={17} aria-hidden="true" /></button></header>
      {isTextElement ? <>
        <div className="g7pb-element-balloon__controls">
          <label><span>글꼴</span><select disabled={disabled} value={currentElement.font ?? 'inherit'}
            data-testid="page-builder-element-font"
            onChange={(event) => updateElement({ font: event.currentTarget.value as ElementAppearance['font'] })}>
            <option value="inherit">기본</option><option value="modern">모던</option><option value="serif">명조</option><option value="mono">고정폭</option>
          </select></label>
          <label><span>글자 크기</span><select disabled={disabled} value={currentFontSize}
            data-testid="page-builder-font-size-rem"
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === 'auto') updateElement({ fontSizeRem: undefined, size: undefined });
              else if (value !== 'legacy') updateElement({ fontSizeRem: Number(value), size: undefined });
            }}>
            <option value="auto">자동 · 반응형</option>
            {currentElement.size ? <option value="legacy">기존 상대 크기</option> : null}
            {FONT_SIZE_REM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>
          <label><span>굵기</span><select disabled={disabled} value={currentElement.weight ?? 'regular'}
            data-testid="page-builder-element-weight"
            onChange={(event) => updateElement({ weight: event.currentTarget.value as ElementAppearance['weight'] })}>
            <option value="regular">보통</option><option value="semibold">굵게</option><option value="bold">매우 굵게</option>
          </select></label>
          <div className="g7pb-element-balloon__align" role="group" aria-label="요소 전체 글자 정렬">
          <button type="button" disabled={disabled} aria-label="왼쪽 정렬" aria-pressed={(currentElement.align ?? 'left') === 'left'} onClick={() => updateElement({ align: 'left' })}><AlignLeft size={16} data-testid="page-builder-text-align-left" /></button>
          <button type="button" disabled={disabled} aria-label="가운데 정렬" aria-pressed={currentElement.align === 'center'} onClick={() => updateElement({ align: 'center' })}><AlignCenter size={16} data-testid="page-builder-text-align-center" /></button>
          <button type="button" disabled={disabled} aria-label="오른쪽 정렬" aria-pressed={currentElement.align === 'right'} onClick={() => updateElement({ align: 'right' })}><AlignRight size={16} data-testid="page-builder-text-align-right" /></button>
          </div>
          <label><span>색상</span><select disabled={disabled} value={currentElement.tone ?? 'default'}
            data-testid="page-builder-element-tone"
            onChange={(event) => updateElement({ tone: event.currentTarget.value as ElementAppearance['tone'] })}>
            <option value="default">기본</option><option value="muted">보조</option><option value="accent">강조</option><option value="contrast">반전</option>
            <option value="custom1">사용자 1</option><option value="custom2">사용자 2</option><option value="custom3">사용자 3</option><option value="custom4">사용자 4</option>
          </select></label>
        </div>
        <div className="g7pb-element-balloon__footer">
          {routeFieldPath ? <button type="button" disabled={disabled} data-testid="page-builder-element-route-open"
            onClick={() => canvasUi.setRouteDialogOpen(true)}><Link2 size={15} /> 연결 설정</button> : null}
          <button type="button" disabled={disabled || !elementStyles[fieldPath]} onClick={resetElement}>스타일 초기화</button>
        </div>
      </> : <>
        <div className="g7pb-context-panel__row"><span>배경</span><div role="group" aria-label="블록 배경">
          {([['default', '기본'], ['soft', '부드럽게'], ['contrast', '강조']] as const).map(([surface, text]) => <button type="button" key={surface} disabled={disabled} aria-pressed={currentSurface === surface} onClick={() => update({ surface })}>{text}</button>)}
        </div></div>
        <div className="g7pb-context-panel__row"><span>세로 여백</span><div role="group" aria-label="블록 세로 여백">
          {([['compact', '좁게'], ['normal', '기본'], ['spacious', '넓게']] as const).map(([spacing, text]) => <button type="button" key={spacing} disabled={disabled} aria-pressed={currentSpacing === spacing} onClick={() => update({ spacing })}>{text}</button>)}
        </div></div>
        <div className="g7pb-context-panel__row"><span>표시 대상</span><div role="group" aria-label="블록 표시 대상">
          {([['all', '모두'], ['guest', '로그아웃'], ['member', '로그인']] as const).map(([audience, text]) => <button type="button" key={audience} disabled={disabled}
            aria-pressed={currentVisibility === audience} onClick={() => update({ __g7pbVisibilityAudience: audience })}
            data-testid={`page-builder-block-visibility-${audience}`}>{text}</button>)}
        </div></div>
      </>}
    </section>,
    globalThis.document.body,
  );
}

function ConnectedCanvasDialogs({ disabled }: { disabled: boolean }): React.ReactElement | null {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const canvasUi = React.useContext(CanvasEditingUiContext);
  if (!canvasUi || disabled || canvasUi.rangeEditingActive) return null;

  const selectionIndex = canvasUi.selection
    ? data.content.findIndex((block) => idToUuid(asString(block.props.id)) === canvasUi.selection?.blockId)
    : -1;
  const blockIndex = selectionIndex >= 0 ? selectionIndex : selectedZone === 'root:default-zone' ? selectedIndex : null;
  const selectedBlock = blockIndex !== null ? data.content[blockIndex] : null;
  if (!selectedBlock || blockIndex === null) return null;

  const defaultRouteFieldPath = selectedBlock.type === 'Hero' || selectedBlock.type === 'HeroSplit' || selectedBlock.type === 'Cta'
    ? 'primaryUrl' : selectedBlock.type === 'Contact' ? 'ctaUrl' : null;
  const routeFieldPath = canvasUi.selection?.fieldPath
    ? resolveRouteFieldPath(selectedBlock.type, canvasUi.selection.fieldPath)
    : defaultRouteFieldPath;
  const mediaFieldPath = canvasUi.selection
    ? resolveMediaFieldPath(selectedBlock.type, canvasUi.selection)
    : selectedBlock.type === 'Hero' || selectedBlock.type === 'HeroSplit' ? 'imageSrc' : null;
  const updateSelectedPath = (path: string, value: unknown): void => {
    dispatch({
      type: 'replace', destinationIndex: blockIndex, destinationZone: 'root:default-zone',
      data: { ...selectedBlock, props: setValueAtPath(selectedBlock.props, path, value) } as never,
      recordHistory: true,
    });
  };

  return <>
    {canvasUi.mediaDialogOpen && mediaFieldPath ? createPortal(
      <CanvasMediaPicker value={String(valueAtPath(selectedBlock.props, mediaFieldPath) ?? '')}
        onChange={(value) => { updateSelectedPath(mediaFieldPath, value); canvasUi.setMediaDialogOpen(false); }}
        onDismiss={() => canvasUi.setMediaDialogOpen(false)} />,
      globalThis.document.body,
    ) : null}
    {canvasUi.routeDialogOpen && routeFieldPath ? createPortal(
      <CanvasRoutePicker value={String(valueAtPath(selectedBlock.props, routeFieldPath) ?? '')}
        onChange={(value) => { updateSelectedPath(routeFieldPath, value); canvasUi.setRouteDialogOpen(false); }}
        onDismiss={() => canvasUi.setRouteDialogOpen(false)} />,
      globalThis.document.body,
    ) : null}
  </>;
}

const NARROW_CANVAS_MAX_WIDTH = 900;
const SELECTED_ACTION_BAR_SAFE_INSET_PX = 8;

function useSelectedActionBarSafeZone(enabled: boolean): React.RefObject<HTMLDivElement | null> {
  const actionBarRef = useRef<HTMLDivElement>(null);
  const canvasUi = React.useContext(CanvasEditingUiContext);
  const rangeEditingActive = canvasUi?.rangeEditingActive ?? false;
  const rangeAnchor = canvasUi?.rangeEditingActive ? canvasUi.rangeAnchor : null;

  React.useLayoutEffect(() => {
    const actionBar = actionBarRef.current;
    if (!actionBar) return undefined;

    const clearPosition = (): void => {
      actionBar.style.removeProperty('--g7pb-selected-actionbar-translate-x');
      actionBar.style.removeProperty('--g7pb-selected-actionbar-translate-y');
      actionBar.style.removeProperty('--g7pb-selected-actionbar-max-width');
      actionBar.removeAttribute('data-g7pb-safe-zone-ready');
      actionBar.removeAttribute('data-g7pb-safe-zone-placement');
      clearVisibleClipContract(actionBar);
    };
    if (!enabled) {
      clearPosition();
      return undefined;
    }

    const ownerDocument = actionBar.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    const selectedOverlay = actionBar.closest<HTMLElement>('[data-puck-overlay]');
    if (!ownerWindow || !selectedOverlay) {
      clearPosition();
      return undefined;
    }

    let animationFrame = 0;
    const styleNumber = (name: string): number => {
      const value = Number.parseFloat(actionBar.style.getPropertyValue(name));
      return Number.isFinite(value) ? value : 0;
    };
    const writeStyle = (name: string, value: string): void => {
      if (actionBar.style.getPropertyValue(name) !== value) actionBar.style.setProperty(name, value);
    };
    const syncPosition = (): void => {
      animationFrame = 0;

      const visibleClip = visibleOwnerViewport(actionBar);
      if (!visibleClip) {
        actionBar.removeAttribute('data-g7pb-safe-zone-ready');
        clearVisibleClipContract(actionBar);
        return;
      }
      exposeVisibleClipContract(actionBar, visibleClip);
      const initialRect = actionBar.getBoundingClientRect();
      const initialScale = renderedElementScale(actionBar, initialRect);
      const renderedMaxWidth = quantizeOverlayPixel(
        Math.max(0, visibleClip.width - SELECTED_ACTION_BAR_SAFE_INSET_PX * 2),
        ownerWindow.devicePixelRatio,
      );
      writeStyle(
        '--g7pb-selected-actionbar-max-width',
        `${quantizeOverlayPixel(renderedMaxWidth / initialScale.x, ownerWindow.devicePixelRatio)}px`,
      );

      const actionBarRect = actionBar.getBoundingClientRect();
      const selectedRect = rangeEditingActive
        ? richTextRangeAnchorFromSelection(ownerDocument) ?? rangeAnchor ?? selectedOverlay.getBoundingClientRect()
        : selectedOverlay.getBoundingClientRect();
      const renderedScale = renderedElementScale(actionBar, actionBarRect);
      const placement = placeEditorOverlay({
        anchorRect: selectedRect,
        overlaySize: actionBarRect,
        visibleClip,
        avoidRects: currentInteractionRects(actionBar),
        gap: SELECTED_ACTION_BAR_SAFE_INSET_PX,
        inset: SELECTED_ACTION_BAR_SAFE_INSET_PX,
      });
      const translation = inverseScaledTranslation({
        currentRect: actionBarRect,
        target: placement,
        renderedScale,
      });
      const translatedX = quantizeOverlayPixel(
        styleNumber('--g7pb-selected-actionbar-translate-x') + translation.x,
        ownerWindow.devicePixelRatio,
      );
      const translatedY = quantizeOverlayPixel(
        styleNumber('--g7pb-selected-actionbar-translate-y') + translation.y,
        ownerWindow.devicePixelRatio,
      );
      writeStyle('--g7pb-selected-actionbar-translate-x', `${translatedX}px`);
      writeStyle('--g7pb-selected-actionbar-translate-y', `${translatedY}px`);
      if (actionBar.getAttribute('data-g7pb-safe-zone-placement') !== placement.placement) {
        actionBar.setAttribute('data-g7pb-safe-zone-placement', placement.placement);
      }
      if (actionBar.getAttribute('data-g7pb-safe-zone-ready') !== 'true') {
        actionBar.setAttribute('data-g7pb-safe-zone-ready', 'true');
      }
    };
    const schedulePosition = (): void => {
      if (animationFrame !== 0) return;
      animationFrame = ownerWindow.requestAnimationFrame(syncPosition);
    };

    const resizeObserver = new ownerWindow.ResizeObserver(schedulePosition);
    resizeObserver.observe(actionBar);
    resizeObserver.observe(selectedOverlay);
    const positionObserver = new ownerWindow.MutationObserver(schedulePosition);
    positionObserver.observe(selectedOverlay, { attributes: true, attributeFilter: ['style'] });
    positionObserver.observe(actionBar, { childList: true, characterData: true, subtree: true });
    if (actionBar.parentElement) {
      positionObserver.observe(actionBar.parentElement, { attributes: true, attributeFilter: ['style'] });
    }
    ownerDocument.addEventListener('scroll', schedulePosition, true);
    ownerDocument.addEventListener('selectionchange', schedulePosition);
    ownerWindow.addEventListener('resize', schedulePosition);
    const hostFrame = ownerWindow.frameElement as HTMLElement | null;
    const hostDocument = hostFrame?.ownerDocument ?? null;
    const hostWindow = hostDocument?.defaultView ?? null;
    const hostResizeObserver = hostWindow && hostFrame ? new hostWindow.ResizeObserver(schedulePosition) : null;
    if (hostResizeObserver && hostFrame) {
      hostResizeObserver.observe(hostFrame);
      for (let ancestor = hostFrame.parentElement; ancestor; ancestor = ancestor.parentElement) {
        hostResizeObserver.observe(ancestor);
      }
    }
    hostDocument?.addEventListener('scroll', schedulePosition, true);
    hostWindow?.addEventListener('resize', schedulePosition);
    syncPosition();

    return () => {
      if (animationFrame !== 0) ownerWindow.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      hostResizeObserver?.disconnect();
      positionObserver.disconnect();
      ownerDocument.removeEventListener('scroll', schedulePosition, true);
      ownerDocument.removeEventListener('selectionchange', schedulePosition);
      ownerWindow.removeEventListener('resize', schedulePosition);
      hostDocument?.removeEventListener('scroll', schedulePosition, true);
      hostWindow?.removeEventListener('resize', schedulePosition);
      clearPosition();
    };
  }, [enabled, rangeAnchor, rangeEditingActive]);

  return actionBarRef;
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
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const contentLength = usePageBuilderPuck((state) => state.appState.data.content.length);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const currentViewportWidth = usePageBuilderPuck((state) => state.appState.ui.viewports.current.width);
  const narrowCanvas = typeof currentViewportWidth === 'number' && currentViewportWidth <= NARROW_CANVAS_MAX_WIDTH;
  const actionBarRef = useSelectedActionBarSafeZone(true);
  const canvasUi = React.useContext(CanvasEditingUiContext);
  const selectedBlock = selectedZone === 'root:default-zone' && selectedIndex !== null
    ? data.content[selectedIndex]
    : null;
  if (!canvasUi) throw new Error('Canvas editing UI provider is unavailable.');
  const {
    selection: elementSelection,
    rangeEditingActive,
    rangeAnchor,
    setSelection: setElementSelection,
    setMediaDialogOpen,
    setRouteDialogOpen,
    textToolsOpen,
    setTextToolsOpen,
  } = canvasUi;

  const defaultRouteFieldPath = selectedBlock?.type === 'Hero' || selectedBlock?.type === 'HeroSplit' || selectedBlock?.type === 'Cta'
    ? 'primaryUrl' : selectedBlock?.type === 'Contact' ? 'ctaUrl' : null;
  const routeFieldPath = selectedBlock && elementSelection?.fieldPath
    ? resolveRouteFieldPath(selectedBlock.type, elementSelection.fieldPath)
    : defaultRouteFieldPath;
  const mediaFieldPath = selectedBlock && elementSelection
    ? resolveMediaFieldPath(selectedBlock.type, elementSelection)
    : selectedBlock?.type === 'Hero' || selectedBlock?.type === 'HeroSplit' ? 'imageSrc' : null;
  const collection = elementSelection?.collection ?? null;
  const itemIndex = elementSelection?.itemIndex ?? null;
  const selectedProps = selectedBlock?.props as Record<string, unknown> | undefined;
  const selectedCollection = selectedProps && collection && Array.isArray(selectedProps[collection])
    ? selectedProps[collection] as unknown[]
    : null;
  const limits = selectedBlock && collection ? collectionLimit(selectedBlock.type, collection) : null;

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

  const updateSelectedProps = (nextProps: Record<string, unknown>): void => {
    if (selectedIndex === null || !selectedBlock) return;
    dispatch({
      type: 'replace',
      destinationIndex: selectedIndex,
      destinationZone: selectedZone,
      data: { ...selectedBlock, props: nextProps } as never,
      ui: { itemSelector: { index: selectedIndex, zone: selectedZone } },
      recordHistory: true,
    });
  };

  const updateSelectedPath = (path: string, value: unknown): void => {
    if (!selectedBlock) return;
    updateSelectedProps(setValueAtPath(selectedBlock.props, path, value));
  };

  const clearDirectMedia = (): void => {
    if (!selectedBlock || !mediaFieldPath) return;
    updateSelectedPath(mediaFieldPath, '');
  };

  const updateCollection = (operation: 'up' | 'down' | 'duplicate' | 'delete'): void => {
    if (!selectedBlock || !collection || itemIndex === null || !selectedCollection || !limits) return;
    const next = structuredClone(selectedCollection);
    let nextIndex = itemIndex;
    if (operation === 'up' && itemIndex > 0) {
      [next[itemIndex - 1], next[itemIndex]] = [next[itemIndex], next[itemIndex - 1]];
      nextIndex = itemIndex - 1;
    } else if (operation === 'down' && itemIndex < next.length - 1) {
      [next[itemIndex + 1], next[itemIndex]] = [next[itemIndex], next[itemIndex + 1]];
      nextIndex = itemIndex + 1;
    } else if (operation === 'duplicate' && next.length < limits.max) {
      next.splice(itemIndex + 1, 0, structuredClone(next[itemIndex]));
      nextIndex = itemIndex + 1;
    } else if (operation === 'delete' && next.length > limits.min) {
      next.splice(itemIndex, 1);
      nextIndex = Math.min(itemIndex, next.length - 1);
    } else {
      return;
    }
    const nextElementStyles = remapCollectionElementAppearanceMap(
      selectedBlock.props.elementStyles,
      collection,
      operation,
      itemIndex,
    );
    const nextProps: Record<string, unknown> = { ...selectedBlock.props, [collection]: next };
    if (Object.keys(nextElementStyles).length > 0) nextProps.elementStyles = nextElementStyles;
    else delete nextProps.elementStyles;
    updateSelectedProps(nextProps);
    const fieldPath = elementSelection?.fieldPath?.replace(`${collection}.${itemIndex}.`, `${collection}.${nextIndex}.`) ?? null;
    setElementSelection((current) => current ? { ...current, fieldPath, itemIndex: nextIndex,
      label: current.label.replace(`${itemIndex + 1}번 항목`, `${nextIndex + 1}번 항목`) } : current);
  };

  const roleLabel = elementSelection?.role === 'media' ? '이미지'
    : elementSelection?.role === 'action' ? '버튼·링크'
      : elementSelection?.role === 'text' ? '텍스트' : '블록';
  const elementStyleTarget = Boolean(elementSelection?.fieldPath)
    && (elementSelection?.role === 'text' || elementSelection?.role === 'action');
  const styleActionLabel = elementStyleTarget
    ? `${elementSelection?.label ?? '선택 요소'} 요소 전체 스타일`
    : '블록 설정';
  const puckActions = rangeEditingActive ? React.Children.toArray(children)[0] : children;
  return (
    <div
      ref={actionBarRef}
      className="g7pb-selected-block-actionbar"
      data-g7pb-selected-block-actionbar="true"
      data-g7pb-canvas-layout={narrowCanvas ? 'narrow' : 'wide'}
      data-g7pb-range-editing-active={rangeEditingActive ? 'true' : 'false'}
      data-g7pb-range-anchor={rangeEditingActive && rangeAnchor ? 'true' : 'false'}
    >
      <ActionBar>
        {!rangeEditingActive && <ActionBar.Group>
          {parentAction}
          {label && <ActionBar.Label label={label} />}
          {selectedBlock && <ActionBar.Label label={`${elementSelection?.label ?? '블록 전체'} · ${roleLabel}`} />}
        </ActionBar.Group>}
        <ActionBar.Group>
          {!rangeEditingActive && mediaFieldPath && (
            <>
              <ActionBar.Action label="선택 이미지 변경" disabled={disabled} onClick={() => setMediaDialogOpen(true)}>
                <ImagePlus size={16} data-testid="page-builder-canvas-media-open" aria-hidden="true" />
              </ActionBar.Action>
              <ActionBar.Action label="선택 이미지 비우기" disabled={disabled || !selectedBlock || !valueAtPath(selectedBlock.props, mediaFieldPath)}
                onClick={clearDirectMedia}>
                <ImageOff size={16} data-testid="page-builder-canvas-media-clear" aria-hidden="true" />
              </ActionBar.Action>
            </>
          )}
          {!rangeEditingActive && routeFieldPath ? <ActionBar.Action label="선택 버튼 연결 편집" disabled={disabled} onClick={() => setRouteDialogOpen(true)}>
            <Link2 size={16} data-testid="page-builder-canvas-route-open" aria-hidden="true" />
          </ActionBar.Action> : null}
          {!rangeEditingActive && selectedBlock ? <ActionBar.Action
            label={styleActionLabel}
            aria-label={styleActionLabel}
            disabled={disabled} onClick={() => setTextToolsOpen((open) => !open)}>
            {elementStyleTarget
              ? <Paintbrush size={16} data-testid="page-builder-element-style-open" aria-hidden="true" />
              : <Settings2 size={16} data-testid="page-builder-block-style-open" aria-hidden="true" />}
          </ActionBar.Action> : null}
          {!rangeEditingActive && selectedCollection && itemIndex !== null && limits ? <>
            <ActionBar.Action label="선택 항목 위로" disabled={disabled || itemIndex === 0} onClick={() => updateCollection('up')}><ArrowUp size={16} data-testid="page-builder-item-move-up" aria-hidden="true" /></ActionBar.Action>
            <ActionBar.Action label="선택 항목 아래로" disabled={disabled || itemIndex >= selectedCollection.length - 1} onClick={() => updateCollection('down')}><ArrowDown size={16} data-testid="page-builder-item-move-down" aria-hidden="true" /></ActionBar.Action>
            <ActionBar.Action label="선택 항목 복제" disabled={disabled || selectedCollection.length >= limits.max} onClick={() => updateCollection('duplicate')}><Copy size={16} data-testid="page-builder-item-duplicate" aria-hidden="true" /></ActionBar.Action>
            <ActionBar.Action label={`선택 항목 삭제${selectedCollection.length <= limits.min ? ` (최소 ${limits.min}개)` : ''}`} disabled={disabled || selectedCollection.length <= limits.min} onClick={() => updateCollection('delete')}><Trash2 size={16} data-testid="page-builder-item-delete" aria-hidden="true" /></ActionBar.Action>
          </> : null}
          {!rangeEditingActive && <ActionBar.Action
            label="블록 위로 이동"
            disabled={disabled || selectedIndex === null || selectedIndex === 0}
            onClick={() => move((selectedIndex ?? 0) - 1)}
          >
            <ArrowUp size={16} data-testid="page-builder-block-move-up" aria-hidden="true" />
          </ActionBar.Action>}
          {!rangeEditingActive && <ActionBar.Action
            label="블록 아래로 이동"
            disabled={disabled || selectedIndex === null || selectedIndex >= contentLength - 1}
            onClick={() => move((selectedIndex ?? -1) + 1)}
          >
            <ArrowDown size={16} data-testid="page-builder-block-move-down" aria-hidden="true" />
          </ActionBar.Action>}
          {puckActions}
        </ActionBar.Group>
      </ActionBar>
    </div>
  );
}

function PuckHeaderLayer({ children }: { children: React.ReactNode }): React.ReactElement {
  const policy = React.useContext(EditorViewportPolicyContext);
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const leftSideBarVisible = usePageBuilderPuck((state) => state.appState.ui.leftSideBarVisible);
  const rightSideBarVisible = usePageBuilderPuck((state) => state.appState.ui.rightSideBarVisible);
  const previousHostSupported = useRef(policy.hostSupported);
  const pcPanels = useRef({ leftSideBarVisible: true, rightSideBarVisible: true });

  useEffect(() => {
    if (previousHostSupported.current === policy.hostSupported) return;
    previousHostSupported.current = policy.hostSupported;
    if (!policy.hostSupported) pcPanels.current = { leftSideBarVisible, rightSideBarVisible };
    dispatch({
      type: 'setUi',
      ui: policy.hostSupported ? pcPanels.current : { leftSideBarVisible: false, rightSideBarVisible: false },
      recordHistory: false,
    });
  }, [dispatch, leftSideBarVisible, policy.hostSupported, rightSideBarVisible]);

  return <div className="g7pb-puck-header-layer">
    <div
      className="g7pb-editor-mode-notice"
      data-testid="page-builder-editor-mode-notice"
      data-mode={policy.mode}
      role="status"
    >
      <strong>{PC_EDITOR_POLICY_NOTICE}</strong>
      <span>{policy.status}</span>
    </div>
    {children}
  </div>;
}

function PuckDrawerLibrary({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="g7pb-puck-drawer-library" data-testid="page-builder-block-library">
      <header className="g7pb-puck-drawer-library__header">
        <strong>블록 라이브러리</strong>
        <p>실제 화면을 확인하고 블록을 선택하세요.</p>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_BLOCK_GALLERY_EVENT))}>완성 섹션과 모든 출처 보기</button>
      </header>
      {children}
    </div>
  );
}

function PuckDrawerItem({ children, name }: { children: React.ReactNode; name: string }): React.ReactElement {
  const { items } = React.useContext(BlockCatalogContext);
  const item = items.find((candidate) => candidate.kind === 'definition' && candidate.type === name)
    ?? BLOCK_GALLERY_ITEMS.find((candidate) => candidate.type === name);

  if (!item) {
    return <>{children}</>;
  }

  return (
    <div className="g7pb-puck-drawer-card" data-library-block={item.type}
      data-preview-density={blockPreviewDensity(item.type)}>
      <div className="g7pb-puck-drawer-card__preview">
        <BlockGalleryThumbnail item={item} />
      </div>
      <div className="g7pb-puck-drawer-card__copy">
        <small>{item.category}</small>
        <strong>{item.title}</strong>
        <span>{item.description}</span>
        {item.favorite ? <em>★ 즐겨찾기</em> : null}
      </div>
    </div>
  );
}

export function PuckEditorAdapter({
  document,
  revisionKey,
  disabled = false,
  iframeEnabled = true,
  onDirty,
  onChange,
  onPublish,
}: PuckEditorAdapterProps): React.ReactElement {
  const initialHostWidth = useMemo(() => (
    typeof window === 'undefined' ? PC_EDITOR_MIN_HOST_WIDTH : window.innerWidth
  ), []);
  const [hostWidth, setHostWidth] = useState(initialHostWidth);
  const [canvasViewportWidth, setCanvasViewportWidth] = useState<number | '100%'>(() => (
    initialEditorCanvasWidth(initialHostWidth)
  ));
  const viewportPolicy = useMemo(() => resolveEditorViewportPolicy({
    canvasWidth: canvasViewportWidth,
    disabled,
    hostWidth,
  }), [canvasViewportWidth, disabled, hostWidth]);
  const editingDisabled = !viewportPolicy.canEdit;
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [structureEditingEnabled, setStructureEditingEnabled] = useState(
    document.schema_version === 'g7-page-builder/v2',
  );
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structureActivationError, setStructureActivationError] = useState<string | null>(null);
  const runtimePuckConfig = useMemo(() => {
    const baseConfig = {
      ...pageBuilderPuckConfig,
      categories: {
        ...pageBuilderPuckConfig.categories,
        layout: {
          ...pageBuilderPuckConfig.categories?.layout,
          visible: structureEditingEnabled,
        },
      },
      components: {
        ...pageBuilderPuckConfig.components,
        ...externalEditorComponents(),
      },
    } as Config<EditorComponents, PageDesignProps>;
    if (viewportPolicy.canEdit) return baseConfig;
    const components = Object.fromEntries(Object.entries(baseConfig.components).map(([type, candidate]) => {
      const component = candidate as typeof candidate & { fields?: Record<string, EditorFieldContract> };
      if (!component.fields) return [type, component];
      return [type, { ...component, fields: applyEditorContentPolicy(component.fields, false) }];
    })) as Config<EditorComponents, PageDesignProps>['components'];
    return { ...baseConfig, components };
  }, [structureEditingEnabled, viewportPolicy.canEdit]);
  const initialSession = useMemo(() => canonicalToPuck(document), [document.document_id, revisionKey]);
  const contextRef = useRef(initialSession.context);
  const [data, setData] = useState(initialSession.data);
  const latestDataRef = useRef(initialSession.data);
  const canonicalFrameRef = useRef<number | null>(null);
  const [catalogItems, setCatalogItems] = useState<ReadonlyArray<BlockGalleryItem>>(BLOCK_GALLERY_ITEMS);
  const [siteParts, setSiteParts] = useState<{ header: SitePartResource | null; footer: SitePartResource | null }>({ header: null, footer: null });
  const [sitePartMode, setSitePartMode] = useState<'header' | 'footer' | null>(null);
  const [canvasContextState, setCanvasContextState] = useState(INITIAL_CANVAS_CONTEXT_STATE);
  const canvasContextStateRef = useRef(INITIAL_CANVAS_CONTEXT_STATE);
  const [canvasMediaDialogOpen, setCanvasMediaDialogOpen] = useState(false);
  const [canvasRouteDialogOpen, setCanvasRouteDialogOpen] = useState(false);
  const [canvasTextToolsOpen, setCanvasTextToolsOpen] = useState(false);
  const heroFamilyCount = data.content.filter((block) =>
    block.type === 'Hero' || block.type === 'HeroSplit' || block.type === 'HeroSlider').length;
  const heroWarningKey = `g7pb:warning:${document.document_id}:hero-family:${heroFamilyCount}`;
  const [warningStateVersion, setWarningStateVersion] = useState(0);
  const transitionCanvasContext = useCallback((action: CanvasContextAction) => {
    const next = reduceCanvasContextState(canvasContextStateRef.current, action);
    canvasContextStateRef.current = next;
    setCanvasContextState(next);
    return next;
  }, []);
  const canvasElementSelection = canvasContextSelection(canvasContextState);
  const rangeEditingActive = canvasContextRangeActive(canvasContextState);
  const rangeAnchor = canvasContextRangeAnchor(canvasContextState);
  const setCanvasElementSelection = useCallback<React.Dispatch<React.SetStateAction<CanvasElementSelection | null>>>((value) => {
    const current = canvasContextSelection(canvasContextStateRef.current);
    const selection = typeof value === 'function' ? value(current) : value;
    transitionCanvasContext({ type: 'selection.replace', selection });
  }, [transitionCanvasContext]);
  const heroWarningDismissed = useMemo(() => {
    if (heroFamilyCount <= 1 || typeof window === 'undefined') return false;
    try {
      return window.localStorage?.getItem(heroWarningKey) === 'dismissed';
    } catch {
      return false;
    }
  }, [heroFamilyCount, heroWarningKey, warningStateVersion]);

  const dismissHeroWarning = (): void => {
    try {
      window.localStorage?.setItem(heroWarningKey, 'dismissed');
    } catch {
      // Storage can be unavailable in hardened browsers; dismissal still lasts for this render.
    }
    setWarningStateVersion((version) => version + 1);
  };

  useEffect(() => {
    const updateHostWidth = (): void => setHostWidth(window.innerWidth);
    window.addEventListener('resize', updateHostWidth);
    return () => window.removeEventListener('resize', updateHostWidth);
  }, []);

  useEffect(() => {
    if (viewportPolicy.canEdit) return;
    transitionCanvasContext({ type: 'clear' });
    setCanvasMediaDialogOpen(false);
    setCanvasRouteDialogOpen(false);
    setCanvasTextToolsOpen(false);
  }, [transitionCanvasContext, viewportPolicy.canEdit]);

  useEffect(() => {
    const accept = (selection: CanvasElementSelection): void => {
      if (!viewportPolicy.canEdit) return;
      transitionCanvasContext({ type: 'selection.accept', selection });
      setCanvasMediaDialogOpen(false);
      setCanvasRouteDialogOpen(false);
      if (shouldAutoOpenCanvasTextTools(selection, 'selection')) {
        window.requestAnimationFrame(() => {
          if (!canvasContextRangeActive(canvasContextStateRef.current)) setCanvasTextToolsOpen(true);
        });
      } else {
        setCanvasTextToolsOpen(false);
      }
    };
    const acceptRangeState = (active: boolean, anchorValue: unknown = null): void => {
      if (!viewportPolicy.canEdit) return;
      const wasActive = canvasContextRangeActive(canvasContextStateRef.current);
      const next = transitionCanvasContext({
        type: 'range.change',
        active,
        anchor: active ? normalizeCanvasRangeAnchor(anchorValue) : null,
      });
      if (active) {
        setCanvasMediaDialogOpen(false);
        setCanvasRouteDialogOpen(false);
        setCanvasTextToolsOpen(false);
      }
      if (!shouldAutoOpenCanvasTextTools(canvasContextSelection(next), active ? 'range-active' : 'range-inactive')) {
        setCanvasTextToolsOpen(false);
        return;
      }
      if (!wasActive) return;
      window.requestAnimationFrame(() => {
        if (!canvasContextRangeActive(canvasContextStateRef.current)) setCanvasTextToolsOpen(true);
      });
    };
    const fromMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === RICH_TEXT_RANGE_STATE_MESSAGE) {
        acceptRangeState(event.data.active === true, event.data.anchor);
        return;
      }
      if (event.data?.type !== CANVAS_ELEMENT_MESSAGE) return;
      accept(event.data.selection as CanvasElementSelection);
    };
    const fromCustomEvent = (event: Event): void => {
      if (event instanceof CustomEvent) accept(event.detail as CanvasElementSelection);
    };
    const fromRangeEvent = (event: Event): void => {
      if (event instanceof CustomEvent) acceptRangeState(event.detail?.active === true, event.detail?.anchor);
    };
    window.addEventListener('message', fromMessage);
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, fromCustomEvent);
    window.addEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, fromRangeEvent);
    return () => {
      window.removeEventListener('message', fromMessage);
      window.removeEventListener(CANVAS_ELEMENT_MESSAGE, fromCustomEvent);
      window.removeEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, fromRangeEvent);
    };
  }, [transitionCanvasContext, viewportPolicy.canEdit]);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || event.target.closest('[data-testid="page-builder-context-panel"]')) return;
      setCanvasTextToolsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setCanvasTextToolsOpen(false);
      setCanvasMediaDialogOpen(false);
      setCanvasRouteDialogOpen(false);
    };
    globalThis.document?.addEventListener('pointerdown', closeOnPointerDown, true);
    globalThis.document?.addEventListener('keydown', closeOnEscape);
    return () => {
      globalThis.document?.removeEventListener('pointerdown', closeOnPointerDown, true);
      globalThis.document?.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => () => {
    if (canonicalFrameRef.current !== null) window.cancelAnimationFrame(canonicalFrameRef.current);
  }, []);

  useEffect(() => {
    const session = canonicalToPuck(document);
    contextRef.current = session.context;
    latestDataRef.current = session.data;
    if (canonicalFrameRef.current !== null) {
      window.cancelAnimationFrame(canonicalFrameRef.current);
      canonicalFrameRef.current = null;
    }
    setData(session.data);
  }, [document.document_id, revisionKey]);

  useEffect(() => {
    setStructureEditingEnabled(document.schema_version === 'g7-page-builder/v2');
    setStructureDialogOpen(false);
    setStructureActivationError(null);
  }, [document.document_id, revisionKey]);

  useEffect(() => {
    let active = true;
    try {
      if (!window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY)) return undefined;
    } catch {
      return undefined;
    }

    void api.listBlockCatalog({ locale: document.locale })
      .then((resource) => {
        if (!active) return;
        const items = resource.items
          .map((item) => apiCatalogItemToGalleryItem(item, document.locale))
          .filter((item): item is BlockGalleryItem => item !== null);
        if (items.length > 0) setCatalogItems(items);
      })
      .catch(() => {
        // The embedded builtin catalog remains available when an admin API request fails.
      });

    return () => {
      active = false;
    };
  }, [api, document.locale]);

  useEffect(() => {
    if (document.shell_mode !== 'builder' && document.shell_mode !== 'global') {
      setSiteParts({ header: null, footer: null });
      return undefined;
    }
    let active = true;
    void Promise.allSettled([api.getSitePart('header', document.locale), api.getSitePart('footer', document.locale)]).then(([header, footer]) => {
      if (!active) return;
      setSiteParts({
        header: header.status === 'fulfilled' ? header.value : null,
        footer: footer.status === 'fulfilled' ? footer.value : null,
      });
    });
    return () => { active = false; };
  }, [api, document.locale, document.shell_mode]);

  const toggleFavorite = React.useCallback(async (catalogId: string, favorite: boolean): Promise<void> => {
    await api.setBlockFavorite(catalogId, favorite);
    setCatalogItems((current) => current.map((item) => item.catalogId === catalogId ? { ...item, favorite } : item));
  }, [api]);
  const blockCatalogContext = useMemo<BlockCatalogContextValue>(() => ({
    items: catalogItems,
    toggleFavorite,
  }), [catalogItems, toggleFavorite]);
  const editSitePart = useCallback((kind: 'header' | 'footer'): void => {
    if (viewportPolicy.canEdit) setSitePartMode(kind);
  }, [viewportPolicy.canEdit]);
  const closeSitePartEditor = useCallback((): void => setSitePartMode(null), []);
  const refreshSitePart = useCallback((resource: SitePartResource): void => {
    setSiteParts((current) => ({ ...current, [resource.document.kind]: resource }));
  }, []);

  const handleViewportChange = useCallback((width: number | '100%'): void => {
    setCanvasViewportWidth(width);
  }, []);

  const enableStructureEditing = useCallback((): void => {
    try {
      const activated = activateStructureEditing(latestDataRef.current, contextRef.current);
      contextRef.current = activated.context;
      setStructureEditingEnabled(true);
      setStructureDialogOpen(false);
      setStructureActivationError(null);
      onDirty?.();
      onChange(activated.document);
    } catch (error) {
      setStructureActivationError(error instanceof Error
        ? `현재 문서는 구조 편집으로 전환할 수 없습니다. ${error.message}`
        : '현재 문서는 구조 편집으로 전환할 수 없습니다.');
    }
  }, [onChange, onDirty]);
  const resolvePatternSection = useCallback((block: PuckEditorData['content'][number]): PageBuilderBlock => {
    const section = puckBlockToCanonical(block, contextRef.current);
    if (section.type !== LAYOUT_SECTION_BLOCK_TYPE) {
      throw new Error('Section 전체만 내 패턴으로 저장할 수 있습니다.');
    }

    return section;
  }, []);

  const overrides = useMemo(() => ({
    header: PuckHeaderLayer,
    headerActions: () => <>
      {!structureEditingEnabled && <button
        type="button"
        className="g7pb-button g7pb-button--quiet"
        data-testid="page-builder-enable-structure"
        disabled={editingDisabled}
        onClick={() => {
          setStructureActivationError(null);
          setStructureDialogOpen(true);
        }}
      >구조 편집 사용</button>}
      {structureEditingEnabled && <ConnectedSectionPatternControls
        disabled={editingDisabled}
        resolveSection={resolvePatternSection}
      />}
      <ConnectedHeaderControls
        editingDisabled={editingDisabled}
        viewportDisabled={disabled}
        onViewportChange={handleViewportChange}
      />
      <ConnectedContextPanel disabled={editingDisabled} />
      <ConnectedCanvasDialogs disabled={editingDisabled} />
    </>,
    drawer: PuckDrawerLibrary,
    drawerItem: PuckDrawerItem,
    actionBar: (props: { children: React.ReactNode; label?: string; parentAction?: React.ReactNode }) => (
      <SelectedBlockActionBar {...props} disabled={editingDisabled} />
    ),
  }), [disabled, editingDisabled, handleViewportChange, resolvePatternSection, structureEditingEnabled]);

  const emitCanonical = (nextData: PuckEditorData): PageBuilderDocument => {
    latestDataRef.current = nextData;
    const nextDocument = puckToCanonical(nextData, contextRef.current);
    onChange(nextDocument);
    return nextDocument;
  };
  const flushCanonical = (nextData = latestDataRef.current): PageBuilderDocument => {
    if (canonicalFrameRef.current !== null) {
      window.cancelAnimationFrame(canonicalFrameRef.current);
      canonicalFrameRef.current = null;
    }
    setData(nextData);
    return emitCanonical(nextData);
  };
  const updateCanonical = (nextData: PuckEditorData): void => {
    if (!viewportPolicy.canEdit) return;
    latestDataRef.current = nextData;
    onDirty?.();
    if (canonicalFrameRef.current !== null) return;
    canonicalFrameRef.current = window.requestAnimationFrame(() => {
      canonicalFrameRef.current = null;
      setData(latestDataRef.current);
      emitCanonical(latestDataRef.current);
    });
  };

  const fullSiteCanvas = useMemo(() => ({
    locale: document.locale,
    shellMode: document.shell_mode ?? 'template',
    header: siteParts.header,
    footer: siteParts.footer,
    canEdit: viewportPolicy.canEdit,
    edit: editSitePart,
  } satisfies FullSiteCanvasValue), [document.locale, document.shell_mode, editSitePart, siteParts.footer, siteParts.header, viewportPolicy.canEdit]);
  const canvasEditingUi = useMemo<CanvasEditingUiValue>(() => ({
    selection: canvasElementSelection,
    setSelection: setCanvasElementSelection,
    rangeEditingActive,
    rangeAnchor,
    mediaDialogOpen: canvasMediaDialogOpen,
    setMediaDialogOpen: setCanvasMediaDialogOpen,
    routeDialogOpen: canvasRouteDialogOpen,
    setRouteDialogOpen: setCanvasRouteDialogOpen,
    textToolsOpen: canvasTextToolsOpen,
    setTextToolsOpen: setCanvasTextToolsOpen,
  }), [canvasElementSelection, canvasMediaDialogOpen, canvasRouteDialogOpen, canvasTextToolsOpen, rangeAnchor, rangeEditingActive]);
  const canvasElementStyles = useMemo<Record<string, ElementAppearanceMap>>(() => Object.fromEntries(
    data.content.flatMap((block) => {
      const rawId = asString(block.props.id);
      const styles = normalizeElementAppearanceMap(block.props.elementStyles);
      return [[rawId, styles], [idToUuid(rawId), styles]];
    }),
  ), [data.content]);
  const canvasBlockAppearances = useMemo<Record<string, string>>(() => Object.fromEntries(
    flattenPuckBlocks(data.content).flatMap((block) => {
      const rawId = asString(block.props.id);
      const blockProps = block.props as Record<string, unknown>;
      const appearance = mergeBlockContainerAppearance(undefined, blockProps);
      const className = `${blockContainerClassName(appearance ?? { surface: 'default', spacing: 'normal' })} ${responsiveClassName(blockProps.responsiveOverrides)}`.trim();
      return [[rawId, className], [idToUuid(rawId), className]];
    }),
  ), [data.content]);

  if (sitePartMode) {
    return <SitePartEditor
      kind={sitePartMode}
      locale={document.locale}
      embedded
      iframeEnabled={iframeEnabled}
      onBack={closeSitePartEditor}
      onChanged={refreshSitePart}
    />;
  }

  return (
    <div
      className="g7pb-editor"
      data-testid="page-builder-editor"
      data-editing-mode={viewportPolicy.mode}
      data-host-editing-supported={viewportPolicy.hostSupported ? 'true' : 'false'}
      data-canvas-viewport={String(viewportPolicy.canvasWidth)}
      aria-busy={disabled}
    >
      {heroFamilyCount > 1 && !heroWarningDismissed && (
        <div className="g7pb-editor-warning" role="status" data-testid="page-builder-hero-warning">
          <span>Hero 계열 블록이 {heroFamilyCount}개 있습니다. 사용할 수 있지만 첫 화면 집중도가 낮아질 수 있습니다.</span>
          <button
            type="button"
            aria-label="Hero 안내 닫기"
            data-testid="page-builder-hero-warning-dismiss"
            onClick={dismissHeroWarning}
          >
            닫기
          </button>
        </div>
      )}
      {structureDialogOpen && createPortal(
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-structure-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-structure-heading">
            <p className="g7pb-kicker">문서 구조 버전 전환</p>
            <h2 id="g7pb-structure-heading">Section·Columns·Stack 구조 편집을 사용하시겠습니까?</h2>
            <p>기존 내용·SEO·공개 페이지는 유지됩니다. 동의하면 현재 초안이 v2로 전환되어 자동 저장 대상이 되며, 단순 편집만으로 v1으로 되돌아가지는 않습니다.</p>
            {structureActivationError && <p role="alert">{structureActivationError}</p>}
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                data-testid="page-builder-structure-cancel" onClick={() => setStructureDialogOpen(false)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-structure-confirm" onClick={enableStructureEditing}>구조 편집 사용</button>
            </div>
          </section>
        </div>,
        globalThis.document.body,
      )}
      <BlockCatalogContext.Provider value={blockCatalogContext}>
        <EditorViewportPolicyContext.Provider value={viewportPolicy}>
        <FullSiteCanvasContext.Provider value={fullSiteCanvas}>
        <CanvasEditingUiContext.Provider value={canvasEditingUi}>
        <CanvasBlockAppearanceContext.Provider value={canvasBlockAppearances}>
        <CanvasElementStylesContext.Provider value={canvasElementStyles}>
        <Puck
          config={runtimePuckConfig}
          data={data}
          dictionary={{
            'field-richtext-bold': '선택한 글자 굵게',
            'field-richtext-italic': '선택한 글자 기울임',
            'field-richtext-underline': '선택한 글자 밑줄',
          }}
          height="100%"
          iframe={{ enabled: iframeEnabled, syncHostStyles: true, waitForStyles: false }}
          viewports={PAGE_BUILDER_VIEWPORTS}
          ui={{
            leftSideBarVisible: viewportPolicy.hostSupported,
            rightSideBarVisible: viewportPolicy.hostSupported,
            viewports: {
              current: { width: canvasViewportWidth, height: 'auto' },
              controlsVisible: false,
              options: PAGE_BUILDER_VIEWPORTS,
            },
          }}
          permissions={{ edit: viewportPolicy.canEdit, insert: viewportPolicy.canEdit, delete: viewportPolicy.canEdit, duplicate: viewportPolicy.canEdit, drag: viewportPolicy.canEdit }}
          overrides={overrides}
          headerTitle="페이지 블록"
          headerPath={document.slug}
          onChange={updateCanonical}
          onPublish={(nextData) => {
            if (!viewportPolicy.canEdit) return;
            return onPublish(flushCanonical(nextData));
          }}
        />
        </CanvasElementStylesContext.Provider>
        </CanvasBlockAppearanceContext.Provider>
        </CanvasEditingUiContext.Provider>
        </FullSiteCanvasContext.Provider>
        </EditorViewportPolicyContext.Provider>
      </BlockCatalogContext.Provider>
    </div>
  );
}
