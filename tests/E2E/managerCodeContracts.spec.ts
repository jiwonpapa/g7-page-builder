import { expect, request as playwrightRequest, test as base, type BrowserContext, type Route } from '@playwright/test';
import type { FormSubmissionResource } from '../../resources/js/api/resources';
import type { BlockPackResource, GitHubBlockPackCheckResource } from '../../resources/js/blocks/types';
import type { OfficialStoreCatalogResource, OfficialStoreProduct } from '../../resources/js/store/types';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const API = '/api/modules/jiwonpapa-page_builder/admin';
const MANAGER_PATH = '/modules/jiwonpapa-page_builder/admin';
const ROUTE = `**${API}/**`;
const FIRST_INQUIRY = '40000000-0000-4000-8000-000000000001';
const SECOND_INQUIRY = '40000000-0000-4000-8000-000000000002';
const FIXTURE_TIME = '2026-09-03T00:00:00Z';

// These API responses prove UI/request ownership only. No catalog, installed
// pack, customer inquiry, or document is created/changed by this fixture.
interface FixtureRequest { method: string; path: string; body: unknown; }
interface ManagerFixture {
  requests: FixtureRequest[];
  readRequested: Promise<void>;
  releaseRead: () => void;
}

function product(productId: string, kind: OfficialStoreProduct['product_type'], title: string): OfficialStoreProduct {
  return {
    product_id: productId, product_type: kind, product_version: '1.2.3',
    title: { ko: title }, description: { ko: '합성 요청 계약' }, category: 'code-fixture', tags: ['synthetic'],
    license: 'free', compatibility: { page_builder: '*', php: '*', g7: '*' },
    preview: { thumbnail_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E', screenshots: [] },
    artifact: { url: '/code-fixture/unused.zip', sha256: '0'.repeat(64), bytes: 0 },
    requirements: { blocks: [] }, compatible: true, compatibility_error: null, installed: false, installed_state: null,
  };
}

function pack(packId: string): BlockPackResource {
  return {
    pack_id: packId, pack_version: '1.2.3', kind: 'data', publisher: { id: 'audit', name: 'Synthetic fixture' },
    state: 'disabled', source: 'store', source_uri: null, archive_sha256: null, blocks: 0, presets: 0,
    runtime_active: false, editor_asset_url: null, style_asset_urls: [], usage: { documents: 0, revisions: 0 },
    installed_at: FIXTURE_TIME, updated_at: FIXTURE_TIME,
  };
}

function inquiry(id: string, subject: string, failed: boolean): FormSubmissionResource {
  return {
    id, page_slug: 'synthetic-inquiry', block_instance_id: '40000000-0000-4000-8000-000000000003',
    form_kind: 'inquiry', payload: { name: 'Fixture', message: '합성 문의 요청' },
    email: 'fixture@example.invalid', subject, status: 'unread', mail_status: failed ? 'failed' : 'sent',
    mail_error: failed ? 'Synthetic delivery failure' : null, mail_attempts: 1,
    created_at: FIXTURE_TIME, updated_at: FIXTURE_TIME,
  };
}

async function authenticate(context: BrowserContext): Promise<void> {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Manager code-contract administrator credentials are missing.');
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  try {
    const response = await api.post('/api/auth/admin/login', { data: { email, password } });
    expect(response.ok(), 'Manager code-contract administrator login failed').toBe(true);
    const payload = await response.json() as { success?: unknown; data?: { token?: unknown } };
    const token = payload.success === true && typeof payload.data?.token === 'string' ? payload.data.token : null;
    if (!token) throw new Error('Manager code-contract administrator login returned no token.');
    await context.addInitScript(({ origin, bearer }) => {
      if (window.location.origin === origin) window.localStorage.setItem('auth_token', bearer);
    }, { origin: new URL(BASE_URL).origin, bearer: token });
  } finally {
    await api.dispose();
  }
}

async function success(route: Route, data: unknown): Promise<void> {
  await route.fulfill({ json: { success: true, message: 'Synthetic response', data } });
}

async function failure(route: Route, message: string): Promise<void> {
  await route.fulfill({ status: 422, json: { success: false, message, code: 'G7PB_SYNTHETIC_REQUEST_REJECTED' } });
}

const test = base.extend<{ manager: ManagerFixture }>({
  manager: async ({ page, context }, use) => {
    const requests: FixtureRequest[] = [];
    const unexpected: string[] = [];
    const pageErrors: string[] = [];
    const onPageError = (error: Error): void => { pageErrors.push(error.message); };
    let releaseRead = (): void => {};
    let notifyRead = (): void => {};
    const readResponse = new Promise<void>((resolve) => { releaseRead = resolve; });
    const readRequested = new Promise<void>((resolve) => { notifyRead = resolve; });
    const packs = [pack('audit/code-pack-b'), pack('audit/untouched-pack')];
    const submissions = [inquiry(FIRST_INQUIRY, 'Synthetic inquiry A', true), inquiry(SECOND_INQUIRY, 'Synthetic inquiry B', false)];
    const catalog: OfficialStoreCatalogResource = {
      catalog_version: 'g7pb-store/v1', publisher: { id: 'jiwonpapa', name: 'Synthetic fixture' }, generated_at: FIXTURE_TIME,
      products: [product('audit/code-page-a', 'page_kit', 'Synthetic Page A'), product('audit/code-pack-b', 'block_pack', 'Synthetic Pack B')],
    };
    const routeHandler = async (route: Route): Promise<void> => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname.slice(API.length);
      const method = request.method();
      if (url.origin !== new URL(BASE_URL).origin || !request.headers().authorization?.startsWith('Bearer ')) {
        unexpected.push(`${method} ${path}: unexpected origin or missing authentication`);
        await route.abort('blockedbyclient');
        return;
      }
      // The document list remains the real read-only Manager request. All
      // mutations outside the explicit synthetic routes fail closed.
      if (path === '/documents' && method === 'GET') {
        await route.continue();
        return;
      }
      const body: unknown = request.postData() ? request.postDataJSON() : null;
      requests.push({ method, path: path + url.search, body });
      if (path === '/store/catalog' && method === 'GET') return success(route, catalog);
      if (path === '/block-packs' && method === 'GET') return success(route, { items: packs });
      if (path === '/store/block-packs/install' && method === 'POST') return failure(route, 'Synthetic store install rejected');
      if (path === '/store/page-kits/apply' && method === 'POST') return failure(route, 'Synthetic page apply rejected');
      if (path === '/block-packs/state' && method === 'PUT') {
        expect(body).toEqual({ pack_id: packs[0].pack_id, pack_version: packs[0].pack_version, state: 'enabled' });
        packs[0] = { ...packs[0], state: 'enabled' };
        return success(route, packs[0]);
      }
      if (path === '/block-packs/github/check' && method === 'POST') {
        const result: GitHubBlockPackCheckResource = {
          release: { repository: 'audit/code-release', tag: 'v1.2.3', version: '1.2.3', asset_name: 'fixture.zip',
            asset_bytes: 0, sha256: '0'.repeat(64), release_url: 'https://example.invalid/code-release', published_at: FIXTURE_TIME },
          installed_version: '1.2.3', update_available: false,
        };
        return success(route, result);
      }
      if (path === '/form-submissions' && method === 'GET' && url.searchParams.get('status') === 'all') {
        return success(route, { items: submissions });
      }
      if (path === `/form-submissions/${FIRST_INQUIRY}` && method === 'PATCH') {
        expect(body).toEqual({ status: 'read' });
        notifyRead();
        await readResponse;
        submissions[0] = { ...submissions[0], status: 'read' };
        return success(route, submissions[0]);
      }
      if (path === `/form-submissions/${SECOND_INQUIRY}` && method === 'PATCH') {
        expect(body).toEqual({ status: 'archived' });
        return failure(route, 'Synthetic inquiry B update rejected');
      }
      if (path === `/form-submissions/${FIRST_INQUIRY}/retry` && method === 'POST') {
        submissions[0] = { ...submissions[0], mail_status: 'sent', mail_error: null, mail_attempts: 2 };
        return success(route, submissions[0]);
      }
      unexpected.push(`${method} ${path}: outside synthetic request contract`);
      await route.abort('blockedbyclient');
    };
    await authenticate(context);
    await context.route(ROUTE, routeHandler);
    page.on('pageerror', onPageError);
    try {
      const response = await page.goto(MANAGER_PATH);
      expect(response?.ok()).toBe(true);
      const app = page.getByTestId('page-builder-manager-app');
      await expect(app).toBeVisible();
      await expect(app).toHaveAttribute('aria-busy', 'false');
      await use({ requests, readRequested, releaseRead });
    } finally {
      releaseRead();
      await context.unrouteAll({ behavior: 'wait' });
      page.off('pageerror', onPageError);
      expect(unexpected, 'A request escaped the synthetic Manager fixture').toEqual([]);
      expect(pageErrors, 'The Manager emitted an uncaught browser error').toEqual([]);
    }
  },
});

