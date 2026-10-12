interface ControlMount {
  host: HTMLElement;
  runtime: ControlRuntime;
  kind: 'accordion' | 'tabs';
  nodes: Element[];
  configuration: string;
  dispose: () => void;
}
type ControlRoot = Document | HTMLElement;
interface ControlRuntime { root: ControlRoot; mounts: Set<ControlMount>; observer: MutationObserver }
const runtimes = new WeakMap<ControlRoot, ControlRuntime>();
const owners = new WeakMap<HTMLElement, ControlMount>();
const hostSelector = '[data-g7pb-tabs],[data-g7pb-accordion]';
function owned<T extends HTMLElement>(host: HTMLElement, selector: string): T[] {
  return Array.from(host.querySelectorAll<T>(selector)).filter(node => node.closest(hostSelector) === host);
}
function hosts(root: ControlRoot, selector: string): HTMLElement[] {
  return [...('matches' in root && root.matches(selector) ? [root] : []), ...root.querySelectorAll<HTMLElement>(selector)];
}
function nodesFor(host: HTMLElement, kind: ControlMount['kind']): Element[] {
  return owned(host, kind === 'tabs' ? '[role="tablist"],[role="tab"],[role="tabpanel"]'
    : '[data-g7pb-accordion-item],[data-g7pb-accordion-trigger],[data-g7pb-accordion-panel],details');
}
function configuration(host: HTMLElement, kind: ControlMount['kind']): string {
  const stable = host.dataset.g7pbControlIds === 'stable';
  return JSON.stringify([kind === 'tabs' ? [host.dataset.blockId, host.dataset.g7pbTabsInitial]
    : host.dataset.g7pbAccordionBehavior, stable,
    stable ? nodesFor(host, kind).map(node => [node.id, node.getAttribute('aria-controls'), node.getAttribute('aria-labelledby')]) : [],
    kind === 'tabs' ? owned(host, '[role="tablist"]').map(node => node.getAttribute('aria-orientation')) : []]);
}
function matches(mount: ControlMount, root: ControlRoot): boolean {
  const nodes = nodesFor(mount.host, mount.kind);
  return mount.host.isConnected && root.contains(mount.host)
    && mount.host.matches(mount.kind === 'tabs' ? '[data-g7pb-tabs]' : '[data-g7pb-accordion]')
    && configuration(mount.host, mount.kind) === mount.configuration
    && nodes.length === mount.nodes.length && nodes.every((node, index) => node === mount.nodes[index]);
}
function reconcile(runtime: ControlRuntime, records: MutationRecord[]): void {
  for (const mount of runtime.mounts) {
    if (!matches(mount, runtime.root) || records.some(record => Array.from(record.removedNodes).some(node => node.contains(mount.host)))) {
      runtime.mounts.delete(mount); mount.dispose();
    }
  }
}
function available(host: HTMLElement): boolean {
  const previous = owners.get(host);
  if (previous) reconcile(previous.runtime, previous.runtime.observer.takeRecords());
  return !owners.has(host);
}
function runtimeFor(root: ControlRoot): ControlRuntime {
  const previous = runtimes.get(root);
  if (previous) { reconcile(previous, previous.observer.takeRecords()); return previous; }
  const observer = new MutationObserver(records => reconcile(runtime, records));
  const runtime: ControlRuntime = { root, mounts: new Set(), observer };
  observer.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-g7pb-tabs', 'data-g7pb-accordion', 'data-g7pb-tabs-initial', 'data-g7pb-accordion-behavior', 'data-block-id', 'role',
      'data-g7pb-control-ids', 'id', 'aria-controls', 'aria-labelledby', 'aria-orientation'] });
  runtimes.set(root, runtime); return runtime;
}
export function disposeContentControls(root: ControlRoot = document): void {
  const runtime = runtimes.get(root); if (!runtime) return;
  runtimes.delete(root); runtime.observer.disconnect();
  for (const mount of runtime.mounts) mount.dispose();
  runtime.mounts.clear();
}
function install(runtime: ControlRuntime, host: HTMLElement, kind: ControlMount['kind']) {
  let active = true; const cleanups: (() => void)[] = [];
  const mount: ControlMount = { host, runtime, kind, nodes: nodesFor(host, kind), configuration: configuration(host, kind),
    dispose: () => { active = false; cleanups.forEach(dispose => dispose());
      if (owners.get(host) === mount) owners.delete(host);
      if (kind === 'tabs') delete host.dataset.g7pbTabsReady; else delete host.dataset.g7pbAccordionReady; } };
  runtime.mounts.add(mount); owners.set(host, mount);
  const current = (): boolean => {
    reconcile(runtime, runtime.observer.takeRecords());
    return active && runtimes.get(runtime.root) === runtime && matches(mount, runtime.root);
  };
  return {
    current,
    cleanup(dispose: () => void) { cleanups.push(dispose); },
    on<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, listener: (event: HTMLElementEventMap[K]) => void, capture = false): void {
      const guarded = (event: HTMLElementEventMap[K]): void => { if (current()) listener(event); };
      target.addEventListener(type, guarded, capture);
      cleanups.push(() => target.removeEventListener(type, guarded, capture));
    },
  };
}

