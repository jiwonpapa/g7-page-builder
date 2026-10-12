import { describe, expect, it } from 'vitest';
import { beginGesture, completeGesture, duplicateTail, nodeKeyboardAllowed, type Context } from './model';

const context: Context = { session: 'document-a:1', revision: 4, readonly: false };
const boxes = [{ id: 'a', width: 200, height: 100 }, { id: 'b', width: 200, height: 100 }];
const resized = boxes.map(box => ({ ...box, width: 240 }));
describe('IP1 atomic gesture guards', () => {
  it('coalesces only an equivalent latest vendor history, preserving redo and distinct edits', () => {
    const equal = (a: string, b: string) => a === b;
    expect(duplicateTail(['a', 'b', 'b'], 2, equal)).toEqual(['a', 'b']);
    expect(duplicateTail(['a', 'b', 'b'], 1, equal)).toBeNull();
    expect(duplicateTail(['a', 'b', 'c'], 2, equal)).toBeNull();
    expect(duplicateTail(['a'], 0, equal)).toBeNull();
    expect(duplicateTail([], -1, equal)).toBeNull();
  });
  it('copies snapshots and returns the complete group without mutating the original', () => {
    const gesture = beginGesture(context, boxes);
    expect(completeGesture(gesture, context, resized)).toEqual(resized);
    expect(gesture?.before).toEqual(boxes);
    expect(gesture?.before).not.toBe(boxes);
  });
  it.each([
    { ...context, session: 'document-b:1' }, { ...context, revision: 5 }, { ...context, readonly: true },
  ])('rejects stale or readonly context %o', current => {
    expect(completeGesture(beginGesture(context, boxes), current, resized)).toBeNull();
  });
  it.each([[], [resized[0]], [resized[0], resized[0]], [...resized, { id: 'c', width: 100, height: 100 }]].map(result => ({ result })))('rejects partial/wrong groups', ({ result }) => {
    expect(completeGesture(beginGesture(context, boxes), context, result)).toBeNull();
  });
  it.each([NaN, Infinity, -1, 0, 23, 4097])('rejects invalid geometry %s', width => {
    expect(completeGesture(beginGesture(context, boxes), context, [{ ...resized[0], width }, resized[1]])).toBeNull();
  });
  it('does not commit cancel, no-op, empty selection or readonly start', () => {
    expect(completeGesture(null, context, resized)).toBeNull();
    expect(completeGesture(beginGesture(context, boxes), context, boxes)).toBeNull();
    expect(beginGesture(context, [])).toBeNull();
    expect(beginGesture({ ...context, readonly: true }, boxes)).toBeNull();
  });
  it('gives text, IME, readonly and structure input exclusive ownership', () => {
    expect(nodeKeyboardAllowed('geometry', false, false, false)).toBe(true);
    for (const owner of ['text', 'structure'] as const) expect(nodeKeyboardAllowed(owner, false, false, false)).toBe(false);
    expect(nodeKeyboardAllowed('geometry', true, false, false)).toBe(false);
    expect(nodeKeyboardAllowed('geometry', false, true, false)).toBe(false);
    expect(nodeKeyboardAllowed('geometry', false, false, true)).toBe(false);
  });
});
