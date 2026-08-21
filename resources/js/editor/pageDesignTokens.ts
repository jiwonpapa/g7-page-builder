import type { ScalarToken } from '../documents/types';

export const PAGE_DESIGN_TOKEN_KEYS = {
  colorMode: 'design.color_mode',
  palette: 'design.palette',
  font: 'design.font',
  radius: 'design.radius',
  width: 'design.width',
  scale: 'design.scale',
} as const;

export interface PageDesignProps {
  colorMode: 'light' | 'dark' | 'system';
  palette: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  font: 'system' | 'modern' | 'serif';
  radius: 'sharp' | 'soft' | 'round';
  width: 'narrow' | 'standard' | 'wide';
  scale: 'compact' | 'balanced' | 'large';
}

export const DEFAULT_PAGE_DESIGN: PageDesignProps = {
  colorMode: 'light',
  palette: 'indigo',
  font: 'modern',
  radius: 'soft',
  width: 'standard',
  scale: 'balanced',
};

const OPTIONS = {
  colorMode: new Set<PageDesignProps['colorMode']>(['light', 'dark', 'system']),
  palette: new Set<PageDesignProps['palette']>(['indigo', 'blue', 'emerald', 'amber', 'rose', 'slate']),
  font: new Set<PageDesignProps['font']>(['system', 'modern', 'serif']),
  radius: new Set<PageDesignProps['radius']>(['sharp', 'soft', 'round']),
  width: new Set<PageDesignProps['width']>(['narrow', 'standard', 'wide']),
  scale: new Set<PageDesignProps['scale']>(['compact', 'balanced', 'large']),
};

function option<TKey extends keyof PageDesignProps>(
  tokens: Record<string, ScalarToken> | undefined,
  key: TKey,
): PageDesignProps[TKey] {
  const value = tokens?.[PAGE_DESIGN_TOKEN_KEYS[key]];
  if (typeof value !== 'string') {
    return DEFAULT_PAGE_DESIGN[key];
  }

  return (OPTIONS[key] as ReadonlySet<string>).has(value)
    ? value as PageDesignProps[TKey]
    : DEFAULT_PAGE_DESIGN[key];
}

export function tokensToPageDesign(
  tokens: Record<string, ScalarToken> | undefined,
): PageDesignProps {
  return {
    colorMode: option(tokens, 'colorMode'),
    palette: option(tokens, 'palette'),
    font: option(tokens, 'font'),
    radius: option(tokens, 'radius'),
    width: option(tokens, 'width'),
    scale: option(tokens, 'scale'),
  };
}

export function pageDesignToTokens(
  props: Partial<PageDesignProps> | undefined,
  existing: Record<string, ScalarToken> | undefined,
): Record<string, ScalarToken> {
  const normalized = tokensToPageDesign({
    ...(existing ?? {}),
    [PAGE_DESIGN_TOKEN_KEYS.palette]: props?.palette ?? DEFAULT_PAGE_DESIGN.palette,
    [PAGE_DESIGN_TOKEN_KEYS.colorMode]: props?.colorMode ?? DEFAULT_PAGE_DESIGN.colorMode,
    [PAGE_DESIGN_TOKEN_KEYS.font]: props?.font ?? DEFAULT_PAGE_DESIGN.font,
    [PAGE_DESIGN_TOKEN_KEYS.radius]: props?.radius ?? DEFAULT_PAGE_DESIGN.radius,
    [PAGE_DESIGN_TOKEN_KEYS.width]: props?.width ?? DEFAULT_PAGE_DESIGN.width,
    [PAGE_DESIGN_TOKEN_KEYS.scale]: props?.scale ?? DEFAULT_PAGE_DESIGN.scale,
  });

  const result: Record<string, ScalarToken> = { ...(existing ?? {}) };

  for (const key of Object.keys(DEFAULT_PAGE_DESIGN) as Array<keyof PageDesignProps>) {
    const token = PAGE_DESIGN_TOKEN_KEYS[key];
    if (Object.prototype.hasOwnProperty.call(existing ?? {}, token) || normalized[key] !== DEFAULT_PAGE_DESIGN[key]) {
      result[token] = normalized[key];
    }
  }

  return result;
}

export function pageDesignClassName(props: Partial<PageDesignProps>): string {
  const design = { ...DEFAULT_PAGE_DESIGN, ...props };
  return [
    'g7pb-document-theme',
    `g7pb-theme-mode-${design.colorMode}`,
    `g7pb-theme-palette-${design.palette}`,
    `g7pb-theme-font-${design.font}`,
    `g7pb-theme-radius-${design.radius}`,
    `g7pb-theme-width-${design.width}`,
    `g7pb-theme-scale-${design.scale}`,
  ].join(' ');
}
