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
const POINTER_DRAG_STEPS = 8;

type RichTextBlockType = 'heading' | 'features' | 'rich-text' | 'article-list';

interface FormattingExpectation {
  font: 'mono' | 'serif';
  size: 'large' | 'xlarge';
  tone: 'accent' | 'custom1';
  weight: 'bold' | 'semibold';
}

test.use({ screenshot: 'only-on-failure', trace: 'off', video: 'off' });
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
  const menuToggle = page.getByRole('button', { name: 'Toggle menu bar' });
  let openedMenu = false;
  if (!(await button.isVisible())) {
    await menuToggle.click();
    openedMenu = true;
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
  if (openedMenu) {
    const viewportSwitcher = page.locator('.g7pb-viewport-switcher');
    const [toggleBox, switcherBox] = await Promise.all([
      menuToggle.boundingBox(),
      viewportSwitcher.boundingBox(),
    ]);
    if (!toggleBox || !switcherBox) throw new Error('Mobile header control geometry is unavailable.');
    const overlaps = toggleBox.x < switcherBox.x + switcherBox.width
      && toggleBox.x + toggleBox.width > switcherBox.x
      && toggleBox.y < switcherBox.y + switcherBox.height
      && toggleBox.y + toggleBox.height > switcherBox.y;
    expect(overlaps, 'mobile viewport switcher must not overlap the Puck menu toggle').toBe(false);
    const toggleReachable = await menuToggle.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = element.ownerDocument.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit === element || element.contains(hit);
    });
    expect(toggleReachable, 'mobile Puck menu toggle must remain pointer-reachable').toBe(true);
    await menuToggle.click();
    await expect(viewportSwitcher).toBeHidden();
  }
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
  localEnd: { x: number; y: number };
  localStart: { x: number; y: number };
  start: { x: number; y: number };
}

interface PointerPoint {
  x: number;
  y: number;
}

interface RichTextSelectionLocator {
  blockType: RichTextBlockType;
  fieldPath: string;
  locateTarget: (field: Locator) => Locator;
}

async function resolveRichTextSelection(page: Page, selection: RichTextSelectionLocator): Promise<{
  field: Locator;
  targetNode: Locator;
}> {
  const field = await richTextField(page, selection.blockType, selection.fieldPath);
  const targetNode = selection.locateTarget(field);
  await expect(targetNode).toHaveCount(1);
  await expect(targetNode).toBeVisible();
  return { field, targetNode };
}

