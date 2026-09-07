export type NativeValue = string | number | boolean | null;
export interface NativeField {
  id: string;
  label: string;
  kind: 'text' | 'link' | 'image' | 'alt' | 'choice';
  group: 'content' | 'style';
  value: NativeValue;
  options: Array<{ value: NativeValue; label: string }>;
  editable: boolean;
  custom: boolean;
  source: 'template-spec' | 'core-image';
}
export function acceptsNativeValue(field: NativeField, value: NativeValue, reset: boolean): boolean {
  if (!field.editable) return false;
  if (reset) return true;
  if (field.kind === 'choice') return field.options.some(option => option.value === value);
  return typeof value === 'string' && !/\$[\w-]+:|\{\{|\}\}|\{p\d+\}|<[^>]*>/.test(value);
}
