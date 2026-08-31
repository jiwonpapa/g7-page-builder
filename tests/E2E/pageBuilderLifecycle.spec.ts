import {
  expect,
  request as playwrightRequest,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const MANAGER_PATH = '/modules/jiwonpapa-page_builder/admin';
const NATIVE_MANAGER_PATH = '/admin/page-builder';
const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const DOCUMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const E2E_OWNERSHIP_DIRECTORY = join(process.cwd(), 'output', 'playwright', 'ownership');
const E2E_DOCUMENT_SLUG_PATTERN = /^(?:managed-)?g7pb-e2e-[a-z0-9-]+-\d{13}-[a-z0-9]{6}(?:-copy)?$|^g7pb-template-e2e-\d{13}-[a-z0-9]{6}$/;
const MOBILE_EDITOR_BREAKPOINT = 900;
/*
 * @puckeditor/core is pinned to 0.23.0. These selectors use that pinned build's
 * semantic CSS-module prefixes only; generated build hash suffixes are never
 * part of the lifecycle contract.
 */
const PUCK_LEFT_SIDEBAR_OPEN = '[class*="PuckLayout--leftSideBarVisible"]';
const PUCK_RIGHT_SIDEBAR_OPEN = '[class*="PuckLayout--rightSideBarVisible"]';
const PUCK_NAV_ITEM_ACTIVE = 'NavItem--active';

type BlockType =
  | 'article-list'
  | 'bar-chart'
  | 'comparison-table'
  | 'contact'
  | 'cta'
  | 'features'
  | 'faq-accordion'
  | 'gallery'
  | 'heading'
  | 'hero'
  | 'hero-slider'
  | 'icon-list'
  | 'image'
  | 'image-text'
  | 'buttons'
  | 'rich-text'
  | 'g7-product-grid'
  | 'g7-recent-posts'
  | 'logo-cloud'
  | 'pricing'
  | 'process-timeline'
  | 'stats'
  | 'tabs'
  | 'team'
  | 'testimonials'
  | 'video-embed'
  | 'logo-carousel'
  | 'testimonial-slider'
  | 'event-schedule'
  | 'download-resources'
  | 'g7-board-archive'
  | 'g7-product-showcase';

const PUBLISHED_BLOCK_ORDER: BlockType[] = [
  'features',
  'hero',
  'hero-slider',
  'cta',
  'contact',
  'heading',
  'rich-text',
  'image',
  'buttons',
  'image-text',
  'icon-list',
  'logo-cloud',
  'stats',
  'pricing',
  'team',
  'gallery',
  'bar-chart',
  'g7-recent-posts',
  'g7-product-grid',
  'testimonials',
  'faq-accordion',
  'process-timeline',
  'tabs',
  'comparison-table',
  'article-list',
  'video-embed',
  'logo-carousel',
  'testimonial-slider',
  'event-schedule',
  'download-resources',
  'g7-board-archive',
  'g7-product-showcase',
];

const BLOCK_LABELS: Record<BlockType, string> = {
  'bar-chart': 'Bar chart',
  contact: 'Contact',
  cta: 'CTA',
  features: 'Features',
  gallery: 'Gallery',
  heading: '제목',
  hero: 'Hero',
  'hero-slider': 'Hero slider',
  'icon-list': '아이콘 목록',
  image: '단일 이미지',
  'image-text': '이미지 + 텍스트',
  buttons: '버튼 묶음',
  'rich-text': '리치텍스트',
  'g7-product-grid': 'G7 Product Grid',
  'g7-recent-posts': 'G7 Recent Posts',
  'logo-cloud': 'Logo cloud',
  pricing: 'Pricing',
  'process-timeline': 'Process timeline',
  stats: 'Stats',
  team: 'Team',
  'article-list': 'Article list',
  'comparison-table': 'Comparison table',
  'faq-accordion': 'FAQ accordion',
  tabs: 'Tabs',
  testimonials: 'Testimonials',
  'video-embed': 'Video embed',
  'logo-carousel': 'Logo carousel',
  'testimonial-slider': 'Testimonial slider',
  'event-schedule': 'Event schedule',
  'download-resources': 'Download resources',
  'g7-board-archive': 'G7 Board Archive',
  'g7-product-showcase': 'G7 Product Showcase',
};

interface AdminLoginResponse {
  data?: {
    token?: unknown;
  };
  success?: unknown;
}

interface CleanupDocumentResource {
  archived_at?: unknown;
  document?: {
    document_id?: unknown;
    slug?: unknown;
  };
  lock_version?: unknown;
}

interface CleanupDocumentListResponse {
  data?: {
    items?: unknown;
    pagination?: {
      total?: unknown;
    };
  };
  success?: unknown;
}

interface E2eOwnershipJournal {
  version: 1;
  slugs: string[];
  uploadedMediaId: string | null;
}

function assertOwnedE2eJournal(value: unknown): asserts value is E2eOwnershipJournal {
  if (!value || typeof value !== 'object') throw new Error('Page Builder E2E ownership journal is invalid.');
  const journal = value as Partial<E2eOwnershipJournal>;
  if (journal.version !== 1 || !Array.isArray(journal.slugs) || journal.slugs.length === 0
    || journal.slugs.some((slug) => typeof slug !== 'string' || !E2E_DOCUMENT_SLUG_PATTERN.test(slug))
    || (journal.uploadedMediaId !== null
      && (typeof journal.uploadedMediaId !== 'string' || !DOCUMENT_ID_PATTERN.test(journal.uploadedMediaId)))) {
    throw new Error('Page Builder E2E ownership journal contains an unowned artifact.');
  }
}

async function writeE2eOwnershipJournal(
  fileName: string,
  slugs: string[],
  uploadedMediaId: string | null = null,
): Promise<string> {
  const journal: E2eOwnershipJournal = { version: 1, slugs, uploadedMediaId };
  assertOwnedE2eJournal(journal);
  await mkdir(E2E_OWNERSHIP_DIRECTORY, { recursive: true });
  const path = join(E2E_OWNERSHIP_DIRECTORY, fileName.replace(/[^a-z0-9.-]+/gi, '-') + '.json');
  await writeFile(path, JSON.stringify(journal, null, 2), 'utf8');
  return path;
}

async function updateE2eOwnershipJournal(path: string, uploadedMediaId: string | null): Promise<void> {
  const journal = JSON.parse(await readFile(path, 'utf8')) as unknown;
  assertOwnedE2eJournal(journal);
  await writeFile(path, JSON.stringify({ ...journal, uploadedMediaId }, null, 2), 'utf8');
}

async function removeE2eOwnershipJournal(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}

async function recoverOwnedE2eArtifacts(authToken: string): Promise<void> {
  await mkdir(E2E_OWNERSHIP_DIRECTORY, { recursive: true });
  const entries = await readdir(E2E_OWNERSHIP_DIRECTORY, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const path = join(E2E_OWNERSHIP_DIRECTORY, entry.name);
    const journal = JSON.parse(await readFile(path, 'utf8')) as unknown;
    assertOwnedE2eJournal(journal);
    await cleanupE2eArtifacts(authToken, journal.slugs, journal.uploadedMediaId);
    await removeE2eOwnershipJournal(path);
  }
}

/*
 * This acceptance test handles an administrator credential and bearer token.
 * Disable automatic artifacts for the whole file so neither login request data
 * nor localStorage state can be retained in traces, screenshots, or videos.
 */
test.use({ screenshot: 'off', trace: 'off', video: 'off' });

function adminCredentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Page Builder E2E administrator credentials are not configured.');
  }

  return { email, password };
}

async function authenticateAdmin(context: BrowserContext): Promise<string> {
  const credentials = adminCredentials();
  const authRequest = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  });

  try {
    const response = await authRequest.post('/api/auth/admin/login', {
      data: credentials,
    });

    if (!response.ok()) {
      throw new Error(`Page Builder E2E administrator login failed with HTTP ${response.status()}.`);
    }

    const payload = (await response.json()) as AdminLoginResponse;
    const token = payload.success === true && typeof payload.data?.token === 'string'
      ? payload.data.token
      : null;

    if (!token) {
      throw new Error('Page Builder E2E administrator login returned no usable token.');
    }

    const origin = new URL(BASE_URL).origin;
    await context.addInitScript(
      ({ expectedOrigin, authToken }) => {
        if (window.location.origin === expectedOrigin) {
          window.localStorage.setItem('auth_token', authToken);
        }
      },
      { expectedOrigin: origin, authToken: token },
    );

    return token;
  } finally {
    await authRequest.dispose();
  }
}

async function cleanupE2eArtifacts(
  authToken: string,
  candidateSlugs: string[],
  uploadedMediaId: string | null,
): Promise<void> {
  const cleanupRequest = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  const expectedSlugs = new Set(candidateSlugs);
  const targets = new Map<string, { archived: boolean; lockVersion: number; slug: string }>();

  try {
    for (let pageNumber = 1; ; pageNumber += 1) {
      const response = await cleanupRequest.get(
        `/api/modules/jiwonpapa-page_builder/admin/documents?page=${pageNumber}&per_page=100&status=all`,
      );
      if (!response.ok()) {
        throw new Error(`Page Builder E2E cleanup list failed with HTTP ${response.status()}.`);
      }

      const payload = await response.json() as CleanupDocumentListResponse;
      const items = payload.success === true && Array.isArray(payload.data?.items)
        ? payload.data.items as CleanupDocumentResource[]
        : [];

      for (const item of items) {
        const documentId = item.document?.document_id;
        const documentSlug = item.document?.slug;
        if (
          typeof documentId === 'string'
          && typeof documentSlug === 'string'
          && typeof item.lock_version === 'number'
          && expectedSlugs.has(documentSlug)
        ) {
          targets.set(documentId, {
            archived: typeof item.archived_at === 'string',
            lockVersion: item.lock_version,
            slug: documentSlug,
          });
        }
      }

      const total = payload.data?.pagination?.total;
      if (typeof total !== 'number' || pageNumber * 100 >= total) {
        break;
      }
    }

    for (const [documentId, target] of targets) {
      let lockVersion = target.lockVersion;
      if (!target.archived) {
        let archiveResponse = await cleanupRequest.post(
          `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/archive`,
          { data: { expected_lock_version: lockVersion } },
        );
        if (archiveResponse.status() === 409) {
          const currentResponse = await cleanupRequest.get(
            `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`,
          );
          const currentPayload = await currentResponse.json() as { data?: { lock_version?: unknown } };
          if (!currentResponse.ok() || typeof currentPayload.data?.lock_version !== 'number') {
            throw new Error(`Page Builder E2E cleanup refresh failed with HTTP ${currentResponse.status()}.`);
          }
          lockVersion = currentPayload.data.lock_version;
          archiveResponse = await cleanupRequest.post(
            `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/archive`,
            { data: { expected_lock_version: lockVersion } },
          );
        }
        if (!archiveResponse.ok()) {
          throw new Error(`Page Builder E2E cleanup archive failed with HTTP ${archiveResponse.status()}.`);
        }
        const archivePayload = await archiveResponse.json() as {
          data?: { lock_version?: unknown };
          success?: unknown;
        };
        if (archivePayload.success !== true || typeof archivePayload.data?.lock_version !== 'number') {
          throw new Error('Page Builder E2E cleanup archive returned no lock version.');
        }
        lockVersion = archivePayload.data.lock_version;
      }

      const purgeResponse = await cleanupRequest.delete(
        `/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`,
        {
          data: {
            confirmation_slug: target.slug,
            expected_lock_version: lockVersion,
          },
        },
      );
      if (!purgeResponse.ok()) {
        throw new Error(`Page Builder E2E cleanup purge failed with HTTP ${purgeResponse.status()}.`);
      }
    }

    if (uploadedMediaId) {
      const mediaResponse = await cleanupRequest.delete(
        `/api/modules/jiwonpapa-page_builder/admin/media/${uploadedMediaId}`,
      );
      if (!mediaResponse.ok()) {
        throw new Error(`Page Builder E2E media cleanup failed with HTTP ${mediaResponse.status()}.`);
      }
    }
  } finally {
    await cleanupRequest.dispose();
  }
}

