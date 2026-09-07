import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} } as typeof ResizeObserver;
});
import layoutFixture from '../Contract/document-layout-v2.fixture.json';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import { canonicalToPuck } from '../../resources/js/editor/puckBlockCodec';
import { activeEditorSlots, assertEditorInsertion, assertEditorMove, editorDefaultInsertionTarget, editorInsertionDestination, editorInsertionTargets, editorItemLocations, editorMoveDestinations, editorSelectionAncestors, editorSubtreeSize, resolveEditorSelection } from '../../resources/js/editor/puckEditorSelection';
import { layoutCatalogComponentConfigs } from '../../resources/js/editor/layoutCatalogBlocks';
import { registerExternalEditor } from '../../resources/js/blocks/externalEditorRegistryData';
import { duplicateCanvasItem, moveCanvasItemTo } from '../../resources/js/editor/canvasItemCommands';
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


describe('contextual placement policy', () => {
  it('never redirects an incompatible insertion beside a selected container', () => {
    const data = sample(), section = editorItemLocations(data)[0];
    expect(editorDefaultInsertionTarget(data, section.selector).selector.zone).toBe(`${section.item.props.id}:content`);
    expect(() => editorInsertionDestination(data, section.selector, 'Hero')).toThrow('parent:');
    expect(editorInsertionDestination(data, null, 'Hero').zone).toBe('root:default-zone');
  });

  it('offers only active declared slots and disambiguates repeated container paths', () => {
    const data = sample(), columns = editorItemLocations(data).find(({ item }) => item.type === 'LayoutColumns')!;
    if (columns.item.type !== 'LayoutColumns') throw new Error('Columns required');
    columns.item.props.column3 = [];
    Object.assign(columns.item.props, { invented: [] });
    expect(activeEditorSlots(columns.item.type, columns.item.props)).toEqual(['column1', 'column2']);
    const targets = editorInsertionTargets(data);
    expect(targets.map(({ selector }) => selector.zone)).not.toContain(`${columns.item.props.id}:column3`);
    expect(targets.map(({ selector }) => selector.zone)).not.toContain(`${columns.item.props.id}:invented`);
    expect(targets.map(({ label }) => label)).toContain('구역 1 › 열 묶음 1 › 2열');
    expect(() => assertEditorInsertion(data, { zone: `${columns.item.props.id}:column3`, index: 0 }, 'Heading')).toThrow('slot:');
    expect(() => assertEditorInsertion(data, { zone: `${columns.item.props.id}:invented`, index: 0 }, 'Heading')).toThrow('slot:');
    expect(activeEditorSlots('Buttons', { items: [] })).toEqual([]);
  });

  it('provides a real parent chain without changing selection or document', () => {
    const data = sample(), before = structuredClone(data);
    const leaf = editorItemLocations(data).find(({ item }) => item.type === 'Heading')!;
    expect(editorSelectionAncestors(data, leaf).map(({ item }) => item.type)).toEqual(['LayoutSection', 'LayoutColumns']);
    expect(data).toEqual(before);
    expect(() => editorDefaultInsertionTarget(data, { zone: 'missing:content', index: 0 })).toThrow('not_found:');
  });

  it('counts the real Section defaults and rejects the whole subtree at the node and depth boundaries', () => {
    const size = editorSubtreeSize('LayoutSection', { ...layoutCatalogComponentConfigs.LayoutSection.defaultProps });
    expect(size).toEqual({ nodes: 4, depth: 3 });
    const data = sample(), heading = editorItemLocations(data).find(({ item }) => item.type === 'Heading')!.item;
    if (heading.type !== 'Heading') throw new Error('Heading required');
    data.content = Array.from({ length: 497 }, (_, index) => ({ ...heading, props: { ...heading.props, id: `node-${index}` } }));
    expect(() => assertEditorInsertion(data, { zone: 'root:default-zone', index: 497 }, 'LayoutSection', size.nodes, size.depth)).toThrow('node_limit:');
    data.content.pop();
    expect(() => assertEditorInsertion(data, { zone: 'root:default-zone', index: 496 }, 'LayoutSection', size.nodes, size.depth)).not.toThrow();
    expect(() => assertEditorInsertion(sample(), { zone: 'root:default-zone', index: 0 }, 'LayoutSection', 5, 5)).toThrow('depth_limit:');
  });

  it('rejects forged and stale move commands before dispatch and preserves every node', () => {
    const data = sample(), before = structuredClone(data), locations = editorItemLocations(data);
    const heading = locations.find(({ item }) => item.type === 'Heading')!;
    const section = locations[0];
    for (const destination of [
      { zone: `${heading.item.props.id}:content`, index: 0 },
      { zone: heading.selector.zone, index: 100 },
      { zone: 'missing:content', index: 0 },
    ]) expect(moveCanvasItemTo(data, heading, destination)).toEqual([]);
    const descendant = { zone: heading.selector.zone, index: 0 };
    expect(() => assertEditorMove(data, section, descendant)).toThrow('descendant:');
    expect(moveCanvasItemTo(data, section, descendant)).toEqual([]);
    const stale = { ...heading, selector: { ...heading.selector, index: 30 } };
    expect(moveCanvasItemTo(data, stale, { zone: 'root:default-zone', index: 1 })).toEqual([]);
    expect(duplicateCanvasItem(data, stale)).toEqual([]);
    expect(data).toEqual(before);
  });

  it('matches move menu reasons with executable commands at slot limits', () => {
    const data = sample(), locations = editorItemLocations(data);
    const heading = locations.find(({ item }) => item.type === 'Heading')!;
    const columns = locations.find(({ item }) => item.type === 'LayoutColumns')!;
    if (columns.item.type !== 'LayoutColumns') throw new Error('Columns required');
    const sourceHeading = heading.item;
    if (sourceHeading.type !== 'Heading') throw new Error('Heading required');
    columns.item.props.column2 = Array.from({ length: 200 }, (_, index) => ({ ...sourceHeading, props: { ...sourceHeading.props, id: `full-${index}` } }));
    const target = editorMoveDestinations(data, heading).find(({ selector }) => selector.zone === `${columns.item.props.id}:column2`)!;
    expect(target.valid).toBe(false);
    expect(target.reason).toContain('200');
    expect(moveCanvasItemTo(data, heading, target.selector)).toEqual([]);
    const fullChild = editorItemLocations(data).find(({ selector }) => selector.zone === target.selector.zone)!;
    expect(duplicateCanvasItem(data, fullChild)).toEqual([]);
    expect(moveCanvasItemTo(data, fullChild, { zone: target.selector.zone, index: 1 })).toHaveLength(2);
  });

  it('preserves v1 external packs and does not apply v2 limits retroactively', () => {
    registerExternalEditor({ pack_id: 'ep1/placement', pack_version: '1.0.0',
      blocks: [{ block_id: 'ep1.external-01', block_version: 1, editor_component: 'PlacementExternal' }],
      components: { PlacementExternal: { defaultProps: { title: '' }, render: () => createElement('span') } } });
    const data = sample(); data.content = [];
    const target = { zone: 'root:default-zone', index: 0 };
    expect(() => assertEditorInsertion(data, target, 'External_PlacementExternal', 1, 1, false)).not.toThrow();
    expect(() => assertEditorInsertion(data, target, 'External_PlacementExternal', 1, 1, true)).toThrow('parent:');
    expect(() => assertEditorInsertion(data, target, 'External_Unregistered', 1, 1, false)).toThrow('parent:');
    expect(() => assertEditorInsertion(data, target, 'Heading', 501, 1, false)).not.toThrow();
    expect(() => assertEditorInsertion(data, target, 'Heading', 501, 1, true)).toThrow('node_limit:');
  });
});
