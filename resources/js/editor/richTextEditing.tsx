import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RichTextMenu } from '@puckeditor/core';
import { Extension, Mark, Node as TiptapNode, mergeAttributes, type Editor } from '@tiptap/core';
import { Bold, Check, ChevronDown, Italic, Link2, RotateCcw, SlidersHorizontal, Underline, Unlink } from 'lucide-react';
import { CanvasCurrentElementStylesContext, elementAppearanceClassName } from './canvasEditingContract';
import type { CanvasRangeAnchor } from './canvasContextState';

const FONT_VALUES = ['inherit', 'modern', 'serif', 'mono'] as const;
const SIZE_VALUES = ['base', 'small', 'large', 'xlarge'] as const;
const WEIGHT_VALUES = ['regular', 'medium', 'semibold', 'bold'] as const;
const TONE_VALUES = ['default', 'muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'] as const;
const FLOATING_LAYER_STABLE_FRAMES = 3;
const RANGE_OPTION_COMPATIBILITY_CLICK_WINDOW_MS = 50;
export const RICH_TEXT_RANGE_STATE_MESSAGE = 'g7pb:richtext-range-state';

type FontValue = typeof FONT_VALUES[number];
type SizeValue = typeof SIZE_VALUES[number];
type WeightValue = typeof WEIGHT_VALUES[number];
type ToneValue = typeof TONE_VALUES[number];
type RangeMenu = 'font' | 'weight' | 'size' | 'tone';
type RichTextEditorState = Record<string, boolean | undefined>;
type InlineRichTextOptions = { allowLink?: boolean };
type FloatingLayerStyle = React.CSSProperties & {
  '--g7pb-richtext-floating-left': string;
  '--g7pb-richtext-floating-top': string;
  '--g7pb-richtext-floating-max-width': string;
  '--g7pb-richtext-floating-max-height': string;
};

