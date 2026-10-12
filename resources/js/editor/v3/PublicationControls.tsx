import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPublicationSession, type PreparedPublication, type PublicationPort, type PublishedPage, type PublicPreview } from '../../editor-application/v3/publication';
import type { EditContext, SaveOutcome } from '../../editor-application/v3/session';

export interface PublicationControlsProps {
  port: PublicationPort;
  context: () => EditContext;
  save: () => Promise<SaveOutcome>;
  disabled: boolean;
  editRevision: number;
  busy: (value: boolean) => void;
  published?: (page: PublishedPage) => void;
}
export function PublicationControls(props: PublicationControlsProps) {
  const live = useRef(props); live.current = props;
  const active = useRef(false);
  const request = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<(PublicPreview & { context: EditContext }) | null>(null);
  const [candidate, setCandidate] = useState<PreparedPublication | null>(null);
  const [published, setPublished] = useState<PublishedPage | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const session = useMemo(() => createPublicationSession({ context: () => ({ ...live.current.context(),
    readonly: !active.current || live.current.context().readonly }), save: () => live.current.save() }, props.port), [props.port]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; session.cancel(); };
  }, [session]);
  useEffect(() => {
    if (candidate && !session.canCommit()) {
      session.cancel(); setCandidate(null); setMessage('준비 이후 문서가 변경되었습니다. 발행할 내용을 다시 준비해 주세요.');
    }
    if (preview && preview.context.revision !== props.editRevision) setPreview(null);
  }, [candidate, session, preview, props.editRevision, props.disabled]);
  useEffect(() => {
    const element = dialog.current;
    if (candidate && element && !element.open) element.showModal();
    return () => { if (element?.open) element.close(); };
  }, [candidate]);
  const cancel = () => { if (!request.current) { session.cancel(); setCandidate(null); } };
  const run = async (kind: 'preview' | 'prepare' | 'commit') => {
    if (request.current || live.current.disabled || !active.current) return;
    request.current = true; setBusy(true); live.current.busy(true); setMessage('');
    try {
      if (kind === 'preview') {
        setPreview(null);
        const result = await session.preview();
        if (active.current) { setPreview(result); setMessage('저장된 버전의 공개 미리보기를 준비했습니다.'); }
      } else if (kind === 'prepare') {
        const result = await session.prepare();
        if (active.current) setCandidate(result);
      } else {
        setCandidate(null);
        const result = await session.commit();
        if (active.current) {
          setPublished(result); live.current.published?.(result);
          setMessage(result.edited ? '확인한 버전을 발행했습니다. 이후 편집한 내용은 별도 초안입니다.' : '확인한 버전을 발행했습니다.');
        }
      }
    } catch (cause) {
      if (active.current) setMessage((kind === 'commit' ? '발행 상태를 확인하지 못했습니다. 공개 페이지 상태를 확인한 뒤 다시 준비해 주세요. ' : '')
        + (cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.'));
    } finally {
      request.current = false;
      if (active.current) { setBusy(false); live.current.busy(false); }
    }
  };
  return <div role="group" aria-label="공개 출력" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
    <button type="button" className="g7pb-button g7pb-button--quiet" disabled={props.disabled || busy}
      onClick={() => void run('preview')}>공개 미리보기 준비</button>
    <button type="button" className="g7pb-button g7pb-button--primary" disabled={props.disabled || busy}
      onClick={() => void run('prepare')}>발행 준비</button>
    {preview && <a className="g7pb-button g7pb-button--quiet" href={preview.url} target="_blank" rel="noopener noreferrer"
      title={'만료: ' + preview.expiresAt}>공개 미리보기 열기</a>}
    {published && <a className="g7pb-button g7pb-button--quiet" href={published.url} target="_blank" rel="noopener noreferrer">공개 페이지 열기</a>}
    <span role="status" aria-label="공개 출력 상태">{busy ? '저장·공개 출력 처리 중' : message}</span>
    {candidate && <dialog ref={dialog} className="g7pb-dialog" aria-labelledby={heading} onCancel={event => { event.preventDefault(); cancel(); }}
      style={{ border: 0, color: 'var(--g7pb-text)', background: 'var(--g7pb-surface-strong)' }}>
      <h2 id={heading}>이 버전을 공개할까요?</h2>
      <p>방금 저장한 내용으로 현재 공개 페이지를 교체합니다.</p>
      <p>구조 미리보기와 달리 페이지에 설정한 사이트 공통영역을 포함하여 공개됩니다.</p>
      {candidate.warnings.length > 0 && <ul>{candidate.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="g7pb-button g7pb-button--quiet" autoFocus onClick={cancel}>취소</button>
        <button type="button" className="g7pb-button g7pb-button--primary" disabled={busy || props.disabled || !session.canCommit()}
          onClick={() => void run('commit')}>이 버전 발행</button>
      </div>
    </dialog>}
  </div>;
}
