import React from 'react';
import { ImagePlus } from 'lucide-react';
import type { PageSeoMetadata, PageShellMode } from '../documents/types';
import type { useManagerMetadata } from './useManagerMetadata';

export function ManagerMetadataDialog({ controller }: { controller: ReturnType<typeof useManagerMetadata> }): React.ReactElement {
  const { metadataDocument, closeMetadata, metadataTitle, setMetadataTitle, metadataSlug, setMetadataSlug,
    metadataShellMode, setMetadataShellMode, metadataSeoTitle, setMetadataSeoTitle, metadataSeoDescription, setMetadataSeoDescription,
    metadataSeoImage, setMetadataSeoImage, metadataSeoRobots, setMetadataSeoRobots, metadataMediaOpen, setMetadataMediaOpen,
    metadataMedia, metadataMediaLoading, metadataMediaFileRef, openMetadataMedia, uploadMetadataMedia, savingMetadata, updateMetadata,
    unpublishDocument, setUnpublishDocument, unpublishing, confirmUnpublish } = controller;
  return (<>
      {metadataDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-manager-metadata-dialog">
          <section className="g7pb-dialog g7pb-dialog--metadata" role="dialog" aria-modal="true" aria-labelledby="g7pb-manager-metadata-heading">
            <p className="g7pb-kicker">문서 설정</p>
            <h2 id="g7pb-manager-metadata-heading">페이지 정보와 검색 노출</h2>
            <form onSubmit={(event) => void updateMetadata(event)}>
              <fieldset className="g7pb-metadata-section">
                <legend>기본 정보</legend>
                <p>관리 목록과 공개 주소, 사이트 공통영역 사용 방식을 정합니다.</p>
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
                <label>
                  페이지 출력 방식
                  <span>변경 사항은 다음 발행부터 공개 페이지에 적용됩니다.</span>
                  <select value={metadataShellMode === 'global' ? 'builder' : metadataShellMode}
                    data-testid="page-builder-manager-metadata-shell-mode"
                    onChange={(event) => setMetadataShellMode(event.currentTarget.value as PageShellMode)}>
                    <option value="template">활성 사이트 템플릿 · 권장</option>
                    <option value="builder">페이지 빌더 Header·Footer</option>
                    <option value="none">공통영역 없음 · 인트로/캠페인</option>
                  </select>
                </label>
              </fieldset>
              <fieldset className="g7pb-metadata-section">
                <legend>검색·공유 미리보기</legend>
                <p>검색 결과와 메신저·SNS 링크 공유에 사용할 정보를 발행본에 고정합니다.</p>
                <label>
                  검색 제목 <span>{metadataSeoTitle.length}/70 · 비우면 페이지 제목 사용</span>
                  <input data-testid="page-builder-manager-seo-title" value={metadataSeoTitle} maxLength={70}
                    placeholder={metadataTitle || '페이지 제목'} onChange={(event) => setMetadataSeoTitle(event.target.value)} />
                </label>
                <label>
                  검색 설명 <span>{metadataSeoDescription.length}/200</span>
                  <textarea data-testid="page-builder-manager-seo-description" value={metadataSeoDescription}
                    maxLength={200} rows={3} onChange={(event) => setMetadataSeoDescription(event.target.value)} />
                </label>
                <div className="g7pb-metadata-media">
                  <label>
                    공유 대표 이미지
                    <span>직접 업로드하거나 기존 미디어를 선택할 수 있습니다.</span>
                    <input data-testid="page-builder-manager-seo-image" value={metadataSeoImage}
                      placeholder="/storage/... 또는 https://..." onChange={(event) => setMetadataSeoImage(event.target.value)} />
                  </label>
                  {metadataSeoImage ? <img src={metadataSeoImage} alt="공유 대표 이미지 미리보기" /> : null}
                  <div className="g7pb-metadata-media__actions">
                    <button type="button" className="g7pb-button g7pb-button--quiet"
                      onClick={() => void openMetadataMedia()} disabled={metadataMediaLoading}>
                      <ImagePlus size={15} aria-hidden="true" />
                      <span>{metadataMediaOpen ? '미디어 닫기' : '미디어 선택'}</span>
                    </button>
                    {metadataSeoImage ? <button type="button" className="g7pb-button g7pb-button--quiet"
                      onClick={() => setMetadataSeoImage('')}>이미지 비우기</button> : null}
                    <input ref={metadataMediaFileRef} className="g7pb-visually-hidden" type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                      onChange={(event) => void uploadMetadataMedia(event)} />
                    <button type="button" className="g7pb-button g7pb-button--quiet"
                      disabled={metadataMediaLoading} onClick={() => metadataMediaFileRef.current?.click()}>
                      {metadataMediaLoading ? '처리 중' : '파일 업로드'}
                    </button>
                  </div>
                  {metadataMediaOpen ? <div className="g7pb-metadata-media__grid" data-testid="page-builder-manager-seo-media-library">
                    {metadataMediaLoading && metadataMedia.length === 0 ? <p>미디어를 불러오는 중입니다.</p> : null}
                    {!metadataMediaLoading && metadataMedia.length === 0 ? <p>업로드된 이미지가 없습니다.</p> : null}
                    {metadataMedia.map((asset) => <button type="button" key={asset.id}
                      aria-pressed={metadataSeoImage === asset.url}
                      onClick={() => { setMetadataSeoImage(asset.url); setMetadataMediaOpen(false); }}>
                      <img src={asset.url} alt="" loading="lazy" /><span>{asset.original_name}</span>
                    </button>)}
                  </div> : null}
                </div>
                <label>
                  검색 엔진 공개
                  <span>캠페인·인트로처럼 검색 제외가 필요할 때만 차단합니다.</span>
                  <select data-testid="page-builder-manager-seo-robots" value={metadataSeoRobots}
                    onChange={(event) => setMetadataSeoRobots(event.currentTarget.value as PageSeoMetadata['robots'])}>
                    <option value="index">검색 허용</option>
                    <option value="noindex">검색 제외</option>
                  </select>
                </label>
              </fieldset>
              <div className="g7pb-dialog__actions">
                {metadataDocument.public_url && (
                  <button type="button" className="g7pb-button g7pb-button--danger"
                    data-testid="page-builder-manager-unpublish"
                    onClick={() => setUnpublishDocument(metadataDocument)}>공개 해제</button>
                )}
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  onClick={() => closeMetadata()}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-manager-metadata-save" disabled={savingMetadata}>
                  {savingMetadata ? '저장 중' : '초안 정보 저장'}
                </button>
              </div>
            </form>
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

  </>);
}