function finiteDataNumber(element: HTMLElement | null, name: string, fallback: number): number {
  const raw = element?.getAttribute(name);
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function stableOverlayPixel(value: number, devicePixelRatio: number): number {
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(value * scale) / scale;
}

function RichTextFloatingLayer({
  anchorRef,
  align = 'start',
  preserveSelectionOnTouch = false,
  className,
  children,
  ...attributes
}: React.HTMLAttributes<HTMLDivElement> & {
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  preserveSelectionOnTouch?: boolean;
}): React.ReactElement | null {
  const layerRef = useRef<HTMLDivElement>(null);
  const initialStyle = useRef<FloatingLayerStyle>({
    '--g7pb-richtext-floating-left': '0px',
    '--g7pb-richtext-floating-top': '0px',
    '--g7pb-richtext-floating-max-width': 'calc(100vw - 1rem)',
    '--g7pb-richtext-floating-max-height': 'calc(100vh - 1rem)',
    visibility: 'hidden',
  });
  const anchor = anchorRef.current;
  const ownerDocument = anchor?.ownerDocument ?? null;

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    const currentAnchor = anchorRef.current;
    const currentDocument = currentAnchor?.ownerDocument;
    const ownerWindow = currentDocument?.defaultView;
    if (!layer || !currentAnchor || !currentDocument || !ownerWindow) return undefined;
    let animationFrame = 0;
    let pendingPlacement: string | null = null;
    let stablePlacementFrames = 0;
    let revealed = false;
    const observedSizes = new WeakMap<Element, { height: number; width: number }>();
    const actionBar = currentAnchor.closest<HTMLElement>('.g7pb-selected-block-actionbar');
    const position = (): void => {
      animationFrame = 0;
      const viewportWidth = currentDocument.documentElement.clientWidth || ownerWindow.innerWidth;
      const viewportHeight = currentDocument.documentElement.clientHeight || ownerWindow.innerHeight;
      const clipLeft = finiteDataNumber(actionBar, 'data-g7pb-safe-clip-left', 0);
      const clipTop = finiteDataNumber(actionBar, 'data-g7pb-safe-clip-top', 0);
      const clipRight = finiteDataNumber(actionBar, 'data-g7pb-safe-clip-right', viewportWidth);
      const clipBottom = finiteDataNumber(actionBar, 'data-g7pb-safe-clip-bottom', viewportHeight);
      const inset = 8;
      const gap = 6;
      const safeLeft = Math.min(clipRight, clipLeft + inset);
      const safeTop = Math.min(clipBottom, clipTop + inset);
      const safeRight = Math.max(safeLeft, clipRight - inset);
      const safeBottom = Math.max(safeTop, clipBottom - inset);
      const maxWidth = stableOverlayPixel(Math.max(0, safeRight - safeLeft), ownerWindow.devicePixelRatio);
      const maxHeight = stableOverlayPixel(Math.max(0, safeBottom - safeTop), ownerWindow.devicePixelRatio);
      const writeVariable = (name: string, value: string): void => {
        if (layer.style.getPropertyValue(name) !== value) layer.style.setProperty(name, value);
      };
      writeVariable('--g7pb-richtext-floating-max-width', `${maxWidth}px`);
      writeVariable('--g7pb-richtext-floating-max-height', `${maxHeight}px`);
      const anchorRect = currentAnchor.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      const width = Math.min(layerRect.width, maxWidth);
      const height = Math.min(layerRect.height, maxHeight);
      const preferredLeft = align === 'end' ? anchorRect.right - width : anchorRect.left;
      const left = stableOverlayPixel(
        Math.min(Math.max(safeLeft, preferredLeft), Math.max(safeLeft, safeRight - width)),
        ownerWindow.devicePixelRatio,
      );
      const below = anchorRect.bottom + gap;
      const above = anchorRect.top - gap - height;
      const rawTop = below + height <= safeBottom
        ? below
        : above >= safeTop ? above : Math.min(Math.max(safeTop, below), Math.max(safeTop, safeBottom - height));
      const top = stableOverlayPixel(rawTop, ownerWindow.devicePixelRatio);
      writeVariable('--g7pb-richtext-floating-left', `${left}px`);
      writeVariable('--g7pb-richtext-floating-top', `${top}px`);
      const placement = [
        clipLeft, clipTop, clipRight, clipBottom,
        anchorRect.left, anchorRect.top, anchorRect.right, anchorRect.bottom,
        layerRect.width, layerRect.height, maxWidth, maxHeight, left, top,
      ].map((value) => stableOverlayPixel(value, ownerWindow.devicePixelRatio)).join('|');
      if (!revealed) {
        if (pendingPlacement === placement) {
          stablePlacementFrames += 1;
        } else {
          pendingPlacement = placement;
          stablePlacementFrames = 1;
        }
        if (stablePlacementFrames >= FLOATING_LAYER_STABLE_FRAMES) {
          revealed = true;
          layer.setAttribute('data-g7pb-floating-ready', 'true');
          if (layer.style.visibility !== 'visible') layer.style.visibility = 'visible';
          return;
        }
        layer.removeAttribute('data-g7pb-floating-ready');
        if (layer.style.visibility !== 'hidden') layer.style.visibility = 'hidden';
        schedule();
        return;
      }
      if (layer.style.visibility !== 'visible') layer.style.visibility = 'visible';
    };
    const schedule = (): void => {
      if (animationFrame === 0) animationFrame = ownerWindow.requestAnimationFrame(position);
    };
    const invalidatePlacement = (): void => {
      revealed = false;
      pendingPlacement = null;
      stablePlacementFrames = 0;
      layer.removeAttribute('data-g7pb-floating-ready');
      if (layer.style.visibility !== 'hidden') layer.style.visibility = 'hidden';
      schedule();
    };
    const contentBoxSize = (element: HTMLElement): { height: number; width: number } => {
      const style = ownerWindow.getComputedStyle(element);
      const pixel = (value: string): number => Number.parseFloat(value) || 0;
      return {
        width: stableOverlayPixel(
          Math.max(0, element.clientWidth - pixel(style.paddingLeft) - pixel(style.paddingRight)),
          ownerWindow.devicePixelRatio,
        ),
        height: stableOverlayPixel(
          Math.max(0, element.clientHeight - pixel(style.paddingTop) - pixel(style.paddingBottom)),
          ownerWindow.devicePixelRatio,
        ),
      };
    };
    const resizeObserver = new ownerWindow.ResizeObserver((entries) => {
      const changed = entries.some((entry) => {
        const width = stableOverlayPixel(entry.contentRect.width, ownerWindow.devicePixelRatio);
        const height = stableOverlayPixel(entry.contentRect.height, ownerWindow.devicePixelRatio);
        const previous = observedSizes.get(entry.target);
        observedSizes.set(entry.target, { width, height });
        return !previous || previous.width !== width || previous.height !== height;
      });
      if (changed) invalidatePlacement();
    });
    observedSizes.set(currentAnchor, contentBoxSize(currentAnchor));
    observedSizes.set(layer, contentBoxSize(layer));
    resizeObserver.observe(currentAnchor);
    resizeObserver.observe(layer);
    const safeClipObserver = actionBar ? new ownerWindow.MutationObserver(invalidatePlacement) : null;
    safeClipObserver?.observe(actionBar as HTMLElement, {
      attributes: true,
      attributeFilter: [
        'style',
        'data-g7pb-safe-clip-left', 'data-g7pb-safe-clip-top',
        'data-g7pb-safe-clip-right', 'data-g7pb-safe-clip-bottom',
      ],
    });
    const scheduleFromScroll = (event: Event): void => {
      if (event.target instanceof ownerWindow.Node && layer.contains(event.target)) return;
      invalidatePlacement();
    };
    currentDocument.addEventListener('scroll', scheduleFromScroll, true);
    ownerWindow.addEventListener('resize', invalidatePlacement);
    const retainSelectionFromTouch = (event: TouchEvent): void => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (preserveSelectionOnTouch) {
      layer.addEventListener('touchstart', retainSelectionFromTouch, { passive: false });
    }
    position();
    return () => {
      if (animationFrame !== 0) ownerWindow.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      safeClipObserver?.disconnect();
      currentDocument.removeEventListener('scroll', scheduleFromScroll, true);
      ownerWindow.removeEventListener('resize', invalidatePlacement);
      if (preserveSelectionOnTouch) layer.removeEventListener('touchstart', retainSelectionFromTouch);
    };
  }, [align, anchorRef, ownerDocument, preserveSelectionOnTouch]);

  if (!ownerDocument?.body) return null;
  return createPortal(
    <div {...attributes} ref={layerRef}
      data-puck-rte-menu="portal"
      className={`${className ?? ''} g7pb-richtext-floating-layer`.trim()} style={initialStyle.current}>
      {children}
    </div>,
    ownerDocument.body,
  );
}

