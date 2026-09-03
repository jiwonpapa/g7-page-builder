interface ControlMount {
  host: HTMLElement;
  kind: 'accordion' | 'tabs';
  nodes: Element[];
  configuration: string;
  dispose: () => void;
}
interface ControlRuntime { root: Document; mounts: Set<ControlMount>; observer: MutationObserver }
const runtimes = new WeakMap<Document, ControlRuntime>();
function nodesFor(host: HTMLElement, kind: ControlMount['kind']): Element[] {
  return Array.from(host.querySelectorAll(kind === 'tabs' ? '[role="tab"],[role="tabpanel"]'
    : '[data-g7pb-accordion-item],[data-g7pb-accordion-trigger],[data-g7pb-accordion-panel],details'));
}
function configuration(host: HTMLElement, kind: ControlMount['kind']): string {
  return kind === 'tabs' ? JSON.stringify([host.dataset.blockId, host.dataset.g7pbTabsInitial]) : host.dataset.g7pbAccordionBehavior ?? '';
}
function matches(mount: ControlMount): boolean {
  const nodes = nodesFor(mount.host, mount.kind);
  return mount.host.isConnected && mount.host.ownerDocument.contains(mount.host)
    && mount.host.matches(mount.kind === 'tabs' ? '[data-g7pb-tabs]' : '[data-g7pb-accordion]')
    && configuration(mount.host, mount.kind) === mount.configuration
    && nodes.length === mount.nodes.length && nodes.every((node, index) => node === mount.nodes[index]);
}
function reconcile(runtime: ControlRuntime, records: MutationRecord[]): void {
  for (const mount of runtime.mounts) {
    if (!matches(mount) || records.some(record => Array.from(record.removedNodes).some(node => node.contains(mount.host)))) {
      runtime.mounts.delete(mount); mount.dispose();
    }
  }
}
function runtimeFor(root: Document): ControlRuntime {
  const previous = runtimes.get(root);
  if (previous) { reconcile(previous, previous.observer.takeRecords()); return previous; }
  const observer = new MutationObserver(records => reconcile(runtime, records));
  const runtime: ControlRuntime = { root, mounts: new Set(), observer };
  observer.observe(root, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-g7pb-tabs', 'data-g7pb-accordion', 'data-g7pb-tabs-initial', 'data-g7pb-accordion-behavior', 'data-block-id', 'role'] });
  runtimes.set(root, runtime); return runtime;
}
export function disposeContentControls(root: Document = document): void {
  const runtime = runtimes.get(root); if (!runtime) return;
  runtimes.delete(root); runtime.observer.disconnect();
  for (const mount of runtime.mounts) mount.dispose();
  runtime.mounts.clear();
}
function install(runtime: ControlRuntime, host: HTMLElement, kind: ControlMount['kind']) {
  let active = true; const cleanups: (() => void)[] = [];
  const mount: ControlMount = { host, kind, nodes: nodesFor(host, kind), configuration: configuration(host, kind),
    dispose: () => { active = false; cleanups.forEach(dispose => dispose());
      if (kind === 'tabs') delete host.dataset.g7pbTabsReady; else delete host.dataset.g7pbAccordionReady; } };
  runtime.mounts.add(mount);
  const current = (): boolean => {
    reconcile(runtime, runtime.observer.takeRecords());
    return active && runtimes.get(runtime.root) === runtime && matches(mount);
  };
  return {
    current,
    on<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, listener: (event: HTMLElementEventMap[K]) => void, capture = false): void {
      const guarded = (event: HTMLElementEventMap[K]): void => { if (current()) listener(event); };
      target.addEventListener(type, guarded, capture);
      cleanups.push(() => target.removeEventListener(type, guarded, capture));
    },
  };
}

export function bootAccordions(root: Document = document): void {
  const runtime = runtimeFor(root);
  for (const accordion of root.querySelectorAll<HTMLElement>('[data-g7pb-accordion]')) {
    if ([...runtime.mounts].some(mount => mount.host === accordion && mount.kind === 'accordion')) continue;
    const owner = install(runtime, accordion, 'accordion');
    const items = Array.from(accordion.querySelectorAll<HTMLElement>('[data-g7pb-accordion-item]'));
    const setOpen = (item: HTMLElement, open: boolean): void => {
      item.dataset.g7pbOpen = open ? 'true' : 'false';
      item.querySelector<HTMLElement>('[data-g7pb-accordion-trigger]')?.setAttribute('aria-expanded', open ? 'true' : 'false');
      const panel = item.querySelector<HTMLElement>('[data-g7pb-accordion-panel]');
      if (panel) panel.hidden = !open;
    };
    items.forEach((item) => {
      const trigger = item.querySelector<HTMLElement>('[data-g7pb-accordion-trigger]');
      if (!trigger) return;
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
        const item = event.target;
        if (!(item instanceof HTMLDetailsElement) || !item.open) return;
        for (const sibling of accordion.querySelectorAll<HTMLDetailsElement>('details')) {
          if (sibling !== item) sibling.open = false;
        }
      }, true);
    }
    accordion.dataset.g7pbAccordionReady = 'true';
  }
}

export function bootTabs(root: Document = document): void {
  const runtime = runtimeFor(root);
  for (const tabsRoot of root.querySelectorAll<HTMLElement>('[data-g7pb-tabs]')) {
    if ([...runtime.mounts].some(mount => mount.host === tabsRoot && mount.kind === 'tabs')) continue;
    const tabs = Array.from(tabsRoot.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = Array.from(tabsRoot.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    if (tabs.length < 2 || tabs.length !== panels.length) continue;
    const owner = install(runtime, tabsRoot, 'tabs');
    const blockKey = (tabsRoot.dataset.blockId ?? `tabs-${Array.from(root.querySelectorAll('[data-g7pb-tabs]')).indexOf(tabsRoot)}`)
      .replace(/[^A-Za-z0-9_-]/g, '-');
    const select = (index: number, focus = false): void => {
      const target = Math.min(Math.max(index, 0), tabs.length - 1);
      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === target;
        tab.setAttribute('aria-selected', selected ? 'true' : 'false'); tab.tabIndex = selected ? 0 : -1;
      });
      panels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== target; });
      if (focus) tabs[target]?.focus();
    };
    tabs.forEach((tab, index) => {
      const tabId = `g7pb-${blockKey}-tab-${index}`; const panelId = `g7pb-${blockKey}-panel-${index}`;
      tab.id = tabId; tab.setAttribute('aria-controls', panelId);
      panels[index].id = panelId; panels[index].setAttribute('aria-labelledby', tabId);
      owner.on(tab, 'click', () => select(index));
      owner.on(tab, 'keydown', (event) => {
        let target: number | null = null;
        if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
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
