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

import type { RevisionListResource } from '../../resources/js/api/resources';
function history(id: string, current: number): RevisionListResource {
  return { current_revision: current, items: [current, current - 1].map(revision => ({ revision, schema_version: 'g7-page-builder/v2', title: `${id} revision ${revision}`, slug: `page-${id}`, locale: 'ko', block_count: 0, author_id: null, created_at: '2026-09-03' })) };
}
describe('manager revision session ownership', () => {
  it('keeps the latest document history when a previously closed history responds last', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(resource('a'), resource('b')));
    const first = deferred<RevisionListResource>(); const second = deferred<RevisionListResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'listRevisions').mockImplementation(id => id === 'a' ? first.promise : second.promise);
    await mount();
    await openAction('a', 'revisions');
    const firstDialog = document.querySelector('[data-testid="page-builder-manager-revisions-dialog"]');
    if (!firstDialog) throw new Error('Expected history dialog');
    await click(byText(firstDialog, '닫기'));
    await openAction('b', 'revisions');
    await act(async () => { second.resolve(history('b', 20)); });
    expect(document.querySelector('[data-testid="page-builder-revision-list"]')?.textContent).toContain('b revision 20');
    await act(async () => { first.resolve(history('a', 2)); });
    expect(document.querySelector('#g7pb-manager-revisions-heading')?.textContent).toBe('Document b');
    expect(document.querySelector('[data-testid="page-builder-revision-list"]')?.textContent).toContain('b revision 20');
    expect(document.querySelector('[data-testid="page-builder-revision-list"]')?.textContent).not.toContain('a revision');
  });
  it('keeps a completed restore in the document list after its dialogs close', async () => {
    const a = resource('a');
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(a, resource('b')));
    vi.spyOn(PageBuilderApiClient.prototype, 'listRevisions').mockImplementation(id => Promise.resolve(history(id, 20)));
    const restored = deferred<DocumentResource>();
    const restore = vi.spyOn(PageBuilderApiClient.prototype, 'restoreRevision').mockImplementation(() => restored.promise);
    await mount(); await openAction('a', 'revisions');
    await click(document.querySelector('[data-revision="19"] [data-testid="page-builder-revision-restore"]'));
    await click(document.querySelector('[data-testid="page-builder-revision-restore-confirm"]'));
    expect(restore).toHaveBeenCalledWith('a', 19, 7);
    const confirm = document.querySelector('[data-testid="page-builder-revision-restore-dialog"]');
    if (!confirm) throw new Error('Expected restore confirmation');
    await click(byText(confirm, '취소'));
    const dialog = document.querySelector('[data-testid="page-builder-manager-revisions-dialog"]');
    if (!dialog) throw new Error('Expected A history');
    await click(byText(dialog, '닫기')); await openAction('b', 'revisions');
    await act(async () => { restored.resolve({ ...a, title: 'Restored A', revision: 21, lock_version: 8 }); });
    expect(row('a').querySelector('h3')?.textContent).toBe('Restored A');
    expect(document.querySelector('#g7pb-manager-revisions-heading')?.textContent).toBe('Document b');
    expect(document.querySelector('[data-testid="page-builder-revision-list"]')?.textContent).toContain('b revision 20');
    expect(document.querySelector('[data-testid="page-builder-revision-restore-dialog"]')).toBeNull();
  });

  it('opens previews synchronously and closes only pending windows when their history closes', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(resource('a'), resource('b')));
    vi.spyOn(PageBuilderApiClient.prototype, 'listRevisions').mockImplementation(id => Promise.resolve(history(id, 20)));
    const firstFrame = document.createElement('iframe'); const secondFrame = document.createElement('iframe');
    document.body.append(firstFrame, secondFrame);
    const firstWindow = firstFrame.contentWindow; const secondWindow = secondFrame.contentWindow;
    if (!firstWindow || !secondWindow) throw new Error('Expected independent preview windows');
    const closeFirst = vi.spyOn(firstWindow, 'close').mockImplementation(() => {});
    const closeSecond = vi.spyOn(secondWindow, 'close').mockImplementation(() => {});
    const open = vi.spyOn(window, 'open').mockReturnValueOnce(firstWindow).mockReturnValueOnce(secondWindow);
    const first = deferred<{ preview_url: string; expires_at: string }>(); const second = deferred<{ preview_url: string; expires_at: string }>();
    const preview = vi.spyOn(PageBuilderApiClient.prototype, 'createRevisionPreview')
      .mockImplementationOnce(() => { expect(open).toHaveBeenCalledWith('about:blank', '_blank'); return first.promise; })
      .mockImplementationOnce(() => second.promise);
    await mount(); await openAction('a', 'revisions');
    await click(document.querySelector('[data-revision="20"] [data-testid="page-builder-revision-preview"]'));
    expect(preview).toHaveBeenCalledWith('a', 20);
    expect(firstWindow.document.title).toBe('미리보기 준비 중');
    await act(async () => { first.resolve({ preview_url: 'about:blank#accepted', expires_at: '2026-09-03' }); });
    expect(firstWindow.location.hash).toBe('#accepted');
    let dialog = document.querySelector('[data-testid="page-builder-manager-revisions-dialog"]');
    if (!dialog) throw new Error('Expected A history');
    await click(byText(dialog, '닫기'));
    expect(closeFirst).not.toHaveBeenCalled();
    await openAction('b', 'revisions');
    await click(document.querySelector('[data-revision="20"] [data-testid="page-builder-revision-preview"]'));
    dialog = document.querySelector('[data-testid="page-builder-manager-revisions-dialog"]');
    if (!dialog) throw new Error('Expected B history');
    await click(byText(dialog, '닫기'));
    expect(closeSecond).toHaveBeenCalled();
    await act(async () => { second.resolve({ preview_url: 'about:blank#stale', expires_at: '2026-09-03' }); });
    expect(secondWindow.location.hash).toBe('');
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('does not replace a newer row with a delayed lower-lock restore result', async () => {
    const a = resource('a'); const old = { ...a, title: 'Older restored A', lock_version: 8 }; const latest = { ...a, title: 'Latest restored A', lock_version: 9 };
    let activeRequests = 0;
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockImplementation((_page, _size, status) => Promise.resolve(
      status === 'archived' ? list() : list(++activeRequests === 1 ? a : latest)));
    vi.spyOn(PageBuilderApiClient.prototype, 'listRevisions').mockImplementation(id => Promise.resolve(history(id, 20)));
    const restore = deferred<DocumentResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'restoreRevision').mockImplementation(() => restore.promise);
    await mount(); await openAction('a', 'revisions');
    await click(document.querySelector('[data-revision="19"] [data-testid="page-builder-revision-restore"]'));
    await click(document.querySelector('[data-testid="page-builder-revision-restore-confirm"]'));
    const confirm = document.querySelector('[data-testid="page-builder-revision-restore-dialog"]');
    if (!confirm) throw new Error('Expected restore confirmation'); await click(byText(confirm, '취소'));
    const dialog = document.querySelector('[data-testid="page-builder-manager-revisions-dialog"]');
    if (!dialog) throw new Error('Expected A history'); await click(byText(dialog, '닫기'));
    await click(document.querySelector('[data-testid="page-builder-manager-filter-archived"]'));
    await click(document.querySelector('[data-testid="page-builder-manager-filter-active"]'));
    expect(row('a').querySelector('h3')?.textContent).toBe('Latest restored A');
    await act(async () => { restore.resolve(old); });
    expect(row('a').querySelector('h3')?.textContent).toBe('Latest restored A');
  });

});
