import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { editorContextProps } from '../blocks/externalEditorData';
import type { ElementAppearanceMap } from '../documents/types';
import { blockContainerClassName, mergeBlockContainerAppearance } from './blockAppearance';
import { canvasContextRangeActive, canvasContextRangeAnchor, canvasContextSelection, INITIAL_CANVAS_CONTEXT_STATE, normalizeCanvasRangeAnchor, reduceCanvasContextState, type CanvasContextAction } from './canvasContextState';
import { CANVAS_ELEMENT_MESSAGE, normalizeElementAppearanceMap, shouldAutoOpenCanvasTextTools, type CanvasElementSelection } from './canvasEditingContract';
import { asString, idToUuid } from './puckBlockCodec';
import type { CanvasEditingUiValue } from './puckEditorContexts';
import { editorItemLocations } from './puckEditorSelection';
import type { PuckEditorData } from './puckEditorTypes';
import { responsiveClassName } from './responsiveBlockStyle';
import { RICH_TEXT_RANGE_STATE_MESSAGE } from './richTextEditing';

export function useCanvasEditingUi(data: PuckEditorData, canEdit: boolean) {
  const pendingFrame = useRef<number | null>(null);
  const live = useRef(true);
  const permission = useRef(canEdit);
  permission.current = canEdit;
  const cancelPending = useCallback(() => {
    if (pendingFrame.current !== null) window.cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = null;
  }, []);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; cancelPending(); };
  }, [cancelPending]);
  const [canvasContextState, setCanvasContextState] = useState(INITIAL_CANVAS_CONTEXT_STATE);
  const canvasContextStateRef = useRef(INITIAL_CANVAS_CONTEXT_STATE);
  const [canvasMediaDialogOpen, setCanvasMediaDialogOpen] = useState(false);
  const [canvasRouteDialogOpen, setCanvasRouteDialogOpen] = useState(false);
  const [canvasTextToolsOpen, setCanvasTextToolsOpen] = useState(false);
  const transitionCanvasContext = useCallback((action: CanvasContextAction) => {
    const next = reduceCanvasContextState(canvasContextStateRef.current, action);
    canvasContextStateRef.current = next;
    setCanvasContextState(next);
    return next;
  }, []);
  const canvasElementSelection = canvasContextSelection(canvasContextState);
  const rangeEditingActive = canvasContextRangeActive(canvasContextState);
  const rangeAnchor = canvasContextRangeAnchor(canvasContextState);
  const setCanvasElementSelection = useCallback<React.Dispatch<React.SetStateAction<CanvasElementSelection | null>>>((value) => {
    const current = canvasContextSelection(canvasContextStateRef.current);
    const selection = typeof value === 'function' ? value(current) : value;
    transitionCanvasContext({ type: 'selection.replace', selection });
  }, [transitionCanvasContext]);
  useEffect(() => {
    if (canEdit) return;
    cancelPending();
    transitionCanvasContext({ type: 'clear' });
    setCanvasMediaDialogOpen(false);
    setCanvasRouteDialogOpen(false);
    setCanvasTextToolsOpen(false);
  }, [cancelPending, transitionCanvasContext, canEdit]);

  const scheduleTextTools = useCallback(() => {
    cancelPending();
    const expected = canvasContextStateRef.current;
    const frame = window.requestAnimationFrame(() => {
      if (pendingFrame.current !== frame) return;
      pendingFrame.current = null;
      if (live.current && permission.current && canvasContextStateRef.current === expected
        && !canvasContextRangeActive(expected)) setCanvasTextToolsOpen(true);
    });
    pendingFrame.current = frame;
  }, [cancelPending]);

  useEffect(() => {
    const accept = (selection: CanvasElementSelection): void => {
      if (!canEdit) return;
      cancelPending();
      transitionCanvasContext({ type: 'selection.accept', selection });
      setCanvasMediaDialogOpen(false);
      setCanvasRouteDialogOpen(false);
      if (shouldAutoOpenCanvasTextTools(selection, 'selection')) {
        scheduleTextTools();
      } else {
        setCanvasTextToolsOpen(false);
      }
    };
    const acceptRangeState = (active: boolean, anchorValue: unknown = null): void => {
      if (!canEdit) return;
      cancelPending();
      const wasActive = canvasContextRangeActive(canvasContextStateRef.current);
      const next = transitionCanvasContext({
        type: 'range.change',
        active,
        anchor: active ? normalizeCanvasRangeAnchor(anchorValue) : null,
      });
      if (active) {
        setCanvasMediaDialogOpen(false);
        setCanvasRouteDialogOpen(false);
        setCanvasTextToolsOpen(false);
      }
      if (!shouldAutoOpenCanvasTextTools(canvasContextSelection(next), active ? 'range-active' : 'range-inactive')) {
        setCanvasTextToolsOpen(false);
        return;
      }
      if (!wasActive) return;
      scheduleTextTools();
    };
    const fromMessage = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === RICH_TEXT_RANGE_STATE_MESSAGE) {
        acceptRangeState(event.data.active === true, event.data.anchor);
        return;
      }
      if (event.data?.type !== CANVAS_ELEMENT_MESSAGE) return;
      accept(event.data.selection as CanvasElementSelection);
    };
    const fromCustomEvent = (event: Event): void => {
      if (event instanceof CustomEvent) accept(event.detail as CanvasElementSelection);
    };
    const fromRangeEvent = (event: Event): void => {
      if (event instanceof CustomEvent) acceptRangeState(event.detail?.active === true, event.detail?.anchor);
    };
    window.addEventListener('message', fromMessage);
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, fromCustomEvent);
    window.addEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, fromRangeEvent);
    return () => {
      cancelPending();
      window.removeEventListener('message', fromMessage);
      window.removeEventListener(CANVAS_ELEMENT_MESSAGE, fromCustomEvent);
      window.removeEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, fromRangeEvent);
    };
  }, [cancelPending, scheduleTextTools, transitionCanvasContext, canEdit]);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || event.target.closest('[data-testid="page-builder-context-panel"]')) return;
      cancelPending();
      setCanvasTextToolsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      cancelPending();
      setCanvasTextToolsOpen(false);
      setCanvasMediaDialogOpen(false);
      setCanvasRouteDialogOpen(false);
    };
    globalThis.document?.addEventListener('pointerdown', closeOnPointerDown, true);
    globalThis.document?.addEventListener('keydown', closeOnEscape);
    return () => {
      globalThis.document?.removeEventListener('pointerdown', closeOnPointerDown, true);
      globalThis.document?.removeEventListener('keydown', closeOnEscape);
    };
  }, [cancelPending]);

  const canvasEditingUi = useMemo<CanvasEditingUiValue>(() => ({
    selection: canvasElementSelection,
    setSelection: setCanvasElementSelection,
    rangeEditingActive,
    rangeAnchor,
    mediaDialogOpen: canvasMediaDialogOpen,
    setMediaDialogOpen: setCanvasMediaDialogOpen,
    routeDialogOpen: canvasRouteDialogOpen,
    setRouteDialogOpen: setCanvasRouteDialogOpen,
    textToolsOpen: canvasTextToolsOpen,
    setTextToolsOpen: setCanvasTextToolsOpen,
  }), [canvasElementSelection, canvasMediaDialogOpen, canvasRouteDialogOpen, canvasTextToolsOpen, rangeAnchor, rangeEditingActive]);
  const canvasElementStyles = useMemo<Record<string, ElementAppearanceMap>>(() => Object.fromEntries(
    editorItemLocations(data).flatMap(({ item: block }) => {
      const rawId = asString(block.props.id);
      const styles = normalizeElementAppearanceMap(editorContextProps(block).elementStyles);
      return [[rawId, styles], [idToUuid(rawId), styles]];
    }),
  ), [data.content]);
  const canvasBlockAppearances = useMemo<Record<string, string>>(() => Object.fromEntries(
    editorItemLocations(data).map(({ item }) => item).flatMap((block) => {
      const rawId = asString(block.props.id);
      const blockProps = block.props as Record<string, unknown>;
      const appearance = mergeBlockContainerAppearance(undefined, blockProps);
      const className = `${blockContainerClassName(appearance ?? { surface: 'default', spacing: 'normal' })} ${responsiveClassName(blockProps.responsiveOverrides)}`.trim();
      return [[rawId, className], [idToUuid(rawId), className]];
    }),
  ), [data.content]);

  return { canvasEditingUi, canvasElementStyles, canvasBlockAppearances };
}
