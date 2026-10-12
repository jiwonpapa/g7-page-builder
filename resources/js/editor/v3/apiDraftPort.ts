import type { PageBuilderApiClient } from '../../api/pageBuilderApi';
import { createV3DocumentApi } from '../../api/v3DocumentResource';
import { reopenDraft, type DraftPort } from '../../editor-application/v3/session';

/** HTTP adapter only. The editor session retains document, stale-context and Undo ownership. */
export function createApiDraftPort(client: Pick<PageBuilderApiClient, 'documentSource'>): DraftPort {
  const api = createV3DocumentApi(client);
  return {
    async save(request) {
      const document = reopenDraft(request.json, request.documentId);
      const saved = await api.saveStructureDraft(request.documentId, document, request.expectedRevision);
      // The API's lock_version is the CAS token; document revision is separate.
      return { documentId: saved.document.document_id, revision: saved.lock_version };
    },
  };
}
