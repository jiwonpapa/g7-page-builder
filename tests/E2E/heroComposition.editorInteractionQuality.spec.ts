import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import fixtures from '../Fixtures/layout-policy-cases.json' with { type: 'json' };
import type { PageBuilderDocument } from '../../resources/js/documents/types';
import { authenticateEditorInteractionAdmin, cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument, editorInteractionApi } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin/documents';
async function resource(api: APIRequestContext, id: string) {
  const response = await api.get(`${API}/${id}`);
  expect(response.ok()).toBe(true);
  return (await response.json() as { data: { document: PageBuilderDocument; lock_version: number } }).data;
}
async function selectComposition(page: Page, kind: 'hero' | 'imageText') {
  const row = page.locator('[data-puck-layer-tree-id] button').filter({ hasText: kind === 'hero' ? /^Hero$/ : /^이미지 \+ 텍스트$/ }).filter({ visible: true });
  if (!await row.isVisible()) await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
  await row.click();
  const composition = page.getByTestId(kind === 'hero' ? 'hero-composition' : 'image-text-composition').filter({ visible: true });
  if (!await composition.evaluate((node) => node.hasAttribute('open'))) await composition.locator('summary').click();
  return composition;
}
async function save(page: Page) {
  await page.getByTestId('page-builder-save').click();
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

for (const kind of ['hero', 'imageText'] as const) test(`${kind} extra inserts edits reorders deletes undoes and survives reopen preview and publication`, async ({ page, context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  const viewer = await context.newPage();
  try {
    const initial = await resource(api, owned.documentId);
    const hero = structuredClone(fixtures[kind].blocks[0]);
    hero.slots.extra = [];
    const seed = await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: initial.lock_version,
      document: { ...initial.document, schema_version: 'g7-page-builder/v2', shell_mode: 'none', blocks: [hero] } } });
    expect(seed.ok()).toBe(true);
    await page.goto(`/modules/jiwonpapa-page_builder/admin/editor?document=${owned.documentId}`);
    let composition = await selectComposition(page, kind);
    const addBadge = composition.getByRole('button', { name: '배지 추가', exact: true });
    expect((await addBadge.boundingBox())?.height).toBeLessThan(44);
    await addBadge.click();
    composition = await selectComposition(page, kind);
    await expect(composition.getByRole('button', { name: '배지 추가', exact: true })).toBeDisabled();
    await composition.getByRole('button', { name: '목록 추가', exact: true }).click();
    composition = await selectComposition(page, kind);
    await expect(composition.getByRole('button', { name: '목록 추가', exact: true })).toBeDisabled();
    await save(page);
    const before = await resource(api, owned.documentId);
    expect(before.document.blocks[0].slots?.extra.map((child) => child.type)).toEqual(['content.badge-01', 'content.list-01']);
    const frame = page.frameLocator('#puck-canvas-root iframe');
    const badgeId = before.document.blocks[0].slots!.extra[0].instance_id;
    await composition.getByRole('button', { name: '배지 편집', exact: true }).click();
    const label = page.getByLabel('문구 (40자 이내)', { exact: true }).filter({ visible: true });
    await label.fill('검증한 내부 배지');
    composition = await selectComposition(page, kind);
    await composition.getByRole('button', { name: '목록 위로', exact: true }).click();
    composition = await selectComposition(page, kind);
    await save(page);
    const reordered = await resource(api, owned.documentId);
    expect(reordered.document.blocks[0].slots?.extra.map((child) => child.type)).toEqual(['content.list-01', 'content.badge-01']);
    expect(reordered.document.blocks[0].slots!.extra[1].instance_id).toBe(badgeId);
    await composition.getByRole('button', { name: '배지 삭제', exact: true }).click();
    await expect(frame.getByText('검증한 내부 배지', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'undo', exact: true }).click();
    await save(page);
    const restored = await resource(api, owned.documentId);
    expect(restored.document.blocks[0].slots).toEqual(reordered.document.blocks[0].slots);
    expect(restored.document.blocks[0].props).toEqual(before.document.blocks[0].props);
    await page.reload();
    composition = await selectComposition(page, kind);
    await expect(composition.locator('summary')).toContainText(kind === 'hero' ? '2/2' : '2/3');
    await expect(frame.getByText('검증한 내부 배지', { exact: true })).toBeVisible();
    if (kind === 'imageText') {
      await composition.getByRole('button', { name: '구분선 추가', exact: true }).click();
      composition = await selectComposition(page, kind);
      await expect(composition.getByRole('button', { name: '구분선 추가', exact: true })).toBeDisabled();
      await composition.getByRole('button', { name: '구분선 위로', exact: true }).click();
      await save(page);
      await page.reload();
      composition = await selectComposition(page, kind);
      await expect(composition.locator('summary')).toContainText('3/3');
      expect((await resource(api, owned.documentId)).document.blocks[0].slots!.extra.map((child) => child.type))
        .toEqual(['content.list-01', 'content.divider-01', 'content.badge-01']);
    }
    await page.screenshot({ path: info.outputPath(`${kind}-composition.png`), fullPage: true });
    const current = await resource(api, owned.documentId);
    const preview = await api.post(`${API}/${owned.documentId}/preview`, { data: { expected_lock_version: current.lock_version } });
    expect(preview.ok()).toBe(true);
    const previewUrl = (await preview.json() as { data: { preview_url: string } }).data.preview_url;
    const publication = page.waitForResponse((response) => response.request().method() === 'POST'
      && /\/publications\/[^/]+\/commit$/.test(new URL(response.url()).pathname));
    await page.getByTestId('page-builder-publish').click();
    expect((await publication).ok()).toBe(true);
    for (const url of [previewUrl, `/pages/${owned.slug}`]) {
      await viewer.goto(url);
      await expect(viewer.getByText('검증한 내부 배지', { exact: true })).toBeVisible();
      await expect(viewer.getByRole('link', { name: '문의', exact: true })).toHaveAttribute('href', '/contact');
      const renderedOrder = await viewer.locator(`[data-block-type="${kind === 'hero' ? 'hero' : 'image-text'}"] [data-block-id]`).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-block-id')));
      expect(renderedOrder).toEqual(current.document.blocks[0].slots!.extra.map((child) => child.instance_id));
    }
    const publishedState = await resource(api, owned.documentId);
    const invalid = structuredClone(publishedState.document);
    const extra = invalid.blocks[0].slots!.extra;
    extra.push({ ...structuredClone(extra[0]), instance_id: crypto.randomUUID() });
    const rejected = await api.put(`${API}/${owned.documentId}/draft`, { data: {
      expected_lock_version: publishedState.lock_version, document: invalid } });
    expect(rejected.status()).toBe(400);
    expect(await rejected.json()).toMatchObject({ success: false, message: expect.stringContaining('component_slot_limit:'),
      data: { code: 'G7PB_DOCUMENT_INVALID' } });
    expect((await resource(api, owned.documentId)).document).toEqual(publishedState.document);
    await page.getByRole('group', { name: '캔버스 기기 미리보기' }).getByRole('button', { name: '태블릿', exact: true }).click();
    await expect(page.getByTestId('page-builder-editor')).toHaveAttribute('data-editing-mode', 'preview');
    await expect(frame.getByText('검증한 내부 배지', { exact: true })).toBeVisible();
    const readonly = page.getByTestId(kind === 'hero' ? 'hero-composition' : 'image-text-composition').filter({ visible: true });
    if (!await readonly.evaluate((node) => node.hasAttribute('open'))) await readonly.locator('summary').click();
    await expect(readonly.getByRole('button', { name: '배지 삭제', exact: true })).toBeDisabled();
  } finally {
    await viewer.close();
    await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});

