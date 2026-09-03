import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootG7SystemControls } from '../../resources/js/public/pageEffects';
import { disposeG7SystemControls } from '../../resources/js/public/siteShellRuntime';
import { bootServiceActions, disposeServiceActions } from '../../resources/js/public/siteShellActions';
import { disposeShellNotifications, loadShellNotifications, type ShellWindow } from '../../resources/js/public/siteShellControls';

const documents = new Set<Document>();
const view: ShellWindow = window;
afterEach(() => {
  for (const root of documents) {
    disposeG7SystemControls(root); disposeServiceActions(root);
    root.querySelectorAll<HTMLElement>('[data-g7pb-shell-mounted]').forEach(disposeShellNotifications);
  }
  documents.clear(); delete view.G7Core; vi.unstubAllGlobals(); vi.restoreAllMocks();
});
function shellFixture(markup = '') {
  const root = document.implementation.createHTMLDocument('shell lifetime'); documents.add(root);
  root.body.innerHTML = markup || '<div data-g7pb-shell-mounted><button data-g7pb-notifications-read-all>Read all</button><div data-g7pb-notifications-list></div></div>';
  return root;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const notification = (subject: string) => new Response(JSON.stringify({ data: [{ subject, url: '/notification', created_at: 'now' }] }));

describe('public shell request lifetime', () => {
  it('keeps the new notifications after the same host is removed, disposed and reinstalled', async () => {
    const root = document.implementation.createHTMLDocument('shell');
    documents.add(root);
    root.body.innerHTML = '<div data-g7pb-shell-mounted><button data-g7pb-notifications-read-all>Read all</button><div data-g7pb-notifications-list></div></div>';
    const host = root.querySelector<HTMLElement>('[data-g7pb-shell-mounted]')!;
    const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(notification('Current notification'));
    bootG7SystemControls(root, window);
    const first = loadShellNotifications(host, window, fetcher);
    host.remove(); bootG7SystemControls(root, window);
    root.body.append(host); bootG7SystemControls(root, window);
    await loadShellNotifications(host, window, fetcher);
    pending.resolve(notification('Old notification')); await first;
    expect(host.querySelector('strong')?.textContent).toBe('Current notification');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it.each(['identity', 'storage', 'pageshow'] as const)('invalidates prior notification read-all on native %s transitions without touching the next session', async reason => {
    const root = shellFixture(); const host = root.querySelector<HTMLElement>('[data-g7pb-shell-mounted]')!;
    let state = { currentUser: { uuid: 'A' }, notificationCount: 3 }; let listener: (() => void) | undefined;
    const unsubscribe = vi.fn(); const stateSet = vi.fn(); const sessionChanged = vi.fn();
    view.G7Core = { state: { get: () => state, set: stateSet, subscribe: callback => { listener = callback; return unsubscribe; } } };
    bootG7SystemControls(root, view, sessionChanged);
    const old = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => old.promise).mockResolvedValueOnce(notification('Session B'));
    const readEvent = vi.fn(); root.addEventListener('g7pb:notifications-read', readEvent);
    const first = loadShellNotifications(host, view, fetcher, true);
    if (reason === 'identity') { state = { currentUser: { uuid: 'B' }, notificationCount: 7 }; listener?.(); }
    if (reason === 'storage') view.dispatchEvent(new StorageEvent('storage', { key: 'auth_token', newValue: 'B' }));
    if (reason === 'pageshow') view.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(sessionChanged).toHaveBeenCalledExactlyOnceWith(reason);
    await loadShellNotifications(host, view, fetcher);
    old.resolve(new Response('{}')); await first;
    expect(host.querySelector('strong')?.textContent).toBe('Session B');
    expect(fetcher).toHaveBeenCalledTimes(2); expect(readEvent).not.toHaveBeenCalled(); expect(stateSet).not.toHaveBeenCalled();
    disposeG7SystemControls(root); expect(unsubscribe).toHaveBeenCalledTimes(1);
    listener?.(); view.dispatchEvent(new StorageEvent('storage', { key: 'auth_token', newValue: 'C' }));
    expect(sessionChanged).toHaveBeenCalledTimes(1);
    bootG7SystemControls(root, view, sessionChanged); disposeG7SystemControls(root);
    expect(unsubscribe).toHaveBeenCalledTimes(2);
  });

  it('keeps the latest standalone auth/cart/unread response and ignores disposed work', async () => {
    const root = shellFixture('<div data-g7pb-runtime-config="{&quot;commerceAvailable&quot;:true}"></div><div data-g7pb-system-controls><span data-g7pb-system-member hidden>Member</span><span data-g7pb-system-cart-count></span><span data-g7pb-system-notification-count></span></div>');
    const oldAuth = deferred<Response>(); const oldCart = deferred<Response>(); let authCalls = 0; let cartCalls = 0;
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url === '/api/public/locales/active') return new Response('{"data":{"locales":["ko","en"],"locale_names":{"ko":"한국어"}}}');
      if (url === '/api/auth/user') { authCalls += 1; return authCalls === 1 ? oldAuth.promise : new Response('{"data":{"uuid":"B"}}'); }
      if (url.endsWith('/cart/count')) { cartCalls += 1; return cartCalls === 1 ? oldCart.promise : new Response('{"data":{"count":9}}'); }
      if (url.endsWith('/unread-count')) return new Response('{"data":{"count":7}}');
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal('fetch', fetcher);
    bootG7SystemControls(root, view);
    view.dispatchEvent(new StorageEvent('storage', { key: 'auth_token', newValue: 'B' }));
    await vi.waitFor(() => expect(cartCalls).toBe(1));
    view.dispatchEvent(new StorageEvent('storage', { key: 'auth_token', newValue: 'C' }));
    await vi.waitFor(() => expect(root.querySelector('[data-g7pb-system-cart-count]')?.textContent).toBe('9'));
    await vi.waitFor(() => expect(root.querySelector('[data-g7pb-system-notification-count]')?.textContent).toBe('7'));
    oldAuth.resolve(new Response('{"data":{"uuid":"A"}}')); oldCart.resolve(new Response('{"data":{"count":1}}'));
    await oldAuth.promise; await oldCart.promise;
    expect(root.querySelector('[data-g7pb-system-cart-count]')?.textContent).toBe('9');
    expect(root.querySelector('[data-g7pb-system-notification-count]')?.textContent).toBe('7');
    const before = fetcher.mock.calls.length; disposeG7SystemControls(root);
    view.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    expect(fetcher).toHaveBeenCalledTimes(before);
  });

  it('does not start follow-on work when a session callback disposes its standalone runtime', async () => {
    const root = shellFixture('<div data-g7pb-runtime-config="{&quot;commerceAvailable&quot;:true}"></div>');
    const fetcher = vi.fn<typeof fetch>(async input => new Response(String(input).includes('/auth/user') ? '{"data":{"uuid":"A"}}' : '{}'));
    vi.stubGlobal('fetch', fetcher);
    const changed = vi.fn(() => disposeG7SystemControls(root));
    bootG7SystemControls(root, view, changed);
    await vi.waitFor(() => expect(changed).toHaveBeenCalledExactlyOnceWith('identity'));
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual(['/api/public/locales/active', '/api/auth/user']);
  });

  it('keeps newer notification DOM when the old list is replaced and fails', async () => {
    const root = shellFixture(); const host = root.querySelector<HTMLElement>('[data-g7pb-shell-mounted]')!;
    const oldList = host.querySelector<HTMLElement>('[data-g7pb-notifications-list]')!;
    const old = deferred<Response>(); const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => old.promise).mockResolvedValueOnce(notification('New target'));
    const first = loadShellNotifications(host, view, fetcher);
    const list = root.createElement('div'); list.dataset.g7pbNotificationsList = ''; oldList.replaceWith(list);
    await loadShellNotifications(host, view, fetcher);
    old.resolve(new Response('{}', { status: 503 })); await first;
    expect(list.querySelector('strong')?.textContent).toBe('New target');
    expect(oldList.textContent).toBe('알림을 불러오는 중입니다.');
    expect(list.dataset.loading).toBeUndefined();
  });

  it.each([200, 503])('keeps token B after token A logout returns %s, releases only A busy state and allows B to retry', async code => {
    const root = shellFixture('<a href="#g7-action-logout">Logout</a>'); const link = root.querySelector('a')!;
    let token: string | null = 'A'; const removeItem = vi.fn(() => { token = null; });
    const storage = { getItem: () => token, removeItem };
    const old = deferred<Response>(); const next = deferred<Response>(); const navigate = vi.fn();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
    bootServiceActions(root, view, fetcher, navigate, storage); link.click(); token = 'B';
    old.resolve(new Response('{}', { status: code }));
    await vi.waitFor(() => expect(link.dataset.g7pbActionPending).toBe('false'));
    expect(token).toBe('B'); expect(removeItem).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    link.click(); expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1]?.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer B' });
    next.resolve(new Response('{}')); await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(removeItem).toHaveBeenCalledExactlyOnceWith('auth_token');
  });

  it('cancels queued native actions and detached fallback completion without claiming to cancel an issued server mutation', async () => {
    const root = shellFixture('<a href="#g7-action-logout">Logout</a>'); const link = root.querySelector('a')!;
    const dispatch = vi.fn(); view.G7Core = { dispatch };
    bootServiceActions(root, view); link.click(); disposeServiceActions(root);
    await Promise.resolve(); expect(dispatch).not.toHaveBeenCalled();
    delete view.G7Core;
    const pending = deferred<Response>(); const fetcher = vi.fn<typeof fetch>(() => pending.promise);
    const storage = { getItem: () => 'A', removeItem: vi.fn() }; const navigate = vi.fn();
    bootServiceActions(root, view, fetcher, navigate, storage); link.click();
    link.remove(); root.body.append(link); pending.resolve(new Response('{}'));
    await vi.waitFor(() => expect(link.dataset.g7pbActionPending).toBe('false'));
    expect(storage.removeItem).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
  });
});
