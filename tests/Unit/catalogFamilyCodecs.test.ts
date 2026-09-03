// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BlockMotion, PageBuilderBlock } from '../../resources/js/documents/types';
import {
  TESTIMONIALS_BLOCK_TYPE, TABS_BLOCK_TYPE, VIDEO_EMBED_BLOCK_TYPE,
  LOGO_CAROUSEL_BLOCK_TYPE, TESTIMONIAL_SLIDER_BLOCK_TYPE, DOWNLOAD_RESOURCES_BLOCK_TYPE,
  G7_PRODUCT_SHOWCASE_BLOCK_TYPE, G7_PRODUCT_DETAIL_BLOCK_TYPE,
  DIVIDER_BLOCK_TYPE, BLOCKQUOTE_BLOCK_TYPE, NOTICE_BLOCK_TYPE, BREADCRUMBS_BLOCK_TYPE,
  ANCHOR_MENU_BLOCK_TYPE, SOCIAL_LINKS_BLOCK_TYPE, COMPARISON_TABLE_BLOCK_TYPE,
  G7_BOARD_ARCHIVE_BLOCK_TYPE, G7_POST_DETAIL_BLOCK_TYPE, CARD_GRID_BLOCK_TYPE, IMAGE_CAROUSEL_BLOCK_TYPE,
} from '../../resources/js/documents/builtinBlockContracts';

import * as phase2 from '../../resources/js/editor/phase2CatalogCodec';
import * as phase3 from '../../resources/js/editor/phase3CatalogCodec';
import * as phase4 from '../../resources/js/editor/phase4CatalogCodec';
import * as production from '../../resources/js/editor/productionCatalogCodec';

const families = [
  { name: 'phase2', fallback: { surface: 'soft', spacing: 'normal' }, acceptsArrayRecord: true, decode: phase2.canonicalPhase2BlockToPuck, encode: phase2.phase2PuckBlockToCanonical,
    affected: [TESTIMONIALS_BLOCK_TYPE, TABS_BLOCK_TYPE, VIDEO_EMBED_BLOCK_TYPE] },
  { name: 'phase3', fallback: { surface: 'default', spacing: 'compact' }, acceptsArrayRecord: false, decode: phase3.canonicalPhase3BlockToPuck, encode: phase3.phase3PuckBlockToCanonical,
    affected: [LOGO_CAROUSEL_BLOCK_TYPE, TESTIMONIAL_SLIDER_BLOCK_TYPE, DOWNLOAD_RESOURCES_BLOCK_TYPE, G7_PRODUCT_SHOWCASE_BLOCK_TYPE] },
  { name: 'phase4', fallback: { surface: 'soft', spacing: 'normal' }, acceptsArrayRecord: false, decode: phase4.canonicalPhase4BlockToPuck, encode: phase4.phase4PuckBlockToCanonical,
    affected: [G7_PRODUCT_DETAIL_BLOCK_TYPE] },
  { name: 'production', fallback: { surface: 'default', spacing: 'compact' }, acceptsArrayRecord: false, decode: production.canonicalProductionBlockToPuck, encode: production.productionPuckBlockToCanonical,
    affected: [DIVIDER_BLOCK_TYPE, BLOCKQUOTE_BLOCK_TYPE, NOTICE_BLOCK_TYPE, BREADCRUMBS_BLOCK_TYPE, ANCHOR_MENU_BLOCK_TYPE, SOCIAL_LINKS_BLOCK_TYPE] },
];

function block(type: string, props: Record<string, unknown> = {}): PageBuilderBlock {
  return { instance_id: '10000000-0000-4000-8000-000000000003', type, block_version: 1, props, slots: {} };
}

