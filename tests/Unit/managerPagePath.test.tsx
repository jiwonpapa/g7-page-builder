import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagerPagePathPanel } from '../../resources/js/manager/ManagerPagePathPanel';
import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';
import { parsePagePathResource, type PagePathResource } from '../../resources/js/api/pagePath';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); });
const connected: PagePathResource = { path: '/about', lock_version: 3, active: true, reason: null };
function api() { return { getPagePath: vi.fn().mockResolvedValue(connected), setPagePath: vi.fn().mockResolvedValue(connected) }; }
async function mount(client: ReturnType<typeof api>, id = 'one'): Promise<void> {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root?.render(<ManagerPagePathPanel api={client} documentId={id} />); });
  await act(async () => {
    const details = document.querySelector('details'); if (!details) throw new Error('Missing panel');
    details.open = true; details.dispatchEvent(new Event('toggle'));
  });
}
async function edit(value: string): Promise<void> {
  await act(async () => {
    const input = document.querySelector('input'); if (!input) throw new Error('Missing input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit(): Promise<void> { await act(async () => { document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }

describe('Page address settings', () => {
  it('uses the loaded version and keeps the last connected URL after a conflict', async () => {
    const client = api(); client.setPagePath.mockRejectedValue(new Error('다른 페이지가 사용 중인 주소입니다.'));
    await mount(client); await edit('/taken'); await submit();
    expect(client.setPagePath).toHaveBeenCalledWith('one', '/taken', 3);
    expect(document.body.textContent).toContain('다른 페이지가 사용 중인 주소입니다.');
    expect(document.querySelector('[data-testid="page-builder-path-visit"]')?.getAttribute('href')).toBe('/about');
    expect(document.querySelector('input')?.value).toBe('/taken');
  });
  it('releases only the assignment and retains the incremented version', async () => {
    const client = api(); client.setPagePath.mockResolvedValue({ path: null, lock_version: 4, active: false, reason: null });
    await mount(client); await edit(''); await submit();
    expect(client.setPagePath).toHaveBeenCalledWith('one', null, 3);
    expect(document.querySelector('[data-testid="page-builder-path-visit"]')).toBeNull();
    await edit('/new'); await submit(); expect(client.setPagePath).toHaveBeenLastCalledWith('one', '/new', 4);
  });
  it('does not apply an old document request after remounting another document', async () => {
    const client = api(); let finish!: (value: PagePathResource) => void;
    client.getPagePath.mockReturnValueOnce(new Promise<PagePathResource>(resolve => { finish = resolve; }));
    await mount(client); act(() => root?.unmount()); root = undefined;
    await mount(client, 'two'); await act(async () => { finish({ ...connected, path: '/stale' }); });
    expect(document.querySelector('input')?.value).toBe('/about');
  });
  it('rejects malformed or remote response URLs before rendering a link', () => {
    expect(() => parsePagePathResource({ ...connected, path: 'https://evil.invalid' })).toThrow();
    expect(() => parsePagePathResource({ ...connected, path: '//evil' })).toThrow();
    expect(() => parsePagePathResource({ ...connected, lock_version: -1 })).toThrow();
    expect(() => parsePagePathResource({ ...connected, path: null })).toThrow();
  });
  it('sends the authenticated path command through the shared API client', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: connected }), { status: 200 }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'synthetic-test-token' });
    expect(await client.setPagePath('document', '/about', 2)).toEqual(connected);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/documents/document/path');
    expect(init?.method).toBe('PUT'); expect(JSON.parse(String(init?.body))).toEqual({ path: '/about', expected_lock_version: 2 });
    expect(await client.getPagePath('document')).toEqual(connected);
  });
});
