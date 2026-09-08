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
    const mobileOverride = frame.locator('.g7pb-mobile-appearance-spacing--compact');
    await expect(mobileOverride).toHaveCount(1);
    await undo.click();
    // Observe the restored canvas without another edit between history commands.
    await expect(mobileOverride).toHaveCount(0);
    await page.getByRole('button', { name: /다시 실행|Redo/i }).first().click();
    await expect(mobileOverride).toHaveCount(1);
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


test('rapid page edits preserve toolbar and keyboard undo redo without a recording delay', async ({ context, page }) => {
  const api = await editorInteractionApi(await authenticateEditorInteractionAdmin(context));
  const owned = await createOwnedEditorInteractionDocument(api, 'desktop');
  try {
    await page.goto(`${EDITOR}?document=${owned.documentId}`);
    const colors = page.getByTestId('page-builder-design-color-mode');
    const radius = page.getByTestId('page-builder-design-radius');
    const beforeRadius = await radius.getByRole('radio', { checked: true }).getAttribute('value');
    const dark = colors.getByRole('radio', { name: '다크', exact: true });
    const light = colors.getByRole('radio', { name: '라이트', exact: true });
    const round = radius.getByRole('radio', { name: '둥글게', exact: true });
    const undo = page.getByRole('button', { name: 'undo', exact: true });
    const redo = page.getByRole('button', { name: 'redo', exact: true });
    await page.evaluate(() => {
      let changed = 0;
      document.addEventListener('change', () => { changed = performance.now(); }, true);
      document.addEventListener('click', (event) => {
        const button = event.target instanceof Element ? event.target.closest('button') : null;
        if (changed && button?.getAttribute('aria-label') === 'undo') {
          document.body.dataset.rapidUndoMs = String(performance.now() - changed);
          changed = 0;
        }
      }, true);
    });
    await dark.check();
    await round.check();
    await undo.click();
    const elapsed = await page.locator('body').getAttribute('data-rapid-undo-ms');
    expect(elapsed).not.toBeNull();
    expect(Number(elapsed)).toBeLessThan(250);
    await undo.click();
    await expect(light).toBeChecked();
    expect(await radius.getByRole('radio', { checked: true }).getAttribute('value')).toBe(beforeRadius);
    await redo.click();
    await redo.click();
    await expect(dark).toBeChecked();
    await expect(round).toBeChecked();
    // Global shortcut from toolbar focus, so a text input's own Undo cannot mask the kernel.
    await undo.focus();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(light).toBeChecked();
    await page.keyboard.press('Control+Shift+z');
    await page.keyboard.press('Control+Shift+z');
    await expect(round).toBeChecked();
    await expect(dark).toBeChecked();
    // A new branch must invalidate redo; selecting a panel must not.
    await undo.click();
    await light.check();
    await expect(redo).toBeDisabled();
    await page.getByTestId('page-builder-save').click();
    await expect(page.getByTestId('page-builder-save-status')).toHaveAttribute('data-state', 'saved');
    await page.reload();
    await expect(light).toBeChecked();
    expect(await radius.getByRole('radio', { checked: true }).getAttribute('value')).toBe(beforeRadius);
  } finally {
    await cleanupOwnedEditorInteractionDocument(api, owned);
    await api.dispose();
  }
});
