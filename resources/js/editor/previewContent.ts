import React from 'react';
import { normalizeFontSizeRem } from './fontSize';

export function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) && typeof value[index] === 'object' && value[index] !== null
    ? value[index] as Record<string, unknown>
    : {};
  const candidate = item[key];
  return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback;
}

export function safeLink(value: unknown): string {
  if (typeof value !== 'string') return '#';
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (['https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return trimmed;
    }
  } catch {
    // Invalid values stay visible in the inspector but are inert in the preview.
  }

  return '#';
}

export function safeImage(value: unknown): string | null {
  const link = safeLink(value);
  return link === '#' || link.startsWith('mailto:') || link.startsWith('tel:') ? null : link;
}

export function safePhoneLink(value: unknown): string {
  if (typeof value !== 'string') return '#';
  const trimmed = value.trim();
  if (!/^\+?[0-9][0-9 .()\-]{2,39}$/.test(trimmed)) {
    return '#';
  }

  return safeLink(`tel:${trimmed.replace(/[ .()\-]/g, '')}`);
}

export function safeEmailLink(value: unknown): string {
  if (typeof value !== 'string') return '#';
  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return '#';
  }

  return safeLink(`mailto:${trimmed}`);
}

export function sanitizeRichTextForPreview(value: string): string {
  if (typeof DOMParser === 'undefined') {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  }

  const allowedTags = new Set([
    'P', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'SPAN', 'A', 'OL', 'UL', 'LI', 'BLOCKQUOTE', 'BR',
  ]);
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  const root = parsed.body.firstElementChild;
  if (!root) {
    return '';
  }

  const clean = (node: Element): void => {
    for (const child of Array.from(node.children)) {
      clean(child);
      if (!allowedTags.has(child.tagName)) {
        child.replaceWith(...Array.from(child.childNodes));
        continue;
      }

      const href = child.tagName === 'A' ? child.getAttribute('href') ?? '' : '';
      const typedMarks = child.tagName === 'SPAN' ? {
        font: child.getAttribute('data-g7pb-font') ?? '',
        fontSizeRem: child.getAttribute('data-g7pb-font-size-rem') ?? '',
        size: child.getAttribute('data-g7pb-size') ?? '',
        weight: child.getAttribute('data-g7pb-weight') ?? '',
        tone: child.getAttribute('data-g7pb-tone') ?? '',
      } : null;
      for (const attribute of Array.from(child.attributes)) {
        child.removeAttribute(attribute.name);
      }
      if (child.tagName === 'A' && safeLink(href) !== '#') {
        child.setAttribute('href', safeLink(href));
        child.setAttribute('rel', 'noopener noreferrer');
      }
      if (typedMarks) {
        if (['modern', 'serif', 'mono'].includes(typedMarks.font)) child.setAttribute('data-g7pb-font', typedMarks.font);
        const fontSizeRem = normalizeFontSizeRem(Number(typedMarks.fontSizeRem));
        if (fontSizeRem !== undefined) child.setAttribute('data-g7pb-font-size-rem', String(fontSizeRem));
        if (['small', 'large', 'xlarge'].includes(typedMarks.size)) child.setAttribute('data-g7pb-size', typedMarks.size);
        if (['medium', 'semibold', 'bold'].includes(typedMarks.weight)) child.setAttribute('data-g7pb-weight', typedMarks.weight);
        if (['muted', 'accent', 'contrast', 'custom1', 'custom2', 'custom3', 'custom4'].includes(typedMarks.tone)) child.setAttribute('data-g7pb-tone', typedMarks.tone);
      }
    }
  };
  clean(root);

  return root.innerHTML;
}

