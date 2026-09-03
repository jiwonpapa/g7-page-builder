import type { ElementAppearance, ElementAppearanceMap } from '../documents/blockPresentation';
import { normalizeFontSizeRem } from './fontSize';

export function normalizeElementAppearance(value: unknown): ElementAppearance {
  const record = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fontSizeRem = normalizeFontSizeRem(record.fontSizeRem);
  return {
    ...(record.font === 'system' || record.font === 'modern' || record.font === 'serif' || record.font === 'mono' ? { font: record.font } : {}),
    ...(fontSizeRem !== undefined ? { fontSizeRem } : {}),
    ...(fontSizeRem === undefined && (record.size === 'small' || record.size === 'large' || record.size === 'xlarge') ? { size: record.size } : {}),
    ...(record.weight === 'regular' || record.weight === 'medium' || record.weight === 'semibold' || record.weight === 'bold' ? { weight: record.weight } : {}),
    ...(record.align === 'center' || record.align === 'right' ? { align: record.align } : {}),
    ...(record.tone === 'muted' || record.tone === 'accent' || record.tone === 'contrast'
      || record.tone === 'custom1' || record.tone === 'custom2' || record.tone === 'custom3' || record.tone === 'custom4'
      ? { tone: record.tone } : {}),
  };
}

export function normalizeElementAppearanceMap(value: unknown): ElementAppearanceMap {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([path]) => /^[A-Za-z][A-Za-z0-9]*(?:\.\d+)?(?:\.[A-Za-z][A-Za-z0-9]*)?$/.test(path))
    .map(([path, appearance]) => [path, normalizeElementAppearance(appearance)])
    .filter(([, appearance]) => Object.keys(appearance).length > 0));
}
