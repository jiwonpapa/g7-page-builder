import React from 'react';
import { Download, ExternalLink, LayoutTemplate, PackagePlus } from 'lucide-react';
import type { useManagerStore } from './useManagerStore';

export function ManagerStoreDialogs({ controller }: { controller: ReturnType<typeof useManagerStore> }): React.ReactElement {
  const { storeOpen, closeStore, storeType, setStoreType, storeQuery, setStoreQuery, storeLoading, visibleStoreProducts,
    storeBusy, installStoreBlockPack, choosePageKit, pageKitProduct, pageKitTitle, setPageKitTitle, pageKitSlug,
    setPageKitSlug, applyPageKit, backToCatalog, exportDocument, exportKitId, setExportKitId, exportKitVersion,
    setExportKitVersion, exportTitle, setExportTitle, exportDescription, setExportDescription, exporting,
    exportPageKit, closeExport } = controller;
  return <>
      {storeOpen && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-store-dialog">
          <section className="g7pb-dialog g7pb-dialog--wide g7pb-store-dialog" role="dialog" aria-modal="true"
            aria-labelledby="g7pb-store-heading">
            <div className="g7pb-dialog__heading-row">
              <div>
                <p className="g7pb-kicker">지원소프트 기본 제공</p>
                <h2 id="g7pb-store-heading">{storeType === 'page_kit' ? '페이지 킷' : '무료 블록 팩 · 페이지 킷'}</h2>
                <p>{storeType === 'page_kit'
                  ? '샘플 이미지와 블록 구성이 완성된 페이지를 선택하면 즉시 편집기로 이동합니다.'
                  : '검증된 공식 자산과 실제 PC·태블릿·모바일 적용 화면만 표시합니다.'}</p>
              </div>
              <button type="button" className="g7pb-button g7pb-button--quiet"
                onClick={() => closeStore()}>닫기</button>
            </div>
            <div className="g7pb-store-tools">
              <label className="g7pb-manager-search">
                <span className="sr-only">기본 제공 항목 검색</span>
                <input type="search" value={storeQuery} placeholder="이름·설명·태그 검색"
                  data-testid="page-builder-store-search"
                  onChange={(event) => setStoreQuery(event.target.value)} />
              </label>
              <div className="g7pb-manager-tabs" role="tablist" aria-label="기본 제공 항목 종류">
                {([['all', '전체'], ['block_pack', '블록 팩'], ['page_kit', '완성 페이지']] as const).map(([value, label]) => (
                  <button type="button" role="tab" key={value} aria-selected={storeType === value}
                    data-testid={`page-builder-store-filter-${value}`}
                    onClick={() => setStoreType(value)}>{label}</button>
                ))}
              </div>
            </div>
            {storeLoading ? (
              <div className="g7pb-manager-loading" role="status">기본 제공 항목을 불러오는 중입니다.</div>
            ) : visibleStoreProducts.length === 0 ? (
              <div className="g7pb-manager-empty"><h3>표시할 무료 상품이 없습니다.</h3><p>검색 조건을 바꾸거나 잠시 뒤 다시 확인해 주세요.</p></div>
            ) : (
              <div className="g7pb-store-grid" data-testid="page-builder-store-products">
                {visibleStoreProducts.map((product) => {
                  const identity = `${product.product_id}@${product.product_version}`;
                  return (
                    <article className="g7pb-store-card" key={identity} data-testid="page-builder-store-product"
                      data-product-type={product.product_type}>
                      <a className="g7pb-store-card__preview" href={product.preview.demo_url ?? product.preview.thumbnail_url}
                        target="_blank" rel="noopener noreferrer" aria-label={`${product.title.ko} 미리보기`}>
                        <img src={product.preview.thumbnail_url} alt="" loading="lazy" />
                        <span>{product.preview.demo_url ? '실제 데모 보기' : '크게 미리보기'} <ExternalLink size={14} aria-hidden="true" /></span>
                      </a>
                      <div className="g7pb-store-card__body">
                        <span className="g7pb-store-card__kind">
                          {product.product_type === 'block_pack' ? <PackagePlus size={15} /> : <LayoutTemplate size={15} />}
                          {product.product_type === 'block_pack' ? 'Block Pack' : 'Page Kit'} · 무료
                        </span>
                        <h3>{product.title.ko}</h3>
                        <p>{product.description.ko}</p>
                        <small>v{product.product_version} · {product.tags.join(' · ')}</small>
                        {product.preview.screenshots.length > 0 && (
                          <small className="g7pb-store-card__screenshots">
                            PC·태블릿·모바일 실제 화면 {product.preview.screenshots.length}장
                          </small>
                        )}
                        {!product.compatible && <strong className="g7pb-store-card__error">{product.compatibility_error}</strong>}
                      </div>
                      <div className="g7pb-store-card__actions">
                        {product.product_type === 'block_pack' ? (
                          <button type="button" className="g7pb-button g7pb-button--primary"
                            data-testid="page-builder-store-install-block-pack"
                            disabled={!product.compatible || product.installed || storeBusy !== null}
                            onClick={() => void installStoreBlockPack(product)}>
                            {product.installed ? '설치됨' : storeBusy === identity ? '검증·설치 중' : '무료 설치'}
                          </button>
                        ) : (
                          <button type="button" className="g7pb-button g7pb-button--primary"
                            data-testid="page-builder-store-apply-page-kit"
                            disabled={!product.compatible || storeBusy !== null}
                            onClick={() => choosePageKit(product)}>새 페이지로 적용</button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {pageKitProduct && (
        <div className="g7pb-dialog-backdrop g7pb-dialog-backdrop--confirm"
          data-testid="page-builder-store-page-kit-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-page-kit-apply-heading">
            <p className="g7pb-kicker">완성 페이지 적용</p>
            <h2 id="g7pb-page-kit-apply-heading">{pageKitProduct.title.ko}</h2>
            <p className="g7pb-dialog__body">기존 페이지는 바꾸지 않습니다. 새 UUID와 새 주소를 가진 미발행 초안으로 만들고, 활성 사이트 템플릿을 사용합니다.</p>
            <div className="g7pb-page-kit-readiness" data-testid="page-builder-store-page-kit-readiness">
              <strong>발행 전에 교체할 항목</strong>
              <ul>
                <li>버튼·기사·자료의 샘플 링크를 실제 경로로 연결합니다.</li>
                <li>포함된 샘플 이미지는 그대로 편집할 수 있으며, 실제 운영 이미지가 있으면 교체합니다.</li>
                <li>문의 폼·위치·일정 등 실제 운영 정보를 최종 확인합니다.</li>
              </ul>
              <p>Hero·팀·후기·연사·기사에 필요한 샘플 이미지가 Page Kit에 포함됩니다.</p>
            </div>
            <form onSubmit={(event) => void applyPageKit(event)}>
              <label>새 페이지 제목
                <input value={pageKitTitle} required autoFocus data-testid="page-builder-store-page-kit-title"
                  onChange={(event) => setPageKitTitle(event.target.value)} />
              </label>
              <label>새 페이지 주소
                <span>영문 소문자, 숫자, 하이픈</span>
                <input value={pageKitSlug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  data-testid="page-builder-store-page-kit-slug"
                  onChange={(event) => setPageKitSlug(event.target.value.toLowerCase())} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={storeBusy !== null} onClick={backToCatalog}>이전</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-store-page-kit-confirm" disabled={storeBusy !== null}>
                  {storeBusy ? '검증·적용 중' : '새 초안 만들기'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {exportDocument && (
        <div className="g7pb-dialog-backdrop" data-testid="page-builder-export-page-kit-dialog">
          <section className="g7pb-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-page-kit-export-heading">
            <p className="g7pb-kicker">지원소프트 배포용</p>
            <h2 id="g7pb-page-kit-export-heading">{exportDocument.title} Page Kit 만들기</h2>
            <p className="g7pb-dialog__body">현재 초안과 Page Builder 미디어를 휴대 가능한 ZIP으로 만듭니다. 발행 상태·홈 지정·리비전·Header·Footer는 포함하지 않습니다.</p>
            <form onSubmit={(event) => void exportPageKit(event)}>
              <label>상품 id
                <input value={exportKitId} required pattern="jiwonpapa/[a-z0-9][a-z0-9._-]{1,63}"
                  data-testid="page-builder-export-page-kit-id"
                  onChange={(event) => setExportKitId(event.target.value.toLowerCase())} />
              </label>
              <label>버전
                <input value={exportKitVersion} required data-testid="page-builder-export-page-kit-version"
                  onChange={(event) => setExportKitVersion(event.target.value)} />
              </label>
              <label>마켓 제목
                <input value={exportTitle} required onChange={(event) => setExportTitle(event.target.value)} />
              </label>
              <label>마켓 설명
                <textarea value={exportDescription} required rows={3}
                  onChange={(event) => setExportDescription(event.target.value)} />
              </label>
              <div className="g7pb-dialog__actions">
                <button type="button" className="g7pb-button g7pb-button--quiet"
                  disabled={exporting} onClick={closeExport}>취소</button>
                <button type="submit" className="g7pb-button g7pb-button--primary"
                  data-testid="page-builder-export-page-kit-confirm" disabled={exporting}>
                  <Download size={15} aria-hidden="true" /> {exporting ? '만드는 중' : '배포 ZIP 다운로드'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
  </>;
}
