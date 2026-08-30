import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puck, usePuck, type Config, type Viewports } from '@puckeditor/core';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Layers3,
  ListTree,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Tablet,
} from 'lucide-react';

import { PageBuilderApiClient, PageBuilderApiError } from '../api/pageBuilderApi';
import type {
  SitePartKind,
  SitePartResource,
  SitePartSetEditorResource,
  SitePartSetResource,
} from '../documents/types';
import {
  type SitePartComponents,
  type SitePartPuckData,
  type SitePartSetPresetKey,
  normalizeSitePartSetPuckData,
  sitePartSetCanonicalToPuck,
  sitePartSetPresetToPuck,
  sitePartSetPuckToCanonical,
} from './sitePartDocumentAdapter';
import {
  SitePartActionBar,
  SitePartDrawerItem,
  sitePartSetConfig,
  SitePartPersona,
  SitePartPersonaSelector,
} from './SitePartEditor';

const VIEWPORTS: Viewports = [
  { width: 360, height: 'auto', label: '모바일', icon: 'Smartphone' },
  { width: 768, height: 'auto', label: '태블릿', icon: 'Tablet' },
  { width: 1280, height: 'auto', label: 'PC', icon: 'Monitor' },
];

const SET_PRESETS: Array<{ key: SitePartSetPresetKey; title: string; description: string }> = [
  { key: 'business', title: '비즈니스', description: '공지·2단 메뉴·문의 CTA·다단 Footer' },
  { key: 'minimal', title: '미니멀', description: '투명 Header·핵심 링크·짧은 Footer' },
  { key: 'community', title: '커뮤니티', description: '게시판 메뉴·회원 동선·정책 Footer' },
];

type LeftPanel = 'sets' | 'blocks' | 'outline';

interface SitePartSetEditorProps {
  locale: string;
  setId: string;
  setTitle: string;
  sets: SitePartSetResource[];
  isActive: boolean;
  onSelectSet: (setId: string) => void;
  onCreateSet: () => void;
  onActivate: () => Promise<void>;
  onChanged: (kind: SitePartKind, resource: SitePartResource) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof PageBuilderApiError) {
    return error.correlationId ? `${error.message} · 문의 번호 ${error.correlationId}` : error.message;
  }
  return error instanceof Error ? error.message : '헤더·푸터 세트를 처리하지 못했습니다.';
}

