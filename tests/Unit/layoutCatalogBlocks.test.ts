import { describe, expect, it, vi } from 'vitest';

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
  type LayoutColumnsEditorProps,
} from '../../resources/js/editor/layoutCatalogBlocks';
import { resizeLayoutColumnsEditorProps as domainBackedResize } from '../../resources/js/editor/layoutEditorCommands';

const item = (type: string, id: string, props: Record<string, unknown> = {}) => ({
  type, props: { id, ...props },
});

describe('Puck layout structure controls', () => {
  it('rejects an impossible merge before confirmation without dropping any content', () => {
    const source = {
      columns: '2', ratio: '1:1', gap: 'normal',
      column1: Array.from({ length: 101 }, (_, index) => item('Heading', `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`)),
      column2: Array.from({ length: 100 }, (_, index) => item('Heading', `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`)),
    } as LayoutColumnsEditorProps & Record<string, unknown>;
    const before = structuredClone(source);
    expect(() => domainBackedResize(source, '1')).toThrow('slot_limit:');
    expect(source).toEqual(before);
  });

  it('moves removed columns to the final active column in order without mutating the source', () => {
    const source = {
      columns: '3', ratio: '1:1:1', gap: 'normal',
      column1: [item('Heading', 'heading-1')],
      column2: [item('RichText', 'body-1')],
      column3: [item('LayoutStack', 'stack-1', { content: [item('Divider', 'divider-1')] })],
    } as unknown as LayoutColumnsEditorProps & Record<string, unknown>;
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
      columns: '1', ratio: '1', gap: 'none', column1: [],
    } as LayoutColumnsEditorProps & Record<string, unknown>, '3');

    expect(result).toMatchObject({ movedNodes: 0, targetSlot: 'column3' });
    expect(result.props).toMatchObject({ columns: '3', ratio: '1:1:1', column1: [], column2: [], column3: [] });
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