function useNarrowOwnerViewport(
  anchorRef: React.RefObject<HTMLElement | null>,
  active: boolean,
): boolean {
  const [narrow, setNarrow] = useState(false);

  React.useLayoutEffect(() => {
    const ownerWindow = anchorRef.current?.ownerDocument.defaultView;
    if (!active || !ownerWindow) {
      setNarrow(false);
      return undefined;
    }
    const update = (): void => setNarrow(ownerWindow.innerWidth <= 640);
    update();
    ownerWindow.addEventListener('resize', update);
    return () => ownerWindow.removeEventListener('resize', update);
  }, [active, anchorRef]);

  return narrow;
}

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

export const G7TextStyleMark = Mark.create({
  name: 'g7TextStyle',
  addAttributes() {
    return {
      font: enumAttribute('font', FONT_VALUES, 'inherit'),
      size: enumAttribute('size', SIZE_VALUES, 'base'),
      weight: enumAttribute('weight', WEIGHT_VALUES, 'regular'),
      tone: enumAttribute('tone', TONE_VALUES, 'default'),
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-g7pb-font], span[data-g7pb-size], span[data-g7pb-weight], span[data-g7pb-tone]' }];
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

function selectedMark(editor: Editor | null): { font: FontValue; size: SizeValue; weight: WeightValue; tone: ToneValue } {
  const attributes = editor?.getAttributes('g7TextStyle') ?? {};
  return {
    font: FONT_VALUES.includes(attributes.font as FontValue) ? attributes.font as FontValue : 'inherit',
    size: SIZE_VALUES.includes(attributes.size as SizeValue) ? attributes.size as SizeValue : 'base',
    weight: WEIGHT_VALUES.includes(attributes.weight as WeightValue) ? attributes.weight as WeightValue : 'regular',
    tone: TONE_VALUES.includes(attributes.tone as ToneValue) ? attributes.tone as ToneValue : 'default',
  };
}

export function isRichTextRangeActive(editor: Editor | null): boolean {
  return Boolean(editor && !editor.state.selection.empty);
}

function RangeChoiceMenu<T extends string>({
  name,
  label,
  value,
  values,
  open,
  disabled,
  testId,
  onToggle,
  onChange,
  onClose,
}: {
  name: RangeMenu;
  label: string;
  value: T;
  values: ReadonlyArray<{ value: T; label: string }>;
  open: boolean;
  disabled: boolean;
  testId: string;
  onToggle: (menu: RangeMenu) => void;
  onChange: (value: T) => void;
  onClose: () => void;
}): React.ReactElement {
  const current = values.find((option) => option.value === value) ?? values[0];
  const triggerRef = useRef<HTMLButtonElement>(null);
  const suppressCompatibilityClick = React.useRef(false);
  const pendingOptionPointer = React.useRef<{ pointerId: number; value: T } | null>(null);
  const pendingCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearScheduledClose = (): void => {
    if (pendingCloseTimer.current === null) return;
    clearTimeout(pendingCloseTimer.current);
    pendingCloseTimer.current = null;
  };
  const markPointerActivation = (): void => {
    clearScheduledClose();
    suppressCompatibilityClick.current = true;
  };
  const clearPointerActivation = (): void => {
    clearScheduledClose();
    suppressCompatibilityClick.current = false;
    pendingOptionPointer.current = null;
  };
  const scheduleCloseAfterPointer = (): void => {
    clearScheduledClose();
    pendingCloseTimer.current = setTimeout(() => {
      pendingCloseTimer.current = null;
      suppressCompatibilityClick.current = false;
      pendingOptionPointer.current = null;
      onClose();
    }, RANGE_OPTION_COMPATIBILITY_CLICK_WINDOW_MS);
  };
  React.useEffect(() => clearScheduledClose, []);
  const clearPointerActivationFromKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') clearPointerActivation();
  };
  const toggleFromPointer = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    markPointerActivation();
    onToggle(name);
  };
  const toggleFromKeyboard = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    if (suppressCompatibilityClick.current) {
      suppressCompatibilityClick.current = false;
      return;
    }
    if (event.detail === 0) onToggle(name);
  };
  const armOptionFromPointer = (event: React.PointerEvent<HTMLButtonElement>, nextValue: T): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    markPointerActivation();
    pendingOptionPointer.current = { pointerId: event.pointerId, value: nextValue };
  };
  const chooseFromPointer = (event: React.PointerEvent<HTMLButtonElement>, nextValue: T): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const pending = pendingOptionPointer.current;
    if (!pending || pending.pointerId !== event.pointerId || pending.value !== nextValue) return;
    pendingOptionPointer.current = null;
    onChange(nextValue);
    scheduleCloseAfterPointer();
  };
  const chooseFromKeyboard = (event: React.MouseEvent<HTMLButtonElement>, nextValue: T): void => {
    event.preventDefault();
    event.stopPropagation();
    if (suppressCompatibilityClick.current) {
      clearPointerActivation();
      onClose();
      return;
    }
    if (event.detail === 0) {
      onChange(nextValue);
      onClose();
    }
  };
  return <div className="g7pb-richtext-inline-toolbar__choice">
    <button ref={triggerRef} type="button" disabled={disabled} data-testid={testId} aria-haspopup="listbox" aria-expanded={open}
      aria-label={`선택한 글자 ${label}: ${current.label}`}
      onKeyDown={clearPointerActivationFromKeyboard} onPointerCancel={clearPointerActivation}
      onPointerDown={toggleFromPointer} onClick={toggleFromKeyboard}>
      <span>{current.label}</span><ChevronDown size={13} aria-hidden="true" />
    </button>
    {open ? <RichTextFloatingLayer anchorRef={triggerRef} preserveSelectionOnTouch
      className="g7pb-richtext-inline-toolbar__options" role="listbox" aria-label={`선택한 글자 ${label}`}>
      {values.map((option) => <button type="button" role="option" aria-selected={option.value === value}
        key={option.value}
        onKeyDown={clearPointerActivationFromKeyboard}
        onPointerCancel={clearPointerActivation}
        onPointerDown={(event) => armOptionFromPointer(event, option.value)}
        onPointerUp={(event) => chooseFromPointer(event, option.value)}
        onClick={(event) => chooseFromKeyboard(event, option.value)}>
        <span>{option.label}</span>{option.value === value ? <Check size={13} aria-hidden="true" /> : null}
      </button>)}
    </RichTextFloatingLayer> : null}
  </div>;
}