async function textPointerGeometry(field: Locator, targetNode: Locator): Promise<PointerGeometry> {
  await field.scrollIntoViewIfNeeded();
  await expect(targetNode).toHaveCount(1);
  const [fieldBox, targetBox, fieldRect, fragments] = await Promise.all([
    field.boundingBox(),
    targetNode.boundingBox(),
    field.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
    targetNode.evaluate((element) => Array.from(element.getClientRects())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, height: rect.height }))),
  ]);
  if (!fieldBox || !targetBox || fieldBox.width <= 0 || fieldBox.height <= 0
    || targetBox.width <= 0 || targetBox.height <= 0 || fieldRect.width <= 0 || fieldRect.height <= 0
    || fragments.length === 0) {
    throw new Error('Rich-text pointer geometry is unavailable.');
  }
  const scaleX = fieldBox.width / fieldRect.width;
  const scaleY = fieldBox.height / fieldRect.height;
  const targetLeft = (targetBox.x - fieldBox.x) / scaleX;
  const targetTop = (targetBox.y - fieldBox.y) / scaleY;
  const fragmentLeft = Math.min(...fragments.map((fragment) => fragment.left));
  const fragmentTop = Math.min(...fragments.map((fragment) => fragment.top));
  const first = fragments[0];
  const last = fragments[fragments.length - 1];
  const startInset = Math.min(POINTER_EDGE_INSET_PX,
    Math.max(MIN_POINTER_EDGE_INSET_PX, (first.right - first.left) / 4));
  const endInset = Math.min(POINTER_EDGE_INSET_PX,
    Math.max(MIN_POINTER_EDGE_INSET_PX, (last.right - last.left) / 4));
  const local = fragments.length === 1
    ? {
      start: {
        x: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldRect.width - MIN_POINTER_EDGE_INSET_PX,
            targetLeft + startInset)),
        y: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldRect.height - MIN_POINTER_EDGE_INSET_PX,
            targetTop + targetBox.height / scaleY / 2)),
      },
      end: {
        x: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldRect.width - MIN_POINTER_EDGE_INSET_PX,
            targetLeft + targetBox.width / scaleX - endInset)),
        y: Math.max(MIN_POINTER_EDGE_INSET_PX,
          Math.min(fieldRect.height - MIN_POINTER_EDGE_INSET_PX,
            targetTop + targetBox.height / scaleY / 2)),
      },
    }
    : {
      start: {
        x: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.width - MIN_POINTER_EDGE_INSET_PX,
          targetLeft + first.left - fragmentLeft + startInset)),
        y: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.height - MIN_POINTER_EDGE_INSET_PX,
          targetTop + first.top - fragmentTop + first.height / 2)),
      },
      end: {
        x: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.width - MIN_POINTER_EDGE_INSET_PX,
          targetLeft + last.right - fragmentLeft - endInset)),
        y: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.height - MIN_POINTER_EDGE_INSET_PX,
          targetTop + last.top - fragmentTop + last.height / 2)),
      },
    };
  return {
    localStart: local.start,
    localEnd: local.end,
    start: { x: fieldBox.x + local.start.x * scaleX, y: fieldBox.y + local.start.y * scaleY },
    end: {
      x: fieldBox.x + local.end.x * scaleX,
      y: fieldBox.y + local.end.y * scaleY,
    },
  };
}

async function assertTextPointerReachable(page: Page, field: Locator, pointer: PointerGeometry): Promise<void> {
  const topDocumentHits = await page.evaluate(({ start, end, iframeSelector }) => {
    const iframe = document.querySelector(iframeSelector);
    return {
      start: document.elementFromPoint(start.x, start.y) === iframe,
      end: document.elementFromPoint(end.x, end.y) === iframe,
    };
  }, { start: pointer.start, end: pointer.end, iframeSelector: CANVAS_IFRAME });
  expect(topDocumentHits.start, 'pointer start must hit the Puck canvas iframe').toBe(true);
  expect(topDocumentHits.end, 'pointer end must hit the Puck canvas iframe').toBe(true);

  const canvasHits = await field.evaluate((element, points) => {
    const rect = element.getBoundingClientRect();
    const startHit = element.ownerDocument.elementFromPoint(
      rect.left + points.start.x,
      rect.top + points.start.y,
    );
    const endHit = element.ownerDocument.elementFromPoint(
      rect.left + points.end.x,
      rect.top + points.end.y,
    );
    return {
      start: startHit === element || element.contains(startHit),
      end: endHit === element || element.contains(endHit),
    };
  }, { start: pointer.localStart, end: pointer.localEnd });
  expect(canvasHits.start, 'pointer start must hit the current rich-text field').toBe(true);
  expect(canvasHits.end, 'pointer end must hit the current rich-text field').toBe(true);
}

