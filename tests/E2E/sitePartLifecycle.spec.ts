import { expect, request as playwrightRequest, test, type BrowserContext, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
type SitePartKind = 'header' | 'footer';

function sitePartPath(kind: SitePartKind): string {
  return `/modules/jiwonpapa-page_builder/admin/site-parts/${kind}`;
}

interface SitePartResource {
  set_id?: string | null;
  title: string;
  document: {
    schema_version: 'g7-page-builder/site-part/v1';
    site_part_id: string;
    kind: SitePartKind;
    locale: string;
    tokens: Record<string, string | number | boolean | null>;
    blocks: Array<{ instance_id: string; type: string; block_version: number; props: Record<string, unknown>; slots: Record<string, unknown> }>;
  };
  lock_version: number;
  revision: number;
  active_revision: number | null;
  status: 'draft' | 'published_with_changes' | 'published';
}

interface SitePartSetResource {
  id: string;
  title: string;
  locale: string;
  is_active: boolean;
  is_ready: boolean;
  header: { active_revision: number | null; status: SitePartResource['status'] };
  footer: { active_revision: number | null; status: SitePartResource['status'] };
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Site Part E2E administrator credentials are not configured.');
  return { email, password };
}

async function authenticate(context: BrowserContext): Promise<string> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  try {
    const response = await api.post('/api/auth/admin/login', { data: credentials() });
    expect(response.ok()).toBe(true);
    const payload = await response.json() as { success?: boolean; data?: { token?: unknown } };
    if (payload.success !== true || typeof payload.data?.token !== 'string') throw new Error('Admin login returned no token.');
    const token = payload.data.token;
    await context.addInitScript(({ origin, authToken }) => {
      if (window.location.origin === origin) localStorage.setItem('auth_token', authToken);
    }, { origin: new URL(BASE_URL).origin, authToken: token });
    return token;
  } finally {
    await api.dispose();
  }
}

async function adminApi(token: string): Promise<APIRequestContext> {
  return playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
}

async function readOrBootstrap(api: APIRequestContext, kind: SitePartKind, locale: string): Promise<SitePartResource> {
  let response = await api.get(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}?locale=${encodeURIComponent(locale)}`);
  if (response.status() === 404) {
    response = await api.post(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}/bootstrap`, { data: { locale } });
  }
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { success?: boolean; data?: SitePartResource };
  if (payload.success !== true || !payload.data) throw new Error(`${kind} Site Part API returned no resource.`);
  return payload.data;
}

async function listSitePartSets(api: APIRequestContext, locale: string): Promise<SitePartSetResource[]> {
  const response = await api.get(`/api/modules/jiwonpapa-page_builder/admin/site-part-sets?locale=${encodeURIComponent(locale)}`);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { items?: SitePartSetResource[] } };
  return payload.data?.items ?? [];
}

async function ensureSetPartPublished(api: APIRequestContext, set: SitePartSetResource, kind: SitePartKind): Promise<void> {
  const query = new URLSearchParams({ locale: set.locale, set_id: set.id });
  const response = await api.get(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}?${query.toString()}`);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: SitePartResource };
  const resource = payload.data;
  if (!resource) throw new Error(`${kind} Site Part set resource is missing.`);
  if (resource.active_revision !== null) return;
  const publish = await api.post(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}/publish`, {
    data: { locale: set.locale, set_id: set.id, expected_lock_version: resource.lock_version },
  });
  expect(publish.ok()).toBe(true);
}

async function restoreAndPublish(api: APIRequestContext, kind: SitePartKind, original: SitePartResource): Promise<void> {
  const current = await readOrBootstrap(api, kind, original.document.locale);
  const save = await api.put(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}/draft`, {
    data: { locale: original.document.locale, title: original.title, document: original.document, expected_lock_version: current.lock_version },
  });
  expect(save.ok()).toBe(true);
  const savedPayload = await save.json() as { data?: SitePartResource };
  if (!savedPayload.data) throw new Error('Site Part restore returned no resource.');
  const publish = await api.post(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}/publish`, {
    data: { locale: original.document.locale, expected_lock_version: savedPayload.data.lock_version },
  });
  expect(publish.ok()).toBe(true);
}

