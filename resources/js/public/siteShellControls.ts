/** Module-owned UI for the public G7 state/dispatch contract. Never stores auth in documents. */
export type ShellOptions = Record<'search' | 'account' | 'cart' | 'notifications' | 'theme' | 'locale' | 'currency', boolean>;
export type ShellRecord = Record<string, unknown>;
export type ShellWindow = Window & {
  G7Core?: { state?: { get?: () => unknown; set?: (value: ShellRecord) => unknown; subscribe?: (listener: () => void) => unknown }; dispatch?: (action: ShellRecord) => unknown };
  G7Config?: { settings?: unknown; modules?: unknown; activeModules?: unknown; appConfig?: unknown };
};
const paths: Record<string, string> = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  cart: '<path d="M3 3h2l3 12h11l2-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M9 4H4v16h5m6-12 4 4-4 4m-7-4h11"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  chevron: '<path d="m7 10 5 5 5-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  youtube: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 5 3-5 3z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  facebook: '<path d="M14 22V12h3l1-4h-4V6c0-1 1-2 2-2h2V1h-3c-4 0-5 2-5 5v2H7v4h3v10"/>',
  twitter: '<path d="m4 3 16 18h-4L0 3h4Zm16 0L4 21" transform="translate(2 0) scale(.9 1)"/>',
  github: '<path d="M9 19c-5 2-5-3-7-3m14 6v-4c0-1-.3-2-1-2 4-.5 6-2 6-6a5 5 0 0 0-1-3c.3-1 0-3 0-3s-2-.3-4 1a14 14 0 0 0-8 0C6 4 4 4 4 4s-.3 2 0 3a5 5 0 0 0-1 3c0 4 2 5.5 6 6-.7.5-1 1-1 2v4"/>',
  discord: '<path d="M8 5 5 6 2 17l5 2 1-2m8-12 3 1 3 11-5 2-1-2M7 7a14 14 0 0 1 10 0M7 16a14 14 0 0 0 10 0"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
};
export function shellIcon(name: string): string {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.globe}</svg>`;
}
export function shellRecord(value: unknown): ShellRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ShellRecord : {};
}
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const escape = (value: string): string => value.replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
export function shellSafeUrl(value: unknown): string {
  const url = text(value).trim();
  if (/^\/(?!\/)/u.test(url) && !/[\\\s]/u.test(url)) return url;
  try { return new URL(url).protocol === 'https:' ? new URL(url).href : ''; } catch { return ''; }
}
function paint(node: Element | null, value: string): void { if (node && node.textContent !== value) node.textContent = value; }
let sequence = 0;

/** This exact markup is also used by the editor's non-persistent persona preview. */
export function shellControlsMarkup(options: ShellOptions, english = false): string {
  const t = (ko: string, en: string): string => english ? en : ko;
  const iconButton = (icon: string, label: string, attrs = ''): string => `<button type="button" class="g7pb-shell-icon" aria-label="${label}" title="${label}" ${attrs}>${shellIcon(icon)}</button>`;
  const popover = (key: string, label: string, trigger: string, body: string, attrs = ''): string => {
    const id = `g7pb-shell-${key}-${++sequence}`;
    return `<div class="g7pb-shell-tool" ${attrs}>${trigger.replace('<button ', `<button data-g7pb-shell-toggle="${key}" aria-expanded="false" aria-controls="${id}" `)}<section class="g7pb-shell-popover" id="${id}" aria-label="${label}" data-g7pb-shell-panel="${key}" hidden>${body}</section></div>`;
  };
  let html = '';
  if (options.search) html += popover('search', t('통합 검색', 'Search'), iconButton('search', t('검색 열기', 'Open search')), `<form action="/search" method="get" role="search" class="g7pb-system-search" data-g7pb-system-search-host><label><span>${t('통합 검색', 'Search')}</span><input type="search" name="q" aria-label="${t('통합 검색', 'Search')}" placeholder="${t('검색어를 입력하세요', 'Enter search terms')}" required maxlength="200"></label><button type="submit">${t('검색', 'Search')}</button></form>`);
  if (options.notifications) html += popover('notifications', t('알림', 'Notifications'), iconButton('bell', t('알림', 'Notifications')).replace('</button>', '<span class="g7pb-system-badge" data-g7pb-system-notification-count hidden></span></button>'), `<div class="g7pb-shell-panel-heading"><strong>${t('알림', 'Notifications')}</strong><button type="button" data-g7pb-notifications-read-all>${t('모두 읽음', 'Mark all read')}</button></div><div data-g7pb-notifications-list role="status">${t('알림을 불러옵니다.', 'Loading notifications.')}</div><a class="g7pb-shell-panel-link" href="/mypage/notifications">${t('전체 알림 보기', 'View all notifications')}</a>`, 'data-g7pb-system-member hidden');
  if (options.cart) html += `<a class="g7pb-shell-icon" href="/shop/cart" data-g7pb-system-cart data-g7pb-system-commerce hidden aria-label="${t('장바구니', 'Cart')}" title="${t('장바구니', 'Cart')}">${shellIcon('cart')}<span class="g7pb-system-badge" data-g7pb-system-cart-count hidden></span></a>`;
  if (options.theme || options.locale || options.currency) html += popover('preferences', t('화면 설정', 'Preferences'), iconButton('settings', t('화면 설정', 'Preferences')), `<strong>${t('화면 설정', 'Preferences')}</strong>${options.theme ? `<button type="button" data-g7pb-system-theme>${shellIcon('settings')}<span data-g7pb-theme-label>${t('화면 모드', 'Theme')}</span></button>` : ''}${options.locale ? `<span data-g7pb-system-locale-host data-g7pb-label="${t('언어', 'Language')}"></span>` : ''}${options.currency ? `<span data-g7pb-system-currency-host data-g7pb-label="${t('통화', 'Currency')}"></span>` : ''}`);
  if (options.account) html += popover('account', t('계정', 'Account'), iconButton('user', t('계정 메뉴', 'Account menu'), 'data-g7pb-account-trigger'), `<div data-g7pb-system-guest><strong>${t('환영합니다', 'Welcome')}</strong><p>${t('로그인하고 서비스를 이용하세요.', 'Sign in to access your account.')}</p><a href="/login">${shellIcon('user')}${t('로그인', 'Log in')}</a><a href="/register" data-g7pb-system-register>${t('회원가입', 'Register')}</a></div><div data-g7pb-system-member hidden><strong data-g7pb-account-name></strong><a href="/admin" data-g7pb-system-admin hidden>${shellIcon('shield')}${t('관리자', 'Admin')}</a><a href="/mypage">${shellIcon('user')}${t('마이페이지', 'My page')}</a><a href="/mypage/orders" data-g7pb-system-commerce hidden>${shellIcon('cart')}${t('주문 내역', 'Orders')}</a><a href="/mypage/wishlist" data-g7pb-system-commerce hidden>${t('관심 상품', 'Wishlist')}</a><a href="#g7-action-logout">${shellIcon('logout')}${t('로그아웃', 'Log out')}</a></div><p role="alert" data-g7pb-shell-error hidden></p>`);
  return html;
}

export function mountShellControls(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-shell-options]').forEach((host) => {
    if (host.dataset.g7pbShellMounted) return;
    try {
      const options = shellRecord(JSON.parse(host.dataset.g7pbShellOptions ?? '{}'));
      const normalized = Object.fromEntries(['search', 'account', 'cart', 'notifications', 'theme', 'locale', 'currency'].map((key) => [key, options[key] === true])) as ShellOptions;
      host.innerHTML = shellControlsMarkup(normalized, host.dataset.g7pbShellLocale?.startsWith('en'));
      host.dataset.g7pbShellMounted = 'true';
    } catch { /* Malformed optional controls retain the compiled fallback. */ }
  });
}

export function shellCommerce(state: ShellRecord, config: ShellWindow['G7Config']): boolean {
  return state.commerceAvailable === true || !!shellRecord(config?.modules)['sirsoft-ecommerce'] || !!shellRecord(state.modules)['sirsoft-ecommerce'];
}
export function paintShellProduct(root: ParentNode, state: ShellRecord, config?: ShellWindow['G7Config']): void {
  const user = shellRecord(state.currentUser);
  const member = typeof user.uuid === 'string' && user.uuid !== '';
  const commerce = shellCommerce(state, config);
  root.querySelectorAll<HTMLElement>('[data-g7pb-system-member]').forEach((node) => { node.hidden = !member; });
  root.querySelectorAll<HTMLElement>('[data-g7pb-system-guest]').forEach((node) => { node.hidden = member; });
  for (const [key, value] of [['cart', state.cartCount], ['notification', state.notificationCount]] as const) {
    const count = Math.max(0, Number(value) || 0);
    root.querySelectorAll<HTMLElement>(`[data-g7pb-system-${key}-count]`).forEach((node) => { node.hidden = count === 0; paint(node, count > 99 ? '99+' : String(count)); });
  }
  root.querySelectorAll<HTMLElement>('[data-g7pb-system-admin]').forEach((node) => { node.hidden = !member || user.is_admin !== true; });
  root.querySelectorAll<HTMLElement>('[data-g7pb-system-commerce]').forEach((node) => { node.hidden = !commerce; });
  root.querySelectorAll<HTMLElement>('[data-g7pb-account-name]').forEach((node) => paint(node, text(user.nickname) || text(user.name) || '회원'));
  root.querySelectorAll<HTMLElement>('[data-g7pb-account-trigger]').forEach((node) => {
    const avatar = member ? shellSafeUrl(user.avatar) : '';
    const signature = `${member}:${avatar}`;
    if (node.dataset.g7pbAvatar === signature) return;
    node.dataset.g7pbAvatar = signature;
    node.innerHTML = avatar ? `<img src="${escape(avatar)}" alt="" referrerpolicy="no-referrer">` : shellIcon('user');
    node.classList.toggle('is-member', member);
  });
  const settings = shellRecord(state.settings ?? config?.settings);
  const general = shellRecord(settings.general);
  root.querySelectorAll<HTMLElement>('[data-g7pb-site-info="inherit"] .g7pb-site-brand').forEach((node) => {
    const name = text(general.site_name);
    const logo = node.querySelector('img');
    if (name && logo) logo.alt = name;
    else if (name) paint(node, name);
  });
  root.querySelectorAll<HTMLElement>('[data-g7pb-site-info="inherit"] [data-g7pb-site-description]').forEach((node) => { paint(node, text(general.site_description)); node.hidden = !text(general.site_description); });
  const socials = shellRecord(settings.social);
  root.querySelectorAll<HTMLElement>('[data-g7pb-site-socials]').forEach((host) => {
    const links = ['github', 'twitter', 'discord', 'facebook', 'instagram', 'youtube'].flatMap((name) => {
      const url = shellSafeUrl(socials[name]);
      return url.startsWith('https:') ? [`<a href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${name} (${host.ownerDocument.documentElement.lang.startsWith('en') ? 'new tab' : '새 창'})">${shellIcon(name)}</a>`] : [];
    }).join('');
    if (host.dataset.g7pbSocialSignature !== links) { host.innerHTML = links; host.dataset.g7pbSocialSignature = links; }
    host.hidden = !links;
  });
}

