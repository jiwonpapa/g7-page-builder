/** Shared by the published shell and Puck's read-only responsive preview. */
export interface MobileNavigationElements {
  toggle: HTMLElement;
  menu: HTMLElement;
  backdrop?: HTMLElement | null;
  preview?: boolean;
}
interface MenuSnapshot { open: boolean; submenus: number[]; scroll: number; focus: number; url: string }
const snapshots = new WeakMap<Document, MenuSnapshot>();
const mounts = new WeakMap<Document, { menu: HTMLElement; toggle: HTMLElement; backdrop: HTMLElement | null; dispose: (preserveSnapshot?: boolean) => void }>();
const focusables = (menu: HTMLElement): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'))
  .filter((node) => !node.closest('[hidden], [inert]') && menu.ownerDocument.defaultView?.getComputedStyle(node).display !== 'none');

export function installMobileNavigation({ toggle, menu, backdrop, preview = false }: MobileNavigationElements): (preserveSnapshot?: boolean) => void {
  const doc = menu.ownerDocument;
  const view = doc.defaultView!;
  let opened = false;
  let active = true;
  let inertNodes: Array<{ node: HTMLElement; previous: boolean }> = [];
  const submenuButtons = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>('[data-g7pb-submenu-toggle]'));
  const style = (): string => menu.getAttribute(view.innerWidth <= 520 ? 'data-g7pb-mobile-menu-style' : 'data-g7pb-tablet-menu-style') ?? menu.dataset.g7pbMenuStyle ?? 'drawer-right';
  const modal = (): boolean => style() !== 'dropdown';
  const setSubmenu = (button: HTMLElement, open: boolean): void => {
    const submenu = doc.getElementById(button.getAttribute('aria-controls') ?? '');
    if (!submenu) return;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', (button.getAttribute('aria-label') ?? '').replace(open ? '열기' : '닫기', open ? '닫기' : '열기'));
    submenu.hidden = !open;
  };
  const remember = (): void => {
    if (preview || !opened) return;
    snapshots.set(doc, { open: true, submenus: submenuButtons().flatMap((button, index) => button.getAttribute('aria-expanded') === 'true' ? [index] : []), scroll: menu.scrollTop, focus: Math.max(0, focusables(menu).indexOf(doc.activeElement as HTMLElement)), url: view.location.href });
  };
  const unlock = (): void => {
    for (const { node, previous } of inertNodes) { node.inert = previous; delete node.dataset.g7pbMenuInert; }
    inertNodes = [];
    doc.documentElement.classList.remove('g7pb-menu-open');
  };
  const lock = (): void => {
    unlock();
    if (!modal()) return;
    // Inert siblings along the entire ancestor path, never an ancestor of the dialog.
    let branch: HTMLElement = menu;
    while (branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        const node = sibling as HTMLElement;
        if (node === branch || node === backdrop || node.contains(backdrop ?? null) || ['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)) continue;
        inertNodes.push({ node, previous: node.inert }); node.dataset.g7pbMenuInert = node.inert ? 'true' : 'false'; node.inert = true;
      }
      branch = branch.parentElement;
      if (branch === doc.body) break;
    }
    doc.documentElement.classList.add('g7pb-menu-open');
  };
  const close = (restore = false): void => {
    opened = false; menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
    if (backdrop) backdrop.hidden = true;
    submenuButtons().forEach((button) => setSubmenu(button, false));
    unlock();
    if (!preview) snapshots.delete(doc);
    if (restore && toggle.isConnected) toggle.focus();
  };
  const open = (snapshot?: MenuSnapshot): void => {
    doc.dispatchEvent(new CustomEvent('g7pb:shell-open', { detail: 'navigation' }));
    opened = true; menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', '메뉴 닫기');
    menu.setAttribute('role', modal() ? 'dialog' : 'region');
    if (modal()) menu.setAttribute('aria-modal', 'true'); else menu.removeAttribute('aria-modal');
    menu.tabIndex = -1;
    if (backdrop) backdrop.hidden = !modal();
    submenuButtons().forEach((button, index) => setSubmenu(button, snapshot?.submenus.includes(index) ?? false));
    lock();
    (focusables(menu)[snapshot?.focus ?? 0] ?? menu).focus({ preventScroll: true });
    menu.scrollTop = snapshot?.scroll ?? 0;
    remember();
  };
  const onToggle = (event: Event): void => { event.preventDefault(); event.stopPropagation(); if (opened) close(true); else open(); };
  const onClick = (event: Event): void => {
    const target = event.target as Element;
    if (target.closest('[data-g7pb-menu-close]')) { close(true); return; }
    const button = target.closest<HTMLElement>('[data-g7pb-submenu-toggle]');
    if (button) { event.preventDefault(); setSubmenu(button, button.getAttribute('aria-expanded') !== 'true'); remember(); return; }
    const link = target.closest<HTMLAnchorElement>('a');
    if (link && preview) event.preventDefault();
    // Keep logout errors visible in the menu; navigation closes on success.
    if (link && !preview && link.getAttribute('href') !== '#g7-action-logout') close();
  };
  const onOutside = (event: Event): void => { if (opened && !menu.contains(event.target as Node) && !toggle.contains(event.target as Node)) close(false); };
  const onBackdrop = (): void => close(true);
  const onKey = (event: KeyboardEvent): void => {
    if (!opened || !menu.isConnected) return;
    if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
    if (event.key !== 'Tab' || !modal()) return;
    const nodes = focusables(menu); const first = nodes[0]; const last = nodes.at(-1);
    if (!first) { event.preventDefault(); menu.focus(); return; }
    if (event.shiftKey && (doc.activeElement === first || !menu.contains(doc.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (doc.activeElement === last || !menu.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
  };
  const onFocus = (): void => {
    if (!opened || !menu.isConnected) return;
    if (modal() && !menu.contains(doc.activeElement)) (focusables(menu)[0] ?? menu).focus();
    else if (!modal() && !menu.contains(doc.activeElement) && doc.activeElement !== toggle) close();
    remember();
  };
  const onOtherPanel = (event: Event): void => { if ((event as CustomEvent).detail !== 'navigation' && opened) close(); };
  let viewportWidth = view.innerWidth;
  const onResize = (): void => {
    // A soft keyboard/browser toolbar changes height, not the responsive layout.
    if (view.innerWidth === viewportWidth) return;
    viewportWidth = view.innerWidth;
    if (opened) close(view.innerWidth < 900);
  };
  const onNavigate = (): void => close();
  const presentation = new MutationObserver(() => {
    if (!active || !opened) return;
    menu.setAttribute('role', modal() ? 'dialog' : 'region');
    if (modal()) menu.setAttribute('aria-modal', 'true'); else menu.removeAttribute('aria-modal');
    if (backdrop) backdrop.hidden = !modal();
    lock();
  });
  presentation.observe(menu, { attributes: true, attributeFilter: ['data-g7pb-mobile-menu-style', 'data-g7pb-tablet-menu-style'] });
  toggle.addEventListener('click', onToggle); menu.addEventListener('click', onClick); menu.addEventListener('scroll', remember);
  backdrop?.addEventListener('click', onBackdrop);
  doc.addEventListener('keydown', onKey); doc.addEventListener('focusin', onFocus); doc.addEventListener('click', onOutside); doc.addEventListener('g7pb:shell-open', onOtherPanel);
  view.addEventListener('resize', onResize); view.addEventListener('popstate', onNavigate); view.addEventListener('pagehide', onNavigate);
  const previous = preview ? undefined : snapshots.get(doc);
  if (previous?.open && previous.url === view.location.href && view.innerWidth < 900) open(previous); else close();
  return (preserveSnapshot = true) => {
    if (!active) return;
    active = false;
    if (!preserveSnapshot || preview) close();
    else if (menu.isConnected) remember();
    unlock();
    presentation.disconnect();
    toggle.removeEventListener('click', onToggle); menu.removeEventListener('click', onClick); menu.removeEventListener('scroll', remember); backdrop?.removeEventListener('click', onBackdrop);
    doc.removeEventListener('keydown', onKey); doc.removeEventListener('focusin', onFocus); doc.removeEventListener('click', onOutside); doc.removeEventListener('g7pb:shell-open', onOtherPanel);
    view.removeEventListener('resize', onResize); view.removeEventListener('popstate', onNavigate); view.removeEventListener('pagehide', onNavigate);
  };
}

export function bootMobileNavigation(root: Document): void {
  const previous = mounts.get(root);
  const menu = root.querySelector<HTMLElement>('[data-g7pb-mobile-menu]');
  const toggle = root.querySelector<HTMLElement>('[data-g7pb-menu-toggle]');
  const backdrop = root.querySelector<HTMLElement>('[data-g7pb-menu-backdrop]');
  if (previous && previous.menu === menu && previous.toggle === toggle && previous.backdrop === backdrop) return;
  retireMobileNavigation(root, true);
  root.querySelectorAll<HTMLElement>('[data-g7pb-menu-inert]').forEach((node) => { node.inert = node.dataset.g7pbMenuInert === 'true'; delete node.dataset.g7pbMenuInert; });
  if (!toggle || !menu) { snapshots.delete(root); return; }
  mounts.set(root, { menu, toggle, backdrop, dispose: installMobileNavigation({ toggle, menu, backdrop }) });
  toggle.dataset.g7pbMenuReady = 'true';
}

export function disposeMobileNavigation(root: Document): void {
  retireMobileNavigation(root, false); snapshots.delete(root);
}

function retireMobileNavigation(root: Document, preserveSnapshot: boolean): void {
  const previous = mounts.get(root); if (!previous) return;
  mounts.delete(root); previous.dispose(preserveSnapshot); delete previous.toggle.dataset.g7pbMenuReady;
}

export function pruneMobileNavigation(root: Document, records: MutationRecord[]): void {
  const previous = mounts.get(root); if (!previous) return;
  if ([previous.menu, previous.toggle, previous.backdrop].some(target => target !== null &&
    (!root.contains(target) || records.some(record => Array.from(record.removedNodes).some(node => node.contains(target)))))) {
    retireMobileNavigation(root, true);
  }
}
