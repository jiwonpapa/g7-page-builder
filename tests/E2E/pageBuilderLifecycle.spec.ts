import {
  expect,
  request as playwrightRequest,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const MANAGER_PATH = '/modules/jiwonpapa-page_builder/admin';
const NATIVE_MANAGER_PATH = '/admin/page-builder';
const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BlockType =
  | 'bar-chart'
  | 'contact'
  | 'cta'
  | 'features'
  | 'gallery'
  | 'hero'
  | 'logo-cloud'
  | 'pricing'
  | 'stats'
  | 'team';

const PUBLISHED_BLOCK_ORDER: BlockType[] = [
  'features',
  'hero',
  'cta',
  'contact',
  'logo-cloud',
  'stats',
  'pricing',
  'team',
  'gallery',
  'bar-chart',
];

interface AdminLoginResponse {
  data?: {
    token?: unknown;
  };
  success?: unknown;
}

/*
 * This acceptance test handles an administrator credential and bearer token.
 * Disable automatic artifacts for the whole file so neither login request data
 * nor localStorage state can be retained in traces, screenshots, or videos.
 */
test.use({ screenshot: 'off', trace: 'off', video: 'off' });

function adminCredentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Page Builder E2E administrator credentials are not configured.');
  }

  return { email, password };
}

async function authenticateAdmin(context: BrowserContext): Promise<void> {
  const credentials = adminCredentials();
  const authRequest = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  });

  try {
    const response = await authRequest.post('/api/auth/admin/login', {
      data: credentials,
    });

    if (!response.ok()) {
      throw new Error(`Page Builder E2E administrator login failed with HTTP ${response.status()}.`);
    }

    const payload = (await response.json()) as AdminLoginResponse;
    const token = payload.success === true && typeof payload.data?.token === 'string'
      ? payload.data.token
      : null;

    if (!token) {
      throw new Error('Page Builder E2E administrator login returned no usable token.');
    }

    const origin = new URL(BASE_URL).origin;
    await context.addInitScript(
      ({ expectedOrigin, authToken }) => {
        if (window.location.origin === expectedOrigin) {
          window.localStorage.setItem('auth_token', authToken);
        }
      },
      { expectedOrigin: origin, authToken: token },
    );
  } finally {
    await authRequest.dispose();
  }
}

function editorBlock(page: Page, type: BlockType): Locator {
  return page.locator(
    `[data-testid="page-builder-block"][data-block-type="${type}"]`,
  );
}

function renderedBlocks(page: Page): Locator {
  return page.getByTestId('page-builder-rendered-block');
}

function visibleTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

async function revealEditorHeaderActions(page: Page): Promise<void> {
  const addBlock = page.getByTestId('page-builder-add-block');

  if (await addBlock.isVisible()) {
    return;
  }

  await page.getByRole('button', { name: 'Toggle menu bar' }).click();
  await expect(addBlock).toBeVisible();
}

async function revealInspectorField(page: Page, testId: string): Promise<Locator> {
  const field = visibleTestId(page, testId);

  if (!(await field.isVisible())) {
    await page.locator('nav').getByText('Fields', { exact: true }).click();
  }

  await expect(field).toBeVisible();
  return field;
}

async function expectBlockOrder(locator: Locator, expected: BlockType[]): Promise<void> {
  await expect(locator).toHaveCount(expected.length);

  const actual = await locator.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-block-type')),
  );

  expect(actual).toEqual(expected);
}

async function selectMotion(page: Page, type: BlockType, preset: string): Promise<void> {
  await editorBlock(page, type).click();
  const field = await revealInspectorField(page, 'page-builder-motion-preset');
  await field.selectOption(preset);
  await expect(field).toHaveValue(preset);
}

