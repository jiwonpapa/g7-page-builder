import { asRecord, asText, safeImageSource, safeLinkSource } from './publicValues';
import { bootDynamicData, publicDataFetcher } from './publicDataRuntime';
export { bootBlockVisibility, bootDynamicData } from './publicDataRuntime';
import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import { bootMobileNavigation } from './mobileNavigation';
import { installShellDisclosures, loadShellNotifications, mountShellControls, paintShellProduct, shellAuthHeaders, shellRecord, type ShellWindow } from './siteShellControls';

type MotionPreset = 'reveal' | 'stagger' | 'parallax-soft' | 'counter' | 'chart-draw';

interface CounterParts {
  prefix: string;
  value: number;
  suffix: string;
  decimals: number;
}

type MotionWindow = Window & {
  IntersectionObserver?: typeof IntersectionObserver;
};

type G7ShellWindow = MotionWindow & ShellWindow & {
  G7Core?: {
    state?: {
      get?: () => unknown;
      subscribe?: (listener: () => void) => (() => void) | void;
    };
    dispatch?: (action: Record<string, unknown>) => Promise<unknown> | unknown;
  };
};

const MOTION_SELECTOR = '.g7pb-block[data-g7pb-motion]';
const SLIDER_SELECTOR = '[data-g7pb-slider]';
const STAGGER_TARGETS = [
  '.g7pb-icon-list__item',
  '.g7pb-features__item',
  '.g7pb-logo-cloud li',
  '.g7pb-stats__grid article',
  '.g7pb-pricing__plan',
  '.g7pb-team__grid article',
  '.g7pb-gallery__grid figure',
  '.g7pb-testimonials__items blockquote',
  '.g7pb-process li',
  '.g7pb-articles__items article',
  '.g7pb-events li',
  '.g7pb-downloads li',
  '.g7pb-board-archive__items article',
  '.g7pb-product-showcase__items article',
  '.g7pb-dynamic-posts article',
  '.g7pb-dynamic-products article',
  '.g7pb-card-grid__item',
  '.g7pb-social-links li',
  '.g7pb-image-carousel__slide',
];

export function parseCounterText(value: string): CounterParts | null {
  const match = value.trim().match(/^(.*?)([-+]?\d[\d,]*(?:\.\d+)?)(.*)$/u);
  if (!match) {
    return null;
  }

  const numeric = Number(match[2].replaceAll(',', ''));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const decimals = match[2].split('.')[1]?.length ?? 0;

  return {
    prefix: match[1],
    value: numeric,
    suffix: match[3],
    decimals,
  };
}

function formatCounter(parts: CounterParts, value: number): string {
  return `${parts.prefix}${value.toLocaleString(undefined, {
    minimumFractionDigits: parts.decimals,
    maximumFractionDigits: parts.decimals,
  })}${parts.suffix}`;
}

function counterDuration(block: HTMLElement): number {
  if (block.dataset.g7pbMotionIntensity === 'subtle') return 650;
  if (block.dataset.g7pbMotionIntensity === 'strong') return 1200;
  return 900;
}

function animateCounter(element: HTMLElement, block: HTMLElement, view: MotionWindow): void {
  const original = element.dataset.g7pbCounterOriginal ?? element.textContent?.trim() ?? '';
  const parts = parseCounterText(original);
  if (!parts) return;

  element.dataset.g7pbCounterOriginal = original;
  element.setAttribute('aria-label', original);
  const startedAt = view.performance.now();
  const duration = counterDuration(block);

  const tick = (now: number): void => {
    if (!block.classList.contains('is-inview')) return;
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatCounter(parts, parts.value * eased);
    if (progress < 1) view.requestAnimationFrame(tick);
  };

  element.textContent = formatCounter(parts, 0);
  view.requestAnimationFrame(tick);
}

function resetCounters(block: HTMLElement): void {
  for (const element of block.querySelectorAll<HTMLElement>('[data-g7pb-counter-original]')) {
    element.textContent = element.dataset.g7pbCounterOriginal ?? element.textContent;
  }
}

