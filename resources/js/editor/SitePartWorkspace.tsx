import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CirclePlus, PanelsTopLeft } from 'lucide-react';

import {
  PAGE_BUILDER_MANAGER_PATH,
  PageBuilderApiClient,
  PageBuilderApiError,
} from '../api/pageBuilderApi';
import type {
  SitePartKind,
} from '../documents/types';
import type { SitePartResource, SitePartSetPartSummary, SitePartSetResource } from '../api/resources';
import { SitePartSetEditor } from './SitePartSetEditor';

interface SitePartWorkspaceProps {
  locale: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) {
    return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  }
  return error instanceof Error ? error.message : '헤더·푸터 세트를 불러오지 못했습니다.';
}

function summary(resource: SitePartResource): SitePartSetPartSummary {
  return {
    site_part_id: resource.document.site_part_id,
    revision: resource.revision,
    active_revision: resource.active_revision,
    status: resource.status,
    updated_at: resource.updated_at,
  };
}

export function SitePartWorkspace({ locale }: SitePartWorkspaceProps): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const [sets, setSets] = useState<SitePartSetResource[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      let items = (await api.listSitePartSets(locale)).items;
      if (items.length === 0) {
        items = [await api.createSitePartSet('기본 세트', locale)];
      }
      setSets(items);
      setSelectedId((current) => current && items.some((item) => item.id === current)
        ? current
        : (items.find((item) => item.is_active)?.id ?? items[0]?.id ?? null));
      setMessage(null);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [api, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = sets.find((set) => set.id === selectedId) ?? null;

  const createSet = async (): Promise<void> => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    setBusy(true);
    setMessage(null);
    try {
      const created = await api.createSitePartSet(nextTitle, locale);
      setSets((current) => [...current, created]);
      setSelectedId(created.id);
      setTitle('');
      setCreateOpen(false);
      setMessage('새 세트를 만들었습니다. Header와 Footer를 모두 발행하면 사용할 수 있습니다.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const activate = async (): Promise<void> => {
    if (!selected || !selected.is_ready || selected.is_active) return;
    setBusy(true);
    setMessage(null);
    try {
      const activated = await api.activateSitePartSet(selected.id, locale);
      setSets((current) => current.map((item) => item.id === activated.id
        ? activated
        : { ...item, is_active: false }));
      setMessage(`사용 중인 사이트 공통 영역: ${activated.title}`);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const updatePart = useCallback((kind: SitePartKind, resource: SitePartResource): void => {
    setSets((current) => current.map((set) => {
      if (set.id !== resource.set_id) return set;
      const next = { ...set, [kind]: summary(resource) } as SitePartSetResource;
      return {
        ...next,
        is_ready: next.header.active_revision !== null && next.footer.active_revision !== null,
      };
    }));
  }, []);

  return <main className="g7pb-root g7pb-site-parts-workspace" data-testid="page-builder-site-part-workspace" aria-busy={loading || busy}>
    <header className="g7pb-site-parts-workspace__header">
      <div className="g7pb-site-parts-workspace__identity">
        <a href={PAGE_BUILDER_MANAGER_PATH} className="g7pb-icon-link" aria-label="문서함으로 돌아가기"><ArrowLeft size={18} /></a>
        <span className="g7pb-product-mark" aria-hidden="true"><PanelsTopLeft size={20} /></span>
        <div><p>Site Parts</p><h1>헤더·푸터</h1><span>사이트 공통 영역을 한 화면에서 관리합니다.</span></div>
      </div>
      <button type="button" className="g7pb-button g7pb-button--primary" data-testid="page-builder-site-part-set-create" onClick={() => setCreateOpen(true)}>
        <CirclePlus size={17} /> 새 세트
      </button>
    </header>

    {message ? <div className="g7pb-site-parts-workspace__notice" role="alert">{message}</div> : null}

    <div className="g7pb-site-parts-workspace__layout">
      {selected ? <SitePartSetEditor
        key={selected.id}
        locale={locale}
        setId={selected.id}
        setTitle={selected.title}
        sets={sets}
        isActive={selected.is_active}
        onSelectSet={setSelectedId}
        onCreateSet={() => setCreateOpen(true)}
        onActivate={activate}
        onChanged={updatePart}
      /> : !loading ? <div className="g7pb-site-part-pair__empty"><h2>사용할 세트가 없습니다.</h2><p>새 세트를 만들어 Header와 Footer 편집을 시작하세요.</p></div> : null}
    </div>

    {createOpen ? <div className="g7pb-dialog-backdrop" role="presentation">
      <section className="g7pb-site-part-set-dialog" role="dialog" aria-modal="true" aria-labelledby="g7pb-site-part-set-create-title">
        <p>새 공통 영역</p><h2 id="g7pb-site-part-set-create-title">헤더·푸터 세트 만들기</h2>
        <label><span>세트 이름</span><input autoFocus value={title} maxLength={255} placeholder="예: 회사 기본형" data-testid="page-builder-site-part-set-title" onChange={(event) => setTitle(event.target.value)} /></label>
        <div><button type="button" className="g7pb-button g7pb-button--quiet" onClick={() => setCreateOpen(false)}>취소</button><button type="button" className="g7pb-button g7pb-button--primary" disabled={busy || !title.trim()} onClick={() => void createSet()}>만들기</button></div>
      </section>
    </div> : null}
  </main>;
}
