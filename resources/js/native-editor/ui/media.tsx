import React, { useEffect, useRef, useState } from 'react';
import type { NativeField } from '../domain/fields';
import type { NativeAsset, NativeHost } from '../ports/host';
import { NativeMediaRequest } from '../application/mediaRequest';
import { Choice } from './Choice';
export function NativeMediaPanel({ host, field }: { host: NativeHost; field: NativeField }): React.ReactElement {
  const request = useRef(new NativeMediaRequest());
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'page' | 'template'>('page');
  const [items, setItems] = useState<NativeAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => () => request.current.cancel(), []);
  const media = host.media;
  async function load(next: 'page' | 'template'): Promise<void> {
    if (!media) return;
    setScope(next); setOpen(true); setBusy(true); setMessage(''); setItems([]);
    const result = await request.current.run(signal => media.list(next, signal));
    if (!result) return;
    setBusy(false);
    if (result.ok) setItems(result.data); else setMessage(result.reason);
  }
  async function upload(file: File): Promise<void> {
    if (!media) return;
    setBusy(true); setMessage('');
    const result = await request.current.run(signal => media.upload(file, signal));
    if (!result) return;
    setBusy(false);
    if (result.ok) {
      setItems(previous => [result.data, ...previous.filter(item => item.id !== result.data.id)]);
      setMessage('업로드했습니다. 아래 이미지의 선택 버튼으로 적용하세요.');
    } else setMessage(result.reason);
  }
  function close(): void { request.current.cancel(); setBusy(false); setOpen(false); setMessage(''); }
  if (!media) return <p className="g7pb-native-note">이 호스트에서는 이미지 첨부 기능을 제공하지 않습니다.</p>;
  return <div className="g7pb-native-media">
    {!open ? <button type="button" onClick={() => { void load('page'); }}>이미지 선택·업로드</button> : <>
      <Choice label="이미지 범위" value={scope} options={[{ value: 'page', label: '이 페이지' }, { value: 'template', label: '템플릿 전체' }]}
        onChange={next => { if (next === 'page' || next === 'template') void load(next); }} />
      <label>이미지 업로드<input type="file" aria-label="이미지 업로드" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" disabled={busy}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /></label>
      <p className="g7pb-native-note">업로드 위치: {host.context.layoutName}. 선택·참조 해제는 파일을 삭제하지 않습니다.</p>
      {busy && <p role="status">이미지를 불러오는 중입니다.</p>}
      {message && <p role="status">{message}</p>}
      {!busy && !message && !items.length && <p>등록된 이미지가 없습니다.</p>}
      <div className="g7pb-native-assets">{items.map(item => <div key={item.id}>
        <img src={item.url} alt="" loading="lazy" />
        <span>{item.name}</span><small>{item.layoutName ?? '템플릿 공용'}</small>
        <button type="button" disabled={busy} aria-label={item.name + ' 선택'} onClick={() => {
          const result = host.applyField(field.id, item.url);
          if (result.kind === 'refused') setMessage('선택 항목이 바뀌어 적용하지 않았습니다.'); else close();
        }}>선택</button>
      </div>)}</div>
      <div className="g7pb-native-actions"><button type="button" disabled={busy} onClick={() => { void load(scope); }}>새로고침</button>
        <button type="button" onClick={close}>취소·닫기</button></div>
    </>}
  </div>;
}
