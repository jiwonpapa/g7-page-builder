import type { PuckAction, Viewports } from '@puckeditor/core';
import { Ban, Monitor, Moon, MoreHorizontal, Paintbrush, Smartphone, Sparkles, Sun, Tablet } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { StableAddBlockControls } from './BlockGalleryControls';
import { applyRecommendedMotions, clearMotions } from './blockMotionCommands';
import { setPageColorMode } from './canvasItemCommands';
import { PC_EDITOR_POLICY_NOTICE, PC_EDITOR_VIEWPORT_WIDTH } from './editorViewportPolicy';
import type { PageDesignProps } from './pageDesignTokens';
import { CanvasEditingUiContext, EditorViewportPolicyContext, usePageBuilderPuck } from './puckEditorContexts';
import { resolveEditorSelection } from './puckEditorSelection';
import type { PuckEditorData } from './puckEditorTypes';

export const PAGE_BUILDER_VIEWPORTS: Viewports = [
  { width: 360, height: 'auto', label: '모바일', icon: 'Smartphone' },
  { width: 768, height: 'auto', label: '태블릿', icon: 'Tablet' },
  { width: 1280, height: 'auto', label: 'PC', icon: 'Monitor' },
];

export function StableHeaderControls({
  dispatch,
  data,
  contentLength,
  selectedIndex,
  selectedZone,
  currentViewportWidth,
  viewportState,
  editingDisabled,
  viewportDisabled,
  onViewportChange,
}: {
  dispatch: (action: PuckAction) => void;
  data: PuckEditorData;
  contentLength: number;
  selectedIndex: number | null;
  selectedZone: string;
  currentViewportWidth: number | '100%';
  viewportState: {
    current: { width: number | '100%'; height: number | 'auto' };
    controlsVisible: boolean;
    options: Viewports;
  };
  editingDisabled: boolean;
  viewportDisabled: boolean;
  onViewportChange: (width: number | '100%') => void;
}): React.ReactElement {
  const setViewport = (width: number): void => {
    const viewport = PAGE_BUILDER_VIEWPORTS.find((candidate) => candidate.width === width);
    if (!viewport) {
      return;
    }

    dispatch({
      type: 'setUi',
      ui: {
        viewports: {
          ...viewportState,
          current: {
            width: viewport.width,
            height: viewport.height ?? 'auto',
          },
        },
      },
      recordHistory: false,
    });
    onViewportChange(width);
  };

  const selectPageDesign = (): void => {
    dispatch({
      type: 'setUi',
      ui: { itemSelector: null },
      recordHistory: false,
    });
  };

  const setColorMode = (colorMode: PageDesignProps['colorMode']): void => {
    dispatch(setPageColorMode(colorMode));
  };

  const viewportIcon = (width: number): React.ReactNode => {
    if (width === 360) return <Smartphone size={15} aria-hidden="true" />;
    if (width === 768) return <Tablet size={15} aria-hidden="true" />;
    return <Monitor size={15} aria-hidden="true" />;
  };

  return (
    <div className="g7pb-header-controls">
      <button type="button" className="g7pb-design-button" data-testid="page-builder-page-design"
        disabled={editingDisabled} onClick={selectPageDesign}>
        <Paintbrush size={16} aria-hidden="true" /><span>페이지 디자인</span>
      </button>
      <div className="g7pb-viewport-switcher" role="group" aria-label="캔버스 기기 미리보기">
        {PAGE_BUILDER_VIEWPORTS.map((viewport) => (
          <button
            key={viewport.width}
            type="button"
            data-testid={`page-builder-viewport-${viewport.width}`}
            aria-pressed={viewport.width === PC_EDITOR_VIEWPORT_WIDTH
              ? currentViewportWidth === '100%' || currentViewportWidth === PC_EDITOR_VIEWPORT_WIDTH
              : currentViewportWidth === viewport.width}
            disabled={viewportDisabled}
            onClick={() => setViewport(viewport.width as number)}
          >
            {viewportIcon(viewport.width as number)}<span>{viewport.label}</span>
          </button>
        ))}
      </div>
      <StableAddBlockControls
        data={data}
        dispatch={dispatch}
        selectedIndex={selectedIndex}
        selectedZone={selectedZone}
        disabled={editingDisabled}
      />
      <details className="g7pb-editor-more">
        <summary aria-label="편집 도구 더 보기"><MoreHorizontal size={17} aria-hidden="true" /></summary>
        <div>
          <span>화면 테마</span>
          <div className="g7pb-theme-switcher" role="group" aria-label="라이트·다크 테마 미리보기">
            <button type="button" aria-label="라이트 테마" aria-pressed={(data.root.props?.colorMode ?? 'light') === 'light'} disabled={editingDisabled} onClick={() => setColorMode('light')}><Sun size={15} aria-hidden="true" /></button>
            <button type="button" aria-label="다크 테마" aria-pressed={data.root.props?.colorMode === 'dark'} disabled={editingDisabled} onClick={() => setColorMode('dark')}><Moon size={15} aria-hidden="true" /></button>
            <button type="button" aria-label="기기 테마" aria-pressed={data.root.props?.colorMode === 'system'} disabled={editingDisabled} onClick={() => setColorMode('system')}><Monitor size={15} aria-hidden="true" /></button>
          </div>
          <span>페이지 효과</span>
          <div className="g7pb-motion-batch" role="group" aria-label="페이지 효과 일괄 설정">
            <button type="button" disabled={editingDisabled || contentLength === 0}
              data-testid="page-builder-auto-motion" onClick={() => dispatch(applyRecommendedMotions(data))}><Sparkles size={15} aria-hidden="true" /><span>추천 효과</span></button>
            <button type="button" disabled={editingDisabled || contentLength === 0}
              data-testid="page-builder-clear-motion" onClick={() => dispatch(clearMotions(data))}><Ban size={15} aria-hidden="true" /><span>효과 없음</span></button>
          </div>
        </div>
      </details>
    </div>
  );
}

