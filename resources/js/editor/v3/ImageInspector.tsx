import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentV3, Node } from '../../documents/v3/types';
import type { DocumentCommand } from '../../documents/v3/designCommands';
import { effectiveStyle, type Viewport } from '../../documents/v3/validate';
import { createMediaSession, type MediaChoice, type MediaPort, type MediaTarget } from '../../editor-application/v3/media';
import type { EditContext } from '../../editor-application/v3/session';
import { InputButton } from './TypedInput';

export function ImageInspector({ node, document, disabled, viewport, port, read, apply }: {
  node: Extract<Node, { type: 'media.image' }>; document: DocumentV3; disabled: boolean; viewport: Viewport;
  port?: MediaPort; read: () => MediaTarget; apply: (command: DocumentCommand, expected?: EditContext) => void;
}) {
  const [alt, setAlt] = useState(node.props.alt), [assetId, setAssetId] = useState(node.props.asset_id);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [query, setQuery] = useState('');
  const [choices, setChoices] = useState<MediaChoice[]>([]), [message, setMessage] = useState('');
  const live = useRef({ read, apply, alive: true }); live.current.read = read; live.current.apply = apply;
  const session = useMemo(() => createMediaSession(() => live.current.read(), (command, expected) => live.current.apply(command, expected)), []);
  useEffect(() => { live.current.alive = true; return () => { live.current.alive = false; session.cancel(); }; }, [session]);
  useEffect(() => { if (disabled) session.cancel(); }, [disabled, session]);
  const report = (error: unknown) => { if (live.current.alive) setMessage(error instanceof Error ? error.message : '이미지 요청을 처리하지 못했습니다.'); };
  const effective = effectiveStyle(node, viewport);
  const [fit, setFit] = useState(effective.object_fit ?? 'cover');
  const [x, setX] = useState(effective.object_x ?? 50), [y, setY] = useState(effective.object_y ?? 50);
  const load = async () => {
    if (!port || disabled || busy) return;
    setOpen(true); setBusy(true); setMessage('');
    try {
      const result = await session.list(port);
      if (live.current.alive && result.status === 'ready') setChoices(result.value);
      else if (live.current.alive) setMessage('선택이나 문서가 변경되어 이전 이미지 목록을 적용하지 않았습니다.');
    } catch (error) { report(error); }
    finally { if (live.current.alive) setBusy(false); }
  };
  const upload = async (file: File) => {
    if (!port || disabled || busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await session.upload(port, file, alt);
      if (live.current.alive) setMessage(result.status === 'ready' ? '이미지를 교체했습니다.' : '취소되거나 선택이 바뀌어 이미지를 적용하지 않았습니다. 업로드 파일은 라이브러리에 보존됩니다.');
    } catch (error) { report(error); }
    finally { if (live.current.alive) setBusy(false); }
  };
  return <section aria-label="이미지 편집" style={{ borderTop: '1px solid var(--g7pb-border)', marginTop: 16, paddingTop: 16 }}>
    <h2 style={{ fontSize: 15 }}>이미지</h2>
    <form onSubmit={event => {
      event.preventDefault();
      try {
        const asset = document.assets.find(value => value.asset_id === assetId);
        if (!asset) throw new Error('선택한 이미지 자산을 찾을 수 없습니다.');
        session.choose(asset, alt); setMessage('이미지 의미를 적용했습니다.');
      } catch (error) { report(error); }
    }}><fieldset disabled={disabled || busy} style={{ border: 0, padding: 0 }}>
      <label>문서 이미지<select aria-label="문서 이미지" value={assetId} onChange={event => setAssetId(event.target.value)}>
        {document.assets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.url}</option>)}
      </select></label>
      <label>대체 문구<input aria-label="이미지 대체 문구" value={alt} onChange={event => setAlt(event.target.value)} /></label>
      <p>장식용 이미지의 대체 문구는 비워 두세요. 비율은 디자인의 크기 설정에서 변경합니다.</p>
      <InputButton type="submit">이미지 적용</InputButton>
    </fieldset></form>
    <form onSubmit={event => {
      event.preventDefault();
      try { apply({ kind: 'style', id: node.instance_id, viewport, set: { object_fit: fit, object_x: x, object_y: y } }); setMessage('이미지 맞춤과 초점을 적용했습니다.'); }
      catch (error) { report(error); }
    }}><fieldset disabled={disabled || busy} style={{ border: 0, padding: '12px 0' }}>
      <label>이미지 맞춤<select aria-label="이미지 맞춤" value={fit} onChange={event => {
        const value = event.target.value;
        if (value === 'cover' || value === 'contain' || value === 'fill' || value === 'none' || value === 'scale-down') setFit(value);
      }}><option value="cover">영역 채우기</option><option value="contain">전체 보이기</option><option value="fill">영역에 맞추기</option><option value="none">원래 크기</option><option value="scale-down">넘칠 때 축소</option></select></label>
      <label>가로 초점 (%)<input type="number" min={0} max={100} step="any" value={x} onChange={event => setX(Number(event.target.value))} /></label>
      <label>세로 초점 (%)<input type="number" min={0} max={100} step="any" value={y} onChange={event => setY(Number(event.target.value))} /></label>
      <InputButton type="submit">맞춤·초점 적용</InputButton>
    </fieldset></form>
    <InputButton disabled={disabled || busy || !port} onClick={() => void load()}>이미지 선택·업로드</InputButton>
    {!port && <p role="status">미디어 서비스가 연결되지 않았습니다. 문서에 등록된 이미지는 편집할 수 있습니다.</p>}
    {open && <div role="group" aria-label="이미지 라이브러리">
      <label>이미지 검색<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <label>이미지 업로드<input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" disabled={disabled || busy}
        onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /></label>
      {busy && <p role="status">이미지를 불러오는 중입니다.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        {choices.filter(asset => asset.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(asset => <InputButton key={asset.asset_id}
          disabled={disabled || busy} onClick={() => {
            try { session.choose({ asset_id: asset.asset_id, url: asset.url }, alt); setOpen(false); }
            catch (error) { report(error); }
          }}><img src={asset.url} alt="" loading="lazy" style={{ width: '100%', height: 72, objectFit: 'cover' }} />
          <span style={{ overflowWrap: 'anywhere' }}>{asset.name}</span></InputButton>)}
      </div>
      {!busy && !choices.length && <p>등록된 이미지가 없습니다.</p>}
      <InputButton onClick={() => { session.cancel(); setOpen(false); setBusy(false); setMessage('이미지 선택을 취소했습니다.'); }}>선택 취소</InputButton>
    </div>}
    {message && <p role="status">{message}</p>}
  </section>;
}
