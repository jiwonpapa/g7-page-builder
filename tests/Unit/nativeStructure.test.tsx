import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { readNativeHost } from '../../resources/js/adapters/gnuboard7/editor';
import { readNativeCollections } from '../../resources/js/adapters/gnuboard7/structure';
import { NativeTextPanel } from '../../resources/js/native-editor/ui/NativeTextPanel';
const context = { templateIdentifier: 'theme', layoutName: 'page', editMode: 'route', sessionId: 's', revision: 1, lockVersion: 1, readonly: false, nodeId: 'root', path: [0] };
const collection = { id: 'opaque-child-slot', label: '자식', kind: 'children', editable: true,
  choices: [{ id: 'P', label: '문단' }], items: [{ id: 'child', label: '첫 문단', editable: true, fields: [] }] };
const fixture = () => ({ protocol: 'g7.layout-editor/1', execute: vi.fn((_command: unknown) => ({ kind: 'applied' })), snapshot: { context: { ...context },
  node: { id: 'root', name: 'Div', type: 'basic', __source: { kind: 'route' } }, collections: [structuredClone(collection)] } });
it('validates detached opaque slot descriptors and rejects malformed arrays', () => {
  const input = [structuredClone(collection)]; const parsed = readNativeCollections(input);
  input[0]!.items[0]!.label = 'Changed'; expect(parsed[0]?.items[0]?.label).toBe('첫 문단');
  expect(Object.isFrozen(parsed[0]?.items)).toBe(true);
  for (const invalid of [{ kind: 'raw' }, { editable: 1 }, { choices: [{}] }, { items: [{}] }, { id: '' }]) {
    expect(readNativeCollections([{ ...collection, ...invalid }])).toEqual([]);
  }
  expect(readNativeCollections([collection, collection])).toEqual([]);
});
it('sends only a guarded command and keeps old hosts compatible', () => {
  const input = fixture(); const host = readNativeHost(input)!;
  const change = { operation: 'duplicate' as const, collection: collection.id, index: 0 };
  expect(host.changeStructure?.(change)).toEqual({ kind: 'applied' });
  expect(input.execute).toHaveBeenCalledWith({ kind: 'structure', expected: context, change });
  expect(readNativeHost({ ...input, snapshot: { context, node: input.snapshot.node } })?.collections).toEqual([]);
  expect(input.snapshot.collections).toEqual([collection]);
});
it.each(['readonly', 'unknown-slot', 'negative-index', 'unknown-seed', 'protected-item'])('rejects %s locally', reason => {
  const input = fixture(); if (reason === 'readonly') input.snapshot.context.readonly = true;
  if (reason === 'protected-item') input.snapshot.collections[0]!.items[0]!.editable = false;
  const host = readNativeHost(input)!;
  const result = reason === 'unknown-seed' ? host.changeStructure?.({ operation: 'insert', collection: collection.id, choice: 'Script', index: 0 })
    : host.changeStructure?.({ operation: 'delete', collection: reason === 'unknown-slot' ? 'other' : collection.id, index: reason === 'negative-index' ? -1 : 0 });
  expect(result?.kind).toBe('refused'); expect(input.execute).not.toHaveBeenCalled();
});
it('requires a matching declared iteration root and preserves it in commands', () => {
  const input = fixture();
  expect(readNativeHost({ ...input, snapshot: { ...input.snapshot, context: { ...context, editMode: 'iteration_item' } } })).toBeNull();
  const expected = { ...context, editMode: 'iteration_item', iterationRoot: [0] };
  const host = readNativeHost({ ...input, snapshot: { ...input.snapshot, context: expected } });
  host?.changeStructure?.({ operation: 'delete', collection: collection.id, index: 0 });
  expect(input.execute).toHaveBeenCalledWith(expect.objectContaining({ expected }));
});
it('renders controls and routes insert/duplicate/delete through the host; readonly disables all', async () => {
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  const input = fixture();
  try {
    await act(() => root.render(<NativeTextPanel host={readNativeHost(input)} />));
    await act(() => element.querySelector<HTMLInputElement>('input[type=radio]')!.closest('fieldset')!.querySelectorAll<HTMLInputElement>('input')[1]!.click());
    const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('button')];
    for (const label of ['항목 추가', '복제', '삭제']) await act(() => buttons().find(button => button.textContent === label)!.click());
    expect(input.execute.mock.calls.map(call => call[0])).toEqual([
      { kind: 'structure', expected: context, change: { operation: 'insert', collection: collection.id, choice: 'P', index: 1 } },
      { kind: 'structure', expected: context, change: { operation: 'duplicate', collection: collection.id, index: 0 } },
      { kind: 'structure', expected: context, change: { operation: 'delete', collection: collection.id, index: 0 } },
    ]);
    input.snapshot.context.readonly = true;
    await act(() => root.render(<NativeTextPanel host={readNativeHost(input)} />));
    expect(buttons().every(button => button.disabled)).toBe(true);
  } finally { await act(() => root.unmount()); element.remove(); }
});
