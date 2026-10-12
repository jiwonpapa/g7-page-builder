import { expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';
import { createApiDraftPort } from '../../resources/js/editor/v3/apiDraftPort';
import { createStructureSession, type Snapshot } from '../../resources/js/editor-application/v3/session';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';

function snapshot(): Snapshot {
  return { document: validateDocumentV3(structuredClone(fixture)),
    context: { documentId: fixture.document_id, sessionId: 'session-a', revision: 2, readonly: false } };
}
function saved(document = snapshot().document) {
  return new Response(JSON.stringify({ success: true, data: {
    document, title: '저장', lock_version: 11, revision: 6, public_url: null,
    active_artifact_sha256: null, is_home: false, status: 'draft', has_unpublished_changes: true,
    created_at: null, updated_at: null, published_at: null, archived_at: null,
  } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

it('maps the canonical DraftPort onto the existing API and returns the CAS token, not the revision number', async () => {
  const current = snapshot();
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(saved());
  const port = createApiDraftPort(new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' }));
  expect(await port.save({ documentId: current.document.document_id, expectedRevision: 10, json: JSON.stringify(current.document) }))
    .toEqual({ documentId: fixture.document_id, revision: 11 });
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ document: current.document, expected_lock_version: 10 });
});

it.each(['{', '[]', JSON.stringify({ ...fixture, schema_version: 'g7-page-builder/v2' })])('rejects an invalid source before sending a write: %s', async (json) => {
  const fetchImpl = vi.fn<typeof fetch>();
  const port = createApiDraftPort(new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' }));
  await expect(port.save({ documentId: fixture.document_id, expectedRevision: 10, json })).rejects.toThrow();
  expect(fetchImpl).not.toHaveBeenCalled();
});

it.each(['edit', 'session', 'readonly'] as const)('leaves late-response ownership with the existing editor session: %s', async (change) => {
  const current = snapshot();
  const commit = vi.fn();
  let resolve: (value: Response) => void = () => { throw new Error('Pending fetch not started'); };
  const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(done => { resolve = done; }));
  const port = createApiDraftPort(new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' }));
  const session = createStructureSession({ read: () => current, commit }, () => crypto.randomUUID());
  const pending = session.save(port, { ...current.context }, 10);
  if (change === 'edit') { current.context.revision++; current.document.blocks[0].name = '저장 중 새 입력'; }
  if (change === 'session') current.context.sessionId = 'session-b';
  if (change === 'readonly') current.context.readonly = true;
  const latest = JSON.stringify(current);
  resolve(saved());
  expect(await pending).toEqual(change === 'edit' ? { status: 'edited', revision: 11 } : { status: 'stale' });
  expect(JSON.stringify(current)).toBe(latest);
  expect(commit).not.toHaveBeenCalled();
  expect(fetchImpl).toHaveBeenCalledOnce();
});
