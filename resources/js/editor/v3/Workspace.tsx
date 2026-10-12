import React, { useEffect } from 'react';
import { useV3Puck, type PuckBridge } from './PuckBridge';

export type InputMode = 'structure' | 'geometry' | 'text' | 'pan';
/** Measure only our authored surface through Puck's public iframe override. */
export function WorkspaceFrame({ owner, extent }: { owner: Document; extent: (height: number) => void }) {
  useEffect(() => {
    const frame = owner.defaultView?.frameElement;
    if (!frame || !('style' in frame) || !(frame instanceof HTMLIFrameElement)) return;
    const previous = frame.style.height;
    let surface: HTMLElement | null = null;
    const measure = () => {
      if (!surface) return;
      const height = Math.ceil(Math.max(800, surface.scrollHeight, surface.getBoundingClientRect().height));
      frame.style.height = height + 'px'; extent(height);
    };
    const resize = new ResizeObserver(measure);
    const discover = () => {
      const next = owner.querySelector<HTMLElement>('[data-v3-surface]');
      if (surface !== next) { resize.disconnect(); surface = next; if (surface) resize.observe(surface); }
      measure();
    };
    const mutations = new MutationObserver(discover);
    mutations.observe(owner.body, { childList: true, subtree: true }); discover();
    return () => { mutations.disconnect(); resize.disconnect(); frame.style.height = previous; };
  }, [owner, extent]);
  return null;
}
/** Public Puck preview mode relinquishes structure DnD while the interaction adapter owns input. */
export function WorkspaceMode({ mode, bridge }: { mode: InputMode; bridge: PuckBridge }) {
  const dispatch = useV3Puck(state => state.dispatch);
  const previewMode = useV3Puck(state => state.appState.ui.previewMode);
  bridge.interactionOwner(mode === 'geometry' || mode === 'pan');
  useEffect(() => {
    const interaction = mode === 'geometry' || mode === 'pan';
    const expected = interaction ? 'interactive' : 'edit';
    if (previewMode !== expected) dispatch({ type: 'setUi', ui: { previewMode: expected }, recordHistory: false });
  }, [mode, bridge, dispatch, previewMode]);
  return null;
}
export function WorkspaceControls({ mode, change, zoom, setZoom, fit, disabled }: {
  mode: InputMode; change: (mode: InputMode) => void; zoom: number; setZoom: (zoom: number) => void;
  fit: () => void; disabled: boolean;
}) {
  return <nav aria-label="작업면 조작" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
    {(['structure', 'geometry', 'text', 'pan'] as const).map((value, i) =>
      <button key={value} type="button" className="g7pb-button g7pb-button--quiet" aria-pressed={mode === value}
        disabled={disabled && value !== 'pan'} onClick={() => change(value)}>{['구조 선택', '정밀 조작', '본문 입력', '화면 이동'][i]}</button>)}
    <label>확대<select aria-label="작업면 확대" value={zoom} onChange={event => setZoom(Number(event.target.value))}>
      {Array.from(new Set([.5, 1, 2, zoom])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
    </select></label>
    <button type="button" className="g7pb-button g7pb-button--quiet" onClick={fit}>화면 맞춤</button>
  </nav>;
}
