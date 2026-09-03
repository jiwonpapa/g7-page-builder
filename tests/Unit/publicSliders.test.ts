import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmblaCarouselType } from 'embla-carousel';
import { bootPageSliders } from '../../resources/js/public/pageEffects';
import { disposePageSliders } from '../../resources/js/public/publicSliders';

const observed = vi.hoisted<{ instances: EmblaCarouselType[] }>(() => ({ instances: [] }));
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
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => ++sequence);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  disposePageSliders(document); observed.instances.length = 0;
  document.body.innerHTML = ''; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});
describe('public slider ownership with installed Embla', () => {
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
