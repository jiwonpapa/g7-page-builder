import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManagerSiteKitDialog } from '../../resources/js/manager/ManagerSiteKitDialog';
import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';
import { parseSiteKitCatalog, parseSiteKitPreview, parseSiteKitReceipt, type SiteKitReceipt, type SiteKitInstallInput } from '../../resources/js/api/siteKit';
import { readSiteKitInstallation, storeSiteKitInstallation } from '../../resources/js/manager/siteKitInstallationStorage';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
const id = '12000000-0000-4000-8000-000000000001';
const kit = { id: 'company-starter', version: '1.0.0', title: '회사 사이트', description: '3페이지', locale: 'ko', pages: [{ key: 'about', title: '회사소개', path: '/about' }], compatible: true, compatibility_error: null };
const preview = { can_install: true, issues: {}, pages: kit.pages, media_count: 3, kit_version: '1.0.0' };
const receipt: SiteKitReceipt = { request_id: id, kit_id: kit.id, kit_version: '1.0.0', title: kit.title, locale: 'ko',
  pages: [{ ...kit.pages[0], document_id: id, slug: 'site-about' }], set_id: id, status: 'draft' };
function api() { return { listSiteKits: vi.fn().mockResolvedValue({ items: [kit] }), previewSiteKit: vi.fn().mockResolvedValue(preview), installSiteKit: vi.fn<(input: SiteKitInstallInput) => Promise<SiteKitReceipt>>().mockResolvedValue(receipt) }; }
beforeEach(() => { window.sessionStorage.clear(); Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } }); });
afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.replaceChildren(); vi.restoreAllMocks(); });
async function mount(client: ReturnType<typeof api>): Promise<void> {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => { root?.render(<ManagerSiteKitDialog api={client} locale="ko" onClose={() => undefined} />); });
}
async function click(label: string): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(item => item.textContent === label);
  if (!button) throw new Error(`Missing ${label}`);
  await act(async () => button.click());
}
async function prepare(client: ReturnType<typeof api>): Promise<void> {
  await mount(client); await click('구성 선택');
  await act(async () => { document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}

describe('Site Kit installation', () => {
  it('previews before installation and links to the exact installed set', async () => {
    const client = api(); await prepare(client); await click('새 초안으로 설치');
    expect(client.previewSiteKit).toHaveBeenCalledWith(kit.id, { about: '/about' });
    expect(client.installSiteKit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-testid="site-kit-edit-parts"]')?.getAttribute('href')).toContain(`set_id=${id}`);
    expect(document.body.textContent).toContain('회사소개 편집');
    expect(readSiteKitInstallation()?.receipt).toEqual(receipt);
  });
  it('preserves the request ID after network uncertainty and page reentry', async () => {
    const client = api(); client.installSiteKit.mockRejectedValueOnce(new Error('연결 끊김'));
    await prepare(client); await click('새 초안으로 설치');
    const sent = client.installSiteKit.mock.calls[0][0];
    expect(readSiteKitInstallation()?.pending).toEqual(sent);
    act(() => root?.unmount()); root = undefined;
    await mount(client); await click('설치 결과 다시 확인');
    expect(client.installSiteKit.mock.calls[1][0]).toEqual(sent);
    expect(document.querySelector('[data-testid="site-kit-result"]')).not.toBeNull();
  });
  it('invalidates the preview after an address edit and never enables conflicting installation', async () => {
    const client = api(); await prepare(client);
    await act(async () => {
      const input = document.querySelector<HTMLInputElement>('[data-testid="site-kit-path-about"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '/changed');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.querySelector<HTMLButtonElement>('[data-testid="site-kit-install"]')?.disabled).toBe(true);
    client.previewSiteKit.mockResolvedValue({ ...preview, can_install: false, issues: { about: '주소 충돌' } });
    await act(async () => { document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(document.body.textContent).toContain('주소 충돌');
    expect(document.querySelector<HTMLButtonElement>('[data-testid="site-kit-install"]')?.disabled).toBe(true);
    expect(client.installSiteKit).not.toHaveBeenCalled();
  });
  it('isolates a late catalog response from a newly mounted dialog', async () => {
    const old = api(); let complete!: (value: { items: typeof kit[] }) => void;
    old.listSiteKits.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
    await mount(old); act(() => root?.unmount()); root = undefined;
    await mount(api()); await act(async () => complete({ items: [{ ...kit, title: '오래된 응답' }] }));
    expect(document.body.textContent).not.toContain('오래된 응답');
  });
  it('rejects malformed saved receipts and remote page links', () => {
    expect(() => parseSiteKitReceipt({ ...receipt, set_id: '../outside' })).toThrow();
    expect(() => parseSiteKitReceipt({ ...receipt, pages: [{ ...receipt.pages[0], path: '//remote.test' }] })).toThrow();
    expect(parseSiteKitPreview({ ...preview, issues: [] })).toEqual(preview);
    expect(parseSiteKitCatalog({ items: [kit] }).items).toEqual([kit]);
    storeSiteKitInstallation({ pending: null, receipt }); expect(readSiteKitInstallation()?.receipt).toEqual(receipt);
    window.sessionStorage.setItem('g7pb-site-kit-installation-v1', '{invalid'); expect(readSiteKitInstallation()).toBeNull();
  });
  it('uses the shared authenticated API transport and validates its payload', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, data: receipt })));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'synthetic-token' });
    const input = { kit_id: kit.id, kit_version: '1.0.0', title: kit.title, paths: { about: '/about' }, request_id: id };
    expect(await client.installSiteKit(input)).toEqual(receipt);
    expect(fetchImpl.mock.calls[0][0]).toContain('/site-kits/install');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual(input);
  });
});
