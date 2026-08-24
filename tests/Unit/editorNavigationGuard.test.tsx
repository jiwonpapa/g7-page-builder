import React, { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DocumentResource } from '../../resources/js/documents/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

vi.mock('../../resources/js/editor/PuckEditorAdapter', () => ({
  PuckEditorAdapter: ({ onDirty }: { onDirty?: () => void }) => (
    <button type="button" data-testid="mock-editor-dirty" onClick={onDirty}>변경</button>
  ),
}));

const { PageBuilderApiClient } = await import('../../resources/js/api/pageBuilderApi');
const { mountPageBuilderEditor } = await import('../../resources/js/editor/main');

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
