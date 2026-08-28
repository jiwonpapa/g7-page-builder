export const FONT_SIZE_REM_VALUES = [
  0.75, 0.875, 1, 1.125, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5, 4, 4.5, 5, 6,
] as const;

export type FontSizeRem = typeof FONT_SIZE_REM_VALUES[number];

export function normalizeFontSizeRem(value: unknown): FontSizeRem | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return FONT_SIZE_REM_VALUES.includes(value as FontSizeRem) ? value as FontSizeRem : undefined;
}

export function fontSizeRemToPx(value: FontSizeRem): number {
  return Math.round(value * 16);
}

export function elementFontSizeClassName(value: FontSizeRem): string {
  return `g7pb-element-font-size--${fontSizeRemToPx(value)}`;
}

export const FONT_SIZE_REM_OPTIONS = FONT_SIZE_REM_VALUES.map((value) => ({
  value: String(value),
  label: `${fontSizeRemToPx(value)} px · ${value} rem`,
}));
