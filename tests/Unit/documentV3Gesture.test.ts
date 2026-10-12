import { describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { createGeometryGesture } from '../../resources/js/editor-application/v3/gesture';
import { createStructureSession, reopenDraft, serializeDraft, type Snapshot } from '../../resources/js/editor-application/v3/session';

function setup() {
  const document = cloneDocument(validateDocumentV3(fixture));
  const id = document.blocks[0].slots.content![0].instance_id;
  const state: Snapshot = { document, context: { documentId: document.document_id, sessionId: 'gesture', revision: 0, readonly: false } };
  const commit = vi.fn((result: { document: typeof document }) => { state.document = result.document; state.context.revision++; });
  const session = createStructureSession({ read: () => state, commit }, () => { throw Error('no IDs'); });
  const gesture = createGeometryGesture({ read: () => state, execute: session.execute });
  const begin = () => gesture.begin([id], [{ id, left: 10, top: 20, width: 100, height: 50 }]);
  const command = { kind: 'styles' as const, updates: [{ id, set: { width: { value: 200, unit: 'px' as const } } }] };
  return { state, commit, gesture, begin, command, id };
}
describe('v3 provisional gesture ownership', () => {
  it('pins a gesture to its responsive target and rejects a cross-viewport preview', () => {
    const s = setup(), boxes = [{ id: s.id, left: 10, top: 20, width: 100, height: 50 }];
    s.gesture.begin([s.id], boxes, 'mobile');
    expect(() => s.gesture.preview(s.command)).toThrow('gesture_targets');
    expect(s.commit).not.toHaveBeenCalled();
    s.gesture.begin([s.id], boxes, 'mobile');
    s.gesture.preview({ ...s.command, viewport: 'mobile' });
    s.gesture.finish();
    expect(s.commit).toHaveBeenCalledTimes(1);
    expect(s.state.document.blocks[0].slots.content![0].responsive.mobile?.width).toEqual({ value: 200, unit: 'px' });
    expect(s.state.document.blocks[0].slots.content![0].style.width).toEqual(fixture.blocks[0].slots.content[0].style.width);
  });
  it('previews without writing, commits once, then saves and reopens canonical data', () => {
    const s = setup(), before = serializeDraft(s.state.document);
    s.begin();
    for (let i = 0; i < 5; i++) s.gesture.preview(s.command);
    expect(s.commit).not.toHaveBeenCalled();
    expect(serializeDraft(s.state.document)).toBe(before);
    expect(s.gesture.finish()?.changed).toBe(true);
    expect(s.commit).toHaveBeenCalledTimes(1);
    expect(s.gesture.active()).toBe(false);
    expect(() => s.gesture.finish()).toThrow('gesture_cancelled');
    expect(reopenDraft(serializeDraft(s.state.document), s.state.context.documentId)).toEqual(s.state.document);
  });
  it('does not allocate history for no-motion or explicit cancellation', () => {
    const s = setup(); s.begin(); expect(s.gesture.finish()).toBeNull();
    s.begin(); s.gesture.preview(s.command); s.gesture.cancel();
    expect(() => s.gesture.finish()).toThrow('gesture_cancelled');
    expect(s.commit).not.toHaveBeenCalled();
    s.begin(); s.gesture.preview({ kind: 'styles', updates: [{ id: s.id, set: {} }] }); s.gesture.finish();
    expect(s.commit).not.toHaveBeenCalled();
  });
  it.each(['documentId', 'sessionId', 'revision', 'readonly'] as const)('invalidates the entire gesture after %s changes', field => {
    const s = setup(); s.begin(); s.gesture.preview(s.command);
    if (field === 'revision') s.state.context.revision++;
    else if (field === 'readonly') s.state.context.readonly = true;
    else s.state.context[field] = 'other';
    expect(() => s.gesture.finish()).toThrow('gesture_cancelled');
    expect(s.commit).not.toHaveBeenCalled();
    expect(s.gesture.active()).toBe(false);
  });
  it('rejects readonly start, changed identities and invalid preview without partial writes', () => {
    const s = setup(); s.state.context.readonly = true;
    expect(s.begin).toThrow('readonly'); s.state.context.readonly = false;
    s.begin();
    expect(() => s.gesture.preview({ kind: 'rename', id: s.id, name: 'wrong command' })).toThrow('gesture_targets');
    s.begin();
    expect(() => s.gesture.preview({ kind: 'styles', updates: [] })).toThrow('gesture_targets');
    s.begin();
    expect(() => s.gesture.preview({ kind: 'styles', updates: [{ id: s.id, set: { opacity: -1 } }] })).toThrow();
    expect(s.gesture.active()).toBe(false);
    expect(s.commit).not.toHaveBeenCalled();
  });
  it('copies the command rather than retaining mutable adapter data', () => {
    const s = setup(); s.begin(); s.gesture.preview(s.command);
    s.command.updates[0].set.width.value = 999;
    s.gesture.finish();
    expect(s.state.document.blocks[0].slots.content![0].style.width).toEqual({ value: 200, unit: 'px' });
  });
});
