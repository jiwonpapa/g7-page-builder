import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { authenticateEditorInteractionAdmin, cleanupOwnedEditorInteractionDocument, createOwnedEditorInteractionDocument, editorInteractionApi } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin/documents';
async function resource(api: APIRequestContext, id: string) {
  const response = await api.get(`${API}/${id}`); expect(response.ok()).toBe(true);
  return (await response.json() as { data: { document: PageBuilderDocument; lock_version: number } }).data;
}
async function selectCard(page: Page) {
  const row = page.locator('[data-puck-layer-tree-id] button').filter({ hasText: /^카드$/ }).filter({ visible: true });
  if (!await row.isVisible()) await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
  await row.click();
  const panel = page.getByTestId('card-composition').filter({ visible: true });
  if (!await panel.evaluate((node) => node.hasAttribute('open'))) await panel.locator('summary').click();
  return panel;
}
async function save(page: Page) {
  await page.getByTestId('page-builder-save').click();
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}
function cardIn(doc: PageBuilderDocument): PageBuilderBlock {
  const walk = (blocks: PageBuilderBlock[]): PageBuilderBlock | undefined => {
    for (const block of blocks) { if (block.type === 'content.card-01') return block; const child = walk(Object.values(block.slots ?? {}).flat()); if (child) return child; }
  };
  const card = walk(doc.blocks); if (!card) throw new Error('Missing Card'); return card;
}
for (const nested of [false, true]) test(`Card UI insertion ${nested ? 'in Columns' : 'at root'} and internal editing survives undo reopen and publication`, async ({ page, context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  const viewer = await context.newPage();
  try {
    const initial = await resource(api, owned.documentId);
    const columnId = crypto.randomUUID();
    const blocks: PageBuilderBlock[] = nested ? [{ instance_id: crypto.randomUUID(), type: 'layout.section-01', block_version: 1,
      props: { width: 'standard', spacing: 'compact' }, slots: { content: [{ instance_id: columnId, type: 'layout.columns-01', block_version: 1,
        props: { columns: 1, ratio: '1', gap: 'compact' }, slots: { column1: [] } }] } }] : [];
    expect((await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: initial.lock_version,
      document: { ...initial.document, schema_version: 'g7-page-builder/v2', shell_mode: 'none', blocks } } })).ok()).toBe(true);
    await page.goto(`/modules/jiwonpapa-page_builder/admin/editor?document=${owned.documentId}`);
    if (nested) {
      await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
      await page.getByRole('button', { name: 'Expand', exact: true }).click();
      await page.locator(`[data-puck-layer-tree-id="${columnId}"]`).getByRole('button', { name: 'Columns · 1/2/3열', exact: true }).click();
    }
    await page.getByTestId('page-builder-add-block').click();
    await page.getByRole('button', { name: '모든 제작 단위와 변형 보기', exact: true }).click();
    await page.getByRole('textbox', { name: '블록 검색', exact: true }).fill('content.card-01');
    await page.getByTestId('page-builder-block-gallery').getByTestId('page-builder-block-option-card').click();
    let panel = await selectCard(page);
    for (const label of ['이미지', '제목', '본문', '아이콘', '목록', '배지', '구분선', '버튼']) {
      await panel.getByRole('button', { name: `${label} 추가`, exact: true }).click();
      panel = await selectCard(page);
      await expect(panel.getByRole('button', { name: `${label} 추가`, exact: true })).toBeDisabled();
    }
    await expect(panel.locator('summary')).toContainText('8/8');
    await panel.getByRole('button', { name: '이미지 편집', exact: true }).click();
    await page.getByRole('textbox', { name: '이미지 URL', exact: true }).filter({ visible: true }).fill('/modules/jiwonpapa-page_builder/block-packs/jiwonpapa/builtin-core/0.16.0/thumbnails/generated/block-46-icon.png');
    await page.getByLabel('대체 텍스트', { exact: true }).filter({ visible: true }).fill('카드 이미지 저장 검증');
    panel = await selectCard(page);
    await panel.getByRole('button', { name: '배지 편집', exact: true }).click();
    await page.getByLabel('문구 (40자 이내)', { exact: true }).filter({ visible: true }).fill('카드 내부 저장 검증');
    panel = await selectCard(page);
    await panel.getByRole('button', { name: '배지 위로', exact: true }).click();
    panel = await selectCard(page);
    await save(page);
    const before = cardIn((await resource(api, owned.documentId)).document);
    expect(before.slots!.body.map((b) => b.type)).toEqual(['content.heading-01', 'content.rich-text-01', 'content.icon-01', 'content.badge-01', 'content.list-01', 'content.divider-01']);
    await panel.getByRole('button', { name: '배지 삭제', exact: true }).click();
    await page.getByRole('button', { name: 'undo', exact: true }).click();
    await save(page);
    expect(cardIn((await resource(api, owned.documentId)).document)).toEqual(before);
    await page.reload(); panel = await selectCard(page);
    await expect(panel.locator('summary')).toContainText('8/8');
    const frame = page.frameLocator('#puck-canvas-root iframe');
    await expect(frame.getByText('카드 내부 저장 검증', { exact: true })).toBeVisible();
    const url = page.url(); const link = frame.locator('[data-card-slot="actions"] a').first();
    await link.click(); expect(page.url()).toBe(url);
    await expect(frame.locator('[data-card-slot="body"]')).toBeVisible();
    panel = await selectCard(page);
    await page.screenshot({ path: info.outputPath('card-composition.png'), fullPage: true });
    const current = await resource(api, owned.documentId);
    const preview = await api.post(`${API}/${owned.documentId}/preview`, { data: { expected_lock_version: current.lock_version } });
    expect(preview.ok()).toBe(true);
    const previewUrl = (await preview.json() as { data: { preview_url: string } }).data.preview_url;
    const published = page.waitForResponse((response) => response.request().method() === 'POST' && /\/publications\/[^/]+\/commit$/.test(new URL(response.url()).pathname));
    await page.getByTestId('page-builder-publish').click(); expect((await published).ok()).toBe(true);
    for (const address of [previewUrl, `/pages/${owned.slug}`]) {
      await viewer.goto(address); await expect(viewer.getByText('카드 내부 저장 검증', { exact: true })).toBeVisible();
      await expect(viewer.locator('.g7pb-single-card a a')).toHaveCount(0);
      await expect(viewer.locator('[data-card-slot="actions"] a').first()).toHaveAttribute('href', before.slots!.actions[0].props.items && Array.isArray(before.slots!.actions[0].props.items) ? String((before.slots!.actions[0].props.items[0] as { url: string }).url) : '/');
      expect(await viewer.locator('.g7pb-single-card').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    const latest = await resource(api, owned.documentId);
    const forged = structuredClone(latest.document); const card = cardIn(forged); const child = structuredClone(card.slots!.body[0]); child.instance_id = crypto.randomUUID(); card.slots!.body.push(child);
    const rejected = await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: latest.lock_version, document: forged } });
    expect(rejected.status()).toBe(400);
    expect((await rejected.json()).message).toContain('component_slot_limit:');
    await page.getByTestId('page-builder-viewport-tablet').click();
    panel = await selectCard(page);
    await expect(panel.getByRole('button', { name: '배지 삭제', exact: true })).toBeDisabled();
  } finally { await viewer.close(); await cleanupOwnedEditorInteractionDocument(api, owned); await api.dispose(); }
});
