import { expect, request as playwrightRequest, test, type APIRequestContext } from '@playwright/test';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const READ_ONLY = process.env.G7PB_SITE_SHELL_READ_ONLY === '1';
type SitePartKind = 'header' | 'footer';

interface SitePartResource {
  title: string;
  document: Record<string, unknown>;
  lock_version: number;
  status: 'draft' | 'published_with_changes' | 'published';
}

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

async function readOrBootstrap(api: APIRequestContext, kind: SitePartKind, locale: string): Promise<SitePartResource> {
  const path = `/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}`;
  let response = await api.get(`${path}?locale=${encodeURIComponent(locale)}`);
  if (response.status() === 404) response = await api.post(`${path}/bootstrap`, { data: { locale } });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: SitePartResource };
  if (!payload.data) throw new Error(`${kind} Site Part API returned no resource.`);
  return payload.data;
}

async function publishCurrent(api: APIRequestContext, kind: SitePartKind, locale: string, resource: SitePartResource): Promise<SitePartResource> {
  if (resource.status === 'published') return resource;
  const response = await api.post(`/api/modules/jiwonpapa-page_builder/admin/site-parts/${kind}/publish`, {
    data: { locale, expected_lock_version: resource.lock_version },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: SitePartResource };
  if (!payload.data) throw new Error(`${kind} Site Part publish returned no resource.`);
  return payload.data;
}

test('applies one fail-safe Page Builder Header and Footer across representative G7 user routes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The route matrix is structural and runs once on desktop.');
  const initialResponse = await page.goto('/');
  expect(initialResponse?.ok()).toBe(true);
  const locale = ((await page.locator('html').getAttribute('lang')) || 'ko').split('-')[0];
  const api = READ_ONLY
    ? await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true, extraHTTPHeaders: { Accept: 'application/json' } })
    : await authenticatedApi();
  try {
    if (!READ_ONLY) {
      await publishCurrent(api, 'header', locale, await readOrBootstrap(api, 'header', locale));
      await publishCurrent(api, 'footer', locale, await readOrBootstrap(api, 'footer', locale));
    }

    const shell = await api.get(`/api/modules/jiwonpapa-page_builder/public/site-shell?locale=${encodeURIComponent(locale)}`);
    expect(shell.ok()).toBe(true);
    const shellPayload = await shell.json() as { data?: { shell?: { enabled?: unknown } } };
    expect(shellPayload.data?.shell?.enabled).toBe(true);

    if (!READ_ONLY) {
      for (let requestNumber = 1; requestNumber <= 121; requestNumber += 1) {
        const repeated = await api.get(`/api/modules/jiwonpapa-page_builder/public/site-shell?locale=${encodeURIComponent(locale)}`);
        expect(repeated.status(), `public Site Shell request ${requestNumber}`).toBe(200);
      }
    }

    for (const route of ['/', '/login', '/register', '/boards', '/boards/popular', '/shop/products', '/search?q=page-builder', '/404']) {
      const response = await page.goto(route);
      if (route === '/404') expect([200, 404], route).toContain(response?.status());
      else expect(response?.ok(), route).toBe(true);
      await expect(page.getByTestId('page-builder-site-header'), route).toBeVisible();
      await expect(page.getByTestId('page-builder-site-footer'), route).toBeVisible();
      await expect(page.locator('[data-g7pb-system-controls]'), route).toHaveCount(1);
      await expect(page.locator('[data-g7pb-system-controls] form[action="/search"]'), route).toHaveCount(1);
      expect(await page.locator('html').evaluate((html) => html.scrollWidth <= html.clientWidth + 1), route).toBe(true);
    }

    await page.goto('/boards');
    await expect(page.locator('[data-g7pb-system-cart]')).toHaveAttribute('href', /\/cart$/u);
    await expect(page.locator('[data-g7pb-system-guest]').first()).toHaveAttribute('href', '/login');
    const search = page.locator('[data-g7pb-system-controls] input[name="q"]');
    await search.fill('통합 셸');
    await search.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=(?:%ED%86%B5%ED%95%A9\+%EC%85%B8|%ED%86%B5%ED%95%A9%20%EC%85%B8)/u);
  } finally {
    await api.dispose();
  }
});
