import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageBuilderManager, mountPageBuilderManager } from '../../resources/js/manager/PageBuilderManager';
import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';
import type { DocumentResource, DocumentListResource } from '../../resources/js/api/resources';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
const disposers: (() => void)[] = [];
beforeEach(() => { window.localStorage.setItem('auth_token', 'test-token'); });
afterEach(() => {
  if (root) act(() => root?.unmount());
  for (const dispose of disposers.splice(0)) act(dispose);
  root = undefined;
  document.body.replaceChildren();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function resource(id: string, archived = false): DocumentResource {
  return { title: `Document ${id}`, document: { schema_version: 'g7-page-builder/v2', document_id: id, slug: `page-${id}`, mode: 'canvas', locale: 'ko', tokens: {}, blocks: [], seo: { title: '', description: '', robots: 'index', og_image_url: `/${id}.png` } },
    revision: 20, lock_version: 7, status: archived ? 'archived' : 'published', public_url: archived ? null : `/pages/page-${id}`, active_artifact_sha256: archived ? null : 'a'.repeat(64), is_home: false, has_unpublished_changes: false,
    created_at: '2026-09-03', updated_at: '2026-09-03', published_at: '2026-09-03', archived_at: archived ? '2026-09-03' : null };
}
function list(...items: DocumentResource[]): DocumentListResource { return { items, pagination: { page: 1, per_page: 100, total: items.length } }; }
async function mount(strict = false): Promise<void> {
  const container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(async () => { root?.render(strict ? <React.StrictMode><PageBuilderManager /></React.StrictMode> : <PageBuilderManager />); });
}
async function click(button: HTMLButtonElement | null): Promise<void> {
  if (!button) throw new Error('Expected UI control');
  await act(async () => { button.click(); });
}
function byText(scope: ParentNode, text: string): HTMLButtonElement | null {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text) ?? null;
}
function row(id: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-document-id="${id}"]`);
  if (!element) throw new Error(`Expected document ${id}`);
  return element;
}
async function openAction(id: string, action: string): Promise<void> {
  await click(row(id).querySelector('[data-testid="page-builder-manager-more"]'));
  await click(row(id).querySelector(`[data-testid="page-builder-manager-${action}"]`));
}

describe('manager document lifecycle ownership', () => {
  it('keeps the replacement mount alive when the previous mount is disposed', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(resource('a')));
    const container = document.createElement('div'); document.body.append(container);
    let disposeFirst!: () => void;
    await act(async () => { disposeFirst = mountPageBuilderManager(container); });
    await act(async () => { disposers.push(mountPageBuilderManager(container)); });
    expect(container.querySelector('[data-document-id="a"]')).not.toBeNull();
    await act(async () => { disposeFirst(); });
    expect(container.querySelector('[data-document-id="a"]')).not.toBeNull();
    await click(container.querySelector('[data-testid="page-builder-manager-create"]'));
    expect(container.querySelector('[data-testid="page-builder-manager-create-dialog"]')).not.toBeNull();
    await act(async () => { disposers.pop()?.(); });
    expect(container.childElementCount).toBe(0);
  });

  it('keeps the selected archived list when an earlier home action refresh resolves', async () => {
    const active = resource('a'); const archived = resource('b', true);
    const home = deferred<DocumentResource>(); const oldRefresh = deferred<DocumentListResource>();
    let activeRequests = 0;
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockImplementation((_page, _perPage, status) => {
      if (status === 'archived') return Promise.resolve(list(archived));
      return ++activeRequests === 1 ? Promise.resolve(list(active)) : oldRefresh.promise;
    });
    const setHome = vi.spyOn(PageBuilderApiClient.prototype, 'setHomeDocument').mockImplementation(() => home.promise);
    await mount();
    await openAction('a', 'home');
    expect(setHome).toHaveBeenCalledWith('a', true, 7);
    await click(document.querySelector('[data-testid="page-builder-manager-filter-archived"]'));
    expect(row('b').textContent).toContain('Document b');
    await act(async () => { home.resolve({ ...active, is_home: true, lock_version: 8 }); });
    await act(async () => { oldRefresh.resolve(list({ ...active, is_home: true })); });
    expect(document.querySelector('[data-testid="page-builder-manager-filter-archived"]')?.getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-document-id="b"]')).not.toBeNull();
    expect(document.querySelector('[data-document-id="a"]')).toBeNull();
    expect(document.querySelector('[data-testid="page-builder-manager-restore-archived"]')).not.toBeNull();
  });
  it('reactivates the StrictMode owner and ignores a superseded list error', async () => {
    const requests: ReturnType<typeof deferred<DocumentListResource>>[] = [];
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockImplementation(() => {
      const request = deferred<DocumentListResource>(); requests.push(request); return request.promise;
    });
    await mount(true);
    const current = requests.at(-1); if (!current) throw new Error('Expected active list request');
    await act(async () => { current.resolve(list(resource('current'))); });
    await act(async () => { requests.slice(0, -1).forEach(request => request.reject(new Error('old setup'))); });
    expect(row('current').textContent).toContain('Document current');
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(document.querySelector('[data-testid="page-builder-manager-app"]')?.getAttribute('aria-busy')).toBe('false');
  });

  it('keeps an in-flight list request valid when the selected filter is clicked again', async () => {
    const request = deferred<DocumentListResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockImplementation(() => request.promise);
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-filter-active"]'));
    await act(async () => { request.resolve(list(resource('a'))); });
    expect(document.querySelector('[data-document-id="a"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="page-builder-manager-app"]')?.getAttribute('aria-busy')).toBe('false');
  });

});
