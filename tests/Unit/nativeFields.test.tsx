import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { readNativeHost } from '../../resources/js/adapters/gnuboard7/editor';
import { readNativeFields } from '../../resources/js/adapters/gnuboard7/fields';
import { acceptsNativeValue, type NativeField } from '../../resources/js/native-editor/domain/fields';
import { NativeTextPanel } from '../../resources/js/native-editor/ui/NativeTextPanel';
import { Choice } from '../../resources/js/native-editor/ui/Choice';
const context = { templateIdentifier: 'theme', layoutName: 'page', editMode: 'route', sessionId: 'one', revision: 1, lockVersion: 1, readonly: false, nodeId: 'img', path: [0] };
const field: NativeField = { id: 'imgAlt', label: '대체 텍스트', kind: 'alt', group: 'content', value: 'Before', options: [], editable: true, custom: false, source: 'template-spec' };
const fixture = (fields = [field]) => ({ protocol: 'g7.layout-editor/1', execute: vi.fn(() => ({ kind: 'applied' })),
  snapshot: { context: { ...context }, node: { id: 'img', name: 'Img', type: 'basic', props: { src: '/before.png' }, __source: { kind: 'route' } }, fields } });
it('validates detached field descriptors and rejects malformed or duplicate host fields', () => {
  const input = [structuredClone(field)]; const parsed = readNativeFields(input); input[0]!.label = 'mutated';
  expect(parsed[0]?.label).toBe('대체 텍스트'); expect(Object.isFrozen(parsed[0])).toBe(true);
  expect(readNativeFields([field, field])).toEqual([]);
  for (const bad of [{ kind: 'html' }, { value: {} }, { options: [{}] }, { editable: 'yes' }, { group: 'raw' }, { source: 'guess' }]) {
    expect(readNativeFields([{ ...field, ...bad }])).toEqual([]);
  }
});
it('applies fields and reset only through the current public command context', () => {
  const input = fixture(); const host = readNativeHost(input)!;
  expect(host.applyField('imgAlt', '')).toEqual({ kind: 'applied' });
  expect(input.execute).toHaveBeenLastCalledWith({ kind: 'setControl', expected: context, control: 'imgAlt', value: '', reset: false });
  host.applyField('imgAlt', null, true);
  expect(input.execute).toHaveBeenLastCalledWith({ kind: 'setControl', expected: context, control: 'imgAlt', value: null, reset: true });
});
it.each(['missing', 'readonly', 'binding', 'invalid-value', 'unknown-choice'])('refuses %s before calling the host', reason => {
  const input = fixture(reason === 'binding' ? [{ ...field, editable: false }] : reason === 'unknown-choice' ? [{ ...field, kind: 'choice', options: [{ value: 'yes', label: '예' }] }] : [field]);
  if (reason === 'readonly') input.snapshot.context.readonly = true;
  const host = readNativeHost(input)!;
  expect(host.applyField(reason === 'missing' ? 'unknown' : 'imgAlt', reason === 'invalid-value' ? '{{bound}}' : 'other').kind).toBe('refused');
  expect(input.execute).not.toHaveBeenCalled();
});
it('preserves unsupported binding values and only accepts the listed choices', () => {
  expect(acceptsNativeValue({ ...field, editable: false }, null, true)).toBe(false);
  expect(acceptsNativeValue(field, '<b>raw</b>', false)).toBe(false);
  expect(acceptsNativeValue(field, 5, false)).toBe(false);
});
it('shows short choices as radios and a long list as Select with current unknown value preserved', async () => {
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  const changed = vi.fn(); const options = ['왼쪽', '가운데', '오른쪽'].map(value => ({ value, label: value }));
  try {
    await act(() => root.render(<Choice label="정렬" value="가운데" options={options} onChange={changed} />));
    expect(element.querySelectorAll('input[type=radio]')).toHaveLength(3); expect(element.querySelector('select')).toBeNull();
    await act(() => element.querySelectorAll<HTMLInputElement>('input')[2]!.click()); expect(changed).toHaveBeenCalledWith('오른쪽');
    await act(() => root.render(<Choice label="색상" value="custom" options={Array.from({ length: 6 }, (_, value) => ({ value, label: String(value) }))} onChange={changed} />));
    expect(element.querySelector('select')?.value).toBe('-1');
  } finally { await act(() => root.unmount()); element.remove(); }
});
it('renders content and style fields for the selected node; readonly has no mutation controls', async () => {
  const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
  const input = fixture([field, { ...field, id: 'width', label: '너비', kind: 'choice', group: 'style', value: '50%', options: [{ value: '50%', label: '절반' }] }]);
  try {
    await act(() => root.render(<NativeTextPanel host={readNativeHost(input)} />));
    expect(element.textContent).toContain('공통 스타일'); expect(element.textContent).toContain('공개 페이지');
    expect(element.querySelector<HTMLInputElement>('.g7pb-native-content input')?.value).toBe('Before');
    input.snapshot.context.readonly = true;
    await act(() => root.render(<NativeTextPanel host={readNativeHost(input)} />));
    expect(element.querySelector<HTMLInputElement>('.g7pb-native-content input')?.disabled).toBe(true);
    expect([...element.querySelectorAll<HTMLButtonElement>('.g7pb-native-content button')].every(button => button.disabled)).toBe(true);
  } finally { await act(() => root.unmount()); element.remove(); }
});
