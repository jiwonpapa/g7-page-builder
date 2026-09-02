import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { activatePointerTarget, replacePuckRichTextField } from './support/richTextInput';
import { authenticateEditorInteractionAdmin, cleanupOwnedEditorInteractionDocument, createOwnedEditorInteractionDocument,
  editorInteractionApi, type OwnedEditorInteractionDocument } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin/documents';
const EDITOR = '/modules/jiwonpapa-page_builder/admin/editor';
const token = (field: string): string => `${field}-${crypto.randomUUID().slice(0, 8)}`;
const block = (type: string, props: Record<string, unknown>, slots: Record<string, PageBuilderBlock[]> = {}): PageBuilderBlock =>
  ({ instance_id: crypto.randomUUID(), type, block_version: 1, props, slots });

function heading(): PageBuilderBlock {
  return block('content.heading-01', { eyebrow: '', heading: token('heading'), level: 2, anchor: '' });
}

function buttons(): PageBuilderBlock {
  return block('action.buttons-01', { alignment: 'left', items: [
    { label: token('action'), url: '/fixture-a', variant: 'primary' },
    { label: token('action'), url: '/fixture-b', variant: 'secondary' },
  ] });
}

function slider(): PageBuilderBlock {
  return block('content.hero-slider-01', { slides: [0, 1].map(() => ({
    eyebrow: token('eyebrow'), title: token('slide'), body: `<p>${token('body')}</p>`,
    buttonLabel: token('action'), buttonUrl: '/fixture', imageSrc: '', imageAlt: '',
  })), autoplay: false, interval: 5000, loop: false });
}

function tabs(): PageBuilderBlock {
  return block('content.tabs-01', { eyebrow: '', heading: token('tabs'), initialTab: 0, style: 'pills',
    items: [0, 1].map(() => ({ label: token('tab'), heading: token('panel'), body: `<p>${token('body')}</p>` })),
  });
}

function pricing(): PageBuilderBlock {
  return block('commerce.pricing-tiers-01', { eyebrow: '', heading: token('pricing'), layout: 'cards',
    plans: [0, 1].map((index) => ({ name: token('plan'), price: `${index + 1}`, period: token('period'),
      description: `<p>${token('description')}</p>`, features: [token('feature')],
      buttonLabel: token('action'), buttonUrl: '/fixture', featured: false,
    })),
  });
}

function frameCases(): Array<{ item: PageBuilderBlock; field: string }> {
  const cases = [
    { item: heading(), field: 'heading' },
    { item: tabs(), field: 'heading' },
    { item: block('content.event-schedule-01', { eyebrow: '', heading: token('events'), layout: 'agenda', items: [{
      date: '2026-09-03', time: '14:00', title: token('event'), location: token('location'),
      description: token('description'), buttonLabel: token('action'), buttonUrl: '/fixture',
    }] }), field: 'heading' },
    { item: block('g7.board-post-detail-01', { eyebrow: '', heading: token('detail'), boardSlug: 'code-fixture',
      postId: 1, detailUrl: '/fixture', linkLabel: token('action'), audience: 'all', showContent: false,
      emptyMessage: token('empty'),
    }), field: 'heading' },
    { item: block('content.notice-01', { tone: 'info', title: token('notice'), body: `<p>${token('body')}</p>`,
      actionLabel: '', actionUrl: '',
    }), field: 'title' },
    { item: slider(), field: 'slides.0.title' },
  ];
  for (const { item, field } of cases) {
    item.props.appearance = { surface: 'soft', spacing: 'compact', containerWidth: 'wide',
      elements: { [field]: { weight: 'bold', tone: 'accent' } } };
    item.motion = { preset: 'reveal', intensity: 'subtle', trigger: 'once', stagger_ms: 60 };
  }
  return cases;
}

async function resource(api: APIRequestContext, id: string): Promise<{ document: PageBuilderDocument; lock_version: number }> {
  const response = await api.get(`${API}/${id}`);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { document?: PageBuilderDocument; lock_version?: number } };
  if (!payload.data?.document || typeof payload.data.lock_version !== 'number') throw new Error('Missing owned catalog document.');
  return { document: payload.data.document, lock_version: payload.data.lock_version };
}

