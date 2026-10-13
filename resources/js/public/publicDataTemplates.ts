import { asRecord, asText, plainText, safeImageSource, safeLinkSource } from './publicValues';
import { payloadItems, payloadRecord, type DynamicPayload } from './publicDataRendering';

/** Runtime records fill a cloned authored tree. No block-specific DOM factory or source mutation. */
export function renderDataTemplate(root: Document, block: HTMLElement, payload: DynamicPayload): HTMLElement[] {
  const template = block.querySelector<HTMLTemplateElement>(':scope > template[data-g7pb-data-template]');
  const prototype = template?.content.firstElementChild;
  const fields: unknown = JSON.parse(block.dataset.g7pbV3Data ?? 'null');
  if (!prototype || !Array.isArray(fields)) throw new Error('Invalid authored data template.');
  const detail = (block.dataset.g7pbDataSource ?? '').endsWith('-detail');
  const record = detail ? payloadRecord(payload) : null;
  const items = detail ? record ? [record] : [] : payloadItems(payload);
  const limit = Number(block.dataset.g7pbDataLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error('Invalid data limit.');
  return items.slice(0, limit).map((item, index) => {
    const clone = root.importNode(prototype, true) as HTMLElement;
    const elements = [clone, ...clone.querySelectorAll<HTMLElement>('*')], ids = new Map<string, string>();
    for (const element of elements) if (element.id) {
      const original = element.id, id = original + '-data-' + block.dataset.v3Node + '-' + index;
      ids.set(original, id); element.id = id;
    }
    for (const element of elements) {
      const href = element.getAttribute('href');
      if (href?.startsWith('#') && ids.has(href.slice(1))) element.setAttribute('href', '#' + ids.get(href.slice(1)));
      for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'for']) {
        const value = element.getAttribute(attr);
        if (value) element.setAttribute(attr, value.split(' ').map(id => ids.get(id) ?? id).join(' '));
      }
    }
    const product = (block.dataset.g7pbDataSource ?? '').startsWith('product');
    const board = asRecord(item.board), author = asRecord(item.author);
    const boardSlug = asText(item.board_slug) || asText(board?.slug) || asText(board?.id);
    const key = asText(product ? item.product_code ?? item.id : item.id);
    const title = product ? asText(item.name_localized) || asText(item.name) : asText(item.title);
    const values: Record<string, string> = {
      title, description: plainText(root, product ? item.short_description_localized ?? item.description_localized : item.content),
      image: safeImageSource(product ? item.thumbnail_url : item.thumbnail),
      link: key && (product || boardSlug) ? product ? '/shop/products/' + encodeURIComponent(key) : '/board/' + encodeURIComponent(boardSlug) + '/' + encodeURIComponent(key) : '',
      meta: product ? [asText(item.category_name), asText(item.product_code)].filter(Boolean).join(' · ')
        : [asText(item.board_name) || asText(board?.name), asText(author?.name) || asText(item.author_name), asText(item.created_at_formatted)].filter(Boolean).join(' · '),
      price: product ? asText(item.selling_price_formatted) || asText(item.selling_price) : '',
    };
    if (!title || !key) throw new Error('Invalid public data item.');
    clone.dataset.g7pbArchiveTitle = title.toLocaleLowerCase();
    clone.dataset.g7pbArchiveBoard = asText(item.board_name) || asText(board?.name) || boardSlug;
    for (const raw of fields) {
      const field = asRecord(raw);
      if (!field || typeof field.node_id !== 'string' || typeof field.field !== 'string' || !Object.hasOwn(values, field.field)) throw new Error('Invalid data field.');
      const target = elements.find(element => element.dataset.v3Node === field.node_id);
      if (!target) throw new Error('Missing data field element.');
      const value = values[field.field];
      if (field.property === 'text' && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'A'].includes(target.tagName)) target.textContent = value;
      else if (field.property === 'image' && target.tagName === 'IMG') {
        if (value) target.setAttribute('src', safeImageSource(value)); else target.removeAttribute('src');
        target.hidden = !value;
      } else if (field.property === 'link' && target.tagName === 'A') target.setAttribute('href', safeLinkSource(value));
      else throw new Error('Invalid data field role.');
    }
    return clone;
  });
}
