/** Only PB's v3 breakout width is owned here; host/theme layout is untouched. */
const PROPERTY = '--g7pb-template-viewport-width';
const SELECTOR = '.g7pb-template-body:has([data-g7pb-v3-public])';
interface OwnedWidth { value: string; priority: string; applied: string }

export function createTemplateViewportWidth(root: Document) {
  const view = root.defaultView;
  const owned = new Map<HTMLElement, OwnedWidth>();
  const restore = (element: HTMLElement, state: OwnedWidth): void => {
    if (element.style.getPropertyValue(PROPERTY) !== state.applied || element.style.getPropertyPriority(PROPERTY) !== '') return;
    if (state.value) element.style.setProperty(PROPERTY, state.value, state.priority);
    else element.style.removeProperty(PROPERTY);
  };
  const update = (): void => {
    const width = root.documentElement.clientWidth || view?.innerWidth || 0;
    if (width <= 0) return;
    const targets = new Set(root.querySelectorAll<HTMLElement>(SELECTOR));
    for (const [element, state] of owned) {
      if (!targets.has(element)) { restore(element, state); owned.delete(element); }
    }
    for (const element of targets) {
      const state = owned.get(element);
      if (state && (element.style.getPropertyValue(PROPERTY) !== state.applied || element.style.getPropertyPriority(PROPERTY) !== '')) continue;
      const next = width + 'px';
      if (state?.applied === next) continue;
      if (!state) owned.set(element, {
        value: element.style.getPropertyValue(PROPERTY), priority: element.style.getPropertyPriority(PROPERTY), applied: next,
      });
      else state.applied = next;
      element.style.setProperty(PROPERTY, next);
    }
  };
  const observer = view && typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(update) : null;
  observer?.observe(root.documentElement);
  view?.addEventListener('resize', update);
  return {
    update,
    dispose(): void {
      observer?.disconnect(); view?.removeEventListener('resize', update);
      for (const [element, state] of owned) restore(element, state);
      owned.clear();
    },
  };
}