function prepareBlock(block: HTMLElement): void {
  const preset = block.dataset.g7pbMotion as MotionPreset | undefined;
  if (preset === 'stagger') {
    const targets = block.querySelectorAll<HTMLElement>(STAGGER_TARGETS.join(','));
    const stagger = Number(block.dataset.g7pbMotionStagger ?? 100);
    targets.forEach((target, index) => {
      target.dataset.g7pbMotionItem = '';
      target.style.setProperty('--g7pb-motion-order', String(index));
      target.style.setProperty('--g7pb-motion-delay', `${index * stagger}ms`);
    });
  }

  if (preset === 'counter') {
    for (const target of block.querySelectorAll<HTMLElement>('.g7pb-stats__grid article > strong')) {
      target.dataset.g7pbCounterOriginal = target.textContent?.trim() ?? '';
    }
  }

  if (preset === 'chart-draw') {
    for (const target of block.querySelectorAll<HTMLElement>('progress')) {
      target.dataset.g7pbMotionItem = '';
    }
  }

  if (preset === 'parallax-soft') {
    const target = block.querySelector<HTMLElement>('img, .g7pb-media-placeholder, figure');
    target?.classList.add('g7pb-motion-parallax-target');
  }
}

function activateBlock(block: HTMLElement, view: MotionWindow): void {
  if (block.classList.contains('is-inview') && block.dataset.g7pbMotionTrigger === 'once') return;
  block.classList.add('is-inview');

  if (block.dataset.g7pbMotion === 'counter') {
    for (const target of block.querySelectorAll<HTMLElement>('[data-g7pb-counter-original]')) {
      animateCounter(target, block, view);
    }
  }
}

function installParallax(blocks: HTMLElement[], view: MotionWindow): void {
  const parallaxBlocks = blocks.filter((block) => block.dataset.g7pbMotion === 'parallax-soft');
  if (parallaxBlocks.length === 0) return;

  let frame = 0;
  const render = (): void => {
    frame = 0;
    const viewportHeight = Math.max(1, view.innerHeight);
    for (const block of parallaxBlocks) {
      const rect = block.getBoundingClientRect();
      const distance = viewportHeight + rect.height;
      const progress = Math.max(-1, Math.min(1, (viewportHeight / 2 - (rect.top + rect.height / 2)) / distance));
      block.style.setProperty('--g7pb-motion-progress', progress.toFixed(4));
    }
  };
  const schedule = (): void => {
    if (frame === 0) frame = view.requestAnimationFrame(render);
  };

  view.addEventListener('scroll', schedule, { passive: true });
  view.addEventListener('resize', schedule, { passive: true });
  schedule();
}

