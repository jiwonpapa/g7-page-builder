import { Puck, type Config } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_AUTH_TOKEN_KEY, PageBuilderApiClient, type SitePartResource } from '../api/pageBuilderApi';
import { editorContextProps } from '../blocks/externalEditorData';
import { externalEditorComponents } from '../blocks/runtimeRegistry';
import { LAYOUT_SECTION_BLOCK_TYPE, type ElementAppearanceMap, type PageBuilderBlock, type PageBuilderDocument } from '../documents/types';
import { BLOCK_GALLERY_ITEMS, BlockCatalogContext, apiCatalogItemToGalleryItem, type BlockCatalogContextValue } from './BlockCatalogContext';
import type { BlockGalleryItem } from './blockGalleryModel';
import { PuckDrawerLibrary, PuckDrawerItem } from './BlockGalleryControls';
import { blockContainerClassName, mergeBlockContainerAppearance } from './blockAppearance';
import { ConnectedCanvasDialogs, ConnectedContextPanel } from './CanvasContextControls';
import { canvasContextRangeActive, canvasContextRangeAnchor, canvasContextSelection, INITIAL_CANVAS_CONTEXT_STATE, normalizeCanvasRangeAnchor, reduceCanvasContextState, type CanvasContextAction } from './canvasContextState';
import { CANVAS_ELEMENT_MESSAGE, CanvasBlockAppearanceContext, CanvasElementStylesContext, normalizeElementAppearanceMap, shouldAutoOpenCanvasTextTools, type CanvasElementSelection } from './canvasEditingContract';
import { ConnectedHeaderControls, PAGE_BUILDER_VIEWPORTS, PuckHeaderLayer } from './EditorHeaderControls';
import { EditorPortal } from './EditorPortal';
import { applyEditorContentPolicy, initialEditorCanvasWidth, PC_EDITOR_MIN_HOST_WIDTH, resolveEditorViewportPolicy, type EditorFieldContract } from './editorViewportPolicy';
import { FullSiteCanvasContext, type FullSiteCanvasValue } from './FullSiteCanvas';
import type { PageDesignProps } from './pageDesignTokens';
import { activateStructureEditing, asString, canonicalToPuck, idToUuid, puckBlockToCanonical } from './puckBlockCodec';
import { PuckDocumentBoundary, usePuckDocumentBoundary } from './PuckDocumentBoundary';
import { pageBuilderPuckConfig } from './puckEditorConfig';
import { CanvasEditingUiContext, EditorViewportPolicyContext, type CanvasEditingUiValue } from './puckEditorContexts';
import { editorItemLocations } from './puckEditorSelection';
import type { EditorComponents, PuckEditorData } from './puckEditorTypes';
import { responsiveClassName } from './responsiveBlockStyle';
import { RICH_TEXT_RANGE_STATE_MESSAGE } from './richTextEditing';
import { SectionPatternControls } from './SectionPatternControls';
import { SelectedBlockActionBar } from './SelectedBlockActionBar';
import { SitePartEditor } from './SitePartEditor';

export { BLOCK_GALLERY_WINDOW_SIZE } from './blockGalleryModel';
export { recommendedMotionPlan } from './blockMotionCommands';
export { PAGE_BUILDER_VIEWPORTS } from './EditorHeaderControls';
export { activateStructureEditing, canonicalToPuck, puckToCanonical } from './puckBlockCodec';
export type { PuckAdapterContext, PuckEditorSession } from './puckDocumentAdapter';
export { pageBuilderPuckConfig } from './puckEditorConfig';
export type { PuckEditorData } from './puckEditorTypes';
export { sanitizeRichTextForPreview } from './previewContent';

interface PuckEditorAdapterProps {
  document: PageBuilderDocument;
  revisionKey: number;
  disabled?: boolean;
  iframeEnabled?: boolean;
  onDirty?: () => void;
  onChange: (document: PageBuilderDocument) => void;
  onPublish: (document: PageBuilderDocument) => void | Promise<void>;
}

