import { describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { createMigrationSession, type MigrationContext, type MigrationPort, type MigrationResponse } from '../../resources/js/editor-application/v3/migration';

function setup() {
  const candidate = { ...structuredClone(fixture), shell_mode: 'template' };
  const original = { schema_version: 'g7-page-builder/v2', document_id: candidate.document_id,
    slug: candidate.slug, locale: candidate.locale, blocks: [], tokens: { keep: false } };
  const source = JSON.stringify(original, null, 2);
  const context: MigrationContext = { documentId: candidate.document_id, sessionId: 'session-A', editRevision: 3, serverRevision: 7, readonly: false };
  const convert = vi.fn<MigrationPort['convert']>().mockResolvedValue(candidate);
  const apply = vi.fn<MigrationPort['apply']>().mockImplementation(async request => ({ documentId: request.documentId, revision: request.expectedRevision + 1, sourceRevision: request.sourceRevision }));
  const restore = vi.fn<MigrationPort['restore']>().mockImplementation(async request => ({ documentId: request.documentId, revision: request.expectedRevision + 1, sourceRevision: request.sourceRevision }));
  const session = createMigrationSession(() => context, { convert, apply, restore });
  return { candidate, original, source, context, convert, apply, restore, session };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
async function ready(state: ReturnType<typeof setup>) {
  const result = await state.session.preview(state.source, true);
  if (result.status !== 'ready') throw new Error('Expected ready candidate');
  return result;
}

describe('explicit migration session and immutable original recovery', () => {
  it('requires separate explicit preview/apply/restore, retaining exact original bytes', async () => {
    const state = setup();
    await expect(state.session.preview(state.source, false)).rejects.toThrow('explicit_choice');
    expect(state.convert).not.toHaveBeenCalled();
    const preview = await ready(state);
    expect(state.apply).not.toHaveBeenCalled();
    expect(state.convert.mock.calls[0][0]).toEqual({ source_json: state.source, source_revision: 7,
      source_schema: 'g7-page-builder/v2', target_schema: 'g7-page-builder/v3', publish: false });
    await expect(state.session.apply(preview.token, false)).rejects.toThrow('explicit_choice');
    state.candidate.slug = 'mapper-object-mutated-after-preview';
    expect(await state.session.apply(preview.token, true)).toEqual({ status: 'applied', revision: 8 });
    expect(state.apply.mock.calls[0][0]).toEqual({ documentId: state.context.documentId, expectedRevision: 7,
      sourceRevision: 7, sourceJson: state.source, candidateJson: preview.candidateJson });
    state.context.serverRevision = 8; state.context.editRevision++;
    await expect(state.session.restore(false)).rejects.toThrow('explicit_choice');
    expect(await state.session.restore(true)).toEqual({ status: 'restored', revision: 9 });
    expect(state.restore.mock.calls[0][0]).toEqual({ documentId: state.context.documentId, expectedRevision: 8, sourceRevision: 7, sourceJson: state.source });
    await expect(state.session.restore(true)).rejects.toThrow('migration_backup');
  });
  it('does not let a mapper mutate the retained original snapshot', async () => {
    const state = setup();
    state.convert.mockImplementation(async snapshot => { snapshot.source_json = 'changed'; snapshot.source_revision = 99; return state.candidate; });
    const preview = await ready(state);
    await state.session.apply(preview.token, true);
    expect(state.apply.mock.calls[0][0].sourceJson).toBe(state.source);
    expect(state.apply.mock.calls[0][0].sourceRevision).toBe(7);
  });
  it.each(['documentId', 'sessionId', 'editRevision', 'serverRevision', 'readonly'] as const)('discards delayed candidates after %s changes', async field => {
    const state = setup(), conversion = deferred<unknown>();
    state.convert.mockReturnValue(conversion.promise);
    const pending = state.session.preview(state.source, true);
    if (field === 'readonly') state.context.readonly = true;
    else if (field === 'editRevision' || field === 'serverRevision') state.context[field]++;
    else state.context[field] += '-changed';
    conversion.resolve(state.candidate);
    expect(await pending).toEqual({ status: 'stale' });
    expect(state.apply).not.toHaveBeenCalled();
  });
  it('cancels a delayed preview and never applies a replaced receipt', async () => {
    const state = setup(), conversion = deferred<unknown>();
    state.convert.mockReturnValueOnce(conversion.promise);
    const pending = state.session.preview(state.source, true);
    await expect(state.session.preview(state.source, true)).rejects.toThrow('migration_pending');
    state.session.cancel(); conversion.resolve(state.candidate);
    expect(await pending).toEqual({ status: 'stale' });
    const first = await ready(state), second = await ready(state);
    await expect(state.session.apply(first.token, true)).rejects.toThrow('migration_preview');
    expect(await state.session.apply(second.token, true)).toEqual({ status: 'applied', revision: 8 });
    await expect(state.session.apply(second.token, true)).rejects.toThrow('migration_preview');
  });
  it('rejects changed context between preview and confirmation without writing', async () => {
    const state = setup(), preview = await ready(state);
    state.context.editRevision++;
    await expect(state.session.apply(preview.token, true)).rejects.toThrow('stale_context');
    expect(state.apply).not.toHaveBeenCalled();
  });
  it.each(['document_id', 'slug', 'locale', 'shell_mode'] as const)('rejects conversion that changes %s', async field => {
    const state = setup();
    state.convert.mockResolvedValue({ ...state.candidate, [field]: field === 'shell_mode' ? 'none'
      : field === 'document_id' ? '00000000-0000-4000-8000-000000000098' : field === 'locale' ? 'en' : 'different' });
    await expect(ready(state)).rejects.toThrow('migration_identity');
    expect(state.apply).not.toHaveBeenCalled();
  });
  it('supports explicit legacy global shell alias without auto-converting reads', async () => {
    const state = setup();
    state.convert.mockResolvedValue({ ...state.candidate, shell_mode: 'builder' });
    expect(await state.session.preview(JSON.stringify({ ...state.original, shell_mode: 'global' }), true)).toMatchObject({ status: 'ready' });
    expect(state.apply).not.toHaveBeenCalled();
  });
  it('rejects unsupported source/candidate or mapper failure and leaves publication out of writes', async () => {
    const state = setup();
    await expect(state.session.preview('{', true)).rejects.toThrow();
    await expect(state.session.preview(JSON.stringify({ ...state.original, document_id: 'other' }), true)).rejects.toThrow('document_identity');
    await expect(state.session.preview(JSON.stringify({ ...state.original, schema_version: 'g7-page-builder/site-part/v1' }), true)).rejects.toThrow('source_schema');
    state.convert.mockRejectedValueOnce(new Error('unsupported field blocks.0.props.future'));
    await expect(ready(state)).rejects.toThrow('unsupported field');
    state.convert.mockResolvedValueOnce({ ...state.candidate, unknown: 'must not discard' });
    await expect(ready(state)).rejects.toThrow('unknown_field');
    const preview = await ready(state); await state.session.apply(preview.token, true);
    expect(state.apply.mock.calls[0][0]).not.toHaveProperty('publication');
    expect(state.apply.mock.calls[0][0]).not.toHaveProperty('publish');
  });
  it('does not replay a failed or uncertain write, and never overwrites the editor', async () => {
    const state = setup(), preview = await ready(state), before = { ...state.context };
    state.apply.mockRejectedValueOnce(new Error('409 conflict'));
    await expect(state.session.apply(preview.token, true)).rejects.toThrow('409 conflict');
    await expect(state.session.apply(preview.token, true)).rejects.toThrow('migration_preview');
    expect(state.context).toEqual(before);
    expect(state.restore).not.toHaveBeenCalled();
  });
  it('reports committed-but-stale writes explicitly and blocks cancellation during CAS', async () => {
    const state = setup(), preview = await ready(state), write = deferred<MigrationResponse>();
    state.apply.mockReturnValue(write.promise);
    const pending = state.session.apply(preview.token, true);
    expect(() => state.session.cancel()).toThrow('migration_write_pending');
    await expect(state.session.restore(true)).rejects.toThrow('migration_pending');
    state.context.sessionId = 'different';
    write.resolve({ documentId: state.context.documentId, revision: 8, sourceRevision: 7 });
    expect(await pending).toEqual({ status: 'stale', committed: true, revision: 8 });
    await expect(state.session.restore(true)).rejects.toThrow('migration_backup');
  });
  it.each([{ revision: 7 }, { revision: 8.5 }, { documentId: 'wrong' }, { sourceRevision: 9 }])('rejects invalid write responses %j', async patch => {
    const state = setup(), preview = await ready(state);
    state.apply.mockResolvedValue({ documentId: state.context.documentId, revision: 8, sourceRevision: 7, ...patch });
    await expect(state.session.apply(preview.token, true)).rejects.toThrow('migration_response');
  });
  it('keeps backup after restore failure and uses the latest server CAS revision', async () => {
    const state = setup(), preview = await ready(state);
    await state.session.apply(preview.token, true);
    state.context.serverRevision = 10;
    state.restore.mockRejectedValueOnce(new Error('409 conflict'));
    await expect(state.session.restore(true)).rejects.toThrow('409 conflict');
    expect(await state.session.restore(true)).toEqual({ status: 'restored', revision: 11 });
    expect(state.restore.mock.calls[1][0].expectedRevision).toBe(10);
  });
  it('guards readonly and malformed revision contexts before external work', async () => {
    const state = setup(); state.context.readonly = true;
    await expect(ready(state)).rejects.toThrow('readonly');
    state.context.readonly = false; state.context.serverRevision = 0;
    await expect(ready(state)).rejects.toThrow('migration_context');
    expect(state.convert).not.toHaveBeenCalled();
  });
  it('refuses confirmation after losing permission and reports a delayed restore as stale', async () => {
    const state = setup(), preview = await ready(state);
    state.context.readonly = true;
    await expect(state.session.apply(preview.token, true)).rejects.toThrow('readonly');
    expect(state.apply).not.toHaveBeenCalled();
    state.context.readonly = false;
    await state.session.apply(preview.token, true);
    state.context.serverRevision = 8;
    const write = deferred<MigrationResponse>(); state.restore.mockReturnValue(write.promise);
    const pending = state.session.restore(true);
    await expect(state.session.preview(state.source, true)).rejects.toThrow('migration_pending');
    state.context.editRevision++;
    write.resolve({ documentId: state.context.documentId, revision: 9, sourceRevision: 7 });
    expect(await pending).toEqual({ status: 'stale', committed: true, revision: 9 });
  });
});