export function bootPageEffects(root: Document = document, view: MotionWindow = window as MotionWindow): void {
  hydrateTemplateRuntime(root);
  ensureSiteShellButtons(root);
  bootG7SystemControls(root, view as G7ShellWindow);
  bootSiteShellMenu(root, view);
  bootServiceActions(root, view);
  bootAccordions(root);
  bootTabs(root);
  const fetcher = publicDataFetcher(root, view);
  bootInquiryForms(root, fetcher);
  void bootDynamicData(root, fetcher);
  const page = root.querySelector<HTMLElement>('.g7pb-page');
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(MOTION_SELECTOR))
    .filter((block) => block.dataset.g7pbMotionReady !== 'true');
  if (!page) return;

  const reducedMotion = typeof view.matchMedia === 'function'
    && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  bootPageSliders(root, reducedMotion);
  if (blocks.length === 0) return;

  if (reducedMotion) {
    page.dataset.g7pbMotionReduced = 'true';
    blocks.forEach((block) => { block.dataset.g7pbMotionReady = 'true'; });
    return;
  }

  blocks.forEach(prepareBlock);
  blocks.forEach((block) => { block.dataset.g7pbMotionReady = 'true'; });
  page.classList.add('g7pb-motion-active');
  installParallax(blocks, view);

  const Observer = view.IntersectionObserver;
  if (typeof Observer !== 'function') {
    blocks.forEach((block) => activateBlock(block, view));
    return;
  }

  const observer = new Observer((entries: IntersectionObserverEntry[]) => {
    for (const entry of entries) {
      const block = entry.target as HTMLElement;
      if (entry.isIntersecting) {
        activateBlock(block, view);
        if (block.dataset.g7pbMotionTrigger !== 'repeat') observer.unobserve(block);
      } else if (block.dataset.g7pbMotionTrigger === 'repeat') {
        block.classList.remove('is-inview');
        resetCounters(block);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });

  blocks.forEach((block) => {
    observer.observe(block);
  });
}

function replaceElement(root: Document, marker: HTMLElement, tag: string): HTMLElement {
  const replacement = root.createElement(tag);
  for (const attribute of marker.attributes) replacement.setAttribute(attribute.name, attribute.value);
  replacement.append(...marker.childNodes);
  marker.replaceWith(replacement);
  return replacement;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ICON_MARKUP_PATTERN = /^(?:<(path|circle|rect)(?: (?:d|fill|cx|cy|r|x|y|width|height|rx|ry)="[-.,0-9A-Za-z ]+")+><\/\1>)+$/;

function hydrateCatalogIcons(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-runtime-icon]').forEach((marker) => {
    const markup = marker.dataset.g7pbIconMarkup ?? '';
    if (!ICON_MARKUP_PATTERN.test(markup)) return;
    const svg = root.createElementNS(SVG_NAMESPACE, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.1');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (marker.className) svg.setAttribute('class', marker.className);
    svg.innerHTML = markup;
    marker.replaceWith(svg);
  });
}

function hydrateEmbeds(root: Document): void {
  const allowedPrefixes: Record<string, string> = {
    'map-openstreetmap': 'https://www.openstreetmap.org/',
    'map-google': 'https://www.google.com/maps',
    'video-youtube': 'https://www.youtube-nocookie.com/embed/',
    'video-vimeo': 'https://player.vimeo.com/video/',
  };
  root.querySelectorAll<HTMLElement>('[data-g7pb-embed]').forEach((marker) => {
    const kind = marker.dataset.g7pbEmbedKind ?? '';
    const src = marker.dataset.g7pbEmbedSrc ?? '';
    if (!src.startsWith(allowedPrefixes[kind] ?? ' ')) return;
    const frame = root.createElement('iframe');
    frame.src = src;
    frame.title = marker.dataset.g7pbEmbedTitle ?? '';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';
    frame.allowFullscreen = kind[0] === 'v';
    marker.replaceWith(frame);
  });
}

function hydrateInquiryHosts(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-inquiry-host]').forEach((host) => {
    const form = replaceElement(root, host, 'form') as HTMLFormElement;
    form.method = 'post';
    form.action = host.dataset.g7pbFormAction ?? '';
    delete form.dataset.g7pbInquiryHost;
  });
}

function hydrateTypedControls(root: Document): void {
  const attributes = ['type', 'name', 'maxlength', 'autocomplete', 'tabindex', 'value', 'rows', 'placeholder', 'required'] as const;
  root.querySelectorAll<HTMLElement>('[data-g7pb-form-control]').forEach((marker) => {
    const tag = marker.dataset.g7pbFormControl;
    if (tag !== 'input' && tag !== 'textarea' && tag !== 'button' && tag !== 'select') return;
    const control = root.createElement(tag);
    for (const name of attributes) {
      const value = marker.getAttribute(`data-g7pb-control-${name}`);
      if (value !== null) control.setAttribute(name, value);
    }
    const controlMarker = marker.dataset.g7pbControlMarker;
    if (controlMarker === 'archive-search') control.dataset.g7pbArchiveSearch = '';
    if (controlMarker === 'archive-filter') {
      control.dataset.g7pbArchiveFilter = '';
      control.append(new Option(marker.textContent ?? '', ''));
    }
    if (tag === 'button') control.replaceChildren(...marker.childNodes);
    marker.replaceWith(control);
  });
}

