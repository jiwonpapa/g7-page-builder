import type { BlockAppearance, BlockMotion, ElementAppearanceMap } from '../documents/blockPresentation';
import { normalizeElementAppearanceMap } from './elementAppearanceData';

export interface AppearanceEditorProps {
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

export function normalizeSurface(value: unknown, fallback: BlockAppearance['surface'] = 'default'): BlockAppearance['surface'] {
  return value === 'default' || value === 'soft' || value === 'contrast' ? value : fallback;
}

export function normalizeSpacing(value: unknown, fallback: BlockAppearance['spacing'] = 'normal'): BlockAppearance['spacing'] {
  return value === 'compact' || value === 'normal' || value === 'spacious' ? value : fallback;
}

export function appearance(record: Record<string, unknown>, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } {
  const resolved: BlockAppearance = {
    surface: normalizeSurface(record.surface, fallback.surface),
    spacing: normalizeSpacing(record.spacing, fallback.spacing),
  };
  if (record.textScale === 'compact' || record.textScale === 'large') resolved.textScale = record.textScale;
  if (record.textAlign === 'center' || record.textAlign === 'right') resolved.textAlign = record.textAlign;
  const elements = normalizeElementAppearanceMap(record.elementStyles ?? record.elements);
  return Object.keys(elements).length > 0 ? { ...resolved, elementStyles: elements } : resolved;
}

export function attachAppearance(props: Record<string, unknown>, raw: Record<string, unknown>, fallback: BlockAppearance, include: boolean): Record<string, unknown> {
  const next = { ...props };
  const editor = appearance({
    surface: raw.surface, spacing: raw.spacing, textScale: raw.textScale, textAlign: raw.textAlign,
    elementStyles: raw.elementStyles,
  }, fallback);
  const { elementStyles, ...resolved } = editor;
  const canonical: BlockAppearance = {
    ...resolved,
    ...(elementStyles && Object.keys(elementStyles).length > 0 ? { elements: elementStyles } : {}),
  };
  if (include || canonical.surface !== fallback.surface || canonical.spacing !== fallback.spacing
    || canonical.textScale || canonical.textAlign || canonical.elements) next.appearance = canonical;
  return next;
}
