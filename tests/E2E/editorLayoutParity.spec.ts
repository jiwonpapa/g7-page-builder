import { expect, request as playwrightRequest, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const API = '/api/modules/jiwonpapa-page_builder/admin';
const EDITOR_PATH = '/modules/jiwonpapa-page_builder/admin/editor';
const CANVAS_IFRAME = '#puck-canvas-root iframe';
const VIEWPORT_WIDTHS = { desktop: 1280, tablet: 768, mobile: 360 } as const;
const LAYOUT_TOLERANCE_PX = 1.25;
const TYPOGRAPHY_TOLERANCE_PX = 0.75;

interface CatalogManifest {
  blocks: Array<{ block_id: string; block_version: number; capabilities: string[] }>;
  presets: Array<{
    preset_id: string;
    block_id: string;
    block_version: number;
    props: Record<string, unknown>;
  }>;
}

interface StoreCatalog {
  products: Array<{
    product_id: string;
    product_type: string;
    product_version: string;
  }>;
}

interface PageKitManifest {
  kits: Array<{ slug: string }>;
}

interface DocumentResource {
  data?: {
    archived_at?: unknown;
    document?: Record<string, unknown>;
    lock_version?: unknown;
  };
}

interface LayoutMetric {
  blockId: string;
  blockType: string;
  blockScrollOverflow: number;
  contentLeft: number;
  contentRight: number;
  measuredScrollOverflow: number;
  overflow: number;
  rectLeftOverflow: number;
  rectRightOverflow: number;
  typography: TypographyMetric | null;
}

interface TypographyMetric {
  color: string;
  ancestorTrail: string[];
  canvasTextWidth: number;
  descendantTrail: string[];
  contentEditable: string;
  fontFamily: string;
  fontReady: boolean;
  fontStatus: FontFaceSetLoadStatus;
  fontSize: number;
  fontWeight: string;
  height: number;
  letterSpacing: number;
  lineCount: number;
  lineHeight: number;
  maxWidth: string;
  overflowWrap: string;
  scrollWidth: number;
  tagName: string;
  text: string;
  textCodePoints: string;
  whiteSpace: string;
  width: number;
  wordBreak: string;
}

interface Scenario {
  expectedBlockCount: number;
  label: string;
}

interface DraftScenario extends Scenario {
  document: Record<string, unknown>;
}

interface PageKitScenario extends Scenario {
  productId: string;
  productVersion: string;
  slug: string;
}

interface OwnedDocument {
  document: Record<string, unknown>;
  documentId: string;
  lockVersion: number;
  mediaIds: string[];
  slug: string;
}

interface MediaResource {
  data?: {
    items?: Array<{ id?: unknown; url?: unknown }>;
  };
}

const builtinManifest = JSON.parse(
  readFileSync(resolve('resources/block-packs/builtin-core/manifest.json'), 'utf8'),
) as CatalogManifest;
const storeCatalog = JSON.parse(
  readFileSync(resolve('resources/store/dist/catalog.json'), 'utf8'),
) as StoreCatalog;
const pageKitManifest = JSON.parse(
  readFileSync(resolve('resources/store/source/page-kits/manifest.json'), 'utf8'),
) as PageKitManifest;
const sourcePageKitSlugs = readdirSync(resolve('resources/store/source/page-kits'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const declaredPageKitSlugs = pageKitManifest.kits.map((kit) => kit.slug);

const pageKitScenarios = pageKitManifest.kits
  .map((kit): PageKitScenario => {
    const source = JSON.parse(readFileSync(
      resolve('resources/store/source/page-kits', kit.slug, 'document.json'),
      'utf8',
    )) as Record<string, unknown>;
    const blocks = source.blocks as Array<Record<string, unknown>>;
    const productId = `jiwonpapa/${kit.slug}`;
    const product = storeCatalog.products.find((candidate) => (
      candidate.product_type === 'page_kit' && candidate.product_id === productId
    ));
    if (!product) throw new Error(`Official Page Kit catalog entry is missing: ${productId}`);
    return {
      expectedBlockCount: blocks.length,
      label: `PAGE_KIT_LAYOUT_GATE:${kit.slug}`,
      productId,
      productVersion: product.product_version,
      slug: kit.slug,
    };
  });

function credentials(): { email: string; password: string } {
  const email = process.env.G7PB_ADMIN_EMAIL;
  const password = process.env.G7PB_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Editor layout E2E administrator credentials are not configured.');
  return { email, password };
}

function instanceId(index: number): string {
  return `72000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
}

function rekeyBlocks(blocks: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return blocks.map((block, index) => ({ ...structuredClone(block), instance_id: instanceId(index) }));
}

function presetScenario(): DraftScenario {
  const blocks = builtinManifest.presets.map((preset, index) => ({
    instance_id: instanceId(index),
    type: preset.block_id,
    block_version: preset.block_version,
    props: structuredClone(preset.props),
    slots: {},
  }));
  return {
    document: {
      schema_version: 'g7-page-builder/v1',
      mode: 'canvas',
      locale: 'ko',
      tokens: {
        'design.color_mode': 'light',
        'design.palette': 'blue',
        'design.font': 'system',
        'design.radius': 'soft',
        'design.width': 'standard',
        'design.scale': 'balanced',
      },
      blocks,
    },
    expectedBlockCount: blocks.length,
    label: 'ALL_PRESET_LAYOUT_GATE',
  };
}

async function authenticate(context: BrowserContext): Promise<{ api: APIRequestContext; token: string }> {
  const auth = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  try {
    const response = await auth.post('/api/auth/admin/login', { data: credentials() });
    expect(response.ok()).toBe(true);
    const payload = await response.json() as { success?: unknown; data?: { token?: unknown } };
    if (payload.success !== true || typeof payload.data?.token !== 'string') {
      throw new Error('Editor layout administrator login returned no token.');
    }
    const token = payload.data.token;
    await context.addInitScript(({ origin, authToken }) => {
      if (window.location.origin === origin) window.localStorage.setItem('auth_token', authToken);
    }, { origin: new URL(BASE_URL).origin, authToken: token });
    const api = await playwrightRequest.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return { api, token };
  } finally {
    await auth.dispose();
  }
}

async function createDocument(api: APIRequestContext, projectName: string): Promise<OwnedDocument> {
  const slug = `g7pb-layout-${projectName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await api.post(`${API}/documents`, {
    data: { title: '편집 미리보기 레이아웃 계약', slug, locale: 'ko', mode: 'canvas', shell_mode: 'none' },
  });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as DocumentResource;
  const document = payload.data?.document;
  const lockVersion = payload.data?.lock_version;
  const documentId = document?.document_id;
  if (!document || typeof documentId !== 'string' || typeof lockVersion !== 'number') {
    throw new Error('Editor layout document creation returned an invalid resource.');
  }
  return { document, documentId, lockVersion, mediaIds: [], slug };
}

async function putScenario(
  api: APIRequestContext,
  owned: OwnedDocument,
  scenario: DraftScenario,
): Promise<void> {
  const sourceBlocks = scenario.document.blocks as Array<Record<string, unknown>>;
  const document = {
    ...owned.document,
    ...structuredClone(scenario.document),
    document_id: owned.documentId,
    slug: owned.slug,
    shell_mode: 'none',
    blocks: rekeyBlocks(sourceBlocks),
  };
  const response = await api.put(`${API}/documents/${owned.documentId}/draft`, {
    data: { document, expected_lock_version: owned.lockVersion },
  });
  if (!response.ok()) throw new Error(`${scenario.label} draft failed (${response.status()}): ${await response.text()}`);
  const payload = await response.json() as DocumentResource;
  if (typeof payload.data?.lock_version !== 'number' || !payload.data.document) {
    throw new Error(`${scenario.label} draft returned an invalid resource.`);
  }
  owned.document = payload.data.document;
  owned.lockVersion = payload.data.lock_version;
}

function collectStoredMediaUrls(value: unknown, urls: Set<string>): void {
  if (typeof value === 'string') {
    if (value.includes('/storage/g7-page-builder/')) urls.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStoredMediaUrls(item, urls);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStoredMediaUrls(item, urls);
  }
}

async function applyPageKit(
  api: APIRequestContext,
  scenario: PageKitScenario,
  projectName: string,
  ownedDocuments: OwnedDocument[],
): Promise<OwnedDocument> {
  const slug = `g7pb-layout-${projectName}-${scenario.slug}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await api.post(`${API}/store/page-kits/apply`, {
    data: {
      product_id: scenario.productId,
      product_version: scenario.productVersion,
      slug,
      title: `레이아웃 계약 ${scenario.slug}`,
    },
  });
  if (response.status() !== 201) {
    throw new Error(`${scenario.label} apply failed (${response.status()}): ${await response.text()}`);
  }
  const payload = await response.json() as DocumentResource;
  const document = payload.data?.document;
  const lockVersion = payload.data?.lock_version;
  const documentId = document?.document_id;
  if (!document || typeof documentId !== 'string' || typeof lockVersion !== 'number') {
    throw new Error(`${scenario.label} apply returned an invalid document resource.`);
  }
  const owned: OwnedDocument = { document, documentId, lockVersion, mediaIds: [], slug };
  ownedDocuments.push(owned);
  expect(JSON.stringify(document), `${scenario.label} retained unresolved portable media`).not.toContain('g7pb-media://');
  expect(document.blocks).toHaveLength(scenario.expectedBlockCount);

  const mediaUrls = new Set<string>();
  collectStoredMediaUrls(document, mediaUrls);
  expect(mediaUrls.size, `${scenario.label} resolved no owned Page Kit media`).toBeGreaterThan(0);
  const mediaResponse = await api.get(`${API}/media?kind=image`);
  expect(mediaResponse.ok()).toBe(true);
  const mediaPayload = await mediaResponse.json() as MediaResource;
  const mediaIds = (mediaPayload.data?.items ?? [])
    .filter((item) => typeof item.url === 'string' && mediaUrls.has(item.url))
    .map((item) => item.id)
    .filter((id): id is string => typeof id === 'string');
  owned.mediaIds.push(...mediaIds);
  expect(new Set(mediaIds).size, `${scenario.label} owned media cleanup inventory is incomplete`).toBe(mediaUrls.size);

  return owned;
}

async function setCanvasViewport(page: Page, projectName: string): Promise<number> {
  const width = VIEWPORT_WIDTHS[projectName as keyof typeof VIEWPORT_WIDTHS];
  if (!width) throw new Error(`Unknown layout project: ${projectName}`);
  const button = page.getByTestId(`page-builder-viewport-${width}`);
  if (!(await button.isVisible())) await page.getByRole('button', { name: 'Toggle menu bar' }).click();
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(
    () => page.locator('#puck-canvas-root').evaluate((element) => (element as HTMLElement).style.width),
  ).toBe(`${width}px`);
  await page.evaluate(() => new Promise<void>((resolveAnimation) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveAnimation()));
  }));
  return width;
}

async function layoutMetrics(blocks: Locator, editor: boolean): Promise<LayoutMetric[]> {
  return blocks.evaluateAll((elements, usesEditorChild) => elements.map((element) => {
    const block = element as HTMLElement;
    const measured = usesEditorChild ? block.firstElementChild as HTMLElement | null : block;
    if (!measured) throw new Error(`Block ${block.dataset.blockId ?? 'unknown'} has no rendered child.`);
    const documentElement = block.ownerDocument.documentElement;
    const rect = measured.getBoundingClientRect();
    const style = block.ownerDocument.defaultView?.getComputedStyle(measured);
    const paddingLeft = Number.parseFloat(style?.paddingLeft ?? '0') || 0;
    const paddingRight = Number.parseFloat(style?.paddingRight ?? '0') || 0;
    const viewportWidth = documentElement.clientWidth;
    const rectLeftOverflow = Math.max(0, -rect.left);
    const rectRightOverflow = Math.max(0, rect.right - viewportWidth);
    const blockScrollOverflow = Math.max(0, block.scrollWidth - block.clientWidth);
    const measuredScrollOverflow = Math.max(0, measured.scrollWidth - measured.clientWidth);
    const typographySelectors = [
      'h1',
      '[data-g7pb-heading-level="1"]',
      'h2',
      '[data-g7pb-heading-level="2"]',
      'h3',
      '[data-g7pb-heading-level="3"]',
      'h4',
      '[data-g7pb-heading-level="4"]',
      'blockquote p',
      'figcaption',
      '.g7pb-divider__label',
      'strong',
      'a',
      'button',
      'time',
      'p',
      'small',
    ];
    let typographyCandidate: HTMLElement | null = null;
    for (const selector of typographySelectors) {
      typographyCandidate = Array.from(measured.querySelectorAll<HTMLElement>(selector)).find((candidate) => {
        const candidateRect = candidate.getBoundingClientRect();
        return candidateRect.width > 0
          && candidateRect.height > 0
          && (candidate.textContent ?? '').replace(/\s+/g, ' ').trim() !== '';
      }) ?? null;
      if (typographyCandidate) break;
    }
    let typography: TypographyMetric | null = null;
    if (typographyCandidate) {
      const typographyStyle = block.ownerDocument.defaultView?.getComputedStyle(typographyCandidate);
      const typographyRect = typographyCandidate.getBoundingClientRect();
      const fontSize = Number.parseFloat(typographyStyle?.fontSize ?? '0') || 0;
      const parsedLineHeight = Number.parseFloat(typographyStyle?.lineHeight ?? '0');
      const lineHeight = Number.isFinite(parsedLineHeight) && parsedLineHeight > 0
        ? parsedLineHeight
        : fontSize * 1.2;
      const range = block.ownerDocument.createRange();
      const rawText = typographyCandidate.textContent ?? '';
      const canvas = block.ownerDocument.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      if (canvasContext && typographyStyle) canvasContext.font = typographyStyle.font;
      const walker = block.ownerDocument.createTreeWalker(typographyCandidate, NodeFilter.SHOW_TEXT);
      const lineCenters: number[] = [];
      for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
        if ((textNode.textContent ?? '').trim() === '') continue;
        range.selectNodeContents(textNode);
        for (const lineRect of Array.from(range.getClientRects())) {
          if (lineRect.width > 0 && lineRect.height > 0) lineCenters.push(lineRect.top + (lineRect.height / 2));
        }
      }
      lineCenters.sort((left, right) => left - right);
      const lineClusters: number[] = [];
      for (const center of lineCenters) {
        const previousCenter = lineClusters.at(-1);
        if (previousCenter === undefined || Math.abs(center - previousCenter) > Math.max(1, lineHeight * .35)) {
          lineClusters.push(center);
        }
      }
      const ancestorTrail: string[] = [];
      let ancestor: HTMLElement | null = typographyCandidate;
      while (ancestor && ancestorTrail.length < 5) {
        const ancestorRect = ancestor.getBoundingClientRect();
        const ancestorStyle = block.ownerDocument.defaultView?.getComputedStyle(ancestor);
        const className = typeof ancestor.className === 'string'
          ? ancestor.className.trim().replace(/\s+/g, '.').slice(0, 120)
          : '';
        ancestorTrail.push(`${ancestor.tagName.toLowerCase()}${className ? `.${className}` : ''}:${ancestorRect.width.toFixed(2)}:${ancestorStyle?.maxWidth ?? ''}:${ancestorStyle?.display ?? ''}`);
        if (ancestor === measured) break;
        ancestor = ancestor.parentElement;
      }
      const descendantTrail = [typographyCandidate, ...Array.from(typographyCandidate.querySelectorAll<HTMLElement>('*'))]
        .slice(0, 12)
        .map((descendant) => {
          const descendantRect = descendant.getBoundingClientRect();
          const descendantStyle = block.ownerDocument.defaultView?.getComputedStyle(descendant);
          const className = typeof descendant.className === 'string'
            ? descendant.className.trim().replace(/\s+/g, '.').slice(0, 100)
            : '';
          const descendantRange = block.ownerDocument.createRange();
          descendantRange.selectNodeContents(descendant);
          const lineRects = Array.from(descendantRange.getClientRects())
            .filter((lineRect) => lineRect.width > 0 && lineRect.height > 0)
            .map((lineRect) => `${lineRect.width.toFixed(2)}x${lineRect.height.toFixed(2)}`)
            .join(',');
          return [
            `${descendant.tagName.toLowerCase()}${className ? `.${className}` : ''}`,
            `${descendantRect.width.toFixed(2)}x${descendantRect.height.toFixed(2)}`,
            `display=${descendantStyle?.display ?? ''}`,
            `min-height=${descendantStyle?.minHeight ?? ''}`,
            `padding=${descendantStyle?.padding ?? ''}`,
            `margin=${descendantStyle?.margin ?? ''}`,
            `position=${descendantStyle?.position ?? ''}`,
            `font-stretch=${descendantStyle?.fontStretch ?? ''}`,
            `font-kerning=${descendantStyle?.fontKerning ?? ''}`,
            `font-feature=${descendantStyle?.fontFeatureSettings ?? ''}`,
            `font-variation=${descendantStyle?.fontVariationSettings ?? ''}`,
            `font-size=${descendantStyle?.fontSize ?? ''}`,
            `letter-spacing=${descendantStyle?.letterSpacing ?? ''}`,
            `word-spacing=${descendantStyle?.wordSpacing ?? ''}`,
            `text-transform=${descendantStyle?.textTransform ?? ''}`,
            `transform=${descendantStyle?.transform ?? ''}`,
            `lines=${lineRects}`,
          ].join(':');
        });
      typography = {
        color: typographyStyle?.color ?? '',
        ancestorTrail,
        canvasTextWidth: canvasContext ? canvasContext.measureText(rawText).width : 0,
        descendantTrail,
        contentEditable: typographyCandidate.contentEditable,
        fontFamily: typographyStyle?.fontFamily ?? '',
        fontReady: typographyStyle
          ? block.ownerDocument.fonts.check(`${typographyStyle.fontWeight} ${typographyStyle.fontSize} ${typographyStyle.fontFamily}`, rawText)
          : false,
        fontStatus: block.ownerDocument.fonts.status,
        fontSize,
        fontWeight: typographyStyle?.fontWeight ?? '',
        height: typographyRect.height,
        letterSpacing: Number.parseFloat(typographyStyle?.letterSpacing ?? '0') || 0,
        lineCount: Math.max(
          lineClusters.length,
          Math.max(1, Math.round(typographyRect.height / lineHeight)),
        ),
        lineHeight,
        maxWidth: typographyStyle?.maxWidth ?? '',
        overflowWrap: typographyStyle?.overflowWrap ?? '',
        scrollWidth: typographyCandidate.scrollWidth,
        tagName: typographyCandidate.tagName.toLowerCase(),
        text: rawText.replace(/\s+/g, ' ').trim(),
        textCodePoints: Array.from(rawText).map((character) => character.codePointAt(0)?.toString(16) ?? '').join(','),
        whiteSpace: typographyStyle?.whiteSpace ?? '',
        width: typographyRect.width,
        wordBreak: typographyStyle?.wordBreak ?? '',
      };
    }
    return {
      blockId: block.dataset.blockId ?? '',
      blockType: block.dataset.blockType ?? '',
      blockScrollOverflow,
      contentLeft: rect.left + paddingLeft,
      contentRight: rect.right - paddingRight,
      measuredScrollOverflow,
      overflow: Math.max(rectLeftOverflow, rectRightOverflow, blockScrollOverflow, measuredScrollOverflow),
      rectLeftOverflow,
      rectRightOverflow,
      typography,
    };
  }), editor);
}

async function documentOverflow(locator: Locator): Promise<{
  overflow: number;
  outliers: Array<{ className: string; left: number; right: number; tag: string; testId: string }>;
}> {
  return locator.evaluate((element, tolerance) => {
    const root = element as HTMLElement;
    const rootRect = root.getBoundingClientRect();
    const overflow = Math.max(0, root.scrollWidth - root.clientWidth);
    const outliers = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .map((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return {
          className: typeof candidate.className === 'string' ? candidate.className.slice(0, 160) : '',
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          tag: candidate.tagName.toLowerCase(),
          testId: candidate.dataset.testid ?? '',
        };
      })
      .filter((candidate) => candidate.left < rootRect.left - tolerance
        || candidate.right > rootRect.right + tolerance)
      .sort((left, right) => Math.max(rootRect.left - right.left, right.right - rootRect.right)
        - Math.max(rootRect.left - left.left, left.right - rootRect.right))
      .slice(0, 8);
    return { overflow, outliers };
  }, LAYOUT_TOLERANCE_PX);
}

async function expectDocumentContained(locator: Locator, label: string): Promise<void> {
  const measured = await documentOverflow(locator);
  expect(measured.overflow, `${label}: ${JSON.stringify(measured.outliers)}`)
    .toBeLessThanOrEqual(LAYOUT_TOLERANCE_PX);
}

async function expectStableVisibleGeometry(blocks: Locator, expectedCount: number): Promise<void> {
  let previousSignature = '';
  let stableSamples = 0;
  await expect.poll(async () => {
    const rectangles = await blocks.evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return [Math.round(rect.left * 100), Math.round(rect.top * 100), Math.round(rect.width * 100), Math.round(rect.height * 100)];
    }));
    const signature = JSON.stringify(rectangles);
    const visible = rectangles.length === expectedCount
      && rectangles.every(([, , width, height]) => width > 0 && height > 0);
    stableSamples = visible && signature === previousSignature ? stableSamples + 1 : 0;
    previousSignature = signature;
    return stableSamples >= 2;
  }, { timeout: 60_000, intervals: [100, 150, 250, 500] }).toBe(true);
}

async function expectProductCanvasStyles(root: Locator): Promise<void> {
  await expect.poll(() => root.evaluate((element) => {
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    return style?.getPropertyValue('container-type') === 'inline-size'
      && style.getPropertyValue('--g7pb-theme-content-width').trim() !== '';
  }), { timeout: 60_000 }).toBe(true);
}

async function expectProductPublicStyles(blocks: Locator): Promise<void> {
  await expect.poll(() => blocks.first().evaluate((element) => {
    const theme = element.closest('.g7pb-document-theme');
    if (!theme) return false;
    const themeStyle = element.ownerDocument.defaultView?.getComputedStyle(theme);
    const blockStyle = element.ownerDocument.defaultView?.getComputedStyle(element);
    return themeStyle?.getPropertyValue('--g7pb-theme-content-width').trim() !== ''
      && blockStyle?.boxSizing === 'border-box';
  }), { timeout: 60_000 }).toBe(true);
}

function expectLayoutParity(editorMetrics: LayoutMetric[], previewMetrics: LayoutMetric[]): void {
  expect(editorMetrics.map((metric) => metric.blockId)).toEqual(previewMetrics.map((metric) => metric.blockId));
  expect(editorMetrics.map((metric) => metric.blockType)).toEqual(previewMetrics.map((metric) => metric.blockType));
  const mismatches: Array<Record<string, unknown>> = [];
  for (let index = 0; index < editorMetrics.length; index += 1) {
    const editor = editorMetrics[index];
    const preview = previewMetrics[index];
    const leftDelta = Math.abs(editor.contentLeft - preview.contentLeft);
    const rightDelta = Math.abs(editor.contentRight - preview.contentRight);
    const editorTypography = editor.typography;
    const previewTypography = preview.typography;
    const typographyPresenceMismatch = (editorTypography === null) !== (previewTypography === null);
    const typographyTextMismatch = editorTypography !== null && previewTypography !== null
      && editorTypography.text !== previewTypography.text;
    const typographyFamilyMismatch = editorTypography !== null && previewTypography !== null
      && editorTypography.fontFamily !== previewTypography.fontFamily;
    const typographyWeightMismatch = editorTypography !== null && previewTypography !== null
      && editorTypography.fontWeight !== previewTypography.fontWeight;
    const typographyColorMismatch = editorTypography !== null && previewTypography !== null
      && editorTypography.color !== previewTypography.color;
    const typographyLineCountMismatch = editorTypography !== null && previewTypography !== null
      && editorTypography.lineCount !== previewTypography.lineCount;
    const fontSizeDelta = editorTypography !== null && previewTypography !== null
      ? Math.abs(editorTypography.fontSize - previewTypography.fontSize)
      : 0;
    const lineHeightDelta = editorTypography !== null && previewTypography !== null
      ? Math.abs(editorTypography.lineHeight - previewTypography.lineHeight)
      : 0;
    const letterSpacingDelta = editorTypography !== null && previewTypography !== null
      ? Math.abs(editorTypography.letterSpacing - previewTypography.letterSpacing)
      : 0;
    if (
      editor.overflow > LAYOUT_TOLERANCE_PX
      || preview.overflow > LAYOUT_TOLERANCE_PX
      || leftDelta > LAYOUT_TOLERANCE_PX
      || rightDelta > LAYOUT_TOLERANCE_PX
      || typographyPresenceMismatch
      || typographyTextMismatch
      || typographyFamilyMismatch
      || typographyWeightMismatch
      || typographyColorMismatch
      || typographyLineCountMismatch
      || fontSizeDelta > TYPOGRAPHY_TOLERANCE_PX
      || lineHeightDelta > TYPOGRAPHY_TOLERANCE_PX
      || letterSpacingDelta > TYPOGRAPHY_TOLERANCE_PX
    ) {
      mismatches.push({
        blockId: editor.blockId,
        blockType: editor.blockType,
        editorOverflow: editor.overflow,
        previewOverflow: preview.overflow,
        leftDelta,
        rightDelta,
        fontSizeDelta,
        letterSpacingDelta,
        lineHeightDelta,
        typographyFamilyMismatch,
        typographyLineCountMismatch,
        typographyPresenceMismatch,
        typographyTextMismatch,
        typographyWeightMismatch,
        typographyColorMismatch,
        editor,
        preview,
      });
    }
  }
  expect(mismatches, `editor/preview layout mismatches: ${JSON.stringify(mismatches)}`).toEqual([]);
}

function expectBlockContainment(metrics: LayoutMetric[], surface: string): void {
  const overflows = metrics.filter((metric) => metric.overflow > LAYOUT_TOLERANCE_PX);
  expect(overflows, `${surface} block overflows: ${JSON.stringify(overflows)}`).toEqual([]);
}

async function compareContentElements(editorBlocks: Locator, previewBlocks: Locator): Promise<{
  checked: number; failures: Array<Record<string, unknown>>; geometry: Array<Record<string, unknown>>;
}> {
  const expected = await editorBlocks.evaluateAll((blocks) => blocks.map((block) => {
    const tree = (element: Element, depth = 0): unknown => {
      const s = getComputedStyle(element); const r = element.getBoundingClientRect();
      return {tag:element.tagName,class:element.className,field:element.getAttribute('data-g7pb-inline-field'),width:r.width,height:r.height,margin:s.margin,padding:s.padding,display:s.display,font:s.fontSize,line:s.lineHeight,children:depth < 3 && !element.hasAttribute('data-g7pb-richtext-field') ? Array.from(element.children).map(e=>tree(e,depth+1)):[]};
    };
    const metrics = (element: Element, inline = false) => {
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      let rect = element.getBoundingClientRect();
      if (inline) {
        const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const lines: DOMRect[] = [];
        while (walker.nextNode()) { if (walker.currentNode.textContent?.trim()) { range.selectNodeContents(walker.currentNode); lines.push(...range.getClientRects()); } }
        if (lines.length) rect = new DOMRect(Math.min(...lines.map(r=>r.left)), Math.min(...lines.map(r=>r.top)), Math.max(...lines.map(r=>r.right))-Math.min(...lines.map(r=>r.left)), Math.max(...lines.map(r=>r.bottom))-Math.min(...lines.map(r=>r.top)));
      }
      const style = getComputedStyle(element);
      return { parent: {width:element.parentElement?.getBoundingClientRect().width, padding:element.parentElement && getComputedStyle(element.parentElement).padding, border:element.parentElement && getComputedStyle(element.parentElement).borderWidth}, width: rect.width, height: rect.height, color: style.color, fontSize: style.fontSize,
        fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
    };
    return {
      id: (block as HTMLElement).dataset.blockId, type: (block as HTMLElement).dataset.blockType,
      height: block.getBoundingClientRect().height,
      padding: block.firstElementChild && getComputedStyle(block.firstElementChild).padding,
      tree: block.firstElementChild && tree(block.firstElementChild),
      fields: Array.from(block.querySelectorAll<HTMLElement>('[data-g7pb-richtext-field]'))
        .filter((element) => element.getBoundingClientRect().height > 0 && element.textContent?.trim())
        .map((element) => ({ field: element.dataset.g7pbInlineField ?? '', tag: element.dataset.g7pbRichtextDisplay,
          html: element.outerHTML.slice(0, 2000), text: (element.textContent ?? '').replace(/\s+/g, ' ').trim(), ...metrics(element.dataset.g7pbInlineField === 'caption' && element.parentElement?.tagName === 'FIGCAPTION' ? element.parentElement : element, element.dataset.g7pbRichtextDisplay === 'span' && element.dataset.g7pbInlineField !== 'caption') })),
      media: Array.from(block.querySelectorAll<HTMLImageElement>('img'))
        .filter((element) => element.getBoundingClientRect().height > 0)
        .map((element) => ({ src: element.src, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height,
          diagnostic: {reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, transform:getComputedStyle(element).transform, cssWidth:getComputedStyle(element).width, parentWidth:element.parentElement?.getBoundingClientRect().width, parentTransform:element.parentElement && getComputedStyle(element.parentElement).transform} })),
      video: Array.from(block.querySelectorAll('.g7pb-preview-video__frame')).map((element) => metrics(element)),
    };
  }));
  return previewBlocks.evaluateAll((blocks, input) => {
    const failures: Array<Record<string, unknown>> = [];
    const geometry: Array<Record<string, unknown>> = [];
    let checked = 0;
    const normalize = (text: string | null) => (text ?? '').replace(/\s+/g, ' ').trim();
    const tree = (element: Element, depth = 0): unknown => {
      const s = getComputedStyle(element); const r = element.getBoundingClientRect();
      return {tag:element.tagName,class:element.className,width:r.width,height:r.height,margin:s.margin,padding:s.padding,display:s.display,font:s.fontSize,line:s.lineHeight,children:depth < 3 ? Array.from(element.children).map(e=>tree(e,depth+1)):[]};
    };
    for (const source of input) {
      const block = blocks.find((element) => (element as HTMLElement).dataset.blockId === source.id);
      if (!block) throw new Error(`Missing compiled block ${source.id}`);
      geometry.push({id:source.id,type:source.type,editor:source.height,preview:block.getBoundingClientRect().height,delta:source.height-block.getBoundingClientRect().height,editorPadding:source.padding,previewPadding:getComputedStyle(block).padding,editorTree:source.tree,previewTree:tree(block)});
      const candidates = Array.from(block.querySelectorAll<HTMLElement>('h1,h2,h3,h4,p,div,span,strong,small,figcaption,cite,a,li,td,th'));
      const compare = (key: string, editor: Record<string, unknown>, element: Element | undefined | null, inline = false) => {
        checked += 1;
        if (!element) { failures.push({ block: source.type, id: source.id, key, reason: 'Missing compiled counterpart' }); return; }
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        let rect = element.getBoundingClientRect();
        if (inline) {
          const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const lines: DOMRect[] = [];
          while (walker.nextNode()) { if (walker.currentNode.textContent?.trim()) { range.selectNodeContents(walker.currentNode); lines.push(...range.getClientRects()); } }
          if (lines.length) rect = new DOMRect(Math.min(...lines.map(r=>r.left)), Math.min(...lines.map(r=>r.top)), Math.max(...lines.map(r=>r.right))-Math.min(...lines.map(r=>r.left)), Math.max(...lines.map(r=>r.bottom))-Math.min(...lines.map(r=>r.top)));
        }
        const style = getComputedStyle(element);
        const actual: Record<string, unknown> = { width: rect.width, height: rect.height, color: style.color,
          fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, lineHeight: style.lineHeight };
        const differences = Object.keys(actual).filter((property) => property in editor && (
          typeof actual[property] === 'number'
            ? Math.abs(Number(actual[property]) - Number(editor[property])) > 1.25
            : actual[property] !== editor[property]
        ));
        const matchedRules: string[] = [];
        if (differences.length) {
          const scan = (rules: CSSRuleList) => { for (const rule of Array.from(rules)) {
            if (rule instanceof CSSStyleRule) { try { if (element.matches(rule.selectorText) && /font|line-height|transform|width|height/.test(rule.style.cssText)) matchedRules.push(rule.cssText); } catch { /* Unsupported selector diagnostic only. */ } }
            else if ('cssRules' in rule) scan((rule as CSSGroupingRule).cssRules);
          } };
          for (const sheet of Array.from(element.ownerDocument.styleSheets)) { try { scan(sheet.cssRules); } catch { /* Cross-origin template stylesheet. */ } }
        }
        if (differences.length) failures.push({ block: source.type, id: source.id, key, differences, editor,
          stylesheets: Array.from(element.ownerDocument.styleSheets).map(sheet=>sheet.href), matchedRules,
          diagnostic: {reduced:matchMedia('(prefers-reduced-motion: reduce)').matches, transform:getComputedStyle(element).transform, cssWidth:getComputedStyle(element).width, parentTransform:element.parentElement && getComputedStyle(element.parentElement).transform},
          preview: actual, parent: {width:element.parentElement?.getBoundingClientRect().width, padding:element.parentElement && getComputedStyle(element.parentElement).padding, border:element.parentElement && getComputedStyle(element.parentElement).borderWidth}, html: element.outerHTML.slice(0, 2000), selector: `${element.tagName}.${element.className}` });
      };
      for (const field of source.fields) {
        const matches = candidates.filter((element) => normalize(element.textContent).replace(/^[“”]|[“”]$/g, '') === field.text.replace(/^[“”]|[“”]$/g, '') && element.getBoundingClientRect().height > 0);
        const score = (element: HTMLElement): number => {
          const tag = element.tagName.toLowerCase();
          if (field.field === 'caption' && tag === 'figcaption') return 100;
          if (field.field.endsWith('.answer') && tag === 'div' && element.parentElement?.tagName === 'DETAILS') return 110;
          if (field.tag === 'div') return /__(body|summary|description|quote)/.test(element.className) ? 100 : tag === 'p' ? 80 : tag === 'div' ? 10 : 0;
          return tag === field.tag ? 100 : /^(h[1-4]|figcaption|small|strong|cite)$/.test(tag) ? 60 : 0;
        };
        matches.sort((a, b) => score(b) - score(a));
        compare(field.field, field, matches[0], field.tag === 'span' && field.field !== 'caption');
      }
      const images = Array.from(block.querySelectorAll<HTMLImageElement>('img'));
      const usedImages = new Set<HTMLImageElement>();
      for (const [index, media] of source.media.entries()) {
        const match = images.find((element) => element.src === media.src && !usedImages.has(element));
        if (match) usedImages.add(match);
        compare(`image:${index}`, media, match);
      }
      for (const [index, video] of source.video.entries()) {
        compare(`video-frame:${index}`, {width:video.width,height:video.height}, block.querySelectorAll('.g7pb-video__frame')[index]);
      }
    }
    return { checked, failures, geometry };
  }, expected);
}

async function settleContentMedia(blocks: Locator): Promise<void> {
  await blocks.evaluateAll(async (elements) => {
    const images = elements.flatMap((element) => Array.from(element.querySelectorAll('img')));
    for (const image of images) image.loading = 'eager';
    await Promise.all(images.map(async (image) => { try { await image.decode(); } catch { /* Broken media is reported by the catalog gate. */ } }));
  });
}

async function assertScenario(
  context: BrowserContext,
  page: Page,
  owned: OwnedDocument,
  scenario: Scenario,
  projectName: string,
): Promise<void> {
  // Optional local candidate bundle: never overwrite the shared installed runtime.
  if (process.env.G7PB_PARITY_CANDIDATE_DIST) {
    for (const [file, contentType] of [['js/page-builder-editor.iife.js', 'application/javascript'], ['css/page-builder-editor.css', 'text/css']]) {
      await context.route(`**/dist/${file}*`, (route) => route.fulfill({
        path: resolve(process.env.G7PB_PARITY_CANDIDATE_DIST!, file), contentType,
      }));
    }
  }
  if (process.env.G7PB_PARITY_CANDIDATE_PUBLIC_CSS) {
    await context.route('**/dist/css/page-builder-public.css*', (route) => route.fulfill({
      path: process.env.G7PB_PARITY_CANDIDATE_PUBLIC_CSS!, contentType: 'text/css',
    }));
    if (process.env.G7PB_PARITY_INSTALLED_PUBLIC_CSS) {
      const installed = readFileSync(process.env.G7PB_PARITY_INSTALLED_PUBLIC_CSS, 'utf8').trim();
      const candidate = readFileSync(process.env.G7PB_PARITY_CANDIDATE_PUBLIC_CSS, 'utf8').trim();
      await context.route('**/api/modules/bundle.css*', async (route) => {
        const response = await route.fetch();
        const bundle = await response.text();
        if (!bundle.includes(installed)) throw new Error('Candidate public CSS does not match the installed G7 module bundle.');
        await route.fulfill({response, body: bundle.replace(installed, candidate), contentType: 'text/css'});
      });
    }
  }
  await page.goto(`${EDITOR_PATH}?document=${owned.documentId}`);
  const editor = page.getByTestId('page-builder-editor');
  await expect(editor).toBeVisible();
  const viewportMutations: string[] = [];
  const collectViewportMutation = (request: { method(): string; url(): string }): void => {
    const path = new URL(request.url()).pathname;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && path.includes(`/documents/${owned.documentId}`)) {
      viewportMutations.push(`${request.method()} ${path}`);
    }
  };
  page.on('request', collectViewportMutation);
  const width = await setCanvasViewport(page, projectName);
  page.off('request', collectViewportMutation);
  expect(viewportMutations, `${scenario.label} viewport switch must not persist document data`).toEqual([]);
  const expectedMode = projectName === 'desktop' ? 'edit' : 'preview';
  await expect(editor).toHaveAttribute('data-editing-mode', expectedMode);
  await expect(editor).toHaveAttribute('data-canvas-viewport', String(width));
  await expect(page.getByTestId('page-builder-editor-mode-notice'))
    .toContainText('편집은 PC에서만 지원합니다. 모바일·태블릿은 반응형 미리보기 전용입니다.');
  const addBlock = page.getByTestId('page-builder-add-block');
  if (expectedMode === 'edit') await expect(addBlock).toBeEnabled();
  else await expect(addBlock).toBeDisabled();
  await expect(page.locator(CANVAS_IFRAME)).toHaveCount(1);
  const editorBlocks = page.frameLocator(CANVAS_IFRAME).getByTestId('page-builder-block');
  await expect(editorBlocks).toHaveCount(scenario.expectedBlockCount, { timeout: 60_000 });
  const editorRoot = page.frameLocator(CANVAS_IFRAME).locator('.g7pb-preview-page');
  await expect(editorRoot).toBeVisible();
  if (expectedMode === 'preview') {
    await expect(page.frameLocator(CANVAS_IFRAME).locator('[contenteditable="true"]')).toHaveCount(0);
  }
  await expectProductCanvasStyles(editorRoot);
  await editorRoot.evaluate(async (element) => { await element.ownerDocument.fonts.ready; });
  await settleContentMedia(editorBlocks);
  await expectStableVisibleGeometry(editorBlocks, scenario.expectedBlockCount);
  const editorMetrics = await layoutMetrics(editorBlocks, true);
  expectBlockContainment(editorMetrics, `${scenario.label} editor`);
  await expectDocumentContained(editorRoot, `${scenario.label} editor product root overflow`);

  const previewLink = page.getByTestId('page-builder-preview-link');
  await expect(previewLink).toBeVisible();
  if (await previewLink.evaluate((element) => element.tagName === 'BUTTON')) {
    const previewResponsePromise = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && new URL(response.url()).pathname === `${API}/documents/${owned.documentId}/preview`
    ));
    await previewLink.click();
    const previewResponse = await previewResponsePromise;
    const previewResponseBody = await previewResponse.text();
    expect(
      previewResponse.ok(),
      `${scenario.label} preview creation failed (${previewResponse.status()}): ${previewResponseBody}`,
    ).toBe(true);
  }
  await expect(previewLink).toHaveAttribute('href', /\/modules\/jiwonpapa-page_builder\/preview\/[a-f0-9]{64}/);
  const previewUrl = await previewLink.getAttribute('href');
  if (!previewUrl) throw new Error(`${scenario.label} preview URL is unavailable.`);
  const preview = await context.newPage();
  try {
    const canvasHeight = await editorRoot.evaluate((element) => element.ownerDocument.defaultView!.innerHeight);
    await preview.setViewportSize({ width, height: canvasHeight });
    const response = await preview.goto(previewUrl);
    expect(response?.ok()).toBe(true);
    const previewBlocks = preview.getByTestId('page-builder-rendered-block');
    await expect(previewBlocks).toHaveCount(scenario.expectedBlockCount, { timeout: 60_000 });
    await expect(previewBlocks.first()).toBeVisible({ timeout: 60_000 });
    await expect(previewBlocks.last()).toBeVisible({ timeout: 60_000 });
    await expectProductPublicStyles(previewBlocks);
    await settleContentMedia(previewBlocks);
    await expectStableVisibleGeometry(previewBlocks, scenario.expectedBlockCount);
    const standalonePreviewRoot = preview.getByTestId('page-builder-preview-root');
    const previewRoot = await standalonePreviewRoot.count() === 1
      ? standalonePreviewRoot
      : preview.locator('html');
    await expect(previewRoot).toBeVisible();
    await previewRoot.evaluate(async (element) => { await element.ownerDocument.fonts.ready; });
    await expectDocumentContained(previewRoot, `${scenario.label} preview product root overflow`);
    const previewMetrics = await layoutMetrics(previewBlocks, false);
    const elementComparison = await compareContentElements(editorBlocks, previewBlocks);
    mkdirSync(resolve('output/playwright/parity-elements'), { recursive: true });
    writeFileSync(resolve('output/playwright/parity-elements', `${projectName}-${scenario.label.replace(/[^a-z0-9_-]/gi, '-')}.json`), JSON.stringify(elementComparison, null, 2));
    expect(elementComparison.failures.length, `Internal content differences: ${JSON.stringify(elementComparison.failures.slice(0, 3))}; full evidence: output/playwright/parity-elements`).toBe(0);
    expectLayoutParity(editorMetrics, previewMetrics);
  } finally {
    await preview.close();
  }
}

async function purgeDocument(
  api: APIRequestContext,
  owned: OwnedDocument,
): Promise<void> {
  const currentResponse = await api.get(`${API}/documents/${owned.documentId}`);
  if (currentResponse.status() !== 404) {
    expect(currentResponse.ok()).toBe(true);
    const current = await currentResponse.json() as DocumentResource;
    if (typeof current.data?.lock_version !== 'number') throw new Error('Layout cleanup returned no lock version.');
    let lockVersion = current.data.lock_version;
    if (typeof current.data.archived_at !== 'string') {
      const archiveResponse = await api.post(`${API}/documents/${owned.documentId}/archive`, {
        data: { expected_lock_version: lockVersion },
      });
      expect(archiveResponse.ok()).toBe(true);
      const archived = await archiveResponse.json() as DocumentResource;
      if (typeof archived.data?.lock_version !== 'number') throw new Error('Layout archive returned no lock version.');
      lockVersion = archived.data.lock_version;
    }
    const purgeResponse = await api.delete(`${API}/documents/${owned.documentId}`, {
      data: { expected_lock_version: lockVersion, confirmation_slug: owned.slug },
    });
    expect(purgeResponse.ok()).toBe(true);
  }
  for (const mediaId of owned.mediaIds) {
    const mediaResponse = await api.delete(`${API}/media/${mediaId}`);
    expect(mediaResponse.ok(), `Layout media cleanup failed for ${mediaId}`).toBe(true);
  }
}

// Compare settled document geometry, not different instants of a scroll animation.
// Motion playback has its own product gate; both renderers honor reduced motion here.
test.use({ screenshot: 'off', trace: 'off', video: 'off', contextOptions: {reducedMotion: 'reduce'} });
test.describe.configure({ retries: 0 });

test('keeps every built-in block preset and Page Kit inside the editor/preview layout contract', async ({ context, page }, testInfo) => {
  test.setTimeout(360_000);
  expect(builtinManifest.blocks.length).toBeGreaterThan(0);
  const activeBlocks = builtinManifest.blocks.filter((block) => (
    !block.capabilities.includes('editor.compatibility-only')
  ));
  const compatibilityBlocks = builtinManifest.blocks.filter((block) => (
    block.capabilities.includes('editor.compatibility-only')
  ));
  expect(builtinManifest.presets.length).toBeGreaterThanOrEqual(builtinManifest.blocks.length);
  expect(compatibilityBlocks.map((block) => block.block_id)).toEqual(['content.hero-split-01']);
  expect(pageKitScenarios.length).toBeGreaterThan(0);
  expect(new Set(declaredPageKitSlugs).size).toBe(declaredPageKitSlugs.length);
  expect([...declaredPageKitSlugs].sort()).toEqual(sourcePageKitSlugs);
  expect(new Set(builtinManifest.presets.map((preset) => preset.block_id))).toEqual(
    new Set(activeBlocks.map((block) => block.block_id)),
  );

  const { api } = await authenticate(context);
  const ownedDocuments: OwnedDocument[] = [];
  await context.route(/^https:\/\/(?:www\.youtube-nocookie\.com|player\.vimeo\.com)\//, (route) => route.abort());
  try {
    const preset = presetScenario();
    const presetDocument = await createDocument(api, testInfo.project.name);
    ownedDocuments.push(presetDocument);
    await test.step(preset.label, async () => {
      await putScenario(api, presetDocument, preset);
      await assertScenario(context, page, presetDocument, preset, testInfo.project.name);
    });
    for (const scenario of pageKitScenarios) {
      const pageKitDocument = await applyPageKit(api, scenario, testInfo.project.name, ownedDocuments);
      await test.step(scenario.label, async () => {
        await assertScenario(context, page, pageKitDocument, scenario, testInfo.project.name);
      });
    }
  } finally {
    await page.close();
    for (const owned of ownedDocuments.reverse()) await purgeDocument(api, owned);
    await api.dispose();
  }
});
