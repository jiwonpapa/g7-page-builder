import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';
import React, { useMemo } from 'react';
import { BlockCatalogContext } from './BlockCatalogContext';
import { PuckDrawerLibrary, PuckDrawerItem } from './BlockGalleryControls';
import { ConnectedCanvasDialogs, ConnectedContextPanel } from './CanvasContextControls';
import { CanvasBlockAppearanceContext, CanvasElementStylesContext } from './canvasEditingContract';
import { ConnectedHeaderControls, PAGE_BUILDER_VIEWPORTS, PuckHeaderLayer } from './EditorHeaderControls';
import { EditorPortal } from './EditorPortal';
import { FullSiteCanvasContext, type FullSiteCanvasValue } from './FullSiteCanvas';
import { PuckDocumentBoundary } from './PuckDocumentBoundary';
import { createRuntimePuckConfig } from './puckEditorConfig';
import { CanvasEditingUiContext, EditorViewportPolicyContext } from './puckEditorContexts';
import type { PuckEditorAdapterProps } from './puckEditorTypes';
import { SectionPatternControls } from './SectionPatternControls';
import { SelectedBlockActionBar } from './SelectedBlockActionBar';
import { SitePartEditor } from './SitePartEditor';
import { useCanvasEditingUi } from './useCanvasEditingUi';
import { useEditorViewport } from './useEditorViewport';
import { usePageBuilderResources } from './usePageBuilderResources';
import { usePageBuilderSession } from './usePageBuilderSession';

export { BLOCK_GALLERY_WINDOW_SIZE } from './blockGalleryModel';
export { recommendedMotionPlan } from './blockMotionCommands';
export { PAGE_BUILDER_VIEWPORTS } from './EditorHeaderControls';
export { activateStructureEditing, canonicalToPuck, puckToCanonical } from './puckBlockCodec';
export type { PuckAdapterContext, PuckEditorSession } from './puckDocumentAdapter';
export { pageBuilderPuckConfig } from './puckEditorConfig';
export type { PuckEditorData } from './puckEditorTypes';
export { sanitizeRichTextForPreview } from './previewContent';

export function PuckEditorAdapter(props: PuckEditorAdapterProps): React.ReactElement {
  return <PageBuilderEditorSession key={`${props.document.document_id}:${props.revisionKey}`} {...props} />;
}

function PageBuilderEditorSession({ document, disabled = false, iframeEnabled = true, onDirty, onChange, onPublish }: PuckEditorAdapterProps): React.ReactElement {
  const { viewportPolicy, canvasViewportWidth, handleViewportChange } = useEditorViewport(disabled);
  const { boundary, data, documentError, recovering, editingDisabled, structureEditingEnabled,
    structureDialogOpen, setStructureDialogOpen, structureActivationError, setStructureActivationError,
    enableStructureEditing, resolvePatternSection, heroFamilyCount, heroWarningDismissed, dismissHeroWarning,
  } = usePageBuilderSession({ document, canEdit: viewportPolicy.canEdit, onDirty, onChange });
  const runtimePuckConfig = useMemo(() => createRuntimePuckConfig(structureEditingEnabled, editingDisabled), [structureEditingEnabled, editingDisabled]);
  const { blockCatalogContext, siteParts, sitePartMode, editSitePart, closeSitePartEditor, refreshSitePart,
  } = usePageBuilderResources(document.locale, document.shell_mode, viewportPolicy.canEdit);
  const { canvasEditingUi, canvasElementStyles, canvasBlockAppearances } = useCanvasEditingUi(data, viewportPolicy.canEdit);

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
