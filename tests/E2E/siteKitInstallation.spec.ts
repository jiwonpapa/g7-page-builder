import { devices, expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';
import { parseSiteKitReceipt } from '../../resources/js/api/siteKit';

const API = '/api/modules/jiwonpapa-page_builder/admin';
test.use({ locale: 'ko-KR' });
test('installs a site kit as drafts, edits and publishes its pages, and connects the installed menu', async ({ page, context, browser }, info) => {
  // Editors are PC-only; public responsive proof is explicit below for every project.
  await page.setViewportSize({ width: 1440, height: 1000 });
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await editorInteractionApi(token);
  const oldSets = await (await api.get(`${API}/site-part-sets?locale=ko`)).json();
  const original = oldSets.data.items.find((item: { is_active: boolean }) => item.is_active);
  if (!original?.id || !original.is_ready) throw new Error('A restorable active pair is required for site kit proof.');
  const stamp = `kit-${Date.now()}`;
  const aliases = { about: `/company/${stamp}/about`, services: `/company/${stamp}/services`, contact: `/company/${stamp}/contact` };
  let activated = false;
  try {
    await page.goto('/modules/jiwonpapa-page_builder/admin');
    await page.getByTestId('manager-site-kits').click();
    const dialog = page.getByTestId('site-kit-dialog');
    await dialog.getByRole('button', { name: '구성 선택', exact: true }).click();
    await dialog.getByLabel('설치 이름', { exact: true }).fill(`3차 검증 ${stamp}`);
    await page.getByTestId('site-kit-path-about').fill('/admin/users');
    await dialog.getByRole('button', { name: '구성 확인', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('시스템에서 사용하는 주소');
    for (const [key, path] of Object.entries(aliases)) await page.getByTestId(`site-kit-path-${key}`).fill(path);
    await dialog.getByRole('button', { name: '구성 확인', exact: true }).click();
    await expect(page.getByTestId('site-kit-install')).toBeEnabled();
    await page.screenshot({ path: info.outputPath('installation-preview.png'), fullPage: true });
    const installedResponse = page.waitForResponse(response => response.url().endsWith('/site-kits/install') && response.request().method() === 'POST');
    await page.getByTestId('site-kit-install').click();
    const response = await installedResponse;
    expect(response.ok()).toBe(true);
    const receipt = parseSiteKitReceipt((await response.json()).data);
    await writeFile(info.outputPath('owned-installation.json'), JSON.stringify(receipt, null, 2));
    await expect(page.getByTestId('site-kit-result')).toBeVisible();
    for (const item of receipt.pages) expect((await page.request.get(item.path)).status()).toBe(404);
    const sets = await (await api.get(`${API}/site-part-sets?locale=ko`)).json();
    expect(sets.data.items.find((item: { id: string }) => item.id === receipt.set_id).is_active).toBe(false);
    expect(sets.data.items.find((item: { is_active: boolean }) => item.is_active).id).toBe(original.id);
    // Reload returns the saved receipt, so edit links survive page reentry.
    await page.reload(); await page.getByTestId('manager-site-kits').click();
    await expect(page.getByTestId('site-kit-edit-parts')).toHaveAttribute('href', `/modules/jiwonpapa-page_builder/admin/site-parts?set_id=${receipt.set_id}`);
    await page.screenshot({ path: info.outputPath('installation-result.png'), fullPage: true });
    for (const item of receipt.pages) {
      await page.goto(`/modules/jiwonpapa-page_builder/admin/editor?document=${item.document_id}`);
      await expect(page.getByTestId('page-builder-editor')).toBeVisible();
      const canvas = page.frameLocator('#puck-canvas-root iframe');
      const title = canvas.locator('[data-g7pb-inline-field="title"] [contenteditable="true"]').first();
      await expect(title).toBeVisible();
      await title.fill(`${item.title} · 맞춤 안내`);
      await page.getByTestId('page-builder-save').click();
      await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
      await page.reload(); await expect(title).toContainText('맞춤 안내');
      if (item.key === 'about') {
        const popup = page.waitForEvent('popup'); await page.getByTestId('page-builder-preview-link').click();
        const preview = await popup; await preview.waitForLoadState('networkidle');
        await expect(preview.locator('h1')).toContainText('맞춤 안내'); await preview.close();
      }
      await page.getByTestId('page-builder-publish').click();
      await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute('data-state', 'published');
    }
    await page.goto(`/modules/jiwonpapa-page_builder/admin/site-parts?set_id=${receipt.set_id}`);
    const partsCanvas = page.frameLocator('iframe').first();
    await expect(partsCanvas.getByText('모로 스튜디오', { exact: true }).first()).toBeVisible();
    const headerBounds = await partsCanvas.locator('.g7pb-site-header').boundingBox();
    if (!headerBounds) throw new Error('Installed header selection geometry is missing.');
    await page.mouse.click(headerBounds.x + 4, headerBounds.y + 4);
    await page.getByLabel('사이트 이름', { exact: true }).last().fill('3차 맞춤 스튜디오');
    const save = page.waitForResponse(r => r.url().includes(`/site-part-sets/${receipt.set_id}/draft`) && r.request().method() === 'PUT');
    await page.getByTestId('page-builder-site-part-set-save').click(); expect((await save).ok()).toBe(true);
    await page.reload(); await expect(partsCanvas.getByText('3차 맞춤 스튜디오', { exact: true }).first()).toBeVisible();
    const publish = page.waitForResponse(r => r.url().includes(`/site-part-sets/${receipt.set_id}/publish`));
    await page.getByTestId('page-builder-site-part-set-publish').click(); expect((await publish).ok()).toBe(true);
    const activate = page.waitForResponse(r => r.url().includes(`/site-part-sets/${receipt.set_id}/activate`));
    activated = true;
    await page.getByTestId('page-builder-site-part-set-activate').click(); expect((await activate).ok()).toBe(true);
    await page.screenshot({ path: info.outputPath('installed-parts-editor.png'), fullPage: true });
    const publicContext = await browser.newContext({ ...devices['Desktop Chrome'], ignoreHTTPSErrors: true, locale: 'ko-KR' });
    try {
      const visitor = await publicContext.newPage(); const errors: string[] = []; visitor.on('pageerror', error => errors.push(error.message));
      await visitor.goto(new URL(aliases.about, page.url()).href);
      const header = visitor.getByTestId('page-builder-site-header');
      await expect(header).toContainText('3차 맞춤 스튜디오');
      await header.getByRole('link', { name: '서비스 소개', exact: true }).click();
      await expect(visitor).toHaveURL(new RegExp(aliases.services + '$'));
      await expect(visitor.locator('h1')).toContainText('서비스 소개 · 맞춤 안내');
      for (const width of [1440, 768, 390]) {
        await visitor.setViewportSize({ width, height: 1000 });
        for (const item of receipt.pages) {
          await visitor.goto(new URL(item.path, page.url()).href); await visitor.waitForLoadState('networkidle');
          await expect(visitor.locator('h1')).toContainText('맞춤 안내');
          await expect(visitor.getByTestId('page-builder-site-footer')).toBeVisible();
          expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          for (const block of await visitor.locator('.g7pb-block[data-g7pb-motion]').all()) {
            await block.scrollIntoViewIfNeeded(); await expect(block).toHaveClass(/is-inview/);
          }
          for (const card of await visitor.locator('.g7pb-features__item').all()) await expect(card).toHaveCSS('opacity', '1');
          await visitor.locator('h1').scrollIntoViewIfNeeded();
          await visitor.screenshot({ path: info.outputPath(`${item.key}-${width}.png`), fullPage: true });
        }
      }
      expect(errors).toEqual([]);
      const rejected = await api.post(`${API}/publications/not-a-token/commit`, { data: {} }); expect(rejected.ok()).toBe(false);
      await visitor.reload(); await expect(visitor.locator('h1')).toContainText('맞춤 안내');
    } finally { await publicContext.close(); }
  } finally {
    if (activated) {
      const restored = await api.post(`${API}/site-part-sets/${original.id}/activate`, { data: { locale: 'ko' } });
      expect(restored.ok(), 'Restore original active pair through the normal API').toBe(true);
    }
    await api.dispose();
  }
});
