import { externalBlockForComponent, externalEditorDefaults, externalBlockForDocument } from '../blocks/runtimeRegistry';
import { externalEditorName, externalEditorProps, isExternalEditorItem, canonicalExternalProps, canonicalExternalMetadata } from '../blocks/externalEditorData';
import { layoutPolicy, validateLayoutDocument } from '../documents/layoutPolicy';
import type { PageBuilderBlock, PageBuilderDocument } from '../documents/types';
import type { BlockAppearance } from '../documents/blockPresentation';
import { LAYOUT_COLUMNS_BLOCK_TYPE, LAYOUT_SECTION_BLOCK_TYPE, LAYOUT_STACK_BLOCK_TYPE } from '../documents/layoutContracts';
import { CONTACT_BLOCK_TYPE, CTA_BLOCK_TYPE, FEATURES_BLOCK_TYPE, HERO_BLOCK_TYPE, type ContactBlockProps, type CtaBlockProps, type FeatureItem, type FeaturesBlockProps, type HeroBlockProps } from '../documents/builtinBlockContracts';
import { blockContainerEditorProps, mergeBlockContainerAppearance } from './blockAppearance';
import { DEFAULT_BLOCK_MOTION, normalizeBlockMotion } from './blockMotionData';
import { normalizeElementAppearanceMap } from './elementAppearanceData';
import { canonicalCatalogBlockToPuck, catalogPuckBlockToCanonical } from './catalogBlocks';
import { canonicalDocumentToPuck, puckDocumentToCanonical, type PuckAdapterContext, type PuckEditorSession } from './puckDocumentAdapter';
import type { ContactEditorProps, CtaEditorProps, FeaturesEditorProps, HeroEditorProps, PuckEditorData } from './puckEditorTypes';
import { hasResponsiveOverrides, normalizeResponsiveOverrides } from './responsiveBlockStyle';

import { normalizeSurface, normalizeSpacing } from './catalogAppearance';
export { normalizeSurface, normalizeSpacing } from './catalogAppearance';

// The canonical↔vendor boundary owns conversion and normalization. It has no
// editor selection, API calls, portals, React state or DOM responsibilities.
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const SAFE_ICONS = new Set(['sparkles', 'shield', 'bolt', 'heart']);

export const DEFAULT_FEATURES: FeaturesEditorProps = {
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

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeAlignment(value: unknown): HeroEditorProps['alignment'] {
  return value === 'left' ? 'left' : 'center';
}

export function normalizeTheme(value: unknown): CtaEditorProps['theme'] {
  return value === 'dark' ? 'dark' : 'light';
}

export function normalizeHeroLayout(value: unknown): HeroEditorProps['layout'] {
  return value === 'product' || value === 'poster' || value === 'backdrop' || value === 'editorial' || value === 'device'
    || value === 'balanced' || value === 'screenshot' || value === 'overlap' || value === 'offset'
    ? value
    : 'classic';
}

export function isSplitHeroLayout(layout: HeroEditorProps['layout']): layout is 'balanced' | 'screenshot' | 'overlap' | 'offset' {
  return layout === 'balanced' || layout === 'screenshot' || layout === 'overlap' || layout === 'offset';
}

export function normalizeFeaturesLayout(value: unknown): FeaturesEditorProps['layout'] {
  return value === 'bento' || value === 'editorial' || value === 'panel' || value === 'list' ? value : 'grid';
}

export function normalizeCtaLayout(value: unknown): CtaEditorProps['layout'] {
  return value === 'centered' || value === 'banner' || value === 'panel' ? value : 'split';
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

export function normalizeFeatureItems(value: unknown): FeatureItem[] {
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

export function idToUuid(id: unknown): string {
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
    } as PuckEditorData['content'][number];
  }

  if (block.type === LAYOUT_COLUMNS_BLOCK_TYPE) {
    const columns = block.props.columns === 1 || block.props.columns === 3 ? block.props.columns : 2;
    const ratios: readonly string[] = layoutPolicy.ratios[columns];
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
    } as PuckEditorData['content'][number];
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
    } as PuckEditorData['content'][number];
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
    } as PuckEditorData['content'][number];
  }

  const externalBlock = externalBlockForDocument(block.type, block.block_version);
  if (externalBlock) {
    return {
      type: externalEditorName(externalBlock.editor_component),
      props: {
        ...externalEditorProps(block, externalEditorDefaults(externalBlock.editor_component)),
        id: block.instance_id,
      },
    };
  }

  throw new Error(`Unsupported PageBuilder block: ${block.type}`);
}

export function canonicalBlockToPuck(block: PageBuilderBlock): PuckEditorData['content'][number] {
  const converted = canonicalBlockToPuckRaw(block);
  if (isExternalEditorItem(converted)) return converted;
  // The raw converter created a new props object; augment that object without
  // erasing the discriminated type/props relationship through a double cast.
  Object.assign(converted.props, blockContainerEditorProps(block.props.appearance), {
    responsiveOverrides: normalizeResponsiveOverrides(block.responsive),
    __g7pbVisibilityAudience: block.visibility?.audience ?? 'all',
  });
  return converted;
}

export function canonicalToPuck(document: PageBuilderDocument): PuckEditorSession {
  if (document.schema_version === 'g7-page-builder/v2') validateLayoutDocument(document);
  return canonicalDocumentToPuck(document, canonicalBlockToPuck);
}

export function puckBlockToCanonical(
  block: PuckEditorData['content'][number],
  context: PuckAdapterContext,
): PageBuilderBlock {
  const instanceId = idToUuid(block.props.id);
  if (isExternalEditorItem(block)) {
    const descriptor = externalBlockForComponent(block.type);
    if (!descriptor) throw new Error(`Unsupported Puck component: ${block.type}`);
    return { instance_id: instanceId, type: descriptor.block_id, block_version: descriptor.block_version,
      props: canonicalExternalProps(block.props), ...canonicalExternalMetadata(block.props.metadata) };
  }
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
    const ratios: readonly string[] = layoutPolicy.ratios[columns];
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
    if (!catalogBlock) throw new Error(`Unsupported Puck component: ${(block as { type: string }).type}`);
    type = catalogBlock.type;
    props = catalogBlock.props;
  }

  const canonical: PageBuilderBlock = {
    instance_id: instanceId,
    type,
    block_version: blockVersion,
    props: { ...props },
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
