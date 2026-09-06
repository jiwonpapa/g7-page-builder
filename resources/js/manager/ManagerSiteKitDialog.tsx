import React, { useEffect, useRef } from 'react';
import type { PageBuilderApiClient } from '../api/pageBuilderApi';
import { useSiteKitInstallation } from './useSiteKitInstallation';
import { editorUrl } from './managerDocumentPresentation';

type Api = Pick<PageBuilderApiClient, 'listSiteKits' | 'previewSiteKit' | 'installSiteKit'>;
export function ManagerSiteKitDialog({ api, locale, onClose }: { api: Api; locale: string; onClose: (installed: boolean) => void }): React.ReactElement {
  const state = useSiteKitInstallation(api, locale);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const locked = state.busy || state.pending !== null;
  return <dialog ref={dialog} className="g7pb-dialog g7pb-dialog--wide" data-testid="site-kit-dialog"
    aria-labelledby="site-kit-heading" aria-busy={state.busy}
    onCancel={event => { if (state.busy) event.preventDefault(); else onClose(state.receipt !== null); }}>
    <div className="g7pb-dialog__heading-row"><div><p className="g7pb-kicker">사이트 구성</p><h2 id="site-kit-heading">사이트 킷</h2></div>
      <button type="button" className="g7pb-button g7pb-button--quiet" disabled={state.busy} onClick={() => onClose(state.receipt !== null)}>닫기</button></div>
    {state.message && <p role="alert">{state.message}</p>}
    {state.receipt ? <section data-testid="site-kit-result">
      <h3>{state.receipt.title} 설치 완료</h3><p>페이지와 헤더·푸터를 초안으로 만들었습니다. 내용을 확인하고 각 페이지를 발행한 뒤 헤더·푸터 세트를 발행·적용해 주세요.</p>
      <ol>{state.receipt.pages.map(page => <li key={page.key}><a href={editorUrl(page.document_id)}>{page.title} 편집</a> · {page.path}</li>)}</ol>
      <p><a className="g7pb-button g7pb-button--primary" data-testid="site-kit-edit-parts"
        href={`/modules/jiwonpapa-page_builder/admin/site-parts?set_id=${encodeURIComponent(state.receipt.set_id)}`}>설치한 헤더·푸터 편집</a></p>
      <p>문의 안내의 연락처와 회사 정보를 실제 정보로 바꿔 주세요.</p>
      <button type="button" className="g7pb-button g7pb-button--quiet" onClick={state.reset}>다른 사이트 구성</button>
    </section> : state.pending ? <section>
      <h3>설치 결과 확인</h3><p>{state.pending.title}</p><p>같은 설치 요청으로 결과를 확인합니다. 이미 설치됐다면 기존 결과를 불러옵니다.</p>
      <button type="button" data-testid="site-kit-retry" className="g7pb-button g7pb-button--primary" disabled={state.busy} onClick={() => void state.install()}>
        {state.busy ? '설치 결과 확인 중…' : '설치 결과 다시 확인'}</button>
    </section> : <>
      {!state.selected ? <section><p>여러 페이지와 공통 헤더·푸터, 메뉴를 함께 준비합니다.</p>
        {state.catalog.map(kit => <article key={kit.id}><h3>{kit.title}</h3><p>{kit.description}</p><p>{kit.pages.map(page => page.title).join(' · ')} · 헤더·푸터</p>
          {kit.compatibility_error && <p role="alert">{kit.compatibility_error}</p>}
          <button type="button" className="g7pb-button g7pb-button--primary" disabled={!kit.compatible} onClick={() => state.choose(kit)}>구성 선택</button></article>)}
        {state.catalog.length === 0 && <button type="button" className="g7pb-button" onClick={state.reload}>목록 다시 불러오기</button>}
      </section> : <form onSubmit={event => { event.preventDefault(); void state.check(); }}>
        <h3>{state.selected.title}</h3>
        <div className="g7pb-dialog__body"><label>설치 이름<input value={state.title} maxLength={80} required disabled={locked} onChange={event => state.setTitle(event.target.value)} /></label>
          {state.selected.pages.map(page => <label key={page.key}>{page.title} 주소<input data-testid={`site-kit-path-${page.key}`}
            value={state.paths[page.key] ?? ''} maxLength={240} required disabled={locked} onChange={event => state.editPath(page.key, event.target.value)} /></label>)}
        </div>
        <p>지정한 주소로 페이지와 메뉴를 연결합니다. 기존 사이트는 유지되고 새 구성은 초안으로 만들어집니다.</p>
        {state.preview && <section data-testid="site-kit-preview" aria-live="polite"><h4>설치 구성 확인</h4>
          <ul>{state.preview.pages.map(page => <li key={page.key}>{page.title} → {page.path}
            {state.preview?.issues[page.key] && <p role="alert">{state.preview.issues[page.key]}</p>}</li>)}</ul>
          <p>헤더·푸터 1세트 · 이미지 {state.preview.media_count}개</p>
          {state.preview.issues.compatibility && <p role="alert">{state.preview.issues.compatibility}</p>}
        </section>}
        <div className="g7pb-dialog__actions"><button type="button" className="g7pb-button g7pb-button--quiet" disabled={locked} onClick={state.reset}>킷 다시 선택</button>
          <button type="submit" className="g7pb-button" disabled={locked}>구성 확인</button>
          <button type="button" data-testid="site-kit-install" className="g7pb-button g7pb-button--primary"
            disabled={locked || !state.preview?.can_install || !state.title.trim()} onClick={() => void state.install()}>새 초안으로 설치</button></div>
      </form>}
    </>}
  </dialog>;
}
