import { describe, expect, it } from 'vitest';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

const {
  normalizeResponsiveOverrides,
  resetResponsivePart,
  resolveResponsiveAppearance,
  resolveResponsiveLayout,
  responsiveClassName,
} = await import('../../resources/js/editor/responsiveBlockStyle');

describe('typed responsive block style policy', () => {
  it('inherits mobile directly from common while preserving an explicit tablet override', () => {
    const responsive = {
      tablet: { appearance: { surface: 'contrast' as const } },
      mobile: { appearance: { spacing: 'compact' as const } },
    };
    const reset = resetResponsivePart(responsive, 'mobile', 'appearance');
    const changedCommon = { surface: 'soft' as const, spacing: 'spacious' as const };

    expect(resolveResponsiveAppearance(changedCommon, reset, 'tablet')).toEqual({
      surface: 'contrast', spacing: 'spacious',
    });
    expect(resolveResponsiveAppearance(changedCommon, reset, 'mobile')).toEqual(changedCommon);
    expect(reset).toEqual({ tablet: responsive.tablet });
  });

  it('does not chain mobile from tablet and applies the documented column defaults', () => {
    const responsive = {
      tablet: { layout: { columns: 1 as const, gap: 'spacious' as const } },
      mobile: { layout: { gap: 'compact' as const } },
    };

    expect(resolveResponsiveLayout('columns', { columns: 3, gap: 'normal' }, responsive, 'tablet')).toEqual({
      columns: 1, gap: 'spacious',
    });
    expect(resolveResponsiveLayout('columns', { columns: 3, gap: 'normal' }, responsive, 'mobile')).toEqual({
      columns: 1, gap: 'compact',
    });
  });

  it('drops untyped content and invalid values before serialization', () => {
    expect(normalizeResponsiveOverrides({
      tablet: { appearance: { surface: 'contrast', title: '금지' }, layout: { columns: 2, gap: 'huge' } },
      mobile: { appearance: { spacing: 'invalid' }, layout: { columns: 2 }, link: '/unsafe' },
      desktop: { appearance: { surface: 'soft' } },
    })).toEqual({ tablet: { appearance: { surface: 'contrast' }, layout: { columns: 2 } } });
  });

  it('generates the same finite class contract used by preview and publication', () => {
    expect(responsiveClassName({
      tablet: { appearance: { surface: 'soft', textAlign: 'center' }, layout: { columns: 2 } },
      mobile: { appearance: { spacing: 'compact' }, layout: { columns: 1, gap: 'none' } },
    })).toBe([
      'g7pb-tablet-appearance-surface--soft',
      'g7pb-tablet-appearance-text-align--center',
      'g7pb-tablet-layout-columns--2',
      'g7pb-mobile-appearance-spacing--compact',
      'g7pb-mobile-layout-columns--1',
      'g7pb-mobile-layout-gap--none',
    ].join(' '));
  });
});
