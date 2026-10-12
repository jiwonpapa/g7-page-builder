import { test, expect, type Page, type Locator } from '@playwright/test';

type State = { session: string; previewMode: string; history: number; nodes: { id: string; width: number; height: number; body: string }[] };
const state = async (page: Page): Promise<State> => JSON.parse(await page.getByTestId('state').innerText());
const canvas = (page: Page) => page.frameLocator('iframe');
const node = (page: Page, index = 0) => canvas(page).locator(`[data-probe-node="box-${index}"]`);
const selection = (page: Page) => canvas(page).getByTestId('selection');
const runtimeErrors = new WeakMap<Page, string[]>();
async function box(locator: Locator) {
  const value = await locator.boundingBox();
  if (!value) throw new Error('Missing rendered target');
  return value;
}
async function startResize(page: Page, dx: number) {
  const handle = canvas(page).locator('.moveable-control.moveable-e').last();
  await expect(handle).toBeVisible();
  const rect = await box(handle);
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + dx, rect.y + rect.height / 2, { steps: 8 });
}
async function ready(page: Page, count = 3) {
  await page.goto('/?nodes=' + count);
  await expect(node(page)).toBeVisible();
  await expect(selection(page)).toHaveText('0 selected');
}
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(process.env.G7PB_PROBE_URL ?? '') && !url.startsWith('data:'))
      throw new Error('Unexpected external/G7 request: ' + url);
    return route.continue();
  });
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });

for (const zoom of [0.5, 1, 2]) {
  test(`iframe resize at ${zoom * 100}% with scroll is one Puck Undo`, async ({ page }, testInfo) => {
    await ready(page);
    await page.getByLabel('Zoom', { exact: true }).selectOption(String(zoom));
    await node(page).click();
    await expect(selection(page)).toHaveText('1 selected');
    await canvas(page).locator('body').evaluate(element => element.ownerDocument.defaultView?.scrollTo(0, 20));
    const before = await state(page);
    await startResize(page, 40);
    // Live DOM preview never writes intermediate vendor states/history.
    expect((await state(page)).history).toBe(before.history);
    await page.mouse.up();
    await expect.poll(async () => (await state(page)).nodes[0].width).toBeCloseTo(240 + 40 / zoom, 0);
    expect((await state(page)).history).toBe(before.history + 1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect((await state(page)).nodes).toEqual(before.nodes);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect.poll(async () => (await state(page)).nodes[0].width).toBeCloseTo(240 + 40 / zoom, 0);
    await expect(canvas(page).locator('.moveable-control.moveable-e').last()).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`zoom-${zoom}.png`), fullPage: true });
  });
}

test('Selecto box selection and group resize have a single atomic Undo', async ({ page }) => {
  await ready(page);
  const first = await box(node(page, 0));
  const second = await box(node(page, 1));
  await page.mouse.move(first.x - 10, first.y - 10);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width + 10, second.y + second.height + 5, { steps: 10 });
  await page.mouse.up();
  await expect(selection(page)).toHaveText('2 selected');
  const before = await state(page);
  await startResize(page, 40);
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).history).toBe(before.history + 1);
  const after = await state(page);
  expect(after.nodes[0].width).toBeGreaterThan(240);
  expect(after.nodes[1].width).toBeGreaterThan(240);
  expect(after.nodes[2]).toEqual(before.nodes[2]);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page)).nodes).toEqual(before.nodes);
});

test('Escape, readonly and document switch cancel a pending geometry gesture', async ({ page }) => {
  await ready(page);
  await node(page).click();
  const before = await state(page);
  await startResize(page, 40);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await state(page)).nodes).toEqual(before.nodes);
  expect((await state(page)).history).toBe(before.history);
  await expect(node(page)).toHaveCSS('width', '240px');
  await startResize(page, 40);
  await page.getByRole('checkbox', { name: 'Readonly' }).focus();
  await page.keyboard.press('Space');
  await page.mouse.up();
  expect((await state(page)).nodes).toEqual(before.nodes);
  await page.getByRole('checkbox', { name: 'Readonly' }).uncheck();
  await node(page).click();
  await startResize(page, 40);
  await page.getByRole('button', { name: 'Switch document' }).focus();
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).session).toBe('document-1');
  expect((await state(page)).nodes).toEqual(before.nodes);
  expect((await state(page)).history).toBe(0);
});