async function requiredLink(locator: Locator, label: string): Promise<string> {
  await expect(locator).toBeVisible();
  await expect(locator).toHaveAttribute('href', /\S+/);
  const href = await locator.getAttribute('href');

  if (!href) {
    throw new Error(`${label} did not provide a URL.`);
  }

  const url = new URL(href, BASE_URL);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} provided an unsupported URL.`);
  }

  return url.toString();
}

async function expectResponsivePage(page: Page, testInfo: TestInfo): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport, 'A fixed viewport is required for responsive acceptance.').not.toBeNull();

  if (!viewport) {
    return;
  }

  if (testInfo.project.name === 'desktop') {
    expect(viewport.width).toBeGreaterThanOrEqual(1200);
  } else if (testInfo.project.name === 'tablet') {
    expect(viewport.width).toBeGreaterThanOrEqual(700);
    expect(viewport.width).toBeLessThan(1200);
  } else if (testInfo.project.name === 'mobile') {
    expect(viewport.width).toBeLessThanOrEqual(500);
  }

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  const count = await renderedBlocks(page).count();
  for (let index = 0; index < count; index += 1) {
    const box = await renderedBlocks(page).nth(index).boundingBox();
    expect(box, `Rendered block ${index + 1} must have a visible box.`).not.toBeNull();

    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  }
}

async function selectAndEditHero(
  page: Page,
  title: string,
  subtitle: string,
): Promise<void> {
  const hero = editorBlock(page, 'hero');
  await expect(hero).toHaveCount(1);
  await hero.click();
  await (await revealInspectorField(page, 'page-builder-hero-title')).fill(title);
  await (await revealInspectorField(page, 'page-builder-hero-subtitle')).fill(subtitle);
}

async function selectAndEditFeatures(
  page: Page,
  heading: string,
  itemTitle: string,
  itemBody: string,
): Promise<void> {
  const features = editorBlock(page, 'features');
  await expect(features).toHaveCount(1);
  await features.click();
  await (await revealInspectorField(page, 'page-builder-features-heading')).fill(heading);
  await (await revealInspectorField(page, 'page-builder-features-item-0-title')).fill(itemTitle);
  await (await revealInspectorField(page, 'page-builder-features-item-0-body')).fill(itemBody);
}

async function selectAndEditCta(
  page: Page,
  heading: string,
  body: string,
  primaryLabel: string,
): Promise<void> {
  const cta = editorBlock(page, 'cta');
  await expect(cta).toHaveCount(1);
  await cta.click();
  await (await revealInspectorField(page, 'page-builder-cta-heading')).fill(heading);
  await (await revealInspectorField(page, 'page-builder-cta-body')).fill(body);
  await (await revealInspectorField(page, 'page-builder-cta-primary-label')).fill(primaryLabel);
  await (await revealInspectorField(page, 'page-builder-cta-primary-url')).fill('/start-now');
  await (await revealInspectorField(page, 'page-builder-cta-theme')).selectOption('dark');
}

async function selectAndEditContact(
  page: Page,
  heading: string,
  address: string,
  email: string,
): Promise<void> {
  const contact = editorBlock(page, 'contact');
  await expect(contact).toHaveCount(1);
  await contact.click();
  await (await revealInspectorField(page, 'page-builder-contact-heading')).fill(heading);
  await (await revealInspectorField(page, 'page-builder-contact-address')).fill(address);
  await (await revealInspectorField(page, 'page-builder-contact-phone')).fill('02-9876-5432');
  await (await revealInspectorField(page, 'page-builder-contact-email')).fill(email);
  await (await revealInspectorField(page, 'page-builder-contact-map-label')).fill('오시는 길');
  await (await revealInspectorField(page, 'page-builder-contact-map-url')).fill('https://maps.example.com/office');
}

async function saveDraft(page: Page): Promise<void> {
  await page.getByTestId('page-builder-save').click();
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute(
    'data-state',
    'saved',
  );
}

async function currentDocumentRevision(page: Page, documentId: string): Promise<number> {
  const revision = await page.evaluate(async (id) => {
    const token = window.localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }
    const response = await fetch(`/api/modules/jiwonpapa-page_builder/admin/documents/${id}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json() as { data?: { revision?: unknown } };

    return typeof payload.data?.revision === 'number' ? payload.data.revision : null;
  }, documentId);

  if (revision === null) {
    throw new Error('Page Builder document did not expose its current revision.');
  }

  return revision;
}

async function publish(page: Page): Promise<void> {
  const committed = page.waitForResponse((response) => {
    const pathname = new URL(response.url()).pathname;

    return response.request().method() === 'POST'
      && /^\/api\/modules\/jiwonpapa-page_builder\/admin\/publications\/[^/]+\/commit$/.test(pathname);
  });
  await page.getByTestId('page-builder-publish').click();
  const response = await committed;
  expect(response.ok()).toBe(true);
  await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute(
    'data-state',
    'published',
  );
}

