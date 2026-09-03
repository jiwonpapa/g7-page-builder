import {
  DOWNLOAD_RESOURCES_BLOCK_TYPE,
  EVENT_SCHEDULE_BLOCK_TYPE,
  G7_BOARD_ARCHIVE_BLOCK_TYPE,
  G7_PRODUCT_SHOWCASE_BLOCK_TYPE,
  LOGO_CAROUSEL_BLOCK_TYPE,
  TESTIMONIAL_SLIDER_BLOCK_TYPE,
} from '../documents/builtinBlockContracts';
import type { BlockAppearance, PageBuilderBlock } from '../documents/types';
import { appearance, attachAppearance, type AppearanceEditorProps } from './catalogAppearance';
import { normalizeBlockMotion } from './blockMotionData';
import {
  type G7BoardArchiveEditorProps,
  type G7ProductShowcaseEditorProps,
  type Phase3CatalogEditorComponents,
  type Phase3ComponentType,
  DEFAULT_BOARD_ARCHIVE,
  DEFAULT_PRODUCT_SHOWCASE,
  asRecord,
  asString,
  normalizeLogos,
  normalizeTestimonials,
  normalizeEvents,
  normalizeDownloads,
} from './phase3CatalogData';

function common(block: PageBuilderBlock, fallback: BlockAppearance): AppearanceEditorProps { return { ...appearance(asRecord(block.props.appearance), fallback), motion: normalizeBlockMotion(block.motion) }; }

export function canonicalPhase3BlockToPuck(block: PageBuilderBlock): { type: Phase3ComponentType; props: Phase3CatalogEditorComponents[Phase3ComponentType] } | null {
  const props = block.props;
  if (block.type === LOGO_CAROUSEL_BLOCK_TYPE) return { type: 'LogoCarousel', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), logos: normalizeLogos(props.logos), autoplay: props.autoplay === false ? 'no' : 'yes', interval: props.interval === 3000 ? '3000' : props.interval === 7000 ? '7000' : '5000', ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === TESTIMONIAL_SLIDER_BLOCK_TYPE) return { type: 'TestimonialSlider', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeTestimonials(props.items), autoplay: props.autoplay === false ? 'no' : 'yes', interval: props.interval === 5000 ? '5000' : props.interval === 9000 ? '9000' : '7000', ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  if (block.type === EVENT_SCHEDULE_BLOCK_TYPE) return { type: 'EventSchedule', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeEvents(props.items), layout: props.layout === 'timeline' ? 'timeline' : 'agenda', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === DOWNLOAD_RESOURCES_BLOCK_TYPE) return { type: 'DownloadResources', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeDownloads(props.items), ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  if (block.type === G7_BOARD_ARCHIVE_BLOCK_TYPE) return { type: 'G7BoardArchive', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' ? 'popular' : 'recent', period: ['today', 'week', 'year'].includes(asString(props.period)) ? asString(props.period) as G7BoardArchiveEditorProps['period'] : 'month', limit: ['6', '8'].includes(String(props.limit)) ? String(props.limit) as G7BoardArchiveEditorProps['limit'] : '12', pageSize: ['3', '4'].includes(String(props.pageSize)) ? String(props.pageSize) as G7BoardArchiveEditorProps['pageSize'] : '6', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', showSearch: props.showSearch !== false, showBoardFilter: props.showBoardFilter !== false, emptyMessage: asString(props.emptyMessage, DEFAULT_BOARD_ARCHIVE.emptyMessage), ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === G7_PRODUCT_SHOWCASE_BLOCK_TYPE) return { type: 'G7ProductShowcase', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' || props.source === 'latest' ? props.source : 'new', limit: ['3', '4', '8'].includes(String(props.limit)) ? String(props.limit) as G7ProductShowcaseEditorProps['limit'] : '6', pageSize: props.pageSize === 4 || props.pageSize === '4' ? '4' : '3', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', detailBasePath: asString(props.detailBasePath, '/shop/products'), layout: props.layout === 'rail' ? 'rail' : 'featured', emptyMessage: asString(props.emptyMessage, DEFAULT_PRODUCT_SHOWCASE.emptyMessage), ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  return null;
}

export function phase3PuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'LogoCarousel') return { type: LOGO_CAROUSEL_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), logos: normalizeLogos(raw.logos), autoplay: raw.autoplay !== 'no', interval: Number(raw.interval) || 5000 }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'TestimonialSlider') return { type: TESTIMONIAL_SLIDER_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeTestimonials(raw.items), autoplay: raw.autoplay !== 'no', interval: Number(raw.interval) || 7000 }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'EventSchedule') return { type: EVENT_SCHEDULE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeEvents(raw.items), layout: raw.layout === 'timeline' ? 'timeline' : 'agenda' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'DownloadResources') return { type: DOWNLOAD_RESOURCES_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeDownloads(raw.items) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7BoardArchive') return { type: G7_BOARD_ARCHIVE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' ? 'popular' : 'recent', period: ['today', 'week', 'year'].includes(asString(raw.period)) ? raw.period : 'month', limit: Number(raw.limit) || 12, pageSize: Number(raw.pageSize) || 6, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', showSearch: raw.showSearch !== false, showBoardFilter: raw.showBoardFilter !== false, emptyMessage: asString(raw.emptyMessage, DEFAULT_BOARD_ARCHIVE.emptyMessage) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7ProductShowcase') return { type: G7_PRODUCT_SHOWCASE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' || raw.source === 'latest' ? raw.source : 'new', limit: Number(raw.limit) || 6, pageSize: Number(raw.pageSize) || 3, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', detailBasePath: asString(raw.detailBasePath, '/shop/products'), layout: raw.layout === 'rail' ? 'rail' : 'featured', emptyMessage: asString(raw.emptyMessage, DEFAULT_PRODUCT_SHOWCASE.emptyMessage) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  return null;
}
