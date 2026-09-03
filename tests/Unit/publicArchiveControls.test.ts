import { describe, expect, it } from 'vitest';
import { installArchiveFilters, installPagination } from '../../resources/js/public/publicArchiveControls';

function fixture() {
  const root = document.implementation.createHTMLDocument('archive controls');
  root.body.innerHTML = `<section data-g7pb-page-size="1" data-g7pb-empty-message="No matching rows">
    <input data-g7pb-archive-search><select data-g7pb-archive-filter></select><p data-g7pb-data-status></p>
    <div><article data-g7pb-archive-title="alpha" data-g7pb-archive-board="A">Alpha</article>
    <article data-g7pb-archive-title="beta" data-g7pb-archive-board="B">Beta</article>
    <article data-g7pb-archive-title="gamma" data-g7pb-archive-board="A">Gamma</article></div>
    <nav data-g7pb-pagination><button data-g7pb-page-prev>previous</button><span data-g7pb-page-status></span><button data-g7pb-page-next>next</button></nav></section>`;
  const block = root.querySelector<HTMLElement>('section')!;
  const rows = Array.from(block.querySelectorAll<HTMLElement>('article'));
  const status = block.querySelector<HTMLElement>('[data-g7pb-data-status]')!;
  const search = block.querySelector<HTMLInputElement>('input')!;
  const filter = block.querySelector<HTMLSelectElement>('select')!;
  const next = block.querySelector<HTMLButtonElement>('[data-g7pb-page-next]')!;
  const pageStatus = block.querySelector<HTMLElement>('[data-g7pb-page-status]')!;
  return { root, block, rows, status, search, filter, next, pageStatus };
}

describe('archive control lifetimes', () => {
  it('keeps filtering and local page reset while disposing every owned listener and render callback', () => {
    const { block, rows, status, search, filter, next, pageStatus } = fixture();
    const pagination = installPagination(block, rows);
    const disposeFilters = installArchiveFilters(block, rows, status, pagination);
    expect(Array.from(filter.options, option => option.value)).toEqual(['', 'A', 'B']);
    next.click(); expect(pageStatus.textContent).toBe('2 / 3');
    filter.value = 'A'; filter.dispatchEvent(new Event('change'));
    expect(rows.map(row => row.hidden)).toEqual([false, true, true]);
    expect(pageStatus.textContent).toBe('1 / 2');
    next.click(); expect(rows.map(row => row.hidden)).toEqual([true, true, false]);
    search.value = 'missing'; search.dispatchEvent(new Event('input'));
    expect(status.textContent).toBe('No matching rows');
    expect(rows.every(row => row.hidden)).toBe(true);
    search.value = ''; search.dispatchEvent(new Event('input'));
    const before = block.innerHTML;
    disposeFilters(); pagination.dispose(); disposeFilters(); pagination.dispose();
    search.value = 'gamma'; search.dispatchEvent(new Event('input'));
    next.click(); pagination.render([rows[2]], true);
    expect(block.innerHTML).toBe(before);
  });

  it('preserves a still valid board on reinstall and falls back to all when that board disappears', () => {
    const { block, rows, status, filter, next, pageStatus } = fixture();
    const first = installPagination(block, rows);
    const disposeFirst = installArchiveFilters(block, rows, status, first);
    filter.value = 'A'; filter.dispatchEvent(new Event('change'));
    disposeFirst(); first.dispose();
    const second = installPagination(block, rows);
    const disposeSecond = installArchiveFilters(block, rows, status, second);
    expect(filter.value).toBe('A');
    next.click(); expect(pageStatus.textContent).toBe('2 / 2');
    expect(rows.map(row => row.hidden)).toEqual([true, true, false]);
    disposeSecond(); second.dispose();
    const finalRows = [rows[1]];
    const third = installPagination(block, finalRows);
    const disposeThird = installArchiveFilters(block, finalRows, status, third);
    expect(filter.value).toBe(''); expect(rows[1].hidden).toBe(false);
    disposeThird(); third.dispose();
  });
});
