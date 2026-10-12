import { describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { PageBuilderApiClient, PageBuilderApiError, PAGE_BUILDER_API_PREFIX } from '../../resources/js/api/pageBuilderApi';
import { createV3DocumentApi, parseV3DocumentResource } from '../../resources/js/api/v3DocumentResource';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';

const documentId = fixture.document_id;
function source() { return validateDocumentV3(structuredClone(fixture)); }
function resource() {
  return { document: source(), title: '정밀 편집', lock_version: 7, revision: 4,
    public_url: null, active_artifact_sha256: null, is_home: false, status: 'draft',
    has_unpublished_changes: true, created_at: null, updated_at: null, published_at: null, archived_at: null };
}
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(status === 200 ? { success: true, data } : data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

describe('v3 document API adapter', () => {
  it('loads canonical v3 through the existing authenticated transport without coercing empty maps', async () => {
    const data = resource();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(data));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'test-token' });
    expect(await createV3DocumentApi(client).getStructureDocument(documentId)).toEqual(data);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${PAGE_BUILDER_API_PREFIX}/documents/${documentId}`);
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer test-token');
    expect(data.document.blocks[0].slots.content?.[0]?.slots).toEqual({});
  });

  it('saves the unchanged canonical payload and uses lock_version independently of revision', async () => {
    const document = source();
    const before = JSON.stringify(document);
    const data = { ...resource(), lock_version: 8, revision: 5 };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(data));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'test-token' });
    expect(await createV3DocumentApi(client).saveStructureDraft(documentId, document, 7)).toEqual(data);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${PAGE_BUILDER_API_PREFIX}/documents/${documentId}/draft`);
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(String(options?.body))).toEqual({ document, expected_lock_version: 7 });
    expect(JSON.stringify(document)).toBe(before);
  });

  it.each([
    { title: null }, { is_home: 0 }, { has_unpublished_changes: 'yes' }, { status: 'unknown' },
    { lock_version: -1 }, { lock_version: 1.5 }, { lock_version: Number.MAX_SAFE_INTEGER + 1 },
    { revision: 0 }, { public_url: 'javascript:alert(1)' }, { public_url: '//outside.test' }, { public_url: 'https://' },
    { active_artifact_sha256: 'bad' }, { created_at: {} }, { updated_at: [] },
    { published_at: false }, { archived_at: 0 },
  ])('rejects malformed endpoint metadata: %j', (patch) => {
    expect(() => parseV3DocumentResource({ ...resource(), ...patch }, documentId)).toThrow();
  });

  it.each([null, [], 'document', {}])('rejects a non-resource response: %j', (value) => {
    expect(() => parseV3DocumentResource(value, documentId)).toThrow();
  });

  it('accepts published metadata without substituting it for the canonical source', () => {
    const data = { ...resource(), status: 'published', public_url: '/pages/published', active_artifact_sha256: 'a'.repeat(64) };
    expect(parseV3DocumentResource(data, documentId)).toEqual(data);
    expect(parseV3DocumentResource({ ...data, public_url: 'https://example.test/pages/published' }, documentId).document).toEqual(data.document);
  });

  it('rejects a legacy document, wrong identity and malformed v3 slots on the real transport path', async () => {
    const malformed: unknown[] = [
      { ...source(), schema_version: 'g7-page-builder/v2' },
      { ...source(), document_id: '00000000-0000-4000-8000-000000000098' },
      { ...source(), blocks: [{ ...source().blocks[0], slots: [] }] },
    ];
    for (const document of malformed) {
      const client = new PageBuilderApiClient({ fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({ ...resource(), document })), readAuthToken: () => 'token' });
      await expect(createV3DocumentApi(client).getStructureDocument(documentId)).rejects.toThrow();
    }
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects an invalid save lock before HTTP: %s', async (lock) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });
    await expect(createV3DocumentApi(client).saveStructureDraft(documentId, source(), lock)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a wrong source identity before HTTP', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token' });
    await expect(createV3DocumentApi(client).saveStructureDraft('00000000-0000-4000-8000-000000000098', source(), 7)).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([{ lock_version: 7 }, { lock_version: 6 }, { lock_version: 8, status: 'archived' }])('rejects an invalid save acknowledgement: %j', async (patch) => {
    const client = new PageBuilderApiClient({ fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(response({ ...resource(), ...patch })), readAuthToken: () => 'token' });
    await expect(createV3DocumentApi(client).saveStructureDraft(documentId, source(), 7)).rejects.toThrow();
  });

  it.each([401, 403, 409, 422, 500])('preserves existing API errors without retrying a write: %s', async (status) => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response({ success: false, error: { code: 'G7PB_TEST_FAILURE', message: '저장 거부' } }, status));
    const client = new PageBuilderApiClient({ fetchImpl, readAuthToken: () => 'token', onUnauthorized });
    await expect(createV3DocumentApi(client).saveStructureDraft(documentId, source(), 7)).rejects.toBeInstanceOf(PageBuilderApiError);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(onUnauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });
});
