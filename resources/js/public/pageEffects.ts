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

type G7ShellWindow = MotionWindow & {
  G7Core?: {
    state?: {
      get?: () => unknown;
      subscribe?: (listener: () => void) => (() => void) | void;
    };
    dispatch?: (action: Record<string, unknown>) => Promise<unknown> | unknown;
  };
};

type DynamicAudience = 'all' | 'guest' | 'member';

interface DynamicPayload {
  success?: boolean;
  data?: unknown;
}

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

const audienceRequests = new WeakMap<typeof fetch, Promise<'guest' | 'member'>>();

async function visitorAudience(fetcher: typeof fetch): Promise<'guest' | 'member'> {
  const cached = audienceRequests.get(fetcher);
  if (cached) return cached;

  const request = (async (): Promise<'guest' | 'member'> => {
    try {
      const response = await fetcher('/api/user/auth/user', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      return response.ok ? 'member' : 'guest';
    } catch {
      return 'guest';
    }
  })();
  audienceRequests.set(fetcher, request);
  return request;
}

export async function bootBlockVisibility(root: Document = document, fetcher: typeof fetch = fetch): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-g7pb-visibility-audience]'))
    .filter((block) => block.dataset.g7pbVisibilityReady !== 'true');
  if (blocks.length === 0) return;

  const needsAudience = blocks.some((block) => block.dataset.g7pbVisibilityAudience !== 'all');
  const audience = needsAudience ? await visitorAudience(fetcher) : 'guest';
  blocks.forEach((block) => {
    const required = (block.dataset.g7pbVisibilityAudience ?? 'all') as DynamicAudience;
    const allowed = required === 'all' || required === audience;
    if (!allowed) block.hidden = true;
    else if (!block.hasAttribute('data-g7pb-data-source')) block.hidden = false;
    block.dataset.g7pbVisibilityAllowed = allowed ? 'true' : 'false';
    block.dataset.g7pbVisibilityReady = 'true';
  });
}

function renderPost(root: Document, item: Record<string, unknown>): HTMLElement | null {
  const board = asRecord(item.board);
  const boardSlug = asText(item.board_slug) || asText(board?.slug) || asText(board?.id);
  const id = asText(item.id);
  const title = asText(item.title);
  if (!boardSlug || !id || !title) return null;

  const article = root.createElement('article');
  article.dataset.g7pbArchiveTitle = title.toLocaleLowerCase();
  article.dataset.g7pbArchiveBoard = asText(item.board_name) || asText(board?.name) || boardSlug;
  const link = root.createElement('a');
  link.href = `/board/${encodeURIComponent(boardSlug)}/${encodeURIComponent(id)}`;
  const heading = root.createElement('strong');
  heading.textContent = title;
  const meta = root.createElement('span');
  meta.textContent = [article.dataset.g7pbArchiveBoard, asText(item.created_at_formatted)].filter(Boolean).join(' · ');
  link.append(heading, meta);
  article.append(link);
  return article;
}

interface PaginationController {
  render: (candidates: HTMLElement[], reset?: boolean) => void;
}

function installPagination(block: HTMLElement, nodes: HTMLElement[]): PaginationController {
  const nav = block.querySelector<HTMLElement>('[data-g7pb-pagination]');
  const previous = nav?.querySelector<HTMLButtonElement>('[data-g7pb-page-prev]') ?? null;
  const next = nav?.querySelector<HTMLButtonElement>('[data-g7pb-page-next]') ?? null;
  const status = nav?.querySelector<HTMLElement>('[data-g7pb-page-status]') ?? null;
  const pageSize = Math.max(1, Number(block.dataset.g7pbPageSize) || nodes.length || 1);
  let page = 1;
  let active = nodes;

  const paint = (): void => {
    const pageCount = Math.max(1, Math.ceil(active.length / pageSize));
    page = Math.min(Math.max(1, page), pageCount);
    const visible = new Set(active.slice((page - 1) * pageSize, page * pageSize));
    nodes.forEach((node) => { node.hidden = !visible.has(node); });
    if (nav) nav.hidden = active.length === 0 || pageCount <= 1;
    if (previous) previous.disabled = page <= 1;
    if (next) next.disabled = page >= pageCount;
    if (status) status.textContent = `${page} / ${pageCount}`;
  };
  previous?.addEventListener('click', () => { page -= 1; paint(); });
  next?.addEventListener('click', () => { page += 1; paint(); });
  paint();

  return {
    render(candidates, reset = false): void {
      active = candidates;
      if (reset) page = 1;
      paint();
    },
  };
}

