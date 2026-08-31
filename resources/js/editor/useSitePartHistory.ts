import { useCallback, useEffect, useRef } from 'react';
import { usePuck, type Config } from '@puckeditor/core';
import type { SitePartComponents } from './sitePartDocumentAdapter';

type Direction = 'back' | 'forward';

/** Keep Puck's native history; defer commands until its debounced snapshot lands. */
export function useSitePartHistory(): {
  ref: React.RefObject<HTMLDivElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
} {
  const { appState, history } = usePuck<Config<SitePartComponents>>();
  const ref = useRef<HTMLDivElement>(null);
  const pending = JSON.stringify(history.histories[history.index]?.state.data) !== JSON.stringify(appState.data);
  const queued = useRef<Direction | null>(null);
  const current = useRef({ pending, history });
  current.current = { pending, history };
  const run = useCallback((direction: Direction): void => {
    const state = current.current;
    if (state.pending) {
      if (direction === 'back') queued.current = direction;
      return;
    }
    state.history[direction]();
  }, []);
  useEffect(() => {
    if (pending || !queued.current) return;
    const direction = queued.current;
    queued.current = null;
    run(direction);
  }, [pending, run]);
  useEffect(() => {
    const tools = ref.current;
    const win = tools?.ownerDocument.defaultView;
    const iframe = tools?.closest('.Puck')?.querySelector('iframe');
    if (!win) return;
    const onKey = (event: KeyboardEvent): void => {
      if (!current.current.pending || event.altKey || (!event.ctrlKey && !event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      run(key === 'y' || event.shiftKey ? 'forward' : 'back');
    };
    const bindFrame = (): void => iframe?.contentWindow?.addEventListener('keydown', onKey, true);
    win.addEventListener('keydown', onKey, true);
    iframe?.addEventListener('load', bindFrame);
    bindFrame();
    return () => {
      win.removeEventListener('keydown', onKey, true);
      iframe?.removeEventListener('load', bindFrame);
      iframe?.contentWindow?.removeEventListener('keydown', onKey, true);
    };
  }, [run]);
  return { ref, canUndo: history.hasPast || pending, canRedo: history.hasFuture && !pending, undo: () => run('back'), redo: () => run('forward') };
}
