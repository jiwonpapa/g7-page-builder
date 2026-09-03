// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { appearance, attachAppearance, normalizeSpacing, normalizeSurface } from '../../resources/js/editor/catalogAppearance';

describe('pure catalog appearance adapter', () => {
  const fallback = { surface: 'soft', spacing: 'compact' } as const;

  it('distinguishes valid explicit defaults from absent or invalid values', () => {
    expect(appearance({ surface: 'default', spacing: 'normal' }, fallback))
      .toEqual({ surface: 'default', spacing: 'normal' });
    for (const value of [undefined, null, false, 1, '', 'invalid', [], {}]) {
      expect(appearance({ surface: value, spacing: value }, fallback)).toEqual(fallback);
    }
    expect(normalizeSurface(undefined)).toBe('default');
    expect(normalizeSpacing(undefined)).toBe('normal');
  });

  it('omits unchanged inherited appearance unless the source explicitly owned it', () => {
    const props = { heading: 'Sentinel' };
    expect(attachAppearance(props, { ...fallback, textScale: 'balanced', textAlign: 'left' }, fallback, false)).toEqual(props);
    expect(attachAppearance(props, fallback, fallback, true)).toEqual({ ...props, appearance: fallback });
    expect(attachAppearance(props, { surface: 'default', spacing: 'normal' }, fallback, false))
      .toEqual({ ...props, appearance: { surface: 'default', spacing: 'normal' } });
    expect(attachAppearance(props, { ...fallback, textScale: 'large', textAlign: 'right' }, fallback, false))
      .toEqual({ ...props, appearance: { ...fallback, textScale: 'large', textAlign: 'right' } });
    expect(props).toEqual({ heading: 'Sentinel' });
  });

  it('preserves element alias precedence, safe tokens and canonical output without mutating input', () => {
    const raw = { ...fallback, containerWidth: 'full',
      elementStyles: { heading: { fontSizeRem: 3, size: 'large', weight: 'bold', color: 'red' },
        'items.0.label': { tone: 'accent' }, 'bad[path]': { weight: 'bold' } },
      elements: { heading: { font: 'serif' } },
    };
    const before = structuredClone(raw);
    const elements = { heading: { fontSizeRem: 3, weight: 'bold' }, 'items.0.label': { tone: 'accent' } };
    expect(appearance(raw, fallback)).toEqual({ ...fallback, elementStyles: elements });
    expect(attachAppearance({ heading: 'Sentinel' }, raw, fallback, false))
      .toEqual({ heading: 'Sentinel', appearance: { ...fallback, elements } });
    expect(appearance({ elements: raw.elements }, fallback)).toEqual({ ...fallback, elementStyles: raw.elements });
    expect(appearance({ ...raw, elementStyles: {} }, fallback)).toEqual(fallback);
    expect(appearance({ ...raw, elementStyles: null }, fallback)).toEqual({ ...fallback, elementStyles: raw.elements });
    expect(attachAppearance({}, { ...fallback, elementStyles: { heading: { weight: 'regular' } } }, fallback, false))
      .toEqual({ appearance: { ...fallback, elements: { heading: { weight: 'regular' } } } });
    expect(attachAppearance({}, { ...fallback, elementStyles: { heading: {} } }, fallback, false)).toEqual({});
    expect(raw).toEqual(before);
  });
});
