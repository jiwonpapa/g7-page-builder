import React, { useEffect, useRef, useState } from 'react';
import { RichTextMenu } from '@puckeditor/core';
import type { Editor } from '@tiptap/core';
import { Bold, Check, ChevronDown, Italic, Link2, RotateCcw, SlidersHorizontal, Underline, Unlink } from 'lucide-react';
import { FONT_SIZE_REM_OPTIONS, normalizeFontSizeRem, type FontSizeRem } from './fontSize';
import { markFromEditorState, type FontValue, type SizeValue, type WeightValue, type ToneValue, type RichTextEditorState } from './richTextModel';
import { RichTextRangeStateSignal } from './richTextSelection';
import { RichTextFloatingLayer } from './richTextFloatingLayer';
import { updateRichTextMark, applyRichTextLink, toggleRichTextMark, removeRichTextLink, clearRichTextMarks } from './richTextCommands';

const RANGE_OPTION_COMPATIBILITY_CLICK_WINDOW_MS = 50;
type RangeMenu = 'font' | 'weight' | 'size' | 'tone';

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

function RangeChoiceMenu<T extends string>({
  name,
  owner,
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
  owner: Editor | null;
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
  React.useLayoutEffect(() => {
    clearPointerActivation();
    return clearPointerActivation;
  }, [disabled, owner]);
  React.useLayoutEffect(() => {
    if (!open) {
      clearScheduledClose();
      pendingOptionPointer.current = null;
    }
  }, [open]);
  const clearPointerActivationFromKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') clearPointerActivation();
  };
  const toggleFromPointer = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || disabled) return;
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
    if (!disabled && event.detail === 0) onToggle(name);
  };
  const armOptionFromPointer = (event: React.PointerEvent<HTMLButtonElement>, nextValue: T): void => {
    if (event.button !== 0 || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    markPointerActivation();
    pendingOptionPointer.current = { pointerId: event.pointerId, value: nextValue };
  };
  const chooseFromPointer = (event: React.PointerEvent<HTMLButtonElement>, nextValue: T): void => {
    if (event.button !== 0 || disabled) return;
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
    if (!disabled && event.detail === 0) {
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

export function G7RichTextInlineMenu({ editor, editorState, readOnly, allowLink = true }: {
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
  React.useLayoutEffect(() => {
    setOpenMenu(null);
    setLinkOpen(false);
    setLinkValue('');
    setLinkError(false);
    setAdvancedOpen(false);
    suppressAdvancedCompatibilityClick.current = false;
  }, [editor, readOnly, rangeActive]);
  const closeMenu = (menu: RangeMenu): void => setOpenMenu(current => current === menu ? null : current);
  const mark = markFromEditorState(editorState);
  const fontSizeChoice = mark.fontSizeRem === undefined
    ? mark.size === 'base' ? 'auto' : 'legacy'
    : String(mark.fontSizeRem);

  useEffect(() => {
    if (rangeActive && narrowViewport) return;
    setAdvancedOpen(false);
  }, [narrowViewport, rangeActive]);

  const updateMark = (patch: Partial<{ font: FontValue; fontSizeRem: FontSizeRem | undefined; size: SizeValue; weight: WeightValue; tone: ToneValue }>): void => {
    updateRichTextMark({ editor, readOnly, rangeActive }, mark, patch);
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
    const result = applyRichTextLink({ editor, readOnly, rangeActive }, linkValue, allowLink, Boolean(editorState?.isLink));
    if (result === 'blocked') return;
    if (result === 'invalid') {
      setLinkError(true);
      return;
    }
    setLinkError(false);
    setLinkOpen(false);
  };

  const toggleAdvancedFromPointer = (event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    suppressAdvancedCompatibilityClick.current = true;
    setAdvancedOpen((open) => !open);
    setOpenMenu(null);
    setLinkOpen(false);
  };

  const toggleAdvancedFromKeyboard = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    if (readOnly) return;
    if (suppressAdvancedCompatibilityClick.current) {
      suppressAdvancedCompatibilityClick.current = false;
      return;
    }
    if (event.detail === 0) setAdvancedOpen((open) => !open);
  };

  const advancedControls = (ref: React.RefObject<HTMLDivElement | null>): React.ReactElement => (
    <div ref={ref} className="g7pb-richtext-inline-toolbar__advanced-controls"
      role="group" aria-label="선택한 글자 상세 서식">
      <RangeChoiceMenu owner={editor} name="font" label="글꼴" value={mark.font} disabled={readOnly} open={openMenu === 'font'}
        testId="page-builder-richtext-font" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(font) => updateMark({ font })} onClose={() => closeMenu('font')} values={[
          { value: 'inherit', label: '기본 글꼴' }, { value: 'modern', label: '모던' },
          { value: 'serif', label: '명조' }, { value: 'mono', label: '고정폭' },
        ]} />
      <RangeChoiceMenu owner={editor} name="weight" label="굵기" value={mark.weight} disabled={readOnly} open={openMenu === 'weight'}
        testId="page-builder-richtext-weight" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(weight) => updateMark({ weight })} onClose={() => closeMenu('weight')} values={[
          { value: 'regular', label: '보통' }, { value: 'medium', label: '중간' },
          { value: 'semibold', label: '굵게' }, { value: 'bold', label: '매우 굵게' },
        ]} />
      <RangeChoiceMenu owner={editor} name="size" label="글자 크기" value={fontSizeChoice} disabled={readOnly} open={openMenu === 'size'}
        testId="page-builder-richtext-size" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(value) => {
          if (value === 'auto') updateMark({ fontSizeRem: undefined, size: 'base' });
          else if (value !== 'legacy') updateMark({ fontSizeRem: normalizeFontSizeRem(Number(value)), size: 'base' });
        }} onClose={() => closeMenu('size')} values={[
          { value: 'auto', label: '자동 · 반응형' },
          ...(mark.size === 'base' ? [] : [{ value: 'legacy', label: '기존 상대 크기' }]),
          ...FONT_SIZE_REM_OPTIONS,
        ]} />
      <RangeChoiceMenu owner={editor} name="tone" label="색상" value={mark.tone} disabled={readOnly} open={openMenu === 'tone'}
        testId="page-builder-richtext-tone" onToggle={(menu) => setOpenMenu((current) => current === menu ? null : menu)}
        onChange={(tone) => updateMark({ tone })} onClose={() => closeMenu('tone')} values={[
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
          removeRichTextLink({ editor, readOnly, rangeActive });
        }}
      /> : null}
      <RichTextMenu.Control
        title="부분 서식 초기화"
        icon={<RotateCcw size={15} aria-hidden="true" />}
        disabled={readOnly || !editor}
        onClick={(event) => {
          event.stopPropagation();
          clearRichTextMarks({ editor, readOnly, rangeActive });
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
              toggleRichTextMark({ editor, readOnly, rangeActive }, 'bold');
              setOpenMenu(null);
            }}
          />
          <NativeRangeControl
            label="선택한 글자 기울임"
            icon={<Italic size={15} aria-hidden="true" />}
            active={Boolean(editorState?.isItalic)}
            disabled={readOnly || !editor || !editorState?.canItalic}
            onApply={() => {
              toggleRichTextMark({ editor, readOnly, rangeActive }, 'italic');
              setOpenMenu(null);
            }}
          />
          <NativeRangeControl
            label="선택한 글자 밑줄"
            icon={<Underline size={15} aria-hidden="true" />}
            active={Boolean(editorState?.isUnderline)}
            disabled={readOnly || !editor || !editorState?.canUnderline}
            onApply={() => {
              toggleRichTextMark({ editor, readOnly, rangeActive }, 'underline');
              setOpenMenu(null);
            }}
          />
        </RichTextMenu.Group>
        <RichTextMenu.Group>
          <div ref={toolbarRef} className="g7pb-richtext-inline-toolbar" role="group" aria-label="선택한 글자 추가 서식"
            data-testid="page-builder-richtext-inline-toolbar">
            {narrowViewport ? <>
              <button ref={advancedTriggerRef} type="button" disabled={readOnly} className="g7pb-richtext-inline-toolbar__more"
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
