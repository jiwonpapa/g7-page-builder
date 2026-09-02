import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} } as typeof ResizeObserver;
});
import layoutFixture from '../Contract/document-layout-v2.fixture.json';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import { canonicalToPuck } from '../../resources/js/editor/puckBlockCodec';
import { editorInsertionDestination, editorItemLocations, resolveEditorSelection } from '../../resources/js/editor/puckEditorSelection';
import { layoutPolicy } from '../../resources/js/documents/layoutPolicy';

const sample = () => canonicalToPuck(structuredClone(layoutFixture) as PageBuilderDocument).data;

describe('shared Puck editor selection', () => {
  it('resolves a nested canvas ID to its owning slot instead of the root selection', () => {
    const data = sample();
    const heading = editorItemLocations(data).find(({ item }) => item.type === 'Heading')!;
    expect(heading.selector.zone).not.toBe('root:default-zone');
    const resolved = resolveEditorSelection(data, { index: 0, zone: 'root:default-zone' }, heading.item.props.id);
    expect(resolved?.item).toBe(heading.item);
    expect(resolved?.selector).toEqual(heading.selector);
  });

  it('does not apply stale canvas edits to an unrelated current selection', () => {
    expect(resolveEditorSelection(sample(), { index: 0, zone: 'root:default-zone' }, 'missing-id')).toBeNull();
  });

  it('honors a newer sibling selection made in the outline tree', () => {
    const data = sample();
    const locations = editorItemLocations(data);
    const heading = locations.find(({ item }) => item.type === 'Heading')!;
    const body = locations.find(({ item }) => item.type === 'RichText')!;
    expect(resolveEditorSelection(data, body.selector, heading.item.props.id)).toBeNull();
    expect(resolveEditorSelection(data, body.selector)?.item).toBe(body.item);
  });

  it('inserts after nested content, and into the first slot of a selected container', () => {
    const data = sample();
    const locations = editorItemLocations(data);
    const heading = locations.find(({ item }) => item.type === 'Heading')!;
    expect(editorInsertionDestination(data, heading.selector, 'Image')).toEqual({ ...heading.selector, index: heading.selector.index + 1 });
    const section = locations.find(({ item }) => item.type === 'LayoutSection')!;
    expect(editorInsertionDestination(data, section.selector, 'RichText').zone).toBe(`${section.item.props.id}:content`);
  });

  it('rejects incompatible nested blocks instead of silently inserting at the root', () => {
    const data = sample();
    const heading = editorItemLocations(data).find(({ item }) => item.type === 'Heading')!;
    expect(() => editorInsertionDestination(data, heading.selector, 'Hero')).toThrow('parent:');
  });

  it('counts every node in an inserted pattern before accepting the change', () => {
    expect(() => editorInsertionDestination(sample(), null, 'LayoutSection', layoutPolicy.limits.nodes)).toThrow('node_limit:');
  });

  it('enforces the shared slot limit before mutating Puck state', () => {
    const data = sample();
    const section = editorItemLocations(data).find(({ item }) => item.type === 'LayoutSection')!;
    const heading = editorItemLocations(data).find(({ item }) => item.type === 'Heading')!.item;
    if (section.item.type !== 'LayoutSection' || heading.type !== 'Heading') throw new Error('fixture must contain a section and heading');
    section.item.props.content = Array.from({ length: layoutPolicy.limits.slot_children }, (_, index) => ({ ...heading, props: { ...heading.props, id: `heading-${index}` } }));
    expect(() => editorInsertionDestination(data, section.selector, 'RichText')).toThrow('slot_limit:');
  });
});
