import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test } from '@playwright/test';

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

function adminCredentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Page Builder E2E administrator credentials are not configured.');
  return { email, password };
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });

test('keeps the public page accessible and visually stable', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
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
  const slug = `g7pb-quality-${testInfo.project.name}-${Date.now()}`;
  let documentId = '';
  let lockVersion = 0;

  try {
    const createResponse = await api.post(`${API}/documents`, {
      data: { title: 'G7 페이지 빌더 품질 기준', slug, locale: 'ko', mode: 'canvas', shell_mode: 'none' },
    });
    expect(createResponse.ok()).toBe(true);
    const created = await createResponse.json() as ResourceEnvelope;
    documentId = typeof created.data?.document?.document_id === 'string'
      ? created.data.document.document_id
      : '';
    lockVersion = typeof created.data?.lock_version === 'number' ? created.data.lock_version : 0;
    expect(documentId).toMatch(/^[0-9a-f-]{36}$/i);

    const metadataResponse = await api.patch(`${API}/documents/${documentId}`, {
      data: {
        title: 'G7 페이지 빌더 품질 기준',
        slug,
        locale: 'ko',
        shell_mode: 'none',
        expected_lock_version: lockVersion,
        seo: {
          title: 'G7 페이지 빌더 품질 기준',
          description: '접근성과 반응형 시각 회귀를 검증하는 고정 공개 페이지입니다.',
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
      blocks: [
        {
          instance_id: '00000000-0000-4000-8000-000000000161',
          type: 'content.hero-centered-01',
          block_version: 1,
          props: {
            eyebrow: 'PAGE BUILDER',
            title: '콘텐츠를 빠르게 만들고 안전하게 발행합니다.',
            body: '<p>블록을 조합하고 화면에서 바로 편집한 뒤 검증된 결과만 공개합니다.</p>',
            primaryCta: { label: '기능 살펴보기', url: '/features' },
            alignment: 'center',
          },
          slots: [],
        },
        {
          instance_id: '00000000-0000-4000-8000-000000000162',
          type: 'content.features-grid-01',
          block_version: 1,
          props: {
            title: '페이지 제작에 필요한 기본 흐름',
            items: [
              { icon: 'layers', title: '블록 조합', body: '검증된 블록을 원하는 순서로 배치합니다.' },
              { icon: 'sparkles', title: '직접 편집', body: '문맥을 유지한 채 제목과 버튼을 수정합니다.' },
              { icon: 'shield', title: '안전한 발행', body: '실패해도 마지막 정상 발행본을 유지합니다.' },
            ],
          },
          slots: [],
        },
        {
          instance_id: '00000000-0000-4000-8000-000000000163',
          type: 'content.cta-split-01',
          block_version: 1,
          props: {
            eyebrow: 'START',
            heading: '첫 페이지를 준비해 보세요.',
            body: '기존 G7 페이지 관리와 템플릿은 그대로 유지됩니다.',
            primaryLink: { label: '문의하기', url: '/contact' },
            secondaryLink: { label: '문서 보기', url: '/docs' },
            theme: 'dark',
          },
          slots: [],
        },
      ],
    };
    const draftResponse = await api.put(`${API}/documents/${documentId}/draft`, {
      data: { document: pageDocument, expected_lock_version: lockVersion },
    });
    expect(draftResponse.ok()).toBe(true);
    const draft = await draftResponse.json() as ResourceEnvelope;
    lockVersion = Number(draft.data?.lock_version);

    const prepareResponse = await api.post(`${API}/documents/${documentId}/publications/prepare`, {
      data: { expected_lock_version: lockVersion },
    });
    if (!prepareResponse.ok()) {
      throw new Error(
        `Public quality publication prepare failed (${prepareResponse.status()}): ${await prepareResponse.text()}`,
      );
    }
    expect(prepareResponse.ok()).toBe(true);
    const prepared = await prepareResponse.json() as ResourceEnvelope;
    const publicationToken = prepared.data?.publication_token;
    expect(typeof publicationToken).toBe('string');
    const commitResponse = await api.post(`${API}/publications/${publicationToken}/commit`, { data: {} });
    expect(commitResponse.ok()).toBe(true);

    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const publicResponse = await page.goto(`/pages/${slug}`);
    expect(publicResponse?.ok()).toBe(true);
    expect(publicResponse?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.getByTestId('page-builder-public-root')).toBeVisible();
    await expect(page).toHaveTitle('G7 페이지 빌더 품질 기준');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      '접근성과 반응형 시각 회귀를 검증하는 고정 공개 페이지입니다.',
    );
    await expect(page.locator('svg.g7pb-features__icon')).toHaveCount(3);
    await page.evaluate(() => document.fonts.ready);

    const accessibility = await new AxeBuilder({ page })
      .include('[data-testid="page-builder-public-root"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(accessibility.violations).toEqual([]);

    const widths = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
    await expect(page).toHaveScreenshot(`public-quality-${testInfo.project.name}.png`, {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
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
