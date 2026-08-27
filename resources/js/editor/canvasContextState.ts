import type { CanvasElementRole, CanvasElementSelection } from './canvasEditingContract';

type SelectionForRole<Role extends CanvasElementRole> = CanvasElementSelection & { role: Role };

export interface CanvasRangeAnchor {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export type CanvasContextTarget =
  | { kind: 'none'; selection: null }
  | { kind: 'block'; selection: SelectionForRole<'block'> }
  | { kind: 'text-element'; selection: SelectionForRole<'text'> }
  | { kind: 'text-range'; selection: SelectionForRole<'text'>; anchor: CanvasRangeAnchor | null }
  | { kind: 'media'; selection: SelectionForRole<'media'> }
  | { kind: 'action'; selection: SelectionForRole<'action'> };

export interface CanvasContextState {
  target: CanvasContextTarget;
}

export type CanvasContextAction =
  | { type: 'selection.accept'; selection: CanvasElementSelection }
  | { type: 'selection.replace'; selection: CanvasElementSelection | null }
  | { type: 'range.change'; active: boolean; anchor?: CanvasRangeAnchor | null }
  | { type: 'clear' };

export const INITIAL_CANVAS_CONTEXT_STATE: CanvasContextState = {
  target: { kind: 'none', selection: null },
};

function targetForSelection(
  selection: CanvasElementSelection,
  preservedRangeAnchor: CanvasRangeAnchor | null | undefined,
): CanvasContextTarget {
  if (selection.role === 'text') {
    if (preservedRangeAnchor !== undefined) {
      return { kind: 'text-range', selection: selection as SelectionForRole<'text'>, anchor: preservedRangeAnchor };
    }
    return { kind: 'text-element', selection: selection as SelectionForRole<'text'> };
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
      target: targetForSelection(
        action.selection,
        state.target.kind === 'text-range' ? state.target.anchor : undefined,
      ),
    };
  }

  if (action.type === 'range.change') {
    if (action.active) {
      if (state.target.kind !== 'text-element' && state.target.kind !== 'text-range') return state;
      return {
        target: {
          kind: 'text-range',
          selection: state.target.selection,
          anchor: action.anchor === undefined
            ? state.target.kind === 'text-range' ? state.target.anchor : null
            : action.anchor,
        },
      };
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

export function canvasContextRangeAnchor(state: CanvasContextState): CanvasRangeAnchor | null {
  return state.target.kind === 'text-range' ? state.target.anchor : null;
}

export function normalizeCanvasRangeAnchor(value: unknown): CanvasRangeAnchor | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const coordinates = ['top', 'right', 'bottom', 'left', 'width', 'height'] as const;
  if (!coordinates.every((key) => typeof candidate[key] === 'number' && Number.isFinite(candidate[key]))) return null;
  const anchor = Object.fromEntries(coordinates.map((key) => [key, candidate[key]])) as unknown as CanvasRangeAnchor;
  if (anchor.right <= anchor.left || anchor.bottom <= anchor.top || anchor.width <= 0 || anchor.height <= 0) return null;
  return anchor;
}