function hydrateTemplateRuntime(root: Document): void {
  hydrateCatalogIcons(root);
  hydrateEmbeds(root);
  hydrateInquiryHosts(root);
  hydrateTypedControls(root);
}

function ensureSiteShellButtons(root: Document): void {
  root.querySelectorAll<HTMLElement>('[data-g7pb-menu-toggle],[data-g7pb-menu-backdrop],[data-g7pb-menu-close],[data-g7pb-submenu-toggle],[data-g7pb-runtime-button]').forEach((marker) => {
    if (marker instanceof HTMLButtonElement) return;
    const button = replaceElement(root, marker, 'button') as HTMLButtonElement;
    button.type = 'button';
  });
}

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

const shellDisclosureMounts = new WeakMap<Document, Map<HTMLElement, () => void>>();
export function bootG7SystemControls(root: Document = document, view: G7ShellWindow = window as G7ShellWindow): void {
  renderG7SystemControls(root, view);
  const mounts = shellDisclosureMounts.get(root) ?? new Map<HTMLElement, () => void>();
  shellDisclosureMounts.set(root, mounts);
  for (const [host, dispose] of mounts) if (!host.isConnected) { dispose(); mounts.delete(host); }
  root.querySelectorAll<HTMLElement>('[data-g7pb-shell-mounted]').forEach((host) => {
    if (host.dataset.g7pbDisclosuresReady) return;
    mounts.set(host, installShellDisclosures(host, (key) => { if (key === 'notifications') void loadShellNotifications(host, view); }));
    host.querySelector('[data-g7pb-notifications-read-all]')?.addEventListener('click', () => { void loadShellNotifications(host, view, fetch, true); });
    host.dataset.g7pbDisclosuresReady = 'true';
  });
  if (view.G7Core?.state?.subscribe && root.documentElement.dataset.g7pbStateSubscribed !== 'true') {
    view.G7Core.state.subscribe(() => renderG7SystemControls(root, view));
    root.documentElement.dataset.g7pbStateSubscribed = 'true';
  }
  const standaloneConfig = root.querySelector<HTMLElement>('[data-g7pb-runtime-config]');
  if (!view.G7Core && standaloneConfig && !standaloneShellStates.has(root)) {
    let config: Record<string, unknown> = {};
    try { config = shellRecord(JSON.parse(standaloneConfig.dataset.g7pbRuntimeConfig ?? '{}')); } catch { /* Safe empty configuration. */ }
    standaloneShellStates.set(root, config);
    void fetch('/api/public/locales/active', { headers: { Accept: 'application/json' } }).then(async (response) => {
      if (!response.ok) return;
      const locales = shellRecord(shellRecord(await response.json()).data);
      config = { ...config, appConfig: { supportedLocales: locales.locales, localeNames: locales.locale_names } };
      standaloneShellStates.set(root, { ...standaloneShellStates.get(root), appConfig: config.appConfig });
      renderG7SystemControls(root, view);
    }).catch(() => { /* Optional language capabilities fail closed. */ });
    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch('/api/auth/user', { credentials: 'same-origin', headers: shellAuthHeaders(view) });
        const payload = response.ok ? shellRecord(await response.json()) : {};
        const currentUser = shellRecord(payload.data);
        standaloneShellStates.set(root, { ...config, currentUser });
        renderG7SystemControls(root, view);
        if (config.commerceAvailable === true) {
          const headers = shellAuthHeaders(view);
          const key = storageValue(view, 'g7_cart_key');
          if (key) headers['X-Cart-Key'] = key;
          const cart = await fetch('/api/modules/sirsoft-ecommerce/cart/count', { credentials: 'same-origin', headers });
          if (cart.ok) {
            const count = shellRecord(shellRecord(await cart.json()).data);
            standaloneShellStates.set(root, { ...standaloneShellStates.get(root), cartCount: Number(count.count) || 0 });
            renderG7SystemControls(root, view);
          }
        }
        if (typeof currentUser.uuid === 'string') {
          const unread = await fetch('/api/user/notifications/unread-count', { credentials: 'same-origin', headers: shellAuthHeaders(view) });
          if (unread.ok) {
            const count = shellRecord(shellRecord(await unread.json()).data);
            standaloneShellStates.set(root, { ...standaloneShellStates.get(root), notificationCount: Number(count.count ?? count.unread_count) || 0 });
            renderG7SystemControls(root, view);
          }
        }
      } catch { /* Public content remains usable when account services are unavailable. */ }
    };
    void refresh();
    view.addEventListener('storage', (event) => { if (event.key === 'auth_token') void refresh(); });
    view.addEventListener('pageshow', (event) => { if (event.persisted) void refresh(); });
    renderG7SystemControls(root, view);
  }
  if (root.documentElement.dataset.g7pbSystemControlsReady === 'true') return;

  root.addEventListener('g7pb:notifications-read', () => {
    if (view.G7Core?.state?.set) view.G7Core.state.set({ notificationCount: 0 });
    else standaloneShellStates.set(root, { ...systemState(view, root), notificationCount: 0 });
    renderG7SystemControls(root, view);
  });

  root.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement | null;
    if (input?.matches('[data-g7pb-system-search-host] input[name="q"]')) {
      systemSearchQueries.set(root, input.value);
    }
  });

  root.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-g7pb-system-theme]');
    if (!button) return;
    event.preventDefault();
    const current = storageValue(view, 'g7_color_scheme') || 'auto';
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    try {
      if (view.G7Core?.dispatch) {
        void view.G7Core.dispatch({ handler: 'setTheme', target: next });
      } else {
        view.localStorage.setItem('g7_color_scheme', next);
        const resolved = next === 'auto' && typeof view.matchMedia === 'function'
          ? (view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : next;
        root.documentElement.dataset.theme = resolved;
        root.documentElement.classList.toggle('dark', resolved === 'dark');
      }
      const label = button.querySelector('[data-g7pb-theme-label]');
      if (label) label.textContent = next === 'auto' ? '화면 모드: 시스템' : next === 'light' ? '화면 모드: 밝게' : '화면 모드: 어둡게';
    } catch {
      // G7가 초기화되지 않은 순간에는 기존 템플릿 상태를 바꾸지 않습니다.
    }
  });

  root.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;
    if (select.matches('[data-g7pb-system-locale]') && /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(select.value)) {
      if (view.G7Core?.dispatch) void view.G7Core.dispatch({ handler: 'setLocale', target: select.value });
      else { view.localStorage.setItem('g7_locale', select.value); view.location.reload(); }
    }
    if (select.matches('[data-g7pb-system-currency]') && /^[A-Z]{3}$/u.test(select.value)) {
      if (view.G7Core?.dispatch) void view.G7Core.dispatch({
        handler: 'sirsoft-basic.savePreferredCurrency',
        params: { currencyCode: select.value },
      });
      else {
        view.localStorage.setItem('g7_preferred_currency', select.value);
        standaloneShellStates.set(root, { ...systemState(view, root), preferredCurrency: select.value });
        renderG7SystemControls(root, view);
      }
    }
  });

  root.documentElement.dataset.g7pbSystemControlsReady = 'true';
}

