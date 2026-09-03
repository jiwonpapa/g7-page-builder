// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { HERO_BLOCK_TYPE, LOGO_CLOUD_BLOCK_TYPE, HEADING_BLOCK_TYPE, BUTTONS_BLOCK_TYPE } from '../../resources/js/documents/builtinBlockContracts';
import { LAYOUT_SECTION_BLOCK_TYPE, LAYOUT_COLUMNS_BLOCK_TYPE, LAYOUT_STACK_BLOCK_TYPE } from '../../resources/js/documents/layoutContracts';
import { registerExternalEditor } from '../../resources/js/blocks/externalEditorRegistryData';
import { isExternalEditorItem } from '../../resources/js/blocks/externalEditorData';

vi.mock('react', () => { throw new Error('Canonical codec imported React'); });
vi.mock('react/jsx-runtime', () => { throw new Error('Canonical codec imported JSX runtime'); });
vi.mock('react/jsx-dev-runtime', () => { throw new Error('Canonical codec imported JSX development runtime'); });
vi.mock('react-dom', () => { throw new Error('Canonical codec imported ReactDOM'); });
vi.mock('react-dom/client', () => { throw new Error('Canonical codec imported ReactDOM client'); });
vi.mock('react-dom/server', () => { throw new Error('Canonical codec imported ReactDOM server'); });
vi.mock('@puckeditor/core', () => { throw new Error('Canonical codec imported Puck runtime'); });
vi.mock('@tiptap/core', () => { throw new Error('Canonical codec imported Tiptap core'); });
vi.mock('@tiptap/react', () => { throw new Error('Canonical codec imported Tiptap React'); });
vi.mock('lucide-react', () => { throw new Error('Canonical codec imported icon renderer'); });

const { canonicalToPuck, puckToCanonical } = await import('../../resources/js/editor/puckBlockCodec');

const id = (index: number): string => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
function block(index: number, type: string, props: Record<string, unknown>): PageBuilderBlock {
  return { instance_id: id(index), type, block_version: 2, props };
}
function document(blocks: PageBuilderBlock[]): PageBuilderDocument {
  return { schema_version: 'g7-page-builder/v1', document_id: id(1), slug: 'codec-boundary', mode: 'canvas', locale: 'ko', blocks };
}

