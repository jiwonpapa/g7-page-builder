import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmblaCarouselType } from 'embla-carousel';
import { bootPageSliders, disposePageSliders } from '../../resources/js/public/publicSliders';
import { ensureSliderControls } from '../../resources/js/public/publicSliderControls';

const observed = vi.hoisted<{ instances: EmblaCarouselType[] }>(() => ({ instances: [] }));
const scopedRoots = new Set<HTMLElement>();
vi.mock('embla-carousel', async importOriginal => {
  const original = await importOriginal<typeof import('embla-carousel')>();
  return { ...original, default: (...args: Parameters<typeof original.default>) => {
    const instance = original.default(...args);
    vi.spyOn(instance, 'destroy'); vi.spyOn(instance, 'off'); vi.spyOn(instance, 'scrollNext');
    observed.instances.push(instance); return instance;
  } };
});
function fixture() {
  document.body.innerHTML = '<main class="g7pb-page"><section data-g7pb-slider data-g7pb-slider-loop="false"><div class="g7pb-hero-slider__viewport"><div class="g7pb-hero-slider__track">' +
    [1, 2, 3].map(index => `<article class="g7pb-hero-slider__slide"><a href="/slide-${index}">Slide ${index}</a></article>`).join('') +
    '</div></div><div class="g7pb-hero-slider__controls"><div data-g7pb-slider-dots></div></div><p data-g7pb-slider-status></p></section></main>';
  const slider = document.querySelector<HTMLElement>('[data-g7pb-slider]')!;
  const size = (node: Element, left = 0) => Object.defineProperties(node, {
    offsetWidth: { configurable: true, value: 600 }, offsetHeight: { configurable: true, value: 200 },
    offsetLeft: { configurable: true, value: left }, offsetTop: { configurable: true, value: 0 },
  });
  size(slider.querySelector('.g7pb-hero-slider__viewport')!); size(slider.querySelector('.g7pb-hero-slider__track')!);
  slider.querySelectorAll<HTMLElement>('article').forEach((node, index) => { size(node, index * 600); node.style.marginRight = '0px'; });
  return slider;
}
function stableFixture(prefix = 'authored') {
  const slider = fixture(); slider.dataset.g7pbControlIds = 'stable'; slider.dataset.g7pbSliderInitial = '0';
  slider.id = prefix; scopedRoots.add(slider);
  const viewport = slider.querySelector<HTMLElement>('.g7pb-hero-slider__viewport')!;
  const track = slider.querySelector<HTMLElement>('.g7pb-hero-slider__track')!;
  viewport.dataset.g7pbSliderViewport = ''; viewport.id = prefix + '-viewport'; viewport.className = '';
  track.dataset.g7pbSliderTrack = ''; track.id = prefix + '-track'; track.className = ''; track.setAttribute('aria-live', 'polite');
  for (const [index, slide] of [...track.children].entries()) {
    slide.setAttribute('data-g7pb-slider-slide', ''); slide.id = prefix + '-slide-' + index; slide.className = '';
  }
  slider.querySelector('.g7pb-hero-slider__controls')!.remove();
  for (const [name, label] of [['prev', '이전 내용'], ['next', '다음 내용'], ['toggle', '자동 넘김']]) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.setAttribute('data-g7pb-slider-' + name, ''); button.id = prefix + '-' + name;
    button.setAttribute('aria-controls', viewport.id);
    if (name === 'toggle') { button.setAttribute('aria-pressed', 'false'); slider.prepend(button); } else slider.append(button);
  }
  return slider;
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => ++sequence);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  for (const root of scopedRoots) disposePageSliders(root);
  scopedRoots.clear();
  disposePageSliders(document); observed.instances.length = 0;
  document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
