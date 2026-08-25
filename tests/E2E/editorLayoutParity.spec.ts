import { expect, request as playwrightRequest, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

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
  contentLeft: number;
  contentRight: number;
  overflow: number;
}

interface Scenario {
  document: Record<string, unknown>;
  expectedBlockCount: number;
  label: string;
}

const builtinManifest = JSON.parse(
  readFileSync(resolve('resources/block-packs/builtin-core/manifest.json'), 'utf8'),
) as CatalogManifest;

const pageKitScenarios = readdirSync(resolve('resources/store/source/page-kits'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))
  .map((entry): Scenario => {
    const source = JSON.parse(readFileSync(
      resolve('resources/store/source/page-kits', entry.name, 'document.json'),
      'utf8',
    )) as Record<string, unknown>;
    const blocks = source.blocks as Array<Record<string, unknown>>;
    return {
      document: source,
      expectedBlockCount: blocks.length,
      label: `PAGE_KIT_LAYOUT_GATE:${basename(entry.name)}`,
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

function presetScenario(): Scenario {
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

async function createDocument(api: APIRequestContext, projectName: string): Promise<{
  document: Record<string, unknown>;
  documentId: string;
  lockVersion: number;
  slug: string;
}> {
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
  return { document, documentId, lockVersion, slug };
}

async function putScenario(
  api: APIRequestContext,
  owned: { document: Record<string, unknown>; documentId: string; lockVersion: number; slug: string },
  scenario: Scenario,
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
    return {
      blockId: block.dataset.blockId ?? '',
      blockType: block.dataset.blockType ?? '',
      contentLeft: rect.left + paddingLeft,
      contentRight: rect.right - paddingRight,
      overflow: Math.max(
        0,
        -rect.left,
        rect.right - viewportWidth,
        block.scrollWidth - block.clientWidth,
        measured.scrollWidth - measured.clientWidth,
      ),
    };
  }), editor);
}

async function documentOverflow(locator: Locator): Promise<{
  overflow: number;
  outliers: Array<{ className: string; left: number; right: number; tag: string; testId: string }>;
}> {
  return locator.evaluate((element, tolerance) => {
    const root = element.ownerDocument.documentElement;
    const overflow = Math.max(0, root.scrollWidth - root.clientWidth);
    const outliers = Array.from(element.ownerDocument.body.querySelectorAll<HTMLElement>('*'))
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
      .filter((candidate) => candidate.left < -tolerance
        || candidate.right > root.clientWidth + tolerance)
      .sort((left, right) => Math.max(Math.abs(right.left), right.right - root.clientWidth)
        - Math.max(Math.abs(left.left), left.right - root.clientWidth))
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
  for (let index = 0; index < editorMetrics.length; index += 1) {
    const editor = editorMetrics[index];
    const preview = previewMetrics[index];
    expect(editor.overflow, `${editor.blockType} editor overflow`).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    expect(preview.overflow, `${preview.blockType} preview overflow`).toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    expect(Math.abs(editor.contentLeft - preview.contentLeft), `${editor.blockType} left content edge`)
      .toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
    expect(Math.abs(editor.contentRight - preview.contentRight), `${editor.blockType} right content edge`)
      .toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
  }
}

async function assertScenario(
  context: BrowserContext,
  page: Page,
  owned: { documentId: string },
  scenario: Scenario,
  projectName: string,
): Promise<void> {
  await page.goto(`${EDITOR_PATH}?document=${owned.documentId}`);
  await expect(page.getByTestId('page-builder-editor')).toBeVisible();
  const width = await setCanvasViewport(page, projectName);
  await expect(page.locator(CANVAS_IFRAME)).toHaveCount(1);
  const editorBlocks = page.frameLocator(CANVAS_IFRAME).getByTestId('page-builder-block');
  await expect(editorBlocks).toHaveCount(scenario.expectedBlockCount, { timeout: 60_000 });
  await expectDocumentContained(editorBlocks.first(), `${scenario.label} editor document overflow`);
  const editorMetrics = await layoutMetrics(editorBlocks, true);

  const previewLink = page.getByTestId('page-builder-preview-link');
  await expect(previewLink).toHaveAttribute('href', /\/modules\/jiwonpapa-page_builder\/preview\/[a-f0-9]{64}/);
  const previewUrl = await previewLink.getAttribute('href');
  if (!previewUrl) throw new Error(`${scenario.label} preview URL is unavailable.`);
  const preview = await context.newPage();
  try {
    await preview.setViewportSize({ width, height: 900 });
    const response = await preview.goto(previewUrl);
    expect(response?.ok()).toBe(true);
    await expect(preview.getByTestId('page-builder-preview-root')).toBeVisible();
    const previewBlocks = preview.getByTestId('page-builder-rendered-block');
    await expect(previewBlocks).toHaveCount(scenario.expectedBlockCount, { timeout: 60_000 });
    await expectDocumentContained(previewBlocks.first(), `${scenario.label} preview document overflow`);
    const previewMetrics = await layoutMetrics(previewBlocks, false);
    expectLayoutParity(editorMetrics, previewMetrics);
  } finally {
    await preview.close();
  }
}

async function purgeDocument(
  api: APIRequestContext,
  owned: { documentId: string; lockVersion: number; slug: string },
): Promise<void> {
  const currentResponse = await api.get(`${API}/documents/${owned.documentId}`);
  if (currentResponse.status() === 404) return;
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
  const owned = await createDocument(api, testInfo.project.name);
  await context.route(/^https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());
  try {
    for (const scenario of [presetScenario(), ...pageKitScenarios]) {
      await test.step(scenario.label, async () => {
        await putScenario(api, owned, scenario);
        await assertScenario(context, page, owned, scenario, testInfo.project.name);
      });
    }
  } finally {
    await page.close();
    await purgeDocument(api, owned);
    await api.dispose();
  }
});
