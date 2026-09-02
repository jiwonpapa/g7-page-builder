import { AlignCenter, AlignLeft, AlignRight, Link2, X } from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';
import { editorContextProps } from '../blocks/externalEditorData';
import type { ElementAppearance } from '../documents/types';
import { normalizeElementAppearance, normalizeElementAppearanceMap, resolveMediaFieldPath, resolveRouteFieldPath, valueAtPath } from './canvasEditingContract';
import { updateCanvasContext, updateCanvasElement, updateCanvasPath } from './canvasItemCommands';
import { FONT_SIZE_REM_OPTIONS } from './fontSize';
import { CanvasMediaPicker } from './MediaPickerField';
import { CanvasRoutePicker } from './RouteUrlField';
import { CanvasEditingUiContext, usePageBuilderPuck } from './puckEditorContexts';
import { resolveEditorSelection } from './puckEditorSelection';
import type { PuckEditorData } from './puckEditorTypes';

export function ConnectedContextPanel({ disabled }: { disabled: boolean }): React.ReactElement | null {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const canvasUi = React.useContext(CanvasEditingUiContext);
  const location = resolveEditorSelection(data, selectedIndex === null ? null : { index: selectedIndex, zone: selectedZone }, canvasUi?.selection?.blockId);
  const selectedBlock = location?.item;
  const blockIndex = location?.selector.index ?? null;
  if (!canvasUi?.textToolsOpen || canvasUi.rangeEditingActive || canvasUi.mediaDialogOpen || canvasUi.routeDialogOpen || !selectedBlock || !location || blockIndex === null) return null;
  const selectedInternalProps = editorContextProps(selectedBlock);
  const currentSurface = selectedInternalProps.surface === 'soft' || selectedInternalProps.surface === 'contrast'
    ? selectedInternalProps.surface : 'default';
  const currentSpacing = selectedInternalProps.spacing === 'compact' || selectedInternalProps.spacing === 'spacious'
    ? selectedInternalProps.spacing : 'normal';
  const currentVisibility = selectedInternalProps.__g7pbVisibilityAudience === 'guest'
    || selectedInternalProps.__g7pbVisibilityAudience === 'member'
    ? selectedInternalProps.__g7pbVisibilityAudience
    : 'all';
  const fieldPath = canvasUi.selection?.fieldPath ?? null;
  const isTextElement = fieldPath !== null && (canvasUi.selection?.role === 'text' || canvasUi.selection?.role === 'action');
  const elementStyles = normalizeElementAppearanceMap(editorContextProps(selectedBlock).elementStyles);
  const currentElement = normalizeElementAppearance(fieldPath ? elementStyles[fieldPath] : undefined);
  const currentFontSize = currentElement.fontSizeRem === undefined
    ? currentElement.size ? 'legacy' : 'auto'
    : String(currentElement.fontSizeRem);
  const routeFieldPath = fieldPath ? resolveRouteFieldPath(selectedBlock.type, fieldPath) : null;
  const update = (patch: Record<string, unknown>): void => {
    dispatch(updateCanvasContext(location, patch));
  };

  const updateElement = (patch: Partial<ElementAppearance>): void => {
    if (fieldPath) dispatch(updateCanvasElement(location, fieldPath, patch));
  };
  const resetElement = (): void => {
    if (fieldPath) dispatch(updateCanvasElement(location, fieldPath, null));
  };
  const anchor = canvasUi.selection?.anchor;
  const balloonPlacement = isTextElement && anchor && anchor.top >= 360 ? 'above' : 'below';
  const balloonStyle = isTextElement && anchor ? {
    '--g7pb-balloon-left': `${Math.max(
      Math.min(284, globalThis.innerWidth / 2),
      Math.min(anchor.left + anchor.width / 2, globalThis.innerWidth - Math.min(284, globalThis.innerWidth / 2)),
    )}px`,
    '--g7pb-balloon-top': `${balloonPlacement === 'above'
      ? anchor.top - 12
      : Math.max(12, Math.min(anchor.bottom + 12, globalThis.innerHeight - 156))}px`,
  } as React.CSSProperties : undefined;

  return createPortal(
    <section className={`g7pb-context-panel${isTextElement ? ` g7pb-element-balloon g7pb-element-balloon--${balloonPlacement}` : ''}`} style={balloonStyle}
      role="dialog" aria-label={isTextElement ? '선택 요소 스타일' : '선택 블록 스타일'} data-testid="page-builder-context-panel">
      <header><div><strong>{canvasUi.selection?.label ?? '블록 전체'} 스타일</strong><span>{isTextElement ? '요소 전체 · 부분 선택은 글자 위 툴바' : '블록 배경·여백·표시 대상을 조정합니다.'}</span></div><button type="button" aria-label="스타일 도구 닫기" onClick={() => canvasUi.setTextToolsOpen(false)}><X size={17} aria-hidden="true" /></button></header>
      {isTextElement ? <>
        <div className="g7pb-element-balloon__controls">
          <label><span>글꼴</span><select disabled={disabled} value={currentElement.font ?? 'inherit'}
            data-testid="page-builder-element-font"
            onChange={(event) => updateElement({ font: event.currentTarget.value as ElementAppearance['font'] })}>
            <option value="inherit">기본</option><option value="modern">모던</option><option value="serif">명조</option><option value="mono">고정폭</option>
          </select></label>
          <label><span>글자 크기</span><select disabled={disabled} value={currentFontSize}
            data-testid="page-builder-font-size-rem"
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === 'auto') updateElement({ fontSizeRem: undefined, size: undefined });
              else if (value !== 'legacy') updateElement({ fontSizeRem: Number(value), size: undefined });
            }}>
            <option value="auto">자동 · 반응형</option>
            {currentElement.size ? <option value="legacy">기존 상대 크기</option> : null}
            {FONT_SIZE_REM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select></label>
          <label><span>굵기</span><select disabled={disabled} value={currentElement.weight ?? 'regular'}
            data-testid="page-builder-element-weight"
            onChange={(event) => updateElement({ weight: event.currentTarget.value as ElementAppearance['weight'] })}>
            <option value="regular">보통</option><option value="semibold">굵게</option><option value="bold">매우 굵게</option>
          </select></label>
          <div className="g7pb-element-balloon__align" role="group" aria-label="요소 전체 글자 정렬">
          <button type="button" disabled={disabled} aria-label="왼쪽 정렬" aria-pressed={(currentElement.align ?? 'left') === 'left'} onClick={() => updateElement({ align: 'left' })}><AlignLeft size={16} data-testid="page-builder-text-align-left" /></button>
          <button type="button" disabled={disabled} aria-label="가운데 정렬" aria-pressed={currentElement.align === 'center'} onClick={() => updateElement({ align: 'center' })}><AlignCenter size={16} data-testid="page-builder-text-align-center" /></button>
          <button type="button" disabled={disabled} aria-label="오른쪽 정렬" aria-pressed={currentElement.align === 'right'} onClick={() => updateElement({ align: 'right' })}><AlignRight size={16} data-testid="page-builder-text-align-right" /></button>
          </div>
          <label><span>색상</span><select disabled={disabled} value={currentElement.tone ?? 'default'}
            data-testid="page-builder-element-tone"
            onChange={(event) => updateElement({ tone: event.currentTarget.value as ElementAppearance['tone'] })}>
            <option value="default">기본</option><option value="muted">보조</option><option value="accent">강조</option><option value="contrast">반전</option>
            <option value="custom1">사용자 1</option><option value="custom2">사용자 2</option><option value="custom3">사용자 3</option><option value="custom4">사용자 4</option>
          </select></label>
        </div>
        <div className="g7pb-element-balloon__footer">
          {routeFieldPath ? <button type="button" disabled={disabled} data-testid="page-builder-element-route-open"
            onClick={() => canvasUi.setRouteDialogOpen(true)}><Link2 size={15} /> 연결 설정</button> : null}
          <button type="button" disabled={disabled || !elementStyles[fieldPath]} onClick={resetElement}>스타일 초기화</button>
        </div>
      </> : <>
        <div className="g7pb-context-panel__row"><span>배경</span><div role="group" aria-label="블록 배경">
          {([['default', '기본'], ['soft', '부드럽게'], ['contrast', '강조']] as const).map(([surface, text]) => <button type="button" key={surface} disabled={disabled} aria-pressed={currentSurface === surface} onClick={() => update({ surface })}>{text}</button>)}
        </div></div>
        <div className="g7pb-context-panel__row"><span>세로 여백</span><div role="group" aria-label="블록 세로 여백">
          {([['compact', '좁게'], ['normal', '기본'], ['spacious', '넓게']] as const).map(([spacing, text]) => <button type="button" key={spacing} disabled={disabled} aria-pressed={currentSpacing === spacing} onClick={() => update({ spacing })}>{text}</button>)}
        </div></div>
        <div className="g7pb-context-panel__row"><span>표시 대상</span><div role="group" aria-label="블록 표시 대상">
          {([['all', '모두'], ['guest', '로그아웃'], ['member', '로그인']] as const).map(([audience, text]) => <button type="button" key={audience} disabled={disabled}
            aria-pressed={currentVisibility === audience} onClick={() => update({ __g7pbVisibilityAudience: audience })}
            data-testid={`page-builder-block-visibility-${audience}`}>{text}</button>)}
        </div></div>
      </>}
    </section>,
    globalThis.document.body,
  );
}

