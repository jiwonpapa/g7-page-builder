import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Braces, FileCode2 } from 'lucide-react';

import '../../css/page-builder-editor.css';
import {
  ADMIN_AUTH_TOKEN_KEY,
  PAGE_BUILDER_EDITOR_PATH,
  PAGE_BUILDER_MANAGER_PATH,
  PageBuilderApiClient,
  PageBuilderApiError,
  buildAdminLoginUrl,
} from '../api/pageBuilderApi';
import type { DocumentResource, PageBuilderDocument } from '../documents/types';
import { normalizeDocumentTransport } from '../documents/normalizeDocumentTransport';
import { LayoutPolicyError, validateLayoutDocument } from '../documents/layoutPolicy';
import { loadBlockPackEditorAssets } from '../blocks/runtimeLoader';
import { PuckEditorAdapter } from './PuckEditorAdapter';
import { clearDraftJournal, readDraftJournal, writeDraftJournal } from './draftJournal';
import { createDraftPersistence } from './draftPersistence';

export interface PageBuilderEditorOptions {
  documentId?: string;
  locale?: string;
  title?: string;
  slug?: string;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'error';
type PublishState = 'idle' | 'preparing' | 'publishing' | 'published' | 'error';

const roots = new WeakMap<Element, Root>();
export const AUTO_SAVE_IDLE_MS = 750;
export const DRAFT_JOURNAL_BATCH_MS = 200;

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

function actionableCompileMessage(message: string): string | null {
  if (/^(?:필수 항목 “.+”를 입력해야 합니다|“.+” 입력은 \d+자 이내여야 합니다)\.$/.test(message)) {
    return message;
  }
  const legacy = message.match(/^Property (alt|imageAlt|avatarAlt) is required or too long\.$/);
  return legacy ? '필수 항목 “이미지 대체 텍스트”를 입력해야 합니다.' : null;
}

function formatError(error: unknown): string {
  if (error instanceof LayoutPolicyError) {
    return '문서의 블록 구성이 올바르지 않아 편집기를 열지 못했습니다. 문서함에서 다른 문서를 열 수 있습니다.';
  }
  if (error instanceof PageBuilderApiError) {
    const actionable = error.code === 'G7PB_COMPILE_FAILED' ? actionableCompileMessage(error.message) : null;
    if (actionable) return actionable;
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

function readEditorDocument(document: PageBuilderDocument): PageBuilderDocument {
  const normalized = normalizeDocumentTransport(document);
  if (normalized.schema_version === 'g7-page-builder/v2') validateLayoutDocument(normalized);
  return normalized;
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
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticTab, setDiagnosticTab] = useState<'document' | 'artifact'>('document');
  const [compiledSource, setCompiledSource] = useState('');
  const [diagnosticBusy, setDiagnosticBusy] = useState(false);
  const [leaveHref, setLeaveHref] = useState<string | null>(null);

  const documentRef = useRef<PageBuilderDocument | null>(null);
  const lockVersionRef = useRef(0);
  const dirtyRef = useRef(false);
  const editVersionRef = useRef(0);
  const loadedDocumentIdRef = useRef<string | null>(null);
  const navigationBypassRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const draftJournalTimerRef = useRef<number | null>(null);

  const cancelAutoSave = useCallback((): void => {
    if (autoSaveTimerRef.current === null) return;
    window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
  }, []);

  const flushDraftJournal = useCallback((): void => {
    if (draftJournalTimerRef.current !== null) {
      window.clearTimeout(draftJournalTimerRef.current);
      draftJournalTimerRef.current = null;
    }
    const current = documentRef.current;
    if (current && dirtyRef.current) writeDraftJournal(current, lockVersionRef.current);
  }, []);

  const scheduleDraftJournal = useCallback((): void => {
    if (draftJournalTimerRef.current !== null) return;
    draftJournalTimerRef.current = window.setTimeout(flushDraftJournal, DRAFT_JOURNAL_BATCH_MS);
  }, [flushDraftJournal]);

  const applyResource = useCallback((
    resource: DocumentResource,
    resetEditor: boolean,
    restoreJournal = false,
  ): void => {
    const journal = restoreJournal
      ? readDraftJournal(resource.document.document_id, resource.lock_version)
      : null;
    // Check before committing React state so malformed transport/journal data is
    // handled by the load error path instead of unmounting the entire editor.
    const nextDocument = readEditorDocument(journal?.document ?? resource.document);
    documentRef.current = nextDocument;
    lockVersionRef.current = resource.lock_version;
    dirtyRef.current = journal !== null;
    editVersionRef.current += 1;
    loadedDocumentIdRef.current = resource.document.document_id;
    setDocument(nextDocument);
    setDocumentTitle(resource.title);
    setPublicUrl(resource.public_url);
    setSaveState(journal ? 'dirty' : 'saved');
    setMessage(journal ? '저장되지 않은 브라우저 복구본을 불러왔습니다.' : null);
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
    void (async () => {
      const packs = await api.listBlockPacks();
      await loadBlockPackEditorAssets(packs.items);

      return api.getDocument(requestedDocumentId);
    })()
      .then(async (resource) => {
        if (active) {
          applyResource(resource, true, true);
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

  const refreshPreviewTicket = useCallback(async (documentId: string, lockVersion: number, isCurrent: () => boolean): Promise<void> => {
    await api.createPreview(documentId, lockVersion)
      .then((preview) => {
        if (!isCurrent()) return;
        setPreviewUrl(preview.preview_url);
        setPreviewExpiresAt(preview.expires_at);
      })
      .catch(() => {
        // A saved draft remains valid even when preview ticket creation fails.
        if (!isCurrent()) return;
        setPreviewUrl(null);
        setPreviewExpiresAt(null);
      });
  }, [api]);

  const persistence = useMemo(() => createDraftPersistence({
    current: () => ({ document: documentRef.current, dirty: dirtyRef.current,
      editVersion: editVersionRef.current, lockVersion: lockVersionRef.current }),
    cancelScheduledSave: cancelAutoSave,
    save: (snapshot, lockVersion) => api.saveDraft(snapshot.document_id, snapshot, lockVersion),
    preview: refreshPreviewTicket,
    readDocument: readEditorDocument,
    started: () => { setSaveState('saving'); setMessage(null); },
    resourceReceived: (resource) => {
      lockVersionRef.current = resource.lock_version;
      setDocumentTitle(resource.title);
      setPublicUrl(resource.public_url);
    },
    saved: (resource, savedDocument) => {
      if (draftJournalTimerRef.current !== null) {
        window.clearTimeout(draftJournalTimerRef.current);
        draftJournalTimerRef.current = null;
      }
      documentRef.current = savedDocument;
      dirtyRef.current = false;
      setDocument(savedDocument);
      setSaveState('saved');
      clearDraftJournal(resource.document.document_id);
    },
    cleanSaved: () => setSaveState('saved'),
    newerEdits: (resource) => {
      const latest = documentRef.current;
      if (latest && resource) {
        if (draftJournalTimerRef.current !== null) {
          window.clearTimeout(draftJournalTimerRef.current);
          draftJournalTimerRef.current = null;
        }
        writeDraftJournal(latest, resource.lock_version);
      }
      setSaveState('dirty');
    },
    failed: (error) => {
      if (isConflict(error)) {
        setSaveState('conflict');
        setMessage('서버의 초안이 먼저 변경되었습니다. 서버 버전을 다시 불러와 비교해 주세요.');
      } else {
        setSaveState('error');
        setMessage(formatError(error));
      }
    },
  }), [api, cancelAutoSave, refreshPreviewTicket]);
  const saveDraft = useCallback((flushLatest = false): Promise<boolean> => persistence.save(flushLatest), [persistence]);

  const scheduleAutoSave = useCallback((): void => {
    cancelAutoSave();
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void saveDraft(false);
    }, AUTO_SAVE_IDLE_MS);
  }, [cancelAutoSave, saveDraft]);

  const handleDocumentChange = useCallback((nextDocument: PageBuilderDocument): void => {
    documentRef.current = nextDocument;
    dirtyRef.current = true;
    editVersionRef.current += 1;
    scheduleDraftJournal();
    scheduleAutoSave();
    setSaveState('dirty');
    setPublishState('idle');
    setPreviewUrl(null);
    setPreviewExpiresAt(null);
    setMessage(null);
  }, [scheduleAutoSave, scheduleDraftJournal]);

  const handleEditorDirty = useCallback((): void => {
    dirtyRef.current = true;
    setSaveState('dirty');
    setPublishState('idle');
    setPreviewUrl(null);
    setPreviewExpiresAt(null);
  }, []);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent): string | undefined => {
      if (navigationBypassRef.current || (!dirtyRef.current && saveState !== 'saving' && saveState !== 'error' && saveState !== 'conflict')) {
        return undefined;
      }
      flushDraftJournal();
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [flushDraftJournal, saveState]);

  useEffect(() => {
    const saveWhenHidden = (): void => {
      if (globalThis.document?.visibilityState === 'hidden' && dirtyRef.current) {
        flushDraftJournal();
        void saveDraft(false);
      }
    };
    globalThis.document?.addEventListener('visibilitychange', saveWhenHidden);
    return () => globalThis.document?.removeEventListener('visibilitychange', saveWhenHidden);
  }, [flushDraftJournal, saveDraft]);

  useEffect(() => () => {
    cancelAutoSave();
    flushDraftJournal();
  }, [cancelAutoSave, flushDraftJournal]);

  const navigateTo = (href: string): void => {
    navigationBypassRef.current = true;
    window.location.assign(href);
  };

  const requestNavigation = (event: React.MouseEvent<HTMLAnchorElement>, href: string): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!dirtyRef.current && saveState !== 'saving' && saveState !== 'error' && saveState !== 'conflict') return;
    event.preventDefault();
    setLeaveHref(href);
  };

  const saveAndLeave = async (): Promise<void> => {
    if (!leaveHref || !(await saveDraft(true))) return;
    navigateTo(leaveHref);
  };

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
      clearDraftJournal(resource.document.document_id);
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
      clearDraftJournal(current.document_id);
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

  const generateCompiledDiagnostic = async (): Promise<void> => {
    const current = documentRef.current;
    if (!current) return;
    if (dirtyRef.current && !(await saveDraft(true))) return;

    setDiagnosticBusy(true);
    setMessage(null);
    try {
      const preview = await api.createPreview(current.document_id, lockVersionRef.current);
      const response = await fetch(preview.preview_url, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      });
      if (!response.ok) throw new Error('컴파일 산출물을 불러오지 못했습니다.');
      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const main = parsed.querySelector('main.g7pb-page');
      if (!main) throw new Error('컴파일 산출물 형식이 올바르지 않습니다.');
      setCompiledSource(main.innerHTML.trim());
      setDiagnosticTab('artifact');
    } catch (error) {
      setMessage(formatError(error));
    } finally {
      setDiagnosticBusy(false);
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

  const editorInteractionLocked = loading || creating ||
    publishState === 'preparing' || publishState === 'publishing';
  const actionBusy = editorInteractionLocked || saveState === 'saving';

  return (
    <main className="g7pb-root" data-testid="page-builder-app" aria-busy={actionBusy}>
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
            href={PAGE_BUILDER_MANAGER_PATH} onClick={(event) => requestNavigation(event, PAGE_BUILDER_MANAGER_PATH)}>
            문서함
          </a>
          {document ? (
            <>
              <span className="g7pb-status" data-testid="page-builder-save-status" data-state={saveState} role="status">
                {saveLabels[saveState]}
              </span>
              <button type="button" className="g7pb-button g7pb-button--quiet" data-testid="page-builder-save"
                disabled={actionBusy} onClick={() => void saveDraft(true)}>
                저장
              </button>
              <button type="button" className="g7pb-button g7pb-button--quiet g7pb-button--icon-label"
                data-testid="page-builder-source-view" disabled={actionBusy}
                onClick={() => { setDiagnosticTab('document'); setDiagnosticsOpen(true); }}>
                <Braces size={16} aria-hidden="true" /><span>원본 보기</span>
              </button>
              {previewUrl ? (
                <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-preview-link" href={previewUrl}
                  target="_blank" rel="noopener noreferrer" title={previewExpiresAt ? `${previewExpiresAt}까지 유효` : undefined}>
                  미리보기 ↗
                </a>
              ) : (
                <button type="button" className="g7pb-button g7pb-button--quiet" data-testid="page-builder-preview-link"
                  disabled={actionBusy} onClick={() => void preparePreview()}>
                  미리보기 생성
                </button>
              )}
              <button type="button" className="g7pb-button g7pb-button--primary" data-testid="page-builder-publish"
                disabled={actionBusy} onClick={() => void publish()}>
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
          <button
            type="button"
            className="g7pb-notice__dismiss"
            aria-label="알림 닫기"
            data-testid="page-builder-message-dismiss"
            onClick={() => setMessage(null)}
          >
            닫기
          </button>
        </div>
      )}

      {loading && <div className="g7pb-loading" role="status">페이지를 불러오는 중입니다.</div>}

      {!loading && document && (
        <PuckEditorAdapter document={document} revisionKey={editorRevisionKey} disabled={editorInteractionLocked}
          onDirty={handleEditorDirty} onChange={handleDocumentChange} onPublish={() => publish()} />
      )}

      {!loading && !document && requestedDocumentId && (
        <section className="g7pb-empty-state">
          <h1>페이지를 열지 못했습니다.</h1>
          <p>상단의 오류 안내를 확인해 주세요.</p>
        </section>
      )}

      {!loading && !document && !requestedDocumentId && (
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

      {diagnosticsOpen && document && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-source-dialog">
          <section className="g7pb-dialog g7pb-source-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-source-heading">
            <header>
              <div>
                <p className="g7pb-kicker">읽기 전용 진단</p>
                <h2 id="g7pb-source-heading">원본과 컴파일 산출물</h2>
              </div>
              <button type="button" className="g7pb-icon-button" aria-label="원본 보기 닫기" onClick={() => setDiagnosticsOpen(false)}>×</button>
            </header>
            <div className="g7pb-source-dialog__tabs" role="tablist" aria-label="진단 형식">
              <button type="button" role="tab" aria-selected={diagnosticTab === 'document'}
                data-testid="page-builder-source-document-tab" onClick={() => setDiagnosticTab('document')}>
                <Braces size={16} aria-hidden="true" /> PageBuilderDocument JSON
              </button>
              <button type="button" role="tab" aria-selected={diagnosticTab === 'artifact'}
                data-testid="page-builder-source-artifact-tab" onClick={() => setDiagnosticTab('artifact')}>
                <FileCode2 size={16} aria-hidden="true" /> 컴파일 HTML
              </button>
            </div>
            {diagnosticTab === 'document' ? (
              <pre data-testid="page-builder-source-document">{JSON.stringify(documentRef.current, null, 2)}</pre>
            ) : compiledSource ? (
              <pre data-testid="page-builder-source-artifact">{compiledSource}</pre>
            ) : (
              <div className="g7pb-source-dialog__empty">
                <p>현재 초안을 서버 컴파일러로 검증한 읽기 전용 HTML을 생성합니다. 발행 상태는 바뀌지 않습니다.</p>
                <button type="button" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-source-generate" disabled={diagnosticBusy}
                  onClick={() => void generateCompiledDiagnostic()}>
                  {diagnosticBusy ? '생성 중' : '산출물 생성'}
                </button>
              </div>
            )}
            <footer>
              <span>직접 수정은 지원하지 않습니다. 편집은 캔버스와 안전한 설정에서만 수행합니다.</span>
              <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setDiagnosticsOpen(false)}>닫기</button>
            </footer>
          </section>
        </div>
      )}

      {leaveHref && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm" data-testid="page-builder-unsaved-dialog">
          <section className="g7pb-dialog g7pb-leave-dialog" role="alertdialog" aria-modal="true"
            aria-labelledby="g7pb-leave-heading" aria-describedby="g7pb-leave-description">
            <p className="g7pb-kicker">저장하지 않은 변경</p>
            <h2 id="g7pb-leave-heading">편집 내용을 저장하고 나갈까요?</h2>
            <p id="g7pb-leave-description">저장하지 않고 나가면 마지막 자동 저장 이후 변경이 사라집니다.</p>
            <div className="g7pb-dialog__actions g7pb-leave-dialog__actions">
              <button type="button" className="g7pb-button g7pb-button--quiet"
                data-testid="page-builder-unsaved-cancel" onClick={() => setLeaveHref(null)}>계속 편집</button>
              <button type="button" className="g7pb-button g7pb-button--danger"
                data-testid="page-builder-unsaved-discard" onClick={() => navigateTo(leaveHref)}>저장 안 함</button>
              <button type="button" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-unsaved-save" disabled={saveState === 'saving'} onClick={() => void saveAndLeave()}>
                저장하고 나가기
              </button>
            </div>
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
