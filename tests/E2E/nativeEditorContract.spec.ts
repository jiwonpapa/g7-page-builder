import { expect, test, request as playwrightRequest, type APIRequestContext, type Page } from '@playwright/test';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';
import { nativeStructureFlow } from './support/nativeStructureFixture';

test('native structure commands preserve nested source through one Undo save and reopen', async ({ page, context }, info) => {
  await nativeStructureFlow(page, context, info);
});

const endpoint = '/api/admin/templates/sirsoft-basic/layouts/e2e_sandbox';
const before = 'NE1 원본 보존 확인 문구';
const after = 'NE1 편집 후 저장한 문구';
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Resource = { content: string; lock_version: number };
async function read(api: APIRequestContext): Promise<Resource> {
  const response = await api.get(endpoint);
  expect(response.ok(), 'The owned G7 e2e_sandbox fixture must be installed').toBe(true);
  return (await response.json() as { data: Resource }).data;
}
async function put(api: APIRequestContext, content: Json, version: number): Promise<void> {
  const response = await api.put(endpoint, { data: { content: JSON.stringify(content), expected_lock_version: version } });
  expect(response.ok(), await response.text()).toBe(true);
}
function replaceText(value: Json, next: string): Json {
  if (Array.isArray(value)) return value.map(item => replaceText(item, next));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    value.id === 'native_ne1_text' && key === 'text' ? next : replaceText(item, next)]));
}

async function selectText(page: Page): Promise<void> {
  const path = await page.locator('[data-editor-id="native_ne1_text"]').getAttribute('data-editor-path');
  expect(path).toBeTruthy();
  await page.getByTestId('g7le-dnd-handle-' + path).click();
}

test('native general page preserves its source through edit Undo Redo save and reopen', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const original = await read(api);
  const owned: Json = { version: '1.0.0', layout_name: 'e2e_sandbox', extends: '_user_base',
    meta: { title: 'NE1 contract fixture', seo: { enabled: false } },
    slots: { content: [{ id: 'native_ne1_root', type: 'basic', name: 'Div', props: { className: 'p-4' }, children: [
      { id: 'native_ne1_text', type: 'basic', name: 'H2', text: before, props: { className: 'text-2xl' },
        future_meta: { retained: ['unknown', 7], object: {}, list: [], numeric: { '0': 'kept' } }, responsive: { mobile: { props: { className: 'text-xl' } } } },
      { id: 'native_ne1_sibling', type: 'basic', name: 'P', text: 'NE1 보존할 형제 문구',
        props: { title: '$t:common.save', onClick: [{ action: 'navigate', url: '/' }], style: {} } },
    ] }] } };
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await put(api, owned, original.lock_version);
    const baseline = JSON.parse((await read(api)).content) as Json;
    expect(baseline).toEqual(owned);
    await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
    await expect(page.getByTestId('g7le-toolbar')).toBeVisible();
    await expect(page.getByTestId('g7le-extension-panels')).toBeVisible();
    await selectText(page);
    const field = page.getByRole('textbox', { name: '페이지 빌더 문구' });
    await expect(field).toHaveValue(before);
    await expect(field).toBeEnabled();
    await field.fill(after);
    await page.getByRole('button', { name: '문구 적용', exact: true }).click();
    await expect(page.locator('[data-editor-id="native_ne1_text"]')).toHaveText(after);
    await expect(page.getByTestId('g7le-toolbar-undo')).toBeEnabled();
    await page.getByTestId('g7le-toolbar-undo').click();
    await expect(page.locator('[data-editor-id="native_ne1_text"]')).toHaveText(before);
    await page.getByTestId('g7le-toolbar-redo').click();
    await expect(page.locator('[data-editor-id="native_ne1_text"]')).toHaveText(after);
    const saved = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
    await page.getByTestId('g7le-toolbar-save').click();
    expect((await saved).ok()).toBe(true);
    expect(JSON.parse((await read(api)).content)).toEqual(replaceText(baseline, after));
    await page.reload();
    await selectText(page);
    await expect(field).toHaveValue(after);
    await expect(page.getByText('NE1 보존할 형제 문구', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('native-ne1-reopened.png'), fullPage: true });
    await info.attach('NAT-01-source-diff', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      template: 'sirsoft-basic', layout: 'e2e_sandbox', changedNode: 'native_ne1_text', changedField: 'text',
      differenceOutsideChange: 0, pageErrors: errors, source: 'G7 admin layout API',
    }, null, 2)) });
  } catch (error) {
    await page.screenshot({ path: info.outputPath('native-ne1-before-cleanup.png'), fullPage: true });
    throw error;
  } finally {
    await page.goto('about:blank');
    const latest = await read(api);
    await put(api, JSON.parse(original.content) as Json, latest.lock_version);
    await api.dispose();
  }
});