function safeEditorLink(value: string): string | null {
  const trimmed = value.trim();
  if (/^\/(?!\/)[^\s\\]*$/.test(trimmed)) return trimmed;
  if (/^(?:mailto:[^\s@]+@[^\s@]+\.[^\s@]+|tel:\+?[0-9][0-9 .()\-]{2,39})$/i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' && url.hostname ? trimmed : null;
  } catch {
    return null;
  }
}

function markFromEditorState(editorState: RichTextEditorState | null): {
  font: FontValue;
  size: SizeValue;
  weight: WeightValue;
  tone: ToneValue;
} {
  return {
    font: editorState?.g7FontModern ? 'modern'
      : editorState?.g7FontSerif ? 'serif'
        : editorState?.g7FontMono ? 'mono' : 'inherit',
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

export function richTextRangeAnchorFromSelection(
  ownerDocument: Document,
  editorRoot?: HTMLElement,
): CanvasRangeAnchor | null {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) return null;
  const selection = ownerWindow.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const commonElement = range.commonAncestorContainer instanceof ownerWindow.Element
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;
  if (!commonElement?.closest('[data-g7pb-richtext-field]')) return null;
  if (editorRoot && !editorRoot.contains(commonElement)) return null;
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function richTextRangeAnchor(editor: Editor | null): CanvasRangeAnchor | null {
  if (!editor?.state?.selection || editor.state.selection.empty || !editor.view?.dom) return null;
  return richTextRangeAnchorFromSelection(editor.view.dom.ownerDocument, editor.view.dom);
}

function dispatchRichTextRangeState(active: boolean, anchor: CanvasRangeAnchor | null): void {
  const detail = { active, anchor };
  if (window.parent !== window) {
    window.parent.postMessage({ type: RICH_TEXT_RANGE_STATE_MESSAGE, ...detail }, window.location.origin);
  }
  window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_STATE_MESSAGE, { detail }));
}

