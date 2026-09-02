import React, { act } from 'react';
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
// JSDOM has no layout; ProseMirror still asks Range for selection geometry.
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
const { Puck, usePuck } = await import('@puckeditor/core');
const { canonicalToPuck } = await import('../../resources/js/editor/puckBlockCodec');
const { pageBuilderPuckConfig, PuckEditorAdapter } = await import('../../resources/js/editor/PuckEditorAdapter');
type EditorApi = ReturnType<typeof usePuck<Config<EditorComponents, PageDesignProps>>>;

const heading = (text: string): PageBuilderBlock => ({ instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
  props: { eyebrow: '', heading: text, level: 2, anchor: '' } });
function fixture() {
  const first = heading('First column'), nested = heading('Nested title');
  const stack: PageBuilderBlock = { instance_id: crypto.randomUUID(), type: 'layout.stack-01', block_version: 1,
    props: { gap: 'normal' }, slots: { content: [nested] } };
  const columns: PageBuilderBlock = { instance_id: crypto.randomUUID(), type: 'layout.columns-01', block_version: 1,
    props: { columns: 3, ratio: '1:1:1', gap: 'none' }, slots: { column1: [first], column2: [], column3: [stack] } };
  const source: PageBuilderDocument = { schema_version: 'g7-page-builder/v2', document_id: crypto.randomUUID(),
    slug: 'slot-identity', locale: 'ko', mode: 'canvas', shell_mode: 'none',
    blocks: [{ instance_id: crypto.randomUUID(), type: 'layout.section-01', block_version: 1,
      props: { width: 'standard', spacing: 'normal' }, slots: { content: [columns] } }] };
  return { source, first, nested, stack, columns };
}
const cleanups: Array<() => void> = [];
afterEach(async () => { await act(async () => { cleanups.splice(0).forEach((cleanup) => cleanup()); }); });
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }

async function mount(adapter = false) {
  const nodes = fixture();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  let api: EditorApi | null = null;
  function Capture() { api = usePuck<Config<EditorComponents, PageDesignProps>>(); return <></>; }
  cleanups.push(() => { root.unmount(); host.remove(); });
  // Real Puck, real layout renderers, and real Tiptap Heading fields. Only this
  // small synthetic tree is exercised; no existing block content is inspected.
  await act(async () => root.render(adapter
    ? <PuckEditorAdapter document={nodes.source} revisionKey={0} iframeEnabled={false}
      onChange={() => undefined} onPublish={() => undefined} />
    : <Puck config={pageBuilderPuckConfig} data={canonicalToPuck(nodes.source).data}
      iframe={{ enabled: false }} overrides={{ headerActions: Capture }} />));
  const current = (): EditorApi => { if (!api) throw new Error('Missing public Puck API'); return api; };
  const field = (id: string): HTMLElement => {
    const element = host.querySelector<HTMLElement>(`[data-block-id="${id}"] [data-g7pb-inline-field="heading"] .ProseMirror`);
    if (!element) throw new Error('Missing actual Heading editor');
    return element;
  };
  await vi.waitFor(async () => { await flush(); expect(field(nodes.nested.instance_id).textContent).toBe('Nested title'); });
  const command = async (run: (value: EditorApi) => void) => { await act(async () => { run(current()); }); await flush(); };
  return { ...nodes, host, current, field, command };
}

describe('layout slot identity through real Puck', () => {
  it('keeps column and nested Stack editors mounted and focused across native selection', async () => {
    const test = await mount(true);
    for (const node of [test.first, test.nested]) {
      const original = test.field(node.instance_id);
      // JSDOM does not implement pointer default focus. Establish the same
      // focus a browser mousedown gives, then run Puck's real click handler.
      await act(async () => { original.focus(); });
      expect(document.activeElement).toBe(original);
      await act(async () => {
        original.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        original.click();
      });
      await flush();
      expect(original.isConnected).toBe(true);
      expect(test.field(node.instance_id)).toBe(original);
      expect(document.activeElement).toBe(original);
    }
  });

  it('renders current slot contents after edits, insertion and removal without replacing existing editors', async () => {
    const test = await mount(), id = test.nested.instance_id;
    const original = test.field(id), zone = `${test.stack.instance_id}:content`;
    await test.command((api) => {
      const item = api.getItemById(id);
      if (!item || item.type !== 'Heading') throw new Error('Missing synthetic Heading');
      api.dispatch({ type: 'replace', destinationZone: zone, destinationIndex: 0,
        data: { ...item, props: { ...item.props, heading: '<p>Current title</p>' } } });
    });
    await vi.waitFor(async () => { await flush(); expect(test.field(id).textContent).toBe('Current title'); });
    expect(test.field(id)).toBe(original);
    await test.command((api) => api.dispatch({ type: 'insert', componentType: 'Heading', destinationZone: zone, destinationIndex: 1 }));
    const stack = test.host.querySelector('[data-testid="page-builder-layout-stack"]');
    expect(stack?.querySelectorAll('[data-block-type="heading"]')).toHaveLength(2);
    expect(test.field(id)).toBe(original);
    await test.command((api) => api.dispatch({ type: 'remove', zone, index: 1 }));
    expect(stack?.querySelectorAll('[data-block-type="heading"]')).toHaveLength(1);
    expect(test.field(id)).toBe(original);
    expect(original.textContent).toBe('Current title');
  });
});
