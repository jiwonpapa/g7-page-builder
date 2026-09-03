export interface PaginationController {
  render: (candidates: HTMLElement[], reset?: boolean) => void;
  dispose: () => void;
}

export function archiveControlNodes(block: HTMLElement): (Element | null)[] {
  const nav = block.querySelector('[data-g7pb-pagination]');
  return [nav, nav?.querySelector('[data-g7pb-page-prev]') ?? null,
    nav?.querySelector('[data-g7pb-page-next]') ?? null, nav?.querySelector('[data-g7pb-page-status]') ?? null,
    block.querySelector('[data-g7pb-archive-search]'), block.querySelector('[data-g7pb-archive-filter]')];
}

export function installPagination(block: HTMLElement, nodes: HTMLElement[]): PaginationController {
  const nav = block.querySelector<HTMLElement>('[data-g7pb-pagination]');
  const previous = nav?.querySelector<HTMLButtonElement>('[data-g7pb-page-prev]') ?? null;
  const next = nav?.querySelector<HTMLButtonElement>('[data-g7pb-page-next]') ?? null;
  const status = nav?.querySelector<HTMLElement>('[data-g7pb-page-status]') ?? null;
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
    if (previous) previous.disabled = page <= 1;
    if (next) next.disabled = page >= pageCount;
    if (status) status.textContent = `${page} / ${pageCount}`;
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
    },
  };
}

export function installArchiveFilters(block: HTMLElement, nodes: HTMLElement[], status: HTMLElement | null, pagination: PaginationController): () => void {
  const search = block.querySelector<HTMLInputElement>('[data-g7pb-archive-search]');
  const filter = block.querySelector<HTMLSelectElement>('[data-g7pb-archive-filter]');
  const boards = [...new Set(nodes.map((node) => node.dataset.g7pbArchiveBoard ?? '').filter(Boolean))];
  let disposed = false;
  if (filter) {
    const selectedBoard = filter.value;
    const option = (label: string, value: string): HTMLOptionElement => {
      const element = block.ownerDocument.createElement('option');
      element.textContent = label;
      element.value = value;
      return element;
    };
    filter.replaceChildren(option('전체 게시판', ''), ...boards.map((board) => option(board, board)));
    if (boards.includes(selectedBoard)) filter.value = selectedBoard;
  }
  const apply = (): void => {
    if (disposed) return;
    const query = search?.value.trim().toLocaleLowerCase() ?? '';
    const board = filter?.value ?? '';
    const matches = nodes.filter((node) => (!query || (node.dataset.g7pbArchiveTitle ?? '').includes(query))
      && (!board || node.dataset.g7pbArchiveBoard === board));
    pagination.render(matches, true);
    if (status) status.textContent = matches.length === 0 ? block.dataset.g7pbEmptyMessage ?? '조건에 맞는 게시글이 없습니다.' : '';
  };
  search?.addEventListener('input', apply);
  filter?.addEventListener('change', apply);
  apply();
  return (): void => {
    disposed = true;
    search?.removeEventListener('input', apply);
    filter?.removeEventListener('change', apply);
  };
}
