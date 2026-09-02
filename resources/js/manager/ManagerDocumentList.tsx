import React, { useEffect, useState } from 'react';
import { Archive, Copy, Download, ExternalLink, History, Home, MoreHorizontal, Pencil, Settings } from 'lucide-react';
import type { DocumentResource } from '../api/pageBuilderApi';
import type { useManagerDocuments } from './useManagerDocuments';
import { DOCUMENT_STATUS_LABELS, editorUrl, formatDocumentDate } from './managerDocumentPresentation';

export function ManagerDocumentList({ controller, message, onMetadata, onRevisions, onExport }: {
  controller: ReturnType<typeof useManagerDocuments>; message: string | null;
  onMetadata: (resource: DocumentResource) => void; onRevisions: (resource: DocumentResource) => void; onExport: (resource: DocumentResource) => void;
}): React.ReactElement {
  const { totalDocuments, documentFilter, setDocumentFilter, searchQuery, setSearchQuery, loading, visibleDocuments,
    setCreateDialogOpen, lifecycleBusy, restoreArchived, setPurgeDocument, setPurgeConfirmation,
    settingHomeId, toggleHome, setArchiveDocument, openDuplicateDialog } = controller;
  const [actionMenuDocumentId, setActionMenuDocumentId] = useState<string | null>(null);
  useEffect(() => {
    if (actionMenuDocumentId === null) {
      return undefined;
    }

    const closeOnPointerDown = (event: PointerEvent): void => {
      if (!(event.target instanceof Element) || !event.target.closest('.g7pb-document-actions-menu')) {
        setActionMenuDocumentId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setActionMenuDocumentId(null);
      }
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [actionMenuDocumentId]);

  return (
      <section className="g7pb-manager-workspace" aria-labelledby="g7pb-manager-heading">
        <div className="g7pb-manager-summary">
          <div>
            <p className="g7pb-kicker">독립 문서함</p>
            <h2 id="g7pb-manager-heading">페이지 빌더에서 만든 문서만 관리합니다.</h2>
            <p>G7 기본 페이지 관리는 변경하지 않습니다.</p>
          </div>
          <strong data-testid="page-builder-manager-count">{totalDocuments}<span>개 문서</span></strong>
        </div>

        <div className="g7pb-manager-tools" aria-label="문서 목록 도구">
          <div className="g7pb-manager-tabs" role="tablist" aria-label="문서 상태">
            <button type="button" role="tab" aria-selected={documentFilter === 'active'}
              data-testid="page-builder-manager-filter-active"
              onClick={() => setDocumentFilter('active')}>사용 중</button>
            <button type="button" role="tab" aria-selected={documentFilter === 'archived'}
              data-testid="page-builder-manager-filter-archived"
              onClick={() => setDocumentFilter('archived')}>보관함</button>
          </div>
          <label className="g7pb-manager-search">
            <span className="sr-only">문서 검색</span>
            <input type="search" value={searchQuery} placeholder="제목 또는 주소 검색"
              data-testid="page-builder-manager-search"
              onChange={(event) => setSearchQuery(event.target.value)} />
          </label>
        </div>

        {message && <div className="g7pb-manager-notice" role="alert">{message}</div>}

        {loading ? (
          <div className="g7pb-manager-loading" role="status">문서를 불러오는 중입니다.</div>
        ) : visibleDocuments.length === 0 ? (
          <div className="g7pb-manager-empty">
            <h3>{searchQuery ? '검색 결과가 없습니다.' : documentFilter === 'archived' ? '보관된 문서가 없습니다.' : '아직 만든 페이지가 없습니다.'}</h3>
            <p>{searchQuery ? '다른 제목이나 주소로 검색해 보세요.' : documentFilter === 'archived' ? '보관한 문서는 여기서 복원하거나 영구 삭제할 수 있습니다.' : '완성 블록을 조합할 첫 페이지를 시작하세요.'}</p>
            {!searchQuery && documentFilter === 'active' && (
              <button className="g7pb-button g7pb-button--primary" type="button"
                data-testid="page-builder-manager-empty-create" onClick={() => setCreateDialogOpen(true)}>
                첫 페이지 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="g7pb-document-list" data-testid="page-builder-document-list">
            <div className="g7pb-document-list__head" aria-hidden="true">
              <span>문서</span><span>상태</span><span>작업</span>
            </div>
            {visibleDocuments.map((resource) => (
              <article className={`g7pb-document-row${actionMenuDocumentId === resource.document.document_id ? ' is-actions-open' : ''}`}
                data-testid="page-builder-document-row"
                data-document-id={resource.document.document_id} key={resource.document.document_id}>
                <div className="g7pb-document-row__identity">
                  <h3>{resource.title}</h3>
                  <p>/{resource.document.slug}</p>
                  <small>생성 {formatDocumentDate(resource.created_at)} · 수정 {formatDocumentDate(resource.updated_at)}</small>
                </div>
                <div>
                  <span className={`g7pb-document-state is-${resource.status}`}>
                    {resource.is_home ? '홈' : DOCUMENT_STATUS_LABELS[resource.status]}
                  </span>
                  {resource.published_at && <small className="g7pb-document-published-at">발행 {formatDocumentDate(resource.published_at)}</small>}
                </div>
                <div className="g7pb-document-row__actions">
                  {resource.status === 'archived' ? (
                    <>
                      <button className="g7pb-button g7pb-button--quiet" type="button"
                        data-testid="page-builder-manager-restore-archived" disabled={lifecycleBusy}
                        onClick={() => void restoreArchived(resource)}>복원</button>
                      <button className="g7pb-button g7pb-button--danger" type="button"
                        data-testid="page-builder-manager-purge"
                        onClick={() => { setPurgeDocument(resource); setPurgeConfirmation(''); }}>영구 삭제</button>
                    </>
                  ) : (
                    <>
                      <a className="g7pb-button g7pb-button--primary" href={editorUrl(resource.document.document_id)}
                        data-testid="page-builder-manager-edit-link">
                        <Pencil size={15} aria-hidden="true" />
                        <span>편집</span>
                      </a>
                      {resource.public_url && (
                        <a className="g7pb-button g7pb-button--quiet" href={resource.public_url}
                          target="_blank" rel="noopener noreferrer"
                          data-testid="page-builder-manager-public-link">
                          <ExternalLink size={15} aria-hidden="true" />
                          <span>공개 보기</span>
                        </a>
                      )}
                      <div className="g7pb-document-actions-menu">
                        <button className="g7pb-button g7pb-button--quiet g7pb-icon-button" type="button"
                          aria-label={`${resource.title} 더보기`}
                          aria-expanded={actionMenuDocumentId === resource.document.document_id}
                          aria-controls={`g7pb-document-actions-${resource.document.document_id}`}
                          data-testid="page-builder-manager-more"
                          onClick={() => setActionMenuDocumentId((current) =>
                            current === resource.document.document_id ? null : resource.document.document_id)}>
                          <MoreHorizontal size={18} aria-hidden="true" />
                        </button>
                        {actionMenuDocumentId === resource.document.document_id && (
                          <div className="g7pb-document-actions-popover" role="menu"
                            id={`g7pb-document-actions-${resource.document.document_id}`}>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-duplicate"
                              onClick={() => { setActionMenuDocumentId(null); openDuplicateDialog(resource); }}>
                              <Copy size={15} aria-hidden="true" /><span>복제해서 새로 작성</span>
                            </button>
                            {resource.public_url && (
                              <button type="button" role="menuitem" data-testid="page-builder-manager-home"
                                disabled={settingHomeId !== null}
                                onClick={() => { setActionMenuDocumentId(null); void toggleHome(resource); }}>
                                <Home size={15} aria-hidden="true" />
                                <span>{resource.is_home ? '홈 해제' : '홈 지정'}</span>
                              </button>
                            )}
                            <button type="button" role="menuitem" data-testid="page-builder-manager-settings"
                              onClick={() => { setActionMenuDocumentId(null); onMetadata(resource); }}>
                              <Settings size={15} aria-hidden="true" /><span>설정</span>
                            </button>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-revisions"
                              onClick={() => { setActionMenuDocumentId(null); onRevisions(resource); }}>
                              <History size={15} aria-hidden="true" /><span>변경 기록</span>
                            </button>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-export-page-kit"
                              onClick={() => { setActionMenuDocumentId(null); onExport(resource); }}>
                              <Download size={15} aria-hidden="true" /><span>Page Kit 배포 ZIP</span>
                            </button>
                            <button type="button" role="menuitem" data-testid="page-builder-manager-archive"
                              onClick={() => { setActionMenuDocumentId(null); setArchiveDocument(resource); }}>
                              <Archive size={15} aria-hidden="true" /><span>보관함으로 이동</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

  );
}
