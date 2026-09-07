import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readNativeHost, registerNativeEditor } from '../../resources/js/adapters/gnuboard7/editor';
import { prepareNativeEditor } from '../../resources/js/adapters/gnuboard7/bootstrap';
import { NativeTextPanel } from '../../resources/js/native-editor/ui/NativeTextPanel';

const node = { id: 'heading', name: 'H2', type: 'basic', text: 'Before', __source: { kind: 'route' },
  future: { keep: [1, 'x'] }, responsive: { mobile: { text: '$t:mobile' } } };
const context = { templateIdentifier: 'sirsoft-basic', layoutName: 'e2e_sandbox', editMode: 'route',
  sessionId: 'test-session', revision: 2, lockVersion: 3, readonly: false, nodeId: 'heading', path: [0] };
const fixture = () => ({ protocol: 'g7.layout-editor/1', snapshot: { node: structuredClone(node), context: structuredClone(context) },
  execute: vi.fn().mockReturnValue({ kind: 'applied' }) });
afterEach(() => { delete window.G7Core; document.head.innerHTML = ''; });
it('requires the actual host protocol and complete valid context', () => {
  expect(readNativeHost(null)).toBeNull();
  expect(readNativeHost({ ...fixture(), protocol: 'future' })).toBeNull();
  for (const key of Object.keys(context)) {
    const input = fixture();
    Reflect.deleteProperty(input.snapshot.context, key);
    expect(readNativeHost(input), key).toBeNull();
  }
  expect(readNativeHost({ ...fixture(), snapshot: { node, context: { ...context, nodeId: 'other' } } })).toBeNull();
});
it('sends only an expected-context text command and preserves source metadata', () => {
  const input = fixture();
  const port = readNativeHost(input)!;
  input.snapshot.node.text = 'External mutation';
  expect(port.node.text).toBe('Before');
  expect(port.applyText('After')).toEqual({ kind: 'applied' });
  expect(input.execute).toHaveBeenCalledExactlyOnceWith({ kind: 'setText', expected: context, text: 'After' });
  expect(port.node).toEqual(node);
});
it.each(['readonly', 'binding', 'noop'])('does not send an unnecessary or unsupported %s request', mode => {
  const input = fixture();
  if (mode === 'readonly') input.snapshot.context.readonly = true;
  if (mode === 'binding') input.snapshot.node.text = '$t:hello';
  const port = readNativeHost(input)!;
  port.applyText(mode === 'noop' ? 'Before' : 'After');
  expect(input.execute).not.toHaveBeenCalled();
});
it('preserves a responsive path and returns stale/error outcomes', () => {
  const input = { ...fixture(), snapshot: { node, context: { ...context, path: [0, { responsive: 'portable' }, 1] } } };
  input.execute.mockReturnValue({ kind: 'refused', reason: 'stale' });
  const port = readNativeHost(input)!;
  expect(port.context.path).toEqual(input.snapshot.context.path);
  expect(port.applyText('After')).toEqual({ kind: 'refused', reason: 'stale' });
  input.execute.mockImplementation(() => { throw new Error('host failed'); });
  expect(port.applyText('After')).toEqual({ kind: 'refused', reason: 'host-error' });
});
it('registers only via a provided public panel API', () => {
  expect(registerNativeEditor()).toBe(false);
  const registerPanel = vi.fn();
  window.G7Core = { layoutEditor: { registerPanel } };
  expect(registerNativeEditor()).toBe(true);
  expect(registerPanel.mock.calls[0]?.[0]).toBe('jiwonpapa-page-builder/detail');
});
it('loads native assets once on ready, and leaves older hosts unchanged', () => {
  const ready: Array<() => void> = [];
  window.G7Core = { layoutEditor: { onReady: callback => { ready.push(callback); } } };
  prepareNativeEditor();
  ready[0]!();
  expect(document.querySelector('[data-g7pb-native-asset]')).toBeNull();
  window.G7Core.layoutEditor!.registerPanel = vi.fn();
  ready[0]!(); ready[0]!();
  expect(document.querySelectorAll('[data-g7pb-native-asset]')).toHaveLength(1);
  expect(document.querySelector('script')?.src).toContain('/dist/js/page-builder-native.iife.js');
});
it('shows an unavailable selection and disables a protected node in the real React panel', async () => {
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  try {
    await act(async () => root.render(<NativeTextPanel host={null} />));
    expect(element.textContent).toContain('선택해 주세요');
    const input = fixture(); input.snapshot.context.readonly = true;
    await act(async () => root.render(<NativeTextPanel host={readNativeHost(input)} />));
    expect(element.querySelector('textarea')?.disabled).toBe(true);
    expect(element.querySelector('button')?.disabled).toBe(true);
  } finally { await act(async () => root.unmount()); element.remove(); }
});
it('boots the native entry through the public host registration', async () => {
  const registerPanel = vi.fn();
  window.G7Core = { layoutEditor: { registerPanel } };
  await import('../../resources/js/native-editor/entry');
  expect(registerPanel).toHaveBeenCalledOnce();
});
