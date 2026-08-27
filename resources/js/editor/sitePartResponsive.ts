export type SitePartViewport = 'desktop' | 'tablet' | 'mobile';
export type SitePartResponsiveViewport = Exclude<SitePartViewport, 'desktop'>;
export type SitePartDensity = 'compact' | 'comfortable' | 'spacious';
export type SitePartAlignment = 'start' | 'center' | 'spread';
export type SitePartMobileMenuStyle = 'dropdown' | 'drawer-left' | 'drawer-right' | 'sheet-bottom';

export interface HeaderResponsivePresentation {
  density: SitePartDensity;
  alignment: SitePartAlignment;
  showCta: boolean;
  mobileMenuStyle: SitePartMobileMenuStyle;
}

export interface FooterResponsivePresentation {
  density: SitePartDensity;
  alignment: Exclude<SitePartAlignment, 'spread'>;
  showNavigation: boolean;
  columns: 1 | 2 | 4;
}

export type HeaderResponsiveOverride = Partial<HeaderResponsivePresentation>;
export type FooterResponsiveOverride = Partial<FooterResponsivePresentation>;

export interface ResponsiveOverrides<T> {
  tablet?: T;
  mobile?: T;
}

export type HeaderResponsiveOverrides = ResponsiveOverrides<HeaderResponsiveOverride>;
export type FooterResponsiveOverrides = ResponsiveOverrides<FooterResponsiveOverride>;

const DENSITIES: readonly SitePartDensity[] = ['compact', 'comfortable', 'spacious'];
const ALIGNMENTS: readonly SitePartAlignment[] = ['start', 'center', 'spread'];
const FOOTER_ALIGNMENTS: readonly FooterResponsivePresentation['alignment'][] = ['start', 'center'];
const MENU_STYLES: readonly SitePartMobileMenuStyle[] = ['dropdown', 'drawer-left', 'drawer-right', 'sheet-bottom'];
const FOOTER_COLUMNS: readonly FooterResponsivePresentation['columns'][] = [1, 2, 4];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function member<T extends string | number>(value: unknown, choices: readonly T[]): T | undefined {
  return choices.includes(value as T) ? value as T : undefined;
}

function compact<T extends object>(value: T): T | undefined {
  return Object.keys(value).length > 0 ? value : undefined;
}

function responsive<T>(tablet: T | undefined, mobile: T | undefined): ResponsiveOverrides<T> {
  return {
    ...(tablet === undefined ? {} : { tablet }),
    ...(mobile === undefined ? {} : { mobile }),
  };
}

export function viewportFromWidth(width: number | '100%'): SitePartViewport {
  if (width === '100%' || width > 899) return 'desktop';
  return width <= 520 ? 'mobile' : 'tablet';
}

function headerOverrideFromCanonical(value: unknown): HeaderResponsiveOverride | undefined {
  const source = record(value);
  return compact({
    ...(member(source.density, DENSITIES) ? { density: member(source.density, DENSITIES) } : {}),
    ...(member(source.alignment, ALIGNMENTS) ? { alignment: member(source.alignment, ALIGNMENTS) } : {}),
    ...(typeof source.show_cta === 'boolean' ? { showCta: source.show_cta } : {}),
    ...(member(source.mobile_menu_style, MENU_STYLES) ? { mobileMenuStyle: member(source.mobile_menu_style, MENU_STYLES) } : {}),
  });
}

function footerOverrideFromCanonical(value: unknown): FooterResponsiveOverride | undefined {
  const source = record(value);
  return compact({
    ...(member(source.density, DENSITIES) ? { density: member(source.density, DENSITIES) } : {}),
    ...(member(source.alignment, FOOTER_ALIGNMENTS) ? { alignment: member(source.alignment, FOOTER_ALIGNMENTS) } : {}),
    ...(typeof source.show_navigation === 'boolean' ? { showNavigation: source.show_navigation } : {}),
    ...(member(source.columns, FOOTER_COLUMNS) ? { columns: member(source.columns, FOOTER_COLUMNS) } : {}),
  });
}

