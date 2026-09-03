import { asRecord, asText, plainText, safeImageSource, safeLinkSource } from './publicValues';

export interface DynamicPayload {
  success?: boolean;
  data?: unknown;
}

export function payloadItems(payload: DynamicPayload): Record<string, unknown>[] {
  const nested = asRecord(payload.data);
  const values = Array.isArray(payload.data) ? payload.data : nested && Array.isArray(nested.data) ? nested.data : [];
  return values.map(asRecord).filter((item): item is Record<string, unknown> => item !== null);
}

export function payloadRecord(payload: DynamicPayload): Record<string, unknown> | null {
  const data = asRecord(payload.data);
  if (!data) return null;
  return asRecord(data.data) ?? data;
}

export function renderPost(root: Document, item: Record<string, unknown>): HTMLElement | null {
  const board = asRecord(item.board);
  const boardSlug = asText(item.board_slug) || asText(board?.slug) || asText(board?.id);
  const id = asText(item.id);
  const title = asText(item.title);
  if (!boardSlug || !id || !title) return null;

  const article = root.createElement('article');
  article.dataset.g7pbArchiveTitle = title.toLocaleLowerCase();
  article.dataset.g7pbArchiveBoard = asText(item.board_name) || asText(board?.name) || boardSlug;
  const link = root.createElement('a');
  link.href = `/board/${encodeURIComponent(boardSlug)}/${encodeURIComponent(id)}`;
  const heading = root.createElement('strong');
  heading.textContent = title;
  const meta = root.createElement('span');
  meta.textContent = [article.dataset.g7pbArchiveBoard, asText(item.created_at_formatted)].filter(Boolean).join(' · ');
  link.append(heading, meta);
  article.append(link);
  return article;
}

export function renderPostDetail(root: Document, block: HTMLElement, item: Record<string, unknown>): HTMLElement | null {
  const title = asText(item.title);
  if (!title) return null;
  const article = root.createElement('article');
  const meta = root.createElement('p');
  meta.className = 'g7pb-data-detail__meta';
  const author = asRecord(item.author);
  meta.textContent = [asText(author?.name) || asText(item.author_name), asText(item.created_at_formatted), asText(item.view_count) ? `조회 ${asText(item.view_count)}` : ''].filter(Boolean).join(' · ');
  const heading = root.createElement('h3');
  heading.textContent = title;
  article.append(meta, heading);
  const thumbnail = safeImageSource(item.thumbnail);
  if (thumbnail) {
    const image = root.createElement('img');
    image.src = thumbnail;
    image.alt = '';
    image.loading = 'lazy';
    article.append(image);
  }
  if (block.dataset.g7pbShowContent !== 'false') {
    const content = plainText(root, item.content);
    if (content) {
      const paragraph = root.createElement('p');
      paragraph.textContent = content;
      article.append(paragraph);
    }
  }
  const link = block.querySelector<HTMLAnchorElement>('[data-g7pb-detail-action]') ?? root.createElement('a');
  link.href = safeLinkSource(block.dataset.g7pbDetailUrl);
  link.textContent = block.dataset.g7pbDetailLabel ?? '게시글 전체 보기';
  link.hidden = false;
  article.append(link);
  return article;
}

export function renderProductDetail(root: Document, block: HTMLElement, item: Record<string, unknown>): HTMLElement | null {
  const name = asText(item.name_localized) || asText(item.name);
  if (!name) return null;
  const article = root.createElement('article');
  const imageSource = safeImageSource(item.thumbnail_url);
  if (imageSource) {
    const image = root.createElement('img');
    image.src = imageSource;
    image.alt = '';
    image.loading = 'lazy';
    article.append(image);
  } else {
    const placeholder = root.createElement('span');
    placeholder.className = 'g7pb-data-detail__placeholder';
    placeholder.textContent = '상품 이미지';
    article.append(placeholder);
  }
  const body = root.createElement('div');
  const meta = root.createElement('p');
  meta.className = 'g7pb-data-detail__meta';
  meta.textContent = [asText(item.category_name), asText(item.product_code)].filter(Boolean).join(' · ');
  const heading = root.createElement('h3');
  heading.textContent = name;
  const price = root.createElement('strong');
  price.textContent = asText(item.selling_price_formatted) || asText(item.selling_price);
  body.append(meta, heading, price);
  if (block.dataset.g7pbShowDescription !== 'false') {
    const description = plainText(root, item.short_description_localized) || plainText(root, item.description_localized);
    if (description) {
      const paragraph = root.createElement('p');
      paragraph.textContent = description;
      body.append(paragraph);
    }
  }
  const link = block.querySelector<HTMLAnchorElement>('[data-g7pb-detail-action]') ?? root.createElement('a');
  link.href = safeLinkSource(block.dataset.g7pbDetailUrl);
  link.textContent = block.dataset.g7pbDetailLabel ?? '상품 전체 보기';
  link.hidden = false;
  body.append(link);
  article.append(body);
  return article;
}

export function renderProduct(root: Document, item: Record<string, unknown>, basePath: string): HTMLElement | null {
  const key = asText(item.product_code) || asText(item.id);
  const name = asText(item.name_localized) || asText(item.name);
  if (!key || !name) return null;

  const article = root.createElement('article');
  const link = root.createElement('a');
  link.href = `${basePath}/${encodeURIComponent(key)}`;
  const source = safeImageSource(item.thumbnail_url);
  if (source) {
    const image = root.createElement('img');
    image.src = source;
    image.alt = '';
    image.loading = 'lazy';
    link.append(image);
  } else {
    const placeholder = root.createElement('span');
    placeholder.className = 'g7pb-dynamic-products__placeholder';
    placeholder.textContent = '상품 이미지';
    link.append(placeholder);
  }
  const heading = root.createElement('strong');
  heading.textContent = name;
  const price = root.createElement('span');
  price.textContent = asText(item.selling_price_formatted) || asText(item.selling_price);
  link.append(heading, price);
  article.append(link);
  return article;
}
