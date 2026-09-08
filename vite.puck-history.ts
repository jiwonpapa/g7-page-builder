import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

// Puck 0.23.0 MIT vendor correction. Keep the original history/reducer/UI;
// record each dispatched edit atomically instead of a trailing 250ms timer.
// Exact upstream bytes are required: upgrades must review or retire this patch.
const SOURCE_HASHES = new Set([
  '4a5be5f5355088fe768bae0b72876e349010deb4b952e69a02f48acb461f3e37',
  '34b012f3b413a88b30aff0066b9616ef7c59482f85268dea40a7c52b0a024d20',
]);
export function patchPuckHistory(source: string): string {
  if (!SOURCE_HASHES.has(createHash('sha256').update(source).digest('hex'))) {
    throw new Error('Unreviewed Puck history source; review the pinned 0.23.0 correction.');
  }
  const start = source.indexOf('createHistorySlice = (set, get) => {');
  const end = source.indexOf('  return {', start);
  const record = source.slice(start, end)
    .replace('const record = debounce((state) => {', 'const record = (state) => {')
    .replace('}, 250);', '};');
  let patched = source.slice(0, start) + record + source.slice(end);
  const dispatchStart = patched.indexOf('dispatch: (action) => set((s) => {');
  const dispatchEnd = patched.indexOf('setZoomConfig:', dispatchStart);
  const dispatch = patched.slice(dispatchStart, dispatchEnd)
    // record() updates history within this set callback. Do not overwrite it
    // with the callback's pre-action snapshot when publishing the new data.
    .replace('{ state, selectedItem }', '{ state, selectedItem, history: get().history }');
  patched = patched.slice(0, dispatchStart) + dispatch + patched.slice(dispatchEnd);
  return patched;
}

export function puckHistoryCorrection(): Plugin {
  let corrected = false;
  return {
    name: 'g7pb-puck-023-history-correction', enforce: 'pre', apply: 'build',
    transform(source, id) {
      if (!id.includes('/@puckeditor/core/dist/') || !source.includes('createHistorySlice = (set, get) => {')) return;
      const code = patchPuckHistory(source);
      corrected = true;
      return { code, map: null };
    },
    buildEnd(error) {
      if (!error && !corrected) throw new Error('Puck history correction was not applied to the editor bundle.');
    },
  };
}
