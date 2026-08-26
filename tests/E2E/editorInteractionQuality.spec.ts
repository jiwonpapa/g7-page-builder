import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  authenticateEditorInteractionAdmin,
  cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument,
  EDITOR_INTERACTION_COPY,
  editorInteractionApi,
  recoverOwnedEditorInteractionDocuments,
  type OwnedEditorInteractionDocument,
} from './support/editorInteractionFixture';

const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const API = '/api/modules/jiwonpapa-page_builder/admin';
const CANVAS_IFRAME = '#puck-canvas-root iframe';
const POINTER_EDGE_INSET_PX = 2;
const MIN_POINTER_EDGE_INSET_PX = 0.25;

type RichTextBlockType = 'heading' | 'features' | 'rich-text' | 'article-list';

interface FormattingExpectation {
  font: 'mono' | 'serif';
  size: 'large' | 'xlarge';
  tone: 'accent' | 'custom1';
  weight: 'bold' | 'semibold';
}

test.use({ screenshot: 'off', trace: 'off', video: 'off' });
test.describe.configure({ retries: 0 });

function canvasRichTextSelector(blockType: RichTextBlockType, fieldPath: string): string {
  return `[data-testid="page-builder-block"][data-block-type="${blockType}"] `
    + `[data-g7pb-richtext-field="true"][data-g7pb-inline-field="${fieldPath}"] [contenteditable="true"]`;
}

async function richTextField(page: Page, blockType: RichTextBlockType, fieldPath: string): Promise<Locator> {
  await expect(page.locator(CANVAS_IFRAME)).toHaveCount(1);
  const field = page.frameLocator(CANVAS_IFRAME).locator(`${canvasRichTextSelector(blockType, fieldPath)}:visible`);
  await expect(field).toHaveCount(1);
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
  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const sidebarEditor = page.locator('[contenteditable="true"]:visible');
  if (viewportWidth <= 720 && await sidebarEditor.count()) {
    await page.locator('nav').getByText('Fields', { exact: true }).click();
    await expect(sidebarEditor).toBeHidden();
  }
  const rightSidebarLayout = page.locator('[class*="PuckLayout--rightSideBarVisible"]');
  if (viewportWidth >= 638 && viewportWidth <= 900 && await rightSidebarLayout.count()) {
    await page.getByRole('button', { name: 'Toggle right sidebar' }).click();
    await expect(rightSidebarLayout).toHaveCount(0);
  }
}

interface PointerGeometry {
  end: { x: number; y: number };
  start: { x: number; y: number };
}

async function textPointerGeometry(field: Locator, targetNode: Locator): Promise<PointerGeometry> {
  await field.scrollIntoViewIfNeeded();
  await expect(targetNode).toHaveCount(1);
  const [fieldBox, targetBox, fragments] = await Promise.all([
    field.boundingBox(),
    targetNode.boundingBox(),
    targetNode.evaluate((element) => Array.from(element.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, height: rect.height }))),
  ]);
  if (!fieldBox || !targetBox || fieldBox.width <= 0 || fieldBox.height <= 0
    || targetBox.width <= 0 || targetBox.height <= 0 || fragments.length === 0) {
    throw new Error('Rich-text pointer geometry is unavailable.');
  }
  const targetLeft = targetBox.x - fieldBox.x;
  const targetTop = targetBox.y - fieldBox.y;
  const fragmentLeft = Math.min(...fragments.map((fragment) => fragment.left));
  const fragmentTop = Math.min(...fragments.map((fragment) => fragment.top));
  const first = fragments[0];
  const last = fragments[fragments.length - 1];
  const startInset = Math.min(POINTER_EDGE_INSET_PX,
    Math.max(MIN_POINTER_EDGE_INSET_PX, (first.right - first.left) / 4));
  const endInset = Math.min(POINTER_EDGE_INSET_PX,
    Math.max(MIN_POINTER_EDGE_INSET_PX, (last.right - last.left) / 4));
  if (fragments.length === 1) {
    return {
      start: {
        x: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldBox.width - MIN_POINTER_EDGE_INSET_PX,
            targetLeft + MIN_POINTER_EDGE_INSET_PX)),
        y: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldBox.height - MIN_POINTER_EDGE_INSET_PX,
            targetTop + targetBox.height / 2)),
      },
      end: {
        x: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldBox.width - MIN_POINTER_EDGE_INSET_PX,
            targetLeft + targetBox.width - MIN_POINTER_EDGE_INSET_PX)),
        y: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldBox.height - MIN_POINTER_EDGE_INSET_PX,
            targetTop + targetBox.height / 2)),
      },
    };
  }
  return {
    start: {
      x: Math.max(0.25, Math.min(fieldBox.width - 0.25,
        targetLeft + first.left - fragmentLeft + startInset)),
      y: Math.max(0.25, Math.min(fieldBox.height - 0.25,
        targetTop + first.top - fragmentTop + first.height / 2)),
    },
    end: {
      x: Math.max(0.25, Math.min(fieldBox.width - 0.25,
        targetLeft + last.right - fragmentLeft - endInset)),
      y: Math.max(0.25, Math.min(fieldBox.height - 0.25,
        targetTop + last.top - fragmentTop + last.height / 2)),
    },
  };
}

