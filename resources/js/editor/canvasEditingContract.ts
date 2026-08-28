import React from 'react';

import type { ElementAppearance, ElementAppearanceMap } from '../documents/types';

export const CANVAS_ELEMENT_MESSAGE = 'g7pb:canvas-element-selected';

export const CanvasElementStylesContext = React.createContext<Record<string, ElementAppearanceMap>>({});
export const CanvasBlockAppearanceContext = React.createContext<Record<string, string>>({});
export const CanvasCurrentElementStylesContext = React.createContext<ElementAppearanceMap | undefined>(undefined);

export function useCanvasElementStyles(blockId: string, fallback?: ElementAppearanceMap): ElementAppearanceMap | undefined {
  const styles = React.useContext(CanvasElementStylesContext);
  if (styles[blockId]) return styles[blockId];
  const uuid = blockId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0]?.toLowerCase();
  return (uuid ? styles[uuid] : undefined) ?? fallback;
}

export function useCanvasBlockAppearanceClass(blockId: string): string {
  const classes = React.useContext(CanvasBlockAppearanceContext);
  if (classes[blockId]) return classes[blockId];
  const uuid = blockId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0]?.toLowerCase();
  return (uuid ? classes[uuid] : undefined) ?? '';
}

export type CanvasElementRole = 'block' | 'text' | 'action' | 'media';
export type CanvasElementSelectionIntent = 'identify';
export type CanvasTextToolsAutoOpenTrigger = 'selection' | 'range-active' | 'range-inactive';

export interface CanvasElementSelection {
  blockId: string;
  blockType: string;
  fieldPath: string | null;
  role: CanvasElementRole;
  label: string;
  collection: string | null;
  itemIndex: number | null;
  /**
   * Current canvases only identify the pointer target. A missing value is a
   * compatibility signal from canvases bundled before selection intent was
   * added, where selecting text also opened the element tools.
   */
  intent?: CanvasElementSelectionIntent;
  anchor?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    width: number;
    height: number;
  } | null;
}

export type NormalizedCanvasElementSelectionIntent = CanvasElementSelectionIntent | 'legacy-open';

export function normalizeCanvasElementSelectionIntent(value: unknown): NormalizedCanvasElementSelectionIntent {
  if (value === undefined) return 'legacy-open';
  return 'identify';
}

export function shouldAutoOpenCanvasTextTools(
  selection: Pick<CanvasElementSelection, 'intent' | 'role'> | null,
  trigger: CanvasTextToolsAutoOpenTrigger,
): boolean {
  if (trigger === 'range-active' || !selection
    || (selection.role !== 'text' && selection.role !== 'action')) return false;
  return normalizeCanvasElementSelectionIntent(selection.intent) === 'legacy-open';
}

interface CollectionLimit {
  min: number;
  max: number;
}

export interface CanvasBlockEditingCapability {
  componentType: string;
  directText: boolean;
  textFields: CanvasTextFieldCapability[];
  collections: string[];
  directMedia: boolean;
  directRoute: boolean;
  dynamicData: boolean;
}

export type CanvasTextFieldKind = 'plain' | 'inline-rich' | 'block-rich' | 'structural';

export interface CanvasTextFieldCapability {
  path: string;
  kind: CanvasTextFieldKind;
  /** Puck-only path when the canonical field is represented by an editor wrapper object. */
  editorPath?: string;
  /** False when the rendered field already participates in an outer route/action. */
  allowLink?: boolean;
}

type CanvasTextFieldPath = string | Omit<CanvasTextFieldCapability, 'kind'>;
type CanvasBlockEditingCapabilityDefinition = Omit<CanvasBlockEditingCapability, 'directText'>;

function classified(kind: CanvasTextFieldKind, ...paths: CanvasTextFieldPath[]): CanvasTextFieldCapability[] {
  return paths.map((path) => typeof path === 'string' ? { path, kind } : { ...path, kind });
}

const plain = (...paths: CanvasTextFieldPath[]): CanvasTextFieldCapability[] => classified('plain', ...paths);
const inlineRich = (...paths: CanvasTextFieldPath[]): CanvasTextFieldCapability[] => classified('inline-rich', ...paths);
const blockRich = (...paths: CanvasTextFieldPath[]): CanvasTextFieldCapability[] => classified('block-rich', ...paths);
const structural = (...paths: CanvasTextFieldPath[]): CanvasTextFieldCapability[] => classified('structural', ...paths);