function installArchiveFilters(block: HTMLElement, nodes: HTMLElement[], status: HTMLElement | null, pagination: PaginationController): void {
  const search = block.querySelector<HTMLInputElement>('[data-g7pb-archive-search]');
  const filter = block.querySelector<HTMLSelectElement>('[data-g7pb-archive-filter]');
  const boards = [...new Set(nodes.map((node) => node.dataset.g7pbArchiveBoard ?? '').filter(Boolean))];
  if (filter) {
    filter.replaceChildren(new Option('전체 게시판', ''), ...boards.map((board) => new Option(board, board)));
  }
  const apply = (): void => {
    const query = search?.value.trim().toLocaleLowerCase() ?? '';
    const board = filter?.value ?? '';
    const matches = nodes.filter((node) => (!query || (node.dataset.g7pbArchiveTitle ?? '').includes(query))
      && (!board || node.dataset.g7pbArchiveBoard === board));
    pagination.render(matches, true);
    if (status) status.textContent = matches.length === 0 ? block.dataset.g7pbEmptyMessage ?? '조건에 맞는 게시글이 없습니다.' : '';
  };
  search?.addEventListener('input', apply);
  filter?.addEventListener('change', apply);
  apply();
}

function safeLinkSource(value: unknown): string {
  const source = asText(value).trim();
  if (source.startsWith('/') && !source.startsWith('//') && !source.includes('\\')) return source;
  try {
    const parsed = new URL(source);
    return parsed.protocol === 'https:' ? parsed.toString() : '#';
  } catch {
    return '#';
  }
}

function plainText(root: Document, value: unknown): string {
  const markup = asText(value);
  if (!markup.includes('<')) return markup.trim();
  const container = root.createElement('div');
  container.innerHTML = markup;
  return (container.textContent ?? '').replace(/\s+/gu, ' ').trim();
}

function payloadRecord(payload: DynamicPayload): Record<string, unknown> | null {
  const data = asRecord(payload.data);
  if (!data) return null;
  return asRecord(data.data) ?? data;
}

function renderPostDetail(root: Document, block: HTMLElement, item: Record<string, unknown>): HTMLElement | null {
  const title = asText(item.title);
  if (!title) return null;
  const article = root.createElement('article');
  const meta = root.createElement('p');
  meta.className = 'g7pb-data-detail__meta';
  const author = asRecord(item.author);
  meta.textContent = [asText(author?.name) || asText(item.author_name), asText(item.created_at_formatted), asText(item.view_count) ? `조회 ${asText(item.view_count)}` : ''].filter(Boolean).join(' · ');
  const heading = root.createElement('h3');
  heading.textContent = title;
  article.append(meta, heading);
  const thumbnail = safeImageSource(item.thumbnail);
  if (thumbnail) {
    const image = root.createElement('img');
    image.src = thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    article.append(image);
  }
  if (block.dataset.g7pbShowContent !== 'false') {
    const content = plainText(root, item.content);
    if (content) {
      const paragraph = root.createElement('p');
      paragraph.textContent = content;
      article.append(paragraph);
    }
  }
  const link = block.querySelector<HTMLAnchorElement>('[data-g7pb-detail-action]') ?? root.createElement('a');
  link.href = safeLinkSource(block.dataset.g7pbDetailUrl);
  link.textContent = block.dataset.g7pbDetailLabel ?? '게시글 전체 보기';
  link.hidden = false;
  article.append(link);
  return article;
}