async function selectNode(page: Page, id: string): Promise<void> {
  await page.getByRole('button', { name: '한국어', exact: true }).click();
  const path = await page.locator(`[data-editor-id="${id}"]`).getAttribute('data-editor-path');
  expect(path).toBeTruthy();
  await page.getByTestId('g7le-dnd-handle-' + path).click();
}
function changeNode(value: Json, id: string, patch: (node: Record<string, Json>) => Record<string, Json>): Json {
  if (Array.isArray(value)) return value.map(item => changeNode(item, id, patch));
  if (!value || typeof value !== 'object') return value;
  if (value.id === id) return patch(value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, changeNode(item, id, patch)]));
}
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64');
const mediaEndpoint = '/api/admin/templates/sirsoft-basic/layout-attachments';

test('native content style and image commands preserve source through Undo save reopen and cancelled media', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  const original = await read(api);
  const createdAssets: Array<string | number> = [];
  const mediaTag = 'ne2-late-' + Date.now() + '-';
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let releaseUpload: (() => void) | undefined;
  try {
    const seedResponse = await api.post(mediaEndpoint, { multipart: { layout_name: 'e2e_sandbox',
      file: { name: 'ne2-before.png', mimeType: 'image/png', buffer: imageBytes } } });
    expect(seedResponse.ok(), await seedResponse.text()).toBe(true);
    const seed = (await seedResponse.json() as { data: { id: number; url: string } }).data; createdAssets.push(seed.id);
    let expected: Json = { version: '1.0.0', layout_name: 'e2e_sandbox', extends: '_user_base', meta: { title: 'NE2 code fixture', seo: { enabled: false } },
      slots: { content: [{ id: 'ne2-root', type: 'basic', name: 'Div', props: { className: 'p-4' }, children: [
        { id: 'ne2-heading', type: 'basic', name: 'H2', text: 'NE2 편집 검증', props: { className: 'text-left custom-preserved dark:text-right' }, future: { kept: 2 }, responsive: { mobile: { props: { className: 'text-right' } } } },
        { id: 'ne2-link', type: 'basic', name: 'A', text: '링크 검증', props: { href: '/before', target: '_self', title: '$t:common.save' } },
        { id: 'ne2-image', type: 'basic', name: 'Img', props: { src: seed.url, alt: '원래 대체 텍스트', style: { width: '320px', borderRadius: '12px' }, className: 'preserve-image-class' }, responsive: { mobile: { props: { alt: '$t:mobile.alt' } } }, future: { kept: true } },
        { id: 'ne2-bound', type: 'basic', name: 'Img', props: { src: seed.url, alt: '$t:common.save', style: { width: '50px' } } },
      ] }] } };
    await put(api, expected, original.lock_version);
    await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
    await expect(page.getByTestId('g7le-extension-panels')).toBeVisible();
    await selectNode(page, 'ne2-heading');
    await page.getByRole('group', { name: '텍스트 정렬', exact: true }).getByRole('radio', { name: '가운데', exact: true }).check();
    await expect(page.locator('[data-editor-id="ne2-heading"]')).toHaveCSS('text-align', 'center');
    await page.getByTestId('g7le-toolbar-undo').click();
    await expect(page.locator('[data-editor-id="ne2-heading"]')).toHaveCSS('text-align', 'left');
    await page.getByTestId('g7le-toolbar-redo').click();
    expected = changeNode(expected, 'ne2-heading', node => ({ ...node, props: { ...node.props as Record<string, Json>, className: 'custom-preserved dark:text-right text-center' } }));
    await selectNode(page, 'ne2-link');
    await page.getByRole('textbox', { name: '링크 주소', exact: true }).fill('/pages/ne2-target');
    await page.getByRole('button', { name: '링크 주소 적용', exact: true }).click();
    await expect(page.locator('[data-editor-id="ne2-link"]')).toHaveAttribute('href', '/pages/ne2-target');
    expected = changeNode(expected, 'ne2-link', node => ({ ...node, props: { ...node.props as Record<string, Json>, href: '/pages/ne2-target' } }));
    await selectNode(page, 'ne2-image');
    await page.getByRole('textbox', { name: '대체 텍스트', exact: true }).fill('수정한 대체 텍스트');
    await page.getByRole('button', { name: '대체 텍스트 적용', exact: true }).click();
    await page.getByRole('group', { name: '이미지 비율', exact: true }).getByRole('radio', { name: '16:9', exact: true }).check();
    await page.getByRole('group', { name: '이미지 맞춤', exact: true }).getByRole('radio', { name: '채우기', exact: true }).check();
    await expect(page.locator('[data-editor-id="ne2-image"]')).toHaveCSS('aspect-ratio', '16 / 9');
    await page.getByRole('button', { name: '이미지 선택·업로드', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ne2-before.png 선택', exact: true })).toBeVisible();
    const allList = page.waitForResponse(response => response.url().endsWith(mediaEndpoint) && response.request().method() === 'GET');
    await page.getByRole('radio', { name: '템플릿 전체', exact: true }).check(); expect((await allList).ok()).toBe(true);
    const uploaded = page.waitForResponse(response => response.url().endsWith(mediaEndpoint) && response.request().method() === 'POST');
    await page.getByLabel('이미지 업로드', { exact: true }).setInputFiles({ name: 'ne2-after.png', mimeType: 'image/png', buffer: imageBytes });
    const uploadedResponse = await uploaded; expect(uploadedResponse.ok()).toBe(true);
    const asset = (await uploadedResponse.json() as { data: { id: number; url: string } }).data; createdAssets.push(asset.id);
    const imageUrl = new URL(asset.url, page.url());
    expect(imageUrl.origin).toBe(new URL(page.url()).origin);
    asset.url = imageUrl.pathname + imageUrl.search + imageUrl.hash;
    await expect(page.getByRole('button', { name: 'ne2-after.png 선택', exact: true })).toBeVisible();
    // Upload success must not silently replace the selected node.
    await expect(page.locator('[data-editor-id="ne2-image"]')).toHaveAttribute('src', seed.url);
    await page.getByRole('button', { name: 'ne2-after.png 선택', exact: true }).click();
    await expect(page.locator('[data-editor-id="ne2-image"]')).toHaveAttribute('src', asset.url);
    await page.getByTestId('g7le-toolbar-undo').click();
    await expect(page.locator('[data-editor-id="ne2-image"]')).toHaveAttribute('src', seed.url);
    await page.getByTestId('g7le-toolbar-redo').click();
    expected = changeNode(expected, 'ne2-image', node => ({ ...node, props: { ...node.props as Record<string, Json>, src: asset.url, alt: '수정한 대체 텍스트',
      style: { width: '320px', borderRadius: '12px', aspectRatio: '16 / 9', objectFit: 'cover' } } }));
    const saved = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
    await page.getByTestId('g7le-toolbar-save').click(); expect((await saved).ok()).toBe(true);
    expect(JSON.parse((await read(api)).content)).toEqual(expected);
    await page.reload(); await selectNode(page, 'ne2-image');
    await expect(page.getByRole('textbox', { name: '대체 텍스트', exact: true })).toHaveValue('수정한 대체 텍스트');
    await expect(page.locator('[data-editor-id="ne2-image"]')).toHaveCSS('object-fit', 'cover');
    await expect(page.getByRole('radio', { name: '16:9', exact: true })).toBeChecked();
    await page.screenshot({ path: info.outputPath('native-ne2-reopened.png'), fullPage: true });
    await selectNode(page, 'ne2-bound');
    await expect(page.getByRole('textbox', { name: '대체 텍스트', exact: true })).toBeDisabled();
    await selectNode(page, 'ne2-image');
    await page.getByRole('button', { name: '이미지 선택·업로드', exact: true }).click();
    await expect(page.getByLabel('이미지 업로드', { exact: true })).toBeEnabled();
    // Network failure and delayed success are isolated failure fixtures; the upload above used the real API.
    await page.route('**/layout-attachments', async route => {
      if (route.request().method() === 'POST') await route.fulfill({ status: 503, json: { success: false, message: 'NE2 test failure' } });
      else await route.continue();
    });
    await page.getByLabel('이미지 업로드', { exact: true }).setInputFiles({ name: 'ne2-failed.png', mimeType: 'image/png', buffer: imageBytes });
    await expect(page.getByText('이미지를 불러오지 못했습니다. 권한과 연결을 확인해 주세요.', { exact: true })).toBeVisible();
    await page.unroute('**/layout-attachments');
    for (const mode of ['cancel', 'selection', 'document']) {
      const lateName = mediaTag + mode + '.png';
      let arrived!: () => void; const started = new Promise<void>(resolve => { arrived = resolve; });
      const held = new Promise<void>(resolve => { releaseUpload = resolve; });
      await page.route('**/layout-attachments', async route => {
        if (route.request().method() !== 'POST') { await route.continue(); return; }
        arrived(); await held;
        await route.fulfill({ json: { success: true, data: { id: 'late', layout_name: 'e2e_sandbox', original_name: lateName, mime_type: 'image/png', size: 1, url: '/late.png' } } }).catch(() => undefined);
      });
      await page.getByLabel('이미지 업로드', { exact: true }).setInputFiles({ name: lateName, mimeType: 'image/png', buffer: imageBytes });
      await started;
      if (mode === 'cancel') await page.getByRole('button', { name: '취소·닫기', exact: true }).click();
      else if (mode === 'selection') await selectNode(page, 'ne2-link');
      else await page.goto('/admin/layout-editor/sirsoft-basic?route=%2F');
      releaseUpload?.(); releaseUpload = undefined;
      await page.unroute('**/layout-attachments');
      if (mode === 'document') await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
      await selectNode(page, 'ne2-image');
      await expect(page.locator('[data-editor-id="ne2-image"]')).toHaveAttribute('src', asset.url);
      await page.getByRole('button', { name: '이미지 선택·업로드', exact: true }).click();
      await expect(page.getByLabel('이미지 업로드', { exact: true })).toBeEnabled();
      // A server-accepted file may remain in the fresh list after cancel. Only the held response must be dropped.
      await expect(page.locator('.g7pb-native-assets img[src="/late.png"]'), mode).toHaveCount(0);
    }
    expect(JSON.parse((await read(api)).content)).toEqual(expected); expect(errors).toEqual([]);
    await info.attach('NAT-02-source-and-media', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      template: 'sirsoft-basic', layout: 'e2e_sandbox', changed: ['alignment', 'href', 'src', 'alt', 'aspectRatio', 'objectFit'],
      differenceOutsideChange: 0, upload: 'real-api', negativeMedia: ['503', 'cancel', 'selection-change', 'document-change'], pageErrors: errors,
    }, null, 2)) });
  } catch (error) {
    await page.screenshot({ path: info.outputPath('native-ne2-before-cleanup.png'), fullPage: true }); throw error;
  } finally {
    releaseUpload?.(); await page.unrouteAll({ behavior: 'ignoreErrors' }); await page.goto('about:blank');
    const latest = await read(api); await put(api, JSON.parse(original.content) as Json, latest.lock_version);
    const files = await api.get(mediaEndpoint + '?layout_name=e2e_sandbox');
    expect(files.ok()).toBe(true);
    const remaining = (await files.json() as { data: Array<{ id: number; original_name: string }> }).data;
    for (const item of remaining) if (item.original_name.startsWith(mediaTag)) createdAssets.push(item.id);
    for (const id of new Set(createdAssets)) expect((await api.delete('/api/admin/templates/layout-attachments/' + id)).ok()).toBe(true);
    await api.dispose();
  }
});

