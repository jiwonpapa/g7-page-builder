import React, { useEffect, useRef, useState } from 'react';
import type { V3DocumentResource } from '../../api/v3DocumentResource';
import type { DraftPort } from '../../editor-application/v3/session';
import type { PublicationPort } from '../../editor-application/v3/publication';
import { StructureEditor } from './StructureEditor';
import type { MediaPort } from '../../editor-application/v3/media';
import type { CompositionLibraryPort } from '../../editor-application/v3/compositionLibrary';

export interface StructureHostPorts {
  load: (documentId: string) => Promise<V3DocumentResource | { legacyUrl: string }>;
  create: (input: { title: string; slug: string; locale: string; shell_mode: 'template' | 'builder' | 'none' }) => Promise<V3DocumentResource>;
  drafts: DraftPort;
  publication?: PublicationPort;
  media?: MediaPort;
  library?: CompositionLibraryPort;
  navigate: (url: string) => void;
  created: (documentId: string) => void;
  confirmLeave: () => boolean;
  nextId: () => string;
}

/** Product chrome consumes ports; StructureEditor owns the document, commands and save history. */
export function StructureDocumentHost({ documentId, locale = 'ko', ports, compositions = [], catalogMessage, libraryUrl }: {
  documentId?: string; locale?: string; ports: StructureHostPorts; compositions?: readonly unknown[]; catalogMessage?: string; libraryUrl: string;
}) {
  const [resource, setResource] = useState<V3DocumentResource | null>(null);
  const [busy, setBusy] = useState(Boolean(documentId));
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [shell, setShell] = useState<'template' | 'builder' | 'none'>('template');
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const request = useRef({ generation: 0, active: false, creating: false });
  const markDirty = (value: boolean) => { dirtyRef.current = value; setDirty(value); };

  useEffect(() => {
    const generation = ++request.current.generation;
    request.current.active = true; request.current.creating = false;
    setResource(null); setError(''); setBusy(Boolean(documentId)); markDirty(false);
    const current = () => request.current.active && request.current.generation === generation;
    if (documentId) void ports.load(documentId).then(value => {
      if (!current()) return;
      if ('legacyUrl' in value) ports.navigate(value.legacyUrl);
      else setResource(value);
    }).catch((cause: unknown) => {
      if (current()) setError(cause instanceof Error ? cause.message : '문서를 불러오지 못했습니다.');
    }).finally(() => { if (current()) setBusy(false); });
    return () => { request.current.active = false; request.current.generation++; };
  }, [documentId, ports]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!request.current.active || request.current.creating || busy) return;
    if (!title.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError('제목과 영문 소문자·숫자·하이픈으로 된 기본 주소 이름을 입력해 주세요.'); return;
    }
    const generation = request.current.generation;
    const current = () => request.current.active && request.current.generation === generation;
    request.current.creating = true; setBusy(true); setError('');
    try {
      const created = await ports.create({ title: title.trim(), slug, locale, shell_mode: shell });
      if (current()) { setResource(created); ports.created(created.document.document_id); }
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : '페이지를 만들지 못했습니다.');
    } finally { if (current()) { request.current.creating = false; setBusy(false); } }
  };

  return <section className="g7pb-root g7pb-structure-host" aria-label="페이지 정밀 편집" data-testid="structure-document-host">
    <header className="g7pb-structure-host__bar">
      <a className="g7pb-button g7pb-button--quiet" href={libraryUrl} onClick={event => {
        event.preventDefault(); if (!dirtyRef.current || ports.confirmLeave()) ports.navigate(libraryUrl);
      }}>문서함</a>
      <h1>{resource?.title ?? '빈 페이지 만들기'}</h1>
      <span role="status" data-testid="structure-document-status">{busy ? '불러오는 중' : resource
        ? resource.status === 'archived' ? '보관된 문서 · 읽기 전용' : dirty ? '저장할 변경 있음' : '초안 저장됨' : '새 문서'}</span>
      {resource && <span className="g7pb-structure-host__publication">{resource.active_artifact_sha256 ? '공개 버전과 별도인 초안' : '발행되지 않은 초안'}</span>}
    </header>
    {catalogMessage && <p className="g7pb-structure-host__catalog" role="status">{catalogMessage}</p>}
    {error && <p className="g7pb-structure-host__error" role="alert">{error}</p>}
    {resource ? <div className="g7pb-structure-host__workspace">
      <StructureEditor document={resource.document} sessionId={`${resource.document.document_id}:${resource.lock_version}`}
        serverRevision={resource.lock_version} drafts={ports.drafts} compositions={compositions} nextId={ports.nextId}
        media={ports.media} library={ports.library} publication={ports.publication} onPublished={page => setResource(current => current ? { ...current,
          active_artifact_sha256: page.hash, public_url: page.url, published_at: page.publishedAt } : current)}
        readonly={resource.status === 'archived'} onChange={() => markDirty(true)}
        onSaved={(_revision, status) => markDirty(status !== 'saved')} />
    </div> : !documentId && <form className="g7pb-structure-host__create" onSubmit={event => void create(event)}>
      <h2>기본 요소로 시작</h2><p>빈 캔버스에 텍스트·이미지·컨테이너를 넣어 구성합니다.</p>
      <label>페이지 제목<input required value={title} autoFocus onChange={event => setTitle(event.target.value)} /></label>
      <label>기본 주소 이름<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} /></label>
      <label>페이지 출력 방식<select value={shell} onChange={event => {
        const value = event.target.value;
        if (value === 'template' || value === 'builder' || value === 'none') setShell(value);
      }}><option value="template">활성 사이트 템플릿</option><option value="builder">페이지 빌더 Header·Footer</option><option value="none">공통영역 없음</option></select></label>
      <button className="g7pb-button g7pb-button--primary" type="submit" disabled={busy}>{busy ? '만드는 중' : '빈 페이지 만들기'}</button>
    </form>}
  </section>;
}