async function withFixture(page: Page, context: BrowserContext, project: string, blocks: PageBuilderBlock[],
  run: (api: APIRequestContext, owned: OwnedEditorInteractionDocument, baseline: PageBuilderDocument) => Promise<void>): Promise<void> {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const errors: string[] = [];
  const watch = (target: Page): void => { target.on('pageerror', (error) => errors.push(error.message)); };
  watch(page);
  context.on('page', watch);
  let owned: OwnedEditorInteractionDocument | undefined;
  try {
    owned = await createOwnedEditorInteractionDocument(api, project);
    const initial = await resource(api, owned.documentId);
    const document: PageBuilderDocument = { ...initial.document, schema_version: 'g7-page-builder/v2', blocks,
      shell_mode: 'none', tokens: { 'design.color_mode': 'light' } };
    const seeded = await api.put(`${API}/${owned.documentId}/draft`, {
      data: { document, expected_lock_version: initial.lock_version },
    });
    if (!seeded.ok()) {
      const payload = await seeded.json().catch(() => null) as { message?: unknown; errors?: unknown; data?: { errors?: unknown } } | null;
      // Only validation diagnostics from this owned synthetic document; never
      // include authentication headers or an unexpected HTML error page.
      const diagnostic = JSON.stringify({ message: payload?.message, errors: payload?.data?.errors ?? payload?.errors }).slice(0, 4000);
      throw new Error(`Catalog fixture rejected (${seeded.status()}): ${diagnostic}`);
    }
    // Compare persistence against the server-accepted representation, before
    // the editor opens. No codec output is used to manufacture the expectation.
    const baseline = (await resource(api, owned.documentId)).document;
    expect(baseline.schema_version).toBe(document.schema_version);
    expect(baseline.shell_mode).toBe(document.shell_mode);
    expect(baseline.tokens).toEqual(document.tokens);
    expect(baseline.blocks.map(({ instance_id, type, block_version }) => ({ instance_id, type, block_version })))
      .toEqual(blocks.map(({ instance_id, type, block_version }) => ({ instance_id, type, block_version })));
    expect((await page.goto(`${EDITOR}?document=${owned.documentId}`))?.ok()).toBe(true);
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await run(api, owned, baseline);
    expect(errors, 'Catalog code must not raise an uncaught browser exception.').toEqual([]);
  } catch (error) {
    if (!page.isClosed()) {
      await test.info().attach('catalog-code-failure-screen', { body: await page.screenshot(), contentType: 'image/png' });
      await test.info().attach('catalog-code-failure-aria', { body: await page.locator('body').ariaSnapshot(), contentType: 'text/plain' });
    }
    throw error;
  } finally {
    context.off('page', watch);
    await page.close();
    try { if (owned) await cleanupOwnedEditorInteractionDocument(api, owned); }
    finally { await api.dispose(); }
  }
}

function canvasBlock(page: Page, item: PageBuilderBlock): Locator {
  return page.frameLocator('iframe').locator(`[data-block-id="${item.instance_id}"]`).first();
}

function richField(container: Locator, path: string): Locator {
  return container.locator(`[data-g7pb-inline-field="${path}"].ProseMirror, [data-g7pb-inline-field="${path}"] .ProseMirror`).first();
}

async function save(page: Page, id: string): Promise<void> {
  const acknowledged = page.waitForResponse((response) => {
    const path = new URL(response.url()).pathname;
    return response.request().method() === 'PUT' && path === `${API}/${id}/draft`
      || response.request().method() === 'POST' && path === `${API}/${id}/preview`;
  });
  await page.getByTestId('page-builder-save').click();
  expect((await acknowledged).ok()).toBe(true);
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

async function previewUrl(api: APIRequestContext, id: string): Promise<string> {
  const current = await resource(api, id);
  const response = await api.post(`${API}/${id}/preview`, { data: { expected_lock_version: current.lock_version } });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { preview_url?: string } };
  if (!payload.data?.preview_url) throw new Error('Missing compiled catalog preview URL.');
  return payload.data.preview_url;
}

async function selectOutlineBlock(page: Page, item: PageBuilderBlock, label: string): Promise<void> {
  await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
  const row = page.locator(`[data-puck-layer-tree-id="${item.instance_id}"]`);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
}