function RichTextRangeStateSignal({ active, editor }: { active: boolean; editor: Editor | null }): null {
  const anchor = active ? richTextRangeAnchor(editor) : null;
  const anchorKey = anchor
    ? `${anchor.left}:${anchor.top}:${anchor.right}:${anchor.bottom}`
    : 'none';
  useEffect(() => {
    dispatchRichTextRangeState(active, anchor);
  }, [active, anchorKey]);

  useEffect(() => () => dispatchRichTextRangeState(false, null), []);

  return null;
}

function NativeRangeControl({
  label,
  icon,
  active,
  disabled,
  onApply,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  disabled: boolean;
  onApply: () => void;
}): React.ReactElement {
  const suppressCompatibilityClick = useRef(false);
  const applyFromPointer = (event: React.PointerEvent<HTMLSpanElement>): void => {
    if (event.button !== 0 || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    suppressCompatibilityClick.current = true;
    onApply();
  };
  const applyFromClick = (event: React.SyntheticEvent): void => {
    event.stopPropagation();
    if (suppressCompatibilityClick.current) {
      suppressCompatibilityClick.current = false;
      return;
    }
    if ((event.nativeEvent as MouseEvent).detail === 0 && !disabled) onApply();
  };

  return <span
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') suppressCompatibilityClick.current = false;
    }}
    onPointerCancel={() => { suppressCompatibilityClick.current = false; }}
    onPointerDownCapture={applyFromPointer}
  >
    <RichTextMenu.Control title={label} icon={icon} active={active} disabled={disabled} onClick={applyFromClick} />
  </span>;
}

