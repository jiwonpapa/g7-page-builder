import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config, PuckAction, UsePuckData } from '@puckeditor/core';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import type { EditorComponents } from '../../resources/js/editor/puckEditorTypes';
import type { PageDesignProps } from '../../resources/js/editor/pageDesignTokens';
import type { BlockGalleryItem } from '../../resources/js/editor/blockGalleryModel';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
const { Puck, usePuck } = await import('@puckeditor/core');
const { canonicalToPuck, puckToCanonical } = await import('../../resources/js/editor/puckBlockCodec');
const { pageBuilderPuckConfig } = await import('../../resources/js/editor/puckEditorConfig');
const { BlockCatalogContext } = await import('../../resources/js/editor/BlockCatalogContext');
const { StableAddBlockControls } = await import('../../resources/js/editor/BlockGalleryControls');
const { moveCanvasItem, updateCanvasCollection, updateCanvasContext, updateCanvasPath } = await import('../../resources/js/editor/canvasItemCommands');
const { editorItemLocations } = await import('../../resources/js/editor/puckEditorSelection');
const { collectionLimit } = await import('../../resources/js/editor/canvasEditingContract');

type EditorApi = UsePuckData<Config<EditorComponents, PageDesignProps>>;
const preset: BlockGalleryItem = {
  catalogId: 'synthetic-preset', kind: 'preset', type: 'Heading', testId: 'synthetic-preset', category: '기본',
  title: 'Synthetic preset', description: 'Fixture', searchText: 'Synthetic preset', blockId: 'content.heading-01',
  blockVersion: 1, favorite: false, presetProps: { eyebrow: '', heading: 'Inserted sentinel', level: 2, anchor: '' },
  thumbnail: '', packId: 'synthetic/fixture', packLabel: 'Fixture',
};
const heading = (text: string): PageBuilderBlock => ({ instance_id: crypto.randomUUID(), type: 'content.heading-01',
  block_version: 1, props: { eyebrow: '', heading: text, level: 2, anchor: '' }, slots: {} });
function fixture() {
  const first = heading('First sentinel'), second = heading('Second sentinel');
  const buttons: PageBuilderBlock = { instance_id: crypto.randomUUID(), type: 'action.buttons-01', block_version: 1,
    props: { alignment: 'left', items: [
      { label: 'Item A', url: '/a', variant: 'primary' }, { label: 'Item B', url: '/b', variant: 'secondary' },
    ], appearance: { surface: 'default', spacing: 'compact', elements: { 'items.0.label': { weight: 'bold' }, 'items.1.label': { tone: 'accent' }, title: { align: 'center' } } } }, slots: {} };
  const section: PageBuilderBlock = { instance_id: crypto.randomUUID(), type: 'layout.section-01', block_version: 1,
    props: { width: 'standard', spacing: 'normal' }, slots: { content: [first, second, buttons] } };
  const source: PageBuilderDocument = { schema_version: 'g7-page-builder/v2', document_id: crypto.randomUUID(),
    slug: 'synthetic-tools', mode: 'canvas', locale: 'ko', shell_mode: 'none', tokens: {}, blocks: [section] };
  return { source, section, first, second, buttons };
}
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach((run) => run())); });
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
async function mount() {
  const nodes = fixture(), session = canonicalToPuck(nodes.source);
  expect(puckToCanonical(session.data, session.context)).toEqual(nodes.source);
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); let api: EditorApi | null = null;
  function Tools() {
    api = usePuck<Config<EditorComponents, PageDesignProps>>();
    return <StableAddBlockControls dispatch={api.dispatch} data={api.appState.data}
      selectedIndex={api.appState.ui.itemSelector?.index ?? null}
      selectedZone={api.appState.ui.itemSelector?.zone ?? 'root:default-zone'} disabled={false} />;
  }
  const catalog = { items: [preset], toggleFavorite: async () => undefined };
  const render = (stamp: number) => root.render(<BlockCatalogContext.Provider value={catalog}>
    <span data-parent-stamp={stamp} />
    <Puck config={pageBuilderPuckConfig} data={session.data} iframe={{ enabled: false }}
      ui={{ itemSelector: { index: 0, zone: `${nodes.section.instance_id}:content` } }}>
      <Tools /><Puck.Preview />
    </Puck>
  </BlockCatalogContext.Provider>);
  cleanup.push(() => { root.unmount(); host.remove(); });
  await act(async () => render(0)); await flush();
  const current = (): EditorApi => { if (!api) throw new Error('Missing public Puck API'); return api; };
  const location = (id: string) => {
    const result = editorItemLocations(current().appState.data).find(({ item }) => item.props.id === id);
    if (!result) throw new Error(`Missing fixture item ${id}`);
    return result;
  };
  const command = async (actions: PuckAction[]) => { await act(async () => actions.forEach(current().dispatch)); await flush(); };
  // Puck groups consecutive edits for 250ms. Cross its normal history boundary
  // before assertions; no fake history implementation or scheduler override.
  const settleHistory = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 260)); }); };
  const undo = async () => { await act(async () => current().history.back()); await flush(); };
  const canonical = () => puckToCanonical(current().appState.data, session.context);
  return { ...nodes, host, current, location, command, settleHistory, undo, canonical, render };
}

