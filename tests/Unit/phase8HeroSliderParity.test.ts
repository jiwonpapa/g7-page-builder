import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import type { HeroSlideItem } from '../../resources/js/documents/builtinBlockContracts';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { HeroSliderPreview } = await import('../../resources/js/editor/catalogPreviews');
const { DEFAULT_HERO_SLIDER } = await import('../../resources/js/editor/catalogData');
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach((run) => run())); });

const slides: HeroSlideItem[] = Array.from({ length: 3 }, (_, index) => ({
  eyebrow: `Tag ${index}`, title: `Slide ${index}`, body: `Body ${index}`,
  buttonLabel: `Action ${index}`, buttonUrl: `/action-${index}`, imageSrc: '', imageAlt: '',
}));

function element<T extends HTMLElement>(host: HTMLElement, selector: string): T {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  cleanup.push(() => { root.unmount(); host.remove(); });
  return { host,
    async render(items = slides, loop: 'yes' | 'no' = 'yes') {
      await act(async () => root.render(React.createElement(HeroSliderPreview,
        { ...DEFAULT_HERO_SLIDER, id: 'synthetic-slider', slides: items, loop })));
    },
    async click(testId: string) {
      await act(async () => element<HTMLButtonElement>(host, `[data-testid="page-builder-slider-${testId}"]`).click());
    },
    active() { return host.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.dataset.testid; },
  };
}

describe('hero slider editor parity', () => {
  it('keeps every slide and input DOM while clicks reorder the selected slide', async () => {
    const view = mount();
    await view.render();
    const articles = Array.from(view.host.querySelectorAll<HTMLElement>('[data-slide-index]'));
    const title = element<HTMLElement>(view.host, '[data-g7pb-inline-field="slides.0.title"]');
    expect(articles).toHaveLength(3);
    expect(articles.map((article) => article.style.order)).toEqual(['-1', '1', '2']);
    await view.click('slide-2');
    expect(view.active()).toBe('page-builder-slider-slide-2');
    expect(articles.map((article) => article.style.order)).toEqual(['0', '1', '-1']);
    expect(Array.from(view.host.querySelectorAll('[data-slide-index]'))).toEqual(articles);
    expect(element(view.host, '[data-g7pb-inline-field="slides.0.title"]')).toBe(title);
    expect(articles.every((article) => !article.hidden && article.getAttribute('aria-hidden') !== 'true')).toBe(true);
    expect(articles.map((article) => article.querySelector('[data-g7pb-richtext-display="h2"]')?.textContent))
      .toEqual(['Slide 0', 'Slide 1', 'Slide 2']);
    expect(element(view.host, '.g7pb-preview-hero-slider__controls').getAttribute('data-puck-overlay-portal')).toBe('true');
    await view.click('next');
    expect(view.active()).toBe('page-builder-slider-slide-0');
    await view.render(slides, 'no');
    await view.click('previous');
    expect(view.active()).toBe('page-builder-slider-slide-0');
    await view.click('slide-2');
    await view.click('next');
    expect(view.active()).toBe('page-builder-slider-slide-2');
  });

  it.each(['previous', 'next'] as const)('navigates %s from the visible clamped slide after shrinking', async (direction) => {
    const view = mount();
    await view.render();
    await view.click('slide-2');
    await view.render(slides.slice(0, 2));
    expect(view.active()).toBe('page-builder-slider-slide-1');
    await view.click(direction);
    expect(view.active()).toBe('page-builder-slider-slide-0');
    await view.render(slides);
    expect(view.active()).toBe('page-builder-slider-slide-0');
  });

  it('ignores navigation without slides and remains usable after slides are added', async () => {
    const view = mount();
    await view.render([]);
    await view.click('next');
    await view.click('previous');
    await view.render(slides);
    expect(view.active()).toBe('page-builder-slider-slide-0');
    await view.click('next');
    expect(view.active()).toBe('page-builder-slider-slide-1');
  });
});
