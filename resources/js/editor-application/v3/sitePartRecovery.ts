import { validateElementSitePart, type ElementSitePart } from '../../documents/v3/sitePart';
import { reject } from '../../documents/v3/schema';

export interface PartRecoveryRevision { revision: number; createdAt: string; document: ElementSitePart | null }
export interface PartRecoveryContext {
  setId: string; kind: ElementSitePart['kind']; documentId: string; slug: string; locale: string;
  session: number; serverRevision: number; activeRevision: number | null; readonly: boolean; dirty: boolean;
}
export interface PartRecoveryDraft { document: ElementSitePart; lock_version: number; active_revision: number | null }
function same(left: PartRecoveryContext, right: PartRecoveryContext): boolean {
  return !right.readonly && !right.dirty && left.setId === right.setId && left.kind === right.kind
    && left.documentId === right.documentId && left.session === right.session && left.serverRevision === right.serverRevision
    && left.activeRevision === right.activeRevision && left.slug === right.slug && left.locale === right.locale;
}
/** Explicit v2 Site Part draft recovery. Neither the published pair nor legacy source is changed. */
export function createPartRecoverySession(read: () => PartRecoveryContext) {
  let pending = false;
  return { async restore<T extends PartRecoveryDraft>(source: PartRecoveryRevision, confirmed: boolean,
    save: (document: ElementSitePart, expectedLock: number) => Promise<T>): Promise<{ status: 'restored' | 'stale'; value: T }> {
    if (pending) reject('recovery_pending', '$');
    if (!confirmed) reject('explicit_choice', '$');
    const context = { ...read() };
    if (context.readonly || context.dirty) reject('recovery_unsaved', '$');
    if (!Number.isSafeInteger(source.revision) || source.revision < 1 || !source.document) reject('recovery_revision', '$');
    const document = validateElementSitePart(source.document);
    if (document.kind !== context.kind || document.content.document_id !== context.documentId
      || document.content.slug !== context.slug || document.content.locale !== context.locale) reject('document_identity', '$');
    pending = true;
    try {
      const value = await save(structuredClone(document), context.serverRevision);
      validateElementSitePart(value.document);
      if (JSON.stringify(value.document) !== JSON.stringify(document) || value.lock_version <= context.serverRevision
        || value.active_revision !== context.activeRevision) reject('recovery_response', '$');
      return { status: same(context, read()) ? 'restored' : 'stale', value };
    } finally { pending = false; }
  } };
}
