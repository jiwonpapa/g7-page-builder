import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { authenticateEditorInteractionAdmin, cleanupOwnedEditorInteractionDocument, createOwnedEditorInteractionDocument,
  editorInteractionApi, type OwnedEditorInteractionDocument } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin/documents';
const EDITOR = '/modules/jiwonpapa-page_builder/admin/editor';

function syntheticSection(count: number): PageBuilderBlock {
  return { instance_id: crypto.randomUUID(), type: 'layout.section-01', block_version: 1,
    props: { width: 'standard', spacing: 'compact' }, slots: { content: Array.from({ length: count }, (_, index) => ({
      instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
      props: { eyebrow: '', heading: `Boundary fixture ${index + 1}`, level: 2, anchor: '' },
    })) } };
}
async function resource(api: APIRequestContext, id: string): Promise<{ document: PageBuilderDocument; lock_version: number }> {
  const response = await api.get(`${API}/${id}`);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { document?: PageBuilderDocument; lock_version?: number } };
  if (!payload.data?.document || typeof payload.data.lock_version !== 'number') throw new Error('Missing owned fixture document.');
  return { document: payload.data.document, lock_version: payload.data.lock_version };
}
async function withFixture(
  page: Page, context: BrowserContext, project: string, count: number,
  run: (api: APIRequestContext, owned: OwnedEditorInteractionDocument, section: PageBuilderBlock) => Promise<void>,
): Promise<void> {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let owned: OwnedEditorInteractionDocument | undefined;
  try {
    owned = await createOwnedEditorInteractionDocument(api, project);
    const current = await resource(api, owned.documentId);
    const section = syntheticSection(count);
    const document: PageBuilderDocument = { ...current.document, schema_version: 'g7-page-builder/v2', blocks: [section],
      tokens: { 'design.color_mode': 'light' } };
    const seeded = await api.put(`${API}/${owned.documentId}/draft`, { data: { document, expected_lock_version: current.lock_version } });
    expect(seeded.ok()).toBe(true);
    expect((await page.goto(`${EDITOR}?document=${owned.documentId}`))?.ok()).toBe(true);
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await run(api, owned, section);
    expect(errors, 'Canonical rejection must not escape as a browser exception.').toEqual([]);
  } catch (error) {
    if (!page.isClosed()) {
      await test.info().attach('boundary-failure-screen', { body: await page.screenshot(), contentType: 'image/png' });
      await test.info().attach('boundary-failure-aria', { body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain' });
    }
    throw error;
  } finally {
    await page.close();
    try { if (owned) await cleanupOwnedEditorInteractionDocument(api, owned); }
    finally { await api.dispose(); }
  }
}
async function save(page: Page, id: string): Promise<void> {
  const response = page.waitForResponse((candidate) => {
    const path = new URL(candidate.url()).pathname;
    return (candidate.request().method() === 'PUT' && path === `${API}/${id}/draft`)
      || (candidate.request().method() === 'POST' && path === `${API}/${id}/preview`);
  });
  await page.getByTestId('page-builder-save').click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

// Only structural limits and editor/save state are exercised; fixture copy is not a content acceptance test.
test.use({ trace: 'off', video: 'off' });
test.describe('Editor canonical document boundary', () => {
  test.describe.configure({ retries: 0 });

  test('rejects native invalid structure without losing valid history or saving it', async ({ page, context }, info) => {
    await withFixture(page, context, info.project.name, 200, async (api, owned, section) => {
      const canvas = page.frameLocator('iframe');
      const headings = canvas.locator('[data-g7pb-inline-field="heading"]');
      const theme = canvas.locator('.g7pb-document-theme');
      const sentCounts: number[] = [];
      page.on('request', (request) => {
        if (request.method() !== 'PUT' || new URL(request.url()).pathname !== `${API}/${owned.documentId}/draft`) return;
        const body = request.postDataJSON() as { document?: PageBuilderDocument };
        sentCounts.push(body.document?.blocks[0].slots?.content.length ?? -1);
      });
      await expect(headings).toHaveCount(200);
      // Establish a valid, acknowledged state before the rejected native command.
      await page.getByRole('button', { name: '다크 테마', exact: true }).click();
      await save(page, owned.documentId);
      await expect(theme).toHaveClass(/g7pb-theme-mode-dark/);
      await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
      const sectionRow = page.locator(`[data-puck-layer-tree-id="${section.instance_id}"]`);
      await expect(sectionRow).toBeVisible();
      const expand = sectionRow.locator(':scope > div').first().getByRole('button', { name: 'Expand', exact: true });
      if (await expand.isVisible()) await expand.click();
      const headingId = section.slots!.content[0].instance_id;
      const row = page.locator(`[data-puck-layer-tree-id="${headingId}"]`);
      await row.locator(':scope > div').first().getByRole('button', { name: '제목', exact: true }).click();
      const duplicate = row.getByRole('button', { name: 'Duplicate', exact: true });
      await duplicate.click();
      await expect(page.getByTestId('page-builder-document-error')).toContainText('한 구역의 블록 수');
      await expect(headings).toHaveCount(200);
      // Recovery temporarily disables mutations; wait for the editor's public busy state.
      await expect(page.getByTestId('page-builder-editor')).toHaveAttribute('aria-busy', 'false');
      await expect(duplicate).toBeVisible();
      await expect(duplicate).toBeEnabled();
      await page.getByRole('button', { name: 'undo', exact: true }).click();
      await expect(theme).toHaveClass(/g7pb-theme-mode-light/);
      await page.getByRole('button', { name: 'redo', exact: true }).click();
      await expect(theme).toHaveClass(/g7pb-theme-mode-dark/);
      await save(page, owned.documentId);
      const saved = await resource(api, owned.documentId);
      expect(saved.document.blocks[0].slots?.content.map((item) => item.instance_id))
        .toEqual(section.slots!.content.map((item) => item.instance_id));
      expect(sentCounts.length).toBeGreaterThan(0);
      expect(sentCounts.every((value) => value === 200)).toBe(true);
      await page.reload();
      await expect(headings).toHaveCount(200);
      await expect(theme).toHaveClass(/g7pb-theme-mode-dark/);
      await page.screenshot({ path: info.outputPath('editor-boundary-recovered.png'), fullPage: false });
    });
  });

  test('serializes a clean preview save with later edits', async ({ page, context }, info) => {
    await withFixture(page, context, info.project.name, 1, async (api, owned) => {
      let release!: () => void;
      let received!: () => void;
      const held = new Promise<void>((resolve) => { release = resolve; });
      const pending = new Promise<void>((resolve) => { received = resolve; });
      let intercepted = false;
      const previewPath = `**${API}/${owned.documentId}/preview`;
      await page.route(previewPath, async (route) => {
        if (intercepted) { await route.continue(); return; }
        intercepted = true;
        const response = await route.fetch();
        received();
        await held;
        await route.fulfill({ response });
      });
      try {
        await page.getByTestId('page-builder-save').click();
        await pending;
        await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saving');
        await page.getByRole('button', { name: '다크 테마', exact: true }).click();
        await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'dirty');
        const latestSaved = page.waitForResponse((candidate) => {
          if (candidate.request().method() !== 'PUT' || new URL(candidate.url()).pathname !== `${API}/${owned.documentId}/draft`) return false;
          const body = candidate.request().postDataJSON() as { document?: PageBuilderDocument };
          return body.document?.tokens?.['design.color_mode'] === 'dark';
        });
        release();
        expect((await latestSaved).ok()).toBe(true);
        await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
        expect((await resource(api, owned.documentId)).document.tokens?.['design.color_mode']).toBe('dark');
        await page.reload();
        await expect(page.frameLocator('iframe').locator('.g7pb-document-theme')).toHaveClass(/g7pb-theme-mode-dark/);
      } finally {
        release();
        await page.unroute(previewPath);
      }
    });
  });
});
