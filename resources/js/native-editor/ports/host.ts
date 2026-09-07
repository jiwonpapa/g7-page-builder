import type { NativeNode } from '../domain/node';

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
}
export type NativeApplyResult = { kind: 'applied' | 'noop' } | { kind: 'refused'; reason: string };
export interface NativeHost {
  context: NativeContext;
  node: NativeNode;
  applyText: (text: string) => NativeApplyResult;
}