export function ConnectedHeaderControls({
  editingDisabled,
  onViewportChange,
  viewportDisabled,
}: {
  editingDisabled: boolean;
  onViewportChange: (width: number | '100%') => void;
  viewportDisabled: boolean;
}): React.ReactElement {
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const selectedItemId = usePageBuilderPuck((state) => state.selectedItem?.props.id ?? null);
  const data = usePageBuilderPuck((state) => state.appState.data as PuckEditorData);
  const selectedIndex = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.index ?? null);
  const selectedZone = usePageBuilderPuck((state) => state.appState.ui.itemSelector?.zone ?? 'root:default-zone');
  const previousSelectedId = useRef<string | null>(null);
  const canvasUi = React.useContext(CanvasEditingUiContext);
  useEffect(() => {
    const previous = previousSelectedId.current;
    previousSelectedId.current = selectedItemId;
    // Outline navigation has no canvas pointer event. Retire its old element
    // target without discarding a fresh pointer selection for the new block.
    const selector = selectedIndex === null ? null : { index: selectedIndex, zone: selectedZone };
    if (previous !== selectedItemId && canvasUi?.selection
      && (!selectedItemId || !resolveEditorSelection(data, selector, canvasUi.selection.blockId))) {
      canvasUi.setSelection(null);
      canvasUi.setTextToolsOpen(false);
      canvasUi.setMediaDialogOpen(false);
      canvasUi.setRouteDialogOpen(false);
    }
  }, [selectedItemId, selectedIndex, selectedZone, data, canvasUi]);
  const contentLength = usePageBuilderPuck((state) => state.appState.data.content.length);
  const viewportState = usePageBuilderPuck((state) => state.appState.ui.viewports);

  useEffect(() => {
    onViewportChange(viewportState.current.width);
  }, [onViewportChange, viewportState.current.width]);

  return (
    <StableHeaderControls
      dispatch={dispatch}
      data={data}
      contentLength={contentLength}
      selectedIndex={selectedIndex}
      selectedZone={selectedZone}
      currentViewportWidth={viewportState.current.width}
      viewportState={viewportState}
      editingDisabled={editingDisabled}
      viewportDisabled={viewportDisabled}
      onViewportChange={onViewportChange}
    />
  );
}

export function PuckHeaderLayer({ children }: { children: React.ReactNode }): React.ReactElement {
  const policy = React.useContext(EditorViewportPolicyContext);
  const dispatch = usePageBuilderPuck((state) => state.dispatch);
  const leftSideBarVisible = usePageBuilderPuck((state) => state.appState.ui.leftSideBarVisible);
  const rightSideBarVisible = usePageBuilderPuck((state) => state.appState.ui.rightSideBarVisible);
  const previousHostSupported = useRef(policy.hostSupported);
  const pcPanels = useRef({ leftSideBarVisible: true, rightSideBarVisible: true });

  useEffect(() => {
    if (previousHostSupported.current === policy.hostSupported) return;
    previousHostSupported.current = policy.hostSupported;
    if (!policy.hostSupported) pcPanels.current = { leftSideBarVisible, rightSideBarVisible };
    dispatch({
      type: 'setUi',
      ui: policy.hostSupported ? pcPanels.current : { leftSideBarVisible: false, rightSideBarVisible: false },
      recordHistory: false,
    });
  }, [dispatch, leftSideBarVisible, policy.hostSupported, rightSideBarVisible]);

  return <div className="g7pb-puck-header-layer">
    {policy.canEdit ? null : <div
      className="g7pb-editor-mode-notice"
      data-testid="page-builder-editor-mode-notice"
      data-mode={policy.mode}
      role="status"
    >
      <strong>{PC_EDITOR_POLICY_NOTICE}</strong>
      <span>{policy.status}</span>
    </div>}
    {children}
  </div>;
}
