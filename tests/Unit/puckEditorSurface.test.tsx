import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PageBuilderDocument } from '../../resources/js/documents/types';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { PuckEditorAdapter } = await import('../../resources/js/editor/PuckEditorAdapter');

const fixture: PageBuilderDocument = {
  schema_version: 'g7-page-builder/v1',
  document_id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'surface-test',
  mode: 'canvas',
  locale: 'ko',
  tokens: {},
  blocks: [
    {
      instance_id: '223e4567-e89b-42d3-a456-426614174001',
      type: 'content.hero-centered-01',
      block_version: 1,
      props: {
        eyebrow: 'Hero eyebrow',
        title: 'Hero title',
        body: '<p>Hero body</p>',
        alignment: 'center',
      },
      slots: {},
    },
    {
      instance_id: '323e4567-e89b-42d3-a456-426614174002',
      type: 'content.features-grid-01',
      block_version: 1,
      props: {
        title: 'Features title',
        items: [
          { icon: 'sparkles', title: 'First title', body: 'First body' },
          { icon: 'shield', title: 'Second title', body: 'Second body' },
        ],
      },
      slots: {},
    },
    {
      instance_id: '423e4567-e89b-42d3-a456-426614174003',
      type: 'content.cta-split-01',
      block_version: 1,
      props: {
        eyebrow: 'CTA eyebrow',
        heading: 'CTA heading',
        body: 'CTA body',
        primaryLink: { label: 'Primary', url: '/start' },
        secondaryLink: { label: 'Secondary', url: '/about' },
        theme: 'dark',
      },
      slots: {},
    },
    {
      instance_id: '523e4567-e89b-42d3-a456-426614174004',
      type: 'content.contact-info-01',
      block_version: 1,
      props: {
        heading: 'Contact heading',
        address: 'Seoul address',
        phone: '02-1234-5678',
        email: 'hello@example.com',
        cta: { label: 'Contact us', url: '/contact' },
        mapLink: { label: 'Map', url: 'https://maps.example.com/' },
      },
      slots: {},
    },
  ],
};

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) {
    cleanup();
  }
  document.body.replaceChildren();
});

async function eventually<T extends Element>(selector: string): Promise<T> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const element = document.querySelector<T>(selector);
    if (element) {
      return element;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  throw new Error(`Element not rendered: ${selector}`);
}

describe('Puck editor surface contract', () => {
  it('renders stable block and inspector selectors through the adapter', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
    });

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={fixture}
          revisionKey={0}
          onChange={() => undefined}
          onPublish={() => undefined}
        />,
      );
    });

    const hero = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="hero"]');
    const features = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="features"]');
    const cta = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="cta"]');
    const contact = await eventually<HTMLElement>('[data-testid="page-builder-block"][data-block-type="contact"]');
    expect(document.querySelectorAll('[data-testid="page-builder-block"]')).toHaveLength(4);
    expect(hero.textContent).toContain('Hero body');
    expect(hero.textContent).not.toContain('[object Object]');

    await act(async () => {
      hero.click();
    });
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-hero-title"]')).value).toBe('Hero title');
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-hero-subtitle"]')).value).toBe('Hero eyebrow');

    await act(async () => {
      features.click();
    });
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-features-heading"]')).value).toBe('Features title');
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-features-item-0-title"]')).value).toBe('First title');
    expect((await eventually<HTMLTextAreaElement>('[data-testid="page-builder-features-item-0-body"]')).value).toBe('First body');

    await act(async () => {
      cta.click();
    });
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-cta-heading"]')).value).toBe('CTA heading');
    expect((await eventually<HTMLTextAreaElement>('[data-testid="page-builder-cta-body"]')).value).toBe('CTA body');
    expect((await eventually<HTMLSelectElement>('[data-testid="page-builder-cta-theme"]')).value).toBe('dark');

    await act(async () => {
      contact.click();
    });
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-contact-heading"]')).value).toBe('Contact heading');
    expect((await eventually<HTMLTextAreaElement>('[data-testid="page-builder-contact-address"]')).value).toBe('Seoul address');
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-contact-email"]')).value).toBe('hello@example.com');

    await act(async () => {
      features.click();
    });

    const moveUpMarker = await eventually<HTMLElement>('[data-testid="page-builder-block-move-up"]');
    const moveUp = moveUpMarker.closest('button');
    expect(moveUp).not.toBeNull();
    expect(moveUp?.disabled).toBe(false);
    await act(async () => {
      moveUp?.click();
    });

    const reorderedTypes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid="page-builder-block"]'),
    ).map((element) => element.dataset.blockType);
    expect(reorderedTypes).toEqual(['features', 'hero', 'cta', 'contact']);
    expect((await eventually<HTMLInputElement>('[data-testid="page-builder-features-heading"]')).value).toBe('Features title');
  });

  it('shows descriptive previews before a block is inserted', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => {
      act(() => root.unmount());
    });

    await act(async () => {
      root.render(
        <PuckEditorAdapter
          document={{ ...fixture, blocks: [] }}
          revisionKey={0}
          onChange={() => undefined}
          onPublish={() => undefined}
        />,
      );
    });

    const addButton = await eventually<HTMLButtonElement>('[data-testid="page-builder-add-block"]');
    await act(async () => {
      addButton.click();
    });

    const gallery = await eventually<HTMLElement>('[data-testid="page-builder-block-gallery"]');
    expect(gallery.textContent).toContain('히어로');
    expect(gallery.textContent).toContain('특징 목록');
    expect(gallery.textContent).toContain('행동 유도');
    expect(gallery.textContent).toContain('연락처');
    expect(gallery.textContent).toContain('슬라이더 히어로');
    expect(gallery.textContent).toContain('요금제');
    expect(gallery.textContent).toContain('팀 소개');
    expect(gallery.textContent).toContain('갤러리 그리드');
    expect(gallery.textContent).toContain('막대그래프');
    expect(gallery.querySelectorAll('[data-block-preview]')).toHaveLength(12);
  });
});
