import { devices, expect, test, type APIRequestContext, type Page, type Locator } from '@playwright/test';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';
import { SitePartSetFixture } from './support/sitePartSetFixture';
import type { ElementPartResource, PartKind } from '../../resources/js/api/elementSitePartResource';
import type { SitePartSetResource } from '../../resources/js/api/resources';

// SPEC-09 edits every canvas width on a desktop host, without a mobile-UA/OS keymap mix.
test.use({ locale: 'ko-KR', isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });

const API = '/api/modules/jiwonpapa-page_builder/admin';
const EDITOR = '/modules/jiwonpapa-page_builder/admin/site-parts';
const click = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true }).click();
const pane = (page: Page, kind: PartKind) => page.locator('[data-part="' + kind + '"]');
async function create(page: Page, owned: SitePartSetFixture) {
  const title = owned.reserveProductCreation();
  await page.goto(EDITOR + '?editor=structure&locale=' + owned.locale);
  await expect(page.getByTestId('page-builder-site-part-editor-root')).toHaveAttribute('data-locale', owned.locale);
  await page.getByLabel('세트 이름', { exact: true }).fill(title);
  const creating = page.waitForResponse(response => response.url().endsWith('/site-part-sets') && response.request().method() === 'POST');
  await click(page, '빈 정밀 세트 만들기');
  const response = await creating; expect(response.ok(), await response.text()).toBe(true);
  const set: SitePartSetResource = (await response.json()).data;
  expect(set).toMatchObject({ id: expect.any(String), locale: owned.locale,
    header: { site_part_id: expect.any(String) }, footer: { site_part_id: expect.any(String) } });
  expect(set.header.site_part_id).not.toBe(set.footer.site_part_id);
  owned.registerProductCreation(set.id);
  expect(set.is_active).toBe(false); expect(set.is_ready).toBe(false);
  await expect(page.getByTestId('structure-site-part-pair')).toBeVisible();
  return set;
}
async function read(api: APIRequestContext, setId: string, kind: PartKind) {
  const response = await api.get(API + '/site-parts/' + kind + '?' + new URLSearchParams({ set_id: setId, locale: 'ko' }));
  expect(response.ok(), await response.text()).toBe(true);
  const part: ElementPartResource = (await response.json()).data;
  expect(part).toMatchObject({ set_id: setId, lock_version: expect.any(Number), revision: expect.any(Number),
    document: { schema_version: 'g7-page-builder/site-part/v2', kind,
      content: { schema_version: 'g7-page-builder/v3', locale: 'ko', shell_mode: 'none' } } });
  return part;
}
async function save(page: Page, kind: PartKind) {
  const response = page.waitForResponse(value => value.url().endsWith('/site-parts/' + kind + '/draft') && value.request().method() === 'PUT');
  await click(pane(page, kind), '저장');
  const saved = await response; expect(saved.ok(), await saved.text()).toBe(true);
  await expect(pane(page, kind).getByRole('status', { name: '편집 상태' })).toHaveText('저장됨');
}
async function font(scope: Locator, pixels: number) {
  const group = scope.getByLabel('글자 크기 지정', { exact: true }).locator('xpath=ancestor::details');
  if (await group.getAttribute('open') === null) await group.locator('summary').click();
  await scope.getByLabel('글자 크기 지정', { exact: true }).check();
  await scope.getByLabel('글자 크기 형식', { exact: true }).selectOption({ label: 'px' });
  await scope.getByLabel('글자 크기 값', { exact: true }).fill(String(pixels));
  await click(scope, '디자인 적용');
}
async function measure(node: Locator) {
  return node.evaluate(async element => {
    await element.ownerDocument.fonts.ready;
    const rect = element.getBoundingClientRect(), css = getComputedStyle(element);
    // Puck's transparent iframe paints over the host workspace. Inspect that
    // same-origin ancestor too; a transparent node alone does not prove parity.
    let ancestor: Element | null = element, background: string | undefined;
    while (ancestor) {
      const paint = ancestor.ownerDocument.defaultView!.getComputedStyle(ancestor).backgroundColor;
      if (paint !== 'transparent' && paint !== 'rgba(0, 0, 0, 0)') { background = paint; break; }
      ancestor = ancestor.parentElement ?? ancestor.ownerDocument.defaultView?.frameElement ?? null;
    }
    if (!background) throw new Error('The authored surface has no measurable background');
    return { text: element.textContent, width: rect.width, height: rect.height, font: css.fontSize,
      color: css.color, background };
  });
}

