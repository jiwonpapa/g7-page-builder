import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { cloneDocument } from '../../resources/js/documents/v3/tree';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { Inspector } from '../../resources/js/editor/v3/Inspector';
import { TypedInput } from '../../resources/js/editor/v3/TypedInput';
import { groups, styleRules, choices, seed, matches, choiceLabel } from '../../resources/js/editor/v3/inspectorFields';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach(run => run())); });
async function mount(element: React.ReactNode) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); cleanup.push(() => { root.unmount(); host.remove(); });
  await act(async () => root.render(element)); return host;
}
async function click(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === label);
  if (!button) throw new Error(label); await act(async () => button.click());
}
describe('precision Inspector', () => {
  it('shows inherited values, seeds overrides from effective values and resets only the active layer', async () => {
    const doc = cloneDocument(validateDocumentV3(fixture)), node = doc.blocks[0].slots.content![0];
    node.style = { width: { value: 70, unit: '%' }, opacity: .5 };
    node.responsive = { tablet: { opacity: .7 }, mobile: { opacity: 0 } };
    const apply = vi.fn(), host = await mount(<Inspector node={node} document={doc} viewport="mobile" disabled={false} apply={apply} />);
    expect(host.querySelector('[aria-label="너비 상속"]')?.textContent).toContain('70');
    await act(async () => host.querySelector<HTMLInputElement>('[aria-label="너비 지정"]')!.click());
    await click(host, '디자인 적용');
    expect(apply.mock.calls[0][0]).toMatchObject({ viewport: 'mobile', set: { width: { value: 70, unit: '%' }, opacity: 0 } });
    await click(host, '현재 화면 스타일 초기화');
    await click(host, '디자인 적용');
    expect(apply.mock.calls[1][0]).toEqual({ kind: 'style', viewport: 'mobile', id: node.instance_id, set: {}, reset: ['opacity'] });
    const result = executeDocumentCommand(doc, apply.mock.calls[1][0], () => '').document;
    expect(result.blocks[0].slots.content![0].style).toEqual(node.style);
    expect(result.blocks[0].slots.content![0].responsive).toEqual({ tablet: { opacity: .7 } });
  });
  it('covers typed layout, all size and four-sided appearance groups without JSON/CSS inputs', () => {
    const keys = groups.flatMap(group => group.keys);
    for (const key of ['display', 'columns', 'rows', 'basis', 'width', 'height', 'aspect_ratio', 'min_width', 'max_height',
      'padding_left', 'margin_bottom', 'border_right', 'radius_top_left', 'shadows', 'background', 'line_height', 'letter_spacing']) expect(keys).toContain(key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(styleRules[key]).toBeDefined();
    expect(choices(styleRules.width!).map(choiceLabel)).toEqual(expect.arrayContaining(['auto', 'hug', 'fill', 'px', '%', 'rem', 'vw', 'vh']));
    expect(choices(styleRules.columns!).length).toBe(1);
    expect(matches(seed(styleRules.opacity!), styleRules.opacity!)).toBe(true);
    expect(matches('', styleRules.opacity!)).toBe(false);
  });
  it('does not commit typing drafts; applies explicit zero and reset as one command', async () => {
    const doc = cloneDocument(validateDocumentV3(fixture)), node = doc.blocks[0].slots.content![0];
    node.style = { opacity: 0, width: { value: 50, unit: '%' } };
    const apply = vi.fn(), host = await mount(<Inspector node={node} document={doc} disabled={false} apply={apply} />);
    expect(apply).not.toHaveBeenCalled();
    const widthReset = host.querySelector<HTMLButtonElement>('[aria-label="너비 초기화"]')!;
    await act(async () => widthReset.click());
    expect(apply).not.toHaveBeenCalled();
    await click(host, '디자인 적용');
    expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'style', id: node.instance_id, set: { opacity: 0 }, reset: ['width'] });
    const result = executeDocumentCommand(doc, apply.mock.calls[0][0], () => 'unused').document;
    expect(result.blocks[0].slots.content![0].style).toEqual({ opacity: 0 });
    expect(result.blocks[0].slots.content![0].responsive).toEqual(node.responsive);
  });
  it('cancel and Escape discard drafts; locked/readonly Inspector disables every control', async () => {
    const doc = cloneDocument(validateDocumentV3(fixture)), node = doc.blocks[0]; node.style = { opacity: 0 };
    const apply = vi.fn(), host = await mount(<Inspector node={node} document={doc} disabled={false} apply={apply} />);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="불투명도 초기화"]')!.click());
    await click(host, '입력 취소');
    expect(host.querySelector('[aria-label="불투명도 초기화"]')).not.toBeNull();
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="불투명도 초기화"]')!.click());
    await act(async () => host.querySelector('form')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('[aria-label="불투명도 초기화"]')).not.toBeNull();
    expect(apply).not.toHaveBeenCalled();
    const locked = await mount(<Inspector node={node} document={doc} disabled apply={apply} />);
    expect(locked.querySelector('fieldset')?.disabled).toBe(true);
  });
  it('surfaces command rejection without partial mutation and offers bounded track add/remove controls', async () => {
    const doc = cloneDocument(validateDocumentV3(fixture)), node = doc.blocks[0]; node.style = { opacity: 0 };
    const host = await mount(<Inspector node={node} document={doc} disabled={false} apply={() => { throw new Error('stale_context'); }} />);
    await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="불투명도 초기화"]')!.click());
    await click(host, '디자인 적용');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('stale_context');
    expect(node.style.opacity).toBe(0);
    const change = vi.fn();
    const controls = await mount(<TypedInput rule={styleRules.columns!} value={['auto']} label="열" change={change} />);
    await click(controls, '열 추가');
    expect(change.mock.calls[0][0]).toHaveLength(2);
    expect(controls.querySelector<HTMLButtonElement>('[aria-label="열 1 삭제"]')?.disabled).toBe(true);
  });
});