async function dragSelectText(page: Page, field: Locator, targetNode: Locator, target: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pointer = await textPointerGeometry(field, targetNode);
    if (attempt > 0) await field.click({ position: pointer.end });
    await field.focus();
    await expect.poll(() => selectedText(field)).toBe('');
    await field.hover({ position: pointer.start });
    await page.mouse.down();
    try {
      await field.hover({ position: pointer.end, force: true });
    } finally {
      await page.mouse.up();
    }
    if (await selectedText(field) === target) break;
  }
  await expect(field).toBeFocused();
  await expect.poll(() => selectedText(field)).toBe(target);
}

async function officialPuckMenuRoot(page: Page): Promise<Locator> {
  const menuRoot = page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible');
  await expect(menuRoot).toHaveCount(1);
  await expect(menuRoot).toBeVisible();
  await expect(menuRoot.getByTestId('page-builder-richtext-inline-toolbar')).toBeVisible();
  return menuRoot;
}

async function clickNativeControl(control: Locator, menuRoot: Locator, field: Locator, target: string): Promise<void> {
  await control.click();
  await expect(menuRoot).toBeVisible();
  await expect.poll(() => selectedText(field)).toBe(target);
}

async function chooseRangeOption(
  menuRoot: Locator,
  field: Locator,
  target: string,
  testId: string,
  option: string,
): Promise<void> {
  const trigger = menuRoot.getByTestId(testId);
  const reachability = await trigger.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = element.ownerDocument.elementFromPoint(centerX, centerY);
    return {
      centerHit: hit === element || element.contains(hit),
      fullyVisible: rect.left >= 0 && rect.top >= 0
        && rect.right <= element.ownerDocument.defaultView!.innerWidth
        && rect.bottom <= element.ownerDocument.defaultView!.innerHeight,
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: {
        width: element.ownerDocument.defaultView!.innerWidth,
        height: element.ownerDocument.defaultView!.innerHeight,
      },
    };
  });
  expect(reachability.fullyVisible, `range control is clipped: ${JSON.stringify(reachability)}`).toBe(true);
  expect(reachability.centerHit, `range control is not pointer-reachable: ${JSON.stringify(reachability)}`).toBe(true);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await menuRoot.getByRole('option', { name: option, exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(menuRoot).toBeVisible();
  await expect.poll(() => selectedText(field)).toBe(target);
}

async function applySelectedFormatting(
  menuRoot: Locator,
  field: Locator,
  target: string,
  choices: { font: string; size: string; tone: string; weight: string },
): Promise<void> {
  const bold = menuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true });
  const italic = menuRoot.getByRole('button', { name: '선택한 글자 기울임', exact: true });
  const underline = menuRoot.getByRole('button', { name: '선택한 글자 밑줄', exact: true });
  await clickNativeControl(bold, menuRoot, field, target);
  await clickNativeControl(italic, menuRoot, field, target);
  await clickNativeControl(underline, menuRoot, field, target);
  await chooseRangeOption(menuRoot, field, target, 'page-builder-richtext-font', choices.font);
  await chooseRangeOption(menuRoot, field, target, 'page-builder-richtext-size', choices.size);
  await chooseRangeOption(menuRoot, field, target, 'page-builder-richtext-weight', choices.weight);
  await chooseRangeOption(menuRoot, field, target, 'page-builder-richtext-tone', choices.tone);
}

