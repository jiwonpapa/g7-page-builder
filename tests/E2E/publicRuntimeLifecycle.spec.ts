import { readFileSync } from 'node:fs';
import { expect, test, type Page, type Request, type Route } from '@playwright/test';

const BASE_URL = process.env.G7PB_BASE_URL ?? 'https://g7pb.test';
const FIXTURE_PATH = '/__g7pb-public-runtime-contract';
const DATA_PATH = '/api/__g7pb-public-runtime/posts';
const INQUIRY_PATH = '/pages/__g7pb-public-runtime-contract/inquiries';
type ApiResponse = { status?: number; json: unknown };
type ApiHandlers = Record<string, (request: Request) => ApiResponse | Promise<ApiResponse>>;

/** Synthetic DOM/services, actual shipped bundle and native user actions.
 * No compiler, existing document, account service or catalog content is changed.
 * Reading dist here keeps --list independent of build/runtime availability.
 */
async function withPublicFixture(
  page: Page,
  markup: string,
  handlers: ApiHandlers,
  exercise: (requests: Request[]) => Promise<void>,
  hostStyles = '',
): Promise<void> {
  const css = readFileSync('dist/css/page-builder-public.css', 'utf8');
  const js = readFileSync('dist/js/page-effects.iife.js', 'utf8');
  const requests: Request[] = [];
  const unexpected: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const document = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="csrf-token" content="synthetic-csrf"><title>Public runtime code contract</title>${hostStyles}<link rel="stylesheet" href="${FIXTURE_PATH}.css"><script defer src="${FIXTURE_PATH}.js"></script></head><body>${markup}</body></html>`;
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}${url.search}`;
    if (url.origin === new URL(BASE_URL).origin) {
      if (key === `GET ${FIXTURE_PATH}`) return route.fulfill({ contentType: 'text/html', body: document });
      if (key === `GET ${FIXTURE_PATH}.css`) return route.fulfill({ contentType: 'text/css', body: css });
      if (key === `GET ${FIXTURE_PATH}.js`) return route.fulfill({ contentType: 'application/javascript', body: js });
      if (key === 'GET /favicon.ico') return route.fulfill({ status: 204, body: '' });
      const handler = handlers[key];
      if (handler) {
        requests.push(request);
        return route.fulfill(await handler(request));
      }
    }
    unexpected.push(`${request.method()} ${request.url()}`);
    return route.abort('blockedbyclient');
  });
  try {
    await page.goto(FIXTURE_PATH);
    await expect(page.locator('html')).toHaveAttribute('data-g7pb-effects-observer-ready', 'true');
    await exercise(requests);
  } finally {
    // Keep interception installed until Playwright disposes this page, so a
    // late request cannot escape to a real service during fixture teardown.
    expect.soft(unexpected, 'Only explicitly owned fixture routes are allowed').toEqual([]);
    expect.soft(pageErrors, 'The shipped public bundle must not throw').toEqual([]);
  }
}

test('loads synthetic public data and filters the loaded rows without another request', async ({ page }) => {
  const markup = `<main class="g7pb-page"><section data-g7pb-data-source="post-archive" data-g7pb-endpoint="${DATA_PATH}" data-g7pb-audience="all" data-g7pb-page-size="2" data-g7pb-empty-message="No matching fixture rows">
    <label>Search rows<input type="search" data-g7pb-archive-search></label>
    <label>Board<select data-g7pb-archive-filter></select></label>
    <p role="status" data-g7pb-data-status></p><div data-g7pb-data-list aria-busy="true"></div>
    <nav data-g7pb-pagination><button data-g7pb-page-prev>Previous</button><span data-g7pb-page-status></span><button data-g7pb-page-next>Next</button></nav>
  </section></main>`;
  await withPublicFixture(page, markup, {
    [`GET ${DATA_PATH}`]: () => ({ json: { success: true, data: [
      { id: 'one', board_slug: 'alpha', board_name: 'Alpha', title: 'First <b>literal</b>' },
      { id: 'two', board_slug: 'beta', board_name: 'Beta', title: 'Second row' },
      { id: 'three', board_slug: 'alpha', board_name: 'Alpha', title: 'Third row' },
    ] } }),
  }, async (requests) => {
    const archive = page.locator('[data-g7pb-data-source]');
    await expect(archive).toHaveAttribute('data-g7pb-data-ready', 'true');
    await expect(archive.locator('[data-g7pb-data-list]')).toHaveAttribute('aria-busy', 'false');
    await expect(archive.locator('article')).toHaveCount(3);
    await expect(archive.locator('article:visible')).toHaveCount(2);
    await expect(archive.locator('article strong').first()).toHaveText('First <b>literal</b>');
    await expect(archive.locator('article strong b')).toHaveCount(0);
    await expect(archive.locator('article a').first()).toHaveAttribute('href', '/board/alpha/one');
    // Initial in-flight deduplication is a separate unit lifecycle contract.
    // Only settled local filtering/pagination is asserted here.
    const loadedRequests = requests.length;
    expect(loadedRequests).toBeGreaterThan(0);
    await archive.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(archive.locator('[data-g7pb-page-status]')).toHaveText('2 / 2');
    await expect(archive.locator('article:visible strong')).toHaveText('Third row');
    await archive.getByRole('button', { name: 'Previous', exact: true }).click();
    await expect(archive.locator('[data-g7pb-page-status]')).toHaveText('1 / 2');
    const board = archive.getByRole('combobox', { name: 'Board', exact: true });
    await expect(board).toHaveCount(1);
    await board.selectOption('Beta');
    await expect(archive.locator('article:visible strong')).toHaveText('Second row');
    await archive.getByLabel('Search rows', { exact: true }).fill('absent');
    await expect(archive.locator('article:visible')).toHaveCount(0);
    await expect(archive.getByRole('status')).toHaveText('No matching fixture rows');
    await archive.getByLabel('Search rows', { exact: true }).fill('');
    await expect(board).toHaveCount(1);
    await board.selectOption('');
    await expect(archive.locator('article:visible')).toHaveCount(2);
    expect(requests).toHaveLength(loadedRequests);
  });
});

