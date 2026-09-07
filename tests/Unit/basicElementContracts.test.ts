import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
import schema from '../../schemas/page-builder-document.schema.json';
import fixture from '../Contract/document-basic-elements-v2.fixture.json';
import legacy from '../Contract/document-foundation-v1.fixture.json';
import type { PageBuilderDocument, PageBuilderBlock } from '../../resources/js/documents/types';
import { layoutAllowsChild, layoutPolicy, validateLayoutDocument } from '../../resources/js/documents/layoutPolicy';
import { canonicalToPuck, puckToCanonical } from '../../resources/js/editor/puckBlockCodec';
import { BUILTIN_CANVAS_EDITING_CONTRACT, collectionLimit } from '../../resources/js/editor/canvasEditingContract';
import { BLOCK_GALLERY_ITEMS } from '../../resources/js/editor/BlockCatalogContext';
import { basicElementToCanonical } from '../../resources/js/editor/basicElementCatalogCodec';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const valid = ajv.compile<PageBuilderDocument>(schema);
function document(value: unknown): PageBuilderDocument {
  if (!valid(value)) throw new Error(JSON.stringify(valid.errors));
  validateLayoutDocument(value);
  return value;
}
function leaves(value: PageBuilderDocument): PageBuilderBlock[] {
  return value.blocks[0].slots!.content[0].slots!.column1[0].slots!.content;
}

describe('EP2-01 canonical basic element contract', () => {
  it('offers exactly eight basic definitions and keeps presets attached to their own element', () => {
    const items = BLOCK_GALLERY_ITEMS.filter((item) => item.productionKind === 'element');
    expect(items.filter((item) => item.kind === 'definition').map((item) => item.type).sort())
      .toEqual(['Badge', 'Buttons', 'Divider', 'Heading', 'Icon', 'Image', 'List', 'RichText']);
    for (const type of ['Icon', 'List', 'Badge']) expect(items.filter((item) => item.type === type)).toHaveLength(2);
    expect(collectionLimit('List', 'items')).toEqual({ min: 1, max: 20 });
    expect(BUILTIN_CANVAS_EDITING_CONTRACT.find((item) => item.componentType === 'Icon')?.directText).toBe(false);
  });

  it('round-trips stable nested identities, order, styles, responsive values and old documents', () => {
    const original = document(structuredClone(fixture));
    const [icon, list, badge] = leaves(original);
    icon.responsive = { tablet: { appearance: { surface: 'soft' } }, mobile: { appearance: { surface: 'contrast' } } };
    list.props.appearance = { surface: 'default', spacing: 'compact', elements: { 'items.0.text': { weight: 'bold' } } };
    badge.props.appearance = { surface: 'soft', spacing: 'compact', elements: { label: { tone: 'accent' } } };
    for (const value of [original, document(structuredClone(legacy))]) {
      const session = canonicalToPuck(value);
      expect(puckToCanonical(session.data, session.context)).toEqual(value);
      expect(valid(puckToCanonical(session.data, session.context)), JSON.stringify(valid.errors)).toBe(true);
    }
    for (const parent of [null, ...Object.values(layoutPolicy.layouts)]) {
      for (const type of ['content.icon-01', 'content.list-01', 'content.badge-01']) expect(layoutAllowsChild(parent, type)).toBe(true);
    }
    expect(layoutAllowsChild('content.icon-01', 'content.badge-01')).toBe(false);
    expect(layoutAllowsChild('content.list-01', 'content.list-01')).toBe(false);
  });

  it.each([
    [0, { label: '', decorative: false }], [0, { label: '  ', decorative: false }], [0, { icon: '<svg/>' }],
    [0, { decorative: 1 }], [0, { label: '한'.repeat(121) }], [0, { size: '100px' }],
    [1, { items: [] }], [1, { items: Array.from({ length: 21 }, () => ({ text: '항목' })) }],
    [1, { items: [{ text: '한'.repeat(201) }] }], [1, { items: [{ text: '항목', children: [] }] }],
    [1, { ordered: 'true' }], [2, { label: '' }], [2, { label: '한'.repeat(41) }],
    [2, { tone: '#fff' }], [2, { url: '/' }], [2, { onClick: 'alert(1)' }],
  ] as const)('rejects invalid basic element %s props at the canonical schema', (index, patch) => {
    const value = document(structuredClone(fixture));
    leaves(value)[index].props = { ...leaves(value)[index].props, ...patch };
    expect(valid(value)).toBe(false);
  });

  it('accepts server-normalized absent optional values but requires meaningful icon names', () => {
    const value = document(structuredClone(fixture));
    const [icon, , badge] = leaves(value);
    icon.props.decorative = true;
    icon.props.label = null;
    badge.props.icon = null;
    expect(valid(value), JSON.stringify(valid.errors)).toBe(true);
    icon.props.decorative = false;
    expect(valid(value)).toBe(false);
    icon.props.label = '서비스 안내';
    expect(valid(value), JSON.stringify(valid.errors)).toBe(true);
  });

  it('preserves invalid editor values for validation and accepts the exact Unicode limits', () => {
    const value = document(structuredClone(fixture));
    const [icon, list, badge] = leaves(value);
    icon.props.label = '한'.repeat(120);
    list.props.items = Array.from({ length: 20 }, () => ({ text: '🙂'.repeat(200) }));
    badge.props.label = '한'.repeat(40);
    expect(valid(value), JSON.stringify(valid.errors)).toBe(true);
    const invalid = basicElementToCanonical('Badge', { ...badge.props, label: '' }, false);
    expect(invalid?.props.label).toBe('');
    badge.props = invalid!.props;
    expect(valid(value)).toBe(false);
    const unsupported = document(structuredClone(fixture));
    leaves(unsupported)[0].block_version = 2;
    expect(valid(unsupported)).toBe(false);
    const nested = document(structuredClone(fixture));
    leaves(nested)[0].slots = { content: [structuredClone(leaves(nested)[2])] };
    expect(() => validateLayoutDocument(nested)).toThrow();
  });
});
