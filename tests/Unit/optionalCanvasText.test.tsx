import React from 'react';
import { Render } from '@puckeditor/core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { pageBuilderPuckConfig } from '../../resources/js/editor/PuckEditorAdapter';
import { canvasTextValue } from '../../resources/js/editor/foundationCatalogBlocks';

vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

type InlineProps = { value?: string; content?: string; children?: React.ReactNode };
function InlineValue({ children }: InlineProps): React.ReactNode { return children; }
function inline(value: string, readOnly = false): React.ReactElement {
  return <InlineValue {...(readOnly ? { content: value } : { value })}>{value}</InlineValue>;
}

const components = pageBuilderPuckConfig.components as unknown as Record<string, {
  defaultProps: Record<string, unknown>;
  render: React.ComponentType<Record<string, unknown>>;
}>;

function renderBlock(type: string, props: Record<string, unknown>): Document {
  const component = components[type];
  return new DOMParser().parseFromString(renderToStaticMarkup(React.createElement(component.render, {
    ...component.defaultProps, ...props, id: 'optional-text-test',
  })), 'text/html');
}

describe('optional canvas text presence', () => {
  it('does not interpret literal angle brackets or entities in plain labels as HTML', () => {
    for (const value of ['<안내>', '&nbsp;']) {
      expect(canvasTextValue(inline(value), 'plain')).toBe(value);
      const hero = renderBlock('Hero', { primaryLabel: inline(value), primaryUrl: '/next' });
      expect(hero.querySelector('a[href="/next"]')?.textContent).toBe(value);
    }
  });

  it.each(['', ' \n\t', '<p><br></p>', '<p>&nbsp;</p>', '<p>&#160;&#xA0;</p>'])
    ('treats empty plain/editable/read-only content consistently: %j', (value) => {
      expect(canvasTextValue(value)).toBe('');
      expect(canvasTextValue(inline(value))).toBe('');
      expect(canvasTextValue(inline(value, true))).toBe('');
      expect(canvasTextValue(<React.Suspense>{inline(value, true)}</React.Suspense>)).toBe('');
    });

  it('retains real text through the pinned Puck editable, read-only and Suspense prop shapes', () => {
    const text = '<p>정상 <strong>본문</strong></p>';
    for (const value of [text, inline(text), inline(text, true), <React.Suspense>{inline(text, true)}</React.Suspense>]) {
      expect(canvasTextValue(value)).toBe('정상 본문');
    }
    expect(canvasTextValue(<InlineValue value="" content="빈 값 대신 노출하면 안 됩니다" />)).toBe('');
    expect(canvasTextValue(null)).toBe('');
    expect(canvasTextValue({ value: 'React 요소가 아님' })).toBe('');
  });

  it.each(['classic', 'balanced'])('omits empty Hero copy/actions and keeps populated actions in %s layout', (layout) => {
    const empty = renderBlock('Hero', { layout, eyebrow: inline(''), primaryLabel: inline('') });
    expect(empty.querySelector('[data-g7pb-inline-field="eyebrow"]')).toBeNull();
    expect(empty.querySelector('[data-g7pb-inline-field="primaryLabel"]')).toBeNull();
    const populated = renderBlock('Hero', { layout, eyebrow: inline('소개'), primaryLabel: inline('다음 단계'), primaryUrl: '/next' });
    expect(populated.querySelector('[data-g7pb-inline-field="eyebrow"]')?.textContent).toBe('소개');
    expect(populated.querySelector('a[href="/next"]')?.textContent).toBe('다음 단계');
  });

  it('omits a blank CTA body/actions from read-only output without hiding populated rich content', () => {
    const empty = renderBlock('Cta', { eyebrow: inline(''), body: inline('<p><br></p>', true), primaryLabel: inline(''), secondaryLabel: inline('') });
    for (const field of ['eyebrow', 'body', 'primaryLabel', 'secondaryLabel']) {
      expect(empty.querySelector(`[data-g7pb-inline-field="${field}"]`)).toBeNull();
    }
    expect(empty.querySelector('.g7pb-preview-cta-split__actions')).toBeNull();
    const populated = renderBlock('Cta', { body: inline('정상 본문', true), primaryLabel: inline('신청'), secondaryLabel: inline('문의') });
    expect(populated.querySelector('[data-g7pb-inline-field="body"]')?.textContent).toBe('정상 본문');
    expect(populated.querySelectorAll('.g7pb-preview-cta-split__actions a')).toHaveLength(2);
  });

  it('keeps nonempty CTA body through the actual Puck Render/Suspense transform', () => {
    const html = renderToStaticMarkup(<Render config={pageBuilderPuckConfig} data={{
      root: { props: {} },
      content: [{ type: 'Cta', props: { ...components.Cta.defaultProps, id: 'puck-readonly-cta', body: '<p>읽기 전용에서도 보이는 본문</p>' } }],
    }} />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('[data-g7pb-inline-field="body"]')?.textContent).toBe('읽기 전용에서도 보이는 본문');
  });

  it('removes blank contact address/actions without losing the phone and email', () => {
    const doc = renderBlock('Contact', { address: inline(''), ctaLabel: inline(''), mapLabel: inline(''), phone: '02-1234-5678', email: 'team@example.com' });
    for (const field of ['address', 'ctaLabel', 'mapLabel']) {
      expect(doc.querySelector(`[data-g7pb-inline-field="${field}"]`)).toBeNull();
    }
    expect(doc.querySelector('.g7pb-preview-contact__actions')).toBeNull();
    expect(doc.querySelector('a[href="tel:0212345678"]')).not.toBeNull();
    expect(doc.querySelector('a[href="mailto:team@example.com"]')).not.toBeNull();
    const populated = renderBlock('Contact', { address: inline('서울'), ctaLabel: inline('문의'), mapLabel: inline('길찾기') });
    expect(populated.querySelector('[data-g7pb-inline-field="address"]')?.textContent).toBe('서울');
    expect(populated.querySelectorAll('.g7pb-preview-contact__actions a')).toHaveLength(2);
  });

  it('omits an empty Heading eyebrow and retains a populated one', () => {
    expect(renderBlock('Heading', { eyebrow: inline('') }).querySelector('[data-g7pb-inline-field="eyebrow"]')).toBeNull();
    expect(renderBlock('Heading', { eyebrow: inline('소제목') }).querySelector('[data-g7pb-inline-field="eyebrow"]')?.textContent).toBe('소제목');
  });
});
