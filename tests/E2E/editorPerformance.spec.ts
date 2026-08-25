import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

import type { PageBuilderDocument } from '../../resources/js/documents/types';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const BLOCK_COUNT = 100;

const budget = (name: string, fallback: number): number => {
  const configured = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(configured) || configured <= 0) throw new Error(`${name} must be a positive number.`);
  return configured;
};

const BUDGETS = {
  documentReadyMs: budget('G7PB_PERF_DOCUMENT_READY_MS', 8_000),
  typingP95Ms: budget('G7PB_PERF_TYPING_P95_MS', 180),
  typingMaxMs: budget('G7PB_PERF_TYPING_MAX_MS', 300),
  dragMs: budget('G7PB_PERF_DRAG_MS', 1_500),
  galleryOpenMs: budget('G7PB_PERF_GALLERY_OPEN_MS', 650),
  longTaskCount: budget('G7PB_PERF_LONG_TASK_COUNT', 20),
  longTaskMaxMs: budget('G7PB_PERF_LONG_TASK_MAX_MS', 700),
  longTaskTotalMs: budget('G7PB_PERF_LONG_TASK_TOTAL_MS', 2_500),
};

interface CreatedResource {
  document: PageBuilderDocument;
  lock_version: number;
}

interface LongTaskMetric {
  duration: number;
  startTime: number;
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Page Builder performance administrator credentials are not configured.');
  return { email, password };
}

async function authenticate(context: BrowserContext): Promise<string> {
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
      throw new Error('Page Builder performance login returned no token.');
    }
    const token = payload.data.token;
    await context.addInitScript(({ origin, authToken }) => {
      if (window.location.origin === origin) window.localStorage.setItem('auth_token', authToken);
      if (window === window.top) {
        const metrics = window as Window & { __g7pbLongTasks?: LongTaskMetric[] };
        metrics.__g7pbLongTasks = [];
        if (typeof PerformanceObserver !== 'undefined'
          && PerformanceObserver.supportedEntryTypes.includes('longtask')) {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              metrics.__g7pbLongTasks?.push({ duration: entry.duration, startTime: entry.startTime });
            }
          }).observe({ type: 'longtask', buffered: true });
        }
      }
    }, { origin: new URL(BASE_URL).origin, authToken: token });
    return token;
  } finally {
    await auth.dispose();
  }
}

