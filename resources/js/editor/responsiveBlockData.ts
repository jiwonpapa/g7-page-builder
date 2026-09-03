import type {
  BlockAppearance,
  BlockResponsiveOverride,
  BlockResponsiveOverrides,
  ResponsiveAppearanceOverride,
  ResponsiveLayoutOverride,
} from '../documents/blockPresentation';

export type ResponsiveViewport = 'tablet' | 'mobile';
export type ResponsiveLayoutKind = 'section' | 'columns' | 'stack';
export type CommonResponsiveLayout = Omit<ResponsiveLayoutOverride, 'columns'> & { columns?: 1 | 2 | 3 };

export const SURFACES = ['default', 'soft', 'contrast'] as const;
export const SPACINGS = ['compact', 'normal', 'spacious'] as const;
export const TEXT_SCALES = ['compact', 'balanced', 'large'] as const;
export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export const WIDTHS = ['inherit', 'narrow', 'standard', 'wide', 'full'] as const;
export const CONTAINER_ALIGNS = ['left', 'center', 'right', 'stretch'] as const;
export const HEIGHTS = ['auto', 'compact', 'medium', 'large', 'viewport'] as const;
export const VERTICAL_ALIGNS = ['start', 'center', 'end'] as const;
export const LAYOUT_WIDTHS = ['standard', 'wide', 'full'] as const;
export const GAPS = ['none', 'compact', 'normal', 'spacious'] as const;

export function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function choice<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return typeof value === 'string' && options.includes(value as T) ? value as T : undefined;
}

