import { validateDocumentV3 } from '../documents/v3/validate';
import type { DocumentV3 } from '../documents/v3/types';
import type { DocumentResource } from './resources';
import type { PageBuilderApiClient } from './pageBuilderApi';

/** Existing document endpoint metadata with the independently validated v3 source. */
export type V3DocumentResource = Omit<DocumentResource, 'document'> & { document: DocumentV3 };

function invalid(): never { throw new Error('서버의 정밀 편집 문서 응답이 올바르지 않습니다.'); }
function nullableString(value: unknown): string | null {
  if (value === null || typeof value === 'string') return value;
  return invalid();
}
function integer(value: unknown, minimum: number): number {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum) return value;
  return invalid();
}

/** Do not normalize malformed v3 maps or accept a legacy response as v3. */
export function parseV3DocumentResource(value: unknown, documentId: string, previousLock?: number): V3DocumentResource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const data: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  const document = validateDocumentV3(data.document);
  if (document.document_id !== documentId || typeof data.title !== 'string'
    || typeof data.is_home !== 'boolean' || typeof data.has_unpublished_changes !== 'boolean') return invalid();
  const status = data.status;
  if (status !== 'draft' && status !== 'published' && status !== 'published_with_changes' && status !== 'archived') return invalid();
  const lock = integer(data.lock_version, 0);
  if (previousLock !== undefined && (lock <= previousLock || status === 'archived')) return invalid();
  const hash = nullableString(data.active_artifact_sha256);
  if (hash !== null && !/^[a-f0-9]{64}$/.test(hash)) return invalid();
  const url = nullableString(data.public_url);
  if (url !== null && !/^(?:\/(?!\/)[^\s]*|https:\/\/[^\s/?#]+(?:[/?#][^\s]*)?)$/.test(url)) return invalid();
  return {
    document, title: data.title, lock_version: lock, revision: integer(data.revision, 1),
    public_url: url, active_artifact_sha256: hash, is_home: data.is_home, status,
    has_unpublished_changes: data.has_unpublished_changes,
    created_at: nullableString(data.created_at), updated_at: nullableString(data.updated_at),
    published_at: nullableString(data.published_at), archived_at: nullableString(data.archived_at),
  };
}

export function validateV3DraftRequest(documentId: string, value: unknown, expectedLock: number): DocumentV3 {
  const document = validateDocumentV3(value);
  integer(expectedLock, 0);
  if (document.document_id !== documentId) return invalid();
  return document;
}

/** Imported by the v3 host only: legacy manager/editor bundles do not load the v3 schema. */
export function createV3DocumentApi(client: Pick<PageBuilderApiClient, 'documentSource'>) {
  return {
    async getStructureDocument(documentId: string): Promise<V3DocumentResource> {
      return parseV3DocumentResource(await client.documentSource(documentId), documentId);
    },
    async saveStructureDraft(documentId: string, document: DocumentV3, expectedLockVersion: number): Promise<V3DocumentResource> {
      const source = validateV3DraftRequest(documentId, document, expectedLockVersion);
      const response = await client.documentSource(documentId, { document: source, expectedLockVersion });
      return parseV3DocumentResource(response, documentId, expectedLockVersion);
    },
  };
}