function defineCanvasBlockCapability(definition: CanvasBlockEditingCapabilityDefinition): CanvasBlockEditingCapability {
  return {
    ...definition,
    directText: definition.textFields.some((field) => field.kind !== 'structural'),
  };
}

export const BUILTIN_CANVAS_EDITING_CONTRACT: CanvasBlockEditingCapability[] = [
  defineCanvasBlockCapability({ componentType: 'Heading', textFields: [
    ...plain('eyebrow'), ...inlineRich('heading'), ...structural('level', 'anchor'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'RichText', textFields: [
    ...blockRich('content'), ...structural('measure'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Image', textFields: [
    ...plain('caption'), ...structural('src', 'alt', 'linkUrl', 'aspectRatio'),
  ], collections: [], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Buttons', textFields: [
    ...plain('items.*.label'), ...structural('items.*.url', 'items.*.variant', 'alignment'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'ImageText', textFields: [
    ...plain('eyebrow', 'primaryLabel'), ...inlineRich('heading'), ...blockRich('body'),
    ...structural('imageSrc', 'imageAlt', 'mediaPosition', 'primaryUrl'),
  ], collections: [], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'IconList', textFields: [
    ...plain('eyebrow'), ...inlineRich('heading', 'items.*.title'), ...blockRich('items.*.body'),
    ...structural('items.*.icon', 'layout'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Hero', textFields: [
    ...plain('eyebrow', 'primaryLabel'), ...inlineRich('title'), ...blockRich('body'),
    ...structural('primaryUrl', 'imageSrc', 'imageAlt', 'alignment', 'mediaPosition', 'layout'),
  ], collections: [], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'HeroSplit', textFields: [
    ...plain('eyebrow', 'primaryLabel'), ...inlineRich('title'), ...blockRich('body'),
    ...structural('primaryUrl', 'imageSrc', 'imageAlt', 'mediaPosition', 'layout'),
  ], collections: [], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'HeroSlider', textFields: [
    ...plain('slides.*.eyebrow', 'slides.*.buttonLabel'), ...inlineRich('slides.*.title'),
    ...blockRich('slides.*.body'), ...structural('slides.*.buttonUrl', 'slides.*.imageSrc', 'slides.*.imageAlt', 'autoplay', 'interval', 'loop'),
  ], collections: ['slides'], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Features', textFields: [
    ...inlineRich('title', 'items.*.title'), ...blockRich('items.*.body'), ...structural('items.*.icon', 'layout'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Cta', textFields: [
    ...plain('eyebrow', 'primaryLabel', 'secondaryLabel'), ...inlineRich('heading'), ...blockRich('body'),
    ...structural('primaryUrl', 'secondaryUrl', 'theme', 'layout'),
  ], collections: [], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Contact', textFields: [
    ...plain('address', 'phone', 'email', 'ctaLabel', 'mapLabel'), ...inlineRich('heading'),
    ...structural('ctaUrl', 'mapUrl'),
  ], collections: [], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'FaqAccordion', textFields: [
    ...plain('eyebrow'), ...inlineRich('heading', 'items.*.question'), ...blockRich('items.*.answer'),
    ...structural('behavior', 'openFirst'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'ProcessTimeline', textFields: [
    ...plain('eyebrow', 'items.*.linkLabel'), ...inlineRich('heading', 'items.*.title'), ...blockRich('items.*.body'),
    ...structural('layout', 'items.*.linkUrl'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Tabs', textFields: [
    ...plain('eyebrow', 'items.*.label'), ...inlineRich('heading', 'items.*.heading'), ...blockRich('items.*.body'),
    ...structural('tabVariant', 'initialTab'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'ArticleList', textFields: [
    ...plain('eyebrow', 'items.*.category'), ...inlineRich('heading', { path: 'items.*.title', allowLink: false }), ...blockRich('items.*.summary'),
    ...structural('layout', 'items.*.date', 'items.*.imageSrc', 'items.*.imageAlt', 'items.*.url'),
  ], collections: ['items'], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'EventSchedule', textFields: [
    ...plain('eyebrow', 'items.*.date', 'items.*.time', 'items.*.location', 'items.*.buttonLabel'),
    ...inlineRich('heading', 'items.*.title'), ...blockRich('items.*.description'), ...structural('layout', 'items.*.buttonUrl'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'DownloadResources', textFields: [
    ...plain('eyebrow', 'items.*.fileType', 'items.*.fileSize', 'items.*.buttonLabel'),
    ...inlineRich('heading', 'items.*.title'), ...blockRich('items.*.description'), ...structural('items.*.url'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'InquiryForm', textFields: [
    ...plain('eyebrow', 'submitLabel', 'successMessage', 'privacyLabel'), ...inlineRich('heading'), ...blockRich('description'),
    ...structural('formKind', 'showPhone', 'showSubject'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'MapDirections', textFields: [
    ...plain('eyebrow', 'address', 'directionsLabel', 'phone', 'hours', 'parking'), ...inlineRich('heading'), ...blockRich('description'),
    ...structural('latitude', 'longitude', 'zoom', 'provider', 'mapImageSrc', 'mapImageAlt', 'directionsUrl'),
  ], collections: [], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'LogoCloud', textFields: [
    ...plain('logos.*.name'), ...inlineRich('heading'), ...structural('logos.*.imageSrc', 'logos.*.imageAlt', 'logos.*.url', 'layout'),
  ], collections: ['logos'], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'LogoCarousel', textFields: [
    ...plain('eyebrow', 'logos.*.name'), ...inlineRich('heading'),
    ...structural('logos.*.imageSrc', 'logos.*.imageAlt', 'logos.*.url', 'autoplay', 'interval'),
  ], collections: ['logos'], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Testimonials', textFields: [
    ...plain('eyebrow', 'items.*.name', 'items.*.role', 'items.*.company'), ...inlineRich('heading'), ...blockRich('items.*.quote'),
    ...structural('layout', 'items.*.avatarSrc', 'items.*.avatarAlt', 'items.*.rating'),
  ], collections: ['items'], directMedia: true, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'TestimonialSlider', textFields: [
    ...plain('eyebrow', 'items.*.name', 'items.*.role', 'items.*.company'), ...inlineRich('heading'), ...blockRich('items.*.quote'),
    ...structural('items.*.avatarSrc', 'items.*.avatarAlt', 'items.*.rating', 'autoplay', 'interval'),
  ], collections: ['items'], directMedia: true, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Pricing', textFields: [
    ...plain('eyebrow', 'plans.*.price', 'plans.*.period', 'plans.*.buttonLabel'), ...inlineRich('heading', 'plans.*.name', { path: 'plans.*.features.*', editorPath: 'plans.*.features.*.text' }),
    ...blockRich('plans.*.description'), ...structural('plans.*.buttonUrl', 'plans.*.featured', 'layout'),
  ], collections: ['plans'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'ComparisonTable', textFields: [
    ...plain('eyebrow', { path: 'rows.*.values.*', editorPath: 'rows.*.valuesText' }),
    ...inlineRich('heading', 'columns.*.title', 'columns.*.description', 'rows.*.feature'), ...structural('highlightColumn'),
  ], collections: ['columns', 'rows'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Team', textFields: [
    ...plain('eyebrow', 'members.*.name', 'members.*.role'), ...inlineRich('heading'), ...blockRich('members.*.bio'),
    ...structural('members.*.imageSrc', 'members.*.imageAlt', 'members.*.profileUrl', 'layout'),
  ], collections: ['members'], directMedia: true, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Stats', textFields: [
    ...plain('eyebrow', 'items.*.value'), ...inlineRich('heading', 'items.*.label'), ...blockRich('items.*.detail'),
    ...structural('items.*.icon', 'layout'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'BarChart', textFields: [
    ...plain('eyebrow', 'unit', 'items.*.label'), ...inlineRich('heading'), ...blockRich('description'),
    ...structural('items.*.value', 'items.*.tone'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Gallery', textFields: [
    ...plain('eyebrow', 'images.*.caption'), ...inlineRich('heading'), ...structural('columns', 'images.*.src', 'images.*.alt', 'layout'),
  ], collections: ['images'], directMedia: true, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'VideoEmbed', textFields: [
    ...plain('eyebrow'), ...inlineRich('heading'), ...blockRich('caption'), ...structural('provider', 'videoId', 'ratio'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'G7RecentPosts', textFields: [
    ...plain('eyebrow', 'emptyMessage'), ...inlineRich('heading'), ...structural('source', 'period', 'limit', 'pageSize', 'audience'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: true }),
  defineCanvasBlockCapability({ componentType: 'G7BoardArchive', textFields: [
    ...plain('eyebrow', 'emptyMessage'), ...inlineRich('heading'),
    ...structural('source', 'period', 'limit', 'pageSize', 'audience', 'showSearch', 'showBoardFilter'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: true }),
  defineCanvasBlockCapability({ componentType: 'G7PostDetail', textFields: [
    ...plain('eyebrow', 'linkLabel', 'emptyMessage'), ...inlineRich('heading'),
    ...structural('boardSlug', 'postId', 'detailUrl', 'audience', 'showContent'),
  ], collections: [], directMedia: false, directRoute: true, dynamicData: true }),
  defineCanvasBlockCapability({ componentType: 'G7ProductGrid', textFields: [
    ...plain('eyebrow', 'emptyMessage'), ...inlineRich('heading'),
    ...structural('source', 'limit', 'columns', 'pageSize', 'audience', 'detailBasePath'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: true }),
  defineCanvasBlockCapability({ componentType: 'G7ProductShowcase', textFields: [
    ...plain('eyebrow', 'emptyMessage'), ...inlineRich('heading'),
    ...structural('source', 'limit', 'pageSize', 'audience', 'detailBasePath', 'layout'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: true }),
  defineCanvasBlockCapability({ componentType: 'G7ProductDetail', textFields: [
    ...plain('eyebrow', 'buttonLabel', 'emptyMessage'), ...inlineRich('heading'),
    ...structural('productKey', 'detailUrl', 'audience', 'showDescription'),
  ], collections: [], directMedia: false, directRoute: true, dynamicData: true }),
  defineCanvasBlockCapability({ componentType: 'Divider', textFields: [
    ...plain('label'), ...structural('variant', 'width'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Blockquote', textFields: [
    ...plain('citation', 'role'), ...blockRich('quote'), ...structural('alignment', 'variant'),
  ], collections: [], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Notice', textFields: [
    ...plain('actionLabel'), ...inlineRich('title'), ...blockRich('body'), ...structural('tone', 'actionUrl'),
  ], collections: [], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'CardGrid', textFields: [
    ...plain('eyebrow', 'items.*.kicker', 'items.*.linkLabel'), ...inlineRich('heading', 'items.*.title'), ...blockRich('items.*.body'),
    ...structural('items.*.linkUrl', 'columns', 'variant', 'layout'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'Breadcrumbs', textFields: [
    ...plain('items.*.label', 'currentLabel'), ...structural('items.*.url'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'AnchorMenu', textFields: [
    ...plain('label', 'items.*.label'), ...structural('items.*.anchor', 'sticky', 'alignment'),
  ], collections: ['items'], directMedia: false, directRoute: false, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'SocialLinks', textFields: [
    ...plain('items.*.label'), ...inlineRich('heading'), ...structural('items.*.network', 'items.*.url', 'variant', 'alignment'),
  ], collections: ['items'], directMedia: false, directRoute: true, dynamicData: false }),
  defineCanvasBlockCapability({ componentType: 'ImageCarousel', textFields: [
    ...plain('eyebrow', 'images.*.caption'), ...inlineRich('heading'),
    ...structural('images.*.src', 'images.*.alt', 'autoplay', 'interval', 'controls', 'aspectRatio'),
  ], collections: ['images'], directMedia: true, directRoute: false, dynamicData: false }),
];

const COLLECTION_LIMITS: Record<string, Record<string, CollectionLimit>> = {
  Buttons: { items: { min: 1, max: 3 } },
  IconList: { items: { min: 2, max: 8 } },
  Features: { items: { min: 1, max: 6 } },
  HeroSlider: { slides: { min: 2, max: 5 } },
  LogoCloud: { logos: { min: 2, max: 12 } },
  Stats: { items: { min: 2, max: 6 } },
  Pricing: { plans: { min: 2, max: 4 } },
  Team: { members: { min: 2, max: 8 } },
  Gallery: { images: { min: 2, max: 12 } },
  BarChart: { items: { min: 2, max: 8 } },
  Testimonials: { items: { min: 2, max: 8 } },
  FaqAccordion: { items: { min: 2, max: 12 } },
  ProcessTimeline: { items: { min: 2, max: 8 } },
  Tabs: { items: { min: 2, max: 6 } },
  ComparisonTable: { columns: { min: 2, max: 4 }, rows: { min: 1, max: 12 } },
  ArticleList: { items: { min: 2, max: 8 } },
  LogoCarousel: { logos: { min: 3, max: 12 } },
  TestimonialSlider: { items: { min: 2, max: 8 } },
  EventSchedule: { items: { min: 1, max: 12 } },
  DownloadResources: { items: { min: 1, max: 12 } },
  CardGrid: { items: { min: 2, max: 6 } },
  Breadcrumbs: { items: { min: 1, max: 6 } },
  AnchorMenu: { items: { min: 2, max: 8 } },
  SocialLinks: { items: { min: 1, max: 8 } },
  ImageCarousel: { images: { min: 2, max: 8 } },
};

const ROOT_ROUTE_FIELDS: Record<string, Record<string, string>> = {
  Image: { caption: 'linkUrl', src: 'linkUrl' },
  ImageText: { primaryLabel: 'primaryUrl' },
  Hero: { primaryLabel: 'primaryUrl' },
  HeroSplit: { primaryLabel: 'primaryUrl' },
  Cta: { primaryLabel: 'primaryUrl', secondaryLabel: 'secondaryUrl' },
  Contact: { ctaLabel: 'ctaUrl', mapLabel: 'mapUrl' },
  MapDirections: { directionsLabel: 'directionsUrl' },
  G7PostDetail: { linkLabel: 'detailUrl' },
  G7ProductDetail: { buttonLabel: 'detailUrl' },
  Notice: { actionLabel: 'actionUrl' },
};

const COLLECTION_ROUTE_FIELDS: Record<string, Record<string, { trigger: string[]; target: string }>> = {
  Buttons: { items: { trigger: ['label'], target: 'url' } },
  HeroSlider: { slides: { trigger: ['buttonLabel'], target: 'buttonUrl' } },
  LogoCloud: { logos: { trigger: ['name'], target: 'url' } },
  Pricing: { plans: { trigger: ['buttonLabel'], target: 'buttonUrl' } },
  Team: { members: { trigger: ['name'], target: 'profileUrl' } },
  ProcessTimeline: { items: { trigger: ['linkLabel'], target: 'linkUrl' } },
  ArticleList: { items: { trigger: ['title'], target: 'url' } },
  LogoCarousel: { logos: { trigger: ['name'], target: 'url' } },
  EventSchedule: { items: { trigger: ['buttonLabel'], target: 'buttonUrl' } },
  DownloadResources: { items: { trigger: ['buttonLabel'], target: 'url' } },
  CardGrid: { items: { trigger: ['linkLabel'], target: 'linkUrl' } },
  Breadcrumbs: { items: { trigger: ['label'], target: 'url' } },
  SocialLinks: { items: { trigger: ['label'], target: 'url' } },
};

const COLLECTION_MEDIA_FIELDS: Record<string, Record<string, string>> = {
  HeroSlider: { slides: 'imageSrc' },
  LogoCloud: { logos: 'imageSrc' },
  Team: { members: 'imageSrc' },
  Gallery: { images: 'src' },
  Testimonials: { items: 'avatarSrc' },
  ArticleList: { items: 'imageSrc' },
  LogoCarousel: { logos: 'imageSrc' },
  TestimonialSlider: { items: 'avatarSrc' },
  ImageCarousel: { images: 'src' },
};

const FIELD_LABELS: Record<string, string> = {
  eyebrow: '보조 문구',
  title: '제목',
  heading: '제목',
  body: '본문',
  content: '본문',
  description: '설명',
  primaryLabel: '주 버튼',
  secondaryLabel: '보조 버튼',
  ctaLabel: '문의 버튼',
  mapLabel: '지도 버튼',
  buttonLabel: '버튼',
  linkLabel: '링크',
  directionsLabel: '길찾기 버튼',
  actionLabel: '안내 링크',
  currentLabel: '현재 페이지',
  role: '역할·소속',
  kicker: '보조 문구',
  imageSrc: '이미지',
  avatarSrc: '프로필 이미지',
  src: '이미지',
  name: '이름',
  quote: '후기',
  caption: '캡션',
  label: '이름',
  value: '값',
  question: '질문',
  answer: '답변',
  summary: '요약',
  address: '주소',
  phone: '전화번호',
  email: '이메일',
};

const COMPONENT_TYPE_BY_BLOCK_TYPE: Record<string, string> = {
  heading: 'Heading',
  'rich-text': 'RichText',
  image: 'Image',
  buttons: 'Buttons',
  'image-text': 'ImageText',
  'icon-list': 'IconList',
  hero: 'Hero',
  'hero-split': 'HeroSplit',
  'hero-slider': 'HeroSlider',
  features: 'Features',
  cta: 'Cta',
  contact: 'Contact',
  'logo-cloud': 'LogoCloud',
  stats: 'Stats',
  pricing: 'Pricing',
  team: 'Team',
  gallery: 'Gallery',
  'bar-chart': 'BarChart',
  testimonials: 'Testimonials',
  'faq-accordion': 'FaqAccordion',
  'process-timeline': 'ProcessTimeline',
  tabs: 'Tabs',
  'comparison-table': 'ComparisonTable',
  'article-list': 'ArticleList',
  'video-embed': 'VideoEmbed',
  'logo-carousel': 'LogoCarousel',
  'testimonial-slider': 'TestimonialSlider',
  'event-schedule': 'EventSchedule',
  'download-resources': 'DownloadResources',
  'inquiry-form': 'InquiryForm',
  'map-directions': 'MapDirections',
  'g7-recent-posts': 'G7RecentPosts',
  'g7-board-archive': 'G7BoardArchive',
  'g7-post-detail': 'G7PostDetail',
  'g7-product-grid': 'G7ProductGrid',
  'g7-product-showcase': 'G7ProductShowcase',
  'g7-product-detail': 'G7ProductDetail',
  divider: 'Divider',
  blockquote: 'Blockquote',
  notice: 'Notice',
  'card-grid': 'CardGrid',
  breadcrumbs: 'Breadcrumbs',
  'anchor-menu': 'AnchorMenu',
  'social-links': 'SocialLinks',
  'image-carousel': 'ImageCarousel',
};

function selectionFromPath(blockId: string, blockType: string, fieldPath: string, role: CanvasElementRole): Omit<CanvasElementSelection, 'anchor'> {
  const segments = fieldPath.split('.');
  const collection = segments.length >= 3 && /^\d+$/.test(segments[1]) ? segments[0] : null;
  const itemIndex = collection ? Number(segments[1]) : null;
  const leaf = segments.at(-1) ?? fieldPath;

  return {
    blockId,
    blockType,
    fieldPath,
    role,
    label: `${FIELD_LABELS[leaf] ?? leaf}${itemIndex === null ? '' : ` · ${itemIndex + 1}번 항목`}`,
    collection,
    itemIndex,
  };
}

function parentViewportRect(element: HTMLElement | null): CanvasElementSelection['anchor'] {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  const frame = element.ownerDocument.defaultView?.frameElement;
  if (!frame || typeof frame.getBoundingClientRect !== 'function') {
    return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
  }
  const frameRect = frame.getBoundingClientRect();
  const frameWidth = element.ownerDocument.defaultView?.innerWidth ?? frameRect.width;
  const frameHeight = element.ownerDocument.defaultView?.innerHeight ?? frameRect.height;
  const scaleX = frameWidth > 0 ? frameRect.width / frameWidth : 1;
  const scaleY = frameHeight > 0 ? frameRect.height / frameHeight : 1;
  return {
    top: frameRect.top + rect.top * scaleY,
    right: frameRect.left + rect.right * scaleX,
    bottom: frameRect.top + rect.bottom * scaleY,
    left: frameRect.left + rect.left * scaleX,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

export function normalizeElementAppearance(value: unknown): ElementAppearance {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    ...(record.font === 'system' || record.font === 'modern' || record.font === 'serif' || record.font === 'mono' ? { font: record.font } : {}),
    ...(record.size === 'small' || record.size === 'large' || record.size === 'xlarge' ? { size: record.size } : {}),
    ...(record.weight === 'medium' || record.weight === 'semibold' || record.weight === 'bold' ? { weight: record.weight } : {}),
    ...(record.align === 'center' || record.align === 'right' ? { align: record.align } : {}),
    ...(record.tone === 'muted' || record.tone === 'accent' || record.tone === 'contrast'
      || record.tone === 'custom1' || record.tone === 'custom2' || record.tone === 'custom3' || record.tone === 'custom4'
      ? { tone: record.tone } : {}),
  };
}

export function normalizeElementAppearanceMap(value: unknown): ElementAppearanceMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([path]) => /^[A-Za-z][A-Za-z0-9]*(?:\.\d+)?(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(path))
    .map(([path, appearance]) => [path, normalizeElementAppearance(appearance)])
    .filter(([, appearance]) => Object.keys(appearance).length > 0));
}

export type CollectionAppearanceOperation = 'up' | 'down' | 'duplicate' | 'delete';

export function remapCollectionElementAppearanceMap(
  value: unknown,
  collection: string,
  operation: CollectionAppearanceOperation,
  itemIndex: number,
): ElementAppearanceMap {
  const styles = normalizeElementAppearanceMap(value);
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(collection) || !Number.isInteger(itemIndex) || itemIndex < 0) return styles;

  const next: ElementAppearanceMap = {};
  Object.entries(styles).forEach(([path, style]) => {
    const match = path.match(/^([A-Za-z][A-Za-z0-9]*)\.(\d+)\.([A-Za-z][A-Za-z0-9]*)$/);
    if (!match || match[1] !== collection) {
      next[path] = { ...style };
      return;
    }

    const sourceIndex = Number(match[2]);
    const leaf = match[3];
    let targetIndex = sourceIndex;
    if (operation === 'up') {
      if (sourceIndex === itemIndex) targetIndex = itemIndex - 1;
      else if (sourceIndex === itemIndex - 1) targetIndex = itemIndex;
    } else if (operation === 'down') {
      if (sourceIndex === itemIndex) targetIndex = itemIndex + 1;
      else if (sourceIndex === itemIndex + 1) targetIndex = itemIndex;
    } else if (operation === 'delete') {
      if (sourceIndex === itemIndex) return;
      if (sourceIndex > itemIndex) targetIndex = sourceIndex - 1;
    } else if (operation === 'duplicate') {
      if (sourceIndex > itemIndex) targetIndex = sourceIndex + 1;
      if (sourceIndex === itemIndex) next[`${collection}.${itemIndex + 1}.${leaf}`] = { ...style };
    }
    if (targetIndex >= 0) next[`${collection}.${targetIndex}.${leaf}`] = { ...style };
  });

  return next;
}

export function elementAppearanceClassName(styles: ElementAppearanceMap | undefined, fieldPath: string): string {
  const style = normalizeElementAppearance(styles?.[fieldPath]);
  return [
    `g7pb-element-font--${style.font ?? 'inherit'}`,
    `g7pb-element-size--${style.size ?? 'base'}`,
    `g7pb-element-weight--${style.weight ?? 'regular'}`,
    `g7pb-element-align--${style.align ?? 'left'}`,
    `g7pb-element-tone--${style.tone ?? 'default'}`,
  ].join(' ');
}

export function decorateCanvasElementStyles(
  children: React.ReactNode,
  styles: ElementAppearanceMap | undefined,
): React.ReactNode {
  if (!styles || Object.keys(styles).length === 0) return children;
  return React.Children.map(children, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return child;
    const props = child.props;
    const fieldPath = typeof props['data-g7pb-inline-field'] === 'string'
      ? props['data-g7pb-inline-field']
      : typeof props['data-g7pb-action-field'] === 'string' ? props['data-g7pb-action-field'] : null;
    const nested = decorateCanvasElementStyles(props.children as React.ReactNode, styles);
    const className = fieldPath
      ? [typeof props.className === 'string' ? props.className : '', elementAppearanceClassName(styles, fieldPath)].filter(Boolean).join(' ')
      : props.className;
    return React.cloneElement(child, { ...props, className, children: nested });
  });
}

export function notifyCanvasElementSelection(
  event: React.PointerEvent<HTMLElement>,
  blockId: string,
  blockType: string,
): void {
  const target = event.target && typeof (event.target as Element).closest === 'function'
    ? event.target as Element
    : null;
  if (!target) return;

  // Tiptap owns range state and reports both activation and collapse through
  // the dedicated rich-text range contract. This message only identifies the
  // element, so the host never infers range state from a stale DOM Selection.
  const richText = target.closest<HTMLElement>('[data-g7pb-richtext-field], [data-puck-richtext]');
  if (richText) {
    const fieldPath = richText.dataset.g7pbInlineField ?? target.closest<HTMLElement>('[data-g7pb-inline-field]')?.dataset.g7pbInlineField;
    if (!fieldPath) return;
    const selection = {
      ...selectionFromPath(blockId, blockType, fieldPath, 'text'),
      intent: 'identify',
      anchor: parentViewportRect(richText),
    } satisfies CanvasElementSelection;
    const message = { type: CANVAS_ELEMENT_MESSAGE, selection };
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
    window.dispatchEvent(new CustomEvent(CANVAS_ELEMENT_MESSAGE, { detail: selection }));
    return;
  }

  const selectable = target.closest<HTMLElement>('[data-g7pb-media-field], [data-g7pb-action-field], [data-g7pb-inline-field]');
  const fieldPath = selectable?.dataset.g7pbMediaField ?? selectable?.dataset.g7pbActionField
    ?? selectable?.dataset.g7pbInlineField ?? null;
  const inferredAction = fieldPath ? resolveRouteFieldPath(COMPONENT_TYPE_BY_BLOCK_TYPE[blockType] ?? blockType, fieldPath) : null;
  const role: CanvasElementRole = selectable?.dataset.g7pbMediaField
    ? 'media'
    : selectable?.dataset.g7pbActionField || inferredAction ? 'action' : fieldPath ? 'text' : 'block';
  const selection = fieldPath
    ? { ...selectionFromPath(blockId, blockType, fieldPath, role), intent: 'identify', anchor: parentViewportRect(selectable) }
    : { blockId, blockType, fieldPath: null, role, label: '블록 전체', collection: null, itemIndex: null,
      intent: 'identify', anchor: parentViewportRect(target.closest<HTMLElement>('[data-block-id]')) } satisfies CanvasElementSelection;

  selectable?.ownerDocument.querySelectorAll('[data-g7pb-canvas-selected="true"]').forEach((element) => {
    element.removeAttribute('data-g7pb-canvas-selected');
  });
  selectable?.setAttribute('data-g7pb-canvas-selected', 'true');

  const message = { type: CANVAS_ELEMENT_MESSAGE, selection };
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
  window.dispatchEvent(new CustomEvent(CANVAS_ELEMENT_MESSAGE, { detail: selection }));
}

export function resolveRouteFieldPath(componentType: string, fieldPath: string): string | null {
  const rootTarget = ROOT_ROUTE_FIELDS[componentType]?.[fieldPath];
  if (rootTarget) return rootTarget;

  const match = fieldPath.match(/^([A-Za-z]+)\.(\d+)\.([A-Za-z]+)$/);
  if (!match) return null;
  const [, collection, index, leaf] = match;
  const rule = COLLECTION_ROUTE_FIELDS[componentType]?.[collection];
  return rule?.trigger.includes(leaf) ? `${collection}.${index}.${rule.target}` : null;
}

export function resolveMediaFieldPath(componentType: string, selection: CanvasElementSelection): string | null {
  if (selection.role === 'media' && selection.fieldPath) return selection.fieldPath;
  if (componentType === 'Image') return selection.fieldPath === null ? 'src' : null;
  if (componentType === 'ImageText') return selection.fieldPath === null ? 'imageSrc' : null;
  if (componentType === 'Hero') return selection.fieldPath === null ? 'imageSrc' : null;
  if (componentType === 'HeroSplit') return selection.fieldPath === null ? 'imageSrc' : null;
  if (!selection.collection || selection.itemIndex === null) return null;
  const target = COLLECTION_MEDIA_FIELDS[componentType]?.[selection.collection];
  return target ? `${selection.collection}.${selection.itemIndex}.${target}` : null;
}

export function collectionLimit(componentType: string, collection: string): CollectionLimit | null {
  return COLLECTION_LIMITS[componentType]?.[collection] ?? null;
}

export function valueAtPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (Array.isArray(current) && /^\d+$/.test(segment)) return current[Number(segment)];
    if (current !== null && typeof current === 'object') return (current as Record<string, unknown>)[segment];
    return undefined;
  }, root);
}

export function setValueAtPath(root: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = structuredClone(root);
  const segments = path.split('.');
  let cursor: Record<string, unknown> | unknown[] = result;
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (Array.isArray(cursor)) {
      const numeric = Number(segment);
      if (last) cursor[numeric] = value;
      else cursor = cursor[numeric] as Record<string, unknown> | unknown[];
      return;
    }
    if (last) cursor[segment] = value;
    else cursor = cursor[segment] as Record<string, unknown> | unknown[];
  });
  return result;
}
