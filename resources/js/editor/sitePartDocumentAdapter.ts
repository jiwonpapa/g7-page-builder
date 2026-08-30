import type { Data, Slot } from '@puckeditor/core';

import type { PageBuilderBlock, SitePartDocument, SitePartLink } from '../documents/types';
import {
  footerResponsiveFromCanonical,
  footerResponsiveToCanonical,
  type FooterResponsiveOverrides,
  headerResponsiveFromCanonical,
  headerResponsiveToCanonical,
  type HeaderResponsiveOverrides,
  legacyFooterResponsiveOverrides,
  legacyHeaderResponsiveOverrides,
  responsiveOverridesEqual,
  type SitePartMobileMenuStyle,
} from './sitePartResponsive';

export interface HeaderNavigationProps {
  useSiteSettings?: boolean;
  brandName: string;
  logoUrl: string;
  homeUrl: string;
  variant: 'solid' | 'transparent';
  sticky: boolean;
  navigation: HeaderNavigationItem[];
  ctaLabel: string;
  ctaUrl: string;
  mobileMenu: boolean;
  mobileMenuStyle: SitePartMobileMenuStyle;
  responsiveOverrides?: HeaderResponsiveOverrides;
  systemControls?: Slot<{ HeaderSystemControls: HeaderSystemControlsProps }>;
}

export interface HeaderSystemControlsProps {
  search: boolean;
  account: boolean;
  cart: boolean;
  notifications: boolean;
  theme: boolean;
  locale: boolean;
  currency: boolean;
}

type HeaderSystemControlsContent = Array<{
  type: 'HeaderSystemControls';
  props: HeaderSystemControlsProps & { id: string };
}>;

export interface HeaderNavigationItem extends SitePartLink {
  children: SitePartLink[];
}

export interface AnnouncementProps {
  text: string;
  linkLabel: string;
  linkUrl: string;
  tone: 'brand' | 'dark' | 'light';
}

export interface FooterSimpleProps {
  useSiteSettings?: boolean;
  brandName: string;
  homeUrl: string;
  navigation: SitePartLink[];
  footerText: string;
  responsiveOverrides?: FooterResponsiveOverrides;
}

export interface FooterColumnItem {
  heading: string;
  links: SitePartLink[];
}

export interface FooterColumnsProps {
  useSiteSettings?: boolean;
  brandName: string;
  homeUrl: string;
  columns: FooterColumnItem[];
  legalText: string;
  responsiveOverrides?: FooterResponsiveOverrides;
}

export interface SitePartComponents {
  HeaderNavigation: HeaderNavigationProps;
  HeaderSystemControls: HeaderSystemControlsProps;
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
  HeaderSystemControls: 'site.header.system-controls-01',
  Announcement: 'site.header.announcement-01',
  FooterSimple: 'site.footer.simple-01',
  FooterColumns: 'site.footer.columns-01',
};

export const DEFAULT_HEADER_SYSTEM_CONTROLS: HeaderSystemControlsProps = {
  search: true,
  account: true,
  cart: true,
  notifications: true,
  theme: true,
  locale: true,
  currency: true,
};

function systemControlValue(props: Record<string, unknown>, key: keyof HeaderSystemControlsProps): boolean {
  return props[key] !== false;
}

function systemControlsToPuck(
  block: PageBuilderBlock,
  fallbackId: string,
): HeaderSystemControlsContent {
  if (Object.prototype.hasOwnProperty.call(block.slots ?? {}, 'systemControls')) {
    const child = block.slots?.systemControls?.find((candidate) => candidate.type === 'site.header.system-controls-01');
    if (!child) return [];
    return [{
      type: 'HeaderSystemControls',
      props: {
        id: stableUuid(child.instance_id),
        search: systemControlValue(child.props, 'search'),
        account: systemControlValue(child.props, 'account'),
        cart: systemControlValue(child.props, 'cart'),
        notifications: systemControlValue(child.props, 'notifications'),
        theme: systemControlValue(child.props, 'theme'),
        locale: systemControlValue(child.props, 'locale'),
        currency: systemControlValue(child.props, 'currency'),
      },
    }];
  }
  return [{ type: 'HeaderSystemControls', props: { id: derivedUuid(fallbackId), ...DEFAULT_HEADER_SYSTEM_CONTROLS } }];
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function leafLinks(value: unknown): SitePartLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    return [{ label: text(source.label), url: text(source.url, '/') }];
  });
}

