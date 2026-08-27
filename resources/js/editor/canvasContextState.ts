import type { CanvasElementRole, CanvasElementSelection } from './canvasEditingContract';

type SelectionForRole<Role extends CanvasElementRole> = CanvasElementSelection & { role: Role };

export type CanvasContextTarget =
  | { kind: 'none'; selection: null }
  | { kind: 'block'; selection: SelectionForRole<'block'> }
  | { kind: 'text-element'; selection: SelectionForRole<'text'> }
  | { kind: 'text-range'; selection: SelectionForRole<'text'> }
  | { kind: 'media'; selection: SelectionForRole<'media'> }
  | { kind: 'action'; selection: SelectionForRole<'action'> };

export interface CanvasContextState {
  target: CanvasContextTarget;
}

export type CanvasContextAction =
  | { type: 'selection.accept'; selection: CanvasElementSelection }
  | { type: 'selection.replace'; selection: CanvasElementSelection | null }
  | { type: 'range.change'; active: boolean }
  | { type: 'clear' };

export const INITIAL_CANVAS_CONTEXT_STATE: CanvasContextState = {
  target: { kind: 'none', selection: null },
};

function targetForSelection(
  selection: CanvasElementSelection,
  preserveTextRange: boolean,
): CanvasContextTarget {
  if (selection.role === 'text') {
    return {
      kind: preserveTextRange ? 'text-range' : 'text-element',
      selection: selection as SelectionForRole<'text'>,
    };
  }
  if (selection.role === 'media') {
    return { kind: 'media', selection: selection as SelectionForRole<'media'> };
  }
  if (selection.role === 'action') {
    return { kind: 'action', selection: selection as SelectionForRole<'action'> };
  }
  return { kind: 'block', selection: selection as SelectionForRole<'block'> };
}

export function reduceCanvasContextState(
  state: CanvasContextState,
  action: CanvasContextAction,
): CanvasContextState {
  if (action.type === 'clear') return INITIAL_CANVAS_CONTEXT_STATE;

  if (action.type === 'selection.accept' || action.type === 'selection.replace') {
    if (action.selection === null) return INITIAL_CANVAS_CONTEXT_STATE;
    return {
      target: targetForSelection(action.selection, state.target.kind === 'text-range'),
    };
  }

  if (action.type === 'range.change') {
    if (action.active) {
      if (state.target.kind !== 'text-element' && state.target.kind !== 'text-range') return state;
      return { target: { kind: 'text-range', selection: state.target.selection } };
    }

    if (state.target.kind !== 'text-range') return state;
    return { target: { kind: 'text-element', selection: state.target.selection } };
  }

  return state;
}

export function canvasContextSelection(state: CanvasContextState): CanvasElementSelection | null {
  return state.target.selection;
}

export function canvasContextRangeActive(state: CanvasContextState): boolean {
  return state.target.kind === 'text-range';
}
