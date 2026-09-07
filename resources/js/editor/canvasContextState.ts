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

export type CanvasTextTarget = Pick<CanvasElementSelection, 'blockId' | 'fieldPath'>;

export function normalizeCanvasTextTarget(value: unknown): CanvasTextTarget | null {
  if (!value || typeof value !== 'object' || !('blockId' in value) || typeof value.blockId !== 'string'
    || !value.blockId || !('fieldPath' in value) || typeof value.fieldPath !== 'string' || !value.fieldPath) return null;
  return { blockId: value.blockId, fieldPath: value.fieldPath };
}

export function sameCanvasTextTarget(left: CanvasTextTarget | null, right: CanvasTextTarget | null): boolean {
  return left !== null && right !== null && left.blockId === right.blockId && left.fieldPath === right.fieldPath;
}

/** Cross-frame events are UI input, not a trusted document or a type assertion. */
export function normalizeCanvasElementSelection(value: unknown): CanvasElementSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!('blockId' in value) || typeof value.blockId !== 'string' || !value.blockId
    || !('blockType' in value) || typeof value.blockType !== 'string' || !value.blockType
    || !('role' in value) || !['block', 'text', 'media', 'action'].some((role) => role === value.role)
    || !('fieldPath' in value) || (value.fieldPath !== null && typeof value.fieldPath !== 'string')
    || !('label' in value) || typeof value.label !== 'string'
    ) return null;
  const collection = 'collection' in value ? value.collection : null;
  const itemIndex = 'itemIndex' in value ? value.itemIndex : null;
  if ((collection !== null && (typeof collection !== 'string' || !collection))
    || (itemIndex !== null && (typeof itemIndex !== 'number' || !Number.isInteger(itemIndex) || itemIndex < 0))
    || (collection === null) !== (itemIndex === null)) return null;
  if (value.role !== 'block' && !value.fieldPath) return null;
  return { blockId: value.blockId, blockType: value.blockType, role: value.role as CanvasElementRole,
    fieldPath: value.fieldPath, label: value.label, collection, itemIndex,
    ...('intent' in value ? { intent: 'identify' as const } : {}),
    ...('anchor' in value ? { anchor: normalizeCanvasRangeAnchor(value.anchor) } : {}) };
}

export type CanvasContextAction =
  | { type: 'selection.accept'; selection: CanvasElementSelection }
  | { type: 'selection.replace'; selection: CanvasElementSelection | null }
  | { type: 'range.change'; active: boolean; anchor?: CanvasRangeAnchor | null; target?: CanvasTextTarget }
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
        state.target.kind === 'text-range' && sameCanvasTextTarget(state.target.selection, action.selection)
          ? state.target.anchor : undefined,
      ),
    };
  }

  if (action.type === 'range.change') {
    if (action.target && !sameCanvasTextTarget(state.target.selection, action.target)) return state;
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
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (!('top' in value) || !('right' in value) || !('bottom' in value)
    || !('left' in value) || !('width' in value) || !('height' in value)) return null;
  const { top, right, bottom, left, width, height } = value;
  if (typeof top !== 'number' || !Number.isFinite(top)
    || typeof right !== 'number' || !Number.isFinite(right)
    || typeof bottom !== 'number' || !Number.isFinite(bottom)
    || typeof left !== 'number' || !Number.isFinite(left)
    || typeof width !== 'number' || !Number.isFinite(width)
    || typeof height !== 'number' || !Number.isFinite(height)) return null;
  const anchor: CanvasRangeAnchor = { top, right, bottom, left, width, height };
  if (anchor.right <= anchor.left || anchor.bottom <= anchor.top || anchor.width <= 0 || anchor.height <= 0) return null;
  return anchor;
}
