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
  | 'hero-slider'
  | 'logo-cloud'
  | 'pricing'
  | 'stats'
  | 'team';

const PUBLISHED_BLOCK_ORDER: BlockType[] = [
  'features',
  'hero',
  'hero-slider',
  'cta',
  'contact',
  'logo-cloud',
  'stats',
  'pricing',
  'team',
  'gallery',
  'bar-chart',
];

const BLOCK_LABELS: Record<BlockType, string> = {
  'bar-chart': 'Bar chart',
  contact: 'Contact',
  cta: 'CTA',
  features: 'Features',
  gallery: 'Gallery',
  hero: 'Hero',
  'hero-slider': 'Hero slider',
  'logo-cloud': 'Logo cloud',
  pricing: 'Pricing',
  stats: 'Stats',
  team: 'Team',
};

interface AdminLoginResponse {
  data?: {
    token?: unknown;
  };
  success?: unknown;
}

interface CleanupDocumentResource {
  archived_at?: unknown;
  document?: {
    document_id?: unknown;
    slug?: unknown;
  };
  lock_version?: unknown;
}

interface CleanupDocumentListResponse {
  data?: {
    items?: unknown;
    pagination?: {
      total?: unknown;
    };
  };
  success?: unknown;
}

interface SiteShellResource {
  locale: string;
  lock_version: number;
  brand_name: string;
  logo_url: string;
  home_url: string;
  header_variant: 'solid' | 'transparent';
  sticky: boolean;
  navigation: Array<{ label: string; url: string }>;
  cta: { label: string; url: string } | null;
  footer_text: string;
  show_footer_navigation: boolean;
  updated_at: string | null;
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

async function authenticateAdmin(context: BrowserContext): Promise<string> {
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

    return token;
  } finally {
    await authRequest.dispose();
  }
}

