import type { ScalarToken } from '../documents/types';

export const PAGE_DESIGN_TOKEN_KEYS = {
  colorMode: 'design.color_mode',
  palette: 'design.palette',
  font: 'design.font',
  radius: 'design.radius',
  width: 'design.width',
  scale: 'design.scale',
  customColor1Light: 'design.custom_color_1_light',
  customColor1Dark: 'design.custom_color_1_dark',
  customColor2Light: 'design.custom_color_2_light',
  customColor2Dark: 'design.custom_color_2_dark',
  customColor3Light: 'design.custom_color_3_light',
  customColor3Dark: 'design.custom_color_3_dark',
  customColor4Light: 'design.custom_color_4_light',
  customColor4Dark: 'design.custom_color_4_dark',
} as const;

export interface PageDesignProps {
  colorMode: 'light' | 'dark' | 'system';
  palette: 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose' | 'slate';
  font: 'system' | 'modern' | 'serif';
  radius: 'sharp' | 'soft' | 'round';
  width: 'narrow' | 'standard' | 'wide';
  scale: 'compact' | 'balanced' | 'large';
  customColor1Light: string;
  customColor1Dark: string;
  customColor2Light: string;
  customColor2Dark: string;
  customColor3Light: string;
  customColor3Dark: string;
  customColor4Light: string;
  customColor4Dark: string;
}

export const DEFAULT_PAGE_DESIGN: PageDesignProps = {
  colorMode: 'light',
  palette: 'indigo',
  font: 'modern',
  radius: 'soft',
  width: 'standard',
  scale: 'balanced',
  customColor1Light: '#2456df',
  customColor1Dark: '#8ba7ff',
  customColor2Light: '#059669',
  customColor2Dark: '#6ee7b7',
  customColor3Light: '#d97706',
  customColor3Dark: '#fbbf24',
  customColor4Light: '#e11d48',
  customColor4Dark: '#fda4af',
};

const PRESET_OPTIONS = {
  colorMode: new Set<PageDesignProps['colorMode']>(['light', 'dark', 'system']),
  palette: new Set<PageDesignProps['palette']>(['indigo', 'blue', 'emerald', 'amber', 'rose', 'slate']),
  font: new Set<PageDesignProps['font']>(['system', 'modern', 'serif']),
  radius: new Set<PageDesignProps['radius']>(['sharp', 'soft', 'round']),
  width: new Set<PageDesignProps['width']>(['narrow', 'standard', 'wide']),
  scale: new Set<PageDesignProps['scale']>(['compact', 'balanced', 'large']),
};

type PresetKey = keyof typeof PRESET_OPTIONS;
type ColorKey = Exclude<keyof PageDesignProps, PresetKey>;
const COLOR_KEYS: ColorKey[] = [
  'customColor1Light', 'customColor1Dark', 'customColor2Light', 'customColor2Dark',
  'customColor3Light', 'customColor3Dark', 'customColor4Light', 'customColor4Dark',
];
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function option<TKey extends PresetKey>(
  tokens: Record<string, ScalarToken> | undefined,
  key: TKey,
): PageDesignProps[TKey] {
  const value = tokens?.[PAGE_DESIGN_TOKEN_KEYS[key]];
  if (typeof value !== 'string') {
    return DEFAULT_PAGE_DESIGN[key];
  }

  return (PRESET_OPTIONS[key] as ReadonlySet<string>).has(value)
    ? value as PageDesignProps[TKey]
    : DEFAULT_PAGE_DESIGN[key];
}

function color(tokens: Record<string, ScalarToken> | undefined, key: ColorKey): string {
  const value = tokens?.[PAGE_DESIGN_TOKEN_KEYS[key]];
  return typeof value === 'string' && HEX_COLOR.test(value)
    ? value.toLowerCase()
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
    customColor1Light: color(tokens, 'customColor1Light'),
    customColor1Dark: color(tokens, 'customColor1Dark'),
    customColor2Light: color(tokens, 'customColor2Light'),
    customColor2Dark: color(tokens, 'customColor2Dark'),
    customColor3Light: color(tokens, 'customColor3Light'),
    customColor3Dark: color(tokens, 'customColor3Dark'),
    customColor4Light: color(tokens, 'customColor4Light'),
    customColor4Dark: color(tokens, 'customColor4Dark'),
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
    ...Object.fromEntries(COLOR_KEYS.map((key) => [
      PAGE_DESIGN_TOKEN_KEYS[key],
      props?.[key] ?? DEFAULT_PAGE_DESIGN[key],
    ])),
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
    'g7pb-theme-custom-palette',
  ].join(' ');
}

export function pageDesignCustomCss(props: Partial<PageDesignProps>): string {
  const design = tokensToPageDesign(pageDesignToTokens(props, {}));
  const declarations = [1, 2, 3, 4].flatMap((slot) => {
    const light = design[`customColor${slot}Light` as ColorKey];
    const dark = design[`customColor${slot}Dark` as ColorKey];
    return [`--g7pb-custom-tone-${slot}-light:${light}`, `--g7pb-custom-tone-${slot}-dark:${dark}`];
  }).join(';');
  return `.g7pb-theme-custom-palette{${declarations}}`;
}
