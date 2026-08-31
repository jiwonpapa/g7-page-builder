import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSitePartHistory } from '../../resources/js/editor/useSitePartHistory';

const native = vi.hoisted(() => ({
  appState: { data: { content: ['before'] } },
  history: { index: 1, histories: [{ state: { data: { content: ['initial'] } } }, { state: { data: { content: ['before'] } } }], hasPast: true, hasFuture: false, back: vi.fn(), forward: vi.fn() },
}));
vi.mock('@puckeditor/core', () => ({ usePuck: () => native }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

function Harness(): React.ReactElement {
  const history = useSitePartHistory();
  return <div className="Puck"><div ref={history.ref}>
    <button data-action="undo" disabled={!history.canUndo} onClick={history.undo}>Undo</button>
    <button data-action="redo" disabled={!history.canRedo} onClick={history.redo}>Redo</button>
  </div><iframe title="Preview" /></div>;
}

beforeEach(async () => {
  native.appState.data = { content: ['before'] };
  native.history.histories = [{ state: { data: { content: ['initial'] } } }, { state: { data: { content: ['before'] } } }];
  native.history.index = 1;
  native.history.hasPast = true;
  native.history.hasFuture = false;
  vi.clearAllMocks();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function pendingChange(): Promise<void> {
  native.appState.data = { content: ['after'] };
  await act(async () => root.render(<Harness />));
}
async function recordChange(): Promise<void> {
  native.history.histories.push({ state: { data: native.appState.data } });
  native.history.index += 1;
  await act(async () => root.render(<Harness />));
}

describe('Site Part native history commands', () => {
  it('waits for the latest Puck snapshot before undoing a rapid edit', async () => {
    await pendingChange();
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action="undo"]')!.click());
    expect(native.history.back).not.toHaveBeenCalled();
    await recordChange();
    expect(native.history.back).toHaveBeenCalledTimes(1);
    native.history.hasFuture = true;
    await act(async () => root.render(<Harness />));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-action="redo"]')!.click());
    expect(native.history.forward).toHaveBeenCalledTimes(1);
  });

  it.each(['host', 'iframe'])('defers rapid undo shortcuts from the %s until recording finishes', async (target) => {
    await pendingChange();
    const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    const win = target === 'host' ? window : container.querySelector('iframe')!.contentWindow!;
    await act(async () => { win.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(true);
    expect(native.history.back).not.toHaveBeenCalled();
    await recordChange();
    expect(native.history.back).toHaveBeenCalledTimes(1);
    const settled = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, cancelable: true });
    win.dispatchEvent(settled);
    expect(settled.defaultPrevented).toBe(false);
  });
});
