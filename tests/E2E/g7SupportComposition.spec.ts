import { devices, expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { authenticateEditorInteractionAdmin, editorInteractionApi } from './support/editorInteractionFixture';

const API = '/api/modules/jiwonpapa-page_builder/admin';
test.use({ ...devices['Desktop Chrome'], locale: 'ko-KR' });

test('composes a support page with a real selected G7 board and preserves content during service failures', async ({ page, context, browser }, info) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const slug = `phase4-${Date.now()}-${info.project.name}`; const alias = `/support/${slug}`;
  const boardsResponse = await page.request.get('/api/modules/sirsoft-board/boards?limit=0');
  expect(boardsResponse.ok(), 'The local G7 board capability is required for real acceptance').toBe(true);
  const boards = (await boardsResponse.json()).data as Array<{ slug: string; name: string }>;
  const board = boards[0];
  if (!board || typeof board.slug !== 'string' || typeof board.name !== 'string') throw new Error('A real readable G7 board is required.');
  const endpoint = `/api/modules/sirsoft-board/boards/${encodeURIComponent(board.slug)}/posts?per_page=6&sort_by=id&sort_order=desc`;
  const postsResponse = await page.request.get(endpoint); expect(postsResponse.ok()).toBe(true);
  const posts = (await postsResponse.json()).data.data as Array<{ id: number; title: string }>;
  if (!posts[0] || typeof posts[0].title !== 'string') throw new Error('A real published post is required; synthetic rows cannot satisfy acceptance.');
  const first = posts[0];
  const visitorContext = await browser.newContext({ ...devices['Desktop Chrome'], ignoreHTTPSErrors: true, locale: 'ko-KR' });
  try {
    await page.goto('/modules/jiwonpapa-page_builder/admin');
    await page.getByTestId('page-builder-manager-create').click();
    await page.getByTestId('page-builder-manager-title-input').fill('고객 지원');
    await page.getByTestId('page-builder-manager-slug-input').fill(slug);
    await page.getByTestId('page-builder-manager-create-confirm').click();
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    const id = new URL(page.url()).searchParams.get('document'); if (!id) throw new Error('Missing new document ID.');
    const current = (await (await api.get(`${API}/documents/${id}`)).json()).data;
    const block = (type: string, props: Record<string, unknown>) => ({ instance_id: crypto.randomUUID(), type, block_version: 1, props, slots: {} });
    // Seed only this owned page's informational sections. Board selection is authored in the UI below.
    const seeded = await api.put(`${API}/documents/${id}/draft`, { data: {
      expected_lock_version: current.lock_version,
      document: { ...current.document, schema_version: 'g7-page-builder/v2', shell_mode: 'template', blocks: [
        block('content.heading-01', { eyebrow: 'SUPPORT', heading: '고객 지원', level: 1, anchor: '' }),
        block('content.notice-01', { tone: 'info', title: '이용 안내', body: '<p>서비스 이용 방법과 새로운 소식을 확인해 주세요. 문의는 평일 오전 9시부터 오후 6시까지 안내합니다.</p>', actionLabel: '', actionUrl: '' }),
        block('g7.board-recent-posts-01', { eyebrow: 'NEWS', heading: '게시판 소식', source: 'recent', period: 'week', limit: 6, pageSize: 3, audience: 'all', emptyMessage: '등록된 소식이 없습니다.' }),
      ] },
    } }); expect(seeded.ok()).toBe(true);
    await writeFile(info.outputPath('owned-support-page.json'), JSON.stringify({ id, slug, alias, board, first, endpoint }, null, 2));
    await page.reload();
    const canvas = page.frameLocator('#puck-canvas-root iframe');
    const postsBlock = canvas.locator('[data-block-type="g7-recent-posts"]');
    await postsBlock.click({ position: { x: 8, y: 8 } });
    await page.getByLabel('지정 게시판', { exact: true }).check();
    const picker = page.getByLabel('연결 게시판', { exact: true });
    await expect(picker).toBeEnabled(); await picker.selectOption(board.slug);
    await expect(postsBlock).toContainText(board.slug);
    const saved = page.waitForResponse(r => r.request().method() === 'PUT' && new URL(r.url()).pathname === `${API}/documents/${id}/draft`);
    await page.getByTestId('page-builder-save').click(); expect((await saved).ok()).toBe(true);
    await page.reload(); await postsBlock.click({ position: { x: 8, y: 8 } });
    await expect(picker).toHaveValue(board.slug);
    await page.screenshot({ path: info.outputPath('board-source-editor.png'), fullPage: true });
    const previewEvent = page.waitForEvent('popup'); await page.getByTestId('page-builder-preview-link').click();
    const preview = await previewEvent;
    await expect(preview.locator('[data-g7pb-data-list]')).toContainText(first.title);
    await expect(preview.getByText('이용 안내', { exact: true })).toBeVisible(); await preview.close();
    await page.goto('/modules/jiwonpapa-page_builder/admin');
    await page.getByTestId('page-builder-manager-search').fill(slug);
    const row = page.getByTestId('page-builder-document-row').filter({ hasText: slug });
    await row.getByTestId('page-builder-manager-more').click(); await row.getByTestId('page-builder-manager-settings').click();
    await page.getByTestId('page-builder-path-open').click(); await page.getByTestId('page-builder-path-input').fill(alias);
    await page.getByTestId('page-builder-path-save').click(); await expect(page.getByTestId('page-builder-path-status')).toContainText('발행한 뒤');
    await page.getByRole('button', { name: '취소', exact: true }).click();
    await page.goto(`/modules/jiwonpapa-page_builder/admin/editor?document=${id}`);
    await page.getByTestId('page-builder-publish').click();
    await expect(page.getByTestId('page-builder-publish-status')).toHaveAttribute('data-state', 'published');
    const visitor = await visitorContext.newPage(); const errors: string[] = []; visitor.on('pageerror', error => errors.push(error.message));
    const publicUrl = new URL(alias, page.url()).href;
    for (const width of [1440, 768, 390]) {
      await visitor.setViewportSize({ width, height: 1000 }); await visitor.goto(publicUrl);
      await expect(visitor.locator('[data-g7pb-data-list]')).toContainText(first.title);
      await expect(visitor.getByText('이용 안내', { exact: true })).toBeVisible();
      expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await visitor.screenshot({ path: info.outputPath(`support-${width}.png`), fullPage: true });
    }
    await visitor.locator('[data-g7pb-data-list]').getByRole('link', { name: new RegExp(first.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().click();
    await expect(visitor).toHaveURL(new RegExp(`/board/${board.slug}/${first.id}$`));
    await expect(visitor.getByText(first.title, { exact: true }).first()).toBeVisible();
    await visitor.screenshot({ path: info.outputPath('actual-post-navigation.png'), fullPage: true });
    // Controlled response faults supplement, and never replace, the real API proof above.
    const route = `**/api/modules/sirsoft-board/boards/${board.slug}/posts?*`;
    for (const [status, body, expected] of [
      [200, { success: true, data: { data: [], board: { slug: board.slug } } }, '등록된 소식이 없습니다.'],
      [403, { success: false }, '콘텐츠를 볼 수 있는 권한이 없습니다.'],
      [404, { success: false }, '연결된 콘텐츠를 찾을 수 없습니다.'],
      [500, { success: false }, '콘텐츠를 불러오지 못했습니다.'],
    ] as const) {
      await visitor.route(route, request => request.fulfill({ status, json: body })); await visitor.goto(publicUrl);
      await expect(visitor.locator('[data-g7pb-data-status]')).toContainText(expected);
      await expect(visitor.getByText('이용 안내', { exact: true })).toBeVisible();
      await visitor.screenshot({ path: info.outputPath(`controlled-response-${status}.png`), fullPage: true });
      await visitor.unroute(route);
    }
    await visitor.goto(publicUrl); await expect(visitor.locator('[data-g7pb-data-list]')).toContainText(first.title);
    expect(errors).toEqual([]);
    const restored = (await (await api.get(`${API}/documents/${id}`)).json()).data.document;
    expect(restored.blocks[2].props).toMatchObject({ source: 'board', boardSlug: board.slug });
    // Preserve the owned page and evidence for user review; existing G7 posts are read-only.
  } finally { await visitorContext.close(); await api.dispose(); }
});
