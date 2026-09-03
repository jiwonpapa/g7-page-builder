interface CounterParts {
  prefix: string;
  value: number;
  suffix: string;
  decimals: number;
}

export type MotionWindow = Window & {
  IntersectionObserver?: typeof IntersectionObserver;
};

const MOTION_SELECTOR = '.g7pb-block[data-g7pb-motion]';
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

interface CounterJob { active: boolean; frame: number }
interface CounterTarget { original: string; marker: string | undefined; label: string | null }
interface MotionGroup { observer: IntersectionObserver; states: Map<Element, MotionState> }
interface MotionState {
  block: HTMLElement;
  inputs: string;
  targets: HTMLElement[];
  counters: Map<HTMLElement, CounterTarget>;
  jobs: Map<HTMLElement, CounterJob>;
  group?: MotionGroup;
}
interface MotionRuntime {
  root: Document;
  view: MotionWindow;
  page: HTMLElement;
  active: boolean;
  reduced: boolean;
  states: Map<HTMLElement, MotionState>;
  observer: MutationObserver;
  groups: Set<MotionGroup>;
  parallaxFrame: number;
  parallaxVersion: number;
  parallaxListening: boolean;
  scheduleParallax: () => void;
}
const runtimes = new WeakMap<Document, MotionRuntime>();
const attributes = ['data-g7pb-motion', 'data-g7pb-motion-trigger', 'data-g7pb-motion-intensity', 'data-g7pb-motion-stagger'];
const inputs = (block: HTMLElement): string => JSON.stringify(attributes.map(name => block.getAttribute(name)));
function targets(block: HTMLElement): HTMLElement[] {
  switch (block.dataset.g7pbMotion) {
    case 'counter': return Array.from(block.querySelectorAll<HTMLElement>('.g7pb-stats__grid article > strong'));
    case 'stagger': return Array.from(block.querySelectorAll<HTMLElement>(STAGGER_TARGETS.join(',')));
    case 'chart-draw': return Array.from(block.querySelectorAll<HTMLElement>('progress'));
    case 'parallax-soft': { const target = block.querySelector<HTMLElement>('img, .g7pb-media-placeholder, figure'); return target ? [target] : []; }
    default: return [];
  }
}
function live(runtime: MotionRuntime): boolean { return runtime.active && runtimes.get(runtime.root) === runtime; }
function stopCounters(runtime: MotionRuntime, state: MotionState): void {
  for (const job of state.jobs.values()) { job.active = false; runtime.view.cancelAnimationFrame(job.frame); }
  state.jobs.clear();
  for (const [element, target] of state.counters) if (element.textContent !== target.original) element.textContent = target.original;
}
function retire(runtime: MotionRuntime, state: MotionState): void {
  runtime.states.delete(state.block);
  stopCounters(runtime, state);
  const group = state.group;
  if (group) {
    group.observer.unobserve(state.block); group.states.delete(state.block);
    if (group.states.size === 0) { group.observer.disconnect(); runtime.groups.delete(group); }
  }
  for (const [element, target] of state.counters) {
    if (target.marker === undefined) delete element.dataset.g7pbCounterOriginal;
    else element.dataset.g7pbCounterOriginal = target.marker;
    if (target.label === null) element.removeAttribute('aria-label'); else element.setAttribute('aria-label', target.label);
  }
  for (const target of state.targets) {
    target.classList.remove('g7pb-motion-parallax-target');
    delete target.dataset.g7pbMotionItem;
    target.style.removeProperty('--g7pb-motion-order'); target.style.removeProperty('--g7pb-motion-delay');
  }
  state.block.classList.remove('is-inview'); state.block.style.removeProperty('--g7pb-motion-progress');
  delete state.block.dataset.g7pbMotionReady;
}
function reconcile(runtime: MotionRuntime, records: MutationRecord[]): void {
  if (!live(runtime)) return;
  for (const state of runtime.states.values()) {
    const actual = targets(state.block);
    if (!runtime.root.contains(state.block) || !state.block.isConnected || state.inputs !== inputs(state.block)
      || actual.length !== state.targets.length || actual.some((node, index) => node !== state.targets[index])
      || records.some(record => Array.from(record.removedNodes).some(node => node.contains(state.block)
        || state.targets.some(target => node.contains(target))))) retire(runtime, state);
  }
  if (![...runtime.states.keys()].some(block => block.dataset.g7pbMotion === 'parallax-soft')) stopParallax(runtime);
}
function current(runtime: MotionRuntime, state: MotionState): boolean {
  reconcile(runtime, runtime.observer.takeRecords());
  return live(runtime) && runtime.states.get(state.block) === state;
}
function prepare(state: MotionState): void {
  const preset = state.block.dataset.g7pbMotion;
  state.targets.forEach((target, index) => {
    if (preset === 'stagger') {
      target.dataset.g7pbMotionItem = '';
      target.style.setProperty('--g7pb-motion-order', String(index));
      target.style.setProperty('--g7pb-motion-delay', `${index * Number(state.block.dataset.g7pbMotionStagger ?? 100)}ms`);
    } else if (preset === 'counter') {
      const original = target.dataset.g7pbCounterOriginal ?? target.textContent?.trim() ?? '';
      state.counters.set(target, { original, marker: target.dataset.g7pbCounterOriginal, label: target.getAttribute('aria-label') });
      target.dataset.g7pbCounterOriginal = original;
    } else if (preset === 'chart-draw') target.dataset.g7pbMotionItem = '';
    else if (preset === 'parallax-soft') target.classList.add('g7pb-motion-parallax-target');
  });
}
function activate(runtime: MotionRuntime, state: MotionState): void {
  const { block } = state;
  if (!current(runtime, state) || (block.classList.contains('is-inview') && block.dataset.g7pbMotionTrigger === 'once')) return;
  block.classList.add('is-inview');
  stopCounters(runtime, state);
  for (const [element, target] of state.counters) {
    const parts = parseCounterText(target.original); if (!parts) continue;
    const startedAt = runtime.view.performance.now(); const duration = counterDuration(block);
    const job: CounterJob = { active: true, frame: 0 }; state.jobs.set(element, job);
    element.setAttribute('aria-label', target.original); element.textContent = formatCounter(parts, 0);
    const tick = (now: number): void => {
      if (!job.active || !current(runtime, state) || state.jobs.get(element) !== job || !block.classList.contains('is-inview')) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      element.textContent = formatCounter(parts, parts.value * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) job.frame = runtime.view.requestAnimationFrame(tick);
      else { job.active = false; state.jobs.delete(element); }
    };
    job.frame = runtime.view.requestAnimationFrame(tick);
  }
}
function stopParallax(runtime: MotionRuntime): void {
  if (!runtime.parallaxListening) return;
  runtime.parallaxVersion += 1;
  runtime.view.removeEventListener('scroll', runtime.scheduleParallax);
  runtime.view.removeEventListener('resize', runtime.scheduleParallax);
  runtime.view.cancelAnimationFrame(runtime.parallaxFrame);
  runtime.parallaxFrame = 0; runtime.parallaxListening = false;
}
function installParallax(runtime: MotionRuntime): void {
  if (runtime.reduced || ![...runtime.states.keys()].some(block => block.dataset.g7pbMotion === 'parallax-soft')) return;
  if (!runtime.parallaxListening) {
    runtime.view.addEventListener('scroll', runtime.scheduleParallax, { passive: true });
    runtime.view.addEventListener('resize', runtime.scheduleParallax, { passive: true });
    runtime.parallaxListening = true;
  }
  runtime.scheduleParallax();
}
export function disposePageMotion(root: Document = document): void {
  const runtime = runtimes.get(root); if (!runtime) return;
  runtime.active = false; runtime.observer.disconnect(); stopParallax(runtime);
  for (const state of runtime.states.values()) retire(runtime, state);
  runtime.page.classList.remove('g7pb-motion-active'); delete runtime.page.dataset.g7pbMotionReduced;
  runtimes.delete(root);
}
export function bootPageMotion(root: Document = document, view: MotionWindow = window, reducedMotion = false): void {
  const page = root.querySelector<HTMLElement>('.g7pb-page');
  let runtime = runtimes.get(root);
  if (runtime && (runtime.view !== view || runtime.page !== page || runtime.reduced !== reducedMotion)) { disposePageMotion(root); runtime = undefined; }
  if (!page) return;
  if (!runtime) {
    const observer = new MutationObserver(records => { if (runtime) reconcile(runtime, records); });
    const owner: MotionRuntime = { root, view, page, active: true, reduced: reducedMotion, states: new Map(), groups: new Set(), observer,
      parallaxFrame: 0, parallaxVersion: 0, parallaxListening: false, scheduleParallax: () => {
        if (!live(owner) || !owner.parallaxListening || owner.parallaxFrame !== 0) return;
        const version = ++owner.parallaxVersion;
        owner.parallaxFrame = -1;
        const frame = view.requestAnimationFrame(() => {
          if (!live(owner) || !owner.parallaxListening || owner.parallaxVersion !== version) return;
          owner.parallaxFrame = 0;
          reconcile(owner, observer.takeRecords());
          if (!live(owner) || !owner.parallaxListening) return;
          const height = Math.max(1, view.innerHeight);
          for (const block of owner.states.keys()) {
            if (block.dataset.g7pbMotion !== 'parallax-soft') continue;
            const rect = block.getBoundingClientRect();
            const progress = Math.max(-1, Math.min(1, (height / 2 - (rect.top + rect.height / 2)) / (height + rect.height)));
            block.style.setProperty('--g7pb-motion-progress', progress.toFixed(4));
          }
        });
        if (owner.parallaxFrame === -1) owner.parallaxFrame = frame;
      } };
    runtime = owner; runtimes.set(root, owner);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
  }
  reconcile(runtime, runtime.observer.takeRecords());
  const fresh: MotionState[] = [];
  for (const block of root.querySelectorAll<HTMLElement>(MOTION_SELECTOR)) {
    if (runtime.states.has(block)) continue;
    const state: MotionState = { block, inputs: inputs(block), targets: targets(block), counters: new Map(), jobs: new Map() };
    runtime.states.set(block, state); fresh.push(state);
    if (!reducedMotion) prepare(state);
    block.dataset.g7pbMotionReady = 'true';
  }
  if (reducedMotion) { page.dataset.g7pbMotionReduced = 'true'; return; }
  if (runtime.states.size === 0) return;
  page.classList.add('g7pb-motion-active'); installParallax(runtime);
  if (fresh.length === 0) return;
  const owner = runtime;
  const Observer = view.IntersectionObserver;
  if (typeof Observer !== 'function') { fresh.forEach(state => activate(owner, state)); return; }
  const states = new Map<Element, MotionState>(fresh.map(state => [state.block, state]));
  const observer = new Observer(entries => {
    for (const entry of entries) {
      const state = states.get(entry.target); if (!state || !current(owner, state)) continue;
      if (entry.isIntersecting) {
        activate(owner, state);
        if (state.block.dataset.g7pbMotionTrigger !== 'repeat') observer.unobserve(state.block);
      } else if (state.block.dataset.g7pbMotionTrigger === 'repeat') {
        state.block.classList.remove('is-inview'); stopCounters(owner, state);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
  const group = { observer, states }; owner.groups.add(group);
  for (const state of fresh) { state.group = group; observer.observe(state.block); }
}