async function dragLibraryBlockBefore(page: Page, component: string, target: Locator): Promise<void> {
  const source = page.locator(`[data-testid="drawer-item:${component}"]:visible`).first();
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error(`Could not resolve Site Part drag geometry for ${component}.`);

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2, { steps: 4 });
  await page.mouse.move(targetBox.x + 24, targetBox.y + 4, { steps: 24 });
  await page.waitForTimeout(180);
  await page.mouse.up();
}

async function globalPublicPageUrl(api: APIRequestContext, locale: string): Promise<string | null> {
  const response = await api.get('/api/modules/jiwonpapa-page_builder/admin/documents?page=1&per_page=100&status=active');
  if (!response.ok()) return null;
  const payload = await response.json() as {
    success?: boolean;
    data?: { items?: Array<{ public_url?: unknown; document?: { locale?: unknown; shell_mode?: unknown } }> };
  };
  const item = payload.data?.items?.find((candidate) =>
    typeof candidate.public_url === 'string'
      && candidate.document?.locale === locale
      && candidate.document?.shell_mode === 'builder');
  return typeof item?.public_url === 'string' ? item.public_url : null;
}

test('edits and publishes the Header as an independent responsive Puck Site Part', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Site Part interaction is covered once; page lifecycle owns all three viewports.');
  const token = await authenticate(context);
  const api = await adminApi(token);
  const changedBrand = `Site Part E2E ${Date.now()}`;
  const childLabel = `하위 기능 ${Date.now()}`;
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  let original: SitePartResource | null = null;

  try {
    await page.goto(sitePartPath('header'));
    const locale = await page.getByTestId('page-builder-site-part-editor-root').getAttribute('data-locale') ?? 'ko';
    original = await readOrBootstrap(api, 'header', locale);
    const originalBrand = String(original.document.blocks.find((block) => block.type === 'site.header.navigation-01')?.props.brand_name ?? '사이트 이름');
    const seededDocument = structuredClone(original.document);
    const seededNavigationBlock = seededDocument.blocks.find((block) => block.type === 'site.header.navigation-01');
    if (!seededNavigationBlock) throw new Error('Header navigation block is required for the Site Part E2E seed.');
    const seededNavigation = Array.isArray(seededNavigationBlock.props.navigation)
      ? seededNavigationBlock.props.navigation as Array<Record<string, unknown>>
      : [];
    if (seededNavigation.length === 0) seededNavigation.push({ label: '서비스', url: '/pages/services' });
    seededNavigation[0] = { ...seededNavigation[0], children: [{ label: childLabel, url: '/pages/features' }] };
    seededNavigationBlock.props.navigation = seededNavigation;
    const seedResponse = await api.put('/api/modules/jiwonpapa-page_builder/admin/site-parts/header/draft', {
      data: { locale, title: original.title, document: seededDocument, expected_lock_version: original.lock_version },
    });
    expect(seedResponse.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId('page-builder-site-part-editor')).toBeVisible();
    await expect(page.getByText('Header 편집', { exact: true })).toBeVisible();
    await expect(page.getByText('Header · 내비게이션', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('상단 기기 버튼으로 반응형 화면을 확인하세요.')).toBeVisible();
    await expect(page.getByTestId('page-builder-site-part-presets')).toContainText('빠른 시작 프리셋');
    await expect(page.getByTestId('page-builder-site-part-presets').getByRole('button')).toHaveCount(3);
    const headerNavigationCard = page.locator('[data-testid="drawer-item:HeaderNavigation"]:visible');
    const announcementCard = page.locator('[data-testid="drawer-item:Announcement"]:visible');
    await expect(headerNavigationCard).toHaveCount(1);
    await expect(announcementCard).toHaveCount(1);
    await expect(headerNavigationCard.locator('.g7pb-site-part-thumb')).toBeVisible();
    await expect(announcementCard.locator('.g7pb-site-part-thumb')).toBeVisible();
    await expect(page.getByTitle('Switch to 모바일 viewport')).toBeVisible();
    await expect(page.getByTitle('Switch to 태블릿 viewport')).toBeVisible();
    await expect(page.getByTitle('Switch to PC viewport')).toBeVisible();
    const mediaFileInputs = page.getByTestId('page-builder-media-file');
    const mediaFileInputCount = await mediaFileInputs.count();
    expect(mediaFileInputCount).toBeGreaterThan(0);
    for (let index = 0; index < mediaFileInputCount; index += 1) {
      await expect(mediaFileInputs.nth(index)).toBeHidden();
    }
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
    await page.screenshot({ path: 'output/playwright/site-part-header-editor.png', fullPage: true });

    const canvas = page.frameLocator('iframe').first();
    expect(await canvas.locator('body').innerText()).toContain(originalBrand);
    await dragLibraryBlockBefore(page, 'Announcement', canvas.locator('.g7pb-site-header').first());
    await expect(canvas.locator('.g7pb-site-announcement')).toBeVisible();
    await expect(canvas.getByText(originalBrand, { exact: true }).first()).toBeVisible();
    await canvas.getByText(originalBrand, { exact: true }).first().click();
    const brandField = page.getByLabel('사이트 이름', { exact: true }).last();
    await expect(brandField).toBeVisible();
    await brandField.fill(changedBrand);
    await expect(canvas.getByText(changedBrand, { exact: true }).first()).toBeVisible();

    const saveResponse = page.waitForResponse((response) => response.url().includes('/site-parts/header/draft') && response.request().method() === 'PUT');
    await page.locator('.g7pb-command-bar').getByRole('button', { name: '저장', exact: true }).click();
    expect((await saveResponse).ok()).toBe(true);
    const publishResponse = page.waitForResponse((response) => response.url().includes('/site-parts/header/publish') && response.request().method() === 'POST');
    await page.getByTestId('page-builder-site-part-publish').click();
    expect((await publishResponse).ok()).toBe(true);
    await expect(page.getByRole('alert')).toContainText('Header 발행을 완료했습니다.');

    const published = await readOrBootstrap(api, 'header', locale);
    expect(published.status).toBe('published');
    expect(published.document.blocks.find((block) => block.type === 'site.header.navigation-01')?.props.brand_name).toBe(changedBrand);
    const publishedNavigation = published.document.blocks.find((block) => block.type === 'site.header.navigation-01')?.props.navigation as Array<Record<string, unknown>>;
    expect(publishedNavigation[0]?.children).toEqual([{ label: childLabel, url: '/pages/features' }]);
    expect(published.document.blocks.some((block) => block.type === 'site.header.announcement-01')).toBe(true);

    const publicUrl = await globalPublicPageUrl(api, locale);
    if (publicUrl) {
      await page.goto(publicUrl);
      await expect(page.getByTestId('page-builder-site-header')).toContainText(changedBrand);
      await expect(page.locator('.g7pb-site-subnav').getByText(childLabel, { exact: true })).toBeAttached();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await page.locator('[data-g7pb-menu-toggle]').click();
      const submenuToggle = page.locator('[data-g7pb-submenu-toggle]').first();
      await submenuToggle.click();
      await expect(submenuToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-g7pb-mobile-submenu]').getByText(childLabel, { exact: true })).toBeVisible();
    }
  } finally {
    if (original) await restoreAndPublish(api, 'header', original);
    await api.dispose();
  }
});

