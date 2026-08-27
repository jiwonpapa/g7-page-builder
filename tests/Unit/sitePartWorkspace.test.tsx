import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const editorProps = vi.hoisted(() => [] as Array<{ kind: string; onChanged?: unknown }>);

vi.mock('../../resources/js/editor/SitePartEditor', () => ({
  SitePartEditor: ({ kind, setId, onChanged }: { kind: string; setId?: string; onChanged?: unknown }) => {
    editorProps.push({ kind, onChanged });
    return <div data-testid={`mock-site-part-${kind}`} data-set-id={setId}>{kind}</div>;
  },
}));

import { SitePartWorkspace } from '../../resources/js/editor/SitePartWorkspace';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  document.body.replaceChildren();
  window.localStorage.clear();
  vi.restoreAllMocks();
  editorProps.length = 0;
});

function setResource(id: string, title: string, isActive: boolean) {
  const part = (suffix: string) => ({
    site_part_id: `${id.slice(0, -1)}${suffix}`,
    revision: 2,
    active_revision: 2,
    status: 'published' as const,
    updated_at: '2026-08-27T10:00:00+09:00',
  });
  return {
    id,
    title,
    locale: 'ko',
    is_active: isActive,
    is_ready: true,
    header: part('1'),
    footer: part('2'),
    created_at: '2026-08-27T09:00:00+09:00',
    updated_at: '2026-08-27T10:00:00+09:00',
  };
}

async function eventually<T extends Element>(selector: string): Promise<T> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const found = document.querySelector<T>(selector);
    if (found) return found;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error(`Element not rendered: ${selector}`);
}

function latestEditorCallback(kind: string): unknown {
  return [...editorProps].reverse().find((props) => props.kind === kind)?.onChanged;
}

describe('Header and Footer workspace', () => {
  it('shows both editors for the selected set and activates the ready pair atomically', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    const defaultSet = setResource('123e4567-e89b-42d3-a456-426614174001', '기본 세트', true);
    const campaignSet = setResource('123e4567-e89b-42d3-a456-426614174002', '캠페인 세트', false);
    globalThis.fetch = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: { items: [defaultSet, campaignSet] } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, message: 'ok', data: { ...campaignSet, is_active: true } }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));

    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => { root.render(<SitePartWorkspace locale="ko" />); });

    await eventually('[data-testid="page-builder-site-part-set"]');
    const initialHeaderCallback = latestEditorCallback('header');
    const initialFooterCallback = latestEditorCallback('footer');
    const campaign = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="page-builder-site-part-set"]'))
      .find((button) => button.textContent?.includes('캠페인 세트'));
    expect(campaign).toBeDefined();
    await act(async () => { campaign?.click(); });

    expect(document.querySelector('[data-testid="mock-site-part-header"]')?.getAttribute('data-set-id')).toBe(campaignSet.id);
    expect(document.querySelector('[data-testid="mock-site-part-footer"]')?.getAttribute('data-set-id')).toBe(campaignSet.id);
    expect(latestEditorCallback('header')).toBe(initialHeaderCallback);
    expect(latestEditorCallback('footer')).toBe(initialFooterCallback);
    const activate = await eventually<HTMLButtonElement>('[data-testid="page-builder-site-part-set-activate"]');
    expect(activate.disabled).toBe(false);
    await act(async () => { activate.click(); });

    expect((await eventually('[role="alert"]')).textContent).toContain('사용 중인 사이트 공통 영역: 캠페인 세트');
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(`/site-part-sets/${campaignSet.id}/activate`),
      expect.objectContaining({ method: 'POST' }),
    );

    await act(async () => { root.unmount(); });
  });
});
