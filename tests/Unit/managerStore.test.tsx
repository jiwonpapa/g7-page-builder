import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageBuilderManager } from '../../resources/js/manager/PageBuilderManager';
import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
beforeEach(() => {
  window.localStorage.setItem('auth_token', 'test-token');
  vi.spyOn(PageBuilderApiClient.prototype, 'listDocuments').mockResolvedValue({ items: [], pagination: { page: 1, per_page: 100, total: 0 } });
});
afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function mount(strict = false): Promise<void> {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root?.render(strict ? <React.StrictMode><PageBuilderManager /></React.StrictMode> : <PageBuilderManager />); });
}
async function click(button: HTMLButtonElement | null): Promise<void> {
  if (!button) throw new Error('Expected an enabled UI control');
  await act(async () => { button.click(); });
}
function byText(scope: ParentNode, text: string): HTMLButtonElement | null {
  return [...scope.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text) ?? null;
}

import type { OfficialStoreCatalogResource, OfficialStoreProduct } from '../../resources/js/store/types';
const product: OfficialStoreProduct = {
  product_id: 'fixture/kit', product_type: 'page_kit', product_version: '1.0.0',
  title: { ko: 'fixture' }, description: { ko: 'synthetic contract' }, category: 'test', tags: [], license: 'free',
  compatibility: { page_builder: '*', php: '*', g7: '*' }, preview: { thumbnail_url: '/fixture.png', screenshots: [] },
  artifact: { url: '/fixture.zip', sha256: 'a'.repeat(64), bytes: 1 }, requirements: { blocks: [] },
  compatible: true, compatibility_error: null, installed: false, installed_state: null,
};
function catalog(title: string): OfficialStoreCatalogResource {
  return { catalog_version: 'g7pb-store/v1', publisher: { id: 'jiwonpapa', name: 'fixture' }, generated_at: '2026-09-03', products: [{ ...product, title: { ko: title } }] };
}
describe('manager store ownership', () => {
  it('keeps the latest catalog when an earlier closed dialog responds last', async () => {
    const first = deferred<OfficialStoreCatalogResource>();
    const second = deferred<OfficialStoreCatalogResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'getOfficialStoreCatalog')
      .mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-page-kits"]'));
    const dialog = document.querySelector('[data-testid="page-builder-store-dialog"]');
    if (!dialog) throw new Error('Expected store dialog');
    await click(byText(dialog, '닫기'));
    await click(document.querySelector('[data-testid="page-builder-manager-page-kits"]'));
    await act(async () => { second.resolve(catalog('new owner')); });
    expect(document.querySelector('[data-testid="page-builder-store-product"]')?.textContent).toContain('new owner');
    await act(async () => { first.resolve(catalog('old owner')); });
    expect(document.querySelector('[data-testid="page-builder-store-product"]')?.textContent).toContain('new owner');
    expect(document.querySelector('[data-testid="page-builder-store-product"]')?.textContent).not.toContain('old owner');
  });
  it('reactivates a StrictMode deep link and ignores errors from superseded requests', async () => {
    window.history.replaceState({}, '', '/modules/jiwonpapa-page_builder/admin?view=page-kits');
    const pending: ReturnType<typeof deferred<OfficialStoreCatalogResource>>[] = [];
    vi.spyOn(PageBuilderApiClient.prototype, 'getOfficialStoreCatalog').mockImplementation(() => {
      const request = deferred<OfficialStoreCatalogResource>(); pending.push(request); return request.promise;
    });
    await mount(true);
    const latest = pending.at(-1);
    if (!latest) throw new Error('Expected the active setup to request its catalog');
    await act(async () => { latest.resolve(catalog('active setup')); });
    await act(async () => { for (const request of pending.slice(0, -1)) request.reject(new Error('stale setup error')); });
    expect(document.querySelector('[data-testid="page-builder-store-product"]')?.textContent).toContain('active setup');
    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it('preserves the typed Page Kit input and allows retry after application fails', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'getOfficialStoreCatalog').mockResolvedValue(catalog('apply fixture'));
    const apply = vi.spyOn(PageBuilderApiClient.prototype, 'applyOfficialStorePageKit').mockRejectedValue(new Error('apply failed'));
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-page-kits"]'));
    await click(document.querySelector('[data-testid="page-builder-store-apply-page-kit"]'));
    for (const [testId, value] of [['page-builder-store-page-kit-title', 'Typed title'], ['page-builder-store-page-kit-slug', 'typed-slug']]) {
      const field = document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
        field?.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
    await click(document.querySelector('[data-testid="page-builder-store-page-kit-confirm"]'));
    expect(apply).toHaveBeenCalledWith({ product_id: 'fixture/kit', product_version: '1.0.0', title: 'Typed title', slug: 'typed-slug' });
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-store-page-kit-title"]')?.value).toBe('Typed title');
    expect(document.querySelector<HTMLInputElement>('[data-testid="page-builder-store-page-kit-slug"]')?.value).toBe('typed-slug');
    expect(document.querySelector<HTMLButtonElement>('[data-testid="page-builder-store-page-kit-confirm"]')?.disabled).toBe(false);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('apply failed');
  });

  it('releases the completed download URL and does not start a download after unmount', async () => {
    vi.mocked(PageBuilderApiClient.prototype.listDocuments).mockResolvedValue({ items: [{
      title: 'Export fixture', document: { schema_version: 'g7-page-builder/v2', document_id: '123e4567-e89b-42d3-a456-426614174000', slug: 'export-fixture', mode: 'canvas', locale: 'ko', tokens: {}, blocks: [] },
      revision: 1, lock_version: 1, status: 'draft', public_url: null, active_artifact_sha256: null, is_home: false, has_unpublished_changes: true,
      created_at: '2026-09-03', updated_at: '2026-09-03', published_at: null, archived_at: null,
    }], pagination: { page: 1, per_page: 100, total: 1 } });
    const next = deferred<Awaited<ReturnType<PageBuilderApiClient['downloadPageKit']>>>();
    const result = { blob: new Blob(['synthetic archive bytes']), filename: 'fixture.zip', sha256: 'a'.repeat(64) };
    vi.spyOn(PageBuilderApiClient.prototype, 'downloadPageKit').mockResolvedValueOnce(result).mockImplementationOnce(() => next.promise);
    const create = vi.fn(() => 'blob:fixture');
    const revoke = vi.fn();
    vi.stubGlobal('URL', class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await mount();
    const openExport = async () => {
      await click(document.querySelector('[data-testid="page-builder-manager-more"]'));
      await click(document.querySelector('[data-testid="page-builder-manager-export-page-kit"]'));
      await click(document.querySelector('[data-testid="page-builder-export-page-kit-confirm"]'));
    };
    await openExport();
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:fixture');
    expect(document.querySelector('a[download="fixture.zip"]')).toBeNull();
    await openExport();
    await act(async () => { root?.unmount(); root = undefined; });
    await act(async () => { next.resolve(result); });
    expect(create).toHaveBeenCalledOnce();
  });

});
