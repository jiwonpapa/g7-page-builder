import { PageDocumentApiClient } from './pageBuilderApi';
import type { DocumentV3 } from '../documents/v3/types';
import { record } from '../documents/v3/schema';
import { freshId } from '../documents/v3/clipboard';
import { validateDocumentV3 } from '../documents/v3/validate';

export interface ElementCompositionResource { id: string; title: string; source: DocumentV3 | null; error?: string }
function parseComposition(value: unknown): ElementCompositionResource {
  if (!record(value) || typeof value.pattern_id !== 'string' || typeof value.title !== 'string'
    || value.source_document_schema !== 'g7-page-builder/v3') throw new Error('사용자 구성 응답이 올바르지 않습니다.');
  const id = value.pattern_id;
  freshId(new Set(), () => id);
  if (value.compatible === false) return { id: value.pattern_id, title: value.title, source: null,
    error: typeof value.compatibility_error === 'string' ? value.compatibility_error : '지원되지 않는 구성입니다.' };
  if (!record(value.section) || typeof value.section.document_json !== 'string') throw new Error('사용자 구성 원본이 없습니다.');
  const source = validateDocumentV3(JSON.parse(value.section.document_json));
  if (!source.blocks.length || source.shell_mode !== 'none' || source.seo) throw new Error('선택 구성 원본이 올바르지 않습니다.');
  return { id: value.pattern_id, title: value.title, source };
}

export class ElementCompositionApi extends PageDocumentApiClient {
  async list(): Promise<ElementCompositionResource[]> {
    const value = await this.request<unknown>('/section-patterns?source_document_schema=' + encodeURIComponent('g7-page-builder/v3'));
    if (!record(value) || !Array.isArray(value.items)) throw new Error('사용자 구성 목록이 올바르지 않습니다.');
    const entries = value.items.map(parseComposition);
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('사용자 구성 ID가 중복됩니다.');
    return entries;
  }
  async create(title: string, source: DocumentV3): Promise<ElementCompositionResource> {
    const document = validateDocumentV3(source);
    return parseComposition(await this.request<unknown>('/section-patterns', { method: 'POST', body: JSON.stringify({
      title, source_document_schema: 'g7-page-builder/v3', document_json: JSON.stringify(document),
    }) }));
  }
  async remove(id: string): Promise<void> {
    freshId(new Set(), () => id);
    const value = await this.request<unknown>('/section-patterns/' + encodeURIComponent(id), { method: 'DELETE' });
    if (!record(value) || value.pattern_id !== id) throw new Error('사용자 구성 삭제 결과가 올바르지 않습니다.');
  }
}
