import React, { useEffect, useMemo, useState } from 'react';
import { Mark, mergeAttributes, type Editor } from '@tiptap/core';
import { Link2, RotateCcw, Unlink } from 'lucide-react';
import { CanvasCurrentElementStylesContext, elementAppearanceClassName } from './canvasEditingContract';

const FONT_VALUES = ['inherit', 'modern', 'serif', 'mono'] as const;
const SIZE_VALUES = ['base', 'small', 'large', 'xlarge'] as const;
const WEIGHT_VALUES = ['regular', 'medium', 'semibold', 'bold'] as const;
const TONE_VALUES = ['default', 'muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'] as const;
export const RICH_TEXT_RANGE_ACTIVE_MESSAGE = 'g7pb:richtext-range-active';

type FontValue = typeof FONT_VALUES[number];
type SizeValue = typeof SIZE_VALUES[number];
type WeightValue = typeof WEIGHT_VALUES[number];
type ToneValue = typeof TONE_VALUES[number];

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

    const syncEditorState = (): void => setRevision((revision) => revision + 1);
    editor.on('selectionUpdate', syncEditorState);
    editor.on('transaction', syncEditorState);

    return () => {
      editor.off('selectionUpdate', syncEditorState);
      editor.off('transaction', syncEditorState);
    };
  }, [editor]);

  return revision;
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

function G7RichTextInlineMenu({
  children,
  editor,
  readOnly,
}: {
  children: React.ReactNode;
  editor: Editor | null;
  editorState: Record<string, boolean | undefined> | null;
  readOnly: boolean;
}): React.ReactElement {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState(false);
  const editorRevision = useRichTextEditorRevision(editor);
  const selection = editor?.state.selection;
  const selectionFrom = selection?.from;
  const selectionTo = selection?.to;
  const selectionEmpty = selection?.empty ?? true;
  const mark = useMemo(() => selectedMark(editor), [editor, editorRevision, selectionFrom, selectionTo]);

  useEffect(() => {
    if (!editor) return;
    setLinkValue(String(editor.getAttributes('link').href ?? ''));
    setLinkError(false);
  }, [editor, editorRevision, selectionFrom, selectionTo]);

  useEffect(() => {
    if (selectionEmpty) return;
    const message = { type: RICH_TEXT_RANGE_ACTIVE_MESSAGE };
    if (window.parent !== window) window.parent.postMessage(message, window.location.origin);
    window.dispatchEvent(new CustomEvent(RICH_TEXT_RANGE_ACTIVE_MESSAGE));
  }, [selectionEmpty, selectionFrom, selectionTo]);

  if (selectionEmpty) return <></>;

  const updateMark = (patch: Partial<{ font: FontValue; size: SizeValue; weight: WeightValue; tone: ToneValue }>): void => {
    if (!editor || readOnly) return;
    const next = { ...selectedMark(editor), ...patch };
    if (next.font === 'inherit' && next.size === 'base' && next.weight === 'regular' && next.tone === 'default') {
      editor.chain().focus().unsetMark('g7TextStyle').run();
      return;
    }
    editor.chain().focus().setMark('g7TextStyle', next).run();
  };

  const applyLink = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!editor || readOnly) return;
    const safe = safeEditorLink(linkValue);
    if (!safe) {
      setLinkError(true);
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: safe }).run();
    setLinkError(false);
    setLinkOpen(false);
  };

  return (
    <div className="g7pb-richtext-inline-toolbar" role="toolbar" aria-label="선택한 글자 서식"
      data-testid="page-builder-richtext-inline-toolbar">
      <div className="g7pb-richtext-inline-toolbar__marks">{children}</div>
      <label title="글꼴">
        <span className="sr-only">선택한 글자 글꼴</span>
        <select value={mark.font} disabled={readOnly} data-testid="page-builder-richtext-font"
          onChange={(event) => updateMark({ font: event.target.value as FontValue })}>
          <option value="inherit">기본 글꼴</option>
          <option value="modern">모던</option>
          <option value="serif">명조</option>
          <option value="mono">고정폭</option>
        </select>
      </label>
      <label title="굵기">
        <span className="sr-only">선택한 글자 굵기</span>
        <select value={mark.weight} disabled={readOnly} data-testid="page-builder-richtext-weight"
          onChange={(event) => updateMark({ weight: event.target.value as WeightValue })}>
          <option value="regular">보통</option>
          <option value="medium">중간</option>
          <option value="semibold">굵게</option>
          <option value="bold">매우 굵게</option>
        </select>
      </label>
      <label title="크기">
        <span className="sr-only">선택한 글자 크기</span>
        <select value={mark.size} disabled={readOnly} data-testid="page-builder-richtext-size"
          onChange={(event) => updateMark({ size: event.target.value as SizeValue })}>
          <option value="small">S</option>
          <option value="base">M</option>
          <option value="large">L</option>
          <option value="xlarge">XL</option>
        </select>
      </label>
      <label title="색상">
        <span className="sr-only">선택한 글자 색상</span>
        <select value={mark.tone} disabled={readOnly} data-testid="page-builder-richtext-tone"
          onChange={(event) => updateMark({ tone: event.target.value as ToneValue })}>
          <option value="default">기본색</option>
          <option value="muted">보조색</option>
          <option value="accent">강조색</option>
          <option value="contrast">반전색</option>
          <option value="custom1">사용자색 1</option>
          <option value="custom2">사용자색 2</option>
          <option value="custom3">사용자색 3</option>
          <option value="custom4">사용자색 4</option>
        </select>
      </label>
      <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="링크 편집"
        aria-pressed={linkOpen} disabled={readOnly} onClick={() => setLinkOpen((open) => !open)}>
        <Link2 size={15} aria-hidden="true" />
      </button>
      {editor?.isActive('link') ? <button type="button" className="g7pb-richtext-inline-toolbar__icon"
        aria-label="링크 제거" disabled={readOnly}
        onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}>
        <Unlink size={15} aria-hidden="true" />
      </button> : null}
      <button type="button" className="g7pb-richtext-inline-toolbar__icon" aria-label="부분 서식 초기화"
        disabled={readOnly} onClick={() => editor?.chain().focus().unsetAllMarks().run()}>
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
