import { describe, expect, it } from 'vitest';

import {
  linesToLinks,
  safeSitePartHref,
  sitePartCanonicalToPuck,
  sitePartPresetToPuck,
  sitePartPuckToCanonical,
  sitePartSetCanonicalToPuck,
  sitePartSetPresetToPuck,
  sitePartSetPuckToCanonical,
} from '../../resources/js/editor/sitePartDocumentAdapter';
import type { SitePartDocument } from '../../resources/js/documents/types';

const header: SitePartDocument = {
  schema_version: 'g7-page-builder/site-part/v1',
  site_part_id: '123e4567-e89b-42d3-a456-426614174055',
  kind: 'header',
  locale: 'ko',
  tokens: { accent: '#2456df' },
  blocks: [{
    instance_id: '123e4567-e89b-42d3-a456-426614174056',
    type: 'site.header.navigation-01',
    block_version: 1,
    props: {
      brand_name: '지원소프트',
      logo_url: '/storage/logo.webp',
      home_url: '/',
      variant: 'solid',
      sticky: true,
      navigation: [{ label: '소개', url: '/pages/about', children: [{ label: '팀', url: '/pages/team' }] }],
      cta: { label: '문의', url: '/pages/contact' },
      mobile_menu: true,
      mobile_menu_style: 'drawer-left',
      responsive: {
        tablet: { density: 'spacious', alignment: 'center', show_cta: true, mobile_menu_style: 'drawer-left' },
        mobile: { density: 'compact', alignment: 'spread', show_cta: false, mobile_menu_style: 'sheet-bottom' },
      },
    },
    slots: {},
  }],
};