function headerLinks(value: unknown): HeaderNavigationItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    return [{
      label: text(source.label),
      url: text(source.url, '/'),
      children: leafLinks(source.children),
    }];
  });
}

function canonicalHeaderLinks(value: unknown): SitePartLink[] {
  return headerLinks(value).map((item) => ({
    label: item.label,
    url: item.url,
    ...(item.children.length > 0 ? { children: leafLinks(item.children) } : {}),
  }));
}

export function linesToLinks(value: string): SitePartLink[] {
  return value.split('\n').flatMap((line) => {
    const [label, ...urlParts] = line.split('|');
    const url = urlParts.join('|').trim();
    return label?.trim() && url ? [{ label: label.trim(), url }] : [];
  });
}

function stableUuid(value: string): string {
  const match = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  if (match) return match[0].toLowerCase();
  return derivedUuid(value);
}

function derivedUuid(value: string): string {
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

export type SitePartPresetKey =
  | 'header-business'
  | 'header-minimal'
  | 'header-community'
  | 'footer-business'
  | 'footer-compact'
  | 'footer-community';

export type SitePartSetPresetKey = 'business' | 'minimal' | 'community';

export function sitePartPresetToPuck(document: SitePartDocument, preset: SitePartPresetKey): SitePartPuckData {
  const presetId = (component: keyof SitePartComponents): string => stableUuid(`${preset}:${component}:${document.locale}`);
  if (document.kind === 'header') {
    const navigation = preset === 'header-community'
      ? [
        { label: '커뮤니티', url: '/boards', children: [{ label: '최신글', url: '/boards' }, { label: '인기글', url: '/boards?sort=popular' }] },
        { label: '이용 안내', url: '/pages/guide', children: [] },
      ]
      : preset === 'header-minimal'
        ? [{ label: '소개', url: '/pages/about', children: [] }, { label: '문의', url: '/pages/contact', children: [] }]
        : [
          { label: '서비스', url: '/pages/services', children: [{ label: '주요 기능', url: '/pages/features' }, { label: '요금 안내', url: '/pages/pricing' }] },
          { label: '회사 소개', url: '/pages/about', children: [{ label: '팀', url: '/pages/team' }, { label: '오시는 길', url: '/pages/location' }] },
        ];
    const header: SitePartPuckData['content'][number] = {
      type: 'HeaderNavigation',
      props: {
        id: presetId('HeaderNavigation'),
        brandName: '사이트 이름',
        logoUrl: '',
        homeUrl: '/',
        variant: preset === 'header-minimal' ? 'transparent' : 'solid',
        sticky: true,
        navigation,
        ctaLabel: preset === 'header-business' ? '문의하기' : '',
        ctaUrl: '/pages/contact',
        mobileMenu: true,
        mobileMenuStyle: preset === 'header-community' ? 'drawer-left' : 'drawer-right',
        responsiveOverrides: legacyHeaderResponsiveOverrides(preset === 'header-community' ? 'drawer-left' : 'drawer-right'),
        systemControls: [{
          type: 'HeaderSystemControls',
          props: { id: presetId('HeaderSystemControls'), ...DEFAULT_HEADER_SYSTEM_CONTROLS },
        }],
      },
    };
    const content: SitePartPuckData['content'] = preset === 'header-business'
      ? [{
        type: 'Announcement',
        props: { id: presetId('Announcement'), text: '중요한 소식을 짧게 알려보세요.', linkLabel: '자세히', linkUrl: '/pages/news', tone: 'brand' },
      }, header]
      : [header];
    return { root: { props: {} }, content } as SitePartPuckData;
  }

  if (preset === 'footer-compact') {
    return {
      root: { props: {} },
      content: [{
        type: 'FooterSimple',
        props: {
          id: presetId('FooterSimple'), brandName: '사이트 이름', homeUrl: '/',
          navigation: [{ label: '소개', url: '/pages/about' }, { label: '문의', url: '/pages/contact' }, { label: '개인정보처리방침', url: '/pages/privacy' }],
          footerText: '© 사이트 이름. All rights reserved.',
          responsiveOverrides: legacyFooterResponsiveOverrides(),
        },
      }],
    } as SitePartPuckData;
  }

  const columns = preset === 'footer-community'
    ? [
      { heading: '커뮤니티', links: [{ label: '최신글', url: '/boards' }, { label: '인기글', url: '/boards?sort=popular' }] },
      { heading: '고객 지원', links: [{ label: '도움말', url: '/pages/guide' }, { label: '문의', url: '/pages/contact' }] },
      { heading: '안내', links: [{ label: '이용약관', url: '/pages/terms' }, { label: '개인정보처리방침', url: '/pages/privacy' }] },
    ]
    : [
      { heading: '서비스', links: [{ label: '주요 기능', url: '/pages/features' }, { label: '요금 안내', url: '/pages/pricing' }] },
      { heading: '회사', links: [{ label: '소개', url: '/pages/about' }, { label: '오시는 길', url: '/pages/location' }] },
      { heading: '지원', links: [{ label: '문의', url: '/pages/contact' }, { label: '개인정보처리방침', url: '/pages/privacy' }] },
    ];
  return {
    root: { props: {} },
    content: [{
      type: 'FooterColumns',
      props: {
        id: presetId('FooterColumns'), brandName: '사이트 이름', homeUrl: '/', columns,
        legalText: '상호·대표·사업자번호·연락처 등 필수 사업자 정보를 입력해 주세요.',
        responsiveOverrides: legacyFooterResponsiveOverrides(),
      },
    }],
  } as SitePartPuckData;
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
        ...(typeof props.use_site_settings === 'boolean' ? { useSiteSettings: props.use_site_settings } : {}),
        logoUrl: text(props.logo_url),
        homeUrl: text(props.home_url, '/'),
        variant: props.variant === 'transparent' ? 'transparent' : 'solid',
        sticky: props.sticky !== false,
        navigation: headerLinks(props.navigation),
        ctaLabel: text(cta.label),
        ctaUrl: text(cta.url, '/'),
        mobileMenu: props.mobile_menu !== false,
        mobileMenuStyle: props.mobile_menu_style === 'dropdown' || props.mobile_menu_style === 'drawer-left'
          || props.mobile_menu_style === 'sheet-bottom' ? props.mobile_menu_style : 'drawer-right',
        responsiveOverrides: Object.prototype.hasOwnProperty.call(props, 'responsive')
          ? headerResponsiveFromCanonical(props.responsive)
          : legacyHeaderResponsiveOverrides(
            props.mobile_menu_style === 'dropdown' || props.mobile_menu_style === 'drawer-left'
              || props.mobile_menu_style === 'sheet-bottom' ? props.mobile_menu_style : 'drawer-right',
          ),
        systemControls: systemControlsToPuck(block, `${id}:system-controls`),
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
        ...(typeof props.use_site_settings === 'boolean' ? { useSiteSettings: props.use_site_settings } : {}),
        homeUrl: text(props.home_url, '/'),
        navigation: leafLinks(props.navigation),
        footerText: text(props.footer_text),
        responsiveOverrides: Object.prototype.hasOwnProperty.call(props, 'responsive')
          ? footerResponsiveFromCanonical(props.responsive)
          : legacyFooterResponsiveOverrides(),
      } });
      continue;
    }
    if (component !== 'FooterColumns') continue;
    const columns = Array.isArray(props.columns) ? props.columns.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const source = item as Record<string, unknown>;
      return [{ heading: text(source.heading, '메뉴'), links: leafLinks(source.links) }];
    }) : [];
    content.push({ type: component, props: {
      id,
      brandName: text(props.brand_name, '사이트 이름'),
      ...(typeof props.use_site_settings === 'boolean' ? { useSiteSettings: props.use_site_settings } : {}),
      homeUrl: text(props.home_url, '/'),
      columns,
      legalText: text(props.legal_text),
      responsiveOverrides: Object.prototype.hasOwnProperty.call(props, 'responsive')
        ? footerResponsiveFromCanonical(props.responsive)
        : legacyFooterResponsiveOverrides(),
    } });
  }

  return { root: { props: {} }, content } as SitePartPuckData;
}

