import React from 'react';
import type { useManagerRevisions } from './useManagerRevisions';
import { formatRevisionDate } from './managerDocumentPresentation';

export function ManagerRevisionsDialogs({ controller }: { controller: ReturnType<typeof useManagerRevisions> }): React.ReactElement {
  const { revisionDocument, closeRevisions, revisions, currentRevision, loadingRevisions, previewingRevision,
    previewRevision, restoreCandidate, setRestoreCandidate, restoringRevision, restoreRevision } = controller;
  return (<>
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
                onClick={() => closeRevisions()}>닫기</button>
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

  </>);
}
