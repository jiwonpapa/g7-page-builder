import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootMobileNavigation, installMobileNavigation } from '../../resources/js/public/mobileNavigation';
import { installShellDisclosures, mountMobileShell, paintShellProduct, shellControlsMarkup, type ShellOptions } from '../../resources/js/public/siteShellControls';

const all: ShellOptions = { search: true, account: true, cart: true, notifications: true, theme: true, locale: true, currency: true };
const fixture = (): { toggle: HTMLElement; menu: HTMLElement; backdrop: HTMLElement } => {
  document.body.innerHTML = `<header><div id="tools">${shellControlsMarkup(all)}<button data-g7pb-menu-toggle>메뉴</button></div><button data-g7pb-menu-backdrop hidden>닫기</button><section id="menu" aria-label="전체 메뉴" data-g7pb-mobile-menu data-g7pb-menu-style="drawer-right" hidden><button data-g7pb-menu-close>닫기</button><div data-g7pb-mobile-account></div><button data-g7pb-submenu-toggle aria-controls="sub" aria-expanded="false" aria-label="서비스 하위 메뉴 열기">하위 메뉴</button><ul id="sub" hidden><li><a href="/about">소개</a></li></ul><div data-g7pb-mobile-settings></div></section></header><main><button id="outside">본문</button></main>`;
  const menu = document.querySelector<HTMLElement>('#menu')!;
  mountMobileShell(menu, all); paintShellProduct(menu, {});
  return { toggle: document.querySelector<HTMLElement>('[data-g7pb-menu-toggle]')!, menu, backdrop: document.querySelector<HTMLElement>('[data-g7pb-menu-backdrop]')! };
};
let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); dispose = undefined; document.body.innerHTML = ''; bootMobileNavigation(document); vi.restoreAllMocks(); });
describe('shared mobile navigation contract', () => {
  it('keeps native account routes, explicit administrator authority, and hidden commerce', () => {
    const { menu } = fixture();
    expect(menu.querySelectorAll('[data-g7pb-shell-toggle]')).toHaveLength(0);
    paintShellProduct(menu, { currentUser: { uuid: 'member', name: '<test>', is_admin: 'true' } });
    expect(menu.querySelector('[data-g7pb-account-name]')?.textContent).toBe('<test>');
    expect(menu.querySelector<HTMLElement>('[data-g7pb-system-admin]')?.hidden).toBe(true);
    expect(menu.querySelector<HTMLElement>('[data-g7pb-system-commerce]')?.hidden).toBe(true);
    paintShellProduct(menu, { currentUser: { uuid: 'admin', is_admin: true } });
    expect(menu.querySelector<HTMLElement>('[data-g7pb-system-admin]')?.hidden).toBe(false);
    expect(menu.querySelector('[data-g7pb-mobile-settings] [href="#g7-action-logout"]')).not.toBeNull();
  });
  it('contains focus including select controls and restores existing inert state on close', () => {
    const elements = fixture();
    elements.menu.insertAdjacentHTML('beforeend', '<select><option>언어</option></select>');
    const existing = document.createElement('aside'); existing.inert = true; document.body.append(existing);
    dispose = installMobileNavigation(elements); elements.toggle.click();
    expect(document.querySelector<HTMLElement>('main')!.inert).toBe(true);
    expect(elements.menu.getAttribute('aria-modal')).toBe('true');
    elements.menu.querySelector('select')!.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(elements.menu.querySelector('button'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(elements.menu.hidden).toBe(true); expect(document.activeElement).toBe(elements.toggle);
    expect(document.querySelector<HTMLElement>('main')!.inert).not.toBe(true); expect(existing.inert).toBe(true);
  });
  it('coordinates disclosures and navigation, preserves logout error space, closes on browser navigation', () => {
    const elements = fixture();
    const cleanup = installShellDisclosures(document.querySelector<HTMLElement>('#tools')!);
    dispose = installMobileNavigation(elements);
    const search = document.querySelector<HTMLElement>('[data-g7pb-shell-toggle="search"]')!;
    search.click(); elements.toggle.click();
    expect(search.getAttribute('aria-expanded')).toBe('false');
    elements.menu.querySelector<HTMLElement>('[href="#g7-action-logout"]')!.click();
    expect(elements.menu.hidden).toBe(false);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(elements.menu.hidden).toBe(true); cleanup();
  });
  it('restores open submenu, scroll and focus after HtmlContent replacement without duplicate listeners', () => {
    const width = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    const { toggle, menu } = fixture(); bootMobileNavigation(document); toggle.click();
    menu.querySelector<HTMLElement>('[data-g7pb-submenu-toggle]')!.click();
    menu.scrollTop = 120; menu.dispatchEvent(new Event('scroll')); menu.querySelector<HTMLElement>('#sub a')!.focus();
    const header = document.querySelector('header')!; header.replaceWith(header.cloneNode(true));
    bootMobileNavigation(document);
    const next = document.querySelector<HTMLElement>('#menu')!;
    expect(next.hidden).toBe(false); expect(next.querySelector<HTMLElement>('#sub')!.hidden).toBe(false);
    expect(next.scrollTop).toBe(120); expect(document.activeElement?.textContent).toBe('소개');
    window.dispatchEvent(new Event('resize')); expect(next.hidden).toBe(false);
    width.mockReturnValue(844);
    window.dispatchEvent(new Event('resize')); expect(next.hidden).toBe(true);
    expect(document.documentElement.classList.contains('g7pb-menu-open')).toBe(false);
  });
  it('keeps legacy dropdown nonmodal and closes it when focus moves outside', () => {
    const elements = fixture(); elements.menu.dataset.g7pbMenuStyle = 'dropdown';
    dispose = installMobileNavigation(elements); elements.toggle.click();
    expect(elements.menu.hasAttribute('aria-modal')).toBe(false); expect(elements.backdrop.hidden).toBe(true);
    document.querySelector<HTMLElement>('#outside')!.focus(); expect(elements.menu.hidden).toBe(true);
  });
});