describe('catalog family conversion contracts', () => {
  it.each(families)('$name preserves explicit default/normal in both conversion directions', ({ decode, encode, affected }) => {
    for (const type of affected) {
      const appearance = { surface: 'default', spacing: 'normal' };
      const source = block(type, { appearance });
      const before = structuredClone(source);
      const converted = decode(source);
      if (!converted) throw new Error(`Missing conversion: ${type}`);
      expect(converted.props, type).toMatchObject(appearance);
      expect(encode(converted.type, { ...converted.props }, true)?.props.appearance, type).toEqual(appearance);
      expect(encode(converted.type, { ...converted.props, ...appearance }, true)?.props.appearance, type).toEqual(appearance);
      expect(source).toEqual(before);
    }
  });

  it.each(families)('$name preserves fallback, omission, element aliases and record classification', ({ decode, encode, affected, fallback, acceptsArrayRecord }) => {
    for (const appearance of [undefined, { surface: 'invalid', spacing: 'invalid' }]) {
      const converted = decode(block(affected[0], { appearance }));
      if (!converted) throw new Error('Missing conversion');
      expect(converted.props).toMatchObject(fallback);
      expect(encode(converted.type, { ...converted.props }, false)?.props).not.toHaveProperty('appearance');
      expect(encode(converted.type, { ...converted.props }, true)?.props.appearance).toEqual(fallback);
    }
    const styled = { ...fallback, textScale: 'large', textAlign: 'right', elements: { heading: { weight: 'bold' } } };
    const motion: BlockMotion = { preset: 'reveal', intensity: 'strong', trigger: 'repeat', stagger_ms: 160 };
    const source = { ...block(affected[0], { appearance: styled }), motion };
    const before = structuredClone(source);
    const converted = decode(source);
    if (!converted) throw new Error('Missing conversion');
    expect(converted.props.motion).toEqual(motion);
    expect(encode(converted.type, { ...converted.props }, false)?.props.appearance).toEqual(styled);
    const editorAlias = decode(block(affected[0], { appearance: { ...styled, elementStyles: {} } }));
    expect(editorAlias?.props.elementStyles).toBeUndefined();
    const explicitAlias = decode(block(affected[0], { appearance: { ...styled, elementStyles: { title: { tone: 'muted' } } } }));
    expect(explicitAlias?.props.elementStyles).toEqual({ title: { tone: 'muted' } });
    expect(encode(converted.type, { ...converted.props, textScale: 'balanced', textAlign: 'left', elementStyles: {} }, false)?.props)
      .not.toHaveProperty('appearance');
    const arrayAppearance = Object.assign([], { surface: 'contrast', spacing: 'spacious' });
    expect(decode(block(affected[0], { appearance: arrayAppearance }))?.props)
      .toMatchObject(acceptsArrayRecord ? { surface: 'contrast', spacing: 'spacious' } : fallback);
    expect(source).toEqual(before);
    expect(decode(block('unsupported'))).toBeNull();
    expect(encode('Unsupported', {}, false)).toBeNull();
  });

  it('keeps Tabs and comparison directional numeric and text-cell policies', () => {
    expect(phase2.canonicalPhase2BlockToPuck(block(TABS_BLOCK_TYPE, { initialTab: 99 }))?.props)
      .toMatchObject({ initialTab: '5' });
    expect(phase2.phase2PuckBlockToCanonical('Tabs', { initialTab: '99' }, false)?.props.initialTab).toBe(99);
    const source = block(COMPARISON_TABLE_BLOCK_TYPE, {
      columns: [{ title: 'First', description: '' }, { title: 'Second', description: '' }],
      rows: [{ feature: 'A', values: [' one ', 17, ' two ', 'three'] }], highlightColumn: '2',
    });
    const before = structuredClone(source);
    const converted = phase2.canonicalPhase2BlockToPuck(source);
    if (!converted) throw new Error('Missing comparison');
    expect(converted.props).toMatchObject({ rows: [{ feature: 'A', valuesText: ' one \n two \nthree' }], highlightColumn: 'none' });
    const encoded = phase2.phase2PuckBlockToCanonical('ComparisonTable', { ...converted.props, highlightColumn: '2.5' }, false);
    expect(encoded?.props).toMatchObject({ rows: [{ feature: 'A', values: ['one', 'two'] }], highlightColumn: 2.5 });
    expect(source).toEqual(before);
  });

  it('keeps page sizes, false flags and post identifiers direction-specific', () => {
    expect(phase3.canonicalPhase3BlockToPuck(block(G7_BOARD_ARCHIVE_BLOCK_TYPE, {
      pageSize: 4, limit: '8', showSearch: false, showBoardFilter: false, audience: 'member',
    }))?.props).toMatchObject({ pageSize: '4', limit: '8', showSearch: false, showBoardFilter: false, audience: 'member' });
    expect(phase3.canonicalPhase3BlockToPuck(block(G7_BOARD_ARCHIVE_BLOCK_TYPE, { pageSize: 97, limit: 97, audience: 'invalid' }))?.props)
      .toMatchObject({ pageSize: '6', limit: '12', audience: 'all' });
    expect(phase3.phase3PuckBlockToCanonical('G7BoardArchive', { pageSize: '97', limit: '97' }, false)?.props)
      .toMatchObject({ pageSize: 97, limit: 97 });
    expect(phase3.canonicalPhase3BlockToPuck(block(G7_PRODUCT_SHOWCASE_BLOCK_TYPE, { pageSize: '4', limit: 3 }))?.props)
      .toMatchObject({ pageSize: '4', limit: '3' });
    expect(phase3.canonicalPhase3BlockToPuck(block(G7_PRODUCT_SHOWCASE_BLOCK_TYPE, { pageSize: 6 }))?.props)
      .toMatchObject({ pageSize: '3' });
    expect(phase4.canonicalPhase4BlockToPuck(block(G7_POST_DETAIL_BLOCK_TYPE, { postId: '12', showContent: false }))?.props)
      .toMatchObject({ postId: 1, showContent: false });
    expect(phase4.phase4PuckBlockToCanonical('G7PostDetail', { postId: '12' }, false)?.props.postId).toBe(12);
    expect(phase4.canonicalPhase4BlockToPuck(block(G7_PRODUCT_DETAIL_BLOCK_TYPE, { showDescription: false, detailUrl: 'custom:keep' }))?.props)
      .toMatchObject({ showDescription: false, detailUrl: 'custom:keep' });
  });

  it('keeps the distinct string and boolean slider policies', () => {
    expect(phase3.canonicalPhase3BlockToPuck(block(LOGO_CAROUSEL_BLOCK_TYPE, { autoplay: false, interval: 9000 }))?.props)
      .toMatchObject({ autoplay: 'no', interval: '5000' });
    expect(phase3.canonicalPhase3BlockToPuck(block(TESTIMONIAL_SLIDER_BLOCK_TYPE, { autoplay: 'no', interval: 3000 }))?.props)
      .toMatchObject({ autoplay: 'yes', interval: '7000' });
    expect(phase3.phase3PuckBlockToCanonical('LogoCarousel', { autoplay: 'invalid', interval: '11000' }, false)?.props)
      .toMatchObject({ autoplay: true, interval: 11000 });
    expect(phase3.phase3PuckBlockToCanonical('TestimonialSlider', { autoplay: 'no', interval: '' }, false)?.props)
      .toMatchObject({ autoplay: false, interval: 7000 });
    expect(production.canonicalProductionBlockToPuck(block(IMAGE_CAROUSEL_BLOCK_TYPE, { autoplay: 'yes', interval: 9000 }))?.props)
      .toMatchObject({ autoplay: false, interval: '5000' });
    expect(production.productionPuckBlockToCanonical('ImageCarousel', { autoplay: true, interval: '11000' }, false)?.props)
      .toMatchObject({ autoplay: true, interval: 5000 });
    expect(production.productionPuckBlockToCanonical('AnchorMenu', { sticky: 'true' }, false)?.props.sticky).toBe(false);
  });

  it('preserves array order, caps, empty arrays and input data across family normalizers', () => {
    const items = Array.from({ length: 20 }, (_, index) => ({ label: `Tab ${index}`, heading: `Heading ${index}`, body: `<p>${index}</p>` }));
    const before = structuredClone(items);
    expect(phase2.canonicalPhase2BlockToPuck(block(TABS_BLOCK_TYPE, { items }))?.props)
      .toMatchObject({ items: items.slice(0, 6) });
    expect(phase2.phase2PuckBlockToCanonical('Tabs', { items: [] }, false)?.props.items).toEqual([]);
    const logos = items.map((item) => ({ name: item.label, imageSrc: '', imageAlt: '', url: 'custom:unchanged' }));
    const decoded = phase3.canonicalPhase3BlockToPuck(block(LOGO_CAROUSEL_BLOCK_TYPE, { logos }));
    expect(decoded?.props).toMatchObject({ logos: logos.slice(0, 12) });
    expect(phase3.phase3PuckBlockToCanonical('LogoCarousel', { logos: [] }, false)?.props.logos).toEqual([]);
    const cards = items.map((item) => ({ kicker: '', title: item.label, body: item.body, linkLabel: 'Go', linkUrl: 'custom:unchanged' }));
    expect(production.canonicalProductionBlockToPuck(block(CARD_GRID_BLOCK_TYPE, { items: cards }))?.props)
      .toMatchObject({ items: cards.slice(0, 6) });
    expect(production.productionPuckBlockToCanonical('CardGrid', { items: [] }, false)?.props.items).toEqual([]);
    expect(items).toEqual(before);
    if (!decoded) throw new Error('Missing logos');
    expect(phase3.phase3PuckBlockToCanonical(decoded.type, { ...decoded.props }, false)?.props.logos).toEqual(logos.slice(0, 12));
    expect(logos).toEqual(items.map((item) => ({ name: item.label, imageSrc: '', imageAlt: '', url: 'custom:unchanged' })));
  });

  it('keeps production anchor, network, URL and invalid layout policies', () => {
    const anchor = '123 ' + 'x'.repeat(90);
    expect(production.productionPuckBlockToCanonical('AnchorMenu', { items: [{ label: 'A', anchor }, { label: 'B', anchor: ' ### ' }] }, false)?.props.items)
      .toEqual([{ label: 'A', anchor: ('section-123-' + 'x'.repeat(90)).slice(0, 80) }, { label: 'B', anchor: 'section' }]);
    expect(production.productionPuckBlockToCanonical('SocialLinks', { items: [{ network: 'invalid', label: 'A', url: 'custom:unchanged' }] }, false)?.props.items)
      .toEqual([{ network: 'website', label: 'A', url: 'custom:unchanged' }]);
    expect(production.canonicalProductionBlockToPuck(block(CARD_GRID_BLOCK_TYPE, { layout: 'invalid' }))?.props).toMatchObject({ layout: 'grid' });
    expect(production.productionPuckBlockToCanonical('CardGrid', { layout: 'invalid' }, false)?.props.layout).toBe('bento');
    expect(production.productionPuckBlockToCanonical('Notice', { actionUrl: 'custom:unchanged' }, false)?.props.actionUrl).toBe('custom:unchanged');
  });
});