export function shellAuthHeaders(view: Window): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  try { const token = view.localStorage.getItem('auth_token'); if (token) headers.Authorization = `Bearer ${token}`; } catch { /* Session authentication remains available. */ }
  return headers;
}

/** Disclosure panels, not ARIA menus: links and form fields retain their native keyboard behavior. */
const disclosureState = new WeakMap<Document, { key: string; focus: number }>();
export function installShellDisclosures(host: HTMLElement, onOpen?: (key: string) => void, preview = false): () => void {
  const doc = host.ownerDocument;
  const focusable = (panel: HTMLElement): HTMLElement[] => Array.from(panel.querySelectorAll<HTMLElement>('input, a, button, select')).filter((node) => !node.closest('[hidden]'));
  const close = (restore: boolean): void => {
    host.querySelectorAll<HTMLButtonElement>('[data-g7pb-shell-toggle][aria-expanded="true"]').forEach((button) => {
      if (!preview) disclosureState.delete(doc);
      button.setAttribute('aria-expanded', 'false');
      const panel = host.querySelector<HTMLElement>(`[data-g7pb-shell-panel="${button.dataset.g7pbShellToggle}"]`);
      if (panel) panel.hidden = true;
      if (restore) button.focus();
    });
  };
  const openPanel = (key: string, focus = 0, restored = false): void => {
    const button = host.querySelector<HTMLButtonElement>(`[data-g7pb-shell-toggle="${key}"]`);
    const panel = host.querySelector<HTMLElement>(`[data-g7pb-shell-panel="${key}"]`);
    if (!button || !panel || button.closest('[hidden]')) return;
    button.setAttribute('aria-expanded', 'true'); panel.hidden = false;
    // G7 HtmlContent may replace its DOM after any public-state update. Keep the
    // user's open panel/focus, without restarting the entry animation each time.
    if (restored) panel.style.animation = 'none';
    if (!preview) disclosureState.set(doc, { key, focus });
    const controls = focusable(panel);
    (controls[focus] ?? controls[0])?.focus();
    onOpen?.(key);
  };
  const click = (event: Event): void => {
    if (!host.isConnected) return;
    const target = event.target as Element;
    if (!host.contains(target)) { close(false); return; }
    const button = target.closest<HTMLButtonElement>('[data-g7pb-shell-toggle]');
    if (preview && target.closest('a')) event.preventDefault();
    if (!button) {
      if (!preview && target.closest('a:not([href="#g7-action-logout"])')) close(false);
      return;
    }
    event.preventDefault();
    const open = button.getAttribute('aria-expanded') !== 'true';
    close(false);
    if (!open) return;
    const key = button.dataset.g7pbShellToggle ?? '';
    openPanel(key);
  };
  const keydown = (event: KeyboardEvent): void => { if (host.isConnected && event.key === 'Escape' && host.contains(doc.activeElement)) { event.preventDefault(); close(true); } };
  const focus = (event: FocusEvent): void => {
    if (!host.isConnected) return;
    if (!host.contains(event.target as Node)) { close(false); return; }
    const target = event.target as HTMLElement;
    const panel = target.closest<HTMLElement>('[data-g7pb-shell-panel]');
    if (!preview && panel && !panel.hidden) disclosureState.set(doc, { key: panel.dataset.g7pbShellPanel!, focus: Math.max(0, focusable(panel).indexOf(target)) });
  };
  const submit = (event: Event): void => { if (preview) event.preventDefault(); };
  doc.addEventListener('click', click); doc.addEventListener('keydown', keydown); doc.addEventListener('focusin', focus); host.addEventListener('submit', submit);
  const previous = !preview ? disclosureState.get(doc) : undefined;
  if (previous) openPanel(previous.key, previous.focus, true);
  return () => { doc.removeEventListener('click', click); doc.removeEventListener('keydown', keydown); doc.removeEventListener('focusin', focus); host.removeEventListener('submit', submit); };
}

