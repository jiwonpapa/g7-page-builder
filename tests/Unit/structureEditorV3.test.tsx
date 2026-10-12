import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument, indexTree } from '../../resources/js/documents/v3/tree';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { NodeRenderer, StructurePreview } from '../../resources/js/editor/v3/NodeRenderer';
import { documentPresentation } from '../../resources/js/documents/v3/presentation';
import type { DraftPort } from '../../resources/js/editor-application/v3/session';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
const { StructureEditor, ContextActionBar } = await import('../../resources/js/editor/v3/StructureEditor');
const { mountStructureEditor } = await import('../../resources/js/editor/v3/mount');
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach(run => run())); });
function source() {
  const document = cloneDocument(validateDocumentV3(fixture));
  for (const { node } of indexTree(document).values()) { node.style = {}; node.responsive = {}; }
  return document;
}
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); }); }
async function click(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === label);
  if (!button) throw new Error('Missing button: ' + label + '\n' + host.textContent);
  await act(async () => button.click()); await flush();
}
function hostElement() {
  const host = document.createElement('div'); document.body.append(host);
  cleanup.push(() => host.remove());
  return host;
}

describe('v3 structural UI and explicit mount', () => {
  it('neutralizes vendor slot dimensions without overwriting authored width and height', async () => {
    const doc = source();
    doc.blocks[0].style = { width: { value: 420, unit: 'px' }, height: { value: 320, unit: 'px' } };
    doc.blocks[0].slots.content!.push(createPrimitive('layout.container', id(8), doc));
    const host = hostElement(), root = createRoot(host); cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructureEditor document={doc} sessionId="slot-size" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }}
      nextId={() => id(100)} iframeEnabled={false} />));
    await flush();
    const authored = host.querySelector<HTMLElement>('[data-v3-node="' + doc.blocks[0].instance_id + '"]')!;
    const automatic = host.querySelector<HTMLElement>('[data-v3-node="' + id(8) + '"]')!;
    expect(authored.style.width).toBe('420px'); expect(authored.style.height).toBe('320px');
    expect(automatic.style.width).toBe('auto'); expect(automatic.style.height).toBe('auto');
  });
  it('inserts a complete editable composition through one canonical command', async () => {
    const doc = source(); doc.blocks = [];
    const host = hostElement(), root = createRoot(host), changed = vi.fn(); let sequence = 100;
    cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructureEditor document={doc} sessionId="compositions" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }}
      nextId={() => id(sequence++)} iframeEnabled={false} onChange={changed} />));
    await flush();
    await click(host, '구성 삽입');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(indexTree(changed.mock.calls[0][0]).size).toBe(8);
    expect(host.textContent).toContain('히어로 · 포스터');
    await vi.waitFor(() => expect([...host.querySelectorAll('button')].find(button => button.textContent === '실행 취소')?.disabled).toBe(false));
    await click(host, '실행 취소');
    await vi.waitFor(() => expect(changed.mock.calls.at(-1)![0]).toEqual(doc));
    await click(host, '다시 실행');
    expect(indexTree(changed.mock.calls.at(-1)![0]).size).toBe(8);
  });
  it('switches session-only widths without history and scopes visibility to the selected layer', async () => {
    const doc = source(), node = doc.blocks[0].slots.content![0];
    node.responsive.mobile = { hidden: true };
    const host = hostElement(), root = createRoot(host), changed = vi.fn();
    cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructureEditor document={doc} sessionId="responsive" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }}
      nextId={() => id(100)} iframeEnabled={false} onChange={changed} />));
    await flush();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="layer-' + node.instance_id + '"]')!.click());
    await act(async () => host.querySelector<HTMLInputElement>('[aria-label="너비 지정"]')!.click());
    await click(host, '모바일');
    expect(host.querySelector<HTMLElement>('[data-v3-workspace]')?.style.width).toBe('360px');
    expect(host.querySelector<HTMLInputElement>('[aria-label="너비 지정"]')?.checked).toBe(false);
    expect(host.querySelector('[data-testid="layer-' + node.instance_id + '"]')?.textContent).toContain('숨김');
    expect(changed).not.toHaveBeenCalled();
    await click(host, '표시');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][0].blocks[0].slots.content[0].responsive.mobile.hidden).toBe(false);
    expect(changed.mock.calls[0][0].blocks[0].slots.content[0].style).toEqual(node.style);
    await click(host, '태블릿');
    expect(host.querySelector<HTMLElement>('[data-v3-workspace]')?.style.width).toBe('768px');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(host.querySelector<HTMLElement>('[data-v3-workspace]')?.style.width).toBe('768px');
  });
  it('keeps portaled format actions from bubbling into the canvas deselection handler', async () => {
    const host = hostElement(), target = hostElement(), root = createRoot(host);
    cleanup.push(() => root.unmount());
    const deselect = vi.fn(), apply = vi.fn();
    await act(async () => root.render(<div onClick={deselect}>
      <ContextActionBar target={target}><button onClick={apply}>부분 서식 적용</button></ContextActionBar>
    </div>));
    await act(async () => target.querySelector('button')!.click());
    expect(apply).toHaveBeenCalledOnce();
    expect(deselect).not.toHaveBeenCalled();
    expect(target.querySelector('button')).not.toBeNull();
    await act(async () => root.render(<ContextActionBar target={target}>{[false, null, undefined]}</ContextActionBar>));
    expect(target.childElementCount).toBe(0);
  });
  it('keeps click and auxiliary link activation in the editing canvas but preserves preview navigation', async () => {
    const doc = source(), host = hostElement(), root = createRoot(host); cleanup.push(() => root.unmount());
    for (const editing of [false, true]) {
      await act(async () => root.render(<>{doc.blocks[0].slots.content!.map(node =>
        <NodeRenderer key={node.instance_id} node={node} document={doc} styles={documentPresentation(doc)} editing={editing} />)}</>));
      const links = [...host.querySelectorAll('a')];
      expect(links).toHaveLength(2);
      for (const link of links) for (const type of ['click', 'auxclick']) {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: type === 'auxclick' ? 1 : 0 });
        link.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(editing);
      }
    }
  });
  it('renders the six primitives with escaped text and no hidden node in a structural preview', async () => {
    const doc = source();
    doc.blocks[0].slots.content!.push(createPrimitive('layout.container', id(8), doc));
    doc.blocks[0].slots.content![0].style.hidden = true;
    const text = doc.blocks[0].slots.content![2];
    if (text.type !== 'content.text') throw new Error('fixture');
    text.props.paragraphs[0][0].text = '<script>not HTML</script>';
    const host = hostElement(), root = createRoot(host); cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructurePreview document={doc} />));
    expect(host.querySelector(`[data-v3-node="${id(2)}"]`)).toBeNull();
    expect(host.textContent).toContain('<script>not HTML</script>');
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img')?.getAttribute('src')).toBe(doc.assets[0].url);
    expect(host.querySelectorAll('a')).toHaveLength(2);
  });
  it('inserts through canonical commands, saves v3 only and enforces read-only buttons', async () => {
    const doc = source(); doc.blocks = [];
    const host = hostElement(), changed = vi.fn(), saved = vi.fn<DraftPort['save']>(async request => ({ documentId: request.documentId, revision: 2 }));
    let sequence = 100;
    const options = { document: doc, sessionId: 'unit', serverRevision: 1, drafts: { save: saved }, nextId: () => id(sequence++), iframeEnabled: false, onChange: changed };
    let unmount = () => {};
    await act(async () => { unmount = mountStructureEditor(host, options); }); cleanup.push(() => unmount());
    await flush();
    await click(host, '제목 삽입');
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(changed.mock.calls[0][0].blocks[0].type).toBe('content.heading');
    await click(host, '저장');
    expect(saved).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(saved.mock.calls[0][0].json);
    expect(payload.schema_version).toBe('g7-page-builder/v3');
    expect(payload.blocks).toHaveLength(1);
    expect(payload).not.toHaveProperty('content');
    await act(async () => { unmount(); unmount = mountStructureEditor(host, { ...options, document: payload, sessionId: 'reopened', readonly: true }); });
    await flush();
    expect([...host.querySelectorAll('button')].find(button => button.textContent === '제목 삽입')?.disabled).toBe(true);
    expect(host.textContent).toContain('읽기 전용');
  });
  it('selects hidden nodes in layers, preserves session-only collapse and rejects locked deletion', async () => {
    const doc = source(); doc.blocks[0].locked = true; doc.blocks[0].style.hidden = true;
    const host = hostElement(), changed = vi.fn(), root = createRoot(host); cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructureEditor document={doc} sessionId="locks" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }} nextId={() => id(100)} iframeEnabled={false} onChange={changed} />));
    await flush();
    const select = host.querySelector<HTMLButtonElement>(`[data-testid="layer-${id(1)}"]`)!;
    await act(async () => select.click()); await flush();
    await click(host, '삭제');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('locked');
    expect(changed).not.toHaveBeenCalled();
    const collapse = host.querySelector<HTMLButtonElement>('[aria-label="본문 접기"]')!;
    await act(async () => collapse.click());
    expect(host.querySelector(`[data-testid="layer-${id(2)}"]`)).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });
  it('creates validated insertion defaults and diagnoses missing image assets', () => {
    const doc = source();
    for (const type of ['layout.section', 'layout.container', 'content.heading', 'content.text', 'media.image', 'action.link'] as const) {
      expect(validateDocumentV3({ ...doc, blocks: [createPrimitive(type, id(100), doc)] }).blocks[0].type).toBe(type);
    }
    doc.assets = [];
    expect(() => createPrimitive('media.image', id(100), doc)).toThrow('asset_required');
  });
  it('reconnects under StrictMode and ignores a save callback after the owning session unmounts', async () => {
    const doc = source(), host = hostElement(), root = createRoot(host), saved = vi.fn();
    cleanup.push(() => root.unmount());
    let resolve!: (response: { documentId: string; revision: number }) => void;
    const drafts: DraftPort = { save: () => new Promise(accept => { resolve = accept; }) };
    const props = { document: doc, serverRevision: 1, drafts, nextId: () => id(100), iframeEnabled: false, onSaved: saved };
    await act(async () => root.render(<React.StrictMode><StructureEditor {...props} sessionId="first" /></React.StrictMode>));
    await flush(); await click(host, '저장');
    await act(async () => root.render(<React.StrictMode><StructureEditor {...props} sessionId="second" /></React.StrictMode>));
    await act(async () => resolve({ documentId: doc.document_id, revision: 2 }));
    await flush();
    expect(saved).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="편집 상태"]')?.textContent).toContain('구조 편집');
    await click(host, '제목 삽입');
    expect(host.querySelector(`[data-testid="layer-${id(100)}"]`)).not.toBeNull();
  });
});