// The document converter and registry are real. UI imports and component render
// callbacks must remain unreachable; no DOM or vendor data substitute is installed.
describe('canonical codec without UI runtime', () => {
  it('round-trips core and catalog blocks with independent metadata and omitted defaults', () => {
    const source: PageBuilderDocument = {
      ...document([
        block(2, HERO_BLOCK_TYPE, { eyebrow: 'Tag', title: 'Hero sentinel', body: '<p>Body</p>', alignment: 'center' }),
        block(3, LOGO_CLOUD_BLOCK_TYPE, { heading: 'Catalog sentinel', logos: [{ name: 'Logo A', imageSrc: '', imageAlt: '', url: '/logo-a' }] }),
      ]),
      shell_mode: 'none',
      tokens: { 'design.palette': 'emerald', 'extension.counter': 7 },
      seo: { title: 'Metadata sentinel', description: 'Description', og_image_url: '', robots: 'noindex' },
    };
    const before = structuredClone(source);
    const first = canonicalToPuck(source);
    const other: PageBuilderDocument = { ...source, document_id: id(4), slug: 'other-session',
      blocks: source.blocks.map((item) => ({ ...item, block_version: 7, slots: {} })) };
    const second = canonicalToPuck(other);
    expect(puckToCanonical(first.data, first.context)).toEqual(source);
    expect(puckToCanonical(second.data, second.context)).toEqual(other);
    expect(first.context.blocks[id(2)]).toMatchObject({ blockVersion: 2, hadSlots: false, hadMotion: false, hadAppearance: false });
    expect(second.context.blocks[id(2)]).toMatchObject({ blockVersion: 7, hadSlots: true });
    const hero = first.data.content[0];
    if (hero.type !== 'Hero') throw new Error('Missing real Hero conversion');
    hero.props.title = 'Edited hero';
    const changed = puckToCanonical(first.data, first.context);
    expect(changed.blocks[0]).toEqual({ ...source.blocks[0], props: { ...source.blocks[0].props, title: 'Edited hero' } });
    expect(changed.blocks[1]).toEqual(source.blocks[1]);
    expect(source).toEqual(before);
  });

  it('round-trips nested slots, order, visibility, motion and responsive appearance', () => {
    const heading: PageBuilderBlock = {
      ...block(14, HEADING_BLOCK_TYPE, { eyebrow: '', heading: 'Nested heading', level: 2, anchor: 'nested-heading',
        appearance: { surface: 'default', spacing: 'normal', containerWidth: 'wide', elements: { heading: { weight: 'bold' } } } }),
      motion: { preset: 'reveal', intensity: 'strong', trigger: 'repeat', stagger_ms: 160 },
      visibility: { audience: 'member' }, responsive: { mobile: { appearance: { textAlign: 'right', spacing: 'compact' } } }, slots: {},
    };
    const buttons: PageBuilderBlock = { ...block(15, BUTTONS_BLOCK_TYPE, {
      alignment: 'right', items: [{ label: 'First', url: '/first', variant: 'primary' }, { label: 'Second', url: '/second', variant: 'text' }],
      appearance: { surface: 'default', spacing: 'normal' },
    }), slots: {} };
    const source: PageBuilderDocument = { ...document([{
      instance_id: id(11), type: LAYOUT_SECTION_BLOCK_TYPE, block_version: 1,
      props: { width: 'wide', spacing: 'normal' }, responsive: { tablet: { layout: { width: 'standard' } } },
      slots: { content: [{
        instance_id: id(12), type: LAYOUT_COLUMNS_BLOCK_TYPE, block_version: 1,
        props: { columns: 2, ratio: '1:2', gap: 'normal' }, responsive: { tablet: { layout: { columns: 1 } }, mobile: { layout: { columns: 1 } } },
        slots: { column1: [{ instance_id: id(13), type: LAYOUT_STACK_BLOCK_TYPE, block_version: 1, props: { gap: 'compact' },
          slots: { content: [heading] } }], column2: [buttons] },
      }] },
    }]), schema_version: 'g7-page-builder/v2' };
    const before = structuredClone(source);
    const session = canonicalToPuck(source);
    expect(puckToCanonical(session.data, session.context)).toEqual(source);
    const section = session.data.content[0];
    if (section.type !== 'LayoutSection') throw new Error('Missing Section');
    const columns = section.props.content[0];
    if (columns.type !== 'LayoutColumns') throw new Error('Missing Columns');
    const stack = columns.props.column1[0];
    if (stack.type !== 'LayoutStack') throw new Error('Missing Stack');
    const editorHeading = stack.props.content[0];
    if (editorHeading.type !== 'Heading') throw new Error('Missing Heading');
    expect(editorHeading.props.id).toBe(heading.instance_id);
    editorHeading.props.heading = 'Edited nested heading';
    const expected = structuredClone(source);
    const expectedHeading = expected.blocks[0].slots?.content[0].slots?.column1[0].slots?.content[0];
    if (!expectedHeading) throw new Error('Missing expected nested heading');
    expectedHeading.props.heading = 'Edited nested heading';
    expect(puckToCanonical(session.data, session.context)).toEqual(expected);
    expect(source).toEqual(before);
  });

  it('uses real external registration without rendering and preserves payload/default ownership', () => {
    const defaults = { title: 'Display title', optional: 'Default only', nestedDefault: { value: 3 } };
    const originalDefaults = structuredClone(defaults);
    registerExternalEditor({
      pack_id: 'test/pure-codec', pack_version: '1.0.0',
      blocks: [{ block_id: 'test.pure-codec-01', block_version: 3, editor_component: 'PureCodecProbe' }],
      components: { PureCodecProbe: { defaultProps: defaults, fields: { title: { type: 'text' } },
        render: () => { throw new Error('Canonical codec must not render'); } } },
    });
    const source = document([{
      ...block(20, 'test.pure-codec-01', { title: 'Owned title', id: 'payload-id', puck: { owned: true }, editMode: 'payload-edit',
        payload: { nested: ['A', { value: 1 }] }, metadata: { owned: 'metadata' }, motion: 'payload-motion',
        responsiveOverrides: { owned: true }, __g7pbVisibilityAudience: 'payload-audience' }),
      block_version: 3, motion: { preset: 'reveal', intensity: 'subtle', trigger: 'once', stagger_ms: 60 },
      visibility: { audience: 'guest' }, responsive: { tablet: { appearance: { spacing: 'compact' } } }, slots: { empty: [] },
    }]);
    const before = structuredClone(source);
    const session = canonicalToPuck(source);
    const external = session.data.content[0];
    if (!isExternalEditorItem(external)) throw new Error('Missing external conversion');
    expect(external.type).toBe('External_PureCodecProbe');
    expect(external.props.id).toBe(id(20));
    expect(external.props.payload).toMatchObject({ id: 'payload-id', optional: 'Default only', nestedDefault: { value: 3 } });
    expect(external.props.payload.payload).not.toBe(source.blocks[0].props.payload);
    expect(puckToCanonical(session.data, session.context)).toEqual(source);
    external.props.payload.optional = 'Explicit edit';
    const expected = structuredClone(source);
    expected.blocks[0].props.optional = 'Explicit edit';
    expect(puckToCanonical(session.data, session.context)).toEqual(expected);
    expect(source).toEqual(before);
    expect(defaults).toEqual(originalDefaults);
  });
});
