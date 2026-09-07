/** Native JSON stays owned by G7. This boundary retains unknown fields, without a PB schema conversion. */
export type NativeJson = null | boolean | number | string | NativeJson[] | NativeJsonObject;
export interface NativeJsonObject { [key: string]: NativeJson }
export interface NativeNode extends NativeJsonObject { id: string; type: string; name: string }

export type NativeNodeRead =
  | { status: 'valid'; node: NativeNode }
  | { status: 'invalid'; reason: 'not-a-json-node' | 'unsupported-node-shape' };

function copyJson(value: unknown, ancestors: Set<object>): NativeJson {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || ancestors.has(value)) throw new Error('Not a JSON value');
  const prototype: unknown = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new Error('Not a JSON object');
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Reflect.ownKeys(value).length !== value.length + 1) throw new Error('Non-JSON array members');
      const copy: NativeJson[] = [];
      for (let index = 0; index < value.length; index++) {
        const field = Object.getOwnPropertyDescriptor(value, String(index));
        if (!field || !field.enumerable || !('value' in field)) throw new Error('Sparse or accessor array');
        const child: unknown = field.value;
        copy.push(copyJson(child, ancestors));
      }
      Object.freeze(copy);
      return copy;
    }
    const copy: NativeJsonObject = {};
    for (const key of Reflect.ownKeys(value)) {
      const field = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || !field?.enumerable || !('value' in field)) throw new Error('Non-JSON property');
      const child: unknown = field.value;
      Object.defineProperty(copy, key, { enumerable: true, value: copyJson(child, ancestors) });
    }
    return Object.freeze(copy);
  } finally {
    ancestors.delete(value);
  }
}

function isNativeNode(value: NativeJson): value is NativeNode {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && typeof value.id === 'string' && Boolean(value.id.trim())
    && typeof value.name === 'string' && Boolean(value.name.trim())
    && typeof value.type === 'string' && Boolean(value.type.trim());
}

export function readNativeNode(input: unknown): NativeNodeRead {
  try {
    const copy = copyJson(input, new Set());
    return isNativeNode(copy) ? { status: 'valid', node: copy }
      : { status: 'invalid', reason: 'unsupported-node-shape' };
  } catch {
    return { status: 'invalid', reason: 'not-a-json-node' };
  }
}
