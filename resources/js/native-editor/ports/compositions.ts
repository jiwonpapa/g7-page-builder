import type { NativeComposition, NativeCompositionSummary } from '../domain/composition';
import type { NativeApplyResult, NativeMediaResult, NativeHost } from './host';

export interface NativeCompositionCommands {
  export: (signal: AbortSignal) => Promise<NativeMediaResult<string>>;
  insert: (snapshot: string, collection: string, index: number, signal: AbortSignal) => Promise<NativeApplyResult>;
}
export interface NativeCompositionLibrary {
  page: (page: number, signal: AbortSignal) => Promise<NativeMediaResult<{ items: NativeCompositionSummary[]; hasMore: boolean }>>;
  read: (id: string, signal: AbortSignal) => Promise<NativeMediaResult<NativeComposition>>;
  save: (title: string, snapshot: string, signal: AbortSignal) => Promise<NativeMediaResult<NativeCompositionSummary>>;
  delete: (id: string, signal: AbortSignal) => Promise<NativeMediaResult<null>>;
}
export type NativeCompositionPanelProps = { host: NativeHost };