function normalizeAppearance(value: unknown): ResponsiveAppearanceOverride | undefined {
  const source = record(value);
  const next: ResponsiveAppearanceOverride = {};
  const surface = choice(source.surface, SURFACES);
  const spacing = choice(source.spacing, SPACINGS);
  const textScale = choice(source.textScale, TEXT_SCALES);
  const textAlign = choice(source.textAlign, TEXT_ALIGNS);
  const containerWidth = choice(source.containerWidth, WIDTHS);
  const containerAlign = choice(source.containerAlign, CONTAINER_ALIGNS);
  const minHeight = choice(source.minHeight, HEIGHTS);
  const verticalAlign = choice(source.verticalAlign, VERTICAL_ALIGNS);
  if (surface) next.surface = surface;
  if (spacing) next.spacing = spacing;
  if (textScale) next.textScale = textScale;
  if (textAlign) next.textAlign = textAlign;
  if (containerWidth) next.containerWidth = containerWidth;
  if (containerAlign) next.containerAlign = containerAlign;
  if (minHeight) next.minHeight = minHeight;
  if (verticalAlign) next.verticalAlign = verticalAlign;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeLayout(value: unknown, viewport: ResponsiveViewport): ResponsiveLayoutOverride | undefined {
  const source = record(value);
  const next: ResponsiveLayoutOverride = {};
  const width = choice(source.width, LAYOUT_WIDTHS);
  const spacing = choice(source.spacing, SPACINGS);
  const gap = choice(source.gap, GAPS);
  if (width) next.width = width;
  if (spacing) next.spacing = spacing;
  if (gap) next.gap = gap;
  if (viewport === 'tablet' && (source.columns === 1 || source.columns === 2)) next.columns = source.columns;
  if (viewport === 'mobile' && source.columns === 1) next.columns = 1;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeViewport(value: unknown, viewport: ResponsiveViewport): BlockResponsiveOverride | undefined {
  const source = record(value);
  const appearance = normalizeAppearance(source.appearance);
  const layout = normalizeLayout(source.layout, viewport);
  return appearance || layout ? { ...(appearance ? { appearance } : {}), ...(layout ? { layout } : {}) } : undefined;
}

export function normalizeResponsiveOverrides(value: unknown): BlockResponsiveOverrides {
  const source = record(value);
  const tablet = normalizeViewport(source.tablet, 'tablet');
  const mobile = normalizeViewport(source.mobile, 'mobile');
  return { ...(tablet ? { tablet } : {}), ...(mobile ? { mobile } : {}) };
}

export function hasResponsiveOverrides(value: unknown): boolean {
  return Object.keys(normalizeResponsiveOverrides(value)).length > 0;
}

export function resolveResponsiveAppearance(
  common: BlockAppearance,
  value: unknown,
  viewport: ResponsiveViewport,
): BlockAppearance {
  const override = normalizeResponsiveOverrides(value)[viewport]?.appearance ?? {};
  return { ...common, ...override };
}

export function resolveResponsiveLayout(
  kind: ResponsiveLayoutKind,
  common: CommonResponsiveLayout,
  value: unknown,
  viewport: ResponsiveViewport,
): ResponsiveLayoutOverride {
  const { columns: commonColumns, ...commonValues } = common;
  const inherited: ResponsiveLayoutOverride = { ...commonValues };
  if (kind === 'columns') inherited.columns = viewport === 'mobile' ? 1 : Math.min(Number(commonColumns ?? 2), 2) as 1 | 2;
  return { ...inherited, ...(normalizeResponsiveOverrides(value)[viewport]?.layout ?? {}) };
}

export function resetResponsivePart(
  value: unknown,
  viewport: ResponsiveViewport,
  part: keyof BlockResponsiveOverride,
): BlockResponsiveOverrides {
  const next = normalizeResponsiveOverrides(value);
  const current = { ...(next[viewport] ?? {}) };
  delete current[part];
  if (Object.keys(current).length > 0) next[viewport] = current;
  else delete next[viewport];
  return next;
}

export function updatePart(
  value: unknown,
  viewport: ResponsiveViewport,
  part: keyof BlockResponsiveOverride,
  key: string,
  nextValue: unknown,
): BlockResponsiveOverrides {
  const next = normalizeResponsiveOverrides(value);
  const currentViewport = { ...(next[viewport] ?? {}) };
  const currentPart = { ...record(currentViewport[part]) };
  if (nextValue === '' || nextValue === undefined) delete currentPart[key];
  else currentPart[key] = nextValue;
  if (Object.keys(currentPart).length > 0) currentViewport[part] = currentPart;
  else delete currentViewport[part];
  if (Object.keys(currentViewport).length > 0) next[viewport] = currentViewport;
  else delete next[viewport];
  return normalizeResponsiveOverrides(next);
}

const CLASS_KEYS: ReadonlyArray<[keyof ResponsiveAppearanceOverride, string]> = [
  ['surface', 'surface'], ['spacing', 'spacing'], ['textScale', 'text-scale'], ['textAlign', 'text-align'],
  ['containerWidth', 'container-width'], ['containerAlign', 'container-align'], ['minHeight', 'min-height'],
  ['verticalAlign', 'vertical-align'],
];
const LAYOUT_CLASS_KEYS: ReadonlyArray<[keyof ResponsiveLayoutOverride, string]> = [
  ['width', 'width'], ['spacing', 'spacing'], ['columns', 'columns'], ['gap', 'gap'],
];

export function responsiveClassName(value: unknown): string {
  const responsive = normalizeResponsiveOverrides(value);
  const classes: string[] = [];
  for (const viewport of ['tablet', 'mobile'] as const) {
    const appearance = responsive[viewport]?.appearance;
    const layout = responsive[viewport]?.layout;
    for (const [key, cssKey] of CLASS_KEYS) {
      const item = appearance?.[key];
      if (item !== undefined) classes.push(`g7pb-${viewport}-appearance-${cssKey}--${item}`);
    }
    for (const [key, cssKey] of LAYOUT_CLASS_KEYS) {
      const item = layout?.[key];
      if (item !== undefined) classes.push(`g7pb-${viewport}-layout-${cssKey}--${item}`);
    }
  }
  return classes.join(' ');
}