function editorBlock(page: Page, type: BlockType): Locator {
  return page.frameLocator('iframe').locator(
    `[data-testid="page-builder-block"][data-block-type="${type}"]`,
  );
}

function editorBlockPointerTarget(page: Page, type: BlockType): Locator {
  return editorBlock(page, type).locator('xpath=ancestor::*[@data-puck-component][1]');
}

function editorInlineField(page: Page, type: BlockType, field: string): Locator {
  return editorBlock(page, type).locator(
    `[data-g7pb-inline-field="${field}"][contenteditable], [data-g7pb-inline-field="${field}"] [contenteditable]`,
  );
}

function editorBlocks(page: Page): Locator {
  return page.frameLocator('iframe').getByTestId('page-builder-block');
}

function renderedBlocks(page: Page): Locator {
  return page.getByTestId('page-builder-rendered-block');
}

function visibleTestId(page: Page, testId: string): Locator {
  return page.locator(`[data-testid="${testId}"]:visible`);
}

async function dismissContextPanel(page: Page): Promise<void> {
  const contextPanel = page.getByTestId('page-builder-context-panel');

  if (await contextPanel.isVisible()) {
    if (await mobileFieldsPanelIsOpen(page)) {
      const fieldsTab = page.locator('nav').getByText('Fields', { exact: true });
      await activatePointerTarget(page, fieldsTab, 'mobile Fields tab');
      await expect(page.locator(PUCK_LEFT_SIDEBAR_OPEN)).toHaveCount(0);
      await waitForStableLayout(page);
      await expect(contextPanel).toBeHidden();
      return;
    }

    const closeButton = contextPanel.getByRole('button', { name: '스타일 도구 닫기' });
    await activatePointerTarget(page, closeButton, 'element balloon close button');
    await expect(contextPanel).toBeHidden();
  }
}

