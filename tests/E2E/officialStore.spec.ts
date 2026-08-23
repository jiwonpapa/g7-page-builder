import { expect, request as playwrightRequest, test, type BrowserContext } from '@playwright/test';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const MANAGER_PATH = '/modules/jiwonpapa-page_builder/admin';

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Official Store E2E administrator credentials are missing.');

  return { email, password };
}

async function authenticate(context: BrowserContext): Promise<string> {
  const api = await playwrightRequest.newContext({ baseURL: BASE_URL, ignoreHTTPSErrors: true });
  try {
    const response = await api.post('/api/auth/admin/login', { data: credentials() });
    expect(response.ok()).toBe(true);
    const payload = await response.json() as { success?: unknown; data?: { token?: unknown } };
    const token = payload.success === true && typeof payload.data?.token === 'string' ? payload.data.token : null;
    if (!token) throw new Error('Official Store E2E login returned no token.');
    await context.addInitScript(({ origin, bearer }) => {
      if (window.location.origin === origin) window.localStorage.setItem('auth_token', bearer);
    }, { origin: new URL(BASE_URL).origin, bearer: token });

    return token;
  } finally {
    await api.dispose();
  }
}

async function removeDraft(token: string, documentId: string, slug: string): Promise<void> {
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  try {
    const documentResponse = await api.get(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`);
    if (!documentResponse.ok()) return;
    const resource = await documentResponse.json() as { data?: { lock_version?: unknown; archived_at?: unknown } };
    let lock = typeof resource.data?.lock_version === 'number' ? resource.data.lock_version : null;
    if (lock === null) return;
    if (typeof resource.data?.archived_at !== 'string') {
      const archived = await api.post(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/archive`, {
        data: { expected_lock_version: lock },
      });
      if (!archived.ok()) return;
      const payload = await archived.json() as { data?: { lock_version?: unknown } };
      lock = typeof payload.data?.lock_version === 'number' ? payload.data.lock_version : null;
    }
    if (lock !== null) {
      await api.delete(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`, {
        data: { expected_lock_version: lock, confirmation_slug: slug },
      });
    }
  } finally {
    await api.dispose();
  }
}

async function removeOfficialTestPack(token: string): Promise<void> {
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const identity = { pack_id: 'jiwonpapa/marketing-presets', pack_version: '1.0.0' };
  try {
    const response = await api.get('/api/modules/jiwonpapa-page_builder/admin/block-packs');
    if (!response.ok()) return;
    const payload = await response.json() as { data?: { items?: Array<{ pack_id?: unknown; pack_version?: unknown; state?: unknown }> } };
    const pack = payload.data?.items?.find((item) => item.pack_id === identity.pack_id
      && item.pack_version === identity.pack_version);
    if (!pack) return;
    if (pack.state === 'enabled') {
      const disabled = await api.put('/api/modules/jiwonpapa-page_builder/admin/block-packs/state', {
        data: { ...identity, state: 'disabled' },
      });
      if (!disabled.ok()) return;
    }
    await api.delete('/api/modules/jiwonpapa-page_builder/admin/block-packs', { data: identity });
  } finally {
    await api.dispose();
  }
}

async function removeStaleStoreDrafts(token: string): Promise<void> {
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  try {
    const response = await api.get('/api/modules/jiwonpapa-page_builder/admin/documents?status=active&per_page=100');
    if (!response.ok()) return;
    const payload = await response.json() as {
      data?: { items?: Array<{ document?: { document_id?: unknown; slug?: unknown } }> };
    };
    for (const item of payload.data?.items ?? []) {
      const id = item.document?.document_id;
      const slug = item.document?.slug;
      if (typeof id === 'string' && typeof slug === 'string' && slug.startsWith('store-e2e-')) {
        await removeDraft(token, id, slug);
      }
    }
  } finally {
    await api.dispose();
  }
}

test('official free store previews and applies a Page Kit as a separate draft', async ({ page, context }, testInfo) => {
  const token = await authenticate(context);
  const slug = `store-e2e-${testInfo.project.name}-${Date.now()}`.toLowerCase();
  let documentId: string | null = null;

  try {
    await removeStaleStoreDrafts(token);
    await removeOfficialTestPack(token);
    await page.goto(MANAGER_PATH);
    await page.getByTestId('page-builder-manager-store').click();
    const dialog = page.getByTestId('page-builder-store-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('제3자 업로드와 판매자 기능은 없습니다.');
    await expect(page.getByTestId('page-builder-store-product')).toHaveCount(6);
    await page.getByTestId('page-builder-store-filter-block_pack').click();
    const pack = page.getByTestId('page-builder-store-product');
    await expect(pack).toHaveCount(1);
    const installResponse = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/store/block-packs/install'));
    await pack.getByTestId('page-builder-store-install-block-pack').click();
    expect((await installResponse).status()).toBe(201);
    await expect(pack.getByTestId('page-builder-store-install-block-pack')).toHaveText('설치됨');
    await page.getByTestId('page-builder-store-filter-page_kit').click();
    const kits = page.getByTestId('page-builder-store-product');
    await expect(kits).toHaveCount(5);
    await expect(kits).toContainText([
      '회사 소개 랜딩',
      '전문 서비스 상담 랜딩',
      '로컬 비즈니스 방문 안내',
      '컨퍼런스·행사 랜딩',
      '에디토리얼·커뮤니티 홈',
    ]);
    const previewImages = kits.locator('img');
    await expect(previewImages).toHaveCount(5);
    await expect(kits.locator('.g7pb-store-card__screenshots')).toHaveCount(5);
    for (const image of await previewImages.all()) {
      await expect(image).toHaveJSProperty('complete', true);
      expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    }
    const kit = kits.filter({ hasText: '회사 소개 랜딩' });
    await expect(kit).toHaveCount(1);
    await expect(kit).toContainText('실제 데모 보기');
    await expect(kit).toContainText('PC·태블릿·모바일 실제 화면 3장');
    const demoUrl = await kit.locator('.g7pb-store-card__preview').getAttribute('href');
    expect(demoUrl).not.toBeNull();
    const demo = await page.request.get(demoUrl!);
    expect(demo.status()).toBe(200);
    expect(await demo.text()).toContain('page-builder-store-demo-root');
    expect(demo.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await kit.getByTestId('page-builder-store-apply-page-kit').click();

    const applyDialog = page.getByTestId('page-builder-store-page-kit-dialog');
    await expect(applyDialog).toContainText('기존 페이지는 바꾸지 않습니다.');
    await expect(applyDialog.getByTestId('page-builder-store-page-kit-readiness'))
      .toContainText('발행 전에 교체할 항목');
    await applyDialog.getByTestId('page-builder-store-page-kit-title').fill('공식 마켓 회사 소개');
    await applyDialog.getByTestId('page-builder-store-page-kit-slug').fill(slug);
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/store/page-kits/apply'));
    await applyDialog.getByTestId('page-builder-store-page-kit-confirm').click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    await expect(page).toHaveURL(/\/modules\/jiwonpapa-page_builder\/admin\/editor\?document=[0-9a-f-]+$/);
    documentId = new URL(page.url()).searchParams.get('document');
    expect(documentId).not.toBeNull();
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    try {
      const created = await api.get(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`);
      expect(created.status()).toBe(200);
      const payload = await created.json() as {
        data?: {
          document?: {
            shell_mode?: unknown;
            blocks?: Array<{ props?: { image?: { src?: unknown } } }>;
          };
          status?: unknown;
        };
      };
      expect(payload.data?.document?.shell_mode).toBe('template');
      expect(payload.data?.document?.blocks ?? []).toHaveLength(6);
      expect(payload.data?.document?.blocks?.[0]?.props?.image?.src).toMatch(/\/storage\/g7-page-builder\//);
      expect(payload.data?.status).toBe('draft');

      const exportQuery = new URLSearchParams({
        kit_id: 'jiwonpapa/e2e-export',
        kit_version: '1.0.0',
        title: 'E2E export',
        description: 'Official Store Page Kit export regression fixture',
      });
      const exported = await api.get(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/page-kit/export?${exportQuery}`);
      expect(exported.status()).toBe(200);
      expect(exported.headers()['content-type']).toContain('application/zip');
      expect(exported.headers()['x-g7pb-sha256']).toMatch(/^[a-f0-9]{64}$/);
      expect((await exported.body()).subarray(0, 2).toString()).toBe('PK');
    } finally {
      await api.dispose();
    }
  } finally {
    if (documentId) await removeDraft(token, documentId, slug);
    await removeOfficialTestPack(token);
  }
});
