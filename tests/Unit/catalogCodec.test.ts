// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { canonicalCatalogBlockToPuck, catalogPuckBlockToCanonical } from '../../resources/js/editor/catalogCodec';
import { asRecord, safeUrl } from '../../resources/js/editor/catalogData';
import {
  HERO_SPLIT_BLOCK_TYPE, HERO_SLIDER_BLOCK_TYPE, LOGO_CLOUD_BLOCK_TYPE, STATS_BLOCK_TYPE,
  PRICING_BLOCK_TYPE, TEAM_BLOCK_TYPE, GALLERY_BLOCK_TYPE, BAR_CHART_BLOCK_TYPE,
  G7_RECENT_POSTS_BLOCK_TYPE, G7_PRODUCT_GRID_BLOCK_TYPE, INQUIRY_FORM_BLOCK_TYPE, MAP_DIRECTIONS_BLOCK_TYPE,
  HEADING_BLOCK_TYPE, LOGO_CAROUSEL_BLOCK_TYPE, COMPARISON_TABLE_BLOCK_TYPE, G7_POST_DETAIL_BLOCK_TYPE, DIVIDER_BLOCK_TYPE,
} from '../../resources/js/documents/builtinBlockContracts';
import type { PageBuilderBlock } from '../../resources/js/documents/types';

function block(type: string, props: Record<string, unknown> = {}): PageBuilderBlock {
  return { instance_id: '123e4567-e89b-42d3-a456-426614174030', type, block_version: 1, props, slots: {} };
}

const routes = [
  [HERO_SPLIT_BLOCK_TYPE, 'HeroSplit'], [HERO_SLIDER_BLOCK_TYPE, 'HeroSlider'],
  [LOGO_CLOUD_BLOCK_TYPE, 'LogoCloud'], [STATS_BLOCK_TYPE, 'Stats'], [PRICING_BLOCK_TYPE, 'Pricing'],
  [TEAM_BLOCK_TYPE, 'Team'], [GALLERY_BLOCK_TYPE, 'Gallery'], [BAR_CHART_BLOCK_TYPE, 'BarChart'],
  [G7_RECENT_POSTS_BLOCK_TYPE, 'G7RecentPosts'], [G7_PRODUCT_GRID_BLOCK_TYPE, 'G7ProductGrid'],
  [INQUIRY_FORM_BLOCK_TYPE, 'InquiryForm'], [MAP_DIRECTIONS_BLOCK_TYPE, 'MapDirections'],
  [HEADING_BLOCK_TYPE, 'Heading'], [LOGO_CAROUSEL_BLOCK_TYPE, 'LogoCarousel'],
  [COMPARISON_TABLE_BLOCK_TYPE, 'ComparisonTable'], [G7_POST_DETAIL_BLOCK_TYPE, 'G7PostDetail'],
  [DIVIDER_BLOCK_TYPE, 'Divider'],
] as const;

