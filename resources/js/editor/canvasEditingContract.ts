import type React from 'react';

export const CANVAS_ELEMENT_MESSAGE = 'g7pb:canvas-element-selected';

export type CanvasElementRole = 'block' | 'text' | 'action' | 'media';

export interface CanvasElementSelection {
  blockId: string;
  blockType: string;
  fieldPath: string | null;
  role: CanvasElementRole;
  label: string;
  collection: string | null;
  itemIndex: number | null;
}

interface CollectionLimit {
  min: number;
  max: number;
}

export interface CanvasBlockEditingCapability {
  componentType: string;
  directText: boolean;
  collections: string[];
  directMedia: boolean;
  directRoute: boolean;
  dynamicData: boolean;
}

export const BUILTIN_CANVAS_EDITING_CONTRACT: CanvasBlockEditingCapability[] = [
  { componentType: 'Hero', directText: true, collections: [], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'HeroSplit', directText: true, collections: [], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'HeroSlider', directText: true, collections: ['slides'], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'Features', directText: true, collections: ['items'], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'Cta', directText: true, collections: [], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'Contact', directText: true, collections: [], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'FaqAccordion', directText: true, collections: ['items'], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'ProcessTimeline', directText: true, collections: ['items'], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'Tabs', directText: true, collections: ['items'], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'ArticleList', directText: true, collections: ['items'], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'EventSchedule', directText: true, collections: ['items'], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'DownloadResources', directText: true, collections: ['items'], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'InquiryForm', directText: true, collections: [], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'MapDirections', directText: true, collections: [], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'LogoCloud', directText: true, collections: ['logos'], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'LogoCarousel', directText: true, collections: ['logos'], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'Testimonials', directText: true, collections: ['items'], directMedia: true, directRoute: false, dynamicData: false },
  { componentType: 'TestimonialSlider', directText: true, collections: ['items'], directMedia: true, directRoute: false, dynamicData: false },
  { componentType: 'Pricing', directText: true, collections: ['plans'], directMedia: false, directRoute: true, dynamicData: false },
  { componentType: 'ComparisonTable', directText: true, collections: ['columns', 'rows'], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'Team', directText: true, collections: ['members'], directMedia: true, directRoute: true, dynamicData: false },
  { componentType: 'Stats', directText: true, collections: ['items'], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'BarChart', directText: true, collections: ['items'], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'Gallery', directText: true, collections: ['images'], directMedia: true, directRoute: false, dynamicData: false },
  { componentType: 'VideoEmbed', directText: true, collections: [], directMedia: false, directRoute: false, dynamicData: false },
  { componentType: 'G7RecentPosts', directText: true, collections: [], directMedia: false, directRoute: false, dynamicData: true },
  { componentType: 'G7BoardArchive', directText: true, collections: [], directMedia: false, directRoute: false, dynamicData: true },
  { componentType: 'G7ProductGrid', directText: true, collections: [], directMedia: false, directRoute: false, dynamicData: true },
  { componentType: 'G7ProductShowcase', directText: true, collections: [], directMedia: false, directRoute: false, dynamicData: true },
];

const COLLECTION_LIMITS: Record<string, Record<string, CollectionLimit>> = {
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
};

const ROOT_ROUTE_FIELDS: Record<string, Record<string, string>> = {
  Hero: { primaryLabel: 'primaryUrl' },
  HeroSplit: { primaryLabel: 'primaryUrl' },
  Cta: { primaryLabel: 'primaryUrl', secondaryLabel: 'secondaryUrl' },
  Contact: { ctaLabel: 'ctaUrl', mapLabel: 'mapUrl' },
  MapDirections: { directionsLabel: 'directionsUrl' },
};

const COLLECTION_ROUTE_FIELDS: Record<string, Record<string, { trigger: string[]; target: string }>> = {
  HeroSlider: { slides: { trigger: ['buttonLabel'], target: 'buttonUrl' } },
  LogoCloud: { logos: { trigger: ['name'], target: 'url' } },
  Pricing: { plans: { trigger: ['buttonLabel'], target: 'buttonUrl' } },
  Team: { members: { trigger: ['name'], target: 'profileUrl' } },
  ProcessTimeline: { items: { trigger: ['linkLabel'], target: 'linkUrl' } },
  ArticleList: { items: { trigger: ['title'], target: 'url' } },
  LogoCarousel: { logos: { trigger: ['name'], target: 'url' } },
  EventSchedule: { items: { trigger: ['buttonLabel'], target: 'buttonUrl' } },
  DownloadResources: { items: { trigger: ['buttonLabel'], target: 'url' } },
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
};

const FIELD_LABELS: Record<string, string> = {
  eyebrow: '보조 문구',
  title: '제목',
  heading: '제목',
  body: '본문',
  description: '설명',
  primaryLabel: '주 버튼',
  secondaryLabel: '보조 버튼',
  ctaLabel: '문의 버튼',
  mapLabel: '지도 버튼',
  buttonLabel: '버튼',
  linkLabel: '링크',
  directionsLabel: '길찾기 버튼',
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
  'g7-product-grid': 'G7ProductGrid',
  'g7-product-showcase': 'G7ProductShowcase',
};

function selectionFromPath(blockId: string, blockType: string, fieldPath: string, role: CanvasElementRole): CanvasElementSelection {
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

export function notifyCanvasElementSelection(
  event: React.PointerEvent<HTMLElement>,
  blockId: string,
  blockType: string,
): void {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;

  const selectable = target.closest<HTMLElement>('[data-g7pb-media-field], [data-g7pb-action-field], [data-g7pb-inline-field]');
  const fieldPath = selectable?.dataset.g7pbMediaField ?? selectable?.dataset.g7pbActionField
    ?? selectable?.dataset.g7pbInlineField ?? null;
  const inferredAction = fieldPath ? resolveRouteFieldPath(COMPONENT_TYPE_BY_BLOCK_TYPE[blockType] ?? blockType, fieldPath) : null;
  const role: CanvasElementRole = selectable?.dataset.g7pbMediaField
    ? 'media'
    : selectable?.dataset.g7pbActionField || inferredAction ? 'action' : fieldPath ? 'text' : 'block';
  const selection = fieldPath
    ? selectionFromPath(blockId, blockType, fieldPath, role)
    : { blockId, blockType, fieldPath: null, role, label: '블록 전체', collection: null, itemIndex: null } satisfies CanvasElementSelection;

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
