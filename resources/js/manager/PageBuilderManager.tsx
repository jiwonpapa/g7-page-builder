import React, { useEffect, useMemo, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  ADMIN_AUTH_TOKEN_KEY,
  PAGE_BUILDER_EDITOR_PATH,
  PageBuilderApiClient,
  PageBuilderApiError,
  buildAdminLoginUrl,
} from '../api/pageBuilderApi';
import type { DocumentResource, RevisionSummary, SiteShellResource } from '../documents/types';

interface PageBuilderManagerOptions {
  locale?: string;
}

const roots = new WeakMap<Element, Root>();

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function hasAdminToken(): boolean {
  try {
    return Boolean(window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY));
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) {
    return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  }

  return error instanceof Error ? error.message : '문서 목록을 불러오지 못했습니다.';
}

function editorUrl(documentId: string): string {
  return `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(documentId)}`;
}

function formatRevisionDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

function formatDocumentDate(value: string | null): string {
  return value ? formatRevisionDate(value) : '기록 없음';
}

const DOCUMENT_STATUS_LABELS: Record<DocumentResource['status'], string> = {
  draft: '초안',
  published: '발행됨',
  published_with_changes: '발행 후 변경',
  archived: '보관됨',
};

export function PageBuilderManager({ locale = 'ko' }: PageBuilderManagerOptions): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [documents, setDocuments] = useState<DocumentResource[]>([]);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createShellMode, setCreateShellMode] = useState<'global' | 'none'>('global');
  const [creating, setCreating] = useState(false);
  const [metadataDocument, setMetadataDocument] = useState<DocumentResource | null>(null);
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataSlug, setMetadataSlug] = useState('');
  const [metadataShellMode, setMetadataShellMode] = useState<'global' | 'none'>('global');
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [revisionDocument, setRevisionDocument] = useState<DocumentResource | null>(null);
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [currentRevision, setCurrentRevision] = useState(0);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [previewingRevision, setPreviewingRevision] = useState<number | null>(null);
  const [restoreCandidate, setRestoreCandidate] = useState<RevisionSummary | null>(null);
  const [restoringRevision, setRestoringRevision] = useState(false);
  const [unpublishDocument, setUnpublishDocument] = useState<DocumentResource | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const [settingHomeId, setSettingHomeId] = useState<string | null>(null);
  const [documentFilter, setDocumentFilter] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveDocument, setArchiveDocument] = useState<DocumentResource | null>(null);
  const [purgeDocument, setPurgeDocument] = useState<DocumentResource | null>(null);
  const [purgeConfirmation, setPurgeConfirmation] = useState('');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [siteShellOpen, setSiteShellOpen] = useState(false);
  const [siteShell, setSiteShell] = useState<SiteShellResource | null>(null);
  const [siteShellLoading, setSiteShellLoading] = useState(false);
  const [siteShellSaving, setSiteShellSaving] = useState(false);
  const [siteShellLogoUploading, setSiteShellLogoUploading] = useState(false);

  const loadDocuments = React.useCallback(async (status: 'active' | 'archived'): Promise<void> => {
    const resource = await api.listDocuments(1, 100, status);
    setDocuments(resource.items);
    setTotalDocuments(resource.pagination.total);
  }, [api]);

  useEffect(() => {
    if (!hasAdminToken()) {
      window.location.assign(buildAdminLoginUrl(currentPath()));
      return;
    }

    let active = true;
    setLoading(true);
    void api.listDocuments(1, 100, documentFilter)
      .then((resource) => {
        if (active) {
          setDocuments(resource.items);
          setTotalDocuments(resource.pagination.total);
          setMessage(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(errorMessage(error));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [api, documentFilter]);

  const visibleDocuments = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ko');
    if (!query) {
      return documents;
    }

    return documents.filter((resource) =>
      resource.title.toLocaleLowerCase('ko').includes(query)
      || resource.document.slug.toLocaleLowerCase('ko').includes(query));
  }, [documents, searchQuery]);

  const createDocument = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const title = createTitle.trim();
    const slug = createSlug.trim();

    if (!title) {
      setMessage('페이지 제목을 입력해 주세요.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      const resource = await api.createDocument({ title, slug, locale, shell_mode: createShellMode });
      window.location.assign(editorUrl(resource.document.document_id));
    } catch (error) {
      setMessage(errorMessage(error));
      setCreating(false);
    }
  };

  const openMetadataDialog = (resource: DocumentResource): void => {
    setMetadataDocument(resource);
    setMetadataTitle(resource.title);
    setMetadataSlug(resource.document.slug);
    setMetadataShellMode(resource.document.shell_mode ?? 'global');
    setMessage(null);
  };

  const updateMetadata = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!metadataDocument) {
      return;
    }

    const title = metadataTitle.trim();
    const slug = metadataSlug.trim();
    if (!title) {
      setMessage('페이지 제목을 입력해 주세요.');
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setMessage('슬러그는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.');
      return;
    }

    setSavingMetadata(true);
    setMessage(null);
    try {
      const updated = await api.updateDocument(metadataDocument.document.document_id, {
        title,
        slug,
        locale: metadataDocument.document.locale,
        shell_mode: metadataShellMode,
        expected_lock_version: metadataDocument.lock_version,
      });
      setDocuments((current) => current.map((resource) =>
        resource.document.document_id === updated.document.document_id ? updated : resource));
      setMetadataDocument(null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSavingMetadata(false);
    }
  };

  const openSiteShell = async (): Promise<void> => {
    setSiteShellOpen(true);
    setSiteShellLoading(true);
    setMessage(null);
    try {
      setSiteShell(await api.getSiteShell(locale));
    } catch (error) {
      setMessage(errorMessage(error));
      setSiteShellOpen(false);
    } finally {
      setSiteShellLoading(false);
    }
  };

  const saveSiteShell = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!siteShell) return;
    setSiteShellSaving(true);
    setMessage(null);
    try {
      setSiteShell(await api.saveSiteShell(siteShell, siteShell.lock_version));
      setSiteShellOpen(false);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSiteShellSaving(false);
    }
  };

  const updateNavigation = (index: number, field: 'label' | 'url', value: string): void => {
    setSiteShell((current) => current ? {
      ...current,
      navigation: current.navigation.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    } : current);
  };

  const uploadSiteLogo = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !siteShell) return;
    setSiteShellLogoUploading(true);
    setMessage(null);
    try {
      const asset = await api.uploadMedia(file);
      setSiteShell((current) => current ? { ...current, logo_url: asset.url } : current);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSiteShellLogoUploading(false);
    }
  };

  const loadRevisions = async (resource: DocumentResource): Promise<void> => {
    setLoadingRevisions(true);
    setMessage(null);
    try {
      const history = await api.listRevisions(resource.document.document_id);
      setRevisions(history.items);
      setCurrentRevision(history.current_revision);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoadingRevisions(false);
    }
  };

  const openRevisions = (resource: DocumentResource): void => {
    setRevisionDocument(resource);
    setRevisions([]);
    setCurrentRevision(resource.revision);
    void loadRevisions(resource);
  };

  const previewRevision = async (revision: number): Promise<void> => {
    if (!revisionDocument) {
      return;
    }

    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = '미리보기 준비 중';
      previewWindow.document.body.textContent = '리비전 미리보기를 준비하고 있습니다.';
    }

    setPreviewingRevision(revision);
    setMessage(null);
    try {
      const ticket = await api.createRevisionPreview(
        revisionDocument.document.document_id,
        revision,
      );
      if (previewWindow) {
        previewWindow.location.replace(ticket.preview_url);
      } else {
        window.location.assign(ticket.preview_url);
      }
    } catch (error) {
      previewWindow?.close();
      setMessage(errorMessage(error));
    } finally {
      setPreviewingRevision(null);
    }
  };

  const restoreRevision = async (): Promise<void> => {
    if (!revisionDocument || !restoreCandidate) {
      return;
    }

    setRestoringRevision(true);
    setMessage(null);
    try {
      const restored = await api.restoreRevision(
        revisionDocument.document.document_id,
        restoreCandidate.revision,
        revisionDocument.lock_version,
      );
      setDocuments((current) => current.map((resource) =>
        resource.document.document_id === restored.document.document_id ? restored : resource));
      setRevisionDocument(restored);
      setRestoreCandidate(null);
      await loadRevisions(restored);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setRestoringRevision(false);
    }
  };

  const confirmUnpublish = async (): Promise<void> => {
    if (!unpublishDocument) {
      return;
    }

    setUnpublishing(true);
    setMessage(null);
    try {
      const updated = await api.unpublishDocument(
        unpublishDocument.document.document_id,
        unpublishDocument.lock_version,
      );
      setDocuments((current) => current.map((resource) =>
        resource.document.document_id === updated.document.document_id ? updated : resource));
      if (metadataDocument?.document.document_id === updated.document.document_id) {
        setMetadataDocument(updated);
      }
      setUnpublishDocument(null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setUnpublishing(false);
    }
  };

  const toggleHome = async (resource: DocumentResource): Promise<void> => {
    setSettingHomeId(resource.document.document_id);
    setMessage(null);
    try {
      await api.setHomeDocument(
        resource.document.document_id,
        !resource.is_home,
        resource.lock_version,
      );
      const refreshed = await api.listDocuments(1, 100, documentFilter);
      setDocuments(refreshed.items);
      setTotalDocuments(refreshed.pagination.total);
      setMetadataDocument((current) => current
        ? refreshed.items.find((item) => item.document.document_id === current.document.document_id) ?? null
        : null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSettingHomeId(null);
    }
  };

  const confirmArchive = async (): Promise<void> => {
    if (!archiveDocument) {
      return;
    }

    setLifecycleBusy(true);
    setMessage(null);
    try {
      await api.archiveDocument(archiveDocument.document.document_id, archiveDocument.lock_version);
      const archivedId = archiveDocument.document.document_id;
      setArchiveDocument(null);
      setDocuments((current) => current.filter((resource) => resource.document.document_id !== archivedId));
      setTotalDocuments((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const restoreArchived = async (resource: DocumentResource): Promise<void> => {
    setLifecycleBusy(true);
    setMessage(null);
    try {
      await api.restoreArchivedDocument(resource.document.document_id, resource.lock_version);
      setDocuments((current) => current.filter((item) => item.document.document_id !== resource.document.document_id));
      setTotalDocuments((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

  const confirmPurge = async (): Promise<void> => {
    if (!purgeDocument || purgeConfirmation !== purgeDocument.document.slug) {
      return;
    }

    setLifecycleBusy(true);
    setMessage(null);
    try {
      await api.purgeDocument(
        purgeDocument.document.document_id,
        purgeDocument.lock_version,
        purgeConfirmation,
      );
      const purgedId = purgeDocument.document.document_id;
      setPurgeDocument(null);
      setPurgeConfirmation('');
      setDocuments((current) => current.filter((resource) => resource.document.document_id !== purgedId));
      setTotalDocuments((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLifecycleBusy(false);
    }
  };

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
          <button className="g7pb-button g7pb-button--quiet" type="button"
            data-testid="page-builder-manager-site-shell" onClick={() => void openSiteShell()}>
            공통 메뉴
          </button>
          <button className="g7pb-button g7pb-button--primary" type="button"
            data-testid="page-builder-manager-create" onClick={() => setCreateDialogOpen(true)}>
            새 페이지
          </button>
        </div>
      </header>

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
              <article className="g7pb-document-row" data-testid="page-builder-document-row"
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
                  {resource.public_url && (
                    <a href={resource.public_url} target="_blank" rel="noopener noreferrer"
                      data-testid="page-builder-manager-public-link">공개 ↗</a>
                  )}
                  {resource.public_url && (
                    <button className="g7pb-button g7pb-button--quiet" type="button"
                      data-testid="page-builder-manager-home"
                      disabled={settingHomeId !== null}
                      onClick={() => void toggleHome(resource)}>
                      {resource.is_home ? '홈 해제' : '홈 지정'}
                    </button>
                  )}
                  <button className="g7pb-button g7pb-button--quiet" type="button"
                    data-testid="page-builder-manager-settings"
                    onClick={() => openMetadataDialog(resource)}>설정</button>
                  <button className="g7pb-button g7pb-button--quiet" type="button"
                    data-testid="page-builder-manager-revisions"
                    onClick={() => openRevisions(resource)}>기록</button>
                  <a className="g7pb-button g7pb-button--quiet" href={editorUrl(resource.document.document_id)}
                    data-testid="page-builder-manager-edit-link">편집</a>
                      <button className="g7pb-button g7pb-button--quiet" type="button"
                        data-testid="page-builder-manager-archive"
                        onClick={() => setArchiveDocument(resource)}>보관</button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {createDialogOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-create-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-manager-create-heading">
            <p className="g7pb-kicker">새 문서</p>
            <h2 id="g7pb-manager-create-heading">페이지 기본 정보</h2>
            <form onSubmit={(event) => void createDocument(event)}>
              <label>
                페이지 제목
                <input data-testid="page-builder-manager-title-input" value={createTitle} required autoFocus
                  onChange={(event) => setCreateTitle(event.target.value)} />
              </label>
              <label>
                주소 슬러그
                <span>영문 소문자, 숫자, 하이픈</span>
                <input data-testid="page-builder-manager-slug-input" value={createSlug} required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => setCreateSlug(event.target.value.toLowerCase())} />
              </label>
              <label className="g7pb-choice-row">
                <input type="checkbox" checked={createShellMode === 'global'}
                  data-testid="page-builder-manager-shell-mode"
                  onChange={(event) => setCreateShellMode(event.target.checked ? 'global' : 'none')} />
                공통 Header·Footer 표시
                <span>인트로·캠페인 페이지는 끌 수 있습니다.</span>
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  onClick={() => setCreateDialogOpen(false)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-create-confirm" disabled={creating}>
                  {creating ? '만드는 중' : '편집 시작'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {metadataDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-metadata-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-manager-metadata-heading">
            <p className="g7pb-kicker">문서 설정</p>
            <h2 id="g7pb-manager-metadata-heading">페이지 기본 정보 수정</h2>
            <form onSubmit={(event) => void updateMetadata(event)}>
              <label>
                페이지 제목
                <input data-testid="page-builder-manager-metadata-title" value={metadataTitle} required autoFocus
                  onChange={(event) => setMetadataTitle(event.target.value)} />
              </label>
              <label>
                주소 슬러그
                <span>재발행 전에는 기존 공개 주소와 발행본이 유지됩니다.</span>
                <input data-testid="page-builder-manager-metadata-slug" value={metadataSlug} required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => setMetadataSlug(event.target.value.toLowerCase())} />
              </label>
              <label className="g7pb-choice-row">
                <input type="checkbox" checked={metadataShellMode === 'global'}
                  data-testid="page-builder-manager-metadata-shell-mode"
                  onChange={(event) => setMetadataShellMode(event.target.checked ? 'global' : 'none')} />
                공통 Header·Footer 표시
                <span>끄면 이 페이지는 콘텐츠만 표시됩니다.</span>
              </label>
              <div className="g7pb-dialog__actions">
                {metadataDocument.public_url && (
                  <button type="button" className="g7pb-button g7pb-button--danger"
                    data-testid="page-builder-manager-unpublish"
                    onClick={() => setUnpublishDocument(metadataDocument)}>공개 해제</button>
                )}
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  onClick={() => setMetadataDocument(null)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-metadata-save" disabled={savingMetadata}>
                  {savingMetadata ? '저장 중' : '초안 정보 저장'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {siteShellOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-site-shell-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide g7pb-site-shell-dialog" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-site-shell-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">Global Site Shell</p>
                <h2 id="g7pb-site-shell-heading">공통 Header·Footer와 메뉴</h2>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setSiteShellOpen(false)}>닫기</button>
            </div>
            {siteShellLoading || !siteShell ? (
              <div className="g7pb-manager-loading" role="status">공통 메뉴를 불러오는 중입니다.</div>
            ) : (
              <form onSubmit={(event) => void saveSiteShell(event)}>
                <div className="g7pb-site-shell-grid">
                  <label>사이트 이름
                    <input value={siteShell.brand_name} required maxLength={120} data-testid="page-builder-site-shell-brand"
                      onChange={(event) => setSiteShell({ ...siteShell, brand_name: event.target.value })} />
                  </label>
                  <div className="g7pb-site-shell-logo-field">
                    <label>로고 이미지 URL
                      <input value={siteShell.logo_url} placeholder="비워두면 사이트 이름 표시"
                        onChange={(event) => setSiteShell({ ...siteShell, logo_url: event.target.value })} />
                    </label>
                    <label className="g7pb-site-shell-upload">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only"
                        data-testid="page-builder-site-shell-logo-upload" onChange={(event) => void uploadSiteLogo(event)} />
                      {siteShellLogoUploading ? '업로드 중' : '이미지 직접 업로드'}
                    </label>
                  </div>
                  <label>홈 연결 주소
                    <input value={siteShell.home_url} required
                      onChange={(event) => setSiteShell({ ...siteShell, home_url: event.target.value })} />
                  </label>
                  <label>Header 스타일
                    <select className="g7pb-field-control" value={siteShell.header_variant}
                      onChange={(event) => setSiteShell({ ...siteShell, header_variant: event.target.value as 'solid' | 'transparent' })}>
                      <option value="solid">기본 배경</option>
                      <option value="transparent">첫 화면 위 투명</option>
                    </select>
                  </label>
                </div>

                <div className="g7pb-site-shell-section">
                  <div className="g7pb-site-shell-section__heading">
                    <div><strong>메뉴 항목</strong><span>데스크톱과 모바일 메뉴가 같은 순서를 사용합니다.</span></div>
                    <button type="button" className="g7pb-button g7pb-button--quiet"
                      disabled={siteShell.navigation.length >= 10}
                      data-testid="page-builder-site-shell-add-menu"
                      onClick={() => setSiteShell({ ...siteShell, navigation: [...siteShell.navigation, { label: '새 메뉴', url: '/' }] })}>
                      항목 추가
                    </button>
                  </div>
                  <div className="g7pb-site-shell-navigation">
                    {siteShell.navigation.map((item, index) => (
                      <div className="g7pb-site-shell-navigation__item" key={`${index}-${item.label}`}>
                        <span>{index + 1}</span>
                        <input aria-label={`${index + 1}번 메뉴 이름`} value={item.label} required maxLength={80}
                          onChange={(event) => updateNavigation(index, 'label', event.target.value)} />
                        <input aria-label={`${index + 1}번 메뉴 주소`} value={item.url} required
                          onChange={(event) => updateNavigation(index, 'url', event.target.value)} />
                        <button type="button" aria-label={`${item.label} 메뉴 삭제`}
                          onClick={() => setSiteShell({ ...siteShell, navigation: siteShell.navigation.filter((_, itemIndex) => itemIndex !== index) })}>×</button>
                      </div>
                    ))}
                    {siteShell.navigation.length === 0 && <p>메뉴가 없습니다. 항목을 추가해 주세요.</p>}
                  </div>
                </div>

                <div className="g7pb-site-shell-grid">
                  <label>강조 버튼 문구
                    <input value={siteShell.cta?.label ?? ''} placeholder="예: 문의하기"
                      onChange={(event) => setSiteShell({ ...siteShell, cta: event.target.value ? { label: event.target.value, url: siteShell.cta?.url ?? '/' } : null })} />
                  </label>
                  <label>강조 버튼 주소
                    <input value={siteShell.cta?.url ?? ''} disabled={!siteShell.cta}
                      onChange={(event) => setSiteShell({ ...siteShell, cta: siteShell.cta ? { ...siteShell.cta, url: event.target.value } : null })} />
                  </label>
                  <label className="g7pb-choice-row">
                    <input type="checkbox" checked={siteShell.sticky}
                      onChange={(event) => setSiteShell({ ...siteShell, sticky: event.target.checked })} />
                    스크롤할 때 Header 고정
                  </label>
                  <label className="g7pb-choice-row">
                    <input type="checkbox" checked={siteShell.show_footer_navigation}
                      onChange={(event) => setSiteShell({ ...siteShell, show_footer_navigation: event.target.checked })} />
                    Footer에 메뉴 반복 표시
                  </label>
                </div>
                <label>Footer 문구
                  <input value={siteShell.footer_text} maxLength={300}
                    onChange={(event) => setSiteShell({ ...siteShell, footer_text: event.target.value })} />
                </label>
                <div className="g7pb-dialog__actions">
                  <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setSiteShellOpen(false)}>취소</button>
                  <button type="submit" className="g7pb-button g7pb-button--primary"
                    data-testid="page-builder-site-shell-save" disabled={siteShellSaving}>
                    {siteShellSaving ? '저장 중' : '공통 메뉴 저장'}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}

      {revisionDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-revisions-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-manager-revisions-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">리비전 기록</p>
                <h2 id="g7pb-manager-revisions-heading">{revisionDocument.title}</h2>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setRevisionDocument(null)}>닫기</button>
            </div>
            <p className="g7pb-revision-help">복원은 과거 상태를 새 초안 리비전으로 복사합니다. 현재 공개본은 재발행 전까지 유지됩니다.</p>
            {loadingRevisions ? (
              <div className="g7pb-revision-loading" role="status">리비전을 불러오는 중입니다.</div>
            ) : (
              <div className="g7pb-revision-list" data-testid="page-builder-revision-list">
                {revisions.map((revision) => (
                  <article className="g7pb-revision-row" data-testid="page-builder-revision-row"
                    data-revision={revision.revision} key={revision.revision}>
                    <div className="g7pb-revision-row__number">
                      <strong>v{revision.revision}</strong>
                      {revision.revision === currentRevision && <span>현재 초안</span>}
                    </div>
                    <div className="g7pb-revision-row__meta">
                      <strong>{revision.title}</strong>
                      <span>/{revision.slug} · {revision.block_count}개 블록 · {formatRevisionDate(revision.created_at)}</span>
                    </div>
                    <div className="g7pb-revision-row__actions">
                      <button type="button" className="g7pb-button g7pb-button--quiet"
                        data-testid="page-builder-revision-preview"
                        disabled={previewingRevision !== null}
                        onClick={() => void previewRevision(revision.revision)}>
                        {previewingRevision === revision.revision ? '준비 중' : '미리보기'}
                      </button>
                      {revision.revision !== currentRevision && (
                        <button type="button" className="g7pb-button g7pb-button--quiet"
                          data-testid="page-builder-revision-restore"
                          onClick={() => setRestoreCandidate(revision)}>복원</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {revisionDocument && restoreCandidate && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-revision-restore-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-revision-restore-heading">
            <p className="g7pb-kicker">안전 복원</p>
            <h2 id="g7pb-revision-restore-heading">v{restoreCandidate.revision}을 새 초안으로 복원할까요?</h2>
            <p className="g7pb-dialog__body">기존 리비전과 공개본은 삭제되지 않습니다. 복원 뒤 내용을 확인하고 별도로 발행해야 공개됩니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setRestoreCandidate(null)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-revision-restore-confirm" disabled={restoringRevision}
                onClick={() => void restoreRevision()}>
                {restoringRevision ? '복원 중' : '새 초안으로 복원'}
              </button>
            </div>
          </section>
        </div>
      )}

      {unpublishDocument && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-unpublish-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-unpublish-heading">
            <p className="g7pb-kicker">공개 해제</p>
            <h2 id="g7pb-unpublish-heading">이 페이지를 비공개로 전환할까요?</h2>
            <p className="g7pb-dialog__body">공개 URL은 즉시 404가 됩니다. 문서와 모든 리비전은 남아 있어 다시 편집하고 발행할 수 있습니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setUnpublishDocument(null)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-unpublish-confirm" disabled={unpublishing}
                onClick={() => void confirmUnpublish()}>
                {unpublishing ? '해제 중' : '공개 해제'}
              </button>
            </div>
          </section>
        </div>
      )}

      {archiveDocument && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-archive-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-archive-heading">
            <p className="g7pb-kicker">문서 보관</p>
            <h2 id="g7pb-archive-heading">{archiveDocument.title} 문서를 보관할까요?</h2>
            <p className="g7pb-dialog__body">발행 중이면 즉시 공개 해제되고 홈 지정도 해제됩니다. 문서와 리비전은 보관함에서 다시 복원할 수 있습니다.</p>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => setArchiveDocument(null)}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-archive-confirm" disabled={lifecycleBusy}
                onClick={() => void confirmArchive()}>{lifecycleBusy ? '보관 중' : '보관함으로 이동'}</button>
            </div>
          </section>
        </div>
      )}

      {purgeDocument && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-purge-dialog">
          <section className="g7pb-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-purge-heading">
            <p className="g7pb-kicker">영구 삭제</p>
            <h2 id="g7pb-purge-heading">이 문서와 모든 기록을 삭제할까요?</h2>
            <p className="g7pb-dialog__body">복구할 수 없습니다. 확인하려면 <strong>{purgeDocument.document.slug}</strong>를 입력해 주세요.</p>
            <label>
              확인 주소
              <input value={purgeConfirmation} autoFocus data-testid="page-builder-purge-confirmation"
                onChange={(event) => setPurgeConfirmation(event.target.value)} />
            </label>
            <div className="g7pb-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => { setPurgeDocument(null); setPurgeConfirmation(''); }}>취소</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-purge-confirm" disabled={lifecycleBusy || purgeConfirmation !== purgeDocument.document.slug}
                onClick={() => void confirmPurge()}>{lifecycleBusy ? '삭제 중' : '영구 삭제'}</button>
            </div>
          </section>
        </div>
      )}
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
    roots.get(element)?.unmount();
    roots.delete(element);
  };
}

export function discoverPageBuilderManagers(scope: ParentNode = document): Element[] {
  return Array.from(scope.querySelectorAll('[data-g7pb-manager], #g7pb-manager'));
}
