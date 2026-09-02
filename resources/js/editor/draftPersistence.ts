import type { PageBuilderDocument } from '../documents/types';
import type { DocumentResource } from '../api/resources';

interface DraftSnapshot {
  document: PageBuilderDocument | null;
  dirty: boolean;
  editVersion: number;
  lockVersion: number;
}
interface DraftPersistencePorts {
  current: () => DraftSnapshot;
  cancelScheduledSave: () => void;
  save: (document: PageBuilderDocument, lockVersion: number) => Promise<DocumentResource>;
  preview: (documentId: string, lockVersion: number, isCurrent: () => boolean) => Promise<void>;
  readDocument: (document: PageBuilderDocument) => PageBuilderDocument;
  started: () => void;
  resourceReceived: (resource: DocumentResource) => void;
  saved: (resource: DocumentResource, document: PageBuilderDocument) => void;
  cleanSaved: () => void;
  newerEdits: (resource?: DocumentResource) => void;
  failed: (error: unknown) => void;
}

/** Serialize both PUT and clean-preview saves; their results belong to one edit version. */
export function createDraftPersistence(ports: DraftPersistencePorts): { save: (flushLatest?: boolean) => Promise<boolean> } {
  let inFlight: Promise<boolean> | null = null;
  const save = async (flushLatest = false): Promise<boolean> => {
    ports.cancelScheduledSave();
    if (inFlight) {
      const succeeded = await inFlight;
      return succeeded && ports.current().dirty ? save(flushLatest) : succeeded;
    }
    const snapshot = ports.current();
    const document = snapshot.document;
    if (!document) return false;
    const isCurrent = (): boolean => {
      const latest = ports.current();
      return latest.document?.document_id === document.document_id && latest.editVersion === snapshot.editVersion;
    };
    ports.started();
    const request = (async (): Promise<boolean> => {
      try {
        if (!snapshot.dirty) {
          await ports.preview(document.document_id, snapshot.lockVersion, isCurrent);
          const latest = ports.current();
          if (isCurrent() && !latest.dirty) ports.cleanSaved();
          else ports.newerEdits();
          return true;
        }
        const resource = await ports.save(document, snapshot.lockVersion);
        const savedDocument = ports.readDocument(resource.document);
        if (savedDocument.document_id !== document.document_id) throw new Error('저장 응답의 문서가 일치하지 않습니다.');
        ports.resourceReceived(resource);
        if (isCurrent()) await ports.preview(document.document_id, resource.lock_version, isCurrent);
        if (isCurrent()) ports.saved(resource, savedDocument);
        else ports.newerEdits(resource);
        return true;
      } catch (error) {
        ports.failed(error);
        return false;
      }
    })();
    inFlight = request;
    const succeeded = await request;
    if (inFlight === request) inFlight = null;
    return succeeded && flushLatest && ports.current().dirty ? save(true) : succeeded;
  };
  return { save };
}
