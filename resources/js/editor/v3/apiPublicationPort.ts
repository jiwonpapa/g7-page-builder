import type { PageDocumentApiClient } from '../../api/pageBuilderApi';
import type { PublicationPort } from '../../editor-application/v3/publication';

function invalid(): never { throw new Error('서버의 미리보기·발행 응답이 올바르지 않습니다.'); }
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return Object.fromEntries(Object.entries(value));
}
function digest(value: unknown): string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : invalid();
}
function timestamp(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : invalid();
}
function localUrl(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value || /[\s\\]/.test(value)) return invalid();
  const url = new URL(value, origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== new URL(origin).origin || url.username || url.password) return invalid();
  return url.href;
}
/** Reuses authenticated endpoints, validating untrusted responses before exposing links. */
export function createApiPublicationPort(client: Pick<PageDocumentApiClient, 'createPreview' | 'preparePublication' | 'commitPublication'>,
  origin: string): PublicationPort {
  return {
    async preview(documentId, revision) {
      const data = object(await client.createPreview(documentId, revision));
      return { url: localUrl(data.preview_url, origin), expiresAt: timestamp(data.expires_at) };
    },
    async prepare(documentId, revision) {
      const data = object(await client.preparePublication(documentId, revision));
      if (!Array.isArray(data.warnings) || !data.warnings.every(value => typeof value === 'string')) return invalid();
      return { token: digest(data.publication_token), hash: digest(data.artifact_sha256), warnings: [...data.warnings] };
    },
    async commit(token) {
      const data = object(await client.commitPublication(token));
      return { url: localUrl(data.public_url, origin), hash: digest(data.artifact_sha256), publishedAt: timestamp(data.published_at) };
    },
  };
}
