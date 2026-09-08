import type { MouseEvent } from 'react';

/** Puck's native selection listener can stop events before React's bubble phase. */
function preventCanvasLinkNavigation(event: MouseEvent<HTMLElement>): void {
  const target = event.target;
  // Capability checking also works when the event originates in Puck's iframe realm.
  if (!('closest' in target) || typeof target.closest !== 'function') return;
  const link: Element | null = target.closest('a[href], area[href]');
  if (link && event.currentTarget.contains(link)) event.preventDefault();
  // Keep propagation intact: Puck still owns selection and inline editing.
}

/** Editor roots only; never attach these handlers to the public/preview viewer. */
export const canvasNavigationGuard = {
  onClickCapture: preventCanvasLinkNavigation,
  onAuxClickCapture: preventCanvasLinkNavigation,
};
