import { asRecord, asText } from './publicValues';
import { disposeShellNotifications, installShellDisclosures, loadShellNotifications, mountShellControls, paintShellProduct, shellAuthHeaders, shellRecord, type ShellWindow } from './siteShellControls';
type G7ShellWindow = ShellWindow;

const standaloneShellStates = new WeakMap<Document, Record<string, unknown>>();

function systemState(view: G7ShellWindow, root: Document): Record<string, unknown> {
  try {
    return asRecord(view.G7Core?.state?.get?.()) ?? standaloneShellStates.get(root) ?? {};
  } catch {
    return {};
  }
}

function storageValue(view: Window, key: string): string {
  try {
    return view.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

const systemSearchQueries = new WeakMap<Document, string>();

function replaceSelectOptions(select: HTMLSelectElement, values: Array<{ value: string; label: string }>, selected: string): void {
  const signature = values.map((value) => `${value.value}:${value.label}`).join('|');
  if (select.dataset.g7pbSystemOptions !== signature) {
    select.replaceChildren(...values.map((value) => new Option(value.label, value.value)));
    select.dataset.g7pbSystemOptions = signature;
  }
  select.value = selected;
}

function ensureG7SystemControlElements(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-system-search-host]').forEach((host) => {
    if (host.matches('form') || host.querySelector('form')) {
      const input = host.querySelector<HTMLInputElement>('input[name="q"]');
      if (input && !input.value && systemSearchQueries.has(root)) input.value = systemSearchQueries.get(root)!;
      return;
    }
    const form = root.createElement('form');
    form.className = 'g7pb-system-search';
    form.action = '/search';
    form.method = 'get';
    form.role = 'search';
    const label = root.createElement('label');
    const labelText = root.createElement('span');
    labelText.className = 'g7pb-visually-hidden';
    labelText.textContent = host.dataset.g7pbLabel || '검색';
    label.append(labelText);
    const input = root.createElement('input');
    input.name = 'q';
    input.type = 'search';
    input.placeholder = host.dataset.g7pbPlaceholder || label.textContent;
    input.value = systemSearchQueries.get(root) ?? '';
    label.append(input);
    const submit = root.createElement('button');
    submit.type = 'submit';
    submit.textContent = host.dataset.g7pbLabel || '검색';
    form.append(label, submit);
    host.append(form);
  });

  const ensureSelect = (hostSelector: string, wrapAttribute: string, selectAttribute: string): void => {
    root.querySelectorAll<HTMLElement>(hostSelector).forEach((host) => {
      if (host.querySelector('select')) return;
      const label = root.createElement('label');
      label.className = 'g7pb-system-select';
      label.setAttribute(wrapAttribute, '');
      label.hidden = true;
      const text = root.createElement('span');
      text.textContent = host.dataset.g7pbLabel || '';
      const select = root.createElement('select');
      select.setAttribute(selectAttribute, '');
      select.setAttribute('aria-label', host.dataset.g7pbLabel || '설정');
      label.append(text, select);
      host.append(label);
    });
  };
  ensureSelect('[data-g7pb-system-locale-host]', 'data-g7pb-system-locale-wrap', 'data-g7pb-system-locale');
  ensureSelect('[data-g7pb-system-currency-host]', 'data-g7pb-system-currency-wrap', 'data-g7pb-system-currency');
}