/** Authored inline display must not override hidden; restore it on reveal/dispose. */
function visibility(panel: HTMLElement, owner: ReturnType<typeof install>, stable: boolean) {
  const display = panel.style.getPropertyValue('display'), priority = panel.style.getPropertyPriority('display'), hidden = panel.hidden;
  const restore = () => { if (display) panel.style.setProperty('display', display, priority); else panel.style.removeProperty('display'); };
  if (stable) owner.cleanup(() => { restore(); panel.hidden = hidden; });
  return (open: boolean) => {
    panel.hidden = !open;
    if (stable) { if (open) restore(); else panel.style.setProperty('display', 'none'); }
  };
}
function restoreAttributes(node: HTMLElement, names: string[], owner: ReturnType<typeof install>): void {
  const values = names.map(name => [name, node.getAttribute(name)] as const);
  owner.cleanup(() => values.forEach(([name, value]) => value === null ? node.removeAttribute(name) : node.setAttribute(name, value)));
}

export function bootAccordions(root: ControlRoot = document): void {
  const runtime = runtimeFor(root);
  for (const accordion of hosts(root, '[data-g7pb-accordion]')) {
    if (!available(accordion)) continue;
    const items = owned(accordion, '[data-g7pb-accordion-item]');
    const stable = accordion.dataset.g7pbControlIds === 'stable';
    const parts = items.map(item => ({ item,
      trigger: owned(accordion, '[data-g7pb-accordion-trigger]').find(node => node.closest('[data-g7pb-accordion-item]') === item),
      panel: owned(accordion, '[data-g7pb-accordion-panel]').find(node => node.closest('[data-g7pb-accordion-item]') === item),
    }));
    if (stable) {
      const ids = parts.flatMap(({ trigger, panel }) => [trigger?.id, panel?.id]);
      if (!items.length || ids.some(id => !id) || new Set(ids).size !== ids.length
        || parts.some(({ trigger, panel }) => trigger?.tagName !== 'BUTTON' || trigger.getAttribute('aria-controls') !== panel?.id)) continue;
    }
    const owner = install(runtime, accordion, 'accordion');
    const panels = new Map(parts.map(({ item, panel }) => {
      return [item, panel ? visibility(panel, owner, stable) : undefined];
    }));
    const triggerFor = (item: HTMLElement) => parts.find(part => part.item === item)?.trigger;
    const setOpen = (item: HTMLElement, open: boolean): void => {
      item.dataset.g7pbOpen = open ? 'true' : 'false';
      triggerFor(item)?.setAttribute('aria-expanded', open ? 'true' : 'false');
      panels.get(item)?.(open);
    };
    items.forEach((item) => {
      const trigger = triggerFor(item);
      if (!trigger) return;
      if (stable) { restoreAttributes(item, ['data-g7pb-open'], owner); restoreAttributes(trigger, ['aria-expanded'], owner); }
      const toggle = (): void => {
        const open = item.dataset.g7pbOpen !== 'true';
        if (open && accordion.dataset.g7pbAccordionBehavior === 'single') {
          items.forEach((sibling) => { if (sibling !== item) setOpen(sibling, false); });
        }
        setOpen(item, open);
      };
      owner.on(trigger, 'click', toggle);
      owner.on(trigger, 'keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault(); toggle();
      });
      setOpen(item, item.dataset.g7pbOpen === 'true');
    });
    if (accordion.dataset.g7pbAccordionBehavior === 'single') {
      owner.on(accordion, 'toggle', (event) => {
        const item = owned<HTMLDetailsElement>(accordion, 'details').find(node => node === event.target);
        if (!item?.open) return;
        for (const sibling of owned<HTMLDetailsElement>(accordion, 'details')) {
          if (sibling !== item) sibling.open = false;
        }
      }, true);
    }
    accordion.dataset.g7pbAccordionReady = 'true';
  }
}