export async function loadShellNotifications(host: HTMLElement, view: Window, fetcher: typeof fetch = fetch, markAll = false): Promise<void> {
  const list = host.querySelector<HTMLElement>('[data-g7pb-notifications-list]');
  const readAll = host.querySelector<HTMLButtonElement>('[data-g7pb-notifications-read-all]');
  if (!list || list.dataset.loading === 'true') return;
  list.dataset.loading = 'true';
  if (readAll) readAll.disabled = true;
  const english = host.ownerDocument.documentElement.lang.startsWith('en');
  paint(list, english ? 'Loading notifications…' : '알림을 불러오는 중입니다.');
  try {
    const headers = shellAuthHeaders(view);
    if (markAll) {
      const marked = await fetcher('/api/user/notifications/read-all', { method: 'POST', credentials: 'same-origin', headers });
      if (!marked.ok) throw new Error('read failed');
      host.dispatchEvent(new CustomEvent('g7pb:notifications-read', { bubbles: true }));
    }
    const response = await fetcher('/api/user/notifications?per_page=5', { credentials: 'same-origin', headers });
    if (!response.ok) throw new Error('load failed');
    const payload = shellRecord(await response.json());
    const nested = shellRecord(payload.data);
    const items = Array.isArray(payload.data) ? payload.data : Array.isArray(nested.data) ? nested.data : [];
    list.replaceChildren();
    for (const raw of items.slice(0, 5)) {
      const item = shellRecord(raw);
      const link = host.ownerDocument.createElement('a');
      link.href = shellSafeUrl(item.url) || '/mypage/notifications';
      link.className = 'g7pb-shell-notification';
      const title = host.ownerDocument.createElement('strong');
      title.textContent = text(item.subject) || (english ? 'Notification' : '알림');
      const time = host.ownerDocument.createElement('small'); time.textContent = text(item.created_at);
      link.append(title, time); list.append(link);
    }
    if (!items.length) paint(list, english ? 'No notifications yet.' : '새 알림이 없습니다.');
    if (markAll) host.querySelectorAll<HTMLElement>('[data-g7pb-system-notification-count]').forEach((node) => { node.hidden = true; });
  } catch { paint(list, english ? 'Unable to load notifications. Please try again.' : '알림을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); }
  finally { delete list.dataset.loading; if (readAll) readAll.disabled = false; }
}
