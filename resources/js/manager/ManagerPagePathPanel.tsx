import React, { useEffect, useRef, useState } from 'react';
import type { PageBuilderApiClient } from '../api/pageBuilderApi';
import type { PagePathResource } from '../api/pagePath';

type PathApi = Pick<PageBuilderApiClient, 'getPagePath' | 'setPagePath'>;
interface Props { api: PathApi; documentId: string; }

export function ManagerPagePathPanel({ api, documentId }: Props): React.ReactElement {
  const [open, setOpen] = useState(false);
  return <details className="g7pb-metadata-section" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary data-testid="page-builder-path-open">주소 할당·메뉴 연결</summary>
    {open && <PagePathEditor key={documentId} api={api} documentId={documentId} />}
  </details>;
}

function PagePathEditor({ api, documentId }: Props): React.ReactElement {
  const [resource, setResource] = useState<PagePathResource | null>(null);
  const [path, setPath] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const owner = useRef({ active: false, generation: 0, pending: false });
  useEffect(() => {
    owner.current.active = true; owner.current.generation += 1; owner.current.pending = false;
    const generation = owner.current.generation;
    const current = () => owner.current.active && owner.current.generation === generation;
    setLoading(true); setSaving(false); setMessage(null); setResource(null);
    void api.getPagePath(documentId).then(result => {
      if (current()) { setResource(result); setPath(result.path ?? ''); }
    }).catch(error => { if (current()) setMessage(error instanceof Error ? error.message : '주소를 불러오지 못했습니다.'); })
      .finally(() => { if (current()) setLoading(false); });
    return () => { owner.current.active = false; };
  }, [api, documentId, reload]);

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!resource || loading || owner.current.pending) return;
    const generation = owner.current.generation;
    const current = () => owner.current.active && owner.current.generation === generation;
    owner.current.pending = true; setSaving(true); setMessage(null);
    try {
      const result = await api.setPagePath(documentId, path.trim() || null, resource.lock_version);
      if (current()) { setResource(result); setPath(result.path ?? ''); setMessage(result.active ? '주소가 연결되었습니다.' : '주소 설정을 저장했습니다.'); }
    } catch (error) { if (current()) setMessage(error instanceof Error ? error.message : '주소를 저장하지 못했습니다.'); }
    finally { if (current()) { owner.current.pending = false; setSaving(false); } }
  };
  const copy = async (): Promise<void> => {
    if (!resource?.path) return;
    const generation = owner.current.generation;
    try {
      await navigator.clipboard.writeText(resource.path);
      if (owner.current.active && owner.current.generation === generation) setMessage('주소를 복사했습니다. 헤더·푸터 편집에서 메뉴 링크 주소로 붙여 넣어 주세요.');
    } catch {
      if (owner.current.active && owner.current.generation === generation) setMessage('주소 입력란의 값을 직접 복사해 주세요.');
    }
  };
  return <div data-testid="page-builder-path-panel" aria-busy={loading || saving}>
    <p>사이트 메뉴는 발행한 헤더·푸터에서 연결합니다. 템플릿 기본 메뉴를 쓰는 사이트는 해당 템플릿의 메뉴 편집을 이용해 주세요.</p>
    <p>페이지에 /about 같은 주소를 추가합니다. 기본 /pages/주소도 유지됩니다.</p>
    <p>활성 사이트 템플릿 방식으로 발행하면 연결됩니다. 발행된 페이지의 주소 변경·해제는 즉시 적용됩니다.</p>
    <form onSubmit={event => void save(event)}>
      <label>추가 페이지 주소
        <input data-testid="page-builder-path-input" value={path} placeholder="/about 또는 /company/about" maxLength={240}
          disabled={loading || saving || !resource} onChange={event => { setPath(event.target.value); setMessage(null); }} />
      </label>
      <p>비워서 저장하면 추가 주소만 해제하며 페이지와 발행본은 유지됩니다.</p>
      <div className="g7pb-dialog__actions">
        <button type="submit" className="g7pb-button g7pb-button--primary" data-testid="page-builder-path-save" disabled={loading || saving || !resource}>
          {saving ? '저장 중' : '주소 저장'}
        </button>
        {resource?.path && <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => void copy()}>주소 복사</button>}
        {resource?.active && resource.path && <a className="g7pb-button g7pb-button--quiet" data-testid="page-builder-path-visit" href={resource.path} target="_blank" rel="noreferrer">연결한 페이지 보기</a>}
        <a className="g7pb-button g7pb-button--quiet" href="/modules/jiwonpapa-page_builder/admin/site-parts" target="_blank" rel="noreferrer">헤더·푸터 메뉴 편집</a>
      </div>
    </form>
    {loading && <p role="status">주소를 불러오는 중입니다.</p>}
    {resource && <p data-testid="page-builder-path-status">{resource.active ? '연결됨' : resource.reason ?? '추가 주소 없음'}</p>}
    {message && <p role="status">{message}</p>}
    {!loading && !resource && <button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setReload(value => value + 1)}>다시 불러오기</button>}
  </div>;
}
