import { describe, expect, expectTypeOf, it } from 'vitest';
import * as documentContracts from '../../resources/js/documents/types';
import * as builtinContracts from '../../resources/js/documents/builtinBlockContracts';
import type * as presentationContracts from '../../resources/js/documents/blockPresentation';
import * as layoutContracts from '../../resources/js/documents/layoutContracts';

const expectedBlockIds = [
  { name: 'HERO_BLOCK_TYPE', id: 'content.hero-centered-01' },
  { name: 'FEATURES_BLOCK_TYPE', id: 'content.features-grid-01' },
  { name: 'CTA_BLOCK_TYPE', id: 'content.cta-split-01' },
  { name: 'CONTACT_BLOCK_TYPE', id: 'content.contact-info-01' },
  { name: 'HERO_SPLIT_BLOCK_TYPE', id: 'content.hero-split-01' },
  { name: 'HERO_SLIDER_BLOCK_TYPE', id: 'content.hero-slider-01' },
  { name: 'LOGO_CLOUD_BLOCK_TYPE', id: 'trust.logo-cloud-01' },
  { name: 'STATS_BLOCK_TYPE', id: 'data.stats-icons-01' },
  { name: 'PRICING_BLOCK_TYPE', id: 'commerce.pricing-tiers-01' },
  { name: 'TEAM_BLOCK_TYPE', id: 'company.team-grid-01' },
  { name: 'GALLERY_BLOCK_TYPE', id: 'media.gallery-grid-01' },
  { name: 'BAR_CHART_BLOCK_TYPE', id: 'data.bar-chart-01' },
  { name: 'G7_RECENT_POSTS_BLOCK_TYPE', id: 'g7.board-recent-posts-01' },
  { name: 'G7_PRODUCT_GRID_BLOCK_TYPE', id: 'g7.ecommerce-product-grid-01' },
  { name: 'INQUIRY_FORM_BLOCK_TYPE', id: 'form.inquiry-01' },
  { name: 'MAP_DIRECTIONS_BLOCK_TYPE', id: 'location.map-directions-01' },
  { name: 'TESTIMONIALS_BLOCK_TYPE', id: 'trust.testimonials-01' },
  { name: 'FAQ_ACCORDION_BLOCK_TYPE', id: 'content.faq-accordion-01' },
  { name: 'PROCESS_TIMELINE_BLOCK_TYPE', id: 'content.process-timeline-01' },
  { name: 'TABS_BLOCK_TYPE', id: 'content.tabs-01' },
  { name: 'COMPARISON_TABLE_BLOCK_TYPE', id: 'commerce.comparison-table-01' },
  { name: 'ARTICLE_LIST_BLOCK_TYPE', id: 'content.article-list-01' },
  { name: 'VIDEO_EMBED_BLOCK_TYPE', id: 'media.video-embed-01' },
  { name: 'LOGO_CAROUSEL_BLOCK_TYPE', id: 'trust.logo-carousel-01' },
  { name: 'TESTIMONIAL_SLIDER_BLOCK_TYPE', id: 'trust.testimonial-slider-01' },
  { name: 'EVENT_SCHEDULE_BLOCK_TYPE', id: 'content.event-schedule-01' },
  { name: 'DOWNLOAD_RESOURCES_BLOCK_TYPE', id: 'content.download-resources-01' },
  { name: 'G7_BOARD_ARCHIVE_BLOCK_TYPE', id: 'g7.board-content-archive-01' },
  { name: 'G7_PRODUCT_SHOWCASE_BLOCK_TYPE', id: 'g7.ecommerce-product-showcase-01' },
  { name: 'HEADING_BLOCK_TYPE', id: 'content.heading-01' },
  { name: 'RICH_TEXT_BLOCK_TYPE', id: 'content.rich-text-01' },
  { name: 'IMAGE_BLOCK_TYPE', id: 'media.image-01' },
  { name: 'BUTTONS_BLOCK_TYPE', id: 'action.buttons-01' },
  { name: 'IMAGE_TEXT_BLOCK_TYPE', id: 'media.image-text-01' },
  { name: 'ICON_LIST_BLOCK_TYPE', id: 'content.icon-list-01' },
  { name: 'G7_POST_DETAIL_BLOCK_TYPE', id: 'g7.board-post-detail-01' },
  { name: 'G7_PRODUCT_DETAIL_BLOCK_TYPE', id: 'g7.ecommerce-product-detail-01' },
  { name: 'DIVIDER_BLOCK_TYPE', id: 'content.divider-01' },
  { name: 'BLOCKQUOTE_BLOCK_TYPE', id: 'content.blockquote-01' },
  { name: 'NOTICE_BLOCK_TYPE', id: 'content.notice-01' },
  { name: 'CARD_GRID_BLOCK_TYPE', id: 'content.card-grid-01' },
  { name: 'BREADCRUMBS_BLOCK_TYPE', id: 'navigation.breadcrumbs-01' },
  { name: 'ANCHOR_MENU_BLOCK_TYPE', id: 'navigation.anchor-menu-01' },
  { name: 'SOCIAL_LINKS_BLOCK_TYPE', id: 'navigation.social-links-01' },
  { name: 'IMAGE_CAROUSEL_BLOCK_TYPE', id: 'media.image-carousel-01' },
] as const;

