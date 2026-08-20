import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageBuilderManager } from '../../resources/js/manager/PageBuilderManager';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const originalFetch = globalThis.fetch;
const storage = new Map<string, string>();

Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, String(value)),
  },
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  window.localStorage.clear();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function eventually<T extends Element>(selector: string): Promise<T> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.querySelector<T>(selector);
    if (element) {
      return element;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  throw new Error(`Element not rendered: ${selector}`);
}

describe('Page Builder manager surface', () => {
  it('lists only module-owned documents and links them to the independent editor', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      message: 'ok',
      data: {
        items: [{
          title: '독립 문서',
          document: {
            schema_version: 'g7-page-builder/v1',
            document_id: '123e4567-e89b-42d3-a456-426614174000',
            slug: 'independent-page',
            mode: 'canvas',
            locale: 'ko',
            tokens: {},
            blocks: [],
          },
          lock_version: 1,
          revision: 1,
          public_url: null,
          active_artifact_sha256: null,
          is_home: false,
          status: 'draft',
          has_unpublished_changes: true,
          created_at: '2026-08-20T09:00:00+09:00',
          updated_at: '2026-08-20T09:00:00+09:00',
          published_at: null,
          archived_at: null,
        }],
        pagination: { total: 1, page: 1, per_page: 100 },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<PageBuilderManager locale="ko" />);
    });

    const row = await eventually<HTMLElement>('[data-testid="page-builder-document-row"]');
    expect(row.textContent).toContain('독립 문서');
    const editLink = row.querySelector<HTMLAnchorElement>('[data-testid="page-builder-manager-edit-link"]');
    expect(editLink?.getAttribute('href')).toBe(
      '/modules/jiwonpapa-page_builder/admin/editor?document=123e4567-e89b-42d3-a456-426614174000',
    );
    expect(document.querySelector('a[href="/admin/pages"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('opens a prefilled duplicate flow from the compact document action menu', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      message: 'ok',
      data: {
        items: [{
          title: '랜딩 페이지',
          document: {
            schema_version: 'g7-page-builder/v1',
            document_id: '123e4567-e89b-42d3-a456-426614174000',
            slug: 'landing-page',
            mode: 'canvas',
            locale: 'ko',
            tokens: {},
            blocks: [],
            shell_mode: 'none',
          },
          lock_version: 3,
          revision: 2,
          public_url: '/pages/landing-page',
          active_artifact_sha256: 'a'.repeat(64),
          is_home: true,
          status: 'published',
          has_unpublished_changes: false,
          created_at: '2026-08-20T09:00:00+09:00',
          updated_at: '2026-08-20T09:30:00+09:00',
          published_at: '2026-08-20T09:30:00+09:00',
          archived_at: null,
        }],
        pagination: { total: 1, page: 1, per_page: 100 },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<PageBuilderManager locale="ko" />); });

    const more = await eventually<HTMLButtonElement>('[data-testid="page-builder-manager-more"]');
    await act(async () => { more.click(); });
    const duplicate = await eventually<HTMLButtonElement>('[data-testid="page-builder-manager-duplicate"]');
    await act(async () => { duplicate.click(); });

    const dialog = await eventually<HTMLElement>('[data-testid="page-builder-manager-duplicate-dialog"]');
    expect(dialog.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-duplicate-title"]')?.value)
      .toBe('랜딩 페이지 복사본');
    expect(dialog.querySelector<HTMLInputElement>('[data-testid="page-builder-manager-duplicate-slug"]')?.value)
      .toBe('landing-page-copy');
    expect(dialog.textContent).toContain('발행 상태, 공개 주소, 홈 지정, 기존 리비전은 복사하지 않습니다.');

    await act(async () => { root.unmount(); });
  });

  it('links to independent visual Header and Footer editors instead of a settings modal', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    const emptyList = { items: [], pagination: { total: 0, page: 1, per_page: 100 } };
    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: emptyList }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<PageBuilderManager locale="ko" />); });
    const header = await eventually<HTMLAnchorElement>('[data-testid="page-builder-manager-site-header"]');
    const footer = await eventually<HTMLAnchorElement>('[data-testid="page-builder-manager-site-footer"]');
    expect(header.getAttribute('href')).toBe('/modules/jiwonpapa-page_builder/admin/site-parts/header');
    expect(footer.getAttribute('href')).toBe('/modules/jiwonpapa-page_builder/admin/site-parts/footer');
    expect(document.querySelector('[data-testid="page-builder-manager-site-shell"]')).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    await act(async () => { root.unmount(); });
  });

  it('manages independent Block Packs and explains in-use removal blocking', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    const emptyList = { items: [], pagination: { total: 0, page: 1, per_page: 100 } };
    const packs = {
      items: [{
        pack_id: 'vendor/content-pack', pack_version: '1.2.0', kind: 'code',
        publisher: { id: 'vendor', name: '검증 발행자', key_id: 'vendor.main' },
        state: 'disabled', source: 'github', source_uri: 'https://github.com/vendor/content-pack/releases/tag/v1.2.0',
        archive_sha256: 'a'.repeat(64), blocks: 2, presets: 3, runtime_active: true,
        editor_asset_url: '/modules/jiwonpapa-page_builder/block-packs/vendor/content-pack/1.2.0/dist/editor.js',
        style_asset_urls: [], usage: { documents: 1, revisions: 4 },
        installed_at: '2026-08-20T09:00:00+09:00', updated_at: '2026-08-20T09:00:00+09:00',
      }],
    };
    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: emptyList }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: packs }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<PageBuilderManager locale="ko" />); });
    const button = await eventually<HTMLButtonElement>('[data-testid="page-builder-manager-block-packs"]');
    await act(async () => { button.click(); });

    const dialog = await eventually<HTMLElement>('[data-testid="page-builder-block-packs-dialog"]');
    expect(dialog.textContent).toContain('블록 팩 설치·사용·제거');
    expect(dialog.textContent).toContain('문서 1 · 리비전 4 사용 중');
    expect(dialog.textContent).toContain('GitHub Release에서 확인');
    expect(dialog.querySelector<HTMLButtonElement>('.g7pb-button--danger')?.disabled).toBe(true);

    await act(async () => { root.unmount(); });
  });
});
