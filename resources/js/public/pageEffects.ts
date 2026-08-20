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

const MOTION_SELECTOR = '.g7pb-block[data-g7pb-motion]';
const SLIDER_SELECTOR = '[data-g7pb-slider]';
const STAGGER_TARGETS = [
  '.g7pb-features__item',
  '.g7pb-logo-cloud li',
  '.g7pb-stats__grid article',
  '.g7pb-pricing__plan',
  '.g7pb-team__grid article',
  '.g7pb-gallery__grid figure',
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
  bootSiteShellMenu(root, view);
  const page = root.querySelector<HTMLElement>('.g7pb-page');
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(MOTION_SELECTOR));
  if (!page) return;

  const reducedMotion = typeof view.matchMedia === 'function'
    && view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  bootPageSliders(root, reducedMotion);
  if (blocks.length === 0) return;

  if (reducedMotion) {
    page.dataset.g7pbMotionReduced = 'true';
    return;
  }

  blocks.forEach(prepareBlock);
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

  blocks.forEach((block) => observer.observe(block));
}

export function bootSiteShellMenu(root: Document = document, view: Window = window): void {
  const toggle = root.querySelector<HTMLButtonElement>('[data-g7pb-menu-toggle]');
  const menu = root.querySelector<HTMLElement>('[data-g7pb-mobile-menu]');
  if (!toggle || !menu || toggle.dataset.g7pbMenuReady === 'true') return;

  const close = (restoreFocus = false): void => {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', '메뉴 열기');
    menu.hidden = true;
    root.documentElement.classList.remove('g7pb-menu-open');
    if (restoreFocus) toggle.focus();
  };
  const open = (): void => {
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', '메뉴 닫기');
    menu.hidden = false;
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
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
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

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bootPageEffects(), { once: true });
  } else {
    bootPageEffects();
  }
}
