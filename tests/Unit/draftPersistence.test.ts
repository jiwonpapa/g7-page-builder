import { describe, expect, it, vi } from 'vitest';
import type { DocumentResource, PageBuilderDocument } from '../../resources/js/documents/types';
import { createDraftPersistence } from '../../resources/js/editor/draftPersistence';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const document = (): PageBuilderDocument => ({ schema_version: 'g7-page-builder/v2', document_id: crypto.randomUUID(),
  slug: 'persistence-unit', mode: 'canvas', locale: 'ko', blocks: [] });
function setup(dirty = true) {
  const initial = document();
  let state = { document: initial, editVersion: 1, lockVersion: 1, dirty };
  let status = dirty ? 'dirty' : 'saved';
  const resource = (value = initial): DocumentResource => ({ document: value, lock_version: 2,
    title: 'Synthetic', public_url: '/synthetic', published_at: null, revision: 0, active_artifact_sha256: null,
    is_home: false, status: 'draft', has_unpublished_changes: true, created_at: null, updated_at: null, archived_at: null });
  const save = vi.fn(async () => resource());
  const preview = vi.fn(async (_id: string, _lock: number, _isCurrent: () => boolean) => {});
  const saved = vi.fn((received: DocumentResource, value: PageBuilderDocument) => {
    state = { ...state, document: value, dirty: false, lockVersion: received.lock_version }; status = 'saved';
  });
  const newerEdits = vi.fn(() => { status = 'dirty'; });
  const failed = vi.fn(() => { status = 'error'; });
  const persistence = createDraftPersistence({ current: () => state, cancelScheduledSave: vi.fn(), save, preview,
    readDocument: (value) => value, started: () => { status = 'saving'; },
    resourceReceived: (received) => { state = { ...state, lockVersion: received.lock_version }; }, saved,
    cleanSaved: () => { status = 'saved'; }, newerEdits, failed });
  return { initial, resource, save, preview, saved, newerEdits, failed, persistence,
    current: () => state, status: () => status,
    edit: () => { state = { ...state, document: { ...state.document, slug: 'latest-edit' }, editVersion: state.editVersion + 1, dirty: true }; status = 'dirty'; },
  };
}

describe('serialized draft persistence', () => {
  it('ties preview response application to the exact document edit version', async () => {
    const test = setup(false);
    const response = deferred<void>();
    test.preview.mockReturnValueOnce(response.promise);
    const saving = test.persistence.save();
    const isCurrent = test.preview.mock.lastCall?.[2];
    expect(isCurrent?.()).toBe(true);
    test.edit();
    expect(isCurrent?.()).toBe(false);
    response.resolve();
    await saving;
    expect(test.status()).toBe('dirty');
  });

  it('does not label a newer edit saved when a clean preview completes', async () => {
    const test = setup(false);
    const response = deferred<void>();
    test.preview.mockReturnValueOnce(response.promise);
    const saving = test.persistence.save();
    test.edit();
    response.resolve();
    expect(await saving).toBe(true);
    expect(test.current()).toMatchObject({ dirty: true, document: { slug: 'latest-edit' } });
    expect(test.status()).toBe('dirty');
    expect(test.save).not.toHaveBeenCalled();
  });

  it('flushes the latest edit after an awaited clean preview and serializes concurrent saves', async () => {
    const test = setup(false);
    const response = deferred<void>();
    test.preview.mockReturnValueOnce(response.promise);
    const first = test.persistence.save(true);
    test.edit();
    test.save.mockImplementation(async () => test.resource(test.current().document));
    const second = test.persistence.save(true);
    response.resolve();
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(test.save).toHaveBeenCalledTimes(1);
    expect(test.save).toHaveBeenCalledWith(expect.objectContaining({ slug: 'latest-edit' }), 1);
    expect(test.current().dirty).toBe(false);
    expect(test.status()).toBe('saved');
  });

  it('keeps a newer canonical edit and updates its journal lock after a late PUT', async () => {
    const test = setup();
    const response = deferred<DocumentResource>();
    test.save.mockReturnValueOnce(response.promise);
    const saving = test.persistence.save();
    test.edit();
    response.resolve(test.resource());
    expect(await saving).toBe(true);
    expect(test.current()).toMatchObject({ dirty: true, lockVersion: 2, document: { slug: 'latest-edit' } });
    expect(test.newerEdits).toHaveBeenCalledWith(test.resource());
    expect(test.saved).not.toHaveBeenCalled();
    expect(test.preview).not.toHaveBeenCalled();
  });

  it('sends the newer snapshot with the received lock when publish requests a flush', async () => {
    const test = setup();
    const response = deferred<DocumentResource>();
    test.save.mockReturnValueOnce(response.promise).mockImplementation(async () => test.resource(test.current().document));
    const saving = test.persistence.save(true);
    test.edit();
    response.resolve(test.resource());
    expect(await saving).toBe(true);
    expect(test.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ slug: 'latest-edit' }), 2);
    expect(test.status()).toBe('saved');
  });

  it('preserves unsaved state after a failed request and allows retry', async () => {
    const test = setup();
    test.save.mockRejectedValueOnce(new Error('conflict'));
    expect(await test.persistence.save()).toBe(false);
    expect(test.current().dirty).toBe(true);
    expect(test.status()).toBe('error');
    expect(await test.persistence.save()).toBe(true);
    expect(test.save).toHaveBeenCalledTimes(2);
  });

  it('rejects a response for a different document before updating lock or saved state', async () => {
    const test = setup();
    test.save.mockResolvedValueOnce(test.resource(document()));
    expect(await test.persistence.save()).toBe(false);
    expect(test.current()).toMatchObject({ dirty: true, lockVersion: 1 });
    expect(test.saved).not.toHaveBeenCalled();
  });
});
