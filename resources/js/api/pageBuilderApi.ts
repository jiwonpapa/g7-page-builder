import type {
  ApiEnvelope,
  DocumentListResource,
  DocumentResource,
  MediaAssetResource,
  MediaListResource,
  SiteShellResource,
  PageBuilderDocument,
  PreviewResource,
  PublicationCommit,
  PublicationPreparation,
  RevisionListResource,
  RevisionResource,
} from '../documents/types';

export const PAGE_BUILDER_API_PREFIX = '/api/modules/jiwonpapa-page_builder/admin';
export const PAGE_BUILDER_MANAGER_PATH = '/admin/page-builder';
export const PAGE_BUILDER_EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
export const ADMIN_AUTH_TOKEN_KEY = 'auth_token';

interface ApiClientOptions {
  fetchImpl?: typeof fetch;
  readAuthToken?: () => string | null;
  onUnauthorized?: (loginUrl: string) => void;
  currentUrl?: () => string;
}

type JsonObject = Record<string, unknown>;

export class PageBuilderApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string | null;

  constructor(message: string, status = 0, code = 'G7PB_REQUEST_FAILED', correlationId: string | null = null) {
    super(message);
    this.name = 'PageBuilderApiError';
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: JsonObject, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return null;
}

function defaultCurrentUrl(): string {
  if (typeof window === 'undefined') {
    return PAGE_BUILDER_EDITOR_PATH;
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function buildAdminLoginUrl(currentUrl = defaultCurrentUrl()): string {
  return `/admin/login?redirect=${encodeURIComponent(currentUrl)}`;
}

function defaultReadAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
}

function defaultUnauthorizedRedirect(loginUrl: string): void {
  if (typeof window !== 'undefined') {
    window.location.assign(loginUrl);
  }
}

function parseErrorPayload(payload: unknown, status: number): PageBuilderApiError {
  if (!isObject(payload)) {
    return new PageBuilderApiError('요청을 처리하지 못했습니다.', status);
  }

  const nestedError = isObject(payload.error) ? payload.error : null;
  const nestedData = isObject(payload.data) ? payload.data : null;
  const message =
    readString(payload, 'message') ??
    (nestedError ? readString(nestedError, 'message') : null) ??
    '요청을 처리하지 못했습니다.';
  const code =
    readString(payload, 'code') ??
    (nestedError ? readString(nestedError, 'code') : null) ??
    (nestedData ? readString(nestedData, 'code') : null) ??
    'G7PB_REQUEST_FAILED';
  const correlationId =
    readString(payload, 'correlation_id', 'correlationId') ??
    (nestedError ? readString(nestedError, 'correlation_id', 'correlationId') : null) ??
    (nestedData ? readString(nestedData, 'correlation_id', 'correlationId') : null);

  return new PageBuilderApiError(message, status, code, correlationId);
}

function parseEnvelope<T>(payload: unknown): T {
  if (!isObject(payload)) {
    throw new PageBuilderApiError('서버 응답 형식이 올바르지 않습니다.', 0, 'G7PB_RESPONSE_INVALID');
  }

  // Canonical G7 BaseController envelope is authoritative.
  if (payload.success === true && Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data as T;
  }

  // Defensive compatibility for an older direct-data response. New writes never use it.
  if (!Object.prototype.hasOwnProperty.call(payload, 'success')) {
    return payload as T;
  }

  throw parseErrorPayload(payload, 0);
}

export class PageBuilderApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly readAuthToken: () => string | null;
  private readonly onUnauthorized: (loginUrl: string) => void;
  private readonly currentUrl: () => string;

  constructor(options: ApiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.readAuthToken = options.readAuthToken ?? defaultReadAuthToken;
    this.onUnauthorized = options.onUnauthorized ?? defaultUnauthorizedRedirect;
    this.currentUrl = options.currentUrl ?? defaultCurrentUrl;
  }

  async createDocument(input: {
    slug: string;
    title: string;
    locale: string;
    shell_mode?: 'global' | 'none';
  }): Promise<DocumentResource> {
    return this.request<DocumentResource>('/documents', {
      method: 'POST',
      body: JSON.stringify({ ...input, mode: 'canvas' }),
    });
  }

  async listDocuments(
    page = 1,
    perPage = 100,
    status: 'active' | 'archived' | 'all' = 'active',
  ): Promise<DocumentListResource> {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      status,
    });

    return this.request<DocumentListResource>(`/documents?${query.toString()}`);
  }

  async getDocument(documentId: string): Promise<DocumentResource> {
    return this.request<DocumentResource>(`/documents/${encodeURIComponent(documentId)}`);
  }

  async updateDocument(
    documentId: string,
    input: {
      title: string;
      slug: string;
      locale: string;
      shell_mode: 'global' | 'none';
      expected_lock_version: number;
    },
  ): Promise<DocumentResource> {
    return this.request<DocumentResource>(`/documents/${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }

  async listRevisions(documentId: string, limit = 20): Promise<RevisionListResource> {
    const query = new URLSearchParams({ limit: String(limit) });

    return this.request<RevisionListResource>(
      `/documents/${encodeURIComponent(documentId)}/revisions?${query.toString()}`,
    );
  }

  async getRevision(documentId: string, revision: number): Promise<RevisionResource> {
    return this.request<RevisionResource>(
      `/documents/${encodeURIComponent(documentId)}/revisions/${revision}`,
    );
  }

  async createRevisionPreview(documentId: string, revision: number): Promise<PreviewResource> {
    return this.request<PreviewResource>(
      `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/preview`,
      { method: 'POST', body: JSON.stringify({}) },
    );
  }

  async restoreRevision(
    documentId: string,
    revision: number,
    expectedLockVersion: number,
  ): Promise<DocumentResource> {
    return this.request<DocumentResource>(
      `/documents/${encodeURIComponent(documentId)}/revisions/${revision}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_lock_version: expectedLockVersion }),
      },
    );
  }

  async saveDraft(
    documentId: string,
    document: PageBuilderDocument,
    expectedLockVersion: number,
  ): Promise<DocumentResource> {
    return this.request<DocumentResource>(`/documents/${encodeURIComponent(documentId)}/draft`, {
      method: 'PUT',
      body: JSON.stringify({
        document,
        expected_lock_version: expectedLockVersion,
      }),
    });
  }

  async createPreview(documentId: string, expectedLockVersion: number): Promise<PreviewResource> {
    return this.request<PreviewResource>(`/documents/${encodeURIComponent(documentId)}/preview`, {
      method: 'POST',
      body: JSON.stringify({ expected_lock_version: expectedLockVersion }),
    });
  }

  async preparePublication(
    documentId: string,
    expectedLockVersion: number,
  ): Promise<PublicationPreparation> {
    return this.request<PublicationPreparation>(
      `/documents/${encodeURIComponent(documentId)}/publications/prepare`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_lock_version: expectedLockVersion }),
      },
    );
  }

  async commitPublication(publicationToken: string): Promise<PublicationCommit> {
    return this.request<PublicationCommit>(
      `/publications/${encodeURIComponent(publicationToken)}/commit`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );
  }

  async unpublishDocument(
    documentId: string,
    expectedLockVersion: number,
  ): Promise<DocumentResource> {
    return this.request<DocumentResource>(
      `/documents/${encodeURIComponent(documentId)}/publications/unpublish`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_lock_version: expectedLockVersion }),
      },
    );
  }

  async setHomeDocument(
    documentId: string,
    enabled: boolean,
    expectedLockVersion: number,
  ): Promise<DocumentResource> {
    return this.request<DocumentResource>(`/documents/${encodeURIComponent(documentId)}/home`, {
      method: 'POST',
      body: JSON.stringify({ enabled, expected_lock_version: expectedLockVersion }),
    });
  }

  async archiveDocument(documentId: string, expectedLockVersion: number): Promise<DocumentResource> {
    return this.request<DocumentResource>(`/documents/${encodeURIComponent(documentId)}/archive`, {
      method: 'POST',
      body: JSON.stringify({ expected_lock_version: expectedLockVersion }),
    });
  }

  async restoreArchivedDocument(documentId: string, expectedLockVersion: number): Promise<DocumentResource> {
    return this.request<DocumentResource>(`/documents/${encodeURIComponent(documentId)}/restore-archived`, {
      method: 'POST',
      body: JSON.stringify({ expected_lock_version: expectedLockVersion }),
    });
  }

  async purgeDocument(
    documentId: string,
    expectedLockVersion: number,
    confirmationSlug: string,
  ): Promise<{ document_id: string }> {
    return this.request<{ document_id: string }>(`/documents/${encodeURIComponent(documentId)}`, {
      method: 'DELETE',
      body: JSON.stringify({
        expected_lock_version: expectedLockVersion,
        confirmation_slug: confirmationSlug,
      }),
    });
  }

  async listMedia(): Promise<MediaListResource> {
    return this.request<MediaListResource>('/media');
  }

  async uploadMedia(file: File): Promise<MediaAssetResource> {
    const form = new FormData();
    form.append('file', file);

    return this.request<MediaAssetResource>('/media', {
      method: 'POST',
      body: form,
    });
  }

  async deleteMedia(mediaId: string): Promise<{ media_id: string }> {
    return this.request<{ media_id: string }>(`/media/${encodeURIComponent(mediaId)}`, {
      method: 'DELETE',
    });
  }

  async getSiteShell(locale = 'ko'): Promise<SiteShellResource> {
    const query = new URLSearchParams({ locale });
    return this.request<SiteShellResource>(`/site-shell?${query.toString()}`);
  }

  async saveSiteShell(shell: SiteShellResource, expectedLockVersion: number): Promise<SiteShellResource> {
    const { lock_version: _lockVersion, updated_at: _updatedAt, ...payload } = shell;
    return this.request<SiteShellResource>('/site-shell', {
      method: 'PUT',
      body: JSON.stringify({ ...payload, expected_lock_version: expectedLockVersion }),
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = this.readAuthToken();
    if (!token) {
      const loginUrl = buildAdminLoginUrl(this.currentUrl());
      this.onUnauthorized(loginUrl);
      throw new PageBuilderApiError(
        '관리자 로그인이 필요합니다. 로그인 화면으로 이동합니다.',
        401,
        'G7PB_AUTH_REQUIRED',
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      Authorization: `Bearer ${token}`,
    };
    if (!(init.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${PAGE_BUILDER_API_PREFIX}${path}`, {
        ...init,
        credentials: 'same-origin',
        headers: { ...headers, ...init.headers },
      });
    } catch (error) {
      throw new PageBuilderApiError(
        error instanceof Error ? error.message : '서버에 연결할 수 없습니다.',
        0,
        'G7PB_NETWORK_ERROR',
      );
    }

    const payload = await response.json().catch(() => null);
    if (response.status === 401) {
      const loginUrl = buildAdminLoginUrl(this.currentUrl());
      this.onUnauthorized(loginUrl);
      throw parseErrorPayload(payload, response.status);
    }

    if (!response.ok) {
      throw parseErrorPayload(payload, response.status);
    }

    return parseEnvelope<T>(payload);
  }
}

export type PageBuilderApiEnvelope<T> = ApiEnvelope<T>;
