import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { patchPuckHistory } from '../../vite.puck-history';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('@puckeditor/core'));
const source = readFileSync(join(dist, 'chunk-K2LNXU54.mjs'), 'utf8');
interface TestHistory {
  back(): void; forward(): void; hasFuture(): boolean; hasPast(): boolean;
  histories: { state: { value: number } }[]; index: number;
}
interface TestStore {
  state: { value: number; ui: { itemSelector: null } };
  history: TestHistory;
  dispatch(action: { type: string; value?: number; recordHistory?: boolean }): void;
}
// Execute the installed vendor history AND its dispatch wrapper. The reducer
// stub changes a scalar only; no replacement history implementation is tested.
function kernel(input: string): () => TestStore {
  const history = input.slice(input.indexOf('var EMPTY_HISTORY_INDEX = 0;'), input.indexOf('function useRegisterHistorySlice('));
  const dispatchStart = input.indexOf('dispatch: (action) => set((s) => {');
  const dispatch = input.slice(dispatchStart, input.indexOf('setZoomConfig:', dispatchStart));
  return runInNewContext(`
    const __spreadValues = Object.assign, __spreadProps = Object.assign;
    let id = 0; const generateId = () => String(++id);
    let store = { state: { value: 0, ui: { itemSelector: null } } };
    const get = () => store;
    const set = (update) => { store = { ...store, ...(typeof update === 'function' ? update(store) : update) }; };
    const getItem = () => null;
    const createReducer = ({record}) => (state, action) => {
      const next = action.type === 'set' ? action.state : { ...state, value: action.value ?? state.value };
      if (action.type === 'edit' && action.recordHistory !== false) record(next);
      return next;
    };
    ${history}
    store.history = createHistorySlice(set, get);
    store.history.histories = [{ state: store.state, id: 'initial' }];
    store.dispatch = ({ ${dispatch} }).dispatch;
    get;
  `, { setTimeout, clearTimeout }) as () => TestStore;
}

afterEach(() => vi.useRealTimers());
describe('pinned Puck history correction', () => {
  it('reproduces the original pending-record loss of redo', () => {
    vi.useFakeTimers();
    const get = kernel(source);
    get().dispatch({ type: 'edit', value: 1 });
    vi.advanceTimersByTime(250);
    get().dispatch({ type: 'edit', value: 2 });
    get().history.back();
    expect(get().history.hasFuture()).toBe(true);
    vi.advanceTimersByTime(250);
    expect(get().history.hasFuture()).toBe(false);
  });
  it('records every rapid command atomically and preserves repeated undo/redo after timers', () => {
    vi.useFakeTimers();
    const get = kernel(patchPuckHistory(source));
    for (const value of [1, 2, 3]) get().dispatch({ type: 'edit', value });
    expect(get().history.histories.map((h) => h.state.value)).toEqual([0, 1, 2, 3]);
    for (const value of [2, 1, 0]) { get().history.back(); expect(get().state.value).toBe(value); }
    expect(get().history.hasPast()).toBe(false);
    for (const value of [1, 2, 3]) { get().history.forward(); expect(get().state.value).toBe(value); }
    vi.advanceTimersByTime(500);
    expect(get().state.value).toBe(3);
    expect(get().history.histories).toHaveLength(4);
  });
  it('keeps non-recorded selection out of history and discards redo only for a new edit', () => {
    const get = kernel(patchPuckHistory(source));
    get().dispatch({ type: 'edit', value: 1 });
    get().dispatch({ type: 'edit', value: 2 });
    get().history.back();
    get().dispatch({ type: 'selection', recordHistory: false });
    expect(get().history.hasFuture()).toBe(true);
    get().dispatch({ type: 'edit', value: 9 });
    expect(get().history.hasFuture()).toBe(false);
    expect(get().history.histories.map((h) => h.state.value)).toEqual([0, 1, 9]);
    get().history.back(); expect(get().state.value).toBe(1);
  });
  it('supports the pinned CJS source but refuses unreviewed vendor bytes', () => {
    const cjs = readFileSync(join(dist, 'index.js'), 'utf8');
    expect(patchPuckHistory(cjs)).toContain('state, selectedItem, history: get().history');
    expect(() => patchPuckHistory(source + '\n')).toThrow('Unreviewed Puck');
  });
});
