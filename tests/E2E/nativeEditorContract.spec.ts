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
        future_meta: { retained: ['unknown', 7] }, responsive: { mobile: { props: { className: 'text-xl' } } } },
      { id: 'native_ne1_sibling', type: 'basic', name: 'P', text: 'NE1 보존할 형제 문구',
        props: { title: '$t:common.save', onClick: [{ action: 'navigate', url: '/' }] } },
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
