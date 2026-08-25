import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mark, mergeAttributes, type Editor } from '@tiptap/core';
import { Bold, Check, ChevronDown, Italic, Link2, RotateCcw, Underline, Unlink } from 'lucide-react';
import { CanvasCurrentElementStylesContext, elementAppearanceClassName } from './canvasEditingContract';

const FONT_VALUES = ['inherit', 'modern', 'serif', 'mono'] as const;
const SIZE_VALUES = ['base', 'small', 'large', 'xlarge'] as const;
const WEIGHT_VALUES = ['regular', 'medium', 'semibold', 'bold'] as const;
const TONE_VALUES = ['default', 'muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'] as const;
export const RICH_TEXT_RANGE_STATE_MESSAGE = 'g7pb:richtext-range-state';

type FontValue = typeof FONT_VALUES[number];
type SizeValue = typeof SIZE_VALUES[number];
type WeightValue = typeof WEIGHT_VALUES[number];
type ToneValue = typeof TONE_VALUES[number];
type TextRangeBookmark = { from: number; to: number };
type RangeMenu = 'font' | 'weight' | 'size' | 'tone';

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

function useRichTextEditorRevision(editor: Editor | null): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!editor) return;

    let editorDom: HTMLElement | null = null;
    try {
      editorDom = editor.view.dom;
    } catch {
      // Tiptap can expose the Editor before its ProseMirror view is mounted.
    }
    const editorDocument = editorDom?.ownerDocument ?? null;
    const editorWindow = editorDocument?.defaultView ?? null;
    let pointerRangeInProgress = false;
    let pendingRevision = false;
    const commitRevision = (): void => setRevision((revision) => revision + 1);
    const syncEditorState = (): void => {
      if (pointerRangeInProgress) {
        pendingRevision = true;
        return;
      }
      commitRevision();
    };
    const beginPointerRange = (event: PointerEvent): void => {
      if (editorDom && event.composedPath().includes(editorDom)) pointerRangeInProgress = true;
    };
    const closeRangeOutsideEditor = (event: PointerEvent): void => {
      if (!editorDom || event.composedPath().includes(editorDom)) return;
      if (event.target instanceof Element && event.target.closest('[data-testid="page-builder-richtext-inline-toolbar"]')) return;
      const selection = editor.state.selection;
      if (!selection.empty) editor.commands.setTextSelection(selection.to);
    };
    const closeRangeWhenCanvasLosesFocus = (): void => {
      const selection = editor.state.selection;
      if (!selection.empty) editor.commands.setTextSelection(selection.to);
    };
    const finishPointerRange = (): void => {
      if (!pointerRangeInProgress) return;
      pointerRangeInProgress = false;
      if (!pendingRevision) return;
      pendingRevision = false;
      commitRevision();
    };

    editorDocument?.addEventListener('pointerdown', beginPointerRange, true);
    editorDocument?.addEventListener('pointerdown', closeRangeOutsideEditor, true);
    editorDocument?.addEventListener('pointerup', finishPointerRange, true);
    editorDocument?.addEventListener('pointercancel', finishPointerRange, true);
    editorWindow?.addEventListener('blur', closeRangeWhenCanvasLosesFocus);
    editor.on('selectionUpdate', syncEditorState);
    editor.on('transaction', syncEditorState);

    return () => {
      editorDocument?.removeEventListener('pointerdown', beginPointerRange, true);
      editorDocument?.removeEventListener('pointerdown', closeRangeOutsideEditor, true);
      editorDocument?.removeEventListener('pointerup', finishPointerRange, true);
      editorDocument?.removeEventListener('pointercancel', finishPointerRange, true);
      editorWindow?.removeEventListener('blur', closeRangeWhenCanvasLosesFocus);
      editor.off('selectionUpdate', syncEditorState);
      editor.off('transaction', syncEditorState);
    };
  }, [editor]);

  return revision;
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
}): React.ReactElement {
  const current = values.find((option) => option.value === value) ?? values[0];
  return <div className="g7pb-richtext-inline-toolbar__choice">
    <button type="button" disabled={disabled} data-testid={testId} aria-haspopup="listbox" aria-expanded={open}
      aria-label={`선택한 글자 ${label}: ${current.label}`} onClick={() => onToggle(name)}>
      <span>{current.label}</span><ChevronDown size={13} aria-hidden="true" />
    </button>
    {open ? <div className="g7pb-richtext-inline-toolbar__options" role="listbox" aria-label={`선택한 글자 ${label}`}>
      {values.map((option) => <button type="button" role="option" aria-selected={option.value === value}
        key={option.value} onClick={() => onChange(option.value)}>
        <span>{option.label}</span>{option.value === value ? <Check size={13} aria-hidden="true" /> : null}
      </button>)}
    </div> : null}
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

function G7RichTextInlineMenu({ editor, readOnly }: {
  children: React.ReactNode;
  editor: Editor | null;
  editorState: Record<string, boolean | undefined> | null;
  readOnly: boolean;
}): React.ReactElement {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [openMenu, setOpenMenu] = useState<RangeMenu | null>(null);
  const bookmarkRef = useRef<TextRangeBookmark | null>(null);
  const rangeActiveRef = useRef(false);
  const editorRevision = useRichTextEditorRevision(editor);
  const selection = editor?.state.selection;
  const selectionFrom = selection?.from;
  const selectionTo = selection?.to;
  const selectionEmpty = selection?.empty ?? true;
  const mark = useMemo(() => selectedMark(editor), [editor, editorRevision, selectionFrom, selectionTo]);

  if (!selectionEmpty && selectionFrom !== undefined && selectionTo !== undefined) {
    bookmarkRef.current = { from: selectionFrom, to: selectionTo };
  }

  useEffect(() => {
    if (!editor) return;
    setLinkValue(String(editor.getAttributes('link').href ?? ''));
    setLinkError(false);
  }, [editor, editorRevision, selectionFrom, selectionTo]);

  useEffect(() => {
    const active = !selectionEmpty;
    rangeActiveRef.current = active;
    const detail = {
      active,
      range: active && selectionFrom !== undefined && selectionTo !== undefined
        ? { from: selectionFrom, to: selectionTo }
        : null,
    };
    const message = { type: RICH_TEXT_RANGE_STATE_MESSAGE, ...detail };
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
    window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_STATE_MESSAGE, { detail }));
  }, [selectionEmpty, selectionFrom, selectionTo]);

  useEffect(() => () => {
    if (!rangeActiveRef.current) return;
    const detail = { active: false, range: null };
    if (window.parent !== window) window.parent.postMessage({ type: RICH_TEXT_RANGE_STATE_MESSAGE, ...detail }, window.location.origin);
    window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_STATE_MESSAGE, { detail }));
  }, []);

  if (selectionEmpty) return <></>;

  const restoreRange = () => {
    const bookmark = bookmarkRef.current;
    if (!editor || !bookmark || bookmark.from === bookmark.to) return null;
    return editor.chain().focus().setTextSelection(bookmark);
  };
  const preserveRangeOnPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (editor && !editor.state.selection.empty) {
      bookmarkRef.current = { from: editor.state.selection.from, to: editor.state.selection.to };
    }
    if (event.target instanceof Element && event.target.closest('button')) event.preventDefault();
  };
  const updateMark = (patch: Partial<{ font: FontValue; size: SizeValue; weight: WeightValue; tone: ToneValue }>): void => {
    if (!editor || readOnly) return;
    const chain = restoreRange();
    if (!chain) return;
    const next = { ...mark, ...patch };
    if (next.font === 'inherit' && next.size === 'base' && next.weight === 'regular' && next.tone === 'default') {
      chain.unsetMark('g7TextStyle').run();
      return;
    }
    chain.setMark('g7TextStyle', next).run();
    setOpenMenu(null);
  };
  const toggleNativeMark = (name: 'bold' | 'italic' | 'underline'): void => {
    if (!editor || readOnly) return;
    const chain = restoreRange();
    if (!chain) return;
    if (name === 'bold') chain.toggleBold().run();
    else if (name === 'italic') chain.toggleItalic().run();
    else chain.toggleUnderline().run();
  };

  const applyLink = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!editor || readOnly) return;
    const safe = safeEditorLink(linkValue);
    if (!safe) {
      setLinkError(true);
      return;
    }
    const chain = restoreRange();
    if (!chain) return;
    chain.extendMarkRange('link').setLink({ href: safe }).run();
    setLinkError(false);
    setLinkOpen(false);
  };

  return (
    <div className="g7pb-richtext-inline-toolbar" role="toolbar" aria-label="선택한 글자 서식"
      data-testid="page-builder-richtext-inline-toolbar" onPointerDownCapture={preserveRangeOnPointerDown}>
      <div className="g7pb-richtext-inline-toolbar__marks">
        <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="선택한 글자 굵게"
          aria-pressed={editor?.isActive('bold') ?? false} disabled={readOnly} onClick={() => toggleNativeMark('bold')}>
          <Bold size={15} aria-hidden="true" />
        </button>
        <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="선택한 글자 기울임"
          aria-pressed={editor?.isActive('italic') ?? false} disabled={readOnly} onClick={() => toggleNativeMark('italic')}>
          <Italic size={15} aria-hidden="true" />
        </button>
        <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="선택한 글자 밑줄"
          aria-pressed={editor?.isActive('underline') ?? false} disabled={readOnly} onClick={() => toggleNativeMark('underline')}>
          <Underline size={15} aria-hidden="true" />
        </button>
      </div>
      <RangeChoiceMenu name="font" label="글꼴" value={mark.font} disabled={readOnly} open={openMenu === 'font'}
        testId="page-builder-richtext-font" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(font) => updateMark({ font })} values={[
          { value: 'inherit', label: '기본 글꼴' }, { value: 'modern', label: '모던' },
          { value: 'serif', label: '명조' }, { value: 'mono', label: '고정폭' },
        ]} />
      <RangeChoiceMenu name="weight" label="굵기" value={mark.weight} disabled={readOnly} open={openMenu === 'weight'}
        testId="page-builder-richtext-weight" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(weight) => updateMark({ weight })} values={[
          { value: 'regular', label: '보통' }, { value: 'medium', label: '중간' },
          { value: 'semibold', label: '굵게' }, { value: 'bold', label: '매우 굵게' },
        ]} />
      <RangeChoiceMenu name="size" label="크기" value={mark.size} disabled={readOnly} open={openMenu === 'size'}
        testId="page-builder-richtext-size" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(size) => updateMark({ size })} values={[
          { value: 'small', label: 'S' }, { value: 'base', label: 'M' },
          { value: 'large', label: 'L' }, { value: 'xlarge', label: 'XL' },
        ]} />
      <RangeChoiceMenu name="tone" label="색상" value={mark.tone} disabled={readOnly} open={openMenu === 'tone'}
        testId="page-builder-richtext-tone" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(tone) => updateMark({ tone })} values={[
          { value: 'default', label: '기본색' }, { value: 'muted', label: '보조색' },
          { value: 'accent', label: '강조색' }, { value: 'contrast', label: '반전색' },
          { value: 'custom1', label: '사용자색 1' }, { value: 'custom2', label: '사용자색 2' },
          { value: 'custom3', label: '사용자색 3' }, { value: 'custom4', label: '사용자색 4' },
        ]} />
      <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="링크 편집"
        aria-pressed={linkOpen} disabled={readOnly} onClick={() => setLinkOpen((open) => !open)}>
        <Link2 size={15} aria-hidden="true" />
      </button>
      {editor?.isActive('link') ? <button type="button" className="g7pb-richtext-inline-toolbar__icon"
        aria-label="링크 제거" disabled={readOnly}
        onClick={() => restoreRange()?.extendMarkRange('link').unsetLink().run()}>
        <Unlink size={15} aria-hidden="true" />
      </button> : null}
      <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="부분 서식 초기화"
        disabled={readOnly} onClick={() => restoreRange()?.unsetAllMarks().run()}>
        <RotateCcw size={15} aria-hidden="true" />
      </button>
      {linkOpen ? <form className="g7pb-richtext-inline-toolbar__link" onSubmit={applyLink}>
        <label><span className="sr-only">링크 주소</span><input type="text" inputMode="url" value={linkValue}
          aria-invalid={linkError} placeholder="https:// 또는 /페이지" autoFocus
          onChange={(event) => { setLinkValue(event.target.value); setLinkError(false); }} /></label>
        <button type="submit">적용</button>
        {linkError ? <span role="alert">안전한 HTTPS 또는 내부 주소를 입력하세요.</span> : null}
      </form> : null}
    </div>
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
      selector: (context: { editor: Editor | null }) => {
        const current = selectedMark(context.editor);
        return {
          g7FontModern: current.font === 'modern',
          g7FontSerif: current.font === 'serif',
          g7FontMono: current.font === 'mono',
          g7SizeSmall: current.size === 'small',
          g7SizeLarge: current.size === 'large',
          g7SizeXlarge: current.size === 'xlarge',
          g7WeightMedium: current.weight === 'medium',
          g7WeightSemibold: current.weight === 'semibold',
          g7WeightBold: current.weight === 'bold',
          g7ToneMuted: current.tone === 'muted',
          g7ToneAccent: current.tone === 'accent',
          g7ToneContrast: current.tone === 'contrast',
          g7ToneCustom1: current.tone === 'custom1',
          g7ToneCustom2: current.tone === 'custom2',
          g7ToneCustom3: current.tone === 'custom3',
          g7ToneCustom4: current.tone === 'custom4',
        };
      },
    },
    renderInlineMenu: G7RichTextInlineMenu,
  };
}

export function createInlineRichTextField(label: string) {
  return createRichTextField(label, 64, false);
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
  const resolvedClassName = [className, elementAppearanceClassName(elementStyles, fieldPath)].filter(Boolean).join(' ');
  const headingLevel = /^h([1-4])$/.exec(requestedElement)?.[1];
  if (headingLevel) {
    return <div
      className={resolvedClassName}
      role="heading"
      aria-level={Number(headingLevel)}
      data-g7pb-heading-level={headingLevel}
      data-g7pb-inline-field={fieldPath}
      data-g7pb-richtext-field="true"
      data-puck-overlay-portal="true"
      onPointerDown={(event) => event.stopPropagation()}
    >{children}</div>;
  }
  const Component = requestedElement;
  return <Component className={resolvedClassName} data-g7pb-inline-field={fieldPath} data-g7pb-richtext-field="true"
    data-puck-overlay-portal="true" onPointerDown={(event) => event.stopPropagation()}>{children}</Component>;
}

export const RICH_TEXT_ALLOWED_VALUES = Object.freeze({
  fonts: FONT_VALUES,
  sizes: SIZE_VALUES,
  weights: WEIGHT_VALUES,
  tones: TONE_VALUES,
});
