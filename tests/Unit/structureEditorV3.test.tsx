import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import behaviorCases from '../Fixtures/document-v3-cases.json';
import builtinCompositions from '../../resources/compositions/builtin-v3.json';
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
const { WorkspaceFrame } = await import('../../resources/js/editor/v3/Workspace');
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
  it('separates insertion from selected properties and initially fits without editing the document', async () => {
    const doc = source(); doc.blocks = [];
    const host = hostElement(), root = createRoot(host), changed = vi.fn();
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('g7pb-v3-canvas') ? 800 : 0;
    });
    cleanup.push(() => { root.unmount(); width.mockRestore(); });
    await act(async () => root.render(<StructureEditor document={doc} sessionId="workspace-chrome" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }}
      nextId={() => id(980)} iframeEnabled={false} onChange={changed} />)); await flush();
    const navigation = host.querySelector('[aria-label="레이어"]')!, properties = host.querySelector('[aria-label="구조 속성"]')!;
    expect(navigation.querySelector('[aria-label="요소 삽입"]')).not.toBeNull();
    expect(navigation.querySelector('[aria-label="구성 템플릿"]')).not.toBeNull();
    expect(properties.querySelector('[aria-label="삽입 위치"]')).toBeNull();
    expect(properties.textContent).toContain('편집할 요소를 선택하세요');
    expect(host.querySelector<HTMLSelectElement>('[aria-label="작업면 확대"]')!.value).toBe(String(736 / 1280));
    expect(host.querySelector<HTMLElement>('[data-v3-workspace]')!.style.width).toBe('1280px');
    expect(changed).not.toHaveBeenCalled();
    await click(host, '제목 삽입');
    expect(changed).toHaveBeenCalledTimes(1);
    await act(async () => navigation.querySelector<HTMLButtonElement>('[data-testid="layer-' + id(980) + '"]')!.click());
    expect(properties.querySelector('[aria-label="레이어 이름"]')).not.toBeNull();
    expect(properties.querySelector('[aria-label="정밀 Inspector"]')).not.toBeNull();
  });

  it('isolates mirrored frame chrome and scrollbars and restores only the values it owns', async () => {
    const frame = document.createElement('iframe'); document.body.append(frame);
    cleanup.push(() => frame.remove());
    const owner = frame.contentDocument;
    if (!owner) throw new Error('Expected iframe document');
    owner.body.className = 'g7pb-editor-shell';
    owner.body.style.setProperty('background-color', 'navy', 'important');
    // jsdom's CSSOM does not retain priority for overflow-y; background above
    // covers priority restoration through the same property-ownership path.
    owner.documentElement.style.setProperty('overflow-y', 'auto');
    owner.body.style.overflowY = 'scroll';
    owner.body.style.color = 'white';
    const authored = owner.createElement('div'); authored.dataset.v3Surface = '';
    authored.style.backgroundColor = 'red'; authored.style.overflowY = 'auto'; owner.body.append(authored);
    frame.style.height = '123px';
    const host = hostElement(), root = createRoot(host), extent = vi.fn();
    let mounted = true;
    cleanup.push(() => { if (mounted) root.unmount(); });
    await act(async () => root.render(<WorkspaceFrame owner={owner} extent={extent} />));
    expect(owner.documentElement.style.backgroundColor).toBe('transparent');
    expect(owner.body.style.backgroundColor).toBe('transparent');
    expect(owner.documentElement.style.overflowY).toBe('clip');
    expect(owner.body.style.overflowY).toBe('clip');
    expect(authored.style.overflowY).toBe('auto');
    expect(owner.body.style.color).toBe('white');
    expect(owner.body.className).toBe('g7pb-editor-shell');
    expect(authored.style.backgroundColor).toBe('red');
    expect(frame.style.height).toBe('800px');
    expect(extent).toHaveBeenCalledWith(800);
    owner.body.style.overflowY = 'hidden'; // A later owner must not be overwritten on teardown.
    await act(async () => { root.unmount(); mounted = false; });
    expect(owner.documentElement.style.backgroundColor).toBe('');
    expect(owner.body.style.backgroundColor).toBe('navy');
    expect(owner.body.style.getPropertyPriority('background-color')).toBe('important');
    expect(owner.documentElement.style.overflowY).toBe('auto');
    expect(owner.documentElement.style.getPropertyPriority('overflow-y')).toBe('');
    expect(owner.body.style.overflowY).toBe('hidden');
    expect(frame.style.height).toBe('123px');
  });

  it('remeasures authored overflow after a style change without relying on a root resize', async () => {
    const frame = document.createElement('iframe'); document.body.append(frame);
    cleanup.push(() => frame.remove());
    const owner = frame.contentDocument;
    if (!owner) throw new Error('Expected iframe document');
    const surface = owner.createElement('div'); surface.dataset.v3Surface = '';
    const child = owner.createElement('div'); child.style.position = 'absolute'; surface.append(child);
    let height = 1000;
    Object.defineProperty(surface, 'scrollHeight', { get: () => height });
    owner.body.append(surface);
    const host = hostElement(), root = createRoot(host), extent = vi.fn();
    cleanup.push(() => root.unmount());
    await act(async () => root.render(<WorkspaceFrame owner={owner} extent={extent} />));
    expect(frame.style.height).toBe('1000px');
    height = 1500; child.style.top = '1400px'; await flush();
    expect(frame.style.height).toBe('1500px');
    expect(extent).toHaveBeenLastCalledWith(1500);
  });

  it('reports a late save as edited so the product host preserves unsaved navigation protection', async () => {
    const doc = source(), host = hostElement(), root = createRoot(host), saved = vi.fn();
    cleanup.push(() => root.unmount());
    let resolve!: (response: { documentId: string; revision: number }) => void;
    const drafts: DraftPort = { save: () => new Promise(accept => { resolve = accept; }) };
    let sequence = 950;
    await act(async () => root.render(<StructureEditor document={doc} sessionId="late-product-save" serverRevision={1}
      drafts={drafts} nextId={() => id(sequence++)} iframeEnabled={false} onSaved={saved} />));
    await flush(); await click(host, '제목 삽입'); await click(host, '저장'); await click(host, '제목 삽입');
    await act(async () => resolve({ documentId: doc.document_id, revision: 2 })); await flush();
    expect(saved).toHaveBeenCalledExactlyOnceWith(2, 'edited');
    expect(host.querySelector('[aria-label="편집 상태"]')?.textContent).toContain('추가 변경 있음');
    await click(host, '저장'); await act(async () => resolve({ documentId: doc.document_id, revision: 3 })); await flush();
    expect(saved).toHaveBeenLastCalledWith(3, 'saved');
  });

  it('records common behavior and button edits in Puck history while preview interactions stay transient', async () => {
    const doc = validateDocumentV3({ ...structuredClone(fixture), blocks: structuredClone(behaviorCases.behavior_fixtures.tabs) });
    const host = hostElement(), root = createRoot(host), changed = vi.fn(), save = vi.fn(async request => ({ documentId: request.documentId, revision: 2 }));
    cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructureEditor document={doc} compositions={[]} sessionId="common-behavior" serverRevision={1}
      drafts={{ save }} nextId={() => id(900)} iframeEnabled={false} onChange={changed} />)); await flush();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="layer-' + id(100) + '"]')!.click());
    await act(async () => {
      const input = host.querySelector<HTMLSelectElement>('[aria-label="탭 방향"]')!;
      input.value = 'vertical'; input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(host, '동작 적용');
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls.at(-1)![0].blocks[0].behavior.orientation).toBe('vertical');
    // Vitest imports upstream Puck, without the build-only atomic history patch.
    // Drain its documented 250ms trailing record; the built-bundle E2E below
    // exercises immediate Undo without this upstream-only settling step.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    expect([...host.querySelectorAll('button')].find(button => button.textContent === '실행 취소')?.disabled).toBe(false);
    await click(host, '실행 취소'); expect(changed.mock.calls.at(-1)![0]).toEqual(doc);
    await click(host, '다시 실행');
    const authored = structuredClone(changed.mock.calls.at(-1)![0]), count = changed.mock.calls.length;
    await click(host, '구조 미리보기');
    const preview = host.querySelector<HTMLElement>('[data-testid="v3-preview"]')!;
    await act(async () => preview.querySelector<HTMLButtonElement>('[data-v3-node="' + id(103) + '"]')!.click());
    expect(preview.querySelector<HTMLElement>('[data-v3-node="' + id(106) + '"]')!.hidden).toBe(false);
    expect(changed).toHaveBeenCalledTimes(count);
    await click(host, '구조 미리보기');
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="layer-' + id(102) + '"]')!.click());
    await act(async () => {
      const input = host.querySelector<HTMLInputElement>('[aria-label="버튼 문구"]')!;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '직접 바꾼 문구');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(host, '버튼 문구 적용');
    expect(indexTree(changed.mock.calls.at(-1)![0]).get(id(102))!.node.props).toEqual({ label: '직접 바꾼 문구' });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 250)); });
    await click(host, '실행 취소'); expect(changed.mock.calls.at(-1)![0]).toEqual(authored);
    await click(host, '저장'); expect(save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(save.mock.calls[0][0].json)).toEqual(authored);
  });
  it('preserves nested canvas nodes when a canonical edit replaces the slot render function', async () => {
    const doc = source(), leaf = doc.blocks[0].slots.content![0];
    const frame = createPrimitive('layout.container', id(70), doc);
    frame.slots.content = [leaf]; doc.blocks[0].slots.content![0] = frame;
    const host = hostElement(), root = createRoot(host), changed = vi.fn();
    cleanup.push(() => root.unmount());
    await act(async () => root.render(<StructureEditor document={doc} sessionId="stable-slot" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }}
      nextId={() => id(100)} iframeEnabled={false} onChange={changed} />));
    await flush();
    const selector = '[data-v3-node="' + leaf.instance_id + '"]';
    const original = host.querySelector(selector);
    expect(original).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="layer-' + leaf.instance_id + '"]')!.click());
    const input = host.querySelector<HTMLInputElement>('[aria-label="레이어 이름"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '내부 본문 이름');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await click(host, '이름 적용');
    expect(indexTree(changed.mock.calls.at(-1)![0]).get(leaf.instance_id)?.node.name).toBe('내부 본문 이름');
    expect(host.querySelector(selector)).toBe(original);
  });
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
    await act(async () => root.render(<StructureEditor document={doc} compositions={builtinCompositions} sessionId="compositions" serverRevision={1}
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
  for (const family of [
    { label: '반복 구성', key: 'gallery-project-scenes', images: 5 },
    { label: '내용 구성', key: 'image-landscape', images: 1 },
  ]) for (const phase of ['history', 'duplicate-readonly'] as const) it(family.label + ' independent composition ' + phase, async () => {
    const doc = source(); doc.blocks = [];
    const host = hostElement(), root = createRoot(host), changed = vi.fn(); let sequence = 100;
    cleanup.push(() => root.unmount());
    const props = { document: doc, compositions: builtinCompositions, sessionId: 'repeated-compositions', serverRevision: 1,
      drafts: { save: async () => ({ documentId: doc.document_id, revision: 2 }) },
      nextId: () => id(sequence++), iframeEnabled: false, onChange: changed };
    await act(async () => root.render(<StructureEditor {...props} />)); await flush();
    const select = host.querySelector<HTMLSelectElement>('[aria-label="구성 선택"]')!;
    expect(select.options).toHaveLength(builtinCompositions.length);
    await act(async () => { select.value = builtinCompositions.find(item => item.slug === family.key)!.document_id;
      select.dispatchEvent(new Event('change', { bubbles: true })); });
    await click(host, '구성 삽입');
    expect(changed).toHaveBeenCalledTimes(1);
    const inserted = validateDocumentV3(changed.mock.calls[0][0]);
    expect(inserted.blocks).toHaveLength(1);
    expect([...indexTree(inserted).values()].filter(({ node }) => node.type === 'media.image')).toHaveLength(family.images);
    expect(inserted.assets).toHaveLength(doc.assets.length + family.images);
    if (phase === 'history') {
      await vi.waitFor(() => expect([...host.querySelectorAll('button')].find(button => button.textContent === '실행 취소')?.disabled).toBe(false));
      await click(host, '실행 취소'); expect(changed.mock.calls.at(-1)![0]).toEqual(doc);
      await click(host, '다시 실행'); expect(changed.mock.calls.at(-1)![0]).toEqual(inserted);
      return;
    }
    await click(host, '구성 삽입');
    const twice = validateDocumentV3(changed.mock.calls.at(-1)![0]);
    expect(twice.blocks).toHaveLength(2);
    expect(indexTree(twice).size).toBe(indexTree(inserted).size * 2);
    expect(twice.assets).toEqual(inserted.assets);
    await click(host, '구조 미리보기');
    expect([...host.querySelectorAll('button')].find(button => button.textContent === '구성 삽입')?.disabled).toBe(true);
    await click(host, '구조 미리보기');
    await act(async () => root.render(<StructureEditor {...props} readonly />)); await flush();
    expect(host.querySelector<HTMLSelectElement>('[aria-label="구성 선택"]')?.disabled).toBe(true);
    expect([...host.querySelectorAll('button')].find(button => button.textContent === '구성 삽입')?.disabled).toBe(true);
    const calls = changed.mock.calls.length;
    await click(host, '구성 삽입'); expect(changed).toHaveBeenCalledTimes(calls);
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
    expect(host.querySelector('[aria-label="편집 상태"]')?.textContent).toContain('locked');
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
