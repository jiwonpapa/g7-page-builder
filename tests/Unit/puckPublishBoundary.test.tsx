import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import type { Config, Puck } from '@puckeditor/core';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import type { EditorComponents } from '../../resources/js/editor/puckEditorTypes';
import type { PageDesignProps } from '../../resources/js/editor/pageDesignTokens';

type EditorProps = Parameters<typeof Puck<Config<EditorComponents, PageDesignProps>>>[0];
let publish: EditorProps['onPublish'];
vi.mock('@puckeditor/core', async (original) => {
  const core = await original<typeof import('@puckeditor/core')>();
  // Observe the vendor callback boundary while retaining the real Puck tree and commands.
  const ObservedPuck = (props: EditorProps) => {
    publish = props.onPublish;
    return <core.Puck {...props} />;
  };
  return { ...core, Puck: Object.assign(ObservedPuck, core.Puck) };
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
const { PuckEditorAdapter, canonicalToPuck } = await import('../../resources/js/editor/PuckEditorAdapter');
const cleanups: Array<() => void> = [];
afterEach(async () => { await act(async () => { cleanups.splice(0).forEach(run => run()); }); publish = undefined; });

it('publishes validated canonical data and blocks invalid or read-only vendor callbacks', async () => {
  const source: PageBuilderDocument = { schema_version: 'g7-page-builder/v2', document_id: crypto.randomUUID(),
    slug: 'publish-boundary', locale: 'ko', mode: 'canvas', shell_mode: 'none', blocks: [
      { instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
        props: { eyebrow: '', heading: 'Publish sentinel', level: 2, anchor: '' }, slots: {} },
    ] };
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  cleanups.push(() => { root.unmount(); host.remove(); });
  const onPublish = vi.fn(), onChange = vi.fn();
  const render = async (disabled = false) => {
    await act(async () => root.render(<PuckEditorAdapter document={source} revisionKey={0} disabled={disabled}
      iframeEnabled={false} onChange={onChange} onPublish={onPublish} />));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  };
  const data = canonicalToPuck(source).data;
  const invoke = async (candidate: typeof data) => {
    if (!publish) throw new Error('The editor did not supply its vendor publish callback.');
    await act(async () => { publish?.(candidate); });
  };
  await render();
  await invoke(data);
  expect(onPublish).toHaveBeenCalledExactlyOnceWith(source);
  const invalid: typeof data = { ...data, content: [
    { type: 'LayoutStack', props: { id: crypto.randomUUID(), gap: 'normal', content: [] } },
  ] };
  await invoke(invalid);
  expect(onPublish).toHaveBeenCalledOnce();
  expect(onChange).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="page-builder-document-error"]')?.textContent).toBeTruthy();
  await render(true);
  await invoke(data);
  expect(onPublish).toHaveBeenCalledOnce();
});