test('generic Site Parts preserve separate histories save reopen preview and atomic publication at three widths', async ({ page, context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = new SitePartSetFixture(api, 'ko');
  const viewer = await context.newPage();
  let documentId: string | undefined;
  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await owned.start();
    const set = await create(page, owned), header = pane(page, 'header'), footer = pane(page, 'footer');
    const sources = await page.locator('script[src]').evaluateAll(nodes => nodes.map(node => node.getAttribute('src')));
    expect(sources.some(source => source?.includes('page-builder-structure.iife.js'))).toBe(true);
    expect(sources.some(source => source?.includes('page-builder-site-part.iife.js'))).toBe(false);
    await expect(header.getByTestId(/^layer-/)).toHaveCount(0);
    await click(header, '컨테이너 삽입');
    const parent = (await header.getByTestId(/^layer-/).getAttribute('data-testid'))!.slice('layer-'.length);
    await header.getByLabel('삽입 위치', { exact: true }).selectOption(parent);
    await click(header, '제목 삽입');
    const heading = (await header.getByTestId(/^layer-/).last().getAttribute('data-testid'))!.slice('layer-'.length);
    await header.getByTestId('layer-' + heading).click(); await click(header, '본문 입력');
    await header.frameLocator('iframe').locator('[data-v3-node="' + heading + '"] [contenteditable]').click();
    const rich = header.frameLocator('iframe').locator('[data-v3-node="' + heading + '"] .tiptap[contenteditable="true"]');
    await rich.click(); await rich.press('ControlOrMeta+A'); await page.keyboard.insertText('공통 요소로 만든 헤더');
    await expect(rich).toHaveText('공통 요소로 만든 헤더'); await click(header, '구조 선택');
    await font(header, 27); await click(header, '모바일'); await font(header, 21);
    await click(page, 'Footer'); await click(footer, '본문 삽입');
    const paragraph = (await footer.getByTestId(/^layer-/).getAttribute('data-testid'))!.slice('layer-'.length);
    await footer.getByTestId('layer-' + paragraph).click(); await click(footer, '본문 입력');
    await footer.frameLocator('iframe').locator('[data-v3-node="' + paragraph + '"] [contenteditable]').click();
    const footerRich = footer.frameLocator('iframe').locator('[data-v3-node="' + paragraph + '"] .tiptap[contenteditable="true"]');
    await footerRich.click(); await footerRich.press('ControlOrMeta+A'); await page.keyboard.insertText('공통 요소로 만든 푸터');
    await expect(footerRich).toHaveText('공통 요소로 만든 푸터'); await click(footer, '구조 선택');
    await font(footer, 19); await click(footer, '모바일'); await font(footer, 17);
    await click(page, 'Header'); await click(header, '실행 취소');
    await expect(header.frameLocator('iframe').locator('[data-v3-node="' + heading + '"]')).toHaveCSS('font-size', '27px');
    await click(header, '다시 실행');
    await expect(header.frameLocator('iframe').locator('[data-v3-node="' + heading + '"]')).toHaveCSS('font-size', '21px');
    await expect(page.getByRole('button', { name: 'Header·Footer 함께 발행' })).toBeDisabled();
    await save(page, 'header'); await click(page, 'Footer'); await save(page, 'footer');
    const expected = { header: await read(api, set.id, 'header'), footer: await read(api, set.id, 'footer') };
    await page.reload();
    await expect(pane(page, 'header').getByTestId('layer-' + heading)).toBeVisible();
    expect((await read(api, set.id, 'header')).document).toEqual(expected.header.document);
    expect((await read(api, set.id, 'footer')).document).toEqual(expected.footer.document);
    page.once('dialog', dialog => dialog.dismiss()); await click(page, 'Header·Footer 함께 발행');
    expect((await read(api, set.id, 'header')).active_revision).toBeNull();
    page.once('dialog', dialog => dialog.accept()); await click(page, 'Header·Footer 함께 발행');
    await expect(page.getByRole('button', { name: '사이트에 적용', exact: true })).toBeEnabled();
    expect((await read(api, set.id, 'header')).status).toBe('published');
    expect((await read(api, set.id, 'footer')).status).toBe('published');
    owned.prepareActivation(set.id);
    page.once('dialog', dialog => dialog.accept()); await click(page, '사이트에 적용');
    await expect(page.getByRole('button', { name: '사이트에 적용', exact: true })).toBeDisabled();
    owned.checkpointActivation();
    const slug = 'g7pb-part-' + crypto.randomUUID();
    const created = await api.post(API + '/documents', { data: { title: '공통영역 출력 검증', slug,
      locale: 'ko', shell_mode: 'builder', schema_version: 'g7-page-builder/v3' } });
    expect(created.ok(), await created.text()).toBe(true);
    const body = (await created.json()).data; documentId = body.document.document_id;
    const prepare = await api.post(API + '/documents/' + documentId + '/publications/prepare', { data: { expected_lock_version: body.lock_version } });
    expect(prepare.ok(), await prepare.text()).toBe(true);
    const token = (await prepare.json()).data.publication_token;
    const published = await api.post(API + '/publications/' + token + '/commit', { data: {} });
    expect(published.ok(), await published.text()).toBe(true);
    const url = (await published.json()).data.public_url;
    for (const [label, width, size] of [['PC · 공통값', 1280, '27px'], ['태블릿', 768, '27px'], ['모바일', 360, '21px']] as const) {
      await click(page, 'Header'); await click(header, label); await click(header, '화면 맞춤');
      const canvasNode = header.frameLocator('iframe').locator('[data-v3-node="' + heading + '"]');
      await expect(canvasNode).toHaveCSS('font-size', size);
      // Return to 100% for source CSS pixel geometry, not screenshot zoom pixels.
      await header.getByRole('combobox', { name: '작업면 확대', exact: true }).selectOption('1');
      const canvas = await measure(canvasNode);
      await click(page, 'Footer'); await click(footer, label);
      await footer.getByRole('combobox', { name: '작업면 확대', exact: true }).selectOption('1');
      const footerNode = footer.frameLocator('iframe').locator('[data-v3-node="' + paragraph + '"]');
      await expect(footerNode).toHaveCSS('font-size', width === 360 ? '17px' : '19px');
      const footerCanvas = await measure(footerNode);
      await click(page, '공통영역 미리보기');
      await page.getByLabel('미리보기 폭').selectOption(String(width));
      const previewNode = page.getByTestId('site-part-pair-preview').locator('[data-v3-node="' + heading + '"]');
      await expect(previewNode).toHaveCSS('font-size', size);
      const preview = await measure(previewNode);
      await viewer.setViewportSize({ width, height: 1000 }); expect((await viewer.goto(url))?.ok()).toBe(true);
      const outputNode = viewer.locator('[data-g7pb-element-site-part="header"] [data-v3-node="' + heading + '"]');
      await expect(outputNode).toHaveCSS('font-size', size);
      const output = await measure(outputNode);
      for (const actual of [preview, output]) {
        expect(actual.text).toBe(canvas.text); expect(actual.font).toBe(canvas.font);
        expect(actual.color).toBe(canvas.color); expect(actual.background).toBe(canvas.background);
        expect(Math.abs(actual.width - canvas.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(actual.height - canvas.height)).toBeLessThanOrEqual(1);
      }
      const footerPreview = page.getByTestId('site-part-pair-preview').locator('[data-v3-node="' + paragraph + '"]');
      const footerOutput = viewer.locator('[data-g7pb-element-site-part="footer"] [data-v3-node="' + paragraph + '"]');
      for (const node of [footerPreview, footerOutput]) {
        await expect(node).toHaveCSS('font-size', footerCanvas.font);
        const actual = await measure(node);
        expect(actual.text).toBe(footerCanvas.text); expect(actual.font).toBe(footerCanvas.font);
        expect(actual.color).toBe(footerCanvas.color); expect(actual.background).toBe(footerCanvas.background);
        expect(Math.abs(actual.width - footerCanvas.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(actual.height - footerCanvas.height)).toBeLessThanOrEqual(1);
      }
      await info.attach('site-part-appearance-' + width, { contentType: 'application/json', body: JSON.stringify({
        header: { canvas, preview, output },
        footer: { canvas: footerCanvas, preview: await measure(footerPreview), output: await measure(footerOutput) },
      }) });
      await info.attach('site-part-preview-' + width, { body: await page.screenshot(), contentType: 'image/png' });
      await info.attach('site-part-public-' + width, { body: await viewer.screenshot({ fullPage: true }), contentType: 'image/png' });
    }
    // Publishing advanced both CAS tokens without resetting either local history.
    await click(page, 'Header'); await click(header, '본문 삽입'); await save(page, 'header');
    expect((await read(api, set.id, 'header')).status).toBe('published_with_changes');
    await viewer.reload(); await expect(viewer.locator('[data-g7pb-element-site-part="header"] [data-v3-node]')).toHaveCount(2);
    await page.goto(EDITOR + '?set_id=' + set.id + '&locale=ko');
    await expect(page).toHaveURL(/editor=structure/);
    await expect(pane(page, 'header').getByTestId(/^layer-/)).toHaveCount(3);
    await info.attach('canonical-site-part-pair', { body: JSON.stringify(expected), contentType: 'application/json' });
  } finally {
    await viewer.close();
    try {
      if (documentId) {
        const resource = (await (await api.get(API + '/documents/' + documentId)).json()).data;
        expect(resource.document.document_id).toBe(documentId);
        const archived = await api.post(API + '/documents/' + documentId + '/archive', { data: { expected_lock_version: resource.lock_version } });
        expect(archived.ok(), await archived.text()).toBe(true);
      }
    } finally { try { owned.restore(); } finally { await api.dispose(); } }
  }
});

test('generic Site Part save conflicts and delayed responses preserve current input and block publication', async ({ page, context }) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context)), owned = new SitePartSetFixture(api, 'ko');
  try {
    await owned.start(); await page.setViewportSize({ width: 1600, height: 1000 });
    const set = await create(page, owned), header = pane(page, 'header');
    await click(header, '제목 삽입');
    let release!: () => void, started!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; }), reached = new Promise<void>(resolve => { started = resolve; });
    await page.route('**/site-parts/header/draft', async route => {
      expect(route.request().postDataJSON().set_id).toBe(set.id);
      const response = await route.fetch(); started(); await held; await route.fulfill({ response });
    }, { times: 1 });
    try {
      await click(header, '저장'); await reached;
      await click(header, '본문 삽입');
      await expect(page.getByRole('button', { name: 'Header·Footer 함께 발행' })).toBeDisabled();
    } finally { release(); }
    await expect(header.getByRole('status', { name: '편집 상태' })).toHaveText('이전 입력 저장됨 · 추가 변경 있음');
    await save(page, 'header'); await expect(header.getByTestId(/^layer-/)).toHaveCount(2);
    const previous = await read(api, set.id, 'header');
    const external = await api.put(API + '/site-parts/header/draft', { data: { set_id: set.id, locale: 'ko',
      title: previous.title, document: previous.document, expected_lock_version: previous.lock_version } });
    expect(external.ok(), await external.text()).toBe(true);
    await click(header, '제목 삽입');
    const conflict = page.waitForResponse(value => value.url().endsWith('/site-parts/header/draft') && value.request().method() === 'PUT');
    await click(header, '저장');
    expect((await conflict).status()).toBe(409);
    await expect(header.getByRole('status', { name: '편집 상태' })).not.toHaveText(/저장 중|저장됨/);
    await expect(header.getByTestId(/^layer-/)).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Header·Footer 함께 발행' })).toBeDisabled();
    expect((await read(api, set.id, 'header')).document).toEqual(previous.document);
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: '문서함', exact: true }).click();
    await expect(page.getByTestId('structure-site-part-pair')).toBeVisible();
  } finally { try { owned.restore(); } finally { await api.dispose(); } }
});
