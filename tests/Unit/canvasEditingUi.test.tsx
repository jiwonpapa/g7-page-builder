import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANVAS_ELEMENT_MESSAGE, type CanvasElementSelection } from '../../resources/js/editor/canvasEditingContract';
import { DEFAULT_PAGE_DESIGN } from '../../resources/js/editor/pageDesignTokens';
import type { PuckEditorData } from '../../resources/js/editor/puckEditorTypes';
import { useCanvasEditingUi } from '../../resources/js/editor/useCanvasEditingUi';

vi.hoisted(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const data: PuckEditorData = { root: { props: { ...DEFAULT_PAGE_DESIGN } }, content: [] };
const selection: CanvasElementSelection = { blockId: 'synthetic-selection', blockType: 'Heading', fieldPath: 'heading',
  role: 'text', label: 'Title', collection: null, itemIndex: null };
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach((run) => run())); vi.restoreAllMocks(); });

async function mount() {
  const frames = new Map<number, FrameRequestCallback>(); let id = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { frames.set(++id, callback); return id; });
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => { frames.delete(frame); });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  let result: ReturnType<typeof useCanvasEditingUi> | null = null, renders = 0, mounted = true;
  function Probe({ editable }: { editable: boolean }) {
    result = useCanvasEditingUi(data, editable); renders++;
    return <output>{result.canvasEditingUi.textToolsOpen ? 'open' : 'closed'}</output>;
  }
  const render = (editable: boolean) => act(async () => root.render(<Probe editable={editable} />));
  const unmount = () => { if (mounted) { mounted = false; root.unmount(); host.remove(); } };
  cleanup.push(unmount); await render(true);
  const current = () => { if (!result) throw new Error('Missing canvas hook'); return result; };
  const select = (value = selection) => act(async () => { window.dispatchEvent(new CustomEvent(CANVAS_ELEMENT_MESSAGE, { detail: value })); });
  return { host, render, current, select, unmount, cancel, frames, renders: () => renders };
}

describe('canvas selection event lifetime', () => {
  it('cancels pending tools on permission loss and rejects even a callback already dequeued by the browser', async () => {
    const test = await mount(); await test.select();
    expect(test.frames.size).toBe(1); const stale = [...test.frames.values()][0];
    await test.render(false);
    expect(test.cancel).toHaveBeenCalled();
    expect(test.frames.size).toBe(0);
    await act(async () => stale(0));
    expect(test.current().canvasEditingUi.selection).toBeNull();
    expect(test.current().canvasEditingUi.textToolsOpen).toBe(false);
    await test.render(true); await test.select();
    const live = [...test.frames.values()][0]; await act(async () => live(1));
    expect(test.current().canvasEditingUi.textToolsOpen).toBe(true);
  });

  it('retires stale selection callbacks and removes listeners and frames on unmount', async () => {
    const test = await mount(); await test.select();
    const stale = [...test.frames.values()][0];
    await test.select({ ...selection, blockId: 'next-selection' });
    await act(async () => stale(0));
    expect(test.current().canvasEditingUi.selection?.blockId).toBe('next-selection');
    expect(test.current().canvasEditingUi.textToolsOpen).toBe(false);
    await test.select(); const pending = [...test.frames.values()][0];
    await act(async () => test.unmount()); const renders = test.renders();
    expect(test.frames.size).toBe(0);
    await act(async () => {
      pending(1);
      window.dispatchEvent(new CustomEvent(CANVAS_ELEMENT_MESSAGE, { detail: selection }));
    });
    expect(test.renders()).toBe(renders);
    expect(test.frames.size).toBe(0);
  });
});