async function findTextPointerEnd(page: Page, field: Locator, pointer: PointerGeometry): Promise<PointerPoint> {
  const ratios = [0, 0.125, 0.25, 0.5, 0.75];
  const candidates = ratios.map((ratio) => ({
    page: {
      x: pointer.end.x + (pointer.start.x - pointer.end.x) * ratio,
      y: pointer.end.y + (pointer.start.y - pointer.end.y) * ratio,
    },
    local: {
      x: pointer.localEnd.x + (pointer.localStart.x - pointer.localEnd.x) * ratio,
      y: pointer.localEnd.y + (pointer.localStart.y - pointer.localEnd.y) * ratio,
    },
  }));
  const topDocumentHits = await page.evaluate(({ points, iframeSelector }) => {
    const iframe = document.querySelector(iframeSelector);
    return points.map((point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        hit: hit === iframe,
        tag: hit?.tagName ?? '',
        className: hit instanceof HTMLElement ? hit.className : '',
      };
    });
  }, { points: candidates.map((candidate) => candidate.page), iframeSelector: CANVAS_IFRAME });

  const canvasHits = await field.evaluate((element, points) => {
    const rect = element.getBoundingClientRect();
    return points.map((point) => {
      const hit = element.ownerDocument.elementFromPoint(
        rect.left + point.x,
        rect.top + point.y,
      );
      return {
        hit: hit === element || element.contains(hit),
        tag: hit?.tagName ?? '',
        className: hit instanceof HTMLElement ? hit.className : '',
      };
    });
  }, candidates.map((candidate) => candidate.local));
  const reachableIndex = candidates.findIndex((_, index) => (
    topDocumentHits[index]?.hit === true && canvasHits[index]?.hit === true
  ));
  if (reachableIndex < 0) {
    throw new Error(`no current rich-text field pixel is pointer-reachable: ${JSON.stringify({
      candidates,
      topDocumentHits,
      canvasHits,
    })}`);
  }
  return candidates[reachableIndex].page;
}

async function dragSelectText(
  page: Page,
  selection: RichTextSelectionLocator,
  target: string,
): Promise<Locator> {
  let lastFailure: unknown = new Error(`Pointer selection did not produce the exact target: ${target}`);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let pointerDown = false;
    try {
      const { field, targetNode } = await resolveRichTextSelection(page, selection);
      const pointer = await textPointerGeometry(field, targetNode);
      await assertTextPointerReachable(page, field, pointer);
      if (attempt > 0) await page.mouse.click(pointer.end.x, pointer.end.y);
      await field.focus();
      await expect.poll(() => selectedText(field)).toBe('');
      await page.mouse.move(pointer.start.x, pointer.start.y);
      await page.mouse.down();
      pointerDown = true;
      await page.mouse.move(pointer.end.x, pointer.end.y, { steps: POINTER_DRAG_STEPS });
      await page.mouse.up();
      pointerDown = false;
      const actual = await selectedText(field);
      if (actual !== target) {
        lastFailure = new Error(`Pointer selection mismatch: expected ${target}, received ${actual}`);
        continue;
      }
      await expect(field).toBeFocused();
      await expect.poll(() => selectedText(field)).toBe(target);
      return field;
    } catch (error) {
      lastFailure = error;
    } finally {
      if (pointerDown) await page.mouse.up();
    }
  }
  throw lastFailure;
}

async function officialPuckMenuRoot(page: Page): Promise<Locator> {
  const menuRoot = page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible');
  await expect(menuRoot).toHaveCount(1);
  await expect(menuRoot).toBeVisible();
  await expect(menuRoot.getByTestId('page-builder-richtext-inline-toolbar')).toBeVisible();
  return menuRoot;
}