export function renderG7SystemControls(root: Document = document, view: G7ShellWindow = window as G7ShellWindow): void {
  mountShellControls(root);
  ensureG7SystemControlElements(root);
  const controls = Array.from(root.querySelectorAll<HTMLElement>('[data-g7pb-system-controls]'));
  const state = systemState(view, root);
  paintShellProduct(root, state, view.G7Config);
  if (controls.length === 0) return;
  const user = asRecord(state.currentUser);
  const isMember = typeof user?.uuid === 'string' && user.uuid !== '';
  const cartCount = Math.max(0, Number(state.cartCount) || 0);
  const notificationCount = Math.max(0, Number(state.notificationCount) || 0);
  const shopBase = typeof state.shopBase === 'string' ? state.shopBase.replace(/\/$/u, '') : '/shop';
  const appConfig = asRecord(state.appConfig ?? view.G7Config?.appConfig);
  const locales = Array.isArray(appConfig?.supportedLocales)
    ? appConfig.supportedLocales.filter((locale): locale is string => typeof locale === 'string' && /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(locale))
    : [];
  const localeNames = asRecord(appConfig?.localeNames);
  const currentLocale = storageValue(view, 'g7_locale') || root.documentElement.lang || locales[0] || '';
  const currencies = Array.isArray(state.availableCurrencies)
    ? state.availableCurrencies.map(asRecord).filter((currency): currency is Record<string, unknown> => currency !== null)
    : [];
  const preferredCurrency = typeof state.preferredCurrency === 'string'
    ? state.preferredCurrency
    : storageValue(view, 'g7_preferred_currency') || (typeof state.defaultCurrency === 'string' ? state.defaultCurrency : '');

  controls.forEach((control) => {
    control.querySelectorAll<HTMLElement>('[data-g7pb-system-member]').forEach((item) => { item.hidden = !isMember; });
    control.querySelectorAll<HTMLElement>('[data-g7pb-system-guest]').forEach((item) => { item.hidden = isMember; });
    const cart = control.querySelector<HTMLAnchorElement>('[data-g7pb-system-cart]');
    if (cart) cart.href = `${shopBase || ''}/cart`;

    const paintBadge = (selector: string, count: number): void => {
      const badge = control.querySelector<HTMLElement>(selector);
      if (!badge) return;
      badge.hidden = count <= 0;
      const text = count > 99 ? '99+' : String(count);
      // MutationObserver가 bootPageEffects를 다시 호출하므로 같은 텍스트 노드를
      // 매번 교체하면 microtask가 영구 반복된다. 실제 값이 바뀔 때만 DOM을 갱신한다.
      if (badge.textContent !== text) badge.textContent = text;
    };
    paintBadge('[data-g7pb-system-cart-count]', cartCount);
    paintBadge('[data-g7pb-system-notification-count]', notificationCount);

    const localeWrap = control.querySelector<HTMLElement>('[data-g7pb-system-locale-wrap]');
    const localeSelect = control.querySelector<HTMLSelectElement>('[data-g7pb-system-locale]');
    if (localeWrap && localeSelect) {
      localeWrap.hidden = locales.length < 2;
      replaceSelectOptions(localeSelect, locales.map((locale) => ({
        value: locale,
        label: asText(localeNames?.[locale]) || locale.toUpperCase(),
      })), currentLocale);
    }

    const currencyWrap = control.querySelector<HTMLElement>('[data-g7pb-system-currency-wrap]');
    const currencySelect = control.querySelector<HTMLSelectElement>('[data-g7pb-system-currency]');
    if (currencyWrap && currencySelect) {
      const options = currencies.map((currency) => ({
        value: asText(currency.code),
        label: [asText(currency.symbol), asText(currency.code)].filter(Boolean).join(' '),
      })).filter((currency) => /^[A-Z]{3}$/u.test(currency.value));
      currencyWrap.hidden = options.length < 2;
      replaceSelectOptions(currencySelect, options, preferredCurrency);
    }
  });
}

