import type { BlockAppearance, ElementAppearanceMap } from '../documents/blockPresentation';
import { appearance as normalizeCatalogAppearance, attachAppearance } from './catalogAppearance';
import { asRecord, asString, heroSplitLayout, normalizeHeroSlides, normalizeLogos, logoLayout, normalizeStats, statsLayout, normalizePricingEditor, pricingLayout, normalizeMembers, teamLayout, normalizeImages, galleryLayout, normalizeBars } from './catalogData';
import type { PageBuilderBlock } from '../documents/types';
import type { CatalogComponentType, CatalogEditorComponents, G7RecentPostsEditorProps, G7ProductGridEditorProps, MapDirectionsEditorProps } from './catalogEditorTypes';
import { canonicalFoundationBlockToPuck, foundationPuckBlockToCanonical } from './foundationCatalogCodec';
import { canonicalPhase2BlockToPuck, phase2PuckBlockToCanonical } from './phase2CatalogCodec';
import { canonicalPhase3BlockToPuck, phase3PuckBlockToCanonical } from './phase3CatalogCodec';
import { canonicalPhase4BlockToPuck, phase4PuckBlockToCanonical } from './phase4CatalogCodec';
import { canonicalProductionBlockToPuck, productionPuckBlockToCanonical } from './productionCatalogCodec';
import { HERO_SPLIT_BLOCK_TYPE, HERO_SLIDER_BLOCK_TYPE, LOGO_CLOUD_BLOCK_TYPE, STATS_BLOCK_TYPE, PRICING_BLOCK_TYPE, TEAM_BLOCK_TYPE, GALLERY_BLOCK_TYPE, BAR_CHART_BLOCK_TYPE, G7_RECENT_POSTS_BLOCK_TYPE, G7_PRODUCT_GRID_BLOCK_TYPE, INQUIRY_FORM_BLOCK_TYPE, MAP_DIRECTIONS_BLOCK_TYPE } from '../documents/builtinBlockContracts';
import { normalizeBlockMotion } from './blockMotionData';
import type { InquiryFormKind, PricingPlanItem } from '../documents/builtinBlockContracts';

function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } {
  return normalizeCatalogAppearance(asRecord(value), fallback);
}

