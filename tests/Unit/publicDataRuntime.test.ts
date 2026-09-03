import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootDynamicData } from '../../resources/js/public/pageEffects';
import { bootBlockVisibility, disposePublicDataRuntime, publicDataFetcher } from '../../resources/js/public/publicDataRuntime';

const documents = new Set<Document>();
afterEach(() => { documents.forEach(disposePublicDataRuntime); documents.clear(); vi.restoreAllMocks(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const root = document.implementation.createHTMLDocument('data runtime');
  documents.add(root);
  root.body.innerHTML = '<section data-g7pb-data-source="posts" data-g7pb-endpoint="/api/a" data-g7pb-audience="all"><p data-g7pb-data-status></p><div data-g7pb-data-list aria-busy="true"></div></section>';
  const block = root.querySelector<HTMLElement>('section')!;
  const list = block.querySelector<HTMLElement>('[data-g7pb-data-list]')!;
  return { root, block, list };
}
const response = (title: string) => new Response(JSON.stringify({ success: true, data: [{ id: title, board_slug: 'fixture', title }] }), { status: 200 });

describe('public data request ownership', () => {
  it('shares one pending block request across concurrent boot calls', async () => {
    const { root, list } = fixture(); const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => pending.promise);
    const first = bootDynamicData(root, fetcher); const second = bootDynamicData(root, fetcher);
    try {
      await vi.waitFor(() => expect(fetcher).toHaveBeenCalled());
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { pending.resolve(response('one')); await Promise.all([first, second]); }
    expect(list.querySelector('strong')?.textContent).toBe('one');
  });

  it('does not let a late endpoint response replace the newer endpoint rows', async () => {
    const { root, block, list } = fixture(); const firstResult = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => firstResult.promise).mockResolvedValueOnce(response('new'));
    const first = bootDynamicData(root, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    block.dataset.g7pbEndpoint = '/api/b';
    await bootDynamicData(root, fetcher);
    firstResult.resolve(response('old')); await first;
    expect(list.querySelector('strong')?.textContent).toBe('new');
  });

  it('retires the previous request when the same block is removed and reinserted in one task', async () => {
    const { root, block, list } = fixture(); const firstResult = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => firstResult.promise).mockResolvedValueOnce(response('reinserted'));
    const first = bootDynamicData(root, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    block.remove(); root.body.append(block);
    const second = bootDynamicData(root, fetcher);
    await second;
    firstResult.resolve(response('removed-generation')); await first;
    expect(list.querySelector('strong')?.textContent).toBe('reinserted');
  });

  it('ignores the previous error and rows after its render target has been replaced', async () => {
    const { root, list, block } = fixture(); const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(response('current'));
    const first = bootDynamicData(root, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    const replacement = root.createElement('div'); replacement.dataset.g7pbDataList = '';
    list.replaceWith(replacement);
    await bootDynamicData(root, fetcher);
    pending.reject(new Error('old request failed')); await first;
    expect(replacement.querySelector('strong')?.textContent).toBe('current');
    expect(block.querySelector('[data-g7pb-data-status]')?.textContent).toBe('');
    expect(block.dataset.g7pbDataReady).toBe('true');
    expect(list.children).toHaveLength(0);
  });

  it('does not render a detached response and allows a later reinserted block to start again', async () => {
    const { root, block, list } = fixture(); const pending = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(response('new mount'));
    const first = bootDynamicData(root, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    block.remove(); pending.resolve(response('detached')); await first;
    expect(list.children).toHaveLength(0);
    expect(block.dataset.g7pbDataReady).toBeUndefined();
    root.body.append(block); await bootDynamicData(root, fetcher);
    expect(list.querySelector('strong')?.textContent).toBe('new mount');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('drains removal records before response JSON and ignores an older asynchronous body', async () => {
    const { root, block, list } = fixture(); const body = deferred<unknown>();
    const oldResponse = response('unused');
    const readBody = vi.spyOn(oldResponse, 'json').mockImplementation(() => body.promise);
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(oldResponse).mockResolvedValueOnce(response('current'));
    const first = bootDynamicData(root, fetcher);
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledTimes(1));
    const wrapper = root.createElement('div'); block.replaceWith(wrapper); wrapper.append(block);
    wrapper.remove(); root.body.append(wrapper);
    body.resolve({ success: true, data: [{ id: 'old', board_slug: 'fixture', title: 'old body' }] });
    await first;
    expect(list.children).toHaveLength(0);
    await bootDynamicData(root, fetcher);
    expect(list.querySelector('strong')?.textContent).toBe('current');
  });

  it('invalidates visibility and data together on disposal and resolves fresh authentication on the next runtime', async () => {
    const { root, block, list } = fixture(); const firstAuth = deferred<Response>();
    block.dataset.g7pbAudience = 'member'; block.dataset.g7pbVisibilityAudience = 'member';
    let authCount = 0;
    const fetcher = vi.fn<typeof fetch>(async input => {
      if (String(input) !== '/api/user/auth/user') return response('protected');
      authCount += 1;
      return authCount === 1 ? firstAuth.promise : new Response(null, { status: 401 });
    });
    const first = bootDynamicData(root, fetcher);
    const visibility = bootBlockVisibility(root, fetcher);
    await vi.waitFor(() => expect(authCount).toBe(1));
    disposePublicDataRuntime(root);
    const next = bootDynamicData(root, fetcher); await next;
    firstAuth.resolve(new Response(null, { status: 200 })); await Promise.all([first, visibility]);
    expect(authCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(list.children).toHaveLength(0);
    expect(block.hidden).toBe(true);
    expect(block.dataset.g7pbVisibilityAllowed).toBe('false');
  });

  it('shares only pending authentication across visibility and data, without caching later visitors', async () => {
    const { root, block, list } = fixture(); const auth = deferred<Response>();
    block.dataset.g7pbAudience = 'member'; block.dataset.g7pbVisibilityAudience = 'member';
    let member = true; let authCount = 0;
    const fetcher = vi.fn<typeof fetch>(async input => {
      if (String(input) !== '/api/user/auth/user') return response('member rows');
      authCount += 1;
      return member ? auth.promise : new Response(null, { status: 401 });
    });
    const first = bootBlockVisibility(root, fetcher); const second = bootDynamicData(root, fetcher);
    await vi.waitFor(() => expect(authCount).toBe(1));
    auth.resolve(new Response(null, { status: 200 })); await Promise.all([first, second]);
    expect(list.querySelector('strong')?.textContent).toBe('member rows');
    await bootDynamicData(root, fetcher); expect(fetcher).toHaveBeenCalledTimes(2);
    member = false;
    const nextBlock = root.createElement('section'); nextBlock.dataset.g7pbVisibilityAudience = 'member'; root.body.append(nextBlock);
    await bootBlockVisibility(root, fetcher);
    expect(authCount).toBe(2); expect(nextBlock.hidden).toBe(true);
  });

  it('does not start queued authorization or data work after immediate disposal', async () => {
    const { root, block, list } = fixture();
    block.dataset.g7pbAudience = 'member'; block.dataset.g7pbVisibilityAudience = 'member';
    const fetcher = vi.fn<typeof fetch>();
    const pending = bootDynamicData(root, fetcher);
    disposePublicDataRuntime(root); await pending;
    expect(fetcher).not.toHaveBeenCalled(); expect(list.children).toHaveLength(0);
    expect(block.dataset.g7pbDataReady).toBeUndefined();
    expect(block.dataset.g7pbVisibilityReady).toBeUndefined();
  });

  it('does not share document authorization or a disposed transport binding', async () => {
    const { root } = fixture(); const other = fixture().root;
    root.querySelector('section')!.setAttribute('data-g7pb-visibility-audience', 'member');
    other.querySelector('section')!.setAttribute('data-g7pb-visibility-audience', 'member');
    const pending = deferred<Response>(); const fetcher = vi.fn<typeof fetch>(() => pending.promise);
    const first = bootBlockVisibility(root, fetcher); const second = bootBlockVisibility(other, fetcher);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    pending.resolve(new Response(null, { status: 200 })); await Promise.all([first, second]);
    const firstBinding = publicDataFetcher(root, window);
    expect(publicDataFetcher(root, window)).toBe(firstBinding);
    expect(publicDataFetcher(other, window)).not.toBe(firstBinding);
    disposePublicDataRuntime(root);
    expect(publicDataFetcher(root, window)).not.toBe(firstBinding);
  });

  it('reconnects replaced archive controls using settled rows without duplicate requests or handlers', async () => {
    const { root, block, list } = fixture();
    block.dataset.g7pbDataSource = 'post-archive'; block.dataset.g7pbPageSize = '1';
    const controls = root.createElement('div'); block.prepend(controls);
    const markup = '<input data-g7pb-archive-search><select data-g7pb-archive-filter></select><nav data-g7pb-pagination><button data-g7pb-page-prev>prev</button><span data-g7pb-page-status></span><button data-g7pb-page-next>next</button></nav>';
    controls.innerHTML = markup;
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: true, data: [
      { id: 1, board_slug: 'a', title: 'Alpha' }, { id: 2, board_slug: 'b', title: 'Beta' }, { id: 3, board_slug: 'a', title: 'Gamma' },
    ] })));
    await bootDynamicData(root, fetcher);
    const rows = Array.from(list.querySelectorAll<HTMLElement>('article'));
    const oldSearch = controls.querySelector<HTMLInputElement>('input')!;
    const oldNext = controls.querySelector<HTMLButtonElement>('[data-g7pb-page-next]')!;
    controls.innerHTML = markup;
    await bootDynamicData(root, fetcher); await bootDynamicData(root, fetcher);
    expect(Array.from(list.children)).toEqual(rows); expect(fetcher).toHaveBeenCalledTimes(1);
    const search = controls.querySelector<HTMLInputElement>('input')!;
    search.value = 'Beta'; search.dispatchEvent(new Event('input'));
    expect(rows.map(row => row.hidden)).toEqual([true, false, true]);
    oldSearch.value = 'Alpha'; oldSearch.dispatchEvent(new Event('input')); oldNext.click();
    expect(rows.map(row => row.hidden)).toEqual([true, false, true]);
    search.value = ''; search.dispatchEvent(new Event('input'));
    controls.querySelector<HTMLButtonElement>('[data-g7pb-page-next]')!.click();
    expect(rows.map(row => row.hidden)).toEqual([true, false, true]);
    expect(controls.querySelector('[data-g7pb-page-status]')?.textContent).toBe('2 / 3');
    const filter = controls.querySelector<HTMLSelectElement>('select')!;
    filter.value = 'a'; filter.dispatchEvent(new Event('change'));
    const previousNav = controls.querySelector('nav')!;
    const replacementNav = root.createElement('nav'); replacementNav.dataset.g7pbPagination = '';
    replacementNav.innerHTML = '<button data-g7pb-page-prev>prev</button><span data-g7pb-page-status></span><button data-g7pb-page-next>next</button>';
    previousNav.replaceWith(replacementNav);
    await bootDynamicData(root, fetcher);
    expect(controls.querySelector('select')).toBe(filter); expect(filter.value).toBe('a');
    replacementNav.querySelector<HTMLButtonElement>('[data-g7pb-page-next]')!.click();
    expect(rows.map(row => row.hidden)).toEqual([true, true, false]);
    expect(replacementNav.querySelector('[data-g7pb-page-status]')?.textContent).toBe('2 / 2');
    expect(fetcher).toHaveBeenCalledTimes(1);
    disposePublicDataRuntime(root);
    search.value = 'Alpha'; search.dispatchEvent(new Event('input'));
    expect(rows.map(row => row.hidden)).toEqual([true, true, false]);
  });
});