function G7RichTextInlineMenu({ editor, editorState, readOnly, allowLink = true }: {
  children: React.ReactNode;
  editor: Editor | null;
  editorState: RichTextEditorState | null;
  readOnly: boolean;
  allowLink?: boolean;
}): React.ReactElement {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [openMenu, setOpenMenu] = useState<RangeMenu | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const advancedTriggerRef = useRef<HTMLButtonElement>(null);
  const advancedControlsRef = useRef<HTMLDivElement>(null);
  const suppressAdvancedCompatibilityClick = useRef(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const rangeActive = Boolean(editorState?.g7HasSelection);
  const narrowViewport = useNarrowOwnerViewport(toolbarRef, rangeActive);
  const mark = markFromEditorState(editorState);

  useEffect(() => {
    if (rangeActive && narrowViewport) return;
    setAdvancedOpen(false);
  }, [narrowViewport, rangeActive]);

  const updateMark = (patch: Partial<{ font: FontValue; size: SizeValue; weight: WeightValue; tone: ToneValue }>): void => {
    if (!editor || readOnly || !rangeActive) return;
    const chain = editor.chain().focus();
    const next = { ...mark, ...patch };
    if (next.font === 'inherit' && next.size === 'base' && next.weight === 'regular' && next.tone === 'default') {
      chain.unsetMark('g7TextStyle').run();
    } else {
      chain.setMark('g7TextStyle', next).run();
    }
  };

  const toggleLinkEditor = (): void => {
    if (!editor || readOnly || !rangeActive) return;
    if (!linkOpen) setLinkValue(String(editor.getAttributes('link').href ?? ''));
    setLinkError(false);
    setLinkOpen((open) => !open);
  };

  const applyLink = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    event.stopPropagation();
    if (!editor || readOnly || !allowLink || !rangeActive) return;
    const safe = safeEditorLink(linkValue);
    if (!safe) {
      setLinkError(true);
      return;
    }
    const chain = editor.chain().focus();
    if (editorState?.isLink) chain.extendMarkRange('link');
    chain.setLink({ href: safe }).run();
    setLinkError(false);
    setLinkOpen(false);
  };

  const toggleAdvancedFromPointer = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    suppressAdvancedCompatibilityClick.current = true;
    setAdvancedOpen((open) => !open);
    setOpenMenu(null);
    setLinkOpen(false);
  };

  const toggleAdvancedFromKeyboard = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    if (suppressAdvancedCompatibilityClick.current) {
      suppressAdvancedCompatibilityClick.current = false;
      return;
    }
    if (event.detail === 0) setAdvancedOpen((open) => !open);
  };

  const advancedControls = (ref: React.RefObject<HTMLDivElement | null>): React.ReactElement => (
    <div ref={ref} className="g7pb-richtext-inline-toolbar__advanced-controls"
      role="group" aria-label="선택한 글자 상세 서식">
      <RangeChoiceMenu name="font" label="글꼴" value={mark.font} disabled={readOnly} open={openMenu === 'font'}
        testId="page-builder-richtext-font" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(font) => updateMark({ font })} onClose={() => setOpenMenu(null)} values={[
          { value: 'inherit', label: '기본 글꼴' }, { value: 'modern', label: '모던' },
          { value: 'serif', label: '명조' }, { value: 'mono', label: '고정폭' },
        ]} />
      <RangeChoiceMenu name="weight" label="굵기" value={mark.weight} disabled={readOnly} open={openMenu === 'weight'}
        testId="page-builder-richtext-weight" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(weight) => updateMark({ weight })} onClose={() => setOpenMenu(null)} values={[
          { value: 'regular', label: '보통' }, { value: 'medium', label: '중간' },
          { value: 'semibold', label: '굵게' }, { value: 'bold', label: '매우 굵게' },
        ]} />
      <RangeChoiceMenu name="size" label="크기" value={mark.size} disabled={readOnly} open={openMenu === 'size'}
        testId="page-builder-richtext-size" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(size) => updateMark({ size })} onClose={() => setOpenMenu(null)} values={[
          { value: 'small', label: 'S' }, { value: 'base', label: 'M' },
          { value: 'large', label: 'L' }, { value: 'xlarge', label: 'XL' },
        ]} />
      <RangeChoiceMenu name="tone" label="색상" value={mark.tone} disabled={readOnly} open={openMenu === 'tone'}
        testId="page-builder-richtext-tone" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(tone) => updateMark({ tone })} onClose={() => setOpenMenu(null)} values={[
          { value: 'default', label: '기본색' }, { value: 'muted', label: '보조색' },
          { value: 'accent', label: '강조색' }, { value: 'contrast', label: '반전색' },
          { value: 'custom1', label: '사용자색 1' }, { value: 'custom2', label: '사용자색 2' },
          { value: 'custom3', label: '사용자색 3' }, { value: 'custom4', label: '사용자색 4' },
        ]} />
      {allowLink ? <RichTextMenu.Control
        title="링크 편집"
        icon={<Link2 size={15} aria-hidden="true" />}
        active={linkOpen}
        disabled={!editorState?.g7CanLink || !editor}
        onClick={(event) => { event.stopPropagation(); toggleLinkEditor(); }}
      /> : null}
      {allowLink && editorState?.isLink ? <RichTextMenu.Control
        title="링크 제거"
        icon={<Unlink size={15} aria-hidden="true" />}
        disabled={readOnly || !editor}
        onClick={(event) => {
          event.stopPropagation();
          editor?.chain().focus().extendMarkRange('link').unsetLink().run();
        }}
      /> : null}
      <RichTextMenu.Control
        title="부분 서식 초기화"
        icon={<RotateCcw size={15} aria-hidden="true" />}
        disabled={readOnly || !editor}
        onClick={(event) => {
          event.stopPropagation();
          editor?.chain().focus().unsetAllMarks().run();
        }}
      />
      {allowLink && linkOpen ? <RichTextFloatingLayer anchorRef={ref} align="end"
        className="g7pb-richtext-inline-toolbar__link">
        <form onSubmit={applyLink}>
          <label><span className="sr-only">링크 주소</span><input type="text" inputMode="url" value={linkValue}
            aria-label="링크 주소" aria-invalid={linkError} placeholder="https:// 또는 /페이지" autoFocus
            onChange={(event) => { setLinkValue(event.target.value); setLinkError(false); }} /></label>
          <button type="submit">적용</button>
          {linkError ? <span role="alert">안전한 HTTPS 또는 내부 주소를 입력하세요.</span> : null}
        </form>
      </RichTextFloatingLayer> : null}
    </div>
  );

  return (
    <>
      <RichTextRangeStateSignal active={rangeActive} editor={editor} />
      {rangeActive ? <RichTextMenu>
        <RichTextMenu.Group>
          <NativeRangeControl
            label="선택한 글자 굵게"
            icon={<Bold size={15} aria-hidden="true" />}
            active={Boolean(editorState?.isBold)}
            disabled={readOnly || !editor || !editorState?.canBold}
            onApply={() => {
              editor?.chain().focus().toggleBold().run();
              setOpenMenu(null);
            }}
          />
          <NativeRangeControl
            label="선택한 글자 기울임"
            icon={<Italic size={15} aria-hidden="true" />}
            active={Boolean(editorState?.isItalic)}
            disabled={readOnly || !editor || !editorState?.canItalic}
            onApply={() => {
              editor?.chain().focus().toggleItalic().run();
              setOpenMenu(null);
            }}
          />
          <NativeRangeControl
            label="선택한 글자 밑줄"
            icon={<Underline size={15} aria-hidden="true" />}
            active={Boolean(editorState?.isUnderline)}
            disabled={readOnly || !editor || !editorState?.canUnderline}
            onApply={() => {
              editor?.chain().focus().toggleUnderline().run();
              setOpenMenu(null);
            }}
          />
        </RichTextMenu.Group>
        <RichTextMenu.Group>
          <div ref={toolbarRef} className="g7pb-richtext-inline-toolbar" role="group" aria-label="선택한 글자 추가 서식"
            data-testid="page-builder-richtext-inline-toolbar">
            {narrowViewport ? <>
              <button ref={advancedTriggerRef} type="button" className="g7pb-richtext-inline-toolbar__more"
                data-testid="page-builder-richtext-more" aria-haspopup="dialog" aria-expanded={advancedOpen}
                aria-label="추가 글자 서식" onPointerCancel={() => { suppressAdvancedCompatibilityClick.current = false; }}
                onPointerDown={toggleAdvancedFromPointer} onClick={toggleAdvancedFromKeyboard}>
                <SlidersHorizontal size={15} aria-hidden="true" />
              </button>
              {advancedOpen ? <RichTextFloatingLayer anchorRef={advancedTriggerRef}
                className="g7pb-richtext-inline-toolbar__advanced" role="dialog" aria-label="선택한 글자 상세 서식"
                data-testid="page-builder-richtext-advanced-panel">
                {advancedControls(advancedControlsRef)}
              </RichTextFloatingLayer> : null}
            </> : advancedControls(advancedControlsRef)}
          </div>
        </RichTextMenu.Group>
      </RichTextMenu> : null}
    </>
  );
}

