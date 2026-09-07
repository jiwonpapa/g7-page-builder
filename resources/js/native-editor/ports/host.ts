import type { NativeField, NativeValue } from '../domain/fields';
import type { NativeNode } from '../domain/node';
import type { NativeCollection, NativeStructureChange } from '../domain/tree';

export type NativePath = Array<number | { responsive: string }>;
export interface NativeContext {
  templateIdentifier: string;
  layoutName: string;
  editMode: string;
  sessionId: string;
  revision: number;
  lockVersion: number;
  readonly: boolean;
  nodeId: string;
  path: NativePath;
  iterationRoot?: NativePath;
}
export type NativeApplyResult = { kind: 'applied' | 'noop' } | { kind: 'refused'; reason: string };
export interface NativeHost {
  context: NativeContext;
  node: NativeNode;
  fields: NativeField[];
  applyField: (id: string, value: NativeValue, reset?: boolean) => NativeApplyResult;
  media: NativeMedia | null;
  applyText: (text: string) => NativeApplyResult;
  collections?: NativeCollection[];
  changeStructure?: (change: NativeStructureChange) => NativeApplyResult;
}

export interface NativeAsset {
  id: string | number;
  layoutName: string | null;
  name: string;
  url: string;
}
export type NativeMediaResult<T> = { ok: true; data: T } | { ok: false; reason: string };
export interface NativeMedia {
  list: (scope: 'page' | 'template', signal: AbortSignal) => Promise<NativeMediaResult<NativeAsset[]>>;
  upload: (file: File, signal: AbortSignal) => Promise<NativeMediaResult<NativeAsset>>;
}