describe('public slider ownership with installed Embla', () => {
  it('mounts a stable element root once across overlapping roots and preserves authored controls', () => {
    const slider = stableFixture(), before = slider.innerHTML;
    ensureSliderControls(document, slider, true); expect(slider.innerHTML).toBe(before);
    bootPageSliders(slider); bootPageSliders(document); bootPageSliders(slider);
    expect(observed.instances).toHaveLength(1);
    const instance = observed.instances[0], next = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]')!;
    next.click(); expect(instance.selectedScrollSnap()).toBe(1); expect(instance.scrollNext).toHaveBeenCalledTimes(1);
    expect(slider.querySelector('[data-g7pb-slider-toggle]')?.textContent).toBe('자동 넘김');
    expect(slider.querySelector('[data-g7pb-slider-dot]')).toBeNull();
    disposePageSliders(slider); next.click(); expect(instance.scrollNext).toHaveBeenCalledTimes(1);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(slider.querySelector('[data-g7pb-slider-prev]')?.hasAttribute('disabled')).toBe(false);
    expect(slider.querySelector('[data-g7pb-slider-track]')?.getAttribute('aria-live')).toBe('polite');
    bootPageSliders(document); expect(observed.instances).toHaveLength(2);
  });
  it('rejects malformed stable references without mutation or a vendor instance', () => {
    const slider = stableFixture();
    slider.querySelector('[data-g7pb-slider-next]')!.setAttribute('aria-controls', 'foreign-viewport');
    const before = slider.innerHTML; bootPageSliders(slider);
    expect(observed.instances).toHaveLength(0); expect(slider.innerHTML).toBe(before);
    expect(slider.hasAttribute('data-g7pb-slider-ready')).toBe(false);
    slider.querySelector('[data-g7pb-slider-next]')!.setAttribute('aria-controls', slider.id + '-viewport');
    slider.dataset.g7pbSliderInitial = '9'; bootPageSliders(slider);
    expect(observed.instances).toHaveLength(0);
  });
  it('keeps nested authored slider control ownership independent', () => {
    const outer = stableFixture('outer'), inner = stableFixture('inner');
    document.body.append(outer); outer.querySelector('[data-g7pb-slider-slide]')!.append(inner);
    bootPageSliders(outer); expect(observed.instances).toHaveLength(2);
    const ownNext = (slider: HTMLElement) => [...slider.querySelectorAll<HTMLButtonElement>('[data-g7pb-slider-next]')]
      .find(button => button.closest('[data-g7pb-slider]') === slider)!;
    ownNext(inner).click(); expect(observed.instances[1].selectedScrollSnap()).toBe(1);
    expect(observed.instances[0].selectedScrollSnap()).toBe(0);
    ownNext(outer).click(); expect(observed.instances[0].selectedScrollSnap()).toBe(1);
    expect(observed.instances[1].selectedScrollSnap()).toBe(1);
  });
  it('pauses authored autoplay on focus and hover, preserves its label and respects reduced motion', () => {
    vi.useFakeTimers();
    const slider = stableFixture(); slider.dataset.g7pbSliderAutoplay = 'true'; bootPageSliders(slider);
    const instance = observed.instances[0], autoplay = instance.plugins().autoplay;
    const toggle = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-toggle]')!;
    expect(autoplay.isPlaying()).toBe(true); expect(toggle.getAttribute('aria-pressed')).toBe('true');
    toggle.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(autoplay.isPlaying()).toBe(false); expect(toggle.getAttribute('aria-pressed')).toBe('false');
    vi.advanceTimersByTime(10000); expect(instance.selectedScrollSnap()).toBe(0);
    toggle.click(); expect(autoplay.isPlaying()).toBe(true);
    slider.dispatchEvent(new MouseEvent('mouseenter')); expect(autoplay.isPlaying()).toBe(false);
    slider.dispatchEvent(new MouseEvent('mouseleave')); expect(autoplay.isPlaying()).toBe(false);
    toggle.click(); vi.advanceTimersByTime(5000); expect(instance.selectedScrollSnap()).toBe(1);
    expect(toggle.textContent).toBe('자동 넘김');
    bootPageSliders(slider, true);
    expect(instance.destroy).toHaveBeenCalledTimes(1); expect(autoplay.isPlaying()).toBe(false);
    expect(toggle.disabled).toBe(true); expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(observed.instances[1].plugins().autoplay).toBeUndefined();
    disposePageSliders(slider); expect(toggle.disabled).toBe(false);
    expect(toggle.textContent).toBe('자동 넘김'); expect(toggle.getAttribute('aria-pressed')).toBe('false');
  });
  it('keeps a single authored slide accessible with disabled navigation and stale controls inert', () => {
    const slider = stableFixture(), track = slider.querySelector('[data-g7pb-slider-track]')!;
    [...track.children].slice(1).forEach(node => node.remove());
    bootPageSliders(slider);
    expect(observed.instances).toHaveLength(1);
    expect(slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-prev]')!.disabled).toBe(true);
    expect(slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]')!.disabled).toBe(true);
    expect(track.firstElementChild?.getAttribute('aria-hidden')).toBe('false');
    const oldNext = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]')!;
    slider.remove(); oldNext.click();
    // A disabled native button cannot dispatch; disposal still follows root ownership.
    disposePageSliders(slider); expect(observed.instances[0].destroy).toHaveBeenCalledTimes(1);
  });
  it('connects a replacement control on the same slider and detaches the old one', () => {
    const slider = fixture(); bootPageSliders(document);
    const oldNext = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]')!;
    const next = document.createElement('button'); next.dataset.g7pbSliderNext = ''; oldNext.replaceWith(next);
    bootPageSliders(document); next.click();
    expect(observed.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(slider.querySelector('[data-g7pb-slider-status]')?.textContent).toBe('2 / 3');
    oldNext.click();
    expect(slider.querySelector('[data-g7pb-slider-status]')?.textContent).toBe('2 / 3');
  });

  it('keeps native dots and accessibility, disposes vendor callbacks, and reinstalls without duplicate dots', async () => {
    const slider = fixture(); bootPageSliders(document); bootPageSliders(document);
    slider.dataset.g7pbSliderLoop = 'false'; await Promise.resolve(); bootPageSliders(document);
    expect(observed.instances).toHaveLength(1);
    const instance = observed.instances[0];
    const last = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-dot="2"]')!;
    last.click(); expect(instance.selectedScrollSnap()).toBe(2);
    expect(last.getAttribute('aria-current')).toBe('true');
    const slides = [...slider.querySelectorAll<HTMLElement>('article')];
    expect(slides.map(slide => slide.getAttribute('aria-hidden'))).toEqual(['true', 'true', 'false']);
    expect(slides.map(slide => slide.inert)).toEqual([true, true, false]);
    disposePageSliders(document); disposePageSliders(document);
    expect(instance.destroy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(instance.off).mock.calls.map(([event]) => event)).toEqual(['select', 'reInit']);
    const status = slider.querySelector<HTMLElement>('[data-g7pb-slider-status]')!; status.textContent = 'Disposed';
    for (const [event, handler] of vi.mocked(instance.off).mock.calls) handler(instance, event);
    last.click(); expect(status.textContent).toBe('Disposed');
    expect(slider.querySelectorAll('[data-g7pb-slider-dot]')).toHaveLength(0);
    bootPageSliders(document);
    expect(observed.instances).toHaveLength(2); expect(slider.querySelectorAll('[data-g7pb-slider-dot]')).toHaveLength(3);
    slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-next]')!.click();
    expect(status.textContent).toBe('2 / 3');
  });

  it('stops the installed autoplay plugin and keeps reduced-motion controls manual after reinstall', () => {
    vi.useFakeTimers();
    const slider = fixture(); slider.dataset.g7pbSliderAutoplay = 'true';
    bootPageSliders(document);
    const original = observed.instances[0]; const autoplay = original.plugins().autoplay;
    expect(autoplay.isPlaying()).toBe(true);
    vi.advanceTimersByTime(5000); expect(original.selectedScrollSnap()).toBe(1);
    const oldToggle = slider.querySelector<HTMLButtonElement>('[data-g7pb-slider-toggle]')!;
    oldToggle.click(); expect(autoplay.isPlaying()).toBe(false);
    oldToggle.click(); expect(autoplay.isPlaying()).toBe(true);
    bootPageSliders(document, true);
    expect(original.destroy).toHaveBeenCalledTimes(1); expect(autoplay.isPlaying()).toBe(false);
    expect(slider.querySelector('[data-g7pb-slider-toggle]')).toBeNull();
    expect(observed.instances[1].plugins().autoplay).toBeUndefined();
    oldToggle.click(); vi.advanceTimersByTime(5000);
    expect(observed.instances[1].selectedScrollSnap()).toBe(0);
  });
});
