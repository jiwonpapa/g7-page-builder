import { usePuck, type Config, type PuckAction } from '@puckeditor/core';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { PageBuilderDocument } from '../documents/types';
import { assessEditorCandidate, historyAfterRejectedCommand, sameEditorData, type EditorCandidate } from './editorDocumentBoundary';
import type { PuckAdapterContext, PuckEditorSession } from './puckDocumentAdapter';
import type { EditorComponents, PuckEditorData } from './puckEditorTypes';
import type { PageDesignProps } from './pageDesignTokens';

type EditorApi = ReturnType<typeof usePuck<Config<EditorComponents, PageDesignProps>>>;
type EditorState = EditorApi['appState'];
// Public Puck dispatch defaults its root type to {title}; preserve all named
// page-design read-only flags through a compatible dictionary at that boundary.
function restoreAction(state: EditorState, recordHistory: boolean): PuckAction {
  const readOnly: Record<string, boolean | undefined> | undefined = state.data.root.readOnly;
  return { type: 'set', recordHistory, state: {
    data: { ...state.data, root: { ...state.data.root, readOnly } }, ui: state.ui,
  } };
}

interface Recovery {
  state: EditorState;
  histories: EditorApi['history']['histories'];
  index: number;
}
interface BoundaryOptions {
  canEdit: boolean;
  context: React.RefObject<PuckAdapterContext>;
  onDirty?: () => void;
  onChange: (document: PageBuilderDocument) => void;
}

export function usePuckDocumentBoundary(initial: PuckEditorSession, options: BoundaryOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [data, setData] = useState(initial.data);
  const [message, setMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const boundary = useMemo(() => {
    let api: EditorApi | null = null;
    let acceptedData = initial.data;
    let previousState: EditorState | null = null;
    let prepared: { data: PuckEditorData; result: EditorCandidate } | null = null;
    let recovery: Recovery | null = null;
    let repairing = false;
    let mounted = true;

    const assess = (candidate: PuckEditorData): EditorCandidate => {
      const current = optionsRef.current;
      return assessEditorCandidate(candidate, acceptedData, current.context.current, current.canEdit && !recovery);
    };
    const restore = (): void => {
      if (!mounted || !api || !recovery) return;
      repairing = true;
      try {
        // A public recorded restore replaces the vendor's pending invalid record.
        // Once recorded, finishRecovery removes only this repair's duplicate.
        api.dispatch(restoreAction(recovery.state, true));
      } finally { repairing = false; }
    };
    const reject = (error: string): void => {
      setMessage(error);
      if (!api) return;
      if (!recovery) {
        recovery = {
          state: { data: acceptedData, ui: { ...(previousState?.ui ?? api.appState.ui), isDragging: false } },
          histories: api.history.histories, index: api.history.index,
        };
        setRecovering(true);
      }
      queueMicrotask(restore);
    };
    const accept = (candidate: PuckEditorData): PageBuilderDocument | null => {
      if (repairing) return null;
      const result = prepared?.data === candidate ? prepared.result : assess(candidate);
      prepared = null;
      if (!result.accepted) { reject(result.message); return null; }
      acceptedData = candidate;
      setData(candidate);
      if (result.changed) {
        setMessage(null);
        optionsRef.current.onDirty?.();
        optionsRef.current.onChange(result.document);
      }
      return result.document;
    };
    return {
      currentData: () => acceptedData,
      onChange: (candidate: PuckEditorData): void => { accept(candidate); },
      acceptForPublish: accept,
      onAction: (_action: PuckAction, candidate: EditorState, before: EditorState): void => {
        if (repairing) return;
        previousState = before;
        // Selection/hover-only actions cannot change the canonical document.
        prepared = candidate.data === before.data ? null : { data: candidate.data, result: assess(candidate.data) };
      },
      connect: (current: EditorApi): void => {
        if (!api) {
          // Puck adds an empty zones map before its first onChange. Keep that
          // equivalent initial representation so history comparison is exact.
          const normalized = assess(current.appState.data);
          if (normalized.accepted && !normalized.changed) acceptedData = current.appState.data;
        }
        api = current;
      },
      finishRecovery: (): void => {
        if (!api || !recovery || repairing || api.history.histories === recovery.histories) return;
        const recorded = api.history.histories[api.history.index];
        if (!recorded || !sameEditorData(recorded.state.data, recovery.state.data)) return;
        const plan = historyAfterRejectedCommand(recovery.histories, recovery.index, recorded);
        repairing = true;
        try {
          // These public APIs retain every pre-existing valid past/future entry.
          api.history.setHistories(plan.histories);
          if (plan.index !== plan.histories.length - 1) api.history.setHistoryIndex(plan.index);
          api.dispatch(restoreAction(recovery.state, false));
          previousState = recovery.state;
          recovery = null;
          setRecovering(false);
        } finally { repairing = false; }
      },
      activate: (): void => { mounted = true; },
      dispose: (): void => { mounted = false; api = null; },
    };
  }, [initial]);
  useEffect(() => {
    boundary.activate();
    setData(initial.data);
    setMessage(null);
    setRecovering(false);
    return boundary.dispose;
  }, [boundary, initial]);
  return { boundary, data, message, recovering };
}

export function PuckDocumentBoundary({ boundary }: { boundary: ReturnType<typeof usePuckDocumentBoundary>['boundary'] }): React.ReactElement | null {
  const api = usePuck<Config<EditorComponents, PageDesignProps>>();
  boundary.connect(api);
  useEffect(() => { boundary.finishRecovery(); }, [boundary, api.history.histories, api.history.index]);
  return null;
}
