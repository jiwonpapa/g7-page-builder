import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';
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
  blocks: Array<{ block_id: string; block_version: number }>;
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
    if (!preset) throw new Error(`No E2E preset covers ${definition.block_id}.`);
    return {
      instance_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      type: definition.block_id,
      block_version: definition.block_version,
      props: structuredClone(preset.props),
      slots: [],
    };
  });
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

test('publishes all 45 catalog blocks and keeps 30 responsive visual baselines', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  expect(builtinManifest.blocks).toHaveLength(45);
  expect(builtinManifest.presets).toHaveLength(55);

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
          description: '45종 내장 블록의 발행, 접근성, 반응형 품질 기준입니다.',
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
    await expect(renderedBlocks).toHaveCount(45);
    const renderedTypes = await renderedBlocks.evaluateAll((blocks) => (
      blocks.map((block) => block.getAttribute('data-block-type') ?? '')
    ));
    expect(new Set(renderedTypes).size).toBe(45);
    expect(renderedTypes.every((type) => type !== '')).toBe(true);
    await expect(page.locator('[data-g7pb-slider-ready="true"]')).toHaveCount(4);
    await page.evaluate(() => document.fonts.ready);

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
      await expect(block).toHaveScreenshot(`catalog-${blockType}-${testInfo.project.name}.png`, {
        animations: 'disabled',
        caret: 'hide',
        scale: 'css',
      });
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
