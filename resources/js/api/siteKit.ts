export interface SiteKitPage { key: string; title: string; path: string; }
export interface SiteKitSummary {
  id: string; version: string; title: string; description: string; locale: string;
  pages: SiteKitPage[]; compatible: boolean; compatibility_error: string | null;
}
export interface SiteKitPreview { can_install: boolean; issues: Record<string, string>; pages: SiteKitPage[]; media_count: number; kit_version: string; }
export interface SiteKitInstallInput { kit_id: string; kit_version: string; title: string; paths: Record<string, string>; request_id: string; }
export interface SiteKitReceipt {
  request_id: string; kit_id: string; kit_version: string; title: string; locale: string;
  pages: Array<SiteKitPage & { document_id: string; slug: string }>; set_id: string; status: 'draft';
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pathPattern = /^\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,7}$/;
function invalid(): never { throw new Error('사이트 킷 응답 형식을 확인할 수 없습니다.'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return Object.fromEntries(Object.entries(value));
}
function string(value: unknown, pattern?: RegExp): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000 || (pattern && !pattern.test(value))) return invalid();
  return value;
}
function bool(value: unknown): boolean { return typeof value === 'boolean' ? value : invalid(); }
function pages(value: unknown): SiteKitPage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return invalid();
  const result = value.map(item => { const row = object(item); return {
    key: string(row.key, /^[a-z][a-z0-9-]{0,39}$/), title: string(row.title), path: string(row.path, pathPattern),
  }; });
  if (new Set(result.map(item => item.key)).size !== result.length) return invalid();
  return result;
}
export function parseSiteKitCatalog(value: unknown): { items: SiteKitSummary[] } {
  const row = object(value); if (!Array.isArray(row.items)) return invalid();
  return { items: row.items.map(item => { const kit = object(item); return {
    id: string(kit.id, /^[a-z0-9-]+$/), version: string(kit.version), title: string(kit.title), description: string(kit.description),
    locale: string(kit.locale), pages: pages(kit.pages), compatible: bool(kit.compatible),
    compatibility_error: kit.compatibility_error === null ? null : string(kit.compatibility_error),
  }; }) };
}
export function parseSiteKitPreview(value: unknown): SiteKitPreview {
  const row = object(value);
  const issues = Array.isArray(row.issues) && row.issues.length === 0 ? {} : object(row.issues);
  if (typeof row.media_count !== 'number' || !Number.isSafeInteger(row.media_count) || row.media_count < 0) return invalid();
  return { can_install: bool(row.can_install), issues: Object.fromEntries(Object.entries(issues).map(([key, value]) => [key, string(value)])),
    pages: pages(row.pages), media_count: row.media_count, kit_version: string(row.kit_version) };
}
export function parseSiteKitReceipt(value: unknown): SiteKitReceipt {
  const row = object(value); const summaries = pages(row.pages);
  if (!Array.isArray(row.pages) || row.status !== 'draft') return invalid();
  const entries = row.pages;
  return { request_id: string(row.request_id, uuid), kit_id: string(row.kit_id), kit_version: string(row.kit_version),
    title: string(row.title), locale: string(row.locale), set_id: string(row.set_id, uuid), status: 'draft',
    pages: summaries.map((page, index) => { const entry = object(entries[index]); return { ...page,
      document_id: string(entry.document_id, uuid), slug: string(entry.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    }; }) };
}
export function parseSiteKitInstallInput(value: unknown): SiteKitInstallInput {
  const row = object(value); const paths = object(row.paths);
  return { kit_id: string(row.kit_id, /^[a-z0-9-]+$/), kit_version: string(row.kit_version), title: string(row.title),
    request_id: string(row.request_id, uuid), paths: Object.fromEntries(Object.entries(paths).map(([key, value]) => [key, string(value, pathPattern)])) };
}