export function headerResponsiveFromCanonical(value: unknown): HeaderResponsiveOverrides {
  const source = record(value);
  return responsive(headerOverrideFromCanonical(source.tablet), headerOverrideFromCanonical(source.mobile));
}

export function footerResponsiveFromCanonical(value: unknown): FooterResponsiveOverrides {
  const source = record(value);
  return responsive(footerOverrideFromCanonical(source.tablet), footerOverrideFromCanonical(source.mobile));
}

function headerOverrideToCanonical(value: HeaderResponsiveOverride | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return compact({
    ...(value.density ? { density: value.density } : {}),
    ...(value.alignment ? { alignment: value.alignment } : {}),
    ...(typeof value.showCta === 'boolean' ? { show_cta: value.showCta } : {}),
    ...(value.mobileMenuStyle ? { mobile_menu_style: value.mobileMenuStyle } : {}),
  });
}

function footerOverrideToCanonical(value: FooterResponsiveOverride | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  return compact({
    ...(value.density ? { density: value.density } : {}),
    ...(value.alignment ? { alignment: value.alignment } : {}),
    ...(typeof value.showNavigation === 'boolean' ? { show_navigation: value.showNavigation } : {}),
    ...(value.columns ? { columns: value.columns } : {}),
  });
}

export function headerResponsiveToCanonical(value: HeaderResponsiveOverrides): Record<string, unknown> {
  return responsive(headerOverrideToCanonical(value.tablet), headerOverrideToCanonical(value.mobile)) as Record<string, unknown>;
}

export function footerResponsiveToCanonical(value: FooterResponsiveOverrides): Record<string, unknown> {
  return responsive(footerOverrideToCanonical(value.tablet), footerOverrideToCanonical(value.mobile)) as Record<string, unknown>;
}

export function legacyHeaderResponsiveOverrides(mobileMenuStyle: SitePartMobileMenuStyle): HeaderResponsiveOverrides {
  return {
    tablet: { density: 'comfortable', alignment: 'spread', showCta: false, mobileMenuStyle },
    mobile: { density: 'compact', alignment: 'spread', showCta: false, mobileMenuStyle },
  };
}

export function legacyFooterResponsiveOverrides(): FooterResponsiveOverrides {
  return {
    tablet: { density: 'comfortable', alignment: 'start', showNavigation: true, columns: 2 },
    mobile: { density: 'compact', alignment: 'start', showNavigation: true, columns: 1 },
  };
}

export function resolveHeaderPresentation(
  mobileMenuStyle: SitePartMobileMenuStyle,
  overrides: HeaderResponsiveOverrides,
  viewport: SitePartViewport,
): HeaderResponsivePresentation {
  const base: HeaderResponsivePresentation = {
    density: 'comfortable', alignment: 'spread', showCta: true, mobileMenuStyle,
  };
  if (viewport === 'desktop') return base;
  const tablet = { ...base, ...overrides.tablet };
  return viewport === 'tablet' ? tablet : { ...tablet, ...overrides.mobile };
}

export function resolveFooterPresentation(
  desktopColumns: FooterResponsivePresentation['columns'],
  overrides: FooterResponsiveOverrides,
  viewport: SitePartViewport,
): FooterResponsivePresentation {
  const base: FooterResponsivePresentation = {
    density: 'comfortable', alignment: 'start', showNavigation: true, columns: desktopColumns,
  };
  if (viewport === 'desktop') return base;
  const tablet = { ...base, ...overrides.tablet };
  return viewport === 'tablet' ? tablet : { ...tablet, ...overrides.mobile };
}

export function resetResponsiveViewport(overrides: HeaderResponsiveOverrides, viewport: SitePartResponsiveViewport): HeaderResponsiveOverrides;
export function resetResponsiveViewport(overrides: FooterResponsiveOverrides, viewport: SitePartResponsiveViewport): FooterResponsiveOverrides;
export function resetResponsiveViewport(
  overrides: ResponsiveOverrides<object>,
  viewport: SitePartResponsiveViewport,
): ResponsiveOverrides<object> {
  const next = { ...overrides };
  delete next[viewport];
  return next;
}

export function responsiveOverridesEqual<T>(left: ResponsiveOverrides<T>, right: ResponsiveOverrides<T>): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
