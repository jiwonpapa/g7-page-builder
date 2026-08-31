import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { pageBuilderPuckConfig } from '../../resources/js/editor/PuckEditorAdapter';

vi.hoisted(() => {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

function renderBlock(name: string, overrides: Record<string, unknown> = {}): Document {
  const config = pageBuilderPuckConfig.components as unknown as Record<string, {
    defaultProps: Record<string, unknown>;
    render: React.ComponentType<Record<string, unknown>>;
  }>;
  const component = config[name];
  return new DOMParser().parseFromString(renderToStaticMarkup(React.createElement(component.render, {
    ...component.defaultProps, ...overrides, id: 'media-parity-block',
  })), 'text/html');
}

describe('media canvas semantic parity', () => {
  it('keeps a slider image in a bounded figure beside the copy and a real CTA', () => {
    const doc = renderBlock('HeroSlider');
    const slide = doc.querySelector('.g7pb-preview-hero-slider article:not([hidden])');
    expect(slide?.querySelector(':scope > figure[data-g7pb-media-field]')).not.toBeNull();
    expect(slide?.querySelector(':scope > .g7pb-preview-hero-slider__copy')).not.toBeNull();
    expect(slide?.querySelector('a.g7pb-preview-hero-slider__cta')).not.toBeNull();
  });

  it.each(['16:9', '4:3', '1:1'])('separates the %s video frame from its caption', (ratio) => {
    const doc = renderBlock('VideoEmbed', {ratio, caption: '영상 설명'});
    expect(doc.querySelector('.g7pb-preview-video__frame')?.getAttribute('data-ratio')).toBe(ratio);
    expect(doc.querySelector('figure > figcaption [data-g7pb-inline-field="caption"]')?.textContent).toBe('영상 설명');
    expect(doc.querySelector('.g7pb-preview-video__frame [data-g7pb-inline-field="caption"]')).toBeNull();
  });

  it.each(['', '<p></p>', '<p>&nbsp;</p>'])('does not reserve a caption box for empty rich content (%s)', (caption) => {
    const inline = React.createElement('span', {value: caption} as React.HTMLAttributes<HTMLSpanElement>, caption);
    expect(renderBlock('VideoEmbed', {caption: inline}).querySelector('figcaption')).toBeNull();
  });

  it('retains a card CTA when Puck replaces its label with an inline React element', () => {
    const label = React.createElement('span', {}, '상담 보기');
    const doc = renderBlock('CardGrid', {items: [{kicker: '01', title: '상담', body: '안내', linkLabel: label, linkUrl: '/consulting'}]});
    const link = doc.querySelector('.g7pb-preview-card-grid article > a');
    expect(link?.getAttribute('href')).toBe('/consulting');
    expect(link?.textContent).toContain('상담 보기');
  });

  it('renders one carousel image and exposes image navigation instead of a miniature rail', () => {
    const doc = renderBlock('ImageCarousel');
    expect(doc.querySelectorAll('.g7pb-preview-image-carousel__stage figure:not([hidden])')).toHaveLength(1);
    expect(doc.querySelector('button[aria-label="이전 이미지"]')).not.toBeNull();
    expect(doc.querySelector('button[aria-label="다음 이미지"]')).not.toBeNull();
  });
});
