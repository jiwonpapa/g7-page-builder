import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Puck, createUsePuck, type Config, type Data, type Overrides } from '@puckeditor/core';
import { Interactions } from './Interactions';
import { duplicateTail, type InputOwner } from './model';
import '@puckeditor/core/puck.css';
import './probe.css';

export type ProbeProps = { width: number; height: number; body: string };
export type ProbeConfig = Config<{ Box: ProbeProps }>;
export const useProbe = createUsePuck<ProbeConfig>();
type Workspace = { mode: InputOwner; readonly: boolean; session: string };
const WorkspaceContext = createContext<Workspace>({ mode: 'geometry', readonly: false, session: 'a:0' });

function TextBoundary({ children }: { children: React.ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = element.current;
    if (!target) return;
    const route = (event: KeyboardEvent) => {
      // Native bubbling at our OWN element precedes Puck's document hotkeys;
      // React's iframe portal delegation can run after those listeners.
      if (event.key === 'Delete' || event.key === 'Backspace' || event.isComposing) event.stopPropagation();
    };
    target.addEventListener('keydown', route);
    return () => target.removeEventListener('keydown', route);
  }, []);
  return <div ref={element} className="probe-text">{children}</div>;
}

const config: ProbeConfig = {
  components: {
    Box: {
      label: 'Proof box',
      fields: {
        width: { type: 'number' }, height: { type: 'number' },
        body: { type: 'richtext', contentEditable: true, visible: false },
      },
      defaultProps: { width: 240, height: 100, body: '<p>Editable text</p>' },
      render: ({ id, width, height, body }) => <article data-probe-node={id}
        style={{ width, height }}><TextBoundary>{body}</TextBoundary></article>,
    },
  },
  root: { render: ({ children }) => <section className="probe-canvas">{children}</section> },
};
function initialData(count: number): Data<{ Box: ProbeProps }> {
  return { root: {}, content: Array.from({ length: count }, (_, i) => ({
    type: 'Box', props: { id: `box-${i}`, width: 240, height: 100, body: `<p>Element ${i + 1}</p>` },
  })) };
}

function FrameContent({ children, document: frameDocument }: React.ComponentProps<NonNullable<Overrides<ProbeConfig>['iframe']>>) {
  const workspace = useContext(WorkspaceContext);
  return <>{children}{frameDocument && <Interactions ownerDocument={frameDocument} {...workspace} />}</>;
}

function Workspace({ workspace, setMode, setReadonly, switchDocument }: {
  workspace: Workspace; setMode: (mode: InputOwner) => void;
  setReadonly: (value: boolean) => void; switchDocument: () => void;
}) {
  const api = useProbe(state => state);
  const [zoom, setZoom] = useState(1);
  const [portalOpen, setPortalOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    api.dispatch({ type: 'setUi', ui: { previewMode: workspace.mode === 'geometry' ? 'interactive' : 'edit' }, recordHistory: false });
  }, [workspace.mode, api.dispatch]);
  useEffect(() => {
    // Puck 0.23.0 DnD inserts data, then explicitly records its selection UI.
    // Public API only: remove that duplicate data tail from the SAME history.
    const compact = duplicateTail(api.history.histories, api.history.index,
      (left, right) => Boolean(left.state.data && right.state.data)
        && JSON.stringify(left.state.data) === JSON.stringify(right.state.data));
    if (compact) api.history.setHistories(compact);
  }, [api.history.histories, api.history.index, api.history.setHistories]);
  const state = {
    session: workspace.session, mode: workspace.mode, readonly: workspace.readonly,
    previewMode: api.appState.ui.previewMode,
    history: api.history.index, hasPast: api.history.hasPast, hasFuture: api.history.hasFuture,
    nodes: api.appState.data.content.map(item => ({ ...item.props })),
  };
  return <div className="probe-workspace">
    <header>
      <div><strong>IP1 · Independent engine proof</strong><small>Technical fixture · no G7 / no persistence</small></div>
      <nav aria-label="Input owner">{(['structure', 'geometry', 'text'] as const).map(mode =>
        <button key={mode} aria-pressed={workspace.mode === mode} onClick={() => setMode(mode)}>{mode}</button>)}</nav>
      <button onClick={() => api.history.back()} disabled={!api.history.hasPast || workspace.readonly}>Undo</button>
      <button onClick={() => api.history.forward()} disabled={!api.history.hasFuture || workspace.readonly}>Redo</button>
      <label>Zoom <select aria-label="Zoom" value={zoom} onChange={event => setZoom(Number(event.target.value))}>
        {[0.5, 1, 2].map(value => <option key={value} value={value}>{value * 100}%</option>)}
      </select></label>
      <label><input type="checkbox" checked={workspace.readonly} onChange={event => setReadonly(event.target.checked)} />Readonly</label>
      <button onClick={switchDocument}>Switch document</button>
      <button onClick={() => setPortalOpen(!portalOpen)}>Portal control</button>
    </header>
    <div className="probe-body">
      <aside><h2>Structure</h2><Puck.Components /><Puck.Outline /><p>Only geometry mode owns handles and box selection. Text mode delegates editing to Puck/Tiptap.</p></aside>
      <div className="probe-scroll" data-testid="scroll">
        <div className="probe-scaled" style={{ transform: `scale(${zoom})`, width: 900, height: 850 }}>
          <Puck.Preview />
        </div>
      </div>
      <aside><h2>Observed state</h2><pre data-testid="state">{JSON.stringify(state, null, 2)}</pre></aside>
    </div>
    <div ref={host} className="probe-portal-host" />
    {portalOpen && host.current && createPortal(<div role="dialog" aria-label="Portal ownership" className="probe-dialog">
      <label>Portal text<input aria-label="Portal text" defaultValue="Select text, not nodes" /></label>
      <button onClick={() => setPortalOpen(false)}>Close portal</button>
    </div>, host.current)}
  </div>;
}

function App() {
  const count = Number(new URLSearchParams(location.search).get('nodes') ?? 3);
  const safeCount = [3, 100, 500].includes(count) ? count : 3;
  const [session, setSession] = useState(0);
  const [mode, setMode] = useState<InputOwner>('geometry');
  const [readonly, setReadonly] = useState(false);
  const data = useMemo(() => initialData(safeCount), [safeCount, session]);
  const workspace = { mode, readonly, session: `document-${session}` };
  return <WorkspaceContext.Provider value={workspace}>
    <Puck key={session} config={config} data={data}
      iframe={{ enabled: true, waitForStyles: true }}
      permissions={{ drag: mode !== 'geometry' && !readonly, edit: mode === 'text' && !readonly, insert: !readonly, delete: mode === 'structure' && !readonly }}
      overrides={{ iframe: FrameContent }}
      ui={{ viewports: { current: { width: '100%', height: 'auto' }, controlsVisible: false, options: [] } }}>
      <Workspace workspace={workspace} setMode={setMode} setReadonly={setReadonly}
        switchDocument={() => setSession(value => value + 1)} />
    </Puck>
  </WorkspaceContext.Provider>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing proof root');
createRoot(root).render(<App />);
