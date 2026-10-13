import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRecoverySession, type RecoveryContext, type RecoveryPort, type RecoveryRevision } from '../../editor-application/v3/recovery';
import type { V3DocumentResource } from '../../api/v3DocumentResource';
import { InputButton } from './TypedInput';

export function RevisionRecovery({ port, read, confirm, busy, restored }: {
  port?: RecoveryPort<V3DocumentResource>; read: () => RecoveryContext; confirm?: (revision: number) => boolean;
  busy: (value: boolean) => void; restored: (value: V3DocumentResource) => void;
}) {
  const [items, setItems] = useState<RecoveryRevision[]>([]), [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const live = useRef({ read, confirm, busy, restored, alive: true, sequence: 0 });
  Object.assign(live.current, { read, confirm, busy, restored });
  const session = useMemo(() => createRecoverySession(() => live.current.read()), []);
  useEffect(() => { live.current.alive = true; return () => { live.current.alive = false; live.current.sequence++; }; }, []);
  const list = async () => {
    if (!port || pending) return;
    const context = { ...live.current.read() }, token = ++live.current.sequence;
    setPending(true); setMessage('');
    try {
      const values = await port.list(context.documentId);
      const current = live.current.read();
      if (live.current.alive && token === live.current.sequence && current.documentId === context.documentId && current.sessionId === context.sessionId) setItems(values);
    } catch (error) { if (live.current.alive && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '리비전을 불러오지 못했습니다.'); }
    finally { if (live.current.alive && token === live.current.sequence) setPending(false); }
  };
  const restore = async () => {
    if (!port || pending || !selected) return;
    const revision = Number(selected);
    if (!live.current.confirm?.(revision)) return;
    const token = ++live.current.sequence;
    setPending(true); setMessage(''); live.current.busy(true);
    try {
      const result = await session.restore(port, revision, true);
      if (live.current.alive && token === live.current.sequence) {
        if (result.status === 'restored') { live.current.restored(result.value); setItems([]); setSelected(''); setMessage('리비전을 새 초안으로 복원했습니다. 기존 공개 페이지는 유지됩니다.'); }
        else setMessage('서버에서 복원됐지만 편집 문맥이 바뀌었습니다. 현재 문서는 덮어쓰지 않았습니다. 문서함에서 다시 열어 확인해 주세요.');
      }
    } catch (error) {
      if (live.current.alive && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '복원 결과를 확인하지 못했습니다. 문서를 다시 열어 확인해 주세요.');
    } finally { if (live.current.alive && token === live.current.sequence) { setPending(false); live.current.busy(false); } }
  };
  if (!port) return null;
  const context = read();
  return <section aria-label="초안 리비전 복원" style={{ padding: 12, borderBottom: '1px solid var(--g7pb-border)' }}>
    <details><summary>저장된 리비전 복원</summary>
      <p>현재 초안을 먼저 저장하세요. 복원은 새 초안을 만들며 발행은 별도로 진행합니다.</p>
      <InputButton disabled={pending} onClick={() => void list()}>리비전 목록</InputButton>
      <select aria-label="복원할 리비전" value={selected} disabled={pending} onChange={event => setSelected(event.target.value)}>
        <option value="">리비전 선택</option>
        {items.map(item => <option key={item.revision} value={item.revision} disabled={item.schemaVersion !== 'g7-page-builder/v3'}>
          {'#' + item.revision + ' · ' + item.createdAt + (item.schemaVersion === 'g7-page-builder/v3' ? '' : ' · 별도 문서 처리 대상')}
        </option>)}
      </select>
      <InputButton disabled={pending || context.readonly || context.dirty || !selected || !confirm} onClick={() => void restore()}>선택 리비전을 초안으로 복원</InputButton>
      {context.dirty && <p role="status">저장되지 않은 변경이 있어 복원을 시작할 수 없습니다.</p>}
      {message && <p role="status">{message}</p>}
    </details>
  </section>;
}
