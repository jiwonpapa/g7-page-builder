import { PageDocumentApiClient } from './pageBuilderApi';
import { withSitePartContent } from '../documents/v3/sitePart';
import { elementPair, parseElementPart, parsePartSet, partRecord,
  type ElementPartPair, type ElementPartResource, type PartKind } from './elementSitePartResource';
import type { SitePartSetResource } from './resources';
import type { DocumentV3 } from '../documents/v3/types';

/** Same authenticated endpoints, separate runtime validation; no legacy catalog dependency. */
export class ElementSitePartApi extends PageDocumentApiClient {
  async list(locale: string): Promise<SitePartSetResource[]> {
    const data = partRecord(await this.request<unknown>('/site-part-sets?' + new URLSearchParams({ locale })));
    if (!Array.isArray(data.items)) throw new Error('공통영역 목록이 올바르지 않습니다.');
    const sets = data.items.map(item => parsePartSet(item, locale));
    if (new Set(sets.map(set => set.id)).size !== sets.length) throw new Error('공통영역 목록의 ID가 중복됩니다.');
    return sets;
  }
  async create(title: string, locale: string): Promise<SitePartSetResource> {
    return parsePartSet(await this.request<unknown>('/site-part-sets', { method: 'POST',
      body: JSON.stringify({ title, locale, schema_version: 'g7-page-builder/site-part/v2' }) }), locale);
  }
  async load(set: SitePartSetResource): Promise<ElementPartPair | { legacy: true }> {
    const read = (kind: PartKind) => this.request<unknown>('/site-parts/' + kind + '?' + new URLSearchParams({ locale: set.locale, set_id: set.id }));
    const [header, footer] = await Promise.all([read('header'), read('footer')]);
    const sources = [header, footer].map(value => partRecord(partRecord(value).document));
    if (sources.every(source => source.schema_version === 'g7-page-builder/site-part/v1')) return { legacy: true };
    return elementPair(set, parseElementPart(header, set.id, 'header', set.locale), parseElementPart(footer, set.id, 'footer', set.locale));
  }
  async save(source: ElementPartResource, content: DocumentV3, lock: number): Promise<ElementPartResource> {
    if (!Number.isSafeInteger(lock) || lock < source.lock_version) throw new Error('저장 기준 버전이 올바르지 않습니다.');
    const document = withSitePartContent(source.document, content);
    const response = await this.request<unknown>('/site-parts/' + document.kind + '/draft', { method: 'PUT', body: JSON.stringify({
      set_id: source.set_id, locale: document.content.locale, title: source.title, document, expected_lock_version: lock,
    }) });
    return parseElementPart(response, source.set_id, document.kind, document.content.locale, { ...source, lock_version: lock });
  }
  async publish(pair: ElementPartPair): Promise<ElementPartPair> {
    const { set } = elementPair(pair.set, pair.header, pair.footer);
    const data = partRecord(await this.request<unknown>('/site-part-sets/' + encodeURIComponent(set.id) + '/publish', {
      method: 'POST', body: JSON.stringify({ locale: set.locale,
        header_expected_lock_version: pair.header.lock_version, footer_expected_lock_version: pair.footer.lock_version }),
    }));
    const result = elementPair(parsePartSet(data.set, set.locale, set.id),
      parseElementPart(data.header, set.id, 'header', set.locale, pair.header, false),
      parseElementPart(data.footer, set.id, 'footer', set.locale, pair.footer, false));
    if (!result.set.is_ready || result.header.status !== 'published' || result.footer.status !== 'published') {
      throw new Error('Header와 Footer의 발행 결과를 확인하지 못했습니다.');
    }
    for (const kind of ['header', 'footer'] as const) {
      if (result[kind].active_revision !== pair[kind].revision || result[kind].revision !== pair[kind].revision
        || JSON.stringify(result[kind].document) !== JSON.stringify(pair[kind].document)) {
        throw new Error('발행 요청과 다른 공통영역 문서가 반환되었습니다.');
      }
    }
    return result;
  }
  async activate(set: SitePartSetResource): Promise<SitePartSetResource> {
    const result = parsePartSet(await this.request<unknown>('/site-part-sets/' + encodeURIComponent(set.id) + '/activate', {
      method: 'POST', body: JSON.stringify({ locale: set.locale }),
    }), set.locale, set.id);
    if (!result.is_active || !result.is_ready) throw new Error('공통영역의 활성화를 확인하지 못했습니다.');
    return result;
  }
}
