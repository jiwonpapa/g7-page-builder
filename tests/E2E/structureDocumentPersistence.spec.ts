import { expect, test, type APIResponse } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

const DOCUMENTS = '/api/modules/jiwonpapa-page_builder/admin/documents';
const fixture = JSON.parse(readFileSync(new URL('../Contract/document-v3.fixture.json', import.meta.url), 'utf8')) as DocumentV3;

async function resource(response: APIResponse) {
  expect(response.ok(), await response.text()).toBe(true);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('data' in payload)
    || !payload.data || typeof payload.data !== 'object') throw new Error('Missing document resource');
  const data = payload.data;
  if (!('document' in data) || !('lock_version' in data) || typeof data.lock_version !== 'number'
    || !('revision' in data) || typeof data.revision !== 'number') throw new Error('Invalid document resource');
  const document = data.document;
  if (!document || typeof document !== 'object' || !('schema_version' in document)
    || document.schema_version !== 'g7-page-builder/v3') throw new Error('Unexpected document generation');
  // These API tests compare the complete returned source with the known fixture.
  // The shared PHP/TS schema suites separately own full contract validation.
  return { document: document as DocumentV3, lock: data.lock_version, revision: data.revision };
}

// This verifies the installed authenticated API and persistent repository, not
// the isolated editor's in-memory DraftPort. Product editor UI is a separate gate.
test('persists an empty v3 page and unregistered element tree through real API revisions', async ({ context }, testInfo) => {
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await editorInteractionApi(token);
  const slug = `g7pb-structure-${testInfo.project.name}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let ownedId: string | undefined;
  try {
    const empty = await resource(await api.post(DOCUMENTS, { data: {
      title: '공통 요소 저장 검증', slug, locale: 'ko', shell_mode: 'none', schema_version: 'g7-page-builder/v3',
    } }));
    ownedId = empty.document.document_id;
    await testInfo.attach('owned-document', { body: JSON.stringify({ documentId: ownedId, slug }), contentType: 'application/json' });
    expect(empty.document.blocks).toEqual([]);
    expect(empty.document.assets).toEqual([]);
    expect(empty.lock).toBe(1);
    const path = `${DOCUMENTS}/${ownedId}`;
    const source: DocumentV3 = { ...fixture, document_id: ownedId, slug, shell_mode: 'none',
      blocks: fixture.blocks.map(node => ({ ...node, name: '서버 등록 없는 사용자 구성' })),
    };
    const saved = await resource(await api.put(`${path}/draft`, { data: { document: source, expected_lock_version: empty.lock } }));
    expect(saved.document).toEqual(source);
    expect(saved.lock).toBe(2);
    expect(saved.revision).toBe(2);

    // A fresh HTTP client cannot read a local editor cache or a mock response.
    const reopenedApi = await editorInteractionApi(token);
    try {
      expect((await resource(await reopenedApi.get(path))).document).toEqual(source);
    } finally { await reopenedApi.dispose(); }

    const seo = { title: '검색 제목 보존', description: '원본 요소와 함께 보존', og_image_url: '/storage/cover.webp', robots: 'noindex' };
    const metadata = await resource(await api.patch(path, { data: {
      title: '설정 변경', slug, locale: 'en', shell_mode: 'builder', seo, expected_lock_version: saved.lock,
    } }));
    expect(metadata.document.blocks).toEqual(source.blocks);
    expect(metadata.document.assets).toEqual(source.assets);
    expect(metadata.document.seo).toEqual(seo);
    const { seo: omittedSeo, ...withoutSeo } = metadata.document;
    expect(omittedSeo).toEqual(seo);
    const kept = await resource(await api.put(`${path}/draft`, { data: { document: withoutSeo, expected_lock_version: metadata.lock } }));
    expect(kept.document.seo).toEqual(seo);
    expect(kept.revision).toBe(4);
    const rejected = [
      await api.put(`${path}/draft`, { data: { document: source, expected_lock_version: saved.lock } }),
      await api.put(`${path}/draft`, { data: { document: { ...source, document_id: crypto.randomUUID() }, expected_lock_version: kept.lock } }),
      await api.put(`${path}/draft`, { data: { document: { ...source, blocks: [{ ...source.blocks[0], slots: [] }] }, expected_lock_version: kept.lock } }),
    ];
    expect(rejected.map(response => response.status())).toEqual([409, 400, 400]);
    expect(await resource(await api.get(path))).toEqual(kept);

    const restored = await resource(await api.post(`${path}/revisions/2/restore`, { data: { expected_lock_version: kept.lock } }));
    expect(restored.revision).toBe(5);
    expect(restored.document).toEqual(source);
    expect((await resource(await api.get(path))).document).toEqual(source);
    const revisions = await api.get(`${path}/revisions`);
    expect(revisions.ok(), await revisions.text()).toBe(true);
    await testInfo.attach('persistent-round-trip', {
      body: JSON.stringify({ empty, saved, metadata, kept, restored, revisions: await revisions.json() }, null, 2),
      contentType: 'application/json',
    });
  } finally {
    try {
      // Keep the exact owned document recoverable in the trash; never purge
      // user data or alter global Site Parts/theme state for a storage test.
      if (ownedId) {
        const current = await resource(await api.get(`${DOCUMENTS}/${ownedId}`));
        expect(current.document.document_id).toBe(ownedId);
        expect(current.document.slug).toBe(slug);
        const archived = await api.post(`${DOCUMENTS}/${ownedId}/archive`, { data: { expected_lock_version: current.lock } });
        expect(archived.ok(), await archived.text()).toBe(true);
        await testInfo.attach('owned-document-archived', { body: await archived.body(), contentType: 'application/json' });
      }
    } finally { await api.dispose(); }
  }
});