function inquiryHost(id: string, label: string): string {
  return `<section data-block-id="${id}"><div data-g7pb-inquiry-host data-g7pb-inquiry-form data-g7pb-form-action="${INQUIRY_PATH}" data-g7pb-success-message="Fixture accepted" aria-label="${label}">
    <span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="block_instance_id"></span>
    <span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="started_at"></span>
    <label>Name<span data-g7pb-form-control="input" data-g7pb-control-name="name" data-g7pb-control-required=""></span></label>
    <label>Message<span data-g7pb-form-control="textarea" data-g7pb-control-name="message" data-g7pb-control-required=""></span></label>
    <span data-g7pb-form-control="button" data-g7pb-control-type="submit">Send</span>
    <p role="status" data-g7pb-form-status></p>
  </div></section>`;
}

test('hydrates typed public controls and submits only the active inquiry form', async ({ page }) => {
  const firstId = '00000000-0000-4000-8000-000000000901';
  const secondId = '00000000-0000-4000-8000-000000000902';
  const markup = `<main class="g7pb-page">
    <div data-g7pb-tabs data-block-id="fixture-tabs"><div role="tablist" aria-label="Fixture tabs"><button role="tab">First</button><button role="tab">Second</button></div><div role="tabpanel">Panel one</div><div role="tabpanel">Panel two</div></div>
    <div data-g7pb-accordion data-g7pb-accordion-behavior="single"><div data-g7pb-accordion-item><span role="button" tabindex="0" data-g7pb-accordion-trigger>Open first</span><div data-g7pb-accordion-panel>First answer</div></div><div data-g7pb-accordion-item><span role="button" tabindex="0" data-g7pb-accordion-trigger>Open second</span><div data-g7pb-accordion-panel>Second answer</div></div></div>
    ${inquiryHost(firstId, 'First inquiry')}${inquiryHost(secondId, 'Second inquiry')}
  </main>`;
  let submissions = 0;
  await withPublicFixture(page, markup, {
    [`POST ${INQUIRY_PATH}`]: () => ++submissions === 1
      ? { status: 503, json: { message: 'Synthetic temporary failure' } }
      : { json: { success: true } },
  }, async (requests) => {
    await expect(page.locator('[data-g7pb-form-control]')).toHaveCount(0);
    const first = page.getByRole('form', { name: 'First inquiry', exact: true });
    const second = page.getByRole('form', { name: 'Second inquiry', exact: true });
    await expect(first).toHaveAttribute('data-g7pb-form-ready', 'true');
    await expect(second).toHaveAttribute('data-g7pb-form-ready', 'true');
    const tabs = page.getByRole('tablist', { name: 'Fixture tabs' });
    await tabs.getByRole('tab', { name: 'First', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Second', exact: true })).toBeFocused();
    await expect(tabs.getByRole('tab', { name: 'Second', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveText('Panel two');
    await page.getByRole('button', { name: 'Open first', exact: true }).click();
    await expect(page.getByText('First answer', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open second', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('First answer', { exact: true })).toBeHidden();
    await expect(page.getByText('Second answer', { exact: true })).toBeVisible();
    await first.getByLabel('Name', { exact: true }).fill('Synthetic A');
    await first.getByLabel('Message', { exact: true }).fill('First message');
    await second.getByLabel('Name', { exact: true }).fill('Untouched B');
    await second.getByLabel('Message', { exact: true }).fill('Other message');
    await first.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(first.getByRole('status')).toHaveText('Synthetic temporary failure');
    await expect(first.getByLabel('Name', { exact: true })).toHaveValue('Synthetic A');
    await expect(first.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    await first.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(first.getByRole('status')).toHaveText('Fixture accepted');
    await expect(first.getByLabel('Name', { exact: true })).toHaveValue('');
    await expect(second.getByLabel('Name', { exact: true })).toHaveValue('Untouched B');
    await expect(second.getByLabel('Message', { exact: true })).toHaveValue('Other message');
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.headers()['x-csrf-token']).toBe('synthetic-csrf');
      const form = await new Response(request.postData(), { headers: { 'Content-Type': request.headers()['content-type'] } }).formData();
      expect(Object.fromEntries(form)).toEqual({
        block_instance_id: firstId, started_at: expect.stringMatching(/^\d+$/u), name: 'Synthetic A', message: 'First message',
      });
    }
  });
});

test('initializes synthetic sliders and motion from the shipped bundle', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const markup = `<main class="g7pb-page">
    <section class="g7pb-block" data-g7pb-motion="counter" data-g7pb-motion-trigger="once"><div class="g7pb-stats__grid"><article><strong>1,200+</strong></article></div></section>
    <section class="g7pb-hero-slider" data-g7pb-slider data-g7pb-slider-loop="false" data-g7pb-slider-autoplay="false">
      <div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track"><article class="g7pb-hero-slider__slide"><div class="g7pb-hero-slider__copy"><h2>Slide one</h2><a href="/unused-first">First action</a></div></article><article class="g7pb-hero-slider__slide"><div class="g7pb-hero-slider__copy"><h2>Slide two</h2><a href="/unused-second">Second action</a></div></article></div></div>
      <div class="g7pb-hero-slider__controls"><div class="g7pb-hero-slider__dots" data-g7pb-slider-dots></div></div><p data-g7pb-slider-status></p>
    </section></main>`;
  await withPublicFixture(page, markup, {}, async (requests) => {
    const counter = page.locator('[data-g7pb-motion="counter"]');
    await expect(counter).toHaveAttribute('data-g7pb-motion-ready', 'true');
    await expect(counter).toHaveClass(/is-inview/u);
    await expect(counter.locator('strong')).toHaveAttribute('aria-label', '1,200+');
    await expect(counter.locator('strong')).toHaveText('1,200+');
    const slider = page.locator('[data-g7pb-slider]');
    const slides = slider.locator('.g7pb-hero-slider__slide');
    await expect(slider).toHaveAttribute('data-g7pb-slider-ready', 'true');
    await expect(slider.locator('[data-g7pb-slider-status]')).toHaveText('1 / 2');
    await expect(slider.locator('[data-g7pb-slider-prev]')).toBeDisabled();
    await expect(slides.nth(1)).toHaveJSProperty('inert', true);
    await slider.locator('[data-g7pb-slider-next]').click();
    await expect(slider.locator('[data-g7pb-slider-status]')).toHaveText('2 / 2');
    await expect(slides.nth(0)).toHaveJSProperty('inert', true);
    await expect(slides.nth(1)).toHaveJSProperty('inert', false);
    await expect(slider.locator('[data-g7pb-slider-next]')).toBeDisabled();
    await slider.locator('[data-g7pb-slider-prev]').click();
    await expect(slider.locator('[data-g7pb-slider-status]')).toHaveText('1 / 2');
    await slider.getByRole('button', { name: '2번 슬라이드', exact: true }).click();
    await expect(slider.locator('[data-g7pb-slider-dot="1"]')).toHaveAttribute('aria-current', 'true');
    await expect(slides.nth(1)).toHaveAttribute('aria-hidden', 'false');
    expect(requests).toEqual([]);
  });
});

test('hydrates synthetic shell controls and keeps service requests explicit', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('auth_token', 'public-contract-token'));
  const options = { search: true, account: true, theme: true, locale: true, currency: false, cart: false, notifications: false };
  const hostStyles = `<style>
    :root { color-scheme: dark; font-family: monospace; }
    body { margin: 13px; color: rgb(7, 19, 31); background: rgb(231, 235, 239); }
    * { box-sizing: content-box; }
    .host-sentinel { width: 100px; padding: 7px; border: 3px solid; }
  </style>`;
  const markup = `<aside class="host-sentinel">Host template sentinel</aside><div hidden data-g7pb-runtime-config='{"commerceAvailable":false}'></div><header><div class="g7pb-system-controls" data-g7pb-system-controls data-g7pb-shell-options='${JSON.stringify(options)}'></div></header><main class="g7pb-page g7pb-document-theme g7pb-theme-mode-light"><h1>Shell contract</h1><section class="g7pb-block g7pb-surface--contrast"><section class="g7pb-block g7pb-surface--default"><p>Default child text</p></section><section class="g7pb-block g7pb-surface--soft"><p>Soft child text</p></section><form class="g7pb-inquiry-form"><footer class="g7pb-inquiry-form__footer"><p>Card status text</p></footer></form></section></main>`;
  await withPublicFixture(page, markup, {
    'GET /api/auth/user': () => ({ json: { data: { uuid: 'public-fixture-member', name: 'Synthetic member', is_admin: false } } }),
    'GET /api/public/locales/active': () => ({ json: { data: { locales: ['ko', 'en'], locale_names: { ko: '한국어', en: 'English' } } } }),
    'GET /api/user/notifications/unread-count': () => ({ json: { data: { count: 0 } } }),
    'POST /api/auth/logout': () => ({ status: 503, json: { message: 'Synthetic unavailable service' } }),
  }, async (requests) => {
    const expectHostUnchanged = async (): Promise<void> => {
      await expect(page.locator('html')).not.toHaveClass(/g7pb-standalone-viewer/);
      await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
      await expect(page.locator('html')).toHaveCSS('font-family', 'monospace');
      await expect(page.locator('body')).toHaveCSS('margin', '13px');
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(231, 235, 239)');
      const sentinel = page.locator('.host-sentinel');
      await expect(sentinel).toHaveCSS('box-sizing', 'content-box');
      await expect(sentinel).toHaveCSS('color', 'rgb(7, 19, 31)');
      expect((await sentinel.boundingBox())?.width).toBe(120);
      await expect(page.locator('.g7pb-page')).toHaveCSS('box-sizing', 'border-box');
      await expect(page.locator('.g7pb-system-controls')).toHaveCSS('box-sizing', 'border-box');
    };
    await expectHostUnchanged();
    // CSS composition fixture: it does not claim LayoutSection accepts appearance props.
    for (const [surface, background] of [['default', 'rgb(255, 255, 255)'], ['soft', 'rgb(243, 241, 237)']]) {
      const child = page.locator(`.g7pb-surface--${surface}`);
      await expect(child).toHaveCSS('background-color', background);
      await expect(child).toHaveCSS('color', 'rgb(23, 32, 51)');
      await expect(child.locator('p')).toHaveCSS('color', 'rgb(82, 96, 113)');
    }
    const card = page.locator('.g7pb-inquiry-form');
    await expect(card).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(card).toHaveCSS('color', 'rgb(23, 32, 51)');
    await expect(card).toHaveCSS('border-top-color', 'rgb(223, 226, 232)');
    await expect(card.getByText('Card status text', { exact: true })).toHaveCSS('color', 'rgb(82, 96, 113)');
    const controls = page.locator('[data-g7pb-system-controls]');
    await expect(controls).toHaveAttribute('data-g7pb-shell-mounted', 'true');
    await controls.locator('[data-g7pb-shell-toggle="account"]').click();
    const account = controls.locator('[data-g7pb-shell-panel="account"]');
    await expect(account.locator('[data-g7pb-account-name]')).toHaveText('Synthetic member');
    await expect(account.getByRole('link', { name: '마이페이지', exact: true })).toBeVisible();
    await expect(account.locator('[data-g7pb-system-guest]')).toBeHidden();
    await expect(account.locator('[data-g7pb-system-admin]')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(controls.locator('[data-g7pb-shell-toggle="account"]')).toBeFocused();
    await controls.locator('[data-g7pb-shell-toggle="preferences"]').click();
    await expect(controls.locator('[data-g7pb-system-locale]')).toBeVisible();
    await expect(controls.locator('[data-g7pb-system-locale] option')).toHaveText(['한국어', 'English']);
    await controls.locator('[data-g7pb-system-theme]').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('Escape');
    await controls.locator('[data-g7pb-shell-toggle="search"]').click();
    const search = controls.getByRole('searchbox');
    await expect(search).toBeFocused();
    await search.fill('Synthetic query');
    await expect(search).toHaveValue('Synthetic query');
    await page.keyboard.press('Escape');
    await controls.locator('[data-g7pb-shell-toggle="account"]').click();
    await account.getByRole('link', { name: '로그아웃', exact: true }).click();
    await expect(account.getByRole('alert')).toContainText('로그아웃하지 못했습니다');
    await expect(account).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBe('public-contract-token');
    await expect(page).toHaveURL(new URL(FIXTURE_PATH, BASE_URL).href);
    const logout = requests.filter((request) => request.method() === 'POST');
    expect(logout).toHaveLength(1);
    expect(new URL(logout[0].url()).pathname).toBe('/api/auth/logout');
    expect(logout[0].headers().authorization).toBe('Bearer public-contract-token');
    await expectHostUnchanged();
  }, hostStyles);
});
