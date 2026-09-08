export const NATIVE_COMPOSITION_SCHEMA = 'g7-page-builder/native-composition/v1';
export interface NativeCompositionSummary { id: string; title: string; schemaVersion: string; createdAt: string }
export interface NativeComposition extends NativeCompositionSummary { snapshot: string }
export function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function readCompositionSummary(value: unknown): NativeCompositionSummary | null {
  if (!object(value) || typeof value.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(value.id)
    || typeof value.title !== 'string' || !value.title.trim() || [...value.title].length > 120
    || typeof value.schema_version !== 'string' || typeof value.created_at !== 'string') return null;
  return { id: value.id, title: value.title, schemaVersion: value.schema_version, createdAt: value.created_at };
}
export function readSavedComposition(value: unknown): NativeComposition | null {
  const item = readCompositionSummary(value);
  return item && object(value) && typeof value.snapshot === 'string'
    && new TextEncoder().encode(value.snapshot).length <= 262144 ? { ...item, snapshot: value.snapshot } : null;
}