test('Tiptap input, Undo, composition guard and host portal retain input ownership', async ({ page }) => {
  await ready(page);
  await node(page).click();
  await page.getByRole('button', { name: 'Portal control' }).click();
  const portal = page.getByLabel('Portal text', { exact: true });
  await portal.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Portal only');
  await expect(portal).toHaveValue('Portal only');
  await expect(selection(page)).toHaveText('1 selected');
  expect((await state(page)).history).toBe(0);
  await page.getByRole('button', { name: 'Close portal' }).click();
  // Deterministic synthetic composition guard; native OS IME remains an IP10 manual check.
  await node(page).dispatchEvent('keydown', { key: 'a', metaKey: true, ctrlKey: true, isComposing: true });
  await expect(selection(page)).toHaveText('1 selected');
  await page.getByRole('button', { name: 'text', exact: true }).click();
  await node(page).dblclick();
  const text = node(page).locator('.ProseMirror[contenteditable="true"]');
  await expect(text).toBeVisible();
  await text.hover();
  await text.click();
  await expect(text).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Puck and Tiptap');
  await expect.poll(async () => (await state(page)).nodes[0].body).toBe('<p>Puck and Tiptap</p>');
  await expect(text).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  // ProseMirror reads the browser's selectionchange asynchronously.
  await text.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await state(page)).nodes[0].body).toBe('<p>Puck and Tipta</p>');
  expect((await state(page)).nodes).toHaveLength(3);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => (await state(page)).nodes[0].body).toBe('<p>Puck and Tiptap</p>');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(async () => (await state(page)).nodes[0].body).toBe('<p>Puck and Tipta</p>');
  expect((await state(page)).nodes).toHaveLength(3);
  await page.getByRole('button', { name: 'geometry', exact: true }).click();
  await expect.poll(async () => (await state(page)).previewMode).toBe('interactive');
  await node(page).click();
  await expect(selection(page)).toHaveText('1 selected');
});

test('Puck structure drawer inserts by pointer DnD into the same history', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'structure', exact: true }).click();
  const drawer = page.getByRole('button', { name: 'Proof box', exact: true }).first();
  const source = await box(drawer);
  const target = await box(node(page, 2));
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 15, source.y + source.height / 2, { steps: 3 });
  await page.mouse.move(target.x + 50, target.y + target.height - 5, { steps: 20 });
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).nodes.length).toBe(4);
  await expect.poll(async () => (await state(page)).history).toBe(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(page)).nodes.length).toBe(3);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect.poll(async () => (await state(page)).nodes.length).toBe(4);
  await page.getByRole('button', { name: 'geometry', exact: true }).click();
  await expect.poll(async () => (await state(page)).previewMode).toBe('interactive');
  await node(page).click();
  await expect(selection(page)).toHaveText('1 selected');
  await startResize(page, 30);
  await page.mouse.up();
  await expect.poll(async () => (await state(page)).history).toBe(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page)).nodes[0].width).toBe(240);
  expect((await state(page)).nodes).toHaveLength(4);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(page)).nodes.length).toBe(3);
});

for (const count of [100, 500]) {
  test(`${count} nodes: readiness and selection budgets`, async ({ page }, testInfo) => {
    const started = Date.now();
    await ready(page, count);
    expect((await state(page)).nodes).toHaveLength(count);
    const readinessMs = Date.now() - started;
    expect(readinessMs).toBeLessThan(10_000);
    const selecting = Date.now();
    await node(page).click();
    await expect(selection(page)).toHaveText('1 selected');
    const selectionMs = Date.now() - selecting;
    expect(selectionMs).toBeLessThan(1000);
    await testInfo.attach('performance.json', { body: JSON.stringify({ count, readinessMs, selectionMs, browser: page.context().browser()?.version() }), contentType: 'application/json' });
  });
}
