import type { DocumentV3 } from '../../documents/v3/types';
import { validateDocumentV3 } from '../../documents/v3/validate';
import { reject } from '../../documents/v3/schema';

export interface RecoveryRevision { revision: number; schemaVersion: string; createdAt: string }
export interface RecoveryDraft { document: DocumentV3; lock_version: number; active_artifact_sha256: string | null }
export interface RecoveryPort<T extends RecoveryDraft = RecoveryDraft> {
  list(documentId: string): Promise<RecoveryRevision[]>;
  source(documentId: string, revision: number): Promise<DocumentV3>;
  restore(documentId: string, revision: number, expectedLock: number): Promise<T>;
}
export interface RecoveryContext {
  documentId: string; sessionId: string; editRevision: number; serverRevision: number;
  publishedHash: string | null; readonly: boolean; dirty: boolean;
}
function same(left: RecoveryContext, right: RecoveryContext): boolean {
  return !right.readonly && !right.dirty && left.documentId === right.documentId && left.sessionId === right.sessionId
    && left.editRevision === right.editRevision && left.serverRevision === right.serverRevision && left.publishedHash === right.publishedHash;
}

/** Restores a v3 revision as a new server draft. Never migrates or publishes. */
export function createRecoverySession(read: () => RecoveryContext) {
  let pending = false;
  return {
    async restore<T extends RecoveryDraft>(port: RecoveryPort<T>, revision: number, confirmed: boolean): Promise<{
      status: 'restored' | 'stale'; committed: true; value: T;
    }> {
      if (pending) reject('recovery_pending', '$');
      if (!confirmed) reject('explicit_choice', '$');
      const context = { ...read() };
      if (context.readonly) reject('readonly', '$');
      if (context.dirty) reject('recovery_unsaved', '$');
      if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isSafeInteger(context.serverRevision)
        || context.serverRevision < 1) reject('recovery_revision', '$');
      pending = true;
      try {
        const source = validateDocumentV3(await port.source(context.documentId, revision));
        if (source.document_id !== context.documentId) reject('document_identity', '$');
        if (!same(context, read())) reject('stale_context', '$');
        const value = await port.restore(context.documentId, revision, context.serverRevision);
        const document = validateDocumentV3(value.document);
        if (document.document_id !== context.documentId || !Number.isSafeInteger(value.lock_version)
          || value.lock_version <= context.serverRevision || value.active_artifact_sha256 !== context.publishedHash
          || JSON.stringify(document) !== JSON.stringify(source)) reject('recovery_response', '$');
        return { status: same(context, read()) ? 'restored' : 'stale', committed: true, value };
      } finally { pending = false; }
    },
  };
}