async function assertPointerReachable(page: Page, control: Locator): Promise<PointerPoint> {
  await control.scrollIntoViewIfNeeded();
  const [controlBox, iframeBox] = await Promise.all([
    control.boundingBox(),
    page.locator(CANVAS_IFRAME).boundingBox(),
  ]);
  if (!controlBox || !iframeBox) throw new Error('Range control frame geometry is unavailable.');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Range control viewport geometry is unavailable.');
  const visible = {
    left: Math.max(0, iframeBox.x, controlBox.x),
    top: Math.max(0, iframeBox.y, controlBox.y),
    right: Math.min(viewport.width, iframeBox.x + iframeBox.width, controlBox.x + controlBox.width),
    bottom: Math.min(viewport.height, iframeBox.y + iframeBox.height, controlBox.y + controlBox.height),
  };
  if (visible.right <= visible.left || visible.bottom <= visible.top) {
    throw new Error(`range control has no visible iframe intersection: ${JSON.stringify({ controlBox, iframeBox, viewport })}`);
  }
  const insetX = Math.min(4, (visible.right - visible.left) / 2);
  const insetY = Math.min(4, (visible.bottom - visible.top) / 2);
  const candidates = [
    { x: (visible.left + visible.right) / 2, y: (visible.top + visible.bottom) / 2 },
    { x: visible.left + insetX, y: visible.top + insetY },
    { x: visible.right - insetX, y: visible.top + insetY },
    { x: visible.left + insetX, y: visible.bottom - insetY },
    { x: visible.right - insetX, y: visible.bottom - insetY },
  ];
  const topDocumentReachability = await page.evaluate(({ points, iframeSelector }) => {
    const iframe = document.querySelector(iframeSelector);
    return points.map((point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return {
        hit: hit === iframe,
        tag: hit?.tagName ?? '',
        className: hit instanceof HTMLElement ? hit.className : '',
      };
    });
  }, { points: candidates, iframeSelector: CANVAS_IFRAME });
  const canvasReachability = await control.evaluate((element, geometry) => {
    const view = element.ownerDocument.defaultView;
    if (!view || view.innerWidth <= 0 || view.innerHeight <= 0) return [];
    const scaleX = geometry.iframeBox.width / view.innerWidth;
    const scaleY = geometry.iframeBox.height / view.innerHeight;
    return geometry.points.map((point) => {
      const hit = element.ownerDocument.elementFromPoint(
        (point.x - geometry.iframeBox.x) / scaleX,
        (point.y - geometry.iframeBox.y) / scaleY,
      );
      return {
        hit: hit === element || element.contains(hit),
        tag: hit?.tagName ?? '',
        className: hit instanceof HTMLElement ? hit.className : '',
      };
    });
  }, { points: candidates, iframeBox });
  const reachableIndex = candidates.findIndex((_, index) => (
    topDocumentReachability[index]?.hit === true && canvasReachability[index]?.hit === true
  ));
  if (reachableIndex < 0) {
    throw new Error(`range control has no pointer-reachable pixel: ${JSON.stringify({
      controlBox,
      iframeBox,
      viewport,
      candidates,
      topDocumentReachability,
      canvasReachability,
    })}`);
  }
  return candidates[reachableIndex];
}

async function activateControl(page: Page, point: PointerPoint, projectName: string): Promise<void> {
  if (projectName === 'mobile') {
    await page.touchscreen.tap(point.x, point.y);
    return;
  }
  await page.mouse.click(point.x, point.y);
}

async function clickNativeControl(
  page: Page,
  control: Locator,
  menuRoot: Locator,
  field: Locator,
  target: string,
  tag: 'em' | 'strong' | 'u',
  projectName: string,
): Promise<void> {
  const point = await assertPointerReachable(page, control);
  await activateControl(page, point, projectName);
  await expect(menuRoot).toBeVisible();
  await expect.poll(() => selectedText(field)).toBe(target);
  await expect(field.locator(tag), `${tag} must apply immediately to the pointer-selected copy`).toHaveCount(1);
  await expect(field.locator(tag)).toHaveText(target);
}

async function chooseRangeOption(
  page: Page,
  menuRoot: Locator,
  field: Locator,
  target: string,
  testId: string,
  option: string,
  markAttribute: keyof FormattingExpectation,
  markValue: string,
  projectName: string,
): Promise<void> {
  const trigger = menuRoot.getByTestId(testId);
  const triggerPoint = await assertPointerReachable(page, trigger);
  await activateControl(page, triggerPoint, projectName);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const optionControl = menuRoot.getByRole('option', { name: option, exact: true });
  const optionPoint = await assertPointerReachable(page, optionControl);
  await expect.poll(() => selectedText(field)).toBe(target);
  await activateControl(page, optionPoint, projectName);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(menuRoot).toBeVisible();
  await expect.poll(() => selectedText(field)).toBe(target);
  const appliedMark = field.locator(`span[data-g7pb-${markAttribute}="${markValue}"]`);
  await expect(appliedMark, `${markAttribute} must apply before the next range option tap`).toHaveCount(1);
  await expect(appliedMark).toHaveText(target);
}