const compositionEndpoint = '/api/modules/jiwonpapa-page_builder/admin/native-compositions';
type CompositionNode = { id: string; name: string; children?: CompositionNode[]; props?: Record<string, Json>; [key: string]: unknown };
type CompositionLayout = { slots: { content: CompositionNode[] }; [key: string]: unknown };

test('native private compositions preserve source IDs references assets Undo and reopened copies', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await playwrightRequest.newContext({ baseURL: info.project.use.baseURL, ignoreHTTPSErrors: true,
    extraHTTPHeaders: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
  const original = await read(api);
  const created: string[] = []; const assets: number[] = [];
  const title = 'NAT04 내 조합 ' + Date.now();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const library = page.getByRole('region', { name: '내 조합', exact: true });
  const ownRow = () => library.getByRole('listitem').filter({ hasText: title });
  const selectBox = async (id: string): Promise<void> => {
    const path = await page.locator(`[data-editor-id="${id}"]`).getAttribute('data-editor-path');
    expect(path).toBeTruthy();
    await page.getByTestId('g7le-dnd-handle-' + path).click({ position: { x: 6, y: 6 } });
  };
  const openLibrary = async (): Promise<void> => {
    if (!await library.isVisible()) {
      await page.getByRole('radio', { name: '내 조합', exact: true }).check();
    }
    await expect(library).toBeVisible();
    await library.getByRole('button', { name: '조합 목록 새로고침', exact: true }).click();
  };
  try {
    const uploaded = await api.post(mediaEndpoint, { multipart: { layout_name: 'e2e_sandbox',
      file: { name: 'ne4-owned.png', mimeType: 'image/png', buffer: imageBytes } } });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
    const asset = (await uploaded.json() as { data: { id: number; url: string } }).data; assets.push(asset.id);
    const imagePath = new URL(asset.url, info.project.use.baseURL).pathname;
    let source: CompositionNode = { id: 'ne4_source', type: 'basic', name: 'Div', props: { className: 'p-4' }, future: {}, children: [
      { id: 'ne4_text', type: 'basic', name: 'P', text: '조합 원문', future: { preserved: [7, {}] } },
      { id: 'ne4_link', type: 'basic', name: 'A', text: '내부 이동', props: { href: '#ne4_text' } },
      { id: 'ne4_image', type: 'basic', name: 'Img', props: { src: imagePath, alt: '조합 이미지', style: { width: '48px', height: '48px' } } },
    ] };
    const destination: CompositionNode = { id: 'ne4_destination', type: 'basic', name: 'Div', props: { className: 'p-4' }, children: [
      { id: 'ne4_kept', type: 'basic', name: 'P', text: '삽입 대상' },
    ] };
    let owned: CompositionLayout = { version: '1.0.0', layout_name: 'e2e_sandbox', extends: '_user_base',
      meta: { title: 'NE4 composition fixture' }, slots: { content: [source, destination] } };
    await put(api, JSON.parse(JSON.stringify(owned)) as Json, original.lock_version);
    // Begin acceptance from the actual G7 stored source: its existing API normalizes empty objects before PB runs.
    owned = JSON.parse((await read(api)).content) as CompositionLayout; source = owned.slots.content[0]!;
    await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    await selectBox('ne4_source'); await openLibrary();
    await library.getByText('선택 항목 저장', { exact: true }).click();
    await library.getByRole('textbox', { name: '조합 이름', exact: true }).fill(title);
    const storing = page.waitForResponse(response => response.url().endsWith(compositionEndpoint) && response.request().method() === 'POST');
    await library.getByRole('button', { name: '선택 항목을 내 조합에 저장', exact: true }).click();
    const storedResponse = await storing; expect(storedResponse.ok(), await storedResponse.text()).toBe(true);
    const stored = (await storedResponse.json() as { data: { id: string } }).data; created.push(stored.id);
    await expect(ownRow()).toHaveCount(1);
    const payload = await api.get(compositionEndpoint + '/' + stored.id);
    expect(payload.ok()).toBe(true);
    const snapshot = (await payload.json() as { data: { snapshot: string } }).data.snapshot;
    const exported = JSON.parse(snapshot) as { node: CompositionNode; scope: string };
    expect(exported.node.future).toEqual(source.future); expect(exported.node.children?.[0]?.future).toEqual(source.children?.[0]?.future);
    expect(exported.node.__source).toEqual({ kind: 'route', layout: 'e2e_sandbox' });
    expect(exported.scope).toBe('template');
    expect(JSON.parse((await read(api)).content)).toEqual(owned);
    await page.reload(); await selectBox('ne4_destination'); await openLibrary();
    await expect(ownRow()).toHaveCount(1);
    const location = library.getByLabel('조합 삽입 위치', { exact: true });
    const collection = await location.locator('option').filter({ hasText: 'Div · 자식' }).first().getAttribute('value');
    expect(collection).toBeTruthy(); await location.selectOption(collection!);
    await ownRow().getByRole('button', { name: '조합 삽입', exact: true }).click();
    const copiedText = page.locator('[data-editor-id="ne4_destination"]').getByText('조합 원문', { exact: true });
    await expect(copiedText).toHaveCount(1);
    await page.getByTestId('g7le-toolbar-undo').click(); await expect(copiedText).toHaveCount(0);
    await page.getByTestId('g7le-toolbar-redo').click(); await expect(copiedText).toHaveCount(1);
    const saving = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
    await page.getByTestId('g7le-toolbar-save').click(); expect((await saving).ok()).toBe(true);
    const saved = JSON.parse((await read(api)).content) as CompositionLayout;
    const copy = saved.slots.content[1]!.children![1]!;
    expect(copy.id).toMatch(/^node_/); expect(copy.id).not.toBe(source.id);
    expect(copy.children).toHaveLength(3);
    const newIds = [copy.id, ...copy.children!.map(child => child.id)];
    expect(new Set(newIds).size).toBe(4);
    expect(newIds.some(id => ['ne4_source', 'ne4_text', 'ne4_link', 'ne4_image'].includes(id))).toBe(false);
    expect(copy.children![1]!.props?.href).toBe('#' + copy.children![0]!.id);
    expect(copy.children![2]!.props?.src).toBe(imagePath);
    expect(copy.future).toEqual(source.future); expect(copy.children![0]!.future).toEqual(source.children![0]!.future);
    expect(saved).toEqual({ ...owned, slots: { content: [source, { ...destination, children: [...destination.children!, copy] }] } });
    await page.reload(); await expect(copiedText).toHaveCount(1);
    await expect(page.locator(`[data-editor-id="${copy.children![2]!.id}"]`)).toHaveAttribute('src', imagePath);
    await selectBox('ne4_destination'); await openLibrary(); await expect(ownRow()).toHaveCount(1);
    await ownRow().getByRole('button', { name: '목록에서 삭제', exact: true }).click();
    await expect(ownRow().getByText('이 조합을 목록에서 삭제하시겠습니까? 이미 삽입한 사본과 이미지는 유지됩니다.', { exact: true })).toBeVisible();
    await ownRow().getByRole('button', { name: '삭제 확인', exact: true }).click();
    await expect(ownRow()).toHaveCount(0);
    expect((await api.get(compositionEndpoint + '/' + stored.id)).status()).toBe(404);
    expect((await api.get(imagePath)).ok()).toBe(true);
    expect(JSON.parse((await read(api)).content)).toEqual(saved);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('native-ne4-reopened.png'), fullPage: true });
    await info.attach('NAT-04-native-compositions', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      operations: ['private-save', 'reload-list', 'insert', 'fresh-ids', 'internal-reference-remap', 'undo', 'redo', 'g7-save', 'reopen', 'delete-library-only'],
      schema: 'g7.editor-composition/v1', differenceOutsideInsertion: 0, copiedAssetRemains: true, pageErrors: errors, newIds,
    }, null, 2)) });
  } catch (error) {
    await info.attach('NAT-04-failure', { contentType: 'text/plain', body: String(error) });
    await page.screenshot({ path: info.outputPath('native-ne4-failure.png'), fullPage: true }); throw error;
  } finally {
    await page.goto('about:blank');
    await put(api, JSON.parse(original.content) as Json, (await read(api)).lock_version);
    for (const id of created) {
      const response = await api.delete(compositionEndpoint + '/' + id); expect([200, 404]).toContain(response.status());
    }
    for (const id of assets) expect((await api.delete('/api/admin/templates/layout-attachments/' + id)).ok()).toBe(true);
    await api.dispose();
  }
});

