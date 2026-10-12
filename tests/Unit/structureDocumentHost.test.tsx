import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StructureEditorProps } from '../../resources/js/editor/v3/StructureEditor';
import { StructureDocumentHost, type StructureHostPorts } from '../../resources/js/editor/v3/StructureDocumentHost';
import { parseV3DocumentResource } from '../../resources/js/api/v3DocumentResource';
import fixture from '../Contract/document-v3.fixture.json';
import { mountStructureDocument } from '../../resources/js/editor/v3/entry';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let editor: StructureEditorProps | undefined;
vi.mock('../../resources/js/editor/v3/StructureEditor', () => ({
  StructureEditor: (props: StructureEditorProps) => { editor = props; return <div data-testid="editor-port" />; },
}));
let root: Root | undefined;
const disposers: Array<() => void> = [];
afterEach(async () => { await act(async () => { root?.unmount(); disposers.splice(0).forEach(dispose => dispose()); });
  root = undefined; editor = undefined; document.body.replaceChildren(); window.localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function resource() {
  return parseV3DocumentResource({ document: { ...fixture, blocks: [] }, title: '공통 요소 페이지', lock_version: 1, revision: 1,
    public_url: null, active_artifact_sha256: null, is_home: false, status: 'draft', has_unpublished_changes: false,
    created_at: null, updated_at: null, published_at: null, archived_at: null }, fixture.document_id);
}
function ports(): StructureHostPorts {
  return { load: vi.fn(async () => resource()), create: vi.fn(async () => resource()),
    drafts: { save: vi.fn(async request => ({ documentId: request.documentId, revision: 2 })) },
    navigate: vi.fn(), created: vi.fn(), confirmLeave: vi.fn(() => false), nextId: () => crypto.randomUUID() };
}
async function mount(hostPorts: StructureHostPorts, id?: string) {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(<StructureDocumentHost ports={hostPorts} documentId={id} libraryUrl="/admin/page-builder" />));
  return container;
}
async function input(index: number, value: string) {
  const field = document.querySelectorAll('input')[index];
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(accept => { resolve = accept; }); return { promise, resolve }; }
const status = () => document.querySelector('[data-testid="structure-document-status"]')?.textContent;
const beforeUnload = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };

