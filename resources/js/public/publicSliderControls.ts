export function ensureSliderControls(root: Document, slider: HTMLElement, wantsAutoplay: boolean): void {
  const controls = slider.querySelector<HTMLElement>('.g7pb-hero-slider__controls');
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
