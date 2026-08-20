import type { Data } from '@puckeditor/core';

import type { PageBuilderBlock, SitePartDocument, SitePartLink } from '../documents/types';

export interface HeaderNavigationProps {
  brandName: string;
  logoUrl: string;
  homeUrl: string;
  variant: 'solid' | 'transparent';
  sticky: boolean;
  navigation: SitePartLink[];
  ctaLabel: string;
  ctaUrl: string;
  mobileMenu: boolean;
}

export interface AnnouncementProps {
  text: string;
  linkLabel: string;
  linkUrl: string;
  tone: 'brand' | 'dark' | 'light';
}

export interface FooterSimpleProps {
  brandName: string;
  homeUrl: string;
  navigation: SitePartLink[];
  footerText: string;
}

export interface FooterColumnItem {
  heading: string;
  linksText: string;
}

export interface FooterColumnsProps {
  brandName: string;
  homeUrl: string;
  columns: FooterColumnItem[];
  legalText: string;
}

export interface SitePartComponents {
  HeaderNavigation: HeaderNavigationProps;
  Announcement: AnnouncementProps;
  FooterSimple: FooterSimpleProps;
  FooterColumns: FooterColumnsProps;
}

export type SitePartPuckData = Data<SitePartComponents>;

const COMPONENT_BY_TYPE: Record<string, keyof SitePartComponents> = {
  'site.header.navigation-01': 'HeaderNavigation',
  'site.header.announcement-01': 'Announcement',
  'site.footer.simple-01': 'FooterSimple',
  'site.footer.columns-01': 'FooterColumns',
};

const TYPE_BY_COMPONENT: Record<keyof SitePartComponents, string> = {
  HeaderNavigation: 'site.header.navigation-01',
  Announcement: 'site.header.announcement-01',
  FooterSimple: 'site.footer.simple-01',
  FooterColumns: 'site.footer.columns-01',
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function links(value: unknown): SitePartLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    return [{ label: text(source.label), url: text(source.url, '/') }];
  });
}

export function linesToLinks(value: string): SitePartLink[] {
  return value.split('\n').flatMap((line) => {
    const [label, ...urlParts] = line.split('|');
    const url = urlParts.join('|').trim();
    return label?.trim() && url ? [{ label: label.trim(), url }] : [];
  });
}

function linksToLines(value: unknown): string {
  return links(value).map((item) => `${item.label}|${item.url}`).join('\n');
}

function stableUuid(value: string): string {
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  if (match) return match[0].toLowerCase();
  let a = 2166136261;
  let b = 2246822519;
  for (const character of value) {
    a = Math.imul(a ^ character.charCodeAt(0), 16777619);
    b = Math.imul(b ^ character.charCodeAt(0), 3266489917);
  }
  const hex = `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`.repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function safeSitePartHref(value: string): string {
  if ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#')) return value;
  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol) ? value : '#';
  } catch {
    return '#';
  }
}

export function sitePartCanonicalToPuck(document: SitePartDocument): SitePartPuckData {
  const content: SitePartPuckData['content'] = [];
  for (const block of document.blocks) {
    const component = COMPONENT_BY_TYPE[block.type];
    if (!component) continue;
    const props = block.props;
    const id = block.instance_id;
    if (component === 'HeaderNavigation') {
      const cta = props.cta && typeof props.cta === 'object' ? props.cta as Record<string, unknown> : {};
      content.push({ type: component, props: {
        id,
        brandName: text(props.brand_name, '사이트 이름'),
        logoUrl: text(props.logo_url),
        homeUrl: text(props.home_url, '/'),
        variant: props.variant === 'transparent' ? 'transparent' : 'solid',
        sticky: props.sticky !== false,
        navigation: links(props.navigation),
        ctaLabel: text(cta.label),
        ctaUrl: text(cta.url, '/'),
        mobileMenu: props.mobile_menu !== false,
      } });
      continue;
    }
    if (component === 'Announcement') {
      content.push({ type: component, props: {
        id,
        text: text(props.text, '새로운 소식을 알려보세요.'),
        linkLabel: text(props.link_label),
        linkUrl: text(props.link_url, '/'),
        tone: props.tone === 'dark' || props.tone === 'light' ? props.tone : 'brand',
      } });
      continue;
    }
    if (component === 'FooterSimple') {
      content.push({ type: component, props: {
        id,
        brandName: text(props.brand_name, '사이트 이름'),
        homeUrl: text(props.home_url, '/'),
        navigation: links(props.navigation),
        footerText: text(props.footer_text),
      } });
      continue;
    }
    const columns = Array.isArray(props.columns) ? props.columns.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const source = item as Record<string, unknown>;
      return [{ heading: text(source.heading, '메뉴'), linksText: linksToLines(source.links) }];
    }) : [];
    content.push({ type: component, props: {
      id,
      brandName: text(props.brand_name, '사이트 이름'),
      homeUrl: text(props.home_url, '/'),
      columns,
      legalText: text(props.legal_text),
    } });
  }

  return { root: { props: {} }, content } as SitePartPuckData;
}

export function sitePartPuckToCanonical(data: SitePartPuckData, source: SitePartDocument): SitePartDocument {
  const blocks = data.content.map((block): PageBuilderBlock => {
    const props = block.props as Record<string, unknown>;
    const component = block.type as keyof SitePartComponents;
    let canonicalProps: Record<string, unknown>;
    if (component === 'HeaderNavigation') {
      const ctaLabel = text(props.ctaLabel);
      const ctaUrl = text(props.ctaUrl);
      canonicalProps = {
        brand_name: text(props.brandName), logo_url: text(props.logoUrl), home_url: text(props.homeUrl, '/'),
        variant: props.variant === 'transparent' ? 'transparent' : 'solid', sticky: props.sticky !== false,
        navigation: links(props.navigation), cta: ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : null,
        mobile_menu: props.mobileMenu !== false,
      };
    } else if (component === 'Announcement') {
      canonicalProps = {
        text: text(props.text), link_label: text(props.linkLabel), link_url: text(props.linkUrl),
        tone: props.tone === 'dark' || props.tone === 'light' ? props.tone : 'brand',
      };
    } else if (component === 'FooterSimple') {
      canonicalProps = {
        brand_name: text(props.brandName), home_url: text(props.homeUrl, '/'),
        navigation: links(props.navigation), footer_text: text(props.footerText),
      };
    } else {
      const columns = Array.isArray(props.columns) ? props.columns.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const sourceColumn = item as Record<string, unknown>;
        return [{ heading: text(sourceColumn.heading), links: linesToLinks(text(sourceColumn.linksText)) }];
      }) : [];
      canonicalProps = {
        brand_name: text(props.brandName), home_url: text(props.homeUrl, '/'), columns, legal_text: text(props.legalText),
      };
    }
    return {
      instance_id: stableUuid(text(props.id, `${component}:${JSON.stringify(canonicalProps)}`)),
      type: TYPE_BY_COMPONENT[component],
      block_version: 1,
      props: canonicalProps,
      slots: {},
    };
  });
  return { ...source, blocks };
}
