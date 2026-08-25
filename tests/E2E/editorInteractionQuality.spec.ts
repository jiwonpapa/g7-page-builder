import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  authenticateEditorInteractionAdmin,
  cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument,
  editorInteractionApi,
  recoverOwnedEditorInteractionDocuments,
  type OwnedEditorInteractionDocument,
} from './support/editorInteractionFixture';

const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const FIRST_TARGET = '중요한 문장은';
const SECOND_TARGET = '목록이나 링크';

test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.describe.configure({ retries: 0 });

async function richTextField(page: Page): Promise<Locator> {
  const field = page.frameLocator('iframe').first().locator(
    '[data-testid="page-builder-block"][data-block-type="rich-text"] [contenteditable="true"]',
  );
  await expect(field).toHaveCount(1);
  await expect(field).toBeVisible();
  return field;
}

async function selectedText(field: Locator): Promise<string> {
  return field.evaluate((element) => element.ownerDocument.defaultView?.getSelection()?.toString() ?? '');
}

interface PointerGeometry {
  end: { x: number; y: number };
  start: { x: number; y: number };
}

async function textPointerGeometry(field: Locator, target: string): Promise<PointerGeometry> {
  await field.scrollIntoViewIfNeeded();
  const fieldBox = await field.boundingBox();
  const geometry = await field.evaluate((element, selected) => {
    const fieldRect = element.getBoundingClientRect();
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const content = node.textContent ?? '';
      const startOffset = content.indexOf(selected);
      if (startOffset >= 0) {
        const startRange = element.ownerDocument.createRange();
        startRange.setStart(node, startOffset);
        startRange.setEnd(node, startOffset + 1);
        const endRange = element.ownerDocument.createRange();
        endRange.setStart(node, startOffset + selected.length - 1);
        endRange.setEnd(node, startOffset + selected.length);
        const start = startRange.getBoundingClientRect();
        const end = endRange.getBoundingClientRect();
        return {
          fieldWidth: fieldRect.width,
          fieldHeight: fieldRect.height,
          startX: start.left - fieldRect.left + Math.max(1, start.width * 0.2),
          startY: start.top - fieldRect.top + start.height / 2,
          endX: end.right - fieldRect.left - Math.max(1, end.width * 0.2),
          endY: end.top - fieldRect.top + end.height / 2,
        };
      }
      node = walker.nextNode();
    }
    throw new Error(`Pointer selection target was not found: ${selected}`);
  }, target);
  if (!fieldBox || geometry.fieldWidth <= 0 || geometry.fieldHeight <= 0) {
    throw new Error('Editor rich-text field geometry is unavailable.');
  }
  const scaleX = fieldBox.width / geometry.fieldWidth;
  const scaleY = fieldBox.height / geometry.fieldHeight;
  return {
    start: { x: fieldBox.x + geometry.startX * scaleX, y: fieldBox.y + geometry.startY * scaleY },
    end: { x: fieldBox.x + geometry.endX * scaleX, y: fieldBox.y + geometry.endY * scaleY },
  };
}

async function dragSelectText(page: Page, field: Locator, target: string): Promise<void> {
  const pointer = await textPointerGeometry(field, target);
  await page.mouse.move(pointer.start.x, pointer.start.y);
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.move(pointer.end.x, pointer.end.y, { steps: 18 });
  await page.waitForTimeout(80);
  await page.mouse.up();
  await expect.poll(() => selectedText(field)).toBe(target);
}

async function collapseSelectionWithPointer(page: Page, field: Locator, target: string): Promise<void> {
  const pointer = await textPointerGeometry(field, target);
  await page.mouse.click(pointer.end.x, pointer.end.y);
  await expect.poll(() => selectedText(field)).toBe('');
}

