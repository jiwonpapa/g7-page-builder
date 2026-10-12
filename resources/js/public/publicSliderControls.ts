export function ensureSliderControls(root: Document, slider: HTMLElement, wantsAutoplay: boolean): void {
  if (slider.dataset.g7pbControlIds === 'stable') return;
  const controls = Array.from(slider.querySelectorAll<HTMLElement>('.g7pb-hero-slider__controls'))
    .find(node => node.closest('[data-g7pb-slider]') === slider);
  const dots = controls?.querySelector<HTMLElement>('[data-g7pb-slider-dots]');
  if (!controls || !dots) return;

  const createButton = (attribute: string, label: string, text: string): HTMLButtonElement => {
    const button = root.createElement('button');
    button.type = 'button';
    button.setAttribute(attribute, '');
    button.setAttribute('aria-label', label);
    button.textContent = text;
    return button;
  };

  const previous = controls.querySelector('[data-g7pb-slider-prev]')
    ?? createButton('data-g7pb-slider-prev', '이전 슬라이드', '←');
  const next = controls.querySelector('[data-g7pb-slider-next]')
    ?? createButton('data-g7pb-slider-next', '다음 슬라이드', '→');
  const existingToggle = controls.querySelector('[data-g7pb-slider-toggle]');
  controls.replaceChildren(previous, dots, next);

  if (wantsAutoplay) {
    const toggle = existingToggle
      ?? createButton('data-g7pb-slider-toggle', '자동 재생 일시 정지', '일시 정지');
    controls.append(toggle);
  }
}
import type { EmblaCarouselType } from 'embla-carousel';


/** Only the legacy output creates controls. Authored element trees keep their own. */
export const legacySliderControls = {
  prepare: ensureSliderControls,
  mount(root: Document, slider: HTMLElement, slides: HTMLElement[], embla: EmblaCarouselType,
    on: (node: HTMLElement | undefined, handler: () => void) => void) {
    const owned = <T extends HTMLElement>(query: string) => [...slider.querySelectorAll<T>(query)]
      .find(node => node.closest('[data-g7pb-slider]') === slider);
    const status = owned('[data-g7pb-slider-status]'), toggle = owned<HTMLButtonElement>('[data-g7pb-slider-toggle]');
    const dots = slides.map((_, index) => {
      const dot = root.createElement('button'); dot.type = 'button'; dot.dataset.g7pbSliderDot = String(index);
      dot.setAttribute('aria-label', (index + 1) + '번 슬라이드'); on(dot, () => embla.scrollTo(index)); return dot;
    });
    owned('[data-g7pb-slider-dots]')?.replaceChildren(...dots);
    return {
      update(selected: number) {
        dots.forEach((dot, index) => { dot.classList.toggle('is-active', index === selected); dot.setAttribute('aria-current', String(index === selected)); });
        const label = (selected + 1) + ' / ' + slides.length;
        if (status && status.textContent !== label) status.textContent = label;
      },
      autoplay(playing: boolean) {
        if (!toggle) return;
        toggle.textContent = playing ? '일시 정지' : '재생';
        toggle.setAttribute('aria-label', playing ? '자동 재생 일시 정지' : '자동 재생 시작');
      },
      dispose() { dots.forEach(dot => dot.remove()); },
    };
  },
};
