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
const CANVAS_IFRAME = '#puck-canvas-root iframe';
const RICH_TEXT_SELECTOR = '[data-testid="page-builder-block"][data-block-type="rich-text"] [contenteditable="true"]';
const FIRST_TARGET = '굵게 강조하고';
const SECOND_TARGET = '목록이나 링크';

test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.describe.configure({ retries: 0 });

async function richTextField(page: Page): Promise<Locator> {
  await expect(page.locator(CANVAS_IFRAME)).toHaveCount(1);
  const fields = page.frameLocator(CANVAS_IFRAME).locator(`${RICH_TEXT_SELECTOR}:visible`);
  await expect(fields.first()).toBeVisible();
  const field = fields.first();
  await expect(field).toBeVisible();
  return field;
}

async function selectedText(field: Locator): Promise<string> {
  return field.evaluate((element) => element.ownerDocument.defaultView?.getSelection()?.toString() ?? '');
}

async function assertInteractiveCanvas(page: Page): Promise<void> {
  const iframe = page.locator(CANVAS_IFRAME);
  await expect.poll(async () => (await iframe.boundingBox())?.width ?? 0).toBeGreaterThan(1);
  await expect.poll(async () => (await iframe.boundingBox())?.height ?? 0).toBeGreaterThan(1);
}

