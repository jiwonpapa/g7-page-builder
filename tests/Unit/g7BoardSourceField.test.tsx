import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createG7BoardSourceField } from '../../resources/js/editor/G7BoardSourceField';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: Array<() => void> = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function Harness({ initial = '', readOnly = false }: { initial?: string; readOnly?: boolean }) {
  const [value, setValue] = useState(initial); const field = createG7BoardSourceField();
  if (field.type !== 'custom') throw new Error('Expected custom field.');
  return <><output>{value}</output>{field.render({ field, id: 'board-source', name: 'boardSlug', value, onChange: next => setValue(next ?? ''), readOnly })}</>;
}
async function mount(initial = '', readOnly = false) {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const cleanup = () => act(() => root.unmount()); cleanups.push(cleanup);
  await act(async () => { root.render(<Harness initial={initial} readOnly={readOnly} />); });
  const select = host.querySelector('select'); if (!select) throw new Error('Missing board picker.');
  return { host, select };
}
const available = () => new Response(JSON.stringify({ success: true, data: [{ slug: 'notice', name: '공지사항' }] }));

describe('G7 board source picker', () => {
  it('keeps labels and status bound to each picker when vendor field IDs repeat', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockImplementation(async () => available()));
    const vendorWrapper = document.createElement('div'); vendorWrapper.id = 'board-source'; document.body.append(vendorWrapper);
    const first = await mount(); const second = await mount();
    expect(first.select.id).not.toBe(second.select.id);
    for (const { host, select } of [first, second]) {
      expect(host.querySelector('label')?.control).toBe(select);
      expect(select.labels?.[0]?.textContent).toBe('연결 게시판');
      expect(document.getElementById(select.getAttribute('aria-describedby') ?? '')).toBe(host.querySelector('[role="status"]'));
    }
  });

  it('selects a board by its public name and stores only its slug', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(available()); vi.stubGlobal('fetch', fetcher);
    const { host, select } = await mount();
    expect(fetcher).toHaveBeenCalledWith('/api/modules/sirsoft-board/boards?limit=0', expect.any(Object));
    expect(select.options[1]?.textContent).toBe('공지사항');
    await act(async () => { select.value = 'notice'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector('output')?.textContent).toBe('notice');
  });

  it.each([403, 404, 500])('preserves saved selection on HTTP %s and recovers through refresh', async status => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status })).mockResolvedValueOnce(available());
    vi.stubGlobal('fetch', fetcher); const { host, select } = await mount('notice');
    expect(select.disabled).toBe(true); expect(select.value).toBe('notice');
    expect(host.querySelector('output')?.textContent).toBe('notice');
    expect(host.textContent).toContain('접근 권한');
    await act(async () => { host.querySelector('button')?.click(); });
    expect(select.disabled).toBe(false); expect(select.value).toBe('notice');
  });

  it('keeps missing selections and disables an empty or invalid catalog', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ slug: '../admin', name: 'invalid' }] }))));
    const { host, select } = await mount('retired-board');
    expect(select.disabled).toBe(true); expect(select.value).toBe('retired-board');
    expect(host.textContent).toContain('선택할 수 있는 게시판이 없습니다.');
  });

  it('honors read-only editing', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(available()));
    expect((await mount('notice', true)).select.disabled).toBe(true);
  });
});
