import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import { legacySliderControls } from './publicSliderControls';

export { ensureSliderControls } from './publicSliderControls';

type SliderRoot = Document | HTMLElement;
interface SliderMount { nodes: Element[]; inputs: string; reduced: boolean; dispose: () => void }
interface SliderRuntime { root: SliderRoot; active: boolean; mounts: Map<HTMLElement, SliderMount>; observer: MutationObserver }
const runtimes = new WeakMap<SliderRoot, SliderRuntime>();
const owners = new WeakMap<HTMLElement, { runtime: SliderRuntime; mount: SliderMount }>();
const attributes = ['data-g7pb-slider', 'data-g7pb-slider-loop', 'data-g7pb-slider-autoplay', 'data-g7pb-slider-interval',
  'data-g7pb-slider-initial', 'data-g7pb-control-ids', 'id', 'aria-controls'];
const selector = '.g7pb-hero-slider__viewport,.g7pb-hero-slider__track,.g7pb-hero-slider__slide,.g7pb-hero-slider__controls,' +
  '[data-g7pb-slider-viewport],[data-g7pb-slider-track],[data-g7pb-slider-slide],[data-g7pb-slider-prev],[data-g7pb-slider-next],' +
  '[data-g7pb-slider-toggle],[data-g7pb-slider-dots],[data-g7pb-slider-dot],[data-g7pb-slider-status]';
function owned<T extends HTMLElement>(slider: HTMLElement, query: string): T[] {
  return Array.from(slider.querySelectorAll<T>(query)).filter(node => node.closest('[data-g7pb-slider]') === slider);
}
function nodes(slider: HTMLElement): Element[] { return owned(slider, selector); }
const signature = (slider: HTMLElement, reduced: boolean): string => JSON.stringify([reduced,
  ...attributes.map(key => slider.getAttribute(key)), slider.dataset.g7pbControlIds === 'stable'
    ? nodes(slider).map(node => [node.id, node.getAttribute('aria-controls')]) : []]);
