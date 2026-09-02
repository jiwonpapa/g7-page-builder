import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '@puckeditor/core';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import type { EditorComponents } from '../../resources/js/editor/puckEditorTypes';
import type { PageDesignProps } from '../../resources/js/editor/pageDesignTokens';
import { isExternalEditorItem } from '../../resources/js/blocks/externalEditorData';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
const { Puck, usePuck } = await import('@puckeditor/core');
const { externalEditorComponents, catalogEditorName } = await import('../../resources/js/blocks/runtimeRegistry');
const { canonicalToPuck, puckToCanonical } = await import('../../resources/js/editor/puckBlockCodec');
const { pageBuilderPuckConfig, PuckEditorAdapter } = await import('../../resources/js/editor/PuckEditorAdapter');
type EditorConfig = Config<EditorComponents, PageDesignProps>;
type EditorApi = ReturnType<typeof usePuck<EditorConfig>>;
const componentName = 'VendorNativeSynthetic', internalName = 'External_VendorNativeSynthetic';
const defaults = { title: 'Default inline title', id: 'payload-default-id', motion: 'raw motion', puck: 'raw puck',
  editMode: 'raw editMode', containerWidth: 'raw width', responsiveOverrides: { arbitrary: true }, __g7pbData: { value: 1 } };
window.G7PageBuilderBlockPacks?.register({ pack_id: 'vendor/native-synthetic', pack_version: '1.0.0',
  blocks: [{ block_id: 'vendor.native-synthetic', block_version: 2, editor_component: componentName }],
  components: { [componentName]: { defaultProps: defaults,
    fields: { title: { type: 'text', label: 'Title', contentEditable: true }, id: { type: 'text', label: 'Payload id' },
      motion: { type: 'text', label: 'Payload motion' }, puck: { type: 'text', label: 'Payload puck' }, editMode: { type: 'text', label: 'Payload edit mode' } },
    render: ({ title, id, puck, editMode }) => <article data-native-external={id} data-editing={puck.isEditing && editMode}>
      <h2>{React.isValidElement(title) ? title : String(title)}</h2>
    </article>,
  } },
});
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach((run) => run())); });

function fixture(props: Record<string, unknown>): PageBuilderDocument {
  return { schema_version: 'g7-page-builder/v1', document_id: crypto.randomUUID(), slug: 'synthetic-external', mode: 'canvas', locale: 'ko',
    blocks: [{ instance_id: crypto.randomUUID(), type: 'vendor.native-synthetic', block_version: 2, props,
      motion: { preset: 'reveal', intensity: 'subtle', trigger: 'once', stagger_ms: 60 },
      visibility: { audience: 'member' }, responsive: { mobile: { appearance: { spacing: 'compact' } } }, slots: { first: [], second: [] } }] };
}
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
async function mount(source: PageBuilderDocument) {
  const session = canonicalToPuck(source), host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); let api: EditorApi | null = null;
  function Capture() { api = usePuck<EditorConfig>(); return <></>; }
  const config: EditorConfig = { ...pageBuilderPuckConfig, components: { ...pageBuilderPuckConfig.components, ...externalEditorComponents() } };
  cleanup.push(() => { root.unmount(); host.remove(); });
  await act(async () => root.render(<Puck<EditorConfig> config={config} data={session.data} iframe={{ enabled: false }}
    ui={{ itemSelector: { index: 0, zone: 'root:default-zone' } }} overrides={{ headerActions: Capture }} />));
  const current = (): EditorApi => { if (!api) throw new Error('Missing public Puck API'); return api; };
  await vi.waitFor(async () => { await flush(); expect(host.querySelector('h2 [contenteditable]'), host.querySelector('article')?.outerHTML).not.toBeNull(); });
  const command = async (run: (value: EditorApi) => void) => { await act(async () => run(current())); await flush(); };
  const canonical = () => puckToCanonical(current().appState.data, session.context);
  const input = (label: string): HTMLInputElement => {
    const field = Array.from(host.querySelectorAll('label')).find((candidate) => candidate.textContent?.includes(label))?.querySelector('input');
    if (!(field instanceof HTMLInputElement)) throw new Error(`Missing real Puck field: ${label}`);
    return field;
  };
  const edit = async (label: string, value: string) => {
    const field = input(label);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (!setter) throw new Error('Missing input setter');
      setter.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flush();
  };
  // Puck intentionally groups changes for 250ms. Separate native history actions
  // with its public state settling; this changes no product scheduler or store.
  const historyBoundary = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 260)); }); };
  return { host, current, command, canonical, input, edit, historyBoundary };
}

