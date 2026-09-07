import type { NativeCollection, NativeStructureChange } from '../../native-editor/domain/tree';
import { acceptsNativeValue } from '../../native-editor/domain/fields';
import { readNativeFields } from './fields';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function readNativeCollections(input: unknown): NativeCollection[] {
  if (!Array.isArray(input) || input.length > 256) return [];
  const result: NativeCollection[] = [];
  for (const collection of input) {
    if (!record(collection) || typeof collection.id !== 'string' || !collection.id || typeof collection.label !== 'string'
      || typeof collection.editable !== 'boolean' || !['children', 'array', 'cell'].includes(String(collection.kind))
      || !Array.isArray(collection.choices) || !Array.isArray(collection.items) || collection.items.length > 1000
      || result.some(existing => existing.id === collection.id)) return [];
    const choices: NativeCollection['choices'] = [];
    for (const choice of collection.choices) {
      if (!record(choice) || typeof choice.id !== 'string' || !choice.id || typeof choice.label !== 'string'
        || choices.some(existing => existing.id === choice.id)) return [];
      choices.push(Object.freeze({ id: choice.id, label: choice.label }));
    }
    const items: NativeCollection['items'] = [];
    for (const item of collection.items) {
      if (!record(item) || typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.editable !== 'boolean' || !Array.isArray(item.fields)) return [];
      const fields = readNativeFields(item.fields);
      if (fields.length !== item.fields.length) return [];
      items.push(Object.freeze({ id: item.id, label: item.label, editable: item.editable, fields }));
    }
    const kind = collection.kind;
    if (kind !== 'children' && kind !== 'array' && kind !== 'cell') return [];
    Object.freeze(choices); Object.freeze(items);
    result.push(Object.freeze({ id: collection.id, label: collection.label, kind, editable: collection.editable, choices, items }));
  }
  Object.freeze(result);
  return result;
}
export function acceptsStructureChange(collections: NativeCollection[], change: NativeStructureChange): boolean {
  const collection = collections.find(item => item.id === change.collection);
  if (!collection?.editable || !Number.isSafeInteger(change.index) || change.index < 0) return false;
  if (change.operation === 'insert') return change.index <= collection.items.length && collection.choices.some(choice => choice.id === change.choice);
  const item = collection.items[change.index];
  if (!item?.editable) return false;
  if (change.operation === 'field') {
    const field = item.fields.find(field => field.id === change.field);
    return !!field && acceptsNativeValue(field, change.value, false);
  }
  if (change.operation === 'move') {
    const destination = collections.find(item => item.id === change.destination);
    return !!destination?.editable && Number.isSafeInteger(change.toIndex) && change.toIndex >= 0 && change.toIndex <= destination.items.length;
  }
  return change.operation === 'duplicate' || change.operation === 'delete';
}
