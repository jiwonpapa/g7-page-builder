import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPartRecoverySession, type PartRecoveryContext, type PartRecoveryRevision } from '../../editor-application/v3/sitePartRecovery';
import type { ElementPartResource } from '../../api/elementSitePartResource';
import type { SitePartHostPorts } from './sitePartPorts';
import { InputButton } from './TypedInput';

export function SitePartRecovery({ ports, source, read, blocked, busy, restored }: {
  ports: SitePartHostPorts; source: ElementPartResource; read: () => PartRecoveryContext;
  blocked: boolean; busy: (value: boolean) => void; restored: (value: ElementPartResource) => void;
}) {
  const [items, setItems] = useState<PartRecoveryRevision[]>([]), [selected, setSelected] = useState('');
  const [pending, setPending] = useState(false), [message, setMessage] = useState('');
  const live = useRef({ read, source, busy, restored, alive: true, sequence: 0 });
  Object.assign(live.current, { read, source, busy, restored });
  const session = useMemo(() => createPartRecoverySession(() => live.current.read()), []);
  useEffect(() => { live.current.alive = true; return () => { live.current.alive = false; live.current.sequence++; }; }, []);
  const list = async () => {
    if (!ports.revisions || pending || blocked) return;
    const context = { ...live.current.read() }, token = ++live.current.sequence;
    setPending(true); setMessage('');
    try {
      const values = await ports.revisions(live.current.source), current = live.current.read();
      if (live.current.alive && token === live.current.sequence && current.documentId === context.documentId && current.session === context.session) setItems(values);
    } catch (error) { if (live.current.alive && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '리비전 조회 실패'); }
    finally { if (live.current.alive && token === live.current.sequence) setPending(false); }
  };
  const restore = async () => {
    const item = items.find(item => item.revision === Number(selected));
    if (!item || !ports.restore || pending || blocked || !ports.confirmRestore?.(source.document.kind, item.revision)) return;
    const token = ++live.current.sequence, current = live.current.source;
    setPending(true); setMessage(''); live.current.busy(true);
    try {
      const result = await session.restore(item, true, (document, lock) => ports.restore!(current, document, lock));
      if (live.current.alive && token === live.current.sequence) {
        if (result.status === 'restored') { live.current.restored(result.value); setSelected(''); setItems([]); setMessage('선택 리비전을 새 초안으로 복원했습니다. 발행된 Header·Footer 쌍은 유지됩니다.'); }
        else setMessage('서버에 복원했지만 편집 문맥이 바뀌었습니다. 현재 화면을 덮어쓰지 않았습니다. 세트를 다시 열어 확인하세요.');
      }
    } catch (error) { if (live.current.alive && token === live.current.sequence) setMessage(error instanceof Error ? error.message : '복원 결과를 확인하지 못했습니다. 세트를 다시 열어 확인하세요.'); }
    finally { if (live.current.alive && token === live.current.sequence) { setPending(false); live.current.busy(false); } }
  };
  if (!ports.revisions || !ports.restore) return null;
  const context = read();
  return <section aria-label="공통영역 리비전 복원" style={{ padding: 12, borderBottom: '1px solid var(--g7pb-border)' }}>
    <details><summary>현재 {source.document.kind} 리비전 복원</summary>
      <p>현재 영역을 먼저 저장하세요. 명시적인 초안 복원이며 사이트 발행은 별도입니다. 기존 형식은 전환하지 않습니다.</p>
      <InputButton disabled={pending || blocked} onClick={() => void list()}>리비전 목록</InputButton>
      <select aria-label="복원할 공통영역 리비전" value={selected} disabled={pending || blocked} onChange={event => setSelected(event.target.value)}>
        <option value="">리비전 선택</option>{items.map(item => <option key={item.revision} value={item.revision} disabled={!item.document}>
          {'#' + item.revision + ' · ' + item.createdAt + (item.document ? '' : ' · 별도 문서 처리 대상')}
        </option>)}
      </select>
      <InputButton disabled={pending || blocked || context.dirty || context.readonly || !selected} onClick={() => void restore()}>새 초안으로 복원</InputButton>
      {context.dirty && <p role="status">현재 영역에 저장되지 않은 변경이 있습니다.</p>}{message && <p role="status">{message}</p>}
    </details>
  </section>;
}
