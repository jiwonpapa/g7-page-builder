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
});
