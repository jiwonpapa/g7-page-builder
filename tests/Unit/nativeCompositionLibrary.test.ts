import { afterEach, expect, it, vi } from 'vitest';
import { compositionLibrary } from '../../resources/js/adapters/gnuboard7/compositionLibrary';
import { NATIVE_COMPOSITION_SCHEMA, readSavedComposition } from '../../resources/js/native-editor/domain/composition';
const id = '00000000-0000-4000-8000-000000000004';
const row = { id, title: '소개', schema_version: NATIVE_COMPOSITION_SCHEMA, created_at: '2026-09-08T00:00:00Z' };
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
it('uses authenticated private API and preserves raw snapshot bytes', async () => {
  localStorage.setItem('auth_token', 'admin');
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: row })));
  vi.stubGlobal('fetch', fetch); const signal = new AbortController().signal;
  expect((await compositionLibrary().save('소개', '{"future":{}}', signal)).ok).toBe(true);
  expect(fetch).toHaveBeenCalledWith('/api/modules/jiwonpapa-page_builder/admin/native-compositions', expect.objectContaining({
    method: 'POST', signal, headers: expect.objectContaining({ Authorization: 'Bearer admin' }),
    body: JSON.stringify({ title: '소개', snapshot: '{"future":{}}', schema_version: NATIVE_COMPOSITION_SCHEMA }),
  }));
  expect(readSavedComposition({ ...row, snapshot: '{"future":{}}' })?.snapshot).toBe('{"future":{}}');
});
it.each([401, 403, 404, 500])('does not turn HTTP %i into success', async status => {
  localStorage.setItem('auth_token', 'admin');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"success":false}', { status })));
  expect((await compositionLibrary().read(id, new AbortController().signal)).ok).toBe(false);
});
it('refuses missing login, malformed rows, wrong identity and changed authentication', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch); const signal = new AbortController().signal; const library = compositionLibrary();
  expect((await library.page(1, signal)).ok).toBe(false); expect(fetch).not.toHaveBeenCalled();
  localStorage.setItem('auth_token', 'admin');
  fetch.mockResolvedValue(new Response('{"success":true,"data":{"items":[{}],"has_more":false}}'));
  expect((await library.page(1, signal)).ok).toBe(false);
  fetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { ...row, snapshot: '{}', id: '11111111-1111-4111-8111-111111111111' } })));
  expect((await library.read(id, signal)).ok).toBe(false);
  fetch.mockImplementation(async () => { localStorage.setItem('auth_token', 'other'); return new Response(JSON.stringify({ success: true, data: row })); });
  expect((await library.save('소개', '{}', signal)).ok).toBe(false);
});
it('retains unknown versions and validates delete acknowledgement', async () => {
  localStorage.setItem('auth_token', 'admin'); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  fetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { items: [{ ...row, schema_version: 'future/v2' }], has_more: true } })));
  expect(await compositionLibrary().page(2, new AbortController().signal)).toMatchObject({ ok: true, data: { hasMore: true, items: [{ schemaVersion: 'future/v2' }] } });
  fetch.mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id } })));
  expect(await compositionLibrary().delete(id, new AbortController().signal)).toEqual({ ok: true, data: null });
});
