import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Locator, type TestInfo } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const API = '/api/modules/jiwonpapa-page_builder/admin';

interface ResourceEnvelope {
  success?: unknown;
  data?: {
    document?: Record<string, unknown>;
    lock_version?: unknown;
    publication_token?: unknown;
  };
}

interface CatalogManifest {
  blocks: Array<{ block_id: string; block_version: number; capabilities: string[] }>;
  presets: Array<{ preset_id: string; block_id: string; block_version: number; props: Record<string, unknown> }>;
}

const builtinManifest = JSON.parse(
  readFileSync(resolve('resources/block-packs/builtin-core/manifest.json'), 'utf8'),
) as CatalogManifest;
const VISUAL_BLOCKS = [
  'hero',
  'divider',
  'blockquote',
  'notice',
  'card-grid',
  'breadcrumbs',
  'anchor-menu',
  'social-links',
  'image-carousel',
  'inquiry-form',
] as const;

const VISUAL_STABLE_FRAME_COUNT = 4;
const VISUAL_STABILITY_FRAME_LIMIT = 240;
const VISUAL_CAPTURE_OPTIONS = {
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
} as const;

interface CatalogPresentationMetric {
  blockType: string;
  brokenImages: string[];
  empty: boolean;
  height: number;
  minReadableFontSize: number | null;
  overflow: number;
  width: number;
}

async function prepareVisualDocument(root: Locator): Promise<void> {
  await root.locator('img').evaluateAll(async (elements, options) => {
    const images = elements as HTMLImageElement[];
    const nextFrame = (): Promise<void> => new Promise((resolveFrame) => {
      requestAnimationFrame(() => resolveFrame());
    });
    for (const image of images) {
      image.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
      for (let frame = 0; !image.complete && frame < options.frameLimit; frame += 1) {
        await nextFrame();
      }
      if (!image.complete) {
        throw new Error(`Visual document image did not settle within ${options.frameLimit} animation frames.`);
      }
      if (image.naturalWidth > 0) {
        try {
          await image.decode();
        } catch {
          // A decoded frame is preferred, while a completed optional image remains covered below.
        }
      }
    }

    let previous = '';
    let stableFrames = 0;
    for (let frame = 0; frame < options.frameLimit; frame += 1) {
      await nextFrame();
      const documentRoot = document.documentElement;
      const current = JSON.stringify([
        documentRoot.scrollWidth,
        documentRoot.scrollHeight,
        images.map((image) => [image.complete, image.naturalWidth, image.naturalHeight]),
      ]);
      stableFrames = current === previous ? stableFrames + 1 : 1;
      previous = current;
      if (stableFrames >= options.stableFrameCount) return;
    }
    throw new Error(`Visual document media did not stabilize within ${options.frameLimit} animation frames.`);
  }, {
    frameLimit: VISUAL_STABILITY_FRAME_LIMIT,
    stableFrameCount: VISUAL_STABLE_FRAME_COUNT,
  });
}

