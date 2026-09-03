import { useEffect, useRef, useState } from 'react';
import type { PageBuilderApiClient, DocumentResource, RevisionSummary } from '../api/pageBuilderApi';

export function useManagerRevisions({ api, documents, onUpdated, onError, onMessage }: {
  api: PageBuilderApiClient; documents: DocumentResource[]; onUpdated: (resource: DocumentResource) => void;
  onError: (error: unknown) => void; onMessage: (message: string | null) => void;
}) {
  const [target, setTarget] = useState<DocumentResource | null>(null);
  const revisionDocument = documents.find(item => item.document.document_id === target?.document.document_id) ?? target;
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [currentRevision, setCurrentRevision] = useState(0);
  const [loadingRevisions, setLoadingRevisions] = useState(false);
  const [previewingRevision, setPreviewingRevision] = useState<number | null>(null);
  const [restoreCandidate, updateRestoreCandidate] = useState<RevisionSummary | null>(null);
  const [restoringRevision, setRestoringRevision] = useState(false);
  const owner = useRef({ active: false, generation: 0 }); const session = useRef(0); const listRequest = useRef(0);
  const restoreRequest = useRef(0); const restoreBusy = useRef(false); const previewBusy = useRef(false);
  const previewWindows = useRef(new Set<Window>());
  const closePreviews = (): void => { previewWindows.current.forEach(window => window.close()); previewWindows.current.clear(); };
  useEffect(() => {
    owner.current.active = true; owner.current.generation += 1;
    return () => { owner.current.active = false; owner.current.generation += 1; session.current += 1; closePreviews(); };
  }, [api]);
  const capture = () => {
    const generation = owner.current.generation; const opened = session.current;
    const alive = () => owner.current.active && owner.current.generation === generation;
    return { alive, current: () => alive() && session.current === opened };
  };
  const closeRevisions = (): void => {
    session.current += 1; listRequest.current += 1; restoreRequest.current += 1;
    restoreBusy.current = false; previewBusy.current = false; closePreviews();
    setTarget(null); setRevisions([]); updateRestoreCandidate(null); setLoadingRevisions(false); setRestoringRevision(false); setPreviewingRevision(null);
  };
  const loadRevisions = async (resource: DocumentResource): Promise<void> => {
    const operation = capture(); const sequence = ++listRequest.current;
    const current = () => operation.current() && listRequest.current === sequence;
    setLoadingRevisions(true); onMessage(null);
    try {
      const history = await api.listRevisions(resource.document.document_id);
      if (current()) { setRevisions(history.items); setCurrentRevision(history.current_revision); }
    } catch (error) { if (current()) onError(error); }
    finally { if (current()) setLoadingRevisions(false); }
  };
  const openRevisions = (resource: DocumentResource): void => {
    closeRevisions(); setTarget(resource); setCurrentRevision(resource.revision); void loadRevisions(resource);
  };
  const previewRevision = async (revision: number): Promise<void> => {
    if (!revisionDocument || previewBusy.current || !owner.current.active) return;
    const operation = capture();
    // Open synchronously from the user action; awaiting the ticket must not trigger a popup blocker.
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) {
      previewWindows.current.add(previewWindow); previewWindow.opener = null;
      previewWindow.document.title = '미리보기 준비 중'; previewWindow.document.body.textContent = '리비전 미리보기를 준비하고 있습니다.';
    }
    previewBusy.current = true; setPreviewingRevision(revision); onMessage(null);
    try {
      const ticket = await api.createRevisionPreview(revisionDocument.document.document_id, revision);
      if (!operation.current()) { previewWindow?.close(); return; }
      if (previewWindow) { previewWindows.current.delete(previewWindow); previewWindow.location.replace(ticket.preview_url); }
      else window.location.assign(ticket.preview_url);
    } catch (error) { previewWindow?.close(); if (operation.current()) onError(error); }
    finally {
      if (previewWindow) previewWindows.current.delete(previewWindow);
      if (operation.current()) { previewBusy.current = false; setPreviewingRevision(null); }
    }
  };
  const setRestoreCandidate = (candidate: RevisionSummary | null): void => {
    restoreRequest.current += 1; restoreBusy.current = false; setRestoringRevision(false); updateRestoreCandidate(candidate);
  };
  const restoreRevision = async (): Promise<void> => {
    if (!revisionDocument || !restoreCandidate || restoreBusy.current || !owner.current.active) return;
    const resource = revisionDocument; const revision = restoreCandidate.revision; const documentId = resource.document.document_id;
    const operation = capture(); const sequence = ++restoreRequest.current;
    const current = () => operation.current() && restoreRequest.current === sequence;
    restoreBusy.current = true; setRestoringRevision(true); onMessage(null);
    try {
      const restored = await api.restoreRevision(documentId, revision, resource.lock_version);
      if (restored.document.document_id !== documentId) throw new Error('복원 응답의 문서가 요청한 문서와 다릅니다.');
      if (operation.alive()) onUpdated(restored);
      // Cancelling confirmation does not cancel a committed server mutation.
      // Refresh its still-open history, while leaving any newer confirmation alone.
      if (operation.current()) {
        setTarget(restored);
        if (current()) updateRestoreCandidate(null);
        await loadRevisions(restored);
      }
    } catch (error) { if (current()) onError(error); }
    finally { if (current()) { restoreBusy.current = false; setRestoringRevision(false); } }
  };
  return { revisionDocument, openRevisions, closeRevisions, revisions, currentRevision, loadingRevisions, previewingRevision,
    previewRevision, restoreCandidate, setRestoreCandidate, restoringRevision, restoreRevision };
}
