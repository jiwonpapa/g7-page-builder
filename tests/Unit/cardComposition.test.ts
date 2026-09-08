import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { globalThis.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} } as typeof ResizeObserver; });
import fixtures from '../Fixtures/layout-policy-cases.json';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { validateLayoutDocument } from '../../resources/js/documents/layoutPolicy';
import { canonicalToPuck, puckToCanonical } from '../../resources/js/editor/puckBlockCodec';
import { assertEditorInsertion, editorItemLocations } from '../../resources/js/editor/puckEditorSelection';
import { cloneLayoutSubtree } from '../../resources/js/documents/layoutTree';
import { cardComponentConfig } from '../../resources/js/editor/cardCatalogBlocks';
import { CARD_SLOT_COMPONENTS } from '../../resources/js/editor/ComponentComposition';
import { libraryKind, libraryEditingCapabilities } from '../../resources/js/editor/blockGalleryModel';

const fresh = (): PageBuilderDocument => {
  const doc: PageBuilderDocument = { ...structuredClone(fixtures.imageText), schema_version: 'g7-page-builder/v2', mode: 'canvas' };
  doc.blocks[0].type = 'content.card-01'; doc.blocks[0].props = { variant: 'outlined' };
  doc.blocks[0].slots = { media: [], body: [doc.blocks[0].slots!.extra[0]], actions: [] };
  return doc;
};
const wrap = (type: string, child: PageBuilderBlock, id: number): PageBuilderBlock => ({
  instance_id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`, type, block_version: 1,
  props: type === 'layout.columns-01' ? { columns: 1, ratio: '1', gap: 'normal' } : type === 'layout.section-01' ? { width: 'standard', spacing: 'normal' } : { gap: 'normal' },
  slots: { [type === 'layout.columns-01' ? 'column1' : 'content']: [child] },
});

describe('single Card composition', () => {
  it('preserves slots, IDs and child metadata across save conversion and clone', () => {
    const doc = fresh();
    doc.blocks[0].slots!.body[0].visibility = { audience: 'member' };
    doc.blocks[0].slots!.body[0].responsive = { mobile: { appearance: { textAlign: 'right' } } };
    const session = canonicalToPuck(doc);
    expect(puckToCanonical(session.data, session.context)).toEqual(doc);
    expect(editorItemLocations(session.data)).toHaveLength(2);
    let id = 900;
    const cloned = cloneLayoutSubtree(doc.blocks[0], () => `00000000-0000-4000-8000-${String(id++).padStart(12, '0')}`);
    expect(cloned.slots!.body[0].visibility).toEqual({ audience: 'member' });
    expect(cloned.slots!.body[0].instance_id).not.toBe(doc.blocks[0].slots!.body[0].instance_id);
  });
  it('accepts root and Section/Columns or Section/Stack nesting but rejects depth five', () => {
    for (const parent of ['layout.columns-01', 'layout.stack-01']) {
      const doc = fresh();
      doc.blocks = [wrap('layout.section-01', wrap(parent, doc.blocks[0], 901), 902)];
      expect(() => validateLayoutDocument(doc)).not.toThrow();
      expect(puckToCanonical(canonicalToPuck(doc).data, canonicalToPuck(doc).context)).toEqual(doc);
      doc.blocks[0].slots!.content[0] = wrap('layout.columns-01', wrap('layout.stack-01', fresh().blocks[0], 903), 904);
      expect(() => validateLayoutDocument(doc)).toThrow('depth_limit:');
    }
  });
  it('rejects wrong slot, duplicate type, Card nesting and cross-slot moves', () => {
    const doc = fresh(), session = canonicalToPuck(doc), id = doc.blocks[0].instance_id;
    expect(() => assertEditorInsertion(session.data, { zone: `${id}:media`, index: 0 }, 'Image')).not.toThrow();
    expect(() => assertEditorInsertion(session.data, { zone: `${id}:body`, index: 1 }, 'Badge')).toThrow('component_slot_limit:');
    for (const type of ['Image', 'Buttons', 'Card', 'LayoutStack']) expect(() => assertEditorInsertion(session.data, { zone: `${id}:body`, index: 0 }, type)).toThrow('parent:');
    doc.blocks[0].slots!.invented = [];
    expect(() => validateLayoutDocument(doc)).toThrow('slot:');
  });
  it('keeps explicit empty slots and makes internal controls unavailable outside structure mode', () => {
    const doc = fresh(); doc.blocks[0].slots = { body: [] };
    const session = canonicalToPuck(doc);
    expect(puckToCanonical(session.data, session.context)).toEqual(doc);
    const bare = fresh(); delete bare.blocks[0].slots;
    const bareSession = canonicalToPuck(bare);
    expect(puckToCanonical(bareSession.data, bareSession.context)).toEqual(bare);
    const legacy = fresh(); legacy.schema_version = 'g7-page-builder/v1'; legacy.blocks[0].slots = {};
    const opened = canonicalToPuck(legacy);
    expect(puckToCanonical(opened.data, opened.context)).toEqual(legacy);
    const card = opened.data.content[0];
    if (card.type !== 'Card') throw new Error('Expected Card');
    card.props.body = canonicalToPuck(fresh()).data.content;
    expect(() => puckToCanonical(opened.data, opened.context)).toThrow('requires structure editing');
    for (const name of Object.keys(CARD_SLOT_COMPONENTS)) {
      expect(cardComponentConfig(false).fields?.[name as keyof typeof CARD_SLOT_COMPONENTS]).toMatchObject({ allow: [] });
    }
    expect(libraryKind('Card')).toBe('component');
    expect(libraryEditingCapabilities('Card', cardComponentConfig(true).fields ?? {}).find((entry) => entry.key === 'slots')?.available).toBe(true);
  });
});