async function createPerformanceDocument(api: APIRequestContext, runId: string): Promise<CreatedResource> {
  const response = await api.post('/api/modules/jiwonpapa-page_builder/admin/documents', {
    data: {
      title: `100 Block Performance ${runId}`,
      slug: `g7pb-perf-${runId}`,
      locale: 'ko',
      mode: 'canvas',
      shell_mode: 'none',
    },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: Partial<CreatedResource> };
  if (!payload.data?.document || typeof payload.data.lock_version !== 'number') {
    throw new Error('Performance document creation returned an invalid resource.');
  }

  const document: PageBuilderDocument = {
    ...payload.data.document,
    shell_mode: 'none',
    blocks: Array.from({ length: BLOCK_COUNT }, (_, index) => ({
      instance_id: crypto.randomUUID(),
      type: 'content.heading-01',
      block_version: 1,
      props: {
        eyebrow: `PERFORMANCE ${String(index + 1).padStart(3, '0')}`,
        heading: `100블록 편집 성능 기준 ${index + 1}`,
        level: 2,
        anchor: `performance-${index + 1}`,
      },
      slots: {},
    })),
  };
  const draftResponse = await api.put(
    `/api/modules/jiwonpapa-page_builder/admin/documents/${document.document_id}/draft`,
    { data: { document, expected_lock_version: payload.data.lock_version } },
  );
  expect(draftResponse.ok()).toBe(true);
  const draft = await draftResponse.json() as { data?: { document?: PageBuilderDocument; lock_version?: unknown } };
  if (!draft.data?.document || typeof draft.data.lock_version !== 'number') {
    throw new Error('Performance document draft save returned an invalid resource.');
  }
  return { document: draft.data.document, lock_version: draft.data.lock_version };
}

async function purgePerformanceDocument(api: APIRequestContext, documentId: string, slug: string): Promise<void> {
  const currentResponse = await api.get(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`);
  if (currentResponse.status() === 404) return;
  expect(currentResponse.ok()).toBe(true);
  const current = await currentResponse.json() as {
    data?: { archived_at?: unknown; lock_version?: unknown; document?: { slug?: unknown } };
  };
  if (current.data?.document?.slug !== slug || typeof current.data.lock_version !== 'number') {
    throw new Error('Refusing to clean up a performance document without exact ownership proof.');
  }
  let lockVersion = current.data.lock_version;
  if (typeof current.data.archived_at !== 'string') {
    const archivedResponse = await api.post(
      `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/archive`,
      { data: { expected_lock_version: lockVersion } },
    );
    expect(archivedResponse.ok()).toBe(true);
    const archived = await archivedResponse.json() as { data?: { lock_version?: unknown } };
    if (typeof archived.data?.lock_version !== 'number') throw new Error('Performance cleanup archive returned no lock.');
    lockVersion = archived.data.lock_version;
  }
  const purged = await api.delete(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`, {
    data: { confirmation_slug: slug, expected_lock_version: lockVersion },
  });
  expect(purged.ok()).toBe(true);
}

async function measureTyping(page: Page): Promise<number[]> {
  const firstHeading = page.frameLocator('iframe').locator(
    '[data-testid="page-builder-block"][data-block-type="heading"]',
  ).first().locator('[data-g7pb-inline-field="heading"]');
  await firstHeading.scrollIntoViewIfNeeded();
  await firstHeading.dispatchEvent('pointerdown');
  await expect(firstHeading).toBeEditable();
  await firstHeading.click();

  const samples: number[] = [];
  for (const character of ' typing-gate') {
    const measurement = page.evaluate(() => new Promise<number>((resolve) => {
      const frameDocument = document.querySelector('iframe')?.contentDocument;
      const start = performance.now();
      frameDocument?.addEventListener('input', () => {
        requestAnimationFrame(() => resolve(performance.now() - start));
      }, { capture: true, once: true });
    }));
    await page.keyboard.insertText(character);
    samples.push(await measurement);
  }
  await expect(firstHeading).toContainText('typing-gate');
  return samples;
}

async function measureDrag(page: Page): Promise<number> {
  const source = page.getByTestId('drawer-item:Hero');
  if (!(await source.isVisible())) {
    await page.getByText('Blocks', { exact: true }).click();
  }
  const target = page.frameLocator('iframe').locator(
    '[data-testid="page-builder-block"][data-block-type="heading"]',
  ).first();
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Could not resolve performance drag geometry.');

  const start = await page.evaluate(() => performance.now());
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2, { steps: 4 });
  await page.mouse.move(targetBox.x + 24, targetBox.y + 4, { steps: 16 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect(page.frameLocator('iframe').getByTestId('page-builder-block')).toHaveCount(BLOCK_COUNT + 1);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  return await page.evaluate((startedAt) => performance.now() - startedAt, start);
}

async function measureGallery(page: Page): Promise<number> {
  const measurement = page.evaluate(() => new Promise<number>((resolve) => {
    const start = performance.now();
    const observer = new MutationObserver(() => {
      if (!document.querySelector('[data-testid="page-builder-block-gallery"]')) return;
      observer.disconnect();
      requestAnimationFrame(() => resolve(performance.now() - start));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }));
  await page.getByTestId('page-builder-add-block').click();
  const duration = await measurement;
  const gallery = page.getByTestId('page-builder-block-gallery');
  await expect(gallery).toBeVisible();
  const grid = gallery.locator('.g7pb-block-gallery__grid');
  await expect(grid).toHaveAttribute('data-total-items', '140');
  await expect(grid).toHaveAttribute('data-rendered-items', '24');
  await expect(grid.locator('[data-block-preview]')).toHaveCount(24);
  return duration;
}

function percentile95(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
}

test('100-block editing stays inside hard interaction and Long Task budgets', async ({ browserName, context, page }, testInfo: TestInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'desktop', 'Performance gate runs once on desktop Chromium.');
  const token = await authenticate(context);
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let resource: CreatedResource | null = null;

  try {
    resource = await createPerformanceDocument(api, runId);
    await page.goto(`${EDITOR_PATH}?document=${resource.document.document_id}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('page-builder-app')).toHaveAttribute('aria-busy', 'false', { timeout: 30_000 });
    await expect(page.frameLocator('iframe').getByTestId('page-builder-block')).toHaveCount(BLOCK_COUNT, { timeout: 30_000 });
    const documentReadyMs = await page.evaluate(() => performance.now());

    const typingSamples = await measureTyping(page);
    const typingP95Ms = percentile95(typingSamples);
    const typingMaxMs = Math.max(...typingSamples);
    const dragMs = await measureDrag(page);
    const galleryOpenMs = await measureGallery(page);
    await page.waitForTimeout(100);
    const longTasks = await page.evaluate(() =>
      (window as Window & { __g7pbLongTasks?: LongTaskMetric[] }).__g7pbLongTasks ?? [],
    );
    const longTaskMaxMs = Math.max(0, ...longTasks.map((entry) => entry.duration));
    const longTaskTotalMs = longTasks.reduce((total, entry) => total + entry.duration, 0);
    const metrics = {
      blockCount: BLOCK_COUNT,
      documentReadyMs,
      typingP95Ms,
      typingMaxMs,
      typingSamples,
      dragMs,
      galleryOpenMs,
      galleryRenderedItems: 24,
      longTaskCount: longTasks.length,
      longTaskMaxMs,
      longTaskTotalMs,
      budgets: BUDGETS,
    };
    await testInfo.attach('editor-performance-metrics', {
      body: Buffer.from(JSON.stringify(metrics, null, 2)),
      contentType: 'application/json',
    });

    expect(documentReadyMs, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.documentReadyMs);
    expect(typingP95Ms, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.typingP95Ms);
    expect(typingMaxMs, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.typingMaxMs);
    expect(dragMs, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.dragMs);
    expect(galleryOpenMs, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.galleryOpenMs);
    expect(longTasks.length, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.longTaskCount);
    expect(longTaskMaxMs, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.longTaskMaxMs);
    expect(longTaskTotalMs, JSON.stringify(metrics)).toBeLessThanOrEqual(BUDGETS.longTaskTotalMs);
  } finally {
    await page.close();
    if (resource) await purgePerformanceDocument(api, resource.document.document_id, resource.document.slug);
    await api.dispose();
  }
});
