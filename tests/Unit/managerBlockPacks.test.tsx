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

import type { GitHubBlockPackCheckResource } from '../../resources/js/blocks/types';
function release(repository: string): GitHubBlockPackCheckResource {
  return { release: { repository, tag: 'v1.0.0', version: '1.0.0', asset_name: 'g7pb-block-pack.zip', asset_bytes: 1, sha256: 'a'.repeat(64), release_url: 'https://example.test/release', published_at: '2026-09-03' }, installed_version: null, update_available: true };
}
async function enter(label: string, value: string): Promise<void> {
  const field = [...document.querySelectorAll('label')].find(item => item.textContent?.trim() === label)?.querySelector('input');
  if (!field) throw new Error(`Expected field ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
describe('manager block-pack ownership', () => {
  it('discards a GitHub check after its input changes and requires the new input to be checked', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockPacks').mockResolvedValue({ items: [] });
    const first = deferred<GitHubBlockPackCheckResource>();
    const check = vi.spyOn(PageBuilderApiClient.prototype, 'checkGitHubBlockPack')
      .mockImplementationOnce(() => first.promise).mockResolvedValue(release('owner/second'));
    const install = vi.spyOn(PageBuilderApiClient.prototype, 'installGitHubBlockPack').mockRejectedValue(new Error('synthetic install failure'));
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-block-packs"]'));
    await enter('소유자', 'owner');
    await enter('저장소', 'first');
    await click(byText(document, '최신 버전 확인'));
    expect(check).toHaveBeenCalledWith('owner', 'first', 'g7pb-block-pack.zip');
    await enter('저장소', 'second');
    await act(async () => { first.resolve(release('owner/first')); });
    expect(document.querySelector('[data-testid="page-builder-github-pack-result"]')).toBeNull();
    expect(install).not.toHaveBeenCalled();
    await click(byText(document, '최신 버전 확인'));
    expect(document.querySelector('[data-testid="page-builder-github-pack-result"]')?.textContent).toContain('owner/second');
    await click(byText(document, '이 버전 설치'));
    expect(install).toHaveBeenCalledWith('owner', 'second', 'g7pb-block-pack.zip');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('synthetic install failure');
  });
  it('keeps the current check busy when a superseded check rejects', async () => {
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockPacks').mockResolvedValue({ items: [] });
    const first = deferred<GitHubBlockPackCheckResource>();
    const second = deferred<GitHubBlockPackCheckResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'checkGitHubBlockPack').mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-block-packs"]'));
    await enter('소유자', 'owner');
    await enter('저장소', 'first');
    await click(byText(document, '최신 버전 확인'));
    await enter('저장소', 'second');
    await click(byText(document, '최신 버전 확인'));
    await act(async () => { first.reject(new Error('old input failure')); });
    expect(byText(document, '확인 중')?.disabled).toBe(true);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    await act(async () => { second.resolve(release('owner/second')); });
    expect(document.querySelector('[data-testid="page-builder-github-pack-result"]')?.textContent).toContain('owner/second');
  });

  it('reopens the block-library deep link in the active StrictMode setup', async () => {
    window.history.replaceState({}, '', '/modules/jiwonpapa-page_builder/admin?view=block-library');
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockPacks').mockResolvedValue({ items: [] });
    await mount(true);
    const dialog = document.querySelector('[data-testid="page-builder-block-packs-dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.querySelector('[role="status"]')).toBeNull();
    expect(byText(document, '최신 버전 확인')?.disabled).toBe(false);
  });

});
