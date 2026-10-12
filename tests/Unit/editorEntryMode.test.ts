import { describe, expect, it, vi } from 'vitest';
import type { DocumentResource } from '../../resources/js/api/resources';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import { documentEditorMode, documentEditorUrl, loadLegacyEditorDocument, readLegacyEditorDocument } from '../../resources/js/editor/entryMode';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import fixture from '../Contract/document-v3.fixture.json';

function legacy(): DocumentResource<PageBuilderDocument> {
  return { document: { schema_version: 'g7-page-builder/v1', document_id: fixture.document_id,
    slug: 'entry-test', mode: 'canvas', locale: 'ko', blocks: [] }, title: '문서',
  lock_version: 1, revision: 1, public_url: null, active_artifact_sha256: null, is_home: false,
  status: 'draft', has_unpublished_changes: false, created_at: null, updated_at: null, published_at: null, archived_at: null };
}
function structure(): DocumentResource {
  return { ...legacy(), document: validateDocumentV3({ ...structuredClone(fixture), blocks: [] }) };
}
function ports(value: DocumentResource = legacy()) {
  return { read: vi.fn(async () => value), loadBlocks: vi.fn(async () => {}), redirect: vi.fn(), current: () => true };
}

describe('version-specific editor entry', () => {
  it.each(['g7-page-builder/v1', 'g7-page-builder/v2'] as const)('preserves the existing %s entry without converting its source', async schema_version => {
    const value = legacy();
    value.document.schema_version = schema_version;
    expect(documentEditorMode(value.document)).toBe('legacy');
    const host = ports(value);
    const before = JSON.stringify(value);
    expect(await loadLegacyEditorDocument(fixture.document_id, host)).toBe(value);
    expect(host.read).toHaveBeenCalledWith(fixture.document_id);
    expect(host.loadBlocks).toHaveBeenCalledOnce();
    expect(host.read.mock.invocationCallOrder[0]).toBeLessThan(host.loadBlocks.mock.invocationCallOrder[0]);
    expect(host.redirect).not.toHaveBeenCalled();
    expect(JSON.stringify(value)).toBe(before);
  });

  it('routes an empty v3 document without loading the legacy catalog or changing the source', async () => {
    const value = structure();
    const host = ports(value); const before = JSON.stringify(value);
    host.loadBlocks.mockRejectedValue(new Error('optional legacy catalog unavailable'));
    expect(documentEditorMode(value.document)).toBe('structure');
    expect(await loadLegacyEditorDocument(fixture.document_id, host)).toBeNull();
    expect(host.redirect).toHaveBeenCalledExactlyOnceWith(documentEditorUrl(fixture.document_id, 'structure'));
    expect(host.loadBlocks).not.toHaveBeenCalled();
    expect(JSON.stringify(value)).toBe(before);
    expect(() => readLegacyEditorDocument(value.document)).toThrow('정밀 편집기');
  });

  it.each([null, [], {}, { schema_version: 'g7-page-builder/v4' }, { schema_version: 3 }])('rejects unknown source versions: %j', value => {
    expect(() => documentEditorMode(value)).toThrow('지원하지 않는');
  });

  it('uses only the existing editor route and encodes the document identifier', () => {
    expect(documentEditorUrl('x&editor=elsewhere#fragment', 'legacy'))
      .toBe('/modules/jiwonpapa-page_builder/admin/editor?document=x%26editor%3Delsewhere%23fragment');
    expect(documentEditorUrl('x', 'structure')).toBe('/modules/jiwonpapa-page_builder/admin/editor?document=x&editor=structure');
  });

  it('does not load catalog assets or redirect after authentication/read failure', async () => {
    const host = ports(); host.read.mockRejectedValue(new Error('401 login required'));
    await expect(loadLegacyEditorDocument(fixture.document_id, host)).rejects.toThrow('401');
    expect(host.redirect).not.toHaveBeenCalled(); expect(host.loadBlocks).not.toHaveBeenCalled();
  });

  it('rejects the wrong document identity before redirect or asset loading', async () => {
    const host = ports(structure());
    await expect(loadLegacyEditorDocument('another-document', host)).rejects.toThrow('일치하지');
    expect(host.redirect).not.toHaveBeenCalled(); expect(host.loadBlocks).not.toHaveBeenCalled();
  });

  it('ignores a late source response belonging to an unmounted or replaced editor', async () => {
    const host = ports(structure()); host.current = () => false;
    expect(await loadLegacyEditorDocument(fixture.document_id, host)).toBeNull();
    expect(host.redirect).not.toHaveBeenCalled(); expect(host.loadBlocks).not.toHaveBeenCalled();
  });

  it('ignores a source after the editor is replaced during legacy asset loading', async () => {
    const host = ports();
    host.loadBlocks.mockImplementation(async () => { host.current = () => false; });
    expect(await loadLegacyEditorDocument(fixture.document_id, host)).toBeNull();
  });

  it('preserves existing malformed-layout rejection before loading external assets', async () => {
    const value = legacy(); value.document.schema_version = 'g7-page-builder/v2';
    value.document.blocks = [{ instance_id: 'bad', type: 'layout.section-01', block_version: 1, props: {} }];
    const host = ports(value);
    await expect(loadLegacyEditorDocument(fixture.document_id, host)).rejects.toThrow();
    expect(host.loadBlocks).not.toHaveBeenCalled(); expect(host.redirect).not.toHaveBeenCalled();
  });
});