test('native NE5 finds inserts details previews and saves through existing G7 controls', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const original = await read(api); const created: string[] = [];
  const title = 'NAT05 조합 ' + Date.now(); const text = 'NE5 상세 편집 완료';
  const owned: Json = { version: '1.0.0', layout_name: 'e2e_sandbox', extends: '_user_base',
    meta: { title: 'NE5 일반 페이지 제목', description: 'NE5 흐름 확인' }, slots: { content: [
      { id: 'ne5_root', type: 'basic', name: 'Div', props: { className: 'p-4' }, children: [
        { id: 'ne5_source', type: 'basic', name: 'P', text: 'NE5 원문' },
        { id: 'ne5_destination', type: 'basic', name: 'Div', props: { className: 'p-4' }, children: [
          { id: 'ne5_kept', type: 'basic', name: 'P', text: 'NE5 기존 항목' },
        ] },
      ] },
    ] } };
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const panel = page.getByTestId('g7le-extension-panels');
  const library = panel.getByRole('region', { name: '내 조합', exact: true });
  const select = async (id: string) => {
    const path = await page.locator(`[data-editor-id="${id}"]`).getAttribute('data-editor-path');
    expect(path).toBeTruthy();
    const container = id === 'ne5_destination';
    await page.getByTestId('g7le-dnd-handle-' + path).click(container ? { position: { x: 6, y: 6 } } : {});
  };
  try {
    await put(api, owned, original.lock_version);
    await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    await select('ne5_source');
    await panel.getByRole('radio', { name: '내 조합', exact: true }).check();
    await library.getByText('선택 항목 저장', { exact: true }).click();
    await library.getByRole('textbox', { name: '조합 이름', exact: true }).fill(title);
    const storing = page.waitForResponse(response => response.url().endsWith(compositionEndpoint) && response.request().method() === 'POST');
    await library.getByRole('button', { name: '선택 항목을 내 조합에 저장', exact: true }).click();
    const stored = await storing; expect(stored.ok()).toBe(true); created.push((await stored.json() as { data: { id: string } }).data.id);
    await expect(library.getByRole('button', { name: '조합 목록 새로고침', exact: true })).toBeEnabled();
    await library.getByRole('searchbox', { name: '현재 목록에서 찾기', exact: true }).fill(title);
    await select('ne5_destination');
    const location = library.getByLabel('조합 삽입 위치', { exact: true });
    const slot = await location.locator('option').filter({ hasText: 'Div · 자식' }).first().getAttribute('value');
    expect(slot).toBeTruthy(); await location.selectOption(slot!);
    await library.getByRole('group', { name: '삽입 순서', exact: true }).getByRole('radio').first().check();
    await page.screenshot({ path: info.outputPath('native-ne5-position.png'), fullPage: true });
    await library.getByRole('listitem').filter({ hasText: title }).getByRole('button', { name: '조합 삽입', exact: true }).click();
    const copy = page.locator('[data-editor-id="ne5_destination"] [data-editor-id]').filter({ hasText: 'NE5 원문' });
    await expect(copy).toHaveCount(1); const copiedId = await copy.getAttribute('data-editor-id'); expect(copiedId).toBeTruthy();
    await select(copiedId!); await panel.getByRole('radio', { name: '상세 편집', exact: true }).check();
    const field = panel.getByRole('textbox', { name: '페이지 빌더 문구', exact: true });
    await field.fill('취소할 입력'); await panel.getByRole('button', { name: '문구 입력 취소', exact: true }).click();
    await expect(field).toHaveValue('NE5 원문'); await expect(copy).toHaveText('NE5 원문');
    await field.fill(text); await panel.getByRole('button', { name: '문구 적용', exact: true }).click();
    await expect(page.locator(`[data-editor-id="${copiedId}"]`)).toHaveText(text);
    expect(JSON.parse((await read(api)).content)).toEqual(owned);
    await page.getByTestId('g7le-toolbar-page-settings').click();
    const settings = page.getByRole('dialog'); await expect(settings).toHaveAttribute('aria-label', /e2e-sandbox/);
    await expect(page.getByTestId('g7le-meta-title-preview')).toHaveValue('NE5 일반 페이지 제목');
    await page.screenshot({ path: info.outputPath('native-ne5-page-settings.png'), fullPage: true });
    await page.getByTestId('g7le-page-settings-close').click();
    const previewResponse = page.waitForResponse(response => response.url().includes(endpoint + '/preview') && response.request().method() === 'POST');
    const popupPromise = page.waitForEvent('popup');
    await page.getByTestId('g7le-toolbar-preview').click();
    expect((await previewResponse).ok()).toBe(true); const preview = await popupPromise;
    await expect(preview.getByText(text, { exact: true })).toBeVisible();
    await preview.screenshot({ path: info.outputPath('native-ne5-preview.png'), fullPage: true }); await preview.close();
    expect(JSON.parse((await read(api)).content)).toEqual(owned);
    const saving = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
    await page.getByTestId('g7le-toolbar-save').click(); expect((await saving).ok()).toBe(true);
    const expected = changeNode(owned, 'ne5_destination', node => ({ ...node, children: [
      { id: copiedId!, type: 'basic', name: 'P', text }, ...(node.children as Json[]),
    ] }));
    expect(JSON.parse((await read(api)).content)).toEqual(expected);
    await page.reload(); await select(copiedId!); await expect(field).toHaveValue(text);
    await panel.getByText('상단 저장 시 공개 페이지에 반영됩니다', { exact: true }).click();
    await expect(panel.getByText('미리보기로 확인한 뒤 상단 저장을 누르면 공개 페이지에 반영됩니다. 적용한 변경은 상단 실행 취소로 되돌릴 수 있습니다.', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('native-ne5-reopened.png'), fullPage: true });
    expect(errors).toEqual([]);
    await info.attach('NAT-05-workflow', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      operations: ['find-composition', 'select-parent', 'insert-before', 'cancel-text-input', 'detail-edit', 'host-page-settings', 'preview-before-save', 'host-save', 'reopen'],
      title: 'NE5 일반 페이지 제목', route: '/e2e-sandbox', previewDidNotPublish: true, differenceOutsideInsertion: 0, pageErrors: errors,
    }, null, 2)) });
  } catch (error) {
    await page.screenshot({ path: info.outputPath('native-ne5-failure.png'), fullPage: true }); throw error;
  } finally {
    await page.goto('about:blank'); await put(api, JSON.parse(original.content) as Json, (await read(api)).lock_version);
    for (const id of created) expect((await api.delete(compositionEndpoint + '/' + id)).ok()).toBe(true);
    await api.dispose();
  }
});