export function bootTabs(root: ControlRoot = document): void {
  const runtime = runtimeFor(root);
  for (const tabsRoot of hosts(root, '[data-g7pb-tabs]')) {
    if (!available(tabsRoot)) continue;
    const tabs = owned<HTMLButtonElement>(tabsRoot, '[role="tab"]');
    let panels = owned(tabsRoot, '[role="tabpanel"]');
    const stable = tabsRoot.dataset.g7pbControlIds === 'stable';
    if (tabs.length < (stable ? 1 : 2) || tabs.length !== panels.length) continue;
    const list = owned(tabsRoot, '[role="tablist"]')[0];
    if (stable) {
      const ids = [...tabs, ...panels].map(node => node.id);
      if (!list || tabs.some(tab => tab.tagName !== 'BUTTON' || !list.contains(tab)) || ids.some(id => !id)
        || new Set(ids).size !== ids.length || tabs.some(tab => !panels.some(panel => panel.id === tab.getAttribute('aria-controls') && panel.getAttribute('aria-labelledby') === tab.id))) continue;
      panels = tabs.map(tab => panels.find(panel => panel.id === tab.getAttribute('aria-controls'))!);
    }
    const owner = install(runtime, tabsRoot, 'tabs');
    const visible = panels.map(panel => visibility(panel, owner, stable));
    const blockKey = (tabsRoot.dataset.blockId ?? `tabs-${Array.from(root.querySelectorAll('[data-g7pb-tabs]')).indexOf(tabsRoot)}`)
      .replace(/[^A-Za-z0-9_-]/g, '-');
    const select = (index: number, focus = false): void => {
      const target = Math.min(Math.max(index, 0), tabs.length - 1);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === target;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false'); tab.tabIndex = selected ? 0 : -1;
      });
      visible.forEach((show, panelIndex) => show(panelIndex === target));
      if (focus) tabs[target]?.focus();
    };
    tabs.forEach((tab, index) => {
      if (stable) restoreAttributes(tab, ['aria-selected', 'tabindex'], owner);
      const tabId = `g7pb-${blockKey}-tab-${index}`; const panelId = `g7pb-${blockKey}-panel-${index}`;
      if (!stable) {
        tab.id = tabId; tab.setAttribute('aria-controls', panelId);
        panels[index].id = panelId; panels[index].setAttribute('aria-labelledby', tabId);
      }
      owner.on(tab, 'click', () => select(index));
      owner.on(tab, 'keydown', (event) => {
        let target: number | null = null;
        const vertical = list?.getAttribute('aria-orientation') === 'vertical';
        if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) target = (index + 1) % tabs.length;
        if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) target = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') target = 0;
        if (event.key === 'End') target = tabs.length - 1;
        if (target === null) return;
        event.preventDefault(); select(target, true);
      });
    });
    const configured = Number(tabsRoot.dataset.g7pbTabsInitial ?? 0);
    select(Number.isInteger(configured) ? configured : 0); tabsRoot.dataset.g7pbTabsReady = 'true';
  }
}
