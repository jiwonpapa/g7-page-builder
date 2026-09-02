import { PAGE_BUILDER_EDITOR_PATH, type DocumentResource } from '../api/pageBuilderApi';

export function editorUrl(documentId: string): string {
  return `${PAGE_BUILDER_EDITOR_PATH}?document=${encodeURIComponent(documentId)}`;
}

export function formatRevisionDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ko-KR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
}

export function formatDocumentDate(value: string | null): string {
  return value ? formatRevisionDate(value) : '기록 없음';
}

export function duplicateSlug(slug: string): string {
  const base = slug.slice(0, 115).replace(/-+$/, '');

  return `${base || 'page'}-copy`;
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentResource['status'], string> = {
  draft: '초안',
  published: '발행됨',
  published_with_changes: '발행 후 변경',
  archived: '보관됨',
};