async function selectTab(page: Page, item: PageBuilderBlock, index: number): Promise<void> {
  await selectOutlineBlock(page, item, '탭 콘텐츠');
  const container = canvasBlock(page, item);
  const tab = container.getByRole('tab').nth(index);
  await expect(tab).toBeVisible();
  await tab.scrollIntoViewIfNeeded();
  const target = await tab.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const label = button.querySelector('[data-g7pb-inline-field]')?.getBoundingClientRect();
    const style = getComputedStyle(button);
    const padding = Number.parseFloat(style.paddingLeft);
    const position = { x: Number.parseFloat(style.borderLeftWidth) + padding / 2, y: rect.height / 2 };
    const x = rect.left + position.x, y = rect.top + position.y;
    return { position, padding, button: rect.toJSON(), label: label?.toJSON(),
      outsideLabel: Boolean(label && (x < label.left || x > label.right || y < label.top || y > label.bottom)),
      hitsButton: button.ownerDocument.elementFromPoint(x, y) === button };
  });
  // The Puck inline label consumes clicks for text editing. Activate the
  // button's measured padding once, without targeting that editable child.
  expect(target, 'Tab activation must hit the button itself outside its editable label').toMatchObject({ outsideLabel: true, hitsButton: true });
  expect(target.padding).toBeGreaterThan(0);
  await activatePointerTarget(page, tab, `tab ${index + 1} button padding`, target.position);
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(container.getByRole('tabpanel', { includeHidden: true }).nth(index)).toBeVisible();
}

async function selectCanvasField(page: Page, input: Locator, item: PageBuilderBlock, field: string): Promise<void> {
  const observed = page.evaluate(async ({ blockId, fieldPath }) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let listener: ((event: Event) => void) | undefined;
    try {
      return await new Promise<unknown>((resolve, reject) => {
        listener = (event) => {
          if (event instanceof CustomEvent && event.detail?.blockId === blockId && event.detail?.fieldPath === fieldPath) {
            resolve(event.detail);
          }
        };
        window.addEventListener('g7pb:canvas-element-selected', listener);
        timeout = setTimeout(() => reject(new Error(`Missing canvas selection: ${blockId}/${fieldPath}`)), 10_000);
      });
    } finally {
      clearTimeout(timeout);
      if (listener) window.removeEventListener('g7pb:canvas-element-selected', listener);
    }
  }, { blockId: item.instance_id, fieldPath: field });
  const [selection] = await Promise.all([observed, activatePointerTarget(page, input, `${item.type} field selection`)]);
  expect(selection).toMatchObject({ blockId: item.instance_id, fieldPath: field, role: 'text' });
}

// Synthetic inputs exercise code contracts, not catalog wording or preset quality.
test.use({ trace: 'off', video: 'off' });
test.describe.configure({ retries: 0 });

test('catalog frames preserve selection appearance and motion across families', async ({ page, context }, info) => {
  const cases = frameCases();
  await withFixture(page, context, info.project.name, cases.map(({ item }) => item), async (api, owned, baseline) => {
    expect(baseline.blocks).toMatchObject(cases.map(({ item }) => ({
      motion: item.motion, props: { appearance: item.props.appearance },
    })));
    for (const { item, field } of cases) {
      const container = canvasBlock(page, item);
      await expect(container).toHaveClass(/g7pb-container-width--wide/);
      await expect(container).toHaveAttribute('data-g7pb-motion', item.motion!.preset);
      await expect(container).toHaveAttribute('data-g7pb-motion-intensity', item.motion!.intensity);
      await expect(container).toHaveAttribute('data-g7pb-motion-stagger', String(item.motion!.stagger_ms));
      const styled = container.locator(`[data-g7pb-inline-field="${field}"]`).first();
      await expect(styled).toHaveClass(/g7pb-element-tone--accent/);
      await expect(styled).toHaveCSS('font-weight', '800');
      const input = richField(container, field);
      await expect(input).toBeEditable();
      await selectCanvasField(page, input, item, field);
    }
    await save(page, owned.documentId);
    expect((await resource(api, owned.documentId)).document).toEqual(baseline);
  });
});

