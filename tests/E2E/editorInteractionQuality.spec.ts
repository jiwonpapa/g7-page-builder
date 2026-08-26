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
const CANVAS_VIEWPORT_WIDTHS = [360, 768, 1280] as const;
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
  return field.evaluate((element) => {
    const selection = element.ownerDocument.defaultView?.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return '';
    const belongsToField = (node: Node | null): boolean => (
      node !== null && (node === element || element.contains(node))
    );
    if (!belongsToField(selection.anchorNode) || !belongsToField(selection.focusNode)) return '';
    return selection.toString();
  });
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

async function openElementPanelFromActionBar(page: Page, projectName: string): Promise<void> {
  const textToolsButton = page.frameLocator(CANVAS_IFRAME)
    .getByTestId('page-builder-text-tools-open')
    .locator('xpath=ancestor::button[1]');
  await expect(textToolsButton).toHaveCount(1);
  await expect(textToolsButton).toBeVisible();
  await assertPointerReachable(page, textToolsButton);
  await activateControl(projectName, textToolsButton);
}

async function setCanvasViewportWidth(
  page: Page,
  width: typeof CANVAS_VIEWPORT_WIDTHS[number],
): Promise<void> {
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

async function setCanvasViewport(page: Page, projectName: string): Promise<void> {
  const width = projectName === 'mobile' ? 360 : projectName === 'tablet' ? 768 : 1280;
  await setCanvasViewportWidth(page, width);
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

async function textPointerGeometry(field: Locator, targetNode: Locator, attempt: number): Promise<PointerGeometry> {
  await field.scrollIntoViewIfNeeded();
  await expect(targetNode).toHaveCount(1);
  const [fieldBox, targetBox, fieldRect, pointerCandidates] = await Promise.all([
    field.boundingBox(),
    targetNode.boundingBox(),
    field.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }),
    targetNode.evaluate((element) => {
      const ownerDocument = element.ownerDocument;
      const fieldRoot = element.closest<HTMLElement>('[contenteditable="true"]');
      if (!fieldRoot) return { end: [], start: [], targetEnd: -1, targetStart: -1 };
      const targetWalker = ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const targetTextNodes: Text[] = [];
      let targetNode = targetWalker.nextNode();
      while (targetNode) {
        if ((targetNode.textContent ?? '').length > 0) targetTextNodes.push(targetNode as Text);
        targetNode = targetWalker.nextNode();
      }
      if (targetTextNodes.length === 0) return { end: [], start: [], targetEnd: -1, targetStart: -1 };
      const firstNode = targetTextNodes[0];
      const lastNode = targetTextNodes[targetTextNodes.length - 1];
      const fieldOffset = (node: Node, offset: number): number => {
        const range = ownerDocument.createRange();
        range.selectNodeContents(fieldRoot);
        range.setEnd(node, offset);
        return range.toString().length;
      };
      const targetStart = fieldOffset(firstNode, 0);
      const targetEnd = fieldOffset(lastNode, lastNode.length);
      const firstCharacter = ownerDocument.createRange();
      firstCharacter.setStart(firstNode, 0);
      firstCharacter.setEnd(firstNode, Math.min(1, firstNode.length));
      const lastCharacter = ownerDocument.createRange();
      lastCharacter.setStart(lastNode, Math.max(0, lastNode.length - 1));
      lastCharacter.setEnd(lastNode, lastNode.length);
      const firstRect = firstCharacter.getClientRects()[0];
      const lastRects = lastCharacter.getClientRects();
      const lastRect = lastRects[lastRects.length - 1];
      if (!firstRect || !lastRect) return { end: [], start: [], targetEnd, targetStart };
      const caretOffsetAt = (x: number, y: number): number | null => {
        const caretDocument = ownerDocument as Document & {
          caretPositionFromPoint?: (clientX: number, clientY: number) => { offsetNode: Node; offset: number } | null;
          caretRangeFromPoint?: (clientX: number, clientY: number) => Range | null;
        };
        const position = caretDocument.caretPositionFromPoint?.(x, y);
        const range = position ? null : caretDocument.caretRangeFromPoint?.(x, y);
        const node = position?.offsetNode ?? range?.startContainer ?? null;
        const offset = position?.offset ?? range?.startOffset ?? -1;
        if (!node || offset < 0 || !(node === fieldRoot || fieldRoot.contains(node))) return null;
        return fieldOffset(node, offset);
      };
      const candidates = (
        rect: DOMRect,
        fractions: readonly number[],
        expectedOffset: number,
      ): Array<{ x: number; y: number }> => {
        const verticalFractions = [0.5, 0.35, 0.65];
        return verticalFractions.flatMap((vertical) => fractions.map((horizontal) => ({
          x: rect.left + rect.width * horizontal,
          y: rect.top + rect.height * vertical,
        }))).filter((point) => caretOffsetAt(point.x, point.y) === expectedOffset);
      };
      return {
        start: candidates(firstRect, [0.05, 0.15, 0.25, 0.35, 0.45], targetStart),
        end: candidates(lastRect, [0.95, 0.85, 0.75, 0.65, 0.55], targetEnd),
        targetEnd,
        targetStart,
      };
    }),
  ]);
  if (!fieldBox || !targetBox || fieldBox.width <= 0 || fieldBox.height <= 0
    || targetBox.width <= 0 || targetBox.height <= 0 || fieldRect.width <= 0 || fieldRect.height <= 0
    || pointerCandidates.start.length === 0 || pointerCandidates.end.length === 0) {
    throw new Error(`Rich-text exact caret geometry is unavailable: ${JSON.stringify({
      fieldBox,
      targetBox,
      fieldRect,
      pointerCandidates,
    })}`);
  }
  const scaleX = fieldBox.width / fieldRect.width;
  const scaleY = fieldBox.height / fieldRect.height;
  const startCandidate = pointerCandidates.start[attempt % pointerCandidates.start.length];
  const endCandidate = pointerCandidates.end[attempt % pointerCandidates.end.length];
  const local = {
    start: {
      x: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.width - MIN_POINTER_EDGE_INSET_PX,
        startCandidate.x - fieldRect.left)),
      y: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.height - MIN_POINTER_EDGE_INSET_PX,
        startCandidate.y - fieldRect.top)),
    },
    end: {
      x: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.width - MIN_POINTER_EDGE_INSET_PX,
        endCandidate.x - fieldRect.left)),
      y: Math.max(MIN_POINTER_EDGE_INSET_PX, Math.min(fieldRect.height - MIN_POINTER_EDGE_INSET_PX,
        endCandidate.y - fieldRect.top)),
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
    const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector);
    const editor = document.querySelector<HTMLElement>('[data-testid="page-builder-editor"]');
    const saveStatus = document.querySelector<HTMLElement>('[data-testid="page-builder-save-status"]');
    const inspect = (point: PointerPoint) => {
      const stack = document.elementsFromPoint(point.x, point.y).slice(0, 6);
      return {
        hit: stack[0] === iframe,
        stack: stack.map((element) => ({
          tag: element.tagName,
          className: element instanceof HTMLElement ? element.className : '',
          id: element.id,
        })),
      };
    };
    return {
      editor: {
        ariaBusy: editor?.getAttribute('aria-busy') ?? '',
        pointerEvents: editor ? getComputedStyle(editor).pointerEvents : '',
        saveState: saveStatus?.getAttribute('data-state') ?? '',
      },
      frame: {
        outlineDragging: iframe?.hasAttribute('data-puck-outline-dragging') ?? false,
        pointerEvents: iframe ? getComputedStyle(iframe).pointerEvents : '',
      },
      start: inspect(start),
      end: inspect(end),
    };
  }, { start: pointer.start, end: pointer.end, iframeSelector: CANVAS_IFRAME });

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
  expect(topDocumentHits.start.hit, `pointer start must hit the Puck canvas iframe: ${JSON.stringify({ pointer, topDocumentHits, canvasHits })}`).toBe(true);
  expect(topDocumentHits.end.hit, `pointer end must hit the Puck canvas iframe: ${JSON.stringify({ pointer, topDocumentHits, canvasHits })}`).toBe(true);
  expect(canvasHits.start, `pointer start must hit the current rich-text field: ${JSON.stringify({ pointer, topDocumentHits, canvasHits })}`).toBe(true);
  expect(canvasHits.end, `pointer end must hit the current rich-text field: ${JSON.stringify({ pointer, topDocumentHits, canvasHits })}`).toBe(true);
}