for (const kind of ['hero', 'imageText'] as const) test(`${kind} explicitly transfers buttons with atomic undo and persists edited and empty actions`, async ({ page, context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  const viewer = await context.newPage();
  try {
    const initial = await resource(api, owned.documentId);
    const parent = structuredClone(fixtures[kind].blocks[0]);
    const seed = await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: initial.lock_version,
      document: { ...initial.document, schema_version: 'g7-page-builder/v2', shell_mode: 'none', blocks: [parent] } } });
    expect(seed.ok()).toBe(true);
    await page.goto(`/modules/jiwonpapa-page_builder/admin/editor?document=${owned.documentId}`);
    let composition = await selectComposition(page, kind);
    await composition.getByRole('button', { name: '버튼 구역으로 편집', exact: true }).click();
    await expect(composition.getByRole('button', { name: '버튼 편집', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'undo', exact: true }).click();
    await save(page);
    expect((await resource(api, owned.documentId)).document.blocks[0]).toEqual(parent);
    composition = await selectComposition(page, kind);
    await composition.getByRole('button', { name: '버튼 구역으로 편집', exact: true }).click();
    await save(page);
    const transferred = (await resource(api, owned.documentId)).document.blocks[0];
    const prop = kind === 'hero' ? 'primaryCta' : 'primaryLink';
    expect(transferred.props).not.toHaveProperty(prop);
    expect(transferred.slots?.extra).toEqual(parent.slots.extra);
    expect(transferred.slots?.actions[0].props.items).toEqual([{ label: '문의', url: '/contact', variant: 'primary' }]);
    await expect(page.getByRole('textbox', { name: '버튼 연결', exact: true })).toHaveCount(0);
    await expect(composition.getByRole('button', { name: '버튼 추가', exact: true })).toBeDisabled();
    await composition.getByRole('button', { name: '버튼 편집', exact: true }).click();
    await page.locator('[class*="ArrayFieldItem-summary"]').filter({ hasText: '문의' }).click();
    await page.getByRole('textbox', { name: '버튼 문구', exact: true }).fill('편집한 버튼');
    await page.getByRole('textbox', { name: '버튼 연결', exact: true }).fill('/edited-actions');
    const addItem = page.locator('button[class*="ArrayField-addButton"]');
    await addItem.click();
    await addItem.click();
    await expect(addItem).toHaveCount(0);
    await save(page);
    const edited = (await resource(api, owned.documentId)).document.blocks[0];
    expect(edited.slots?.actions[0].props.items).toEqual([
      { label: '편집한 버튼', url: '/edited-actions', variant: 'primary' },
      { label: '버튼 2', url: '/', variant: 'secondary' },
      { label: '버튼 3', url: '/', variant: 'secondary' },
    ]);
    composition = await selectComposition(page, kind);
    await composition.getByRole('button', { name: '버튼 삭제', exact: true }).click();
    await page.getByRole('button', { name: 'undo', exact: true }).click();
    await save(page);
    expect((await resource(api, owned.documentId)).document.blocks[0]).toEqual(edited);
    await page.reload();
    composition = await selectComposition(page, kind);
    const frame = page.frameLocator('#puck-canvas-root iframe');
    const link = frame.getByRole('link', { name: '편집한 버튼', exact: true });
    await expect(link).toBeVisible();
    const editorUrl = page.url();
    await link.click();
    expect(page.url()).toBe(editorUrl);
    await expect(link).toBeVisible();
    await page.screenshot({ path: info.outputPath(`${kind}-actions.png`), fullPage: true });
    const current = await resource(api, owned.documentId);
    const preview = await api.post(`${API}/${owned.documentId}/preview`, { data: { expected_lock_version: current.lock_version } });
    expect(preview.ok()).toBe(true);
    const previewUrl = (await preview.json() as { data: { preview_url: string } }).data.preview_url;
    const publication = page.waitForResponse((response) => response.request().method() === 'POST'
      && /\/publications\/[^/]+\/commit$/.test(new URL(response.url()).pathname));
    await page.getByTestId('page-builder-publish').click();
    expect((await publication).ok()).toBe(true);
    for (const url of [previewUrl, `/pages/${owned.slug}`]) {
      await viewer.goto(url);
      await expect(viewer.getByRole('link', { name: '편집한 버튼', exact: true })).toHaveAttribute('href', '/edited-actions');
      await expect(viewer.getByRole('link', { name: '문의', exact: true })).toHaveCount(0);
      await expect(viewer.getByRole('link', { name: /^버튼 [23]$/ })).toHaveCount(2);
    }
    composition = await selectComposition(page, kind);
    await composition.getByRole('button', { name: '버튼 삭제', exact: true }).click();
    await save(page);
    await page.reload();
    composition = await selectComposition(page, kind);
    await expect(composition.getByRole('button', { name: '버튼 구역으로 편집', exact: true })).toHaveCount(0);
    const empty = await resource(api, owned.documentId);
    expect(empty.document.blocks[0].slots?.actions).toEqual([]);
    expect(empty.document.blocks[0].props).not.toHaveProperty(prop);
    await expect(frame.getByRole('link', { name: '문의', exact: true })).toHaveCount(0);
    const invalid = structuredClone(empty.document);
    invalid.blocks[0].props[prop] = { label: '중복', url: '/duplicate' };
    const rejected = await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: empty.lock_version, document: invalid } });
    expect(rejected.status()).toBe(400);
    expect((await resource(api, owned.documentId)).document).toEqual(empty.document);
    await composition.getByRole('button', { name: '버튼 추가', exact: true }).click();
    composition = await selectComposition(page, kind);
    await expect(composition.getByRole('button', { name: '버튼 편집', exact: true })).toBeVisible();
    await page.getByRole('group', { name: '캔버스 기기 미리보기' }).getByRole('button', { name: '태블릿', exact: true }).click();
    const readonly = page.getByTestId(kind === 'hero' ? 'hero-composition' : 'image-text-composition').filter({ visible: true });
    if (!await readonly.evaluate((node) => node.hasAttribute('open'))) await readonly.locator('summary').click();
    await expect(readonly.getByRole('button', { name: '버튼 삭제', exact: true })).toBeDisabled();
  } finally {
    await viewer.close();
    await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});
