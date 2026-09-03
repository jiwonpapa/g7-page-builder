export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function asText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function safeImageSource(value: unknown): string {
  const source = asText(value);
  if (source.startsWith('/') && !source.startsWith('//') && !source.includes('\\')) return source;
  try {
    const parsed = new URL(source);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export function safeLinkSource(value: unknown): string {
  const source = asText(value).trim();
  if (source.startsWith('/') && !source.startsWith('//') && !source.includes('\\')) return source;
  try {
    const parsed = new URL(source);
    return parsed.protocol === 'https:' ? parsed.toString() : '#';
  } catch {
    return '#';
  }
}

export function plainText(root: Document, value: unknown): string {
  const markup = asText(value);
  if (!markup.includes('<')) return markup.trim();
  const container = root.createElement('div');
  container.innerHTML = markup;
  return (container.textContent ?? '').replace(/\s+/gu, ' ').trim();
}
