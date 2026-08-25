import { expect, request as playwrightRequest, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PageBuilderDocument } from '../../../resources/js/documents/types';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const OWNERSHIP_DIRECTORY = join(process.cwd(), 'output', 'playwright', 'ownership');
const SLUG_PATTERN = /^g7pb-interaction-(?:desktop|tablet|mobile)-\d{13}-[a-z0-9]{6}$/;
const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    blocks: [{
      instance_id: crypto.randomUUID(),
      type: 'content.rich-text-01',
      block_version: 1,
      props: {
        content: '<p>방문자가 이해해야 할 내용을 읽기 편한 문단으로 작성해 주세요.</p><p>중요한 문장은 굵게 강조하고 목록이나 링크를 활용할 수 있습니다.</p>',
        measure: 'standard',
      },
      slots: {},
    }],
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
