import { ActionBar } from '@puckeditor/core';
import { ArrowDown, ArrowUp, Copy, ImageOff, ImagePlus, Link2, MoveRight, Paintbrush, Settings2, Trash2 } from 'lucide-react';
import React from 'react';
import { collectionLimit, resolveMediaFieldPath, resolveRouteFieldPath, valueAtPath } from './canvasEditingContract';
import { deleteCanvasItem, duplicateCanvasItem, moveCanvasItem, moveCanvasItemTo, updateCanvasCollection, updateCanvasPath, type CollectionOperation } from './canvasItemCommands';
import { idToUuid } from './puckBlockCodec';
import { CanvasEditingUiContext, usePageBuilderPuck } from './puckEditorContexts';
import { editorItemLocations, editorMoveDestinations, resolveEditorSelection } from './puckEditorSelection';
import type { PuckEditorData } from './puckEditorTypes';
import { useSelectedActionBarSafeZone } from './useSelectedActionBarSafeZone';

const NARROW_CANVAS_MAX_WIDTH = 900;

export function SelectedBlockActionBar({
  children,
  label,
  parentAction,
  disabled,
}: {
  children: React.ReactNode;
  label?: string;
  parentAction?: React.ReactNode;
  disabled: boolean;
}): React.ReactElement {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const rawSelector = usePageBuilderPuck((state) => state.appState.ui.itemSelector ?? null);
  const currentViewportWidth = usePageBuilderPuck((state) => state.appState.ui.viewports.current.width);
  const narrowCanvas = typeof currentViewportWidth === 'number' && currentViewportWidth <= NARROW_CANVAS_MAX_WIDTH;
  const actionBarRef = useSelectedActionBarSafeZone(true);
  const canvasUi = React.useContext(CanvasEditingUiContext);
  const location = resolveEditorSelection(data, rawSelector ? { ...rawSelector, zone: rawSelector.zone ?? 'root:default-zone' } : null);
  const selectedBlock = location?.item;
  const selectedIndex = location?.selector.index ?? null;
  const selectedZone = location?.selector.zone ?? 'root:default-zone';
  const contentLength = editorItemLocations(data).filter(({ selector }) => selector.zone === selectedZone).length;
  const [moveOpen, setMoveOpen] = React.useState(false);
  const [moveTarget, setMoveTarget] = React.useState('');
  const moveDestinations = React.useMemo(() => location ? editorMoveDestinations(data, location) : [], [data, location]);
  const validMoveDestinations = moveDestinations.filter(({ valid }) => valid);
  const selectedMove = validMoveDestinations.find(({ selector }) => `${selector.zone}:${selector.index}` === moveTarget) ?? null;
  const duplicateActions = location ? duplicateCanvasItem(data, location) : [];
  const layoutBlock = selectedBlock?.type === 'LayoutSection' || selectedBlock?.type === 'LayoutColumns' || selectedBlock?.type === 'LayoutStack';
  React.useEffect(() => {
    setMoveOpen(false);
    setMoveTarget('');
  }, [selectedBlock?.props.id]);
  if (!canvasUi) throw new Error('Canvas editing UI provider is unavailable.');
  const {
    selection: rawElementSelection,
    rangeEditingActive,
    rangeAnchor,
    setSelection: setElementSelection,
    setMediaDialogOpen,
    setRouteDialogOpen,
    textToolsOpen,
    setTextToolsOpen,
  } = canvasUi;
  const elementSelection = selectedBlock && rawElementSelection?.blockId === idToUuid(selectedBlock.props.id)
    ? rawElementSelection : null;

  const defaultRouteFieldPath = selectedBlock?.type === 'Hero' || selectedBlock?.type === 'HeroSplit' || selectedBlock?.type === 'Cta'
    ? 'primaryUrl' : selectedBlock?.type === 'Contact' ? 'ctaUrl' : null;
  const routeFieldPath = selectedBlock && elementSelection?.fieldPath
    ? resolveRouteFieldPath(selectedBlock.type, elementSelection.fieldPath)
    : defaultRouteFieldPath;
  const mediaFieldPath = selectedBlock && elementSelection
    ? resolveMediaFieldPath(selectedBlock.type, elementSelection)
    : selectedBlock?.type === 'Hero' || selectedBlock?.type === 'HeroSplit' ? 'imageSrc' : null;
  const collection = elementSelection?.collection ?? null;
  const itemIndex = elementSelection?.itemIndex ?? null;
  const selectedProps = selectedBlock?.props as Record<string, unknown> | undefined;
  const selectedCollection = selectedProps && collection && Array.isArray(selectedProps[collection])
    ? selectedProps[collection] as unknown[]
    : null;
  const limits = selectedBlock && collection ? collectionLimit(selectedBlock.type, collection) : null;

  const move = (destinationIndex: number): void => {
    if (location) moveCanvasItem(data, location, destinationIndex).forEach(dispatch);
  };

  const moveToSelectedZone = (): void => {
    if (!location || !selectedMove) return;
    moveCanvasItemTo(data, location, selectedMove.selector).forEach(dispatch);
    setElementSelection(null);
    setMoveOpen(false);
    setMoveTarget('');
  };

  const duplicate = (): void => {
    duplicateActions.forEach(dispatch);
    setElementSelection(null);
  };

  const remove = (): void => {
    if (!location || layoutBlock) return;
    deleteCanvasItem(data, location).forEach(dispatch);
    setElementSelection(null);
  };

  const clearDirectMedia = (): void => {
    if (location && mediaFieldPath) dispatch(updateCanvasPath(location, mediaFieldPath, '', true));
  };

  const updateCollection = (operation: CollectionOperation): void => {
    if (!location || !collection || itemIndex === null) return;
    const plan = updateCanvasCollection(location, collection, itemIndex, operation);
    if (!plan) return;
    dispatch(plan.action);
    const fieldPath = elementSelection?.fieldPath?.replace(`${collection}.${itemIndex}.`, `${collection}.${plan.nextIndex}.`) ?? null;
    setElementSelection((current) => current ? { ...current, fieldPath, itemIndex: plan.nextIndex,
      label: current.label.replace(`${itemIndex + 1}번 항목`, `${plan.nextIndex + 1}번 항목`) } : current);
  };

  const roleLabel = elementSelection?.role === 'media' ? '이미지'
    : elementSelection?.role === 'action' ? '버튼·링크'
      : elementSelection?.role === 'text' ? '텍스트' : '블록';
  const elementStyleTarget = Boolean(elementSelection?.fieldPath)
    && (elementSelection?.role === 'text' || elementSelection?.role === 'action');
  const styleActionLabel = elementStyleTarget
    ? `${elementSelection?.label ?? '선택 요소'} 요소 전체 스타일`
    : '블록 설정';
  const puckRichTextActions = React.Children.toArray(children).find((child) => (
    React.isValidElement(child) && child.type === React.Fragment
  ));
  return (
    <div
      ref={actionBarRef}
      className="g7pb-selected-block-actionbar"
      data-g7pb-selected-block-actionbar="true"
      data-g7pb-canvas-layout={narrowCanvas ? 'narrow' : 'wide'}
      data-g7pb-range-editing-active={rangeEditingActive ? 'true' : 'false'}
      data-g7pb-range-anchor={rangeEditingActive && rangeAnchor ? 'true' : 'false'}
    >
      <ActionBar>
        {!rangeEditingActive && <ActionBar.Group>
          {parentAction}
          {label && <ActionBar.Label label={label} />}
          {selectedBlock && <ActionBar.Label label={`${elementSelection?.label ?? '블록 전체'} · ${roleLabel}`} />}
        </ActionBar.Group>}
        <ActionBar.Group>
          {!rangeEditingActive && mediaFieldPath && (
            <>
              <ActionBar.Action label="선택 이미지 변경" disabled={disabled} onClick={() => setMediaDialogOpen(true)}>
                <ImagePlus size={16} data-testid="page-builder-canvas-media-open" aria-hidden="true" />
              </ActionBar.Action>
              <ActionBar.Action label="선택 이미지 비우기" disabled={disabled || !selectedBlock || !valueAtPath(selectedBlock.props, mediaFieldPath)}
                onClick={clearDirectMedia}>
                <ImageOff size={16} data-testid="page-builder-canvas-media-clear" aria-hidden="true" />
              </ActionBar.Action>
            </>
          )}
          {!rangeEditingActive && routeFieldPath ? <ActionBar.Action label="선택 버튼 연결 편집" disabled={disabled} onClick={() => setRouteDialogOpen(true)}>
            <Link2 size={16} data-testid="page-builder-canvas-route-open" aria-hidden="true" />
          </ActionBar.Action> : null}
          {!rangeEditingActive && selectedBlock ? <ActionBar.Action
            label={styleActionLabel}
            aria-label={styleActionLabel}
            disabled={disabled} onClick={() => {
              if (!elementSelection) setElementSelection(null);
              setTextToolsOpen((open) => !open);
            }}>
            {elementStyleTarget
              ? <Paintbrush size={16} data-testid="page-builder-element-style-open" aria-hidden="true" />
              : <Settings2 size={16} data-testid="page-builder-block-style-open" aria-hidden="true" />}
          </ActionBar.Action> : null}
          {!rangeEditingActive && selectedCollection && itemIndex !== null && limits ? <>
            <ActionBar.Action label="선택 항목 위로" disabled={disabled || itemIndex === 0} onClick={() => updateCollection('up')}><ArrowUp size={16} data-testid="page-builder-item-move-up" aria-hidden="true" /></ActionBar.Action>
            <ActionBar.Action label="선택 항목 아래로" disabled={disabled || itemIndex >= selectedCollection.length - 1} onClick={() => updateCollection('down')}><ArrowDown size={16} data-testid="page-builder-item-move-down" aria-hidden="true" /></ActionBar.Action>
            <ActionBar.Action label="선택 항목 복제" disabled={disabled || selectedCollection.length >= limits.max} onClick={() => updateCollection('duplicate')}><Copy size={16} data-testid="page-builder-item-duplicate" aria-hidden="true" /></ActionBar.Action>
            <ActionBar.Action label={`선택 항목 삭제${selectedCollection.length <= limits.min ? ` (최소 ${limits.min}개)` : ''}`} disabled={disabled || selectedCollection.length <= limits.min} onClick={() => updateCollection('delete')}><Trash2 size={16} data-testid="page-builder-item-delete" aria-hidden="true" /></ActionBar.Action>
          </> : null}
          {!rangeEditingActive && <ActionBar.Action
            label="블록 위로 이동"
            disabled={disabled || selectedIndex === null || selectedIndex === 0}
            onClick={() => move((selectedIndex ?? 0) - 1)}
          >
            <ArrowUp size={16} data-testid="page-builder-block-move-up" aria-hidden="true" />
          </ActionBar.Action>}
          {!rangeEditingActive && <ActionBar.Action
            label="블록 아래로 이동"
            disabled={disabled || selectedIndex === null || selectedIndex >= contentLength - 1}
            onClick={() => move((selectedIndex ?? -1) + 1)}
          >
            <ArrowDown size={16} data-testid="page-builder-block-move-down" aria-hidden="true" />
          </ActionBar.Action>}
          {!rangeEditingActive && <ActionBar.Action label="블록 위치 이동"
            disabled={disabled || !location || moveDestinations.length === 0} onClick={() => setMoveOpen((open) => !open)}>
            <MoveRight size={16} data-testid="page-builder-block-move-zone" aria-hidden="true" />
          </ActionBar.Action>}
          {!rangeEditingActive && <ActionBar.Action label="블록 복제" disabled={disabled || duplicateActions.length === 0}
            onClick={duplicate}>
            <Copy size={16} data-testid="page-builder-block-duplicate" aria-hidden="true" />
          </ActionBar.Action>}
          {!rangeEditingActive && !layoutBlock && <ActionBar.Action label="블록 삭제" disabled={disabled || !location}
            onClick={remove}>
            <Trash2 size={16} data-testid="page-builder-block-delete" aria-hidden="true" />
          </ActionBar.Action>}
          {puckRichTextActions}
        </ActionBar.Group>
      </ActionBar>
      {!rangeEditingActive && moveOpen && <section className="g7pb-context-panel" role="dialog" aria-label="블록 위치 이동"
        data-testid="page-builder-block-move-dialog">
        <header><div><strong>블록 위치 이동</strong><span>옮길 수 없는 구역도 이유와 함께 표시됩니다.</span></div>
          <button type="button" aria-label="블록 위치 이동 닫기" onClick={() => setMoveOpen(false)}>×</button></header>
        <div className="g7pb-context-panel__row"><label htmlFor="g7pb-block-move-target">이동할 구역</label>
          <select id="g7pb-block-move-target" data-testid="page-builder-block-move-target" value={moveTarget}
            onChange={(event) => setMoveTarget(event.target.value)}>
            <option value="">구역을 선택하세요</option>
            {moveDestinations.map((destination) => {
              const value = `${destination.selector.zone}:${destination.selector.index}`;
              return <option key={value} value={value} disabled={!destination.valid}>
                {destination.label}{destination.reason ? ` · ${destination.reason}` : ''}
              </option>;
            })}
          </select></div>
        <div className="g7pb-context-panel__row"><span>{selectedMove ? `${selectedMove.label} 끝으로 이동합니다.` : '이동할 구역을 선택하세요.'}</span>
          <div><button type="button" data-testid="page-builder-block-move-apply" disabled={!selectedMove} onClick={moveToSelectedZone}>이동</button></div>
        </div>
      </section>}
    </div>
  );
}