function renderProductDetail(root: Document, block: HTMLElement, item: Record<string, unknown>): HTMLElement | null {
  const name = asText(item.name_localized) || asText(item.name);
  if (!name) return null;
  const article = root.createElement('article');
  const imageSource = safeImageSource(item.thumbnail_url);
  if (imageSource) {
    const image = root.createElement('img');
    image.src = imageSource;
    image.alt = '';
    image.loading = 'lazy';
    article.append(image);
  } else {
    const placeholder = root.createElement('span');
    placeholder.className = 'g7pb-data-detail__placeholder';
    placeholder.textContent = '상품 이미지';
    article.append(placeholder);
  }
  const body = root.createElement('div');
  const meta = root.createElement('p');
  meta.className = 'g7pb-data-detail__meta';
  meta.textContent = [asText(item.category_name), asText(item.product_code)].filter(Boolean).join(' · ');
  const heading = root.createElement('h3');
  heading.textContent = name;
  const price = root.createElement('strong');
  price.textContent = asText(item.selling_price_formatted) || asText(item.selling_price);
  body.append(meta, heading, price);
  if (block.dataset.g7pbShowDescription !== 'false') {
    const description = plainText(root, item.short_description_localized) || plainText(root, item.description_localized);
    if (description) {
      const paragraph = root.createElement('p');
      paragraph.textContent = description;
      body.append(paragraph);
    }
  }
  const link = block.querySelector<HTMLAnchorElement>('[data-g7pb-detail-action]') ?? root.createElement('a');
  link.href = safeLinkSource(block.dataset.g7pbDetailUrl);
  link.textContent = block.dataset.g7pbDetailLabel ?? '상품 전체 보기';
  link.hidden = false;
  body.append(link);
  article.append(body);
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
  await bootBlockVisibility(root, fetcher);
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('[data-g7pb-data-source]'))
    .filter((block) => block.dataset.g7pbDataReady !== 'true');
  if (blocks.length === 0) return;

  const needsAudience = blocks.some((block) => block.dataset.g7pbAudience !== 'all');
  const audience = needsAudience ? await visitorAudience(fetcher) : 'guest';

  await Promise.all(blocks.map(async (block) => {
    if (block.dataset.g7pbVisibilityAllowed === 'false') {
      block.dataset.g7pbDataReady = 'true';
      return;
    }
    const requiredAudience = (block.dataset.g7pbAudience ?? 'all') as DynamicAudience;
    if (requiredAudience !== 'all' && requiredAudience !== audience) {
      block.hidden = true;
      block.dataset.g7pbDataReady = 'true';
      return;
    }

    block.hidden = false;
    const status = block.querySelector<HTMLElement>('[data-g7pb-data-status]');
    const list = block.querySelector<HTMLElement>('[data-g7pb-data-list]');
    const detail = block.querySelector<HTMLElement>('[data-g7pb-data-detail]');
    const endpoint = block.dataset.g7pbEndpoint ?? '';
    if ((!list && !detail) || !endpoint.startsWith('/api/')) {
      if (status) status.textContent = '데이터 연결 설정을 확인해 주세요.';
      list?.setAttribute('aria-busy', 'false');
      detail?.setAttribute('aria-busy', 'false');
      block.dataset.g7pbDataReady = 'true';
      return;
    }

    try {
      const response = await fetcher(endpoint, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const payload = await response.json() as DynamicPayload;
      if (!response.ok || payload.success === false) throw new Error('dynamic data request failed');

      const source = block.dataset.g7pbDataSource;
      if (source === 'post-detail' || source === 'product-detail') {
        const item = payloadRecord(payload);
        const rendered = item
          ? source === 'post-detail' ? renderPostDetail(root, block, item) : renderProductDetail(root, block, item)
          : null;
        detail?.replaceChildren(...(rendered ? [rendered] : []));
        detail?.setAttribute('aria-busy', 'false');
        if (status) status.textContent = rendered ? '' : block.dataset.g7pbEmptyMessage ?? '표시할 콘텐츠가 없습니다.';
        block.dataset.g7pbDataReady = 'true';
        return;
      }

      if (!list) throw new Error('dynamic list target is missing');
      const basePath = block.dataset.g7pbProductBase ?? '/shop/products';
      const nodes = payloadItems(payload)
        .map((item) => source === 'posts' || source === 'post-archive' ? renderPost(root, item) : renderProduct(root, item, basePath))
        .filter((node): node is HTMLElement => node !== null);
      list.replaceChildren(...nodes);
      if (block.dataset.g7pbMotion === 'stagger') {
        const stagger = Number(block.dataset.g7pbMotionStagger ?? 100);
        nodes.forEach((node, index) => {
          node.dataset.g7pbMotionItem = '';
          node.style.setProperty('--g7pb-motion-order', String(index));
          node.style.setProperty('--g7pb-motion-delay', `${index * stagger}ms`);
        });
      }
      list.setAttribute('aria-busy', 'false');
      if (status) status.textContent = nodes.length === 0
        ? block.dataset.g7pbEmptyMessage ?? '표시할 항목이 없습니다.'
        : '';
      const pagination = installPagination(block, nodes);
      pagination.render(nodes, true);
      if (source === 'post-archive' && nodes.length > 0) installArchiveFilters(block, nodes, status, pagination);
    } catch {
      list?.replaceChildren();
      detail?.replaceChildren();
      list?.setAttribute('aria-busy', 'false');
      detail?.setAttribute('aria-busy', 'false');
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
  ensureSiteShellButtons(root);
  bootG7SystemControls(root, view as G7ShellWindow);
  bootSiteShellMenu(root, view);
  bootServiceActions(root, view);
  bootAccordions(root);
  bootTabs(root);
  const fetcher = typeof view.fetch === 'function' ? view.fetch.bind(view) : fetch;
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

export function ensureSiteShellButtons(root: Document = document): void {
  const selectors = [
    '[data-g7pb-menu-toggle]',
    '[data-g7pb-menu-backdrop]',
    '[data-g7pb-menu-close]',
    '[data-g7pb-submenu-toggle]',
  ];
  root.querySelectorAll<HTMLElement>(selectors.join(',')).forEach((marker) => {
    if (marker instanceof HTMLButtonElement) return;
    const button = root.createElement('button');
    button.type = 'button';
    for (const attribute of Array.from(marker.attributes)) {
      button.setAttribute(attribute.name, attribute.value);
    }
    button.replaceChildren(...Array.from(marker.childNodes));
    marker.replaceWith(button);
  });
}

function systemState(view: G7ShellWindow): Record<string, unknown> {
  try {
    return asRecord(view.G7Core?.state?.get?.()) ?? {};
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
    if (host.querySelector('form')) return;
    const form = root.createElement('form');
    form.className = 'g7pb-system-search';
    form.action = '/search';
    form.method = 'get';
    form.role = 'search';
    const label = root.createElement('label');
    label.className = 'g7pb-visually-hidden';
    label.textContent = host.dataset.g7pbLabel || '검색';
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
      label.append(text, select);
      host.append(label);
    });
  };
  ensureSelect('[data-g7pb-system-locale-host]', 'data-g7pb-system-locale-wrap', 'data-g7pb-system-locale');
  ensureSelect('[data-g7pb-system-currency-host]', 'data-g7pb-system-currency-wrap', 'data-g7pb-system-currency');
}

export function renderG7SystemControls(root: Document = document, view: G7ShellWindow = window as G7ShellWindow): void {
  ensureG7SystemControlElements(root);
  const controls = Array.from(root.querySelectorAll<HTMLElement>('[data-g7pb-system-controls]'));
  if (controls.length === 0) return;

  const state = systemState(view);
  const user = asRecord(state.currentUser);
  const isMember = typeof user?.uuid === 'string' && user.uuid !== '';
  const cartCount = Math.max(0, Number(state.cartCount) || 0);
  const notificationCount = Math.max(0, Number(state.notificationCount) || 0);
  const shopBase = typeof state.shopBase === 'string' ? state.shopBase.replace(/\/$/u, '') : '/shop';
  const appConfig = asRecord(state.appConfig);
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
    : typeof state.defaultCurrency === 'string' ? state.defaultCurrency : '';

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

export function bootG7SystemControls(root: Document = document, view: G7ShellWindow = window as G7ShellWindow): void {
  renderG7SystemControls(root, view);
  if (root.documentElement.dataset.g7pbSystemControlsReady === 'true') return;

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
      const dispatched = view.G7Core?.dispatch?.({ handler: 'setTheme', target: next });
      if (dispatched === undefined) {
        view.localStorage.setItem('g7_color_scheme', next);
        const resolved = next === 'auto' && typeof view.matchMedia === 'function'
          ? (view.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : next;
        root.documentElement.dataset.theme = resolved;
        root.documentElement.classList.toggle('dark', resolved === 'dark');
      }
    } catch {
      // G7가 초기화되지 않은 순간에는 기존 템플릿 상태를 바꾸지 않습니다.
    }
  });

  root.addEventListener('change', (event) => {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;
    if (select.matches('[data-g7pb-system-locale]') && /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(select.value)) {
      void view.G7Core?.dispatch?.({ handler: 'setLocale', target: select.value });
    }
    if (select.matches('[data-g7pb-system-currency]') && /^[A-Z]{3}$/u.test(select.value)) {
      void view.G7Core?.dispatch?.({
        handler: 'sirsoft-basic.savePreferredCurrency',
        params: { currencyCode: select.value },
      });
    }
  });

  try {
    view.G7Core?.state?.subscribe?.(() => renderG7SystemControls(root, view));
  } catch {
    // 구형 호스트는 subscribe 없이도 MutationObserver 재부트로 현재 상태를 반영합니다.
  }
  root.documentElement.dataset.g7pbSystemControlsReady = 'true';
}

export function bootAccordions(root: Document = document): void {
  for (const accordion of root.querySelectorAll<HTMLElement>('[data-g7pb-accordion]')) {
    if (accordion.dataset.g7pbAccordionReady === 'true') continue;
    if (accordion.dataset.g7pbAccordionBehavior === 'single') {
      for (const item of accordion.querySelectorAll<HTMLDetailsElement>('details')) {
        item.addEventListener('toggle', () => {
          if (!item.open) return;
          for (const sibling of accordion.querySelectorAll<HTMLDetailsElement>('details')) {
            if (sibling !== item) sibling.open = false;
          }
        });
      }
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
  const backdrop = root.querySelector<HTMLButtonElement>('[data-g7pb-menu-backdrop]');
  const closeButton = menu?.querySelector<HTMLButtonElement>('[data-g7pb-menu-close]');
  if (!toggle || !menu || toggle.dataset.g7pbMenuReady === 'true') return;

  const submenuToggles = Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-g7pb-submenu-toggle]'));
  const setSubmenuOpen = (button: HTMLButtonElement, open: boolean): void => {
    const submenuId = button.getAttribute('aria-controls');
    const submenu = submenuId ? root.getElementById(submenuId) : null;
    if (!submenu) return;
    button.setAttribute('aria-expanded', String(open));
    submenu.hidden = !open;
    const currentLabel = button.getAttribute('aria-label') ?? '';
    button.setAttribute('aria-label', currentLabel.replace(open ? '열기' : '닫기', open ? '닫기' : '열기'));
  };
  const closeSubmenus = (): void => submenuToggles.forEach((button) => setSubmenuOpen(button, false));
  submenuToggles.forEach((button) => button.addEventListener('click', () => {
    setSubmenuOpen(button, button.getAttribute('aria-expanded') !== 'true');
  }));

  const close = (restoreFocus = false): void => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
    menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
    closeSubmenus();
    root.documentElement.classList.remove('g7pb-menu-open');
    if (restoreFocus) toggle.focus();
  };
  const open = (): void => {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '메뉴 닫기');
    menu.hidden = false;
    if (backdrop) backdrop.hidden = false;
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
  backdrop?.addEventListener('click', () => close(true));
  closeButton?.addEventListener('click', () => close(true));
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
    if (event.key !== 'Tab' || toggle.getAttribute('aria-expanded') !== 'true' || menu.dataset.g7pbMenuStyle === 'dropdown') return;
    const focusable = Array.from(menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
      .filter((element) => element.closest('[hidden]') === null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && root.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && root.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
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
import '../../css/page-builder-public.css';