async function applySelectedFormatting(
  page: Page,
  menuRoot: Locator,
  field: Locator,
  target: string,
  choices: { font: string; size: string; tone: string; weight: string },
  expected: FormattingExpectation,
  projectName: string,
): Promise<void> {
  const bold = menuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true });
  const italic = menuRoot.getByRole('button', { name: '선택한 글자 기울임', exact: true });
  const underline = menuRoot.getByRole('button', { name: '선택한 글자 밑줄', exact: true });
  await expect(bold).toHaveCount(1);
  await expect(italic).toHaveCount(1);
  await expect(underline).toHaveCount(1);
  await clickNativeControl(page, bold, menuRoot, field, target, 'strong', projectName);
  await clickNativeControl(page, italic, menuRoot, field, target, 'em', projectName);
  await clickNativeControl(page, underline, menuRoot, field, target, 'u', projectName);
  await chooseRangeOption(page, menuRoot, field, target,
    'page-builder-richtext-font', choices.font, 'font', expected.font, projectName);
  await chooseRangeOption(page, menuRoot, field, target,
    'page-builder-richtext-size', choices.size, 'size', expected.size, projectName);
  await chooseRangeOption(page, menuRoot, field, target,
    'page-builder-richtext-weight', choices.weight, 'weight', expected.weight, projectName);
  await chooseRangeOption(page, menuRoot, field, target,
    'page-builder-richtext-tone', choices.tone, 'tone', expected.tone, projectName);
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

async function collapseSelectionWithPointer(
  page: Page,
  selection: RichTextSelectionLocator,
): Promise<void> {
  let lastFailure: unknown = new Error('Pointer selection did not collapse.');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { field, targetNode } = await resolveRichTextSelection(page, selection);
      const pointer = await textPointerGeometry(field, targetNode);
      const point = await findTextPointerEnd(page, field, pointer);
      await page.mouse.click(point.x, point.y);
      await expect.poll(() => selectedText(field)).toBe('');
      return;
    } catch (error) {
      lastFailure = error;
    }
  }
  throw lastFailure;
}

