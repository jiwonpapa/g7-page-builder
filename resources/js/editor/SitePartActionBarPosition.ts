import { useLayoutEffect, useRef } from 'react';
import { inverseScaledTranslation, placeEditorOverlay, renderedElementScale, visibleOwnerViewport } from './editorOverlaySafeZone';

/** Share the page editor's placement math without importing its editor kernel. */
export function useSitePartActionBarPosition(): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = ref.current;
    const anchor = bar?.closest<HTMLElement>('[data-puck-overlay]');
    const doc = bar?.ownerDocument;
    const win = doc?.defaultView;
    if (!bar || !anchor || !doc || !win) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const place = (): void => {
      frame = 0;
      const clip = visibleOwnerViewport(bar);
      if (!clip) return;
      const rect = bar.getBoundingClientRect();
      const scale = renderedElementScale(bar, rect);
      const target = placeEditorOverlay({ anchorRect: anchor.getBoundingClientRect(), overlaySize: rect, visibleClip: clip, gap: 8, inset: 8 });
      const delta = inverseScaledTranslation({ currentRect: rect, target, renderedScale: scale });
      x += delta.x;
      y += delta.y;
      bar.style.setProperty('--g7pb-site-part-toolbar-x', `${x}px`);
      bar.style.setProperty('--g7pb-site-part-toolbar-y', `${y}px`);
      bar.dataset.placement = target.placement;
    };
    const schedule = (): void => { if (!frame) frame = win.requestAnimationFrame(place); };
    const size = new win.ResizeObserver(schedule);
    size.observe(bar);
    size.observe(anchor);
    const position = new win.MutationObserver(schedule);
    position.observe(anchor, { attributes: true, attributeFilter: ['style'] });
    if (bar.parentElement) position.observe(bar.parentElement, { attributes: true, attributeFilter: ['style'] });
    const host = win.frameElement;
    const hostWin = host?.ownerDocument.defaultView;
    const hostSize = hostWin ? new hostWin.ResizeObserver(schedule) : null;
    if (hostSize && host) {
      for (let element: Element | null = host; element; element = element.parentElement) hostSize.observe(element);
    }
    doc.addEventListener('scroll', schedule, true);
    win.addEventListener('resize', schedule);
    host?.ownerDocument.addEventListener('scroll', schedule, true);
    place();
    return () => {
      win.cancelAnimationFrame(frame);
      size.disconnect();
      position.disconnect();
      hostSize?.disconnect();
      doc.removeEventListener('scroll', schedule, true);
      win.removeEventListener('resize', schedule);
      host?.ownerDocument.removeEventListener('scroll', schedule, true);
    };
  }, []);
  return ref;
}