// NE6: DB를 사용하는 실제 HTTP 병렬 요청이며 요청 mock/순차 stale 요청이 아니다.
test('NE6 simultaneous layout saves accept one writer and preserve the winning source', async ({ context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const original = await read(api);
  try {
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      version: '1.0.0', layout_name: 'e2e_sandbox',
      meta: { title: 'NE6 writer ' + index },
      components: [{ id: 'ne6-concurrent', type: 'basic', name: 'P', text: 'writer ' + index, props: {} }],
    }));
    const started = Date.now();
    const results = await Promise.all(candidates.map(async content => {
      const response = await api.put(endpoint, { data: { content: JSON.stringify(content), expected_lock_version: original.lock_version } });
      return { status: response.status(), body: await response.json() as Json };
    }));
    await info.attach('NAT-06-concurrency', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      requests: results.length, elapsedMs: Date.now() - started, baseVersion: original.lock_version,
      statuses: results.map(result => result.status),
    })) });
    expect(results.filter(result => result.status === 200), JSON.stringify(results)).toHaveLength(1);
    expect(results.filter(result => result.status === 409), JSON.stringify(results)).toHaveLength(7);
    const saved = await read(api);
    expect(saved.lock_version).toBe(original.lock_version + 1);
    expect(JSON.parse(saved.content)).toEqual(candidates[results.findIndex(result => result.status === 200)]);
  } finally {
    const latest = await read(api);
    await put(api, JSON.parse(original.content) as Json, latest.lock_version);
    await api.dispose();
  }
});

