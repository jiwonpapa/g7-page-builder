import { expect, request as playwrightRequest, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PageBuilderDocument } from '../../../resources/js/documents/types';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const OWNERSHIP_DIRECTORY = join(process.cwd(), 'output', 'playwright', 'ownership');
const SLUG_PATTERN = /^g7pb-interaction-(?:desktop|tablet|mobile)-\d{13}-[a-z0-9]{6}$/;
const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const EDITOR_INTERACTION_COPY = Object.freeze({
  rootPrefix: '루트 앞 문구',
  rootTarget: '루트 선택 부분',
  rootSuffix: '루트 뒤 문구',
  nestedPrefix: '중첩 앞 문구',
  nestedTarget: '중첩 선택 부분',
  nestedSuffix: '중첩 뒤 문구',
  blockInitial: '사이드바 양방향 편집을 확인하는 최초 본문입니다.',
  sidebarToCanvas: '사이드바 입력이 캔버스에 즉시 반영됩니다.',
  canvasToSidebar: '캔버스 입력이 사이드바에 즉시 반영됩니다.',
  articleTitle: '링크 도구가 없는 기사 제목',
});

interface DocumentResource {
  document: PageBuilderDocument;
  lock_version: number;
}

export interface OwnedEditorInteractionDocument {
  documentId: string;
  journalPath: string;
  slug: string;
}

interface OwnershipJournal {
  documentId: string;
  slug: string;
  version: 1;
}

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Editor interaction E2E administrator credentials are not configured.');
  return { email, password };
}

function assertOwnershipJournal(value: unknown): asserts value is OwnershipJournal {
  const journal = value as Partial<OwnershipJournal> | null;
  if (!journal || journal.version !== 1 || typeof journal.slug !== 'string'
    || !SLUG_PATTERN.test(journal.slug) || typeof journal.documentId !== 'string'
    || !DOCUMENT_ID_PATTERN.test(journal.documentId)) {
    throw new Error('Editor interaction ownership journal is invalid.');
  }
}

export async function authenticateEditorInteractionAdmin(context: BrowserContext): Promise<string> {
  const auth = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  try {
    const response = await auth.post('/api/auth/admin/login', { data: credentials() });
    expect(response.ok()).toBe(true);
    const payload = await response.json() as { success?: unknown; data?: { token?: unknown } };
    if (payload.success !== true || typeof payload.data?.token !== 'string') {
      throw new Error('Editor interaction administrator login returned no token.');
    }
    const token = payload.data.token;
    await context.addInitScript(({ origin, authToken }) => {
      if (window.location.origin === origin) window.localStorage.setItem('auth_token', authToken);
    }, { origin: new URL(BASE_URL).origin, authToken: token });
    return token;
  } finally {
    await auth.dispose();
  }
}

export async function editorInteractionApi(token: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
}

async function purgeOwnedDocument(api: APIRequestContext, journal: OwnershipJournal): Promise<void> {
  assertOwnershipJournal(journal);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentResponse = await api.get(
      `/api/modules/jiwonpapa-page_builder/admin/documents/${journal.documentId}`,
    );
    if (currentResponse.status() === 404) return;
    if (!currentResponse.ok()) {
      throw new Error(`Editor interaction cleanup read failed with HTTP ${currentResponse.status()}.`);
    }
    const current = await currentResponse.json() as {
      data?: { archived_at?: unknown; lock_version?: unknown; document?: { slug?: unknown } };
    };
    if (current.data?.document?.slug !== journal.slug || typeof current.data.lock_version !== 'number') {
      throw new Error('Refusing to clean up a document without exact editor interaction ownership proof.');
    }
    let lockVersion = current.data.lock_version;
    if (typeof current.data.archived_at !== 'string') {
      const archived = await api.post(
        `/api/modules/jiwonpapa-page_builder/admin/documents/${journal.documentId}/archive`,
        { data: { expected_lock_version: lockVersion } },
      );
      if (archived.status() === 409) continue;
      if (!archived.ok()) throw new Error(`Editor interaction cleanup archive failed with HTTP ${archived.status()}.`);
      const payload = await archived.json() as { data?: { lock_version?: unknown } };
      if (typeof payload.data?.lock_version !== 'number') throw new Error('Cleanup archive returned no lock version.');
      lockVersion = payload.data.lock_version;
    }
    const purged = await api.delete(
      `/api/modules/jiwonpapa-page_builder/admin/documents/${journal.documentId}`,
      { data: { confirmation_slug: journal.slug, expected_lock_version: lockVersion } },
    );
    if (purged.status() === 404) return;
    if (purged.status() === 409) continue;
    if (!purged.ok()) throw new Error(`Editor interaction cleanup purge failed with HTTP ${purged.status()}.`);
    return;
  }
  throw new Error('Editor interaction cleanup could not resolve concurrent document changes.');
}

