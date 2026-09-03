import { archiveControlNodes, installArchiveFilters, installPagination } from './publicArchiveControls';
import { payloadItems, payloadRecord, renderPost, renderPostDetail, renderProduct, renderProductDetail } from './publicDataRendering';
import { asRecord } from './publicValues';

type Audience = 'guest' | 'member';
interface VisibilityState {
  fetcher: typeof fetch;
  requirement: string;
  job: Promise<void>;
}
interface DataState {
  fetcher: typeof fetch;
  inputs: string;
  list: HTMLElement | null;
  detail: HTMLElement | null;
  status: HTMLElement | null;
  job: Promise<void>;
  rows?: HTMLElement[];
  controls?: { nodes: (Element | null)[]; dispose: () => void };
}
interface DataRuntime {
  root: Document;
  active: boolean;
  visibility: Map<HTMLElement, VisibilityState>;
  data: Map<HTMLElement, DataState>;
  audience: Map<typeof fetch, Promise<Audience>>;
  observer: MutationObserver | null;
  transport?: { view: Window; source: typeof fetch; bound: typeof fetch };
}

const runtimes = new WeakMap<Document, DataRuntime>();
const inputAttributes = ['data-g7pb-data-source', 'data-g7pb-endpoint', 'data-g7pb-audience',
  'data-g7pb-visibility-audience', 'data-g7pb-product-base', 'data-g7pb-empty-message',
  'data-g7pb-show-content', 'data-g7pb-show-description', 'data-g7pb-detail-url', 'data-g7pb-detail-label',
  'data-g7pb-page-size', 'data-g7pb-motion', 'data-g7pb-motion-stagger'];

function dataInputs(block: HTMLElement): string {
  return JSON.stringify(inputAttributes.map((attribute) => block.getAttribute(attribute)));
}

function connected(runtime: DataRuntime, block: HTMLElement): boolean {
  return runtime.active && runtimes.get(runtime.root) === runtime && block.isConnected && runtime.root.contains(block);
}

function sameTargets(block: HTMLElement, state: DataState): boolean {
  return state.inputs === dataInputs(block)
    && state.list === block.querySelector('[data-g7pb-data-list]')
    && state.detail === block.querySelector('[data-g7pb-data-detail]')
    && state.status === block.querySelector('[data-g7pb-data-status]');
}

function retireVisibility(runtime: DataRuntime, block: HTMLElement): void {
  runtime.visibility.delete(block);
  delete block.dataset.g7pbVisibilityReady;
  delete block.dataset.g7pbVisibilityAllowed;
}

function retireData(runtime: DataRuntime, block: HTMLElement, state: DataState): void {
  runtime.data.delete(block);
  state.controls?.dispose();
  state.list?.setAttribute('aria-busy', 'false');
  state.detail?.setAttribute('aria-busy', 'false');
  delete block.dataset.g7pbDataReady;
}

function removed(records: MutationRecord[], node: Node): boolean {
  return records.some((record) => Array.from(record.removedNodes).some((parent) => parent.contains(node)));
}

function reconcile(runtime: DataRuntime, records: MutationRecord[]): void {
  if (!runtime.active) return;
  for (const [block, state] of runtime.visibility) {
    if (!connected(runtime, block) || removed(records, block)
      || state.requirement !== (block.dataset.g7pbVisibilityAudience ?? 'all')
      || records.some((record) => record.target === block && record.attributeName === 'data-g7pb-visibility-audience')) {
      retireVisibility(runtime, block);
    }
  }
  for (const [block, state] of runtime.data) {
    if (!connected(runtime, block) || removed(records, block) || !sameTargets(block, state)
      || [state.list, state.detail, state.status].some((node) => node !== null && removed(records, node))
      || records.some((record) => record.target === block && record.type === 'attributes')) {
      retireData(runtime, block, state);
    } else if (state.controls && (state.controls.nodes.some((node) => node !== null && removed(records, node))
      || archiveControlNodes(block).some((node, index) => node !== state.controls?.nodes[index]))) {
      state.controls.dispose();
      state.controls = undefined;
    }
  }
}

function flush(runtime: DataRuntime): void {
  reconcile(runtime, runtime.observer?.takeRecords() ?? []);
}

function dataRuntime(root: Document): DataRuntime {
  const existing = runtimes.get(root);
  if (existing) { flush(existing); return existing; }
  const runtime: DataRuntime = { root, active: true, visibility: new Map(), data: new Map(), audience: new Map(), observer: null };
  const Observer = root.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof Observer === 'function') {
    runtime.observer = new Observer((records) => reconcile(runtime, records));
    runtime.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: inputAttributes });
  }
  runtimes.set(root, runtime);
  return runtime;
}