export function bootAccordions(root: Document = document): void {
  for (const accordion of root.querySelectorAll<HTMLElement>('[data-g7pb-accordion]')) {
    if (accordion.dataset.g7pbAccordionReady === 'true') continue;
    const items = Array.from(accordion.querySelectorAll<HTMLElement>('[data-g7pb-accordion-item]'));
    const setOpen = (item: HTMLElement, open: boolean): void => {
      item.dataset.g7pbOpen = open ? 'true' : 'false';
      item.querySelector<HTMLElement>('[data-g7pb-accordion-trigger]')?.setAttribute('aria-expanded', open ? 'true' : 'false');
      const panel = item.querySelector<HTMLElement>('[data-g7pb-accordion-panel]');
      if (panel) panel.hidden = !open;
    };
    items.forEach((item) => {
      const trigger = item.querySelector<HTMLElement>('[data-g7pb-accordion-trigger]');
      if (!trigger) return;
      const toggle = (): void => {
        const open = item.dataset.g7pbOpen !== 'true';
        if (open && accordion.dataset.g7pbAccordionBehavior === 'single') {
          items.forEach((sibling) => { if (sibling !== item) setOpen(sibling, false); });
        }
        setOpen(item, open);
      };
      trigger.addEventListener('click', toggle);
      trigger.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggle();
      });
      setOpen(item, item.dataset.g7pbOpen === 'true');
    });
    if (accordion.dataset.g7pbAccordionBehavior === 'single') {
      accordion.addEventListener('toggle', (event) => {
        const item = event.target;
        if (!(item instanceof HTMLDetailsElement) || !item.open) return;
        for (const sibling of accordion.querySelectorAll<HTMLDetailsElement>('details')) {
          if (sibling !== item) sibling.open = false;
        }
      }, true);
    }
    accordion.dataset.g7pbAccordionReady = 'true';
  }
}

