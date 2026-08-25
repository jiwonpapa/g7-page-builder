import type { PageBuilderDocument } from '../documents/types';

const JOURNAL_PREFIX = 'g7pb:draft-journal:v1:';

interface DraftJournalEntry {
  lockVersion: number;
  savedAt: string;
  document: PageBuilderDocument;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function key(documentId: string): string {
  return `${JOURNAL_PREFIX}${documentId}`;
}

export function writeDraftJournal(document: PageBuilderDocument, lockVersion: number): void {
  storage()?.setItem(key(document.document_id), JSON.stringify({
    lockVersion,
    savedAt: new Date().toISOString(),
    document,
  } satisfies DraftJournalEntry));
}

export function readDraftJournal(documentId: string, lockVersion: number): DraftJournalEntry | null {
  const raw = storage()?.getItem(key(documentId));
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as Partial<DraftJournalEntry>;
    if (entry.lockVersion !== lockVersion || entry.document?.document_id !== documentId
      || typeof entry.savedAt !== 'string') return null;
    return entry as DraftJournalEntry;
  } catch {
    return null;
  }
}

export function clearDraftJournal(documentId: string): void {
  storage()?.removeItem(key(documentId));
}