/** Stable document transport: repeated boots share pending auth and block requests. */
export function publicDataFetcher(root: Document, view: Window): typeof fetch {
  const runtime = dataRuntime(root);
  if (typeof view.fetch !== 'function') return fetch;
  if (runtime.transport?.view === view && runtime.transport.source === view.fetch) return runtime.transport.bound;
  const bound = view.fetch.bind(view);
  runtime.transport = { view, source: view.fetch, bound };
  return bound;
}

/** Invalidate before teardown; late responses cannot reacquire this document generation. */
export function disposePublicDataRuntime(root: Document = document): void {
  const runtime = runtimes.get(root);
  if (!runtime) return;
  runtime.active = false;
  runtime.observer?.disconnect();
  for (const block of runtime.visibility.keys()) retireVisibility(runtime, block);
  for (const [block, state] of runtime.data) retireData(runtime, block, state);
  runtime.audience.clear();
  runtimes.delete(root);
}

function visitorAudience(runtime: DataRuntime, fetcher: typeof fetch): Promise<Audience> {
  const pending = runtime.audience.get(fetcher);
  if (pending) return pending;
  const request = Promise.resolve().then(async (): Promise<Audience> => {
    if (!runtime.active || runtimes.get(runtime.root) !== runtime) return 'guest';
    try {
      const response = await fetcher('/api/user/auth/user', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      return response.ok ? 'member' : 'guest';
    } catch { return 'guest'; }
  }).finally(() => {
    if (runtime.audience.get(fetcher) === request) runtime.audience.delete(fetcher);
  });
  runtime.audience.set(fetcher, request);
  return request;
}

function visibilityCurrent(runtime: DataRuntime, block: HTMLElement, state: VisibilityState): boolean {
  flush(runtime);
  return connected(runtime, block) && runtime.visibility.get(block) === state;
}

function claimVisibility(runtime: DataRuntime, fetcher: typeof fetch, audience: () => Promise<Audience>): Map<HTMLElement, Promise<void>> {
  const jobs = new Map<HTMLElement, Promise<void>>();
  for (const block of runtime.root.querySelectorAll<HTMLElement>('[data-g7pb-visibility-audience]')) {
    const existing = runtime.visibility.get(block);
    if (existing?.fetcher === fetcher) { jobs.set(block, existing.job); continue; }
    if (existing) retireVisibility(runtime, block);
    const state: VisibilityState = { fetcher, requirement: block.dataset.g7pbVisibilityAudience ?? 'all', job: Promise.resolve() };
    runtime.visibility.set(block, state);
    const resolved = state.requirement === 'all' ? Promise.resolve<Audience>('guest') : audience();
    state.job = resolved.then((visitor) => {
      if (!visibilityCurrent(runtime, block, state)) return;
      const allowed = state.requirement === 'all' || state.requirement === visitor;
      if (!allowed) block.hidden = true;
      else if (!block.hasAttribute('data-g7pb-data-source')) block.hidden = false;
      block.dataset.g7pbVisibilityAllowed = allowed ? 'true' : 'false';
      block.dataset.g7pbVisibilityReady = 'true';
    });
    jobs.set(block, state.job);
  }
  return jobs;
}

export async function bootBlockVisibility(root: Document = document, fetcher: typeof fetch = fetch): Promise<void> {
  const runtime = dataRuntime(root);
  await Promise.all(claimVisibility(runtime, fetcher, () => visitorAudience(runtime, fetcher)).values());
}

function dataCurrent(runtime: DataRuntime, block: HTMLElement, state: DataState): boolean {
  flush(runtime);
  return connected(runtime, block) && runtime.data.get(block) === state;
}

function connectArchive(block: HTMLElement, state: DataState): void {
  if (state.rows === undefined || state.controls) return;
  const pagination = installPagination(block, state.rows);
  pagination.render(state.rows, true);
  const disposeFilters = block.dataset.g7pbDataSource === 'post-archive' && state.rows.length > 0
    ? installArchiveFilters(block, state.rows, state.status, pagination) : undefined;
  state.controls = { nodes: archiveControlNodes(block), dispose: () => { disposeFilters?.(); pagination.dispose(); } };
}

async function loadBlock(runtime: DataRuntime, block: HTMLElement, state: DataState, visitor: Promise<Audience>, visibility?: Promise<void>): Promise<void> {
  await visibility;
  const audience = await visitor;
  if (!dataCurrent(runtime, block, state)) return;
  const required = block.dataset.g7pbAudience ?? 'all';
  if (block.dataset.g7pbVisibilityAllowed === 'false' || (required !== 'all' && required !== audience)) {
    block.hidden = true;
    block.dataset.g7pbDataReady = 'true';
    return;
  }
  block.hidden = false;
  const { list, detail, status } = state;
  const endpoint = block.dataset.g7pbEndpoint ?? '';
  if ((!list && !detail) || !endpoint.startsWith('/api/')) {
    if (status) status.textContent = '데이터 연결 설정을 확인해 주세요.';
    list?.setAttribute('aria-busy', 'false');
    detail?.setAttribute('aria-busy', 'false');
    block.dataset.g7pbDataReady = 'true';
    return;
  }
  list?.setAttribute('aria-busy', 'true');
  detail?.setAttribute('aria-busy', 'true');
  try {
    const response = await state.fetcher(endpoint, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!dataCurrent(runtime, block, state)) return;
    const payload = asRecord(await response.json());
    if (!dataCurrent(runtime, block, state)) return;
    if (!response.ok || !payload || payload.success === false) throw new Error('dynamic data request failed');
    const source = block.dataset.g7pbDataSource;
    if (source === 'post-detail' || source === 'product-detail') {
      const item = payloadRecord(payload);
      const rendered = item
        ? source === 'post-detail' ? renderPostDetail(runtime.root, block, item) : renderProductDetail(runtime.root, block, item) : null;
      detail?.replaceChildren(...(rendered ? [rendered] : []));
      detail?.setAttribute('aria-busy', 'false');
      if (status) status.textContent = rendered ? '' : block.dataset.g7pbEmptyMessage ?? '표시할 콘텐츠가 없습니다.';
    } else {
      if (!list) throw new Error('dynamic list target is missing');
      const basePath = block.dataset.g7pbProductBase ?? '/shop/products';
      const nodes = payloadItems(payload)
        .map((item) => source === 'posts' || source === 'post-archive' ? renderPost(runtime.root, item) : renderProduct(runtime.root, item, basePath))
        .filter((node): node is HTMLElement => node !== null);
      list.replaceChildren(...nodes);
      if (block.dataset.g7pbMotion === 'stagger') {
        const stagger = Number(block.dataset.g7pbMotionStagger ?? 100);
        nodes.forEach((node, index) => {
          node.dataset.g7pbMotionItem = '';
          node.style.setProperty('--g7pb-motion-order', String(index));
          node.style.setProperty('--g7pb-motion-delay', `${index * stagger}ms`);
        });
      }
      list.setAttribute('aria-busy', 'false');
      if (status) status.textContent = nodes.length === 0 ? block.dataset.g7pbEmptyMessage ?? '표시할 항목이 없습니다.' : '';
      state.rows = nodes;
      connectArchive(block, state);
    }
  } catch {
    if (!dataCurrent(runtime, block, state)) return;
    list?.replaceChildren();
    detail?.replaceChildren();
    list?.setAttribute('aria-busy', 'false');
    detail?.setAttribute('aria-busy', 'false');
    if (status) status.textContent = '콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
  block.dataset.g7pbDataReady = 'true';
}

export async function bootDynamicData(root: Document = document, fetcher: typeof fetch = fetch): Promise<void> {
  const runtime = dataRuntime(root);
  let pendingAudience: Promise<Audience> | undefined;
  const audience = (): Promise<Audience> => pendingAudience ??= visitorAudience(runtime, fetcher);
  const visibility = claimVisibility(runtime, fetcher, audience);
  const jobs = [...visibility.values()];
  for (const block of root.querySelectorAll<HTMLElement>('[data-g7pb-data-source]')) {
    const existing = runtime.data.get(block);
    if (existing?.fetcher === fetcher) {
      connectArchive(block, existing);
      jobs.push(existing.job);
      continue;
    }
    if (existing) retireData(runtime, block, existing);
    const state: DataState = { fetcher, inputs: dataInputs(block), list: block.querySelector('[data-g7pb-data-list]'),
      detail: block.querySelector('[data-g7pb-data-detail]'), status: block.querySelector('[data-g7pb-data-status]'), job: Promise.resolve() };
    runtime.data.set(block, state);
    const visitor = (block.dataset.g7pbAudience ?? 'all') === 'all' ? Promise.resolve<Audience>('guest') : audience();
    state.job = loadBlock(runtime, block, state, visitor, visibility.get(block));
    jobs.push(state.job);
  }
  await Promise.all(jobs);
}
