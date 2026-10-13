import { PAGE_BUILDER_SITE_PART_EDITOR_PATH } from '../api/pageBuilderApi';

export function sitePartEditorUrl(setId: string, locale: string, structure: boolean): string {
  const query = new URLSearchParams({ set_id: setId, locale });
  if (structure) query.set('editor', 'structure');
  return PAGE_BUILDER_SITE_PART_EDITOR_PATH + '?' + query;
}
/** Version check before legacy codecs; this never converts or writes a source. */
export function elementSitePartUrl(value: unknown, setId: string | null, locale: string): string | null {
  if (value && typeof value === 'object' && 'schema_version' in value && value.schema_version === 'g7-page-builder/site-part/v2') {
    if (!setId) throw new Error('정밀 공통영역의 세트 정보가 없습니다.');
    return sitePartEditorUrl(setId, locale, true);
  }
  return null;
}
