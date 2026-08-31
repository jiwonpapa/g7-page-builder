import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import {
  authenticateEditorInteractionAdmin,
  cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument,
  editorInteractionApi,
  recoverOwnedEditorInteractionDocuments,
  type OwnedEditorInteractionDocument,
} from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin';
const CANVAS = '#puck-canvas-root iframe';
const BODY = '미리보기에서도 사라지면 안 되는 본문';
const RESTORED_BODY = '삭제한 뒤 새로 입력하고 저장한 본문';
const ADDRESS = '서울특별시 테스트로 1';
test.use({ screenshot: 'only-on-failure', trace: 'off', video: 'off' });

async function assertUnobscuredPreview(page: Page): Promise<void> {
  await expect(page.getByTestId('page-builder-block-library')).toBeHidden();
  await expect.poll(() => page.locator(CANVAS).evaluate(frame => {
    const rect = frame.getBoundingClientRect();
    const y = Math.min(rect.top + rect.height / 2, window.innerHeight - 2);
    return rect.width > 0 && y > rect.top && [0.05, 0.5, 0.95].every(ratio =>
      document.elementFromPoint(rect.left + rect.width * ratio, y) === frame);
  }), { message: '미리보기 iframe의 좌우/중앙을 편집 패널이 가리면 안 됩니다.' }).toBe(true);
}

async function assertOptionalElements(page: Page, bodyText = BODY, addressText = ''): Promise<void> {
  const canvas = page.frameLocator(CANVAS);
  const hero = canvas.locator('[data-block-type="hero"]');
  await expect(hero).toBeVisible();
  await expect(hero.locator('[data-g7pb-inline-field="eyebrow"]')).toHaveCount(0);
  await expect(hero.locator('[data-g7pb-inline-field="primaryLabel"]')).toHaveCount(0);
  await expect(canvas.locator('[data-block-type="heading"] [data-g7pb-inline-field="eyebrow"]')).toHaveCount(0);
  const address = canvas.locator('[data-block-type="contact"] [data-g7pb-inline-field="address"]');
  if (addressText) await expect(address).toHaveText(addressText);
  else await expect(address).toHaveCount(0);
  await expect(canvas.locator('.g7pb-preview-contact__actions')).toHaveCount(0);
  await expect(canvas.locator('[data-block-type="contact"] [data-g7pb-inline-field="phone"]')).toHaveText('02-1234-5678');
  await expect(canvas.locator('[data-block-type="cta"] [data-g7pb-inline-field="body"]')).toHaveText(bodyText);
}

async function saveAndAssertBody(page: Page, api: APIRequestContext, documentId: string, expectedHtml: string): Promise<void> {
  const saved = page.waitForResponse(response => response.request().method() === 'PUT'
    && new URL(response.url()).pathname === `${API}/documents/${documentId}/draft`);
  await page.getByTestId('page-builder-save').click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
  // Read the canonical server document: editor DOM alone cannot prove saving.
  const response = await api.get(`${API}/documents/${documentId}`);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data: { document: PageBuilderDocument } };
  expect(payload.data.document.blocks).toHaveLength(4);
  expect(payload.data.document.blocks.find(block => block.type === 'content.cta-split-01')?.props.body).toBe(expectedHtml);
}