interface ShellMount { nodes: Element[]; dispose: () => void }
interface ShellRuntime {
  root: Document;
  view: G7ShellWindow;
  core: G7ShellWindow['G7Core'];
  configNode: HTMLElement | null;
  configText: string;
  active: boolean;
  mounts: Map<HTMLElement, ShellMount>;
  observer: MutationObserver;
  cleanups: (() => void)[];
  refresh: number;
  session: string;
  refreshStandalone?: () => Promise<void>;
  sessionChanged?: (reason: 'identity' | 'storage' | 'pageshow') => void;
}
const shellRuntimes = new WeakMap<Document, ShellRuntime>();
function shellNodes(host: HTMLElement): Element[] {
  return Array.from(host.querySelectorAll('[data-g7pb-shell-toggle],[data-g7pb-shell-panel],[data-g7pb-notifications-read-all],[data-g7pb-notifications-list]'));
}
function currentRuntime(runtime: ShellRuntime): boolean {
  return runtime.active && shellRuntimes.get(runtime.root) === runtime
    && runtime.view.G7Core === runtime.core
    && runtime.root.querySelector('[data-g7pb-runtime-config]') === runtime.configNode
    && (runtime.configNode?.dataset.g7pbRuntimeConfig ?? '') === runtime.configText;
}
function pruneShell(runtime: ShellRuntime, records: MutationRecord[]): void {
  for (const [host, mount] of runtime.mounts) {
    const nodes = shellNodes(host);
    if (!runtime.root.contains(host) || !host.isConnected || !host.hasAttribute('data-g7pb-shell-mounted')
      || nodes.length !== mount.nodes.length || nodes.some((node, index) => node !== mount.nodes[index])
      || records.some(record => Array.from(record.removedNodes).some(node => node.contains(host)))) {
      runtime.mounts.delete(host); mount.dispose();
    }
  }
}
function sessionIdentity(runtime: ShellRuntime): string {
  const user = asRecord(systemState(runtime.view, runtime.root).currentUser);
  return typeof user?.uuid === 'string' ? user.uuid : '';
}
function publishSession(runtime: ShellRuntime): void {
  if (!currentRuntime(runtime)) return;
  const identity = sessionIdentity(runtime);
  if (identity === runtime.session) return;
  runtime.session = identity; transitionSession(runtime, 'identity');
}
function transitionSession(runtime: ShellRuntime, reason: 'identity' | 'storage' | 'pageshow'): void {
  if (!currentRuntime(runtime)) return;
  for (const host of runtime.mounts.keys()) disposeShellNotifications(host);
  runtime.sessionChanged?.(reason);
}
export function disposeG7SystemControls(root: Document = document): void {
  const runtime = shellRuntimes.get(root); if (!runtime) return;
  runtime.active = false; runtime.observer.disconnect(); runtime.cleanups.forEach(dispose => dispose());
  for (const mount of runtime.mounts.values()) mount.dispose();
  runtime.mounts.clear(); standaloneShellStates.delete(root); shellRuntimes.delete(root);
  delete root.documentElement.dataset.g7pbSystemControlsReady;
  delete root.documentElement.dataset.g7pbStateSubscribed;
}
function mountDisclosures(runtime: ShellRuntime): void {
  pruneShell(runtime, runtime.observer.takeRecords());
  for (const host of runtime.root.querySelectorAll<HTMLElement>('[data-g7pb-shell-mounted]')) {
    if (runtime.mounts.has(host)) continue;
    const dispose = installShellDisclosures(host, key => {
      if (currentRuntime(runtime) && key === 'notifications') void loadShellNotifications(host, runtime.view);
    });
    const readAll = host.querySelector('[data-g7pb-notifications-read-all]');
    const read = (): void => { if (currentRuntime(runtime)) void loadShellNotifications(host, runtime.view, fetch, true); };
    readAll?.addEventListener('click', read);
    host.dataset.g7pbDisclosuresReady = 'true';
    runtime.mounts.set(host, { nodes: shellNodes(host), dispose: () => {
      dispose(); readAll?.removeEventListener('click', read); disposeShellNotifications(host); delete host.dataset.g7pbDisclosuresReady;
    } });
  }
}
function bootStandalone(runtime: ShellRuntime): void {
  const { root, view, configNode } = runtime;
  if (view.G7Core || !configNode) return;
  let config: Record<string, unknown> = {};
  try { config = shellRecord(JSON.parse(runtime.configText)); } catch { /* Safe empty configuration. */ }
  standaloneShellStates.set(root, config);
  void (async () => {
    try {
      const response = await fetch('/api/public/locales/active', { headers: { Accept: 'application/json' } });
      if (!currentRuntime(runtime) || !response.ok) return;
      const locales = shellRecord(shellRecord(await response.json()).data);
      if (!currentRuntime(runtime)) return;
      config = { ...config, appConfig: { supportedLocales: locales.locales, localeNames: locales.locale_names } };
      standaloneShellStates.set(root, { ...standaloneShellStates.get(root), appConfig: config.appConfig });
      renderG7SystemControls(root, view);
    } catch { /* Optional language capabilities fail closed. */ }
  })();
  const refresh = async (): Promise<void> => {
    if (!currentRuntime(runtime)) return;
    const version = ++runtime.refresh;
    const current = (): boolean => currentRuntime(runtime) && runtime.refresh === version;
    try {
      const response = await fetch('/api/auth/user', { credentials: 'same-origin', headers: shellAuthHeaders(view) });
      if (!current()) return;
      const payload = response.ok ? shellRecord(await response.json()) : {};
      if (!current()) return;
      const currentUser = shellRecord(payload.data);
      standaloneShellStates.set(root, { ...config, currentUser });
      renderG7SystemControls(root, view); publishSession(runtime);
      if (!current()) return;
      if (config.commerceAvailable === true) {
        const headers = shellAuthHeaders(view); const key = storageValue(view, 'g7_cart_key');
        if (key) headers['X-Cart-Key'] = key;
        const cart = await fetch('/api/modules/sirsoft-ecommerce/cart/count', { credentials: 'same-origin', headers });
        if (!current()) return;
        if (cart.ok) {
          const count = shellRecord(shellRecord(await cart.json()).data);
          if (!current()) return;
          standaloneShellStates.set(root, { ...standaloneShellStates.get(root), cartCount: Number(count.count) || 0 });
          renderG7SystemControls(root, view);
        }
      }
      if (!current()) return;
      if (typeof currentUser.uuid === 'string') {
        const unread = await fetch('/api/user/notifications/unread-count', { credentials: 'same-origin', headers: shellAuthHeaders(view) });
        if (!current()) return;
        if (unread.ok) {
          const count = shellRecord(shellRecord(await unread.json()).data);
          if (!current()) return;
          standaloneShellStates.set(root, { ...standaloneShellStates.get(root), notificationCount: Number(count.count ?? count.unread_count) || 0 });
          renderG7SystemControls(root, view);
        }
      }
    } catch { /* Public content remains usable when account services are unavailable. */ }
  };
  runtime.refreshStandalone = refresh;
  void refresh(); renderG7SystemControls(root, view);
}
function installSystemListeners(runtime: ShellRuntime): void {
  const { root, view } = runtime;
  const storage = (event: StorageEvent): void => {
    if (!currentRuntime(runtime) || event.key !== 'auth_token') return;
    transitionSession(runtime, 'storage'); void runtime.refreshStandalone?.();
  };
  const pageshow = (event: PageTransitionEvent): void => {
    if (!currentRuntime(runtime) || !event.persisted) return;
    transitionSession(runtime, 'pageshow'); void runtime.refreshStandalone?.();
  };
  view.addEventListener?.('storage', storage); view.addEventListener?.('pageshow', pageshow);
  runtime.cleanups.push(() => { view.removeEventListener?.('storage', storage); view.removeEventListener?.('pageshow', pageshow); });
  const on = (type: string, listener: (event: Event) => void): void => {
    const guarded = (event: Event): void => { if (currentRuntime(runtime)) listener(event); };
    root.addEventListener(type, guarded); runtime.cleanups.push(() => root.removeEventListener(type, guarded));
  };
  on('g7pb:notifications-read', () => {
    if (view.G7Core?.state?.set) view.G7Core.state.set({ notificationCount: 0 });
    else standaloneShellStates.set(root, { ...systemState(view, root), notificationCount: 0 });
    renderG7SystemControls(root, view);
  });
  on('input', event => {
    const input = event.target as HTMLInputElement | null;
    if (input?.matches('[data-g7pb-system-search-host] input[name="q"]')) systemSearchQueries.set(root, input.value);
  });
  on('click', event => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-g7pb-system-theme]');
    if (!button) return;
    event.preventDefault();
    const current = storageValue(view, 'g7_color_scheme') || 'auto';
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    try {
      if (view.G7Core?.dispatch) void view.G7Core.dispatch({ handler: 'setTheme', target: next });
      else {
        view.localStorage.setItem('g7_color_scheme', next);
        const resolved = next === 'auto' && typeof view.matchMedia === 'function'
          ? (view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : next;
        root.documentElement.dataset.theme = resolved; root.documentElement.classList.toggle('dark', resolved === 'dark');
      }
      const label = button.querySelector('[data-g7pb-theme-label]');
      if (label) label.textContent = next === 'auto' ? '화면 모드: 시스템' : next === 'light' ? '화면 모드: 밝게' : '화면 모드: 어둡게';
    } catch { /* G7 may still be initializing; keep its current template state. */ }
  });
  on('change', event => {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;
    if (select.matches('[data-g7pb-system-locale]') && /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(select.value)) {
      if (view.G7Core?.dispatch) void view.G7Core.dispatch({ handler: 'setLocale', target: select.value });
      else { view.localStorage.setItem('g7_locale', select.value); view.location.reload(); }
    }
    if (select.matches('[data-g7pb-system-currency]') && /^[A-Z]{3}$/u.test(select.value)) {
      if (view.G7Core?.dispatch) void view.G7Core.dispatch({ handler: 'sirsoft-basic.savePreferredCurrency', params: { currencyCode: select.value } });
      else {
        view.localStorage.setItem('g7_preferred_currency', select.value);
        standaloneShellStates.set(root, { ...systemState(view, root), preferredCurrency: select.value }); renderG7SystemControls(root, view);
      }
    }
  });
}
export function bootG7SystemControls(root: Document = document, view: G7ShellWindow = window as G7ShellWindow,
  sessionChanged?: ShellRuntime['sessionChanged']): void {
  let runtime = shellRuntimes.get(root);
  if (runtime && (runtime.view !== view || !currentRuntime(runtime))) { disposeG7SystemControls(root); runtime = undefined; }
  if (!runtime) {
    const observer = new MutationObserver(records => { if (runtime && currentRuntime(runtime)) pruneShell(runtime, records); });
    const configNode = root.querySelector<HTMLElement>('[data-g7pb-runtime-config]');
    runtime = { root, view, core: view.G7Core, configNode, configText: configNode?.dataset.g7pbRuntimeConfig ?? '', active: true,
      mounts: new Map(), cleanups: [], refresh: 0, session: '', observer, sessionChanged };
    shellRuntimes.set(root, runtime); runtime.session = sessionIdentity(runtime);
    observer.observe(root, { childList: true, subtree: true });
    const owner = runtime;
    installSystemListeners(owner);
    if (view.G7Core?.state?.subscribe) {
      const unsubscribe = view.G7Core.state.subscribe(() => {
        if (!currentRuntime(owner)) return;
        renderG7SystemControls(root, view); publishSession(owner);
      });
      if (typeof unsubscribe === 'function') owner.cleanups.push(() => unsubscribe());
      root.documentElement.dataset.g7pbStateSubscribed = 'true';
    }
    bootStandalone(owner); root.documentElement.dataset.g7pbSystemControlsReady = 'true';
  } else if (sessionChanged) runtime.sessionChanged = sessionChanged;
  renderG7SystemControls(root, view); mountDisclosures(runtime);
}
