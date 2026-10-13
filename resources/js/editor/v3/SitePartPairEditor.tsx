import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementPartPair, ElementPartResource, PartKind } from '../../api/elementSitePartResource';
import type { SitePartHostPorts } from './sitePartPorts';
import { StructureEditor } from './StructureEditor';
import { BehaviorPreview } from './BehaviorPreview';
import { viewportAt } from '../../documents/v3/validate';
import type { DocumentV3 } from '../../documents/v3/types';
import { SitePartRecovery } from './SitePartRecovery';

const kinds = ['header', 'footer'] as const;
const labels = { header: 'Header', footer: 'Footer' };
const message = (error: unknown) => error instanceof Error ? error.message : '공통영역 요청을 처리하지 못했습니다.';
function withPart(pair: ElementPartPair, kind: PartKind, part: ElementPartResource): ElementPartPair {
  return { ...pair, [kind]: part, set: { ...pair.set, [kind]: {
    site_part_id: part.document.content.document_id, revision: part.revision, active_revision: part.active_revision,
    status: part.status, updated_at: part.updated_at,
  } } };
}

/** Two separately owned documents reuse the SAME editor; switching never recreates either history. */
export function SitePartPairEditor({ initial, ports, compositions, onUnsafe, onSet, disabled = false }: {
  initial: ElementPartPair; ports: SitePartHostPorts; compositions: readonly unknown[];
  disabled?: boolean;
  onUnsafe: (unsafe: boolean) => void; onSet: (pair: ElementPartPair) => void;
}) {
  const [pair, setPair] = useState(initial);
  const [active, setActive] = useState<PartKind>('header');
  const [dirty, setDirty] = useState({ header: false, footer: false });
  const [pending, setPending] = useState({ header: false, footer: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [width, setWidth] = useState(1280);
  const [documents, setDocuments] = useState({ header: initial.header.document.content, footer: initial.footer.document.content });
  const [seeds, setSeeds] = useState({ header: initial.header.document.content, footer: initial.footer.document.content });
  const [epochs, setEpochs] = useState({ header: 0, footer: 0 });
  const recoveryContext = useRef({ active, preview, epochs }); recoveryContext.current = { active, preview, epochs };
  const live = useRef({ pair, dirty, pending, busy, alive: true });
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const callbacks = useRef({ onUnsafe, onSet }); callbacks.current = { onUnsafe, onSet };
  useEffect(() => {
    live.current.alive = true;
    return () => { live.current.alive = false; };
  }, []);
  const report = () => callbacks.current.onUnsafe(live.current.busy || kinds.some(kind => live.current.dirty[kind] || live.current.pending[kind]));
  const updatePair = (value: ElementPartPair) => {
    if (!live.current.alive) return;
    live.current.pair = value; setPair(value); callbacks.current.onSet(value);
  };
  const markPending = (kind: PartKind, value: boolean) => {
    live.current.pending = { ...live.current.pending, [kind]: value }; setPending(live.current.pending); report();
  };
  const drafts = useMemo(() => {
    const create = (kind: PartKind) => {
      const port = ports.draft(initial[kind], saved => updatePair(withPart(live.current.pair, kind, saved)));
      return { async save(request: Parameters<typeof port.save>[0]) {
        if (!live.current.alive || disabledRef.current || live.current.busy || live.current.pending[kind]) throw new Error('다른 저장 또는 발행 요청을 처리 중입니다.');
        markPending(kind, true);
        try { return await port.save(request); } finally { if (live.current.alive) markPending(kind, false); }
      } };
    };
    return { header: create('header'), footer: create('footer') };
  }, [initial, ports]);
  const changed = (kind: PartKind, document: DocumentV3) => {
    live.current.dirty = { ...live.current.dirty, [kind]: true }; setDirty(live.current.dirty);
    setDocuments(current => ({ ...current, [kind]: document })); report();
  };
  const saved = (kind: PartKind, status: 'saved' | 'edited') => {
    live.current.dirty = { ...live.current.dirty, [kind]: status !== 'saved' };
    setDirty(live.current.dirty); report();
  };
  const operate = async (operation: 'publish' | 'activate') => {
    if (disabledRef.current || live.current.busy || kinds.some(kind => live.current.pending[kind] || live.current.dirty[kind])) return;
    const current = live.current.pair;
    if (operation === 'publish' ? !ports.confirmPublish(current.set.is_active) : !ports.confirmActivate()) return;
    live.current.busy = true; setBusy(true); setError(''); report();
    try {
      const result = operation === 'publish' ? await ports.publish(current) : { ...current, set: await ports.activate(current.set) };
      updatePair(result);
    } catch (cause) { if (live.current.alive) setError(message(cause)); }
    finally { if (live.current.alive) { live.current.busy = false; setBusy(false); report(); } }
  };
  const unsaved = kinds.some(kind => dirty[kind] || pending[kind]);
  return <div className="g7pb-site-part-structure" data-testid="structure-site-part-pair">
    <nav className="g7pb-structure-host__bar" aria-label="공통영역 편집 대상">
      {kinds.map(kind => <button key={kind} className="g7pb-button g7pb-button--quiet" type="button"
        aria-pressed={!preview && active === kind} disabled={disabled || busy || kinds.some(item => pending[item])}
        onClick={() => { setActive(kind); setPreview(false); }}>{labels[kind]}</button>)}
      <button className="g7pb-button g7pb-button--quiet" type="button" aria-pressed={preview} onClick={() => setPreview(!preview)}>공통영역 미리보기</button>
      <span role="status" data-testid="structure-site-part-status">{busy ? '처리 중' : unsaved ? '저장할 변경 있음' : '초안 저장됨'}</span>
      <button className="g7pb-button g7pb-button--primary" type="button" disabled={disabled || busy || unsaved} onClick={() => void operate('publish')}>Header·Footer 함께 발행</button>
      <button className="g7pb-button g7pb-button--quiet" type="button" disabled={disabled || busy || unsaved || !pair.set.is_ready || pair.set.is_active}
        onClick={() => void operate('activate')}>사이트에 적용</button>
    </nav>
    <p className="g7pb-structure-host__catalog">PB 소유 공통영역 · {pair.set.is_active ? '사이트에서 사용 중' : '사이트에 미적용'} ·
      Header {dirty.header ? '변경 있음' : pair.header.status === 'published' ? '발행됨' : '초안'} · Footer {dirty.footer ? '변경 있음' : pair.footer.status === 'published' ? '발행됨' : '초안'}</p>
    {error && <p className="g7pb-structure-host__error" role="alert">{error}</p>}
    <SitePartRecovery key={active} ports={ports} source={pair[active]} blocked={disabled || busy || preview || kinds.some(kind => pending[kind])}
      read={() => {
        const part = live.current.pair[active], context = recoveryContext.current;
        return { setId: part.set_id, kind: active, documentId: part.document.content.document_id,
          slug: part.document.content.slug, locale: part.document.content.locale, session: context.epochs[active],
          serverRevision: part.lock_version, activeRevision: part.active_revision,
          readonly: disabledRef.current || context.preview || context.active !== active, dirty: live.current.dirty[active] };
      }} busy={value => { live.current.busy = value; setBusy(value); report(); }} restored={part => {
        updatePair(withPart(live.current.pair, active, part));
        setSeeds(current => ({ ...current, [active]: part.document.content }));
        setDocuments(current => ({ ...current, [active]: part.document.content }));
        setEpochs(current => ({ ...current, [active]: current[active] + 1 }));
        live.current.dirty = { ...live.current.dirty, [active]: false }; setDirty(live.current.dirty); report();
      }} />
    {kinds.map(kind => <div key={kind} hidden={preview || active !== kind} className="g7pb-site-part-structure__editor" data-part={kind}>
      <StructureEditor document={seeds[kind]} sessionId={initial[kind].document.content.document_id + ':' + epochs[kind]}
        serverRevision={pair[kind].lock_version} readonly={disabled || busy || preview || active !== kind}
        drafts={drafts[kind]} media={ports.media} library={ports.library} compositions={compositions} nextId={ports.nextId}
        onChange={document => changed(kind, document)} onSaved={(_revision, status) => saved(kind, status)} />
    </div>)}
    {preview && <section className="g7pb-site-part-structure__preview" aria-label="Header 본문 Footer 미리보기">
      <label>미리보기 폭<select value={width} onChange={event => setWidth(Number(event.target.value))}>
        <option value={1280}>PC 1280px</option><option value={768}>태블릿 768px</option><option value={360}>모바일 360px</option>
      </select></label>
      <div style={{ width, background: 'var(--g7pb-surface-strong)' }} data-testid="site-part-pair-preview">
        <header><BehaviorPreview document={documents.header} viewport={viewportAt(width)} /></header>
        <div className="g7pb-site-part-structure__body">본문 영역 · 이 화면에서 변경하지 않습니다.</div>
        <footer><BehaviorPreview document={documents.footer} viewport={viewportAt(width)} /></footer>
      </div>
    </section>}
  </div>;
}
