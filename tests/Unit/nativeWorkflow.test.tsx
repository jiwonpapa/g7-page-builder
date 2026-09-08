import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NativeTextPanel } from '../../resources/js/native-editor/ui/NativeTextPanel';
import { InsertionPosition } from '../../resources/js/native-editor/ui/InsertionPosition';
import { readNativeHost } from '../../resources/js/adapters/gnuboard7/editor';
import type { NativeCompositionPanelProps } from '../../resources/js/native-editor/ports/compositions';
import type { NativeCollection } from '../../resources/js/native-editor/domain/tree';

it('separates tools, reports missing capabilities and does not reopen a library after the user leaves it', async () => {
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  const raw = { protocol: 'g7.layout-editor/1', execute: vi.fn(), snapshot: {
    node: { id: 'p', type: 'basic', name: 'P', text: '원문' },
    context: { templateIdentifier: 'theme', layoutName: 'page', editMode: 'route', sessionId: 's', revision: 0, lockVersion: 0, readonly: false, nodeId: 'p', path: [0] },
  } };
  let resolve!: (value: React.ComponentType<NativeCompositionPanelProps>) => void;
  const loader = vi.fn(() => new Promise<React.ComponentType<NativeCompositionPanelProps>>(done => { resolve = done; }));
  const choose = async (position: number) => { await act(() => element.querySelectorAll<HTMLInputElement>('fieldset input')[position]!.click()); };
  try {
    await act(() => root.render(<NativeTextPanel host={readNativeHost(raw)} loadCompositions={loader} />));
    expect(element.querySelector('textarea')?.value).toBe('원문');
    expect(element.textContent).not.toContain('page · P');
    await choose(1); expect(element.querySelector('textarea')).toBeNull();
    expect(element.textContent).toContain('상위 구역을 선택');
    await choose(2); expect(loader).toHaveBeenCalledOnce();
    await choose(0); await act(() => resolve(() => <p>loaded library</p>));
    expect(element.textContent).not.toContain('loaded library');
    await choose(2); expect(element.textContent).toContain('loaded library'); expect(loader).toHaveBeenCalledOnce();
    expect(raw.execute).not.toHaveBeenCalled();
  } finally { await act(() => root.unmount()); element.remove(); }
});

it('uses visible short positions and a select only for a long list', async () => {
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element); const onChange = vi.fn();
  const collection: NativeCollection = { id: 'slot', label: '자식', kind: 'children', editable: true, choices: [],
    items: [{ id: 'p', label: '문단', editable: true, fields: [] }] };
  try {
    await act(() => root.render(<InsertionPosition collection={collection} index={1} onChange={onChange} />));
    expect(element.querySelector('select')).toBeNull();
    await act(() => element.querySelector<HTMLInputElement>('input')!.click()); expect(onChange).toHaveBeenCalledWith(0);
    await act(() => root.render(<InsertionPosition collection={{ ...collection, items: Array.from({ length: 6 }, (_, i) => ({ ...collection.items[0]!, id: String(i) })) }} index={6} onChange={onChange} />));
    expect(element.querySelector('select')?.options).toHaveLength(8);
  } finally { await act(() => root.unmount()); element.remove(); }
});
