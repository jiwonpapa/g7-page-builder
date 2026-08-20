import { describe, expect, it } from 'vitest';

import {
  linesToLinks,
  safeSitePartHref,
  sitePartCanonicalToPuck,
  sitePartPuckToCanonical,
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
      navigation: [{ label: '소개', url: '/pages/about' }],
      cta: { label: '문의', url: '/pages/contact' },
      mobile_menu: true,
    },
    slots: {},
  }],
};

describe('Site Part Puck adapter', () => {
  it('round-trips the typed Header document without inline style output', () => {
    const data = sitePartCanonicalToPuck(header);
    const roundTrip = sitePartPuckToCanonical(data, header);

    expect(data.content[0]?.type).toBe('HeaderNavigation');
    expect(roundTrip).toEqual(header);
    expect(JSON.stringify(roundTrip)).not.toContain('style=');
    expect(JSON.stringify(roundTrip)).not.toContain('className');
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
        }, {
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
});
