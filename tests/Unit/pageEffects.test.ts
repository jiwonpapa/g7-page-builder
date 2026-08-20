import { afterEach, describe, expect, it, vi } from 'vitest';

import { bootPageEffects, bootSiteShellMenu, parseCounterText } from '../../resources/js/public/pageEffects';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('published page effects runtime', () => {
  it('parses localized numeric labels while preserving their prefix and suffix', () => {
    expect(parseCounterText('12,400+')).toEqual({ prefix: '', value: 12400, suffix: '+', decimals: 0 });
    expect(parseCounterText('가용성 99.9%')).toEqual({ prefix: '가용성 ', value: 99.9, suffix: '%', decimals: 1 });
    expect(parseCounterText('숫자 없음')).toBeNull();
  });

  it('activates typed effects and keeps the DOM content accessible without IntersectionObserver', () => {
    document.body.innerHTML = `
      <main class="g7pb-page">
        <section class="g7pb-block" data-g7pb-motion="stagger" data-g7pb-motion-stagger="60"><div class="g7pb-features__grid"><article class="g7pb-features__item">첫째</article><article class="g7pb-features__item">둘째</article></div></section>
        <section class="g7pb-block" data-g7pb-motion="counter" data-g7pb-motion-intensity="normal"><div class="g7pb-stats__grid"><article><strong>12,400+</strong></article></div></section>
        <section class="g7pb-block" data-g7pb-motion="chart-draw"><progress max="100" value="74">74</progress></section>
        <section class="g7pb-block" data-g7pb-motion="parallax-soft"><figure><img src="/safe.webp" alt="안전"></figure></section>
      </main>`;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now() + 2_000);
      return 1;
    });

    bootPageEffects(document, window);

    expect(document.querySelector('.g7pb-page')?.classList.contains('g7pb-motion-active')).toBe(true);
    expect(document.querySelectorAll('.is-inview')).toHaveLength(4);
    expect(document.querySelectorAll('[data-g7pb-motion-item]')).toHaveLength(3);
    expect(document.querySelector('.g7pb-motion-parallax-target')).not.toBeNull();
    expect(document.querySelector('[data-g7pb-counter-original]')?.textContent).toBe('12,400+');
    expect(document.querySelector('strong')?.getAttribute('aria-label')).toBe('12,400+');
  });

  it('does not install motion when the visitor asks for reduced motion', () => {
    document.body.innerHTML = '<main class="g7pb-page"><section class="g7pb-block" data-g7pb-motion="reveal">항상 보이는 콘텐츠</section></main>';
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    bootPageEffects(document, window);

    const page = document.querySelector<HTMLElement>('.g7pb-page');
    expect(page?.dataset.g7pbMotionReduced).toBe('true');
    expect(page?.classList.contains('g7pb-motion-active')).toBe(false);
    expect(document.body.textContent).toContain('항상 보이는 콘텐츠');
  });

  it('opens and closes the accessible mobile site menu without hiding desktop navigation', () => {
    document.body.innerHTML = `
      <header data-g7pb-site-header>
        <button type="button" aria-expanded="false" aria-controls="site-menu" data-g7pb-menu-toggle>메뉴</button>
        <nav id="site-menu" data-g7pb-mobile-menu hidden><a href="/pages/about">소개</a></nav>
      </header>
      <main class="g7pb-page"></main>`;

    bootSiteShellMenu(document, window);
    const toggle = document.querySelector<HTMLButtonElement>('[data-g7pb-menu-toggle]');
    const menu = document.querySelector<HTMLElement>('[data-g7pb-mobile-menu]');

    toggle?.click();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.hidden).toBe(false);
    expect(document.documentElement.classList.contains('g7pb-menu-open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });
});
