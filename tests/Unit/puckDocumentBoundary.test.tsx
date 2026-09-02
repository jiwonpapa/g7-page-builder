import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '@puckeditor/core';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import type { EditorComponents } from '../../resources/js/editor/puckEditorTypes';
import type { PageDesignProps } from '../../resources/js/editor/pageDesignTokens';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
const { Puck, usePuck } = await import('@puckeditor/core');
const { canonicalToPuck } = await import('../../resources/js/editor/puckBlockCodec');
const { PuckDocumentBoundary, usePuckDocumentBoundary } = await import('../../resources/js/editor/PuckDocumentBoundary');
type EditorApi = ReturnType<typeof usePuck<Config<EditorComponents, PageDesignProps>>>;
const { pageBuilderPuckConfig } = await import('../../resources/js/editor/puckEditorConfig');
const config: Config<EditorComponents, PageDesignProps> = {
  components: {
    ...pageBuilderPuckConfig.components,
    Heading: { ...pageBuilderPuckConfig.components.Heading, render: ({ heading }) => <h2 data-synthetic-heading>{String(heading)}</h2> },
    LayoutSection: { ...pageBuilderPuckConfig.components.LayoutSection, render: ({ content: Content }) => <section><Content /></section> },
    LayoutStack: { ...pageBuilderPuckConfig.components.LayoutStack, render: ({ content: Content }) => <div><Content /></div> },
  },
};
const heading = (): PageBuilderBlock => ({ instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
  props: { eyebrow: '', heading: 'Initial', level: 2, anchor: '' } });
function fixture(count: number): PageBuilderDocument {
  return { schema_version: 'g7-page-builder/v2', document_id: crypto.randomUUID(), slug: 'native-boundary', locale: 'ko', mode: 'canvas',
    blocks: [{ instance_id: crypto.randomUUID(), type: 'layout.section-01', block_version: 1,
      props: { width: 'standard', spacing: 'normal' }, slots: { content: Array.from({ length: count }, heading) } }] };
}
const cleanups: Array<() => void> = [];
afterEach(async () => { await act(async () => { cleanups.splice(0).forEach((cleanup) => cleanup()); }); vi.useRealTimers(); });

async function mount(source: PageBuilderDocument, strict = false) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  const initial = canonicalToPuck(source);
  let api: EditorApi | null = null;
  let canonical = source;
  let editable = true;
  let capturedBoundary: ReturnType<typeof usePuckDocumentBoundary>['boundary'] | null = null;
  let mounted = true;
  const dirty = vi.fn();
  const changed = vi.fn((value: PageBuilderDocument) => { canonical = value; });
  function Capture() { api = usePuck<Config<EditorComponents, PageDesignProps>>(); return null; }
  function Editor() {
    const context = useRef(initial.context);
    const { boundary, data, recovering, message } = usePuckDocumentBoundary(initial, { context, canEdit: editable, onDirty: dirty, onChange: changed });
    capturedBoundary = boundary;
    // Only synthetic Heading/Section/Stack instances are rendered and checked.
    return <><output data-recovering={recovering}>{message}</output>
      <Puck config={config} data={data} iframe={{ enabled: false }}
        onAction={boundary.onAction} onChange={boundary.onChange}
        overrides={{ headerActions: () => <><Capture /><PuckDocumentBoundary boundary={boundary} /></> }} />
    </>;
  }
  const render = () => root.render(strict ? <React.StrictMode><Editor /></React.StrictMode> : <Editor />);
  await act(async () => { render(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const unmount = () => { if (mounted) { mounted = false; root.unmount(); host.remove(); } };
  cleanups.push(unmount);
  const current = (): EditorApi => { if (!api) throw new Error('Missing public Puck API'); return api; };
  const command = async (run: (value: EditorApi) => void) => { await act(async () => { run(current()); }); };
  // Advance only Puck's documented 250ms history debounce; assertions inspect actual public state.
  const record = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(251); }); };
  const count = () => host.querySelectorAll('[data-synthetic-heading]').length;
  const readonly = async () => { editable = false; await act(async () => { render(); }); };
  const callbacks = () => { if (!capturedBoundary) throw new Error('Missing boundary callbacks'); return capturedBoundary; };
  return { host, current, command, record, count, readonly, dirty, changed, canonical: () => canonical, initial, callbacks, unmount };
}

function nestedZone(source: PageBuilderDocument): string { return `${source.blocks[0].instance_id}:content`; }
async function replaceTitle(test: Awaited<ReturnType<typeof mount>>, title: string) {
  const first = test.current().getItemById(test.canonical().blocks[0].slots!.content[0].instance_id);
  if (!first || first.type !== 'Heading') throw new Error('Missing synthetic heading');
  await test.command((api) => api.dispatch({ type: 'replace', destinationZone: nestedZone(test.canonical()), destinationIndex: 0,
    data: { ...first, props: { ...first.props, heading: title } } }));
}

