import React, { act, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageBuilderApiClient } from '../../resources/js/api/pageBuilderApi';
import type { MediaAssetResource } from '../../resources/js/documents/types';
import { createDownloadField } from '../../resources/js/editor/DownloadPickerField';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) cleanup();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function eventually<T extends Element>(selector: string): Promise<T> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  }
  throw new Error(`Element not rendered: ${selector}`);
}

function DownloadFieldHarness(): React.ReactElement {
  const [value, setValue] = useState('');
  const field = useMemo(() => createDownloadField('다운로드 파일'), []);
  if (field.type !== 'custom') throw new Error('Expected a custom download field.');

  return <div>
    <output data-testid="download-value">{value}</output>
    {field.render({ field, id: 'download-url', name: 'url', value, onChange: setValue })}
  </div>;
}

describe('DownloadPickerField', () => {
  it('lists only download assets, applies a selected file, and uploads with the download kind', async () => {
    const existing: MediaAssetResource = {
      id: '123e4567-e89b-42d3-a456-426614174080',
      url: '/storage/g7-page-builder/guide.pdf',
      original_name: 'guide.pdf',
      mime_type: 'application/pdf',
      bytes: 2048,
      width: 0,
      height: 0,
      kind: 'download',
      created_at: '2026-08-22T09:00:00+09:00',
    };
    const uploaded: MediaAssetResource = {
      ...existing,
      id: '123e4567-e89b-42d3-a456-426614174081',
      url: '/storage/g7-page-builder/spec.zip',
      original_name: 'spec.zip',
      mime_type: 'application/zip',
    };
    const listMedia = vi.spyOn(PageBuilderApiClient.prototype, 'listMedia').mockResolvedValue({ items: [existing] });
    const uploadMedia = vi.spyOn(PageBuilderApiClient.prototype, 'uploadMedia').mockResolvedValue(uploaded);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));

    await act(async () => { root.render(<DownloadFieldHarness />); });
    await act(async () => { (await eventually<HTMLButtonElement>('[data-testid="page-builder-download-open"]')).click(); });
    const existingButton = await eventually<HTMLButtonElement>('[data-testid="page-builder-download-item"]');
    expect(existingButton.textContent).toContain('guide.pdf');
    expect(listMedia).toHaveBeenCalledWith('download');

    await act(async () => { existingButton.click(); });
    expect(document.querySelector('[data-testid="download-value"]')?.textContent).toBe(existing.url);

    await act(async () => { (await eventually<HTMLButtonElement>('[data-testid="page-builder-download-open"]')).click(); });
    const input = await eventually<HTMLInputElement>('[data-testid="page-builder-download-file"]');
    const file = new File(['zip'], 'spec.zip', { type: 'application/zip' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(uploadMedia).toHaveBeenCalledWith(file, 'download');
    expect(document.querySelector('[data-testid="download-value"]')?.textContent).toBe(uploaded.url);
  });
});