export function ConnectedCanvasDialogs({ disabled }: { disabled: boolean }): React.ReactElement | null {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const canvasUi = React.useContext(CanvasEditingUiContext);
  if (!canvasUi || disabled || canvasUi.rangeEditingActive) return null;

  const location = resolveEditorSelection(data, selectedIndex === null ? null : { index: selectedIndex, zone: selectedZone }, canvasUi?.selection?.blockId);
  const selectedBlock = location?.item;
  const blockIndex = location?.selector.index ?? null;
  if (!selectedBlock || !location || blockIndex === null) return null;

  const defaultRouteFieldPath = selectedBlock.type === 'Hero' || selectedBlock.type === 'HeroSplit' || selectedBlock.type === 'Cta'
    ? 'primaryUrl' : selectedBlock.type === 'Contact' ? 'ctaUrl' : null;
  const routeFieldPath = canvasUi.selection?.fieldPath
    ? resolveRouteFieldPath(selectedBlock.type, canvasUi.selection.fieldPath)
    : defaultRouteFieldPath;
  const mediaFieldPath = canvasUi.selection
    ? resolveMediaFieldPath(selectedBlock.type, canvasUi.selection)
    : selectedBlock.type === 'Hero' || selectedBlock.type === 'HeroSplit' ? 'imageSrc' : null;
  const updateSelectedPath = (path: string, value: unknown): void => {
    dispatch(updateCanvasPath(location, path, value));
  };

  return <>
    {canvasUi.mediaDialogOpen && mediaFieldPath ? createPortal(
      <CanvasMediaPicker value={String(valueAtPath(selectedBlock.props, mediaFieldPath) ?? '')}
        onChange={(value) => { updateSelectedPath(mediaFieldPath, value); canvasUi.setMediaDialogOpen(false); }}
        onDismiss={() => canvasUi.setMediaDialogOpen(false)} />,
      globalThis.document.body,
    ) : null}
    {canvasUi.routeDialogOpen && routeFieldPath ? createPortal(
      <CanvasRoutePicker value={String(valueAtPath(selectedBlock.props, routeFieldPath) ?? '')}
        onChange={(value) => { updateSelectedPath(routeFieldPath, value); canvasUi.setRouteDialogOpen(false); }}
        onDismiss={() => canvasUi.setRouteDialogOpen(false)} />,
      globalThis.document.body,
    ) : null}
  </>;
}
