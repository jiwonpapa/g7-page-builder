import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '../../css/page-builder.css';
import {
  ADMIN_AUTH_TOKEN_KEY,
  PAGE_BUILDER_EDITOR_PATH,
  PAGE_BUILDER_MANAGER_PATH,
  PageBuilderApiClient,
  PageBuilderApiError,
  buildAdminLoginUrl,
} from '../api/pageBuilderApi';
import type { DocumentResource, PageBuilderDocument } from '../documents/types';
import { discoverPageBuilderManagers, mountPageBuilderManager } from '../manager/PageBuilderManager';
import { PuckEditorAdapter } from './PuckEditorAdapter';

export interface PageBuilderEditorOptions {
  documentId?: string;
  locale?: string;
  title?: string;
  slug?: string;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';
type PublishState = 'idle' | 'preparing' | 'publishing' | 'published' | 'error';

const roots = new WeakMap<Element, Root>();

const saveLabels: Record<SaveState, string> = {
  idle: '초안 없음',
  dirty: '저장할 변경 있음',
  saving: '저장 중',
  saved: '저장됨',
  conflict: '다른 변경과 충돌',
  error: '저장 실패',
};

const publishLabels: Record<PublishState, string> = {
  idle: '발행 대기',
  preparing: '발행 검증 중',
  publishing: '발행 반영 중',
  published: '발행 완료',
  error: '발행 실패',
};

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function readDocumentQuery(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return new URLSearchParams(window.location.search).get('document') ?? undefined;
}

function hasAdminToken(): boolean {
  try {
    return Boolean(window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY));
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  if (error instanceof PageBuilderApiError) {
    const message = error.code === 'G7PB_COMPILE_FAILED'
      ? `미리보기 또는 발행할 수 없는 블록 설정이 있습니다. ${error.message}`
      : error.message;
    return error.correlationId ? `${message} · 문의 번호 ${error.correlationId}` : message;
  }

  return error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
}

function isConflict(error: unknown): boolean {
  return error instanceof PageBuilderApiError &&
    (error.status === 409 || error.code === 'G7PB_LOCK_CONFLICT');
}

function EditorShell({
  documentId: initialDocumentId,
  locale = 'ko',
  title: initialTitle = '',
  slug: initialSlug = '',
}: PageBuilderEditorOptions): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [requestedDocumentId, setRequestedDocumentId] = useState(
    initialDocumentId ?? readDocumentQuery(),
  );
  const [document, setDocument] = useState<PageBuilderDocument | null>(null);
  const [documentTitle, setDocumentTitle] = useState(initialTitle);
  const [editorRevisionKey, setEditorRevisionKey] = useState(0);
  const [loading, setLoading] = useState(Boolean(requestedDocumentId));
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState(initialTitle);
  const [createSlug, setCreateSlug] = useState(initialSlug);
  const [creating, setCreating] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [publishState, setPublishState] = useState<PublishState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewExpiresAt, setPreviewExpiresAt] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const documentRef = useRef<PageBuilderDocument | null>(null);
  const lockVersionRef = useRef(0);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  const applyResource = useCallback((resource: DocumentResource, resetEditor: boolean): void => {
    documentRef.current = resource.document;
    lockVersionRef.current = resource.lock_version;
    dirtyRef.current = false;
    editVersionRef.current += 1;
    loadedDocumentIdRef.current = resource.document.document_id;
    setDocument(resource.document);
    setDocumentTitle(resource.title);
    setPublicUrl(resource.public_url);
    setSaveState('saved');
    setMessage(null);
    if (resetEditor) {
      setEditorRevisionKey((value) => value + 1);
    }
  }, []);

  useEffect(() => {
    if (hasAdminToken()) {
      return;
    }

    setMessage('관리자 로그인이 필요합니다. 로그인 화면으로 이동합니다.');
    window.location.assign(buildAdminLoginUrl(currentPath()));
  }, []);

  useEffect(() => {
    if (!requestedDocumentId || loadedDocumentIdRef.current === requestedDocumentId || !hasAdminToken()) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setMessage(null);
    void api.getDocument(requestedDocumentId)
      .then(async (resource) => {
        if (active) {
          applyResource(resource, true);
          try {
            const preview = await api.createPreview(
              resource.document.document_id,
              resource.lock_version,
            );
            if (active) {
              setPreviewUrl(preview.preview_url);
              setPreviewExpiresAt(preview.expires_at);
            }
          } catch {
            // Loading the draft is not blocked by an unavailable preview ticket.
          }
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(formatError(error));
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
  }, [api, applyResource, requestedDocumentId]);

  const refreshPreviewTicket = useCallback(async (documentId: string, lockVersion: number): Promise<void> => {
    await api.createPreview(documentId, lockVersion)
      .then((preview) => {
        setPreviewUrl(preview.preview_url);
        setPreviewExpiresAt(preview.expires_at);
      })
      .catch(() => {
        // A saved draft remains valid even when preview ticket creation fails.
        setPreviewUrl(null);
        setPreviewExpiresAt(null);
      });
  }, [api]);

  const saveDraft = useCallback(async function persistDraft(flushLatest = false): Promise<boolean> {
    if (savePromiseRef.current) {
      const saved = await savePromiseRef.current;
      if (saved && flushLatest && dirtyRef.current) {
        return persistDraft(true);
      }
      return saved;
    }

    const snapshot = documentRef.current;
    if (!snapshot) {
      return false;
    }
    if (!dirtyRef.current) {
      setSaveState('saving');
      await refreshPreviewTicket(snapshot.document_id, lockVersionRef.current);
      setSaveState('saved');
      return true;
    }

    const snapshotEditVersion = editVersionRef.current;
    const expectedLockVersion = lockVersionRef.current;
    setSaveState('saving');
    setMessage(null);

    const request = api.saveDraft(snapshot.document_id, snapshot, expectedLockVersion)
      .then(async (resource) => {
        lockVersionRef.current = resource.lock_version;
        setDocumentTitle(resource.title);
        setPublicUrl(resource.public_url);
        await refreshPreviewTicket(resource.document.document_id, resource.lock_version);
        if (editVersionRef.current === snapshotEditVersion) {
          documentRef.current = resource.document;
          dirtyRef.current = false;
          setDocument(resource.document);
          setSaveState('saved');
        } else {
          setSaveState('dirty');
        }
        return true;
      })
      .catch((error: unknown) => {
        if (isConflict(error)) {
          setSaveState('conflict');
          setMessage('서버의 초안이 먼저 변경되었습니다. 서버 버전을 다시 불러와 비교해 주세요.');
        } else {
          setSaveState('error');
          setMessage(formatError(error));
        }
        return false;
      })
      .finally(() => {
        savePromiseRef.current = null;
      });

    savePromiseRef.current = request;
    const saved = await request;
    if (saved && flushLatest && dirtyRef.current) {
      return persistDraft(true);
    }
    return saved;
  }, [api, refreshPreviewTicket]);

  useEffect(() => {
    if (saveState !== 'dirty') {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveDraft(false);
    }, 2_000);

    return () => window.clearTimeout(timer);
  }, [document, saveDraft, saveState]);

  const handleDocumentChange = useCallback((nextDocument: PageBuilderDocument): void => {
    documentRef.current = nextDocument;
    dirtyRef.current = true;
    editVersionRef.current += 1;
    setDocument(nextDocument);
    setSaveState('dirty');
    setPublishState('idle');
    setPreviewUrl(null);
    setPreviewExpiresAt(null);
    setMessage(null);
  }, []);

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
      const resource = await api.createDocument({ title, slug, locale });
      applyResource(resource, true);
      setRequestedDocumentId(resource.document.document_id);
      setCreateDialogOpen(false);
      window.history.replaceState(
        null,
        '',
        `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(resource.document.document_id)}`,
      );
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setCreating(false);
    }
  };

  const reloadServerDraft = async (): Promise<void> => {
    const current = documentRef.current;
    if (!current) {
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const resource = await api.getDocument(current.document_id);
      applyResource(resource, true);
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setLoading(false);
    }
  };

  const preparePreview = async (): Promise<void> => {
    const current = documentRef.current;
    if (!current || !(await saveDraft(true))) {
      return;
    }

    setMessage(null);
    try {
      const preview = await api.createPreview(current.document_id, lockVersionRef.current);
      setPreviewUrl(preview.preview_url);
      setPreviewExpiresAt(preview.expires_at);
    } catch (error) {
      setMessage(formatError(error));
    }
  };

  const publish = useCallback(async (): Promise<void> => {
    const current = documentRef.current;
    if (!current || !(await saveDraft(true))) {
      return;
    }

    setPublishState('preparing');
    setMessage(null);
    try {
      const preparation = await api.preparePublication(current.document_id, lockVersionRef.current);
      if (preparation.warnings.length > 0) {
        setMessage(preparation.warnings.join(' · '));
      }
      setPublishState('publishing');
      const commit = await api.commitPublication(preparation.publication_token);
      setPublicUrl(commit.public_url);
      setPublishedAt(commit.published_at);
      setPublishState('published');
    } catch (error) {
      setPublishState('error');
      setMessage(formatError(error));
    }
  }, [api, saveDraft]);

  const working = loading || creating || saveState === 'saving' ||
    publishState === 'preparing' || publishState === 'publishing';

  return (
    <main className="g7pb-root" data-testid="page-builder-app" aria-busy={working}>
      <header className="g7pb-command-bar">
        <div className="g7pb-command-bar__identity">
          <span className="g7pb-product-mark" aria-hidden="true">G7</span>
          <div>
            <p>{documentTitle || 'Page Builder'}</p>
            <strong>{document?.slug ?? '새 페이지'}</strong>
          </div>
        </div>

        <div className="g7pb-command-bar__actions">
          <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-manager-link"
            href={PAGE_BUILDER_MANAGER_PATH}>
            문서함
          </a>
          {document ? (
            <>
              <span className="g7pb-status" data-testid="page-builder-save-status" data-state={saveState} role="status">
                {saveLabels[saveState]}
              </span>
              <button type="button" className="g7pb-button g7pb-button--quiet" data-testid="page-builder-save"
                disabled={working} onClick={() => void saveDraft(true)}>
                저장
              </button>
              {previewUrl ? (
                <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-preview-link" href={previewUrl}
                  target="_blank" rel="noopener noreferrer" title={previewExpiresAt ? `${previewExpiresAt}까지 유효` : undefined}>
                  미리보기 ↗
                </a>
              ) : (
                <button type="button" className="g7pb-button g7pb-button--quiet" data-testid="page-builder-preview-link"
                  disabled={working} onClick={() => void preparePreview()}>
                  미리보기 생성
                </button>
              )}
              <button type="button" className="g7pb-button g7pb-button--primary" data-testid="page-builder-publish"
                disabled={working} onClick={() => void publish()}>
                발행
              </button>
              <span className="g7pb-status g7pb-status--publish" data-testid="page-builder-publish-status"
                data-state={publishState} role="status">
                {publishLabels[publishState]}
              </span>
              {publicUrl && (
                <a className="g7pb-public-link" data-testid="page-builder-public-link" href={publicUrl}
                  target="_blank" rel="noopener noreferrer" title={publishedAt ? `${publishedAt} 발행` : '공개 페이지'}>
                  공개 페이지 ↗
                </a>
              )}
            </>
          ) : (
            <button type="button" className="g7pb-button g7pb-button--primary"
              onClick={() => setCreateDialogOpen(true)}>
              페이지 만들기
            </button>
          )}
        </div>
      </header>

      {message && (
        <div className={`g7pb-notice ${saveState === 'conflict' ? 'g7pb-notice--warning' : ''}`} role="alert">
          <span>{message}</span>
          {saveState === 'conflict' && (
            <button type="button" onClick={() => void reloadServerDraft()}>서버 버전 다시 불러오기</button>
          )}
          {saveState === 'error' && (
            <button type="button" onClick={() => void saveDraft(true)}>다시 저장</button>
          )}
        </div>
      )}

      {loading && <div className="g7pb-loading" role="status">페이지를 불러오는 중입니다.</div>}

      {!loading && document && (
        <PuckEditorAdapter document={document} revisionKey={editorRevisionKey} disabled={working}
          onChange={handleDocumentChange} onPublish={() => publish()} />
      )}

      {!loading && !document && (
        <section className="g7pb-empty-state">
          <p className="g7pb-kicker">첫 페이지</p>
          <h1>완성 블록으로 페이지를 시작하세요.</h1>
          <p>Hero와 Features를 배치하고 저장, 미리보기, 발행까지 한 작업면에서 진행합니다.</p>
          <button type="button" className="g7pb-button g7pb-button--primary" data-testid="page-builder-create"
            onClick={() => setCreateDialogOpen(true)}>
            페이지 만들기
          </button>
        </section>
      )}

      {createDialogOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-create-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-create-heading">
            <p className="g7pb-kicker">새 문서</p>
            <h2 id="g7pb-create-heading">페이지 기본 정보</h2>
            <form onSubmit={(event) => void createDocument(event)}>
              <label>
                페이지 제목
                <input data-testid="page-builder-title-input" value={createTitle} required autoFocus
                  onChange={(event) => setCreateTitle(event.target.value)} />
              </label>
              <label>
                주소 슬러그
                <span>영문 소문자, 숫자, 하이픈</span>
                <input data-testid="page-builder-slug-input" value={createSlug} required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => setCreateSlug(event.target.value.toLowerCase())} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setCreateDialogOpen(false)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary" data-testid="page-builder-create-confirm"
                  disabled={creating}>{creating ? '만드는 중' : '편집 시작'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function optionsFromElement(element: Element): PageBuilderEditorOptions {
  const htmlElement = element as HTMLElement;
  return {
    documentId: htmlElement.dataset.documentId ?? readDocumentQuery(),
    locale: htmlElement.dataset.locale ?? 'ko',
    title: htmlElement.dataset.title,
    slug: htmlElement.dataset.slug,
  };
}

export function mountPageBuilderEditor(
  element: Element,
  options: PageBuilderEditorOptions = optionsFromElement(element),
): () => void {
  roots.get(element)?.unmount();
  const root = createRoot(element);
  roots.set(element, root);
  root.render(<EditorShell {...options} />);

  return () => {
    roots.get(element)?.unmount();
    roots.delete(element);
  };
}

export function discoverPageBuilderEditors(scope: ParentNode = document): Element[] {
  return Array.from(scope.querySelectorAll('[data-g7pb-editor], #g7pb-editor'));
}

function autoMountEditors(): void {
  for (const element of discoverPageBuilderManagers()) {
    mountPageBuilderManager(element, {
      locale: (element as HTMLElement).dataset.locale ?? 'ko',
    });
  }

  for (const element of discoverPageBuilderEditors()) {
    if (!roots.has(element)) {
      mountPageBuilderEditor(element);
    }
  }
}

declare global {
  interface Window {
    G7PageBuilder?: {
      mountEditor: typeof mountPageBuilderEditor;
      discoverEditors: typeof discoverPageBuilderEditors;
    };
  }
}

if (typeof window !== 'undefined') {
  window.G7PageBuilder = {
    mountEditor: mountPageBuilderEditor,
    discoverEditors: discoverPageBuilderEditors,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoMountEditors, { once: true });
  } else {
    queueMicrotask(autoMountEditors);
  }
}
