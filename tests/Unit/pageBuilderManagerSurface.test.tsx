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

  it('edits one global navigation model for desktop and mobile site chrome', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    const emptyList = { items: [], pagination: { total: 0, page: 1, per_page: 100 } };
    const shell = {
      locale: 'ko', lock_version: 1, brand_name: '지원소프트', logo_url: '', home_url: '/',
      header_variant: 'solid', sticky: true,
      navigation: [{ label: '소개', url: '/pages/about' }],
      cta: null, footer_text: '지원소프트', show_footer_navigation: true, updated_at: null,
    };
    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: emptyList }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: shell }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: {
        id: '123e4567-e89b-42d3-a456-426614174009', url: '/storage/g7-page-builder/logo.webp',
        original_name: 'logo.webp', mime_type: 'image/webp', bytes: 12, width: 120, height: 40,
        created_at: '2026-08-20T09:00:00+09:00',
      } }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: {
        ...shell, lock_version: 2, brand_name: '새 브랜드', logo_url: '/storage/g7-page-builder/logo.webp',
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<PageBuilderManager locale="ko" />); });
    const button = await eventually<HTMLButtonElement>('[data-testid="page-builder-manager-site-shell"]');
    await act(async () => { button.click(); });

    const dialog = await eventually<HTMLElement>('[data-testid="page-builder-site-shell-dialog"]');
    expect(dialog.textContent).toContain('공통 Header·Footer와 메뉴');
    expect(dialog.querySelector<HTMLInputElement>('[aria-label="1번 메뉴 이름"]')?.value).toBe('소개');
    expect(dialog.querySelector<HTMLInputElement>('[aria-label="1번 메뉴 주소"]')?.value).toBe('/pages/about');

    const brand = dialog.querySelector<HTMLInputElement>('[data-testid="page-builder-site-shell-brand"]');
    const addMenu = dialog.querySelector<HTMLButtonElement>('[data-testid="page-builder-site-shell-add-menu"]');
    const upload = dialog.querySelector<HTMLInputElement>('[data-testid="page-builder-site-shell-logo-upload"]');
    const save = dialog.querySelector<HTMLButtonElement>('[data-testid="page-builder-site-shell-save"]');
    expect(brand && addMenu && upload && save).toBeTruthy();

    await act(async () => {
      if (brand) {
        brand.value = '새 브랜드';
        brand.dispatchEvent(new Event('input', { bubbles: true }));
      }
      addMenu?.click();
    });
    expect(dialog.querySelector<HTMLInputElement>('[aria-label="2번 메뉴 이름"]')?.value).toBe('새 메뉴');
    await act(async () => {
      dialog.querySelector<HTMLButtonElement>('[aria-label="새 메뉴 메뉴 삭제"]')?.click();
      dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
      addMenu?.click();
    });

    const file = new File(['image'], 'logo.webp', { type: 'image/webp' });
    Object.defineProperty(upload, 'files', { configurable: true, value: [file] });
    await act(async () => {
      upload?.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      save?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(document.querySelector('[data-testid="page-builder-site-shell-dialog"]')).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);

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