test('manages synthetic store and pack requests without crossing dialog owners', async ({ page, manager }) => {
  await page.getByTestId('page-builder-manager-page-kits').click();
  const store = page.getByTestId('page-builder-store-dialog');
  const productCards = store.getByTestId('page-builder-store-product');
  await expect(store).toBeVisible();
  await expect(productCards.getByRole('heading', { name: 'Synthetic Page A', exact: true })).toBeVisible();
  await expect(productCards.getByRole('heading', { name: 'Synthetic Pack B', exact: true })).toHaveCount(0);
  await store.getByTestId('page-builder-store-filter-all').click();
  await store.getByTestId('page-builder-store-search').fill('Synthetic Pack B');
  const packCard = productCards.filter({ has: page.getByRole('heading', { name: 'Synthetic Pack B', exact: true }) });
  await expect(packCard).toBeVisible();
  await expect(productCards.getByRole('heading', { name: 'Synthetic Page A', exact: true })).toHaveCount(0);
  await packCard.getByTestId('page-builder-store-install-block-pack').click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic store install rejected');
  await expect(packCard.getByTestId('page-builder-store-install-block-pack')).toBeEnabled();

  await store.getByTestId('page-builder-store-search').fill('');
  await store.getByTestId('page-builder-store-filter-page_kit').click();
  await store.getByTestId('page-builder-store-apply-page-kit').click();
  const pageKit = page.getByTestId('page-builder-store-page-kit-dialog');
  await expect(store).toHaveCount(0);
  await expect(pageKit.getByRole('heading', { name: 'Synthetic Page A', exact: true })).toBeVisible();
  await pageKit.getByTestId('page-builder-store-page-kit-title').fill('Synthetic requested title');
  await pageKit.getByTestId('page-builder-store-page-kit-slug').fill('synthetic-requested-slug');
  await pageKit.getByTestId('page-builder-store-page-kit-confirm').click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic page apply rejected');
  await expect(pageKit.getByTestId('page-builder-store-page-kit-confirm')).toBeEnabled();
  await expect(pageKit.getByTestId('page-builder-store-page-kit-title')).toHaveValue('Synthetic requested title');
  await expect(pageKit.getByTestId('page-builder-store-page-kit-slug')).toHaveValue('synthetic-requested-slug');
  await expect(page).toHaveURL(new URL(MANAGER_PATH, BASE_URL).toString());
  await pageKit.getByRole('button', { name: '이전', exact: true }).click();
  await expect(pageKit).toHaveCount(0);
  await expect(store).toBeVisible();
  await store.getByRole('button', { name: '닫기', exact: true }).click();

  await page.getByTestId('page-builder-manager-block-packs').click();
  const packsDialog = page.getByTestId('page-builder-block-packs-dialog');
  const selectedPack = packsDialog.getByTestId('page-builder-block-pack-row').filter({ hasText: 'audit/code-pack-b' });
  const untouchedPack = packsDialog.getByTestId('page-builder-block-pack-row').filter({ hasText: 'audit/untouched-pack' });
  await expect(selectedPack.locator('[data-state]')).toHaveAttribute('data-state', 'disabled');
  await selectedPack.getByRole('button', { name: '활성화', exact: true }).click();
  await expect(selectedPack.locator('[data-state]')).toHaveAttribute('data-state', 'enabled');
  await expect(untouchedPack.locator('[data-state]')).toHaveAttribute('data-state', 'disabled');
  await expect(selectedPack.getByRole('button', { name: '제거', exact: true })).toBeDisabled();
  await packsDialog.getByLabel('소유자', { exact: true }).fill('audit');
  await packsDialog.getByLabel('저장소', { exact: true }).fill('code-release');
  await packsDialog.getByLabel('Release ZIP asset', { exact: true }).fill('fixture.zip');
  await packsDialog.getByRole('button', { name: '최신 버전 확인', exact: true }).click();
  await expect(packsDialog.getByTestId('page-builder-github-pack-result')).toContainText('audit/code-release');
  await packsDialog.getByLabel('저장소', { exact: true }).fill('different-release');
  await expect(packsDialog.getByTestId('page-builder-github-pack-result')).toHaveCount(0);
  await expect(store).toHaveCount(0);
  expect(manager.requests.filter(({ method }) => method !== 'GET')).toEqual([
    { method: 'POST', path: '/store/block-packs/install', body: { product_id: 'audit/code-pack-b', product_version: '1.2.3' } },
    { method: 'POST', path: '/store/page-kits/apply', body: { product_id: 'audit/code-page-a', product_version: '1.2.3', title: 'Synthetic requested title', slug: 'synthetic-requested-slug' } },
    { method: 'PUT', path: '/block-packs/state', body: { pack_id: 'audit/code-pack-b', pack_version: '1.2.3', state: 'enabled' } },
    { method: 'POST', path: '/block-packs/github/check', body: { owner: 'audit', repository: 'code-release', asset_name: 'fixture.zip' } },
  ]);
});

