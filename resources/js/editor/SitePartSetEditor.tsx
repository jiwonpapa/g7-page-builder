import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Puck, type Viewports } from '@puckeditor/core';
import {
  Check,
  CloudUpload,
  Save,
} from 'lucide-react';

import { SitePartSetLayoutContext, SitePartSetTools, SitePartSetFields, SITE_PART_SET_PLUGINS } from './SitePartSetLayout';
import { PageBuilderApiClient, PageBuilderApiError } from '../api/pageBuilderApi';
import type {
  SitePartKind,
  SitePartResource,
  SitePartSetEditorResource,
  SitePartSetResource,
} from '../documents/types';
import {
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
  withSitePartPermissions,
  SitePartPersona,
  SitePartPersonaSelector,
} from './SitePartEditor';

const VIEWPORTS: Viewports = [
  { width: 360, height: 'auto', label: '모바일', icon: 'Smartphone' },
  { width: 768, height: 'auto', label: '태블릿', icon: 'Tablet' },
  { width: 1280, height: 'auto', label: 'PC', icon: 'Monitor' },
];

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
  const [persona, setPersona] = useState<'guest' | 'member' | 'admin'>('guest');
  const [resources, setResources] = useState<SitePartSetEditorResource | null>(null);
  const [data, setData] = useState<SitePartPuckData>({ root: { props: {} }, content: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorViewport, setEditorViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const baseConfig = useMemo(() => sitePartSetConfig(), []);
  const config = useMemo(() => withSitePartPermissions(baseConfig, data, editorViewport === 'desktop'), [baseConfig, data, editorViewport]);
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
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      const split = sitePartSetPuckToCanonical(dataRef.current, current.header.document, current.footer.document);
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

  const applyPreset = (preset: SitePartSetPresetKey, apply: (data: SitePartPuckData) => void): void => {
    const current = resourcesRef.current;
    if (!current) return;
    if (dirtyRef.current && !window.confirm('저장하지 않은 변경을 세트 프리셋으로 바꾸시겠습니까?')) return;
    const next = sitePartSetPresetToPuck(current.header.document, current.footer.document, preset);
    apply(next);
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
    header: SitePartSetTools,
    fields: SitePartSetFields,
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
    <SitePartSetLayoutContext.Provider value={{ sets, selectedId: setId, dirty, onSelectSet: selectSet, onCreateSet, onPreset: applyPreset, onViewport: setEditorViewport }}>
    {loading ? <div className="g7pb-loading">헤더·푸터 세트를 준비하는 중입니다.</div> : resources ? <Puck
      key={`${setId}:${resources.header.document.site_part_id}:${resources.footer.document.site_part_id}`}
      config={config}
      plugins={SITE_PART_SET_PLUGINS}
      data={data}
      height="100%"
      iframe={{ enabled: true, syncHostStyles: true, waitForStyles: false }}
      viewports={VIEWPORTS}
      ui={{ plugin: { current: 'sets' }, leftSideBarVisible: true, rightSideBarVisible: true, itemSelector: data.content.length > 0 ? { index: 0, zone: 'root:default-zone' } : null, viewports: { current: { width: 1280, height: 'auto' }, controlsVisible: false, options: VIEWPORTS } }}
      permissions={{ edit: editorViewport === 'desktop', insert: editorViewport === 'desktop', delete: editorViewport === 'desktop', duplicate: false, drag: false }}
      overrides={overrides}
      onChange={update}
      onPublish={() => void publish()}
    /> : null}
    </SitePartSetLayoutContext.Provider>
  </section></SitePartPersona.Provider>;
}
