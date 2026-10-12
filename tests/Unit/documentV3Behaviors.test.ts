import { describe, expect, it, vi } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import schema from '../../schemas/page-builder-document-v3.schema.json';
import { validateDocumentV3, designPolicyV3 } from '../../resources/js/documents/v3/validate';
import { record } from '../../resources/js/documents/v3/schema';
import { remapBehavior } from '../../resources/js/documents/v3/behaviors';
import { copyTree } from '../../resources/js/documents/v3/clipboard';
import { executeDocumentCommand, type DocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { createStructureSession, reopenDraft, serializeDraft, type Snapshot } from '../../resources/js/editor-application/v3/session';
import type { Behavior, DocumentV3 } from '../../resources/js/documents/v3/types';

type Kind = keyof typeof cases.behavior_fixtures;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const source = (kind: Kind): unknown => ({ ...structuredClone(fixture), blocks: structuredClone(cases.behavior_fixtures[kind]) });
const valid = (kind: Kind = 'tabs') => validateDocumentV3(source(kind));
function patch(value: unknown, path: (string | number)[], replacement: unknown, remove: boolean): void {
  const [key, ...tail] = path;
  if (key === undefined || (!record(value) && !Array.isArray(value))) throw new Error('Bad fixture path');
  const fields = value as Record<string | number, unknown>;
  if (tail.length) patch(fields[key], tail, replacement, remove);
  else if (remove) delete fields[key];
  else fields[key] = replacement;
}
function ids() { let value = 8000; return () => id(value++); }
function run(document: DocumentV3, command: DocumentCommand) { return executeDocumentCommand(document, command, ids()); }
const entry = (document: DocumentV3, n: number) => indexTree(document).get(id(n))!.node;

describe('common element behavior contract', () => {
  for (const test of cases.behavior_cases) it(test.name, () => {
    if (!Object.hasOwn(cases.behavior_fixtures, test.fixture)) throw new Error('Unknown shared fixture');
    const document = source(test.fixture as Kind);
    for (const change of test.patches) patch(document, change.path, 'value' in change ? change.value : undefined, 'remove' in change && change.remove === true);
    const before = JSON.stringify(document);
    if (test.valid) {
      expect(validateDocumentV3(document)).toEqual(document);
      const check = new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schema);
      expect(check(document), JSON.stringify(check.errors)).toBe(true);
    } else {
      expect(() => validateDocumentV3(document)).toThrow(new RegExp('^' + test.error + ':'));
      if (test.error === 'value') expect(new Ajv2020({ strict: true, multipleOfPrecision: 8 }).compile(schema)(document)).toBe(false);
    }
    expect(JSON.stringify(document)).toBe(before);
  });

  it.each(['tabs', 'disclosure', 'carousel', 'nested'] as const)('duplicates %s with new IDs and all references internal to the copied tree', kind => {
    const document = valid(kind), before = JSON.stringify(document), oldIds = [...indexTree(document).keys()];
    const result = run(document, { kind: 'duplicate', ids: [document.blocks[0].instance_id] });
    expect(result.changed).toBe(true);
    expect(result.document.blocks).toHaveLength(2);
    expect(result.document.blocks[0]).toEqual(document.blocks[0]);
    const copied = { ...result.document, blocks: [result.document.blocks[1]] };
    expect(validateDocumentV3(copied)).toEqual(copied);
    expect([...indexTree(copied).keys()].some(key => oldIds.includes(key))).toBe(false);
    expect(JSON.stringify(copied.blocks)).not.toContain(oldIds[0]);
    for (const old of oldIds) expect(JSON.stringify(copied.blocks)).not.toContain(old);
    expect(result.selection).toEqual([copied.blocks[0].instance_id]);
    expect(JSON.stringify(document)).toBe(before);
  });

  it('pastes nested behavior groups into an empty document and roundtrips without a registry', () => {
    const document = valid('nested'), clipboard = copyTree(document, [document.blocks[0].instance_id]);
    const empty = validateDocumentV3({ ...structuredClone(fixture), blocks: [] });
    const result = run(empty, { kind: 'paste', clipboard, destination: { parentId: null, index: 0 } });
    expect(result.document.blocks).toHaveLength(1);
    expect(reopenDraft(serializeDraft(result.document), empty.document_id)).toEqual(result.document);
    expect(empty.blocks).toEqual([]);
    expect(clipboard.source).toEqual(document);
    expect(() => remapBehavior(document.blocks[0].behavior!, new Map())).toThrow('behavior_clipboard:');
  });

  it('copies an ordinary panel independently without carrying its parent behavior', () => {
    const document = valid(), empty = validateDocumentV3({ ...structuredClone(fixture), blocks: [] });
    const result = run(empty, { kind: 'paste', clipboard: copyTree(document, [id(104)]), destination: { parentId: null, index: 0 } });
    expect(result.document.blocks[0].behavior).toBeUndefined();
    expect(result.document.blocks[0].slots.content).toHaveLength(1);
  });

  it('uses the shared content command for button labels and layout semantics with exact validation', () => {
    const document = valid();
    const button = createPrimitive('action.button', id(901), document);
    expect(button.props).toEqual({ label: '내용 보기' });
    expect(run(document, { kind: 'content', id: id(102), props: { label: '새 문구' } }).document.blocks[0]).not.toEqual(document.blocks[0]);
    expect(run(document, { kind: 'content', id: id(100), props: { tag: 'section' } }).document.blocks[0].props).toEqual({ tag: 'section' });
    for (const props of [{ label: '' }, { label: '실행', onclick: 'alert(1)' }]) {
      expect(() => run(document, { kind: 'content', id: id(102), props })).toThrow('value:');
    }
    expect(() => run(document, { kind: 'content', id: id(102), props: { label: '실행', link: { url: '/x', new_tab: false } } })).toThrow('props_type:');
    expect(() => run(document, { kind: 'content', id: id(100), props: { tag: 'button' } })).toThrow();
  });

  it('changes and removes authored behavior without storing current runtime state', () => {
    const document = valid(), behavior = document.blocks[0].behavior;
    if (behavior?.kind !== 'tabs') throw new Error('tabs fixture');
    const updated = { ...behavior, active_panel_id: id(106), orientation: 'vertical' as const };
    expect(run(document, { kind: 'behavior', id: id(100), value: updated }).document.blocks[0].behavior).toEqual(updated);
    expect(run(document, { kind: 'behavior', id: id(100), value: behavior }).changed).toBe(false);
    const removed = run(document, { kind: 'behavior', id: id(100), value: null }).document;
    expect(removed.blocks[0].behavior).toBeUndefined();
    expect(run(removed, { kind: 'behavior', id: id(100), value: null }).changed).toBe(false);
    expect(() => run(document, { kind: 'behavior', id: id(100), value: { ...behavior, current_panel: id(106) } })).toThrow('value:');
    expect(() => run(document, { kind: 'behavior', id: id(105), value: behavior })).toThrow('behavior_host:');
  });

  it('rejects broken ownership after deletion or movement, while whole-group movement remains valid', () => {
    const document = valid('nested'), before = JSON.stringify(document);
    for (const command of [
      { kind: 'delete', ids: [id(102)] },
      { kind: 'move', ids: [id(102)], destination: { parentId: null, index: 1 } },
      { kind: 'move', ids: [id(102)], destination: { parentId: id(201), index: 0 } },
    ] satisfies DocumentCommand[]) expect(() => run(document, command)).toThrow(/behavior_(reference|owner):/);
    const moved = run(document, { kind: 'move', ids: [id(200)], destination: { parentId: id(106), index: 1 } });
    expect(entry(moved.document, 106).slots.content?.at(-1)?.instance_id).toBe(id(200));
    expect(JSON.stringify(document)).toBe(before);
    const host = document.blocks[0];
    host.type = 'layout.container'; host.props = { tag: 'div' }; host.style = {}; host.responsive = {};
    expect(() => run(document, { kind: 'ungroup', ids: [host.instance_id] })).toThrow('non_neutral_group:');
  });

  it('protects locked participants and ancestors when changing a behavior', () => {
    for (const target of [100, 102, 105]) {
      const document = valid(), before = structuredClone(document.blocks[0].behavior);
      entry(document, target).locked = true;
      expect(() => run(document, { kind: 'behavior', id: id(100), value: null })).toThrow('locked:');
      expect(document.blocks[0].behavior).toEqual(before);
    }
    const nested = valid('nested'); nested.blocks[0].locked = true;
    expect(() => run(nested, { kind: 'behavior', id: id(200), value: null })).toThrow('locked:');
  });

  it('commits a coordinated structure/behavior transaction once and leaves failures uncommitted', () => {
    const document = valid(), behavior = document.blocks[0].behavior;
    if (behavior?.kind !== 'tabs') throw new Error('tabs fixture');
    const command: DocumentCommand = { kind: 'transaction', commands: [
      { kind: 'behavior', id: id(100), value: { ...behavior, pairs: [behavior.pairs[0]] } },
      { kind: 'delete', ids: [id(103), id(106)] },
      { kind: 'content', id: id(102), props: { label: '남은 탭' } },
    ] };
    let snapshot: Snapshot = { document, context: { documentId: document.document_id, sessionId: 'behavior-test', revision: 1, readonly: false } };
    const commit = vi.fn((result) => { snapshot = { document: result.document, context: { ...snapshot.context, revision: snapshot.context.revision + 1 } }; });
    const session = createStructureSession({ read: () => snapshot, commit }, ids());
    const result = session.execute(command, snapshot.context);
    expect(commit).toHaveBeenCalledExactlyOnceWith(result);
    expect(indexTree(result.document).has(id(103))).toBe(false);
    expect(indexTree(result.document).has(id(106))).toBe(false);
    expect(entry(result.document, 102).props).toEqual({ label: '남은 탭' });
    expect(document).toEqual(valid());
    const saved = JSON.stringify(snapshot);
    expect(() => session.execute({ kind: 'transaction', commands: [
      { kind: 'rename', id: id(100), name: '반영되면 안 됨' }, { kind: 'delete', ids: [id(102)] },
    ] }, snapshot.context)).toThrow('behavior_reference:');
    expect(JSON.stringify(snapshot)).toBe(saved);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('bounds transactions, rejects nesting and does not commit a net no-op', () => {
    const document = valid(), behavior: Behavior = document.blocks[0].behavior!;
    for (const commands of [[], Array.from({ length: designPolicyV3.limits.transaction_commands + 1 }, () => ({ kind: 'rename', id: id(100), name: 'x' }))]) {
      expect(() => run(document, JSON.parse(JSON.stringify({ kind: 'transaction', commands })))).toThrow('transaction:');
    }
    expect(() => run(document, JSON.parse('{"kind":"transaction","commands":[{"kind":"transaction","commands":[]}]}'))).toThrow('transaction:');
    const result = run(document, { kind: 'transaction', commands: [
      { kind: 'behavior', id: id(100), value: null }, { kind: 'behavior', id: id(100), value: behavior },
    ] });
    expect(result.changed).toBe(false);
    expect(result.document).toBe(document);
  });
});
