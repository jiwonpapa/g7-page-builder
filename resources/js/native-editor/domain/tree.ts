import type { NativeField, NativeValue } from './fields';

/** A host-owned slot, not a PageBuilderDocument or a second tree store. */
export interface NativeCollection {
  id: string;
  label: string;
  kind: 'children' | 'array' | 'cell';
  editable: boolean;
  choices: Array<{ id: string; label: string }>;
  items: Array<{ id: string; label: string; editable: boolean; fields: NativeField[] }>;
}
export type NativeStructureChange =
  | { operation: 'insert'; collection: string; choice: string; index: number }
  | { operation: 'delete' | 'duplicate'; collection: string; index: number }
  | { operation: 'move'; collection: string; index: number; destination: string; toIndex: number }
  | { operation: 'field'; collection: string; index: number; field: string; value: NativeValue };