async function revealSidebarRichTextField(page: Page, expectedText: string): Promise<Locator> {
  const locateField = (): Locator => page.locator('[contenteditable="true"]:visible');
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
  await expect(sidebarField).toHaveCount(1);
  await expect(sidebarField).toBeEditable();
  await expect(sidebarField).toHaveText(expectedText);
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
  await publishButton.scrollIntoViewIfNeeded();
  await expect(publishButton).toBeEnabled();
  await publishButton.click();
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

    const rootSelection: RichTextSelectionLocator = {
      blockType: 'heading',
      fieldPath: 'heading',
      locateTarget: (field) => field.locator('a[href="/richtext-root"]'),
    };
    let rootField = await test.step('REAL_POINTER_SELECTION_GATE', async () => (
      dragSelectText(page, rootSelection, EDITOR_INTERACTION_COPY.rootTarget)
    ));
    let menuRoot: Locator;
    await test.step('OFFICIAL_PUCK_MENU_ROOT_GATE', async () => {
      menuRoot = await officialPuckMenuRoot(page);
      await expect(menuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true })).toBeVisible();
      await expect(menuRoot.getByRole('button', { name: '선택한 글자 기울임', exact: true })).toBeVisible();
      await expect(menuRoot.getByRole('button', { name: '선택한 글자 밑줄', exact: true })).toBeVisible();
    });
    await test.step('ROOT_INLINE_RICH_GATE', async () => {
      menuRoot = await officialPuckMenuRoot(page);
      await applySelectedFormatting(page, menuRoot, rootField, EDITOR_INTERACTION_COPY.rootTarget, {
        font: '명조', size: 'L', weight: '매우 굵게', tone: '사용자색 1',
      }, ROOT_FORMATTING, testInfo.project.name);
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
      await collapseSelectionWithPointer(page, rootSelection);
      await expect(page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible')).toHaveCount(0);
      await expect(elementPanel).toBeVisible();
      await page.getByTestId('page-builder-editor').click({ position: { x: 8, y: 8 } });
      await expect(page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible')).toHaveCount(0);
      await expect(elementPanel).toBeHidden();
    });
    await test.step('REPEATED_SELECTION_GATE', async () => {
      rootField = await dragSelectText(page, rootSelection, EDITOR_INTERACTION_COPY.rootTarget);
      await expect(await officialPuckMenuRoot(page)).toBeVisible();
      await collapseSelectionWithPointer(page, rootSelection);
    });

    await test.step('NESTED_INLINE_RICH_GATE', async () => {
      const nestedSelection: RichTextSelectionLocator = {
        blockType: 'features',
        fieldPath: 'items.0.title',
        locateTarget: (field) => field.locator('a[href="/richtext-nested"]'),
      };
      const nestedField = await dragSelectText(page, nestedSelection, EDITOR_INTERACTION_COPY.nestedTarget);
      const nestedMenuRoot = await officialPuckMenuRoot(page);
      await expect(elementPanel).toBeHidden();
      await applySelectedFormatting(page, nestedMenuRoot, nestedField, EDITOR_INTERACTION_COPY.nestedTarget, {
        font: '고정폭', size: 'XL', weight: '굵게', tone: '강조색',
      }, NESTED_FORMATTING, testInfo.project.name);
      await assertSelectedFormatting(nestedField, EDITOR_INTERACTION_COPY.nestedTarget,
        EDITOR_INTERACTION_COPY.nestedPrefix, EDITOR_INTERACTION_COPY.nestedSuffix, NESTED_FORMATTING);
      await collapseSelectionWithPointer(page, nestedSelection);
    });

    await test.step('NO_LINK_INLINE_GATE', async () => {
      const articleSelection: RichTextSelectionLocator = {
        blockType: 'article-list',
        fieldPath: 'items.0.title',
        locateTarget: (field) => field.locator('p')
          .filter({ hasText: new RegExp(`^${EDITOR_INTERACTION_COPY.articleTitle}$`) }),
      };
      await dragSelectText(page, articleSelection, EDITOR_INTERACTION_COPY.articleTitle);
      const articleMenuRoot = await officialPuckMenuRoot(page);
      await expect(articleMenuRoot.getByRole('button', { name: '링크 편집', exact: true })).toHaveCount(0);
      await expect(articleMenuRoot.getByRole('button', { name: 'Link', exact: true })).toHaveCount(0);
      await expect(articleMenuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true })).toBeVisible();
      await collapseSelectionWithPointer(page, articleSelection);
    });

    await test.step('BIDIRECTIONAL_SIDEBAR_TO_CANVAS_GATE', async () => {
      const blockField = await richTextField(page, 'rich-text', 'content');
      await blockField.click({ position: { x: 4, y: 4 } });
      const sidebarField = await revealSidebarRichTextField(page, EDITOR_INTERACTION_COPY.blockInitial);
      await expect(sidebarField).toContainText(EDITOR_INTERACTION_COPY.blockInitial);
      await sidebarField.fill(EDITOR_INTERACTION_COPY.sidebarToCanvas);
      await expect(blockField).toHaveText(EDITOR_INTERACTION_COPY.sidebarToCanvas);
    });
    await test.step('BLOCK_RICH_GATE', async () => {
      await exposeCanvasForPointer(page);
      const blockSelection: RichTextSelectionLocator = {
        blockType: 'rich-text',
        fieldPath: 'content',
        locateTarget: (field) => field.locator('p')
          .filter({ hasText: new RegExp(`^${EDITOR_INTERACTION_COPY.sidebarToCanvas}$`) }),
      };
      const blockField = await dragSelectText(page, blockSelection, EDITOR_INTERACTION_COPY.sidebarToCanvas);
      await expect(await officialPuckMenuRoot(page)).toBeVisible();
      await expect(elementPanel).toBeHidden();
      await page.keyboard.type(EDITOR_INTERACTION_COPY.canvasToSidebar);
      await expect(blockField).toHaveText(EDITOR_INTERACTION_COPY.canvasToSidebar);
    });
    await test.step('BIDIRECTIONAL_CANVAS_TO_SIDEBAR_GATE', async () => {
      const sidebarField = await revealSidebarRichTextField(page, EDITOR_INTERACTION_COPY.canvasToSidebar);
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
