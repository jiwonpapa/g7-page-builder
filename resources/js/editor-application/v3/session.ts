import type { DocumentV3 } from '../../documents/v3/types';
import type { TreeResult } from '../../documents/v3/commands';
import { executeDocumentCommand, type DocumentCommand } from '../../documents/v3/designCommands';
import { copyTree, type NewId, type TreeClipboard } from '../../documents/v3/clipboard';
import { validateDocumentV3, designPolicyV3 } from '../../documents/v3/validate';
import { reject } from '../../documents/v3/schema';

export interface EditContext {
  documentId: string;
  sessionId: string;
  /** Monotonic edit epoch, including Undo/Redo, distinct from a server lock revision. */
  revision: number;
  readonly: boolean;
}
export interface Snapshot { document: DocumentV3; context: EditContext }
export interface EditorPort {
  read(): Snapshot;
  /** Adapter records one transaction in its existing history; never a second stack. */
  commit(result: TreeResult): void;
}
export interface DraftPort {
  save(request: { documentId: string; expectedRevision: number; json: string }): Promise<{ documentId: string; revision: number }>;
}
export type SaveOutcome = { status: 'stale' } | { status: 'saved' | 'edited'; revision: number };

function sameSession(left: EditContext, right: EditContext): boolean {
  return left.documentId === right.documentId && left.sessionId === right.sessionId;
}
function assertContext(snapshot: Snapshot, expected: EditContext, write = true): void {
  if (!sameSession(snapshot.context, expected) || snapshot.context.revision !== expected.revision
    || snapshot.document.document_id !== expected.documentId || !Number.isSafeInteger(expected.revision)
    || expected.revision < 0 || !expected.sessionId) reject('stale_context', '$');
  if (write && (snapshot.context.readonly || expected.readonly)) reject('readonly', '$');
}
export function serializeDraft(document: DocumentV3): string {
  return JSON.stringify(validateDocumentV3(document));
}
export function reopenDraft(json: string, documentId: string): DocumentV3 {
  if (typeof json !== 'string' || json.length > designPolicyV3.limits.utf8_bytes) reject('byte_limit', '$');
  const document = validateDocumentV3(JSON.parse(json));
  if (document.document_id !== documentId) reject('document_identity', '$');
  return document;
}
/** No React, Puck, browser storage, HTTP or separate document/history ownership. */
export function createStructureSession(editor: EditorPort, nextId: NewId) {
  let saving = false;
  return {
    execute(command: DocumentCommand, expected: EditContext): TreeResult {
      expected = { ...expected };
      const snapshot = editor.read();
      assertContext(snapshot, expected);
      const result = executeDocumentCommand(snapshot.document, command, nextId);
      // ID providers/adapter callbacks cannot move the command to another session.
      assertContext(editor.read(), expected);
      if (result.changed) editor.commit(result);
      return result;
    },
    copy(ids: string[], expected: EditContext): TreeClipboard {
      expected = { ...expected };
      const snapshot = editor.read();
      assertContext(snapshot, expected, false);
      return copyTree(snapshot.document, ids);
    },
    async save(port: DraftPort, expected: EditContext, serverRevision: number): Promise<SaveOutcome> {
      if (saving) reject('save_pending', '$');
      if (!Number.isSafeInteger(serverRevision) || serverRevision < 0) reject('server_revision', '$');
      const snapshot = editor.read();
      assertContext(snapshot, expected);
      const json = serializeDraft(snapshot.document);
      // Copy the context before the asynchronous boundary; never retain caller-owned objects.
      const submitted = { ...expected };
      saving = true;
      try {
        const response = await port.save({ documentId: submitted.documentId, expectedRevision: serverRevision, json });
        const current = editor.read();
        if (!sameSession(current.context, submitted) || current.document.document_id !== submitted.documentId || current.context.readonly) return { status: 'stale' };
        if (!response || response.documentId !== submitted.documentId || !Number.isSafeInteger(response.revision)
          || response.revision <= serverRevision) reject('save_response', '$');
        // A saved snapshot may be older than current input. Never replace editor data from a save response.
        return { status: current.context.revision === submitted.revision ? 'saved' : 'edited', revision: response.revision };
      } finally { saving = false; }
    },
  };
}