async function assertSelectedFormatting(
  scope: Locator,
  target: string,
  prefix: string,
  suffix: string,
  expected: FormattingExpectation,
): Promise<void> {
  for (const tag of ['strong', 'em', 'u']) {
    await expect(scope.locator(tag), `${tag} must apply only to the pointer-selected copy`).toHaveCount(1);
    await expect(scope.locator(tag)).toHaveText(target);
  }
  const g7Mark = scope.locator(`span[data-g7pb-font="${expected.font}"][data-g7pb-size="${expected.size}"][data-g7pb-weight="${expected.weight}"][data-g7pb-tone="${expected.tone}"]`);
  await expect(g7Mark).toHaveCount(1);
  await expect(g7Mark).toHaveText(target);
  await expect(scope).toContainText(prefix);
  await expect(scope).toContainText(suffix);
}

async function collapseSelectionWithPointer(field: Locator, targetNode: Locator): Promise<void> {
  const pointer = await textPointerGeometry(field, targetNode);
  await field.click({ position: pointer.end });
  await expect.poll(() => selectedText(field)).toBe('');
}

async function revealSidebarRichTextField(page: Page, label: string, expectedText: string): Promise<Locator> {
  const locateField = (): Locator => page.locator('[contenteditable="true"]:visible').filter({ hasText: expectedText });
  let sidebarField = locateField();
  if (await sidebarField.count() === 0) {
    const fieldsTab = page.locator('nav').getByText('Fields', { exact: true });
    if (await fieldsTab.isVisible()) {
      await fieldsTab.click();
    } else {
      const sidebarToggle = page.getByRole('button', { name: 'Toggle right sidebar' });
      await expect(sidebarToggle).toBeVisible();
      await sidebarToggle.click();
    }
    sidebarField = locateField();
  }
  await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
  await expect(sidebarField).toHaveCount(1);
  await expect(sidebarField).toBeEditable();
  return sidebarField;
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

async function preparePreview(page: Page, documentId: string): Promise<string> {
  const previewLink = page.getByTestId('page-builder-preview-link');
  await expect(previewLink).toBeVisible();
  if (await previewLink.evaluate((element) => element.tagName === 'BUTTON')) {
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === `${API}/documents/${documentId}/preview`);
    await previewLink.click();
    const response = await responsePromise;
    const body = await response.text();
    expect(response.ok(), `preview creation failed (${response.status()}): ${body}`).toBe(true);
  }
  await expect(previewLink).toHaveAttribute('href', /\/modules\/jiwonpapa-page_builder\/preview\/[a-f0-9]{64}/);
  const previewUrl = await previewLink.getAttribute('href');
  if (!previewUrl) throw new Error('Editor interaction preview URL is unavailable.');
  return previewUrl;
}

const ROOT_FORMATTING: FormattingExpectation = {
  font: 'serif', size: 'large', weight: 'bold', tone: 'custom1',
};
const NESTED_FORMATTING: FormattingExpectation = {
  font: 'mono', size: 'xlarge', weight: 'semibold', tone: 'accent',
};

async function assertPersistedEditorState(page: Page): Promise<void> {
  const rootField = await richTextField(page, 'heading', 'heading');
  await assertSelectedFormatting(rootField, EDITOR_INTERACTION_COPY.rootTarget,
    EDITOR_INTERACTION_COPY.rootPrefix, EDITOR_INTERACTION_COPY.rootSuffix, ROOT_FORMATTING);
  const nestedField = await richTextField(page, 'features', 'items.0.title');
  await assertSelectedFormatting(nestedField, EDITOR_INTERACTION_COPY.nestedTarget,
    EDITOR_INTERACTION_COPY.nestedPrefix, EDITOR_INTERACTION_COPY.nestedSuffix, NESTED_FORMATTING);
  await expect(await richTextField(page, 'rich-text', 'content')).toHaveText(EDITOR_INTERACTION_COPY.canvasToSidebar);
  await expect(await richTextField(page, 'article-list', 'items.0.title')).toHaveText(EDITOR_INTERACTION_COPY.articleTitle);
}

