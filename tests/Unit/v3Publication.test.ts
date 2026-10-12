import { expect, it, vi } from 'vitest';
import { createPublicationSession, type PublicationPort } from '../../resources/js/editor-application/v3/publication';
import type { EditContext, SaveOutcome } from '../../resources/js/editor-application/v3/session';

const candidate = { token: 'a'.repeat(64), hash: 'b'.repeat(64), warnings: ['주의 <문자>'] };
const published = { hash: candidate.hash, url: '/pages/test', publishedAt: '2026-10-13T00:00:00Z' };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup() {
  const context: EditContext = { documentId: 'doc', sessionId: 'session', revision: 5, readonly: false };
  const save = vi.fn(async (): Promise<SaveOutcome> => ({ status: 'saved', revision: 17 }));
  const port = { preview: vi.fn(async () => ({ url: '/preview/token', expiresAt: '2026-10-13T01:00:00Z' })),
    prepare: vi.fn(async () => candidate), commit: vi.fn(async () => published) } satisfies PublicationPort;
  const session = createPublicationSession({ context: () => context, save }, port);
  return { context, save, port, session };
}
it('saves the editor once and previews exactly that server lock without preparing or committing', async () => {
  const { session, save, port } = setup();
  expect(await session.preview()).toMatchObject({ url: '/preview/token', revision: 17 });
  expect(save).toHaveBeenCalledOnce(); expect(port.preview).toHaveBeenCalledExactlyOnceWith('doc', 17);
  expect(port.prepare).not.toHaveBeenCalled(); expect(port.commit).not.toHaveBeenCalled();
});
it('requires an explicit commit of the prepared version, preserves warnings, and never saves again in commit', async () => {
  const { session, save, port } = setup();
  const prepared = await session.prepare();
  expect(prepared).toEqual({ hash: candidate.hash, warnings: candidate.warnings, revision: 17 });
  expect(prepared).not.toHaveProperty('token');
  expect(port.commit).not.toHaveBeenCalled(); expect(session.canCommit()).toBe(true);
  expect(await session.commit()).toEqual({ ...published, edited: false });
  expect(port.commit).toHaveBeenCalledExactlyOnceWith(candidate.token); expect(save).toHaveBeenCalledOnce();
  expect(session.canCommit()).toBe(false); await expect(session.commit()).rejects.toThrow('먼저 준비');
});
it.each(['edited', 'stale'] as const)('rejects %s save acknowledgements before creating a preview or candidate', async status => {
  const { session, save, port } = setup();
  save.mockResolvedValue(status === 'stale' ? { status } : { status, revision: 17 });
  await expect(session.preview()).rejects.toThrow('추가 변경');
  await expect(session.prepare()).rejects.toThrow('추가 변경');
  expect(port.preview).not.toHaveBeenCalled(); expect(port.prepare).not.toHaveBeenCalled();
});
it.each(['revision', 'sessionId', 'documentId', 'readonly', 'cancel'] as const)('rejects a changed %s after saving and before any compilation', async change => {
  const { session, save, context, port } = setup(); const wait = deferred<SaveOutcome>(); save.mockReturnValue(wait.promise);
  const action = session.prepare();
  if (change === 'revision') context.revision++;
  else if (change === 'readonly') context.readonly = true;
  else if (change === 'cancel') session.cancel();
  else context[change] += '-new';
  wait.resolve({ status: 'saved', revision: 17 });
  await expect(action).rejects.toThrow('문맥'); expect(port.prepare).not.toHaveBeenCalled();
});
it.each(['preview', 'prepare'] as const)('rejects a late %s when input changes during compilation', async kind => {
  const { session, context, port } = setup();
  const wait = deferred<void>();
  port.prepare.mockImplementation(async () => { await wait.promise; return candidate; });
  port.preview.mockImplementation(async () => { await wait.promise; return { url: '/preview', expiresAt: 'later' }; });
  const action = session[kind](); await Promise.resolve(); context.revision++; wait.resolve();
  await expect(action).rejects.toThrow('문맥'); expect(session.canCommit()).toBe(false);
});
it('rejects changes, even edit then Undo, between preparation and commit', async () => {
  const { session, context, port } = setup(); await session.prepare(); context.revision += 2;
  expect(session.canCommit()).toBe(false); await expect(session.commit()).rejects.toThrow('문맥');
  expect(port.commit).not.toHaveBeenCalled();
});
it('keeps edits after the commit request as a separate draft and reports the confirmed publication', async () => {
  const { session, context, port } = setup(); await session.prepare(); const wait = deferred<typeof published>();
  port.commit.mockReturnValue(wait.promise); const action = session.commit(); context.revision++;
  wait.resolve(published); expect(await action).toEqual({ ...published, edited: true });
  expect(context.revision).toBe(6);
});
it('rejects a late commit response after document transition without publishing into the new editor session', async () => {
  const { session, context, port } = setup(); await session.prepare(); const wait = deferred<typeof published>();
  port.commit.mockReturnValue(wait.promise); const action = session.commit(); context.sessionId = 'next';
  wait.resolve(published); await expect(action).rejects.toThrow('문맥');
});
it('prevents overlapping requests and consumes uncertain candidates without automatic retry', async () => {
  const { session, port } = setup(); await session.prepare(); const wait = deferred<typeof published>();
  port.commit.mockReturnValue(wait.promise); const action = session.commit();
  await expect(session.commit()).rejects.toThrow('처리 중'); await expect(session.prepare()).rejects.toThrow('처리 중');
  wait.reject(new Error('network')); await expect(action).rejects.toThrow('network');
  await expect(session.commit()).rejects.toThrow('먼저 준비'); expect(port.commit).toHaveBeenCalledOnce();
});
it('checks readonly before saving and verifies the committed artifact identity', async () => {
  const { session, context, save, port } = setup(); context.readonly = true;
  await expect(session.prepare()).rejects.toThrow('문맥'); expect(save).not.toHaveBeenCalled();
  context.readonly = false; await session.prepare(); port.commit.mockResolvedValue({ ...published, hash: 'other' });
  await expect(session.commit()).rejects.toThrow('버전과 다릅니다');
});
it('cancels a prepared candidate and releases a failed-save request for retry', async () => {
  const { session, save, port } = setup(); save.mockRejectedValueOnce(new Error('409 conflict'));
  await expect(session.prepare()).rejects.toThrow('409 conflict'); expect(port.prepare).not.toHaveBeenCalled();
  await session.prepare(); session.cancel(); await expect(session.commit()).rejects.toThrow('먼저 준비');
});
