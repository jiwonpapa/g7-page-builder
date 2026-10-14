import { asRecord } from './publicValues';

export interface PaginationController {
  render: (candidates: HTMLElement[], reset?: boolean) => void;
  dispose: () => void;
}

export function archiveControlNodes(block: HTMLElement): (HTMLElement | null)[] {
  if (block.hasAttribute('data-g7pb-v3-controls')) {
    try {
      const refs = asRecord(JSON.parse(block.dataset.g7pbV3Controls ?? 'null'));
      const surface = block.closest('[data-v3-surface]');
      const elements = Array.from(surface?.querySelectorAll<HTMLElement>('[data-v3-node]') ?? []);
      return [null, ...['previous_id', 'next_id', 'status_id', 'search_id', 'filter_id'].map(role => {
        const id = refs?.[role];
        return typeof id === 'string' ? elements.find(node => node.dataset.v3Node === id) ?? null : null;
      })];
    } catch { return [null, null, null, null, null, null]; }
  }
  const nav = block.querySelector<HTMLElement>('[data-g7pb-pagination]');
  return [nav, nav?.querySelector<HTMLElement>('[data-g7pb-page-prev]') ?? null,
    nav?.querySelector<HTMLElement>('[data-g7pb-page-next]') ?? null, nav?.querySelector<HTMLElement>('[data-g7pb-page-status]') ?? null,
    block.querySelector<HTMLElement>('[data-g7pb-archive-search]'), block.querySelector<HTMLElement>('[data-g7pb-archive-filter]')];
}

/** Only the captured controls are disabled; late disposal cannot acquire replacement nodes. */
export function setArchiveControlsEnabled(nodes: (Element | null)[], enabled: boolean): void {
  for (const index of [1, 2, 4, 5]) nodes[index]?.toggleAttribute('disabled', !enabled);
}

export function installPagination(block: HTMLElement, nodes: HTMLElement[]): PaginationController {
  const [nav, previous, next, status] = archiveControlNodes(block);
  const authored = block.hasAttribute('data-g7pb-v3-controls');
  const originalRole = status?.getAttribute('role'), originalLive = status?.getAttribute('aria-live');
  if (authored && status) { status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); }
  const pageSize = Math.max(1, Number(block.dataset.g7pbPageSize) || nodes.length || 1);
  let page = 1;
  let active = nodes;
  let disposed = false;

  const paint = (): void => {
    if (disposed) return;
    const pageCount = Math.max(1, Math.ceil(active.length / pageSize));
    page = Math.min(Math.max(1, page), pageCount);
    const visible = new Set(active.slice((page - 1) * pageSize, page * pageSize));
    nodes.forEach((node) => { node.hidden = !visible.has(node); });
    if (nav) nav.hidden = active.length === 0 || pageCount <= 1;
    previous?.toggleAttribute('disabled', page <= 1);
    next?.toggleAttribute('disabled', page >= pageCount);
    if (status) status.textContent = active.length === 0 && block.hasAttribute('data-g7pb-v3-controls') ? '0 / 0' : `${page} / ${pageCount}`;
  };
  const previousPage = (): void => { page -= 1; paint(); };
  const nextPage = (): void => { page += 1; paint(); };
  previous?.addEventListener('click', previousPage);
  next?.addEventListener('click', nextPage);
  paint();

  return {
    render(candidates, reset = false): void {
      if (disposed) return;
      active = candidates;
      if (reset) page = 1;
      paint();
    },
    dispose(): void {
      disposed = true;
      previous?.removeEventListener('click', previousPage);
      next?.removeEventListener('click', nextPage);
      if (authored && status) for (const [name, value, owned] of [['role', originalRole, 'status'], ['aria-live', originalLive, 'polite']] as const) {
        if (status.getAttribute(name) !== owned) continue;
        if (value === null || value === undefined) status.removeAttribute(name); else status.setAttribute(name, value);
      }
    },
  };
}

export function installArchiveFilters(block: HTMLElement, nodes: HTMLElement[], status: HTMLElement | null, pagination: PaginationController): () => void {
  const nodesByRole = archiveControlNodes(block);
  const searchNode = nodesByRole[4], filterNode = nodesByRole[5];
  const search = searchNode?.tagName === 'INPUT' ? searchNode as HTMLInputElement : null;
  const filter = filterNode && ['INPUT', 'SELECT'].includes(filterNode.tagName) ? filterNode as HTMLInputElement | HTMLSelectElement : null;
  const boards = [...new Set(nodes.map((node) => node.dataset.g7pbArchiveBoard ?? '').filter(Boolean))];
  let disposed = false;
  let suggestions: HTMLDataListElement | undefined;
  const originalList = filter?.getAttribute('list');
  if (filter) {
    const selectedBoard = filter.value;
    const option = (label: string, value: string): HTMLOptionElement => {
      const element = block.ownerDocument.createElement('option');
      element.textContent = label;
      element.value = value;
      return element;
    };
    const choices = [option(block.hasAttribute('data-g7pb-v3-controls') ? '전체 분류' : '전체 게시판', ''), ...boards.map((board) => option(board, board))];
    if (filter.tagName === 'SELECT') filter.replaceChildren(...choices);
    else {
      suggestions = block.ownerDocument.createElement('datalist');
      suggestions.id = filter.id + '-data-options';
      suggestions.replaceChildren(...choices);
      filter.setAttribute('list', suggestions.id);
      block.append(suggestions);
    }
    filter.value = boards.includes(selectedBoard) ? selectedBoard : '';
  }
  const apply = (): void => {
    if (disposed) return;
    const query = search?.value.trim().toLocaleLowerCase() ?? '';
    const board = filter?.value.trim().toLocaleLowerCase() ?? '';
    const matches = nodes.filter((node) => (!query || (node.dataset.g7pbArchiveTitle ?? '').includes(query))
      && (!board || node.dataset.g7pbArchiveBoard?.toLocaleLowerCase() === board));
    pagination.render(matches, true);
    if (status) {
      status.textContent = matches.length === 0 ? block.dataset.g7pbEmptyMessage ?? (block.hasAttribute('data-g7pb-v3-controls') ? '조건에 맞는 콘텐츠가 없습니다.' : '조건에 맞는 게시글이 없습니다.') : '';
      if (block.hasAttribute('data-g7pb-v3-controls')) status.hidden = matches.length > 0;
    }
  };
  const preventSubmit = (event: Event): void => { if ('key' in event && event.key === 'Enter') event.preventDefault(); };
  search?.addEventListener('input', apply);
  search?.addEventListener('keydown', preventSubmit);
  filter?.addEventListener('input', apply);
  filter?.addEventListener('change', apply);
  filter?.addEventListener('keydown', preventSubmit);
  apply();
  return (): void => {
    disposed = true;
    search?.removeEventListener('input', apply);
    search?.removeEventListener('keydown', preventSubmit);
    filter?.removeEventListener('input', apply);
    filter?.removeEventListener('change', apply);
    filter?.removeEventListener('keydown', preventSubmit);
    if (suggestions && filter?.getAttribute('list') === suggestions.id) {
      if (originalList === null || originalList === undefined) filter.removeAttribute('list'); else filter.setAttribute('list', originalList);
    }
    suggestions?.remove();
  };
}
