import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockCatalogResource } from '../../resources/js/blocks/types';
import type { SitePartResource } from '../../resources/js/api/resources';
import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';
import { usePageBuilderResources } from '../../resources/js/editor/usePageBuilderResources';

vi.hoisted(() => { globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }; });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: () => 'synthetic-token' } });
function pending<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const catalogId = 'block:content.heading-01@1';
function catalog(): BlockCatalogResource {
  return { categories: [], items: [{ catalog_id: catalogId, kind: 'definition', block_id: 'content.heading-01', block_version: 1,
    pack_id: 'synthetic/resources', pack_version: '1.0.0', category: 'basic', label: { ko: '한국어', en: 'English' },
    description: { ko: '합성', en: 'Synthetic' }, thumbnail: '', editor_component: 'Heading', favorite: false, insertable: true, preset_props: null }] };
}
function part(locale: string, kind: 'header' | 'footer'): SitePartResource {
  return { set_id: crypto.randomUUID(), title: `${locale} ${kind}`, document: { schema_version: 'g7-page-builder/site-part/v1',
    site_part_id: crypto.randomUUID(), kind, locale, tokens: {}, blocks: [] }, lock_version: 1, revision: 1, active_revision: 1,
    status: 'published', created_at: null, updated_at: null, published_at: null };
}
const cleanups: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanups.splice(0).forEach((run) => run())); vi.restoreAllMocks(); });

async function mount() {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  let result: ReturnType<typeof usePageBuilderResources> | null = null;
  let mounted = true, renders = 0;
  function Probe({ locale, enabled }: { locale: string; enabled: boolean }) {
    result = usePageBuilderResources(locale, 'builder', enabled); renders++; return null;
  }
  const render = (locale: string, enabled = true) => act(async () => root.render(<Probe locale={locale} enabled={enabled} />));
  const unmount = () => { if (mounted) { mounted = false; root.unmount(); host.remove(); } };
  cleanups.push(unmount); await render('ko');
  const current = () => { if (!result) throw new Error('Missing hook result'); return result; };
  return { current, render, unmount, renders: () => renders };
}

describe('page builder resource lifetime', () => {
  it('ignores old locale fetches and favorite completion after the next locale has loaded', async () => {
    const koCatalog = pending<BlockCatalogResource>(), enCatalog = pending<BlockCatalogResource>();
    const koHeader = pending<SitePartResource>(), koFooter = pending<SitePartResource>();
    const enHeader = pending<SitePartResource>(), enFooter = pending<SitePartResource>();
    const favorite = pending<{ catalog_id: string; favorite: boolean }>();
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockCatalog').mockImplementation(({ locale } = {}) => locale === 'en' ? enCatalog.promise : koCatalog.promise);
    vi.spyOn(PageBuilderApiClient.prototype, 'getSitePart').mockImplementation((kind, locale) =>
      locale === 'en' ? kind === 'header' ? enHeader.promise : enFooter.promise : kind === 'header' ? koHeader.promise : koFooter.promise);
    const favoriteCall = vi.spyOn(PageBuilderApiClient.prototype, 'setBlockFavorite').mockReturnValue(favorite.promise);
    const test = await mount();
    const old = test.current();
    const savingFavorite = old.blockCatalogContext.toggleFavorite(catalogId, true);
    await test.render('en');
    const currentHeader = part('en', 'header'), currentFooter = part('en', 'footer');
    await act(async () => { enCatalog.resolve(catalog()); enHeader.resolve(currentHeader); enFooter.resolve(currentFooter); });
    expect(test.current().blockCatalogContext.items[0].title).toBe('English');
    await act(async () => {
      koCatalog.resolve(catalog()); koHeader.resolve(part('ko', 'header')); koFooter.resolve(part('ko', 'footer'));
      favorite.resolve({ catalog_id: catalogId, favorite: true }); await savingFavorite;
      old.refreshSitePart(part('ko', 'header'));
    });
    expect(test.current().siteParts).toEqual({ header: currentHeader, footer: currentFooter });
    expect(test.current().blockCatalogContext.items[0]).toMatchObject({ title: 'English', favorite: false });
    const latest = test.current();
    await act(async () => test.unmount()); const renderCount = test.renders();
    await act(async () => {
      await latest.blockCatalogContext.toggleFavorite(catalogId, false);
      latest.refreshSitePart(part('en', 'header'));
    });
    expect(favoriteCall).toHaveBeenCalledTimes(1);
    expect(test.renders()).toBe(renderCount);
  });

  it('leaves a disposed hook untouched when pending catalog and Site Part reads complete', async () => {
    const blocks = pending<BlockCatalogResource>(), header = pending<SitePartResource>(), footer = pending<SitePartResource>();
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockCatalog').mockReturnValue(blocks.promise);
    vi.spyOn(PageBuilderApiClient.prototype, 'getSitePart').mockImplementation((kind) => kind === 'header' ? header.promise : footer.promise);
    const test = await mount(), before = test.current();
    await act(async () => test.unmount()); const renderCount = test.renders();
    await act(async () => { blocks.resolve(catalog()); header.resolve(part('ko', 'header')); footer.resolve(part('ko', 'footer')); });
    expect(test.current()).toBe(before);
    expect(test.renders()).toBe(renderCount);
  });
});
