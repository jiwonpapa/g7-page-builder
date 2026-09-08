import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { NativeCompositionPanel } from '../../resources/js/native-editor/compositionEntry';
import { NativeCompositions } from '../../resources/js/native-editor/ui/compositions';
import { readNativeHost } from '../../resources/js/adapters/gnuboard7/editor';
import { saveComposition, insertSavedComposition } from '../../resources/js/native-editor/application/compositions';
import { NATIVE_COMPOSITION_SCHEMA } from '../../resources/js/native-editor/domain/composition';
import type { NativeCompositionLibrary } from '../../resources/js/native-editor/ports/compositions';
const id = '00000000-0000-4000-8000-000000000004';
const row = { id, title: '소개', schemaVersion: NATIVE_COMPOSITION_SCHEMA, createdAt: '2026-09-08', snapshot: '{"original":{}}' };
const input = () => ({ protocol: 'g7.layout-editor/1', snapshot: { node: { id: 'root', name: 'Div', type: 'basic', __source: { kind: 'route' } },
  context: { templateIdentifier: 'theme', layoutName: 'page', editMode: 'route', sessionId: 's', revision: 1, lockVersion: 1, readonly: false, nodeId: 'root', path: [0] },
  collections: [{ id: 'children', label: '자식', kind: 'children', editable: true, choices: [], items: [] }] },
  execute: vi.fn(), compositions: { export: vi.fn().mockResolvedValue({ ok: true, data: row.snapshot }), insert: vi.fn().mockResolvedValue({ kind: 'applied' }) } });
const library = (): NativeCompositionLibrary => ({ page: vi.fn().mockResolvedValue({ ok: true, data: { items: [row], hasMore: false } }),
  read: vi.fn().mockResolvedValue({ ok: true, data: row }), save: vi.fn().mockResolvedValue({ ok: true, data: row }), delete: vi.fn().mockResolvedValue({ ok: true, data: null }) });
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });
it('exports through the public context and stores the exact opaque host payload', async () => {
  const raw = input(); const host = readNativeHost(raw)!; const store = library(); const signal = new AbortController().signal;
  expect(await saveComposition(host, store, ' 소개 ', signal)).toEqual({ ok: true, data: null });
  expect(raw.compositions.export).toHaveBeenCalledWith({ expected: raw.snapshot.context, signal });
  expect(store.save).toHaveBeenCalledWith('소개', row.snapshot, signal); expect(raw.execute).not.toHaveBeenCalled();
});
it('inserts only a compatible snapshot at an allowed collection', async () => {
  const raw = input(); const host = readNativeHost(raw)!; const store = library(); const signal = new AbortController().signal;
  expect((await insertSavedComposition(host, store, id, 'children', signal)).ok).toBe(true);
  expect(raw.compositions.insert).toHaveBeenCalledWith({ expected: raw.snapshot.context, snapshot: row.snapshot, collection: 'children', index: 0, signal });
  expect((await insertSavedComposition(host, store, id, 'missing', signal)).ok).toBe(false);
  vi.mocked(store.read).mockResolvedValue({ ok: true, data: { ...row, schemaVersion: 'future' } });
  expect((await insertSavedComposition(host, store, id, 'children', signal)).ok).toBe(false);
  expect(raw.compositions.insert).toHaveBeenCalledTimes(1);
});
it('refuses readonly, missing contracts, rejected export and cancelled read', async () => {
  const raw = input(); const store = library(); const signal = new AbortController().signal;
  raw.snapshot.context.readonly = true;
  expect((await saveComposition(readNativeHost(raw)!, store, '소개', signal)).ok).toBe(false);
  raw.snapshot.context.readonly = false; raw.compositions.export.mockResolvedValue({ ok: false, data: '' });
  expect((await saveComposition(readNativeHost(raw)!, store, '소개', signal)).ok).toBe(false); expect(store.save).not.toHaveBeenCalled();
  const abort = new AbortController(); vi.mocked(store.read).mockImplementation(async () => { abort.abort(); return { ok: true, data: row }; });
  expect((await insertSavedComposition(readNativeHost(raw)!, store, id, 'children', abort.signal)).ok).toBe(false);
  expect(raw.compositions.insert).not.toHaveBeenCalled(); expect(readNativeHost({ ...raw, compositions: {} })!.compositions).toBeUndefined();
});
it('shows metadata and requires explicit deletion confirmation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element); const store = library();
  await act(async () => root.render(<NativeCompositions host={readNativeHost(input())!} library={store} />));
  const click = async (label: string) => { await act(async () => Array.from(element.querySelectorAll('button')).find(button => button.textContent === label)!.click()); };
  await click('조합 목록 새로고침'); expect(element.textContent).toContain('소개');
  await click('목록에서 삭제'); expect(store.delete).not.toHaveBeenCalled(); expect(element.textContent).toContain('이미 삽입한 사본과 이미지는 유지');
  await click('취소'); expect(store.delete).not.toHaveBeenCalled();
  await click('목록에서 삭제'); await click('삭제 확인'); expect(store.delete).toHaveBeenCalledWith(id, expect.any(AbortSignal));
  await act(async () => root.unmount()); expect(typeof NativeCompositionPanel).toBe('function');
});