async function waitForStableLayout(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function mobileFieldsPanelIsOpen(page: Page): Promise<boolean> {
  return mobileSidebarPanelIsOpen(page, 'Fields');
}

async function mobileSidebarPanelIsOpen(page: Page, name: 'Fields' | 'Outline'): Promise<boolean> {
  const tab = page.locator('nav').getByText(name, { exact: true });
  if (!(await tab.isVisible())) return false;

  const item = tab.locator('xpath=ancestor::li[1]');
  const active = await item.evaluate(
    (item, activeClass) => item.className.includes(activeClass),
    PUCK_NAV_ITEM_ACTIVE,
  );
  const leftSidebarOpen = await page.locator(PUCK_LEFT_SIDEBAR_OPEN).count() > 0;

  return active && leftSidebarOpen;
}

async function pointerHitEvidence(targetLocator: Locator, position?: { x: number; y: number }) {
  return targetLocator.evaluate((target, requestedPosition) => {
    const rect = target.getBoundingClientRect();
    const point = requestedPosition
      ? { x: rect.left + requestedPosition.x, y: rect.top + requestedPosition.y }
      : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const hit = document.elementFromPoint(point.x, point.y);
    const controls = target.closest('.g7pb-header-controls');
    const controlsRect = controls?.getBoundingClientRect();

    return {
      ariaExpanded: target.getAttribute('aria-expanded'),
      point,
      target: {
        ariaLabel: target.getAttribute('aria-label'),
        bottom: rect.bottom,
        className: target.getAttribute('class'),
        height: rect.height,
        id: target.id || null,
        left: rect.left,
        right: rect.right,
        tagName: target.tagName,
        testId: target.getAttribute('data-testid'),
        text: target.textContent?.trim().slice(0, 80) || null,
        top: rect.top,
        width: rect.width,
      },
      controls: controls && controlsRect
        ? {
            bottom: controlsRect.bottom,
            display: getComputedStyle(controls).display,
            height: controlsRect.height,
            left: controlsRect.left,
            position: getComputedStyle(controls).position,
            right: controlsRect.right,
            top: controlsRect.top,
            width: controlsRect.width,
          }
        : null,
      hit: hit
        ? {
            ariaLabel: hit.getAttribute('aria-label'),
            className: hit.getAttribute('class'),
            id: hit.id || null,
            tagName: hit.tagName,
            testId: hit.getAttribute('data-testid'),
            text: hit.textContent?.trim().slice(0, 80) || null,
          }
        : null,
      topmost: hit === target || target.contains(hit),
      viewport: {
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        width: window.innerWidth,
      },
    };
  }, position);
}

async function activatePointerTarget(
  page: Page,
  target: Locator,
  label: string,
  position?: { x: number; y: number },
): Promise<void> {
  await expect(target, `${label} must be visible before pointer activation`).toBeVisible();
  await target.scrollIntoViewIfNeeded();
  await waitForStableLayout(page);
  const evidence = await pointerHitEvidence(target, position);
  if (!evidence.topmost) {
    throw new Error(`${label} is not the topmost pointer target: ${JSON.stringify(evidence)}`);
  }
  await target.click(position ? { position } : undefined);
}

async function activatePuckPlainTextField(page: Page, field: Locator, label: string): Promise<void> {
  await expect(field, `${label} must be visible before inline activation`).toBeVisible();
  await field.scrollIntoViewIfNeeded();
  await field.hover();
  await expect(field).toHaveAttribute('contenteditable', 'plaintext-only');
  await activatePointerTarget(page, field, label);
  await expect(field).toBeEditable();
}

async function activatePuckRichTextField(page: Page, field: Locator, label: string): Promise<void> {
  await expect(field, `${label} must be visible before rich-text activation`).toBeVisible();
  await field.scrollIntoViewIfNeeded();
  await field.hover();
  await expect(field).toHaveAttribute('contenteditable', 'true');
  await activatePointerTarget(page, field, label);
  await expect(field).toBeEditable();
}

async function openSelectedElementTextTools(page: Page): Promise<void> {
  const textToolsAction = page.frameLocator('iframe')
    .getByTestId('page-builder-element-style-open')
    .locator('xpath=ancestor::button[1]');
  await expect(textToolsAction).toHaveAttribute('aria-label', /요소 전체 스타일/);
  await activatePointerTarget(page, textToolsAction, 'selected element style');
  await expect(page.getByTestId('page-builder-context-panel')).toBeVisible();
}

async function revealEditorHeaderActions(page: Page): Promise<void> {
  const addBlock = page.getByTestId('page-builder-add-block');
  await dismissContextPanel(page);

  if (await mobileFieldsPanelIsOpen(page)) {
    const fieldsTab = page.locator('nav').getByText('Fields', { exact: true });
    await activatePointerTarget(page, fieldsTab, 'mobile Fields tab');
    await expect(page.locator(PUCK_LEFT_SIDEBAR_OPEN)).toHaveCount(0);
    await waitForStableLayout(page);
  }

  if (!(await addBlock.isVisible())) {
    const menuToggle = page.getByRole('button', { name: 'Toggle menu bar' });
    await expect(menuToggle).toBeVisible();
    await activatePointerTarget(page, menuToggle, 'editor menu toggle');
    await waitForStableLayout(page);
  }

  await expect(addBlock).toBeVisible();
  await addBlock.scrollIntoViewIfNeeded();
  await waitForStableLayout(page);
  const evidence = await pointerHitEvidence(addBlock);
  if (!evidence.topmost) {
    throw new Error(`The add-block control is not the topmost pointer target: ${JSON.stringify(evidence)}`);
  }
}

async function chooseRangeOption(rangeToolbar: Locator, testId: string, option: string): Promise<void> {
  const trigger = rangeToolbar.getByTestId(testId);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const optionControl = rangeToolbar.locator('xpath=ancestor::body').getByRole('option', { name: option, exact: true });
  const samples = await optionControl.evaluate(async (element) => {
    const frames: Array<{ height: number; left: number; top: number; width: number }> = [];
    for (let index = 0; index < 3; index += 1) {
      await new Promise<void>((resolve) => element.ownerDocument.defaultView?.requestAnimationFrame(() => resolve()));
      const rect = element.getBoundingClientRect();
      frames.push({ height: rect.height, left: rect.left, top: rect.top, width: rect.width });
    }
    return frames;
  });
  const baseline = samples[0];
  for (const sample of samples.slice(1)) {
    expect(Math.abs(sample.left - baseline.left), `range option left must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
    expect(Math.abs(sample.top - baseline.top), `range option top must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
    expect(Math.abs(sample.width - baseline.width), `range option width must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
    expect(Math.abs(sample.height - baseline.height), `range option height must converge: ${JSON.stringify(samples)}`).toBeLessThanOrEqual(.5);
  }
  await optionControl.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

async function selectedText(field: Locator): Promise<string> {
  return field.evaluate((element) => element.ownerDocument.defaultView?.getSelection()?.toString() ?? '');
}

async function dragSelectText(page: Page, field: Locator, target: string): Promise<void> {
  await field.scrollIntoViewIfNeeded();
  const geometry = await field.evaluate((element, selectedCopy) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const startOffset = (node.textContent ?? '').indexOf(selectedCopy);
      if (startOffset >= 0) {
        const startCharacter = document.createRange();
        startCharacter.setStart(node, startOffset);
        startCharacter.setEnd(node, startOffset + 1);
        const endCharacter = document.createRange();
        endCharacter.setStart(node, startOffset + selectedCopy.length - 1);
        endCharacter.setEnd(node, startOffset + selectedCopy.length);
        const startRect = startCharacter.getClientRects()[0];
        const endRects = endCharacter.getClientRects();
        const endRect = endRects[endRects.length - 1];
        if (!startRect || !endRect) {
          throw new Error(`Pointer selection target has no rendered character geometry: ${selectedCopy}`);
        }
        const fieldRect = element.getBoundingClientRect();
        return {
          field: { height: fieldRect.height, width: fieldRect.width },
          start: {
            x: startRect.left - fieldRect.left + Math.max(1, startRect.width * .1),
            y: startRect.top - fieldRect.top + startRect.height / 2,
          },
          end: {
            x: endRect.right - fieldRect.left - Math.max(1, endRect.width * .1),
            y: endRect.top - fieldRect.top + endRect.height / 2,
          },
        };
      }
      node = walker.nextNode();
    }
    throw new Error(`Pointer selection target was not found: ${selectedCopy}`);
  }, target);

  const fieldBox = await field.boundingBox();
  expect(fieldBox).not.toBeNull();
  if (!fieldBox) {
    throw new Error('The editable field has no pointer geometry.');
  }
  const scaleX = fieldBox.width / geometry.field.width;
  const scaleY = fieldBox.height / geometry.field.height;
  const start = {
    x: fieldBox.x + geometry.start.x * scaleX,
    y: fieldBox.y + geometry.start.y * scaleY,
  };
  const end = {
    x: fieldBox.x + geometry.end.x * scaleX,
    y: fieldBox.y + geometry.end.y * scaleY,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(end.x, end.y, { steps: 12 });
  } finally {
    await page.mouse.up();
  }
  await expect.poll(() => selectedText(field)).toBe(target);
}

async function expandBlockGallery(page: Page): Promise<void> {
  const gallery = visibleTestId(page, 'page-builder-block-gallery');
  const grid = gallery.locator('.g7pb-block-gallery__grid');

  for (let batch = 0; batch < 8; batch += 1) {
    const total = Number(await grid.getAttribute('data-total-items') ?? '0');
    const rendered = Number(await grid.getAttribute('data-rendered-items') ?? '0');
    if (total > 0 && rendered >= total) return;

    const loadMore = gallery.locator('[data-testid="page-builder-gallery-load-more"]:visible');
    await expect(loadMore, 'block gallery load-more button must exist while items remain').toBeVisible();
    await loadMore.scrollIntoViewIfNeeded();
    await waitForStableLayout(page);

    const renderedAfterScroll = Number(await grid.getAttribute('data-rendered-items') ?? '0');
    if (renderedAfterScroll > rendered) {
      continue;
    }

    if (await loadMore.count() === 0) {
      await expect.poll(
        async () => Number(await grid.getAttribute('data-rendered-items') ?? '0'),
        { message: 'the observer-driven gallery window renders after the load-more control leaves the DOM' },
      ).toBeGreaterThan(rendered);
      continue;
    }

    let evidence: Awaited<ReturnType<typeof pointerHitEvidence>>;
    try {
      evidence = await pointerHitEvidence(loadMore);
    } catch (error) {
      if (await loadMore.count() > 0) throw error;
      await expect.poll(
        async () => Number(await grid.getAttribute('data-rendered-items') ?? '0'),
        { message: 'the observer-driven gallery window renders after pointer evidence becomes detached' },
      ).toBeGreaterThan(rendered);
      continue;
    }
    if (!evidence.topmost) {
      throw new Error(`block gallery load-more button is not the topmost pointer target: ${JSON.stringify(evidence)}`);
    }
    try {
      await loadMore.click();
    } catch (error) {
      if (await loadMore.count() > 0) throw error;
    }
    await expect.poll(
      async () => Number(await grid.getAttribute('data-rendered-items') ?? '0'),
      { message: 'the next gallery window renders' },
    ).toBeGreaterThan(rendered);
  }

  throw new Error('Block gallery did not render every requested window.');
}

async function selectDefinitionGalleryTab(gallery: Locator): Promise<void> {
  const tab = gallery.locator('[role="tab"]:visible').filter({ hasText: /블록 종류/ });
  if (await tab.getAttribute('aria-selected') !== 'true') {
    await activatePointerTarget(gallery.page(), tab, 'block definition gallery tab');
  }
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function activateGalleryOption(gallery: Locator, option: string): Promise<void> {
  const button = gallery.locator(`[data-testid="page-builder-block-option-${option}"]:visible`);
  await expect(button).toBeVisible();
  await activatePointerTarget(gallery.page(), button, `block gallery option ${option}`);
  await expect(gallery).toBeHidden();
}

async function addBlockFromGallery(page: Page, option: string): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await revealEditorHeaderActions(page);
  await activatePointerTarget(page, page.getByTestId('page-builder-add-block'), 'add-block control');
  const gallery = visibleTestId(page, 'page-builder-block-gallery');
  await selectDefinitionGalleryTab(gallery);
  await expandBlockGallery(page);
  await activateGalleryOption(gallery, option);
}

async function revealBlockLibrary(page: Page): Promise<void> {
  const library = page.getByTestId('page-builder-block-library');
  if (await library.isVisible()) {
    return;
  }

  await page.getByText('Blocks', { exact: true }).click();
  await expect(library).toBeVisible();
}

async function hideMobileBlockLibrary(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  const library = page.getByTestId('page-builder-block-library');
  if (!viewport || viewport.width > MOBILE_EDITOR_BREAKPOINT || !(await library.isVisible())) {
    return;
  }

  await page.getByText('Blocks', { exact: true }).click();
  await expect(library).toBeHidden();
}

async function revealInspectorField(page: Page, testId: string): Promise<Locator> {
  const field = visibleTestId(page, testId);
  await dismissContextPanel(page);

  const fieldsTab = page.locator('nav').getByText('Fields', { exact: true });
  if (await fieldsTab.isVisible()) {
    if (!(await mobileFieldsPanelIsOpen(page))) {
      await activatePointerTarget(page, fieldsTab, 'mobile Fields tab');
      await expect(page.locator(PUCK_LEFT_SIDEBAR_OPEN)).toHaveCount(1);
      await waitForStableLayout(page);
    }
  } else {
    const rightSidebarOpen = await page.locator(PUCK_RIGHT_SIDEBAR_OPEN).count() > 0;
    if (!rightSidebarOpen) {
      const sidebarToggle = page.getByRole('button', { name: 'Toggle right sidebar' });
      await expect(sidebarToggle).toBeVisible();
      await activatePointerTarget(page, sidebarToggle, 'right sidebar toggle');
      await expect(page.locator(PUCK_RIGHT_SIDEBAR_OPEN)).toHaveCount(1);
      await waitForStableLayout(page);
    }
  }

  await expect(field).toBeVisible();
  return field;
}

async function selectEditorBlock(page: Page, type: BlockType): Promise<void> {
  await dismissContextPanel(page);
  const viewport = page.viewportSize();

  if (viewport && viewport.width <= MOBILE_EDITOR_BREAKPOINT) {
    const navigation = page.locator('nav');
    const fieldsTab = navigation.getByText('Fields', { exact: true });
    const outlineTab = navigation.getByText('Outline', { exact: true });
    if (await mobileFieldsPanelIsOpen(page)) {
      await activatePointerTarget(page, fieldsTab, 'mobile Fields tab');
      await expect(page.locator(PUCK_LEFT_SIDEBAR_OPEN)).toHaveCount(0);
    }

    if (!(await mobileSidebarPanelIsOpen(page, 'Outline'))) {
      await activatePointerTarget(page, outlineTab, 'mobile Outline tab');
    }
    const outlineItem = page.getByText(BLOCK_LABELS[type], { exact: true }).last();
    await expect(outlineItem).toBeVisible();
    await activatePointerTarget(page, outlineItem, `mobile ${BLOCK_LABELS[type]} outline item`);
    if (await fieldsTab.isVisible()) {
      if (!(await mobileFieldsPanelIsOpen(page))) {
        await activatePointerTarget(page, fieldsTab, 'mobile Fields tab');
      }
      await expect(page.locator(PUCK_LEFT_SIDEBAR_OPEN)).toHaveCount(1);
      await expect(outlineItem).toBeHidden();
    }
    return;
  }

  const pointerTarget = editorBlockPointerTarget(page, type);
  await expect(pointerTarget).toHaveAttribute('data-puck-component', /.+/);
  await activatePointerTarget(page, pointerTarget, `${BLOCK_LABELS[type]} canvas block`, { x: 4, y: 4 });
}

async function expectBlockOrder(locator: Locator, expected: BlockType[]): Promise<void> {
  await expect(locator).toHaveCount(expected.length);

  const actual = await locator.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-block-type')),
  );

  expect(actual).toEqual(expected);
}

async function dragLibraryBlockBefore(
  page: Page,
  component: string,
  targetType: BlockType,
): Promise<void> {
  const source = page.getByTestId(`drawer-item:${component}`);
  const target = editorBlock(page, targetType);
  const blocks = editorBlocks(page);
  const initialBlockCount = await blocks.count();
  const canvasEntry = page.frameLocator('iframe').locator('[data-puck-entry]');
  const linePlaceholder = page.frameLocator('iframe').locator('[data-puck-line-placeholder]');
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error(`Could not resolve drag geometry for ${component} before ${targetType}.`);
  }

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  try {
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 12,
      sourceBox.y + sourceBox.height / 2,
      { steps: 4 },
    );
    await expect(canvasEntry).toHaveAttribute('data-puck-dragging', 'true');
    await page.mouse.move(targetBox.x + 24, targetBox.y + Math.min(24, targetBox.height * 0.15), { steps: 24 });
    await expect(linePlaceholder).toHaveCount(1);
  } finally {
    await page.mouse.up();
  }
  await expect(blocks).toHaveCount(initialBlockCount + 1);
}

async function expectCanvasWidth(page: Page, width: number): Promise<void> {
  await expect.poll(
    () => page.locator('#puck-canvas-root').evaluate((element) => element.style.width),
  ).toBe(`${width}px`);
}

async function requiredLink(locator: Locator, label: string): Promise<string> {
  await expect(locator).toBeVisible();
  await expect(locator).toHaveAttribute('href', /\S+/);
  const href = await locator.getAttribute('href');

  if (!href) {
    throw new Error(`${label} did not provide a URL.`);
  }

  const url = new URL(href, BASE_URL);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${label} provided an unsupported URL.`);
  }

  return url.toString();
}

async function expectResponsivePage(page: Page, testInfo: TestInfo): Promise<void> {
  const viewport = page.viewportSize();
  expect(viewport, 'A fixed viewport is required for responsive acceptance.').not.toBeNull();

  if (!viewport) {
    return;
  }

  if (testInfo.project.name === 'desktop') {
    expect(viewport.width).toBeGreaterThanOrEqual(1200);
  } else if (testInfo.project.name === 'tablet') {
    expect(viewport.width).toBeGreaterThanOrEqual(700);
    expect(viewport.width).toBeLessThan(1200);
  } else if (testInfo.project.name === 'mobile') {
    expect(viewport.width).toBeLessThanOrEqual(500);
  }

  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  const count = await renderedBlocks(page).count();
  for (let index = 0; index < count; index += 1) {
    const box = await renderedBlocks(page).nth(index).boundingBox();
    expect(box, `Rendered block ${index + 1} must have a visible box.`).not.toBeNull();

    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  }
}

async function selectAndEditHero(
  page: Page,
  title: string,
  subtitle: string,
  buttonLabel: string,
  directCanvas = true,
): Promise<void> {
  const hero = editorBlock(page, 'hero');
  await expect(hero).toHaveCount(1);
  await selectEditorBlock(page, 'hero');
  const inlineTitle = hero.locator(
    '[data-g7pb-inline-field="title"][contenteditable], [data-g7pb-inline-field="title"] [contenteditable]',
  );
  const inlineSubtitle = hero.locator(
    '[data-g7pb-inline-field="eyebrow"][contenteditable], [data-g7pb-inline-field="eyebrow"] [contenteditable]',
  );
  const inlineBody = hero.locator(
    '[data-g7pb-inline-field="body"][contenteditable], [data-g7pb-inline-field="body"] [contenteditable]',
  );
  const inlineButton = hero.locator(
    '[data-g7pb-inline-field="primaryLabel"][contenteditable], [data-g7pb-inline-field="primaryLabel"] [contenteditable]',
  );
  await expect(inlineTitle).toHaveCount(1);
  await expect(inlineSubtitle).toHaveCount(1);
  await expect(inlineBody).toHaveCount(1);
  await expect(inlineButton).toHaveCount(1);
  await activatePointerTarget(page, inlineTitle, 'Hero title');
  await expect(inlineTitle).toBeEditable();
  await inlineTitle.fill(title);
  if (directCanvas) {
    await activatePuckPlainTextField(page, inlineSubtitle, 'Hero eyebrow');
    await inlineSubtitle.fill(subtitle);
    await activatePuckPlainTextField(page, inlineButton, 'Hero primary action label');
    await inlineButton.fill(buttonLabel);
    await inlineSubtitle.press('Tab');
  } else {
    await (await revealInspectorField(page, 'page-builder-hero-subtitle')).fill(subtitle);
    await (await revealInspectorField(page, 'page-builder-hero-primary-label')).fill(buttonLabel);
  }
  await expect(inlineTitle).toContainText(title);
  await expect(await revealInspectorField(page, 'page-builder-hero-subtitle')).toHaveValue(subtitle);
}

async function selectAndEditFeatures(
  page: Page,
  heading: string,
  itemTitle: string,
  itemBody: string,
): Promise<void> {
  const features = editorBlock(page, 'features');
  await expect(features).toHaveCount(1);
  await selectEditorBlock(page, 'features');
  const headingField = editorInlineField(page, 'features', 'title');
  await activatePointerTarget(page, headingField, 'Features heading');
  await expect(headingField).toBeEditable();
  await headingField.fill(heading);
  const itemFields = [
    [editorInlineField(page, 'features', 'items.0.title'), itemTitle, 'Features first item title'],
    [editorInlineField(page, 'features', 'items.0.body'), itemBody, 'Features first item body'],
  ] as const;
  for (const [field, value, label] of itemFields) {
    await activatePuckRichTextField(page, field, label);
    await field.fill(value);
    await expect(field).toHaveText(value);
  }
}

async function selectAndEditCta(
  page: Page,
  heading: string,
  body: string,
  primaryLabel: string,
): Promise<void> {
  const cta = editorBlock(page, 'cta');
  await expect(cta).toHaveCount(1);
  await selectEditorBlock(page, 'cta');
  const inline = (field: string): Locator => cta.locator(
    `[data-g7pb-inline-field="${field}"][contenteditable], [data-g7pb-inline-field="${field}"] [contenteditable]`,
  );
  const headingField = inline('heading');
  await activatePointerTarget(page, headingField, 'CTA heading');
  await expect(headingField).toBeEditable();
  await headingField.fill(heading);
  await (await revealInspectorField(page, 'page-builder-cta-primary-url')).fill('/start-now');
  await (await revealInspectorField(page, 'page-builder-cta-theme')).selectOption('dark');
  for (const [field, value] of [['body', body], ['primaryLabel', primaryLabel]] as const) {
    const target = inline(field);
    await activatePointerTarget(page, target, `CTA ${field}`);
    await expect(target).toBeEditable();
    await target.fill(value);
  }
}

async function selectAndEditContact(
  page: Page,
  heading: string,
  address: string,
  email: string,
): Promise<void> {
  const contact = editorBlock(page, 'contact');
  await expect(contact).toHaveCount(1);
  await selectEditorBlock(page, 'contact');
  const headingField = editorInlineField(page, 'contact', 'heading');
  await activatePointerTarget(page, headingField, 'Contact heading');
  await expect(headingField).toBeEditable();
  await headingField.fill(heading);
  await (await revealInspectorField(page, 'page-builder-contact-address')).fill(address);
  await (await revealInspectorField(page, 'page-builder-contact-phone')).fill('02-9876-5432');
  await (await revealInspectorField(page, 'page-builder-contact-email')).fill(email);
  await (await revealInspectorField(page, 'page-builder-contact-map-label')).fill('오시는 길');
  await (await revealInspectorField(page, 'page-builder-contact-map-url')).fill('https://maps.example.com/office');
}

async function saveDraft(page: Page): Promise<void> {
  const persisted = page.waitForResponse((response) => {
    const pathname = new URL(response.url()).pathname;
    return (response.request().method() === 'PUT' && pathname.endsWith('/draft'))
      || (response.request().method() === 'POST' && pathname.endsWith('/preview'));
  });
  await page.getByTestId('page-builder-save').click();
  expect((await persisted).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute(
    'data-state',
    'saved',
  );
}

async function currentDocumentRevision(page: Page, documentId: string): Promise<number> {
  const revision = await page.evaluate(async (id) => {
    const token = window.localStorage.getItem('auth_token');
    if (!token) {
      return null;
    }
    const response = await fetch(`/api/modules/jiwonpapa-page_builder/admin/documents/${id}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await response.json() as { data?: { revision?: unknown } };

    return typeof payload.data?.revision === 'number' ? payload.data.revision : null;
  }, documentId);

  if (revision === null) {
    throw new Error('Page Builder document did not expose its current revision.');
  }

  return revision;
}

async function publish(page: Page): Promise<void> {
  const publishButton = page.getByTestId('page-builder-publish');
  await revealEditorHeaderActions(page);
  const [response] = await Promise.all([
    page.waitForResponse((candidate) => {
      const pathname = new URL(candidate.url()).pathname;

      return candidate.request().method() === 'POST'
        && /^\/api\/modules\/jiwonpapa-page_builder\/admin\/publications\/[^/]+\/commit$/.test(pathname);
    }, { timeout: 30_000 }),
    activatePointerTarget(page, publishButton, 'publish control'),
  ]);
  expect(response.ok()).toBe(true);
  await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute(
    'data-state',
    'published',
  );
}

async function openDocumentActions(row: Locator): Promise<void> {
  const more = row.getByTestId('page-builder-manager-more');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
}

async function expectSingleLineAction(action: Locator): Promise<void> {
  const metrics = await action.evaluate((element) => {
    const label = element.querySelector('span') ?? element;
    const range = document.createRange();
    range.selectNodeContents(label);
    const lineTops = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top)));

    return {
      height: element.getBoundingClientRect().height,
      lines: lineTops.size,
      whiteSpace: getComputedStyle(element).whiteSpace,
    };
  });

  expect(metrics.whiteSpace).toBe('nowrap');
  expect(metrics.lines).toBeLessThanOrEqual(1);
  expect(metrics.height).toBeLessThanOrEqual(42);
}

test('manages, publishes, restores, republishes, and unpublishes a page-builder document', async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(300_000);

  const authToken = await authenticateAdmin(context);
  await recoverOwnedE2eArtifacts(authToken);

  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const slug = `g7pb-e2e-${projectSlug}-${runId}`;
  const pageTitle = `Page Builder E2E ${runId}`;
  const managedTitle = `Managed Page Builder E2E ${runId}`;
  const managedSlug = `managed-${slug}`;
  const duplicateTitle = `${pageTitle} Copy`;
  const duplicateSlug = `${slug}-copy`;
  const heroTitle = `Original Hero ${runId}`;
  const heroButtonLabel = `Explore ${runId}`;
  const revisedHeroTitle = `Republished Hero ${runId}`;
  const heroSubtitle = `Original subtitle ${runId}`;
  const revisedHeroSubtitle = `Republished subtitle ${runId}`;
  const featuresHeading = `Features ${runId}`;
  const featureTitle = `Reliable publishing ${runId}`;
  const featureBody = `Published output remains stable ${runId}`;
  const ctaHeading = `Start with confidence ${runId}`;
  const ctaBody = `One clear next step ${runId}`;
  const ctaPrimaryLabel = `Start now ${runId}`;
  const contactHeading = `Contact our team ${runId}`;
  const contactAddress = `Seoul office ${runId}`;
  const contactEmail = `e2e-${runId}@example.com`;
  const ownershipJournalPath = await writeE2eOwnershipJournal(
    `${projectSlug}-${runId}`,
    [slug, managedSlug, duplicateSlug],
  );

  let previewPage: Page | undefined;
  let publicContext: BrowserContext | undefined;
  let uploadedMediaId: string | null = null;
  let lifecycleError: unknown;

  try {
    page.on('pageerror', (error) => {
      console.error(`Page Builder browser runtime error: ${error.name}: ${error.message.slice(0, 500)}`);
    });
    const managerResponse = await page.goto(MANAGER_PATH);
    expect(managerResponse?.ok()).toBe(true);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();

    await page.getByTestId('page-builder-manager-block-packs').click();
    const blockPackDialog = page.getByTestId('page-builder-block-packs-dialog');
    await expect(blockPackDialog).toBeVisible();
    await expect(blockPackDialog).toContainText('jiwonpapa/builtin-core');
    await expect(blockPackDialog).toContainText('블록 45 / 완성 섹션 95');
    await expect(blockPackDialog).toContainText('편집기 상단 블록 추가');
    await expect(blockPackDialog.getByTestId('page-builder-block-pack-upload')).toBeAttached();
    const managerViewport = page.viewportSize()!;
    for (const width of [1440, 1024, 640, 390]) {
      await page.setViewportSize({ width, height: managerViewport.height });
      await expect.poll(() => blockPackDialog.getByRole('dialog').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const upload = blockPackDialog.getByTestId('page-builder-block-pack-upload');
      // Dialog enter animation scales geometry; the hidden input's CSS size is invariant.
      await expect(upload).toHaveCSS('width', '1px');
      await expect(upload).toHaveCSS('height', '1px');
    }
    await page.setViewportSize(managerViewport);
    const chooser = page.waitForEvent('filechooser');
    await blockPackDialog.getByText('ZIP 추가', { exact: true }).click();
    expect((await chooser).isMultiple()).toBe(false);
    await expect(blockPackDialog.getByRole('button', { name: '최신 버전 확인' })).toBeVisible();
    await blockPackDialog.getByRole('button', { name: '닫기' }).click();
    await expect(blockPackDialog).toHaveCount(0);

    await page.getByTestId('page-builder-manager-create').click();
    await expect(page.getByTestId('page-builder-manager-create-dialog')).toBeVisible();
    await page.getByTestId('page-builder-manager-title-input').fill(pageTitle);
    await page.getByTestId('page-builder-manager-slug-input').fill(slug);
    await page.getByTestId('page-builder-manager-shell-mode').selectOption('builder');
    await page.getByTestId('page-builder-manager-create-confirm').click();

    await expect.poll(() => new URL(page.url()).searchParams.get('document') ?? '').toMatch(
      DOCUMENT_ID_PATTERN,
    );
    const documentId = new URL(page.url()).searchParams.get('document');
    if (!documentId) {
      throw new Error('Created Page Builder document did not provide an identifier.');
    }

    await expect(page.getByTestId('page-builder-editor')).toBeVisible();

    await revealBlockLibrary(page);
    for (const component of [
      'Hero',
      'Heading',
      'RichText',
      'Image',
      'Buttons',
      'ImageText',
      'IconList',
      'HeroSlider',
      'Features',
      'Cta',
      'Contact',
      'LogoCloud',
      'Stats',
      'Pricing',
      'Team',
      'Gallery',
      'BarChart',
      'G7RecentPosts',
      'G7ProductGrid',
      'InquiryForm',
      'MapDirections',
      'Testimonials',
      'FaqAccordion',
      'ProcessTimeline',
      'Tabs',
      'ComparisonTable',
      'ArticleList',
      'VideoEmbed',
      'LogoCarousel',
      'TestimonialSlider',
      'EventSchedule',
      'DownloadResources',
      'G7BoardArchive',
      'G7ProductShowcase',
      'G7PostDetail',
      'G7ProductDetail',
      'Divider',
      'Blockquote',
      'Notice',
      'CardGrid',
      'Breadcrumbs',
      'AnchorMenu',
      'SocialLinks',
      'ImageCarousel',
    ]) {
      await expect(page.getByTestId(`drawer-item:${component}`)).toHaveCount(1);
    }
    const drawerLibrary = page.getByTestId('page-builder-block-library');
    const renderedThumbnails = drawerLibrary.locator('.g7pb-block-thumb--image > img[src*="/thumbnails/generated/"]');
    const collectThumbnailUrls = async () => [...new Set(await renderedThumbnails.evaluateAll((images) =>
      images.map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src)))];
    await expect.poll(collectThumbnailUrls, {
      message: 'all built-in block thumbnail URLs are rendered',
    }).toHaveLength(44);
    await expect(page.getByTestId('drawer-item:HeroSplit')).toHaveCount(0);
    const thumbnailUrls = await collectThumbnailUrls();
    const thumbnailResponses = await Promise.all(thumbnailUrls.map((url) => page.request.get(url)));
    try {
      expect(thumbnailResponses.every((response) => response.ok())).toBe(true);
      expect(thumbnailResponses.every((response) => response.headers()['content-type'] === 'image/png')).toBe(true);
    } finally {
      await Promise.all(thumbnailResponses.map((response) => response.dispose()));
    }
    await expect.poll(async () => renderedThumbnails.evaluateAll((images) => images.some((image) => {
      const thumbnail = image as HTMLImageElement;

      return thumbnail.complete && thumbnail.naturalWidth === 320 && thumbnail.naturalHeight === 200;
    })), {
      message: 'a visible thumbnail is decoded at its source dimensions',
    }).toBe(true);
    const drawerText = await drawerLibrary.textContent();
    expect(drawerText?.match(/끌어/g)?.length ?? 0).toBe(0);
    await expect(drawerLibrary.locator('.g7pb-block-thumb__zoom')).toHaveCount(0);
    const compactHeadingPreview = drawerLibrary.locator(
      '[data-library-block="Heading"][data-preview-density="compact"] .g7pb-puck-drawer-card__preview:visible',
    ).first();
    const compactRichTextPreview = drawerLibrary.locator(
      '[data-library-block="RichText"][data-preview-density="compact"] .g7pb-puck-drawer-card__preview:visible',
    ).first();
    const regularImageTextPreview = drawerLibrary.locator(
      '[data-library-block="ImageText"][data-preview-density="regular"] .g7pb-puck-drawer-card__preview:visible',
    ).first();
    await expect(compactHeadingPreview).toBeVisible();
    await expect(compactRichTextPreview).toBeVisible();
    await expect(regularImageTextPreview).toBeVisible();
    if (testInfo.project.name === 'desktop') {
      const [headingBox, richTextBox, imageTextBox] = await Promise.all([
        compactHeadingPreview.boundingBox(),
        compactRichTextPreview.boundingBox(),
        regularImageTextPreview.boundingBox(),
      ]);
      expect(headingBox).not.toBeNull();
      expect(richTextBox).not.toBeNull();
      expect(imageTextBox).not.toBeNull();
      expect(headingBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan((imageTextBox?.height ?? 0) * .75);
      expect(richTextBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThan((imageTextBox?.height ?? 0) * .75);
    }
    await hideMobileBlockLibrary(page);

    await revealEditorHeaderActions(page);
    await expect(page.getByTestId('page-builder-viewport-1280')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('page-builder-viewport-360').click();
    await expectCanvasWidth(page, 360);
    await page.getByTestId('page-builder-viewport-768').click();
    await expectCanvasWidth(page, 768);
    await page.getByTestId('page-builder-viewport-1280').click();
    await expectCanvasWidth(page, 1280);
    if ((page.viewportSize()?.width ?? 1280) <= MOBILE_EDITOR_BREAKPOINT) {
      await page.getByTestId('page-builder-viewport-360').click();
      await expectCanvasWidth(page, 360);
    }

    await page.getByTestId('page-builder-page-design').click();
    await (await revealInspectorField(page, 'page-builder-design-palette')).selectOption('emerald');
    await (await revealInspectorField(page, 'page-builder-design-font')).selectOption('serif');
    await (await revealInspectorField(page, 'page-builder-design-radius')).selectOption('round');
    await (await revealInspectorField(page, 'page-builder-design-width')).selectOption('wide');
    await (await revealInspectorField(page, 'page-builder-design-scale')).selectOption('large');
    await (await revealInspectorField(page, 'page-builder-design-custom-1-light')).fill('#13579b');
    await (await revealInspectorField(page, 'page-builder-design-custom-1-dark')).fill('#b3d4ff');
    await expect(page.frameLocator('iframe').locator('.g7pb-document-theme')).toHaveClass(/g7pb-theme-palette-emerald/);

    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-add-block').click();
    const blockGallery = page.getByTestId('page-builder-block-gallery');
    const galleryLayer = Number(await blockGallery.evaluate((element) => getComputedStyle(element).zIndex));
    const commandBarLayer = Number(await page.locator('.g7pb-command-bar').evaluate((element) =>
      getComputedStyle(element).zIndex));
    expect(galleryLayer).toBeGreaterThan(commandBarLayer);
    await expect(blockGallery.getByRole('tab', { name: /블록 종류/ })).toBeVisible();
    await expect(blockGallery.getByRole('tab', { name: /완성 섹션/ })).toBeVisible();
    await expect(blockGallery.getByLabel('블록 팩')).toContainText('기본 제공');
    await expect(blockGallery.locator('.g7pb-block-thumb__zoom')).toHaveCount(0);
    const firstGalleryPreview = blockGallery.locator('[data-block-preview]').first();
    await expect(firstGalleryPreview).toBeVisible();
    const firstGalleryPreviewBox = await firstGalleryPreview.boundingBox();
    expect(firstGalleryPreviewBox).not.toBeNull();
    if (firstGalleryPreviewBox) {
      expect(firstGalleryPreviewBox.width / firstGalleryPreviewBox.height).toBeCloseTo(1.6, 1);
    }
    const blockSearch = page.getByLabel('블록 검색');
    await blockSearch.fill('막대그래프');
    await expect(page.getByTestId('page-builder-block-option-bar-chart')).toBeVisible();
    await expect(page.getByTestId('page-builder-block-option-hero')).toHaveCount(0);
    await blockSearch.fill('');
    await selectDefinitionGalleryTab(blockGallery);
    const galleryGrid = blockGallery.locator('.g7pb-block-gallery__grid');
    await expect(galleryGrid).toHaveAttribute('data-total-items', '44');
    await expect(galleryGrid).toHaveAttribute('data-rendered-items', '24');
    await expandBlockGallery(page);
    await expect(galleryGrid).toHaveAttribute('data-rendered-items', '44');
    for (const option of [
      'hero',
      'heading',
      'rich-text',
      'image',
      'buttons',
      'image-text',
      'icon-list',
      'hero-slider',
      'features',
      'cta',
      'contact',
      'logo-cloud',
      'stats',
      'pricing',
      'team',
      'gallery',
      'bar-chart',
      'g7-recent-posts',
      'g7-product-grid',
      'testimonials',
      'faq-accordion',
      'process-timeline',
      'tabs',
      'comparison-table',
      'article-list',
      'video-embed',
      'logo-carousel',
      'testimonial-slider',
      'event-schedule',
      'download-resources',
      'g7-board-archive',
      'g7-product-showcase',
      'g7-post-detail',
      'g7-product-detail',
      'inquiry-form',
      'map-directions',
      'divider',
      'blockquote',
      'notice',
      'card-grid',
      'breadcrumbs',
      'anchor-menu',
      'social-links',
      'image-carousel',
    ]) {
      await expect(page.getByTestId(`page-builder-block-option-${option}`)).toBeVisible();
    }
    await activateGalleryOption(blockGallery, 'hero');
    await addBlockFromGallery(page, 'hero-slider');
    await expect(page.getByTestId('page-builder-hero-warning')).toContainText('Hero 계열 블록이 2개');
    await page.getByTestId('page-builder-hero-warning-dismiss').click();
    await expect(page.getByTestId('page-builder-hero-warning')).toBeHidden();
    const slider = editorBlock(page, 'hero-slider');
    const sliderInlineFields = slider.locator('[contenteditable]');
    const visibleSliderInlineFields = slider.locator('[contenteditable]:visible');
    await expect(sliderInlineFields).toHaveCount(8);
    await expect(visibleSliderInlineFields).toHaveCount(4);
    if (testInfo.project.name === 'desktop') {
      await visibleSliderInlineFields.first().scrollIntoViewIfNeeded();
      await visibleSliderInlineFields.first().hover();
      await expect(visibleSliderInlineFields.first()).toHaveAttribute('contenteditable', 'plaintext-only');
    }
    if (testInfo.project.name === 'desktop') {
      await slider.getByTestId('page-builder-slider-next').click();
      await expect(slider.getByTestId('page-builder-slider-slide-1')).toHaveAttribute('aria-pressed', 'true');
      await expect(slider.locator('[data-slide-index="1"]')).toBeVisible();
      await expect(slider.locator('[data-slide-index="0"]')).toBeHidden();
    }
    await addBlockFromGallery(page, 'cta');
    await revealBlockLibrary(page);
    await dragLibraryBlockBefore(page, 'Features', 'hero');
    await expectBlockOrder(editorBlocks(page), ['features', 'hero', 'hero-slider', 'cta']);
    await hideMobileBlockLibrary(page);

    await selectEditorBlock(page, 'cta');
    await addBlockFromGallery(page, 'contact');
    for (const option of ['heading', 'rich-text', 'image', 'buttons', 'image-text', 'icon-list', 'logo-cloud', 'stats', 'pricing', 'team', 'gallery', 'bar-chart', 'g7-recent-posts', 'g7-product-grid', 'testimonials', 'faq-accordion', 'process-timeline', 'tabs', 'comparison-table', 'article-list', 'video-embed', 'logo-carousel', 'testimonial-slider', 'event-schedule', 'download-resources', 'g7-board-archive', 'g7-product-showcase']) {
      await addBlockFromGallery(page, option);
    }

    if (testInfo.project.name === 'desktop') {
      const richTextBlock = editorBlock(page, 'rich-text');
      const richTextEditor = richTextBlock.locator('[contenteditable="true"]').first();
      const selectedText = '이해해야 할 내용';
      await dragSelectText(page, richTextEditor, selectedText);
      const rangeToolbar = page.frameLocator('iframe').getByTestId('page-builder-richtext-inline-toolbar');
      await expect(rangeToolbar).toBeVisible();
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-font', '명조');
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-size', '32 px · 2 rem');
      await chooseRangeOption(rangeToolbar, 'page-builder-richtext-tone', '강조색');
      const selectedMark = richTextBlock.locator('span[data-g7pb-font="serif"][data-g7pb-font-size-rem="2"][data-g7pb-tone="accent"]');
      await expect(selectedMark).toHaveText(selectedText);
      await expect(selectedMark).toHaveCSS('font-size', '32px');
      await expect(richTextBlock.locator('[contenteditable="true"]')).toContainText('방문자가 이해해야 할 내용을 읽기 편한 문단');
    }

    await selectAndEditHero(page, heroTitle, heroSubtitle, heroButtonLabel, testInfo.project.name === 'desktop');
    if (testInfo.project.name === 'desktop') {
      const heroBlock = editorBlock(page, 'hero');
      const heroTitleField = editorInlineField(page, 'hero', 'title');
      const selectedHeadingText = 'Hero';
      await dragSelectText(page, heroTitleField, selectedHeadingText);
      const headingRangeToolbar = page.frameLocator('iframe').getByTestId('page-builder-richtext-inline-toolbar');
      await expect(headingRangeToolbar).toBeVisible();
      await expect(page.getByTestId('page-builder-context-panel')).toBeHidden();
      await chooseRangeOption(headingRangeToolbar, 'page-builder-richtext-weight', '매우 굵게');
      await chooseRangeOption(headingRangeToolbar, 'page-builder-richtext-tone', '사용자색 1');
      await expect(heroTitleField.locator('span[data-g7pb-weight="bold"][data-g7pb-tone="custom1"]'))
        .toHaveText(selectedHeadingText);
      await heroTitleField.click({ position: { x: 4, y: 4 } });
      await expect.poll(() => selectedText(heroTitleField)).toBe('');
      await expect(headingRangeToolbar).toBeHidden();
      await openSelectedElementTextTools(page);
      const elementPanel = page.getByTestId('page-builder-context-panel');
      await expect(elementPanel).toContainText('요소 전체 · 부분 선택은 글자 위 툴바');
      const elementPanelBox = await elementPanel.boundingBox();
      const editorViewport = page.viewportSize();
      expect(elementPanelBox).not.toBeNull();
      expect(editorViewport).not.toBeNull();
      if (elementPanelBox && editorViewport) {
        expect(elementPanelBox.y).toBeGreaterThanOrEqual(0);
        expect(elementPanelBox.y + elementPanelBox.height).toBeLessThanOrEqual(editorViewport.height);
      }
      await elementPanel.getByTestId('page-builder-font-size-rem').selectOption('3');
      await elementPanel.getByTestId('page-builder-text-align-right').click();
      await expect(heroBlock.locator('[data-g7pb-inline-field="title"]')).toHaveClass(/g7pb-element-font-size--48/);
      await expect(heroBlock.locator('[data-g7pb-inline-field="title"]')).toHaveCSS('font-size', '48px');
      await expect(heroBlock.locator('[data-g7pb-inline-field="title"]')).toHaveClass(/g7pb-element-align--right/);
      await expect(heroBlock.locator('[data-g7pb-inline-field="body"]')).not.toHaveClass(/g7pb-element-font-size--48/);
      await activatePointerTarget(
        page,
        page.getByTestId('page-builder-app'),
        'editor background outside the element balloon',
        { x: 4, y: 4 },
      );
      await expect(elementPanel).toBeHidden();

      const containerWidth = await revealInspectorField(page, 'page-builder-block-container-width');
      const containerAlign = await revealInspectorField(page, 'page-builder-block-container-align');
      const containerHeight = await revealInspectorField(page, 'page-builder-block-min-height');
      const verticalAlign = await revealInspectorField(page, 'page-builder-block-vertical-align');
      await containerWidth.selectOption('full');
      await containerAlign.selectOption('right');
      await containerHeight.selectOption('viewport');
      await verticalAlign.selectOption('center');
      await expect(containerWidth).toHaveValue('full');
      await expect(containerAlign).toHaveValue('right');
      await expect(containerHeight).toHaveValue('viewport');
      await expect(verticalAlign).toHaveValue('center');
      await expect(heroBlock).toHaveClass(/g7pb-container-width--full/);
      await expect(heroBlock).toHaveClass(/g7pb-container-align--right/);
      await expect(heroBlock).toHaveClass(/g7pb-container-height--viewport/);
      await expect(heroBlock).toHaveClass(/g7pb-container-vertical--center/);
      await containerWidth.selectOption('inherit');
      await containerAlign.selectOption('center');
      await containerHeight.selectOption('auto');
      await verticalAlign.selectOption('start');

      await page.getByTestId('page-builder-manager-link').click();
      const unsavedDialog = page.getByTestId('page-builder-unsaved-dialog');
      await expect(unsavedDialog).toContainText('저장하지 않고 나가면');
      await unsavedDialog.getByTestId('page-builder-unsaved-cancel').click();
      await expect(unsavedDialog).toHaveCount(0);

      const heroUrl = await revealInspectorField(page, 'page-builder-hero-primary-url');
      await visibleTestId(page, 'page-builder-route-picker-open').click();
      const routePicker = page.getByTestId('page-builder-route-picker');
      await expect(routePicker).toBeVisible();
      await routePicker.getByPlaceholder('로그인, 게시판, 상품…').fill('로그인');
      await routePicker.locator('.g7pb-route-picker__routes button').filter({ hasText: '로그인' }).first().click();
      await expect(routePicker).toBeHidden();
      await expect(heroUrl).toHaveValue('/login');

      await activatePointerTarget(
        page,
        heroBlock.locator('[data-g7pb-inline-field="primaryLabel"]'),
        'Hero primary action label',
      );
      await openSelectedElementTextTools(page);
      await page.getByTestId('page-builder-element-route-open').click();
      await expect(routePicker).toBeVisible();
      await routePicker.getByPlaceholder('로그인, 게시판, 상품…').fill('회원가입');
      await routePicker.locator('.g7pb-route-picker__routes button').filter({ hasText: '회원가입' }).first().click();
      await expect(routePicker).toBeHidden();
      await expect(heroUrl).toHaveValue('/register');
    }
    const mediaUpload = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/modules/jiwonpapa-page_builder/admin/media');
    const mediaField = page.locator('.g7pb-media-field:visible');
    await (await revealInspectorField(page, 'page-builder-media-open')).click();
    await expect(mediaField.getByTestId('page-builder-media-library')).toBeVisible();
    const mediaItems = mediaField.getByTestId('page-builder-media-item');
    await expect(mediaItems.first()).toBeVisible();
    const mediaItemBoxes = await mediaItems.evaluateAll((items) => items.slice(0, 12).map((item) => {
      const rect = item.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    }));
    expect(mediaItemBoxes.every((box) => box.width >= 80 && box.height >= 80)).toBe(true);
    expect(mediaItemBoxes.every((box, index) => mediaItemBoxes.slice(index + 1).every((other) =>
      box.right <= other.left + 1 || other.right <= box.left + 1 || box.bottom <= other.top + 1 || other.bottom <= box.top + 1))).toBe(true);
    await mediaField.getByTestId('page-builder-media-file').setInputFiles({
      name: 'e2e-pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    const mediaResponse = await mediaUpload;
    expect(mediaResponse.ok()).toBe(true);
    const mediaPayload = await mediaResponse.json() as { data?: { id?: unknown } };
    uploadedMediaId = typeof mediaPayload.data?.id === 'string' ? mediaPayload.data.id : null;
    expect(uploadedMediaId).toMatch(DOCUMENT_ID_PATTERN);
    await updateE2eOwnershipJournal(ownershipJournalPath, uploadedMediaId);
    if (testInfo.project.name === 'desktop') {
      await mediaField.getByTestId('page-builder-media-open').click();
      const heroMedia = editorBlock(page, 'hero').locator('[data-g7pb-media-field="imageSrc"]');
      await expect(heroMedia.locator('img')).toHaveCount(1);
      await activatePointerTarget(page, heroMedia, 'Hero canvas image');
      const directClear = page.frameLocator('iframe').getByTestId('page-builder-canvas-media-clear')
        .locator('xpath=ancestor::button[1]');
      await expect(directClear).toBeEnabled();
      await activatePointerTarget(page, directClear, 'Hero canvas image clear');
      await expect(heroMedia.locator('.g7pb-preview-media-placeholder')).toContainText('대표 이미지를 선택하세요');
      await activatePointerTarget(page, heroMedia, 'Hero empty image slot');
      const directOpen = page.frameLocator('iframe').getByTestId('page-builder-canvas-media-open')
        .locator('xpath=ancestor::button[1]');
      await activatePointerTarget(page, directOpen, 'Hero canvas image change');
      const canvasMediaDialog = page.getByTestId('page-builder-canvas-media-dialog');
      await expect(canvasMediaDialog).toBeVisible();
      const directMediaItems = canvasMediaDialog.getByTestId('page-builder-media-item');
      await expect(directMediaItems.first()).toBeVisible();
      await directMediaItems.first().click();
      await expect(canvasMediaDialog).toBeHidden();
      await expect(heroMedia.locator('img')).toHaveCount(1);
    }
    await selectAndEditCta(page, ctaHeading, ctaBody, ctaPrimaryLabel);
    await selectAndEditContact(page, contactHeading, contactAddress, contactEmail);
    await selectAndEditFeatures(page, featuresHeading, featureTitle, featureBody);
    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-auto-motion').click();

    await expectBlockOrder(editorBlocks(page), PUBLISHED_BLOCK_ORDER);

    await saveDraft(page);
    if (testInfo.project.name === 'desktop') {
      await page.getByTestId('page-builder-source-view').click();
      const sourceDialog = page.getByTestId('page-builder-source-dialog');
      await expect(sourceDialog).toBeVisible();
      await expect(sourceDialog.getByTestId('page-builder-source-document')).toContainText('g7-page-builder/v1');
      await expect(sourceDialog.getByTestId('page-builder-source-document')).toContainText('g7.board-recent-posts-01');
      await sourceDialog.getByTestId('page-builder-source-artifact-tab').click();
      await sourceDialog.getByTestId('page-builder-source-generate').click();
      await expect(sourceDialog.getByTestId('page-builder-source-artifact')).toContainText(
        'data-g7pb-data-source="posts"',
        { timeout: 30_000 },
      );
      await sourceDialog.getByRole('button', { name: '원본 보기 닫기' }).click();
      await expect(sourceDialog).toHaveCount(0);
    }
    const originalRevision = await currentDocumentRevision(page, documentId);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`document=${documentId}`));
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await expect(page.getByTestId('page-builder-hero-warning')).toBeHidden();
    await expectBlockOrder(editorBlocks(page), PUBLISHED_BLOCK_ORDER);

    await revealEditorHeaderActions(page);
    await page.getByTestId('page-builder-page-design').click();
    await expect(await revealInspectorField(page, 'page-builder-design-palette')).toHaveValue('emerald');
    await expect(await revealInspectorField(page, 'page-builder-design-font')).toHaveValue('serif');
    await expect(await revealInspectorField(page, 'page-builder-design-radius')).toHaveValue('round');
    await expect(await revealInspectorField(page, 'page-builder-design-width')).toHaveValue('wide');
    await expect(await revealInspectorField(page, 'page-builder-design-scale')).toHaveValue('large');
    await expect(await revealInspectorField(page, 'page-builder-design-custom-1-light')).toHaveValue('#13579b');
    await expect(await revealInspectorField(page, 'page-builder-design-custom-1-dark')).toHaveValue('#b3d4ff');

    await selectEditorBlock(page, 'hero');
    await expect(editorInlineField(page, 'hero', 'title')).toContainText(heroTitle);
    await expect(await revealInspectorField(page, 'page-builder-hero-subtitle')).toHaveValue(heroSubtitle);
    if (testInfo.project.name === 'desktop') {
      await expect(await revealInspectorField(page, 'page-builder-hero-primary-url')).toHaveValue('/register');
      await expect(editorBlock(page, 'hero').locator('[data-g7pb-inline-field="title"]')).toHaveClass(/g7pb-element-font-size--48/);
      await expect(editorBlock(page, 'hero').locator('[data-g7pb-inline-field="title"]')).toHaveCSS('font-size', '48px');
      await expect(editorBlock(page, 'hero').locator('[data-g7pb-inline-field="body"]')).not.toHaveClass(/g7pb-element-font-size--48/);
    }
    await expect(editorBlock(page, 'hero').getByText(heroButtonLabel, { exact: true })).toBeVisible();
    await selectEditorBlock(page, 'features');
    await expect(editorInlineField(page, 'features', 'title')).toContainText(featuresHeading);
    await expect(editorInlineField(page, 'features', 'items.0.title')).toHaveText(featureTitle);
    await expect(editorInlineField(page, 'features', 'items.0.body')).toHaveText(featureBody);
    await selectEditorBlock(page, 'cta');
    await expect(editorInlineField(page, 'cta', 'heading')).toContainText(ctaHeading);
    await expect(editorInlineField(page, 'cta', 'body')).toContainText(ctaBody);
    await expect(await revealInspectorField(page, 'page-builder-cta-primary-label')).toHaveValue(ctaPrimaryLabel);
    await expect(await revealInspectorField(page, 'page-builder-cta-theme')).toHaveValue('dark');
    await selectEditorBlock(page, 'contact');
    await expect(editorInlineField(page, 'contact', 'heading')).toContainText(contactHeading);
    await expect(await revealInspectorField(page, 'page-builder-contact-address')).toHaveValue(contactAddress);
    await expect(await revealInspectorField(page, 'page-builder-contact-email')).toHaveValue(contactEmail);

    const previewUrl = await requiredLink(
      page.getByTestId('page-builder-preview-link'),
      'Page Builder preview',
    );
    previewPage = await context.newPage();
    const previewResponse = await previewPage.goto(previewUrl);
    expect(previewResponse?.ok()).toBe(true);
    await expect(previewPage.getByTestId('page-builder-preview-root')).toBeVisible();
    await expect(previewPage.getByTestId('page-builder-site-header')).toBeVisible();
    await expect(previewPage.getByTestId('page-builder-site-footer')).toBeVisible();
    await expect(previewPage.locator('.g7pb-document-theme')).toHaveClass(/g7pb-theme-palette-emerald/);
    await expect(previewPage.locator('.g7pb-document-theme')).toHaveClass(/g7pb-theme-font-serif/);
    await expectBlockOrder(renderedBlocks(previewPage), PUBLISHED_BLOCK_ORDER);
    await expect(previewPage.getByText(heroTitle, { exact: true })).toBeVisible();
    if (testInfo.project.name === 'desktop') {
      await expect(previewPage.getByText(heroTitle, { exact: true })).toHaveClass(/g7pb-element-font-size--48/);
      await expect(previewPage.getByText(heroTitle, { exact: true })).toHaveCSS('font-size', '48px');
      await expect(previewPage.getByText(heroTitle, { exact: true })).toHaveClass(/g7pb-element-align--right/);
      await expect(previewPage.locator('[data-block-type="hero"] .g7pb-hero__body')).not.toHaveClass(/g7pb-element-font-size--48/);
    }
    await expect(previewPage.getByText(heroButtonLabel, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(featuresHeading, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(ctaHeading, { exact: true })).toBeVisible();
    await expect(previewPage.getByText(contactHeading, { exact: true })).toBeVisible();
    await expect(previewPage.locator('form:not(.g7pb-system-search)')).toHaveCount(0);
    await expect(previewPage.locator('script[src*="page-effects.iife.js"]')).toHaveCount(1);
    await expect(previewPage.locator('[data-block-type="hero"]')).toHaveAttribute('data-g7pb-motion', 'parallax-soft');
    await expect(previewPage.locator('[data-block-type="features"]')).toHaveAttribute('data-g7pb-motion', 'stagger');
    const previewSlider = previewPage.locator('[data-g7pb-slider]').first();
    await expect(previewSlider).toHaveAttribute('data-g7pb-slider-ready', 'true');
    await expect(previewSlider.locator('[data-g7pb-slider-status]')).toHaveText('1 / 2');
    await previewSlider.locator('[data-g7pb-slider-next]').click();
    await expect(previewSlider.locator('[data-g7pb-slider-status]')).toHaveText('2 / 2');
    await expectResponsivePage(previewPage, testInfo);
    const repeatedPreviewResponse = await previewPage.reload();
    expect(repeatedPreviewResponse?.ok()).toBe(true);
    await expect(previewPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await previewPage.close();
    previewPage = undefined;

    await page.bringToFront();
    await publish(page);
    const publicUrl = await requiredLink(
      page.getByTestId('page-builder-public-link'),
      'Published Page Builder page',
    );

    const viewport = page.viewportSize() ?? { width: 1440, height: 1000 };
    publicContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport,
    });
    const publicPage = await publicContext.newPage();
    const publicResponse = await publicPage.goto(publicUrl);
    expect(publicResponse?.ok()).toBe(true);
    await expect(publicPage.getByTestId('page-builder-public-root')).toBeVisible();
    await expect(publicPage.getByTestId('page-builder-site-header')).toBeVisible();
    await expect(publicPage.getByTestId('page-builder-site-footer')).toBeVisible();
    if ((publicPage.viewportSize()?.width ?? 1440) < 900) {
      const menuToggle = publicPage.locator('[data-g7pb-menu-toggle]');
      await menuToggle.click();
      await expect(menuToggle).toHaveAttribute('aria-expanded', 'true');
      await expect(publicPage.locator('[data-g7pb-mobile-menu]')).toBeVisible();
      await publicPage.keyboard.press('Escape');
      await expect(publicPage.locator('[data-g7pb-mobile-menu]')).toBeHidden();
    }
    expect(await publicPage.evaluate(() => window.localStorage.getItem('auth_token'))).toBeNull();
    await expectBlockOrder(renderedBlocks(publicPage), PUBLISHED_BLOCK_ORDER);
    await expect(publicPage.locator('[data-g7pb-data-source="posts"]')).toHaveAttribute('data-g7pb-data-ready', 'true');
    await expect(publicPage.locator('[data-g7pb-data-source="products"]')).toHaveAttribute('data-g7pb-data-ready', 'true');
    if (testInfo.project.name === 'desktop') {
      await publicPage.screenshot({ path: 'output/playwright/page-builder-public-desktop.png', fullPage: true });
    }
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    if (testInfo.project.name === 'desktop') {
      await expect(publicPage.getByText(heroTitle, { exact: true })).toHaveCSS('font-size', '48px');
    }
    await expect(publicPage.locator('[data-block-type="hero"] img.g7pb-hero__image')).toHaveCount(1);
    await expect(publicPage.getByText(featuresHeading, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(ctaHeading, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(contactHeading, { exact: true })).toBeVisible();
    await expect(publicPage.locator('form:not(.g7pb-system-search)')).toHaveCount(0);
    await expect(publicPage.locator('script[src*="page-effects.iife.js"]')).toHaveCount(1);
    await expect(publicPage.locator('[data-g7pb-slider]')).toHaveCount(3);
    await expect(publicPage.locator('[data-g7pb-slider]').first()).toHaveAttribute('data-g7pb-slider-ready', 'true');
    await expect(publicPage.locator('[data-g7pb-accordion]')).toHaveAttribute('data-g7pb-accordion-ready', 'true');
    const publicTabs = publicPage.locator('[data-g7pb-tabs]');
    await expect(publicTabs).toHaveAttribute('data-g7pb-tabs-ready', 'true');
    await expect(publicTabs.locator('[role="tab"]').first()).toHaveAttribute('aria-controls', /g7pb-.+-panel-0/);
    await publicTabs.locator('[role="tab"]').nth(1).click();
    await expect(publicTabs.locator('[role="tabpanel"]').nth(1)).toBeVisible();
    await expect(publicPage.locator('[data-block-type="video-embed"] iframe')).toHaveAttribute('src', /youtube-nocookie\.com\/embed\//);
    const animatedStats = publicPage.locator('[data-block-type="stats"][data-g7pb-motion="counter"]');
    await animatedStats.scrollIntoViewIfNeeded();
    await expect(animatedStats).toHaveClass(/is-inview/);
    const animatedChart = publicPage.locator('[data-block-type="bar-chart"][data-g7pb-motion="chart-draw"]');
    await animatedChart.scrollIntoViewIfNeeded();
    await expect(animatedChart).toHaveClass(/is-inview/);
    await expectResponsivePage(publicPage, testInfo);

    await page.bringToFront();
    await selectAndEditHero(page, revisedHeroTitle, revisedHeroSubtitle, heroButtonLabel, testInfo.project.name === 'desktop');
    await saveDraft(page);
    await page.reload();
    await selectEditorBlock(page, 'hero');
    await expect(editorInlineField(page, 'hero', 'title')).toContainText(revisedHeroTitle);

    await publicPage.reload();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toHaveCount(0);

    await page.bringToFront();
    await publish(page);
    await publicPage.reload();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toHaveCount(0);
    await expectBlockOrder(renderedBlocks(publicPage), PUBLISHED_BLOCK_ORDER);
    await expectResponsivePage(publicPage, testInfo);

    await page.bringToFront();
    await page.getByTestId('page-builder-manager-link').click();
    await expect(page).toHaveURL(new RegExp(`${NATIVE_MANAGER_PATH}$`));
    await expect(page.getByText('G7 기본 페이지 관리와 분리된 페이지 빌더 문서함입니다.')).toBeVisible();
    await expect(page.getByText(pageTitle, { exact: true })).toBeVisible();
    await page.goto(MANAGER_PATH);
    await expect(page).toHaveURL(new RegExp(`${MANAGER_PATH}$`));
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();
    const documentRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(documentRow).toContainText(pageTitle);
    await expect(documentRow).toContainText('발행됨');
    await expect(documentRow.getByTestId('page-builder-manager-edit-link')).toHaveAttribute(
      'href',
      `${EDITOR_PATH}?document=${documentId}`,
    );
    const stablePublicHref = await documentRow.getByTestId('page-builder-manager-public-link').getAttribute('href');
    if (!stablePublicHref) {
      throw new Error('Published document row did not retain its public URL.');
    }
    await expectSingleLineAction(documentRow.getByTestId('page-builder-manager-edit-link'));
    await expectSingleLineAction(documentRow.getByTestId('page-builder-manager-public-link'));

    await openDocumentActions(documentRow);
    await documentRow.getByTestId('page-builder-manager-duplicate').click();
    const duplicateDialog = page.getByTestId('page-builder-manager-duplicate-dialog');
    await expect(duplicateDialog).toBeVisible();
    await page.getByTestId('page-builder-manager-duplicate-title').fill(duplicateTitle);
    await page.getByTestId('page-builder-manager-duplicate-slug').fill(duplicateSlug);
    const duplicateResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith(`/admin/documents/${documentId}/duplicate`));
    await page.getByTestId('page-builder-manager-duplicate-confirm').click();
    const duplicateResponse = await duplicateResponsePromise;
    expect(duplicateResponse.status()).toBe(201);
    await expect.poll(() => new URL(page.url()).searchParams.get('document') ?? '').toMatch(
      DOCUMENT_ID_PATTERN,
    );
    const duplicateDocumentId = new URL(page.url()).searchParams.get('document');
    if (!duplicateDocumentId) {
      throw new Error('Duplicated Page Builder document did not provide an identifier.');
    }
    await expect(page).toHaveURL(new RegExp(`${EDITOR_PATH}\\?document=${duplicateDocumentId}$`));
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await selectEditorBlock(page, 'hero');
    await expect(editorInlineField(page, 'hero', 'title')).toContainText(revisedHeroTitle);
    await page.goto(MANAGER_PATH);
    const duplicateRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${duplicateDocumentId}"]`,
    );
    await expect(duplicateRow).toContainText(duplicateTitle);
    await expect(duplicateRow).toContainText('초안');
    await expect(duplicateRow.getByTestId('page-builder-manager-public-link')).toHaveCount(0);

    await openDocumentActions(documentRow);
    await documentRow.getByTestId('page-builder-manager-settings').click();
    await expect(page.getByTestId('page-builder-manager-metadata-dialog')).toBeVisible();
    await page.getByTestId('page-builder-manager-metadata-title').fill(managedTitle);
    await page.getByTestId('page-builder-manager-metadata-slug').fill(managedSlug);
    await page.getByTestId('page-builder-manager-metadata-save').click();
    await expect(page.getByTestId('page-builder-manager-metadata-dialog')).toHaveCount(0);
    await expect(documentRow).toContainText(managedTitle);
    await expect(documentRow).toContainText(`/${managedSlug}`);
    await expect(documentRow.getByTestId('page-builder-manager-public-link')).toHaveAttribute(
      'href',
      stablePublicHref,
    );

    await openDocumentActions(documentRow);
    await documentRow.getByTestId('page-builder-manager-revisions').click();
    await expect(page.getByTestId('page-builder-manager-revisions-dialog')).toBeVisible();
    const originalRevisionRow = page.locator(
      `[data-testid="page-builder-revision-row"][data-revision="${originalRevision}"]`,
    );
    await expect(originalRevisionRow).toBeVisible();
    const historicalPopupPromise = page.waitForEvent('popup');
    await originalRevisionRow.getByTestId('page-builder-revision-preview').click();
    const historicalPreview = await historicalPopupPromise;
    await historicalPreview.waitForURL(/\/modules\/jiwonpapa-page_builder\/preview\/[a-f0-9]{64}$/);
    await expect(historicalPreview.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(historicalPreview.getByText(revisedHeroTitle, { exact: true })).toHaveCount(0);
    await historicalPreview.close();

    await originalRevisionRow.getByTestId('page-builder-revision-restore').click();
    await expect(page.getByTestId('page-builder-revision-restore-dialog')).toBeVisible();
    await page.getByTestId('page-builder-revision-restore-confirm').click();
    await expect(page.getByTestId('page-builder-revision-restore-dialog')).toHaveCount(0);
    await expect(documentRow).toContainText(`/${slug}`);

    await publicPage.reload();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '닫기' }).click();
    await documentRow.getByTestId('page-builder-manager-edit-link').click();
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await selectEditorBlock(page, 'hero');
    await expect(editorInlineField(page, 'hero', 'title')).toContainText(heroTitle);
    await publish(page);
    await publicPage.reload();
    await expect(publicPage.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(publicPage.getByText(revisedHeroTitle, { exact: true })).toHaveCount(0);

    await page.bringToFront();
    await page.getByTestId('page-builder-manager-link').click();
    await expect(page).toHaveURL(new RegExp(`${NATIVE_MANAGER_PATH}$`));
    await page.goto(MANAGER_PATH);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();
    const restoredDocumentRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await openDocumentActions(restoredDocumentRow);
    await restoredDocumentRow.getByTestId('page-builder-manager-settings').click();
    await page.getByTestId('page-builder-manager-metadata-shell-mode').selectOption('none');
    const shellModeSave = page.waitForResponse((response) => response.request().method() === 'PATCH'
      && new URL(response.url()).pathname.endsWith(`/admin/documents/${documentId}`));
    await page.getByTestId('page-builder-manager-metadata-save').click();
    expect((await shellModeSave).ok()).toBe(true);
    await expect(page.getByTestId('page-builder-manager-metadata-dialog')).toHaveCount(0);
    await restoredDocumentRow.getByTestId('page-builder-manager-edit-link').click();
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await publish(page);
    await publicPage.reload();
    await expect(publicPage.getByTestId('page-builder-site-header')).toHaveCount(0);
    await expect(publicPage.getByTestId('page-builder-site-footer')).toHaveCount(0);

    await page.bringToFront();
    await page.getByTestId('page-builder-manager-link').click();
    await expect(page).toHaveURL(new RegExp(`${NATIVE_MANAGER_PATH}$`));
    await page.goto(MANAGER_PATH);
    await expect(page.getByTestId('page-builder-manager-app')).toBeVisible();
    const shellFreeDocumentRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await openDocumentActions(shellFreeDocumentRow);
    await shellFreeDocumentRow.getByTestId('page-builder-manager-settings').click();
    await page.getByTestId('page-builder-manager-unpublish').click();
    await expect(page.getByTestId('page-builder-unpublish-dialog')).toBeVisible();
    await page.getByTestId('page-builder-unpublish-confirm').click();
    await expect(page.getByTestId('page-builder-unpublish-dialog')).toHaveCount(0);
    await page.getByRole('button', { name: '취소' }).click();
    await expect(shellFreeDocumentRow).toContainText('초안');
    await expect(shellFreeDocumentRow).toContainText('생성');
    await expect(shellFreeDocumentRow).toContainText('수정');
    await expect(shellFreeDocumentRow.getByTestId('page-builder-manager-public-link')).toHaveCount(0);

    const unpublishedResponse = await publicPage.reload();
    expect(unpublishedResponse?.status()).toBe(404);

    await openDocumentActions(restoredDocumentRow);
    await restoredDocumentRow.getByTestId('page-builder-manager-archive').click();
    await expect(page.getByTestId('page-builder-archive-dialog')).toBeVisible();
    await page.getByTestId('page-builder-archive-confirm').click();
    await expect(restoredDocumentRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-archived').click();
    const archivedRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(archivedRow).toContainText('보관됨');
    await archivedRow.getByTestId('page-builder-manager-restore-archived').click();
    await expect(archivedRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-active').click();
    const activeRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(activeRow).toContainText('초안');

    await openDocumentActions(activeRow);
    await activeRow.getByTestId('page-builder-manager-archive').click();
    await page.getByTestId('page-builder-archive-confirm').click();
    await expect(page.getByTestId('page-builder-archive-dialog')).toHaveCount(0);
    await expect(activeRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-archived').click();
    const purgeRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${documentId}"]`,
    );
    await expect(purgeRow).toContainText('보관됨');
    await purgeRow.getByTestId('page-builder-manager-purge').click();
    await page.getByTestId('page-builder-purge-confirmation').fill(slug);
    await page.getByTestId('page-builder-purge-confirm').click();
    await expect(purgeRow).toHaveCount(0);

    await page.getByTestId('page-builder-manager-filter-active').click();
    const duplicateCleanupRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${duplicateDocumentId}"]`,
    );
    await expect(duplicateCleanupRow).toContainText('초안');
    await openDocumentActions(duplicateCleanupRow);
    await duplicateCleanupRow.getByTestId('page-builder-manager-archive').click();
    await page.getByTestId('page-builder-archive-confirm').click();
    await expect(duplicateCleanupRow).toHaveCount(0);
    await page.getByTestId('page-builder-manager-filter-archived').click();
    const duplicatePurgeRow = page.locator(
      `[data-testid="page-builder-document-row"][data-document-id="${duplicateDocumentId}"]`,
    );
    await duplicatePurgeRow.getByTestId('page-builder-manager-purge').click();
    await page.getByTestId('page-builder-purge-confirmation').fill(duplicateSlug);
    await page.getByTestId('page-builder-purge-confirm').click();
    await expect(duplicatePurgeRow).toHaveCount(0);

    if (uploadedMediaId) {
      const deleted = await page.evaluate(async (mediaId) => {
        const token = window.localStorage.getItem('auth_token');
        const response = await fetch(`/api/modules/jiwonpapa-page_builder/admin/media/${mediaId}`, {
          method: 'DELETE',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token ?? ''}` },
        });
        return response.ok;
      }, uploadedMediaId);
      expect(deleted).toBe(true);
      uploadedMediaId = null;
      await updateE2eOwnershipJournal(ownershipJournalPath, null);
    }
  } catch (error) {
    lifecycleError = error;
  } finally {
    let siteShellRestoreError: unknown;
    try {
    } catch (error) {
      siteShellRestoreError = error;
    } finally {
      await previewPage?.close();
      await publicContext?.close();
      if (!page.isClosed()) {
        await page.close();
      }
      await cleanupE2eArtifacts(authToken, [slug, managedSlug, duplicateSlug], uploadedMediaId);
      await removeE2eOwnershipJournal(ownershipJournalPath);
    }
    if (lifecycleError) throw lifecycleError;
    if (siteShellRestoreError) throw siteShellRestoreError;
  }
});

test('renders a Page Builder page and temporary home inside the active G7 User Template', async ({
  context,
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The template integration gate runs once on desktop.');
  test.setTimeout(120_000);

  const authToken = await authenticateAdmin(context);
  await recoverOwnedE2eArtifacts(authToken);
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const slug = `g7pb-template-e2e-${runId}`;
  const title = `Template Integration ${runId}`;
  const heroTitle = `Active User Template ${runId}`;
  const api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });
  let previousHomeId: string | null = null;
  const ownershipJournalPath = await writeE2eOwnershipJournal(
    `template-${testInfo.project.name}-${runId}`,
    [slug],
  );

  try {
    const listResponse = await api.get('/api/modules/jiwonpapa-page_builder/admin/documents?status=active&per_page=100');
    expect(listResponse.ok()).toBe(true);
    const listPayload = await listResponse.json() as {
      data?: { items?: Array<{ is_home?: unknown; document?: { document_id?: unknown } }> };
    };
    const previousHome = listPayload.data?.items?.find((item) => item.is_home === true);
    previousHomeId = typeof previousHome?.document?.document_id === 'string'
      ? previousHome.document.document_id
      : null;

    const createResponse = await api.post('/api/modules/jiwonpapa-page_builder/admin/documents', {
      data: { title, slug, locale: 'ko', mode: 'canvas', shell_mode: 'template' },
    });
    expect(createResponse.ok()).toBe(true);
    const created = await createResponse.json() as {
      data?: { document?: Record<string, unknown>; lock_version?: unknown };
    };
    const documentId = created.data?.document?.document_id;
    const initialLock = created.data?.lock_version;
    expect(documentId).toMatch(DOCUMENT_ID_PATTERN);
    expect(typeof initialLock).toBe('number');

    const document = {
      ...created.data?.document,
      schema_version: 'g7-page-builder/v1',
      shell_mode: 'template',
      blocks: [{
        instance_id: crypto.randomUUID(),
        type: 'content.hero-centered-01',
        block_version: 1,
        props: {
          eyebrow: 'G7 USER TEMPLATE',
          title: heroTitle,
          body: '<p>활성 사이트 템플릿의 헤더와 푸터 사이에 렌더링됩니다.</p>',
          primaryCta: { label: '로그인', url: '/login' },
          alignment: 'center',
        },
        motion: { preset: 'reveal', intensity: 'normal', trigger: 'once', stagger_ms: 100 },
        slots: [],
      }],
    };
    const draftResponse = await api.put(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/draft`, {
      data: { document, expected_lock_version: initialLock },
    });
    expect(draftResponse.ok()).toBe(true);
    const draft = await draftResponse.json() as { data?: { lock_version?: unknown } };
    expect(typeof draft.data?.lock_version).toBe('number');

    const prepareResponse = await api.post(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/publications/prepare`, {
      data: { expected_lock_version: draft.data?.lock_version },
    });
    expect(prepareResponse.ok()).toBe(true);
    const prepared = await prepareResponse.json() as { data?: { publication_token?: unknown } };
    expect(typeof prepared.data?.publication_token).toBe('string');
    const commitResponse = await api.post(`/api/modules/jiwonpapa-page_builder/admin/publications/${prepared.data?.publication_token}/commit`, {
      data: {},
    });
    expect(commitResponse.ok()).toBe(true);

    const publishedResponse = await page.goto(`/pages/${slug}`);
    expect(publishedResponse?.ok()).toBe(true);
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('.g7pb-template-page')).toBeVisible();
    await expect(page.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(page.getByTestId('page-builder-site-header')).toBeVisible();
    await expect(page.locator('[data-block-type="hero"]')).toHaveClass(/is-inview/);
    await expect.poll(() => page.evaluate(() => {
      const config = (window as typeof window & { G7Config?: { moduleAssets?: Record<string, { css?: string; js?: string }> } }).G7Config;
      const assets = config?.moduleAssets?.['jiwonpapa-page_builder'];
      return `${assets?.css ?? ''}|${assets?.js ?? ''}`;
    })).toContain('page-builder-public.css');

    const currentResponse = await api.get(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}`);
    const current = await currentResponse.json() as { data?: { lock_version?: unknown } };
    const homeResponse = await api.post(`/api/modules/jiwonpapa-page_builder/admin/documents/${documentId}/home`, {
      data: { enabled: true, expected_lock_version: current.data?.lock_version },
    });
    expect(homeResponse.ok()).toBe(true);

    const catalogResponse = await api.get('/api/modules/jiwonpapa-page_builder/admin/routes/catalog');
    expect(catalogResponse.ok()).toBe(true);
    const catalogPayload = await catalogResponse.json() as { data?: { active_template?: unknown } };
    expect(typeof catalogPayload.data?.active_template).toBe('string');
    const activeTemplate = String(catalogPayload.data?.active_template);

    const routesResponse = await page.request.get(`/api/templates/${encodeURIComponent(activeTemplate)}/routes`);
    const routesPayload = await routesResponse.json() as { data?: { routes?: Array<{ path?: unknown; layout?: unknown }> } };
    expect(routesPayload.data?.routes?.find((route) => route.path === '/')?.layout)
      .toBe('jiwonpapa-page_builder.page_builder_home');

    const homePageResponse = await page.goto('/');
    expect(homePageResponse?.ok()).toBe(true);
    await expect(page.getByText(heroTitle, { exact: true })).toBeVisible();
    await expect(page.locator('.g7pb-template-page')).toBeVisible();
  } finally {
    await cleanupE2eArtifacts(authToken, [slug], null);
    await removeE2eOwnershipJournal(ownershipJournalPath);
    if (previousHomeId) {
      const previousResponse = await api.get(`/api/modules/jiwonpapa-page_builder/admin/documents/${previousHomeId}`);
      if (previousResponse.ok()) {
        const previous = await previousResponse.json() as { data?: { lock_version?: unknown; is_home?: unknown } };
        if (previous.data?.is_home !== true && typeof previous.data?.lock_version === 'number') {
          const restoreResponse = await api.post(`/api/modules/jiwonpapa-page_builder/admin/documents/${previousHomeId}/home`, {
            data: { enabled: true, expected_lock_version: previous.data.lock_version },
          });
          expect(restoreResponse.ok()).toBe(true);
        }
      }
    }
    await api.dispose();
  }
});
