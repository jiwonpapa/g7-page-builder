import { expect, request as playwrightRequest, test, type APIRequestContext, type BrowserContext } from '@playwright/test';

import { SitePartSetFixture, fixtureLocale, gotoOwnedSiteShell } from './support/sitePartSetFixture';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';

// Set the browser's supported Accept-Language path; no runtime global is patched.
test.use({ locale: 'ko-KR' });

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Global Site Shell E2E administrator credentials are not configured.');
  return { email, password };
}

async function authenticatedApi(): Promise<APIRequestContext> {
  const login = await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  const response = await login.post('/api/auth/admin/login', { data: credentials() });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { token?: unknown } };
  await login.dispose();
  if (typeof payload.data?.token !== 'string') throw new Error('Admin login returned no token.');

  return playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${payload.data.token}` },
  });
}

test('applies one fail-safe Page Builder Header and Footer across representative G7 user routes', async ({ page, browser }) => {
  const locale = await fixtureLocale(page);
  const browserUserAgent = await page.evaluate(() => navigator.userAgent);
  if (process.env.G7PB_SITE_SHELL_READ_ONLY === '1') throw new Error('This owned-fixture scenario requires the scoped Local runner.');
  const api = await authenticatedApi();
  const fixture = new SitePartSetFixture(api, locale);
  let englishContext: BrowserContext | undefined;
  let englishFixture: SitePartSetFixture | undefined;
  try {
    await fixture.start();

    const shell = await api.get(`/api/modules/jiwonpapa-page_builder/public/site-shell?locale=${encodeURIComponent(locale)}`);
    expect(shell.ok()).toBe(true);
    const shellPayload = await shell.json() as { data?: { shell?: { enabled?: unknown; locale?: string } } };
    expect(shellPayload.data?.shell?.enabled).toBe(true);
    expect(shellPayload.data?.shell?.locale).toBe(locale);

    {
      for (let requestNumber = 1; requestNumber <= 121; requestNumber += 1) {
        const repeated = await api.get(`/api/modules/jiwonpapa-page_builder/public/site-shell?locale=${encodeURIComponent(locale)}`);
        expect(repeated.status(), `public Site Shell request ${requestNumber}`).toBe(200);
      }
    }

    for (const route of ['/', '/login', '/register', '/boards', '/boards/popular', '/shop/products', '/search?q=page-builder', '/404']) {
      const response = await gotoOwnedSiteShell(page, route, locale);
      if (route === '/404') expect([200, 404], route).toContain(response?.status());
      else expect(response?.ok(), route).toBe(true);
      await expect(page.getByTestId('page-builder-site-header'), route).toBeVisible();
      await expect(page.getByTestId('page-builder-site-footer'), route).toBeVisible();
      const desktopControls = page.locator('.g7pb-system-controls[data-g7pb-system-controls]');
      const mobileControls = page.locator('[data-g7pb-mobile-menu][data-g7pb-system-controls]');
      await expect(desktopControls, route).toHaveCount(1);
      await expect(desktopControls, route).toBeVisible();
      await expect(mobileControls, route).toHaveCount(1);
      await expect(mobileControls, route).toBeHidden();
      await expect(page.locator('[data-g7pb-system-controls]:visible'), route).toHaveCount(1);
      await expect(desktopControls.locator('form[action="/search"]'), route).toHaveCount(1);
      await expect(mobileControls.locator('form[action="/search"]'), route).toHaveCount(0);
      expect(await page.locator('html').evaluate((html) => html.scrollWidth <= html.clientWidth + 1), route).toBe(true);
    }

    await gotoOwnedSiteShell(page, '/boards', locale);
    await expect(page.locator('[data-g7pb-system-cart]')).toHaveAttribute('href', /\/cart$/u);
    await page.locator('.g7pb-system-controls [data-g7pb-shell-toggle="account"]').click();
    await expect(page.locator('.g7pb-system-controls [data-g7pb-system-guest] a[href="/login"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.g7pb-system-controls [data-g7pb-shell-toggle="search"]').click();
    const search = page.locator('[data-g7pb-system-controls] input[name="q"]');
    await search.fill('통합 셸');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=(?:%ED%86%B5%ED%95%A9\+%EC%85%B8|%ED%86%B5%ED%95%A9%20%EC%85%B8)/u);
    // One English request catches the actual locale-binding regression without
    // adding a catalog sweep or translating any existing document content.
    fixture.restore();
    englishContext = await browser.newContext({
      locale: 'en-US', baseURL: BASE_URL, ignoreHTTPSErrors: true,
      userAgent: browserUserAgent,
    });
    englishFixture = new SitePartSetFixture(api, 'en');
    await englishFixture.start();
    const englishPage = await englishContext.newPage();
    expect((await gotoOwnedSiteShell(englishPage, '/', 'en'))?.ok()).toBe(true);
    await expect(englishPage.getByTestId('page-builder-site-header')).toBeVisible();
    await expect(englishPage.getByTestId('page-builder-site-footer')).toBeVisible();
    await expect(englishPage.locator('.g7pb-system-controls')).toHaveAttribute('data-g7pb-shell-locale', 'en');
  } finally {
    try { englishFixture?.restore(); fixture.restore(); } finally {
      await englishContext?.close();
      await api.dispose();
    }
  }
});
