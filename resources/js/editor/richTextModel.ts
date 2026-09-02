import { Extension, Mark, Node as TiptapNode, mergeAttributes, type Editor } from '@tiptap/core';
import { FONT_SIZE_REM_VALUES, elementFontSizeClassName, normalizeFontSizeRem, type FontSizeRem } from './fontSize';

export const FONT_VALUES = ['inherit', 'modern', 'serif', 'mono'] as const;
export const SIZE_VALUES = ['base', 'small', 'large', 'xlarge'] as const;
export const WEIGHT_VALUES = ['regular', 'medium', 'semibold', 'bold'] as const;
export const TONE_VALUES = ['default', 'muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'] as const;
export type FontValue = typeof FONT_VALUES[number];
export type SizeValue = typeof SIZE_VALUES[number];
export type WeightValue = typeof WEIGHT_VALUES[number];
export type ToneValue = typeof TONE_VALUES[number];
export type RichTextEditorState = Record<string, boolean | undefined>;

function enumAttribute<T extends string>(key: 'font' | 'size' | 'weight' | 'tone', values: readonly T[], fallback: T) {
  return {
    default: fallback,
    parseHTML: (element: HTMLElement): T => {
      const raw = element.getAttribute(`data-g7pb-${key}`);
      return values.includes(raw as T) ? raw as T : fallback;
    },
    renderHTML: (attributes: Record<string, unknown>): Record<string, string> => {
      const raw = attributes[key];
      return values.includes(raw as T) && raw !== fallback ? { [`data-g7pb-${key}`]: String(raw) } : {};
    },
  };
}

function fontSizeRemAttribute() {
  return {
    default: null,
    parseHTML: (element: HTMLElement): FontSizeRem | null =>
      normalizeFontSizeRem(Number(element.getAttribute('data-g7pb-font-size-rem'))) ?? null,
    renderHTML: (attributes: Record<string, unknown>): Record<string, string> => {
      const value = normalizeFontSizeRem(attributes.fontSizeRem);
      return value === undefined ? {} : {
        class: elementFontSizeClassName(value),
        'data-g7pb-font-size-rem': String(value),
      };
    },
  };
}

export const G7TextStyleMark = Mark.create({
  name: 'g7TextStyle',
  addAttributes() {
    return {
      font: enumAttribute('font', FONT_VALUES, 'inherit'),
      fontSizeRem: fontSizeRemAttribute(),
      size: enumAttribute('size', SIZE_VALUES, 'base'),
      weight: enumAttribute('weight', WEIGHT_VALUES, 'regular'),
      tone: enumAttribute('tone', TONE_VALUES, 'default'),
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-g7pb-font], span[data-g7pb-font-size-rem], span[data-g7pb-size], span[data-g7pb-weight], span[data-g7pb-tone]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0];
  },
});

export const G7SingleLineDocument = TiptapNode.create({
  name: 'doc',
  topNode: true,
  content: 'paragraph',
});

export const G7SingleLineRichText = Extension.create({
  name: 'g7SingleLineRichText',
  addKeyboardShortcuts() {
    return {
      Enter: () => true,
      'Shift-Enter': () => true,
    };
  },
});

export function selectedMark(editor: Editor | null): { font: FontValue; fontSizeRem?: FontSizeRem; size: SizeValue; weight: WeightValue; tone: ToneValue } {
  const attributes = editor?.getAttributes('g7TextStyle') ?? {};
  const fontSizeRem = normalizeFontSizeRem(attributes.fontSizeRem);
  return {
    font: FONT_VALUES.includes(attributes.font as FontValue) ? attributes.font as FontValue : 'inherit',
    ...(fontSizeRem === undefined ? {} : { fontSizeRem }),
    size: SIZE_VALUES.includes(attributes.size as SizeValue) ? attributes.size as SizeValue : 'base',
    weight: WEIGHT_VALUES.includes(attributes.weight as WeightValue) ? attributes.weight as WeightValue : 'regular',
    tone: TONE_VALUES.includes(attributes.tone as ToneValue) ? attributes.tone as ToneValue : 'default',
  };
}

export function isRichTextRangeActive(editor: Editor | null): boolean {
  return Boolean(editor && !editor.state.selection.empty);
}

