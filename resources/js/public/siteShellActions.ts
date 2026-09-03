import type { ShellWindow } from './siteShellControls';

interface ActionRuntime {
  view: Window;
  fetcher: typeof fetch;
  dispose: () => void;
}
const runtimes = new WeakMap<Document, ActionRuntime>();

export function disposeServiceActions(root: Document = document): void { runtimes.get(root)?.dispose(); }

export function bootServiceActions(
  root: Document = document,
  view: Window = window,
  fetcher: typeof fetch = fetch,
  navigate: (url: string) => void = (url) => view.location.assign(url),
  tokenStorage?: Pick<Storage, 'getItem' | 'removeItem'> | null,
): void {
  const previous = runtimes.get(root);
  if (previous?.view === view && previous.fetcher === fetcher) return;
  previous?.dispose();
  let active = true;
  const pending = new Map<HTMLAnchorElement, object>();
  const clear = (link: HTMLAnchorElement): void => {
    pending.delete(link); link.dataset.g7pbActionPending = 'false'; link.removeAttribute('aria-disabled');
  };
  const prune = (records: MutationRecord[]): void => {
    for (const link of pending.keys()) {
      if (!root.contains(link) || !link.isConnected || link.getAttribute('href') !== '#g7-action-logout'
        || records.some(record => Array.from(record.removedNodes).some(node => node.contains(link)))) clear(link);
    }
  };
  const observer = new MutationObserver(prune);
  const current = (link: HTMLAnchorElement, token: object): boolean => {
    prune(observer.takeRecords());
    return active && runtimes.get(root) === runtime && pending.get(link) === token;
  };
  const click = (event: Event): void => {
    if (!active) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href="#g7-action-logout"]');
    if (!link) return;
    event.preventDefault(); prune(observer.takeRecords());
    if (pending.has(link)) return;
    const token = {}; pending.set(link, token);
    link.dataset.g7pbActionPending = 'true'; link.setAttribute('aria-disabled', 'true');
    let storage = tokenStorage;
    if (storage === undefined) { try { storage = view.localStorage; } catch { storage = null; } }
    const bearer = storage?.getItem('auth_token');
    const currentSession = (): boolean => {
      if (!current(link, token)) return false;
      try { return storage?.getItem('auth_token') === bearer; } catch { return false; }
    };
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    const nativeDispatch = (view as ShellWindow).G7Core?.dispatch;
    const request = nativeDispatch
      ? Promise.resolve().then(() => { if (currentSession()) return nativeDispatch({ handler: 'logout' }); })
      : fetcher('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers }).then(response => {
        if (!currentSession()) return;
        if (!response.ok) throw new Error('logout failed');
        storage?.removeItem('auth_token'); navigate('/');
      });
    void request.catch(() => {
      if (!currentSession()) return;
      let error = link.closest('[data-g7pb-system-controls]')?.querySelector<HTMLElement>('[data-g7pb-shell-error]');
      if (!error) { error = root.createElement('span'); error.role = 'alert'; link.after(error); }
      error.hidden = false; error.textContent = '로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.';
    }).finally(() => { if (current(link, token)) clear(link); });
  };
  const runtime: ActionRuntime = { view, fetcher, dispose: () => {
    active = false; observer.disconnect(); root.removeEventListener('click', click);
    for (const link of pending.keys()) clear(link);
    if (runtimes.get(root) === runtime) { runtimes.delete(root); delete root.documentElement.dataset.g7pbServiceActionsReady; }
  } };
  runtimes.set(root, runtime); observer.observe(root, { subtree: true, childList: true });
  root.addEventListener('click', click); root.documentElement.dataset.g7pbServiceActionsReady = 'true';
}
