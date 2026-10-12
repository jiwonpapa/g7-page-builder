import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import type { DocumentV3 } from '../../documents/v3/types';
import { geometryCommand, geometryTargets, type GeometryBox, type GeometryOperation } from '../../documents/v3/geometry';
import { documentPresentation } from '../../documents/v3/presentation';
import { indexTree, selectionRoots } from '../../documents/v3/tree';
import { createGeometryGesture } from '../../editor-application/v3/gesture';
import type { PuckBridge } from '../../editor/v3/PuckBridge';
import type { InputMode } from '../../editor/v3/Workspace';
import { InputButton } from '../../editor/v3/TypedInput';
import { canvasTargets, measureTargets, ownsTextInput } from './measure';

export function GeometryAdapter({ owner, source, bridge, selected, mode, readonly, zoom, controls, pan, report }: {
  owner: Document; source: DocumentV3; bridge: PuckBridge; selected: string[]; mode: InputMode; readonly: boolean;
  zoom: number; controls: HTMLElement | null; pan: (x: number, y: number) => void; report: (message: string) => void;
}) {
  const [targets, setTargets] = useState<HTMLElement[]>([]);
  const [ratio, setRatio] = useState(false), [snap, setSnap] = useState(true);
  const moveable = useRef<Moveable>(null), selecto = useRef<Selecto>(null);
  const groupClick = useRef<string | null>(null);
  const before = useRef<{ boxes: GeometryBox[]; styles: Map<HTMLElement, string> } | null>(null);
  const transaction = useMemo(() => createGeometryGesture({
    read: () => ({ document: bridge.read(), context: bridge.context() }), execute: bridge.execute,
  }), [bridge]);
  const live = useRef({ source, selected, targets, mode, readonly, zoom, pan, report });
  live.current = { source, selected, targets, mode, readonly, zoom, pan, report };
  const restore = () => {
    before.current?.styles.forEach((style, element) => element.setAttribute('style', style));
    before.current = null;
    moveable.current?.updateRect();
  };
  const cancel = () => { transaction.cancel(); restore(); moveable.current?.stopDrag(); };
  const run = (action: () => void) => {
    try { action(); } catch (error) {
      cancel(); live.current.report(error instanceof Error ? error.message : '조작을 적용하지 못했습니다.');
    }
  };
  const begin = () => {
    const boxes = measureTargets(live.current.targets);
    transaction.begin(live.current.selected, boxes);
    before.current = { boxes, styles: new Map(live.current.targets.map(element => [element, element.getAttribute('style') ?? ''])) };
  };
  const preview = (operation: GeometryOperation) => run(() => {
    if (!before.current || !transaction.active()) return;
    const result = transaction.preview(geometryCommand(bridge.read(), live.current.selected, before.current.boxes, operation));
    const styles = documentPresentation(result.document);
    for (const element of live.current.targets) {
      const declarations = styles.get(element.dataset.v3Node ?? '');
      if (declarations) element.setAttribute('style', Object.entries(declarations).map(([key, value]) => key + ':' + value).join(';'));
    }
    if (operation.kind === 'resize') {
      const tree = indexTree(result.document);
      for (const box of measureTargets(live.current.targets)) {
        const style = tree.get(box.id)!.node.style;
        for (const key of ['width', 'height'] as const) {
          const value = style[key];
          if (typeof value === 'object' && value.unit === 'px' && Math.abs(box[key] - value.value) > 1) {
            throw Error('geometry_constraint: ' + box.id + ':' + key);
          }
        }
      }
    }
  });
  const finish = () => run(() => {
    if (!transaction.active()) return;
    restore(); transaction.finish();
  });
  const execute = (operation: GeometryOperation) => run(() => {
    cancel();
    bridge.execute(geometryCommand(bridge.read(), bridge.selection(), measureTargets(canvasTargets(owner, bridge.read(), bridge.selection())), operation));
  });
  useEffect(() => {
    const frame = owner.defaultView?.frameElement;
    const original = frame?.getAttribute('title');
    frame?.setAttribute('title', '페이지 디자인 캔버스');
    return () => {
      if (original === null) frame?.removeAttribute('title');
      else if (original !== undefined) frame?.setAttribute('title', original);
    };
  }, [owner]);
  useEffect(() => {
    cancel();
    const elements = canvasTargets(owner, source, selected);
    setTargets(elements);
    selecto.current?.setSelectedTargets(elements);
  }, [source, selected, mode, readonly, owner, zoom]);
  useEffect(() => { moveable.current?.updateRect(); }, [targets]);
  useEffect(() => {
    const refresh = () => {
      const elements = canvasTargets(owner, bridge.read(), bridge.selection());
      setTargets(current => current.length === elements.length && current.every((element, index) => element === elements[index]) ? current : elements);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(owner.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [owner, bridge]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target;
      if (target && 'closest' in target && typeof target.closest === 'function' && target.closest('a')) event.preventDefault();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cancel(); return; }
      const state = live.current;
      if (state.mode !== 'geometry' || state.readonly || event.isComposing || ownsTextInput(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); event.stopImmediatePropagation();
        bridge.selectMany([...indexTree(bridge.read()).keys()]); return;
      }
      if (!state.selected.length || event.ctrlKey || event.metaKey || event.altKey) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete', 'Backspace'].includes(event.key)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.repeat) return;
        run(() => {
          if (event.key === 'Delete' || event.key === 'Backspace') { bridge.execute({ kind: 'delete', ids: state.selected }); return; }
          const roots = selectionRoots(indexTree(bridge.read()), state.selected);
          if (roots.every(item => item.node.style.position === 'absolute')) {
            const step = event.shiftKey ? 10 : 1;
            execute({ kind: 'translate', x: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
              y: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 });
          } else {
            const first = roots[0], last = roots.at(-1)!;
            const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
            if (roots.some(item => item.parent !== first.parent)) throw Error('mixed_parents');
            bridge.execute({ kind: 'move', ids: state.selected, destination: { parentId: first.parent?.instance_id ?? null,
              index: backwards ? Math.max(0, first.index - 1) : Math.min(first.siblings.length, last.index + 2) } });
          }
        });
      }
    };
    const blur = () => cancel();
    const scroll = () => moveable.current?.updateRect();
    owner.addEventListener('click', click, true);
    owner.addEventListener('keydown', key, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('focusin', blur, true);
    owner.addEventListener('pointercancel', blur, true);
    owner.addEventListener('scroll', scroll, true);
    window.addEventListener('blur', blur);
    // Iframe focus changes to host Inspector controls must abandon a pending gesture too.
    owner.defaultView?.addEventListener('blur', blur);
    return () => {
      cancel(); owner.removeEventListener('click', click, true);
      owner.removeEventListener('keydown', key, true); document.removeEventListener('keydown', key, true);
      document.removeEventListener('focusin', blur, true);
      owner.removeEventListener('pointercancel', blur, true); owner.removeEventListener('scroll', scroll, true);
      window.removeEventListener('blur', blur); owner.defaultView?.removeEventListener('blur', blur);
    };
  }, [owner, bridge]);
  useEffect(() => {
    let position: { x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      if (live.current.mode !== 'pan' || event.button !== 0 || ownsTextInput(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation(); cancel();
      position = { x: event.screenX, y: event.screenY };
    };
    const move = (event: PointerEvent) => {
      if (!position) return;
      if (!event.buttons) { position = null; return; }
      // Screen CSS coordinates do not shift when scrolling the iframe's host.
      live.current.pan(position.x - event.screenX, position.y - event.screenY);
      position = { x: event.screenX, y: event.screenY };
      event.preventDefault();
    };
    const up = () => { position = null; };
    owner.addEventListener('pointerdown', down, true); owner.addEventListener('pointermove', move, true);
    owner.addEventListener('pointerup', up, true); owner.addEventListener('pointercancel', up, true);
    document.addEventListener('pointerup', up, true); window.addEventListener('blur', up);
    return () => {
      owner.removeEventListener('pointerdown', down, true); owner.removeEventListener('pointermove', move, true);
      owner.removeEventListener('pointerup', up, true); owner.removeEventListener('pointercancel', up, true);
      document.removeEventListener('pointerup', up, true); window.removeEventListener('blur', up);
    };
  }, [owner, mode]);
  let allowed = false, absolute = false;
  try {
    const items = geometryTargets(source, selected, measureTargets(targets));
    allowed = !readonly && mode === 'geometry' && items.length === targets.length;
    absolute = items.every(({ item }) => item.node.style.position === 'absolute' && item.parent === items[0].item.parent);
  } catch { /* Hidden/locked/empty selection remains selectable, but never receives writable handles. */ }
  const guides = Array.from(owner.querySelectorAll<HTMLElement>('[data-v3-node]')).filter(element =>
    !targets.some(target => target === element || target.contains(element) || element.contains(target)));
  const tools = controls && mode === 'geometry' ? createPortal(<section aria-label="정밀 조작 도구">
    <p>공통값 · 직접 조작은 CSS px로 확정합니다. Esc로 취소합니다.</p>
    <label><input type="checkbox" checked={ratio} onChange={event => { cancel(); setRatio(event.target.checked); }} />비율 잠금</label>
    <label><input type="checkbox" checked={snap} onChange={event => { cancel(); setSnap(event.target.checked); }} />스냅 가이드</label>
    <p>화살표: 흐름 순서 또는 좌표 1px · Shift: 10px</p>
    <fieldset disabled={!allowed || !absolute} style={{ border: 0, padding: 0 }}>
      {(['x', 'y'] as const).map(axis => <div key={axis}>
        {(['start', 'center', 'end'] as const).map((edge, i) => <InputButton key={edge}
          onClick={() => execute({ kind: 'align', axis, edge })}>{(axis === 'x' ? ['왼쪽', '가로 가운데', '오른쪽'] : ['위쪽', '세로 가운데', '아래쪽'])[i]} 정렬</InputButton>)}
        <InputButton disabled={targets.length < 3} onClick={() => execute({ kind: 'distribute', axis })}>{axis === 'x' ? '가로' : '세로'} 간격 균등</InputButton>
      </div>)}
      <InputButton onClick={() => execute({ kind: 'rotate', degrees: -15 })}>반시계 15도</InputButton>
      <InputButton onClick={() => execute({ kind: 'rotate', degrees: 15 })}>시계 15도</InputButton>
    </fieldset>
    {!absolute && <p>좌표 이동·회전·정렬은 같은 부모의 absolute 요소에서 사용합니다.</p>}
  </section>, controls) : null;
  return <>{tools}
    {mode === 'geometry' && <Selecto ref={selecto} container={owner.body} dragContainer={owner.body}
      selectableTargets={[() => Array.from(owner.querySelectorAll<HTMLElement>('[data-v3-node]'))]}
      selectByClick selectFromInside hitRate={100} preventDefault toggleContinueSelect={['shift']}
      onDragStart={event => {
        const element: Element = event.inputEvent.target;
        if (element.closest('.moveable-control-box') || ownsTextInput(element) || transaction.active()) event.stop();
        else if (allowed && absolute && targets.length > 1 && !event.inputEvent.shiftKey
          && targets.some(target => target === element || target.contains(element))) {
          event.stop(); moveable.current?.dragStart(event.inputEvent);
        }
      }}
      onSelectEnd={event => {
        const inputTarget: Element = event.inputEvent.target;
        if (inputTarget.closest('.moveable-control-box')) return;
        if (event.isClick || event.isDragStartEnd) {
          const target: Element = event.inputEvent.target;
          const id = target.closest<HTMLElement>('[data-v3-node]')?.dataset.v3Node;
          if (id) bridge.selectMany(event.inputEvent.shiftKey
            ? bridge.selection().includes(id) ? bridge.selection().filter(value => value !== id) : [...bridge.selection(), id] : [id]);
          else if (!event.inputEvent.shiftKey) bridge.selectMany([]);
        } else bridge.selectMany(event.selected.flatMap(element => element.getAttribute('data-v3-node') ?? []));
      }} />}
    {allowed && <Moveable ref={moveable} container={owner.body} rootContainer={owner.body} target={targets.length === 1 ? targets[0] : targets}
      origin={false} resizable renderDirections={['e', 's', 'se']} keepRatio={ratio} checkInput useResizeObserver useMutationObserver passDragArea
      draggable={absolute} rotatable={absolute && targets.length === 1} throttleResize={.001} throttleRotate={1}
      snappable={snap} elementGuidelines={guides} snapDirections={{ left: true, right: true, top: true, bottom: true, center: true, middle: true }}
      elementSnapDirections={{ left: true, right: true, top: true, bottom: true, center: true, middle: true }}
      snapThreshold={5} snapRotationDegrees={[0, 45, 90, 135, 180, 225, 270, 315]} snapRotationThreshold={5}
      onResizeStart={() => run(begin)}
      onResize={event => preview({ kind: 'resize', width: event.width, height: event.height, keepRatio: ratio })}
      onResizeEnd={finish}
      onResizeGroupStart={() => run(begin)}
      onResizeGroup={event => {
        const first = event.events[0];
        if (first) preview({ kind: 'resize', width: first.width, height: first.height, keepRatio: ratio });
      }}
      onResizeGroupEnd={finish}
      onDragStart={event => { event.set([0, 0]); run(begin); }}
      onDrag={event => preview({ kind: 'translate', x: event.beforeDist[0], y: event.beforeDist[1] })}
      onDragEnd={finish}
      onDragGroupStart={event => {
        const element: Element = event.inputEvent.target;
        groupClick.current = element.closest<HTMLElement>('[data-v3-node]')?.dataset.v3Node ?? null;
        event.events.forEach(item => item.set([0, 0])); run(begin);
      }}
      onDragGroup={event => preview({ kind: 'translate', x: event.beforeDist[0], y: event.beforeDist[1] })}
      onDragGroupEnd={event => {
        finish();
        if (!event.isDrag && groupClick.current) bridge.selectMany([groupClick.current]);
        groupClick.current = null;
      }}
      onRotateStart={event => { event.set(indexTree(source).get(targets[0].dataset.v3Node ?? '')?.node.style.rotation ?? 0); run(begin); }}
      onRotate={event => preview({ kind: 'rotate', degrees: event.beforeDist })}
      onRotateEnd={finish}
    />}
  </>;
}
