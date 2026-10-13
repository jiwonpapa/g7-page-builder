import { validateElementSitePart, type ElementSitePart } from '../documents/v3/sitePart';
import type { SitePartResource, SitePartSetResource, SitePartSetPartSummary } from './resources';

export type ElementPartResource = Omit<SitePartResource, 'document' | 'set_id'> & { document: ElementSitePart; set_id: string };
export interface ElementPartPair { set: SitePartSetResource; header: ElementPartResource; footer: ElementPartResource }
export type PartKind = ElementSitePart['kind'];

function invalid(): never { throw new Error('서버의 공통영역 응답이 올바르지 않습니다.'); }
export function partRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown): string { return typeof value === 'string' && value.length > 0 ? value : invalid(); }
function nullableText(value: unknown): string | null { return value === null || typeof value === 'string' ? value : invalid(); }
function count(value: unknown, min = 1): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : invalid();
}
function status(value: unknown): SitePartResource['status'] {
  return value === 'draft' || value === 'published' || value === 'published_with_changes' ? value : invalid();
}
function summary(value: unknown): SitePartSetPartSummary {
  const data = partRecord(value), revision = count(data.revision);
  const active = data.active_revision === null ? null : count(data.active_revision);
  if (active !== null && active > revision) return invalid();
  return { site_part_id: text(data.site_part_id), revision, active_revision: active,
    status: status(data.status), updated_at: nullableText(data.updated_at) };
}
export function parsePartSet(value: unknown, locale: string, id?: string): SitePartSetResource {
  const data = partRecord(value);
  if (data.locale !== locale || (id !== undefined && data.id !== id)
    || typeof data.is_active !== 'boolean' || typeof data.is_ready !== 'boolean') return invalid();
  const header = summary(data.header), footer = summary(data.footer);
  if (header.site_part_id === footer.site_part_id
    || data.is_ready !== (header.active_revision !== null && footer.active_revision !== null)) return invalid();
  return { id: text(data.id), title: text(data.title), locale, is_active: data.is_active, is_ready: data.is_ready,
    header, footer, created_at: nullableText(data.created_at), updated_at: nullableText(data.updated_at) };
}
export function parseElementPart(value: unknown, setId: string, kind: PartKind, locale: string,
  previous?: ElementPartResource, advanceLock = true): ElementPartResource {
  const data = partRecord(value), document = validateElementSitePart(data.document);
  if (data.set_id !== setId || document.kind !== kind || document.content.locale !== locale) return invalid();
  const lock = count(data.lock_version, 0), revision = count(data.revision);
  const active = data.active_revision === null ? null : count(data.active_revision);
  if (active !== null && active > revision) return invalid();
  if (previous && (document.content.document_id !== previous.document.content.document_id
    || document.content.slug !== previous.document.content.slug || lock < previous.lock_version
    || (advanceLock && lock === previous.lock_version)
    || revision < previous.revision)) return invalid();
  return { set_id: setId, document, lock_version: lock, revision, active_revision: active, status: status(data.status),
    title: text(data.title), created_at: nullableText(data.created_at), updated_at: nullableText(data.updated_at),
    published_at: nullableText(data.published_at) };
}
export function elementPair(set: SitePartSetResource, header: ElementPartResource, footer: ElementPartResource): ElementPartPair {
  for (const [kind, part] of [['header', header], ['footer', footer]] as const) {
    if (part.set_id !== set.id || part.document.kind !== kind || part.document.content.locale !== set.locale
      || part.document.content.document_id !== set[kind].site_part_id
      || part.revision !== set[kind].revision || part.active_revision !== set[kind].active_revision
      || part.status !== set[kind].status) return invalid();
  }
  return { set, header, footer };
}
