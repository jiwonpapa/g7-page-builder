// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { createMediaSession, createMediaInsertionSession, type MediaChoice, type MediaInsertionContext, type MediaTarget } from '../../resources/js/editor-application/v3/media';
import { captureComposition, createCompositionLibrarySession, type UserComposition } from '../../resources/js/editor-application/v3/compositionLibrary';
import { createRecoverySession, type RecoveryContext, type RecoveryDraft } from '../../resources/js/editor-application/v3/recovery';
import type { EditContext } from '../../resources/js/editor-application/v3/session';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const source = () => validateDocumentV3(structuredClone(fixture));
const context = (): EditContext => ({ documentId: fixture.document_id, sessionId: 'resource-session', revision: 1, readonly: false });
const image: MediaChoice = { ...fixture.assets[0], name: 'image.webp', width: 160, height: 80 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}

describe('v3 resource sessions without a host engine', () => {
  for (const change of ['node', 'document', 'session', 'revision', 'readonly', 'cancel'] as const) {
    it('does not apply a media upload after ' + change + ' changes', async () => {
      const target: MediaTarget = { context: context(), nodeId: id(4) }, commit = vi.fn(), pending = deferred<MediaChoice>();
      const session = createMediaSession(() => target, commit);
      const request = session.upload({ list: async () => [], upload: () => pending.promise }, {}, '지연 이미지');
      if (change === 'node') target.nodeId = id(77);
      if (change === 'document') target.context.documentId = id(78);
      if (change === 'session') target.context.sessionId = 'next-session';
      if (change === 'revision') target.context.revision++;
      if (change === 'readonly') target.context.readonly = true;
      if (change === 'cancel') session.cancel();
      pending.resolve(image);
      expect(await request).toEqual({ status: 'stale' });
      expect(commit).not.toHaveBeenCalled();
    });
  }
  it('rejects parallel media writes and commits one asset command with its original context', async () => {
    const target: MediaTarget = { context: context(), nodeId: id(4) }, commit = vi.fn(), pending = deferred<MediaChoice>();
    const session = createMediaSession(() => target, commit), port = { list: async () => [], upload: () => pending.promise };
    const request = session.upload(port, {}, '새 이미지');
    await expect(session.upload(port, {}, '다른 이미지')).rejects.toThrow('media_pending');
    pending.resolve(image);
    expect((await request).status).toBe('ready');
    expect(commit).toHaveBeenCalledExactlyOnceWith({ kind: 'image', id: id(4),
      asset: { asset_id: image.asset_id, url: image.url }, alt: '새 이미지' }, target.context);
  });
  for (const change of ['document', 'session', 'revision', 'readonly', 'selection', 'destination', 'cancel'] as const) {
    it('does not insert a late first image after ' + change + ' changes', async () => {
      const target: MediaInsertionContext = { context: context(), destination: { parentId: null, index: 0 }, selection: [] };
      const commit = vi.fn(), pending = deferred<MediaChoice>(), session = createMediaInsertionSession(() => target, commit);
      const request = session.upload({ list: async () => [], upload: () => pending.promise }, {}, '이미지');
      if (change === 'document') target.context.documentId = id(78);
      if (change === 'session') target.context.sessionId = 'next-session';
      if (change === 'revision') target.context.revision++;
      if (change === 'readonly') target.context.readonly = true;
      if (change === 'selection') target.selection = [id(79)];
      if (change === 'destination') target.destination.index++;
      if (change === 'cancel') session.cancel();
      pending.resolve(image);
      expect(await request).toEqual({ status: 'stale' });
      expect(commit).not.toHaveBeenCalled();
    });
  }
  it('captures an independent composition and marks a late save stale without mutating the page', async () => {
    const document = source(), original = JSON.stringify(document), current = context();
    let sequence = 5000;
    const pending = deferred<UserComposition>(), create = vi.fn((_title: string, _source: DocumentV3) => pending.promise);
    const session = createCompositionLibrarySession(() => ({ context: current, document, ids: [document.blocks[0].instance_id] }), () => id(sequence++));
    const port = { list: async () => [], create, remove: async () => {} };
    const request = session.save(port, ' 독립 구성 ');
    await expect(session.save(port, '중복 요청')).rejects.toThrow('composition_pending');
    const captured = create.mock.calls[0][1];
    expect(captured.document_id).not.toBe(document.document_id);
    expect(captured.shell_mode).toBe('none');
    expect(captured.blocks[0].instance_id).not.toBe(document.blocks[0].instance_id);
    current.revision++;
    pending.resolve({ id: id(8000), title: '독립 구성', source: captured });
    expect((await request).status).toBe('stale');
    expect(JSON.stringify(document)).toBe(original);
    expect(create).toHaveBeenCalledOnce();
  });
  it('rejects an internal link outside a captured selection and remaps it with the complete selection', () => {
    const document = source(), link = createPrimitive('action.link', id(8001), document);
    if (link.type !== 'action.link') throw new Error('Expected link');
    link.props.link.url = '#node-' + document.blocks[0].instance_id;
    document.blocks[0].slots.content!.push(link);
    let sequence = 9000;
    expect(() => captureComposition(document, [link.instance_id], () => id(sequence++))).toThrow('composition_reference');
    const captured = captureComposition(document, [document.blocks[0].instance_id], () => id(sequence++));
    const copy = captured.blocks[0].slots.content!.at(-1)!;
    expect(copy.type).toBe('action.link');
    if (copy.type !== 'action.link') throw new Error('Expected copied link');
    expect(copy.props.link.url).toBe('#node-' + captured.blocks[0].instance_id);
  });

  const recoveryContext = (): RecoveryContext => ({ documentId: fixture.document_id, sessionId: 'restore-session', editRevision: 1,
    serverRevision: 1, publishedHash: 'a'.repeat(64), readonly: false, dirty: false });
  for (const state of ['readonly', 'dirty', 'unconfirmed'] as const) {
    it('rejects recovery before I/O when ' + state, async () => {
      const current = recoveryContext(), read = vi.fn(async () => source()), restore = vi.fn();
      if (state === 'readonly') current.readonly = true;
      if (state === 'dirty') current.dirty = true;
      const session = createRecoverySession(() => current);
      await expect(session.restore({ list: async () => [], source: read, restore }, 1, state !== 'unconfirmed')).rejects.toThrow();
      expect(read).not.toHaveBeenCalled(); expect(restore).not.toHaveBeenCalled();
    });
  }
  it('does not restore after a pending revision read loses its edit context', async () => {
    const current = recoveryContext(), pending = deferred<ReturnType<typeof source>>(), restore = vi.fn();
    const session = createRecoverySession(() => current);
    const request = session.restore({ list: async () => [], source: () => pending.promise, restore }, 1, true);
    current.dirty = true; current.editRevision++;
    pending.resolve(source());
    await expect(request).rejects.toThrow('stale_context'); expect(restore).not.toHaveBeenCalled();
  });
  it('reports a committed late restore as stale instead of replacing newer local input', async () => {
    const current = recoveryContext(), document = source(), started = deferred<void>(), pending = deferred<RecoveryDraft>();
    const session = createRecoverySession(() => current);
    const request = session.restore({ list: async () => [], source: async () => document,
      restore: async () => { started.resolve(); return pending.promise; } }, 1, true);
    await started.promise;
    current.editRevision++; current.dirty = true;
    pending.resolve({ document, lock_version: 2, active_artifact_sha256: current.publishedHash });
    expect(await request).toMatchObject({ status: 'stale', committed: true });
    expect(current.dirty).toBe(true);
  });
  it('rejects a restore response that changes the last published artifact', async () => {
    const current = recoveryContext(), document = source(), session = createRecoverySession(() => current);
    await expect(session.restore({ list: async () => [], source: async () => document,
      restore: async () => ({ document, lock_version: 2, active_artifact_sha256: 'b'.repeat(64) }) }, 1, true)).rejects.toThrow('recovery_response');
    expect(current.publishedHash).toBe('a'.repeat(64));
  });
});