async function assertTabletHeaderHeight(page: Page, projectName: string): Promise<void> {
  if (projectName !== 'tablet') return;
  const header = page.locator('.g7pb-puck-header-layer');
  await expect(header).toHaveCount(1);
  await expect.poll(async () => (await header.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(100);
}

async function setCanvasViewport(page: Page, projectName: string): Promise<void> {
  const width = projectName === 'mobile' ? 360 : projectName === 'tablet' ? 768 : 1280;
  const button = page.getByTestId(`page-builder-viewport-${width}`);
  if (!(await button.isVisible())) {
    await page.getByRole('button', { name: 'Toggle menu bar' }).click();
  }
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(
    () => page.locator('#puck-canvas-root').evaluate((element) => element.style.width),
  ).toBe(`${width}px`);
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function exposeCanvasForPointer(page: Page): Promise<void> {
  const library = page.getByTestId('page-builder-block-library');
  if (await library.isVisible()) {
    await page.getByText('Blocks', { exact: true }).click();
    await expect(library).toBeHidden();
  }
  const rightSidebarLayout = page.locator('[class*="PuckLayout--rightSideBarVisible"]');
  if ((page.viewportSize()?.width ?? 1440) >= 638 && (page.viewportSize()?.width ?? 1440) <= 900
    && await rightSidebarLayout.count()) {
    await page.getByRole('button', { name: 'Toggle right sidebar' }).click();
    await expect(rightSidebarLayout).toHaveCount(0);
  }
}

interface PointerGeometry {
  end: { x: number; y: number };
  start: { x: number; y: number };
}

async function textPointerGeometry(field: Locator, target: string): Promise<PointerGeometry> {
  await field.scrollIntoViewIfNeeded();
  const geometry = await field.evaluate((element, selected) => {
    const fieldRect = element.getBoundingClientRect();
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const content = node.textContent ?? '';
      const startOffset = content.indexOf(selected);
      if (startOffset >= 0) {
        const caretDocument = element.ownerDocument as Document & {
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
        };
        const caretOffsetAtPoint = (x: number, y: number): number | null => {
          const position = caretDocument.caretPositionFromPoint?.(x, y);
          if (position) return position.offsetNode === node ? position.offset : null;
          const range = caretDocument.caretRangeFromPoint?.(x, y);
          return range?.startContainer === node ? range.startOffset : null;
        };
        const resolveCaretPoint = (rect: DOMRect, expectedOffset: number): { left: number; right: number; top: number } => {
          const top = rect.top + rect.height / 2;
          const candidates: Array<{ left: number; right: number; top: number }> = [];
          for (let sample = 1; sample < 20; sample += 1) {
            const left = rect.left + rect.width * sample / 20;
            if (caretOffsetAtPoint(left, top) === expectedOffset) candidates.push({ left, right: left, top });
          }
          const point = candidates[Math.floor(candidates.length / 2)];
          if (!point) throw new Error(`No pointer point resolves to caret offset ${expectedOffset}.`);
          return point;
        };
        const startRange = element.ownerDocument.createRange();
        startRange.setStart(node, startOffset);
        startRange.setEnd(node, startOffset + 1);
        const endRange = element.ownerDocument.createRange();
        endRange.setStart(node, startOffset + selected.length - 1);
        endRange.setEnd(node, startOffset + selected.length);
        const start = resolveCaretPoint(startRange.getBoundingClientRect(), startOffset);
        const end = resolveCaretPoint(endRange.getBoundingClientRect(), startOffset + selected.length);
        return {
          fieldHeight: fieldRect.height,
          fieldWidth: fieldRect.width,
          startX: start.left - fieldRect.left,
          startY: start.top - fieldRect.top,
          endX: end.right - fieldRect.left,
          endY: end.top - fieldRect.top,
        };
      }
      node = walker.nextNode();
    }
    throw new Error(`Pointer selection target was not found: ${selected}`);
  }, target);
  const box = await field.boundingBox();
  if (!box || geometry.fieldWidth <= 0 || geometry.fieldHeight <= 0) {
    throw new Error('Rich-text pointer geometry is unavailable.');
  }
  const scaleX = box.width / geometry.fieldWidth;
  const scaleY = box.height / geometry.fieldHeight;
  return {
    start: { x: geometry.startX * scaleX, y: geometry.startY * scaleY },
    end: { x: geometry.endX * scaleX, y: geometry.endY * scaleY },
  };
}

async function dragSelectText(page: Page, field: Locator, target: string): Promise<void> {
  await field.focus();
  await expect.poll(() => selectedText(field)).toBe('');
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const pointer = await textPointerGeometry(field, target);
  await field.hover({ position: pointer.start });
  await page.mouse.down();
  try {
    await field.hover({ position: pointer.end });
  } finally {
    await page.mouse.up();
  }
  field = page.frameLocator(CANVAS_IFRAME).locator(`${RICH_TEXT_SELECTOR}:focus`);
  await expect(field).toHaveCount(1);
  await expect(field).toBeFocused();
  await expect.poll(() => selectedText(field)).toBe(target);
}

async function chooseRangeOption(rangeToolbar: Locator, testId: string, option: string): Promise<void> {
  const trigger = rangeToolbar.getByTestId(testId);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await rangeToolbar.getByRole('option', { name: option, exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function collapseSelectionWithPointer(page: Page, field: Locator, target: string): Promise<void> {
  const pointer = await textPointerGeometry(field, target);
  await field.click({ position: pointer.end });
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
    await test.step('CANVAS_VIEWPORT_GATE', async () => {
      await setCanvasViewport(page, testInfo.project.name);
    });
    let field = await richTextField(page);
    const rangeToolbar = page.frameLocator(CANVAS_IFRAME).getByTestId('page-builder-richtext-inline-toolbar');
    const elementPanel = page.getByTestId('page-builder-context-panel');

    await test.step('POINTER_CANVAS_GATE', async () => {
      await exposeCanvasForPointer(page);
    });
    await test.step('INTERACTIVE_CANVAS_GATE', async () => {
      await assertInteractiveCanvas(page);
    });
    await test.step('TABLET_HEADER_HEIGHT_GATE', async () => {
      await assertTabletHeaderHeight(page, testInfo.project.name);
    });

    await test.step('REAL_POINTER_SELECTION_GATE', async () => {
      await dragSelectText(page, field, FIRST_TARGET);
      await expect(rangeToolbar).toBeVisible();
    });
    await test.step('RANGE_TOOLBAR_EXCLUSIVE_GATE', async () => {
      await expect(elementPanel).toBeHidden();
      await rangeToolbar.getByRole('button', { name: '선택한 글자 굵게', exact: true }).click();
      await expect(field.locator('strong')).toHaveText(FIRST_TARGET);
      await expect(rangeToolbar).toBeVisible();
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-font', '명조');
      await expect(rangeToolbar).toBeVisible();
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-size', 'L');
      await expect(rangeToolbar).toBeVisible();
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-tone', '사용자색 1');
      await expect(rangeToolbar).toBeVisible();
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
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-weight', '매우 굵게');
      await expect(rangeToolbar).toBeVisible();
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
