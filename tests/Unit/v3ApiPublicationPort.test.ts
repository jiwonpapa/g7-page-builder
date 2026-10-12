import { expect, it, vi } from 'vitest';
import { PageDocumentApiClient } from '../../resources/js/api/pageBuilderApi';
import { createApiPublicationPort } from '../../resources/js/editor/v3/apiPublicationPort';

const origin = 'https://builder.test';
const hash = 'a'.repeat(64), token = 'b'.repeat(64), date = '2026-10-13T12:00:00+09:00';
function setup(data: unknown, status = 200) {
  const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: status === 200, data }), { status }));
  const client = new PageDocumentApiClient({ fetchImpl, readAuthToken: () => 'admin-token', onUnauthorized: vi.fn() });
  return { fetchImpl, port: createApiPublicationPort(client, origin) };
}
it('uses the existing authenticated preview, prepare and commit endpoints with server CAS revisions', async () => {
  const { port, fetchImpl } = setup({ preview_url: '/modules/jiwonpapa-page_builder/preview/token?shell=template', expires_at: date });
  expect(await port.preview('document', 23)).toEqual({ url: origin + '/modules/jiwonpapa-page_builder/preview/token?shell=template', expiresAt: date });
  expect(fetchImpl.mock.calls[0][0]).toContain('/documents/document/preview');
  expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ expected_lock_version: 23 });
  expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer admin-token');
  fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { publication_token: token, artifact_sha256: hash, warnings: ['검토'] } })));
  expect(await port.prepare('document', 24)).toEqual({ token, hash, warnings: ['검토'] });
  expect(fetchImpl.mock.calls[1][0]).toContain('/documents/document/publications/prepare');
  expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({ expected_lock_version: 24 });
  fetchImpl.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { public_url: origin + '/pages/test', artifact_sha256: hash, published_at: date } })));
  expect(await port.commit(token)).toEqual({ url: origin + '/pages/test', hash, publishedAt: date });
  expect(fetchImpl.mock.calls[2][0]).toContain('/publications/' + token + '/commit');
  expect(JSON.parse(String(fetchImpl.mock.calls[2][1]?.body))).toEqual({});
});
it.each(['javascript:alert(1)', '//outside.test/x', 'https://outside.test/x', 'https://user:pass@builder.test/x', '/\\outside.test/x', '/bad path', '', null])('rejects unsafe public/preview links: %s', async url => {
  await expect(setup({ preview_url: url, expires_at: date }).port.preview('doc', 1)).rejects.toThrow();
  await expect(setup({ public_url: url, artifact_sha256: hash, published_at: date }).port.commit(token)).rejects.toThrow();
});
it.each([null, [], {}, { publication_token: token, artifact_sha256: 'bad', warnings: [] },
  { publication_token: 'bad', artifact_sha256: hash, warnings: [] }, { publication_token: token, artifact_sha256: hash, warnings: [7] },
  { publication_token: token, artifact_sha256: hash, warnings: 'warning' }])('rejects malformed candidate data %j', async data => {
  await expect(setup(data).port.prepare('doc', 1)).rejects.toThrow();
});
it.each([null, 'not a date', '2026-99-99T00:00:00Z'])('rejects missing or invalid server timestamps: %s', async date => {
  await expect(setup({ preview_url: '/preview', expires_at: date }).port.preview('doc', 1)).rejects.toThrow();
  await expect(setup({ public_url: '/pages/test', artifact_sha256: hash, published_at: date }).port.commit(token)).rejects.toThrow();
});
it.each([401, 403, 409, 422, 500])('propagates a server %i without retrying publication', async status => {
  const { port, fetchImpl } = setup({}, status);
  await expect(port.commit(token)).rejects.toThrow(); expect(fetchImpl).toHaveBeenCalledOnce();
});
