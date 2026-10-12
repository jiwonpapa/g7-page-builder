import { devices, expect, test } from '@playwright/test';
import type { DocumentV3 } from '../../resources/js/documents/v3/types';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

test.use({ isMobile: false, hasTouch: false, userAgent: devices['Desktop Chrome'].userAgent });
const documents = '/api/modules/jiwonpapa-page_builder/admin/documents';
const editor = '/modules/jiwonpapa-page_builder/admin/editor';

test('creates an empty page in the installed generic editor and preserves nested edits through authenticated save and reload', async ({ page, context }, testInfo) => {
  const token = await authenticateEditorInteractionAdmin(context), api = await editorInteractionApi(token);
  const slug = `g7pb-product-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let ownedId: string | undefined;
  const click = (name: string) => page.getByRole('button', { name, exact: true }).click();
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const loadedScripts: string[] = [];
    page.on('request', request => { if (request.resourceType() === 'script') loadedScripts.push(request.url()); });
    await page.goto(`${editor}?editor=structure`);
    await expect(page.getByTestId('structure-document-host')).toBeVisible();
    await page.getByLabel('페이지 제목', { exact: true }).fill('블록 없는 공통 요소 편집');
    await page.getByLabel('기본 주소 이름', { exact: true }).fill(slug);
    await page.getByLabel('페이지 출력 방식', { exact: true }).selectOption('none');
    const creating = page.waitForResponse(response => response.url().endsWith(documents) && response.request().method() === 'POST');
    await click('빈 페이지 만들기');
    const createdResponse = await creating;
    expect(createdResponse.ok(), await createdResponse.text()).toBe(true);
    const created = (await createdResponse.json()).data;
    ownedId = created.document.document_id;
    expect(created.document.schema_version).toBe('g7-page-builder/v3');
    expect(created.document.blocks).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`document=${ownedId}&editor=structure$`));
    await testInfo.attach('owned-document', { body: JSON.stringify({ documentId: ownedId, slug }), contentType: 'application/json' });
    await expect(page.getByRole('main', { name: '독립 구조 편집기' })).toBeVisible();
    expect(loadedScripts.some(url => url.includes('/page-builder-structure.iife.js'))).toBe(true);
    expect(loadedScripts.some(url => url.includes('/page-builder-editor.iife.js'))).toBe(false);
    await click('컨테이너 삽입');
    const layers = page.getByTestId(/^layer-/);
    await expect(layers).toHaveCount(1);
    const containerId = (await layers.first().getAttribute('data-testid'))!.slice('layer-'.length);
    await page.getByLabel('삽입 위치', { exact: true }).selectOption(containerId);
    await click('제목 삽입'); await expect(layers).toHaveCount(2);
    const headingId = (await layers.last().getAttribute('data-testid'))!.slice('layer-'.length);
    await click('실행 취소'); await expect(layers).toHaveCount(1);
    await click('다시 실행'); await expect(layers).toHaveCount(2);
    await page.getByTestId('layer-' + headingId).click();
    await click('본문 입력');
    const content = page.frameLocator('iframe').locator(`[data-v3-node="${headingId}"]`);
    await content.locator('[contenteditable]').click();
    const text = content.locator('.tiptap[contenteditable="true"]');
    await expect(text).toBeVisible(); await text.click(); await text.press('ControlOrMeta+A');
    await page.keyboard.insertText('등록 없이 만든 한글 제목');
    await expect(text).toHaveText('등록 없이 만든 한글 제목');
    await click('구조 선택');
    const saveResponse = page.waitForResponse(response => response.url().endsWith(`${documents}/${ownedId}/draft`) && response.request().method() === 'PUT');
    await click('저장');
    const response = await saveResponse; expect(response.ok(), await response.text()).toBe(true);
    const saved = (await response.json()).data;
    const source = saved.document as DocumentV3;
    expect(source.blocks).toHaveLength(1);
    const heading = source.blocks[0].slots.content?.[0];
    expect(heading?.instance_id).toBe(headingId);
    expect(heading?.type).toBe('content.heading');
    expect(JSON.stringify(heading?.props)).toContain('등록 없이 만든 한글 제목');
    await expect(page.getByTestId('structure-document-status')).toHaveText('초안 저장됨');
    await page.reload();
    await expect(page.getByTestId('layer-' + headingId)).toBeVisible();
    await expect(page.frameLocator('iframe').locator(`[data-v3-node="${headingId}"]`)).toHaveText('등록 없이 만든 한글 제목');
    for (const [label, width] of [['PC · 공통값', 1280], ['태블릿', 768], ['모바일', 360]] as const) {
      await click(label); await click('화면 맞춤');
      await expect(page.locator('[data-v3-workspace]')).toHaveCSS('width', width + 'px');
      await testInfo.attach(`product-canvas-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    const reopened = await api.get(`${documents}/${ownedId}`);
    expect(reopened.ok()).toBe(true);
    expect((await reopened.json()).data.document).toEqual(source);
    await testInfo.attach('ui-created-canonical-source', { body: JSON.stringify(source), contentType: 'application/json' });
    // The old bookmark must dispatch from authenticated source version, not auto-convert.
    await page.goto(`${editor}?document=${ownedId}`);
    await expect(page).toHaveURL(new RegExp(`document=${ownedId}&editor=structure$`));
    await expect(page.getByTestId('layer-' + headingId)).toBeVisible();
  } finally {
    try {
      if (ownedId) {
        const current = (await (await api.get(`${documents}/${ownedId}`)).json()).data;
        expect(current.document.slug).toBe(slug); expect(current.document.document_id).toBe(ownedId);
        const archived = await api.post(`${documents}/${ownedId}/archive`, { data: { expected_lock_version: current.lock_version } });
        expect(archived.ok(), await archived.text()).toBe(true);
        await testInfo.attach('owned-document-archived', { body: await archived.body(), contentType: 'application/json' });
      }
    } finally { await api.dispose(); }
  }
});
