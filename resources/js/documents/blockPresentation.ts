import type { LayoutColumnsBlockProps, LayoutSectionBlockProps } from './layoutContracts';

export interface BlockAppearance {
  surface: 'default' | 'soft' | 'contrast';
  spacing: 'compact' | 'normal' | 'spacious';
  textScale?: 'compact' | 'balanced' | 'large';
  textAlign?: 'left' | 'center' | 'right';
  containerWidth?: 'inherit' | 'narrow' | 'standard' | 'wide' | 'full';
  containerAlign?: 'left' | 'center' | 'right' | 'stretch';
  minHeight?: 'auto' | 'compact' | 'medium' | 'large' | 'viewport';
  verticalAlign?: 'start' | 'center' | 'end';
  elements?: ElementAppearanceMap;
}

export interface ElementAppearance {
  font?: 'inherit' | 'system' | 'modern' | 'serif' | 'mono';
  /** Explicit user choice in rem. The editor also shows its 16px-root px equivalent. */
  fontSizeRem?: number;
  /** Legacy relative-size token kept for existing documents. */
  size?: 'small' | 'base' | 'large' | 'xlarge';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  align?: 'left' | 'center' | 'right';
  tone?: 'default' | 'muted' | 'accent' | 'contrast' | 'custom1' | 'custom2' | 'custom3' | 'custom4';
}

export type ElementAppearanceMap = Record<string, ElementAppearance>;

export interface ResponsiveAppearanceOverride {
  surface?: BlockAppearance['surface'];
  spacing?: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  containerWidth?: NonNullable<BlockAppearance['containerWidth']>;
  containerAlign?: NonNullable<BlockAppearance['containerAlign']>;
  minHeight?: NonNullable<BlockAppearance['minHeight']>;
  verticalAlign?: NonNullable<BlockAppearance['verticalAlign']>;
}

export interface ResponsiveLayoutOverride {
  width?: LayoutSectionBlockProps['width'];
  spacing?: LayoutSectionBlockProps['spacing'];
  columns?: 1 | 2;
  gap?: LayoutColumnsBlockProps['gap'];
}

export interface BlockResponsiveOverride {
  appearance?: ResponsiveAppearanceOverride;
  layout?: ResponsiveLayoutOverride;
}

export interface BlockResponsiveOverrides {
  tablet?: BlockResponsiveOverride;
  mobile?: BlockResponsiveOverride;
}

export type BlockMotionPreset = 'none' | 'reveal' | 'stagger' | 'parallax-soft' | 'counter' | 'chart-draw';

export interface BlockMotion {
  preset: BlockMotionPreset;
  intensity: 'subtle' | 'normal' | 'strong';
  trigger: 'once' | 'repeat';
  stagger_ms: 60 | 100 | 160;
}