test('opens the Footer as a separate visual Site Part with preview cards', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Site Part interaction is covered once; page lifecycle owns all three viewports.');
  const token = await authenticate(context);
  const api = await adminApi(token);
  try {
    await page.goto(sitePartPath('footer'));
    const locale = await page.getByTestId('page-builder-site-part-editor-root').getAttribute('data-locale') ?? 'ko';
    const resource = await readOrBootstrap(api, 'footer', locale);
    await expect(page.getByTestId('page-builder-site-part-editor')).toHaveAttribute('data-kind', 'footer');
    await expect(page.getByText('Footer 편집', { exact: true })).toBeVisible();
    await expect(page.getByTestId('page-builder-site-part-presets').getByRole('button')).toHaveCount(3);
    const simpleCard = page.locator('[data-testid="drawer-item:FooterSimple"]:visible');
    const columnsCard = page.locator('[data-testid="drawer-item:FooterColumns"]:visible');
    await expect(simpleCard).toHaveCount(1);
    await expect(columnsCard).toHaveCount(1);
    await expect(simpleCard.locator('.g7pb-site-part-thumb')).toBeVisible();
    await expect(columnsCard.locator('.g7pb-site-part-thumb')).toBeVisible();
    await expect(page.frameLocator('iframe').first().locator('.g7pb-site-footer')).toBeVisible();
    expect(resource.document.kind).toBe('footer');
  } finally {
    await api.dispose();
  }
});

