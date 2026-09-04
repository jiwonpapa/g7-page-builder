import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Locator, type Page } from '@playwright/test';

import { gotoOwnedSiteShell, SitePartSetFixture } from './support/sitePartSetFixture';

const compiled = JSON.parse(execFileSync('php', ['scripts/render-site-shell-quality-fixture.php'], { encoding: 'utf8' })) as { header: string; footer: string };
const css = readFileSync('dist/css/page-builder-public.css', 'utf8');
const js = readFileSync('dist/js/page-effects.iife.js', 'utf8');
const settings = { general: { site_name: '검증 사이트', site_description: '실제 사이트 정보가 표시되는 공통 영역' }, social: { youtube: 'https://youtube.com/@example', github: 'https://github.com/example' } };
const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';


const portable = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) < 900;
async function openAccount(page: Page, header: Locator): Promise<Locator> {
  await header.locator(portable(page) ? '[data-g7pb-menu-toggle]' : '[data-g7pb-shell-toggle="account"]').click();
  return header.locator(portable(page) ? '[data-g7pb-mobile-menu]' : '[data-g7pb-shell-panel="account"]');
}

// Synthetic API contracts are deliberately separate from the real G7 login test below.
for (const persona of ['guest', 'member', 'admin', 'unavailable'] as const) {
  test(`compiled shell contract · ${persona} · pointer/keyboard/responsive`, async ({ page }, testInfo) => {
    const member = persona === 'member' || persona === 'admin';
    const config = { settings, commerceAvailable: persona !== 'unavailable', shopBase: '/shop', availableCurrencies: [{ code: 'KRW', symbol: '₩' }, { code: 'USD', symbol: '$' }], defaultCurrency: 'KRW' };
    await page.route('**/__shell-quality.css', (route) => route.fulfill({ contentType: 'text/css', body: css }));
    await page.route('**/__shell-quality.js', (route) => route.fulfill({ contentType: 'application/javascript', body: js }));
    await page.route('**/api/auth/user', (route) => route.fulfill({ status: persona === 'unavailable' ? 503 : member ? 200 : 401, json: { data: member ? { uuid: 'test-member', name: '검증 회원', is_admin: persona === 'admin' } : {} } }));
    await page.route('**/api/public/locales/active', (route) => route.fulfill({ json: { data: { locales: ['ko', 'en'], locale_names: { ko: '한국어', en: 'English' } } } }));
    await page.route('**/api/modules/sirsoft-ecommerce/cart/count', (route) => route.fulfill({ json: { data: { count: 2 } } }));
    await page.route('**/api/user/notifications/unread-count', (route) => route.fulfill({ json: { data: { unread_count: 3 } } }));
    await page.route('**/api/user/notifications?*', (route) => route.fulfill({ json: { data: [{ id: '11111111-1111-4111-8111-111111111111', subject: '새로운 소식', url: '/mypage/notifications', created_at: '2026-08-30' }] } }));
    await page.route('**/api/user/notifications/read-all', (route) => route.fulfill({ json: { success: true } }));
    await page.route('**/__shell-quality', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html class="g7pb-standalone-viewer" lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Site Shell quality</title><link rel="stylesheet" href="/__shell-quality.css"><script defer src="/__shell-quality.js"></script></head><body><div hidden data-g7pb-runtime-config='${JSON.stringify(config)}'></div>${compiled.header}<main class="g7pb-page g7pb-document-theme" style="min-height:400px"><section class="g7pb-block g7pb-container-width--standard" data-testid="page-builder-shell-content"><div><h1>사이트 공통 영역 품질 검증</h1><p>이 화면은 실제 컴파일러와 배포 번들을 사용합니다.</p></div></section></main>${compiled.footer}</body></html>` }));
    await page.goto('/__shell-quality');
    const header = page.getByTestId('page-builder-site-header');
    await expect(header.locator('[data-g7pb-shell-mounted]')).toHaveCount(1);
    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
      const headerBox = rect('[data-testid="page-builder-site-header"]');
      const headerInner = rect('.g7pb-site-header__inner');
      const content = rect('[data-testid="page-builder-shell-content"] > div');
      const footerBox = rect('[data-testid="page-builder-site-footer"]');
      const footerInner = rect('.g7pb-site-footer__top');
      if (!headerBox || !headerInner || !content || !footerBox || !footerInner) throw new Error('Shell geometry fixture is incomplete.');
      return { viewport: document.documentElement.clientWidth,
        header: { left: headerBox.left, right: headerBox.right }, footer: { left: footerBox.left, right: footerBox.right },
        edges: [headerInner.left, headerInner.right, content.left, content.right, footerInner.left, footerInner.right] };
    });
    expect(Math.max(...geometry.edges.filter((_, index) => index % 2 === 0)) - Math.min(...geometry.edges.filter((_, index) => index % 2 === 0))).toBeLessThanOrEqual(1);
    expect(Math.max(...geometry.edges.filter((_, index) => index % 2 === 1)) - Math.min(...geometry.edges.filter((_, index) => index % 2 === 1))).toBeLessThanOrEqual(1);
    expect(geometry.header).toEqual({ left: 0, right: geometry.viewport });
    expect(geometry.footer).toEqual({ left: 0, right: geometry.viewport });
    const account = await openAccount(page, header);
    await expect(account).toBeVisible();
    if (member) {
      await expect(account.getByText('검증 회원', { exact: true })).toBeVisible();
      await expect(account.getByRole('link', { name: '마이페이지', exact: true })).toBeVisible();
      await expect(account.getByRole('link', { name: '로그아웃', exact: true })).toBeVisible();
      await expect(account.getByRole('link', { name: '로그인', exact: true })).toBeHidden();
    } else await expect(account.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
    if (persona === 'admin') await expect(account.getByRole('link', { name: '관리자', exact: true })).toHaveAttribute('href', '/admin');
    else await expect(account.locator('[data-g7pb-system-admin]')).toBeHidden();
    expect(await page.locator('html').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    // Mobile modals occupy the viewport, not the locked page behind them.
    // Chromium full-page capture can change mobile visualViewport.scale to 4;
    // capture the actual viewport and assert its scale before pointer checks.
    await page.screenshot({ path: testInfo.outputPath(`shell-${persona}-${testInfo.project.name}.png`), fullPage: !portable(page), animations: 'disabled' });
    await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    const accessibility = await new AxeBuilder({ page }).include('[data-testid="page-builder-site-header"]').include('[data-testid="page-builder-site-footer"]').analyze();
    expect(accessibility.violations).toEqual([]);
    await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
    await page.keyboard.press('Escape');
    await expect(header.locator(portable(page) ? '[data-g7pb-menu-toggle]' : '[data-g7pb-shell-toggle="account"]')).toBeFocused();
    await header.getByRole('button', { name: '검색 열기', exact: true }).click();
    const search = header.getByRole('searchbox', { name: '통합 검색' });
    await expect(search).toBeVisible(); await expect(search).toBeFocused();
    await search.click(); await search.fill('키보드와 터치 검색');
    // Reproduce G7 HtmlContent replacing the compiled host on a state update.
    await header.locator('[data-g7pb-shell-options]').evaluate((host) => {
      const replacement = host.cloneNode(false) as HTMLElement;
      delete replacement.dataset.g7pbShellMounted; delete replacement.dataset.g7pbDisclosuresReady;
      host.replaceWith(replacement);
    });
    await expect(search).toBeVisible(); await expect(search).toHaveValue('키보드와 터치 검색');
    await expect(search).toBeFocused();
    const rect = await search.boundingBox(); expect(rect?.height).toBeGreaterThanOrEqual(44);
    await page.keyboard.press('Escape');
    await header.locator(portable(page) ? '[data-g7pb-menu-toggle]' : '[data-g7pb-shell-toggle="preferences"]').click();
    const preferences = header.locator(portable(page) ? '[data-g7pb-mobile-menu]' : '[data-g7pb-shell-panel="preferences"]');
    await expect(preferences.getByLabel('언어', { exact: true })).toBeVisible();
    if (persona !== 'unavailable') await expect(preferences.getByLabel('통화', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    if (member && !portable(page)) {
      await header.getByRole('button', { name: '알림', exact: true }).click();
      await expect(header.getByText('새로운 소식', { exact: true })).toBeVisible();
      await header.getByRole('button', { name: '모두 읽음', exact: true }).click();
      await expect(header.locator('.g7pb-system-controls [data-g7pb-system-notification-count]')).toBeHidden();
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('[data-g7pb-site-info] .g7pb-site-brand')).toHaveText('검증 사이트');
    await expect(page.locator('[data-g7pb-site-socials] a')).toHaveCount(2);
    if (persona === 'unavailable') await expect(header.locator('[data-g7pb-system-cart]')).toBeHidden();
  });
}

test('real G7 authentication · admin route · native logout · guest transition', async ({ page, context, request }, testInfo) => {
  test.setTimeout(90_000);
  const email = process.env.G7PB_ADMIN_EMAIL; const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Site Shell release gate requires the configured test administrator.');
  const login = await request.post('/api/auth/admin/login', { data: { email, password } });
  expect(login.ok()).toBe(true);
  const payload = await login.json() as { data?: { token?: string } };
  if (!payload.data?.token) throw new Error('G7 returned no authentication token.');
  await context.addInitScript((token) => { if (!sessionStorage.getItem('shell-auth-seeded')) { localStorage.setItem('auth_token', token); sessionStorage.setItem('shell-auth-seeded', 'true'); } }, payload.data.token);
  const sitePartApi = await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${payload.data.token}` } });
  const siteParts = new SitePartSetFixture(sitePartApi, 'ko');
  try {
    await siteParts.start(page);
    await gotoOwnedSiteShell(page, '/', 'ko');
    const header = page.getByTestId('page-builder-site-header');
    await expect(header).toBeVisible();
    await expect(header.locator('.g7pb-system-controls [data-g7pb-system-admin]')).toHaveAttribute('href', '/admin');
    await expect(header.locator('.g7pb-system-controls [data-g7pb-system-admin]')).not.toHaveAttribute('hidden');
    if (testInfo.project.name === 'desktop' && await header.locator('.g7pb-site-nav[aria-hidden="true"]').count()) {
    // G7 replaces HtmlContent while auth/site state hydrates. Read both rectangles
    // atomically from one connected header, and still enforce the same 1px tolerance.
    await expect.poll(() => header.evaluate((element) => {
      const inner = element.querySelector('.g7pb-site-header__inner')?.getBoundingClientRect();
      const actions = element.querySelector('.g7pb-site-header__actions')?.getBoundingClientRect();
      if (!element.isConnected || !inner?.width || !actions?.width) return Number.POSITIVE_INFINITY;
      return Math.abs(inner.right - actions.right);
    })).toBeLessThanOrEqual(1);
    }
    await openAccount(page, header);
    const admin = header.getByRole('link', { name: '관리자', exact: true });
    await expect(admin).toBeVisible(); await expect(admin).toHaveAttribute('href', '/admin');
    await page.screenshot({ path: testInfo.outputPath(`real-admin-${testInfo.project.name}.png`), fullPage: false });
    await admin.click();
    await expect(page).toHaveURL(/\/admin(?:\/|$)/u);
    if (testInfo.project.name === 'desktop') {
    await page.goto('/modules/jiwonpapa-page_builder/admin/site-parts/header');
    await page.getByRole('group', { name: '접속 상태 미리보기', exact: true }).getByRole('button', { name: '관리자', exact: true }).click();
    const personaBounds = await page.locator('.g7pb-site-part-persona').boundingBox();
    expect(personaBounds?.height).toBeLessThan(64);
    const preview = page.frameLocator('iframe').first();
    await preview.getByRole('button', { name: '계정 메뉴', exact: true }).click();
    const previewAdmin = preview.getByRole('link', { name: '관리자', exact: true });
    await expect(previewAdmin).toBeVisible();
    // A visible DOM node alone can still be clipped or reset by Puck selection.
    // Real pointer interaction must work without navigating or changing content.
    await previewAdmin.click();
    await expect(page).toHaveURL(/\/admin\/site-parts\/header$/u);
    await expect(preview.getByRole('button', { name: '계정 메뉴', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(previewAdmin).toBeVisible();
    await expect(page.locator('.g7pb-status[data-state="dirty"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('editor-admin-persona.png'), animations: 'disabled' });
    await page.getByTitle('Switch to 모바일 viewport').click();
    const mobileToggle = preview.locator('[data-g7pb-preview-menu-toggle]');
    await mobileToggle.click();
    const mobileMenu = preview.locator('[data-g7pb-preview-mobile-menu]');
    await expect(mobileMenu).toHaveAttribute('role', 'dialog');
    await expect(mobileMenu.getByRole('link', { name: '관리자', exact: true })).toBeVisible();
    await expect(mobileMenu.getByLabel('언어', { exact: true })).toBeVisible();
    await mobileMenu.getByRole('link', { name: '관리자', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/site-parts\/header$/u);
    await expect(mobileMenu).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('editor-mobile-menu.png'), animations: 'disabled' });
    await mobileMenu.locator('[data-g7pb-preview-menu-close]').click();
    await expect(mobileMenu).toBeHidden();
    await expect(page.locator('.g7pb-status[data-state="dirty"]')).toHaveCount(0);
    }
    await gotoOwnedSiteShell(page, '/', 'ko');
    await expect(header.locator('.g7pb-system-controls [data-g7pb-system-admin]')).toHaveAttribute('href', '/admin');
    await expect(header.locator('.g7pb-system-controls [data-g7pb-system-admin]')).not.toHaveAttribute('hidden');
    await openAccount(page, header);
    const nativeLogout = page.waitForResponse((response) => /\/api\/(?:admin\/)?auth\/logout$/u.test(new URL(response.url()).pathname) && response.request().method() === 'POST');
    await header.getByRole('link', { name: '로그아웃', exact: true }).click();
    expect((await nativeLogout).ok()).toBe(true);
    await page.waitForURL(/\/login(?:\?|$)/u);
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();
    await gotoOwnedSiteShell(page, '/', 'ko');
    await openAccount(page, header);
    await expect(header.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
    await expect(header.locator('.g7pb-system-controls [data-g7pb-system-admin]')).toBeHidden();
  } finally {
    await page.goto('about:blank');
    siteParts.restore();
    await sitePartApi.dispose();
  }
});

test('real standalone builder viewer · authenticated account · API logout', async ({ page, context, request }, testInfo) => {
  const email = process.env.G7PB_ADMIN_EMAIL; const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Standalone gate requires the configured test administrator.');
  const login = await request.post('/api/auth/admin/login', { data: { email, password } });
  expect(login.ok()).toBe(true);
  const token = (await login.json()).data.token as string;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const base = '/api/modules/jiwonpapa-page_builder/admin';
  const slug = `g7pb-shell-quality-${testInfo.project.name}-${Date.now()}`;
  const sitePartApi = await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true, extraHTTPHeaders: headers });
  const siteParts = new SitePartSetFixture(sitePartApi, 'ko');
  let id: string | null = null;
  try {
    await siteParts.start(page);
    const create = await request.post(`${base}/documents`, { headers, data: { title: 'Site Shell 검증용', slug, locale: 'ko', shell_mode: 'builder' } });
    expect(create.ok()).toBe(true);
    const resource = (await create.json()).data;
    id = resource.document.document_id as string;
    const prepare = await request.post(`${base}/documents/${id}/publications/prepare`, { headers, data: { expected_lock_version: resource.lock_version } });
    expect(prepare.ok()).toBe(true);
    const commit = await request.post(`${base}/publications/${(await prepare.json()).data.publication_token}/commit`, { headers, data: {} });
    expect(commit.ok()).toBe(true);
    await context.addInitScript((value) => { if (!sessionStorage.getItem('shell-auth-seeded')) { localStorage.setItem('auth_token', value); sessionStorage.setItem('shell-auth-seeded', 'true'); } }, token);
    await gotoOwnedSiteShell(page, `/pages/${slug}`, 'ko');
    await expect(page.locator('[data-g7pb-runtime-config]')).toHaveCount(1);
    const header = page.getByTestId('page-builder-site-header');
    await openAccount(page, header);
    await expect(header.getByRole('link', { name: '관리자', exact: true })).toBeVisible();
    await expect(page.getByTestId('page-builder-site-footer')).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`builder-admin-${testInfo.project.name}.png`), animations: 'disabled' });
    const loggedOut = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/logout' && response.request().method() === 'POST');
    await header.getByRole('link', { name: '로그아웃', exact: true }).click();
    const logoutResult = await loggedOut;
    expect(logoutResult.status(), 'The public G7 logout endpoint must accept the current account.').toBe(200);
    await expect(page).toHaveURL(/\/$/u);
    await openAccount(page, header);
    await expect(header.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
  } finally {
    // Only this test-created document is archived; never touch an existing page.
    if (id) {
      const cleanupLogin = await request.post('/api/auth/admin/login', { data: { email, password } });
      expect(cleanupLogin.ok()).toBe(true);
      const cleanupHeaders = { Authorization: `Bearer ${(await cleanupLogin.json()).data.token as string}` };
      const current = await request.get(`${base}/documents/${id}`, { headers: cleanupHeaders });
      expect(current.ok()).toBe(true);
      const archive = await request.post(`${base}/documents/${id}/archive`, { headers: cleanupHeaders, data: { expected_lock_version: (await current.json()).data.lock_version } });
      expect(archive.ok()).toBe(true);
    }
    await page.goto('about:blank');
    siteParts.restore();
    await sitePartApi.dispose();
  }
});
