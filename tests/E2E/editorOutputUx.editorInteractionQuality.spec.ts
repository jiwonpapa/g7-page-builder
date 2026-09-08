import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { PageBuilderBlock, PageBuilderDocument } from '../../resources/js/documents/types';
import { authenticateEditorInteractionAdmin, cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument, editorInteractionApi } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin/documents';
const EDITOR = '/modules/jiwonpapa-page_builder/admin/editor';
const block = (type: string, props: Record<string, unknown>): PageBuilderBlock =>
  ({ instance_id: crypto.randomUUID(), type, block_version: 1, props, slots: {} });
async function resource(api: APIRequestContext, id: string) {
  const response = await api.get(`${API}/${id}`);
  expect(response.ok()).toBe(true);
  const result = await response.json() as { data: { document: PageBuilderDocument; lock_version: number } };
  return result.data;
}
async function save(page: Page) {
  await page.getByTestId('page-builder-save').click();
  await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
}

test('Hero responsive typography matches canvas, compiled preview and published page after reopen', async ({ page, context }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  const hero = block('content.hero-centered-01', { title: '반응형 편집 확인', body: '<p>본문 보존 확인</p>', alignment: 'center', layout: 'product',
    appearance: { surface: 'default', spacing: 'compact', textAlign: 'center', textScale: 'large' } });
  const viewer = await context.newPage();
  try {
    const initial = await resource(api, owned.documentId);
    expect((await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: initial.lock_version,
      document: { ...initial.document, schema_version: 'g7-page-builder/v2', shell_mode: 'none', blocks: [hero] },
    } })).ok()).toBe(true);
    await page.goto(`${EDITOR}?document=${owned.documentId}`);
    const frame = page.frameLocator('#puck-canvas-root iframe');
    await frame.locator('[data-g7pb-inline-field="title"] [contenteditable="true"]').first().click();
    for (const [device, align, scale] of [['tablet', 'right', 'balanced'], ['mobile', 'left', 'compact']]) {
      const group = page.getByTestId(`page-builder-responsive-${device}-section`).filter({ visible: true });
      await group.locator('summary').click();
      await group.getByTestId(`page-builder-responsive-${device}-textAlign`).selectOption(align);
      await group.getByTestId(`page-builder-responsive-${device}-textScale`).selectOption(scale);
    }
    await save(page);
    await page.reload();
    const saved = await resource(api, owned.documentId);
    expect(saved.document.blocks[0].responsive).toEqual({
      tablet: { appearance: { textAlign: 'right', textScale: 'balanced' } },
      mobile: { appearance: { textAlign: 'left', textScale: 'compact' } },
    });
    const samples: Array<{ width: number; align: string; font: string }> = [];
    for (const [name, width, align, size] of [['PC', 1280, 'center', 18], ['태블릿', 768, 'right', 16], ['모바일', 360, 'left', 15]] as const) {
      await page.getByRole('group', { name: '캔버스 기기 미리보기' }).getByRole('button', { name, exact: true }).click();
      const canvas = frame.locator('.g7pb-preview-hero');
      await expect.soft(canvas).toHaveCSS('text-align', align);
      await expect.soft(canvas).toHaveCSS('font-size', `${size}px`);
      samples.push({ width, align, font: `${size}px` });
      await page.screenshot({ path: info.outputPath(`hero-${width}.png`) });
    }
    const current = await resource(api, owned.documentId);
    const preview = await api.post(`${API}/${owned.documentId}/preview`, { data: { expected_lock_version: current.lock_version } });
    expect(preview.ok()).toBe(true);
    const previewBody = await preview.json() as { data: { preview_url: string } };
    const beforePublish = await resource(api, owned.documentId);
    const published = await api.post(`${API}/${owned.documentId}/publish`, { data: { expected_lock_version: beforePublish.lock_version } });
    expect(published.ok()).toBe(true);
    for (const url of [previewBody.data.preview_url, `/pages/${owned.slug}`]) {
      await viewer.goto(url);
      const rendered = viewer.locator('[data-block-type="hero"]');
      for (const sample of samples) {
        await viewer.setViewportSize({ width: sample.width, height: 1000 });
        await expect(rendered).toHaveCSS('text-align', sample.align);
        await expect(rendered).toHaveCSS('font-size', sample.font);
      }
    }
  } finally {
    await viewer.close();
    await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});

test('slider inspector summaries show text while retaining the original rich title', async ({ page, context }) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  const richTitle = '<strong>혜택</strong> &amp; 안내';
  const slider = block('content.hero-slider-01', { slides: [richTitle, '<em>두 번째</em>'].map((title) => ({
    eyebrow: '', title, body: '<p>본문</p>', buttonLabel: '확인', buttonUrl: '/', imageSrc: '', imageAlt: '',
  })), autoplay: false, interval: 5000, loop: false });
  try {
    const initial = await resource(api, owned.documentId);
    expect((await api.put(`${API}/${owned.documentId}/draft`, { data: { expected_lock_version: initial.lock_version,
      document: { ...initial.document, schema_version: 'g7-page-builder/v2', shell_mode: 'none', blocks: [slider] },
    } })).ok()).toBe(true);
    await page.goto(`${EDITOR}?document=${owned.documentId}`);
    await page.getByRole('navigation').getByText('Outline', { exact: true }).click();
    await page.locator(`[data-puck-layer-tree-id="${slider.instance_id}"]`).locator('button').filter({ hasText: /^슬라이더 히어로$/ }).click();
    const summary = page.locator('[class*="ArrayFieldItem-summary"]').filter({ visible: true });
    await expect(summary.first()).toContainText('혜택 & 안내');
    await expect(summary.first()).not.toContainText('<strong>');
    expect((await resource(api, owned.documentId)).document.blocks[0].props.slides).toEqual(slider.props.slides);
  } finally {
    await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});