export function canonicalCatalogBlockToPuck(block: PageBuilderBlock): { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] } | null {
  const foundationBlock = canonicalFoundationBlockToPuck(block);
  if (foundationBlock) return foundationBlock as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const phase2Block = canonicalPhase2BlockToPuck(block);
  if (phase2Block) return phase2Block as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const phase3Block = canonicalPhase3BlockToPuck(block);
  if (phase3Block) return phase3Block as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const phase4Block = canonicalPhase4BlockToPuck(block);
  if (phase4Block) return phase4Block as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const productionBlock = canonicalProductionBlockToPuck(block);
  if (productionBlock) return productionBlock as { type: CatalogComponentType; props: CatalogEditorComponents[CatalogComponentType] };
  const props = block.props;
  if (block.type === HERO_SPLIT_BLOCK_TYPE) {
    const cta = asRecord(props.primaryCta); const image = asRecord(props.image);
    return { type: 'HeroSplit', props: { eyebrow: asString(props.eyebrow), title: asString(props.title), body: asString(props.body), primaryLabel: asString(cta.label), primaryUrl: asString(cta.url), imageSrc: asString(image.src), imageAlt: asString(image.alt), mediaPosition: props.mediaPosition === 'left' ? 'left' : 'right', layout: heroSplitLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  }
  if (block.type === HERO_SLIDER_BLOCK_TYPE) return { type: 'HeroSlider', props: { slides: normalizeHeroSlides(props.slides), autoplay: props.autoplay === false ? 'no' : 'yes', interval: props.interval === 3000 ? '3000' : props.interval === 7000 ? '7000' : '5000', loop: props.loop === false ? 'no' : 'yes', ...appearance(props.appearance, { surface: 'contrast', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === LOGO_CLOUD_BLOCK_TYPE) return { type: 'LogoCloud', props: { heading: asString(props.heading), logos: normalizeLogos(props.logos), layout: logoLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'compact' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === STATS_BLOCK_TYPE) return { type: 'Stats', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeStats(props.items), layout: statsLayout(props.layout), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === PRICING_BLOCK_TYPE) return { type: 'Pricing', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), plans: normalizePricingEditor(props.plans), layout: pricingLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'spacious' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === TEAM_BLOCK_TYPE) return { type: 'Team', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), members: normalizeMembers(props.members), layout: teamLayout(props.layout), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === GALLERY_BLOCK_TYPE) return { type: 'Gallery', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), images: normalizeImages(props.images), columns: props.columns === 2 || props.columns === '2' ? '2' : props.columns === 4 || props.columns === '4' ? '4' : '3', layout: galleryLayout(props.layout), ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === BAR_CHART_BLOCK_TYPE) return { type: 'BarChart', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), unit: asString(props.unit), items: normalizeBars(props.items), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === G7_RECENT_POSTS_BLOCK_TYPE) return { type: 'G7RecentPosts', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' ? 'popular' : 'recent', period: ['today', 'month', 'year'].includes(asString(props.period)) ? asString(props.period) as G7RecentPostsEditorProps['period'] : 'week', limit: ['3', '4', '8', '12'].includes(String(props.limit)) ? String(props.limit) as G7RecentPostsEditorProps['limit'] : '6', pageSize: ['4', '6'].includes(String(props.pageSize)) ? String(props.pageSize) as G7RecentPostsEditorProps['pageSize'] : '3', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', emptyMessage: asString(props.emptyMessage, '표시할 게시글이 없습니다.'), ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === G7_PRODUCT_GRID_BLOCK_TYPE) return { type: 'G7ProductGrid', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' || props.source === 'latest' ? props.source : 'new', limit: ['2', '3', '6', '8', '12'].includes(String(props.limit)) ? String(props.limit) as G7ProductGridEditorProps['limit'] : '4', columns: props.columns === 2 || props.columns === '2' ? '2' : props.columns === 3 || props.columns === '3' ? '3' : '4', pageSize: ['2', '3', '6'].includes(String(props.pageSize)) ? String(props.pageSize) as G7ProductGridEditorProps['pageSize'] : '4', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', detailBasePath: asString(props.detailBasePath, '/shop/products'), emptyMessage: asString(props.emptyMessage, '표시할 상품이 없습니다.'), ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === INQUIRY_FORM_BLOCK_TYPE) return { type: 'InquiryForm', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), formKind: ['quote', 'reservation', 'application', 'newsletter'].includes(asString(props.formKind)) ? asString(props.formKind) as InquiryFormKind : 'inquiry', submitLabel: asString(props.submitLabel, '문의 보내기'), successMessage: asString(props.successMessage, '문의가 접수되었습니다.'), privacyLabel: asString(props.privacyLabel, '개인정보 수집 및 이용에 동의합니다.'), showPhone: props.showPhone !== false, showSubject: props.showSubject !== false, ...appearance(props.appearance, { surface: 'soft', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  if (block.type === MAP_DIRECTIONS_BLOCK_TYPE) return { type: 'MapDirections', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), description: asString(props.description), address: asString(props.address), latitude: typeof props.latitude === 'number' ? props.latitude : 37.5665, longitude: typeof props.longitude === 'number' ? props.longitude : 126.978, zoom: ['12', '14', '18'].includes(String(props.zoom)) ? String(props.zoom) as MapDirectionsEditorProps['zoom'] : '16', provider: props.provider === 'image' || props.provider === 'google' || props.provider === 'none' ? props.provider : 'openstreetmap', mapImageSrc: asString(props.mapImageSrc), mapImageAlt: asString(props.mapImageAlt), directionsLabel: asString(props.directionsLabel, '길찾기'), directionsUrl: asString(props.directionsUrl, 'https://www.openstreetmap.org/'), phone: asString(props.phone), hours: asString(props.hours), parking: asString(props.parking), ...appearance(props.appearance, { surface: 'default', spacing: 'normal' }), motion: normalizeBlockMotion(block.motion) } };
  return null;
}

export function catalogPuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean, includeSliderSettings = false): { type: string; props: Record<string, unknown> } | null {
  const foundationBlock = foundationPuckBlockToCanonical(type, raw, includeAppearance);
  if (foundationBlock) return foundationBlock;
  const phase2Block = phase2PuckBlockToCanonical(type, raw, includeAppearance);
  if (phase2Block) return phase2Block;
  const phase3Block = phase3PuckBlockToCanonical(type, raw, includeAppearance);
  if (phase3Block) return phase3Block;
  const phase4Block = phase4PuckBlockToCanonical(type, raw, includeAppearance);
  if (phase4Block) return phase4Block;
  const productionBlock = productionPuckBlockToCanonical(type, raw, includeAppearance);
  if (productionBlock) return productionBlock;
  if (type === 'HeroSplit') {
    const props: Record<string, unknown> = { eyebrow: asString(raw.eyebrow), title: asString(raw.title), body: asString(raw.body), mediaPosition: raw.mediaPosition === 'left' ? 'left' : 'right', layout: heroSplitLayout(raw.layout) };
    if (asString(raw.primaryLabel) || asString(raw.primaryUrl)) props.primaryCta = { label: asString(raw.primaryLabel), url: asString(raw.primaryUrl) };
    if (asString(raw.imageSrc) || asString(raw.imageAlt)) props.image = { src: asString(raw.imageSrc), alt: asString(raw.imageAlt) };
    return { type: HERO_SPLIT_BLOCK_TYPE, props: attachAppearance(props, raw, { surface: 'default', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'HeroSlider') {
    const props: Record<string, unknown> = { slides: normalizeHeroSlides(raw.slides) };
    if (includeSliderSettings || raw.autoplay === 'no' || raw.interval === '3000' || raw.interval === '7000' || raw.loop === 'no') {
      props.autoplay = raw.autoplay !== 'no';
      props.interval = raw.interval === '3000' ? 3000 : raw.interval === '7000' ? 7000 : 5000;
      props.loop = raw.loop !== 'no';
    }
    return { type: HERO_SLIDER_BLOCK_TYPE, props: attachAppearance(props, raw, { surface: 'contrast', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'LogoCloud') return { type: LOGO_CLOUD_BLOCK_TYPE, props: attachAppearance({ heading: asString(raw.heading), logos: normalizeLogos(raw.logos), layout: logoLayout(raw.layout) }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'Stats') return { type: STATS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeStats(raw.items), layout: statsLayout(raw.layout) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Pricing') {
    const plans: PricingPlanItem[] = normalizePricingEditor(raw.plans).map((plan) => ({ name: plan.name, price: plan.price, period: plan.period, description: plan.description, features: plan.features.map((feature) => feature.text.trim()).filter(Boolean), buttonLabel: plan.buttonLabel, buttonUrl: plan.buttonUrl, featured: plan.featured === 'yes' }));
    return { type: PRICING_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), plans, layout: pricingLayout(raw.layout) }, raw, { surface: 'default', spacing: 'spacious' }, includeAppearance) };
  }
  if (type === 'Team') return { type: TEAM_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), members: normalizeMembers(raw.members), layout: teamLayout(raw.layout) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'Gallery') return { type: GALLERY_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), images: normalizeImages(raw.images), columns: raw.columns === '2' ? 2 : raw.columns === '4' ? 4 : 3, layout: galleryLayout(raw.layout) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'BarChart') return { type: BAR_CHART_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), unit: asString(raw.unit), items: normalizeBars(raw.items) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7RecentPosts') return { type: G7_RECENT_POSTS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' ? 'popular' : 'recent', period: ['today', 'month', 'year'].includes(asString(raw.period)) ? raw.period : 'week', limit: Number(raw.limit) || 6, pageSize: Number(raw.pageSize) || 3, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', emptyMessage: asString(raw.emptyMessage, '표시할 게시글이 없습니다.') }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7ProductGrid') return { type: G7_PRODUCT_GRID_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' || raw.source === 'latest' ? raw.source : 'new', limit: Number(raw.limit) || 4, columns: Number(raw.columns) || 4, pageSize: Number(raw.pageSize) || 4, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', detailBasePath: asString(raw.detailBasePath, '/shop/products'), emptyMessage: asString(raw.emptyMessage, '표시할 상품이 없습니다.') }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'InquiryForm') return { type: INQUIRY_FORM_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), formKind: ['quote', 'reservation', 'application', 'newsletter'].includes(asString(raw.formKind)) ? raw.formKind : 'inquiry', submitLabel: asString(raw.submitLabel), successMessage: asString(raw.successMessage), privacyLabel: asString(raw.privacyLabel), showPhone: raw.showPhone !== false, showSubject: raw.showSubject !== false }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'MapDirections') {
    const provider = raw.provider === 'image' || raw.provider === 'google' || raw.provider === 'none' ? raw.provider : 'openstreetmap';
    const mapProps: Record<string, unknown> = {
      eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), description: asString(raw.description), address: asString(raw.address),
      latitude: typeof raw.latitude === 'number' ? raw.latitude : 37.5665, longitude: typeof raw.longitude === 'number' ? raw.longitude : 126.978,
      zoom: Number(raw.zoom) || 16, provider, directionsLabel: asString(raw.directionsLabel), directionsUrl: asString(raw.directionsUrl),
      phone: asString(raw.phone), hours: asString(raw.hours), parking: asString(raw.parking),
    };
    const mapImageSrc = asString(raw.mapImageSrc);
    const mapImageAlt = asString(raw.mapImageAlt);
    if (provider === 'image' || mapImageSrc || mapImageAlt) {
      mapProps.mapImageSrc = mapImageSrc;
      mapProps.mapImageAlt = mapImageAlt;
    }
    return { type: MAP_DIRECTIONS_BLOCK_TYPE, props: attachAppearance(mapProps, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  }
  return null;
}
