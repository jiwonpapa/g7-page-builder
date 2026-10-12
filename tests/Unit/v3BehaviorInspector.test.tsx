import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { indexTree } from '../../resources/js/documents/v3/tree';
import { BehaviorInspector } from '../../resources/js/editor/v3/BehaviorInspector';
import type { Behavior, DocumentV3 } from '../../resources/js/documents/v3/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach(run => run())); });
const source = (kind: keyof typeof cases.behavior_fixtures) => validateDocumentV3({ ...structuredClone(fixture), blocks: structuredClone(cases.behavior_fixtures[kind]) });
async function mount(element: React.ReactNode) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); cleanup.push(() => { root.unmount(); host.remove(); });
  await act(async () => root.render(element)); return host;
}
async function select(host: HTMLElement, label: string, value: string) {
  const input = host.querySelector<HTMLSelectElement>('[aria-label="' + label + '"]')!;
  expect(input, label).not.toBeNull();
  await act(async () => { input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function fill(host: HTMLElement, label: string, value: string) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="' + label + '"]')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function click(host: HTMLElement, label: string) {
  const button = [...host.querySelectorAll('button')].find(node => node.textContent === label);
  if (!button) throw new Error(label);
  await act(async () => button.click());
}
async function check(host: HTMLElement, label: string, value: boolean) {
  const input = host.querySelector<HTMLInputElement>('[aria-label="' + label + '"]')!;
  if (input.checked !== value) await act(async () => input.click());
}
async function connect(host: HTMLElement, behavior: Behavior) {
  await select(host, '동작 유형', behavior.kind);
  if ('label' in behavior) await fill(host, '동작 이름', behavior.label);
  if (behavior.kind === 'tabs') {
    await select(host, '탭 방향', behavior.orientation);
    await select(host, '탭 버튼 영역', behavior.tablist_id);
  }
  if (behavior.kind === 'disclosure') await select(host, '접기 방식', behavior.mode);
  if ('pairs' in behavior) {
    for (const [index, pair] of behavior.pairs.entries()) {
      await click(host, '연결 추가');
      if ('item_id' in pair && typeof pair.item_id === 'string') await select(host, (index + 1) + ' 항목 영역', pair.item_id);
      await select(host, (index + 1) + ' 동작 버튼', pair.trigger_id);
      await select(host, (index + 1) + ' 내용 영역', pair.panel_id);
      if ('expanded' in pair && typeof pair.expanded === 'boolean') await check(host, (index + 1) + ' 처음에 펼침', pair.expanded);
    }
    if (behavior.kind === 'tabs') await select(host, '처음 표시할 내용', behavior.active_panel_id);
  } else {
    await select(host, '슬라이드 표시 영역', behavior.viewport_id);
    await select(host, '슬라이드 트랙', behavior.track_id);
    await select(host, '처음 표시할 슬라이드', behavior.active_slide_id);
    await select(host, '이전 버튼', behavior.previous_id);
    await select(host, '다음 버튼', behavior.next_id);
    await select(host, '자동 재생 버튼', behavior.rotation_id ?? '');
    await check(host, '처음부터 자동 재생', behavior.autoplay);
    await check(host, '슬라이드 반복', behavior.loop);
    await fill(host, '전환 간격', String(behavior.interval_ms));
  }
}

describe('common behavior Inspector uses existing element IDs', () => {
  it.each(['tabs', 'disclosure', 'carousel'] as const)('connects %s on an ordinary authored tree with one command', async kind => {
    const document = source(kind), node = document.blocks[0], expected = structuredClone(node.behavior)!;
    delete node.behavior; node.name = '처음 보는 자유 구성';
    const before = JSON.stringify(document); let result: DocumentV3 | undefined;
    const apply = vi.fn(command => { result = executeDocumentCommand(document, command, () => '').document; });
    const host = await mount(<BehaviorInspector node={node} document={document} disabled={false} apply={apply} />);
    await connect(host, expected);
    expect(apply).not.toHaveBeenCalled();
    await click(host, '동작 적용');
    expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'behavior', id: node.instance_id, value: expected });
    expect(result?.blocks[0].behavior).toEqual(expected);
    expect(JSON.stringify(document)).toBe(before);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('textarea')).toBeNull();
  });
  it('cancels drafts and rejects duplicate references without changing the document', async () => {
    const document = source('tabs'), node = document.blocks[0], before = JSON.stringify(document);
    const apply = vi.fn(command => { executeDocumentCommand(document, command, () => ''); });
    const host = await mount(<BehaviorInspector node={node} document={document} disabled={false} apply={apply} />);
    await select(host, '탭 방향', 'vertical'); await click(host, '동작 입력 취소');
    expect(host.querySelector<HTMLSelectElement>('[aria-label="탭 방향"]')!.value).toBe('horizontal');
    const behavior = node.behavior;
    if (behavior?.kind !== 'tabs') throw new Error('tabs');
    await select(host, '2 동작 버튼', behavior.pairs[0].trigger_id); await click(host, '동작 적용');
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('behavior_duplicate:');
    expect(JSON.stringify(document)).toBe(before);
  });
  it('removes a connection explicitly, offers readonly controls and clears no source fields implicitly', async () => {
    const document = source('disclosure'), node = document.blocks[0], apply = vi.fn();
    const host = await mount(<BehaviorInspector node={node} document={document} disabled={false} apply={apply} />);
    await select(host, '동작 유형', ''); await click(host, '동작 적용');
    expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'behavior', id: node.instance_id, value: null });
    expect(node.behavior?.kind).toBe('disclosure');
    const locked = await mount(<BehaviorInspector node={node} document={document} disabled apply={apply} />);
    expect(locked.querySelector('fieldset')?.disabled).toBe(true);
    await click(locked, '동작 적용'); expect(apply).toHaveBeenCalledTimes(1);
  });
  it('edits a button label as plain text with the same canonical content command', async () => {
    const document = source('tabs'), node = [...indexTree(document).values()].find(item => item.node.type === 'action.button')!.node;
    const apply = vi.fn(command => { executeDocumentCommand(document, command, () => ''); });
    const host = await mount(<BehaviorInspector node={node} document={document} disabled={false} apply={apply} />);
    await fill(host, '버튼 문구', '<b>한글 안내</b>'); await click(host, '버튼 문구 적용');
    expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'content', id: node.instance_id, props: { label: '<b>한글 안내</b>' } });
    expect(host.querySelector('b')).toBeNull();
    expect(host.querySelector('[aria-label="동작 유형"]')).toBeNull();
  });
});
