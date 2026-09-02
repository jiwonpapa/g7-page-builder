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

import type { FormSubmissionResource } from '../../resources/js/api/resources';
function submission(id: string, status: FormSubmissionResource['status'] = 'unread'): FormSubmissionResource {
  return { id, page_slug: 'fixture', block_instance_id: 'fixture', form_kind: 'inquiry', payload: {}, email: 'fixture@example.test', subject: id, status, mail_status: 'failed', mail_error: 'fixture', mail_attempts: 1, created_at: '2026-09-03', updated_at: '2026-09-03' };
}
function row(id: string): Element {
  const found = [...document.querySelectorAll('.g7pb-inbox-list article')].find(item => item.querySelector('h3')?.textContent === id);
  if (!found) throw new Error(`Expected inquiry ${id}`);
  return found;
}
describe('manager inbox ownership', () => {
  it('keeps both inquiry rows busy until each owning request completes', async () => {
    const first = deferred<FormSubmissionResource>();
    const second = deferred<FormSubmissionResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'listFormSubmissions').mockResolvedValue({ items: [submission('first'), submission('second')] });
    vi.spyOn(PageBuilderApiClient.prototype, 'updateFormSubmission').mockImplementation(id => id === 'first' ? first.promise : second.promise);
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-inbox"]'));
    await click(byText(row('first'), '읽음 처리'));
    await click(byText(row('second'), '읽음 처리'));
    expect(byText(row('first'), '읽음 처리')?.disabled).toBe(true);
    expect(byText(row('second'), '읽음 처리')?.disabled).toBe(true);
    await act(async () => { second.resolve(submission('second', 'read')); });
    expect(byText(row('first'), '읽음 처리')?.disabled).toBe(true);
    expect(byText(row('second'), '읽지 않음')?.disabled).toBe(false);
    await act(async () => { first.resolve(submission('first', 'read')); });
    expect(byText(row('first'), '읽지 않음')?.disabled).toBe(false);
  });
  it('ignores a closed inquiry request error without clearing the reopened row request', async () => {
    const old = deferred<FormSubmissionResource>();
    const current = deferred<FormSubmissionResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'listFormSubmissions').mockResolvedValue({ items: [submission('first')] });
    vi.spyOn(PageBuilderApiClient.prototype, 'updateFormSubmission').mockImplementationOnce(() => old.promise).mockImplementationOnce(() => current.promise);
    await mount();
    await click(document.querySelector('[data-testid="page-builder-manager-inbox"]'));
    await click(byText(row('first'), '읽음 처리'));
    const dialog = document.querySelector('[data-testid="page-builder-inbox-dialog"]');
    if (!dialog) throw new Error('Expected inquiry dialog');
    await click(byText(dialog, '닫기'));
    await click(document.querySelector('[data-testid="page-builder-manager-inbox"]'));
    await click(byText(row('first'), '읽음 처리'));
    await act(async () => { old.reject(new Error('closed session error')); });
    expect(byText(row('first'), '읽음 처리')?.disabled).toBe(true);
    expect(document.querySelector('[role="alert"]')).toBeNull();
    await act(async () => { current.resolve(submission('first', 'read')); });
    expect(byText(row('first'), '읽지 않음')?.disabled).toBe(false);
  });

});