async function saveDraft(page: Page): Promise<void> {
  const response = page.waitForResponse((candidate) => {
    const path = new URL(candidate.url()).pathname;
    return candidate.request().method() === 'PUT' && path.endsWith('/draft');
  });
  await page.getByTestId('page-builder-save').click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

async function publish(page: Page): Promise<void> {
  const response = page.waitForResponse((candidate) => {
    const path = new URL(candidate.url()).pathname;
    return candidate.request().method() === 'POST'
      && /^\/api\/modules\/jiwonpapa-page_builder\/admin\/publications\/[^/]+\/commit$/.test(path);
  });
  const publishButton = page.getByTestId('page-builder-publish');
  if ((page.viewportSize()?.width ?? 1440) <= 720) {
    await publishButton.evaluate((element) => (element as HTMLButtonElement).click());
  } else {
    await publishButton.click();
  }
  expect((await response).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute('data-state', 'published');
}

test('keeps real pointer range editing exclusive, persistent, and publishable', async ({ context, page }, testInfo) => {
  test.setTimeout(180_000);
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await editorInteractionApi(token);
  let owned: OwnedEditorInteractionDocument | null = null;

  try {
    await recoverOwnedEditorInteractionDocuments(api);
    owned = await createOwnedEditorInteractionDocument(api, testInfo.project.name);
    await page.goto(`${EDITOR_PATH}?document=${owned.documentId}`);
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    let field = await richTextField(page);
    const rangeToolbar = page.frameLocator('iframe').first().getByTestId('page-builder-richtext-inline-toolbar');
    const elementPanel = page.getByTestId('page-builder-context-panel');

    await test.step('REAL_POINTER_SELECTION_GATE', async () => {
      await dragSelectText(page, field, FIRST_TARGET);
      await expect(rangeToolbar).toBeVisible();
    });
    await test.step('RANGE_TOOLBAR_EXCLUSIVE_GATE', async () => {
      await expect(elementPanel).toBeHidden();
      await rangeToolbar.getByTestId('page-builder-richtext-font').selectOption('serif');
      await rangeToolbar.getByTestId('page-builder-richtext-size').selectOption('large');
      await rangeToolbar.getByTestId('page-builder-richtext-tone').selectOption('custom1');
      const mark = field.locator('span[data-g7pb-font="serif"][data-g7pb-size="large"][data-g7pb-tone="custom1"]');
      await expect(mark).toHaveText(FIRST_TARGET);
      await expect(field.locator('span[data-g7pb-font], span[data-g7pb-size], span[data-g7pb-tone]')).toHaveCount(1);
    });
    await test.step('COLLAPSED_SELECTION_GATE', async () => {
      await collapseSelectionWithPointer(page, field, FIRST_TARGET);
      await expect(rangeToolbar).toBeHidden();
      await expect(elementPanel).toBeVisible();
      await page.getByTestId('page-builder-editor').click({ position: { x: 8, y: 8 } });
      await expect(rangeToolbar).toBeHidden();
      await expect(elementPanel).toBeHidden();
    });
    await test.step('REPEATED_SELECTION_GATE', async () => {
      await dragSelectText(page, field, SECOND_TARGET);
      await expect(rangeToolbar).toBeVisible();
      await expect(elementPanel).toBeHidden();
      await rangeToolbar.getByTestId('page-builder-richtext-weight').selectOption('bold');
      await expect(field.locator('span[data-g7pb-weight="bold"]')).toHaveText(SECOND_TARGET);
    });

    await saveDraft(page);
    await test.step('PERSISTED_SELECTION_MARK_GATE', async () => {
      await page.reload();
      await expect(page.getByTestId('page-builder-editor')).toBeVisible();
      field = await richTextField(page);
      await expect(field.locator('span[data-g7pb-font="serif"][data-g7pb-size="large"][data-g7pb-tone="custom1"]'))
        .toHaveText(FIRST_TARGET);
      await expect(field.locator('span[data-g7pb-weight="bold"]')).toHaveText(SECOND_TARGET);
    });

    const previewUrl = await page.getByTestId('page-builder-preview-link').getAttribute('href');
    if (!previewUrl) throw new Error('Editor interaction preview URL is unavailable.');
    const preview = await context.newPage();
    await preview.goto(previewUrl);
    await test.step('PREVIEW_SELECTION_MARK_GATE', async () => {
      await expect(preview.locator('[data-block-type="rich-text"] span[data-g7pb-font="serif"][data-g7pb-size="large"][data-g7pb-tone="custom1"]'))
        .toHaveText(FIRST_TARGET);
      await expect(preview.locator('[data-block-type="rich-text"] span[data-g7pb-weight="bold"]')).toHaveText(SECOND_TARGET);
    });
    await preview.close();

    await publish(page);
    const publicUrl = await page.getByTestId('page-builder-public-link').getAttribute('href');
    if (!publicUrl) throw new Error('Editor interaction public URL is unavailable.');
    const published = await context.newPage();
    await published.goto(publicUrl);
    await test.step('PUBLIC_SELECTION_MARK_GATE', async () => {
      await expect(published.locator('[data-block-type="rich-text"] span[data-g7pb-font="serif"][data-g7pb-size="large"][data-g7pb-tone="custom1"]'))
        .toHaveText(FIRST_TARGET);
      await expect(published.locator('[data-block-type="rich-text"] span[data-g7pb-weight="bold"]')).toHaveText(SECOND_TARGET);
    });
    await published.close();
  } finally {
    await page.close();
    if (owned) await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});