const BASE_RICH_TEXT_OPTIONS = {
  code: false as const,
  codeBlock: false as const,
  horizontalRule: false as const,
  strike: false as const,
  textAlign: {},
  underline: {},
};

export function createRichTextField(label: string, initialHeight = 150, headings = false) {
  return {
    type: 'richtext' as const,
    label,
    contentEditable: true,
    initialHeight,
    options: {
      ...BASE_RICH_TEXT_OPTIONS,
      heading: headings ? { levels: [2, 3, 4] as [2, 3, 4] } : false as const,
    },
    tiptap: {
      extensions: [G7TextStyleMark],
      selector: (context: { editor: Editor | null }, readOnly: boolean) => {
        const current = selectedMark(context.editor);
        return {
          g7HasSelection: isRichTextRangeActive(context.editor),
          g7CanLink: !readOnly && isRichTextRangeActive(context.editor),
          g7FontInherit: current.font === 'inherit',
          g7FontModern: current.font === 'modern',
          g7FontSerif: current.font === 'serif',
          g7FontMono: current.font === 'mono',
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
      },
    },
    renderInlineMenu: G7RichTextInlineMenu,
  };
}

export function createInlineRichTextField(label: string, options: InlineRichTextOptions = {}) {
  const allowLink = options.allowLink ?? true;
  const field = createRichTextField(label, 64, false);

  return {
    ...field,
    options: {
      ...field.options,
      blockquote: false as const,
      bulletList: false as const,
      document: false as const,
      hardBreak: false as const,
      heading: false as const,
      link: allowLink ? {} : false as const,
      listItem: false as const,
      listKeymap: false as const,
      orderedList: false as const,
      textAlign: false as const,
    },
    tiptap: {
      ...field.tiptap,
      extensions: [G7SingleLineDocument, G7TextStyleMark, G7SingleLineRichText],
    },
    renderInlineMenu: (props: React.ComponentProps<typeof G7RichTextInlineMenu>) => (
      <G7RichTextInlineMenu {...props} allowLink={allowLink} />
    ),
  };
}

export function RichTextCanvasField({
  fieldPath,
  children,
  className = 'g7pb-preview-richtext',
  as: requestedElement = 'div',
}: {
  fieldPath: string;
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'p' | 'span' | 'strong' | 'h1' | 'h2' | 'h3' | 'h4';
}): React.ReactElement {
  const elementStyles = React.useContext(CanvasCurrentElementStylesContext);
  const semanticClassName = requestedElement === 'strong' ? 'g7pb-element-weight--bold' : '';
  const resolvedClassName = [
    className,
    elementAppearanceClassName(elementStyles, fieldPath),
    semanticClassName,
  ].filter(Boolean).join(' ');
  const headingLevel = /^h([1-4])$/.exec(requestedElement)?.[1];
  const semanticRole: React.AriaRole | undefined = headingLevel
    ? 'heading'
    : requestedElement === 'p' ? 'paragraph'
      : requestedElement === 'strong' ? 'strong' : undefined;
  return <div
    className={resolvedClassName}
    role={semanticRole}
    aria-level={headingLevel ? Number(headingLevel) : undefined}
    data-g7pb-heading-level={headingLevel}
    data-g7pb-richtext-display={requestedElement}
    data-g7pb-inline-field={fieldPath}
    data-g7pb-richtext-field="true"
  >{children}</div>;
}

export const RICH_TEXT_ALLOWED_VALUES = Object.freeze({
  fonts: FONT_VALUES,
  sizes: SIZE_VALUES,
  weights: WEIGHT_VALUES,
  tones: TONE_VALUES,
});
