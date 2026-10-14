import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createCompositionLibrarySession, type CompositionContext, type CompositionLibraryPort, type UserComposition } from '../../editor-application/v3/compositionLibrary';
import type { CompositionChoice } from '../../editor-application/v3/compositions';
import { InputButton } from './TypedInput';

export function UserCompositionPanel({ port, disabled, read, nextId, insert }: {
  port?: CompositionLibraryPort; disabled: boolean; read: () => CompositionContext; nextId: () => string;
  insert: (choice: CompositionChoice) => void;
}) {
  const [entries, setEntries] = useState<UserComposition[]>([]), [title, setTitle] = useState('');
  const [query, setQuery] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const live = useRef({ read, nextId, active: true, sequence: 0 }); live.current.read = read; live.current.nextId = nextId;
  const session = useMemo(() => createCompositionLibrarySession(() => live.current.read(), () => live.current.nextId()), []);
  const load = async () => {
    if (!port) return;
    const token = ++live.current.sequence;
    setBusy(true); setMessage('');
    try { const values = await port.list(); if (live.current.active && token === live.current.sequence) setEntries(values); }
    catch (error) { if (live.current.active && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '구성을 불러오지 못했습니다.'); }
    finally { if (live.current.active && token === live.current.sequence) setBusy(false); }
  };
  useEffect(() => {
    live.current.active = true; void load();
    return () => { live.current.active = false; live.current.sequence++; };
  }, [port]);
  const save = async () => {
    if (!port || busy || disabled) return;
    const token = ++live.current.sequence; setBusy(true); setMessage('');
    try {
      const result = await session.save(port, title);
      if (live.current.active && token === live.current.sequence) {
        setEntries(values => [result.value, ...values.filter(value => value.id !== result.value.id)]);
        setTitle(''); setMessage(result.status === 'saved' ? '선택 구성을 저장했습니다.' : '요청한 구성은 저장됐지만 편집 문맥이 바뀌었습니다. 현재 문서는 변경하지 않았습니다.');
      }
    } catch (error) { if (live.current.active && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '구성을 저장하지 못했습니다.'); }
    finally { if (live.current.active && token === live.current.sequence) setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!port || busy || disabled) return;
    const token = ++live.current.sequence; setBusy(true);
    try {
      await port.remove(id);
      if (live.current.active && token === live.current.sequence) { setEntries(values => values.filter(value => value.id !== id)); setMessage('라이브러리 구성을 삭제했습니다. 사용 중인 페이지와 이미지 파일은 보존됩니다.'); }
    } catch (error) { if (live.current.active && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '구성을 삭제하지 못했습니다.'); }
    finally { if (live.current.active && token === live.current.sequence) setBusy(false); }
  };
  return <section aria-label="내 구성" className="g7pb-v3-library">
    <h2>내 구성</h2>
    {!port ? <p>사용자 구성 저장 서비스가 연결되지 않았습니다.</p> : <>
      <form onSubmit={event => { event.preventDefault(); void save(); }}>
        <label className="g7pb-v3-field">구성 이름<input aria-label="사용자 구성 이름" maxLength={120} value={title} disabled={disabled || busy}
          onChange={event => setTitle(event.target.value)} /></label>
        <InputButton type="submit" disabled={disabled || busy || !title.trim() || !read().ids.length}>선택을 구성으로 저장</InputButton>
      </form>
      <label className="g7pb-v3-field">내 구성 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <InputButton disabled={busy} onClick={() => void load()}>구성 목록 새로고침</InputButton>
      {entries.filter(entry => entry.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(entry => <div key={entry.id} style={{ marginTop: 10 }}>
        <strong style={{ overflowWrap: 'anywhere' }}>{entry.title}</strong>
        {entry.error && <p role="status">{entry.error}</p>}
        <InputButton disabled={disabled || busy || !entry.source} onClick={() => {
          try { if (entry.source) insert({ id: entry.id, label: entry.title, source: entry.source }); }
          catch (error) { setMessage(error instanceof Error ? error.message : '구성을 삽입하지 못했습니다.'); }
        }}>구성 다시 삽입</InputButton>
        <InputButton disabled={disabled || busy} onClick={() => void remove(entry.id)}>라이브러리에서 삭제</InputButton>
      </div>)}
      {!busy && !entries.length && <p>저장된 구성이 없습니다.</p>}
      <p className="g7pb-v3-hint">독립 사본으로 삽입되며 원본과 다른 페이지는 유지됩니다.</p>
    </>}
    {busy && <p role="status">구성을 처리하는 중입니다.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