export function bootTabs(root: Document = document): void {
  for (const tabsRoot of root.querySelectorAll<HTMLElement>('[data-g7pb-tabs]')) {
    if (tabsRoot.dataset.g7pbTabsReady === 'true') continue;
    const tabs = Array.from(tabsRoot.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = Array.from(tabsRoot.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    if (tabs.length < 2 || tabs.length !== panels.length) continue;
    const blockKey = (tabsRoot.dataset.blockId ?? `tabs-${Array.from(root.querySelectorAll('[data-g7pb-tabs]')).indexOf(tabsRoot)}`)
      .replace(/[^A-Za-z0-9_-]/g, '-');

    const select = (index: number, focus = false): void => {
      const target = Math.min(Math.max(index, 0), tabs.length - 1);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === target;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        tab.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== target; });
      if (focus) tabs[target]?.focus();
    };

    tabs.forEach((tab, index) => {
      const tabId = `g7pb-${blockKey}-tab-${index}`;
      const panelId = `g7pb-${blockKey}-panel-${index}`;
      tab.id = tabId;
      tab.setAttribute('aria-controls', panelId);
      panels[index].id = panelId;
      panels[index].setAttribute('aria-labelledby', tabId);
      tab.addEventListener('click', () => select(index));
      tab.addEventListener('keydown', (event) => {
        let target: number | null = null;
        if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = tabs.length - 1;
        if (target === null) return;
        event.preventDefault();
        select(target, true);
      });
    });
    const configured = Number(tabsRoot.dataset.g7pbTabsInitial ?? 0);
    select(Number.isInteger(configured) ? configured : 0);
    tabsRoot.dataset.g7pbTabsReady = 'true';
  }
}