async function publish(page: Page): Promise<void> {
  const publication = page.waitForResponse(response => response.request().method() === 'POST'
    && /^\/api\/modules\/jiwonpapa-page_builder\/admin\/publications\/[^/]+\/commit$/.test(new URL(response.url()).pathname));
  await page.getByTestId('page-builder-publish').click();
  expect((await publication).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute('data-state', 'published');
}

for (const deleteKey of ['Delete', 'Backspace'] as const) {
  test(`keeps optional text recoverable in edit mode and consistent in readonly viewports and publication (${deleteKey})`, async ({ context, page }, testInfo) => {
    test.setTimeout(120_000);
    // Candidate assets are request-local; never overwrite the shared runtime.
    if (process.env.G7PB_OPTIONAL_CANDIDATE_DIST) {
      for (const [file, contentType] of [['js/page-builder-editor.iife.js', 'application/javascript'], ['css/page-builder-editor.css', 'text/css']]) {
        await context.route(`**/dist/${file}*`, route => route.fulfill({
          path: resolve(process.env.G7PB_OPTIONAL_CANDIDATE_DIST!, file), contentType,
        }));
      }
    }
    const token = await authenticateEditorInteractionAdmin(context);
    const api = await editorInteractionApi(token);
    let owned: OwnedEditorInteractionDocument | null = null;
    try {
      await recoverOwnedEditorInteractionDocuments(api);
      owned = await createOwnedEditorInteractionDocument(api, testInfo.project.name);
      const current = await api.get(`${API}/documents/${owned.documentId}`);
      expect(current.ok()).toBe(true);
      const payload = await current.json() as { data: { document: PageBuilderDocument; lock_version: number } };
      const document: PageBuilderDocument = { ...payload.data.document, blocks: [
        { instance_id: crypto.randomUUID(), type: 'content.hero-centered-01', block_version: 1,
          props: { title: '빈 버튼을 만들지 않는 히어로', body: '<p>히어로 본문</p>', eyebrow: '', layout: 'product' }, slots: {} },
        { instance_id: crypto.randomUUID(), type: 'content.heading-01', block_version: 1,
          props: { heading: '선택 문구 없는 제목', eyebrow: '', level: 2 }, slots: {} },
        { instance_id: crypto.randomUUID(), type: 'content.cta-split-01', block_version: 1,
          props: { heading: '선택 본문 편집', body: `<p>${BODY}</p>`, eyebrow: '', theme: 'light' }, slots: {} },
        { instance_id: crypto.randomUUID(), type: 'content.contact-info-01', block_version: 1,
          props: { heading: '연락처', address: '', phone: '02-1234-5678', email: 'team@example.com' }, slots: {} },
      ] };
      const draft = await api.put(`${API}/documents/${owned.documentId}/draft`, {
        data: { document, expected_lock_version: payload.data.lock_version },
      });
      expect(draft.ok(), await draft.text()).toBe(true);
      const editorUrl = `/modules/jiwonpapa-page_builder/admin/editor?document=${owned.documentId}`;

      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(editorUrl);
        await expect(page.getByTestId('page-builder-editor')).toHaveAttribute('data-editing-mode', width === 1440 ? 'edit' : 'preview');
        await assertOptionalElements(page);
        if (width < 1024) await assertUnobscuredPreview(page);
        await page.screenshot({ path: testInfo.outputPath(`optional-content-${width}.png`), fullPage: false });
        await page.frameLocator(CANVAS).locator('[data-block-type="cta"]').screenshot({
          path: testInfo.outputPath(`optional-cta-${width}.png`),
        });
      }

      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(page.getByTestId('page-builder-block-library')).toBeVisible();
      await page.setViewportSize({ width: 768, height: 1000 });
      await assertUnobscuredPreview(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await expect(page.getByTestId('page-builder-block-library')).toBeVisible();
      await page.getByRole('button', { name: 'Toggle left sidebar', exact: true }).click();
      await page.getByRole('button', { name: 'Toggle right sidebar', exact: true }).click();
      await assertUnobscuredPreview(page);
      await page.setViewportSize({ width: 768, height: 1000 });
      await assertUnobscuredPreview(page);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await assertUnobscuredPreview(page);
      await page.goto(editorUrl);
      // Puck's lazy fallback is contenteditable but has no Tiptap input handler.
      // Interact with the initialized editor, not that transient placeholder.
      const body = page.frameLocator(CANVAS).locator('[data-block-type="cta"] [data-g7pb-inline-field="body"] .tiptap[contenteditable="true"]');
      // A triple click selects this fixture's single paragraph with real pointer
      // events. fill('') instead changes the DOM range then sends Delete before
      // Tiptap necessarily sees selectionchange. Wait for the actual range UI,
      // not a fixed delay or a test-only editor command.
      await body.click({ clickCount: 3 });
      await expect(body).toBeFocused();
      await expect.poll(() => body.evaluate(element => element.ownerDocument.defaultView?.getSelection()?.toString().trim())).toBe(BODY);
      await expect(page.frameLocator(CANVAS).getByTestId('page-builder-richtext-inline-toolbar')).toBeVisible();
      await body.press(deleteKey);
      await expect(body).toHaveText('');
      await expect(body).toBeVisible();
      await saveAndAssertBody(page, api, owned.documentId, '<p></p>');
      await page.reload();
      await expect(body).toBeVisible();
      await assertOptionalElements(page, '');
      await page.frameLocator(CANVAS).locator('[data-block-type="cta"]').screenshot({ path: testInfo.outputPath('cta-empty-reloaded.png') });
      await page.getByTestId('page-builder-viewport-768').click();
      await expect(page.getByTestId('page-builder-editor')).toHaveAttribute('data-editing-mode', 'preview');
      await expect(page.frameLocator(CANVAS).locator('[data-block-type="cta"] [data-g7pb-inline-field="body"]')).toHaveCount(0);
      await page.getByTestId('page-builder-viewport-1280').click();
      await expect(page.getByTestId('page-builder-editor')).toHaveAttribute('data-editing-mode', 'edit');
      // Address is required at publication even though an incomplete draft can
      // omit its canvas element. Keep that contract instead of weakening it.
      await page.getByTestId('page-builder-publish').click();
      await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute('data-state', 'error');
      await expect(page.getByRole('alert')).toContainText('주소');
      await page.frameLocator(CANVAS).locator('[data-block-type="contact"] [data-g7pb-inline-field="heading"] .tiptap').click();
      await page.locator('[data-testid="page-builder-contact-address"]:visible').fill(ADDRESS);

      await publish(page);
      const publicPage = await context.newPage();
      try {
        await publicPage.goto(`/pages/${owned.slug}`);
        const publicCta = publicPage.locator('[data-block-type="cta"]');
        await expect(publicCta).toBeVisible();
        await expect(publicCta).toContainText('선택 본문 편집');
        await expect(publicCta.locator('.g7pb-preview-richtext')).toHaveCount(0);
        await expect(publicCta).not.toContainText(BODY);
        await publicCta.screenshot({ path: testInfo.outputPath('cta-empty-published.png') });

        // Use different text, so losing both edits cannot masquerade as a pass.
        await body.fill(RESTORED_BODY);
        await expect(body).toHaveText(RESTORED_BODY);
        await saveAndAssertBody(page, api, owned.documentId, `<p>${RESTORED_BODY}</p>`);
        await page.reload();
        await assertOptionalElements(page, RESTORED_BODY, ADDRESS);
        await page.frameLocator(CANVAS).locator('[data-block-type="cta"]').screenshot({ path: testInfo.outputPath('cta-restored-reloaded.png') });
        await publish(page);
        await publicPage.reload();
        await expect(publicCta).toContainText(RESTORED_BODY);
        await expect(publicCta).not.toContainText(BODY);
        await publicCta.screenshot({ path: testInfo.outputPath('cta-restored-published.png') });
        await expect(publicPage.locator('[data-block-type="hero"] a')).toHaveCount(0);
        await expect(publicPage.locator('[data-block-type="contact"] a')).toHaveCount(2);
        await expect(publicPage.locator('[data-block-type="heading"] small')).toHaveCount(0);
      } finally { await publicPage.close(); }
    } finally {
      if (owned) await cleanupOwnedEditorInteractionDocument(api, owned);
      await api.dispose();
    }
  });
}
