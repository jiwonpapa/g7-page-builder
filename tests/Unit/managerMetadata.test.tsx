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

import type { MediaAssetResource } from '../../resources/js/api/resources';
describe('manager metadata session ownership', () => {
  it('does not apply a closed document upload to the newly opened document', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(resource('a'), resource('b')));
    const upload = deferred<MediaAssetResource>();
    const uploadMedia = vi.spyOn(PageBuilderApiClient.prototype, 'uploadMedia').mockImplementation(() => upload.promise);
    await mount();
    await openAction('a', 'settings');
    const firstDialog = document.querySelector('[data-testid="page-builder-manager-metadata-dialog"]');
    if (!firstDialog) throw new Error('Expected metadata dialog');
    const fileInput = firstDialog.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('Expected file input');
    const file = new File(['synthetic'], 'a.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(uploadMedia).toHaveBeenCalledWith(file);
    await click(byText(firstDialog, '취소'));
    await openAction('b', 'settings');
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-seo-image"]')?.value).toBe('/b.png');
    await act(async () => { upload.resolve({ id: 'asset-a', url: '/upload-a.png', original_name: 'a.png', mime_type: 'image/png', bytes: 1, width: 1, height: 1, kind: 'image', created_at: '2026-09-03' }); });
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-metadata-title"]')?.value).toBe('Document b');
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-seo-image"]')?.value).toBe('/b.png');
  });
  it('keeps a completed save in the list without closing or changing a newer dialog', async () => {
    const a = resource('a');
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(a, resource('b')));
    const saved = deferred<DocumentResource>();
    const update = vi.spyOn(PageBuilderApiClient.prototype, 'updateDocument').mockImplementation(() => saved.promise);
    await mount(); await openAction('a', 'settings');
    await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    expect(update).toHaveBeenCalledWith('a', expect.objectContaining({ expected_lock_version: 7, locale: 'ko', slug: 'page-a' }));
    const dialog = document.querySelector('[data-testid="page-builder-manager-metadata-dialog"]');
    if (!dialog) throw new Error('Expected A metadata');
    await click(byText(dialog, '취소')); await openAction('b', 'settings');
    const title = document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-metadata-title"]');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(title, 'Unsaved B input'); title?.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { saved.resolve({ ...a, title: 'Saved A', lock_version: 8 }); });
    expect(row('a').querySelector('h3')?.textContent).toBe('Saved A');
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-metadata-title"]')?.value).toBe('Unsaved B input');
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-metadata-slug"]')?.value).toBe('page-b');
    expect(document.querySelector<HTMLButtonElement>('[data-testid="page-builder-manager-metadata-save"]')?.disabled).toBe(false);
  });

  it('preserves current input and permits retry after a save conflict', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue(list(resource('a')));
    const update = vi.spyOn(PageBuilderApiClient.prototype, 'updateDocument').mockRejectedValue(new Error('lock conflict'));
    await mount(); await openAction('a', 'settings');
    const title = document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-metadata-title"]');
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(title, 'Keep my title'); title?.dispatchEvent(new Event('input', { bubbles: true })); });
    await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    expect(update).toHaveBeenCalledWith('a', expect.objectContaining({ title: 'Keep my title', expected_lock_version: 7 }));
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-metadata-title"]')?.value).toBe('Keep my title');
    expect(document.querySelector<HTMLButtonElement>('[data-testid="page-builder-manager-metadata-save"]')?.disabled).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('lock conflict');
  });

  it('keeps a newer confirmed save when the same document older save arrives late', async () => {
    const a = resource('a'); const older = { ...a, title: 'Older saved A', lock_version: 8 }; const newest = { ...a, title: 'Newest saved A', lock_version: 9 };
    let activeRequests = 0;
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockImplementation((_page, _size, status) => Promise.resolve(
      status === 'archived' ? list() : list(++activeRequests === 1 ? a : older)));
    const first = deferred<DocumentResource>();
    const update = vi.spyOn(PageBuilderApiClient.prototype, 'updateDocument').mockImplementationOnce(() => first.promise).mockResolvedValueOnce(newest).mockResolvedValue(newest);
    await mount(); await openAction('a', 'settings');
    await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    let dialog = document.querySelector('[data-testid="page-builder-manager-metadata-dialog"]');
    if (!dialog) throw new Error('Expected A metadata'); await click(byText(dialog, '취소'));
    await click(document.querySelector('[data-testid="page-builder-manager-filter-archived"]'));
    await click(document.querySelector('[data-testid="page-builder-manager-filter-active"]'));
    await openAction('a', 'settings');
    await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    expect(update).toHaveBeenNthCalledWith(2, 'a', expect.objectContaining({ expected_lock_version: 8 }));
    expect(row('a').querySelector('h3')?.textContent).toBe('Newest saved A');
    await act(async () => { first.resolve(older); });
    expect(row('a').querySelector('h3')?.textContent).toBe('Newest saved A');
    await openAction('a', 'settings');
    await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    expect(update).toHaveBeenLastCalledWith('a', expect.objectContaining({ expected_lock_version: 9 }));
  });

  it('merges a confirmed save into an older pending list without adding another filter member', async () => {
    const a = resource('a'); const saved = { ...a, title: 'Confirmed saved A', lock_version: 8 };
    const staleList = deferred<DocumentListResource>(); const save = deferred<DocumentResource>(); let activeRequests = 0;
    vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockImplementation((_page, _size, status) => {
      if (status === 'archived') return Promise.resolve(list(resource('b', true)));
      return ++activeRequests === 1 ? Promise.resolve(list(a)) : staleList.promise;
    });
    const update = vi.spyOn(PageBuilderApiClient.prototype, 'updateDocument').mockImplementationOnce(() => save.promise).mockResolvedValue(saved);
    await mount(); await openAction('a', 'settings');
    await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    const dialog = document.querySelector('[data-testid="page-builder-manager-metadata-dialog"]');
    if (!dialog) throw new Error('Expected A metadata'); await click(byText(dialog, '취소'));
    await click(document.querySelector('[data-testid="page-builder-manager-filter-archived"]'));
    await click(document.querySelector('[data-testid="page-builder-manager-filter-active"]'));
    await act(async () => { save.resolve(saved); });
    await act(async () => { staleList.resolve(list(a)); });
    expect(row('a').querySelector('h3')?.textContent).toBe('Confirmed saved A');
    expect(document.querySelector('[data-document-id="b"]')).toBeNull();
    expect(document.querySelector('[data-testid="page-builder-manager-count"]')?.textContent).toBe('1개 문서');
    await openAction('a', 'settings'); await click(document.querySelector('[data-testid="page-builder-manager-metadata-save"]'));
    expect(update).toHaveBeenLastCalledWith('a', expect.objectContaining({ expected_lock_version: 8 }));
  });

});