async function readSiteShell(authToken: string, locale = 'ko'): Promise<SiteShellResource> {
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${authToken}` },
  });
  try {
    const response = await api.get(`/api/modules/jiwonpapa-page_builder/admin/site-shell?locale=${encodeURIComponent(locale)}`);
    expect(response.ok()).toBe(true);
    const payload = await response.json() as { success?: boolean; data?: SiteShellResource };
    if (payload.success !== true || !payload.data) throw new Error('Site shell API returned no configuration.');
    return payload.data;
  } finally {
    await api.dispose();
  }
}

async function restoreSiteShell(authToken: string, original: SiteShellResource): Promise<void> {
  const current = await readSiteShell(authToken, original.locale);
  const { lock_version: _lockVersion, updated_at: _updatedAt, ...configuration } = original;
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json', Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json',
    },
  });
  try {
    const response = await api.put('/api/modules/jiwonpapa-page_builder/admin/site-shell', {
      data: { ...configuration, expected_lock_version: current.lock_version },
    });
    if (!response.ok()) {
      const payload = await response.json().catch(() => null) as {
        data?: { code?: unknown; errors?: unknown };
        message?: unknown;
      } | null;
      throw new Error(
        `Site shell restore failed with HTTP ${response.status()} (${String(payload?.data?.code ?? 'unknown')}): ${String(payload?.message ?? 'no message')} ${JSON.stringify(payload?.data?.errors ?? {})}`,
      );
    }
  } finally {
    await api.dispose();
  }
}

async function cleanupE2eArtifacts(
  authToken: string,
  candidateSlugs: string[],
  uploadedMediaId: string | null,
): Promise<void> {
  const cleanupRequest = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  const expectedSlugs = new Set(candidateSlugs);
  const targets = new Map<string, { archived: boolean; lockVersion: number; slug: string }>();

  try {
    for (let pageNumber = 1; ; pageNumber += 1) {
      const response = await cleanupRequest.get(
        `/api/modules/jiwonpapa-page_builder/admin/documents?page=${pageNumber}&per_page=100&status=all`,
      );
      if (!response.ok()) {
        throw new Error(`Page Builder E2E cleanup list failed with HTTP ${response.status()}.`);
      }

      const payload = await response.json() as CleanupDocumentListResponse;
      const items = payload.success === true && Array.isArray(payload.data?.items)
        ? payload.data.items as CleanupDocumentResource[]
        : [];

      for (const item of items) {
        const documentId = item.document?.document_id;
        const documentSlug = item.document?.slug;
        if (
          typeof documentId === 'string'
          && typeof documentSlug === 'string'
          && typeof item.lock_version === 'number'
          && expectedSlugs.has(documentSlug)
        ) {
          targets.set(documentId, {
            archived: typeof item.archived_at === 'string',
            lockVersion: item.lock_version,
            slug: documentSlug,
          });
        }
      }

      const total = payload.data?.pagination?.total;
      if (typeof total !== 'number' || pageNumber * 100 >= total) {
        break;
      }
    }

    for (const [documentId, target] of targets) {
      let lockVersion = target.lockVersion;
      if (!target.archived) {
        const archiveResponse = await cleanupRequest.post(
          `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/archive`,
          { data: { expected_lock_version: lockVersion } },
        );
        if (!archiveResponse.ok()) {
          throw new Error(`Page Builder E2E cleanup archive failed with HTTP ${archiveResponse.status()}.`);
        }

        const archivePayload = await archiveResponse.json() as {
          data?: { lock_version?: unknown };
          success?: unknown;
        };
        if (archivePayload.success !== true || typeof archivePayload.data?.lock_version !== 'number') {
          throw new Error('Page Builder E2E cleanup archive returned no lock version.');
        }
        lockVersion = archivePayload.data.lock_version;
      }

      const purgeResponse = await cleanupRequest.delete(
        `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`,
        {
          data: {
            confirmation_slug: target.slug,
            expected_lock_version: lockVersion,
          },
        },
      );
      if (!purgeResponse.ok()) {
        throw new Error(`Page Builder E2E cleanup purge failed with HTTP ${purgeResponse.status()}.`);
      }
    }

    if (uploadedMediaId) {
      const mediaResponse = await cleanupRequest.delete(
        `/api/modules/jiwonpapa-page_builder/admin/media/${uploadedMediaId}`,
      );
      if (!mediaResponse.ok()) {
        throw new Error(`Page Builder E2E media cleanup failed with HTTP ${mediaResponse.status()}.`);
      }
    }
  } finally {
    await cleanupRequest.dispose();
  }
}

function editorBlock(page: Page, type: BlockType): Locator {
  return page.frameLocator('iframe').locator(
    `[data-testid="page-builder-block"][data-block-type="${type}"]`,
  );
}

function editorBlocks(page: Page): Locator {
  return page.frameLocator('iframe').getByTestId('page-builder-block');
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

async function revealBlockLibrary(page: Page): Promise<void> {
  const library = page.getByTestId('page-builder-block-library');
  if (await library.isVisible()) {
    return;
  }

  await page.getByText('Blocks', { exact: true }).click();
  await expect(library).toBeVisible();
}

async function hideMobileBlockLibrary(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const library = page.getByTestId('page-builder-block-library');
  if (!viewport || viewport.width > 720 || !(await library.isVisible())) {
    return;
  }

  await page.getByText('Blocks', { exact: true }).click();
  await expect(library).toBeHidden();
}

async function revealInspectorField(page: Page, testId: string): Promise<Locator> {
  const field = visibleTestId(page, testId);

  if (!(await field.isVisible())) {
    await page.locator('nav').getByText('Fields', { exact: true }).click();
  }

  await expect(field).toBeVisible();
  return field;
}

async function selectEditorBlock(page: Page, type: BlockType): Promise<void> {
  const viewport = page.viewportSize();
  const visibleField = page.locator('.g7pb-field-control:visible').first();

  if (viewport && viewport.width <= 720) {
    const navigation = page.locator('nav');
    if (await visibleField.isVisible()) {
      await navigation.getByText('Fields', { exact: true }).click();
      await expect(visibleField).toBeHidden();
    }

    await navigation.getByText('Outline', { exact: true }).click();
    const outlineItem = page.getByText(BLOCK_LABELS[type], { exact: true }).last();
    await expect(outlineItem).toBeVisible();
    await outlineItem.click();
    await navigation.getByText('Outline', { exact: true }).click();
    await expect(outlineItem).toBeHidden();
    return;
  }

  await editorBlock(page, type).click();
}

async function expectBlockOrder(locator: Locator, expected: BlockType[]): Promise<void> {
  await expect(locator).toHaveCount(expected.length);

  const actual = await locator.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-block-type')),
  );

  expect(actual).toEqual(expected);
}

async function dragLibraryBlockBefore(
  page: Page,
  component: string,
  targetType: BlockType,
): Promise<void> {
  const source = page.getByTestId(`drawer-item:${component}`);
  const target = editorBlock(page, targetType);
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error(`Could not resolve drag geometry for ${component} before ${targetType}.`);
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2 + 12,
    sourceBox.y + sourceBox.height / 2,
    { steps: 4 },
  );
  await page.mouse.move(targetBox.x + 24, targetBox.y + 4, { steps: 24 });
  await page.waitForTimeout(180);
  await page.mouse.up();
}

async function expectCanvasWidth(page: Page, width: number): Promise<void> {
  await expect.poll(
    () => page.locator('#puck-canvas-root').evaluate((element) => element.style.width),
  ).toBe(`${width}px`);
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
  await selectEditorBlock(page, 'hero');
  const inlineTitle = hero.locator(
    '[data-g7pb-inline-field="title"][contenteditable], [data-g7pb-inline-field="title"] [contenteditable]',
  );
  const inlineSubtitle = hero.locator(
    '[data-g7pb-inline-field="eyebrow"][contenteditable], [data-g7pb-inline-field="eyebrow"] [contenteditable]',
  );
  const inlineBody = hero.locator(
    '[data-g7pb-inline-field="body"][contenteditable], [data-g7pb-inline-field="body"] [contenteditable]',
  );
  await expect(inlineTitle).toHaveCount(1);
  await expect(inlineSubtitle).toHaveCount(1);
  await expect(inlineBody).toHaveCount(1);
  await inlineTitle.hover();
  await expect(inlineTitle).toHaveAttribute('contenteditable', 'plaintext-only');
  await inlineTitle.fill(title);
  await inlineSubtitle.hover();
  await expect(inlineSubtitle).toHaveAttribute('contenteditable', 'plaintext-only');
  await inlineSubtitle.fill(subtitle);
  await inlineSubtitle.press('Tab');
  await expect(await revealInspectorField(page, 'page-builder-hero-title')).toHaveValue(title);
  await expect(await revealInspectorField(page, 'page-builder-hero-subtitle')).toHaveValue(subtitle);
}

async function selectAndEditFeatures(
  page: Page,
  heading: string,
  itemTitle: string,
  itemBody: string,
): Promise<void> {
  const features = editorBlock(page, 'features');
  await expect(features).toHaveCount(1);
  await selectEditorBlock(page, 'features');
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
  await selectEditorBlock(page, 'cta');
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
  await selectEditorBlock(page, 'contact');
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
  test.setTimeout(240_000);

  const authToken = await authenticateAdmin(context);

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
  let uploadedMediaId: string | null = null;
  let originalSiteShell: SiteShellResource | null = null;
  let lifecycleError: unknown;

  try {
    page.on('pageerror', (error) => {
      console.error(`Page Builder browser runtime error: ${error.name}: ${error.message.slice(0, 500)}`);
    });
    const managerResponse = await page.goto(MANAGER_PATH);
    expect(managerResponse?.ok()).toBe(true);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();

    const managerLocale = await page.getByTestId('page-builder-manager-root').getAttribute('data-locale') ?? 'ko';
    originalSiteShell = await readSiteShell(authToken, managerLocale);
    await page.getByTestId('page-builder-manager-site-shell').click();
    const siteShellDialog = page.getByTestId('page-builder-site-shell-dialog');
    await expect(siteShellDialog).toBeVisible();
    await page.getByTestId('page-builder-site-shell-brand').fill(`E2E Site ${runId}`);
    const menuDeleteButtons = siteShellDialog.locator('.g7pb-site-shell-navigation__item > button');
    while (await menuDeleteButtons.count() > 0) await menuDeleteButtons.first().click();
    await page.getByTestId('page-builder-site-shell-add-menu').click();
    await siteShellDialog.getByLabel('1번 메뉴 이름').fill('소개');
    await siteShellDialog.getByLabel('1번 메뉴 주소').fill(`/pages/${slug}`);
    const siteShellSave = page.waitForResponse((response) => response.request().method() === 'PUT'
      && new URL(response.url()).pathname.endsWith('/admin/site-shell'));
    await page.getByTestId('page-builder-site-shell-save').click();
    const siteShellSaveResponse = await siteShellSave;
    if (!siteShellSaveResponse.ok()) {
      const payload = await siteShellSaveResponse.json().catch(() => null) as {
        data?: { code?: unknown; errors?: unknown };
        message?: unknown;
      } | null;
      throw new Error(
        `Site shell save failed with HTTP ${siteShellSaveResponse.status()} (${String(payload?.data?.code ?? 'unknown')}): ${String(payload?.message ?? 'no message')} ${JSON.stringify(payload?.data?.errors ?? {})}`,
      );
    }
    await expect(siteShellDialog).toHaveCount(0);

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

    await revealBlockLibrary(page);
    for (const component of [
      'Hero',
      'HeroSplit',
      'HeroSlider',
      'Features',
      'Cta',
      'Contact',
      'LogoCloud',
      'Stats',
      'Pricing',
      'Team',
      'Gallery',
      'BarChart',
    ]) {
      await expect(page.getByTestId(`drawer-item:${component}`)).toHaveCount(1);
    }
    await hideMobileBlockLibrary(page);

    await revealEditorHeaderActions(page);
    await expect(page.getByTestId('page-builder-viewport-1280')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('page-builder-viewport-360').click();
    await expectCanvasWidth(page, 360);
    await page.getByTestId('page-builder-viewport-768').click();
    await expectCanvasWidth(page, 768);
    await page.getByTestId('page-builder-viewport-1280').click();
    await expectCanvasWidth(page, 1280);
    if ((page.viewportSize()?.width ?? 1280) <= 720) {
      await page.getByTestId('page-builder-viewport-360').click();
      await expectCanvasWidth(page, 360);
    }

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
    await page.getByTestId('page-builder-block-option-hero-slider').click();
    await expect(page.getByTestId('page-builder-hero-warning')).toContainText('Hero 계열 블록이 2개');
    await page.getByTestId('page-builder-hero-warning-dismiss').click();
    await expect(page.getByTestId('page-builder-hero-warning')).toBeHidden();
    const slider = editorBlock(page, 'hero-slider');
    const sliderInlineFields = slider.locator('[contenteditable]');
    const visibleSliderInlineFields = slider.locator('[contenteditable]:visible');
    await expect(sliderInlineFields).toHaveCount(8);
    await expect(visibleSliderInlineFields).toHaveCount(4);
    await visibleSliderInlineFields.first().hover();
    await expect(visibleSliderInlineFields.first()).toHaveAttribute('contenteditable', 'plaintext-only');
    await slider.getByTestId('page-builder-slider-next').click();
    await expect(slider.getByTestId('page-builder-slider-slide-1')).toHaveAttribute('aria-pressed', 'true');
    await expect(slider.locator('[data-slide-index="1"]')).toBeVisible();
    await expect(slider.locator('[data-slide-index="0"]')).toBeHidden();
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    await page.getByTestId('page-builder-block-option-cta').click();
    await revealBlockLibrary(page);
    await dragLibraryBlockBefore(page, 'Features', 'hero');
    await expectBlockOrder(editorBlocks(page), ['features', 'hero', 'hero-slider', 'cta']);
    await hideMobileBlockLibrary(page);

    await selectEditorBlock(page, 'cta');
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    await page.getByTestId('page-builder-block-option-contact').click();
    for (const option of ['logo-cloud', 'stats', 'pricing', 'team', 'gallery', 'bar-chart']) {
      await revealEditorHeaderActions(page);
      await page.getByTestId('page-builder-add-block').click();
      await page.getByTestId(`page-builder-block-option-${option}`).click();
    }

    await selectAndEditHero(page, heroTitle, heroSubtitle);
    const mediaUpload = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/modules/jiwonpapa-page_builder/admin/media');
    const mediaField = page.locator('.g7pb-media-field:visible');
    await (await revealInspectorField(page, 'page-builder-media-open')).click();
    await expect(mediaField.getByTestId('page-builder-media-library')).toBeVisible();
    await mediaField.getByTestId('page-builder-media-file').setInputFiles({
      name: 'e2e-pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    const mediaResponse = await mediaUpload;
    expect(mediaResponse.ok()).toBe(true);
    const mediaPayload = await mediaResponse.json() as { data?: { id?: unknown } };
    uploadedMediaId = typeof mediaPayload.data?.id === 'string' ? mediaPayload.data.id : null;
    expect(uploadedMediaId).toMatch(DOCUMENT_ID_PATTERN);
    await selectAndEditCta(page, ctaHeading, ctaBody, ctaPrimaryLabel);
    await selectAndEditContact(page, contactHeading, contactAddress, contactEmail);
    await selectAndEditFeatures(page, featuresHeading, featureTitle, featureBody);
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-auto-motion').click();

    await expectBlockOrder(editorBlocks(page), PUBLISHED_BLOCK_ORDER);

    await saveDraft(page);
    const originalRevision = await currentDocumentRevision(page, documentId);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`document=${documentId}`));
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await expect(page.getByTestId('page-builder-hero-warning')).toBeHidden();
    await expectBlockOrder(editorBlocks(page), PUBLISHED_BLOCK_ORDER);

    await selectEditorBlock(page, 'hero');
    await expect(await revealInspectorField(page, 'page-builder-hero-title')).toHaveValue(heroTitle);
    await expect(await revealInspectorField(page, 'page-builder-hero-subtitle')).toHaveValue(heroSubtitle);
    await selectEditorBlock(page, 'features');
    await expect(await revealInspectorField(page, 'page-builder-features-heading')).toHaveValue(featuresHeading);
    await expect(await revealInspectorField(page, 'page-builder-features-item-0-title')).toHaveValue(featureTitle);
    await expect(await revealInspectorField(page, 'page-builder-features-item-0-body')).toHaveValue(featureBody);
    await selectEditorBlock(page, 'cta');
    await expect(await revealInspectorField(page, 'page-builder-cta-heading')).toHaveValue(ctaHeading);
    await expect(await revealInspectorField(page, 'page-builder-cta-body')).toHaveValue(ctaBody);
    await expect(await revealInspectorField(page, 'page-builder-cta-primary-label')).toHaveValue(ctaPrimaryLabel);
    await expect(await revealInspectorField(page, 'page-builder-cta-theme')).toHaveValue('dark');
    await selectEditorBlock(page, 'contact');
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
    await expect(previewPage.getByTestId('page-builder-site-header')).toContainText(`E2E Site ${runId}`);
    await expect(previewPage.getByTestId('page-builder-site-footer')).toContainText(`E2E Site ${runId}`);
    await expectBlockOrder(renderedBlocks(previewPage), PUBLISHED_BLOCK_ORDER);
    await expect(previewPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(featuresHeading, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(ctaHeading, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(contactHeading, { exact: true })).toBeVisible();
    await expect(previewPage.locator('form')).toHaveCount(0);
    await expect(previewPage.locator('script[src*="page-effects.iife.js"]')).toHaveCount(1);
    await expect(previewPage.locator('[data-block-type="hero"]')).toHaveAttribute('data-g7pb-motion', 'parallax-soft');
    await expect(previewPage.locator('[data-block-type="features"]')).toHaveAttribute('data-g7pb-motion', 'stagger');
    const previewSlider = previewPage.locator('[data-g7pb-slider]');
    await expect(previewSlider).toHaveAttribute('data-g7pb-slider-ready', 'true');
    await expect(previewSlider.locator('[data-g7pb-slider-status]')).toHaveText('1 / 2');
    await previewSlider.locator('[data-g7pb-slider-next]').click();
    await expect(previewSlider.locator('[data-g7pb-slider-status]')).toHaveText('2 / 2');
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
    await expect(publicPage.getByTestId('page-builder-site-header')).toContainText(`E2E Site ${runId}`);
    await expect(publicPage.getByTestId('page-builder-site-footer')).toContainText(`E2E Site ${runId}`);
    if ((publicPage.viewportSize()?.width ?? 1440) < 900) {
      const menuToggle = publicPage.locator('[data-g7pb-menu-toggle]');
      await menuToggle.click();
      await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(publicPage.locator('[data-g7pb-mobile-menu]')).toBeVisible();
      await publicPage.keyboard.press('Escape');
      await expect(publicPage.locator('[data-g7pb-mobile-menu]')).toBeHidden();
    }
    expect(await publicPage.evaluate(() => window.localStorage.getItem('auth_token'))).toBeNull();
    await expectBlockOrder(renderedBlocks(publicPage), PUBLISHED_BLOCK_ORDER);
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.locator('[data-block-type="hero"] img.g7pb-hero__image')).toHaveCount(1);
    await expect(publicPage.getByText(featuresHeading, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(ctaHeading, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(contactHeading, { exact: true })).toBeVisible();
    await expect(publicPage.locator('form')).toHaveCount(0);
    await expect(publicPage.locator('script[src*="page-effects.iife.js"]')).toHaveCount(1);
    await expect(publicPage.locator('[data-g7pb-slider]')).toHaveAttribute('data-g7pb-slider-ready', 'true');
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
    await selectEditorBlock(page, 'hero');
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
    await selectEditorBlock(page, 'hero');
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
    await page.getByTestId('page-builder-manager-metadata-shell-mode').uncheck();
    const shellModeSave = page.waitForResponse((response) => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname.endsWith(`/admin/documents/${documentId}`));
    await page.getByTestId('page-builder-manager-metadata-save').click();
    expect((await shellModeSave).ok()).toBe(true);
    await expect(page.getByTestId('page-builder-manager-metadata-dialog')).toHaveCount(0);
    await restoredDocumentRow.getByTestId('page-builder-manager-edit-link').click();
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await publish(page);
    await publicPage.reload();
    await expect(publicPage.getByTestId('page-builder-site-header')).toHaveCount(0);
    await expect(publicPage.getByTestId('page-builder-site-footer')).toHaveCount(0);

    await page.bringToFront();
    await page.getByTestId('page-builder-manager-link').click();
    await expect(page).toHaveURL(new RegExp(`${NATIVE_MANAGER_PATH}$`));
    await page.goto(MANAGER_PATH);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();
    const shellFreeDocumentRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await shellFreeDocumentRow.getByTestId('page-builder-manager-settings').click();
    await page.getByTestId('page-builder-manager-unpublish').click();
    await expect(page.getByTestId('page-builder-unpublish-dialog')).toBeVisible();
    await page.getByTestId('page-builder-unpublish-confirm').click();
    await expect(page.getByTestId('page-builder-unpublish-dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '취소' }).click();
    await expect(shellFreeDocumentRow).toContainText('초안');
    await expect(shellFreeDocumentRow).toContainText('생성');
    await expect(shellFreeDocumentRow).toContainText('수정');
    await expect(shellFreeDocumentRow.getByTestId('page-builder-manager-public-link')).toHaveCount(0);

    const unpublishedResponse = await publicPage.reload();
    expect(unpublishedResponse?.status()).toBe(404);

    await restoredDocumentRow.getByTestId('page-builder-manager-archive').click();
    await expect(page.getByTestId('page-builder-archive-dialog')).toBeVisible();
    await page.getByTestId('page-builder-archive-confirm').click();
    await expect(restoredDocumentRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-archived').click();
    const archivedRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(archivedRow).toContainText('보관됨');
    await archivedRow.getByTestId('page-builder-manager-restore-archived').click();
    await expect(archivedRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-active').click();
    const activeRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(activeRow).toContainText('초안');

    await activeRow.getByTestId('page-builder-manager-archive').click();
    await page.getByTestId('page-builder-archive-confirm').click();
    await expect(page.getByTestId('page-builder-archive-dialog')).toHaveCount(0);
    await expect(activeRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-archived').click();
    const purgeRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(purgeRow).toContainText('보관됨');
    await purgeRow.getByTestId('page-builder-manager-purge').click();
    await page.getByTestId('page-builder-purge-confirmation').fill(slug);
    await page.getByTestId('page-builder-purge-confirm').click();
    await expect(purgeRow).toHaveCount(0);

    if (uploadedMediaId) {
      const deleted = await page.evaluate(async (mediaId) => {
        const token = window.localStorage.getItem('auth_token');
        const response = await fetch(`/api/modules/jiwonpapa-page_builder/admin/media/${mediaId}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token ?? ''}` },
        });
        return response.ok;
      }, uploadedMediaId);
      expect(deleted).toBe(true);
      uploadedMediaId = null;
    }
  } catch (error) {
    lifecycleError = error;
  } finally {
    let siteShellRestoreError: unknown;
    try {
      if (originalSiteShell) await restoreSiteShell(authToken, originalSiteShell);
    } catch (error) {
      siteShellRestoreError = error;
    } finally {
      await previewPage?.close();
      await publicContext?.close();
      if (!page.isClosed()) {
        await page.close();
      }
      await cleanupE2eArtifacts(authToken, [slug, managedSlug], uploadedMediaId);
    }
    if (lifecycleError) throw lifecycleError;
    if (siteShellRestoreError) throw siteShellRestoreError;
  }
});
