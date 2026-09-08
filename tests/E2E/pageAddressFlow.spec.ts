import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin';

test('creates a page in the UI and connects a custom path to its last published content', async ({ page, context, browser }, info) => {
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await editorInteractionApi(token);
  const slug = `phase2-${Date.now()}`;
  const title = `2차 회사소개 ${slug}`;
  const alias = `/company/${slug}`;
  // Keep this explicitly owned proof document for review; never touch existing pages.
  await page.goto('/modules/jiwonpapa-page_builder/admin');
  await page.getByTestId('page-builder-manager-create').click();
  await page.getByTestId('page-builder-manager-title-input').fill(title);
  await page.getByTestId('page-builder-manager-slug-input').fill(slug);
  await page.getByTestId('page-builder-manager-create-confirm').click();
  await expect(page.getByTestId('page-builder-editor')).toBeVisible();
  const id = new URL(page.url()).searchParams.get('document');
  if (!id) throw new Error('Missing created document ID');
  await writeFile(info.outputPath('owned-page.json'), JSON.stringify({ id, slug, alias, title }, null, 2));
  await page.getByTestId('page-builder-add-block').click();
  const gallery = page.getByTestId('page-builder-block-gallery');
  await expect(gallery).toBeVisible();
  await page.getByTestId('page-builder-block-option-heading').click();
  await page.getByTestId('page-builder-save').click();
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
  await page.goto('/modules/jiwonpapa-page_builder/admin');
  await page.getByTestId('page-builder-manager-search').fill(slug);
  const card = page.locator('[data-testid="page-builder-document-row"]').filter({ hasText: title });
  await card.getByTestId('page-builder-manager-more').click();
  await card.getByTestId('page-builder-manager-settings').click();
  await page.getByTestId('page-builder-path-open').click();
  const input = page.getByTestId('page-builder-path-input');
  await expect(input).toBeEnabled();
  await input.fill('/admin/users');
  await page.getByTestId('page-builder-path-save').click();
  await expect(page.getByTestId('page-builder-path-panel')).toContainText('시스템에서 사용하는 주소');
  await input.fill(alias); await page.getByTestId('page-builder-path-save').click();
  await expect(page.getByTestId('page-builder-path-status')).toContainText('발행한 뒤');
  expect((await page.request.get(alias)).status()).toBe(404);
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await page.goto(`/modules/jiwonpapa-page_builder/admin/editor?document=${id}`);
  await expect(page.getByTestId('page-builder-editor')).toBeVisible();
  const previewEvent = page.waitForEvent('popup');
  await page.getByTestId('page-builder-preview-link').click();
  const preview = await previewEvent; await preview.waitForLoadState('networkidle');
  await expect(preview.locator('[data-block-type="heading"]')).toBeVisible();
  await preview.close();
  await page.getByTestId('page-builder-publish').click();
  await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute('data-state', 'published');
  const publicContext = await browser.newContext({ ignoreHTTPSErrors: true, locale: 'ko-KR' });
  const publicPage = await publicContext.newPage();
  const response = await publicPage.goto(new URL(alias, page.url()).href);
  expect(response?.status()).toBe(200);
  await expect(publicPage.locator('[data-block-type="heading"]')).toBeVisible();
  const publishedText = await publicPage.locator('[data-block-type="heading"]').innerText();
  for (const width of [1440, 768, 390]) {
    await publicPage.setViewportSize({ width, height: 1000 });
    // G7 resolves responsive JSON UI at navigation time.
    await publicPage.reload();
    await publicPage.waitForLoadState('networkidle');
    await publicPage.screenshot({ path: info.outputPath(`public-${width}.png`), fullPage: true });
    expect(await publicPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  // An invalid publication request must preserve both the public artifact and alias.
  const invalid = await api.post(`${API}/publications/not-a-valid-token/commit`, { data: {} });
  expect(invalid.ok()).toBe(false);
  await publicPage.reload();
  await expect(publicPage.locator('[data-block-type="heading"]')).toHaveText(publishedText, { useInnerText: true });
  await page.goto('/modules/jiwonpapa-page_builder/admin');
  await page.getByTestId('page-builder-manager-search').fill(slug);
  const reentered = page.locator('[data-testid="page-builder-document-row"]').filter({ hasText: title });
  await reentered.getByTestId('page-builder-manager-more').click();
  await reentered.getByTestId('page-builder-manager-settings').click();
  await page.getByTestId('page-builder-path-open').click();
  await expect(page.getByTestId('page-builder-path-input')).toHaveValue(alias);
  await expect(page.getByTestId('page-builder-path-status')).toHaveText('연결됨');
  await expect(page.getByRole('link', { name: '헤더·푸터 메뉴 편집', exact: true })).toHaveAttribute('href', '/modules/jiwonpapa-page_builder/admin/site-parts');
  await page.screenshot({ path: info.outputPath('path-settings.png'), fullPage: true });
  await publicContext.close(); await api.dispose();
});
