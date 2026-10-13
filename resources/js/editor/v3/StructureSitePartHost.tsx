import React, { useEffect, useRef, useState } from 'react';
import type { SitePartSetResource } from '../../api/resources';
import type { ElementPartPair } from '../../api/elementSitePartResource';
import type { SitePartHostPorts } from './sitePartPorts';
import { SitePartPairEditor } from './SitePartPairEditor';
import { sitePartEditorUrl } from '../sitePartEditorRouting';

export function StructureSitePartHost({ ports, locale, setId, compositions = [], catalogMessage, libraryUrl }: {
  ports: SitePartHostPorts; locale: string; setId?: string; compositions?: readonly unknown[]; catalogMessage?: string; libraryUrl: string;
}) {
  const [sets, setSets] = useState<SitePartSetResource[]>([]);
  const [pair, setPair] = useState<ElementPartPair | null>(null);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [creating, setCreating] = useState(!setId), [title, setTitle] = useState('');
  const state = useRef({ generation: 0, active: false, pending: false, unsafe: false });
  const current = (generation: number) => state.current.active && state.current.generation === generation;
  const failure = (cause: unknown) => setError(cause instanceof Error ? cause.message : '공통영역을 불러오지 못했습니다.');
  const load = async (set: SitePartSetResource, generation: number) => {
    const value = await ports.load(set);
    if (!current(generation)) return;
    if ('legacy' in value) ports.navigate(sitePartEditorUrl(set.id, locale, false));
    else { state.current.unsafe = false; setPair(value); setCreating(false); ports.selected(set.id); }
  };
  useEffect(() => {
    const generation = ++state.current.generation;
    state.current.active = true; state.current.pending = true; state.current.unsafe = false;
    setBusy(true); setError(''); setPair(null); setCreating(!setId);
    void ports.list(locale).then(async values => {
      if (!current(generation)) return;
      setSets(values);
      if (setId) {
        const set = values.find(item => item.id === setId);
        if (!set) throw new Error('요청한 공통영역 세트를 찾을 수 없습니다.');
        await load(set, generation);
      }
    }).catch(cause => { if (current(generation)) failure(cause); })
      .finally(() => { if (current(generation)) { state.current.pending = false; setBusy(false); } });
    return () => { state.current.active = false; state.current.generation++; };
  }, [ports, locale, setId]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!state.current.unsafe) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  const canLeave = () => !state.current.unsafe || ports.confirmLeave();
  const select = async (id: string) => {
    if (state.current.pending || !canLeave()) return;
    const set = sets.find(item => item.id === id);
    if (!set) return;
    const generation = ++state.current.generation;
    state.current.pending = true; setBusy(true); setError('');
    try { await load(set, generation); } catch (cause) { if (current(generation)) failure(cause); }
    finally { if (current(generation)) { state.current.pending = false; setBusy(false); } }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || state.current.pending || !canLeave()) return;
    const generation = ++state.current.generation;
    state.current.pending = true; setBusy(true); setError('');
    try {
      const set = await ports.create(title.trim(), locale);
      if (!current(generation)) return;
      setSets(values => [...values, set]); setTitle('');
      await load(set, generation);
    } catch (cause) { if (current(generation)) failure(cause); }
    finally { if (current(generation)) { state.current.pending = false; setBusy(false); } }
  };
  return <section className="g7pb-root g7pb-structure-host" aria-label="헤더·푸터 정밀 편집" data-testid="structure-site-part-host">
    <header className="g7pb-structure-host__bar">
      <a className="g7pb-button g7pb-button--quiet" href={libraryUrl} onClick={event => {
        event.preventDefault(); if (canLeave()) ports.navigate(libraryUrl);
      }}>문서함</a>
      <h1>{pair?.set.title ?? '헤더·푸터 정밀 편집'}</h1>
      <label>공통영역 세트<select aria-label="공통영역 세트" value={pair?.set.id ?? ''} disabled={busy}
        onChange={event => void select(event.target.value)}><option value="" disabled>세트 선택</option>
        {sets.map(set => <option key={set.id} value={set.id}>{set.title}{set.is_active ? ' · 사용 중' : ''}</option>)}</select></label>
      <button className="g7pb-button g7pb-button--quiet" type="button" disabled={busy} onClick={() => {
        if (canLeave()) { setCreating(true); setPair(null); state.current.unsafe = false; }
      }}>새 정밀 세트</button>
    </header>
    {catalogMessage && <p className="g7pb-structure-host__catalog" role="status">{catalogMessage}</p>}
    {error && <p className="g7pb-structure-host__error" role="alert">{error}</p>}
    {creating && <form className="g7pb-structure-host__create" onSubmit={event => void create(event)}>
      <h2>빈 Header·Footer로 시작</h2><p>본문과 같은 요소로 편집합니다. 기존 세트는 변환하거나 덮어쓰지 않습니다.</p>
      <label>세트 이름<input required maxLength={255} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <button className="g7pb-button g7pb-button--primary" disabled={busy || !title.trim()} type="submit">빈 정밀 세트 만들기</button>
    </form>}
    {pair && <SitePartPairEditor key={pair.set.id} initial={pair} ports={ports} compositions={compositions} disabled={busy}
      onUnsafe={unsafe => { state.current.unsafe = unsafe; }} onSet={value => {
        setSets(values => values.map(set => set.id === value.set.id ? value.set : value.set.is_active ? { ...set, is_active: false } : set));
      }} />}
  </section>;
}