export function bootInquiryForms(root: Document = document, fetcher: typeof fetch = fetch): void {
  const csrf = root.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '';
  for (const form of root.querySelectorAll<HTMLFormElement>('[data-g7pb-inquiry-form]')) {
    if (form.dataset.g7pbFormReady === 'true') continue;
    const block = form.closest<HTMLElement>('[data-block-id]');
    const blockId = block?.dataset.blockId ?? '';
    const blockInput = form.elements.namedItem('block_instance_id');
    const startedInput = form.elements.namedItem('started_at');
    if (blockInput instanceof HTMLInputElement) blockInput.value = blockId;
    if (startedInput instanceof HTMLInputElement) startedInput.value = String(Math.floor(Date.now() / 1000));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const status = form.querySelector<HTMLElement>('[data-g7pb-form-status]');
      const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (!form.reportValidity() || !blockId || submit?.disabled) return;
      if (status) status.textContent = '전송 중입니다…';
      if (submit) submit.disabled = true;
      void fetcher(form.action, {
        method: 'POST', credentials: 'same-origin', body: new FormData(form),
        headers: { Accept: 'application/json', ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}) },
      }).then(async (response) => {
        const payload = await response.json().catch(() => null) as { message?: unknown } | null;
        if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : '문의 전송에 실패했습니다.');
        form.reset();
        if (blockInput instanceof HTMLInputElement) blockInput.value = blockId;
        if (startedInput instanceof HTMLInputElement) startedInput.value = String(Math.floor(Date.now() / 1000));
        if (status) status.textContent = form.dataset.g7pbSuccessMessage || '문의가 접수되었습니다.';
      }).catch((error: unknown) => {
        if (status) status.textContent = error instanceof Error ? error.message : '문의 전송에 실패했습니다.';
      }).finally(() => {
        if (submit) submit.disabled = false;
      });
    });
    form.dataset.g7pbFormReady = 'true';
  }
}

export function bootServiceActions(
  root: Document = document,
  view: Window = window,
  fetcher: typeof fetch = fetch,
  navigate: (url: string) => void = (url) => view.location.assign(url),
  tokenStorage?: Pick<Storage, 'getItem' | 'removeItem'> | null,
): void {
  if (root.documentElement.dataset.g7pbServiceActionsReady === 'true') return;

  root.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href="#g7-action-logout"]');
    if (!link) return;

    event.preventDefault();
    if (link.dataset.g7pbActionPending === 'true') return;
    link.dataset.g7pbActionPending = 'true';
    link.setAttribute('aria-disabled', 'true');

    let storage = tokenStorage;
    if (storage === undefined) {
      try {
        storage = view.localStorage;
      } catch {
        storage = null;
      }
    }
    const token = storage?.getItem('auth_token');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const nativeDispatch = (view as G7ShellWindow).G7Core?.dispatch;
    const request = nativeDispatch
      ? Promise.resolve().then(() => nativeDispatch({ handler: 'logout' }))
      : fetcher('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
    }).then((response) => {
      if (!response.ok) throw new Error('logout failed');
      storage?.removeItem('auth_token');
      navigate('/');
    });
    void request.catch(() => {
      link.dataset.g7pbActionPending = 'false';
      link.removeAttribute('aria-disabled');
      let error = link.closest('[data-g7pb-system-controls]')?.querySelector<HTMLElement>('[data-g7pb-shell-error]');
      if (!error) { error = root.createElement('span'); error.role = 'alert'; link.after(error); }
      error.hidden = false;
      error.textContent = '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }).finally(() => {
      link.dataset.g7pbActionPending = 'false';
      link.removeAttribute('aria-disabled');
    });
  });

  root.documentElement.dataset.g7pbServiceActionsReady = 'true';
}

export function bootSiteShellMenu(root: Document = document, _view: Window = window): void {
  bootMobileNavigation(root);
}

