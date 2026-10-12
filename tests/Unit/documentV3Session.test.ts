import { describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { createStructureSession, serializeDraft, reopenDraft, type DraftPort, type Snapshot } from '../../resources/js/editor-application/v3/session';

const nodeId = '00000000-0000-4000-8000-000000000002';
function setup() {
  const document = cloneDocument(validateDocumentV3(fixture));
  const snapshot: Snapshot = { document, context: { documentId: document.document_id, sessionId: 'session-a', revision: 0, readonly: false } };
  const commit = vi.fn((result: { document: typeof document }) => { snapshot.document = result.document; snapshot.context.revision++; });
  const editor = { read: () => snapshot, commit };
  const session = createStructureSession(editor, () => '00000000-0000-4000-8000-000000000100');
  return { snapshot, commit, editor, session, context: { ...snapshot.context } };
}
const rename = { kind: 'rename', id: nodeId, name: '바꾼 제목' } as const;
function pendingPort() {
  let resolve!: (response: { documentId: string; revision: number }) => void;
  let reject!: (reason: Error) => void;
  const save = vi.fn(() => new Promise<{ documentId: string; revision: number }>((accept, fail) => { resolve = accept; reject = fail; }));
  return { port: { save }, resolve: (documentId: string, revision = 2) => resolve({ documentId, revision }), reject: (error: Error) => reject(error) };
}

describe('v3 command session freshness and a single history port', () => {
  it('commits panel style and canvas content exactly once each through the existing history port', () => {
    const state = setup();
    state.session.execute({ kind: 'style', id: nodeId, set: { opacity: 0, padding_top: { value: 0, unit: 'px' } } }, state.context);
    state.session.execute({ kind: 'content', id: nodeId, props: { level: 2, runs: [{ text: '직접 입력', bold: true }] } }, { ...state.snapshot.context });
    expect(state.commit).toHaveBeenCalledTimes(2);
    expect(state.snapshot.context.revision).toBe(2);
    expect(() => state.session.execute({ kind: 'style', id: nodeId, set: { opacity: 1 } }, state.context)).toThrow('stale_context');
    state.snapshot.context.readonly = true;
    expect(() => state.session.execute({ kind: 'content', id: nodeId, props: {} }, { ...state.snapshot.context })).toThrow('readonly');
    expect(state.commit).toHaveBeenCalledTimes(2);
    expect(reopenDraft(serializeDraft(state.snapshot.document), state.context.documentId)).toEqual(state.snapshot.document);
  });
  it('commits a valid command once and does not commit a no-op or selection/copy', () => {
    const state = setup();
    state.session.copy([nodeId], state.context);
    expect(state.commit).not.toHaveBeenCalled();
    const result = state.session.execute(rename, state.context);
    expect(state.commit).toHaveBeenCalledExactlyOnceWith(result);
    state.session.execute(rename, { ...state.snapshot.context });
    expect(state.commit).toHaveBeenCalledTimes(1);
    expect(state.snapshot.context.revision).toBe(1);
  });
  it.each(['session', 'document', 'revision', 'readonly', 'bad_revision'] as const)('rejects %s mismatch without history', field => {
    const state = setup();
    if (field === 'session') state.snapshot.context.sessionId = 'other';
    if (field === 'document') state.snapshot.context.documentId = 'other';
    if (field === 'revision') state.snapshot.context.revision++;
    if (field === 'readonly') state.snapshot.context.readonly = true;
    if (field === 'bad_revision') state.context.revision = NaN;
    expect(() => state.session.execute(rename, state.context)).toThrow(field === 'readonly' ? 'readonly' : 'stale_context');
    expect(state.commit).not.toHaveBeenCalled();
  });
  it('checks the live context again after an ID callback and cannot be fooled by a shared context object', () => {
    const state = setup();
    const session = createStructureSession(state.editor, () => {
      state.snapshot.context.sessionId = 'new-session';
      return '00000000-0000-4000-8000-000000000100';
    });
    expect(() => session.execute({ kind: 'duplicate', ids: [nodeId] }, state.snapshot.context)).toThrow('stale_context');
    expect(state.commit).not.toHaveBeenCalled();
  });
  it('allows read-only copy but rejects writes and save before the port is called', async () => {
    const state = setup(), pending = pendingPort();
    state.snapshot.context.readonly = true;
    expect(state.session.copy([nodeId], state.context).ids).toEqual([nodeId]);
    await expect(state.session.save(pending.port, state.context, 1)).rejects.toThrow('readonly');
    expect(pending.port.save).not.toHaveBeenCalled();
    expect(() => state.session.execute(rename, { ...state.context, readonly: true })).toThrow('readonly');
  });
});

describe('v3 port-based draft snapshots', () => {
  it('saves only canonical JSON and reopens an equivalent independent source', async () => {
    const state = setup();
    state.session.execute(rename, state.context);
    const port: DraftPort = { save: vi.fn(async request => {
      const saved = reopenDraft(request.json, request.documentId);
      expect(saved).toEqual(state.snapshot.document);
      expect(request.expectedRevision).toBe(1);
      expect(request.json).not.toContain('session-a');
      return { documentId: request.documentId, revision: 2 };
    }) };
    const result = await state.session.save(port, { ...state.snapshot.context }, 1);
    expect(result).toEqual({ status: 'saved', revision: 2 });
    expect(state.commit).toHaveBeenCalledTimes(1);
    expect(reopenDraft(serializeDraft(state.snapshot.document), state.context.documentId)).not.toBe(state.snapshot.document);
  });
  it('does not replace later input or confuse edit epochs with the server lock revision', async () => {
    const state = setup(), pending = pendingPort();
    const saving = state.session.save(pending.port, state.context, 1);
    state.session.execute(rename, state.context);
    pending.resolve(state.context.documentId);
    expect(await saving).toEqual({ status: 'edited', revision: 2 });
    expect(state.snapshot.document.blocks[0].slots.content![0].name).toBe(rename.name);
    expect(state.commit).toHaveBeenCalledTimes(1);
    expect(pending.port.save.mock.calls).toHaveLength(1);
  });
  it.each(['document', 'session', 'readonly'] as const)('ignores a response after %s changes', kind => {
    const state = setup(), pending = pendingPort();
    const saving = state.session.save(pending.port, state.context, 1);
    if (kind === 'document') state.snapshot.context.documentId = 'another-document';
    if (kind === 'session') state.snapshot.context.sessionId = 'session-b';
    if (kind === 'readonly') state.snapshot.context.readonly = true;
    pending.resolve(state.context.documentId);
    return expect(saving).resolves.toEqual({ status: 'stale' });
  });
  it('serializes save requests and allows retry after failure without any document/history change', async () => {
    const state = setup(), pending = pendingPort();
    const json = serializeDraft(state.snapshot.document);
    const saving = state.session.save(pending.port, state.context, 1);
    await expect(state.session.save(pending.port, state.context, 1)).rejects.toThrow('save_pending');
    pending.reject(new Error('conflict 409'));
    await expect(saving).rejects.toThrow('conflict 409');
    const retry = state.session.save(pending.port, state.context, 1);
    pending.resolve(state.context.documentId);
    expect(await retry).toEqual({ status: 'saved', revision: 2 });
    expect(serializeDraft(state.snapshot.document)).toBe(json);
    expect(state.commit).not.toHaveBeenCalled();
  });
  it.each([0, 1, 1.5, NaN])('rejects invalid save response revision %s', async revision => {
    const state = setup(), pending = pendingPort();
    const saving = state.session.save(pending.port, state.context, 1);
    pending.resolve(state.context.documentId, revision);
    await expect(saving).rejects.toThrow('save_response');
    expect(state.commit).not.toHaveBeenCalled();
  });
  it('rejects a wrong response ID, bad server revision and malformed/reidentified drafts', async () => {
    const state = setup(), pending = pendingPort();
    await expect(state.session.save(pending.port, state.context, -1)).rejects.toThrow('server_revision');
    const saving = state.session.save(pending.port, state.context, 1);
    pending.resolve('wrong-document');
    await expect(saving).rejects.toThrow('save_response');
    expect(() => reopenDraft('{', state.context.documentId)).toThrow();
    expect(() => reopenDraft('x'.repeat(1048577), state.context.documentId)).toThrow('byte_limit');
    expect(() => reopenDraft(serializeDraft(state.snapshot.document), 'wrong')).toThrow('document_identity');
    expect(() => reopenDraft('{"schema_version":"g7-page-builder/v2"}', state.context.documentId)).toThrow();
  });
});
