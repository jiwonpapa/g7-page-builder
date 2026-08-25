import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DocumentResource, PageBuilderDocument } from '../../resources/js/documents/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

vi.mock('../../resources/js/editor/PuckEditorAdapter', () => ({
  PuckEditorAdapter: ({ document, onDirty, onChange }: {
    document: PageBuilderDocument;
    onDirty?: () => void;
    onChange?: (document: PageBuilderDocument) => void;
  }) => (
    <button type="button" data-testid="mock-editor-dirty" data-document-slug={document.slug} onClick={() => {
      onDirty?.();
      onChange?.({ ...document, slug: 'navigation-guard-changed' });
    }}>변경</button>
  ),
}));

const { PageBuilderApiClient } = await import('../../resources/js/api/pageBuilderApi');
const { AUTO_SAVE_IDLE_MS, mountPageBuilderEditor } = await import('../../resources/js/editor/main');

const resource: DocumentResource = {
  title: '이탈 방지 시험',
  document: {
    schema_version: 'g7-page-builder/v1',
    document_id: '123e4567-e89b-42d3-a456-426614174000',
    slug: 'navigation-guard',
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
  has_unpublished_changes: false,
  created_at: '2026-08-24T00:00:00+09:00',
  updated_at: '2026-08-24T00:00:00+09:00',
  published_at: null,
  archived_at: null,
};

afterEach(() => {
  document.body.replaceChildren();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

async function eventually<T extends Element>(selector: string): Promise<T> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  throw new Error(`Element not rendered: ${selector}`);
}

describe('editor unsaved navigation guard', () => {
  it('restores an exact-lock browser journal before rendering the editor', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    window.localStorage.setItem(`g7pb:draft-journal:v1:${resource.document.document_id}`, JSON.stringify({
      lockVersion: 1,
      savedAt: '2026-08-25T00:00:00.000Z',
      document: { ...resource.document, slug: 'recovered-browser-draft' },
    }));
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockPacks').mockResolvedValue({ items: [] });
    vi.spyOn(PageBuilderApiClient.prototype, 'getDocument').mockResolvedValue(resource);
    vi.spyOn(PageBuilderApiClient.prototype, 'createPreview').mockResolvedValue({
      preview_url: '/preview/navigation-guard',
      expires_at: '2026-08-24T01:00:00+09:00',
    });
    const container = document.createElement('div');
    document.body.append(container);
    let unmount = (): void => undefined;
    await act(async () => {
      unmount = mountPageBuilderEditor(container, { documentId: resource.document.document_id });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect((await eventually<HTMLElement>('[data-testid="mock-editor-dirty"]')).dataset.documentSlug)
      .toBe('recovered-browser-draft');
    expect((await eventually<HTMLElement>('[data-testid="page-builder-save-status"]')).dataset.state).toBe('dirty');
    await act(async () => { unmount(); });
  });

  it('journals immediately, saves after the short idle window, and clears the accepted journal', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockPacks').mockResolvedValue({ items: [] });
    vi.spyOn(PageBuilderApiClient.prototype, 'getDocument').mockResolvedValue(resource);
    vi.spyOn(PageBuilderApiClient.prototype, 'createPreview').mockResolvedValue({
      preview_url: '/preview/navigation-guard',
      expires_at: '2026-08-24T01:00:00+09:00',
    });
    const saveDraft = vi.spyOn(PageBuilderApiClient.prototype, 'saveDraft').mockImplementation(
      async (_documentId, document) => ({ ...resource, document, lock_version: 2, revision: 2 }),
    );
    const container = document.createElement('div');
    document.body.append(container);
    let unmount = (): void => undefined;
    await act(async () => {
      unmount = mountPageBuilderEditor(container, { documentId: resource.document.document_id });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => { (await eventually<HTMLButtonElement>('[data-testid="mock-editor-dirty"]')).click(); });
    const journalKey = `g7pb:draft-journal:v1:${resource.document.document_id}`;
    expect(window.localStorage.getItem(journalKey)).toContain('navigation-guard-changed');
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, AUTO_SAVE_IDLE_MS + 100)); });

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(journalKey)).toBeNull();
    expect((await eventually<HTMLElement>('[data-testid="page-builder-save-status"]')).dataset.state).toBe('saved');
    await act(async () => { unmount(); });
  });

  it('warns immediately after a canvas change and lets the user keep editing', async () => {
    window.localStorage.setItem('auth_token', 'test-token');
    vi.spyOn(PageBuilderApiClient.prototype, 'listBlockPacks').mockResolvedValue({ items: [] });
    vi.spyOn(PageBuilderApiClient.prototype, 'getDocument').mockResolvedValue(resource);
    vi.spyOn(PageBuilderApiClient.prototype, 'createPreview').mockResolvedValue({
      preview_url: '/preview/navigation-guard',
      expires_at: '2026-08-24T01:00:00+09:00',
    });
    const container = document.createElement('div');
    document.body.append(container);
    let unmount = (): void => undefined;
    await act(async () => {
      unmount = mountPageBuilderEditor(container, { documentId: resource.document.document_id });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => { (await eventually<HTMLButtonElement>('[data-testid="mock-editor-dirty"]')).click(); });
    expect((await eventually<HTMLElement>('[data-testid="page-builder-save-status"]')).dataset.state).toBe('dirty');
    expect(AUTO_SAVE_IDLE_MS).toBeLessThanOrEqual(750);
    expect(window.localStorage.getItem(`g7pb:draft-journal:v1:${resource.document.document_id}`))
      .toContain('navigation-guard-changed');

    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await act(async () => { (await eventually<HTMLAnchorElement>('[data-testid="page-builder-manager-link"]')).click(); });
    const dialog = await eventually<HTMLElement>('[data-testid="page-builder-unsaved-dialog"]');
    expect(dialog.textContent).toContain('저장하지 않고 나가면');
    await act(async () => {
      dialog.querySelector<HTMLButtonElement>('[data-testid="page-builder-unsaved-cancel"]')?.click();
    });
    expect(document.querySelector('[data-testid="page-builder-unsaved-dialog"]')).toBeNull();
    expect(document.querySelector('[data-testid="mock-editor-dirty"]')).not.toBeNull();

    await act(async () => { unmount(); });
  });
});
