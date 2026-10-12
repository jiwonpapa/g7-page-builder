import { createUsePuck, type Config, type PuckAction, type UsePuckData } from '@puckeditor/core';
import { useEffect, useRef } from 'react';
import type { DocumentV3 } from '../../documents/v3/types';
import { indexTree, cloneDocument } from '../../documents/v3/tree';
import { reject } from '../../documents/v3/schema';
import { createStructureSession, type EditContext, type DraftPort } from '../../editor-application/v3/session';
import type { DocumentCommand } from '../../documents/v3/designCommands';
import { assessPuckEdit, documentFromPuck, documentToPuck, sameDocument, type V3Components, type V3Root } from './codec';

export type V3Config = Config<V3Components, V3Root>;
type Api = UsePuckData<V3Config>;
type State = Api['appState'];
export const useV3Puck = createUsePuck<V3Config>();

export function createPuckBridge(initial: DocumentV3, options: {
  context: () => { sessionId: string; readonly: boolean };
  nextId: () => string;
  changed: (document: DocumentV3) => void;
  selected: (ids: string[]) => void;
  error: (message: string) => void;
}) {
  let document = cloneDocument(initial);
  let revision = 0;
  let api: Api | null = null;
  let pending: DocumentV3 | null = null;
  let accepted: DocumentV3 | null = null;
  let undoTarget: DocumentV3 | null = null;
  let selection: string[] = [];
  let recovery: { state: State; histories: Api['history']['histories']; index: number } | null = null;
  let repairing = false;
  let disposed = false;
  let interactionOwnsSelection = false;
  const context = (): EditContext => ({ documentId: document.document_id, ...options.context(), revision,
    readonly: disposed || options.context().readonly });
  function select(ids: string[], reflect = true): void {
    selection = ids.filter(id => indexTree(document).has(id));
    options.selected(selection);
    if (api && reflect) api.dispatch({ type: 'setUi', ui: { itemSelector: selection.length ? api.getSelectorForId(selection.at(-1)!) ?? null : null }, recordHistory: false });
  }
  const session = createStructureSession({
    read: () => ({ document, context: context() }),
    commit: result => {
      if (!api || recovery) reject('editor_not_ready', '$');
      pending = result.document;
      api.dispatch({ type: 'setData', data: documentToPuck(result.document), recordHistory: true });
      select(result.selection);
    },
  }, options.nextId);
  function fail(error: unknown, previous?: State): void {
    options.error(error instanceof Error ? error.message : '구조 변경을 적용하지 못했습니다.');
    if (!api || recovery) return;
    recovery = { state: { data: documentToPuck(document), ui: previous?.ui ?? api.appState.ui },
      histories: api.history.histories, index: api.history.index };
    queueMicrotask(() => {
      if (!api || !recovery) return;
      repairing = true;
      api.dispatch({ type: 'set', state: recovery.state, recordHistory: true });
      repairing = false;
    });
  }
  return {
    read: () => document,
    context,
    connect(current: Api) { api = current; disposed = false; },
    disconnect() { api = null; pending = null; disposed = true; },
    select(id: string, extend = false) { select(extend ? selection.includes(id) ? selection.filter(value => value !== id) : [...selection, id] : [id]); },
    selectMany(ids: string[]) { select([...new Set(ids)], !interactionOwnsSelection); },
    selection: () => [...selection],
    interactionOwner(value: boolean) { interactionOwnsSelection = value; },
    execute(command: DocumentCommand, expected: EditContext = context()) {
      if (!api || recovery) reject('editor_not_ready', '$');
      return session.execute(command, expected);
    },
    copy: () => session.copy(selection, context()),
    save: (port: DraftPort, serverRevision: number) => session.save(port, context(), serverRevision),
    history(direction: 'back' | 'forward') {
      if (!api || recovery || context().readonly) return;
      if (direction === 'back' ? !api.history.hasPast : !api.history.hasFuture) return;
      undoTarget = documentFromPuck(api.history.histories[api.history.index + (direction === 'back' ? -1 : 1)]?.state.data);
      api.history[direction]();
    },
    onAction(action: PuckAction, candidate: State, previous: State) {
      if (repairing || recovery || candidate.data === previous.data) return;
      try {
        const decoded = documentFromPuck(candidate.data);
        if (sameDocument(decoded, document)) return;
        if (context().readonly) reject('readonly', '$');
        accepted = undoTarget && sameDocument(decoded, undoTarget) ? undoTarget
          : pending && sameDocument(decoded, pending) ? pending
          : assessPuckEdit(document, candidate.data, action);
      } catch (error) { accepted = null; fail(error, previous); }
    },
    onChange(data: State['data']) {
      if (repairing || recovery) return;
      try {
        const candidate = documentFromPuck(data);
        if (sameDocument(candidate, document)) return;
        if (context().readonly) reject('readonly', '$');
        if (![undoTarget, pending, accepted].some(value => value && sameDocument(value, candidate))) reject('unapproved_change', '$');
        document = candidate;
        revision++;
        pending = null; accepted = null; undoTarget = null;
        options.changed(document);
        select(selection, false);
      } catch (error) { fail(error); }
    },
    sync() {
      if (!api) return;
      if (recovery) {
        if (api.history.histories === recovery.histories) return;
        const saved = recovery;
        repairing = true;
        api.history.setHistories(saved.histories);
        api.history.setHistoryIndex(saved.index);
        api.dispatch({ type: 'set', state: saved.state, recordHistory: false });
        recovery = null; pending = null; accepted = null; undoTarget = null; repairing = false;
        return;
      }
      const id = api.selectedItem?.props.id;
      if (!interactionOwnsSelection && id && !selection.includes(id)) select([id], false);
    },
  };
}
export type PuckBridge = ReturnType<typeof createPuckBridge>;
/** Rich text shares Puck history. Inspector inputs and active IME retain their input keys. */
export function FrameHistoryBoundary({ frameDocument, bridge }: { frameDocument: Document; bridge: PuckBridge }) {
  useEffect(() => {
    const route = (event: KeyboardEvent) => {
      const target = event.target;
      const input = target && 'closest' in target && typeof target.closest === 'function'
        && target.closest('input,textarea,select');
      if (input || event.isComposing || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault(); event.stopImmediatePropagation();
      bridge.history(event.shiftKey ? 'forward' : 'back');
    };
    frameDocument.addEventListener('keydown', route, true);
    return () => frameDocument.removeEventListener('keydown', route, true);
  }, [frameDocument, bridge]);
  return null;
}
export function BridgeObserver({ bridge }: { bridge: PuckBridge }) {
  const api = useV3Puck(state => state);
  const currentApi = useRef(api); currentApi.current = api;
  bridge.connect(api);
  useEffect(() => { bridge.sync(); }, [bridge, api]);
  useEffect(() => { bridge.connect(currentApi.current); return () => bridge.disconnect(); }, [bridge]);
  return null;
}
