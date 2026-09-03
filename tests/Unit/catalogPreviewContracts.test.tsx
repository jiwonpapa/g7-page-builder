import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
const { HeroSplitPreview, InquiryFormPreview, MapDirectionsPreview } = await import('../../resources/js/editor/catalogPreviews');
const data = await import('../../resources/js/editor/catalogData');
const fields = await import('../../resources/js/editor/catalogFields');
const entry = await import('../../resources/js/editor/catalogBlocks');
const codec = await import('../../resources/js/editor/catalogCodec');
const { CatalogGalleryThumbnail } = await import('../../resources/js/editor/CatalogGalleryThumbnail');
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach((run) => run())); });

function element<T extends HTMLElement>(host: HTMLElement, selector: string): T {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}
function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  cleanup.push(() => { root.unmount(); host.remove(); });
  return { host, async render(children: React.ReactNode) { await act(async () => root.render(children)); } };
}

describe('catalog UI owners', () => {
  it('retains the compatibility bindings and live field callbacks in the composed configuration', () => {
    expect(entry.canonicalCatalogBlockToPuck).toBe(codec.canonicalCatalogBlockToPuck);
    expect(entry.catalogPuckBlockToCanonical).toBe(codec.catalogPuckBlockToCanonical);
    expect(entry.CatalogGalleryThumbnail).toBe(CatalogGalleryThumbnail);
    expect(entry.catalogComponentConfigs.HeroSlider.fields).toBe(fields.heroSliderFields);
    expect(entry.catalogComponentConfigs.HeroSlider.defaultProps).toBe(data.DEFAULT_HERO_SLIDER);
    expect(entry.catalogComponentConfigs.Pricing.fields).toBe(fields.pricingFields);
    const slides = fields.heroSliderFields?.slides;
    if (slides?.type !== 'array') throw new Error('Expected native array field');
    const item = { eyebrow: '', title: 'Dynamic sentinel', body: '', buttonLabel: '', buttonUrl: '', imageSrc: '', imageAlt: '' };
    expect(slides.getItemSummary?.(item, 2)).toBe('Dynamic sentinel');
    expect(slides.arrayFields.title).toMatchObject({ type: 'richtext', contentEditable: true, visible: false });
    expect(slides.arrayFields.imageAlt).toMatchObject({ type: 'text' });
  });

  it('keeps rich body children and focus across appearance rerenders while projecting safe media and links', async () => {
    const view = mount();
    const body = <input aria-label="Synthetic body input" defaultValue="Owned input" />;
    const props = { ...data.DEFAULT_HERO_SPLIT, id: 'synthetic-hero', title: 'Title', body,
      primaryLabel: 'Action', primaryUrl: 'javascript:alert(1)', imageSrc: '//untrusted.test/image', imageAlt: 'Alt' };
    await view.render(<HeroSplitPreview {...props} />);
    const input = element<HTMLInputElement>(view.host, 'input');
    input.focus();
    expect(element<HTMLAnchorElement>(view.host, 'a').getAttribute('href')).toBe('#');
    expect(view.host.querySelector('img')).toBeNull();
    expect(element(view.host, '[data-g7pb-media-field="imageSrc"]')).not.toBeNull();
    await view.render(<HeroSplitPreview {...props} surface="contrast" spacing="compact" imageSrc="https://example.test/image.png" />);
    expect(element(view.host, 'input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('Owned input');
    expect(element<HTMLImageElement>(view.host, 'img').getAttribute('src')).toBe('https://example.test/image.png');
    expect(element(view.host, '.g7pb-preview-hero-split').classList.contains('g7pb-preview-surface--contrast')).toBe(true);
    expect(element(view.host, '[data-g7pb-inline-field="body"]').contains(input)).toBe(true);
  });

  it('keeps inquiry option visibility and read-only preview controls on prop changes', async () => {
    const view = mount();
    const props = { ...data.DEFAULT_INQUIRY_FORM, id: 'synthetic-form', showPhone: false, showSubject: false };
    await view.render(<InquiryFormPreview {...props} />);
    const form = element<HTMLFormElement>(view.host, 'form');
    expect(form.querySelectorAll('input:not([type="checkbox"])')).toHaveLength(2);
    expect(element<HTMLButtonElement>(view.host, 'button').type).toBe('button');
    await view.render(<InquiryFormPreview {...props} showPhone showSubject />);
    expect(element(view.host, 'form')).toBe(form);
    expect(form.querySelectorAll('input:not([type="checkbox"])')).toHaveLength(4);
    expect(Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input,textarea'))
      .every((input) => input.readOnly)).toBe(true);
  });

  it('exposes the image field only for image-map previews and keeps the thumbnail fallback separate', async () => {
    const view = mount();
    const props = { ...data.DEFAULT_MAP_DIRECTIONS, id: 'synthetic-map', mapImageSrc: '/map.png', mapImageAlt: 'Synthetic map' };
    await view.render(<MapDirectionsPreview {...props} />);
    expect(element(view.host, 'figure').getAttribute('data-g7pb-media-field')).toBe('mapImageSrc');
    expect(element<HTMLImageElement>(view.host, 'img').alt).toBe('Synthetic map');
    await view.render(<MapDirectionsPreview {...props} provider="none" />);
    expect(element(view.host, 'figure').hasAttribute('data-g7pb-media-field')).toBe(false);
    expect(view.host.querySelector('img')).toBeNull();
    await view.render(<CatalogGalleryThumbnail type="HeroSlider" />);
    expect(element(view.host, '[data-block-preview="HeroSlider"]').getAttribute('data-g7pb-thumbnail-state')).toBe('unavailable');
  });
});