test('NE6 JSON container kinds survive API save history restore and rejected input', async ({ context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const original = await read(api);
  const owned: Json = { version: '1.0.0', layout_name: 'e2e_sandbox',
    meta: { title: 'NE6 JSON source', future: { object: {}, list: [] } },
    components: [{ id: 'ne6-json', name: 'P', type: 'basic', text: 'JSON source', props: {},
      future: { object: {}, list: [], numeric: { '0': 'zero' }, nested: [{ empty: {} }] } }],
  };
  try {
    await put(api, owned, original.lock_version);
    const saved = await read(api);
    expect(JSON.parse(saved.content)).toEqual(owned);
    const historyResponse = await api.get(endpoint + '/versions');
    expect(historyResponse.ok(), await historyResponse.text()).toBe(true);
    const versions = (await historyResponse.json() as { data: Array<{ id: number; version: number }> }).data;
    const target = versions[0]; expect(target).toBeTruthy();
    const versionResponse = await api.get(endpoint + '/versions/' + target.version);
    expect(versionResponse.ok(), await versionResponse.text()).toBe(true);
    expect((await versionResponse.json() as { data: { full_content: Json } }).data.full_content).toEqual(owned);
    const edited = changeNode(owned, 'ne6-json', node => ({ ...node, text: 'Changed once' }));
    await put(api, edited, saved.lock_version);
    const beforeRestore = await read(api);
    const restored = await api.post(endpoint + '/versions/' + target.id + '/restore');
    expect(restored.ok(), await restored.text()).toBe(true);
    expect(JSON.parse((await read(api)).content)).toEqual(owned);
    const beforeInvalid = await read(api);
    expect(beforeInvalid.lock_version).toBe(beforeRestore.lock_version + 1);
    const staleSave = await api.put(endpoint, { data: { content: JSON.stringify(edited), expected_lock_version: beforeRestore.lock_version } });
    expect(staleSave.status()).toBe(409);
    const invalid = changeNode(owned, 'ne6-json', node => ({ ...node, props: { href: 'javascript:alert(1)' } }));
    const rejected = await api.put(endpoint, { data: { content: JSON.stringify(invalid), expected_lock_version: beforeInvalid.lock_version } });
    expect(rejected.status()).toBe(422);
    expect(await read(api)).toEqual(beforeInvalid);
    await info.attach('NAT-06-json', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      objectListNumericKinds: 'preserved', historyRestore: 'preserved', invalidInput: rejected.status(), sourceDifference: 0,
    })) });
  } finally {
    const latest = await read(api);
    await put(api, JSON.parse(original.content) as Json, latest.lock_version);
    await api.dispose();
  }
});