async function waitForVisualBlockStability(block: Locator): Promise<void> {
  await block.evaluate(async (element, options) => {
    await document.fonts.ready;
    const nextFrame = (): Promise<void> => new Promise((resolveFrame) => {
      requestAnimationFrame(() => resolveFrame());
    });
    const images = Array.from(element.querySelectorAll('img'));
    for (let frame = 0; images.some((image) => !image.complete) && frame < options.frameLimit; frame += 1) {
      await nextFrame();
    }
    if (images.some((image) => !image.complete)) {
      throw new Error(`Visual block images did not settle within ${options.frameLimit} animation frames.`);
    }
    await Promise.all(images.filter((image) => image.complete && image.naturalWidth > 0).map(async (image) => {
      try {
        await image.decode();
      } catch {
        // Broken optional media is still covered by the geometry and screenshot assertions.
      }
    }));

    const canonicalScrollTarget = (): { left: number; top: number } => {
      const rect = element.getBoundingClientRect();
      const scrollingElement = document.scrollingElement ?? document.documentElement;
      const viewport = window.visualViewport;
      const pixelRatio = window.devicePixelRatio || 1;
      const snap = (value: number): number => Math.round(value * pixelRatio) / pixelRatio;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const desiredLeft = (viewport?.offsetLeft ?? 0) + ((viewportWidth - rect.width) / 2);
      const desiredTop = (viewport?.offsetTop ?? 0) + ((viewportHeight - rect.height) / 2);
      const documentLeft = window.scrollX + rect.left;
      const documentTop = window.scrollY + rect.top;
      const maxLeft = Math.max(0, scrollingElement.scrollWidth - window.innerWidth);
      const maxTop = Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
      const clamp = (value: number, maximum: number): number => Math.min(maximum, Math.max(0, value));
      return {
        left: Math.round(clamp(snap(documentLeft - desiredLeft), maxLeft)),
        top: Math.round(clamp(snap(documentTop - desiredTop), maxTop)),
      };
    };

    const signature = (target: { left: number; top: number }): string => {
      const rect = element.getBoundingClientRect();
      const root = document.documentElement;
      const viewport = window.visualViewport;
      const pixelRatio = window.devicePixelRatio || 1;
      return JSON.stringify({
        block: [rect.left, rect.top, rect.width, rect.height, element.scrollWidth, element.scrollHeight],
        captureOrigin: [
          (rect.left - (viewport?.offsetLeft ?? 0)) * pixelRatio,
          (rect.top - (viewport?.offsetTop ?? 0)) * pixelRatio,
        ],
        document: [root.scrollWidth, root.scrollHeight],
        fontStatus: document.fonts.status,
        scroll: [window.scrollX, window.scrollY],
        target: [target.left, target.top],
        viewport: viewport
          ? [viewport.offsetLeft, viewport.offsetTop, viewport.pageLeft, viewport.pageTop, viewport.width, viewport.height]
          : null,
      });
    };

    let previous = '';
    let stableFrames = 0;
    for (let frame = 0; frame < options.frameLimit; frame += 1) {
      const target = canonicalScrollTarget();
      window.scrollTo({ left: target.left, top: target.top, behavior: 'auto' });
      await nextFrame();
      const settledTarget = canonicalScrollTarget();
      const current = signature(settledTarget);
      const targetReached = window.scrollX === settledTarget.left && window.scrollY === settledTarget.top;
      stableFrames = targetReached && current === previous ? stableFrames + 1 : 1;
      previous = current;
      if (stableFrames >= options.stableFrameCount) return;
    }

    throw new Error(`Visual block geometry did not stabilize within ${options.frameLimit} animation frames.`);
  }, {
    frameLimit: VISUAL_STABILITY_FRAME_LIMIT,
    stableFrameCount: VISUAL_STABLE_FRAME_COUNT,
  });
}

async function expectDeterministicVisualBlock(
  block: Locator,
  snapshotName: string,
  testInfo: TestInfo,
): Promise<void> {
  const captureState = (): Promise<Record<string, unknown>> => block.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    return {
      rect: [rect.left, rect.top, rect.width, rect.height],
      scroll: [window.scrollX, window.scrollY],
      viewport: viewport
        ? [viewport.offsetLeft, viewport.offsetTop, viewport.pageLeft, viewport.pageTop, viewport.width, viewport.height]
        : null,
    };
  });
  // Element screenshots may perform their own canonical scroll once. Warm that
  // browser path before the two captures that form the determinism contract.
  await block.screenshot(VISUAL_CAPTURE_OPTIONS);
  await waitForVisualBlockStability(block);
  const beforeFirstCapture = await captureState();
  const firstCapture = await block.screenshot(VISUAL_CAPTURE_OPTIONS);
  const afterFirstCapture = await captureState();
  await waitForVisualBlockStability(block);
  const beforeSecondCapture = await captureState();
  const secondCapture = await block.screenshot(VISUAL_CAPTURE_OPTIONS);
  const afterSecondCapture = await captureState();
  if (!firstCapture.equals(secondCapture)) {
    await testInfo.attach(`${snapshotName}-first-capture`, { body: firstCapture, contentType: 'image/png' });
    await testInfo.attach(`${snapshotName}-second-capture`, { body: secondCapture, contentType: 'image/png' });
  }
  expect(firstCapture.equals(secondCapture), `${snapshotName} 연속 캡처가 일치해야 합니다: ${JSON.stringify({
    afterFirstCapture,
    afterSecondCapture,
    beforeFirstCapture,
    beforeSecondCapture,
  })}`).toBe(true);
  expect.soft(secondCapture).toMatchSnapshot(snapshotName);
}

