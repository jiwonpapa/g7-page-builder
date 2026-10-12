import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { nodeAnchor } from '../../resources/js/documents/v3/tree';
import { canvasTargets, measureTargets, ownsTextInput } from '../../resources/js/adapters/interaction/measure';
import { GeometryAdapter } from '../../resources/js/adapters/interaction/GeometryAdapter';
import { MultiInspector } from '../../resources/js/editor/v3/MultiInspector';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { WorkspaceControls, WorkspaceFrame } = await import('../../resources/js/editor/v3/Workspace');
const cleanups: (() => void)[] = [];
afterEach(async () => { await act(async () => cleanups.splice(0).forEach(cleanup => cleanup())); });
function host() {
  const element = document.createElement('div'); document.body.append(element);
  cleanups.push(() => element.remove()); return element;
}
describe('interaction measurement and UI ownership', () => {
  it('sizes only the owned iframe from the authored surface and restores it on unmount', async () => {
    const container = host(), frame = document.createElement('iframe'); container.append(frame);
    frame.style.height = '300px';
    const owner = frame.contentDocument!, surface = owner.createElement('div');
    surface.dataset.v3Surface = ''; owner.body.append(surface);
    Object.defineProperty(surface, 'scrollHeight', { value: 1200 });
    const root = createRoot(host()), extent = vi.fn();
    await act(async () => root.render(React.createElement(WorkspaceFrame, { owner, extent })));
    expect(frame.style.height).toBe('1200px'); expect(extent).toHaveBeenCalledWith(1200);
    await act(async () => root.unmount());
    expect(frame.style.height).toBe('300px');
  });
  it('recognizes owned text inputs and contenteditable descendants without host realm assumptions', () => {
    const container = host();
    container.innerHTML = '<input/><textarea></textarea><select></select><div contenteditable="true"><span>text</span></div><button>node</button>';
    for (const tag of ['input', 'textarea', 'select', 'span']) expect(ownsTextInput(container.querySelector(tag))).toBe(true);
    expect(ownsTextInput(container.querySelector('button'))).toBe(false);
    expect(ownsTextInput(null)).toBe(false);
    const frame = document.createElement('iframe'); container.append(frame);
    const input = frame.contentDocument!.createElement('input');
    expect(ownsTextInput(input)).toBe(true);
  });
  it('resolves current elements by stable identity and deduplicates selected descendants', () => {
    const source = validateDocumentV3(fixture), container = host();
    const parent = source.blocks[0], child = parent.slots.content![0];
    container.innerHTML = '<div id="' + nodeAnchor(parent.instance_id) + '" data-v3-node="' + parent.instance_id + '"><h2 id="' + nodeAnchor(child.instance_id) + '" data-v3-node="' + child.instance_id + '">title</h2></div>';
    expect(canvasTargets(document, source, [parent.instance_id, child.instance_id])).toEqual([container.firstElementChild]);
    expect(canvasTargets(document, source, [])).toEqual([]);
    container.firstElementChild!.setAttribute('data-v3-node', 'wrong');
    expect(canvasTargets(document, source, [parent.instance_id])).toEqual([]);
  });
  it('reads unscaled border dimensions and subtracts margin from layout offsets', () => {
    const element = host(); element.dataset.v3Node = 'identity';
    element.style.cssText = 'box-sizing:border-box;width:123.5px;height:60px;margin-left:4px;margin-top:2px;transform:rotate(15deg)';
    Object.defineProperty(element, 'offsetLeft', { value: 24 }); Object.defineProperty(element, 'offsetTop', { value: 32 });
    expect(measureTargets([element])).toEqual([{ id: 'identity', left: 20, top: 30, width: 123.5, height: 60 }]);
    element.remove(); expect(() => measureTargets([element])).toThrow('detached_target');
  });
  it('exposes semantic keyboard controls while readonly disables only editing modes', async () => {
    const element = host(), root = createRoot(element); cleanups.push(() => root.unmount());
    const change = vi.fn(), setZoom = vi.fn(), fit = vi.fn();
    await act(async () => root.render(React.createElement(WorkspaceControls, { mode: 'structure', change, zoom: 1, setZoom, fit, disabled: true })));
    const buttons = [...element.querySelectorAll('button')];
    expect(buttons.slice(0, 3).every(button => button.disabled)).toBe(true);
    expect(buttons[3].disabled).toBe(false);
    await act(async () => buttons[3].click()); expect(change).toHaveBeenCalledWith('pan');
    await act(async () => buttons[4].click()); expect(fit).toHaveBeenCalledOnce();
    const zoom = element.querySelector('select')!;
    await act(async () => { zoom.value = '0.5'; zoom.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(setZoom).toHaveBeenCalledWith(.5);
    expect(typeof GeometryAdapter).toBe('function');
  });
  it('shows mixed values and broadcasts only the explicitly edited property', async () => {
    const source = structuredClone(validateDocumentV3(fixture));
    const nodes = source.blocks[0].slots.content!.slice(0, 2), ids = nodes.map(node => node.instance_id);
    nodes[0].style.width = { value: 100, unit: 'px' }; nodes[1].style.width = { value: 200, unit: 'px' };
    const element = host(), root = createRoot(element); cleanups.push(() => root.unmount()); const apply = vi.fn();
    await act(async () => root.render(React.createElement(MultiInspector, { document: source, ids, disabled: false, apply })));
    expect(element.querySelector('[role="status"]')!.textContent).toBe('혼합값');
    const button = [...element.querySelectorAll('button')].find(button => button.textContent === '선택 모두 적용')!;
    await act(async () => button.click());
    expect(apply).toHaveBeenCalledWith({ kind: 'styles', updates: ids.map(id => ({ id, set: { width: 'auto' } })) });
    const reset = [...element.querySelectorAll('button')].find(button => button.textContent === '선택 속성 초기화')!;
    await act(async () => reset.click());
    expect(apply).toHaveBeenLastCalledWith({ kind: 'styles', updates: ids.map(id => ({ id, set: {}, reset: ['width'] })) });
  });
});