export async function recoverOwnedEditorInteractionDocuments(api: APIRequestContext): Promise<void> {
  await mkdir(OWNERSHIP_DIRECTORY, { recursive: true });
  const entries = await readdir(OWNERSHIP_DIRECTORY, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.startsWith('editor-interaction-') || !entry.name.endsWith('.json')) continue;
    const journalPath = join(OWNERSHIP_DIRECTORY, entry.name);
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as unknown;
    assertOwnershipJournal(journal);
    await purgeOwnedDocument(api, journal);
    await unlink(journalPath);
  }
}

export async function createOwnedEditorInteractionDocument(
  api: APIRequestContext,
  projectName: string,
): Promise<OwnedEditorInteractionDocument> {
  const viewport = projectName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `g7pb-interaction-${viewport}-${runId}`;
  if (!SLUG_PATTERN.test(slug)) throw new Error(`Editor interaction slug is not owned: ${slug}`);
  const response = await api.post('/api/modules/jiwonpapa-page_builder/admin/documents', {
    data: {
      title: `Editor Interaction ${runId}`,
      slug,
      locale: 'ko',
      mode: 'canvas',
      shell_mode: 'none',
    },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: Partial<DocumentResource> };
  if (!payload.data?.document || typeof payload.data.lock_version !== 'number') {
    throw new Error('Editor interaction document creation returned an invalid resource.');
  }
  const document: PageBuilderDocument = {
    ...payload.data.document,
    shell_mode: 'none',
    blocks: [
      {
        instance_id: crypto.randomUUID(),
        type: 'content.heading-01',
        block_version: 1,
        props: {
          eyebrow: 'ROOT INLINE RICH',
          heading: `${EDITOR_INTERACTION_COPY.rootPrefix} <a href="/richtext-root">${EDITOR_INTERACTION_COPY.rootTarget}</a> ${EDITOR_INTERACTION_COPY.rootSuffix}`,
          level: 2,
          anchor: 'richtext-root',
        },
        slots: {},
      },
      {
        instance_id: crypto.randomUUID(),
        type: 'content.features-grid-01',
        block_version: 1,
        props: {
          title: '중첩 배열 리치텍스트 검증',
          items: [
            {
              icon: 'sparkles',
              title: `${EDITOR_INTERACTION_COPY.nestedPrefix} <a href="/richtext-nested">${EDITOR_INTERACTION_COPY.nestedTarget}</a> ${EDITOR_INTERACTION_COPY.nestedSuffix}`,
              body: '<p>첫 번째 중첩 block-rich 본문입니다.</p>',
            },
            {
              icon: 'shield',
              title: '두 번째 기능 제목',
              body: '<p>두 번째 기능 본문입니다.</p>',
            },
          ],
          layout: 'grid',
        },
        slots: {},
      },
      {
        instance_id: crypto.randomUUID(),
        type: 'content.rich-text-01',
        block_version: 1,
        props: {
          content: `<p>${EDITOR_INTERACTION_COPY.blockInitial}</p>`,
          measure: 'standard',
        },
        slots: {},
      },
      {
        instance_id: crypto.randomUUID(),
        type: 'content.article-list-01',
        block_version: 1,
        props: {
          eyebrow: 'NO LINK INLINE RICH',
          heading: '외부 링크 안 제목은 링크 mark를 만들지 않습니다',
          items: [
            {
              category: '안전성',
              title: EDITOR_INTERACTION_COPY.articleTitle,
              summary: '<p>외부 action 안에서는 제목 링크 도구를 제공하지 않습니다.</p>',
              date: '2026-08-26',
              imageSrc: '',
              imageAlt: '',
              url: '/articles/no-nested-link',
            },
            {
              category: '회귀',
              title: '두 번째 기사 제목',
              summary: '<p>배열 최소 개수와 공개 컴파일 계약을 함께 지킵니다.</p>',
              date: '2026-08-25',
              imageSrc: '',
              imageAlt: '',
              url: '/articles/second',
            },
          ],
          layout: 'list',
        },
        slots: {},
      },
    ],
  };
  const draft = await api.put(
    `/api/modules/jiwonpapa-page_builder/admin/documents/${document.document_id}/draft`,
    { data: { document, expected_lock_version: payload.data.lock_version } },
  );
  expect(draft.ok()).toBe(true);
  const journal: OwnershipJournal = { version: 1, documentId: document.document_id, slug };
  assertOwnershipJournal(journal);
  await mkdir(OWNERSHIP_DIRECTORY, { recursive: true });
  const journalPath = join(OWNERSHIP_DIRECTORY, `editor-interaction-${viewport}-${runId}.json`);
  await writeFile(journalPath, JSON.stringify(journal, null, 2), 'utf8');
  return { documentId: document.document_id, journalPath, slug };
}

export async function cleanupOwnedEditorInteractionDocument(
  api: APIRequestContext,
  owned: OwnedEditorInteractionDocument,
): Promise<void> {
  await purgeOwnedDocument(api, { version: 1, documentId: owned.documentId, slug: owned.slug });
  await unlink(owned.journalPath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