test('keeps synthetic inquiry actions bound to their pending item', async ({ page, manager }) => {
  await page.getByTestId('page-builder-manager-inbox').click();
  const inbox = page.getByRole('dialog', { name: '문의함', exact: true });
  const first = inbox.locator('article').filter({ has: page.getByRole('heading', { name: 'Synthetic inquiry A', exact: true }) });
  const second = inbox.locator('article').filter({ has: page.getByRole('heading', { name: 'Synthetic inquiry B', exact: true }) });
  await expect(first).toHaveAttribute('data-state', 'unread');
  await expect(second).toHaveAttribute('data-state', 'unread');
  await first.getByRole('button', { name: '읽음 처리', exact: true }).click();
  await manager.readRequested;
  await expect(first.getByRole('button', { name: '읽음 처리', exact: true })).toBeDisabled();
  await expect(first.getByRole('button', { name: '메일 재시도', exact: true })).toBeDisabled();
  await expect(second.getByRole('button', { name: '보관', exact: true })).toBeEnabled();
  manager.releaseRead();
  await expect(first).toHaveAttribute('data-state', 'read');
  await expect(second).toHaveAttribute('data-state', 'unread');
  await second.getByRole('button', { name: '보관', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Synthetic inquiry B update rejected');
  await expect(second.getByRole('button', { name: '보관', exact: true })).toBeEnabled();
  await expect(first).toHaveAttribute('data-state', 'read');
  await expect(second).toHaveAttribute('data-state', 'unread');
  await first.getByRole('button', { name: '메일 재시도', exact: true }).click();
  await expect(first.locator('[data-mail]')).toHaveAttribute('data-mail', 'sent');
  await expect(first.getByRole('button', { name: '메일 재시도', exact: true })).toHaveCount(0);
  await expect(second).toHaveAttribute('data-state', 'unread');
  await inbox.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByTestId('page-builder-manager-inbox').click();
  await expect(first).toHaveAttribute('data-state', 'read');
  await expect(first.locator('[data-mail]')).toHaveAttribute('data-mail', 'sent');
  await expect(second).toHaveAttribute('data-state', 'unread');
  expect(manager.requests.filter(({ method }) => method !== 'GET')).toEqual([
    { method: 'PATCH', path: `/form-submissions/${FIRST_INQUIRY}`, body: { status: 'read' } },
    { method: 'PATCH', path: `/form-submissions/${SECOND_INQUIRY}`, body: { status: 'archived' } },
    { method: 'POST', path: `/form-submissions/${FIRST_INQUIRY}/retry`, body: null },
  ]);
});
