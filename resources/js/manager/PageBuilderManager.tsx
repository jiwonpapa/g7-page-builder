import React, { useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Inbox, LayoutTemplate, PanelTop } from 'lucide-react';
import { PageBuilderApiClient, PageBuilderApiError } from '../api/pageBuilderApi';
import { useManagerStore } from './useManagerStore';
import { ManagerStoreDialogs } from './ManagerStoreDialogs';
import { useManagerBlockPacks } from './useManagerBlockPacks';
import { ManagerBlockPacksDialog } from './ManagerBlockPacksDialog';
import { ManagerInboxDialog } from './ManagerInboxDialog';
import { useManagerDocuments } from './useManagerDocuments';
import { ManagerDocumentList } from './ManagerDocumentList';
import { ManagerDocumentDialogs } from './ManagerDocumentDialogs';
import { useManagerMetadata } from './useManagerMetadata';
import { ManagerMetadataDialog } from './ManagerMetadataDialog';
import { useManagerRevisions } from './useManagerRevisions';
import { ManagerRevisionsDialogs } from './ManagerRevisionsDialogs';
import { editorUrl, formatRevisionDate } from './managerDocumentPresentation';

interface PageBuilderManagerOptions { locale?: string; }
const roots = new WeakMap<Element, Root>();

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) {
    return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  }

  return error instanceof Error ? error.message : '문서 목록을 불러오지 못했습니다.';
}

export function PageBuilderManager({ locale = 'ko' }: PageBuilderManagerOptions): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [message, setMessage] = useState<string | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const reportError = React.useCallback((error: unknown): void => setMessage(errorMessage(error)), []);
  const openCreatedDocument = React.useCallback((id: string): void => window.location.assign(editorUrl(id)), []);
  const documents = useManagerDocuments({ api, locale, onError: reportError, onMessage: setMessage, onCreated: openCreatedDocument });
  const packs = useManagerBlockPacks({ api, onError: reportError, onMessage: setMessage });
  const store = useManagerStore({ api, onError: reportError, onMessage: setMessage, onCreated: openCreatedDocument, onPackInstalled: packs.loadBlockPacks });
  const metadata = useManagerMetadata({ api, documents: documents.documents, onUpdated: documents.replaceResource, onError: reportError, onMessage: setMessage });
  const revisions = useManagerRevisions({ api, documents: documents.documents, onUpdated: documents.replaceResource, onError: reportError, onMessage: setMessage });
  const { loading, creating, setCreateDialogOpen } = documents;
  return (
    <main className="g7pb-root g7pb-manager-root" data-testid="page-builder-manager-app" aria-busy={loading || creating}>
      <header className="g7pb-manager-header">
        <div className="g7pb-manager-header__identity">
          <span className="g7pb-product-mark" aria-hidden="true">G7</span>
          <div>
            <p>Page Builder</p>
            <h1>페이지 빌더 문서</h1>
          </div>
        </div>
        <div className="g7pb-manager-header__actions">
          <a className="g7pb-button g7pb-button--quiet" href="/admin">G7 관리자</a>
          <button className="g7pb-button g7pb-button--primary" type="button"
            data-testid="page-builder-manager-page-kits" onClick={store.openPageKits}>
            <LayoutTemplate size={17} aria-hidden="true" /> 페이지 킷
          </button>
          <button className="g7pb-button g7pb-button--quiet" type="button" data-testid="page-builder-manager-inbox" onClick={() => setInboxOpen(true)}>
            <Inbox size={17} aria-hidden="true" /> 문의함
          </button>
          <button className="g7pb-button g7pb-button--quiet" type="button"
            data-testid="page-builder-manager-block-packs" onClick={packs.openBlockPacks}>
            블록 라이브러리
          </button>
          <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-manager-site-parts"
            href="/modules/jiwonpapa-page_builder/admin/site-parts"><PanelTop size={17} /> 헤더·푸터</a>
          <button className="g7pb-button g7pb-button--quiet" type="button"
            data-testid="page-builder-manager-create" onClick={() => setCreateDialogOpen(true)}>
            빈 페이지
          </button>
        </div>
      </header>

      <ManagerDocumentList controller={documents} message={message} onMetadata={metadata.openMetadataDialog}
        onRevisions={revisions.openRevisions} onExport={store.openPageKitExport} />
      <ManagerInboxDialog api={api} open={inboxOpen} onClose={() => setInboxOpen(false)} onError={reportError} formatDate={formatRevisionDate} />
      <ManagerDocumentDialogs controller={documents} onPageKits={store.openPageKits} />
      <ManagerMetadataDialog controller={metadata} />
      <ManagerBlockPacksDialog controller={packs} />
      <ManagerStoreDialogs controller={store} />
      <ManagerRevisionsDialogs controller={revisions} />
    </main>
  );
}

export function mountPageBuilderManager(
  element: Element,
  options: PageBuilderManagerOptions = {},
): () => void {
  roots.get(element)?.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<PageBuilderManager {...options} />);

  return () => {
    if (roots.get(element) !== root) return;
    root.unmount();
    roots.delete(element);
  };
}

export function discoverPageBuilderManagers(scope: ParentNode = document): Element[] {
  return Array.from(scope.querySelectorAll('[data-g7pb-manager], #g7pb-manager'));
}