const guards = [
  { name: 'isHeroBlock', type: 'content.hero-centered-01' },
  { name: 'isFeaturesBlock', type: 'content.features-grid-01' },
  { name: 'isCtaBlock', type: 'content.cta-split-01' },
  { name: 'isContactBlock', type: 'content.contact-info-01' },
] as const;

describe('canonical document and built-in contract ownership', () => {
  it('keeps every built-in ID literal available through the document entry point', () => {
    expect(Object.keys(builtinContracts).filter((name) => name.endsWith('_BLOCK_TYPE')).sort())
      .toEqual(expectedBlockIds.map(({ name }) => name).sort());
    for (const { name, id } of expectedBlockIds) {
      expect(builtinContracts[name]).toBe(id);
      expect(documentContracts[name]).toBe(builtinContracts[name]);
    }
  });

  it.each(guards)('$name keeps the same function and exact discriminator without modifying input', ({ name, type }) => {
    expect(documentContracts[name]).toBe(builtinContracts[name]);
    const candidates = [...expectedBlockIds.map(({ id }) => id), 'layout.section-01', 'external.contract-01'];
    for (const id of candidates) {
      const block: documentContracts.PageBuilderBlock = Object.freeze({
        instance_id: '10000000-0000-4000-8000-000000000001', type: id, block_version: 1,
        // The existing guards only identify the type; they do not validate props.
        props: Object.freeze({ extension: { enabled: false } }),
      });
      const before = JSON.stringify(block);
      expect(builtinContracts[name](block)).toBe(id === type);
      expect(documentContracts[name](block)).toBe(id === type);
      expect(JSON.stringify(block)).toBe(before);
    }
  });

  it('preserves concrete block aliases and their TypeScript narrowing', () => {
    expectTypeOf<documentContracts.HeroBlock>().toEqualTypeOf<builtinContracts.HeroBlock>();
    expectTypeOf<documentContracts.FeaturesBlock>().toEqualTypeOf<builtinContracts.FeaturesBlock>();
    expectTypeOf<documentContracts.CtaBlock>().toEqualTypeOf<builtinContracts.CtaBlock>();
    expectTypeOf<documentContracts.ContactBlock>().toEqualTypeOf<builtinContracts.ContactBlock>();
    for (const { type } of guards) {
      const block: documentContracts.PageBuilderBlock = {
        instance_id: '10000000-0000-4000-8000-000000000002', type, block_version: 1, props: {},
      };
      if (builtinContracts.isHeroBlock(block)) expectTypeOf(block).toEqualTypeOf<builtinContracts.HeroBlock>();
      if (builtinContracts.isFeaturesBlock(block)) expectTypeOf(block).toEqualTypeOf<builtinContracts.FeaturesBlock>();
      if (builtinContracts.isCtaBlock(block)) expectTypeOf(block).toEqualTypeOf<builtinContracts.CtaBlock>();
      if (builtinContracts.isContactBlock(block)) expectTypeOf(block).toEqualTypeOf<builtinContracts.ContactBlock>();
    }
  });

  it('keeps optional properties absent and the original JSON discriminants unchanged', () => {
    const props = { eyebrow: '', title: 'Contract', body: '', alignment: 'left' } satisfies builtinContracts.HeroBlockProps;
    const legacyProps: documentContracts.HeroBlockProps = props;
    expect(legacyProps).toBe(props);
    expectTypeOf<builtinContracts.HeroBlockProps['primaryCta']>()
      .toEqualTypeOf<documentContracts.PageBuilderCallToAction | undefined>();
    expectTypeOf<builtinContracts.HeroBlockProps['image']>()
      .toEqualTypeOf<documentContracts.PageBuilderImage | undefined>();
    expectTypeOf<builtinContracts.InquiryFormKind>()
      .toEqualTypeOf<'inquiry' | 'quote' | 'reservation' | 'application' | 'newsletter'>();
    const block: builtinContracts.HeroBlock = {
      instance_id: '10000000-0000-4000-8000-000000000003',
      type: builtinContracts.HERO_BLOCK_TYPE, block_version: 1, props,
    };
    expect(JSON.parse(JSON.stringify(block))).toEqual({
      instance_id: '10000000-0000-4000-8000-000000000003',
      type: 'content.hero-centered-01', block_version: 1,
      props: { eyebrow: '', title: 'Contract', body: '', alignment: 'left' },
    });
  });

  it('keeps layout ID literals available from both the owner and document entry point', () => {
    const ids = [
      { name: 'LAYOUT_SECTION_BLOCK_TYPE', id: 'layout.section-01' },
      { name: 'LAYOUT_COLUMNS_BLOCK_TYPE', id: 'layout.columns-01' },
      { name: 'LAYOUT_STACK_BLOCK_TYPE', id: 'layout.stack-01' },
    ] as const;
    for (const { name, id } of ids) {
      expect(layoutContracts[name]).toBe(id);
      expect(documentContracts[name]).toBe(layoutContracts[name]);
    }
  });

  it('preserves presentation and layout aliases, including legacy responsive and optional values', () => {
    expectTypeOf<documentContracts.BlockAppearance>().toEqualTypeOf<presentationContracts.BlockAppearance>();
    expectTypeOf<documentContracts.ElementAppearance>().toEqualTypeOf<presentationContracts.ElementAppearance>();
    expectTypeOf<documentContracts.ElementAppearanceMap>().toEqualTypeOf<presentationContracts.ElementAppearanceMap>();
    expectTypeOf<documentContracts.ResponsiveAppearanceOverride>().toEqualTypeOf<presentationContracts.ResponsiveAppearanceOverride>();
    expectTypeOf<documentContracts.ResponsiveLayoutOverride>().toEqualTypeOf<presentationContracts.ResponsiveLayoutOverride>();
    expectTypeOf<documentContracts.BlockResponsiveOverride>().toEqualTypeOf<presentationContracts.BlockResponsiveOverride>();
    expectTypeOf<documentContracts.BlockResponsiveOverrides>().toEqualTypeOf<presentationContracts.BlockResponsiveOverrides>();
    expectTypeOf<documentContracts.BlockMotionPreset>().toEqualTypeOf<presentationContracts.BlockMotionPreset>();
    expectTypeOf<documentContracts.BlockMotion>().toEqualTypeOf<presentationContracts.BlockMotion>();
    expectTypeOf<documentContracts.LayoutSectionBlockProps>().toEqualTypeOf<layoutContracts.LayoutSectionBlockProps>();
    expectTypeOf<documentContracts.LayoutColumnsBlockProps>().toEqualTypeOf<layoutContracts.LayoutColumnsBlockProps>();
    expectTypeOf<documentContracts.LayoutStackBlockProps>().toEqualTypeOf<layoutContracts.LayoutStackBlockProps>();
    expectTypeOf<presentationContracts.ResponsiveLayoutOverride['columns']>().toEqualTypeOf<1 | 2 | undefined>();
    expectTypeOf<layoutContracts.LayoutColumnsBlockProps['columns']>().toEqualTypeOf<1 | 2 | 3>();
    expectTypeOf<presentationContracts.ElementAppearance['size']>().toEqualTypeOf<'small' | 'base' | 'large' | 'xlarge' | undefined>();
    expectTypeOf<presentationContracts.ElementAppearance['fontSizeRem']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<presentationContracts.BlockMotion['stagger_ms']>().toEqualTypeOf<60 | 100 | 160>();
  });

  it('keeps Page and Site Part JSON envelopes with null tokens and omitted overrides', () => {
    const appearance: presentationContracts.BlockAppearance = {
      surface: 'contrast', spacing: 'normal', elements: { title: { size: 'large', fontSizeRem: 1.5 } },
    };
    const sectionProps = { width: 'wide', spacing: 'normal' } satisfies layoutContracts.LayoutSectionBlockProps;
    const responsive: presentationContracts.BlockResponsiveOverrides = { tablet: { layout: { columns: 2 } } };
    const page: documentContracts.PageBuilderDocument = {
      schema_version: 'g7-page-builder/v2', document_id: '10000000-0000-4000-8000-000000000004',
      slug: 'contract', mode: 'canvas', locale: 'ko', shell_mode: 'global', tokens: { inherited: null },
      blocks: [{
        instance_id: '10000000-0000-4000-8000-000000000005',
        type: layoutContracts.LAYOUT_SECTION_BLOCK_TYPE, block_version: 1, props: sectionProps, responsive,
        slots: { content: [{
          instance_id: '10000000-0000-4000-8000-000000000006',
          type: builtinContracts.HEADING_BLOCK_TYPE, block_version: 1, props: { text: 'Contract', appearance },
        }] },
      }],
    };
    const pageJson = JSON.parse(JSON.stringify(page));
    expect(pageJson.schema_version).toBe('g7-page-builder/v2');
    expect(pageJson.shell_mode).toBe('global');
    expect(pageJson.tokens).toEqual({ inherited: null });
    expect(pageJson.blocks[0].props).toEqual({ width: 'wide', spacing: 'normal' });
    expect(pageJson.blocks[0].responsive).toEqual({ tablet: { layout: { columns: 2 } } });
    expect(pageJson.blocks[0]).not.toHaveProperty('motion');
    expect(pageJson.blocks[0].slots.content[0].props.appearance).toEqual({
      surface: 'contrast', spacing: 'normal', elements: { title: { size: 'large', fontSizeRem: 1.5 } },
    });
    const sitePart: documentContracts.SitePartDocument = {
      schema_version: 'g7-page-builder/site-part/v1', site_part_id: '10000000-0000-4000-8000-000000000007',
      kind: 'header', locale: 'ko', tokens: { inherited: null }, blocks: [],
    };
    expect(JSON.parse(JSON.stringify(sitePart))).toEqual({
      schema_version: 'g7-page-builder/site-part/v1', site_part_id: '10000000-0000-4000-8000-000000000007',
      kind: 'header', locale: 'ko', tokens: { inherited: null }, blocks: [],
    });
  });
});
