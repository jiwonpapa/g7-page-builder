import React, { useEffect, useRef, useState } from 'react';
import type { PageBuilderApiClient, FormSubmissionResource } from '../api/pageBuilderApi';

export function ManagerInboxDialog({ api, open, onClose, onError, formatDate }: {
  api: PageBuilderApiClient;
  open: boolean;
  onClose: () => void;
  onError: (error: unknown) => void;
  formatDate: (value: string) => string;
}): React.ReactElement {
  const [submissions, setSubmissions] = useState<FormSubmissionResource[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxBusy, setInboxBusy] = useState<ReadonlySet<string>>(new Set());
  const session = useRef({ active: false, generation: 0 });
  const requests = useRef(new Map<string, symbol>());
  useEffect(() => {
    const generation = ++session.current.generation;
    session.current.active = open;
    requests.current.clear();
    setInboxBusy(new Set());
    const current = () => session.current.active && session.current.generation === generation;
    if (open) {
      setInboxLoading(true);
      void api.listFormSubmissions().then(resource => {
        if (current()) setSubmissions(resource.items);
      }).catch((error: unknown) => { if (current()) onError(error); })
        .finally(() => { if (current()) setInboxLoading(false); });
    }
    return () => {
      session.current.active = false;
      session.current.generation += 1;
      requests.current.clear();
    };
  }, [api, open, onError]);

  const updateSubmission = async (submission: FormSubmissionResource, update: () => Promise<FormSubmissionResource>): Promise<void> => {
    if (!session.current.active || requests.current.has(submission.id)) return;
    const generation = session.current.generation;
    const request = Symbol(submission.id);
    requests.current.set(submission.id, request);
    setInboxBusy(new Set(requests.current.keys()));
    const current = () => session.current.active && session.current.generation === generation && requests.current.get(submission.id) === request;
    try {
      const updated = await update();
      if (current() && updated.id === submission.id) setSubmissions(items => items.map(item => item.id === updated.id ? updated : item));
    } catch (error) {
      if (current()) onError(error);
    } finally {
      if (current()) {
        requests.current.delete(submission.id);
        setInboxBusy(new Set(requests.current.keys()));
      }
    }
  };
  const setSubmissionStatus = (submission: FormSubmissionResource, status: FormSubmissionResource['status']) =>
    updateSubmission(submission, () => api.updateFormSubmission(submission.id, status));
  const retrySubmission = (submission: FormSubmissionResource) =>
    updateSubmission(submission, () => api.retryFormSubmission(submission.id));

  return <>
      {open && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-inbox-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide g7pb-inbox" role="dialog" aria-modal="true" aria-labelledby="g7pb-inbox-heading">
            <div className="g7pb-dialog__heading-row"><div><p className="g7pb-kicker">폼 접수 관리</p><h2 id="g7pb-inbox-heading">문의함</h2><p>문의는 메일 발송 여부와 관계없이 이곳에 먼저 보존됩니다.</p></div><button type="button" className="g7pb-button g7pb-button--quiet" onClick={onClose}>닫기</button></div>
            {inboxLoading ? <div className="g7pb-manager-loading">문의를 불러오는 중입니다.</div> : submissions.length === 0 ? <div className="g7pb-manager-empty"><h3>접수된 문의가 없습니다.</h3></div> : <div className="g7pb-inbox-list">
              {submissions.map((submission) => <article key={submission.id} data-state={submission.status}>
                <header><div><span>{submission.form_kind} · /{submission.page_slug}</span><h3>{submission.subject || '제목 없는 문의'}</h3><small>{formatDate(submission.created_at)} · {submission.email}</small></div><strong data-mail={submission.mail_status}>{submission.mail_status === 'sent' ? '메일 발송됨' : submission.mail_status === 'failed' ? '메일 실패' : '메일 대기'}</strong></header>
                <dl><div><dt>이름</dt><dd>{submission.payload.name || '-'}</dd></div><div><dt>전화</dt><dd>{submission.payload.phone || '-'}</dd></div></dl>
                <p>{submission.payload.message || ''}</p>
                {submission.mail_error ? <small className="g7pb-inbox-error">{submission.mail_error}</small> : null}
                <footer><button type="button" className="g7pb-button g7pb-button--quiet" disabled={inboxBusy.has(submission.id)} onClick={() => void setSubmissionStatus(submission, submission.status === 'read' ? 'unread' : 'read')}>{submission.status === 'read' ? '읽지 않음' : '읽음 처리'}</button>{submission.mail_status === 'failed' ? <button type="button" className="g7pb-button g7pb-button--quiet" disabled={inboxBusy.has(submission.id)} onClick={() => void retrySubmission(submission)}>메일 재시도</button> : null}<button type="button" className="g7pb-button g7pb-button--danger" disabled={inboxBusy.has(submission.id)} onClick={() => void setSubmissionStatus(submission, 'archived')}>보관</button></footer>
              </article>)}
            </div>}
          </section>
        </div>
      )}
  </>;
}