test('catalog fields and interactive previews retain edited values', async ({ page, context }, info) => {
  const hero = slider(), plans = pricing(), tabbed = tabs();
  const slideTitle = token('edited-slide'), feature = token('edited-feature'), tabBody = token('edited-panel');
  const tabLabel = token('edited-tab');
  await withFixture(page, context, info.project.name, [hero, plans, tabbed], async (api, owned) => {
    const heroCanvas = canvasBlock(page, hero);
    await activatePointerTarget(page, heroCanvas.getByTestId('page-builder-slider-slide-1'), 'second slide');
    await expect(heroCanvas.getByTestId('page-builder-slider-slide-1')).toHaveAttribute('aria-pressed', 'true');
    const titleInput = richField(heroCanvas, 'slides.1.title');
    await replacePuckRichTextField(page, titleInput, slideTitle, 'second slide title');
    const retainedTitle = await titleInput.elementHandle();
    if (!retainedTitle) throw new Error('Missing edited slide input.');
    await expect(heroCanvas.locator('[data-slide-index]')).toHaveCount(2);
    await expect(heroCanvas.locator('[data-slide-index="0"]')).toBeVisible();
    await expect(heroCanvas.locator('[data-slide-index="1"]')).toHaveCSS('order', '-1');
    await replacePuckRichTextField(page, richField(canvasBlock(page, plans), 'plans.0.features.0'), feature, 'nested pricing feature');
    const tabCanvas = canvasBlock(page, tabbed);
    await selectTab(page, tabbed, 1);
    const labelInput = tabCanvas.getByRole('tab').nth(1).locator('[contenteditable]').first();
    await labelInput.hover();
    await expect(labelInput).toHaveAttribute('contenteditable', 'plaintext-only');
    await activatePointerTarget(page, labelInput, 'second tab label text');
    await expect(labelInput).toBeFocused();
    const previousLabel = await labelInput.textContent();
    await page.keyboard.press('ControlOrMeta+A');
    await expect.poll(() => labelInput.evaluate((element) => {
      const selection = element.ownerDocument.getSelection();
      return { text: selection?.toString(), ownsSelection: Boolean(selection?.anchorNode && selection.focusNode
        && element.contains(selection.anchorNode) && element.contains(selection.focusNode)) };
    })).toEqual({ text: previousLabel, ownsSelection: true });
    await page.keyboard.insertText(tabLabel);
    await expect(tabCanvas.getByRole('tab').nth(1)).toHaveText(tabLabel);
    await replacePuckRichTextField(page, richField(tabCanvas, 'items.1.body'), tabBody, 'second tab body');
    await expect(tabCanvas.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(heroCanvas.getByTestId('page-builder-slider-slide-1')).toHaveAttribute('aria-pressed', 'true');
    expect(await retainedTitle.evaluate((element) => element.isConnected)).toBe(true);
    await expect(titleInput).toHaveText(slideTitle);
    await save(page, owned.documentId);
    const saved = (await resource(api, owned.documentId)).document;
    expect(saved.blocks).toMatchObject([
      { instance_id: hero.instance_id, props: { slides: [expect.any(Object), { title: expect.stringContaining(slideTitle) }] } },
      { instance_id: plans.instance_id, props: { plans: [{ features: [expect.stringContaining(feature)] }, expect.any(Object)] } },
      { instance_id: tabbed.instance_id, props: { items: [expect.any(Object), { label: tabLabel, body: expect.stringContaining(tabBody) }] } },
    ]);
    await page.reload();
    await expect(richField(canvasBlock(page, hero), 'slides.1.title')).toHaveText(slideTitle);
    await expect(richField(canvasBlock(page, plans), 'plans.0.features.0')).toHaveText(feature);
    await selectTab(page, tabbed, 1);
    await expect(canvasBlock(page, tabbed).getByRole('tab').nth(1)).toHaveText(tabLabel);
    await expect(richField(canvasBlock(page, tabbed), 'items.1.body')).toHaveText(tabBody);
    await save(page, owned.documentId);
    expect((await resource(api, owned.documentId)).document.blocks).toEqual(saved.blocks);
  });
});

test('catalog conversion preserves nested documents through save and reentry', async ({ page, context }, info) => {
  const title = heading(), actions = buttons();
  const body = block('content.rich-text-01', { content: `<p>${token('sibling')}</p>`, measure: 'standard' });
  const columns = block('layout.columns-01', { columns: 2, ratio: '1:1', gap: 'compact' }, {
    column1: [title, actions], column2: [body],
  });
  const section = block('layout.section-01', { width: 'standard', spacing: 'compact' }, { content: [columns] });
  const edited = token('nested-edited');
  await withFixture(page, context, info.project.name, [section], async (api, owned, baseline) => {
    const originalColumns = baseline.blocks[0].slots!.content[0];
    await replacePuckRichTextField(page, richField(canvasBlock(page, title), 'heading'), edited, 'nested heading');
    await save(page, owned.documentId);
    const saved = (await resource(api, owned.documentId)).document;
    const savedColumns = saved.blocks[0].slots!.content[0];
    expect(saved.blocks.map((item) => item.instance_id)).toEqual([section.instance_id]);
    expect(savedColumns.instance_id).toBe(columns.instance_id);
    expect(savedColumns.slots!.column1.map((item) => item.instance_id)).toEqual([title.instance_id, actions.instance_id]);
    expect(savedColumns.slots!.column1[0].props.heading).toContain(edited);
    expect(savedColumns.slots!.column1[0].props).not.toHaveProperty('appearance');
    expect(savedColumns.slots!.column1[1]).toEqual(originalColumns.slots!.column1[1]);
    expect(savedColumns.slots!.column2).toEqual(originalColumns.slots!.column2);
    const preview = await context.newPage();
    try {
      expect((await preview.goto(await previewUrl(api, owned.documentId)))?.ok()).toBe(true);
      await expect(preview.locator(`[data-block-id="${title.instance_id}"]`)).toContainText(edited);
    } finally { await preview.close(); }
    await page.reload();
    await expect(richField(canvasBlock(page, title), 'heading')).toHaveText(edited);
    await save(page, owned.documentId);
    const reentered = (await resource(api, owned.documentId)).document;
    expect(reentered).toEqual(saved);
  });
});

test('catalog responsive overrides preserve inheritance and reset', async ({ page, context }, info) => {
  const actions = buttons();
  actions.props.appearance = { surface: 'soft', spacing: 'compact', containerWidth: 'narrow' };
  const section = block('layout.section-01', { width: 'standard', spacing: 'compact' }, { content: [actions] });
  await withFixture(page, context, info.project.name, [section], async (api, owned) => {
    // Select the nested item through the public Outline before opening its responsive fields.
    await selectOutlineBlock(page, section, 'Section · 구조 컨테이너');
    const sectionRow = page.locator(`[data-puck-layer-tree-id="${section.instance_id}"]`);
    const expand = sectionRow.locator(':scope > div').first().getByRole('button', { name: 'Expand', exact: true });
    if (await expand.isVisible()) await expand.click();
    await selectOutlineBlock(page, actions, '버튼 묶음');
    const tablet = page.getByTestId('page-builder-responsive-tablet-surface');
    const mobile = page.getByTestId('page-builder-responsive-mobile-surface');
    await expect(tablet).toHaveValue('');
    await expect(mobile).toHaveValue('');
    await tablet.selectOption('contrast');
    await mobile.selectOption('contrast');
    await save(page, owned.documentId);
    const overridden = (await resource(api, owned.documentId)).document.blocks[0].slots!.content[0];
    expect(overridden.responsive).toEqual({ tablet: { appearance: { surface: 'contrast' } }, mobile: { appearance: { surface: 'contrast' } } });
    const preview = await context.newPage();
    const colors = new Map<number, string>();
    try {
      expect((await preview.goto(await previewUrl(api, owned.documentId)))?.ok()).toBe(true);
      for (const width of [1440, 820, 390]) {
        await preview.setViewportSize({ width, height: 1000 });
        const rendered = preview.locator(`[data-block-id="${actions.instance_id}"]`);
        await expect(rendered).toBeVisible();
        colors.set(width, await rendered.evaluate((element) => getComputedStyle(element).backgroundColor));
      }
      expect(colors.get(820)).not.toBe(colors.get(1440));
      expect(colors.get(390)).toBe(colors.get(820));
      await page.getByTestId('page-builder-responsive-tablet-reset').click();
      await expect(tablet).toHaveValue('');
      await expect(mobile).toHaveValue('contrast');
      await save(page, owned.documentId);
      const reset = (await resource(api, owned.documentId)).document.blocks[0].slots!.content[0];
      expect(reset.responsive).toEqual({ mobile: { appearance: { surface: 'contrast' } } });
      expect(reset.props.appearance).toEqual(actions.props.appearance);
      expect((await preview.goto(await previewUrl(api, owned.documentId)))?.ok()).toBe(true);
      for (const width of [1440, 820, 390]) {
        await preview.setViewportSize({ width, height: 1000 });
        await expect(preview.locator(`[data-block-id="${actions.instance_id}"]`))
          .toHaveCSS('background-color', colors.get(width === 820 ? 1440 : width)!);
      }
      await page.reload();
      expect((await resource(api, owned.documentId)).document.blocks[0].slots!.content[0]).toEqual(reset);
    } finally { await preview.close(); }
  });
});
