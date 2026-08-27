import { describe, expect, it } from 'vitest';

import {
  headerResponsiveFromCanonical,
  headerResponsiveToCanonical,
  legacyFooterResponsiveOverrides,
  legacyHeaderResponsiveOverrides,
  resetResponsiveViewport,
  resolveFooterPresentation,
  resolveHeaderPresentation,
  viewportFromWidth,
} from '../../resources/js/editor/sitePartResponsive';

describe('Site Part responsive presentation', () => {
  it('maps the Puck viewport width to the product viewport contract', () => {
    expect(viewportFromWidth(1280)).toBe('desktop');
    expect(viewportFromWidth(768)).toBe('tablet');
    expect(viewportFromWidth(360)).toBe('mobile');
    expect(viewportFromWidth('100%')).toBe('desktop');
  });

  it('keeps legacy Header and Footer layouts stable until a viewport override is changed', () => {
    const header = legacyHeaderResponsiveOverrides('drawer-right');
    expect(resolveHeaderPresentation('drawer-right', header, 'tablet')).toEqual({
      density: 'comfortable', alignment: 'spread', showCta: false, mobileMenuStyle: 'drawer-right',
    });
    expect(resolveHeaderPresentation('drawer-right', header, 'mobile')).toEqual({
      density: 'compact', alignment: 'spread', showCta: false, mobileMenuStyle: 'drawer-right',
    });

    const footer = legacyFooterResponsiveOverrides();
    expect(resolveFooterPresentation(4, footer, 'tablet')).toEqual({
      density: 'comfortable', alignment: 'start', showNavigation: true, columns: 2,
    });
    expect(resolveFooterPresentation(4, footer, 'mobile')).toEqual({
      density: 'compact', alignment: 'start', showNavigation: true, columns: 1,
    });
  });

  it('cascades PC to tablet to mobile and resets only the active viewport', () => {
    const overrides = {
      tablet: { density: 'spacious' as const, alignment: 'center' as const },
      mobile: { mobileMenuStyle: 'sheet-bottom' as const, showCta: false },
    };
    expect(resolveHeaderPresentation('drawer-left', overrides, 'mobile')).toEqual({
      density: 'spacious', alignment: 'center', showCta: false, mobileMenuStyle: 'sheet-bottom',
    });
    expect(resetResponsiveViewport(overrides, 'mobile')).toEqual({ tablet: overrides.tablet });
    expect(resetResponsiveViewport(overrides, 'tablet')).toEqual({ mobile: overrides.mobile });
  });

  it('normalizes the canonical contract and never accepts arbitrary style keys', () => {
    const normalized = headerResponsiveFromCanonical({
      tablet: { density: 'compact', alignment: 'center', show_cta: true, mobile_menu_style: 'drawer-left', class_name: 'fixed' },
      mobile: { density: 'invalid', mobile_menu_style: 'sheet-bottom', style: 'position:fixed' },
      desktop: { density: 'spacious' },
    });

    expect(normalized).toEqual({
      tablet: { density: 'compact', alignment: 'center', showCta: true, mobileMenuStyle: 'drawer-left' },
      mobile: { mobileMenuStyle: 'sheet-bottom' },
    });
    expect(headerResponsiveToCanonical(normalized)).toEqual({
      tablet: { density: 'compact', alignment: 'center', show_cta: true, mobile_menu_style: 'drawer-left' },
      mobile: { mobile_menu_style: 'sheet-bottom' },
    });
  });
});
