import { expect, type APIRequestContext, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './editorInteractionFixture';
const endpoint = '/api/admin/templates/sirsoft-basic/layouts/e2e_sandbox';
type Node = { id?: string; name?: string; type?: string; children?: Node[]; [key: string]: unknown };
type Layout = { slots: { content: Node[] }; [key: string]: unknown };
async function read(api: APIRequestContext): Promise<{ content: string; lock_version: number }> {
  const response = await api.get(endpoint); expect(response.ok()).toBe(true);
  return (await response.json() as { data: { content: string; lock_version: number } }).data;
}
async function put(api: APIRequestContext, content: string, version: number): Promise<void> {
  const response = await api.put(endpoint, { data: { content, expected_lock_version: version } });
  expect(response.ok(), await response.text()).toBe(true);
}
export async function nativeStructureFlow(page: Page, context: BrowserContext, info: TestInfo): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const original = await read(api);
  const leaf: Node = { id: 'ne3_leaf', name: 'P', type: 'basic', text: '구성 편집 원문', future: { keep: ['unknown', 7] }, responsive: { mobile: { props: { className: 'text-sm' } } } };
  const box: Node = { id: 'ne3_box', name: 'Div', type: 'basic', props: { className: 'p-4' }, children: [{ id: 'ne3_nested', name: 'P', type: 'basic', text: '중첩 원문' }] };
  const owned: Layout = { version: '1.0.0', layout_name: 'e2e_sandbox', extends: '_user_base', meta: { title: 'NE3 structure fixture' },
    slots: { content: [{ id: 'ne3_root', type: 'basic', name: 'Div', props: { className: 'p-4' }, children: [leaf, box] }] } };
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const collection = page.locator('.g7pb-native-collection').filter({ has: page.locator(':scope > summary', { hasText: 'Div · 자식' }) }).first();
  const rows = () => collection.locator(':scope > ol > li');
  try {
    await put(api, JSON.stringify(owned), original.lock_version);
    await page.goto('/admin/layout-editor/sirsoft-basic?route=%2Fe2e-sandbox');
    await page.getByRole('button', { name: '한국어', exact: true }).click();
    const path = await page.locator('[data-editor-id="ne3_root"]').getAttribute('data-editor-path');
    // Parent selection uses its visible padding; child handles cover the content centre.
    await page.getByTestId('g7le-dnd-handle-' + path).click({ position: { x: 6, y: 6 } });
    await expect(rows()).toHaveCount(2);
    await collection.getByRole('button', { name: '항목 추가', exact: true }).click();
    await expect(rows()).toHaveCount(3);
    await page.getByTestId('g7le-toolbar-undo').click(); await expect(rows()).toHaveCount(2);
    await page.getByTestId('g7le-toolbar-redo').click(); await expect(rows()).toHaveCount(3);
    await rows().nth(0).getByRole('button', { name: 'P 복제', exact: true }).click(); await expect(rows()).toHaveCount(4);
    await rows().nth(1).getByRole('button', { name: 'P 아래로', exact: true }).click();
    await expect(rows().nth(1).locator(':scope > span')).toHaveText('Div');
    await rows().nth(2).getByRole('button', { name: 'P 삭제', exact: true }).click(); await expect(rows()).toHaveCount(3);
    const destination = await collection.getByLabel('이동 위치').locator('option').filter({ hasText: 'Div / Div · 자식' }).first().getAttribute('value');
    expect(destination).toBeTruthy(); await collection.getByLabel('이동 위치').selectOption(destination!);
    await rows().nth(0).getByRole('button', { name: '선택 위치로 이동', exact: true }).click();
    await expect(rows()).toHaveCount(2);
    const save = page.waitForResponse(response => response.url().includes(endpoint) && response.request().method() === 'PUT');
    await page.getByTestId('g7le-toolbar-save').click(); expect((await save).ok()).toBe(true);
    const saved = JSON.parse((await read(api)).content) as Layout;
    const children = saved.slots.content[0]!.children!;
    expect(children[0]).toEqual({ ...box, children: [...box.children!, leaf] });
    expect(children[1]?.id).toMatch(/^node_/);
    expect(children[1]?.name).toBe('Div');
    expect(saved).toEqual({ ...owned, slots: { content: [{ ...owned.slots.content[0], children }] } });
    await page.reload();
    await expect(page.locator('[data-editor-id="ne3_box"] [data-editor-id="ne3_leaf"]')).toHaveText('구성 편집 원문');
    await page.getByTestId('g7le-dnd-handle-' + path).click({ position: { x: 6, y: 6 } });
    await expect(rows()).toHaveCount(2);
    expect(errors).toEqual([]);
    await page.screenshot({ path: info.outputPath('native-ne3-structure-reopened.png'), fullPage: true });
    await info.attach('NAT-03-tree-source', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
      operations: ['insert', 'undo', 'redo', 'duplicate', 'reorder', 'delete', 'move-into-nested-parent', 'save', 'reopen'],
      preservedNode: leaf, differenceOutsideChange: 0, pageErrors: errors,
    }, null, 2)) });
  } catch (error) {
    await page.screenshot({ path: info.outputPath('native-ne3-structure-failure.png'), fullPage: true }); throw error;
  } finally {
    await page.goto('about:blank'); await put(api, original.content, (await read(api)).lock_version); await api.dispose();
  }
}
