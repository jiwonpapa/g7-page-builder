import { describe, expect, it } from 'vitest';
import { archiveControlNodes, installArchiveFilters, installPagination } from '../../resources/js/public/publicArchiveControls';

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
  it('preserves authored responsive display across filtering, frozen disposal and reinstallation', () => {
    const { block, rows, next } = fixture();
    rows[0].style.display = 'var(--g7pb-v3-current-display, flex)';
    rows[1].style.setProperty('display', 'grid', 'important');
    const pagination = installPagination(block, rows);
    expect(rows.map(row => row.style.display)).toEqual(['var(--g7pb-v3-current-display, flex)', 'none', 'none']);
    next.click();
    expect(rows.map(row => row.hidden)).toEqual([true, false, true]);
    expect(rows[1].style.display).toBe('grid'); expect(rows[1].style.getPropertyPriority('display')).toBe('important');
    pagination.render([], true);
    expect(rows.every(row => row.hidden && row.style.display === 'none')).toBe(true);
    const before = rows.map(row => row.outerHTML);
    pagination.dispose(); pagination.dispose(); next.click(); pagination.render(rows, true);
    expect(rows.map(row => row.outerHTML)).toEqual(before);
    const replacement = installPagination(block, rows);
    expect(rows[0].hidden).toBe(false);
    expect(rows[0].style.display).toBe('var(--g7pb-v3-current-display, flex)');
    next.click(); expect(rows[1].style.display).toBe('grid');
    next.click(); expect(rows[2].hidden).toBe(false); expect(rows[2].style.display).toBe('');
    replacement.render([rows[0]], true);
    expect(rows[0].style.display).toBe('var(--g7pb-v3-current-display, flex)');
    expect(rows[1].style.display).toBe('none'); expect(rows[2].style.display).toBe('none');
    replacement.dispose();
  });

  it('connects authored sibling controls only inside their source surface, suggests categories and releases owned DOM', () => {
    const { root, block, rows, status } = fixture();
    const surface = root.createElement('div'); surface.dataset.v3Surface = 'true';
    block.replaceWith(surface); surface.append(block);
    const search = root.createElement('input'), filter = root.createElement('input');
    const previous = root.createElement('button'), next = root.createElement('button'), page = root.createElement('p');
    const controls = [previous, next, page, search, filter];
    controls.forEach((control, index) => { control.dataset.v3Node = 'control-' + index; control.id = 'node-control-' + index; surface.append(control); });
    block.dataset.g7pbV3Controls = JSON.stringify({ previous_id: 'control-0', next_id: 'control-1', status_id: 'control-2', search_id: 'control-3', filter_id: 'control-4', page_size: 1 });
    const other = root.createElement('div'); other.dataset.v3Surface = 'true';
    other.innerHTML = '<input data-v3-node="control-3" value="other surface">'; root.body.prepend(other);
    expect(archiveControlNodes(block)).toEqual([null, previous, next, page, search, filter]);
    const pagination = installPagination(block, rows), dispose = installArchiveFilters(block, rows, status, pagination);
    expect(page.getAttribute('role')).toBe('status'); expect(page.getAttribute('aria-live')).toBe('polite');
    expect(filter.getAttribute('list')).toBe('node-control-4-data-options');
    expect(Array.from(block.querySelectorAll('datalist option'), option => option.getAttribute('value'))).toEqual(['', 'A', 'B']);
    next.click(); expect(page.textContent).toBe('2 / 3');
    filter.value = 'A'; filter.dispatchEvent(new Event('input'));
    expect(page.textContent).toBe('1 / 2'); expect(rows.map(row => row.hidden)).toEqual([false, true, true]);
    next.click(); expect(rows.map(row => row.hidden)).toEqual([true, true, false]);
    search.value = 'missing'; search.dispatchEvent(new Event('input'));
    expect(status.hidden).toBe(false); expect(status.textContent).toBe('No matching rows'); expect(page.textContent).toBe('0 / 0');
    search.value = ''; search.dispatchEvent(new Event('input')); expect(status.hidden).toBe(true);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }); search.dispatchEvent(enter); expect(enter.defaultPrevented).toBe(true);
    const composing = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true }); search.dispatchEvent(composing); expect(composing.defaultPrevented).toBe(false);
    expect(other.querySelector('input')?.value).toBe('other surface');
    const before = rows.map(row => row.outerHTML);
    dispose(); pagination.dispose(); dispose(); pagination.dispose();
    expect(block.querySelector('datalist')).toBeNull(); expect(filter.hasAttribute('list')).toBe(false);
    expect(page.hasAttribute('role')).toBe(false); expect(page.hasAttribute('aria-live')).toBe(false);
    search.value = 'beta'; search.dispatchEvent(new Event('input')); next.click(); pagination.render([rows[1]], true);
    expect(rows.map(row => row.outerHTML)).toEqual(before);
  });

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
