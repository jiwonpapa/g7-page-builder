import { expect, test } from '@playwright/test';
import {
  authenticateEditorInteractionAdmin, cleanupOwnedEditorInteractionDocument,
  createOwnedEditorInteractionDocument, editorInteractionApi,
} from './support/editorInteractionFixture';

const EDITOR = '/modules/jiwonpapa-page_builder/admin/editor';

test('inspector choices stay compact, keyboard editable and persistent after undo and reopen', async ({ context, page }, info) => {
  const token = await authenticateEditorInteractionAdmin(context);
  const api = await editorInteractionApi(token);
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  try {
    await page.goto(`${EDITOR}?document=${owned.documentId}`);
    await expect(page.getByTestId('page-builder-editor')).toBeVisible();
    await page.getByTestId('page-builder-design-color-mode').getByRole('radio', { name: '라이트', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('page-builder-design-color-mode').getByRole('radio', { name: '다크', exact: true })).toBeChecked();
    await page.getByTestId('page-builder-design-radius').getByRole('radio', { name: '둥글게', exact: true }).check();
    const frame = page.frameLocator('#puck-canvas-root iframe');
    const heading = frame.locator('[data-g7pb-inline-field="heading"] [contenteditable="true"]').first();
    await expect(heading).toHaveCSS('font-family', /system-ui/);
    await page.screenshot({ path: info.outputPath('page-inspector.png') });
    await heading.click();
    const level = page.getByTestId('page-builder-preset-level').filter({ visible: true });
    await level.getByRole('radio', { name: 'H3', exact: true }).check();
    await page.getByTestId('page-builder-preset-spacing').getByRole('radio', { name: '넓게', exact: true }).check();
    await page.getByTestId('page-builder-block-vertical-align').filter({ visible: true }).getByRole('radio', { name: '아래', exact: true }).check();
    await expect(page.getByRole('combobox', { name: '블록 콘텐츠 폭', exact: true })).toBeVisible();
    await expect(page.getByRole('combobox', { name: '블록 높이', exact: true })).toBeVisible();
    const mobile = page.getByTestId('page-builder-responsive-mobile-section').filter({ visible: true });
    await expect(mobile).not.toHaveAttribute('open');
    await expect(mobile.locator('summary')).toContainText('공통 설정 사용');
    await mobile.locator('summary').click();
    await mobile.getByTestId('page-builder-responsive-mobile-spacing').selectOption('compact');
    await expect(mobile.locator('summary')).toContainText('1개 별도 지정');
    await mobile.locator('summary').click();
    await expect(mobile.locator('summary')).toContainText('1개 별도 지정');
    // Select controls must remain usable at the real narrow inspector width.
    for (const field of [level, page.getByTestId('page-builder-block-vertical-align').filter({ visible: true })]) {
      expect(await field.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: info.outputPath('block-inspector.png') });
    const undo = page.getByRole('button', { name: /되돌리기|Undo/i }).first();
    await undo.click();
    await heading.click();
    await expect(mobile.locator('summary')).toContainText('공통 설정 사용');
    await page.getByRole('button', { name: /다시 실행|Redo/i }).first().click();
    await heading.click();
    await expect(mobile.locator('summary')).toContainText('1개 별도 지정');
    const saved = page.waitForResponse((response) => response.request().method() === 'PUT' && new URL(response.url()).pathname.endsWith('/draft'));
    await page.getByTestId('page-builder-save').click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
    await page.reload();
    await expect(page.getByTestId('page-builder-design-radius').getByRole('radio', { name: '둥글게', exact: true })).toBeChecked();
    await heading.click();
    await expect(level.getByRole('radio', { name: 'H3', exact: true })).toBeChecked();
    await expect(page.getByTestId('page-builder-block-vertical-align').filter({ visible: true }).getByRole('radio', { name: '아래', exact: true })).toBeChecked();
    await expect(mobile.locator('summary')).toContainText('1개 별도 지정');
  } finally {
    await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});

