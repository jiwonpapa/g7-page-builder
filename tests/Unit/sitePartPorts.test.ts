import { expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateElementSitePart } from '../../resources/js/documents/v3/sitePart';
import type { ElementPartResource } from '../../resources/js/api/elementSitePartResource';
import { sitePartDraftPort } from '../../resources/js/editor/v3/sitePartPorts';
import { createStructureSession, type Snapshot } from '../../resources/js/editor-application/v3/session';

function source(): ElementPartResource {
  return { set_id: 'set-a', title: 'Header', document: validateElementSitePart({
    schema_version: 'g7-page-builder/site-part/v2', kind: 'header', content: { ...structuredClone(fixture), shell_mode: 'none' },
  }), lock_version: 1, revision: 1, active_revision: null, status: 'draft', created_at: null, updated_at: null, published_at: null };
}
it('reattaches only the owned canonical source and returns the acknowledged CAS version', async () => {
  const value = source(), api = { save: vi.fn(async () => ({ ...value, lock_version: 3, revision: 2 })) }, ack = vi.fn();
  const port = sitePartDraftPort(api, value, ack);
  expect(await port.save({ documentId: fixture.document_id, json: JSON.stringify(value.document.content), expectedRevision: 2 }))
    .toEqual({ documentId: fixture.document_id, revision: 3 });
  expect(api.save).toHaveBeenCalledWith(value, value.document.content, 2); expect(ack).toHaveBeenCalledOnce();
  await expect(port.save({ documentId: 'foreign', json: JSON.stringify(value.document.content), expectedRevision: 3 })).rejects.toThrow();
  expect(api.save).toHaveBeenCalledOnce();
});
it.each(['edit', 'session', 'readonly'] as const)('keeps %s handling inside the original document session', async change => {
  const value = source();
  const snapshot: Snapshot = { document: value.document.content, context: {
    documentId: fixture.document_id, sessionId: 'a', revision: 0, readonly: false,
  } };
  let resolve!: (result: ElementPartResource) => void;
  const api = { save: vi.fn(() => new Promise<ElementPartResource>(accept => { resolve = accept; })) }, commit = vi.fn();
  const session = createStructureSession({ read: () => snapshot, commit }, () => crypto.randomUUID());
  const pending = session.save(sitePartDraftPort(api, value, vi.fn()), { ...snapshot.context }, 1);
  if (change === 'edit') snapshot.context.revision++;
  if (change === 'session') snapshot.context.sessionId = 'other';
  if (change === 'readonly') snapshot.context.readonly = true;
  resolve({ ...value, lock_version: 2 });
  expect(await pending).toEqual(change === 'edit' ? { status: 'edited', revision: 2 } : { status: 'stale' });
  expect(commit).not.toHaveBeenCalled();
});
