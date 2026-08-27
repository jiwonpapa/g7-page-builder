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

  it('loads the active G7 template route catalog through the module adapter', async () => {
    const catalog = {
      active_template: 'sirsoft-basic',
      routes: [{
        id: 'auth.login',
        label: '로그인',
        category: '회원',
        path: '/login',
        auth_required: false,
        guest_only: true,
        parameters: [],
        parameter_sources: {},
        source: { kind: 'template', identifier: null },
      }],
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: catalog }),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.getRouteCatalog()).resolves.toEqual(catalog);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/routes/catalog`);
  });

  it('uses typed endpoints for listing, creating, and atomically activating Header and Footer sets', async () => {
    const setId = '123e4567-e89b-42d3-a456-426614174099';
    const set = { id: setId, title: '회사 기본형', locale: 'ko', is_active: false, is_ready: true };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { items: [set] } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: set }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { ...set, is_active: true } }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.listSitePartSets('ko');
    await client.createSitePartSet('회사 기본형', 'ko');
    await client.activateSitePartSet(setId, 'ko');

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${PAGE_BUILDER_API_PREFIX}/site-part-sets?locale=ko`);
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({ title: '회사 기본형', locale: 'ko' });
    expect(fetchImpl.mock.calls[2]?.[0]).toBe(`${PAGE_BUILDER_API_PREFIX}/site-part-sets/${setId}/activate`);
    expect(JSON.parse(String(fetchImpl.mock.calls[2]?.[1]?.body))).toEqual({ locale: 'ko' });
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

  it('duplicates a document into a new draft through a dedicated endpoint', async () => {
    const copy = {
      ...documentResource,
      title: '테스트 페이지 복사본',
      document: {
        ...documentResource.document,
        document_id: '123e4567-e89b-42d3-a456-426614174099',
        slug: 'test-page-copy',
      },
      lock_version: 1,
      revision: 1,
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: copy }, 201),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.duplicateDocument(documentResource.document.document_id, {
      title: '테스트 페이지 복사본',
      slug: 'test-page-copy',
      expected_lock_version: 7,
    })).resolves.toEqual(copy);

    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/documents/${documentResource.document.document_id}/duplicate`,
    );
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('POST');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      title: '테스트 페이지 복사본',
      slug: 'test-page-copy',
      expected_lock_version: 7,
    });
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
      kind: 'image' as const,
      created_at: '2026-08-20T09:00:00+09:00',
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ success: true, message: 'ok', data: asset }, 201),
    );
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.uploadMedia(new File(['image'], 'example.webp', { type: 'image/webp' }))).resolves.toEqual(asset);
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get('kind')).toBe('image');
    expect(new Headers(init?.headers).has('Content-Type')).toBe(false);
  });

  it('lists and uploads downloadable assets through the typed media contract', async () => {
    const asset = {
      id: '123e4567-e89b-42d3-a456-426614174002', url: '/storage/g7-page-builder/guide.pdf',
      original_name: 'guide.pdf', mime_type: 'application/pdf', bytes: 2048, width: 0, height: 0,
      kind: 'download' as const, created_at: '2026-08-22T09:00:00+09:00',
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { items: [asset] } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, data: asset }, 201));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.listMedia('download')).resolves.toEqual({ items: [asset] });
    await expect(client.uploadMedia(new File(['pdf'], 'guide.pdf', { type: 'application/pdf' }), 'download')).resolves.toEqual(asset);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${PAGE_BUILDER_API_PREFIX}/media?kind=download`);
    expect((fetchImpl.mock.calls[1]?.[1]?.body as FormData).get('kind')).toBe('download');
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
      shell_mode: 'global',
      seo: {
        title: '검색 제목',
        description: '검색 설명',
        og_image_url: '/storage/share.webp',
        robots: 'noindex',
      },
      expected_lock_version: 7,
    });

    expect(fetchImpl.mock.calls[0][1]?.method).toBe('PATCH');
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      title: '수정 제목',
      slug: 'updated-page',
      locale: 'ko',
      shell_mode: 'global',
      seo: {
        title: '검색 제목',
        description: '검색 설명',
        og_image_url: '/storage/share.webp',
        robots: 'noindex',
      },
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

  it('loads and saves the module-owned global site header and footer with CAS locking', async () => {
    const shell = {
      locale: 'ko',
      lock_version: 2,
      brand_name: '지원소프트',
      logo_url: '',
      home_url: '/',
      header_variant: 'solid' as const,
      sticky: true,
      navigation: [{ label: '소개', url: '/pages/about' }],
      cta: { label: '문의하기', url: '/pages/contact' },
      footer_text: '지원소프트',
      show_footer_navigation: true,
      updated_at: null,
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: shell }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { ...shell, lock_version: 3 } }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.getSiteShell('ko')).resolves.toEqual(shell);
    await expect(client.saveSiteShell(shell, 2)).resolves.toMatchObject({ lock_version: 3 });

    expect(fetchImpl.mock.calls[0][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/site-shell?locale=ko`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/site-shell`);
    expect(fetchImpl.mock.calls[1][1]?.method).toBe('PUT');
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toMatchObject({
      brand_name: '지원소프트',
      expected_lock_version: 2,
    });
  });

  it('loads, bootstraps, saves, and publishes an independent Header Site Part', async () => {
    const sitePart = {
      title: '기본 Header',
      document: {
        schema_version: 'g7-page-builder/site-part/v1' as const,
        site_part_id: '123e4567-e89b-42d3-a456-426614174055',
        kind: 'header' as const,
        locale: 'ko',
        tokens: {},
        blocks: [],
      },
      lock_version: 2,
      revision: 2,
      active_revision: null,
      status: 'draft' as const,
      created_at: null,
      updated_at: null,
      published_at: null,
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: sitePart }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: sitePart }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { ...sitePart, lock_version: 3, revision: 3 } }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { ...sitePart, lock_version: 4, active_revision: 3, status: 'published' } }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.getSitePart('header', 'ko');
    await client.bootstrapSitePart('header', 'ko');
    await client.saveSitePart('header', sitePart.title, sitePart.document, 2);
    await client.publishSitePart('header', 'ko', 3);

    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([
      `${PAGE_BUILDER_API_PREFIX}/site-parts/header?locale=ko`,
      `${PAGE_BUILDER_API_PREFIX}/site-parts/header/bootstrap`,
      `${PAGE_BUILDER_API_PREFIX}/site-parts/header/draft`,
      `${PAGE_BUILDER_API_PREFIX}/site-parts/header/publish`,
    ]);
    expect(JSON.parse(String(fetchImpl.mock.calls[2][1]?.body))).toMatchObject({ expected_lock_version: 2 });
    expect(JSON.parse(String(fetchImpl.mock.calls[3][1]?.body))).toEqual({ locale: 'ko', expected_lock_version: 3 });
  });

  it('loads the block catalog and stores actor-scoped favorites', async () => {
    const catalog = { items: [], categories: ['hero'] };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: catalog }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'ok',
        data: { catalog_id: 'block:content.hero-centered-01@1', favorite: true },
      }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.listBlockCatalog({ query: '히어로', category: 'hero', favorites: true }))
      .resolves.toEqual(catalog);
    await client.setBlockFavorite('block:content.hero-centered-01@1', true);

    expect(fetchImpl.mock.calls[0][0]).toBe(
      `${PAGE_BUILDER_API_PREFIX}/blocks/catalog?query=${encodeURIComponent('히어로')}&category=hero&favorites=true`,
    );
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
      catalog_id: 'block:content.hero-centered-01@1',
      favorite: true,
    });
  });

  it('installs and changes a Block Pack through module-owned lifecycle endpoints', async () => {
    const pack = {
      pack_id: 'jiwonpapa/marketing-presets',
      pack_version: '1.0.0',
      kind: 'data',
      publisher: { id: 'jiwonpapa', name: '지원소프트' },
      state: 'enabled',
      source: 'local',
      source_uri: null,
      archive_sha256: 'a'.repeat(64),
      blocks: 0,
      presets: 1,
      runtime_active: true,
      editor_asset_url: null,
      style_asset_urls: [],
      usage: { documents: 0, revisions: 0 },
      installed_at: null,
      updated_at: null,
    } as const;
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: pack }, 201))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { ...pack, state: 'disabled' } }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: 'ok',
        data: { pack_id: pack.pack_id, pack_version: pack.pack_version },
      }));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await client.installBlockPack(new File(['zip'], 'pack.zip', { type: 'application/zip' }));
    await client.setBlockPackState(pack.pack_id, pack.pack_version, 'disabled');
    await client.removeBlockPack(pack.pack_id, pack.pack_version);

    expect(fetchImpl.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
      pack_id: pack.pack_id,
      pack_version: pack.pack_version,
      state: 'disabled',
    });
    expect(fetchImpl.mock.calls[2][1]?.method).toBe('DELETE');
  });

  it('separates GitHub update checking from the explicit install request', async () => {
    const check = {
      release: {
        repository: 'jiwonpapa/g7-blocks',
        tag: 'v1.2.0',
        version: '1.2.0',
        asset_name: 'g7pb-block-pack.zip',
        asset_bytes: 1024,
        sha256: 'b'.repeat(64),
        release_url: 'https://github.com/jiwonpapa/g7-blocks/releases/tag/v1.2.0',
        published_at: '2026-08-20T00:00:00Z',
      },
      installed_version: '1.0.0',
      update_available: true,
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: check }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: { pack_id: 'x/y' } }, 201));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.checkGitHubBlockPack('jiwonpapa', 'g7-blocks')).resolves.toEqual(check);
    expect(fetchImpl).toHaveBeenCalledOnce();
    await client.installGitHubBlockPack('jiwonpapa', 'g7-blocks');

    expect(fetchImpl.mock.calls[0][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/block-packs/github/check`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/block-packs/github/install`);
  });

  it('browses the official free store and applies a Page Kit as a new draft', async () => {
    const catalog = {
      catalog_version: 'g7pb-store/v1' as const,
      publisher: { id: 'jiwonpapa' as const, name: '지원소프트' },
      generated_at: '2026-08-20T00:00:00+00:00',
      products: [],
    };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: catalog }))
      .mockResolvedValueOnce(jsonResponse({ success: true, message: 'ok', data: documentResource }, 201));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });

    await expect(client.getOfficialStoreCatalog()).resolves.toEqual(catalog);
    await expect(client.applyOfficialStorePageKit({
      product_id: 'jiwonpapa/company-launch',
      product_version: '1.0.0',
      title: '회사 소개',
      slug: 'company-launch',
    })).resolves.toEqual(documentResource);

    expect(fetchImpl.mock.calls[0][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/store/catalog`);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${PAGE_BUILDER_API_PREFIX}/store/page-kits/apply`);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
      product_id: 'jiwonpapa/company-launch',
      product_version: '1.0.0',
      title: '회사 소개',
      slug: 'company-launch',
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