describe('catalog conversion without the editor runtime', () => {
  it.each(routes)('routes %s to %s and keeps explicit appearance and source ownership', (type, editorType) => {
    const original = block(type, { appearance: { surface: 'default', spacing: 'normal',
      elements: { heading: { weight: 'bold' } } } });
    const before = structuredClone(original);
    const result = canonicalCatalogBlockToPuck(original);
    if (!result) throw new Error('Missing catalog conversion');
    expect(result.type).toBe(editorType);
    expect(result.props).toMatchObject({ surface: 'default', spacing: 'normal',
      elementStyles: { heading: { weight: 'bold' } } });
    const restored = catalogPuckBlockToCanonical(result.type, { ...result.props }, true);
    expect(restored).toMatchObject({ type, props: { appearance: original.props.appearance } });
    expect(original).toEqual(before);
  });

  it('preserves missing, malformed and array-shaped appearance handling and unknown dispatch', () => {
    const fallback = { surface: 'contrast', spacing: 'spacious' };
    expect(canonicalCatalogBlockToPuck(block(HERO_SLIDER_BLOCK_TYPE))?.props).toMatchObject(fallback);
    expect(canonicalCatalogBlockToPuck(block(HERO_SLIDER_BLOCK_TYPE,
      { appearance: { surface: 'bad', spacing: null } }))?.props).toMatchObject(fallback);
    const array = Object.assign([], { surface: 'default', spacing: 'normal' });
    expect(asRecord(array)).toBe(array);
    expect(canonicalCatalogBlockToPuck(block(HERO_SLIDER_BLOCK_TYPE, { appearance: array }))?.props)
      .toMatchObject({ surface: 'default', spacing: 'normal' });
    expect(catalogPuckBlockToCanonical('HeroSlider', { slides: [] }, false)?.props).toEqual({ slides: [] });
    expect(canonicalCatalogBlockToPuck(block('vendor/unsupported'))).toBeNull();
    expect(catalogPuckBlockToCanonical('Unsupported', {}, true)).toBeNull();
  });

  it('omits untouched slider settings and retains explicit/nondefault settings without changing input', () => {
    const raw = { slides: [{ title: 'Sentinel' }], autoplay: 'yes', interval: '5000', loop: 'yes' };
    const before = structuredClone(raw);
    const omitted = catalogPuckBlockToCanonical('HeroSlider', raw, false)?.props;
    expect(omitted).not.toHaveProperty('autoplay');
    expect(omitted).not.toHaveProperty('interval');
    expect(omitted).not.toHaveProperty('loop');
    expect(catalogPuckBlockToCanonical('HeroSlider', raw, false, true)?.props)
      .toMatchObject({ autoplay: true, interval: 5000, loop: true });
    expect(catalogPuckBlockToCanonical('HeroSlider', { ...raw, autoplay: 'no', interval: '3000', loop: 'no' }, false)?.props)
      .toMatchObject({ autoplay: false, interval: 3000, loop: false });
    expect(raw).toEqual(before);
  });

  it('keeps optional CTA/image and map image fields absent until their values or provider require them', () => {
    expect(catalogPuckBlockToCanonical('HeroSplit', {}, false)?.props).not.toHaveProperty('primaryCta');
    expect(catalogPuckBlockToCanonical('HeroSplit', {}, false)?.props).not.toHaveProperty('image');
    const withValues = catalogPuckBlockToCanonical('HeroSplit', { primaryLabel: 'Action', imageAlt: 'Alt' }, false);
    expect(withValues?.props).toMatchObject({ primaryCta: { label: 'Action', url: '' }, image: { src: '', alt: 'Alt' } });
    expect(catalogPuckBlockToCanonical('MapDirections', { provider: 'none' }, false)?.props).not.toHaveProperty('mapImageSrc');
    expect(catalogPuckBlockToCanonical('MapDirections', { provider: 'image' }, false)?.props)
      .toMatchObject({ mapImageSrc: '', mapImageAlt: '' });
    expect(catalogPuckBlockToCanonical('MapDirections', { provider: 'none', mapImageAlt: 'Preserved' }, false)?.props)
      .toMatchObject({ provider: 'none', mapImageSrc: '', mapImageAlt: 'Preserved' });
  });

  it('preserves pricing feature forms, trimming, booleans and plan ordering', () => {
    const plans = [
      { name: 'One', features: [' Keep ', { text: 'Also' }, { text: '  ' }], featured: true },
      { name: 'Two', featuresText: ' First\n\n Second ', featured: 'no' },
    ];
    const before = structuredClone(plans);
    const editor = canonicalCatalogBlockToPuck(block(PRICING_BLOCK_TYPE, { plans }));
    expect(editor?.props).toMatchObject({ plans: [
      { name: 'One', features: [{ text: ' Keep ' }, { text: 'Also' }, { text: '  ' }], featured: 'yes' },
      { name: 'Two', features: [{ text: 'First' }, { text: 'Second' }], featured: 'no' },
    ] });
    expect(catalogPuckBlockToCanonical('Pricing', { plans }, false)?.props).toMatchObject({ plans: [
      { name: 'One', features: ['Keep', 'Also'], featured: true },
      { name: 'Two', features: ['First', 'Second'], featured: false },
    ] });
    expect(plans).toEqual(before);
  });

  it('bounds array length and chart values without reordering or mutating records', () => {
    const items = [-2, 48, 200, Infinity, NaN, 0, 15, 20, 90].map((value, index) => ({ label: `Item ${index}`, value }));
    const before = structuredClone(items);
    const encoded = catalogPuckBlockToCanonical('BarChart', { items }, false);
    expect(encoded?.props.items).toEqual([0, 48, 100, 0, 0, 0, 15, 20].map((value, index) => ({ label: `Item ${index}`, value, tone: 'blue' })));
    expect(items).toEqual(before);
    const slides = Array.from({ length: 6 }, (_, index) => ({ title: `Slide ${index}` }));
    expect(catalogPuckBlockToCanonical('HeroSlider', { slides }, false)?.props.slides)
      .toEqual(slides.slice(0, 5).map(({ title }) => ({ eyebrow: '', title, body: '', buttonLabel: '', buttonUrl: '', imageSrc: '', imageAlt: '' })));
  });

  it('retains direction-specific numeric and boolean coercion rather than broadening the schema', () => {
    expect(canonicalCatalogBlockToPuck(block(G7_RECENT_POSTS_BLOCK_TYPE, { limit: 9, pageSize: 2 }))?.props)
      .toMatchObject({ limit: '6', pageSize: '3' });
    expect(catalogPuckBlockToCanonical('G7RecentPosts', { limit: '9', pageSize: '2' }, false)?.props)
      .toMatchObject({ limit: 9, pageSize: 2 });
    expect(canonicalCatalogBlockToPuck(block(GALLERY_BLOCK_TYPE, { columns: 2 }))?.props).toHaveProperty('columns', '2');
    expect(catalogPuckBlockToCanonical('Gallery', { columns: 2 }, false)?.props).toHaveProperty('columns', 3);
    expect(catalogPuckBlockToCanonical('G7ProductGrid', { limit: 0, columns: '2', pageSize: '6' }, false)?.props)
      .toMatchObject({ limit: 4, columns: 2, pageSize: 6 });
    expect(canonicalCatalogBlockToPuck(block(HERO_SLIDER_BLOCK_TYPE, { autoplay: false, loop: false, interval: '3000' }))?.props)
      .toMatchObject({ autoplay: 'no', loop: 'no', interval: '5000' });
    expect(catalogPuckBlockToCanonical('InquiryForm', { showPhone: 'no', showSubject: false }, false)?.props)
      .toMatchObject({ showPhone: true, showSubject: false });
  });

  it('keeps stored link text intact and limits preview navigation separately', () => {
    const url = ' javascript:alert(1) ';
    expect(catalogPuckBlockToCanonical('HeroSplit', { primaryLabel: 'Action', primaryUrl: url }, false)?.props.primaryCta)
      .toEqual({ label: 'Action', url });
    expect(safeUrl(url)).toBeNull();
    expect(safeUrl('//outside.test')).toBeNull();
    expect(safeUrl('http://outside.test')).toBeNull();
    expect(safeUrl(' /local/path ')).toBe('/local/path');
    expect(safeUrl(' https://example.test/a ')).toBe('https://example.test/a');
  });
});
