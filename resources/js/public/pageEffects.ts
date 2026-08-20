import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';

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

type DynamicAudience = 'all' | 'guest' | 'member';

interface DynamicPayload {
  success?: boolean;
  data?: unknown;
}

const MOTION_SELECTOR = '.g7pb-block[data-g7pb-motion]';
const SLIDER_SELECTOR = '[data-g7pb-slider]';
const STAGGER_TARGETS = [
  '.g7pb-features__item',
  '.g7pb-logo-cloud li',
  '.g7pb-stats__grid article',
  '.g7pb-pricing__plan',
  '.g7pb-team__grid article',
  '.g7pb-gallery__grid figure',
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function payloadItems(payload: DynamicPayload): Record<string, unknown>[] {
  const nested = asRecord(payload.data);
  const values = Array.isArray(payload.data) ? payload.data : nested && Array.isArray(nested.data) ? nested.data : [];
  return values.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

function safeImageSource(value: unknown): string {
  const source = asText(value);
  if (source.startsWith('/') && !source.startsWith('//') && !source.includes('\\')) return source;
  try {
    const parsed = new URL(source);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

async function visitorAudience(fetcher: typeof fetch): Promise<'guest' | 'member'> {
  try {
    const response = await fetcher('/api/user/auth/user', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    return response.ok ? 'member' : 'guest';
  } catch {
    return 'guest';
  }
}

function renderPost(root: Document, item: Record<string, unknown>): HTMLElement | null {
  const boardSlug = asText(item.board_slug);
  const id = asText(item.id);
  const title = asText(item.title);
  if (!boardSlug || !id || !title) return null;

  const article = root.createElement('article');
  const link = root.createElement('a');
  link.href = `/board/${encodeURIComponent(boardSlug)}/${encodeURIComponent(id)}`;
  const heading = root.createElement('strong');
  heading.textContent = title;
  const meta = root.createElement('span');
  meta.textContent = [asText(item.board_name), asText(item.created_at_formatted)].filter(Boolean).join(' · ');
  link.append(heading, meta);
  article.append(link);
  return article;
}

function renderProduct(root: Document, item: Record<string, unknown>, basePath: string): HTMLElement | null {
  const key = asText(item.product_code) || asText(item.id);
  const name = asText(item.name_localized) || asText(item.name);
  if (!key || !name) return null;

  const article = root.createElement('article');
  const link = root.createElement('a');
  link.href = `${basePath}/${encodeURIComponent(key)}`;
  const source = safeImageSource(item.thumbnail_url);
  if (source) {
    const image = root.createElement('img');
    image.src = source;
    image.alt = '';
    image.loading = 'lazy';
    link.append(image);
  } else {
    const placeholder = root.createElement('span');
    placeholder.className = 'g7pb-dynamic-products__placeholder';
    placeholder.textContent = '상품 이미지';
    link.append(placeholder);
  }
  const heading = root.createElement('strong');
  heading.textContent = name;
  const price = root.createElement('span');
  price.textContent = asText(item.selling_price_formatted) || asText(item.selling_price);
  link.append(heading, price);
  article.append(link);
  return article;
}

export async function bootDynamicData(root: Document = document, fetcher: typeof fetch = fetch): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-g7pb-data-source]'))
    .filter((block) => block.dataset.g7pbDataReady !== 'true');
  if (blocks.length === 0) return;

  const needsAudience = blocks.some((block) => block.dataset.g7pbAudience !== 'all');
  const audience = needsAudience ? await visitorAudience(fetcher) : 'guest';

  await Promise.all(blocks.map(async (block) => {
    const requiredAudience = (block.dataset.g7pbAudience ?? 'all') as DynamicAudience;
    if (requiredAudience !== 'all' && requiredAudience !== audience) {
      block.hidden = true;
      block.dataset.g7pbDataReady = 'true';
      return;
    }

    block.hidden = false;
    const status = block.querySelector<HTMLElement>('[data-g7pb-data-status]');
    const list = block.querySelector<HTMLElement>('[data-g7pb-data-list]');
    const endpoint = block.dataset.g7pbEndpoint ?? '';
    if (!list || !endpoint.startsWith('/api/')) return;

    try {
      const response = await fetcher(endpoint, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json() as DynamicPayload;
      if (!response.ok || payload.success === false) throw new Error('dynamic data request failed');

      const source = block.dataset.g7pbDataSource;
      const basePath = block.dataset.g7pbProductBase ?? '/shop/products';
      const nodes = payloadItems(payload)
        .map((item) => source === 'posts' ? renderPost(root, item) : renderProduct(root, item, basePath))
        .filter((node): node is HTMLElement => node !== null);
      list.replaceChildren(...nodes);
      list.setAttribute('aria-busy', 'false');
      if (status) status.textContent = nodes.length === 0
        ? block.dataset.g7pbEmptyMessage ?? '표시할 항목이 없습니다.'
        : '';
    } catch {
      list.replaceChildren();
      list.setAttribute('aria-busy', 'false');
      if (status) status.textContent = '콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }
    block.dataset.g7pbDataReady = 'true';
  }));
}

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
  bootSiteShellMenu(root, view);
  bootServiceActions(root, view);
  const fetcher = typeof view.fetch === 'function' ? view.fetch.bind(view) : fetch;
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

    void fetcher('/api/user/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
    }).then((response) => {
      if (!response.ok) throw new Error('logout failed');
      storage?.removeItem('auth_token');
      navigate('/');
    }).catch(() => {
      link.dataset.g7pbActionPending = 'false';
      link.removeAttribute('aria-disabled');
    });
  });

  root.documentElement.dataset.g7pbServiceActionsReady = 'true';
}

export function bootSiteShellMenu(root: Document = document, view: Window = window): void {
  const toggle = root.querySelector<HTMLButtonElement>('[data-g7pb-menu-toggle]');
  const menu = root.querySelector<HTMLElement>('[data-g7pb-mobile-menu]');
  if (!toggle || !menu || toggle.dataset.g7pbMenuReady === 'true') return;

  const close = (restoreFocus = false): void => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
    menu.hidden = true;
    root.documentElement.classList.remove('g7pb-menu-open');
    if (restoreFocus) toggle.focus();
  };
  const open = (): void => {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '메뉴 닫기');
    menu.hidden = false;
    root.documentElement.classList.add('g7pb-menu-open');
    menu.querySelector<HTMLElement>('a, button')?.focus();
  };

  toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') === 'true') close();
    else open();
  });
  menu.addEventListener('click', (event) => {
    if ((event.target as Element | null)?.closest('a')) close();
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
  });
  view.addEventListener('resize', () => {
    if (view.innerWidth >= 900) close();
  }, { passive: true });
  toggle.dataset.g7pbMenuReady = 'true';
  close();
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
  let controls = slider.querySelector<HTMLElement>('.g7pb-hero-slider__controls');
  if (!controls) {
    controls = root.createElement('div');
    controls.className = 'g7pb-hero-slider__controls';
    slider.append(controls);
  }

  const createButton = (attribute: string, label: string, text: string): HTMLButtonElement => {
    const button = root.createElement('button');
    button.type = 'button';
    button.setAttribute(attribute, '');
    button.setAttribute('aria-label', label);
    button.textContent = text;
    return button;
  };

  let dots = controls.querySelector<HTMLElement>('[data-g7pb-slider-dots]');
  if (!dots) {
    dots = root.createElement('div');
    dots.className = 'g7pb-hero-slider__dots';
    dots.dataset.g7pbSliderDots = '';
    dots.setAttribute('aria-label', '슬라이드 선택');
  }

  const previous = controls.querySelector('[data-g7pb-slider-prev]')
    ?? createButton('data-g7pb-slider-prev', '이전 슬라이드', '←');
  const next = controls.querySelector('[data-g7pb-slider-next]')
    ?? createButton('data-g7pb-slider-next', '다음 슬라이드', '→');
  controls.replaceChildren(previous, dots, next);

  if (wantsAutoplay) {
    const toggle = createButton('data-g7pb-slider-toggle', '자동 재생 일시 정지', '일시 정지');
    controls.append(toggle);
  }

  if (!slider.querySelector('[data-g7pb-slider-status]')) {
    const status = root.createElement('p');
    status.className = 'g7pb-hero-slider__status';
    status.dataset.g7pbSliderStatus = '';
    status.setAttribute('aria-live', 'polite');
    slider.append(status);
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