function SetCanvasLayout({
  panel,
  onPanel,
  sets,
  selectedId,
  dirty,
  onSelectSet,
  onCreateSet,
  onPreset,
  onViewport,
}: {
  panel: LeftPanel;
  onPanel: (panel: LeftPanel) => void;
  sets: SitePartSetResource[];
  selectedId: string;
  dirty: boolean;
  onSelectSet: (setId: string) => void;
  onCreateSet: () => void;
  onPreset: (preset: SitePartSetPresetKey) => void;
  onViewport: (viewport: 'desktop' | 'tablet' | 'mobile') => void;
}): React.ReactElement {
  const { appState, dispatch, history } = usePuck<Config<SitePartComponents>>();
  const width = typeof appState.ui.viewports.current.width === 'number' ? appState.ui.viewports.current.width : 1280;
  const viewport = width <= 360 ? 'mobile' : width <= 768 ? 'tablet' : 'desktop';
  const changeViewport = (nextWidth: number): void => {
    onViewport(nextWidth <= 360 ? 'mobile' : nextWidth <= 768 ? 'tablet' : 'desktop');
    dispatch({
      type: 'setUi',
      ui: { viewports: { current: { width: nextWidth, height: 'auto' }, controlsVisible: false, options: VIEWPORTS } },
      recordHistory: false,
    });
  };

  return <div className="g7pb-site-part-set-layout" data-testid="page-builder-site-part-set-layout">
    <aside className="g7pb-site-part-set-layout__left">
      <nav className="g7pb-site-part-set-layout__tabs" aria-label="편집 도구">
        <button type="button" aria-current={panel === 'sets' ? 'page' : undefined} onClick={() => onPanel('sets')}><Layers3 size={17} /> Sets</button>
        <button type="button" aria-current={panel === 'blocks' ? 'page' : undefined} onClick={() => onPanel('blocks')}><Plus size={17} /> Blocks</button>
        <button type="button" aria-current={panel === 'outline' ? 'page' : undefined} onClick={() => onPanel('outline')}><ListTree size={17} /> Outline</button>
      </nav>
      <div className="g7pb-site-part-set-layout__panel" data-panel={panel}>
        {panel === 'sets' ? <>
          <header className="g7pb-site-part-set-panel-heading"><div><strong>헤더·푸터 세트</strong><span>Header와 Footer를 함께 선택합니다.</span></div><button type="button" onClick={onCreateSet}><Plus size={16} /> 새 세트</button></header>
          <div className="g7pb-site-part-set-list">
            {sets.map((set) => <button key={set.id} type="button" data-testid="page-builder-site-part-set" aria-current={set.id === selectedId ? 'true' : undefined} onClick={() => onSelectSet(set.id)}>
              <span><strong>{set.title}</strong>{set.is_active ? <em><Check size={12} /> 사용 중</em> : null}</span>
              <small>Header·Footer {set.is_ready ? '발행 가능' : '편집 중'}</small>
            </button>)}
          </div>
          <section className="g7pb-site-part-set-presets" data-testid="page-builder-site-part-set-presets">
            <header><strong>세트 프리셋</strong><span>Header와 Footer를 동시에 교체합니다.</span></header>
            {SET_PRESETS.map((preset) => <button key={preset.key} type="button" onClick={() => onPreset(preset.key)}>
              <strong>{preset.title}</strong><span>{preset.description}</span>
            </button>)}
          </section>
        </> : panel === 'blocks' ? <Puck.Components /> : <Puck.Outline />}
      </div>
    </aside>

    <section className="g7pb-site-part-set-layout__canvas">
      <div className="g7pb-site-part-set-layout__canvas-bar">
        <div className="g7pb-site-part-set-history">
          <button type="button" aria-label="실행 취소" disabled={!history.hasPast} onClick={() => history.back()}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="다시 실행" disabled={!history.hasFuture} onClick={() => history.forward()}><ChevronRight size={18} /></button>
        </div>
        <div className="g7pb-site-part-viewports" aria-label="반응형 화면">
          <button type="button" aria-pressed={viewport === 'mobile'} onClick={() => changeViewport(360)}><Smartphone size={16} /> 모바일</button>
          <button type="button" aria-pressed={viewport === 'tablet'} onClick={() => changeViewport(768)}><Tablet size={16} /> 태블릿</button>
          <button type="button" aria-pressed={viewport === 'desktop'} onClick={() => changeViewport(1280)}><Monitor size={16} /> PC</button>
        </div>
        <span>{viewport === 'desktop' ? 'PC 편집 모드' : '모바일·태블릿은 확인 전용 · 편집은 PC에서 지원'}{dirty ? ' · 저장할 변경 있음' : ''}</span>
      </div>
      <div className="g7pb-site-part-set-layout__preview" data-viewport={viewport}>
        <Puck.Preview id="g7pb-site-part-set-preview" />
      </div>
    </section>

    <aside className="g7pb-site-part-set-layout__inspector" aria-label="선택한 블록 설정">
      <header><strong>설정</strong><span>선택한 블록의 내용과 기기별 표시</span></header>
      {viewport === 'desktop' ? <Puck.Fields wrapFields /> : <div className="g7pb-site-part-set-layout__preview-only">
        <strong>확인 전용 화면입니다.</strong>
        <span>PC로 돌아가 블록 내용과 기기별 표시를 편집하세요.</span>
      </div>}
    </aside>
  </div>;
}

