import { prepareMigration, type MigrationSnapshot } from '../../documents/v3/migration';
import { validateDocumentV3 } from '../../documents/v3/validate';
import { record, reject } from '../../documents/v3/schema';

export interface MigrationContext {
  documentId: string;
  sessionId: string;
  editRevision: number;
  serverRevision: number;
  readonly: boolean;
}
export interface MigrationWrite {
  documentId: string;
  expectedRevision: number;
  sourceRevision: number;
  sourceJson: string;
}
export interface MigrationResponse { documentId: string; revision: number; sourceRevision: number }
export interface MigrationPort {
  /** Validate the ENTIRE original contract and mapping before returning a candidate.
   * Unknown fields/blocks must reject; this is never a read-time normalizer.
   */
  convert(snapshot: MigrationSnapshot): Promise<unknown>;
  /** Atomically preserve the source revision and replace only the draft under CAS.
   * The server revalidates permissions, source bytes and candidate. Never publishes.
   */
  apply(request: MigrationWrite & { candidateJson: string }): Promise<MigrationResponse>;
  /** Restore the preserved original bytes as a new draft revision; never publishes. */
  restore(request: MigrationWrite): Promise<MigrationResponse>;
}
export type MigrationPreview = { status: 'stale' } | {
  status: 'ready'; token: number; sourceRevision: number; candidateJson: string;
};
export type MigrationOutcome = { status: 'applied' | 'restored'; revision: number }
  | { status: 'stale'; committed: true; revision: number };
interface Prepared { token: number; context: MigrationContext; snapshot: MigrationSnapshot; candidateJson: string }
interface Backup { context: MigrationContext; snapshot: MigrationSnapshot }

function writable(context: MigrationContext): void {
  if (context.readonly) reject('readonly', '$');
  if (!context.documentId || !context.sessionId || !Number.isSafeInteger(context.editRevision) || context.editRevision < 0
    || !Number.isSafeInteger(context.serverRevision) || context.serverRevision < 1) reject('migration_context', '$');
}
function same(left: MigrationContext, right: MigrationContext): boolean {
  return left.documentId === right.documentId && left.sessionId === right.sessionId
    && left.editRevision === right.editRevision && left.serverRevision === right.serverRevision && !left.readonly && !right.readonly;
}
function responseRevision(response: MigrationResponse, request: MigrationWrite): number {
  if (!response || response.documentId !== request.documentId || response.sourceRevision !== request.sourceRevision
    || !Number.isSafeInteger(response.revision) || response.revision <= request.expectedRevision) reject('migration_response', '$');
  return response.revision;
}
/** Explicit conversion workflow, not another document/Undo store.
 * Keeps immutable original/candidate bytes only until the existing editor is reopened.
 * A stale write may have committed on the server: callers must refresh, never apply
 * that response to the current editor or announce that cancelling rolled it back.
 */
export function createMigrationSession(read: () => MigrationContext, port: MigrationPort) {
  let sequence = 0;
  let preparing = false;
  let writing = false;
  let prepared: Prepared | undefined;
  let backup: Backup | undefined;
  function request(context: MigrationContext, snapshot: MigrationSnapshot): MigrationWrite {
    return { documentId: context.documentId, expectedRevision: context.serverRevision,
      sourceRevision: snapshot.source_revision, sourceJson: snapshot.source_json };
  }
  return {
    async preview(sourceJson: string, explicitChoice: boolean): Promise<MigrationPreview> {
      if (preparing || writing) reject('migration_pending', '$');
      if (!explicitChoice) reject('explicit_choice', '$');
      const context = { ...read() }; writable(context);
      const snapshot = prepareMigration(sourceJson, context.serverRevision, context.serverRevision, true);
      const original: unknown = JSON.parse(snapshot.source_json);
      if (!record(original) || original.document_id !== context.documentId) reject('document_identity', '$');
      const token = ++sequence;
      prepared = undefined;
      preparing = true;
      try {
        // The mapper receives a detached receipt and cannot alter the retained source.
        const value = await port.convert({ ...snapshot });
        if (token !== sequence || !same(context, read())) return { status: 'stale' };
        const candidate = validateDocumentV3(value);
        if (candidate.document_id !== context.documentId || candidate.slug !== original.slug || candidate.locale !== original.locale
          || candidate.shell_mode !== (original.shell_mode === 'global' ? 'builder' : original.shell_mode ?? 'template')) reject('migration_identity', '$');
        const candidateJson = JSON.stringify(candidate);
        prepared = { token, context, snapshot, candidateJson };
        return { status: 'ready', token, sourceRevision: snapshot.source_revision, candidateJson };
      } finally { preparing = false; }
    },
    cancel(): void {
      if (writing) reject('migration_write_pending', '$');
      sequence++;
      prepared = undefined;
    },
    async apply(token: number, explicitChoice: boolean): Promise<MigrationOutcome> {
      if (preparing || writing) reject('migration_pending', '$');
      if (!explicitChoice) reject('explicit_choice', '$');
      const plan = prepared;
      if (!plan || plan.token !== token) reject('migration_preview', '$');
      const current = { ...read() }; writable(current);
      if (!same(plan.context, current)) reject('stale_context', '$');
      const write = { ...request(current, plan.snapshot), candidateJson: plan.candidateJson };
      // Consume before I/O: an uncertain/late response cannot be replayed blindly.
      prepared = undefined;
      writing = true;
      try {
        const revision = responseRevision(await port.apply(write), write);
        backup = { context: { ...current }, snapshot: { ...plan.snapshot } };
        return same(current, read()) ? { status: 'applied', revision } : { status: 'stale', committed: true, revision };
      } finally { writing = false; }
    },
    async restore(explicitChoice: boolean): Promise<MigrationOutcome> {
      if (preparing || writing) reject('migration_pending', '$');
      if (!explicitChoice) reject('explicit_choice', '$');
      const current = { ...read() }; writable(current);
      const source = backup;
      if (!source || source.context.documentId !== current.documentId || source.context.sessionId !== current.sessionId) reject('migration_backup', '$');
      const write = request(current, source.snapshot);
      writing = true;
      prepared = undefined;
      try {
        const revision = responseRevision(await port.restore(write), write);
        backup = undefined;
        return same(current, read()) ? { status: 'restored', revision } : { status: 'stale', committed: true, revision };
      } finally { writing = false; }
    },
  };
}
