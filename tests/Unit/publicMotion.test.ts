import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootPageEffects, disposePageEffects } from '../../resources/js/public/pageEffects';
import { bootPageMotion, disposePageMotion } from '../../resources/js/public/publicMotion';

function controlledMotion() {
  const frames = new Map<number, FrameRequestCallback>();
  const observers: ControlledIntersection[] = [];
  class ControlledIntersection implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0.12];
    readonly targets = new Set<Element>();
    constructor(readonly callback: IntersectionObserverCallback) { observers.push(this); }
    observe(target: Element) { this.targets.add(target); }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
    takeRecords(): IntersectionObserverEntry[] { return []; }
    emit(target: Element, visible: boolean) {
      const rect = target.getBoundingClientRect();
      this.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0,
        boundingClientRect: rect, intersectionRect: rect, rootBounds: null, time: performance.now() }], this);
    }
  }
  vi.stubGlobal('IntersectionObserver', ControlledIntersection);
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.spyOn(performance, 'now').mockReturnValue(0);
  let sequence = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++sequence, callback); return sequence; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  return { frames, observers };
}

afterEach(() => {
  disposePageEffects(document);
  document.body.innerHTML = '';
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('public motion ownership', () => {
  it('ignores an earlier repeat counter frame after the block leaves and reenters', () => {
    const clock = controlledMotion();
    document.body.innerHTML = '<main class="g7pb-page"><section class="g7pb-block" data-g7pb-motion="counter" data-g7pb-motion-trigger="repeat"><div class="g7pb-stats__grid"><article><strong>1,200+</strong></article></div></section></main>';
    bootPageEffects(document, window);
    const block = document.querySelector<HTMLElement>('section')!;
    const number = block.querySelector('strong')!;
    const observer = clock.observers[0];
    observer.emit(block, true);
    const earlier = clock.frames.get(1)!;
    observer.emit(block, false); observer.emit(block, true);
    clock.frames.get(2)!(225);
    const restarted = number.textContent;
    earlier(900);
    expect(number.textContent).toBe(restarted);
  });

  it('restores counter text on teardown and rejects old frames and intersection entries after reinstall', () => {
    const clock = controlledMotion();
    document.body.innerHTML = '<main class="g7pb-page"><section class="g7pb-block" data-g7pb-motion="counter" data-g7pb-motion-trigger="repeat"><div class="g7pb-stats__grid"><article><strong>1,200+</strong></article></div></section></main>';
    const block = document.querySelector<HTMLElement>('section')!; const number = block.querySelector('strong')!;
    bootPageMotion(document, window); clock.observers[0].emit(block, true);
    const earlier = clock.frames.get(1)!; earlier(225);
    expect(number.textContent).not.toBe('1,200+');
    disposePageMotion(document);
    expect(number.textContent).toBe('1,200+'); expect(block.dataset.g7pbMotionReady).toBeUndefined();
    expect(clock.observers[0].targets.size).toBe(0);
    bootPageMotion(document, window); clock.observers[0].emit(block, true);
    expect(number.textContent).toBe('1,200+');
    clock.observers[1].emit(block, true);
    const fresh = [...clock.frames.values()].at(-1)!;
    earlier(900); expect(number.textContent).toBe('0+');
    fresh(900); expect(number.textContent).toBe('1,200+');
    expect(number.getAttribute('aria-label')).toBe('1,200+');
  });

  it('keeps the replacement parallax frame owned when a cancelled callback is already dequeued', () => {
    const clock = controlledMotion();
    document.body.innerHTML = '<main class="g7pb-page"><section class="g7pb-block" data-g7pb-motion="parallax-soft"><img src="/image.webp"></section></main>';
    const block = document.querySelector<HTMLElement>('section')!; const page = block.parentElement!;
    const added = vi.spyOn(window, 'addEventListener'); const removed = vi.spyOn(window, 'removeEventListener');
    bootPageMotion(document, window); bootPageMotion(document, window);
    expect(added.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(1);
    const earlier = clock.frames.get(1)!;
    block.remove(); bootPageMotion(document, window);
    expect(removed.mock.calls.filter(([name]) => name === 'scroll')).toHaveLength(1);
    page.append(block); bootPageMotion(document, window);
    const freshId = Math.max(...clock.frames.keys());
    earlier(100); expect(block.style.getPropertyValue('--g7pb-motion-progress')).toBe('');
    expect(clock.frames.has(freshId)).toBe(true);
    disposePageMotion(document);
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(freshId);
    expect(clock.frames.size).toBe(0);
  });
});