export function SitePartSetEditor({
  locale,
  setId,
  setTitle,
  sets,
  isActive,
  onSelectSet,
  onCreateSet,
  onActivate,
  onChanged,
}: SitePartSetEditorProps): React.ReactElement {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const config = useMemo(() => sitePartSetConfig(), []);
  const [persona, setPersona] = useState<'guest' | 'member' | 'admin'>('guest');
  const [resources, setResources] = useState<SitePartSetEditorResource | null>(null);
  const [data, setData] = useState<SitePartPuckData>({ root: { props: {} }, content: [] });
  const [panel, setPanel] = useState<LeftPanel>('sets');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorViewport, setEditorViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [editorRevision, setEditorRevision] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const resourcesRef = useRef(resources);
  const dataRef = useRef(data);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const revisionRef = useRef(0);
  const setSummaryRef = useRef({ sets, setTitle, isActive });
  setSummaryRef.current = { sets, setTitle, isActive };

  const applyResources = useCallback((next: SitePartSetEditorResource, resetData: boolean): void => {
    resourcesRef.current = next;
    setResources(next);
    onChanged('header', next.header);
    onChanged('footer', next.footer);
    if (resetData) {
      const nextData = sitePartSetCanonicalToPuck(next.header.document, next.footer.document);
      dataRef.current = nextData;
      setData(nextData);
      dirtyRef.current = false;
      setDirty(false);
    }
  }, [onChanged]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.getSitePart('header', locale, setId),
      api.getSitePart('footer', locale, setId),
    ]).then(([header, footer]) => {
      if (!active) return;
      applyResources({
        set: setSummaryRef.current.sets.find((set) => set.id === setId) ?? {
          id: setId, title: setSummaryRef.current.setTitle, locale, is_active: setSummaryRef.current.isActive, is_ready: false,
          header: { site_part_id: header.document.site_part_id, revision: header.revision, active_revision: header.active_revision, status: header.status, updated_at: header.updated_at },
          footer: { site_part_id: footer.document.site_part_id, revision: footer.revision, active_revision: footer.active_revision, status: footer.status, updated_at: footer.updated_at },
          created_at: null, updated_at: null,
        },
        header,
        footer,
      }, true);
      setMessage(null);
    }).catch((error: unknown) => {
      if (active) setMessage(errorMessage(error));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [api, applyResources, locale, setId]);

  const save = useCallback(async (): Promise<SitePartSetEditorResource | null> => {
    const current = resourcesRef.current;
    if (!current || savingRef.current) return current;
    const revision = revisionRef.current;
    const split = sitePartSetPuckToCanonical(dataRef.current, current.header.document, current.footer.document);
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const next = await api.saveSitePartSet(setId,
        { title: current.header.title, document: split.header, lock_version: current.header.lock_version },
        { title: current.footer.title, document: split.footer, lock_version: current.footer.lock_version });
      const unchanged = revisionRef.current === revision;
      applyResources(next, unchanged);
      if (!unchanged) {
        dirtyRef.current = true;
        setDirty(true);
      }
      return next;
    } catch (error) {
      setMessage(errorMessage(error));
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [api, applyResources, setId]);

  useEffect(() => {
    if (!dirty || saving || loading) return undefined;
    const timer = window.setTimeout(() => { void save(); }, 1_500);
    return () => window.clearTimeout(timer);
  }, [dirty, loading, save, saving]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent): void => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const publish = async (): Promise<void> => {
    const saved = dirtyRef.current ? await save() : resourcesRef.current;
    if (!saved) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const next = await api.publishSitePartSet(setId, locale, saved.header.lock_version, saved.footer.lock_version);
      applyResources(next, true);
      setMessage('Header와 Footer를 한 세트로 발행했습니다.');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const update = (next: SitePartPuckData): void => {
    const normalized = normalizeSitePartSetPuckData(next);
    dataRef.current = normalized;
    setData(normalized);
    revisionRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setMessage(null);
  };

  const applyPreset = (preset: SitePartSetPresetKey): void => {
    const current = resourcesRef.current;
    if (!current) return;
    if (dirtyRef.current && !window.confirm('저장하지 않은 변경을 세트 프리셋으로 바꾸시겠습니까?')) return;
    const next = sitePartSetPresetToPuck(current.header.document, current.footer.document, preset);
    dataRef.current = next;
    setData(next);
    setEditorRevision((value) => value + 1);
    revisionRef.current += 1;
    dirtyRef.current = true;
    setDirty(true);
    setMessage('Header와 Footer 프리셋을 함께 적용했습니다.');
  };

  const selectSet = (nextId: string): void => {
    if (nextId === setId) return;
    if (dirtyRef.current && !window.confirm('저장하지 않은 변경이 있습니다. 다른 세트로 이동하시겠습니까?')) return;
    onSelectSet(nextId);
  };

  const overrides = useMemo(() => ({
    drawerItem: SitePartDrawerItem,
    actionBar: SitePartActionBar,
  }), []);
  const ready = Boolean(resources?.header.active_revision && resources?.footer.active_revision);

  return <SitePartPersona.Provider value={persona}><section className="g7pb-site-part-set-editor" data-testid="page-builder-site-part-set-editor" aria-busy={loading}>
    <header className="g7pb-site-part-set-editor__command">
      <div><p>{isActive ? '현재 사이트에 적용 중' : '편집 중인 세트'}</p><h1>{setTitle}</h1><span>Header와 Footer를 한 작업면에서 편집합니다.</span></div>
      <div>
        <span className="g7pb-status" data-state={dirty ? 'dirty' : 'saved'}>{saving ? '저장 중' : dirty ? '저장할 변경 있음' : '저장됨'}</span>
        <button type="button" className="g7pb-button g7pb-button--quiet" data-testid="page-builder-site-part-set-save" disabled={loading || saving || !resources} onClick={() => void save()}><Save size={17} /> 저장</button>
        <button type="button" className="g7pb-button g7pb-button--primary" disabled={loading || saving || !resources} data-testid="page-builder-site-part-set-publish" onClick={() => void publish()}><CloudUpload size={17} /> 세트 발행</button>
        <button type="button" className="g7pb-button g7pb-button--quiet" disabled={!ready || isActive || saving} data-testid="page-builder-site-part-set-activate" onClick={() => void onActivate()}><Check size={17} /> {isActive ? '사용 중' : ready ? '이 세트 사용' : '발행 후 사용'}</button>
      </div>
    </header>
    <SitePartPersonaSelector value={persona} onChange={setPersona} />
    {message ? <div className="g7pb-notice" role="alert"><span>{message}</span><button type="button" className="g7pb-notice__dismiss" onClick={() => setMessage(null)}>닫기</button></div> : null}
    {loading ? <div className="g7pb-loading">헤더·푸터 세트를 준비하는 중입니다.</div> : resources ? <Puck
      key={`${setId}:${resources.header.document.site_part_id}:${resources.footer.document.site_part_id}:${editorRevision}`}
      config={config}
      data={data}
      height="100%"
      iframe={{ enabled: true, syncHostStyles: true, waitForStyles: false }}
      viewports={VIEWPORTS}
      ui={{ itemSelector: data.content.length > 0 ? { index: 0, zone: 'root:default-zone' } : null, viewports: { current: { width: 1280, height: 'auto' }, controlsVisible: false, options: VIEWPORTS } }}
      permissions={{ edit: editorViewport === 'desktop', insert: editorViewport === 'desktop', delete: editorViewport === 'desktop', duplicate: false, drag: false }}
      overrides={overrides}
      onChange={update}
      onPublish={() => void publish()}
    >
      <SetCanvasLayout panel={panel} onPanel={setPanel} sets={sets} selectedId={setId} dirty={dirty} onSelectSet={selectSet} onCreateSet={onCreateSet} onPreset={applyPreset} onViewport={setEditorViewport} />
    </Puck> : null}
  </section></SitePartPersona.Provider>;
}