function prune(runtime: SliderRuntime, records: MutationRecord[]): void {
  if (!runtime.active) return;
  for (const [slider, mount] of runtime.mounts) {
    const actual = nodes(slider);
    if (!runtime.root.contains(slider) || !slider.isConnected || !slider.hasAttribute('data-g7pb-slider')
      || mount.inputs !== signature(slider, mount.reduced)
      || actual.length !== mount.nodes.length || actual.some((node, index) => node !== mount.nodes[index])
      || records.some(record => Array.from(record.removedNodes).some(node => node.contains(slider) || mount.nodes.some(target => node.contains(target))))) {
      runtime.mounts.delete(slider); mount.dispose();
    }
  }
}
export function disposePageSliders(root: SliderRoot = document): void {
  const runtime = runtimes.get(root); if (!runtime) return;
  runtime.active = false; runtime.observer.disconnect();
  for (const mount of runtime.mounts.values()) mount.dispose();
  runtime.mounts.clear(); runtimes.delete(root);
}
function restoreAttributes(node: HTMLElement, names: string[]): () => void {
  const values = names.map(name => [name, node.getAttribute(name)] as const);
  return () => values.forEach(([name, value]) => value === null ? node.removeAttribute(name) : node.setAttribute(name, value));
}
export function bootPageSliders(root: SliderRoot = document, reducedMotion = false): void {
  bootSliders(root, reducedMotion, legacySliderControls);
}
/** Independent previews never import the legacy generated-control UI. */
export function bootAuthoredSliders(root: SliderRoot, reducedMotion = false): void {
  bootSliders(root, reducedMotion);
}
function bootSliders(root: SliderRoot, reducedMotion: boolean, legacy?: typeof legacySliderControls): void {
  let runtime = runtimes.get(root);
  if (!runtime) {
    const observer = new MutationObserver(records => { if (runtime) prune(runtime, records); });
    runtime = { root, active: true, mounts: new Map(), observer }; runtimes.set(root, runtime);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
  }
  prune(runtime, runtime.observer.takeRecords());
  const owner = runtime, dom = 'createElement' in root ? root : root.ownerDocument;
  const hosts = [...('matches' in root && root.matches('[data-g7pb-slider]') ? [root] : []), ...root.querySelectorAll<HTMLElement>('[data-g7pb-slider]')];
  for (const slider of hosts) {
    const other = owners.get(slider);
    if (other && other.runtime !== owner) {
      prune(other.runtime, other.runtime.observer.takeRecords());
      if (owners.has(slider)) continue;
    }
    const inputs = signature(slider, reducedMotion), stable = slider.dataset.g7pbControlIds === 'stable';
    if (!stable && !legacy) continue;
    const existing = owner.mounts.get(slider);
    if (existing?.inputs === inputs) continue;
    if (existing) { owner.mounts.delete(slider); existing.dispose(); }
    const viewport = owned(slider, stable ? '[data-g7pb-slider-viewport]' : '.g7pb-hero-slider__viewport')[0];
    const track = owned(slider, stable ? '[data-g7pb-slider-track]' : '.g7pb-hero-slider__track')[0];
    const slides = owned(slider, stable ? '[data-g7pb-slider-slide]' : '.g7pb-hero-slider__slide');
    if (!viewport || !track || slides.length < (stable ? 1 : 2)) continue;
    const wantsAutoplay = slider.dataset.g7pbSliderAutoplay === 'true' && !reducedMotion;
    if (!stable) legacy?.prepare(dom, slider, wantsAutoplay);
    const previous = owned<HTMLButtonElement>(slider, '[data-g7pb-slider-prev]')[0];
    const next = owned<HTMLButtonElement>(slider, '[data-g7pb-slider-next]')[0];
    const toggle = owned<HTMLButtonElement>(slider, '[data-g7pb-slider-toggle]')[0];
    if (stable) {
      const parts = [viewport, track, ...slides, previous, next, ...(toggle ? [toggle] : [])];
      if (!previous || !next || parts.some(node => !node?.id) || new Set(parts.map(node => node.id)).size !== parts.length
        || viewport.children.length !== 1 || track.parentElement !== viewport || track.children.length !== slides.length
        || slides.some(slide => slide.parentElement !== track)
        || [previous, next, ...(toggle ? [toggle] : [])].some(button => button.tagName !== 'BUTTON' || button.getAttribute('aria-controls') !== viewport.id || viewport.contains(button))
        || slider.dataset.g7pbSliderAutoplay === 'true' && !toggle) continue;
    }
    const initial = Number(slider.dataset.g7pbSliderInitial ?? 0);
    if (stable && (!Number.isInteger(initial) || initial < 0 || initial >= slides.length)) continue;
    const autoplay = !reducedMotion && (stable ? Boolean(toggle) && slides.length > 1 : wantsAutoplay)
      ? Autoplay({ delay: Number(slider.dataset.g7pbSliderInterval ?? 5000), playOnInit: wantsAutoplay,
        stopOnInteraction: true, stopOnMouseEnter: true, stopOnFocusIn: true }) : undefined;
    const embla = EmblaCarousel(viewport, { loop: slider.dataset.g7pbSliderLoop !== 'false',
      ...(stable ? { container: track, slides, startIndex: initial } : {}) }, autoplay ? [autoplay] : []);
    const cleanups: (() => void)[] = [];
    const original = slides.map(slide => ({ hidden: slide.getAttribute('aria-hidden'), inert: slide.inert }));
    if (stable) {
      for (const button of [previous, next, ...(toggle ? [toggle] : [])]) cleanups.push(restoreAttributes(button, ['disabled', 'aria-pressed', 'aria-label']));
      cleanups.push(restoreAttributes(track, ['aria-live']));
    }
    let active = true;
    const current = (): boolean => {
      prune(owner, owner.observer.takeRecords());
      return active && owner.active && runtimes.get(root) === owner && owner.mounts.get(slider) === mount;
    };
    const on = (node: HTMLElement | undefined, handler: () => void): void => {
      const click = (): void => { if (current()) handler(); };
      node?.addEventListener('click', click); cleanups.push(() => node?.removeEventListener('click', click));
    };
    const controls = stable ? undefined : legacy?.mount(dom, slider, slides, embla, on);
    const update = (): void => {
      if (!current()) return;
      const selected = embla.selectedScrollSnap(), visible = stable ? embla.slidesInView() : [];
      controls?.update(selected);
      slides.forEach((slide, index) => {
        const shown = visible.length ? visible.includes(index) : index === selected;
        slide.setAttribute('aria-hidden', shown ? 'false' : 'true'); slide.inert = !shown;
      });
      if (previous) previous.disabled = !embla.canScrollPrev();
      if (next) next.disabled = !embla.canScrollNext();
    };
    on(previous, () => { if (stable) autoplay?.stop(); embla.scrollPrev(); });
    on(next, () => { if (stable) autoplay?.stop(); embla.scrollNext(); });
    const paintAutoplay = (playing = autoplay?.isPlaying() === true): void => {
      if (!current()) return;
      if (stable) {
        track.setAttribute('aria-live', playing ? 'off' : 'polite');
        if (toggle) { toggle.setAttribute('aria-pressed', String(playing)); toggle.disabled = !autoplay; }
      } else if (autoplay) controls?.autoplay(playing);
    };
    // Embla emits these events before updating isPlaying(), so the event owns this paint.
    const autoplayStarted = () => paintAutoplay(true), autoplayStopped = () => paintAutoplay(false);
    if (stable && autoplay) {
      const pause = () => { if (current()) autoplay.stop(); };
      slider.addEventListener('focusin', pause); slider.addEventListener('mouseenter', pause);
      cleanups.push(() => { slider.removeEventListener('focusin', pause); slider.removeEventListener('mouseenter', pause); });
    }
    on(toggle, () => { if (!autoplay) return; if (autoplay.isPlaying()) autoplay.stop(); else autoplay.play(); paintAutoplay(); });
    const mount: SliderMount = { inputs, reduced: reducedMotion, nodes: nodes(slider), dispose: () => {
      if (!active) return; active = false;
      cleanups.forEach(dispose => dispose()); embla.off('select', update); embla.off('reInit', update);
      if (stable) embla.off('slidesInView', update);
      if (autoplay) { embla.off('autoplay:play', autoplayStarted); embla.off('autoplay:stop', autoplayStopped); }
      embla.destroy(); controls?.dispose();
      slides.forEach((slide, index) => {
        const value = original[index]; if (value.hidden === null) slide.removeAttribute('aria-hidden'); else slide.setAttribute('aria-hidden', value.hidden);
        slide.inert = value.inert;
      });
      if (owners.get(slider)?.mount === mount) owners.delete(slider);
      delete slider.dataset.g7pbSliderReady;
    } };
    prune(owner, owner.observer.takeRecords()); owner.mounts.set(slider, mount); owners.set(slider, { runtime: owner, mount });
    embla.on('select', update); embla.on('reInit', update);
    if (stable) embla.on('slidesInView', update);
    if (autoplay) { embla.on('autoplay:play', autoplayStarted); embla.on('autoplay:stop', autoplayStopped); }
    slider.dataset.g7pbSliderReady = 'true'; update(); paintAutoplay();
  }
}
