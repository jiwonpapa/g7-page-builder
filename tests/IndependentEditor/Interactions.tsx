import React, { useEffect, useRef, useState } from 'react';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import { useProbe } from './main';
import { beginGesture, completeGesture, nodeKeyboardAllowed, type Box, type Gesture, type InputOwner } from './model';

export function Interactions({ ownerDocument, mode, readonly, session }: {
  ownerDocument: Document; mode: InputOwner; readonly: boolean; session: string;
}) {
  const api = useProbe(state => state);
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const moveable = useRef<Moveable>(null);
  const revision = useRef(0);
  const previous = useRef(api.appState.data);
  if (previous.current !== api.appState.data) { revision.current += 1; previous.current = api.appState.data; }
  const context = { session, readonly, revision: revision.current };
  const current = useRef({ api, context });
  current.current = { api, context };
  const dimensions = (elements: HTMLElement[]): Box[] => elements.map(element => ({
    id: element.dataset.probeNode ?? '', width: Number.parseFloat(element.style.width), height: Number.parseFloat(element.style.height),
  }));
  const restore = () => {
    gesture.current?.before.forEach(box => {
      const target = targets.find(element => element.dataset.probeNode === box.id);
      if (target) { target.style.width = `${box.width}px`; target.style.height = `${box.height}px`; }
    });
    gesture.current = null;
    moveable.current?.updateRect();
  };
  const commit = () => {
    const result = completeGesture(gesture.current, current.current.context, dimensions(targets));
    if (!result) { restore(); return; }
    gesture.current = null;
    const byId = new Map(result.map(box => [box.id, box]));
    // One public Puck dispatch for the entire gesture/group. Puck owns Undo.
    current.current.api.dispatch({ type: 'setData', recordHistory: true, data: {
      ...current.current.api.appState.data,
      content: current.current.api.appState.data.content.map(item => {
        const box = byId.get(item.props.id);
        return box ? { ...item, props: { ...item.props, width: box.width, height: box.height } } : item;
      }),
    } });
  };
  useEffect(() => { restore(); setSelectedIds([]); setTargets([]); }, [mode, readonly, session]);
  useEffect(() => {
    // Puck may replace preview DOM on Undo or a mode transition. Selection is
    // IDs, never stale DOM references; Moveable receives current owned nodes.
    const nodes = new Map(Array.from(ownerDocument.querySelectorAll<HTMLElement>('[data-probe-node]'))
      .map(element => [element.dataset.probeNode, element]));
    setTargets(selectedIds.flatMap(id => { const element = nodes.get(id); return element ? [element] : []; }));
  }, [selectedIds, api.appState.data, ownerDocument]);
  useEffect(() => { moveable.current?.updateRect(); }, [api.appState.data, targets]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { restore(); return; }
      const element = event.target;
      // Cross-realm DOM: avoid host instanceof HTMLElement on iframe nodes.
      const editable = element !== null && 'nodeType' in element && element.nodeType === 1
        && typeof (element as Element).closest === 'function'
        && Boolean((element as Element).closest('input,textarea,select,[contenteditable="true"]'));
      if (!nodeKeyboardAllowed(mode, event.isComposing, editable, readonly)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelectedIds(Array.from(ownerDocument.querySelectorAll<HTMLElement>('[data-probe-node]'))
          .flatMap(element => element.dataset.probeNode ? [element.dataset.probeNode] : []));
      }
    };
    ownerDocument.addEventListener('keydown', cancel, true);
    document.addEventListener('keydown', cancel, true);
    const scroll = () => moveable.current?.updateRect();
    ownerDocument.addEventListener('scroll', scroll, true);
    return () => {
      ownerDocument.removeEventListener('keydown', cancel, true);
      document.removeEventListener('keydown', cancel, true);
      ownerDocument.removeEventListener('scroll', scroll, true);
    };
  }, [mode, readonly, targets]);
  if (mode !== 'geometry' || readonly) return null;
  return <>
    <output className="probe-selection" data-testid="selection">{targets.length} selected</output>
    <Selecto container={ownerDocument.body} dragContainer={ownerDocument.body}
      selectableTargets={[() => Array.from(ownerDocument.querySelectorAll<HTMLElement>('[data-probe-node]'))]}
      selectByClick hitRate={0} preventDefault
      selectFromInside={false} toggleContinueSelect={['shift']}
      onDragStart={event => {
        const element: Element = event.inputEvent.target;
        if (element.closest('.moveable-control-box,input,textarea,[contenteditable="true"]')) event.stop();
      }}
      onSelect={event => setSelectedIds(event.selected.flatMap(element => {
        const id = element.getAttribute('data-probe-node'); return id ? [id] : [];
      }))}
    />
    <Moveable ref={moveable} container={ownerDocument.body} rootContainer={ownerDocument.body}
      target={targets} resizable renderDirections={['e', 's', 'se']} origin={false}
      onResizeStart={() => { gesture.current = beginGesture(current.current.context, dimensions(targets)); }}
      onResize={event => { if (gesture.current) { event.target.style.width = `${event.width}px`; event.target.style.height = `${event.height}px`; } }}
      onResizeEnd={commit}
      onResizeGroupStart={() => { gesture.current = beginGesture(current.current.context, dimensions(targets)); }}
      onResizeGroup={event => event.events.forEach(item => {
        if (gesture.current) { item.target.style.width = `${item.width}px`; item.target.style.height = `${item.height}px`; }
      })}
      onResizeGroupEnd={commit}
    />
  </>;
}
