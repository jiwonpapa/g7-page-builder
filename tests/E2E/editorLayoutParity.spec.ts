import { expect, request as playwrightRequest, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const API = '/api/modules/jiwonpapa-page_builder/admin';
const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const CANVAS_IFRAME = '#puck-canvas-root iframe';
const VIEWPORT_WIDTHS = { desktop: 1280, tablet: 768, mobile: 360 } as const;
const LAYOUT_TOLERANCE_PX = 1.25;

interface CatalogManifest {
  blocks: Array<{ block_id: string; block_version: number }>;
  presets: Array<{
    preset_id: string;
    block_id: string;
    block_version: number;
    props: Record<string, unknown>;
  }>;
}

interface StoreCatalog {
  products: Array<{
    product_id: string;
    product_type: string;
    product_version: string;
  }>;
}

interface DocumentResource {
  data?: {
    archived_at?: unknown;
    document?: Record<string, unknown>;
    lock_version?: unknown;
  };
}

interface LayoutMetric {
  blockId: string;
  blockType: string;
  blockScrollOverflow: number;
  contentLeft: number;
  contentRight: number;
  measuredScrollOverflow: number;
  overflow: number;
  rectLeftOverflow: number;
  rectRightOverflow: number;
}

interface Scenario {
  expectedBlockCount: number;
  label: string;
}

interface DraftScenario extends Scenario {
  document: Record<string, unknown>;
}

interface PageKitScenario extends Scenario {
  productId: string;
  productVersion: string;
  slug: string;
}

interface OwnedDocument {
  document: Record<string, unknown>;
  documentId: string;
  lockVersion: number;
  mediaIds: string[];
  slug: string;
}

interface MediaResource {
  data?: {
    items?: Array<{ id?: unknown; url?: unknown }>;
  };
}

const builtinManifest = JSON.parse(
  readFileSync(resolve('resources/block-packs/builtin-core/manifest.json'), 'utf8'),
) as CatalogManifest;
const storeCatalog = JSON.parse(
  readFileSync(resolve('resources/store/dist/catalog.json'), 'utf8'),
) as StoreCatalog;

const pageKitScenarios = readdirSync(resolve('resources/store/source/page-kits'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry): PageKitScenario => {
    const source = JSON.parse(readFileSync(
      resolve('resources/store/source/page-kits', entry.name, 'document.json'),
      'utf8',
    )) as Record<string, unknown>;
    const blocks = source.blocks as Array<Record<string, unknown>>;
    const productId = `jiwonpapa/${entry.name}`;
    const product = storeCatalog.products.find((candidate) => (
      candidate.product_type === 'page_kit' && candidate.product_id === productId
    ));
    if (!product) throw new Error(`Official Page Kit catalog entry is missing: ${productId}`);
    return {
      expectedBlockCount: blocks.length,
      label: `PAGE_KIT_LAYOUT_GATE:${entry.name}`,
      productId,
      productVersion: product.product_version,
      slug: entry.name,
    };
  });

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Editor layout E2E administrator credentials are not configured.');
  return { email, password };
}

