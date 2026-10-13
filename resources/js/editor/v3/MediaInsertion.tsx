import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createMediaInsertionSession, type MediaChoice, type MediaInsertionContext, type MediaPort } from '../../editor-application/v3/media';
import type { DocumentCommand } from '../../documents/v3/designCommands';
import type { EditContext } from '../../editor-application/v3/session';
import { InputButton } from './TypedInput';

export function MediaInsertion({ port, read, apply, nextId, close }: {
  port?: MediaPort; read: () => MediaInsertionContext;
  apply: (command: DocumentCommand, expected: EditContext) => void; nextId: () => string; close: () => void;
}) {
  const [assets, setAssets] = useState<MediaChoice[]>([]), [url, setUrl] = useState(''), [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const live = useRef({ read, apply, alive: true }); live.current.read = read; live.current.apply = apply;
  const session = useMemo(() => createMediaInsertionSession(() => live.current.read(), (command, expected) => live.current.apply(command, expected)), []);
  useEffect(() => {
    live.current.alive = true;
    if (port) {
      setBusy(true);
      void session.list(port).then(result => { if (live.current.alive && result.status === 'ready') setAssets(result.value); })
        .catch(error => { if (live.current.alive) setMessage(error instanceof Error ? error.message : '이미지를 불러오지 못했습니다.'); })
        .finally(() => { if (live.current.alive) setBusy(false); });
    }
    return () => { live.current.alive = false; session.cancel(); };
  }, [port, session]);
  const report = (error: unknown) => { if (live.current.alive) setMessage(error instanceof Error ? error.message : '이미지를 삽입하지 못했습니다.'); };
  const disabled = busy || read().context.readonly;
  return <section aria-label="첫 이미지 삽입" style={{ paddingTop: 12 }}>
    <h3>이미지 선택·업로드</h3>
    <label>새 이미지 대체 문구<input value={alt} disabled={disabled} onChange={event => setAlt(event.target.value)} /></label>
    <form onSubmit={event => {
      event.preventDefault();
      try { session.url(url, alt, nextId); close(); } catch (error) { report(error); }
    }}><label>이미지 주소<input type="text" inputMode="url" value={url} disabled={disabled} placeholder="https:// 또는 사이트 내부 이미지 주소"
      onChange={event => setUrl(event.target.value)} /></label><InputButton type="submit" disabled={disabled || !url}>주소 이미지 삽입</InputButton></form>
    {port && <label>새 이미지 업로드<input type="file" disabled={disabled} accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
      onChange={event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
        setBusy(true);
        void session.upload(port, file, alt).then(result => {
          if (live.current.alive) { if (result.status === 'ready') close(); else setMessage('선택이나 문서가 바뀌어 이미지를 삽입하지 않았습니다. 업로드 파일은 보존됩니다.'); }
        }).catch(report).finally(() => { if (live.current.alive) setBusy(false); });
      }} /></label>}
    {assets.map(asset => <InputButton key={asset.asset_id} disabled={disabled} onClick={() => {
      try { session.choose({ asset_id: asset.asset_id, url: asset.url }, alt); close(); } catch (error) { report(error); }
    }}>{asset.name}</InputButton>)}
    <InputButton onClick={() => { session.cancel(); close(); }}>이미지 삽입 취소</InputButton>
    {busy && <p role="status">이미지를 준비하는 중입니다.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