export function markFromEditorState(editorState: RichTextEditorState | null): {
  font: FontValue;
  fontSizeRem?: FontSizeRem;
  size: SizeValue;
  weight: WeightValue;
  tone: ToneValue;
} {
  const fontSizeIndex = editorState?.g7FontSizeSet
    ? Number(Boolean(editorState.g7FontSizeBit0))
      + (Number(Boolean(editorState.g7FontSizeBit1)) * 2)
      + (Number(Boolean(editorState.g7FontSizeBit2)) * 4)
      + (Number(Boolean(editorState.g7FontSizeBit3)) * 8)
    : -1;
  const fontSizeRem = fontSizeIndex >= 0 ? FONT_SIZE_REM_VALUES[fontSizeIndex] : undefined;
  return {
    font: editorState?.g7FontModern ? 'modern'
      : editorState?.g7FontSerif ? 'serif'
        : editorState?.g7FontMono ? 'mono' : 'inherit',
    ...(fontSizeRem === undefined ? {} : { fontSizeRem }),
    size: editorState?.g7SizeSmall ? 'small'
      : editorState?.g7SizeLarge ? 'large'
        : editorState?.g7SizeXlarge ? 'xlarge' : 'base',
    weight: editorState?.g7WeightMedium ? 'medium'
      : editorState?.g7WeightSemibold ? 'semibold'
        : editorState?.g7WeightBold ? 'bold' : 'regular',
    tone: editorState?.g7ToneMuted ? 'muted'
      : editorState?.g7ToneAccent ? 'accent'
        : editorState?.g7ToneContrast ? 'contrast'
          : editorState?.g7ToneCustom1 ? 'custom1'
            : editorState?.g7ToneCustom2 ? 'custom2'
              : editorState?.g7ToneCustom3 ? 'custom3'
                : editorState?.g7ToneCustom4 ? 'custom4' : 'default',
  };
}

export function selectRichTextEditorState(context: { editor: Editor | null }, readOnly: boolean) {
  const current = selectedMark(context.editor);
  const fontSizeIndex = current.fontSizeRem === undefined
    ? -1
    : FONT_SIZE_REM_VALUES.indexOf(current.fontSizeRem);
  return {
    g7HasSelection: isRichTextRangeActive(context.editor),
    g7CanLink: !readOnly && isRichTextRangeActive(context.editor),
    g7FontInherit: current.font === 'inherit',
    g7FontModern: current.font === 'modern',
    g7FontSerif: current.font === 'serif',
    g7FontMono: current.font === 'mono',
    g7FontSizeSet: fontSizeIndex >= 0,
    g7FontSizeBit0: fontSizeIndex >= 0 && (fontSizeIndex & 1) !== 0,
    g7FontSizeBit1: fontSizeIndex >= 0 && (fontSizeIndex & 2) !== 0,
    g7FontSizeBit2: fontSizeIndex >= 0 && (fontSizeIndex & 4) !== 0,
    g7FontSizeBit3: fontSizeIndex >= 0 && (fontSizeIndex & 8) !== 0,
    g7SizeBase: current.size === 'base',
    g7SizeSmall: current.size === 'small',
    g7SizeLarge: current.size === 'large',
    g7SizeXlarge: current.size === 'xlarge',
    g7WeightRegular: current.weight === 'regular',
    g7WeightMedium: current.weight === 'medium',
    g7WeightSemibold: current.weight === 'semibold',
    g7WeightBold: current.weight === 'bold',
    g7ToneDefault: current.tone === 'default',
    g7ToneMuted: current.tone === 'muted',
    g7ToneAccent: current.tone === 'accent',
    g7ToneContrast: current.tone === 'contrast',
    g7ToneCustom1: current.tone === 'custom1',
    g7ToneCustom2: current.tone === 'custom2',
    g7ToneCustom3: current.tone === 'custom3',
    g7ToneCustom4: current.tone === 'custom4',
    isLink: context.editor?.isActive('link') ?? false,
  };
}

export const RICH_TEXT_ALLOWED_VALUES = Object.freeze({
  fonts: FONT_VALUES,
  fontSizesRem: FONT_SIZE_REM_VALUES,
  sizes: SIZE_VALUES,
  weights: WEIGHT_VALUES,
  tones: TONE_VALUES,
});
