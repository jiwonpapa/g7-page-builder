import { expect, request as playwrightRequest, test, type BrowserContext, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
type SitePartKind = 'header' | 'footer';

function sitePartPath(kind: SitePartKind): string {
  return `/modules/jiwonpapa-page_builder/admin/site-parts/${kind}`;
}

function visibleTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`);
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

async function verifySetWorkspaceTools(page: Page): Promise<void> {
  const editor = page.getByTestId('page-builder-site-part-set-editor');
  const puck = editor.locator('.Puck');
  const viewportHeight = page.viewportSize()!.height;
  for (const tab of ['블록', '구조', '세트', '블록', '구조', '세트']) {
    await editor.getByText(tab, { exact: true }).click();
    await expect.poll(async () => {
      const box = await puck.boundingBox();
      return box ? Math.round(box.y + box.height) : 0;
    }).toBe(viewportHeight);
    expect((await puck.boundingBox())!.height).toBeGreaterThan(500);
  }
  for (const name of ['왼쪽 패널 열기·닫기', '오른쪽 설정 열기·닫기']) {
    const button = editor.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
  }
  for (const side of ['left', 'right']) {
    const sidebar = editor.locator(`[class*="Sidebar--${side}_"]`);
    const before = (await sidebar.boundingBox())!.width;
    const handle = editor.locator(`[class*="ResizeHandle--${side}_"]`);
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 80);
    await page.mouse.down();
    await page.mouse.move(box.x + (side === 'left' ? 45 : -45), box.y + 80, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeGreaterThan(before + 30);
  }
  const persona = editor.getByRole('group', { name: '접속 상태 미리보기' });
  await persona.getByRole('button', { name: '관리자', exact: true }).click();
  await expect(persona.getByRole('button', { name: '관리자', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await editor.getByText('블록', { exact: true }).click();
  for (const component of ['HeaderNavigation', 'FooterSimple', 'FooterColumns', 'HeaderSystemControls']) {
    await expect(editor.getByTestId(`drawer-item:${component}`)).toHaveClass(/DrawerItem--disabled/);
  }
  const canvas = page.frameLocator('iframe').first();
  const controls = canvas.locator('.g7pb-site-header [data-g7pb-system-controls]');
  const account = controls.getByRole('button', { name: '계정 메뉴', exact: true });
  for (let repeat = 0; repeat < 3; repeat += 1) {
    const header = await canvas.locator('.g7pb-site-header').boundingBox();
    if (!header) throw new Error('Header selection geometry is missing.');
    await page.mouse.click(header.x + 4, header.y + 4);
    await account.click();
    const actionBar = canvas.locator('.g7pb-site-part-action-bar');
    await expect(actionBar).toContainText('G7 시스템 기능');
    await expect(actionBar.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  }
  await canvas.locator('.g7pb-site-part-action-bar').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(controls).toHaveCount(0);
  await expect(canvas.locator('[data-g7pb-preview-mobile-menu] [data-g7pb-system-admin]')).toHaveCount(0);
  await expect(editor.getByTestId('drawer-item:HeaderSystemControls')).not.toHaveClass(/DrawerItem--disabled/);
  await editor.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect(controls).toHaveCount(1);
  await expect(editor.getByTestId('drawer-item:HeaderSystemControls')).toHaveClass(/DrawerItem--disabled/);
  await editor.getByRole('button', { name: '다시 실행', exact: true }).click();
  await expect(controls).toHaveCount(0);
  await editor.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect(controls).toHaveCount(1);
  await editor.getByTestId('page-builder-site-part-set-save').click();
  await expect(editor.locator('.g7pb-status')).toHaveAttribute('data-state', 'saved');
  if (!await editor.getByTestId('page-builder-site-part-set-presets').isVisible()) {
    await editor.getByText('세트', { exact: true }).click();
  }
  await editor.getByTestId('page-builder-site-part-set-presets').getByRole('button', { name: /미니멀/ }).click();
  await expect(canvas.locator('.g7pb-site-footer--columns')).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(canvas.locator('.g7pb-site-footer--columns')).toHaveCount(1);
  await editor.getByRole('button', { name: '다시 실행', exact: true }).click();
  await expect(canvas.locator('.g7pb-site-footer--columns')).toHaveCount(0);
  await editor.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect(canvas.locator('.g7pb-site-footer--columns')).toHaveCount(1);
  await page.screenshot({ path: 'output/playwright/site-part-workspace-ux.png', fullPage: false });
}

test('edits and publishes the Header as an independent responsive Puck Site Part', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Site Part interaction is covered once; page lifecycle owns all three viewports.');
  const token = await authenticate(context);
  const api = await adminApi(token);
  const changedBrand = `Site Part E2E ${Date.now()}`;
  const mobileMenuLabel = `E2E 메뉴 ${Date.now()}`;
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
    seededNavigationBlock.props.mobile_menu = true;
    seededNavigationBlock.props.mobile_menu_style = 'drawer-right';
    delete seededNavigationBlock.props.responsive;
    const seededNavigation = Array.isArray(seededNavigationBlock.props.navigation)
      ? seededNavigationBlock.props.navigation as Array<Record<string, unknown>>
      : [];
    if (seededNavigation.length === 0) seededNavigation.push({ label: '서비스', url: '/pages/services' });
    seededNavigation[0] = { ...seededNavigation[0], label: mobileMenuLabel, children: [{ label: childLabel, url: '/pages/features' }] };
    seededNavigationBlock.props.navigation = seededNavigation;
    const seedResponse = await api.put('/api/modules/jiwonpapa-page_builder/admin/site-parts/header/draft', {
      data: { locale, title: original.title, document: seededDocument, expected_lock_version: original.lock_version },
    });
    expect(seedResponse.ok()).toBe(true);
    await page.reload();
    await expect(page.getByTestId('page-builder-site-part-editor')).toBeVisible();
    await expect(page.getByText('Header 편집', { exact: true })).toBeVisible();
    await expect(page.getByText('Header · 내비게이션', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('기기 버튼을 바꾸면 우측의 기기별 표시 설정도 함께 바뀝니다.')).toBeVisible();
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
    await page.getByTitle('Switch to 모바일 viewport').click();
    const responsiveField = visibleTestId(page, 'page-builder-site-part-responsive');
    await expect(responsiveField).toHaveAttribute('data-viewport', 'mobile');
    await expect(visibleTestId(page, 'page-builder-responsive-menu-style')).toHaveValue('drawer-right');
    const editorMenuToggle = canvas.locator('[data-g7pb-preview-menu-toggle]');
    const editorMobileMenu = canvas.locator('[data-g7pb-preview-mobile-menu]');
    await expect(editorMenuToggle).toBeVisible();
    await expect(editorMenuToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(editorMobileMenu).toBeHidden();
    await editorMenuToggle.click();
    await expect(editorMenuToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(editorMobileMenu).toBeVisible();
    await expect(editorMobileMenu).toHaveClass(/g7pb-mobile-menu--drawer-right/);
    await visibleTestId(page, 'page-builder-responsive-menu-style').selectOption('drawer-left');
    await expect(editorMobileMenu).toHaveAttribute('data-g7pb-mobile-menu-style', 'drawer-left');
    const editorFrameBox = await page.locator('iframe').first().boundingBox();
    expect(editorFrameBox).not.toBeNull();
    await expect.poll(async () => {
      const drawerBox = await editorMobileMenu.boundingBox();
      return drawerBox ? Math.abs(drawerBox.x - editorFrameBox!.x) : Number.POSITIVE_INFINITY;
    }).toBeLessThanOrEqual(1);
    await visibleTestId(page, 'page-builder-responsive-menu-style').selectOption('sheet-bottom');
    await expect(editorMobileMenu).toHaveAttribute('data-g7pb-mobile-menu-style', 'sheet-bottom');
    await expect(editorMobileMenu).toBeVisible();
    await expect(editorMobileMenu).toContainText(mobileMenuLabel);
    const editorDrawerBox = await editorMobileMenu.boundingBox();
    const editorBackdrop = canvas.locator('[data-g7pb-preview-menu-backdrop]');
    const editorBackdropBox = await editorBackdrop.boundingBox();
    expect(editorDrawerBox).not.toBeNull();
    expect(editorBackdropBox).not.toBeNull();
    expect(Math.abs(editorDrawerBox!.x - editorFrameBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs((editorDrawerBox!.y + editorDrawerBox!.height) - (editorFrameBox!.y + editorFrameBox!.height))).toBeLessThanOrEqual(2);
    expect(editorDrawerBox!.width).toBeGreaterThanOrEqual(editorFrameBox!.width - 2);
    expect(editorDrawerBox!.height).toBeLessThanOrEqual(editorFrameBox!.height * 0.8);
    expect(editorBackdropBox!.width).toBeGreaterThanOrEqual(editorFrameBox!.width - 2);
    expect(editorBackdropBox!.height).toBeGreaterThanOrEqual(editorFrameBox!.height - 2);
    const editorClose = canvas.locator('[data-g7pb-preview-menu-close]');
    expect(await editorClose.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) === element;
    })).toBe(true);
    await page.screenshot({ path: 'output/playwright/site-part-header-mobile-sheet-editor.png', fullPage: true });
    await canvas.locator('[data-g7pb-preview-menu-close]').click();
    await expect(editorMenuToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(editorMobileMenu).toBeHidden();
    await page.getByTitle('Switch to 태블릿 viewport').click();
    await expect(responsiveField).toHaveAttribute('data-viewport', 'tablet');
    await visibleTestId(page, 'page-builder-responsive-density').selectOption('spacious');
    await visibleTestId(page, 'page-builder-responsive-alignment').selectOption('center');
    await expect(canvas.locator('.g7pb-site-header')).toHaveAttribute('data-g7pb-tablet-density', 'spacious');
    await visibleTestId(page, 'page-builder-responsive-reset').click();
    await expect(visibleTestId(page, 'page-builder-responsive-density')).toHaveValue('');
    await expect(canvas.locator('.g7pb-site-header')).toHaveAttribute('data-g7pb-tablet-density', 'comfortable');
    await page.getByTitle('Switch to PC viewport').click();
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
    expect(published.document.blocks.find((block) => block.type === 'site.header.navigation-01')?.props.mobile_menu_style).toBe('drawer-right');
    expect(published.document.blocks.find((block) => block.type === 'site.header.navigation-01')?.props.responsive).toEqual({
      mobile: { density: 'compact', alignment: 'spread', show_cta: false, mobile_menu_style: 'sheet-bottom' },
    });
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
      const publicMobileMenu = page.locator('[data-g7pb-mobile-menu]');
      await expect(publicMobileMenu).toHaveAttribute('data-g7pb-mobile-menu-style', 'sheet-bottom');
      await expect(publicMobileMenu).toHaveAttribute('data-g7pb-menu-style', 'sheet-bottom');
      await expect(page.locator('[data-g7pb-menu-backdrop]')).toBeVisible();
      const drawerBox = await publicMobileMenu.boundingBox();
      expect(drawerBox?.x ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      expect(drawerBox?.width ?? 0).toBeGreaterThanOrEqual(page.viewportSize()!.width - 2);
      expect(Math.abs((drawerBox?.y ?? 0) + (drawerBox?.height ?? 0) - page.viewportSize()!.height)).toBeLessThanOrEqual(2);
      const submenuToggle = page.locator('[data-g7pb-submenu-toggle]').first();
      await submenuToggle.click();
      await expect(submenuToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-g7pb-mobile-submenu]').getByText(childLabel, { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(publicMobileMenu).toBeHidden();
      await expect(page.locator('[data-g7pb-menu-toggle]')).toBeFocused();
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
  let original: SitePartResource | null = null;
  try {
    await page.goto(sitePartPath('footer'));
    const locale = await page.getByTestId('page-builder-site-part-editor-root').getAttribute('data-locale') ?? 'ko';
    const resource = await readOrBootstrap(api, 'footer', locale);
    original = resource;
    await expect(page.getByTestId('page-builder-site-part-editor')).toHaveAttribute('data-kind', 'footer');
    await expect(page.getByText('Footer 편집', { exact: true })).toBeVisible();
    await expect(page.getByTestId('page-builder-site-part-presets').getByRole('button')).toHaveCount(3);
    const simpleCard = page.locator('[data-testid="drawer-item:FooterSimple"]:visible');
    const columnsCard = page.locator('[data-testid="drawer-item:FooterColumns"]:visible');
    await expect(simpleCard).toHaveCount(1);
    await expect(columnsCard).toHaveCount(1);
    await expect(simpleCard.locator('.g7pb-site-part-thumb')).toBeVisible();
    await expect(columnsCard.locator('.g7pb-site-part-thumb')).toBeVisible();
    const canvas = page.frameLocator('iframe').first();
    const footer = canvas.locator('.g7pb-site-footer').first();
    const footerNavigation = footer.locator('nav, .g7pb-site-footer__columns > section').first();
    await expect(footer).toBeVisible();
    await page.getByTitle('Switch to 모바일 viewport').click();
    await expect(visibleTestId(page, 'page-builder-site-part-responsive')).toHaveAttribute('data-viewport', 'mobile');
    await visibleTestId(page, 'page-builder-responsive-alignment').selectOption('center');
    await visibleTestId(page, 'page-builder-responsive-navigation').selectOption('false');
    await visibleTestId(page, 'page-builder-responsive-columns').selectOption('1');
    await expect(footer).toHaveAttribute('data-g7pb-mobile-alignment', 'center');
    await expect(footer).toHaveAttribute('data-g7pb-mobile-navigation', 'hide');
    await expect(footerNavigation).toBeHidden();
    await visibleTestId(page, 'page-builder-responsive-reset').click();
    await expect(visibleTestId(page, 'page-builder-responsive-alignment')).toHaveValue('');
    await expect(footerNavigation).toBeVisible();
    expect(resource.document.kind).toBe('footer');
  } finally {
    if (original) await restoreAndPublish(api, 'footer', original);
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
    const setEditor = page.getByTestId('page-builder-site-part-set-editor');
    await expect(setEditor).toBeVisible();
    await expect(page.getByTestId('page-builder-site-part-editor')).toHaveCount(0);
    await expect(setEditor.getByText('세트', { exact: true })).toBeVisible();
    await expect(setEditor.getByText('블록', { exact: true })).toBeVisible();
    await expect(setEditor.getByText('구조', { exact: true })).toBeVisible();
    await expect(page.getByTestId('page-builder-site-part-set-presets').getByRole('button')).toHaveCount(3);

    await page.getByTestId('page-builder-site-part-set-presets').getByRole('button', { name: /비즈니스/ }).click();
    await expect(page.getByRole('alert')).toContainText('Header와 Footer 프리셋을 함께 적용했습니다.');
    const saveResponse = page.waitForResponse((response) => response.url().includes(`/site-part-sets/${target?.id}/draft`) && response.request().method() === 'PUT');
    await page.getByTestId('page-builder-site-part-set-save').click();
    const savedResponse = await saveResponse;
    expect(savedResponse.ok(), await savedResponse.text()).toBe(true);

    await verifySetWorkspaceTools(page);

    await setEditor.getByRole('button', { name: '모바일', exact: true }).click();
    await expect(setEditor.getByText('모바일·태블릿은 확인 전용 · 편집은 PC에서 지원')).toBeVisible();
    await expect(setEditor.locator('.g7pb-site-part-set-layout__preview-only:visible').getByText('확인 전용 화면입니다.')).toBeVisible();
    await setEditor.getByRole('button', { name: 'PC', exact: true }).click();

    const publishResponse = page.waitForResponse((response) => response.url().includes(`/site-part-sets/${target?.id}/publish`) && response.request().method() === 'POST');
    await page.getByTestId('page-builder-site-part-set-publish').click();
    const publishedResponse = await publishResponse;
    expect(publishedResponse.ok(), await publishedResponse.text()).toBe(true);
    await expect(page.getByRole('alert')).toContainText('Header와 Footer를 한 세트로 발행했습니다.');

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
