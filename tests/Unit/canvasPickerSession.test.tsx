import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasPickerSession } from '../../resources/js/editor/CanvasPickerSession';

const picker = vi.hoisted(() => ({ apply: (_value: string) => {} }));
vi.mock('../../resources/js/editor/MediaPickerField', () => ({ CanvasMediaPicker: ({ onChange }: { onChange: (value: string) => void }) => {
  picker.apply = onChange; return null;
} }));
vi.mock('../../resources/js/editor/RouteUrlField', () => ({ CanvasRoutePicker: ({ onChange }: { onChange: (value: string) => void }) => {
  picker.apply = onChange; return null;
} }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => void> = [];
afterEach(() => { act(() => cleanups.splice(0).forEach((cleanup) => cleanup())); });

describe.each(['media', 'route'] as const)('%s picker target ownership', (kind) => {
  async function mount() {
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host); const dismiss = vi.fn(); let mounted = true;
    const render = (targetKey: string | null, onChange = vi.fn()) => act(async () => {
      root.render(<CanvasPickerSession kind={kind} targetKey={targetKey} value="" onChange={onChange} onDismiss={dismiss} />);
    });
    const unmount = () => { if (mounted) { root.unmount(); host.remove(); mounted = false; } };
    cleanups.push(unmount); await render('first:image');
    return { render, dismiss, unmount };
  }

  it('rejects a delayed result after selection changes or disappears', async () => {
    for (const nextTarget of ['second:image', null]) {
      const test = await mount(); const pending = picker.apply; const changed = vi.fn();
      await test.render(nextTarget, changed);
      await act(async () => pending('/old-result'));
      expect(changed).not.toHaveBeenCalled();
      expect(test.dismiss).toHaveBeenCalledTimes(1);
    }
  });

  it('uses current props for the same target and rejects callbacks after unmount', async () => {
    const test = await mount(); const pending = picker.apply; const changed = vi.fn();
    await test.render('first:image', changed);
    await act(async () => pending('/chosen'));
    expect(changed).toHaveBeenCalledExactlyOnceWith('/chosen');
    expect(test.dismiss).toHaveBeenCalledTimes(1);
    await act(async () => test.unmount());
    await act(async () => pending('/late-result'));
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
