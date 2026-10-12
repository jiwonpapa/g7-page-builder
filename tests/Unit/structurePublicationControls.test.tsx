import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PublicationControls, type PublicationControlsProps } from '../../resources/js/editor/v3/PublicationControls';
import type { EditContext, SaveOutcome } from '../../resources/js/editor-application/v3/session';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
});
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks();
  for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});
function setup() {
  const context: EditContext = { documentId: 'doc', sessionId: 'one', revision: 1, readonly: false };
  const props: PublicationControlsProps = {
    context: () => context, save: vi.fn(async (): Promise<SaveOutcome> => ({ status: 'saved', revision: 2 })), disabled: false, editRevision: 1,
    port: { preview: vi.fn(async () => ({ url: '/preview', expiresAt: 'later' })),
      prepare: vi.fn(async () => ({ token: 'token', hash: 'hash', warnings: ['<b>그대로 표시</b>'] })),
      commit: vi.fn(async () => ({ url: '/public', hash: 'hash', publishedAt: 'now' })) }, busy: vi.fn(), published: vi.fn(),
  };
  const render = async () => {
    if (!root) { const host = document.createElement('div'); document.body.append(host); root = createRoot(host); }
    await act(async () => root!.render(<PublicationControls {...props} />));
  };
  return { props, context, render };
}
async function click(text: string) { await act(async () => {
  const button = [...document.querySelectorAll('button')].find(item => item.textContent === text);
  if (!button) throw new Error('Missing button ' + text); button.click();
}); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
it('provides a saved public preview link without publishing or confusing it with structure preview', async () => {
  const { props, render } = setup(); await render(); await click('공개 미리보기 준비');
  const link = document.querySelector('a')!; expect(link.textContent).toBe('공개 미리보기 열기');
  expect(link.getAttribute('href')).toBe('/preview'); expect(link.rel).toBe('noopener noreferrer');
  expect(props.port.commit).not.toHaveBeenCalled(); expect(props.save).toHaveBeenCalledOnce();
});
it('shows a native modal with plain warnings and commits only after explicit confirmation', async () => {
  const { props, render } = setup(); await render(); await click('발행 준비');
  expect(document.querySelector('dialog')?.open).toBe(true); expect(document.querySelector('li')?.textContent).toBe('<b>그대로 표시</b>');
  expect(document.querySelector('li b')).toBeNull(); expect(props.port.commit).not.toHaveBeenCalled();
  await click('이 버전 발행'); expect(props.port.commit).toHaveBeenCalledExactlyOnceWith('token');
  expect(props.published).toHaveBeenCalledOnce(); expect(document.querySelector('dialog')).toBeNull();
  expect(document.querySelector('a')?.textContent).toBe('공개 페이지 열기');
});
it.each(['button', 'escape'])('cancels the prepared version using %s without committing', async mode => {
  const { props, render } = setup(); await render(); await click('발행 준비');
  if (mode === 'button') await click('취소');
  else await act(async () => document.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(document.querySelector('dialog')).toBeNull(); expect(props.port.commit).not.toHaveBeenCalled();
});
it('invalidates the confirmation and preview after subsequent edits', async () => {
  const { props, context, render } = setup(); await render(); await click('공개 미리보기 준비'); await click('발행 준비');
  context.revision++; props.editRevision++; await render();
  expect(document.querySelector('dialog')).toBeNull(); expect(document.querySelector('a')).toBeNull();
  expect(document.body.textContent).toContain('준비 이후 문서가 변경'); expect(props.port.commit).not.toHaveBeenCalled();
});
it('handles failed preview and commit without clearing input or automatically retrying', async () => {
  const { props, render } = setup();
  props.port.preview = vi.fn().mockRejectedValue(new Error('preview unavailable'));
  props.port.commit = vi.fn().mockRejectedValue(new Error('409 conflict'));
  await render(); await click('공개 미리보기 준비'); expect(document.body.textContent).toContain('preview unavailable');
  await click('발행 준비'); await click('이 버전 발행');
  expect(document.body.textContent).toContain('발행 상태를 확인하지 못했습니다');
  expect(document.body.textContent).toContain('409 conflict'); expect(props.published).not.toHaveBeenCalled();
  expect(props.port.commit).toHaveBeenCalledOnce(); expect(props.busy).toHaveBeenLastCalledWith(false);
});
it('keeps the newer draft dirty when the confirmed version finishes publishing', async () => {
  const { props, context, render } = setup(); const wait = deferred<{ url: string; hash: string; publishedAt: string }>();
  props.port.commit = vi.fn(() => wait.promise); await render(); await click('발행 준비'); await click('이 버전 발행');
  context.revision++; props.editRevision++; await render();
  await act(async () => wait.resolve({ url: '/public', hash: 'hash', publishedAt: 'now' }));
  expect(document.body.textContent).toContain('이후 편집한 내용은 별도 초안');
  expect(props.published).toHaveBeenCalledOnce();
});
it('disables readonly controls and ignores a late response after unmount', async () => {
  const { props, render } = setup(); props.disabled = true; await render(); await click('발행 준비');
  expect(props.save).not.toHaveBeenCalled(); props.disabled = false;
  const wait = deferred<{ token: string; hash: string; warnings: string[] }>(); props.port.prepare = vi.fn(() => wait.promise);
  await render(); await click('발행 준비');
  await act(async () => root!.unmount()); root = undefined;
  await act(async () => wait.resolve({ token: 'token', hash: 'hash', warnings: [] }));
  expect(document.querySelector('dialog')).toBeNull(); expect(props.port.commit).not.toHaveBeenCalled();
});
