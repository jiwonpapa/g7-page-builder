import { describe, expect, it } from 'vitest';
import * as responsiveData from '../../resources/js/editor/responsiveBlockData';

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
  hasResponsiveOverrides,
  updatePart,
} = responsiveData;

describe('typed responsive block style policy', () => {
  it('retains the original public exports as the same data-owner bindings', async () => {
    const style = await import('../../resources/js/editor/responsiveBlockStyle');
    for (const name of [
      'normalizeResponsiveOverrides', 'hasResponsiveOverrides', 'resolveResponsiveAppearance',
      'resolveResponsiveLayout', 'resetResponsivePart', 'responsiveClassName',
    ] as const) expect(style[name]).toBe(responsiveData[name]);
  });

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

  it('preserves valid explicit values without inventing missing defaults', () => {
    const value = {
      tablet: {
        appearance: { surface: 'default', spacing: 'normal', textScale: 'balanced', textAlign: 'left',
          containerWidth: 'inherit', containerAlign: 'stretch', minHeight: 'auto', verticalAlign: 'start' },
        layout: { width: 'wide', spacing: 'compact', columns: 2, gap: 'none' },
      },
      mobile: { appearance: { surface: 'soft' }, layout: { columns: 1 } },
    };
    expect(normalizeResponsiveOverrides(value)).toEqual(value);
    expect(hasResponsiveOverrides(value)).toBe(true);
    for (const absent of [undefined, null, [], {}, { tablet: { appearance: {} } }, { mobile: { layout: { columns: 2 } } }]) {
      expect(normalizeResponsiveOverrides(absent)).toEqual({});
      expect(hasResponsiveOverrides(absent)).toBe(false);
      expect(responsiveClassName(absent)).toBe('');
    }
  });

  it('clears only the requested override while retaining other parts and immutable inputs', () => {
    const source = Object.freeze({
      tablet: Object.freeze({
        appearance: Object.freeze({ surface: 'contrast', spacing: 'compact' }),
        layout: Object.freeze({ columns: 2, gap: 'spacious' }),
      }),
      mobile: Object.freeze({ appearance: Object.freeze({ surface: 'soft' }) }),
    });
    const cleared = updatePart(source, 'tablet', 'appearance', 'surface', '');
    expect(cleared).toEqual({
      tablet: { appearance: { spacing: 'compact' }, layout: { columns: 2, gap: 'spacious' } },
      mobile: { appearance: { surface: 'soft' } },
    });
    expect(updatePart(source, 'tablet', 'appearance', 'surface', undefined)).toEqual(cleared);
    expect(updatePart(source, 'tablet', 'appearance', 'surface', 'unregistered')).toEqual(cleared);
    expect(resetResponsivePart(source, 'tablet', 'appearance')).toEqual({
      tablet: { layout: { columns: 2, gap: 'spacious' } }, mobile: { appearance: { surface: 'soft' } },
    });
    expect(resetResponsivePart(source, 'mobile', 'appearance')).toEqual({ tablet: {
      appearance: { surface: 'contrast', spacing: 'compact' }, layout: { columns: 2, gap: 'spacious' },
    } });
    expect(source.tablet.appearance.surface).toBe('contrast');
    expect(source.mobile.appearance.surface).toBe('soft');
  });
});