test('NE6 unavailable extension and failed save leave the stored page unchanged', async ({ page, context }, info) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const original = await read(api);
  const owned: Json = { version: '1.0.0', layout_name: 'e2e_sandbox', extends: '_user_base', meta: { title: 'NE6 failure fixture' },
    slots: { content: [{ id: 'native_ne1_text', type: 'basic', name: 'H2', text: before, props: {} }] } };
  let blocked = 0;
  const extensionAsset = '**/page-builder-native.iife.js*';
  try {
    await put(api, owned, original.lock_version);
    const baseline = await read(api);
    await page.route(extensionAsset, route => { blocked += 1; return route.abort(); });
    await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
    await expect(page.getByTestId('g7le-toolbar')).toBeVisible();
    await expect.poll(() => blocked).toBeGreaterThan(0);
    await selectText(page);
    await expect(page.getByRole('textbox', { name: '페이지 빌더 문구' })).toHaveCount(0);
    expect(await read(api)).toEqual(baseline);
    await page.screenshot({ path: info.outputPath('native-ne6-extension-unavailable.png'), fullPage: true });
    await page.unroute(extensionAsset);
    await page.reload(); await selectText(page);
    const field = page.getByRole('textbox', { name: '페이지 빌더 문구' });
    await field.fill(after);
    const apply = page.getByRole('button', { name: '문구 적용', exact: true });
    await apply.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('[data-editor-id="native_ne1_text"]')).toHaveText(after);
    await page.route('**' + endpoint, route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'NE6 injected save failure' }) }) : route.continue());
    const failed = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
    await page.getByTestId('g7le-toolbar-save').click();
    expect((await failed).status()).toBe(503);
    expect(await read(api)).toEqual(baseline);
    await expect(field).toHaveValue(after);
    await page.screenshot({ path: info.outputPath('native-ne6-save-failed.png'), fullPage: true });
    await info.attach('NAT-06-failure', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      blockedExtensionRequests: blocked, hostEditor: 'available', keyboardApply: 'passed', failedSave: 503, storedSourceChanged: false,
    })) });
  } finally {
    await page.goto('about:blank');
    await page.unrouteAll({ behavior: 'wait' });
    const latest = await read(api);
    await put(api, JSON.parse(original.content) as Json, latest.lock_version);
    await api.dispose();
  }
});
