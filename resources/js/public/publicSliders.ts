import EmblaCarousel from 'embla-carousel';
import Autoplay from 'embla-carousel-autoplay';
import { ensureSliderControls } from './publicSliderControls';

export { ensureSliderControls } from './publicSliderControls';

interface SliderMount { nodes: Element[]; inputs: string; reduced: boolean; dispose: () => void }
interface SliderRuntime {
  root: Document;
  active: boolean;
  mounts: Map<HTMLElement, SliderMount>;
  observer: MutationObserver;
}
const runtimes = new WeakMap<Document, SliderRuntime>();
const attributes = ['data-g7pb-slider', 'data-g7pb-slider-loop', 'data-g7pb-slider-autoplay', 'data-g7pb-slider-interval'];
const signature = (slider: HTMLElement, reduced: boolean): string => JSON.stringify([reduced, ...attributes.map(key => slider.getAttribute(key))]);
function nodes(slider: HTMLElement): Element[] {
  return Array.from(slider.querySelectorAll('.g7pb-hero-slider__viewport,.g7pb-hero-slider__track,.g7pb-hero-slider__slide,.g7pb-hero-slider__controls,[data-g7pb-slider-prev],[data-g7pb-slider-next],[data-g7pb-slider-toggle],[data-g7pb-slider-dots],[data-g7pb-slider-dot],[data-g7pb-slider-status]'));
}
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
export function disposePageSliders(root: Document = document): void {
  const runtime = runtimes.get(root); if (!runtime) return;
  runtime.active = false; runtime.observer.disconnect();
  for (const mount of runtime.mounts.values()) mount.dispose();
  runtime.mounts.clear(); runtimes.delete(root);
}
export function bootPageSliders(root: Document = document, reducedMotion = false): void {
  let runtime = runtimes.get(root);
  if (!runtime) {
    const observer = new MutationObserver(records => { if (runtime) prune(runtime, records); });
    runtime = { root, active: true, mounts: new Map(), observer }; runtimes.set(root, runtime);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: attributes });
  }
  prune(runtime, runtime.observer.takeRecords());
  const owner = runtime;
  for (const slider of root.querySelectorAll<HTMLElement>('[data-g7pb-slider]')) {
    const inputs = signature(slider, reducedMotion);
    const existing = owner.mounts.get(slider);
    if (existing?.inputs === inputs) continue;
    if (existing) { owner.mounts.delete(slider); existing.dispose(); }
    const viewport = slider.querySelector<HTMLElement>('.g7pb-hero-slider__viewport');
    const slides = Array.from(slider.querySelectorAll<HTMLElement>('.g7pb-hero-slider__slide'));
    if (!viewport || slides.length < 2) continue;
    const wantsAutoplay = slider.dataset.g7pbSliderAutoplay === 'true' && !reducedMotion;
    ensureSliderControls(root, slider, wantsAutoplay);
    const autoplay = wantsAutoplay ? Autoplay({ delay: Number(slider.dataset.g7pbSliderInterval ?? 5000), stopOnInteraction: true, stopOnMouseEnter: true }) : undefined;
    const embla = EmblaCarousel(viewport, { loop: slider.dataset.g7pbSliderLoop !== 'false' }, autoplay ? [autoplay] : []);
    const previous = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-prev]');
    const next = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]');
    const toggle = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-toggle]');
    const dotsRoot = slider.querySelector<HTMLElement>('[data-g7pb-slider-dots]');
    const status = slider.querySelector<HTMLElement>('[data-g7pb-slider-status]');
    const cleanups: (() => void)[] = [];
    const original = slides.map(slide => ({ hidden: slide.getAttribute('aria-hidden'), inert: slide.inert }));
    let active = true;
    const current = (): boolean => {
      prune(owner, owner.observer.takeRecords());
      return active && owner.active && runtimes.get(root) === owner && owner.mounts.get(slider) === mount;
    };
    const on = (node: HTMLElement | null, handler: () => void): void => {
      const click = (): void => { if (current()) handler(); };
      node?.addEventListener('click', click); cleanups.push(() => node?.removeEventListener('click', click));
    };
    const dots = slides.map((_, index) => {
      const dot = root.createElement('button'); dot.type = 'button'; dot.dataset.g7pbSliderDot = String(index);
      dot.setAttribute('aria-label', `${index + 1}번 슬라이드`); on(dot, () => embla.scrollTo(index)); return dot;
    });
    dotsRoot?.replaceChildren(...dots);
    const update = (): void => {
      if (!current()) return;
      const selected = embla.selectedScrollSnap();
      dots.forEach((dot, index) => { dot.classList.toggle('is-active', index === selected); dot.setAttribute('aria-current', index === selected ? 'true' : 'false'); });
      slides.forEach((slide, index) => { slide.setAttribute('aria-hidden', index === selected ? 'false' : 'true'); slide.inert = index !== selected; });
      const label = `${selected + 1} / ${slides.length}`;
      if (status && status.textContent !== label) status.textContent = label;
      if (previous) previous.disabled = !embla.canScrollPrev();
      if (next) next.disabled = !embla.canScrollNext();
    };
    on(previous, () => embla.scrollPrev()); on(next, () => embla.scrollNext());
    const paintAutoplay = (): void => {
      if (!toggle || !autoplay) return;
      toggle.textContent = autoplay.isPlaying() ? '일시 정지' : '재생';
      toggle.setAttribute('aria-label', autoplay.isPlaying() ? '자동 재생 일시 정지' : '자동 재생 시작');
    };
    on(toggle, () => { if (!autoplay) return; if (autoplay.isPlaying()) autoplay.stop(); else autoplay.play(); paintAutoplay(); });
    paintAutoplay();
    const mount: SliderMount = { inputs, reduced: reducedMotion, nodes: nodes(slider), dispose: () => {
      if (!active) return; active = false;
      cleanups.forEach(dispose => dispose()); embla.off('select', update); embla.off('reInit', update); embla.destroy();
      dots.forEach(dot => dot.remove());
      slides.forEach((slide, index) => {
        const value = original[index]; if (value.hidden === null) slide.removeAttribute('aria-hidden'); else slide.setAttribute('aria-hidden', value.hidden);
        slide.inert = value.inert;
      });
      delete slider.dataset.g7pbSliderReady;
    } };
    // Setup can move existing controls; these records belong to the setup, before this mount owns them.
    prune(owner, owner.observer.takeRecords()); owner.mounts.set(slider, mount);
    embla.on('select', update); embla.on('reInit', update); slider.dataset.g7pbSliderReady = 'true'; update();
  }
}