export function PuckEditorAdapter({
  document,
  revisionKey,
  disabled = false,
  iframeEnabled = true,
  onDirty,
  onChange,
  onPublish,
}: PuckEditorAdapterProps): React.ReactElement {
  const initialHostWidth = useMemo(() => (
    typeof window === 'undefined' ? PC_EDITOR_MIN_HOST_WIDTH : window.innerWidth
  ), []);
  const [hostWidth, setHostWidth] = useState(initialHostWidth);
  const [canvasViewportWidth, setCanvasViewportWidth] = useState<number | '100%'>(() => (
    initialEditorCanvasWidth(initialHostWidth)
  ));
  const viewportPolicy = useMemo(() => resolveEditorViewportPolicy({
    canvasWidth: canvasViewportWidth,
    disabled,
    hostWidth,
  }), [canvasViewportWidth, disabled, hostWidth]);
  const initialSession = useMemo(() => canonicalToPuck(document), [document.document_id, revisionKey]);
  const contextRef = useRef(initialSession.context);
  const { boundary, data, message: documentError, recovering } = usePuckDocumentBoundary(initialSession, {
    context: contextRef, canEdit: viewportPolicy.canEdit, onDirty, onChange,
  });
  const editingDisabled = !viewportPolicy.canEdit || recovering;
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [structureEditingEnabled, setStructureEditingEnabled] = useState(
    document.schema_version === 'g7-page-builder/v2',
  );
  const [structureDialogOpen, setStructureDialogOpen] = useState(false);
  const [structureActivationError, setStructureActivationError] = useState<string | null>(null);
  const runtimePuckConfig = useMemo(() => {
    const baseConfig = {
      ...pageBuilderPuckConfig,
      categories: {
        ...pageBuilderPuckConfig.categories,
        layout: {
          ...pageBuilderPuckConfig.categories?.layout,
          visible: structureEditingEnabled,
        },
      },
      components: {
        ...pageBuilderPuckConfig.components,
        ...externalEditorComponents(),
      },
    } as Config<EditorComponents, PageDesignProps>;
    if (!editingDisabled) return baseConfig;
    const components = Object.fromEntries(Object.entries(baseConfig.components).map(([type, candidate]) => {
      const component = candidate as typeof candidate & { fields?: Record<string, EditorFieldContract> };
      if (!component.fields) return [type, component];
      return [type, { ...component, fields: applyEditorContentPolicy(component.fields, false) }];
    })) as Config<EditorComponents, PageDesignProps>['components'];
    return { ...baseConfig, components };
  }, [structureEditingEnabled, editingDisabled]);
  const [catalogItems, setCatalogItems] = useState<ReadonlyArray<BlockGalleryItem>>(BLOCK_GALLERY_ITEMS);
  const [siteParts, setSiteParts] = useState<{ header: SitePartResource | null; footer: SitePartResource | null }>({ header: null, footer: null });
  const [sitePartMode, setSitePartMode] = useState<'header' | 'footer' | null>(null);
  const [canvasContextState, setCanvasContextState] = useState(INITIAL_CANVAS_CONTEXT_STATE);
  const canvasContextStateRef = useRef(INITIAL_CANVAS_CONTEXT_STATE);
  const [canvasMediaDialogOpen, setCanvasMediaDialogOpen] = useState(false);
  const [canvasRouteDialogOpen, setCanvasRouteDialogOpen] = useState(false);
  const [canvasTextToolsOpen, setCanvasTextToolsOpen] = useState(false);
  const heroFamilyCount = data.content.filter((block) =>
    block.type === 'Hero' || block.type === 'HeroSplit' || block.type === 'HeroSlider').length;
  const heroWarningKey = `g7pb:warning:${document.document_id}:hero-family:${heroFamilyCount}`;
  const [warningStateVersion, setWarningStateVersion] = useState(0);
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
  const heroWarningDismissed = useMemo(() => {
    if (heroFamilyCount <= 1 || typeof window === 'undefined') return false;
    try {
      return window.localStorage?.getItem(heroWarningKey) === 'dismissed';
    } catch {
      return false;
    }
  }, [heroFamilyCount, heroWarningKey, warningStateVersion]);

  const dismissHeroWarning = (): void => {
    try {
      window.localStorage?.setItem(heroWarningKey, 'dismissed');
    } catch {
      // Storage can be unavailable in hardened browsers; dismissal still lasts for this render.
    }
    setWarningStateVersion((version) => version + 1);
  };

  useEffect(() => {
    const updateHostWidth = (): void => setHostWidth(window.innerWidth);
    window.addEventListener('resize', updateHostWidth);
    return () => window.removeEventListener('resize', updateHostWidth);
  }, []);

  useEffect(() => {
    if (viewportPolicy.canEdit) return;
    transitionCanvasContext({ type: 'clear' });
    setCanvasMediaDialogOpen(false);
    setCanvasRouteDialogOpen(false);
    setCanvasTextToolsOpen(false);
  }, [transitionCanvasContext, viewportPolicy.canEdit]);

  useEffect(() => {
    const accept = (selection: CanvasElementSelection): void => {
      if (!viewportPolicy.canEdit) return;
      transitionCanvasContext({ type: 'selection.accept', selection });
      setCanvasMediaDialogOpen(false);
      setCanvasRouteDialogOpen(false);
      if (shouldAutoOpenCanvasTextTools(selection, 'selection')) {
        window.requestAnimationFrame(() => {
          if (!canvasContextRangeActive(canvasContextStateRef.current)) setCanvasTextToolsOpen(true);
        });
      } else {
        setCanvasTextToolsOpen(false);
      }
    };
    const acceptRangeState = (active: boolean, anchorValue: unknown = null): void => {
      if (!viewportPolicy.canEdit) return;
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
      window.requestAnimationFrame(() => {
        if (!canvasContextRangeActive(canvasContextStateRef.current)) setCanvasTextToolsOpen(true);
      });
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
      window.removeEventListener('message', fromMessage);
      window.removeEventListener(CANVAS_ELEMENT_MESSAGE, fromCustomEvent);
      window.removeEventListener(RICH_TEXT_RANGE_STATE_MESSAGE, fromRangeEvent);
    };
  }, [transitionCanvasContext, viewportPolicy.canEdit]);

  useEffect(() => {
    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || event.target.closest('[data-testid="page-builder-context-panel"]')) return;
      setCanvasTextToolsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
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
  }, []);

  useEffect(() => {
    contextRef.current = initialSession.context;
  }, [initialSession]);

  useEffect(() => {
    setStructureEditingEnabled(document.schema_version === 'g7-page-builder/v2');
    setStructureDialogOpen(false);
    setStructureActivationError(null);
  }, [document.document_id, revisionKey]);

  useEffect(() => {
    let active = true;
    try {
      if (!window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY)) return undefined;
    } catch {
      return undefined;
    }

    void api.listBlockCatalog({ locale: document.locale })
      .then((resource) => {
        if (!active) return;
        const items = resource.items
          .map((item) => apiCatalogItemToGalleryItem(item, document.locale))
          .filter((item): item is BlockGalleryItem => item !== null);
        if (items.length > 0) setCatalogItems(items);
      })
      .catch(() => {
        // The embedded builtin catalog remains available when an admin API request fails.
      });

    return () => {
      active = false;
    };
  }, [api, document.locale]);

  useEffect(() => {
    if (document.shell_mode !== 'builder' && document.shell_mode !== 'global') {
      setSiteParts({ header: null, footer: null });
      return undefined;
    }
    let active = true;
    void Promise.allSettled([api.getSitePart('header', document.locale), api.getSitePart('footer', document.locale)]).then(([header, footer]) => {
      if (!active) return;
      setSiteParts({
        header: header.status === 'fulfilled' ? header.value : null,
        footer: footer.status === 'fulfilled' ? footer.value : null,
      });
    });
    return () => { active = false; };
  }, [api, document.locale, document.shell_mode]);

  const toggleFavorite = React.useCallback(async (catalogId: string, favorite: boolean): Promise<void> => {
    await api.setBlockFavorite(catalogId, favorite);
    setCatalogItems((current) => current.map((item) => item.catalogId === catalogId ? { ...item, favorite } : item));
  }, [api]);
  const blockCatalogContext = useMemo<BlockCatalogContextValue>(() => ({
    items: catalogItems,
    toggleFavorite,
  }), [catalogItems, toggleFavorite]);
  const editSitePart = useCallback((kind: 'header' | 'footer'): void => {
    if (viewportPolicy.canEdit) setSitePartMode(kind);
  }, [viewportPolicy.canEdit]);
  const closeSitePartEditor = useCallback((): void => setSitePartMode(null), []);
  const refreshSitePart = useCallback((resource: SitePartResource): void => {
    setSiteParts((current) => ({ ...current, [resource.document.kind]: resource }));
  }, []);

  const handleViewportChange = useCallback((width: number | '100%'): void => {
    setCanvasViewportWidth(width);
  }, []);

  const enableStructureEditing = useCallback((): void => {
    try {
      const activated = activateStructureEditing(boundary.currentData(), contextRef.current);
      contextRef.current = activated.context;
      setStructureEditingEnabled(true);
      setStructureDialogOpen(false);
      setStructureActivationError(null);
      onDirty?.();
      onChange(activated.document);
    } catch (error) {
      setStructureActivationError(error instanceof Error
        ? `현재 문서는 구조 편집으로 전환할 수 없습니다. ${error.message}`
        : '현재 문서는 구조 편집으로 전환할 수 없습니다.');
    }
  }, [boundary, onChange, onDirty]);
  const resolvePatternSection = useCallback((block: PuckEditorData['content'][number]): PageBuilderBlock => {
    const section = puckBlockToCanonical(block, contextRef.current);
    if (section.type !== LAYOUT_SECTION_BLOCK_TYPE) {
      throw new Error('Section 전체만 내 패턴으로 저장할 수 있습니다.');
    }

    return section;
  }, []);

  const overrides = useMemo(() => ({
    header: PuckHeaderLayer,
    headerActions: () => <>
      <PuckDocumentBoundary boundary={boundary} />
      {!structureEditingEnabled && <button
        type="button"
        className="g7pb-button g7pb-button--quiet"
        data-testid="page-builder-enable-structure"
        disabled={editingDisabled}
        onClick={() => {
          setStructureActivationError(null);
          setStructureDialogOpen(true);
        }}
      >구조 편집 사용</button>}
      {structureEditingEnabled && <SectionPatternControls
        disabled={editingDisabled}
        resolveSection={resolvePatternSection}
      />}
      <ConnectedHeaderControls
        editingDisabled={editingDisabled}
        viewportDisabled={disabled}
        onViewportChange={handleViewportChange}
      />
      <ConnectedContextPanel disabled={editingDisabled} />
      <ConnectedCanvasDialogs disabled={editingDisabled} />
    </>,
    drawer: PuckDrawerLibrary,
    drawerItem: PuckDrawerItem,
    actionBar: (props: { children: React.ReactNode; label?: string; parentAction?: React.ReactNode }) => (
      <SelectedBlockActionBar {...props} disabled={editingDisabled} />
    ),
  }), [boundary, disabled, editingDisabled, handleViewportChange, resolvePatternSection, structureEditingEnabled]);

  const fullSiteCanvas = useMemo(() => ({
    locale: document.locale,
    shellMode: document.shell_mode ?? 'template',
    header: siteParts.header,
    footer: siteParts.footer,
    canEdit: viewportPolicy.canEdit,
    edit: editSitePart,
  } satisfies FullSiteCanvasValue), [document.locale, document.shell_mode, editSitePart, siteParts.footer, siteParts.header, viewportPolicy.canEdit]);
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

  if (sitePartMode) {
    return <SitePartEditor
      kind={sitePartMode}
      locale={document.locale}
      embedded
      iframeEnabled={iframeEnabled}
      onBack={closeSitePartEditor}
      onChanged={refreshSitePart}
    />;
  }

  return (
    <div
      className="g7pb-editor"
      data-testid="page-builder-editor"
      data-editing-mode={viewportPolicy.mode}
      data-host-editing-supported={viewportPolicy.hostSupported ? 'true' : 'false'}
      data-canvas-viewport={String(viewportPolicy.canvasWidth)}
      aria-busy={disabled || recovering}
    >
      {documentError && <div className="g7pb-notice" role="alert" data-testid="page-builder-document-error">{documentError}</div>}
      {heroFamilyCount > 1 && !heroWarningDismissed && (
        <div className="g7pb-editor-warning" role="status" data-testid="page-builder-hero-warning">
          <span>Hero 계열 블록이 {heroFamilyCount}개 있습니다. 사용할 수 있지만 첫 화면 집중도가 낮아질 수 있습니다.</span>
          <button
            type="button"
            aria-label="Hero 안내 닫기"
            data-testid="page-builder-hero-warning-dismiss"
            onClick={dismissHeroWarning}
          >
            닫기
          </button>
        </div>
      )}
      {structureDialogOpen && <EditorPortal>
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-structure-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-structure-heading">
            <p className="g7pb-kicker">문서 구조 버전 전환</p>
            <h2 id="g7pb-structure-heading">Section·Columns·Stack 구조 편집을 사용하시겠습니까?</h2>
            <p>기존 내용·SEO·공개 페이지는 유지됩니다. 동의하면 현재 초안이 v2로 전환되어 자동 저장 대상이 되며, 단순 편집만으로 v1으로 되돌아가지는 않습니다.</p>
            {structureActivationError && <p role="alert">{structureActivationError}</p>}
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                data-testid="page-builder-structure-cancel" onClick={() => setStructureDialogOpen(false)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-structure-confirm" onClick={enableStructureEditing}>구조 편집 사용</button>
            </div>
          </section>
        </div>
      </EditorPortal>}
      <BlockCatalogContext.Provider value={blockCatalogContext}>
        <EditorViewportPolicyContext.Provider value={viewportPolicy}>
        <FullSiteCanvasContext.Provider value={fullSiteCanvas}>
        <CanvasEditingUiContext.Provider value={canvasEditingUi}>
        <CanvasBlockAppearanceContext.Provider value={canvasBlockAppearances}>
        <CanvasElementStylesContext.Provider value={canvasElementStyles}>
        <Puck
          config={runtimePuckConfig}
          data={data}
          dictionary={{
            'field-richtext-bold': '선택한 글자 굵게',
            'field-richtext-italic': '선택한 글자 기울임',
            'field-richtext-underline': '선택한 글자 밑줄',
          }}
          height="100%"
          iframe={{ enabled: iframeEnabled, syncHostStyles: true, waitForStyles: false }}
          viewports={PAGE_BUILDER_VIEWPORTS}
          ui={{
            leftSideBarVisible: viewportPolicy.hostSupported,
            rightSideBarVisible: viewportPolicy.hostSupported,
            viewports: {
              current: { width: canvasViewportWidth, height: 'auto' },
              controlsVisible: false,
              options: PAGE_BUILDER_VIEWPORTS,
            },
          }}
          permissions={{ edit: !editingDisabled, insert: !editingDisabled, delete: !editingDisabled, duplicate: !editingDisabled, drag: !editingDisabled }}
          overrides={overrides}
          headerTitle="페이지 블록"
          headerPath={document.slug}
          onAction={boundary.onAction}
          onChange={boundary.onChange}
          onPublish={(nextData) => {
            if (editingDisabled) return;
            const candidate = boundary.acceptForPublish(nextData);
            if (candidate) return onPublish(candidate);
          }}
        />
        </CanvasElementStylesContext.Provider>
        </CanvasBlockAppearanceContext.Provider>
        </CanvasEditingUiContext.Provider>
        </FullSiteCanvasContext.Provider>
        </EditorViewportPolicyContext.Provider>
      </BlockCatalogContext.Provider>
    </div>
  );
}