export function sitePartPuckToCanonical(data: SitePartPuckData, source: SitePartDocument): SitePartDocument {
  const blocks = data.content
    .filter((block) => block.type !== 'HeaderSystemControls')
    .map((block, index): PageBuilderBlock => {
    const props = block.props as Record<string, unknown>;
    const component = block.type as keyof SitePartComponents;
    let canonicalProps: Record<string, unknown>;
    let canonicalSlots: Record<string, PageBuilderBlock[]> = {};
    if (component === 'HeaderNavigation') {
      const sourceBlock = source.blocks.find((candidate) => candidate.instance_id.toLowerCase() === stableUuid(text(props.id, '')).toLowerCase());
      const mobileMenuStyle: SitePartMobileMenuStyle = props.mobileMenuStyle === 'dropdown' || props.mobileMenuStyle === 'drawer-left'
        || props.mobileMenuStyle === 'sheet-bottom' ? props.mobileMenuStyle : 'drawer-right';
      const responsiveOverrides = (props.responsiveOverrides as HeaderResponsiveOverrides | undefined) ?? {};
      const sourceHasResponsive = Object.prototype.hasOwnProperty.call(sourceBlock?.props ?? {}, 'responsive');
      const ctaLabel = text(props.ctaLabel);
      const ctaUrl = text(props.ctaUrl);
      canonicalProps = {
        brand_name: text(props.brandName), logo_url: text(props.logoUrl), home_url: text(props.homeUrl, '/'),
        variant: props.variant === 'transparent' ? 'transparent' : 'solid', sticky: props.sticky !== false,
        navigation: canonicalHeaderLinks(props.navigation), cta: ctaLabel && ctaUrl ? { label: ctaLabel, url: ctaUrl } : null,
        mobile_menu: props.mobileMenu !== false,
        ...(Object.prototype.hasOwnProperty.call(sourceBlock?.props ?? {}, 'mobile_menu_style') || mobileMenuStyle !== 'drawer-right'
          ? { mobile_menu_style: mobileMenuStyle }
          : {}),
        ...(sourceHasResponsive || !responsiveOverridesEqual(responsiveOverrides, legacyHeaderResponsiveOverrides(mobileMenuStyle))
          ? { responsive: headerResponsiveToCanonical(responsiveOverrides) }
          : {}),
      };
      const systemControls = Array.isArray(props.systemControls)
        ? props.systemControls.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
        : [];
      const controlBlocks = systemControls.flatMap((item, controlIndex): PageBuilderBlock[] => {
        if (item.type !== 'HeaderSystemControls' || !item.props || typeof item.props !== 'object') return [];
        const controlProps = item.props as Record<string, unknown>;
        return [{
          instance_id: stableUuid(text(controlProps.id, `${text(props.id)}:system-controls:${controlIndex}`)),
          type: 'site.header.system-controls-01',
          block_version: 1,
          props: {
            search: systemControlValue(controlProps, 'search'),
            account: systemControlValue(controlProps, 'account'),
            cart: systemControlValue(controlProps, 'cart'),
            notifications: systemControlValue(controlProps, 'notifications'),
            theme: systemControlValue(controlProps, 'theme'),
            locale: systemControlValue(controlProps, 'locale'),
            currency: systemControlValue(controlProps, 'currency'),
          },
          slots: {},
        }];
      }).slice(0, 1);
      const defaultControls = controlBlocks.length === 1
        && Object.entries(DEFAULT_HEADER_SYSTEM_CONTROLS).every(([key, value]) => controlBlocks[0]?.props[key] === value);
      if (Object.prototype.hasOwnProperty.call(sourceBlock?.slots ?? {}, 'systemControls') || !defaultControls) {
        canonicalSlots = { systemControls: controlBlocks };
      }
    } else if (component === 'Announcement') {
      canonicalProps = {
        text: text(props.text), link_label: text(props.linkLabel), link_url: text(props.linkUrl),
        tone: props.tone === 'dark' || props.tone === 'light' ? props.tone : 'brand',
      };
    } else if (component === 'FooterSimple') {
      const sourceBlock = source.blocks.find((candidate) => candidate.instance_id.toLowerCase() === stableUuid(text(props.id, '')).toLowerCase());
      const responsiveOverrides = (props.responsiveOverrides as FooterResponsiveOverrides | undefined) ?? {};
      canonicalProps = {
        brand_name: text(props.brandName), home_url: text(props.homeUrl, '/'),
        navigation: leafLinks(props.navigation), footer_text: text(props.footerText),
        ...(Object.prototype.hasOwnProperty.call(sourceBlock?.props ?? {}, 'responsive')
          || !responsiveOverridesEqual(responsiveOverrides, legacyFooterResponsiveOverrides())
          ? { responsive: footerResponsiveToCanonical(responsiveOverrides) }
          : {}),
      };
    } else {
      const sourceBlock = source.blocks.find((candidate) => candidate.instance_id.toLowerCase() === stableUuid(text(props.id, '')).toLowerCase());
      const responsiveOverrides = (props.responsiveOverrides as FooterResponsiveOverrides | undefined) ?? {};
      const columns = Array.isArray(props.columns) ? props.columns.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const sourceColumn = item as Record<string, unknown>;
        return [{ heading: text(sourceColumn.heading), links: leafLinks(sourceColumn.links) }];
      }) : [];
      canonicalProps = {
        brand_name: text(props.brandName), home_url: text(props.homeUrl, '/'), columns, legal_text: text(props.legalText),
        ...(Object.prototype.hasOwnProperty.call(sourceBlock?.props ?? {}, 'responsive')
          || !responsiveOverridesEqual(responsiveOverrides, legacyFooterResponsiveOverrides())
          ? { responsive: footerResponsiveToCanonical(responsiveOverrides) }
          : {}),
      };
    }
    if (component !== 'Announcement' && typeof props.useSiteSettings === 'boolean') canonicalProps.use_site_settings = props.useSiteSettings;
    return {
      instance_id: stableUuid(text(props.id, `${source.site_part_id}:${component}:${index}`)),
      type: TYPE_BY_COMPONENT[component],
      block_version: 1,
      props: canonicalProps,
      slots: canonicalSlots,
    };
  });
  return { ...source, blocks };
}

