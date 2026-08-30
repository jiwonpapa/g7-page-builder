import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import AxeBuilder from '@axe-core/playwright';
import { devices, expect, test, type Page } from '@playwright/test';

const compiled = JSON.parse(execFileSync('php', ['scripts/render-site-shell-quality-fixture.php', '--mobile'], { encoding: 'utf8' })) as { mobile: Record<string, string> };
const css = readFileSync('dist/css/page-builder-public.css', 'utf8');
const js = readFileSync('dist/js/page-effects.iife.js', 'utf8');
async function fixture(page: Page, style: string, persona = 'admin'): Promise<void> {
  await page.route('**/__mobile.css', (route) => route.fulfill({ contentType: 'text/css', body: css }));
  await page.route('**/__mobile.js', (route) => route.fulfill({ contentType: 'application/javascript', body: js }));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/user') return route.fulfill({ status: persona === 'unavailable' ? 503 : persona === 'guest' ? 401 : 200, json: { data: persona === 'guest' || persona === 'unavailable' ? {} : { uuid: 'mobile-test', name: '긴 회원 이름도 잘리지 않고 표시되는 계정', is_admin: persona === 'admin' } } });
    if (path === '/api/public/locales/active') return route.fulfill({ json: { data: { locales: ['ko', 'en'], locale_names: { ko: '한국어', en: 'English' } } } });
    if (path === '/api/auth/logout') return route.fulfill({ status: 503, json: { message: 'Test unavailable' } });
    return route.fulfill({ json: { data: { count: 2, unread_count: 3 } } });
  });
  const config = { commerceAvailable: persona !== 'unavailable', availableCurrencies: [{ code: 'KRW', symbol: '₩' }, { code: 'USD', symbol: '$' }], defaultCurrency: 'KRW' };
  await page.route('**/__mobile', (route) => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mobile navigation contract</title><link rel="stylesheet" href="/__mobile.css"><script defer src="/__mobile.js"></script></head><body><div hidden data-g7pb-runtime-config='${JSON.stringify(config)}'></div>${compiled.mobile[style]}<main style="min-height:2000px;padding:24px"><h1>본문</h1><a href="/outside">본문 링크</a></main></body></html>` }));
  await page.goto('/__mobile');
  await expect(page.locator('[data-g7pb-menu-toggle]')).toHaveAttribute('data-g7pb-menu-ready', 'true');
}

for (const style of ['drawer-right', 'drawer-left', 'dropdown', 'sheet-bottom']) {
  test(`mobile navigation · ${style} · width/focus/scroll/semantics`, async ({ page }, info) => {
    const widths = info.project.name === 'desktop' ? [360, 430] : info.project.name === 'tablet' ? [768, 899] : [320, 390];
    await page.setViewportSize({ width: widths[0], height: 844 });
    await fixture(page, style);
    const toggle = page.locator('[data-g7pb-menu-toggle]'); const menu = page.locator('[data-g7pb-mobile-menu]');
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.getByRole('button', { name: '계정 메뉴', exact: true })).toBeHidden();
      const touch = await toggle.boundingBox(); expect(touch?.width).toBeGreaterThanOrEqual(44); expect(touch?.height).toBeGreaterThanOrEqual(44);
      await toggle.click(); await expect(menu).toBeVisible();
      await menu.evaluate(async (node) => { await Promise.all(node.getAnimations().map((animation) => animation.finished)); });
      await expect(menu.getByRole('link', { name: '관리자', exact: true })).toBeVisible();
      await expect(menu).toHaveAttribute('role', style === 'dropdown' ? 'region' : 'dialog');
      const rect = await menu.boundingBox(); expect(rect!.x).toBeGreaterThanOrEqual(-1); expect(rect!.x + rect!.width).toBeLessThanOrEqual(width + 1); expect(rect!.height).toBeLessThanOrEqual(844);
      expect(await page.locator('html').evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      const child = menu.locator('[data-g7pb-submenu-toggle]').first(); await child.click();
      await expect(child).toHaveAttribute('aria-expanded', 'true'); await expect(menu.getByRole('link', { name: '상세 안내 1', exact: true })).toBeVisible();
      if (style !== 'dropdown') {
        expect(await page.locator('main').evaluate((node) => (node as HTMLElement).inert)).toBe(true);
        await menu.getByRole('link', { name: '로그아웃', exact: true }).focus(); await page.keyboard.press('Tab');
        await expect(menu.locator('[data-g7pb-menu-close]')).toBeFocused();
        await page.keyboard.press('Shift+Tab'); await expect(menu.getByRole('link', { name: '로그아웃', exact: true })).toBeFocused();
      }
      await menu.locator('[data-g7pb-menu-close]').focus();
      const accessibility = await new AxeBuilder({ page }).include('[data-g7pb-mobile-menu]').analyze(); expect(accessibility.violations).toEqual([]);
      await page.screenshot({ path: info.outputPath(`${style}-${width}.png`), animations: 'disabled' });
      await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(toggle).toBeFocused();
      expect(await page.locator('main').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
    }
    await toggle.click(); await page.setViewportSize({ width: 900, height: 844 }); await expect(menu).toBeHidden();
    await expect(page.getByRole('button', { name: '계정 메뉴', exact: true })).toBeVisible();
  });
}

for (const persona of ['guest', 'member', 'admin', 'unavailable']) {
  test(`mobile navigation · empty routes · ${persona} · live state and remount`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 }); await fixture(page, 'empty', persona);
    const toggle = page.locator('[data-g7pb-menu-toggle]'); const menu = page.locator('[data-g7pb-mobile-menu]');
    await toggle.click(); await expect(menu).toBeVisible();
    if (persona === 'guest' || persona === 'unavailable') await expect(menu.getByRole('link', { name: '로그인', exact: true })).toBeVisible();
    else await expect(menu.getByRole('link', { name: '마이페이지', exact: true })).toBeVisible();
    if (persona === 'admin') await expect(menu.getByRole('link', { name: '관리자', exact: true })).toHaveAttribute('href', '/admin');
    else await expect(menu.locator('[data-g7pb-system-admin]')).toBeHidden();
    if (persona === 'unavailable') await expect(page.locator('[data-g7pb-system-cart]')).toBeHidden();
    await menu.getByLabel('언어', { exact: true }).focus();
    // Actual compiler output replacement, as G7 HtmlContent does on state updates.
    await page.locator('header').evaluate((header, html) => { header.outerHTML = html; }, compiled.mobile.empty);
    await expect(menu).toBeVisible(); await expect(menu.getByLabel('언어', { exact: true })).toBeFocused();
    if (persona === 'admin' || persona === 'member') {
      await menu.getByRole('link', { name: '로그아웃', exact: true }).click();
      await expect(menu.getByRole('alert')).toContainText('로그아웃하지 못했습니다'); await expect(menu).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath(`empty-${persona}.png`), animations: 'disabled' });
    await page.keyboard.press('Escape'); await expect(toggle).toBeFocused();
    await page.getByRole('button', { name: '검색 열기', exact: true }).click(); await expect(page.getByRole('searchbox')).toBeVisible();
    await toggle.click(); await expect(page.getByRole('searchbox')).toBeHidden();
    await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate'))); await expect(menu).toBeHidden();
    expect(await page.locator('main').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
  });
}

test('WebKit mobile engine · drawer, select, keyboard, reduced motion and close', async ({ playwright }, info) => {
  const browser = await playwright.webkit.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: 'https://g7pb.test', ignoreHTTPSErrors: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await fixture(page, info.project.name === 'tablet' ? 'sheet-bottom' : info.project.name === 'desktop' ? 'drawer-left' : 'drawer-right');
    const toggle = page.locator('[data-g7pb-menu-toggle]'); const menu = page.locator('[data-g7pb-mobile-menu]');
    await toggle.click(); await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute('aria-modal', 'true');
    await menu.getByLabel('통화', { exact: true }).selectOption('USD'); await expect(menu.getByLabel('통화', { exact: true })).toHaveValue('USD');
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
    await page.setViewportSize({ width: 390, height: 500 });
    await expect(menu).toBeVisible();
    await menu.locator('[data-g7pb-menu-close]').focus();
    await page.screenshot({ path: info.outputPath('webkit-mobile.png'), animations: 'disabled' });
    await page.keyboard.press('Escape'); await expect(menu).toBeHidden(); await expect(toggle).toBeFocused();
    expect(await page.locator('main').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
  } finally { await context.close(); await browser.close(); }
});