test('manages multiple Header and Footer pairs from one top-level workspace', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The paired Site Part workspace is edited on PC.');
  const token = await authenticate(context);
  const api = await adminApi(token);
  let originalActive: SitePartSetResource | null = null;
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto('/modules/jiwonpapa-page_builder/admin/site-parts');
    const workspaceRoot = page.getByTestId('page-builder-site-part-editor-root');
    const locale = await workspaceRoot.getAttribute('data-locale') ?? 'ko';
    await expect(page.getByTestId('page-builder-site-part-set').first()).toBeVisible();
    let sets = await listSitePartSets(api, locale);
    originalActive = sets.find((set) => set.is_active) ?? null;
    if (!originalActive) throw new Error('The default Header/Footer set must be active.');
    await ensureSetPartPublished(api, originalActive, 'header');
    await ensureSetPartPublished(api, originalActive, 'footer');
    sets = await listSitePartSets(api, locale);
    originalActive = sets.find((set) => set.id === originalActive?.id) ?? originalActive;

    let target = sets.find((set) => !set.is_active) ?? null;
    if (!target) {
      const create = await api.post('/api/modules/jiwonpapa-page_builder/admin/site-part-sets', {
        data: { locale, title: 'E2E 통합 세트' },
      });
      expect(create.ok()).toBe(true);
      const payload = await create.json() as { data?: SitePartSetResource };
      target = payload.data ?? null;
    }
    if (!target) throw new Error('A secondary Header/Footer set could not be prepared.');

    await page.reload();
    await expect(page.getByTestId('page-builder-site-part-workspace')).toBeVisible();
    await expect(page.getByRole('heading', { name: '헤더·푸터', exact: true })).toBeVisible();
    const targetButton = page.getByTestId('page-builder-site-part-set').filter({ hasText: target.title });
    await targetButton.click();
    await expect(page.getByTestId('page-builder-site-part-editor')).toHaveCount(2);
    const headerEditor = page.locator('[data-testid="page-builder-site-part-editor"][data-kind="header"]');
    const footerEditor = page.locator('[data-testid="page-builder-site-part-editor"][data-kind="footer"]');
    await expect(headerEditor).toBeVisible();
    await expect(footerEditor).toBeVisible();

    if (!target.is_ready) {
      const headerPublish = page.getByTestId('page-builder-site-part-editor').filter({ hasText: 'Header 편집' }).getByTestId('page-builder-site-part-publish');
      await expect(headerPublish).toBeEnabled();
      const headerResponse = page.waitForResponse((response) => response.url().includes('/site-parts/header/publish') && response.request().method() === 'POST');
      await headerPublish.click();
      expect((await headerResponse).ok()).toBe(true);
      const footerPublish = page.getByTestId('page-builder-site-part-editor').filter({ hasText: 'Footer 편집' }).getByTestId('page-builder-site-part-publish');
      await expect(footerPublish).toBeEnabled();
      const footerResponse = page.waitForResponse((response) => response.url().includes('/site-parts/footer/publish') && response.request().method() === 'POST');
      await footerPublish.click();
      expect((await footerResponse).ok()).toBe(true);
    }

    const activate = page.getByTestId('page-builder-site-part-set-activate');
    await expect(activate).toBeEnabled();
    const activateResponse = page.waitForResponse((response) => response.url().includes(`/site-part-sets/${target?.id}/activate`) && response.request().method() === 'POST');
    await activate.click();
    expect((await activateResponse).ok()).toBe(true);
    await expect(targetButton).toContainText('사용 중');
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  } finally {
    if (originalActive) {
      const restore = await api.post(`/api/modules/jiwonpapa-page_builder/admin/site-part-sets/${originalActive.id}/activate`, {
        data: { locale: originalActive.locale },
      });
      expect(restore.ok()).toBe(true);
    }
    await api.dispose();
  }
});