describe('editor tool owners through real Puck', () => {
  it('preserves gallery input identity and inserts a complete nested preset as one native Undo entry', async () => {
    const test = await mount();
    await act(async () => test.host.querySelector<HTMLButtonElement>('[data-testid="page-builder-add-block"]')!.click());
    const input = document.querySelector<HTMLInputElement>('[aria-label="블록 검색"]');
    if (!input) throw new Error('Missing gallery search');
    await act(async () => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Synthetic');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => test.render(1));
    await test.command([{ type: 'setUi', ui: { itemSelector: { index: 1, zone: `${test.section.instance_id}:content` } }, recordHistory: false }]);
    expect(document.querySelector('[aria-label="블록 검색"]')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Synthetic');
    await test.settleHistory();
    await act(async () => document.querySelector<HTMLButtonElement>('[data-testid="synthetic-preset"]')!.click());
    await vi.waitFor(async () => { await flush(); expect(test.canonical().blocks[0].slots?.content).toHaveLength(4); });
    const inserted = test.canonical().blocks[0].slots!.content[2];
    expect(inserted.props).toEqual(preset.presetProps);
    expect(inserted.type).toBe(preset.blockId);
    expect(inserted.instance_id).not.toBe(test.first.instance_id);
    expect(test.current().appState.ui.itemSelector).toEqual({ index: 2, zone: `${test.section.instance_id}:content` });
    expect(test.current().getItemById(inserted.instance_id)?.props.id).toBe(inserted.instance_id);
    await test.settleHistory();
    await test.undo();
    expect(test.canonical()).toEqual(test.source);
  });

  it('reorders only the selected nested zone, keeps its ID selected and restores the original tree with Undo', async () => {
    const test = await mount();
    await test.settleHistory();
    await test.command(moveCanvasItem(test.current().appState.data, test.location(test.first.instance_id), 1));
    expect(test.canonical().blocks[0].slots?.content?.map((item) => item.instance_id))
      .toEqual([test.second.instance_id, test.first.instance_id, test.buttons.instance_id]);
    expect(test.current().selectedItem?.props.id).toBe(test.first.instance_id);
    expect(moveCanvasItem(test.current().appState.data, test.location(test.first.instance_id), -1)).toEqual([]);
    expect(moveCanvasItem(test.current().appState.data, test.location(test.first.instance_id), 3)).toEqual([]);
    await test.settleHistory(); await test.undo();
    expect(test.canonical()).toEqual(test.source);
  });

  it('remaps collection styles and enforces existing min/max while native Undo restores source values', async () => {
    const test = await mount();
    await test.settleHistory();
    const plan = updateCanvasCollection(test.location(test.buttons.instance_id), 'items', 0, 'duplicate');
    if (!plan) throw new Error('Missing collection plan');
    expect(plan.nextIndex).toBe(1);
    await test.command([plan.action]);
    const current = test.canonical().blocks[0].slots!.content[2];
    expect(current.instance_id).toBe(test.buttons.instance_id);
    const originalItems = test.buttons.props.items;
    if (!Array.isArray(originalItems)) throw new Error('Missing fixture collection');
    expect(current.props.items).toEqual([originalItems[0], originalItems[0], originalItems[1]]);
    expect(current.props.appearance).toEqual({ surface: 'default', spacing: 'compact', elements: { 'items.0.label': { weight: 'bold' }, 'items.1.label': { weight: 'bold' },
      'items.2.label': { tone: 'accent' }, title: { align: 'center' } } });
    const original = test.location(test.buttons.instance_id);
    if (original.item.type !== 'Buttons') throw new Error('Missing Buttons');
    for (const index of [-1, 0.5, original.item.props.items.length, Number.NaN]) {
      for (const operation of ['up', 'down', 'duplicate', 'delete'] as const) {
        expect(updateCanvasCollection(original, 'items', index, operation)).toBeNull();
      }
    }
    const limits = collectionLimit('Buttons', 'items');
    if (!limits) throw new Error('Missing established collection limit');
    for (const [count, operation] of [[limits.min, 'delete'], [limits.max, 'duplicate']] as const) {
      const bounded = { ...original, item: { ...original.item, props: { ...original.item.props,
        items: Array.from({ length: count }, () => ({ label: 'Bound', url: '/bound', variant: 'primary' as const })) } } };
      expect(updateCanvasCollection(bounded, 'items', 0, operation)).toBeNull();
    }
    await test.settleHistory(); await test.undo();
    expect(test.canonical()).toEqual(test.source);
  });

  it('keeps normal spacing after a Buttons collection command and native Undo', async () => {
    const test = await mount();
    await test.settleHistory();
    await test.command([updateCanvasContext(test.location(test.buttons.instance_id), { spacing: 'normal' })]);
    const expected = structuredClone(test.source);
    const expectedButtons = expected.blocks[0].slots!.content[2];
    const appearance = expectedButtons.props.appearance;
    if (!appearance || typeof appearance !== 'object' || Array.isArray(appearance)) throw new Error('Missing appearance');
    expectedButtons.props.appearance = { ...appearance, spacing: 'normal' };
    expect(test.canonical()).toEqual(expected);
    await test.settleHistory();
    const duplicate = updateCanvasCollection(test.location(test.buttons.instance_id), 'items', 0, 'duplicate');
    if (!duplicate) throw new Error('Missing duplicate plan');
    await test.command([duplicate.action]);
    expect(test.canonical().blocks[0].slots!.content[2].props.appearance).toMatchObject({ spacing: 'normal' });
    await test.settleHistory(); await test.undo();
    expect(test.canonical()).toEqual(expected);
    await test.undo();
    expect(test.canonical()).toEqual(test.source);
  });

  it('preserves external payload and metadata at context and path replacement boundaries', () => {
    const payload = { id: 'payload-id', puck: 'payload-puck', editMode: 'payload-edit', title: 'Original', motion: { own: true } };
    const metadata = { visibility: { audience: 'member' as const }, emptySlotNames: ['body'] };
    const location = { item: { type: 'External_SyntheticTool' as const, props: { id: 'puck-id', payload, metadata } },
      selector: { index: 2, zone: 'parent:content' }, depth: 2 };
    const before = structuredClone(location);
    const patched = updateCanvasContext(location, { surface: 'soft' });
    const path = updateCanvasPath(location, 'payload.title', 'Changed');
    if (patched.type !== 'replace' || path.type !== 'replace') throw new Error('Expected replacement plans');
    expect(patched.data).toEqual({ ...location.item, props: { ...location.item.props, payload: { ...payload, surface: 'soft' } } });
    expect(path.data).toEqual({ ...location.item, props: { ...location.item.props, payload: { ...payload, title: 'Changed' } } });
    expect(patched.data.props.metadata.visibility).toBe(metadata.visibility);
    expect(path.data.props.metadata).toEqual(metadata);
    expect(path.data.props.metadata).not.toBe(metadata); // Existing path updates deep-copy the props envelope.
    expect(patched.destinationZone).toBe('parent:content');
    expect(path.destinationIndex).toBe(2);
    expect(location).toEqual(before);
  });
});
