import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SitePartKind, SitePartResource } from '../../resources/js/documents/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
const storage = new Map<string, string>();
Object.defineProperty(window, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key), clear: () => storage.clear(),
} });
const { SitePartEditor } = await import('../../resources/js/editor/SitePartEditor');
const { PageBuilderApiClient } = await import('../../resources/js/api/pageBuilderApi');

const SET_A = '10000000-0000-4000-8000-000000000001';
const SET_B = '10000000-0000-4000-8000-000000000002';
function resource(setId = SET_A): SitePartResource {
  return { set_id: setId, title: `Set ${setId === SET_A ? 'A' : 'B'}`, lock_version: 7, revision: 1,
    active_revision: null, status: 'draft', created_at: null, updated_at: null, published_at: null,
    document: { schema_version: 'g7-page-builder/site-part/v1',
      site_part_id: setId === SET_A ? '20000000-0000-4000-8000-000000000001' : '20000000-0000-4000-8000-000000000002',
      kind: 'header', locale: 'ko', tokens: {}, blocks: [{ instance_id: crypto.randomUUID(),
        type: 'site.header.announcement-01', block_version: 1,
        props: { text: 'Content A', link_label: '', link_url: '/', tone: 'brand' }, slots: {} }] },
  };
}
const cleanups: Array<() => void> = [];
afterEach(async () => {
  await act(async () => { cleanups.splice(0).forEach((cleanup) => cleanup()); });
  vi.restoreAllMocks(); vi.useRealTimers(); storage.clear();
});
async function mount(loaded: SitePartResource, setId?: string) {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const load = vi.spyOn(PageBuilderApiClient.prototype, 'getSitePart').mockResolvedValue(loaded);
  const save = vi.spyOn(PageBuilderApiClient.prototype, 'saveSitePart').mockResolvedValue({ ...loaded, lock_version: 8 });
  const publish = vi.spyOn(PageBuilderApiClient.prototype, 'publishSitePart').mockResolvedValue({ ...loaded, status: 'published' });
  const changed = vi.fn();
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  cleanups.push(() => { root.unmount(); host.remove(); });
  const render = async (kind: SitePartKind = 'header', locale = 'ko') => {
    await act(async () => root.render(<SitePartEditor kind={kind} locale={locale} setId={setId} iframeEnabled={false} onChanged={changed} />));
  };
  await render();
  // Finish Puck's initial 0ms resolver before making user commands.
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  const button = (action: 'save' | 'publish'): HTMLButtonElement => {
    const selected = action === 'publish'
      ? host.querySelector<HTMLButtonElement>('[data-testid="page-builder-site-part-publish"]')
      : Array.from(host.querySelectorAll<HTMLButtonElement>('.g7pb-command-bar button')).find((item) => item.textContent?.trim() === '저장');
    if (!selected) throw new Error(`Missing ${action} button`);
    return selected;
  };
  const click = async (action: 'save' | 'publish') => { await act(async () => button(action).click()); };
  const edit = async () => {
    const input = Array.from(host.querySelectorAll<HTMLInputElement>('input')).find((item) => item.value === 'Content A');
    if (!input) throw new Error('Missing selected Announcement text field');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setValue) throw new Error('Missing native text input setter');
    await act(async () => { setValue.call(input, 'Edited A'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  return { host, load, save, publish, changed, button, click, edit, render };
}

describe('SitePartEditor write identity', () => {
  it('saves and publishes the loaded A set after the active set switches to B at the same lock', async () => {
    const a = resource(), b = resource(SET_B), test = await mount(a);
    let active = SET_A;
    const stored = new Map([[SET_A, a], [SET_B, b]]);
    test.save.mockImplementation(async (_kind, title, document, _lock, requestedSet) => {
      const target = requestedSet ?? active;
      const before = stored.get(target);
      if (!before) throw new Error('Unknown synthetic set');
      const saved = { ...before, title, document: { ...document, site_part_id: before.document.site_part_id }, lock_version: before.lock_version + 1 };
      stored.set(target, saved); return saved;
    });
    test.publish.mockImplementation(async (_kind, _locale, _lock, requestedSet) => {
      const target = requestedSet ?? active;
      const before = stored.get(target);
      if (!before) throw new Error('Unknown synthetic set');
      const published: SitePartResource = { ...before, status: 'published' };
      stored.set(target, published); return published;
    });
    active = SET_B;
    await test.edit();
    await test.click('save');
    await test.click('publish');
    expect(test.save).toHaveBeenCalled();
    expect(test.save.mock.calls.every((call) => call[4] === SET_A)).toBe(true);
    expect(test.publish).toHaveBeenCalledWith('header', 'ko', 8, SET_A);
    expect(stored.get(SET_A)?.document.blocks[0].props.text).toBe('Edited A');
    expect(stored.get(SET_A)?.status).toBe('published');
    expect(stored.get(SET_B)).toEqual(b);
  });

  it.each([null, ''])('blocks writing when the loaded set id is %s', async (missing) => {
    const test = await mount({ ...resource(), set_id: missing });
    expect(test.host.querySelector('[role="alert"]')?.textContent).toContain('세트 ID가 없어');
    expect(test.button('save').disabled).toBe(true);
    expect(test.button('publish').disabled).toBe(true);
    expect(test.changed).not.toHaveBeenCalled();
    expect(test.save).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
  });

  it('rejects a loaded response that differs from the explicitly requested set', async () => {
    const test = await mount(resource(SET_B), SET_A);
    expect(test.host.querySelector('[role="alert"]')?.textContent).toContain('일치하지 않습니다');
    expect(test.button('save').disabled).toBe(true);
    expect(test.changed).not.toHaveBeenCalled();
  });

  it.each([['footer', 'ko'], ['header', 'en']] as const)('blocks stale writes after changing to %s/%s when reloading fails', async (kind, locale) => {
    const a = resource();
    const test = await mount({ ...a, document: { ...a.document, blocks: [] } });
    test.load.mockRejectedValue(new Error('Reload failed'));
    await test.render(kind, locale);
    expect(test.load).toHaveBeenLastCalledWith(kind, locale, undefined);
    expect(test.host.querySelector('[role="alert"]')?.textContent).toContain('Reload failed');
    await test.click('save');
    await test.click('publish');
    expect(test.save).not.toHaveBeenCalled();
    expect(test.publish).not.toHaveBeenCalled();
    expect(test.changed).toHaveBeenCalledTimes(1);
    expect(test.host.querySelector('[role="alert"]')?.textContent).toContain('일치하지 않습니다');
  });

  it.each(['set', 'document', 'missing'] as const)('rejects a mismatched %s save response and does not continue publication', async (mismatch) => {
    const a = resource(), test = await mount(a, SET_A);
    const other = mismatch === 'set' ? resource(SET_B)
      : mismatch === 'document' ? { ...a, document: resource(SET_B).document }
        : { ...a, set_id: null };
    test.save.mockResolvedValue(other);
    await test.edit();
    await test.click('publish');
    expect(test.save).toHaveBeenCalledWith('header', a.title, expect.objectContaining({ site_part_id: a.document.site_part_id }), 7, SET_A);
    expect(test.publish).not.toHaveBeenCalled();
    expect(test.changed).toHaveBeenCalledTimes(1);
    expect(test.host.querySelector('[role="alert"]')?.textContent).toMatch(/일치하지 않습니다|세트 ID가 없어/);
    expect(test.host.querySelector('.g7pb-status')?.textContent).toBe('저장할 변경 있음');
  });

  it('rejects a publication response for another set without claiming success', async () => {
    const a = resource(), test = await mount(a);
    test.publish.mockResolvedValue(resource(SET_B));
    await test.click('publish');
    expect(test.publish.mock.calls[0]?.[3]).toBe(SET_A);
    expect(test.changed.mock.calls.every(([value]) => value.set_id === SET_A)).toBe(true);
    expect(test.host.querySelector('[role="alert"]')?.textContent).toContain('일치하지 않습니다');
    expect(test.host.querySelector('[role="alert"]')?.textContent).not.toContain('발행을 완료');
  });
});
