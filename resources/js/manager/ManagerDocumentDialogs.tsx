import React from 'react';
import { Copy } from 'lucide-react';
import type { PageShellMode } from '../documents/types';
import type { useManagerDocuments } from './useManagerDocuments';

export function ManagerDocumentDialogs({ controller, onPageKits }: {
  controller: ReturnType<typeof useManagerDocuments>; onPageKits: () => void;
}): React.ReactElement {
  const { createDialogOpen, setCreateDialogOpen, createDocument, createTitle, setCreateTitle, createSlug, setCreateSlug,
    createShellMode, setCreateShellMode, creating, duplicateDocument, duplicateTitle, setDuplicateTitle,
    duplicateSlugValue, setDuplicateSlugValue, submitDuplicate, duplicating, setDuplicateDocument,
    archiveDocument, setArchiveDocument, confirmArchive, lifecycleBusy, purgeDocument, setPurgeDocument,
    purgeConfirmation, setPurgeConfirmation, confirmPurge } = controller;
  return (<>
      {createDialogOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-create-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-manager-create-heading">
            <p className="g7pb-kicker">새 문서</p>
            <h2 id="g7pb-manager-create-heading">페이지 기본 정보</h2>
            <div className="g7pb-create-choice">
              <div><strong>페이지 킷에서 시작</strong><span>샘플 이미지와 완성된 블록 구성을 선택합니다.</span></div>
              <button type="button" className="g7pb-button g7pb-button--primary"
                data-testid="page-builder-manager-create-page-kit"
                onClick={() => { setCreateDialogOpen(false); onPageKits(); }}>페이지 킷 보기</button>
            </div>
            <p className="g7pb-dialog__divider"><span>또는 빈 페이지</span></p>
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
              <label>
                페이지 출력 방식
                <span>사이트 템플릿을 기본으로 사용하며 기존 템플릿은 수정하지 않습니다.</span>
                <select value={createShellMode === 'global' ? 'builder' : createShellMode}
                  data-testid="page-builder-manager-shell-mode"
                  onChange={(event) => setCreateShellMode(event.currentTarget.value as PageShellMode)}>
                  <option value="template">활성 사이트 템플릿 · 권장</option>
                  <option value="builder">페이지 빌더 Header·Footer</option>
                  <option value="none">공통영역 없음 · 인트로/캠페인</option>
                </select>
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

      {duplicateDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-duplicate-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-manager-duplicate-heading">
            <p className="g7pb-kicker">문서 복제</p>
            <h2 id="g7pb-manager-duplicate-heading">{duplicateDocument.title}을 새 초안으로 복제</h2>
            <p className="g7pb-dialog__body">현재 초안의 블록·스타일·공통영역 표시 방식을 복사합니다. 발행 상태, 공개 주소, 홈 지정, 기존 리비전은 복사하지 않습니다.</p>
            <form onSubmit={(event) => void submitDuplicate(event)}>
              <label>
                복제본 제목
                <input data-testid="page-builder-manager-duplicate-title" value={duplicateTitle}
                  required autoFocus onChange={(event) => setDuplicateTitle(event.target.value)} />
              </label>
              <label>
                새 주소 슬러그
                <span>기존 공개 주소와 연결되지 않는 새 주소입니다.</span>
                <input data-testid="page-builder-manager-duplicate-slug" value={duplicateSlugValue}
                  required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  onChange={(event) => setDuplicateSlugValue(event.target.value.toLowerCase())} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={duplicating} onClick={() => setDuplicateDocument(null)}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-duplicate-confirm" disabled={duplicating}>
                  <Copy size={15} aria-hidden="true" />
                  <span>{duplicating ? '복제 중' : '복제하고 편집'}</span>
                </button>
              </div>
            </form>
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
  </>);
}
