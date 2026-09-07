import React, { useEffect, useState } from 'react';

export interface SliderProps {
  id?: string;
  slides?: unknown;
  autoplay?: boolean;
  interval?: number;
  editorAttrs?: Record<string, unknown>;
}
interface Slide { id: string; src: string; alt: string; caption: string }
function slidesOf(value: unknown): Slide[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 100).flatMap((item: unknown): Slide[] => {
    if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) return [];
    seen.add(item.id);
    const src = 'src' in item && typeof item.src === 'string' && /^(https?:\/\/|\/(?!\/))/.test(item.src)
      && !/[\u0000-\u0020\u007f\\]/.test(item.src) ? item.src : '';
    return [{ id: item.id, src, alt: 'alt' in item && typeof item.alt === 'string' ? item.alt : '',
      caption: 'caption' in item && typeof item.caption === 'string' ? item.caption : '' }];
  });
}
/** Shared React renderer. Editor attributes are injected by G7's renderer, never stored here. */
export function PageBuilderSlider({ id, slides: input, autoplay = false, interval = 5000, editorAttrs }: SliderProps): React.ReactElement {
  const slides = slidesOf(input);
  const editing = typeof editorAttrs?.['data-editor-id'] === 'string';
  const [index, setIndex] = useState(0);
  const [running, setRunning] = useState(autoplay);
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  const active = Math.min(index, Math.max(0, slides.length - 1));
  const delay = [1000, 3000, 5000].includes(interval) ? interval : 5000;
  const playing = running && !editing && !reduced && visible && slides.length > 1;
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motion = (): void => setReduced(media.matches);
    const visibility = (): void => setVisible(!document.hidden);
    motion(); visibility(); media.addEventListener('change', motion); document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => setRunning(autoplay), [autoplay]);
  useEffect(() => setIndex(current => Math.min(current, Math.max(0, slides.length - 1))), [slides.length]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setIndex(current => (current + 1) % slides.length), delay);
    return () => window.clearInterval(timer);
  }, [playing, slides.length, delay]);
  const go = (next: number): void => { setRunning(false); setIndex((next + slides.length) % slides.length); };
  return <section {...editorAttrs} id={id} className="g7pb-native-slider" aria-roledescription="carousel" aria-label="슬라이드"
    data-editing={editing ? 'true' : undefined} tabIndex={editing ? undefined : 0}
    onPointerEnter={() => setRunning(false)} onFocus={() => setRunning(false)}
    onKeyDown={event => {
      if (editing || !slides.length || event.target !== event.currentTarget) return;
      const next = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: slides.length - 1 }[event.key];
      if (next !== undefined) { event.preventDefault(); go(next); }
    }}>
    <div className="g7pb-native-slider-items" aria-live={playing || editing ? 'off' : 'polite'}>
      {slides.map((slide, position) => <figure key={slide.id} hidden={!editing && position !== active}
        role="group" aria-roledescription="slide" aria-label={`${position + 1} / ${slides.length}`}>
        {slide.src && <img src={slide.src} alt={slide.alt} />}
        {slide.caption && <figcaption>{slide.caption}</figcaption>}
      </figure>)}
      {!slides.length && <p>슬라이드가 없습니다.</p>}
    </div>
    {!editing && slides.length > 1 && <div className="g7pb-native-slider-controls">
      <button type="button" onClick={() => go(active - 1)}>이전 슬라이드</button>
      <span>{active + 1} / {slides.length}</span>
      <button type="button" onClick={() => go(active + 1)}>다음 슬라이드</button>
      <button type="button" disabled={reduced} aria-pressed={playing} onClick={() => setRunning(current => !current)}>
        {playing ? '자동 재생 중지' : '자동 재생 시작'}</button>
    </div>}
  </section>;
}