describe('installed structure document host', () => {
  it('mounts the real authenticated entry and supplies the persisted canonical source without requesting block packs', async () => {
    window.localStorage.setItem('auth_token', 'unit-admin-token');
    const fetchImpl = vi.fn<typeof fetch>(async url => new Response(JSON.stringify(String(url).includes('/documents/')
      ? { success: true, data: resource() } : []), { status: 200 }));
    vi.stubGlobal('fetch', fetchImpl);
    const container = document.createElement('div'); container.dataset.documentId = fixture.document_id;
    document.body.append(container);
    await act(async () => { disposers.push(mountStructureDocument(container)); });
    const reads = fetchImpl.mock.calls.filter(([url]) => String(url).includes('/documents/'));
    expect(reads).toHaveLength(1);
    expect(String(reads[0][0])).toContain('/documents/' + fixture.document_id);
    expect(new Headers(reads[0][1]?.headers).get('Authorization')).toBe('Bearer unit-admin-token');
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('builtin-v3'))).toBe(true);
    expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('block-packs'))).toBe(false);
    expect(editor?.document).toEqual(resource().document);
    expect(status()).toBe('초안 저장됨');
  });

  it('keeps document editing and saving available when the optional composition asset fails', async () => {
    window.localStorage.setItem('auth_token', 'unit-admin-token');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async url => String(url).includes('/documents/')
      ? new Response(JSON.stringify({ success: true, data: resource() }), { status: 200 })
      : new Response('unavailable', { status: 503 })));
    const container = document.createElement('div'); container.dataset.documentId = fixture.document_id;
    document.body.append(container);
    await act(async () => { disposers.push(mountStructureDocument(container)); });
    expect(editor?.document).toEqual(resource().document); expect(editor?.drafts.save).toBeTypeOf('function');
    expect(editor?.compositions).toEqual([]);
    expect(container.textContent).toContain('구성 목록을 불러오지 못했습니다.');
    expect(status()).toBe('초안 저장됨');
  });

  it('cancels the catalog read on unmount and ignores its late response', async () => {
    window.localStorage.setItem('auth_token', 'unit-admin-token');
    const pending = deferred<Response>();
    const fetchImpl = vi.fn<typeof fetch>(() => pending.promise); vi.stubGlobal('fetch', fetchImpl);
    const container = document.createElement('div'); document.body.append(container);
    let dispose: (() => void) | undefined;
    await act(async () => { dispose = mountStructureDocument(container); });
    expect(fetchImpl).toHaveBeenCalledOnce();
    await act(async () => dispose!());
    expect(fetchImpl.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => pending.resolve(new Response('[]')));
    expect(container.children).toHaveLength(0);
  });

  it('preserves the in-progress create form when catalog data arrives later', async () => {
    window.localStorage.setItem('auth_token', 'unit-admin-token');
    const pending = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => pending.promise));
    const container = document.createElement('div'); document.body.append(container);
    await act(async () => { disposers.push(mountStructureDocument(container)); });
    await input(0, '작성 중인 제목'); await input(1, 'in-progress');
    await act(async () => pending.resolve(new Response(JSON.stringify([fixture]))));
    expect(container.querySelectorAll('input')[0].value).toBe('작성 중인 제목');
    expect(container.querySelectorAll('input')[1].value).toBe('in-progress');
    expect(container.textContent).not.toContain('구성 목록을 불러오는 중');
    expect(container.textContent).not.toContain('구성 목록을 불러오지 못했습니다');
  });

  it('creates an empty page without any catalog and passes the single save port to the editor', async () => {
    const hostPorts = ports(); await mount(hostPorts);
    expect(hostPorts.load).not.toHaveBeenCalled();
    await input(0, '빈 페이지'); await input(1, 'blank-page');
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(hostPorts.create).toHaveBeenCalledExactlyOnceWith({ title: '빈 페이지', slug: 'blank-page', locale: 'ko', shell_mode: 'template' });
    expect(hostPorts.created).toHaveBeenCalledExactlyOnceWith(fixture.document_id);
    expect(editor?.document.blocks).toEqual([]); expect(editor?.compositions).toEqual([]);
    expect(editor?.drafts).toBe(hostPorts.drafts); expect(status()).toBe('초안 저장됨');
  });

  it('rejects invalid creation input without sending a request', async () => {
    const hostPorts = ports(); await mount(hostPorts);
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(hostPorts.create).not.toHaveBeenCalled(); expect(document.querySelector('[role="alert"]')?.textContent).toContain('제목');
  });

  it('does not duplicate a pending create or attach its response after unmount', async () => {
    const hostPorts = ports(), pending = deferred<ReturnType<typeof resource>>();
    hostPorts.create = vi.fn(() => pending.promise); await mount(hostPorts);
    await input(0, '새 페이지'); await input(1, 'new-page');
    await act(async () => {
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(hostPorts.create).toHaveBeenCalledOnce();
    await act(async () => root!.unmount()); root = undefined;
    await act(async () => pending.resolve(resource()));
    expect(hostPorts.created).not.toHaveBeenCalled();
  });

  it('retains unsaved navigation protection after a save acknowledges an older edit', async () => {
    const hostPorts = ports(); await mount(hostPorts, fixture.document_id);
    expect(beforeUnload()).toBe(false);
    await act(async () => editor!.onChange!(resource().document));
    expect(beforeUnload()).toBe(true);
    await act(async () => editor!.onSaved!(2, 'edited'));
    expect(status()).toBe('저장할 변경 있음'); expect(beforeUnload()).toBe(true);
    await act(async () => document.querySelector('a')!.click());
    expect(hostPorts.confirmLeave).toHaveBeenCalledOnce(); expect(hostPorts.navigate).not.toHaveBeenCalled();
    await act(async () => editor!.onSaved!(3, 'saved'));
    expect(beforeUnload()).toBe(false); expect(status()).toBe('초안 저장됨');
    await act(async () => document.querySelector('a')!.click());
    expect(hostPorts.navigate).toHaveBeenCalledExactlyOnceWith('/admin/page-builder');
  });

  it('allows an explicitly confirmed unsaved exit without inventing another save transaction', async () => {
    const hostPorts = ports(); hostPorts.confirmLeave = () => true;
    await mount(hostPorts, fixture.document_id); await act(async () => editor!.onChange!(resource().document));
    await act(async () => document.querySelector('a')!.click());
    expect(hostPorts.navigate).toHaveBeenCalledWith('/admin/page-builder'); expect(hostPorts.drafts.save).not.toHaveBeenCalled();
  });

  it('redirects an existing legacy document without mounting or converting it', async () => {
    const hostPorts = ports(); hostPorts.load = vi.fn(async () => ({ legacyUrl: '/legacy-editor' }));
    await mount(hostPorts, fixture.document_id);
    expect(hostPorts.navigate).toHaveBeenCalledExactlyOnceWith('/legacy-editor'); expect(editor).toBeUndefined();
    expect(hostPorts.create).not.toHaveBeenCalled(); expect(hostPorts.drafts.save).not.toHaveBeenCalled();
  });

  it('shows a load error and preserves access to the document library', async () => {
    const hostPorts = ports(); hostPorts.load = vi.fn(async () => { throw new Error('접근 권한 없음'); });
    await mount(hostPorts, fixture.document_id);
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('접근 권한 없음');
    expect(document.querySelector('a')?.getAttribute('href')).toBe('/admin/page-builder'); expect(editor).toBeUndefined();
  });

  it('ignores a late load response and enforces archived read-only mode', async () => {
    const hostPorts = ports(), pending = deferred<ReturnType<typeof resource>>();
    hostPorts.load = vi.fn(() => pending.promise); await mount(hostPorts, fixture.document_id);
    await act(async () => root!.unmount()); root = undefined;
    await act(async () => pending.resolve(resource())); expect(editor).toBeUndefined();
    hostPorts.load = vi.fn(async () => ({ ...resource(), status: 'archived' as const }));
    await mount(hostPorts, fixture.document_id);
    expect(editor?.readonly).toBe(true); expect(status()).toContain('읽기 전용');
  });

  it('preserves creation fields after a failed write without automatically retrying', async () => {
    const hostPorts = ports(); hostPorts.create = vi.fn(async () => { throw new Error('서버 저장 실패'); });
    await mount(hostPorts); await input(0, '유지할 제목'); await input(1, 'keep-page');
    await act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(hostPorts.create).toHaveBeenCalledOnce(); expect(document.querySelector('input')?.value).toBe('유지할 제목');
    expect(document.querySelector('[role="alert"]')?.textContent).toBe('서버 저장 실패');
  });
});
