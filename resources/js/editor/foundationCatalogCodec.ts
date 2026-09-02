import { BUTTONS_BLOCK_TYPE, HEADING_BLOCK_TYPE, ICON_LIST_BLOCK_TYPE, IMAGE_BLOCK_TYPE, IMAGE_TEXT_BLOCK_TYPE, RICH_TEXT_BLOCK_TYPE } from '../documents/builtinBlockContracts';
import type { BlockAppearance, PageBuilderBlock } from '../documents/types';
import type { AppearanceEditorProps } from './catalogAppearance';
import { appearance, attachAppearance } from './catalogAppearance';
import { normalizeBlockMotion } from './blockMotionData';
import { asString, asRecord, normalizeButtons, normalizeIconItems, normalizeAnchor, type FoundationComponentType, type FoundationCatalogEditorComponents } from './foundationCatalogData';

function common(block: PageBuilderBlock, fallback: BlockAppearance): Pick<AppearanceEditorProps, 'surface' | 'spacing' | 'textScale' | 'textAlign' | 'elementStyles' | 'motion'> {
  return { ...appearance(asRecord(block.props.appearance), fallback), motion: normalizeBlockMotion(block.motion) };
}

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
