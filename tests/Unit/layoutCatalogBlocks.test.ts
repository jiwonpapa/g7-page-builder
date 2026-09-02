import { describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.hoisted(() => {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as typeof ResizeObserver;
});

import {
  layoutCatalogComponentConfigs,
  resizeLayoutColumnsEditorProps,
} from '../../resources/js/editor/layoutCatalogBlocks';
import { resizeLayoutColumnsEditorProps as domainBackedResize } from '../../resources/js/editor/layoutEditorCommands';

import { puckLayoutChildren, puckLayoutSlot, type LayoutColumnsPuckItem, type PuckEditorItem } from '../../resources/js/editor/puckLayoutData';

const appearance = { surface: 'default', spacing: 'normal',
  motion: { preset: 'none', intensity: 'subtle', trigger: 'once', stagger_ms: 100 } } as const;
const heading = (id: string): Extract<PuckEditorItem, { type: 'Heading' }> => ({
  type: 'Heading', props: { id, eyebrow: '', heading: 'Synthetic heading', level: '2', anchor: '', ...appearance },
});
const richText = (id: string): Extract<PuckEditorItem, { type: 'RichText' }> => ({
  type: 'RichText', props: { id, content: '<p>Synthetic body</p>', measure: 'standard', ...appearance },
});
const stack = (id: string): Extract<PuckEditorItem, { type: 'LayoutStack' }> => ({
  type: 'LayoutStack', props: { id, gap: 'normal', content: [{
    type: 'Divider', props: { id: 'divider-1', variant: 'solid', width: 'standard', label: '', ...appearance },
  }] },
});

describe('Puck layout structure controls', () => {
  it('rejects an impossible merge before confirmation without dropping any content', () => {
    const source: LayoutColumnsPuckItem['props'] = {
      id: 'columns-1', columns: '2', ratio: '1:1', gap: 'normal',
      column1: Array.from({ length: 101 }, (_, index) => heading(`10000000-0000-4000-8000-${String(index).padStart(12, '0')}`)),
      column2: Array.from({ length: 100 }, (_, index) => heading(`20000000-0000-4000-8000-${String(index).padStart(12, '0')}`)),
    };
    const before = structuredClone(source);
    expect(() => domainBackedResize(source, '1')).toThrow('slot_limit:');
    expect(source).toEqual(before);
  });

  it('moves removed columns to the final active column in order without mutating the source', () => {
    const source: LayoutColumnsPuckItem['props'] = {
      id: 'columns-1', columns: '3', ratio: '1:1:1', gap: 'normal',
      column1: [heading('heading-1')],
      column2: [richText('body-1')],
      column3: [stack('stack-1')],
    };
    const before = structuredClone(source);

    const result = resizeLayoutColumnsEditorProps(source, '1');

    expect(result.movedNodes).toBe(3);
    expect(result.targetSlot).toBe('column1');
    expect(result.props.ratio).toBe('1');
    expect(result.props.column1?.map((entry) => entry.type)).toEqual(['Heading', 'RichText', 'LayoutStack']);
    expect(result.props).not.toHaveProperty('column2');
    expect(result.props).not.toHaveProperty('column3');
    expect(source).toEqual(before);
  });

  it('expands one column to three with valid empty slots and ratio', () => {
    const result = resizeLayoutColumnsEditorProps({
      id: 'columns-1', columns: '1', ratio: '1', gap: 'none', column1: [],
    }, '3');

    expect(result).toMatchObject({ movedNodes: 0, targetSlot: 'column3' });
    expect(result.props).toMatchObject({ columns: '3', ratio: '1:1:1', column1: [], column2: [], column3: [] });
  });

  it('preserves identified nested props and metadata while keeping the source independent', () => {
    const source = Object.assign({
      id: 'columns-1', columns: '3', ratio: '1:1:1', gap: 'normal',
      column1: [heading('heading-1')], column2: [richText('body-1')], column3: [stack('stack-1')],
      containerWidth: 'wide', responsiveOverrides: { tablet: { layout: { columns: 2 } } },
    } satisfies LayoutColumnsPuckItem['props'], { extension: { preserved: true } });
    const before = structuredClone(source);
    const result = resizeLayoutColumnsEditorProps(source, '2');
    expectTypeOf(result.props.id).toEqualTypeOf<string>();
    expectTypeOf(result.props.column1).toEqualTypeOf<PuckEditorItem[]>();
    expect(result.props).toMatchObject({ id: 'columns-1', ratio: '1:1', containerWidth: 'wide',
      responsiveOverrides: source.responsiveOverrides, extension: { preserved: true } });
    expect(result.props.column2).toEqual([source.column2[0], source.column3[0]]);
    expect(result.props.column2?.[1].props.id).toBe('stack-1');
    expect(puckLayoutChildren(result.props.column2![1])[0].props.id).toBe('divider-1');
    result.props.column1[0].props.id = 'changed';
    expect(source).toEqual(before);
  });

  it('rejects duplicate identities without mutating either original slot', () => {
    const source: LayoutColumnsPuckItem['props'] = { id: 'columns-1', columns: '2', ratio: '1:1', gap: 'normal',
      column1: [heading('same-id')], column2: [richText('same-id')] };
    const before = structuredClone(source);
    expect(() => resizeLayoutColumnsEditorProps(source, '1')).toThrow('duplicate_id:');
    expect(source).toEqual(before);
  });

  it('reads only the selected layout slots and retains each original child reference', () => {
    const nested = stack('stack-1');
    const columns: LayoutColumnsPuckItem = { type: 'LayoutColumns', props: {
      id: 'columns-1', columns: '2', ratio: '1:1', gap: 'normal', column1: [heading('heading-1')], column2: [nested],
    } };
    expect(puckLayoutSlot(columns, 'column2')).toBe(columns.props.column2);
    expect(puckLayoutChildren(columns)).toEqual([columns.props.column1[0], nested]);
    expect(puckLayoutChildren(nested)[0]).toBe(nested.props.content[0]);
    expect(puckLayoutSlot(columns, 'content')).toBeUndefined();
    expect(puckLayoutSlot(heading('leaf-1'), 'content')).toBeUndefined();
  });

  it('keeps default Slot identities optional until Puck inserts the structure', () => {
    const defaults = layoutCatalogComponentConfigs.LayoutSection.defaultProps;
    expect(defaults?.content[0].props.id).toBeUndefined();
    expect(defaults?.content[0].props.column1[0].props.id).toBeUndefined();
    expect(defaults?.content[0].props.column2[0].props.id).toBeUndefined();
  });

  it('declares the same restricted children for slots and disables native container deletion', () => {
    const section = layoutCatalogComponentConfigs.LayoutSection;
    const columns = layoutCatalogComponentConfigs.LayoutColumns;
    const stack = layoutCatalogComponentConfigs.LayoutStack;
    expect(section.permissions?.delete).toBe(false);
    expect(columns.permissions?.delete).toBe(false);
    expect(stack.permissions?.delete).toBe(false);
    expect(section.fields?.content).toMatchObject({
      type: 'slot', allow: ['LayoutColumns', 'LayoutStack', 'Heading', 'RichText', 'Image', 'Buttons', 'Divider'],
    });
    expect(columns.fields?.column1).toMatchObject({
      type: 'slot', allow: ['LayoutStack', 'Heading', 'RichText', 'Image', 'Buttons', 'Divider'],
    });
    expect(stack.fields?.content).toMatchObject({
      type: 'slot', allow: ['Heading', 'RichText', 'Image', 'Buttons', 'Divider'],
    });
  });
});
