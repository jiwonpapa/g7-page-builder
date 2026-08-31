import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { SitePartEditorCommands, SitePartEditorTools } from '../../resources/js/editor/SitePartEditorCommands';
import type { SitePartPuckData } from '../../resources/js/editor/sitePartDocumentAdapter';

const native = vi.hoisted(() => ({
  appState: { data: { content: [] }, ui: { leftSideBarVisible: true, rightSideBarVisible: true } },
  dispatch: vi.fn(),
  history: { index: 0, histories: [{ state: { data: { content: [] } } }], hasPast: true, hasFuture: true, back: vi.fn(), forward: vi.fn() },
}));
vi.mock('@puckeditor/core', () => ({ usePuck: () => native }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('registers native preset/history commands and unregisters them when the individual editor closes', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const command = { current: null } as React.RefObject<((data: SitePartPuckData) => void) | null>;
  try {
    await act(async () => root.render(<SitePartEditorCommands.Provider value={command}><SitePartEditorTools /></SitePartEditorCommands.Provider>));
    const data: SitePartPuckData = { root: { props: {} }, content: [] };
    command.current!(data);
    expect(native.dispatch).toHaveBeenCalledWith({ type: 'setData', data, recordHistory: true });
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="실행 취소"]')!.click());
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="다시 실행"]')!.click());
    expect(native.history.back).toHaveBeenCalledTimes(1);
    expect(native.history.forward).toHaveBeenCalledTimes(1);
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="왼쪽 패널 열기·닫기"]')!.click());
    expect(native.dispatch).toHaveBeenLastCalledWith({ type: 'setUi', ui: { leftSideBarVisible: false }, recordHistory: false });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
  expect(command.current).toBeNull();
});