describe('real Puck public command boundary', () => {
  it('delivers a valid canonical edit before the native command returns', async () => {
    const source = fixture(1), test = await mount(source);
    await test.command((api) => {
      const item = api.getItemById(source.blocks[0].slots!.content[0].instance_id);
      if (!item || item.type !== 'Heading') throw new Error('Missing synthetic heading');
      api.dispatch({ type: 'replace', destinationZone: nestedZone(source), destinationIndex: 0,
        data: { ...item, props: { ...item.props, heading: 'Immediate canonical' } } });
      // No RAF, timer, React effect or save callback runs between dispatch and this assertion.
      expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Immediate canonical');
      expect(test.dirty).toHaveBeenCalledOnce();
    });
  });

  it('restores a rejected duplicate, selection and original history while canonical saving stays valid', async () => {
    const source = fixture(200), test = await mount(source), zone = nestedZone(source);
    await test.command((api) => api.dispatch({ type: 'setUi', ui: { itemSelector: { zone, index: 0 } } }));
    const histories = test.current().history.histories;
    await test.command((api) => api.dispatch({ type: 'duplicate', sourceZone: zone, sourceIndex: 0 }));
    expect(test.host.querySelector('output')?.textContent).toContain('한 구역의 블록 수');
    expect(test.count()).toBe(200);
    expect(test.canonical()).toEqual(source);
    expect(test.dirty).not.toHaveBeenCalled();
    expect(test.changed).not.toHaveBeenCalled();
    // A save during recovery sees exactly the restored canvas, never a false-success 201-node candidate.
    expect(test.canonical().blocks[0].slots!.content).toHaveLength(test.count());
    await test.record();
    expect(test.host.querySelector('output')?.dataset.recovering).toBe('false');
    expect(test.current().history.histories).toEqual(histories);
    expect(test.current().selectedItem?.props.id).toBe(source.blocks[0].slots!.content[0].instance_id);
  }, 15_000);

  it.each([false, true])('preserves past and redo after an invalid drag from an undone state (StrictMode=%s)', async (strict) => {
    const source = fixture(1);
    source.blocks[0].slots!.content.push({ instance_id: crypto.randomUUID(), type: 'layout.stack-01', block_version: 1,
      props: { gap: 'normal' }, slots: { content: [] } });
    const test = await mount(source, strict);
    await replaceTitle(test, 'Valid future'); await test.record();
    await test.command((api) => api.history.back());
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Initial');
    const pastAndFuture = test.current().history.histories;
    // Native drag uses this public move action; Stack is forbidden at root.
    await test.command((api) => api.dispatch({ type: 'setUi', ui: { isDragging: true } }));
    await test.command((api) => api.dispatch({ type: 'move', sourceZone: nestedZone(source), sourceIndex: 1,
      destinationZone: 'root:default-zone', destinationIndex: 1 }));
    await test.record();
    expect(test.host.querySelector('output')?.dataset.recovering).toBe('false');
    expect(test.current().appState.data).toEqual(test.callbacks().currentData());
    expect(test.current().appState.ui.isDragging).toBe(false);
    expect(test.current().history.histories).toEqual(pastAndFuture);
    expect(test.current().history.hasFuture).toBe(true);
    await test.command((api) => api.history.forward());
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Valid future');
    await test.command((api) => api.history.back());
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Initial');
  });

  it.each([false, true])('ignores an earlier actual candidate after disposal (StrictMode=%s)', async (strict) => {
    const test = await mount(fixture(1), strict);
    await replaceTitle(test, 'Earlier'); await test.record();
    const earlier = test.current().appState;
    await replaceTitle(test, 'Latest'); await test.record();
    const latest = test.current().appState;
    const callbacks = test.callbacks(), accepted = callbacks.currentData(), api = test.current();
    const saved = structuredClone(test.canonical());
    expect(saved.blocks[0].slots!.content[0].props.heading).toBe('Latest');
    expect(earlier.data).not.toEqual(latest.data);
    const dirtyCalls = test.dirty.mock.calls.length, changeCalls = test.changed.mock.calls.length;
    await act(async () => test.unmount());
    await act(async () => {
      callbacks.onAction({ type: 'setData', data: earlier.data }, earlier, latest);
      callbacks.onChange(earlier.data);
      callbacks.connect(api);
      callbacks.finishRecovery();
      expect(callbacks.acceptForPublish(earlier.data)).toBeNull();
    });
    expect(callbacks.currentData()).toBe(accepted);
    expect(test.canonical()).toEqual(saved);
    expect(test.dirty).toHaveBeenCalledTimes(dirtyCalls);
    expect(test.changed).toHaveBeenCalledTimes(changeCalls);
  });

  it('retains a valid edit pending debounce before a rejected command', async () => {
    const source = fixture(1), test = await mount(source);
    await replaceTitle(test, 'Pending valid edit');
    await test.command((api) => api.dispatch({ type: 'insert', componentType: 'LayoutStack', destinationZone: 'root:default-zone', destinationIndex: 1 }));
    await test.record();
    expect(test.count()).toBe(1);
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Pending valid edit');
    await test.command((api) => api.history.back());
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Initial');
    await test.command((api) => api.history.forward());
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Pending valid edit');
  }, 15_000);

  it('rejects native Undo while read-only and preserves its original history position', async () => {
    const test = await mount(fixture(1));
    await replaceTitle(test, 'Saved valid edit'); await test.record();
    const index = test.current().history.index;
    await test.readonly();
    await test.command((api) => api.history.back());
    await test.record();
    expect(test.host.querySelector('output')?.textContent).toContain('읽기 전용');
    expect(test.canonical().blocks[0].slots!.content[0].props.heading).toBe('Saved valid edit');
    expect(test.current().history.index).toBe(index);
  });
});