async function findFieldCollapsePoints(
  page: Page,
  field: Locator,
  targetNode: Locator,
  selectedCopy: string,
): Promise<PointerPoint[]> {
  await field.scrollIntoViewIfNeeded();
  const [fieldBox, targetBox, iframeBox] = await Promise.all([
    field.boundingBox(),
    targetNode.boundingBox(),
    page.locator(CANVAS_IFRAME).boundingBox(),
  ]);
  const viewport = page.viewportSize();
  if (!fieldBox || !targetBox || !iframeBox || !viewport) {
    throw new Error('Collapse pointer geometry is unavailable.');
  }
  const rangeGeometry = await field.evaluate((fieldRoot, copy) => {
    const document = fieldRoot.ownerDocument;
    const view = document.defaultView;
    if (!view) return { candidates: [], selectedRects: [], text: '', selectedIndex: -1 };
    const walker = document.createTreeWalker(fieldRoot, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }
    const text = textNodes.map((textNode) => textNode.data).join('');
    const selectedIndex = text.indexOf(copy);
    if (selectedIndex < 0 || copy.length === 0 || textNodes.length === 0) {
      return { candidates: [], selectedRects: [], text, selectedIndex };
    }
    const boundary = (offset: number): { node: Text; offset: number } => {
      let consumed = 0;
      for (const textNode of textNodes) {
        const next = consumed + textNode.length;
        if (offset <= next) return { node: textNode, offset: offset - consumed };
        consumed = next;
      }
      const last = textNodes[textNodes.length - 1];
      return { node: last, offset: last.length };
    };
    const rectsFor = (start: number, end: number): Array<{ bottom: number; left: number; right: number; top: number }> => {
      if (end <= start) return [];
      const startBoundary = boundary(start);
      const endBoundary = boundary(end);
      const range = document.createRange();
      range.setStart(startBoundary.node, startBoundary.offset);
      range.setEnd(endBoundary.node, endBoundary.offset);
      return Array.from(range.getClientRects())
        .filter((rect) => rect.width > 1 && rect.height > 1)
        .map((rect) => ({ bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top }));
    };
    const selectedEnd = selectedIndex + copy.length;
    const selectedRects = rectsFor(selectedIndex, selectedEnd);
    const segmentRects = [
      ...rectsFor(0, selectedIndex).map((rect) => ({ rect, source: 'prefix' as const })),
      ...rectsFor(selectedEnd, text.length).map((rect) => ({ rect, source: 'suffix' as const })),
    ];
    const candidateRects = segmentRects.length > 0
      ? segmentRects
      : selectedRects.map((rect) => ({ rect, source: 'selected-fallback' as const }));
    const candidates = candidateRects.flatMap(({ rect, source }) => {
      const inset = Math.min(2, (rect.right - rect.left) / 4);
      const verticalInset = Math.min(2, (rect.bottom - rect.top) / 4);
      const xs = [rect.left + inset, (rect.left + rect.right) / 2, rect.right - inset];
      const ys = [rect.top + verticalInset, (rect.top + rect.bottom) / 2, rect.bottom - verticalInset];
      return ys.flatMap((y) => xs.map((x) => ({ x, y, source })));
    });
    return { candidates, selectedRects, text, selectedIndex };
  }, selectedCopy);
  if (rangeGeometry.candidates.length === 0) {
    throw new Error(`current rich-text target has no collapse range rect: ${JSON.stringify({
      selectedCopy,
      rangeGeometry,
      fieldBox,
      targetBox,
    })}`);
  }
  const iframeViewport = await field.evaluate((fieldRoot) => ({
    height: fieldRoot.ownerDocument.defaultView?.innerHeight ?? 0,
    width: fieldRoot.ownerDocument.defaultView?.innerWidth ?? 0,
  }));
  if (iframeViewport.width <= 0 || iframeViewport.height <= 0) {
    throw new Error('Collapse iframe viewport geometry is unavailable.');
  }
  const scaleX = iframeBox.width / iframeViewport.width;
  const scaleY = iframeBox.height / iframeViewport.height;
  const candidates = rangeGeometry.candidates.map((candidate) => ({
    local: candidate,
    page: {
      x: iframeBox.x + candidate.x * scaleX,
      y: iframeBox.y + candidate.y * scaleY,
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

  const canvasHits = await field.evaluate((fieldRoot, geometry) => {
    return geometry.points.map((point) => {
      const hit = fieldRoot.ownerDocument.elementFromPoint(point.x, point.y);
      return {
        fieldHit: hit === fieldRoot || fieldRoot.contains(hit),
        selectedRectHit: geometry.selectedRects.some((rect) => (
          point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
        )),
        toolbarHit: Boolean(hit?.closest('[data-puck-rte-menu]')),
        tag: hit?.tagName ?? '',
        className: hit instanceof HTMLElement ? hit.className : '',
      };
    });
  }, { points: rangeGeometry.candidates, selectedRects: rangeGeometry.selectedRects });
  const reachable = candidates.filter((_, index) => (
    topDocumentHits[index]?.hit === true
    && canvasHits[index]?.fieldHit === true
    && (candidates[index]?.local.source === 'selected-fallback'
      ? canvasHits[index]?.selectedRectHit === true
      : canvasHits[index]?.selectedRectHit === false)
    && canvasHits[index]?.toolbarHit === false
  )).map((candidate) => candidate.page);
  if (reachable.length === 0) {
    throw new Error(`no prefix/suffix current rich-text pixel is pointer-reachable: ${JSON.stringify({
      selectedCopy,
      fieldBox,
      targetBox,
      iframeBox,
      viewport,
      rangeGeometry,
      candidates,
      topDocumentHits,
      canvasHits,
    })}`);
  }
  return reachable;
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
      if (attempt > 0) await collapseSelectionWithPointer(page, selection);
      const { field, targetNode } = await resolveRichTextSelection(page, selection);
      let pointer = await textPointerGeometry(field, targetNode, attempt);
      await assertTextPointerReachable(page, field, pointer);
      await expect.poll(() => selectedText(field)).toBe('');
      await page.mouse.move(pointer.start.x, pointer.start.y);
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      pointer = await textPointerGeometry(field, targetNode, attempt);
      await assertTextPointerReachable(page, field, pointer);
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

async function assertPointerReachable(page: Page, control: Locator): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Range control viewport geometry is unavailable.');
  const localReachability = await control.evaluate((element) => {
    const view = element.ownerDocument.defaultView;
    if (!view || view.innerWidth <= 0 || view.innerHeight <= 0) {
      return { controlRect: null, points: [], viewport: null };
    }
    const rect = element.getBoundingClientRect();
    const visible = {
      left: Math.max(0, rect.left),
      top: Math.max(0, rect.top),
      right: Math.min(view.innerWidth, rect.right),
      bottom: Math.min(view.innerHeight, rect.bottom),
    };
    if (visible.right <= visible.left || visible.bottom <= visible.top) {
      return {
        controlRect: {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        },
        points: [],
        viewport: { height: view.innerHeight, width: view.innerWidth },
      };
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
    return {
      controlRect: {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
      points: candidates.map((point) => {
        const hit = element.ownerDocument.elementFromPoint(point.x, point.y);
        return {
          ...point,
          hit: hit === element || (hit !== null && element.contains(hit)),
          hitClassName: hit instanceof HTMLElement ? hit.className : '',
          hitTag: hit?.tagName ?? '',
        };
      }),
      viewport: { height: view.innerHeight, width: view.innerWidth },
    };
  });
  const localCenter = localReachability.points[0];
  if (!localReachability.viewport || !localCenter?.hit) {
    throw new Error(`range control center is not pointer-reachable inside the iframe: ${JSON.stringify({
      localReachability,
      viewport,
    })}`);
  }
  const frameGeometry = await page.locator(CANVAS_IFRAME).evaluate((iframe) => {
    const frame = iframe as HTMLIFrameElement;
    const rect = frame.getBoundingClientRect();
    const borderScaleX = frame.offsetWidth > 0 ? rect.width / frame.offsetWidth : 0;
    const borderScaleY = frame.offsetHeight > 0 ? rect.height / frame.offsetHeight : 0;
    return {
      borderScaleX,
      borderScaleY,
      clientHeight: frame.clientHeight,
      clientLeft: frame.clientLeft,
      clientTop: frame.clientTop,
      clientWidth: frame.clientWidth,
      rect: {
        bottom: rect.bottom,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
    };
  });
  const contentOrigin = {
    x: frameGeometry.rect.left + frameGeometry.clientLeft * frameGeometry.borderScaleX,
    y: frameGeometry.rect.top + frameGeometry.clientTop * frameGeometry.borderScaleY,
  };
  const contentScale = {
    x: frameGeometry.clientWidth * frameGeometry.borderScaleX / localReachability.viewport.width,
    y: frameGeometry.clientHeight * frameGeometry.borderScaleY / localReachability.viewport.height,
  };
  if (contentScale.x <= 0 || contentScale.y <= 0) {
    throw new Error(`range control frame content geometry is unavailable: ${JSON.stringify({
      contentOrigin,
      contentScale,
      frameGeometry,
      localReachability,
      viewport,
    })}`);
  }
  const center = {
    x: contentOrigin.x + localCenter.x * contentScale.x,
    y: contentOrigin.y + localCenter.y * contentScale.y,
  };
  const topDocumentReachability = await page.evaluate(({ points, iframeSelector }) => {
      const iframe = document.querySelector<HTMLIFrameElement>(iframeSelector);
      const editor = document.querySelector<HTMLElement>('[data-testid="page-builder-editor"]');
      const saveStatus = document.querySelector<HTMLElement>('[data-testid="page-builder-save-status"]');
      const pointerEvents = iframe ? getComputedStyle(iframe).pointerEvents : '';
      return {
        editor: {
          ariaBusy: editor?.getAttribute('aria-busy') ?? '',
          pointerEvents: editor ? getComputedStyle(editor).pointerEvents : '',
          saveState: saveStatus?.getAttribute('data-state') ?? '',
          saveText: saveStatus?.textContent ?? '',
        },
        frame: {
          outlineDragging: iframe?.hasAttribute('data-puck-outline-dragging') ?? false,
          pointerEvents,
        },
        points: points.map((point) => {
          const stack = document.elementsFromPoint(point.x, point.y).slice(0, 6);
          return {
            hit: stack[0] === iframe,
            stack: stack.map((element) => ({
              tag: element.tagName,
              className: element instanceof HTMLElement ? element.className : '',
              id: element.id,
            })),
          };
        }),
      };
  }, { points: [center], iframeSelector: CANVAS_IFRAME });
  if (topDocumentReachability.points[0]?.hit === true) return;
  throw new Error(`range control center is not pointer-reachable through the iframe: ${JSON.stringify({
    center,
    contentOrigin,
    contentScale,
    frameGeometry,
    localReachability,
    topDocumentReachability,
    viewport,
  })}`);
}

async function activateControl(
  projectName: string,
  control: Locator,
): Promise<void> {
  if (projectName === 'mobile') {
    await control.tap({ scroll: 'none' });
    return;
  }
  await control.click({ scroll: 'none' });
}

async function activateCanvasPoint(page: Page, point: PointerPoint, projectName: string): Promise<void> {
  if (projectName === 'mobile') {
    await page.touchscreen.tap(point.x, point.y);
    return;
  }
  await page.mouse.click(point.x, point.y);
}

async function expectStableControlGeometry(control: Locator): Promise<void> {
  await expect(control).toBeVisible();
  const floatingLayer = control.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " g7pb-richtext-floating-layer ")][1]');
  if (await floatingLayer.count()) await expect(floatingLayer).toHaveAttribute('data-g7pb-floating-ready', 'true');
  const samples = await control.evaluate(async (element) => {
    const frames: Array<{ height: number; left: number; ready: boolean; top: number; width: number }> = [];
    for (let index = 0; index < 3; index += 1) {
      await new Promise<void>((resolve) => element.ownerDocument.defaultView?.requestAnimationFrame(() => resolve()));
      const rect = element.getBoundingClientRect();
      const floating = element.closest<HTMLElement>('.g7pb-richtext-floating-layer');
      frames.push({
        height: rect.height,
        left: rect.left,
        ready: !floating || (
          floating.getAttribute('data-g7pb-floating-ready') === 'true'
          && floating.style.visibility === 'visible'
        ),
        top: rect.top,
        width: rect.width,
      });
    }
    return frames;
  });
  const baseline = samples[0];
  for (const sample of samples) {
    expect(sample.ready, `floating readiness must remain stable: ${JSON.stringify(samples)}`).toBe(true);
  }
  for (const sample of samples.slice(1)) {
    expect(Math.abs(sample.left - baseline.left), `control left must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
    expect(Math.abs(sample.top - baseline.top), `control top must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
    expect(Math.abs(sample.width - baseline.width), `control width must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
    expect(Math.abs(sample.height - baseline.height), `control height must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
  }
}

async function openResponsiveAdvancedControls(
  page: Page,
  menuRoot: Locator,
  projectName: string,
): Promise<Locator> {
  const frame = page.frameLocator(CANVAS_IFRAME);
  const advanced = frame.getByTestId('page-builder-richtext-advanced-panel');
  if (await advanced.count()) return advanced;
  const more = menuRoot.getByTestId('page-builder-richtext-more');
  await expect(more).toHaveCount(1);
  await assertPointerReachable(page, more);
  await activateControl(projectName, more);
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(advanced).toBeVisible();
  return advanced;
}

async function dismissContextPanelWithPointer(page: Page, projectName: string): Promise<void> {
  const editor = page.getByTestId('page-builder-editor');
  const editorBox = await editor.boundingBox();
  if (!editorBox) throw new Error('Editor pointer-dismiss geometry is unavailable.');
  const point: PointerPoint = {
    x: editorBox.x + Math.min(8, editorBox.width / 2),
    y: editorBox.y + Math.min(8, editorBox.height / 2),
  };
  const hitIsEditor = await page.evaluate(({ x, y }) => {
    const editorRoot = document.querySelector<HTMLElement>('[data-testid="page-builder-editor"]');
    const hit = document.elementFromPoint(x, y);
    return hit !== null && editorRoot !== null && (hit === editorRoot || editorRoot.contains(hit));
  }, point);
  expect(hitIsEditor, 'context-panel dismiss point must hit the editor').toBe(true);
  await activateCanvasPoint(page, point, projectName);
  await expect(page.getByTestId('page-builder-context-panel')).toBeHidden();
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
  await assertPointerReachable(page, control);
  await activateControl(projectName, control);
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
  let trigger = menuRoot.getByTestId(testId);
  if (await trigger.count() === 0) {
    const advanced = await openResponsiveAdvancedControls(page, menuRoot, projectName);
    trigger = advanced.getByTestId(testId);
  }
  await expectStableControlGeometry(trigger);
  await assertPointerReachable(page, trigger);
  await activateControl(projectName, trigger);
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const optionControl = page.frameLocator(CANVAS_IFRAME).getByRole('option', { name: option, exact: true });
  await expectStableControlGeometry(optionControl);
  await assertPointerReachable(page, optionControl);
  await expect.poll(() => selectedText(field)).toBe(target);
  await activateControl(projectName, optionControl);
  await expect(optionControl).toBeHidden();
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
      const currentSelection = await selectedText(field);
      if (currentSelection === '') return;
      const points = await findFieldCollapsePoints(page, field, targetNode, currentSelection);
      for (const point of points) {
        await page.mouse.click(point.x, point.y);
        await page.evaluate(() => new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }));
        if (await selectedText(field) === '') return;
      }
      lastFailure = new Error(`Pointer click did not collapse the current selection: ${await selectedText(field)}`);
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

test('keeps ActionBar and rich-text controls pointer-reachable across the host and canvas matrix', async ({ context, page }, testInfo) => {
  test.setTimeout(300_000);
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await editorInteractionApi(token);
  let owned: OwnedEditorInteractionDocument | null = null;

  try {
    await recoverOwnedEditorInteractionDocuments(api);
    owned = await createOwnedEditorInteractionDocument(api, testInfo.project.name);
    await page.goto(`${EDITOR_PATH}?document=${owned.documentId}`);
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await exposeCanvasForPointer(page);
    const rootSelection: RichTextSelectionLocator = {
      blockType: 'heading',
      fieldPath: 'heading',
      locateTarget: (field) => field.locator('a[href="/richtext-root"]'),
    };

    for (const width of CANVAS_VIEWPORT_WIDTHS) {
      await test.step(`POINTER_CONTROL_MATRIX_${testInfo.project.name}_${width}`, async () => {
        await setCanvasViewportWidth(page, width);
        await exposeCanvasForPointer(page);
        await assertInteractiveCanvas(page);
        const field = await dragSelectText(page, rootSelection, EDITOR_INTERACTION_COPY.rootTarget);
        const menuRoot = await officialPuckMenuRoot(page);
        const bold = menuRoot.getByRole('button', { name: '선택한 글자 굵게', exact: true });
        const targetMark = field.locator('strong').filter({
          hasText: new RegExp(`^${EDITOR_INTERACTION_COPY.rootTarget}$`),
        });
        const beforeCount = await targetMark.count();
        await assertPointerReachable(page, bold);
        await activateControl(testInfo.project.name, bold);
        await expect.poll(() => selectedText(field)).toBe(EDITOR_INTERACTION_COPY.rootTarget);
        await expect.poll(() => targetMark.count()).toBe(beforeCount === 0 ? 1 : 0);
        await collapseSelectionWithPointer(page, rootSelection);
        await expect(page.frameLocator(CANVAS_IFRAME).locator('[data-puck-rte-menu]:visible')).toHaveCount(0);
        await openElementPanelFromActionBar(page, testInfo.project.name);
        await expect(page.getByTestId('page-builder-context-panel')).toBeVisible();
        await dismissContextPanelWithPointer(page, testInfo.project.name);
      });
    }
  } finally {
    if (owned) await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});

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
      await expect(elementPanel).toBeHidden();
      await openElementPanelFromActionBar(page, testInfo.project.name);
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
      const articleHasMore = await articleMenuRoot.getByTestId('page-builder-richtext-more').count() > 0;
      const articleControlScope = articleHasMore
        ? await openResponsiveAdvancedControls(page, articleMenuRoot, testInfo.project.name)
        : articleMenuRoot;
      await expect(articleControlScope.getByRole('button', { name: '링크 편집', exact: true })).toHaveCount(0);
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