test('manages, publishes, restores, republishes, and unpublishes a page-builder document', async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);

  await authenticateAdmin(context);

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const slug = `g7pb-e2e-${projectSlug}-${runId}`;
  const pageTitle = `Page Builder E2E ${runId}`;
  const managedTitle = `Managed Page Builder E2E ${runId}`;
  const managedSlug = `managed-${slug}`;
  const heroTitle = `Original Hero ${runId}`;
  const revisedHeroTitle = `Republished Hero ${runId}`;
  const heroSubtitle = `Original subtitle ${runId}`;
  const revisedHeroSubtitle = `Republished subtitle ${runId}`;
  const featuresHeading = `Features ${runId}`;
  const featureTitle = `Reliable publishing ${runId}`;
  const featureBody = `Published output remains stable ${runId}`;
  const ctaHeading = `Start with confidence ${runId}`;
  const ctaBody = `One clear next step ${runId}`;
  const ctaPrimaryLabel = `Start now ${runId}`;
  const contactHeading = `Contact our team ${runId}`;
  const contactAddress = `Seoul office ${runId}`;
  const contactEmail = `e2e-${runId}@example.com`;

  let previewPage: Page | undefined;
  let publicContext: BrowserContext | undefined;

  try {
    page.on('pageerror', (error) => {
      console.error(`Page Builder browser runtime error: ${error.name}: ${error.message.slice(0, 500)}`);
    });
    const managerResponse = await page.goto(MANAGER_PATH);
    expect(managerResponse?.ok()).toBe(true);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();

    await page.getByTestId('page-builder-manager-create').click();
    await expect(page.getByTestId('page-builder-manager-create-dialog')).toBeVisible();
    await page.getByTestId('page-builder-manager-title-input').fill(pageTitle);
    await page.getByTestId('page-builder-manager-slug-input').fill(slug);
    await page.getByTestId('page-builder-manager-create-confirm').click();

    await expect.poll(() => new URL(page.url()).searchParams.get('document') ?? '').toMatch(
      DOCUMENT_ID_PATTERN,
    );
    const documentId = new URL(page.url()).searchParams.get('document');
    if (!documentId) {
      throw new Error('Created Page Builder document did not provide an identifier.');
    }

    await expect(page.getByTestId('page-builder-editor')).toBeVisible();

    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    for (const option of [
      'hero',
      'hero-split',
      'hero-slider',
      'features',
      'cta',
      'contact',
      'logo-cloud',
      'stats',
      'pricing',
      'team',
      'gallery',
      'bar-chart',
    ]) {
      await expect(page.getByTestId(`page-builder-block-option-${option}`)).toBeVisible();
    }
    await page.getByTestId('page-builder-block-option-hero').click();
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    await page.getByTestId('page-builder-block-option-features').click();
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    await page.getByTestId('page-builder-block-option-cta').click();
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    await page.getByTestId('page-builder-block-option-contact').click();
    for (const option of ['logo-cloud', 'stats', 'pricing', 'team', 'gallery', 'bar-chart']) {
      await revealEditorHeaderActions(page);
      await page.getByTestId('page-builder-add-block').click();
      await page.getByTestId(`page-builder-block-option-${option}`).click();
    }

    await selectAndEditHero(page, heroTitle, heroSubtitle);
    await selectAndEditCta(page, ctaHeading, ctaBody, ctaPrimaryLabel);
    await selectAndEditContact(page, contactHeading, contactAddress, contactEmail);
    await selectAndEditFeatures(page, featuresHeading, featureTitle, featureBody);
    await selectMotion(page, 'hero', 'parallax-soft');
    await selectMotion(page, 'features', 'stagger');
    await selectMotion(page, 'cta', 'reveal');
    await selectMotion(page, 'stats', 'counter');
    await selectMotion(page, 'bar-chart', 'chart-draw');

    await editorBlock(page, 'features').click();
    await page.getByTestId('page-builder-block-move-up').click({ timeout: 10_000 });
    await expectBlockOrder(page.getByTestId('page-builder-block'), PUBLISHED_BLOCK_ORDER);

    await saveDraft(page);
    const originalRevision = await currentDocumentRevision(page, documentId);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`document=${documentId}`));
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await expectBlockOrder(page.getByTestId('page-builder-block'), PUBLISHED_BLOCK_ORDER);

    await editorBlock(page, 'hero').click();
    await expect(await revealInspectorField(page, 'page-builder-hero-title')).toHaveValue(heroTitle);
    await expect(await revealInspectorField(page, 'page-builder-hero-subtitle')).toHaveValue(heroSubtitle);
    await editorBlock(page, 'features').click();
    await expect(await revealInspectorField(page, 'page-builder-features-heading')).toHaveValue(featuresHeading);
    await expect(await revealInspectorField(page, 'page-builder-features-item-0-title')).toHaveValue(featureTitle);
    await expect(await revealInspectorField(page, 'page-builder-features-item-0-body')).toHaveValue(featureBody);
    await editorBlock(page, 'cta').click();
    await expect(await revealInspectorField(page, 'page-builder-cta-heading')).toHaveValue(ctaHeading);
    await expect(await revealInspectorField(page, 'page-builder-cta-body')).toHaveValue(ctaBody);
    await expect(await revealInspectorField(page, 'page-builder-cta-primary-label')).toHaveValue(ctaPrimaryLabel);
    await expect(await revealInspectorField(page, 'page-builder-cta-theme')).toHaveValue('dark');
    await editorBlock(page, 'contact').click();
    await expect(await revealInspectorField(page, 'page-builder-contact-heading')).toHaveValue(contactHeading);
    await expect(await revealInspectorField(page, 'page-builder-contact-address')).toHaveValue(contactAddress);
    await expect(await revealInspectorField(page, 'page-builder-contact-email')).toHaveValue(contactEmail);

    const previewUrl = await requiredLink(
      page.getByTestId('page-builder-preview-link'),
      'Page Builder preview',
    );
    previewPage = await context.newPage();
    const previewResponse = await previewPage.goto(previewUrl);
    expect(previewResponse?.ok()).toBe(true);
    await expect(previewPage.getByTestId('page-builder-preview-root')).toBeVisible();
    await expectBlockOrder(renderedBlocks(previewPage), PUBLISHED_BLOCK_ORDER);
    await expect(previewPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(featuresHeading, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(ctaHeading, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(contactHeading, { exact: true })).toBeVisible();
    await expect(previewPage.locator('form')).toHaveCount(0);
    await expect(previewPage.locator('script[src*="page-effects.iife.js"]')).toHaveCount(1);
    await expect(previewPage.locator('[data-block-type="hero"]')).toHaveAttribute('data-g7pb-motion', 'parallax-soft');
    await expect(previewPage.locator('[data-block-type="features"]')).toHaveAttribute('data-g7pb-motion', 'stagger');
    await expectResponsivePage(previewPage, testInfo);
    const repeatedPreviewResponse = await previewPage.reload();
    expect(repeatedPreviewResponse?.ok()).toBe(true);
    await expect(previewPage.getByText(heroTitle, { exact: true })).toBeVisible();

    await page.bringToFront();
    await publish(page);
    const publicUrl = await requiredLink(
      page.getByTestId('page-builder-public-link'),
      'Published Page Builder page',
    );

    const viewport = page.viewportSize() ?? { width: 1440, height: 1000 };
    publicContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport,
    });
    const publicPage = await publicContext.newPage();
    const publicResponse = await publicPage.goto(publicUrl);
    expect(publicResponse?.ok()).toBe(true);
    await expect(publicPage.getByTestId('page-builder-public-root')).toBeVisible();
    expect(await publicPage.evaluate(() => window.localStorage.getItem('auth_token'))).toBeNull();
    await expectBlockOrder(renderedBlocks(publicPage), PUBLISHED_BLOCK_ORDER);
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(featuresHeading, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(ctaHeading, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(contactHeading, { exact: true })).toBeVisible();
    await expect(publicPage.locator('form')).toHaveCount(0);
    await expect(publicPage.locator('script[src*="page-effects.iife.js"]')).toHaveCount(1);
    const animatedStats = publicPage.locator('[data-block-type="stats"][data-g7pb-motion="counter"]');
    await animatedStats.scrollIntoViewIfNeeded();
    await expect(animatedStats).toHaveClass(/is-inview/);
    const animatedChart = publicPage.locator('[data-block-type="bar-chart"][data-g7pb-motion="chart-draw"]');
    await animatedChart.scrollIntoViewIfNeeded();
    await expect(animatedChart).toHaveClass(/is-inview/);
    await expectResponsivePage(publicPage, testInfo);

    await page.bringToFront();
    await selectAndEditHero(page, revisedHeroTitle, revisedHeroSubtitle);
    await saveDraft(page);
    await page.reload();
    await editorBlock(page, 'hero').click();
    await expect(await revealInspectorField(page, 'page-builder-hero-title')).toHaveValue(revisedHeroTitle);

    await publicPage.reload();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toHaveCount(0);

    await page.bringToFront();
    await publish(page);
    await publicPage.reload();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toHaveCount(0);
    await expectBlockOrder(renderedBlocks(publicPage), PUBLISHED_BLOCK_ORDER);
    await expectResponsivePage(publicPage, testInfo);

    await page.bringToFront();
    await page.getByTestId('page-builder-manager-link').click();
    await expect(page).toHaveURL(new RegExp(`${NATIVE_MANAGER_PATH}$`));
    await expect(page.getByText('G7 기본 페이지 관리와 분리된 페이지 빌더 문서함입니다.')).toBeVisible();
    await expect(page.getByText(pageTitle, { exact: true })).toBeVisible();
    await page.goto(MANAGER_PATH);
    await expect(page).toHaveURL(new RegExp(`${MANAGER_PATH}$`));
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();
    const documentRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(documentRow).toContainText(pageTitle);
    await expect(documentRow).toContainText('발행됨');
    await expect(documentRow.getByTestId('page-builder-manager-edit-link')).toHaveAttribute(
      'href',
      `${EDITOR_PATH}?document=${documentId}`,
    );
    const stablePublicHref = await documentRow.getByTestId('page-builder-manager-public-link').getAttribute('href');
    if (!stablePublicHref) {
      throw new Error('Published document row did not retain its public URL.');
    }
    await documentRow.getByTestId('page-builder-manager-settings').click();
    await expect(page.getByTestId('page-builder-manager-metadata-dialog')).toBeVisible();
    await page.getByTestId('page-builder-manager-metadata-title').fill(managedTitle);
    await page.getByTestId('page-builder-manager-metadata-slug').fill(managedSlug);
    await page.getByTestId('page-builder-manager-metadata-save').click();
    await expect(page.getByTestId('page-builder-manager-metadata-dialog')).toHaveCount(0);
    await expect(documentRow).toContainText(managedTitle);
    await expect(documentRow).toContainText(`/${managedSlug}`);
    await expect(documentRow.getByTestId('page-builder-manager-public-link')).toHaveAttribute(
      'href',
      stablePublicHref,
    );

    await documentRow.getByTestId('page-builder-manager-revisions').click();
    await expect(page.getByTestId('page-builder-manager-revisions-dialog')).toBeVisible();
    const originalRevisionRow = page.locator(
      `[data-testid="page-builder-revision-row"][data-revision="${originalRevision}"]`,
    );
    await expect(originalRevisionRow).toBeVisible();
    const historicalPopupPromise = page.waitForEvent('popup');
    await originalRevisionRow.getByTestId('page-builder-revision-preview').click();
    const historicalPreview = await historicalPopupPromise;
    await historicalPreview.waitForURL(/\/modules\/jiwonpapa-page_builder\/preview\/[a-f0-9]{64}$/);
    await expect(historicalPreview.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(historicalPreview.getByText(revisedHeroTitle, { exact: true })).toHaveCount(0);
    await historicalPreview.close();

    await originalRevisionRow.getByTestId('page-builder-revision-restore').click();
    await expect(page.getByTestId('page-builder-revision-restore-dialog')).toBeVisible();
    await page.getByTestId('page-builder-revision-restore-confirm').click();
    await expect(page.getByTestId('page-builder-revision-restore-dialog')).toHaveCount(0);
    await expect(documentRow).toContainText(`/${slug}`);

    await publicPage.reload();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '닫기' }).click();
    await documentRow.getByTestId('page-builder-manager-edit-link').click();
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await editorBlock(page, 'hero').click();
    await expect(await revealInspectorField(page, 'page-builder-hero-title')).toHaveValue(heroTitle);
    await publish(page);
    await publicPage.reload();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toHaveCount(0);

    await page.bringToFront();
    await page.getByTestId('page-builder-manager-link').click();
    await expect(page).toHaveURL(new RegExp(`${NATIVE_MANAGER_PATH}$`));
    await page.goto(MANAGER_PATH);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();
    const restoredDocumentRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await restoredDocumentRow.getByTestId('page-builder-manager-settings').click();
    await page.getByTestId('page-builder-manager-unpublish').click();
    await expect(page.getByTestId('page-builder-unpublish-dialog')).toBeVisible();
    await page.getByTestId('page-builder-unpublish-confirm').click();
    await expect(page.getByTestId('page-builder-unpublish-dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '취소' }).click();
    await expect(restoredDocumentRow).toContainText('초안');
    await expect(restoredDocumentRow.getByTestId('page-builder-manager-public-link')).toHaveCount(0);

    const unpublishedResponse = await publicPage.reload();
    expect(unpublishedResponse?.status()).toBe(404);
  } finally {
    await previewPage?.close();
    await publicContext?.close();
  }
});
