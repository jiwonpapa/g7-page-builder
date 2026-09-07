import type { NativeField, NativeValue } from '../../native-editor/domain/fields';
function record(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function value(v: unknown): v is NativeValue { return v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v); }
export function readNativeFields(input: unknown): NativeField[] {
  if (!Array.isArray(input)) return [];
  const result: NativeField[] = [];
  for (const f of input) {
    if (!record(f) || typeof f.id !== 'string' || !f.id || typeof f.label !== 'string' || !value(f.value)
      || f.kind !== 'text' && f.kind !== 'link' && f.kind !== 'image' && f.kind !== 'alt' && f.kind !== 'choice'
      || f.group !== 'content' && f.group !== 'style' || typeof f.editable !== 'boolean' || typeof f.custom !== 'boolean'
      || f.source !== 'template-spec' && f.source !== 'core-image' || !Array.isArray(f.options)) return [];
    const options: NativeField['options'] = [];
    for (const o of f.options) {
      if (!record(o) || !value(o.value) || typeof o.label !== 'string') return [];
      options.push(Object.freeze({ value: o.value, label: o.label }));
    }
    if (result.some(item => item.id === f.id)) return [];
    result.push(Object.freeze({ id: f.id, label: f.label, kind: f.kind, group: f.group, value: f.value,
      options, editable: f.editable, custom: f.custom, source: f.source }));
    Object.freeze(options);
  }
  return Object.freeze(result).slice();
}