async function assertPublishedState(page: Page): Promise<void> {
  const root = page.locator('[data-block-type="heading"]');
  await assertSelectedFormatting(root, EDITOR_INTERACTION_COPY.rootTarget,
    EDITOR_INTERACTION_COPY.rootPrefix, EDITOR_INTERACTION_COPY.rootSuffix, ROOT_FORMATTING);
  const nested = page.locator('[data-block-type="features"] h3').first();
  await assertSelectedFormatting(nested, EDITOR_INTERACTION_COPY.nestedTarget,
    EDITOR_INTERACTION_COPY.nestedPrefix, EDITOR_INTERACTION_COPY.nestedSuffix, NESTED_FORMATTING);
  await expect(page.locator('[data-block-type="rich-text"]')).toContainText(EDITOR_INTERACTION_COPY.canvasToSidebar);
  const articleHeading = page.locator('[data-block-type="article-list"] h3').first();
  await expect(articleHeading.locator('a')).toHaveCount(1);
  await expect(articleHeading.locator('a')).toHaveText(EDITOR_INTERACTION_COPY.articleTitle);
  await expect(articleHeading.locator('a a')).toHaveCount(0);
}

test('keeps root, nested, block, and no-link rich text pointer editing persistent and publishable', async ({ context, page }, testInfo) => {
  test.setTimeout(240_000);
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
    await test.step('POINTER_CANVAS_GATE', async () => {
      await exposeCanvasForPointer(page);
    });
    await test.step('INTERACTIVE_CANVAS_GATE', async () => {
      await assertInteractiveCanvas(page);
    });
    await test.step('TABLET_HEADER_HEIGHT_GATE', async () => {
      await assertTabletHeaderHeight(page, testInfo.project.name);
    });

    let rootField = await richTextField(page, 'heading', 'heading');
    let rootTarget = rootField.locator('a[href="/richtext-root"]');
    await test.step('REAL_POINTER_SELECTION_GATE', async () => {
      await dragSelectText(page, rootField, rootTarget, EDITOR_INTERACTION_COPY.rootTarget);
    });
    let menuRoot: Locator;
    await test.step('OFFICIAL_PUCK_MENU_ROOT_GATE', async () => {
      menuRoot = await officialPuckMenuRoot(page);
      await expect(menuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true })).toBeVisible();
      await expect(menuRoot.getByRole('button', { name: '선택한 글자 기울임', exact: true })).toBeVisible();
      await expect(menuRoot.getByRole('button', { name: '선택한 글자 밑줄', exact: true })).toBeVisible();
    });
    await test.step('ROOT_INLINE_RICH_GATE', async () => {
      menuRoot = await officialPuckMenuRoot(page);
      await applySelectedFormatting(menuRoot, rootField, EDITOR_INTERACTION_COPY.rootTarget, {
        font: '명조', size: 'L', weight: '매우 굵게', tone: '사용자색 1',
      });
      await assertSelectedFormatting(rootField, EDITOR_INTERACTION_COPY.rootTarget,
        EDITOR_INTERACTION_COPY.rootPrefix, EDITOR_INTERACTION_COPY.rootSuffix, ROOT_FORMATTING);
    });
    const elementPanel = page.getByTestId('page-builder-context-panel');
    await test.step('RANGE_TOOLBAR_EXCLUSIVE_GATE', async () => {
      menuRoot = await officialPuckMenuRoot(page);
      await expect(elementPanel).toBeHidden();
      await expect.poll(() => selectedText(rootField)).toBe(EDITOR_INTERACTION_COPY.rootTarget);
    });
    await test.step('COLLAPSED_SELECTION_GATE', async () => {
      await collapseSelectionWithPointer(rootField, rootTarget);
      await expect(page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible')).toHaveCount(0);
      await expect(elementPanel).toBeVisible();
      await page.getByTestId('page-builder-editor').click({ position: { x: 8, y: 8 } });
      await expect(page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible')).toHaveCount(0);
      await expect(elementPanel).toBeHidden();
    });
    await test.step('REPEATED_SELECTION_GATE', async () => {
      rootField = await richTextField(page, 'heading', 'heading');
      rootTarget = rootField.locator('a[href="/richtext-root"]');
      await dragSelectText(page, rootField, rootTarget, EDITOR_INTERACTION_COPY.rootTarget);
      await expect(await officialPuckMenuRoot(page)).toBeVisible();
      await collapseSelectionWithPointer(rootField, rootTarget);
    });

    await test.step('NESTED_INLINE_RICH_GATE', async () => {
      const nestedField = await richTextField(page, 'features', 'items.0.title');
      const nestedTarget = nestedField.locator('a[href="/richtext-nested"]');
      await dragSelectText(page, nestedField, nestedTarget, EDITOR_INTERACTION_COPY.nestedTarget);
      const nestedMenuRoot = await officialPuckMenuRoot(page);
      await expect(elementPanel).toBeHidden();
      await applySelectedFormatting(nestedMenuRoot, nestedField, EDITOR_INTERACTION_COPY.nestedTarget, {
        font: '고정폭', size: 'XL', weight: '굵게', tone: '강조색',
      });
      await assertSelectedFormatting(nestedField, EDITOR_INTERACTION_COPY.nestedTarget,
        EDITOR_INTERACTION_COPY.nestedPrefix, EDITOR_INTERACTION_COPY.nestedSuffix, NESTED_FORMATTING);
      await collapseSelectionWithPointer(nestedField, nestedTarget);
    });

    await test.step('NO_LINK_INLINE_GATE', async () => {
      const articleField = await richTextField(page, 'article-list', 'items.0.title');
      const articleTarget = articleField.locator('p').filter({ hasText: new RegExp(`^${EDITOR_INTERACTION_COPY.articleTitle}$`) });
      await dragSelectText(page, articleField, articleTarget, EDITOR_INTERACTION_COPY.articleTitle);
      const articleMenuRoot = await officialPuckMenuRoot(page);
      await expect(articleMenuRoot.getByRole('button', { name: '링크 편집', exact: true })).toHaveCount(0);
      await expect(articleMenuRoot.getByRole('button', { name: 'Link', exact: true })).toHaveCount(0);
      await expect(articleMenuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true })).toBeVisible();
      await collapseSelectionWithPointer(articleField, articleTarget);
    });

    await test.step('BIDIRECTIONAL_SIDEBAR_TO_CANVAS_GATE', async () => {
      const blockField = await richTextField(page, 'rich-text', 'content');
      await blockField.click({ position: { x: 4, y: 4 } });
      const sidebarField = await revealSidebarRichTextField(page, '본문', EDITOR_INTERACTION_COPY.blockInitial);
      await expect(sidebarField).toContainText(EDITOR_INTERACTION_COPY.blockInitial);
      await sidebarField.fill(EDITOR_INTERACTION_COPY.sidebarToCanvas);
      await expect(blockField).toHaveText(EDITOR_INTERACTION_COPY.sidebarToCanvas);
    });
    await test.step('BLOCK_RICH_GATE', async () => {
      await exposeCanvasForPointer(page);
      const blockField = await richTextField(page, 'rich-text', 'content');
      const blockTarget = blockField.locator('p').filter({ hasText: new RegExp(`^${EDITOR_INTERACTION_COPY.sidebarToCanvas}$`) });
      await dragSelectText(page, blockField, blockTarget, EDITOR_INTERACTION_COPY.sidebarToCanvas);
      await expect(await officialPuckMenuRoot(page)).toBeVisible();
      await expect(elementPanel).toBeHidden();
      await page.keyboard.type(EDITOR_INTERACTION_COPY.canvasToSidebar);
      await expect(blockField).toHaveText(EDITOR_INTERACTION_COPY.canvasToSidebar);
    });
    await test.step('BIDIRECTIONAL_CANVAS_TO_SIDEBAR_GATE', async () => {
      const sidebarField = await revealSidebarRichTextField(page, '본문', EDITOR_INTERACTION_COPY.canvasToSidebar);
      await expect(sidebarField).toHaveText(EDITOR_INTERACTION_COPY.canvasToSidebar);
    });

    await saveDraft(page);
    await test.step('PERSISTED_SELECTION_MARK_GATE', async () => {
      await page.reload();
      await expect(page.getByTestId('page-builder-editor')).toBeVisible();
      await assertPersistedEditorState(page);
    });

    const previewUrl = await preparePreview(page, owned.documentId);
    const preview = await context.newPage();
    expect((await preview.goto(previewUrl))?.ok()).toBe(true);
    await test.step('PREVIEW_SELECTION_MARK_GATE', async () => {
      await assertPublishedState(preview);
    });
    await preview.close();

    await publish(page);
    const publicUrl = await page.getByTestId('page-builder-public-link').getAttribute('href');
    if (!publicUrl) throw new Error('Editor interaction public URL is unavailable.');
    const published = await context.newPage();
    expect((await published.goto(publicUrl))?.ok()).toBe(true);
    await test.step('PUBLIC_SELECTION_MARK_GATE', async () => {
      await assertPublishedState(published);
    });
    await published.close();
  } finally {
    await page.close();
    if (owned) await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});
