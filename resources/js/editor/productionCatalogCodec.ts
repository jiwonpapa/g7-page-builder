import {
  ANCHOR_MENU_BLOCK_TYPE,
  BLOCKQUOTE_BLOCK_TYPE,
  BREADCRUMBS_BLOCK_TYPE,
  CARD_GRID_BLOCK_TYPE,
  DIVIDER_BLOCK_TYPE,
  IMAGE_CAROUSEL_BLOCK_TYPE,
  NOTICE_BLOCK_TYPE,
  SOCIAL_LINKS_BLOCK_TYPE,
} from '../documents/builtinBlockContracts';
import type { BlockAppearance, PageBuilderBlock } from '../documents/types';
import { appearance, attachAppearance, type AppearanceEditorProps } from './catalogAppearance';
import { normalizeBlockMotion } from './blockMotionData';
import {
  type ProductionCatalogEditorComponents,
  type ProductionComponentType,
  asString,
  asRecord,
  normalizeCards,
  normalizeBreadcrumbs,
  normalizeAnchors,
  normalizeSocialLinks,
  normalizeImages,
} from './productionCatalogData';

function common(block: PageBuilderBlock, fallback: BlockAppearance): Pick<AppearanceEditorProps, 'surface' | 'spacing' | 'textScale' | 'textAlign' | 'elementStyles' | 'motion'> {
  return { ...appearance(asRecord(block.props.appearance), fallback), motion: normalizeBlockMotion(block.motion) };
}

export function canonicalProductionBlockToPuck(block: PageBuilderBlock): { type: ProductionComponentType; props: ProductionCatalogEditorComponents[ProductionComponentType] } | null {
  const props = block.props;
  if (block.type === DIVIDER_BLOCK_TYPE) return { type: 'Divider', props: { variant: props.variant === 'dashed' || props.variant === 'gradient' ? props.variant : 'solid', width: props.width === 'narrow' || props.width === 'full' ? props.width : 'standard', label: asString(props.label), ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === BLOCKQUOTE_BLOCK_TYPE) return { type: 'Blockquote', props: { quote: asString(props.quote), citation: asString(props.citation), role: asString(props.role), alignment: props.alignment === 'center' ? 'center' : 'left', variant: props.variant === 'line' ? 'line' : 'mark', ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  if (block.type === NOTICE_BLOCK_TYPE) return { type: 'Notice', props: { tone: props.tone === 'success' || props.tone === 'warning' || props.tone === 'critical' ? props.tone : 'info', title: asString(props.title), body: asString(props.body), actionLabel: asString(props.actionLabel), actionUrl: asString(props.actionUrl), ...common(block, { surface: 'soft', spacing: 'compact' }) } };
  if (block.type === CARD_GRID_BLOCK_TYPE) return { type: 'CardGrid', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeCards(props.items), columns: props.columns === 2 || props.columns === '2' ? '2' : '3', variant: props.variant === 'plain' ? 'plain' : 'outlined', layout: props.layout === 'bento' || props.layout === 'rail' || props.layout === 'editorial' || props.layout === 'numbered' ? props.layout : 'grid', ...common(block, { surface: 'default', spacing: 'normal' }) } };
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
  if (type === 'CardGrid') return { type: CARD_GRID_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeCards(raw.items), columns: raw.columns === '2' ? 2 : 3, variant: raw.variant === 'plain' ? 'plain' : 'outlined', layout: raw.layout === 'grid' || raw.layout === 'rail' || raw.layout === 'editorial' || raw.layout === 'numbered' ? raw.layout : 'bento' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'Breadcrumbs') return { type: BREADCRUMBS_BLOCK_TYPE, props: attachAppearance({ items: normalizeBreadcrumbs(raw.items), currentLabel: asString(raw.currentLabel) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'AnchorMenu') return { type: ANCHOR_MENU_BLOCK_TYPE, props: attachAppearance({ label: asString(raw.label), items: normalizeAnchors(raw.items), sticky: raw.sticky === true, alignment: raw.alignment === 'center' ? 'center' : 'left' }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'SocialLinks') return { type: SOCIAL_LINKS_BLOCK_TYPE, props: attachAppearance({ heading: asString(raw.heading), items: normalizeSocialLinks(raw.items), variant: raw.variant === 'labels' ? 'labels' : 'icons', alignment: raw.alignment === 'center' || raw.alignment === 'right' ? raw.alignment : 'left' }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'ImageCarousel') return { type: IMAGE_CAROUSEL_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), images: normalizeImages(raw.images), autoplay: raw.autoplay === true, interval: raw.interval === '3000' ? 3000 : raw.interval === '7000' ? 7000 : 5000, controls: raw.controls === 'arrows' || raw.controls === 'dots' ? raw.controls : 'both', aspectRatio: raw.aspectRatio === '4:3' || raw.aspectRatio === '1:1' ? raw.aspectRatio : '16:9' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  return null;
}
