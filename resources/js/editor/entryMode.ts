import { PAGE_BUILDER_EDITOR_PATH } from '../api/pageBuilderApi';
import type { DocumentResource, StoredPageDocument } from '../api/resources';
import type { PageBuilderDocument } from '../documents/types';
import { normalizeDocumentTransport } from '../documents/normalizeDocumentTransport';
import { validateLayoutDocument } from '../documents/layoutPolicy';

export type DocumentEditorMode = 'legacy' | 'structure';

/** Routing is not document validation. Each editor still validates its own source. */
export function documentEditorMode(source: unknown): DocumentEditorMode {
  if (source && typeof source === 'object' && !Array.isArray(source) && 'schema_version' in source) {
    if (source.schema_version === 'g7-page-builder/v3') return 'structure';
    if (source.schema_version === 'g7-page-builder/v1' || source.schema_version === 'g7-page-builder/v2') return 'legacy';
  }
  throw new Error('지원하지 않는 문서 버전입니다. 원본은 변경되지 않았습니다.');
}

export function documentEditorUrl(documentId: string, mode: DocumentEditorMode): string {
  return `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(documentId)}${mode === 'structure' ? '&editor=structure' : ''}`;
}

export function readLegacyEditorDocument(document: StoredPageDocument): PageBuilderDocument {
  if (document.schema_version === 'g7-page-builder/v3') throw new Error('이 문서는 정밀 편집기에서 열어야 합니다.');
  documentEditorMode(document);
  const normalized = normalizeDocumentTransport(document);
  if (normalized.schema_version === 'g7-page-builder/v2') validateLayoutDocument(normalized);
  return normalized;
}

/** Read the authenticated source before loading optional legacy block-pack assets. */
export async function loadLegacyEditorDocument(documentId: string, ports: {
  read: (id: string) => Promise<DocumentResource>;
  loadBlocks: () => Promise<void>;
  redirect: (url: string) => void;
  current: () => boolean;
}): Promise<DocumentResource | null> {
  const resource = await ports.read(documentId);
  if (!ports.current()) return null;
  if (resource.document.document_id !== documentId) throw new Error('불러온 문서가 요청한 문서와 일치하지 않습니다.');
  if (documentEditorMode(resource.document) === 'structure') {
    ports.redirect(documentEditorUrl(documentId, 'structure'));
    return null;
  }
  readLegacyEditorDocument(resource.document);
  await ports.loadBlocks();
  return ports.current() ? resource : null;
}
