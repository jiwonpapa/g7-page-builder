import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateElementSitePart } from '../../resources/js/documents/v3/sitePart';
import type { ElementPartPair, ElementPartResource, PartKind } from '../../resources/js/api/elementSitePartResource';
import { StructureSitePartHost } from '../../resources/js/editor/v3/StructureSitePartHost';
import { mountStructureSiteParts } from '../../resources/js/editor/v3/entry';
import type { SitePartHostPorts } from '../../resources/js/editor/v3/sitePartPorts';
import type { StructureEditorProps } from '../../resources/js/editor/v3/StructureEditor';
import { elementSitePartUrl, sitePartEditorUrl } from '../../resources/js/editor/sitePartEditorRouting';

it('routes only explicit v2 sources and encodes set and locale without query injection', () => {
  for (const structure of [false, true]) {
    const url = new URL(sitePartEditorUrl('set &editor=bad', 'ko &set_id=other', structure), 'https://example.test');
    expect(url.searchParams.get('set_id')).toBe('set &editor=bad');
    expect(url.searchParams.get('locale')).toBe('ko &set_id=other');
    expect(url.searchParams.get('editor')).toBe(structure ? 'structure' : null);
    expect([...url.searchParams.keys()]).toHaveLength(structure ? 3 : 2);
  }
  const source = Object.freeze({ schema_version: 'g7-page-builder/site-part/v2' });
  expect(elementSitePartUrl(source, 'set-a', 'ko')).toBe(sitePartEditorUrl('set-a', 'ko', true));
  expect(() => elementSitePartUrl(source, null, 'ko')).toThrow('세트 정보가 없습니다');
  for (const value of [null, undefined, false, 'v2', [], {}, { schema_version: 'g7-page-builder/site-part/v1' }]) {
    expect(elementSitePartUrl(value, null, 'ko')).toBeNull();
  }
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const editors = new Map<string, StructureEditorProps>(), mounts = vi.fn(), unmounts = vi.fn();
vi.mock('../../resources/js/editor/v3/StructureEditor', () => ({
  StructureEditor: (props: StructureEditorProps) => {
    editors.set(props.document.slug, props);
    useEffect(() => { mounts(props.sessionId); return () => { unmounts(props.sessionId); }; }, []);
    return <div data-testid={'editor-' + props.document.slug} />;
  },
}));
let root: Root | undefined, dispose: (() => void) | undefined;
afterEach(async () => {
  await act(async () => { root?.unmount(); dispose?.(); }); root = undefined; dispose = undefined;
  editors.clear(); mounts.mockClear(); unmounts.mockClear(); document.body.replaceChildren();
  window.localStorage.clear(); window.history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function pair(): ElementPartPair {
  const part = (kind: PartKind): ElementPartResource => ({ set_id: 'set-a', title: kind, document: validateElementSitePart({
    schema_version: 'g7-page-builder/site-part/v2', kind, content: { ...structuredClone(fixture), shell_mode: 'none', blocks: [],
      slug: 'site-' + kind, document_id: kind === 'header' ? fixture.document_id : '22222222-2222-4222-8222-222222222222' },
  }), lock_version: 1, revision: 1, active_revision: null, status: 'draft', created_at: null, updated_at: null, published_at: null });
  const header = part('header'), footer = part('footer');
  const summary = (part: ElementPartResource) => ({ site_part_id: part.document.content.document_id, revision: 1,
    active_revision: null, status: part.status, updated_at: null });
  return { set: { id: 'set-a', title: '정밀 세트', locale: fixture.locale, is_active: false, is_ready: false,
    header: summary(header), footer: summary(footer), created_at: null, updated_at: null }, header, footer };
}
function ports(): SitePartHostPorts {
  return { list: vi.fn(async () => [pair().set]), create: vi.fn(async () => pair().set), load: vi.fn(async () => pair()),
    draft: (source, saved) => ({ save: vi.fn(async request => {
      const value = { ...source, document: { ...source.document, content: JSON.parse(request.json) }, lock_version: request.expectedRevision + 1 };
      saved(value); return { documentId: request.documentId, revision: value.lock_version };
    }) }),
    publish: vi.fn(async source => {
      const value = structuredClone(source);
      for (const kind of ['header', 'footer'] as const) {
        value[kind].lock_version++; value[kind].status = 'published'; value[kind].active_revision = value[kind].revision;
        value.set[kind].status = 'published'; value.set[kind].active_revision = value[kind].revision;
      }
      value.set.is_ready = true; return value;
    }),
    activate: vi.fn(async set => ({ ...set, is_active: true })),
    navigate: vi.fn(), selected: vi.fn(), confirmLeave: vi.fn(() => false), confirmPublish: vi.fn(() => true),
    confirmActivate: vi.fn(() => true), nextId: () => crypto.randomUUID(),
  };
}
async function mount(value: SitePartHostPorts, setId?: string) {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<StructureSitePartHost ports={value} locale={fixture.locale} setId={setId} libraryUrl="/library" />));
}
const button = (name: string) => [...document.querySelectorAll('button')].find(item => item.textContent === name)!;
const click = async (name: string) => act(async () => button(name).click());
const editor = (kind: PartKind) => editors.get('site-' + kind)!;
const status = () => document.querySelector('[data-testid="structure-site-part-status"]')?.textContent;
const unload = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(accept => { resolve = accept; }); return { promise, resolve }; }
async function save(kind: PartKind, outcome: 'saved' | 'edited' = 'saved') {
  const props = editor(kind);
  await act(async () => {
    const result = await props.drafts.save({ documentId: props.document.document_id, json: JSON.stringify(props.document), expectedRevision: props.serverRevision });
    props.onSaved?.(result.revision, outcome);
  });
}
async function createInput(title: string) {
  await act(async () => {
    const input = document.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, title);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const submit = async () => act(async () => document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

it('opens both canonical owners in the same editor and preserves sessions across tabs and preview', async () => {
  await mount(ports(), 'set-a');
  const header = editor('header'), footer = editor('footer');
  expect(header.readonly).toBe(false); expect(footer.readonly).toBe(true); expect(mounts).toHaveBeenCalledTimes(2);
  await click('Footer'); expect(editor('footer').readonly).toBe(false); expect(editor('header').readonly).toBe(true);
  await click('공통영역 미리보기');
  expect(editor('header').readonly).toBe(true); expect(editor('footer').readonly).toBe(true);
  const preview = document.querySelector<HTMLElement>('[data-testid="site-part-pair-preview"]')!;
  expect(preview).not.toBeNull();
  expect(preview.style.background).toBe('var(--g7pb-surface-strong)');
  expect(editor('header').document).toBe(header.document);
  expect(editor('footer').document).toBe(footer.document);
  await click('Header');
  expect(editor('header').sessionId).toBe(header.sessionId); expect(editor('footer').document).toBe(footer.document);
  expect(mounts).toHaveBeenCalledTimes(2); expect(unmounts).not.toHaveBeenCalled();
});
it('preserves dirty protection after late-input save and requires both drafts before pair publication', async () => {
  const value = ports(); await mount(value, 'set-a'); expect(unload()).toBe(false);
  await act(async () => editor('header').onChange!(editor('header').document));
  expect(status()).toBe('저장할 변경 있음'); expect(unload()).toBe(true);
  expect(button('Header·Footer 함께 발행').disabled).toBe(true);
  await save('header', 'edited'); expect(unload()).toBe(true);
  await act(async () => document.querySelector('a')!.click()); expect(value.navigate).not.toHaveBeenCalled();
  expect(value.confirmLeave).toHaveBeenCalledOnce();
  await save('header'); expect(unload()).toBe(false); expect(editor('header').serverRevision).toBe(3);
  await act(async () => editor('footer').onChange!(editor('footer').document));
  expect(button('Header·Footer 함께 발행').disabled).toBe(true);
  await save('footer'); await click('Header·Footer 함께 발행');
  expect(value.publish).toHaveBeenCalledOnce(); expect(editor('header').serverRevision).toBe(4);
  expect(mounts).toHaveBeenCalledTimes(2); expect(button('사이트에 적용').disabled).toBe(false);
  await click('사이트에 적용'); expect(value.activate).toHaveBeenCalledOnce();
  expect(button('사이트에 적용').disabled).toBe(true);
});
it('cancels publication explicitly and preserves drafts after a failed pair publication', async () => {
  const value = ports(); value.confirmPublish = vi.fn(() => false); await mount(value, 'set-a');
  const source = editor('header').document;
  await click('Header·Footer 함께 발행'); expect(value.publish).not.toHaveBeenCalled();
  value.confirmPublish = () => true; value.publish = vi.fn(async () => { throw new Error('동시 발행 충돌'); });
  await click('Header·Footer 함께 발행');
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('동시 발행 충돌');
  expect(editor('header').document).toBe(source); expect(editor('header').serverRevision).toBe(1);
  expect(button('사이트에 적용').disabled).toBe(true); expect(unload()).toBe(false);
});
it('blocks duplicate publication and edits while the pair request is pending', async () => {
  const value = ports(), pending = deferred<ElementPartPair>(); value.publish = vi.fn(() => pending.promise);
  await mount(value, 'set-a'); await click('Header·Footer 함께 발행'); await click('Header·Footer 함께 발행');
  expect(value.publish).toHaveBeenCalledOnce(); expect(editor('header').readonly).toBe(true); expect(unload()).toBe(true);
  await act(async () => pending.resolve(pair())); expect(editor('header').readonly).toBe(false); expect(unload()).toBe(false);
});
it('keeps save pending state separate from dirty state and cannot publish in between', async () => {
  const value = ports(), pending = deferred<{ documentId: string; revision: number }>();
  value.draft = () => ({ save: () => pending.promise }); await mount(value, 'set-a');
  let saving!: Promise<{ documentId: string; revision: number }>;
  await act(async () => { saving = editor('header').drafts.save({ documentId: fixture.document_id, expectedRevision: 1, json: '{}' }); });
  expect(button('Header·Footer 함께 발행').disabled).toBe(true); expect(button('Footer').disabled).toBe(true); expect(unload()).toBe(true);
  await act(async () => { pending.resolve({ documentId: fixture.document_id, revision: 2 }); await saving; });
  expect(unload()).toBe(false);
});
it('creates an empty explicitly requested set without automatically bootstrapping existing content', async () => {
  const value = ports(); value.list = vi.fn(async () => []);
  await mount(value); expect(value.create).not.toHaveBeenCalled(); expect(value.load).not.toHaveBeenCalled();
  await createInput('새 정밀 세트'); await submit();
  expect(value.create).toHaveBeenCalledWith('새 정밀 세트', fixture.locale);
  expect(value.selected).toHaveBeenCalledWith('set-a'); expect(editor('header').document.blocks).toEqual([]);
});
it('keeps a failed creation form and does not retry the write automatically', async () => {
  const value = ports(); value.create = vi.fn(async () => { throw new Error('생성 실패'); });
  await mount(value); await createInput('유지할 이름'); await submit();
  expect(document.querySelector('input')?.value).toBe('유지할 이름');
  expect(value.create).toHaveBeenCalledOnce(); expect(document.querySelector('[role="alert"]')?.textContent).toBe('생성 실패');
});
it('does not mount a late loaded document after unmount or duplicate a pending creation', async () => {
  const value = ports(), pending = deferred<ElementPartPair>(); value.load = vi.fn(() => pending.promise);
  await mount(value); await createInput('이름'); await submit(); await submit();
  expect(value.create).toHaveBeenCalledOnce();
  await act(async () => root!.unmount()); root = undefined;
  await act(async () => pending.resolve(pair()));
  expect(value.selected).not.toHaveBeenCalled(); expect(mounts).not.toHaveBeenCalled();
});
it('sends legacy sources to the original editor with no write or v3 mount', async () => {
  const value = ports(); value.load = vi.fn(async () => ({ legacy: true as const }));
  await mount(value, 'set-a');
  expect(value.navigate).toHaveBeenCalledWith('/modules/jiwonpapa-page_builder/admin/site-parts?set_id=set-a&locale=' + fixture.locale);
  expect(mounts).not.toHaveBeenCalled(); expect(value.publish).not.toHaveBeenCalled();
});
it('reports missing set identity rather than editing the active/default set', async () => {
  const value = ports(); await mount(value, 'not-owned');
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('찾을 수 없습니다');
  expect(value.load).not.toHaveBeenCalled(); expect(mounts).not.toHaveBeenCalled();
});
it('mounts the authenticated product entry and survives a missing optional composition asset', async () => {
  const source = pair(); window.localStorage.setItem('auth_token', 'unit-token');
  window.history.replaceState(null, '', '?set_id=set-a&editor=structure');
  const fetchImpl = vi.fn<typeof fetch>(async url => {
    const path = String(url);
    if (path.includes('/site-part-sets?')) return new Response(JSON.stringify({ success: true, data: { items: [source.set] } }));
    if (path.includes('/site-parts/')) return new Response(JSON.stringify({ success: true, data: path.includes('/header?') ? source.header : source.footer }));
    return new Response('unavailable', { status: 503 });
  });
  vi.stubGlobal('fetch', fetchImpl);
  const host = document.createElement('div'); host.dataset.locale = fixture.locale; document.body.append(host);
  await act(async () => { dispose = mountStructureSiteParts(host); });
  expect(editor('header').document).toEqual(source.header.document.content);
  expect(document.body.textContent).toContain('구성 목록을 불러오지 못했습니다');
  expect(fetchImpl.mock.calls.some(([url]) => String(url).includes('block-packs'))).toBe(false);
  expect(fetchImpl.mock.calls.filter(([url]) => String(url).includes('/site-part-sets?'))).toHaveLength(1);
});
