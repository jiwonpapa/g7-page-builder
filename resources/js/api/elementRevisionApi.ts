import { PageDocumentApiClient } from './pageBuilderApi';
import { parseV3DocumentResource, type V3DocumentResource } from './v3DocumentResource';
import type { DocumentV3 } from '../documents/v3/types';
import { validateDocumentV3 } from '../documents/v3/validate';
import { record } from '../documents/v3/schema';
import { freshId } from '../documents/v3/clipboard';

export interface ElementRevision { revision: number; schemaVersion: string; createdAt: string }
function identity(id: string): void { freshId(new Set(), () => id); }
function positive(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new Error('리비전 번호가 올바르지 않습니다.');
  return value;
}
export class ElementRevisionApi extends PageDocumentApiClient {
  async list(documentId: string): Promise<ElementRevision[]> {
    identity(documentId);
    const value = await this.request<unknown>('/documents/' + encodeURIComponent(documentId) + '/revisions?limit=20');
    if (!record(value) || !Array.isArray(value.items)) throw new Error('리비전 목록이 올바르지 않습니다.');
    const items = value.items.map(item => {
      if (!record(item) || typeof item.schema_version !== 'string' || typeof item.created_at !== 'string') throw new Error('리비전 정보가 올바르지 않습니다.');
      return { revision: positive(item.revision), schemaVersion: item.schema_version, createdAt: item.created_at };
    });
    if (new Set(items.map(item => item.revision)).size !== items.length) throw new Error('리비전 목록이 중복됩니다.');
    return items;
  }
  async source(documentId: string, revision: number): Promise<DocumentV3> {
    identity(documentId); positive(revision);
    const value = await this.request<unknown>('/documents/' + encodeURIComponent(documentId) + '/revisions/' + revision);
    if (!record(value) || value.revision !== revision) throw new Error('요청한 리비전과 응답이 다릅니다.');
    const source = validateDocumentV3(value.document);
    if (source.document_id !== documentId) throw new Error('리비전 문서가 일치하지 않습니다.');
    return source;
  }
  async restore(documentId: string, revision: number, lock: number): Promise<V3DocumentResource> {
    identity(documentId); positive(revision); positive(lock);
    return parseV3DocumentResource(await this.request<unknown>('/documents/' + encodeURIComponent(documentId) + '/revisions/' + revision + '/restore', {
      method: 'POST', body: JSON.stringify({ expected_lock_version: lock }),
    }), documentId, lock);
  }
}
