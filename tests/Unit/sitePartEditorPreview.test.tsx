import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mounted: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of mounted.splice(0)) cleanup();
  document.body.replaceChildren();
});

describe('Site Part Header preview', () => {
  it('shows the fixed G7 system controls beside editable Header content', async () => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    });
    const { HeaderNavigationPreview } = await import('../../resources/js/editor/SitePartEditor');
    const html = renderToStaticMarkup(<HeaderNavigationPreview
      brandName="지원소프트"
      logoUrl=""
      homeUrl="/"
      variant="solid"
      sticky
      navigation={[]}
      ctaLabel="문의"
      ctaUrl="/contact"
      mobileMenu
      mobileMenuStyle="drawer-right"
    />);

    expect(html).toContain('class="g7pb-site-header__actions"');
    expect(html).toContain('data-g7pb-system-controls="true"');
    expect(html).toContain('action="/search"');
    expect(html).toContain('href="/shop/cart"');
    expect(html).toContain('href="/login"');
  });

  it('opens, repositions, and closes the mobile drawer inside the responsive editor preview', async () => {
    const { HeaderNavigationPreview } = await import('../../resources/js/editor/SitePartEditor');
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounted.push(() => act(() => root.unmount()));
    const props = {
      brandName: '지원소프트',
      logoUrl: '',
      homeUrl: '/',
      variant: 'solid' as const,
      sticky: true,
      navigation: [{ label: '서비스', url: '/services', children: [{ label: '소개', url: '/about' }] }],
      ctaLabel: '문의',
      ctaUrl: '/contact',
      mobileMenu: true,
    };

    await act(async () => root.render(<HeaderNavigationPreview {...props} mobileMenuStyle="drawer-right" />));
    const toggle = container.querySelector<HTMLButtonElement>('[data-g7pb-preview-menu-toggle]');
    const menu = container.querySelector<HTMLElement>('[data-g7pb-preview-mobile-menu]');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.hidden).toBe(true);

    await act(async () => toggle?.click());
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.hidden).toBe(false);
    expect(menu?.classList.contains('g7pb-mobile-menu--drawer-right')).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-g7pb-preview-menu-backdrop]')?.hidden).toBe(false);

    await act(async () => root.render(<HeaderNavigationPreview {...props} mobileMenuStyle="drawer-left" />));
    expect(menu?.classList.contains('g7pb-mobile-menu--drawer-left')).toBe(true);
    expect(menu?.hidden).toBe(false);

    const submenuToggle = container.querySelector<HTMLButtonElement>('[data-g7pb-preview-submenu-toggle]');
    const submenu = container.querySelector<HTMLElement>('[data-g7pb-preview-mobile-submenu]');
    expect(submenu?.hidden).toBe(true);
    await act(async () => submenuToggle?.click());
    expect(submenuToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(submenu?.hidden).toBe(false);

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });
});
