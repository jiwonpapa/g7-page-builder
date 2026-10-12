import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React, { act, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { patchPuckHistory, patchPuckPosition, patchPuckRichTextSync } from '../../vite.puck-history';

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

describe('pinned Puck inline position correction', () => {
  const esm = readFileSync(join(dist, 'chunk-55V3NZVF.mjs'), 'utf8');
  function applyPosition(input: string, position: string) {
    const statement = input.split('\n').find(line => line.includes('el.style.position = "relative";'));
    if (!statement) throw new Error('Missing reviewed position statement');
    const el = { style: { position } };
    runInNewContext(statement, { el });
    return el.style.position;
  }
  it('reproduces the upstream overwrite and preserves authored positions in ESM and CJS', () => {
    expect(applyPosition(esm, 'absolute')).toBe('relative');
    for (const input of [esm, readFileSync(join(dist, 'index.js'), 'utf8')]) {
      const patched = patchPuckPosition(input);
      for (const position of ['static', 'relative', 'absolute']) expect(applyPosition(patched, position)).toBe(position);
      expect(applyPosition(patched, '')).toBe('relative');
    }
  });
  it('refuses unreviewed bytes and repeated corrections', () => {
    expect(() => patchPuckPosition(esm + '\n')).toThrow('Unreviewed Puck position');
    expect(() => patchPuckPosition(patchPuckPosition(esm))).toThrow('Unreviewed Puck position');
  });
});

describe('pinned Puck deferred rich-text reconciliation', () => {
  const source = readFileSync(join(dist, 'Editor-44C53YAG.mjs'), 'utf8');
  async function mounted(input: string) {
    const start = input.indexOf('function useSyncedEditor({'), end = input.indexOf('\n  return editor;\n}', start) + '\n  return editor;\n}'.length;
    let html = '<p>plain</p>', update = () => {};
    const setContent = vi.fn((value: string, _options: { emitUpdate: boolean }) => { html = value; });
    const editor = { getHTML: () => html, state: { selection: { from: 1, to: 3 } },
      commands: { setContent, setTextSelection: vi.fn() }, setEditable() {}, on() {}, off() {} };
    const store = { getState: () => ({ state: { ui: { field: { focus: 'body', metadata: { from: 1, to: 3 } } } } }) };
    // Execute the installed hook with real React scheduling, isolating only Tiptap and debounce I/O.
    const useEditor = (options: { onUpdate: (value: { editor: typeof editor }) => void }) => { update = () => options.onUpdate({ editor }); return editor; };
    const useDebounce = () => [null, () => {}];
    const hook = runInNewContext(input.slice(start, end) + '\nuseSyncedEditor', {
      useEffect, useRef, useState, useEditor, useDebounce, useAppStoreApi: () => store, setTimeout, clearTimeout,
      import_react40: { useEffect, useRef, useState }, import_react39: { useEditor }, import_use_debounce: { useDebounce },
    }) as (props: { content: string; name: string; extensions: never[]; onChange: () => void }) => unknown;
    const onChange = vi.fn(), host = document.createElement('div'), root = createRoot(host);
    function Consumer({ content }: { content: string }) { hook({ content, name: 'body', extensions: [], onChange }); return null; }
    const render = async (content: string) => { await act(async () => root.render(React.createElement(Consumer, { content }))); };
    await render(html);
    return { render, setContent, onChange, read: () => html,
      async type(value: string) { html = value; await act(async () => update()); },
      async dispose() { await act(async () => root.unmount()); },
    };
  }
  it('reproduces dropped Undo during the pending typing window and retries without an edit', async () => {
    vi.useFakeTimers();
    for (const corrected of [false, true]) {
      const view = await mounted(corrected ? patchPuckRichTextSync(source) : source);
      try {
        await view.type('<p>bold</p>'); await view.render('<p>bold</p>'); await view.render('<p>plain</p>');
        expect(view.read()).toBe('<p>bold</p>');
        await act(async () => vi.advanceTimersByTime(200));
        expect(view.read()).toBe(corrected ? '<p>plain</p>' : '<p>bold</p>');
        if (corrected) expect(view.setContent).toHaveBeenLastCalledWith('<p>plain</p>', { emitUpdate: false });
        expect(view.onChange).not.toHaveBeenCalled();
      } finally { await view.dispose(); }
    }
  });
  it('keeps the latest edit window and cancels its timer on unmount', async () => {
    vi.useFakeTimers(); const view = await mounted(patchPuckRichTextSync(source));
    await view.type('<p>first</p>'); await act(async () => vi.advanceTimersByTime(100));
    await view.type('<p>latest</p>'); await view.render('<p>latest</p>');
    await act(async () => vi.advanceTimersByTime(100)); expect(view.read()).toBe('<p>latest</p>');
    await view.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('supports pinned CJS and rejects unknown bytes', () => {
    expect(patchPuckRichTextSync(readFileSync(join(dist, 'index.js'), 'utf8'))).toContain('[content, editor, appStoreApi, editEpoch]');
    expect(() => patchPuckRichTextSync(source + '\n')).toThrow('Unreviewed Puck rich-text');
  });
});
