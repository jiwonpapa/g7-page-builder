import React, { useEffect, useRef, useState } from 'react';
import { NATIVE_COMPOSITION_SCHEMA, type NativeCompositionSummary } from '../domain/composition';
import { insertSavedComposition, saveComposition } from '../application/compositions';
import type { NativeHost, NativeMediaResult } from '../ports/host';
import type { NativeCompositionLibrary } from '../ports/compositions';

export function NativeCompositions({ host, library }: { host: NativeHost; library: NativeCompositionLibrary }): React.ReactElement {
  const [title, setTitle] = useState(''); const [items, setItems] = useState<NativeCompositionSummary[]>([]);
  const [page, setPage] = useState(1); const [more, setMore] = useState(false); const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const stamp = JSON.stringify(host.context);
  useEffect(() => {
    request.current?.abort(); setBusy(false); setTarget(''); setDeleting(null); setMessage(''); setItems([]); setLoaded(false);
    return () => { request.current?.abort(); };
  }, [stamp]);
  const slots = host.collections?.filter(slot => slot.editable && slot.kind !== 'array') ?? [];
  const supported = !!host.compositions && !host.context.readonly && host.context.editMode === 'route';
  async function refresh(signal: AbortSignal, nextPage: number): Promise<NativeMediaResult<null>> {
    const result = await library.page(nextPage, signal);
    if (signal.aborted) return { ok: false, reason: 'cancelled' };
    if (!result.ok) return result;
    setItems(result.data.items); setMore(result.data.hasMore); setPage(nextPage); setLoaded(true);
    return { ok: true, data: null };
  }
  async function run(action: (signal: AbortSignal) => Promise<NativeMediaResult<null>>, success = ''): Promise<void> {
    request.current?.abort(); const active = new AbortController(); request.current = active; setBusy(true); setMessage('');
    try {
      const result = await action(active.signal);
      if (!active.signal.aborted && request.current === active) setMessage(result.ok ? success : result.reason);
    } catch { if (!active.signal.aborted) setMessage('요청을 완료하지 못했습니다. 다시 시도해 주세요.'); }
    finally { if (!active.signal.aborted && request.current === active) setBusy(false); }
  }
  return <section aria-label="내 조합" className="g7pb-native-compositions">
    <h3>내 조합</h3>
    <p className="g7pb-native-note">현재 선택과 내부 구성을 개인 조합으로 저장합니다. 삽입본은 독립 사본입니다.</p>
    {!supported && <p role="status">이 호스트 또는 선택은 조합 저장·삽입을 지원하지 않습니다.</p>}
    <form onSubmit={event => { event.preventDefault(); void run(async signal => {
      const saved = await saveComposition(host, library, title, signal);
      if (!saved.ok) return saved;
      setTitle(''); return refresh(signal, 1);
    }, '내 조합에 저장했습니다.'); }}>
      <label>조합 이름<input aria-label="조합 이름" maxLength={120} value={title} onChange={event => setTitle(event.target.value)} disabled={busy || !supported} /></label>
      <button type="submit" disabled={busy || !supported || !title.trim()}>선택 항목을 내 조합에 저장</button>
    </form>
    <button type="button" disabled={busy} onClick={() => { void run(signal => refresh(signal, 1)); }}>조합 목록 새로고침</button>
    {loaded && items.length === 0 && <p>저장한 조합이 없습니다. 항목을 선택하고 이름을 입력해 저장해 주세요.</p>}
    {slots.length > 0 && <label>조합 삽입 위치<select aria-label="조합 삽입 위치" value={target} disabled={busy || !supported} onChange={event => setTarget(event.target.value)}>
      <option value="">위치를 선택해 주세요</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{slot.label}</option>)}
    </select></label>}
    <ul>{items.map(item => <li key={item.id}>
      <strong>{item.title}</strong>
      {item.schemaVersion !== NATIVE_COMPOSITION_SCHEMA && <p>지원하지 않는 조합 버전입니다. 원본을 보존합니다.</p>}
      <div className="g7pb-native-actions">
        <button type="button" disabled={busy || !supported || !target || item.schemaVersion !== NATIVE_COMPOSITION_SCHEMA}
          onClick={() => { void run(signal => insertSavedComposition(host, library, item.id, target, signal), '삽입했습니다. 상단 저장으로 공개 페이지에 반영하세요.'); }}>조합 삽입</button>
        <button type="button" disabled={busy} onClick={() => setDeleting(item.id)}>목록에서 삭제</button>
      </div>
      {deleting === item.id && <div><p>이 조합을 목록에서 삭제하시겠습니까? 이미 삽입한 사본과 이미지는 유지됩니다.</p>
        <button type="button" disabled={busy} onClick={() => { void run(async signal => {
          const removed = await library.delete(item.id, signal); if (!removed.ok || signal.aborted) return removed;
          setDeleting(null); return refresh(signal, page);
        }, '목록에서 삭제했습니다.'); }}>삭제 확인</button>
        <button type="button" disabled={busy} onClick={() => setDeleting(null)}>취소</button></div>}
    </li>)}</ul>
    {loaded && <div className="g7pb-native-actions"><button type="button" disabled={busy || page === 1} onClick={() => { void run(signal => refresh(signal, page - 1)); }}>이전 조합</button>
      <span>{page} 페이지</span><button type="button" disabled={busy || !more} onClick={() => { void run(signal => refresh(signal, page + 1)); }}>다음 조합</button></div>}
    <p role="status">{busy ? '처리 중입니다.' : message}</p>
  </section>;
}

