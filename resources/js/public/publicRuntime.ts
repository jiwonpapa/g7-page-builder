import { hydrateTemplateRuntime, ensureSiteShellButtons } from './publicHydration';
import { bootAccordions, bootTabs, disposeContentControls } from './publicContentControls';
import { bootInquiryForms, disposeInquiryForms } from './publicInquiryForms';
import { bootG7SystemControls, disposeG7SystemControls } from './siteShellRuntime';
import { bootServiceActions, disposeServiceActions } from './siteShellActions';
import { bootDynamicData, disposePublicDataRuntime, publicDataFetcher } from './publicDataRuntime';
import { bootMobileNavigation, disposeMobileNavigation, pruneMobileNavigation } from './mobileNavigation';
import { bootPageMotion, disposePageMotion, type MotionWindow } from './publicMotion';
import { bootPageSliders, disposePageSliders } from './publicSliderLoader';

interface PublicRuntime {
  root: Document;
  view: MotionWindow;
  active: boolean;
  observer: MutationObserver | null;
  scheduled: boolean;
  starting: (() => void) | null;
  transport?: { source: typeof fetch; bound: typeof fetch };
  sessionChanged: () => void;
}
const runtimes = new WeakMap<Document, PublicRuntime>();
// P1 retires request ownership on each of these input records, including equal-value writes.
const dataAttributes = ['data-g7pb-data-source', 'data-g7pb-endpoint', 'data-g7pb-audience',
  'data-g7pb-visibility-audience', 'data-g7pb-product-base', 'data-g7pb-empty-message',
  'data-g7pb-show-content', 'data-g7pb-show-description', 'data-g7pb-detail-url', 'data-g7pb-detail-label',
  'data-g7pb-page-size', 'data-g7pb-motion', 'data-g7pb-motion-stagger'];
const observedAttributes = [
  'data-g7pb-tabs', 'data-g7pb-accordion', 'data-g7pb-tabs-initial', 'data-g7pb-accordion-behavior', 'data-block-id', 'role',
  'data-g7pb-inquiry-form', 'action', 'type', 'data-g7pb-runtime-config',
  ...dataAttributes, 'data-g7pb-motion-trigger', 'data-g7pb-motion-intensity',
  'data-g7pb-slider', 'data-g7pb-slider-autoplay', 'data-g7pb-slider-interval', 'data-g7pb-slider-loop',
];
const current = (runtime: PublicRuntime): boolean => runtime.active && runtimes.get(runtime.root) === runtime;
function runtimeFetcher(runtime: PublicRuntime): typeof fetch {
  const source = typeof runtime.view.fetch === 'function' ? runtime.view.fetch : fetch;
  if (runtime.transport?.source !== source) runtime.transport = { source, bound: publicDataFetcher(runtime.root, runtime.view) };
  return runtime.transport.bound;
}
function runtimeFor(root: Document, view: MotionWindow): PublicRuntime {
  const previous = runtimes.get(root);
  if (previous?.view === view) return previous;
  if (previous) disposePageEffects(root);
  const runtime: PublicRuntime = { root, view, active: true, observer: null, scheduled: false, starting: null,
    sessionChanged: () => {
      if (!current(runtime)) return;
      disposePublicDataRuntime(root);
      void bootDynamicData(root, runtimeFetcher(runtime));
    } };
  runtimes.set(root, runtime); return runtime;
}
export function bootSiteShellMenu(root: Document = document, _view: Window = window): void { bootMobileNavigation(root); }
export function bootPageEffects(root: Document = document, view: MotionWindow = window): void {
  const runtime = runtimeFor(root, view);
  pruneMobileNavigation(root, runtime.observer?.takeRecords() ?? []);
  hydrateTemplateRuntime(root); ensureSiteShellButtons(root);
  bootG7SystemControls(root, view, runtime.sessionChanged);
  bootSiteShellMenu(root, view); bootServiceActions(root, view);
  bootAccordions(root); bootTabs(root);
  const fetcher = runtimeFetcher(runtime);
  bootInquiryForms(root, fetcher); void bootDynamicData(root, fetcher);
  const reduced = typeof view.matchMedia === 'function' && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (root.querySelector('.g7pb-page')) bootPageSliders(root, reduced);
  else disposePageSliders(root);
  bootPageMotion(root, view, reduced);
}
export function observePageEffects(root: Document = document, view: MotionWindow = window): void {
  const runtime = runtimeFor(root, view);
  if (runtime.observer) return;
  const Observer = root.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof Observer !== 'function') return;
  runtime.observer = new Observer(records => {
    if (!current(runtime)) return;
    pruneMobileNavigation(root, records);
    const elementType = root.defaultView?.Element ?? Element;
    const structural = records.some(record => record.type === 'attributes'
      ? record.attributeName !== null && record.target instanceof elementType
        && (dataAttributes.includes(record.attributeName) || record.target.getAttribute(record.attributeName) !== record.oldValue)
      : [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1
        && (!(node instanceof elementType) || !node.matches('script[data-g7pb-slider-asset]'))));
    if (!structural) return;
    if (runtime.scheduled) return;
    runtime.scheduled = true;
    queueMicrotask(() => {
      if (!current(runtime)) return;
      runtime.scheduled = false; bootPageEffects(root, view);
    });
  });
  runtime.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: observedAttributes });
  root.documentElement.dataset.g7pbEffectsObserverReady = 'true';
}
/** The entry calls this once; an explicit disposal also cancels pending DOMContentLoaded work. */
export function startPageEffects(root: Document = document, view: MotionWindow = window): void {
  const runtime = runtimeFor(root, view);
  if (runtime.starting) return;
  const start = (): void => {
    if (!current(runtime)) return;
    runtime.starting = null; bootPageEffects(root, view); observePageEffects(root, view);
  };
  if (root.readyState === 'loading') {
    runtime.starting = start; root.addEventListener('DOMContentLoaded', start, { once: true });
  } else start();
}
/** Explicit teardown. No new pagehide policy: the persisted pageshow session path remains installed. */
export function disposePageEffects(root: Document = document): void {
  const runtime = runtimes.get(root);
  if (runtime) {
    runtime.active = false; runtime.observer?.disconnect();
    if (runtime.starting) root.removeEventListener('DOMContentLoaded', runtime.starting);
    runtime.starting = null; runtime.scheduled = false; runtimes.delete(root);
  }
  disposePublicDataRuntime(root); disposeInquiryForms(root); disposeContentControls(root);
  disposeServiceActions(root); disposeG7SystemControls(root); disposeMobileNavigation(root);
  disposePageSliders(root); disposePageMotion(root);
  delete root.documentElement.dataset.g7pbEffectsObserverReady;
}
