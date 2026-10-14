/** Runtime-only placement. The native top layer keeps authored transforms and
 * clipping from trapping a panel, without moving its DOM or breaking events. */
const GUTTER = 16;
const GAP = 12;
const properties = ['position', 'top', 'right', 'bottom', 'left', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'overflow-x', 'overflow-y'] as const;
type Property = typeof properties[number];
interface PropertyOwner { value: string; priority: string; applied: string }
interface Placement {
  panel: HTMLElement; trigger: HTMLElement; originalPopover: string | null; native: boolean;
  styles: Map<Property, PropertyOwner>;
}
const clamp = (value: number, minimum: number, maximum: number): number => Math.max(minimum, Math.min(maximum, value));

export function createShellPopoverPlacement(doc: Document) {
  const view = doc.defaultView;
  const active = new Map<HTMLElement, Placement>();
  const set = (state: Placement, name: Property, value: string): void => {
    const style = state.panel.style;
    if (!state.styles.has(name)) state.styles.set(name, {
      value: style.getPropertyValue(name), priority: style.getPropertyPriority(name), applied: '',
    });
    style.setProperty(name, value);
    state.styles.get(name)!.applied = style.getPropertyValue(name);
  };
  const close = (panel: HTMLElement): void => {
    const state = active.get(panel);
    if (!state) return;
    active.delete(panel); observer?.unobserve(panel);
    if (state.native && panel.getAttribute('popover') === 'manual') {
      try { panel.hidePopover(); } catch { /* A detached/already hidden owned panel needs no second close. */ }
      if (state.originalPopover === null) panel.removeAttribute('popover');
      else panel.setAttribute('popover', state.originalPopover);
    }
    for (const [name, owned] of state.styles) {
      if (panel.style.getPropertyValue(name) !== owned.applied || panel.style.getPropertyPriority(name) !== '') continue;
      if (owned.value) panel.style.setProperty(name, owned.value, owned.priority);
      else panel.style.removeProperty(name);
    }
  };
  const update = (): void => {
    if (!view) return;
    const viewport = view.visualViewport;
    const width = viewport?.width ?? (doc.documentElement.clientWidth || view.innerWidth);
    const height = viewport?.height ?? (doc.documentElement.clientHeight || view.innerHeight);
    const x = viewport?.offsetLeft ?? 0, y = viewport?.offsetTop ?? 0;
    const gutter = Math.min(GUTTER, width / 4, height / 4);
    for (const state of active.values()) {
      if (!state.panel.isConnected || !state.trigger.isConnected || state.panel.hidden) { close(state.panel); continue; }
      set(state, 'max-width', Math.max(1, width - gutter * 2) + 'px');
      set(state, 'max-height', Math.max(1, height - gutter * 2) + 'px');
      const anchor = state.trigger.getBoundingClientRect(), panel = state.panel.getBoundingClientRect();
      let top = anchor.bottom + GAP;
      if (top + panel.height > y + height - gutter && anchor.top - GAP - panel.height >= y + gutter) {
        top = anchor.top - GAP - panel.height;
      }
      set(state, 'left', clamp(anchor.right - panel.width, x + gutter, x + width - gutter - panel.width) + 'px');
      set(state, 'top', clamp(top, y + gutter, y + height - gutter - panel.height) + 'px');
    }
  };
  const observer = view && typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(update) : null;
  const scrolled = (event: Event): void => {
    if ([...active.keys()].some(panel => event.target instanceof Node && panel.contains(event.target))) return;
    update();
  };
  doc.addEventListener('scroll', scrolled, true);
  view?.addEventListener('resize', update);
  view?.visualViewport?.addEventListener('resize', update);
  view?.visualViewport?.addEventListener('scroll', update);
  return {
    open(trigger: HTMLElement, panel: HTMLElement): void {
      close(panel);
      if (!view || !panel.isConnected || !trigger.isConnected) return;
      const state: Placement = { panel, trigger, originalPopover: panel.getAttribute('popover'), native: false, styles: new Map() };
      active.set(panel, state);
      set(state, 'position', 'fixed'); set(state, 'right', 'auto'); set(state, 'bottom', 'auto');
      for (const name of ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] as const) set(state, name, '0px');
      set(state, 'overflow-x', 'auto'); set(state, 'overflow-y', 'auto');
      if (typeof panel.showPopover === 'function' && typeof panel.hidePopover === 'function') {
        panel.setAttribute('popover', 'manual');
        try { panel.showPopover(); state.native = true; }
        catch {
          if (state.originalPopover === null) panel.removeAttribute('popover');
          else panel.setAttribute('popover', state.originalPopover);
        }
      }
      update(); observer?.observe(panel);
    },
    close,
    dispose(): void {
      for (const panel of [...active.keys()]) close(panel);
      observer?.disconnect(); doc.removeEventListener('scroll', scrolled, true);
      view?.removeEventListener('resize', update);
      view?.visualViewport?.removeEventListener('resize', update);
      view?.visualViewport?.removeEventListener('scroll', update);
    },
  };
}