export function bootPageSliders(root: Document = document, reducedMotion = false): void {
  for (const slider of root.querySelectorAll<HTMLElement>(SLIDER_SELECTOR)) {
    if (slider.dataset.g7pbSliderReady === 'true') continue;
    const viewport = slider.querySelector<HTMLElement>('.g7pb-hero-slider__viewport');
    const slides = Array.from(slider.querySelectorAll<HTMLElement>('.g7pb-hero-slider__slide'));
    if (!viewport || slides.length < 2) continue;

    const wantsAutoplay = slider.dataset.g7pbSliderAutoplay === 'true' && !reducedMotion;
    ensureSliderControls(root, slider, wantsAutoplay);
    const autoplay = Autoplay({
      delay: Number(slider.dataset.g7pbSliderInterval ?? 5000),
      stopOnInteraction: true,
      stopOnMouseEnter: true,
    });
    const embla = EmblaCarousel(viewport, { loop: slider.dataset.g7pbSliderLoop !== 'false' }, wantsAutoplay ? [autoplay] : []);
    const previous = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-prev]');
    const next = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]');
    const toggle = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-toggle]');
    const dotsRoot = slider.querySelector<HTMLElement>('[data-g7pb-slider-dots]');
    const status = slider.querySelector<HTMLElement>('[data-g7pb-slider-status]');
    const dots = slides.map((_, index) => {
      const dot = root.createElement('button');
      dot.type = 'button';
      dot.dataset.g7pbSliderDot = String(index);
      dot.setAttribute('aria-label', `${index + 1}번 슬라이드`);
      dot.addEventListener('click', () => embla.scrollTo(index));
      dotsRoot?.append(dot);
      return dot;
    });
    const update = (): void => {
      const selected = embla.selectedScrollSnap();
      dots.forEach((dot, index) => {
        dot.classList.toggle('is-active', index === selected);
        dot.setAttribute('aria-current', index === selected ? 'true' : 'false');
      });
      slides.forEach((slide, index) => {
        slide.setAttribute('aria-hidden', index === selected ? 'false' : 'true');
        slide.inert = index !== selected;
      });
      if (status) status.textContent = `${selected + 1} / ${slides.length}`;
      if (previous) previous.disabled = !embla.canScrollPrev();
      if (next) next.disabled = !embla.canScrollNext();
    };

    previous?.addEventListener('click', () => embla.scrollPrev());
    next?.addEventListener('click', () => embla.scrollNext());
    toggle?.addEventListener('click', () => {
      if (autoplay.isPlaying()) {
        autoplay.stop();
        toggle.textContent = '재생';
        toggle.setAttribute('aria-label', '자동 재생 시작');
      } else {
        autoplay.play();
        toggle.textContent = '일시 정지';
        toggle.setAttribute('aria-label', '자동 재생 일시 정지');
      }
    });
    embla.on('select', update);
    embla.on('reInit', update);
    slider.dataset.g7pbSliderReady = 'true';
    update();
  }
}

export function ensureSliderControls(root: Document, slider: HTMLElement, wantsAutoplay: boolean): void {
  const controls = slider.querySelector<HTMLElement>('.g7pb-hero-slider__controls');
  const dots = controls?.querySelector<HTMLElement>('[data-g7pb-slider-dots]');
  if (!controls || !dots) return;

  const createButton = (attribute: string, label: string, text: string): HTMLButtonElement => {
    const button = root.createElement('button');
    button.type = 'button';
    button.setAttribute(attribute, '');
    button.setAttribute('aria-label', label);
    button.textContent = text;
    return button;
  };

  const previous = controls.querySelector('[data-g7pb-slider-prev]')
    ?? createButton('data-g7pb-slider-prev', '이전 슬라이드', '←');
  const next = controls.querySelector('[data-g7pb-slider-next]')
    ?? createButton('data-g7pb-slider-next', '다음 슬라이드', '→');
  controls.replaceChildren(previous, dots, next);

  if (wantsAutoplay) {
    const toggle = createButton('data-g7pb-slider-toggle', '자동 재생 일시 정지', '일시 정지');
    controls.append(toggle);
  }

}

export function observePageEffects(root: Document = document, view: MotionWindow = window as MotionWindow): void {
  if (typeof MutationObserver !== 'function' || root.documentElement.dataset.g7pbEffectsObserverReady === 'true') return;

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      bootPageEffects(root, view);
    });
  });
  observer.observe(root.body, { childList: true, subtree: true });
  root.documentElement.dataset.g7pbEffectsObserverReady = 'true';
}

const buildMode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE;
const isTestRuntime = buildMode === 'test'
  || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test');

if (typeof window !== 'undefined' && typeof document !== 'undefined' && !isTestRuntime) {
  const start = (): void => {
    bootPageEffects();
    observePageEffects();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
import '../../css/page-builder-public.css';
import '../../css/page-builder-site-part-responsive.css';
import '../../css/page-builder-site-shell.css';