describe('external blocks through real Puck', () => {
  it('displays missing contentEditable defaults while preserving the exact original document', async () => {
    const source = fixture({});
    const test = await mount(source);
    expect(test.host.querySelector('h2 [contenteditable]')?.textContent).toBe(defaults.title);
    expect(test.canonical()).toEqual(source);
    await test.edit('Title', 'Edited title');
    await vi.waitFor(() => expect(test.canonical().blocks[0].props).toEqual({ title: 'Edited title' }));
  });

  it('applies and clears common effects through the actual editor header without touching pack motion', async () => {
    const source = fixture(defaults), host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host); let saved: PageBuilderDocument = source;
    cleanup.push(() => { root.unmount(); host.remove(); });
    await act(async () => root.render(<PuckEditorAdapter document={source} revisionKey={0} iframeEnabled={false}
      onChange={(next) => { saved = next; }} onPublish={() => undefined} />));
    for (const [testId, expected] of [['page-builder-clear-motion', 'none'], ['page-builder-auto-motion', 'reveal']]) {
      const button = host.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
      if (!button) throw new Error('Missing actual editor effect control');
      await act(async () => button.click());
      await vi.waitFor(async () => { await flush(); expect(saved.blocks[0].motion?.preset).toBe(expected); });
      expect(saved.blocks[0].props).toEqual(source.blocks[0].props);
      expect(saved.blocks[0].visibility).toEqual(source.blocks[0].visibility);
    }
  });

  it('preserves payload and metadata through native duplicate, field editing, Undo, Redo and insert', async () => {
    const source = fixture({ ...defaults, title: 'Original', id: 'raw original id', metadata: { original: true }, payload: { original: true } });
    const test = await mount(source);
    expect(catalogEditorName({ block_id: 'vendor.native-synthetic', block_version: 2, editor_component: componentName }, pageBuilderPuckConfig.components)).toBe(internalName);
    expect(test.canonical()).toEqual(source);
    await test.historyBoundary();
    await test.command((api) => api.dispatch({ type: 'duplicate', sourceZone: 'root:default-zone', sourceIndex: 0 }));
    await test.historyBoundary();
    const duplicated = test.canonical().blocks[1];
    expect(duplicated).toEqual({ ...source.blocks[0], instance_id: duplicated.instance_id });
    expect(duplicated.instance_id).not.toBe(source.blocks[0].instance_id);
    await test.command((api) => api.dispatch({ type: 'setUi', ui: { itemSelector: { index: 1, zone: 'root:default-zone' } }, recordHistory: false }));
    await test.edit('Payload id', 'changed payload id');
    await vi.waitFor(() => expect(test.canonical().blocks[1].props.id).toBe('changed payload id'));
    expect(test.canonical().blocks[0]).toEqual(source.blocks[0]);
    expect(test.canonical().blocks[1].instance_id).toBe(duplicated.instance_id);
    await test.historyBoundary();
    await test.command((api) => api.history.back());
    expect(test.canonical().blocks[1]).toEqual(duplicated);
    await test.command((api) => api.history.forward());
    expect(test.canonical().blocks[1].props.id).toBe('changed payload id');
    await test.historyBoundary();
    await test.command((api) => api.dispatch({ type: 'insert', componentType: internalName, destinationZone: 'root:default-zone', destinationIndex: 2 }));
    const inserted = test.canonical().blocks[2];
    expect(inserted).toEqual({ instance_id: inserted.instance_id, type: 'vendor.native-synthetic', block_version: 2, props: defaults, slots: {} });
    const native = test.current().appState.data.content[2];
    expect(isExternalEditorItem(native)).toBe(true);
    expect(test.canonical().blocks[0]).toEqual(source.blocks[0]);
  });
});
