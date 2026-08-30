import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootG7SystemControls, bootServiceActions, renderG7SystemControls } from '../../resources/js/public/pageEffects';
import { installShellDisclosures, loadShellNotifications, mountShellControls, paintShellProduct, shellControlsMarkup, shellSafeUrl, type ShellOptions } from '../../resources/js/public/siteShellControls';

const options: ShellOptions = { search: true, account: true, cart: true, notifications: true, theme: true, locale: true, currency: true };
function fixture(): { doc: Document; host: HTMLElement } {
  const doc = document.implementation.createHTMLDocument('Site Shell'); doc.documentElement.lang = 'ko';
  const host = doc.createElement('nav'); host.className = 'g7pb-system-controls'; host.dataset.g7pbSystemControls = ''; host.dataset.g7pbShellOptions = JSON.stringify(options); doc.body.append(host);
  mountShellControls(doc);
  return { doc, host };
}
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); document.body.replaceChildren(); });

describe('Site Shell product release gate', () => {
  it('restores disclosure and keyboard focus after a G7 HtmlContent DOM replacement', () => {
    const first = document.importNode(fixture().host, true); document.body.append(first);
    const dispose = installShellDisclosures(first);
    first.querySelector<HTMLButtonElement>('[data-g7pb-shell-toggle="search"]')!.click();
    const replacement = document.importNode(fixture().host, true);
    first.replaceWith(replacement); dispose();
    const disposeReplacement = installShellDisclosures(replacement);
    expect(replacement.querySelector<HTMLElement>('[data-g7pb-shell-panel="search"]')?.hidden).toBe(false);
    expect(document.activeElement).toBe(replacement.querySelector('input'));
    document.body.click();
    expect(replacement.querySelector<HTMLElement>('[data-g7pb-shell-panel="search"]')?.hidden).toBe(true);
    disposeReplacement();
  });
  it('enforces guest/member/admin transitions without exposing admin to truthy strings', () => {
    const { doc, host } = fixture();
    const state: Record<string, unknown> = { currentUser: null };
    const view = { G7Core: { state: { get: () => state } }, localStorage: window.localStorage } as never;
    renderG7SystemControls(doc, view);
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-admin]')?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-guest]')?.hidden).toBe(false);
    state.currentUser = { uuid: 'member', name: '<script>member</script>', is_admin: 'true' };
    renderG7SystemControls(doc, view);
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-admin]')?.hidden).toBe(true);
    expect(host.querySelector('[data-g7pb-account-name]')?.textContent).toBe('<script>member</script>');
    expect(host.querySelector('script')).toBeNull();
    state.currentUser = { uuid: 'admin', name: '관리자', is_admin: true };
    state.commerceAvailable = true; state.notificationCount = 103;
    renderG7SystemControls(doc, view);
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-admin]')?.hidden).toBe(false);
    expect(host.querySelector('[data-g7pb-system-admin]')?.getAttribute('href')).toBe('/admin');
    expect(host.querySelector('[data-g7pb-system-notification-count]')?.textContent).toBe('99+');
    state.currentUser = null;
    renderG7SystemControls(doc, view);
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-admin]')?.hidden).toBe(true);
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-member]')?.hidden).toBe(true);
  });

  it('preserves mounted DOM, typed search and selection across state mutations', () => {
    const { doc, host } = fixture();
    const view = { G7Core: { state: { get: () => ({}) } }, localStorage } as never;
    const input = host.querySelector<HTMLInputElement>('input')!;
    input.value = '입력 중';
    renderG7SystemControls(doc, view); renderG7SystemControls(doc, view);
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('입력 중');
    expect(input.closest('.g7pb-visually-hidden')).toBeNull();
    expect(host.querySelectorAll('form')).toHaveLength(1);
    expect(host.querySelector('form form')).toBeNull();
  });

  it('uses pointer and Escape disclosures, closes outside, and cleans up listeners', () => {
    const doc = document; const host = doc.importNode(fixture().host, true); doc.body.append(host);
    const opened = vi.fn(); const dispose = installShellDisclosures(host, opened);
    const toggle = host.querySelector<HTMLButtonElement>('[data-g7pb-shell-toggle="search"]')!;
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(doc.activeElement).toBe(host.querySelector('input'));
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(doc.activeElement).toBe(toggle);
    toggle.click(); doc.body.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    dispose(); toggle.click();
    expect(opened).toHaveBeenCalledTimes(2);
  });

  it('hides unavailable commerce and preserves authored footer text while safely inheriting site metadata', () => {
    const { doc, host } = fixture();
    doc.body.insertAdjacentHTML('beforeend', '<footer data-g7pb-site-info="inherit"><a class="g7pb-site-brand">기본</a><p data-g7pb-site-description></p><nav data-g7pb-site-socials></nav><p>사용자 사업자 정보</p></footer><footer><a class="g7pb-site-brand">사용자 브랜드</a></footer>');
    paintShellProduct(doc, { settings: { general: { site_name: '실제 사이트', site_description: '운영 중인 사이트' }, social: { youtube: 'https://youtube.com/@example', github: 'javascript:alert(1)', instagram: '//evil.test' } } });
    expect(host.querySelector<HTMLElement>('[data-g7pb-system-cart]')?.hidden).toBe(true);
    expect(doc.querySelector('[data-g7pb-site-info] .g7pb-site-brand')?.textContent).toBe('실제 사이트');
    expect(doc.body.textContent).toContain('사용자 사업자 정보'); expect(doc.body.textContent).toContain('사용자 브랜드');
    expect(doc.querySelectorAll('[data-g7pb-site-socials] a')).toHaveLength(1);
    expect(doc.querySelector('[data-g7pb-site-socials] svg')).not.toBeNull();
    expect(shellSafeUrl('javascript:alert(1)')).toBe(''); expect(shellSafeUrl('https://safe.test')).toBe('https://safe.test/');
  });

  it('loads notification data safely and reports failure instead of silently failing', async () => {
    const { host } = fixture();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ subject: '<img onerror=bad>', created_at: '2026-08-30', url: 'javascript:alert(1)' }] }), { status: 200 }));
    await loadShellNotifications(host, window, fetcher);
    expect(host.querySelector('[data-g7pb-notifications-list] strong')?.textContent).toBe('<img onerror=bad>');
    expect(host.querySelector('[data-g7pb-notifications-list] img')).toBeNull();
    expect(host.querySelector('[data-g7pb-notifications-list] a')?.getAttribute('href')).toBe('/mypage/notifications');
    fetcher.mockResolvedValue(new Response('', { status: 500 }));
    await loadShellNotifications(host, window, fetcher, true);
    expect(host.querySelector('[data-g7pb-notifications-list]')?.textContent).toContain('불러오지 못했습니다');
    expect(host.querySelector<HTMLButtonElement>('[data-g7pb-notifications-read-all]')?.disabled).toBe(false);
  });

  it('dispatches native G7 logout once, without issuing a second REST logout', async () => {
    const { doc, host } = fixture(); const dispatch = vi.fn().mockResolvedValue(undefined); const fetcher = vi.fn();
    bootServiceActions(doc, { G7Core: { dispatch } } as never, fetcher);
    const link = host.querySelector<HTMLAnchorElement>('a[href="#g7-action-logout"]')!;
    link.click(); link.click(); await Promise.resolve(); await Promise.resolve();
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({ handler: 'logout' }); expect(fetcher).not.toHaveBeenCalled();
  });

  it('retains the login on failed fallback logout and offers actionable feedback', async () => {
    const { doc, host } = fixture(); const fetcher = vi.fn().mockRejectedValue(new Error('offline')); const navigate = vi.fn();
    localStorage.setItem('auth_token', 'test-token');
    bootServiceActions(doc, window, fetcher, navigate);
    host.querySelector<HTMLAnchorElement>('a[href="#g7-action-logout"]')!.click();
    await vi.waitFor(() => expect(host.querySelector('[role="alert"]')?.textContent).toContain('로그아웃하지 못했습니다'));
    expect(localStorage.getItem('auth_token')).toBe('test-token'); expect(navigate).not.toHaveBeenCalled();
  });

  it('subscribes once even when boot repeats and supports enabled option subsets', () => {
    const { doc } = fixture(); const subscribe = vi.fn();
    const view = { G7Core: { state: { get: () => ({}), subscribe } }, localStorage } as never;
    bootG7SystemControls(doc, view); bootG7SystemControls(doc, view);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const html = shellControlsMarkup({ ...options, account: false, search: false, notifications: false }, true);
    expect(html).not.toContain('/login'); expect(html).not.toContain('role="search"'); expect(html).toContain('Preferences');
  });
});