async function expectCatalogPresentationQuality(
  blocks: Locator,
  expectedBlockTypes: string[],
): Promise<void> {
  const metrics = await blocks.evaluateAll((elements): CatalogPresentationMetric[] => elements.map((element) => {
    const block = element as HTMLElement;
    const rect = block.getBoundingClientRect();
    const view = block.ownerDocument.defaultView;
    const isVisible = (candidate: HTMLElement): boolean => {
      const candidateRect = candidate.getBoundingClientRect();
      const style = view?.getComputedStyle(candidate);
      return candidateRect.width > 0
        && candidateRect.height > 0
        && style?.display !== 'none'
        && style?.visibility !== 'hidden'
        && Number.parseFloat(style?.opacity ?? '1') > 0;
    };
    const descendants = Array.from(block.querySelectorAll<HTMLElement>('*')).filter(isVisible);
    const readableFontSizes = descendants
      .filter((candidate) => Array.from(candidate.childNodes).some((node) => (
        node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''
      )))
      .filter((candidate) => !candidate.closest('.g7pb-visually-hidden, [aria-hidden="true"]'))
      .map((candidate) => Number.parseFloat(view?.getComputedStyle(candidate).fontSize ?? '0'))
      .filter((fontSize) => Number.isFinite(fontSize) && fontSize > 0);
    const brokenImages = descendants
      .filter((candidate): candidate is HTMLImageElement => candidate instanceof HTMLImageElement)
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || '[empty-src]');
    const hasMeaningfulContent = descendants.some((candidate) => {
      if (candidate.matches('img,svg,canvas,iframe,video,a,button,input,select,textarea')) return true;
      return Array.from(candidate.childNodes).some((node) => (
        node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''
      ));
    });
    const blockType = block.dataset.blockType ?? '';
    return {
      blockType,
      brokenImages,
      empty: blockType !== 'divider' && !hasMeaningfulContent,
      height: rect.height,
      minReadableFontSize: readableFontSizes.length > 0 ? Math.min(...readableFontSizes) : null,
      overflow: Math.max(0, block.scrollWidth - block.clientWidth),
      width: rect.width,
    };
  }));

  expect(metrics.map((metric) => metric.blockType)).toEqual(expectedBlockTypes);
  const violations = metrics.filter((metric) => (
    metric.width <= 0
    || metric.height <= 0
    || metric.overflow > 1
    || metric.empty
    || metric.brokenImages.length > 0
    || (metric.minReadableFontSize !== null && metric.minReadableFontSize < 10)
  ));
  expect(violations, `catalog presentation violations: ${JSON.stringify(violations)}`).toEqual([]);
}

function adminCredentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Page Builder E2E administrator credentials are not configured.');
  return { email, password };
}

