import { describe, expect, it } from 'vitest';

import {
  INITIAL_CANVAS_CONTEXT_STATE,
  canvasContextRangeAnchor,
  canvasContextRangeActive,
  canvasContextSelection,
  normalizeCanvasRangeAnchor,
  reduceCanvasContextState,
  type CanvasContextState,
} from '../../resources/js/editor/canvasContextState';
import type { CanvasElementRole, CanvasElementSelection } from '../../resources/js/editor/canvasEditingContract';

function selection(role: CanvasElementRole, fieldPath: string | null = null): CanvasElementSelection {
  return {
    blockId: 'block-1',
    blockType: 'Heading',
    fieldPath,
    role,
    label: role,
    collection: null,
    itemIndex: null,
    intent: 'identify',
  };
}

describe('canvas context state', () => {
  it('starts with no target and no active text range', () => {
    expect(INITIAL_CANVAS_CONTEXT_STATE.target).toEqual({ kind: 'none', selection: null });
    expect(canvasContextSelection(INITIAL_CANVAS_CONTEXT_STATE)).toBeNull();
    expect(canvasContextRangeActive(INITIAL_CANVAS_CONTEXT_STATE)).toBe(false);
  });

  it.each([
    ['block', 'block'],
    ['text', 'text-element'],
    ['media', 'media'],
    ['action', 'action'],
  ] as const)('normalizes a %s selection to the %s target', (role, kind) => {
    const next = reduceCanvasContextState(INITIAL_CANVAS_CONTEXT_STATE, {
      type: 'selection.accept',
      selection: selection(role, role === 'block' ? null : 'title'),
    });

    expect(next.target.kind).toBe(kind);
    expect(canvasContextSelection(next)?.role).toBe(role);
    expect(canvasContextRangeActive(next)).toBe(false);
  });

  it('activates and collapses a range without losing its text element identity', () => {
    const textElement = reduceCanvasContextState(INITIAL_CANVAS_CONTEXT_STATE, {
      type: 'selection.accept',
      selection: selection('text', 'heading'),
    });
    const anchor = { top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24 };
    const textRange = reduceCanvasContextState(textElement, { type: 'range.change', active: true, anchor });
    const collapsed = reduceCanvasContextState(textRange, { type: 'range.change', active: false });

    expect(textRange.target.kind).toBe('text-range');
    expect(canvasContextRangeActive(textRange)).toBe(true);
    expect(canvasContextRangeAnchor(textRange)).toEqual(anchor);
    expect(collapsed.target.kind).toBe('text-element');
    expect(canvasContextSelection(collapsed)).toEqual(canvasContextSelection(textElement));
  });

  it.each(['block', 'media', 'action'] as const)('cannot activate a text range for a %s target', (role) => {
    const current = reduceCanvasContextState(INITIAL_CANVAS_CONTEXT_STATE, {
      type: 'selection.accept',
      selection: selection(role, role === 'block' ? null : 'target'),
    });

    expect(reduceCanvasContextState(current, { type: 'range.change', active: true })).toBe(current);
  });

  it('preserves a live range across the same text field replacement', () => {
    const textRange = reduceCanvasContextState(
      reduceCanvasContextState(INITIAL_CANVAS_CONTEXT_STATE, {
        type: 'selection.accept',
        selection: selection('text', 'items.0.title'),
      }),
      { type: 'range.change', active: true },
    );
    const replacement = { ...selection('text', 'items.1.title'), itemIndex: 1 };
    const next = reduceCanvasContextState(textRange, { type: 'selection.replace', selection: replacement });

    expect(next.target.kind).toBe('text-range');
    expect(canvasContextSelection(next)).toEqual(replacement);
  });

  it('ends an active range when the target changes to a non-text element', () => {
    const textRange: CanvasContextState = {
      target: {
        kind: 'text-range',
        selection: selection('text', 'heading') as CanvasElementSelection & { role: 'text' },
        anchor: { top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24 },
      },
    };
    const next = reduceCanvasContextState(textRange, {
      type: 'selection.accept',
      selection: selection('media', 'imageSrc'),
    });

    expect(next.target.kind).toBe('media');
    expect(canvasContextRangeActive(next)).toBe(false);
  });

  it('clears the complete target state through either clear path', () => {
    const current = reduceCanvasContextState(INITIAL_CANVAS_CONTEXT_STATE, {
      type: 'selection.accept',
      selection: selection('text', 'heading'),
    });

    expect(reduceCanvasContextState(current, { type: 'selection.replace', selection: null }))
      .toBe(INITIAL_CANVAS_CONTEXT_STATE);
    expect(reduceCanvasContextState(current, { type: 'clear' }))
      .toBe(INITIAL_CANVAS_CONTEXT_STATE);
  });

  it('normalizes only finite, non-collapsed range anchors from cross-frame messages', () => {
    expect(normalizeCanvasRangeAnchor({
      top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24,
    })).toEqual({ top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24 });
    expect(normalizeCanvasRangeAnchor({
      top: 20, right: 80, bottom: 44, left: 80, width: 0, height: 24,
    })).toBeNull();
    expect(normalizeCanvasRangeAnchor({
      top: 20, right: Number.NaN, bottom: 44, left: 80, width: 100, height: 24,
    })).toBeNull();
    expect(normalizeCanvasRangeAnchor('not-an-anchor')).toBeNull();
  });

  it.each(['top', 'right', 'bottom', 'left', 'width', 'height'] as const)(
    'requires a finite numeric %s without coercion or an omitted coordinate', (key) => {
      const valid = { top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24 };
      for (const value of [undefined, null, '20', false, Number.NaN, Infinity, -Infinity]) {
        expect(normalizeCanvasRangeAnchor({ ...valid, [key]: value })).toBeNull();
      }
      const incomplete: Partial<typeof valid> = { ...valid };
      delete incomplete[key];
      expect(normalizeCanvasRangeAnchor(incomplete)).toBeNull();
    },
  );

  it('preserves fractional and off-screen coordinates without mutating the message', () => {
    const input = Object.freeze({ top: -20.5, right: 100.25, bottom: 5.5, left: -10.25, width: 110.5, height: 26, extra: 'message' });
    const expected = { top: -20.5, right: 100.25, bottom: 5.5, left: -10.25, width: 110.5, height: 26 };
    expect(normalizeCanvasRangeAnchor(input)).toEqual(expected);
    expect(normalizeCanvasRangeAnchor(input)).not.toBe(input);
    expect(input).toEqual({ ...expected, extra: 'message' });
  });

  it.each([
    { right: 80 }, { right: 79 }, { bottom: 20 }, { bottom: 19 },
    { width: 0 }, { width: -1 }, { height: 0 }, { height: -1 },
  ])('rejects collapsed or inverted geometry %j', (override) => {
    expect(normalizeCanvasRangeAnchor({ top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24, ...override }))
      .toBeNull();
  });

  it('rejects arrays even when they carry coordinate properties', () => {
    const value = Object.assign([], { top: 20, right: 180, bottom: 44, left: 80, width: 100, height: 24 });
    expect(normalizeCanvasRangeAnchor(value)).toBeNull();
  });
});
