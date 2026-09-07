import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

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
