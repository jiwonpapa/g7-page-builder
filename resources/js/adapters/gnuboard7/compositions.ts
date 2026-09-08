import type { NativeContext } from '../../native-editor/ports/host';
import type { NativeCompositionCommands } from '../../native-editor/ports/compositions';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export function readCompositionCommands(input: unknown, expected: NativeContext): NativeCompositionCommands | undefined {
  if (!record(input) || typeof input.export !== 'function' || typeof input.insert !== 'function') return undefined;
  const exportSnapshot = input.export; const insertSnapshot = input.insert;
  return {
    async export(signal) {
      try {
        if (signal.aborted) return { ok: false, reason: 'cancelled' };
        const result: unknown = await exportSnapshot({ expected, signal });
        return !signal.aborted && record(result) && result.ok === true && typeof result.data === 'string'
          && new TextEncoder().encode(result.data).length <= 262144 ? { ok: true, data: result.data } : { ok: false, reason: 'export-refused' };
      } catch { return { ok: false, reason: 'export-failed' }; }
    },
    async insert(snapshot, collection, index, signal) {
      try {
        if (signal.aborted) return { kind: 'refused', reason: 'cancelled' };
        const result: unknown = await insertSnapshot({ expected, snapshot, collection, index, signal });
        return record(result) && (result.kind === 'applied' || result.kind === 'noop') ? { kind: result.kind }
          : { kind: 'refused', reason: 'insert-refused' };
      } catch { return { kind: 'refused', reason: 'insert-failed' }; }
    },
  };
}