function normalizedSetContent(content: SitePartPuckData['content']): SitePartPuckData['content'] {
  const announcement = content.find((block) => block.type === 'Announcement');
  const header = content.find((block) => block.type === 'HeaderNavigation');
  const footer = content.find((block) => block.type === 'FooterSimple' || block.type === 'FooterColumns');
  return [announcement, header, footer].filter(Boolean) as SitePartPuckData['content'];
}

export function normalizeSitePartSetPuckData(data: SitePartPuckData): SitePartPuckData {
  return {
    root: data.root,
    content: normalizedSetContent(data.content),
  } as SitePartPuckData;
}

export function sitePartSetCanonicalToPuck(
  header: SitePartDocument,
  footer: SitePartDocument,
): SitePartPuckData {
  if (header.kind !== 'header' || footer.kind !== 'footer' || header.locale !== footer.locale) {
    throw new Error('Site Part set requires one Header and one Footer in the same locale.');
  }
  return normalizeSitePartSetPuckData({
    root: { props: {} },
    content: [
      ...sitePartCanonicalToPuck(header).content,
      ...sitePartCanonicalToPuck(footer).content,
    ],
  } as SitePartPuckData);
}

export function sitePartSetPuckToCanonical(
  data: SitePartPuckData,
  header: SitePartDocument,
  footer: SitePartDocument,
): { header: SitePartDocument; footer: SitePartDocument } {
  const normalized = normalizeSitePartSetPuckData(data);
  const headerData = {
    root: normalized.root,
    content: normalized.content.filter((block) => block.type === 'Announcement' || block.type === 'HeaderNavigation'),
  } as SitePartPuckData;
  const footerData = {
    root: normalized.root,
    content: normalized.content.filter((block) => block.type === 'FooterSimple' || block.type === 'FooterColumns'),
  } as SitePartPuckData;
  return {
    header: sitePartPuckToCanonical(headerData, header),
    footer: sitePartPuckToCanonical(footerData, footer),
  };
}

export function sitePartSetPresetToPuck(
  header: SitePartDocument,
  footer: SitePartDocument,
  preset: SitePartSetPresetKey,
): SitePartPuckData {
  const headerPreset: SitePartPresetKey = preset === 'business'
    ? 'header-business'
    : preset === 'minimal' ? 'header-minimal' : 'header-community';
  const footerPreset: SitePartPresetKey = preset === 'business'
    ? 'footer-business'
    : preset === 'minimal' ? 'footer-compact' : 'footer-community';
  return normalizeSitePartSetPuckData({
    root: { props: {} },
    content: [
      ...sitePartPresetToPuck(header, headerPreset).content,
      ...sitePartPresetToPuck(footer, footerPreset).content,
    ],
  } as SitePartPuckData);
}
