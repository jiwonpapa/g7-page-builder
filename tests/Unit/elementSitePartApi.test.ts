import { describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { validateElementSitePart } from '../../resources/js/documents/v3/sitePart';
import { ElementSitePartApi } from '../../resources/js/api/elementSitePartApi';
import { elementPair, parseElementPart, parsePartSet, type ElementPartResource, type PartKind } from '../../resources/js/api/elementSitePartResource';
import { elementSitePartUrl, sitePartEditorUrl } from '../../resources/js/editor/sitePartEditorRouting';

function part(kind: PartKind): ElementPartResource {
  const document = validateElementSitePart({ schema_version: 'g7-page-builder/site-part/v2', kind,
    content: { ...structuredClone(fixture), document_id: kind === 'header' ? fixture.document_id : '22222222-2222-4222-8222-222222222222', slug: 'site-' + kind,
      shell_mode: 'none', blocks: [] } });
  return { set_id: 'set-a', title: kind, document, lock_version: 1, revision: 1, active_revision: null,
    status: 'draft', created_at: null, updated_at: null, published_at: null };
}
function pair() {
  const header = part('header'), footer = part('footer');
  const summary = (value: ElementPartResource) => ({ site_part_id: value.document.content.document_id, revision: value.revision,
    active_revision: value.active_revision, status: value.status, updated_at: null });
  return elementPair({ id: 'set-a', title: '정밀 공통영역', locale: fixture.locale, is_active: false, is_ready: false,
    header: summary(header), footer: summary(footer), created_at: null, updated_at: null }, header, footer);
}
const response = (data: unknown) => new Response(JSON.stringify({ success: true, data }));
function setup(data: unknown) {
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => response(data));
  return { fetchImpl, api: new ElementSitePartApi({ fetchImpl, readAuthToken: () => 'unit-token' }) };
}
describe('element Site Part response boundary', () => {
  it('validates both ownership envelopes and consistent set metadata', () => {
    const value = pair();
    expect(parsePartSet(value.set, fixture.locale, 'set-a')).toEqual(value.set);
    expect(parseElementPart(value.header, 'set-a', 'header', fixture.locale)).toEqual(value.header);
    expect(() => elementPair({ ...value.set, header: { ...value.set.header, revision: 2 } }, value.header, value.footer)).toThrow();
    expect(() => parsePartSet({ ...value.set, is_ready: true }, fixture.locale)).toThrow();
    expect(() => parsePartSet({ ...value.set, footer: value.set.header }, fixture.locale)).toThrow();
  });
  it.each([
    { set_id: 'foreign' }, { lock_version: -1 }, { revision: 0 }, { active_revision: 2 }, { status: 'archived' },
    { title: null }, { updated_at: 8 }, { document: { schema_version: 'g7-page-builder/site-part/v1' } },
  ])('rejects malformed metadata or legacy source %j', changes => {
    expect(() => parseElementPart({ ...part('header'), ...changes }, 'set-a', 'header', fixture.locale)).toThrow();
  });
  it('rejects moved identity, locale, role, slug, and a non-advancing CAS token', () => {
    const value = part('header');
    expect(() => parseElementPart(value, 'set-a', 'footer', fixture.locale)).toThrow();
    expect(() => parseElementPart(value, 'set-a', 'header', 'en')).toThrow();
    expect(() => parseElementPart(value, 'set-a', 'header', fixture.locale, value)).toThrow();
    for (const change of [{ slug: 'other' }, { document_id: '22222222-2222-4222-8222-222222222222' }]) {
      expect(() => parseElementPart({ ...value, lock_version: 2, document: { ...value.document,
        content: { ...value.document.content, ...change } } }, 'set-a', 'header', fixture.locale, value)).toThrow();
    }
  });
  it('routes v2 away from legacy codecs without normalizing or converting it', () => {
    const value = part('header'), before = structuredClone(value);
    expect(elementSitePartUrl(value.document, value.set_id, fixture.locale)).toBe(sitePartEditorUrl('set-a', fixture.locale, true));
    expect(elementSitePartUrl({ schema_version: 'g7-page-builder/site-part/v1' }, 'set-a', fixture.locale)).toBeNull();
    expect(() => elementSitePartUrl(value.document, null, fixture.locale)).toThrow();
    expect(value).toEqual(before);
  });
});
describe('authenticated element Site Part transport', () => {
  it('creates only explicit v2 and loads separate canonical Header/Footer sources', async () => {
    const value = pair(), { api, fetchImpl } = setup(value.set);
    expect(await api.create('정밀 공통영역', fixture.locale)).toEqual(value.set);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      title: '정밀 공통영역', locale: fixture.locale, schema_version: 'g7-page-builder/site-part/v2',
    });
    fetchImpl.mockResolvedValueOnce(response(value.header)).mockResolvedValueOnce(response(value.footer));
    expect(await api.load(value.set)).toEqual(value);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(String(url)).toContain('/admin/');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer unit-token');
    }
  });
  it('keeps legacy loads in their editor and rejects a mixed generation pair', async () => {
    const value = pair(), { api, fetchImpl } = setup({ document: { schema_version: 'g7-page-builder/site-part/v1' } });
    expect(await api.load(value.set)).toEqual({ legacy: true });
    fetchImpl.mockResolvedValueOnce(response(value.header));
    await expect(api.load(value.set)).rejects.toThrow();
    expect(fetchImpl.mock.calls.every(([, init]) => !init?.method || init.method === 'GET')).toBe(true);
  });
  it('validates the list instead of trusting generic request types', async () => {
    const value = pair(), { api, fetchImpl } = setup({ items: [value.set] });
    expect(await api.list(fixture.locale)).toEqual([value.set]);
    fetchImpl.mockResolvedValueOnce(response({ items: [value.set, value.set] }));
    await expect(api.list(fixture.locale)).rejects.toThrow('중복');
    fetchImpl.mockResolvedValueOnce(response({ items: null }));
    await expect(api.list(fixture.locale)).rejects.toThrow();
  });
  it('saves the envelope with explicit set and CAS identity, never vendor data', async () => {
    const value = part('header'), { api, fetchImpl } = setup({ ...value, lock_version: 4, revision: 3 });
    expect((await api.save(value, value.document.content, 3)).lock_version).toBe(4);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      set_id: value.set_id, locale: fixture.locale, title: value.title, document: value.document, expected_lock_version: 3,
    });
    await expect(api.save(value, { ...value.document.content, shell_mode: 'builder' }, 3)).rejects.toThrow();
    await expect(api.save(value, value.document.content, -1)).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('preserves conflict errors and does not silently retry or publish either part', async () => {
    const value = part('header'), { api, fetchImpl } = setup({});
    fetchImpl.mockResolvedValue(new Response(JSON.stringify({ success: false, message: '버전 충돌', code: 'G7PB_LOCK_CONFLICT' }), { status: 409 }));
    await expect(api.save(value, value.document.content, 1)).rejects.toMatchObject({ status: 409, code: 'G7PB_LOCK_CONFLICT' });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
  it('publishes the pair using both versions and verifies activation separately', async () => {
    const value = pair(), published = pair();
    for (const kind of ['header', 'footer'] as const) {
      published[kind] = { ...published[kind], lock_version: 2, active_revision: 1, status: 'published' };
      published.set[kind] = { ...published.set[kind], active_revision: 1, status: 'published' };
    }
    published.set.is_ready = true;
    const { api, fetchImpl } = setup(published);
    expect(await api.publish(value)).toEqual(published);
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      locale: fixture.locale, header_expected_lock_version: 1, footer_expected_lock_version: 1,
    });
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/site-part-sets/set-a/publish');
    // Re-publishing an already active revision is idempotent: unchanged owners
    // correctly retain their lock while the pair still validates atomically.
    fetchImpl.mockResolvedValueOnce(response(published));
    expect(await api.publish(published)).toEqual(published);
    fetchImpl.mockResolvedValueOnce(response({ ...published.set, is_active: true }));
    expect((await api.activate(published.set)).is_active).toBe(true);
    fetchImpl.mockResolvedValueOnce(response(published.set));
    await expect(api.activate(published.set)).rejects.toThrow();
  });
});
