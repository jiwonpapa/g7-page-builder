import { describe, expect, it, vi } from 'vitest';

import {
  PAGE_BUILDER_API_PREFIX,
  PageBuilderApiClient,
  PageBuilderApiError,
  buildAdminLoginUrl,
} from '../../resources/js/api/pageBuilderApi';
import type { DocumentResource } from '../../resources/js/documents/types';

const documentResource: DocumentResource = {
  title: '테스트 페이지',
  document: {
    schema_version: 'g7-page-builder/v1',
    document_id: '123e4567-e89b-42d3-a456-426614174000',
    slug: 'test-page',
    mode: 'canvas',
    locale: 'ko',
    tokens: {},
    blocks: [],
  },
  lock_version: 7,
  revision: 6,
  public_url: null,
  active_artifact_sha256: null,
  is_home: false,
  status: 'draft',
  has_unpublished_changes: true,
  created_at: '2026-08-20T09:00:00+09:00',
  updated_at: '2026-08-20T09:00:00+09:00',
  published_at: null,
  archived_at: null,
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PageBuilderApiClient', () => {
  it('loads the module-owned document list without using the bundled page API', async () => {
    const listResource = {
      items: [documentResource],
      pagination: { total: 1, page: 1, per_page: 100 },
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: listResource }),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.listDocuments()).resolves.toEqual(listResource);
    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/documents?page=1&per_page=100&status=active`,
    );
  });

  it('uses the BaseController envelope and Sanctum Bearer auth', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: documentResource }),
    );
    const client = new PageBuilderApiClient({
      fetchImpl,
      readAuthToken: () => 'sanctum-token',
    });

    await expect(client.getDocument(documentResource.document.document_id)).resolves.toEqual(documentResource);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${PAGE_BUILDER_API_PREFIX}/documents/${documentResource.document.document_id}`);
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer sanctum-token');
    expect(init?.credentials).toBe('same-origin');
  });

  it('uploads media as multipart without forcing a JSON content type', async () => {
    const asset = {
      id: '123e4567-e89b-42d3-a456-426614174001',
      url: 'https://g7pb.test/storage/g7-page-builder/example.webp',
      original_name: 'example.webp',
      mime_type: 'image/webp',
      bytes: 12,
      width: 2,
      height: 2,
      created_at: '2026-08-20T09:00:00+09:00',
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: asset }, 201),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.uploadMedia(new File(['image'], 'example.webp', { type: 'image/webp' }))).resolves.toEqual(asset);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('sends expected_lock_version for preview and publication prepare', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'ok',
        data: { preview_url: '/preview/token', expires_at: '2026-08-19T06:00:00Z' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'ok',
        data: { publication_token: 'pub-token', artifact_sha256: 'a'.repeat(64), warnings: [] },
      }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.createPreview(documentResource.document.document_id, 7);
    await client.preparePublication(documentResource.document.document_id, 7);

    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ expected_lock_version: 7 });
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({ expected_lock_version: 7 });
  });

  it('updates module-owned metadata with compare-and-swap locking', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: documentResource }),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.updateDocument(documentResource.document.document_id, {
      title: '수정 제목',
      slug: 'updated-page',
      locale: 'ko',
      expected_lock_version: 7,
    });

    expect(fetchImpl.mock.calls[0][1]?.method).toBe('PATCH');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      title: '수정 제목',
      slug: 'updated-page',
      locale: 'ko',
      expected_lock_version: 7,
    });
  });

  it('lists and restores immutable revisions through module-owned endpoints', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'ok',
        data: { current_revision: 6, items: [] },
      }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: documentResource }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.listRevisions(documentResource.document.document_id);
    await client.restoreRevision(documentResource.document.document_id, 2, 7);

    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/documents/${documentResource.document.document_id}/revisions?limit=20`,
    );
    expect(fetchImpl.mock.calls[1][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/documents/${documentResource.document.document_id}/revisions/2/restore`,
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({ expected_lock_version: 7 });
  });

  it('unpublishes with compare-and-swap locking instead of deleting the document', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: documentResource }),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.unpublishDocument(documentResource.document.document_id, 7);

    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/documents/${documentResource.document.document_id}/publications/unpublish`,
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ expected_lock_version: 7 });
  });

  it('assigns a published document to home through the module-owned API', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: { ...documentResource, is_home: true } }),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.setHomeDocument(documentResource.document.document_id, true, 7);

    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/documents/${documentResource.document.document_id}/home`,
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      enabled: true,
      expected_lock_version: 7,
    });
  });

  it('redirects to the admin login with a same-origin editor path when auth is missing', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const onUnauthorized = vi.fn();
    const client = new PageBuilderApiClient({
      fetchImpl,
      readAuthToken: () => null,
      currentUrl: () => '/modules/jiwonpapa-page_builder/admin/editor?document=abc',
      onUnauthorized,
    });

    await expect(client.getDocument('abc')).rejects.toMatchObject({
      status: 401,
      code: 'G7PB_AUTH_REQUIRED',
    } satisfies Partial<PageBuilderApiError>);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(onUnauthorized).toHaveBeenCalledWith(
      buildAdminLoginUrl('/modules/jiwonpapa-page_builder/admin/editor?document=abc'),
    );
  });
});