function allCatalogBlocks(): Array<Record<string, unknown>> {
  const presetsByBlock = new Map<string, CatalogManifest['presets'][number]>();
  for (const preset of builtinManifest.presets) {
    if (!presetsByBlock.has(preset.block_id)) presetsByBlock.set(preset.block_id, preset);
  }

  return builtinManifest.blocks.map((definition, index) => {
    const preset = presetsByBlock.get(definition.block_id);
    const compatibilityProps = definition.block_id === 'content.hero-split-01'
      ? {
          eyebrow: '기존 문서 호환',
          title: '기존 분할 히어로도 안전하게 렌더링됩니다',
          body: '<p>새 문서에서는 히어로 블록의 분할 레이아웃을 사용합니다.</p>',
          primaryCta: { label: '자세히 보기', url: '/' },
          image: {
            src: '/modules/jiwonpapa-page_builder/store/previews/company-launch-hero.webp',
            alt: '기존 분할 히어로 호환 이미지',
          },
          mediaPosition: 'right',
          layout: 'screenshot',
        }
      : null;
    if (!preset && !definition.capabilities.includes('editor.compatibility-only')) {
      throw new Error(`No E2E preset covers active block ${definition.block_id}.`);
    }
    if (!preset && compatibilityProps === null) {
      throw new Error(`No E2E compatibility fixture covers ${definition.block_id}.`);
    }
    return {
      instance_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      type: definition.block_id,
      block_version: definition.block_version,
      props: structuredClone(preset?.props ?? compatibilityProps),
      slots: [],
    };
  });
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.describe.configure({ retries: 0 });

test('publishes every catalog block and keeps the responsive visual baselines', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  expect(builtinManifest.blocks.length).toBeGreaterThan(0);
  expect(builtinManifest.presets.length).toBeGreaterThanOrEqual(
    builtinManifest.blocks.filter((block) => !block.capabilities.includes('editor.compatibility-only')).length,
  );

  const login = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  const loginResponse = await login.post('/api/auth/admin/login', { data: adminCredentials() });
  expect(loginResponse.ok()).toBe(true);
  const loginPayload = await loginResponse.json() as { success?: unknown; data?: { token?: unknown } };
  const token = loginPayload.success === true && typeof loginPayload.data?.token === 'string'
    ? loginPayload.data.token
    : null;
  await login.dispose();
  if (!token) throw new Error('Page Builder E2E administrator login returned no usable token.');

  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const slug = `g7pb-catalog-${testInfo.project.name}-${Date.now()}`;
  let documentId = '';
  let lockVersion = 0;
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(`${error.name}: ${error.message}`));
  await page.route(/^https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());

  try {
    const createResponse = await api.post(`${API}/documents`, {
      data: { title: 'G7 전체 블록 카탈로그', slug, locale: 'ko', mode: 'canvas', shell_mode: 'none' },
    });
    expect(createResponse.ok()).toBe(true);
    const created = await createResponse.json() as ResourceEnvelope;
    documentId = typeof created.data?.document?.document_id === 'string'
      ? created.data.document.document_id
      : '';
    lockVersion = Number(created.data?.lock_version);
    expect(documentId).toMatch(/^[0-9a-f-]{36}$/i);

    const metadataResponse = await api.patch(`${API}/documents/${documentId}`, {
      data: {
        title: 'G7 전체 블록 카탈로그',
        slug,
        locale: 'ko',
        shell_mode: 'none',
        expected_lock_version: lockVersion,
        seo: {
          title: 'G7 전체 블록 카탈로그',
          description: `${builtinManifest.blocks.length}종 내장 블록의 발행, 접근성, 반응형 품질 기준입니다.`,
          og_image_url: '',
          robots: 'noindex',
        },
      },
    });
    expect(metadataResponse.ok()).toBe(true);
    const configured = await metadataResponse.json() as ResourceEnvelope;
    lockVersion = Number(configured.data?.lock_version);

    const pageDocument = {
      ...configured.data?.document,
      schema_version: 'g7-page-builder/v1',
      shell_mode: 'none',
      tokens: {
        'design.color_mode': 'light',
        'design.palette': 'blue',
        'design.font': 'system',
        'design.radius': 'soft',
        'design.width': 'standard',
        'design.scale': 'balanced',
      },
      blocks: allCatalogBlocks(),
    };
    const draftResponse = await api.put(`${API}/documents/${documentId}/draft`, {
      data: { document: pageDocument, expected_lock_version: lockVersion },
    });
    if (!draftResponse.ok()) {
      throw new Error(`Catalog draft failed (${draftResponse.status()}): ${await draftResponse.text()}`);
    }
    const draft = await draftResponse.json() as ResourceEnvelope;
    lockVersion = Number(draft.data?.lock_version);

    const prepareResponse = await api.post(`${API}/documents/${documentId}/publications/prepare`, {
      data: { expected_lock_version: lockVersion },
    });
    if (!prepareResponse.ok()) {
      throw new Error(`Catalog publication prepare failed (${prepareResponse.status()}): ${await prepareResponse.text()}`);
    }
    const prepared = await prepareResponse.json() as ResourceEnvelope;
    const publicationToken = prepared.data?.publication_token;
    expect(typeof publicationToken).toBe('string');
    const commitResponse = await api.post(`${API}/publications/${publicationToken}/commit`, { data: {} });
    expect(commitResponse.ok()).toBe(true);

    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const publicResponse = await page.goto(`/pages/${slug}`);
    expect(publicResponse?.ok()).toBe(true);
    const publicRoot = page.getByTestId('page-builder-public-root');
    await expect(publicRoot).toBeVisible();
    const renderedBlocks = publicRoot.getByTestId('page-builder-rendered-block');
    await expect(renderedBlocks).toHaveCount(builtinManifest.blocks.length);
    const renderedTypes = await renderedBlocks.evaluateAll((blocks) => (
      blocks.map((block) => block.getAttribute('data-block-type') ?? '')
    ));
    expect(new Set(renderedTypes).size).toBe(builtinManifest.blocks.length);
    expect(renderedTypes.every((type) => type !== '')).toBe(true);
    await expect(page.locator('[data-g7pb-slider-ready="true"]')).toHaveCount(4);
    const videoFrame = page.locator('.g7pb-video__frame iframe');
    await expect(videoFrame).toHaveAttribute('title', /\S+/);
    await expect(videoFrame).toHaveAttribute('loading', 'lazy');
    await expect(videoFrame).toHaveAttribute('src', /^https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//);
    await expect(page.locator('.g7pb-features__icon')).toHaveCount(3);
    await expect(page.locator('.g7pb-icon-list__icon')).toHaveCount(4);
    await expect(page.locator('.g7pb-stats__icon')).toHaveCount(3);
    const socialIcons = page.locator('.g7pb-social-links__icon');
    await expect(socialIcons).toHaveCount(3);
    await expect(socialIcons.locator('svg')).toHaveCount(3);
    expect(await socialIcons.allTextContents()).toEqual(['', '', '']);
    const comparisonScroller = page.locator('.g7pb-comparison__scroll');
    await expect(comparisonScroller).toHaveAttribute('role', 'region');
    await expect(comparisonScroller).toHaveAttribute('tabindex', '0');
    await comparisonScroller.focus();
    await expect(comparisonScroller).toBeFocused();
    await page.evaluate(() => document.fonts.ready);
    await prepareVisualDocument(publicRoot);
    await expectCatalogPresentationQuality(
      renderedBlocks,
      renderedTypes,
    );
    for (let index = 0; index < builtinManifest.blocks.length; index += 1) {
      await waitForVisualBlockStability(renderedBlocks.nth(index));
    }

    const accessibility = await new AxeBuilder({ page })
      .include('[data-testid="page-builder-public-root"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(runtimeErrors).toEqual([]);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);

    for (const blockType of VISUAL_BLOCKS) {
      const block = publicRoot.locator(`[data-block-type="${blockType}"]`);
      await expect(block).toHaveCount(1);
      await waitForVisualBlockStability(block);
      await expectDeterministicVisualBlock(block, `catalog-${blockType}-${testInfo.project.name}.png`, testInfo);
    }
  } finally {
    if (documentId) {
      const currentResponse = await api.get(`${API}/documents/${documentId}`);
      if (currentResponse.ok()) {
        const current = await currentResponse.json() as ResourceEnvelope;
        lockVersion = Number(current.data?.lock_version);
        const archiveResponse = await api.post(`${API}/documents/${documentId}/archive`, {
          data: { expected_lock_version: lockVersion },
        });
        if (archiveResponse.ok()) {
          const archived = await archiveResponse.json() as ResourceEnvelope;
          lockVersion = Number(archived.data?.lock_version);
          await api.delete(`${API}/documents/${documentId}`, {
            data: { expected_lock_version: lockVersion, confirmation_slug: slug },
          });
        }
      }
    }
    await api.dispose();
  }
});
