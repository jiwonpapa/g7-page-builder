import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { basicElementComponentConfigs, BadgePreview, IconPreview, ListPreview } from '../../resources/js/editor/basicElementCatalogBlocks';
import { DEFAULT_BADGE, DEFAULT_ICON, DEFAULT_LIST } from '../../resources/js/editor/basicElementCatalogData';
import { basicElementToCanonical, canonicalBasicElementToPuck } from '../../resources/js/editor/basicElementCatalogCodec';
import type { PageBuilderBlock } from '../../resources/js/documents/types';

describe('basic leaf elements', () => {
  it.each([
    ['Icon', 'content.icon-01', DEFAULT_ICON],
    ['List', 'content.list-01', DEFAULT_LIST],
    ['Badge', 'content.badge-01', DEFAULT_BADGE],
  ] as const)('round-trips %s without vendor state or lost appearance', (type, blockType, defaults) => {
    const canonical = basicElementToCanonical(type, { ...defaults, spacing: 'spacious' }, true);
    expect(canonical).not.toBeNull();
    if (!canonical) throw new Error('Missing canonical element');
    const block: PageBuilderBlock = { instance_id: '10000000-0000-4000-8000-000000000001', type: blockType, block_version: 1, props: canonical.props };
    expect(canonicalBasicElementToPuck(block)).toEqual({ type, props: { ...defaults, spacing: 'spacious' } });
    expect(canonical.props).not.toHaveProperty('motion');
    expect(canonical.props).not.toHaveProperty('puck');
  });

  it('keeps empty, oversized and malformed edits visible to the canonical validator', () => {
    const items = Array.from({ length: 21 }, () => ({ text: '' }));
    expect(basicElementToCanonical('List', { ...DEFAULT_LIST, items }, false)?.props.items).toEqual(items);
    expect(basicElementToCanonical('Icon', { ...DEFAULT_ICON, decorative: 'invalid' }, false)?.props.decorative).toBe('invalid');
    expect(basicElementToCanonical('Badge', { ...DEFAULT_BADGE, label: '' }, false)?.props.label).toBe('');
    expect(basicElementToCanonical('Unknown', {}, false)).toBeNull();
    expect(canonicalBasicElementToPuck({ instance_id: 'id', type: 'content.rich-text-01', block_version: 1, props: {} })).toBeNull();
  });

  it('uses semantic lists and keeps Puck inline editors rather than rendering their object values', () => {
    // Puck projects native contentEditable fields as elements while rendering a typed string field.
    const editable = <span contentEditable suppressContentEditableWarning>한글 항목</span>;
    const items = [{ text: 'fallback' }];
    Object.assign(items[0], { text: editable });
    const markup = renderToStaticMarkup(<ListPreview {...DEFAULT_LIST} id="list" ordered items={items} />);
    expect(markup).toContain('<ol class="g7pb-basic-list">');
    expect(markup).toContain('contentEditable="true"');
    expect(markup).toContain('한글 항목');
    expect(markup).not.toContain('[object Object]');
    expect(renderToStaticMarkup(<ListPreview {...DEFAULT_LIST} id="list" />)).toContain('<ul class="g7pb-basic-list">');
  });

  it('separates decorative and meaningful icon accessibility and keeps badges static', () => {
    const decorative = renderToStaticMarkup(<IconPreview {...DEFAULT_ICON} id="icon" label="이름" />);
    expect(decorative).not.toContain('role="img"');
    expect(decorative).not.toContain('aria-label="이름"');
    const meaningful = renderToStaticMarkup(<IconPreview {...DEFAULT_ICON} id="icon" decorative={false} label="보안 인증" />);
    expect(meaningful).toContain('role="img" aria-label="보안 인증"');
    const badge = renderToStaticMarkup(<BadgePreview {...DEFAULT_BADGE} id="badge" label="<script>" icon="check" />);
    expect(badge).toContain('&lt;script&gt;');
    expect(badge).not.toContain('role="status"');
    expect(badge).not.toContain('<button');
    expect(badge).not.toContain('<a ');
  });

  it('exposes bounded native repeaters and plain inline fields', () => {
    expect(basicElementComponentConfigs.List.fields?.items).toMatchObject({ type: 'array', min: 1, max: 20, arrayFields: { text: { type: 'text', contentEditable: true } } });
    expect(basicElementComponentConfigs.Badge.fields?.label).toMatchObject({ type: 'text', contentEditable: true });
    expect(basicElementComponentConfigs.Icon.fields?.label).toEqual({ type: 'text', label: '접근성 이름 (의미 전달 시 필수)' });
  });
});
