import { describe, expect, it } from 'vitest';
import fixtures from '../Fixtures/layout-policy-cases.json';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import { layoutSlotNames, validateLayoutDocument } from '../../resources/js/documents/layoutPolicy';
import { canonicalToPuck, puckToCanonical } from '../../resources/js/editor/puckBlockCodec';
import { assertEditorInsertion, assertEditorMove, editorDefaultInsertionTarget, editorItemLocations } from '../../resources/js/editor/puckEditorSelection';
import { cloneLayoutSubtree, deleteLayoutNode, moveLayoutNode } from '../../resources/js/documents/layoutTree';

const fresh = (): PageBuilderDocument => ({ ...structuredClone(fixtures.hero), schema_version: 'g7-page-builder/v2', mode: 'canvas' });
describe('Hero declared extra composition', () => {
  it('round trips nested identity, content and metadata without transferring CTA ownership', () => {
    const original = fresh();
    const child = original.blocks[0].slots!.extra[0];
    child.visibility = { audience: 'member' };
    child.responsive = { mobile: { appearance: { textAlign: 'right' } } };
    const session = canonicalToPuck(original);
    const output = puckToCanonical(session.data, session.context);
    expect(output).toEqual(original);
    expect(editorItemLocations(session.data)).toHaveLength(3);
    expect(layoutSlotNames(original.blocks[0])).toEqual(['extra']);
  });
  it('does not add slots or convert v1 merely by opening an old Hero', () => {
    const original = fresh();
    original.schema_version = 'g7-page-builder/v1';
    delete original.blocks[0].slots;
    const session = canonicalToPuck(original);
    expect(puckToCanonical(session.data, session.context)).toEqual(original);
    const hero = session.data.content[0];
    if (hero.type !== 'Hero') throw new Error('Expected Hero');
    const nested = canonicalToPuck(fresh()).data.content[0];
    if (nested.type !== 'Hero') throw new Error('Expected Hero');
    hero.props.extra = nested.props.extra;
    expect(() => puckToCanonical(session.data, session.context)).toThrow('requires structure editing');
  });
  it('rejects unsupported slots, types and duplicates before insertion or save', () => {
    const doc = fresh();
    const session = canonicalToPuck(doc);
    const zone = `${doc.blocks[0].instance_id}:extra`;
    expect(editorDefaultInsertionTarget(session.data, { zone: 'root:default-zone', index: 0 }).selector).toEqual({ zone: 'root:default-zone', index: 1 });
    expect(() => assertEditorInsertion(session.data, { zone, index: 2 }, 'Badge', 1, 1, false)).toThrow('slot');
    expect(() => assertEditorInsertion(session.data, { zone, index: 2 }, 'Badge')).toThrow('component_slot_limit');
    expect(() => assertEditorInsertion(session.data, { zone, index: 2 }, 'Heading')).toThrow('parent');
    const source = editorItemLocations(session.data)[2];
    expect(() => assertEditorMove(session.data, source, { zone, index: 0 })).not.toThrow();
    const extra = doc.blocks[0].slots!.extra;
    extra.push({ ...structuredClone(extra[0]), instance_id: '00000000-0000-4000-8000-000000000105' });
    expect(() => validateLayoutDocument(doc)).toThrow('component_slot_limit');
    extra.pop();
    extra[0].type = 'content.heading-01';
    expect(() => validateLayoutDocument(doc)).toThrow('parent');
    doc.blocks[0].slots = { actions: [] };
    expect(() => validateLayoutDocument(doc)).toThrow('slot');
  });
  it('reorders/deletes children and clones the full subtree with fresh unique identities', () => {
    const doc = fresh();
    const hero = doc.blocks[0];
    const list = hero.slots!.extra[1];
    const moved = moveLayoutNode(doc, list.instance_id, { parentId: hero.instance_id, slot: 'extra', index: 0 });
    expect(moved.blocks[0].slots!.extra[0].type).toBe('content.list-01');
    const removed = deleteLayoutNode(moved, list.instance_id);
    expect(removed.document.blocks[0].slots!.extra).toHaveLength(1);
    const copy = cloneLayoutSubtree(hero, () => crypto.randomUUID());
    expect(copy.instance_id).not.toBe(hero.instance_id);
    expect(copy.slots!.extra.map((child) => child.instance_id)).not.toEqual(hero.slots!.extra.map((child) => child.instance_id));
  });
});