function instanceId(index: number): string {
  return `72000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function rekeyBlocks(blocks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return blocks.map((block, index) => ({ ...structuredClone(block), instance_id: instanceId(index) }));
}

function presetScenario(): DraftScenario {
  const blocks = builtinManifest.presets.map((preset, index) => ({
    instance_id: instanceId(index),
    type: preset.block_id,
    block_version: preset.block_version,
    props: structuredClone(preset.props),
    slots: {},
  }));
  return {
    document: {
      schema_version: 'g7-page-builder/v1',
      mode: 'canvas',
      locale: 'ko',
      tokens: {
        'design.color_mode': 'light',
        'design.palette': 'blue',
        'design.font': 'system',
        'design.radius': 'soft',
        'design.width': 'standard',
        'design.scale': 'balanced',
      },
      blocks,
    },
    expectedBlockCount: blocks.length,
    label: 'ALL_95_PRESET_LAYOUT_GATE',
  };
}

async function authenticate(context: BrowserContext): Promise<{ api: APIRequestContext; token: string }> {
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
      throw new Error('Editor layout administrator login returned no token.');
    }
    const token = payload.data.token;
    await context.addInitScript(({ origin, authToken }) => {
      if (window.location.origin === origin) window.localStorage.setItem('auth_token', authToken);
    }, { origin: new URL(BASE_URL).origin, authToken: token });
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return { api, token };
  } finally {
    await auth.dispose();
  }
}

async function createDocument(api: APIRequestContext, projectName: string): Promise<OwnedDocument> {
  const slug = `g7pb-layout-${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await api.post(`${API}/documents`, {
    data: { title: '편집 미리보기 레이아웃 계약', slug, locale: 'ko', mode: 'canvas', shell_mode: 'none' },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as DocumentResource;
  const document = payload.data?.document;
  const lockVersion = payload.data?.lock_version;
  const documentId = document?.document_id;
  if (!document || typeof documentId !== 'string' || typeof lockVersion !== 'number') {
    throw new Error('Editor layout document creation returned an invalid resource.');
  }
  return { document, documentId, lockVersion, mediaIds: [], slug };
}

async function putScenario(
  api: APIRequestContext,
  owned: OwnedDocument,
  scenario: DraftScenario,
): Promise<void> {
  const sourceBlocks = scenario.document.blocks as Array<Record<string, unknown>>;
  const document = {
    ...owned.document,
    ...structuredClone(scenario.document),
    document_id: owned.documentId,
    slug: owned.slug,
    shell_mode: 'none',
    blocks: rekeyBlocks(sourceBlocks),
  };
  const response = await api.put(`${API}/documents/${owned.documentId}/draft`, {
    data: { document, expected_lock_version: owned.lockVersion },
  });
  if (!response.ok()) throw new Error(`${scenario.label} draft failed (${response.status()}): ${await response.text()}`);
  const payload = await response.json() as DocumentResource;
  if (typeof payload.data?.lock_version !== 'number' || !payload.data.document) {
    throw new Error(`${scenario.label} draft returned an invalid resource.`);
  }
  owned.document = payload.data.document;
  owned.lockVersion = payload.data.lock_version;
}

function collectStoredMediaUrls(value: unknown, urls: Set<string>): void {
  if (typeof value === 'string') {
    if (value.includes('/storage/g7-page-builder/')) urls.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStoredMediaUrls(item, urls);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStoredMediaUrls(item, urls);
  }
}

async function applyPageKit(
  api: APIRequestContext,
  scenario: PageKitScenario,
  projectName: string,
  ownedDocuments: OwnedDocument[],
): Promise<OwnedDocument> {
  const slug = `g7pb-layout-${projectName}-${scenario.slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await api.post(`${API}/store/page-kits/apply`, {
    data: {
      product_id: scenario.productId,
      product_version: scenario.productVersion,
      slug,
      title: `레이아웃 계약 ${scenario.slug}`,
    },
  });
  if (response.status() !== 201) {
    throw new Error(`${scenario.label} apply failed (${response.status()}): ${await response.text()}`);
  }
  const payload = await response.json() as DocumentResource;
  const document = payload.data?.document;
  const lockVersion = payload.data?.lock_version;
  const documentId = document?.document_id;
  if (!document || typeof documentId !== 'string' || typeof lockVersion !== 'number') {
    throw new Error(`${scenario.label} apply returned an invalid document resource.`);
  }
  const owned: OwnedDocument = { document, documentId, lockVersion, mediaIds: [], slug };
  ownedDocuments.push(owned);
  expect(JSON.stringify(document), `${scenario.label} retained unresolved portable media`).not.toContain('g7pb-media://');
  expect(document.blocks).toHaveLength(scenario.expectedBlockCount);

  const mediaUrls = new Set<string>();
  collectStoredMediaUrls(document, mediaUrls);
  expect(mediaUrls.size, `${scenario.label} resolved no owned Page Kit media`).toBeGreaterThan(0);
  const mediaResponse = await api.get(`${API}/media?kind=image`);
  expect(mediaResponse.ok()).toBe(true);
  const mediaPayload = await mediaResponse.json() as MediaResource;
  const mediaIds = (mediaPayload.data?.items ?? [])
    .filter((item) => typeof item.url === 'string' && mediaUrls.has(item.url))
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string');
  owned.mediaIds.push(...mediaIds);
  expect(new Set(mediaIds).size, `${scenario.label} owned media cleanup inventory is incomplete`).toBe(mediaUrls.size);

  return owned;
}

async function setCanvasViewport(page: Page, projectName: string): Promise<number> {
  const width = VIEWPORT_WIDTHS[projectName as keyof typeof VIEWPORT_WIDTHS];
  if (!width) throw new Error(`Unknown layout project: ${projectName}`);
  const button = page.getByTestId(`page-builder-viewport-${width}`);
  if (!(await button.isVisible())) await page.getByRole('button', { name: 'Toggle menu bar' }).click();
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(
    () => page.locator('#puck-canvas-root').evaluate((element) => (element as HTMLElement).style.width),
  ).toBe(`${width}px`);
  await page.evaluate(() => new Promise<void>((resolveAnimation) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveAnimation()));
  }));
  return width;
}

async function layoutMetrics(blocks: Locator, editor: boolean): Promise<LayoutMetric[]> {
  return blocks.evaluateAll((elements, usesEditorChild) => elements.map((element) => {
    const block = element as HTMLElement;
    const measured = usesEditorChild ? block.firstElementChild as HTMLElement | null : block;
    if (!measured) throw new Error(`Block ${block.dataset.blockId ?? 'unknown'} has no rendered child.`);
    const documentElement = block.ownerDocument.documentElement;
    const rect = measured.getBoundingClientRect();
    const style = block.ownerDocument.defaultView?.getComputedStyle(measured);
    const paddingLeft = Number.parseFloat(style?.paddingLeft ?? '0') || 0;
    const paddingRight = Number.parseFloat(style?.paddingRight ?? '0') || 0;
    const viewportWidth = documentElement.clientWidth;
    const rectLeftOverflow = Math.max(0, -rect.left);
    const rectRightOverflow = Math.max(0, rect.right - viewportWidth);
    const blockScrollOverflow = Math.max(0, block.scrollWidth - block.clientWidth);
    const measuredScrollOverflow = Math.max(0, measured.scrollWidth - measured.clientWidth);
    return {
      blockId: block.dataset.blockId ?? '',
      blockType: block.dataset.blockType ?? '',
      blockScrollOverflow,
      contentLeft: rect.left + paddingLeft,
      contentRight: rect.right - paddingRight,
      measuredScrollOverflow,
      overflow: Math.max(rectLeftOverflow, rectRightOverflow, blockScrollOverflow, measuredScrollOverflow),
      rectLeftOverflow,
      rectRightOverflow,
    };
  }), editor);
}

async function documentOverflow(locator: Locator): Promise<{
  overflow: number;
  outliers: Array<{ className: string; left: number; right: number; tag: string; testId: string }>;
}> {
  return locator.evaluate((element, tolerance) => {
    const root = element as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const overflow = Math.max(0, root.scrollWidth - root.clientWidth);
    const outliers = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return {
          className: typeof candidate.className === 'string' ? candidate.className.slice(0, 160) : '',
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          tag: candidate.tagName.toLowerCase(),
          testId: candidate.dataset.testid ?? '',
        };
      })
      .filter((candidate) => candidate.left < rootRect.left - tolerance
        || candidate.right > rootRect.right + tolerance)
      .sort((left, right) => Math.max(rootRect.left - right.left, right.right - rootRect.right)
        - Math.max(rootRect.left - left.left, left.right - rootRect.right))
      .slice(0, 8);
    return { overflow, outliers };
  }, LAYOUT_TOLERANCE_PX);
}

async function expectDocumentContained(locator: Locator, label: string): Promise<void> {
  const measured = await documentOverflow(locator);
  expect(measured.overflow, `${label}: ${JSON.stringify(measured.outliers)}`)
    .toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
}

function expectLayoutParity(editorMetrics: LayoutMetric[], previewMetrics: LayoutMetric[]): void {
  expect(editorMetrics.map((metric) => metric.blockId)).toEqual(previewMetrics.map((metric) => metric.blockId));
  expect(editorMetrics.map((metric) => metric.blockType)).toEqual(previewMetrics.map((metric) => metric.blockType));
  const mismatches: Array<Record<string, unknown>> = [];
  for (let index = 0; index < editorMetrics.length; index += 1) {
    const editor = editorMetrics[index];
    const preview = previewMetrics[index];
    const leftDelta = Math.abs(editor.contentLeft - preview.contentLeft);
    const rightDelta = Math.abs(editor.contentRight - preview.contentRight);
    if (
      editor.overflow > LAYOUT_TOLERANCE_PX
      || preview.overflow > LAYOUT_TOLERANCE_PX
      || leftDelta > LAYOUT_TOLERANCE_PX
      || rightDelta > LAYOUT_TOLERANCE_PX
    ) {
      mismatches.push({
        blockId: editor.blockId,
        blockType: editor.blockType,
        editorOverflow: editor.overflow,
        previewOverflow: preview.overflow,
        leftDelta,
        rightDelta,
        editor,
        preview,
      });
    }
  }
  expect(mismatches, `editor/preview layout mismatches: ${JSON.stringify(mismatches)}`).toEqual([]);
}

function expectBlockContainment(metrics: LayoutMetric[], surface: string): void {
  const overflows = metrics.filter((metric) => metric.overflow > LAYOUT_TOLERANCE_PX);
  expect(overflows, `${surface} block overflows: ${JSON.stringify(overflows)}`).toEqual([]);
}

async function assertScenario(
  context: BrowserContext,
  page: Page,
  owned: OwnedDocument,
  scenario: Scenario,
  projectName: string,
): Promise<void> {
  await page.goto(`${EDITOR_PATH}?document=${owned.documentId}`);
  await expect(page.getByTestId('page-builder-editor')).toBeVisible();
  const width = await setCanvasViewport(page, projectName);
  await expect(page.locator(CANVAS_IFRAME)).toHaveCount(1);
  const editorBlocks = page.frameLocator(CANVAS_IFRAME).getByTestId('page-builder-block');
  await expect(editorBlocks).toHaveCount(scenario.expectedBlockCount, { timeout: 60_000 });
  const editorMetrics = await layoutMetrics(editorBlocks, true);
  expectBlockContainment(editorMetrics, `${scenario.label} editor`);
  const editorRoot = page.frameLocator(CANVAS_IFRAME).locator('.g7pb-preview-page');
  await expect(editorRoot).toBeVisible();
  await expectDocumentContained(editorRoot, `${scenario.label} editor product root overflow`);

  const previewLink = page.getByTestId('page-builder-preview-link');
  await expect(previewLink).toBeVisible();
  if (await previewLink.evaluate((element) => element.tagName === 'BUTTON')) {
    const previewResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `${API}/documents/${owned.documentId}/preview`
    ));
    await previewLink.click();
    const previewResponse = await previewResponsePromise;
    const previewResponseBody = await previewResponse.text();
    expect(
      previewResponse.ok(),
      `${scenario.label} preview creation failed (${previewResponse.status()}): ${previewResponseBody}`,
    ).toBe(true);
  }
  await expect(previewLink).toHaveAttribute('href', /\/modules\/jiwonpapa-page_builder\/preview\/[a-f0-9]{64}/);
  const previewUrl = await previewLink.getAttribute('href');
  if (!previewUrl) throw new Error(`${scenario.label} preview URL is unavailable.`);
  const preview = await context.newPage();
  try {
    await preview.setViewportSize({ width, height: 900 });
    const response = await preview.goto(previewUrl);
    expect(response?.ok()).toBe(true);
    const previewRoot = preview.getByTestId('page-builder-preview-root');
    await expect(previewRoot).toBeVisible();
    const previewBlocks = preview.getByTestId('page-builder-rendered-block');
    await expect(previewBlocks).toHaveCount(scenario.expectedBlockCount, { timeout: 60_000 });
    await expectDocumentContained(previewRoot, `${scenario.label} preview product root overflow`);
    const previewMetrics = await layoutMetrics(previewBlocks, false);
    expectLayoutParity(editorMetrics, previewMetrics);
  } finally {
    await preview.close();
  }
}

async function purgeDocument(
  api: APIRequestContext,
  owned: OwnedDocument,
): Promise<void> {
  const currentResponse = await api.get(`${API}/documents/${owned.documentId}`);
  if (currentResponse.status() !== 404) {
    expect(currentResponse.ok()).toBe(true);
    const current = await currentResponse.json() as DocumentResource;
    if (typeof current.data?.lock_version !== 'number') throw new Error('Layout cleanup returned no lock version.');
    let lockVersion = current.data.lock_version;
    if (typeof current.data.archived_at !== 'string') {
      const archiveResponse = await api.post(`${API}/documents/${owned.documentId}/archive`, {
        data: { expected_lock_version: lockVersion },
      });
      expect(archiveResponse.ok()).toBe(true);
      const archived = await archiveResponse.json() as DocumentResource;
      if (typeof archived.data?.lock_version !== 'number') throw new Error('Layout archive returned no lock version.');
      lockVersion = archived.data.lock_version;
    }
    const purgeResponse = await api.delete(`${API}/documents/${owned.documentId}`, {
      data: { expected_lock_version: lockVersion, confirmation_slug: owned.slug },
    });
    expect(purgeResponse.ok()).toBe(true);
  }
  for (const mediaId of owned.mediaIds) {
    const mediaResponse = await api.delete(`${API}/media/${mediaId}`);
    expect(mediaResponse.ok(), `Layout media cleanup failed for ${mediaId}`).toBe(true);
  }
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.describe.configure({ retries: 0 });

test('keeps 45 block types, all 95 presets, and every built-in Page Kit inside the editor/preview layout contract', async ({ context, page }, testInfo) => {
  test.setTimeout(360_000);
  expect(builtinManifest.blocks).toHaveLength(45);
  expect(builtinManifest.presets).toHaveLength(95);
  expect(pageKitScenarios).toHaveLength(5);
  expect(new Set(builtinManifest.presets.map((preset) => preset.block_id))).toEqual(
    new Set(builtinManifest.blocks.map((block) => block.block_id)),
  );

  const { api } = await authenticate(context);
  const ownedDocuments: OwnedDocument[] = [];
  await context.route(/^https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());
  try {
    const preset = presetScenario();
    const presetDocument = await createDocument(api, testInfo.project.name);
    ownedDocuments.push(presetDocument);
    await test.step(preset.label, async () => {
      await putScenario(api, presetDocument, preset);
      await assertScenario(context, page, presetDocument, preset, testInfo.project.name);
    });
    for (const scenario of pageKitScenarios) {
      const pageKitDocument = await applyPageKit(api, scenario, testInfo.project.name, ownedDocuments);
      await test.step(scenario.label, async () => {
        await assertScenario(context, page, pageKitDocument, scenario, testInfo.project.name);
      });
    }
  } finally {
    await page.close();
    for (const owned of ownedDocuments.reverse()) await purgeDocument(api, owned);
    await api.dispose();
  }
});
