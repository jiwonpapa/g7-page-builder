import React, { useEffect } from 'react';
import { Hand, Maximize2, MousePointer2, Move, Type } from 'lucide-react';
import { useV3Puck, type PuckBridge } from './PuckBridge';

export type InputMode = 'structure' | 'geometry' | 'text' | 'pan';
/** Measure only our authored surface through Puck's public iframe override. */
export function WorkspaceFrame({ owner, extent }: { owner: Document; extent: (height: number) => void }) {
  useEffect(() => {
    const view = owner.defaultView, frame = view?.frameElement;
    if (!view || !frame || !('style' in frame) || !(frame instanceof HTMLIFrameElement)) return;
    const previous = frame.style.height;
    // Puck mirrors the host body class and stylesheet into this owned frame.
    // Its editor chrome must not paint over the authored workspace underneath.
    // The workbench scrolls the full measured surface. A second vertical frame
    // scrollbar would silently shrink the authored responsive viewport by 15px.
    const chrome = [owner.documentElement, owner.body].flatMap(element =>
      ([['background-color', 'transparent'], ['overflow-y', 'clip']] as const).map(([property, applied]) => ({
        element, property, applied, value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property) })));
    for (const { element, property, applied } of chrome) element.style.setProperty(property, applied);
    let surface: HTMLElement | null = null;
    let pending: number | undefined;
    const measure = () => {
      if (!surface) return;
      const height = Math.ceil(Math.max(800, surface.scrollHeight, surface.getBoundingClientRect().height));
      frame.style.height = height + 'px'; extent(height);
    };
    const schedule = () => {
      if (pending !== undefined) return;
      pending = view.requestAnimationFrame(() => { pending = undefined; measure(); });
    };
    const resize = new ResizeObserver(schedule);
    const discover = () => {
      const next = owner.querySelector<HTMLElement>('[data-v3-surface]');
      if (surface !== next) { resize.disconnect(); surface = next; if (surface) resize.observe(surface); }
      measure();
    };
    const mutations = new MutationObserver(records => {
      if (!surface || !surface.isConnected) { discover(); return; }
      if (records.some(record => surface?.contains(record.target))) schedule();
    });
    mutations.observe(owner.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden'] }); discover();
    return () => {
      if (pending !== undefined) view.cancelAnimationFrame(pending);
      mutations.disconnect(); resize.disconnect(); frame.style.height = previous;
      for (const { element, property, applied, value, priority } of chrome) {
        if (element.style.getPropertyValue(property) !== applied) continue;
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      }
    };
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
  const icons = [MousePointer2, Move, Type, Hand];
  return <nav aria-label="작업면 조작" className="g7pb-v3-workspace-controls">
    <div className="g7pb-v3-segmented">
    {(['structure', 'geometry', 'text', 'pan'] as const).map((value, i) =>
      <button key={value} type="button" className="g7pb-button g7pb-button--quiet" aria-pressed={mode === value}
        disabled={disabled && value !== 'pan'} onClick={() => change(value)}>{React.createElement(icons[i], { size: 16, 'aria-hidden': true })}<span>{['구조 선택', '정밀 조작', '본문 입력', '화면 이동'][i]}</span></button>)}
    </div>
    <label className="g7pb-v3-zoom"><span className="g7pb-v3-sr-only">확대</span><select aria-label="작업면 확대" value={zoom} onChange={event => setZoom(Number(event.target.value))}>
      {Array.from(new Set([.5, 1, 2, zoom])).sort((a, b) => a - b).map(value => <option key={value} value={value}>{Math.round(value * 100)}%</option>)}
    </select></label>
    <button type="button" className="g7pb-button g7pb-button--quiet" title="화면 맞춤" onClick={fit}><Maximize2 size={15} aria-hidden /><span className="g7pb-v3-sr-only">화면 맞춤</span></button>
  </nav>;
}