describe('Site Part Puck adapter', () => {
  it('round-trips the typed Header document without inline style output', () => {
    const data = sitePartCanonicalToPuck(header);
    const roundTrip = sitePartPuckToCanonical(data, header);

    expect(data.content[0]?.type).toBe('HeaderNavigation');
    const navigation = data.content[0]?.type === 'HeaderNavigation' ? data.content[0] : null;
    expect(navigation?.props.systemControls?.[0]?.props.id).not.toBe(navigation?.props.id);
    expect(roundTrip).toEqual(header);
    expect(JSON.stringify(roundTrip)).not.toContain('style=');
    expect(JSON.stringify(roundTrip)).not.toContain('className');
  });

  it('round-trips configurable G7 runtime controls through the Header slot', () => {
    const configured = structuredClone(header);
    configured.blocks[0]!.slots = {
      systemControls: [{
        instance_id: '123e4567-e89b-42d3-a456-426614174090',
        type: 'site.header.system-controls-01',
        block_version: 1,
        props: {
          search: true,
          account: true,
          cart: false,
          notifications: false,
          theme: true,
          locale: false,
          currency: false,
        },
        slots: {},
      }],
    };

    const data = sitePartCanonicalToPuck(configured);
    const navigation = data.content.find((block) => block.type === 'HeaderNavigation');
    expect(navigation?.props.systemControls?.[0]?.props).toMatchObject({ cart: false, notifications: false });
    expect(sitePartPuckToCanonical(data, configured)).toEqual(configured);
  });

  it('preserves legacy output until responsive settings are explicitly changed', () => {
    const legacy = structuredClone(header);
    delete legacy.blocks[0]!.props.responsive;
    const data = sitePartCanonicalToPuck(legacy);
    expect(sitePartPuckToCanonical(data, legacy)).toEqual(legacy);

    const block = data.content[0];
    if (block?.type !== 'HeaderNavigation') throw new Error('HeaderNavigation is required.');
    block.props.responsiveOverrides!.mobile = { mobileMenuStyle: 'sheet-bottom', density: 'compact' };
    expect(sitePartPuckToCanonical(data, legacy).blocks[0]?.props.responsive).toEqual({
      tablet: { density: 'comfortable', alignment: 'spread', show_cta: false, mobile_menu_style: 'drawer-left' },
      mobile: { density: 'compact', mobile_menu_style: 'sheet-bottom' },
    });
  });

  it('round-trips announcement, simple Footer, and column Footer blocks', () => {
    const siteParts: SitePartDocument[] = [
      {
        ...header,
        blocks: [{
          instance_id: '123e4567-e89b-42d3-a456-426614174057',
          type: 'site.header.announcement-01',
          block_version: 1,
          props: { text: '공지', link_label: '보기', link_url: '/news', tone: 'dark' },
          slots: {},
        }],
      },
      {
        ...header,
        site_part_id: '123e4567-e89b-42d3-a456-426614174058',
        kind: 'footer',
        blocks: [{
          instance_id: '123e4567-e89b-42d3-a456-426614174059',
          type: 'site.footer.simple-01',
          block_version: 1,
          props: { brand_name: '지원소프트', home_url: '/', navigation: [], footer_text: 'Copyright' },
          slots: {},
        }],
      },
      {
        ...header,
        site_part_id: '123e4567-e89b-42d3-a456-426614174061',
        kind: 'footer',
        blocks: [{
          instance_id: '123e4567-e89b-42d3-a456-426614174060',
          type: 'site.footer.columns-01',
          block_version: 1,
          props: { brand_name: '지원소프트', home_url: '/', columns: [{ heading: '서비스', links: [{ label: '소개', url: '/about' }] }], legal_text: 'Legal' },
          slots: {},
        }],
      },
    ];

    for (const document of siteParts) {
      expect(sitePartPuckToCanonical(sitePartCanonicalToPuck(document), document)).toEqual(document);
    }
  });

  it('fails closed for unsafe preview links and parses only complete column-link rows', () => {
    expect(safeSitePartHref('/pages/about')).toBe('/pages/about');
    expect(safeSitePartHref('#main')).toBe('#main');
    expect(safeSitePartHref('https://example.com')).toBe('https://example.com');
    expect(safeSitePartHref('mailto:hello@example.com')).toBe('mailto:hello@example.com');
    expect(safeSitePartHref('javascript:alert(1)')).toBe('#');
    expect(safeSitePartHref('//evil.example')).toBe('#');
    expect(safeSitePartHref('not a url')).toBe('#');
    expect(linesToLinks('소개|/about\n잘못된 줄\n문의|/contact|detail\n|/empty')).toEqual([
      { label: '소개', url: '/about' },
      { label: '문의', url: '/contact|detail' },
    ]);
  });

  it('normalizes incomplete stored props and ignores unsupported block types', () => {
    const malformed: SitePartDocument = {
      ...header,
      blocks: [{
        instance_id: 'generated-id',
        type: 'site.header.navigation-01',
        block_version: 1,
        props: { brand_name: 42, navigation: [null, { label: 42, url: false }], cta: 'invalid' },
        slots: {},
      }, {
        instance_id: 'ignored',
        type: 'site.header.unknown-99',
        block_version: 1,
        props: {},
        slots: {},
      }],
    };

    const data = sitePartCanonicalToPuck(malformed);
    expect(data.content).toHaveLength(1);
    expect(data.content[0]?.props).toMatchObject({ brandName: '사이트 이름', homeUrl: '/', ctaLabel: '' });
    const normalized = sitePartPuckToCanonical(data, malformed);
    expect(normalized.blocks[0]?.instance_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalized.blocks[0]?.props.cta).toBeNull();
  });

  it('provides editable Header and Footer presets with typed route items', () => {
    const businessHeader = sitePartPresetToPuck(header, 'header-business');
    const headerNavigation = businessHeader.content.find((block) => block.type === 'HeaderNavigation');
    expect(businessHeader.content.map((block) => block.type)).toEqual(['Announcement', 'HeaderNavigation']);
    expect(headerNavigation?.props.navigation[0]?.children).toHaveLength(2);

    const footer = { ...header, kind: 'footer' as const, site_part_id: '123e4567-e89b-42d3-a456-426614174098', blocks: [] };
    const businessFooter = sitePartPresetToPuck(footer, 'footer-business');
    const footerColumns = businessFooter.content.find((block) => block.type === 'FooterColumns');
    expect(footerColumns?.props.columns).toHaveLength(3);
    expect(footerColumns?.props.columns[0]?.links[0]).toEqual({ label: '주요 기능', url: '/pages/features' });
    expect(sitePartPuckToCanonical(businessFooter, footer).blocks[0]?.type).toBe('site.footer.columns-01');
  });

  it('combines one Header and one Footer into a single Puck set and splits them without loss', () => {
    const footer: SitePartDocument = {
      ...header,
      site_part_id: '123e4567-e89b-42d3-a456-426614174098',
      kind: 'footer',
      blocks: [{
        instance_id: '123e4567-e89b-42d3-a456-426614174099',
        type: 'site.footer.simple-01',
        block_version: 1,
        props: { brand_name: '지원소프트', home_url: '/', navigation: [], footer_text: 'Copyright' },
        slots: {},
      }],
    };

    const data = sitePartSetCanonicalToPuck(header, footer);
    expect(data.content.map((block) => block.type)).toEqual(['HeaderNavigation', 'FooterSimple']);
    expect(sitePartSetPuckToCanonical(data, header, footer)).toEqual({ header, footer });
  });

  it('applies a complete Header and Footer preset as one set operation', () => {
    const footer: SitePartDocument = {
      ...header,
      site_part_id: '123e4567-e89b-42d3-a456-426614174098',
      kind: 'footer',
      blocks: [],
    };

    const business = sitePartSetPresetToPuck(header, footer, 'business');
    expect(business.content.map((block) => block.type)).toEqual([
      'Announcement',
      'HeaderNavigation',
      'FooterColumns',
    ]);
    const split = sitePartSetPuckToCanonical(business, header, footer);
    expect(split.header.blocks.map((block) => block.type)).toEqual([
      'site.header.announcement-01',
      'site.header.navigation-01',
    ]);
    expect(split.footer.blocks.map((block) => block.type)).toEqual(['site.footer.columns-01']);
  });

});
