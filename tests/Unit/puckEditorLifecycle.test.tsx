import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '@puckeditor/core';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import type { EditorComponents } from '../../resources/js/editor/puckEditorTypes';
import type { PageDesignProps } from '../../resources/js/editor/pageDesignTokens';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] });
Object.defineProperty(Range.prototype, 'getBoundingClientRect', { configurable: true, value: () => new DOMRect() });
const { usePuck } = await import('@puckeditor/core');
const boundaryOwner = await import('../../resources/js/editor/PuckDocumentBoundary');
const OriginalBoundary = boundaryOwner.PuckDocumentBoundary;
const { PuckEditorAdapter } = await import('../../resources/js/editor/PuckEditorAdapter');
type EditorApi = ReturnType<typeof usePuck<Config<EditorComponents, PageDesignProps>>>;
type Boundary = ReturnType<typeof boundaryOwner.usePuckDocumentBoundary>['boundary'];
const cleanups: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanups.splice(0).forEach((run) => run())); vi.restoreAllMocks(); });

function fixture(title = 'Initial'): PageBuilderDocument {
  return { schema_version: 'g7-page-builder/v1', document_id: crypto.randomUUID(), slug: 'lifecycle-synthetic', mode: 'canvas',
    locale: 'ko', shell_mode: 'none', tokens: { note: title }, blocks: [
      { instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
        props: { eyebrow: '', heading: `<p>${title}</p>`, level: 2, anchor: '' }, slots: {} },
      { instance_id: crypto.randomUUID(), type: 'content.cta-split-01', block_version: 1,
        props: { eyebrow: '', heading: '<p>CTA</p>', body: '', theme: 'light' }, slots: {} },
    ] };
}
async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
async function mount(initial: PageBuilderDocument, initiallyDisabled = false) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  let capture: { api: EditorApi; boundary: Boundary } | null = null;
  // Observe the public API inside the real Puck provider and still mount the
  // production boundary. No command, conversion, store or history is mocked.
  vi.spyOn(boundaryOwner, 'PuckDocumentBoundary').mockImplementation((props) => {
    capture = { api: usePuck<Config<EditorComponents, PageDesignProps>>(), boundary: props.boundary };
    return <OriginalBoundary {...props} />;
  });
  const dirty = vi.fn(), changed = vi.fn();
  const render = async (source = initial, revisionKey = 0, disabled = false) => {
    await act(async () => root.render(<PuckEditorAdapter document={source} revisionKey={revisionKey} disabled={disabled}
      iframeEnabled={false} onDirty={dirty} onChange={changed} onPublish={() => undefined} />));
    await flush();
  };
  cleanups.push(() => { root.unmount(); host.remove(); });
  await render(initial, 0, initiallyDisabled);
  const current = () => { if (!capture) throw new Error('Missing real Puck capture'); return capture; };
  const replaceHeading = async (id: string, heading: string) => {
    const item = current().api.getItemById(id);
    if (!item || item.type !== 'Heading') throw new Error('Missing current Heading');
    await act(async () => current().api.dispatch({ type: 'replace', destinationIndex: 0, destinationZone: 'root:default-zone',
      data: { ...item, props: { ...item.props, heading } } }));
    await flush();
  };
  const record = async () => { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 260)); }); };
  return { host, render, current, dirty, changed, replaceHeading, record };
}

describe('atomic editor session lifetime', () => {
  it.each(['revision', 'document'] as const)('replaces canonical context, boundary and Puck together on explicit %s change', async (change) => {
    const initial = fixture(), test = await mount(initial, true);
    const old = test.current();
    expect(test.host.querySelector('[data-block-type="cta"] [data-g7pb-inline-field="body"]')).toBeNull();
    const next: PageBuilderDocument = { ...fixture('Restored'), document_id: change === 'revision' ? initial.document_id : crypto.randomUUID(),
      locale: 'en', slug: 'restored-synthetic', tokens: { note: 'restored-metadata' } };
    next.blocks[1].props.body = '<p>Restored CTA body</p>';
    await test.render(next, change === 'revision' ? 1 : 0, true);
    await vi.waitFor(async () => {
      await flush();
      expect(test.host.querySelector('[data-block-type="cta"] [data-g7pb-inline-field="body"]')?.textContent).toBe('Restored CTA body');
    });
    expect(test.current().boundary).not.toBe(old.boundary);
    expect(test.current().api.appState.data.content.map((item) => item.props.id)).toEqual(next.blocks.map((block) => block.instance_id));
    expect(test.current().boundary.currentData()).toEqual(test.current().api.appState.data);
    expect(test.current().api.history.hasPast).toBe(false);
    expect(test.changed).not.toHaveBeenCalled();
    await test.render(next, change === 'revision' ? 1 : 0, false);
    await test.replaceHeading(next.blocks[0].instance_id, '<p>Edited after restore</p>');
    expect(test.changed).toHaveBeenLastCalledWith({ ...next, blocks: [
      { ...next.blocks[0], props: { ...next.blocks[0].props, heading: '<p>Edited after restore</p>' } }, next.blocks[1],
    ] });
    expect(old.boundary.acceptForPublish(test.current().api.appState.data)).toBeNull();
  });

  it('retains input DOM and native Undo through ordinary save/rerender and permission toggles', async () => {
    const source = fixture(), test = await mount(source);
    await test.replaceHeading(source.blocks[0].instance_id, '<p>Saved edit</p>'); await test.record();
    const saved: PageBuilderDocument = test.changed.mock.lastCall![0];
    const boundary = test.current().boundary;
    const histories = test.current().api.history.histories;
    const block = test.host.querySelector<HTMLElement>('[data-block-type="heading"]');
    const field = block?.querySelector<HTMLElement>('[data-g7pb-inline-field="heading"]');
    if (!field) throw new Error('Missing real Heading field');
    await act(async () => { field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); field.click(); });
    let editor: HTMLElement | null = null;
    await vi.waitFor(async () => { await flush(); editor = field.querySelector('.tiptap.ProseMirror[contenteditable="true"]'); expect(editor).not.toBeNull(); });
    if (!editor) throw new Error('Missing actual ProseMirror editor');
    const focused: HTMLElement = editor;
    await act(async () => focused.focus());
    await test.render({ ...saved });
    expect(field.querySelector('.tiptap.ProseMirror')).toBe(focused);
    expect(document.activeElement).toBe(focused);
    expect(test.current().boundary).toBe(boundary);
    expect(test.current().api.history.histories).toEqual(histories);
    await test.render({ ...saved }, 0, true);
    await test.render({ ...saved }, 0, false);
    expect(test.host.querySelector('[data-block-type="heading"]')).toBe(block);
    expect(test.current().boundary).toBe(boundary);
    expect(test.current().api.history.histories).toEqual(histories);
    await act(async () => test.current().api.history.back()); await flush();
    expect(test.changed).toHaveBeenLastCalledWith(source);
    expect(test.current().boundary.currentData()).toEqual(test.current().api.appState.data);
  });
});
