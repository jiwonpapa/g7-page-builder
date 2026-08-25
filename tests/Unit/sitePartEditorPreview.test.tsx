import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

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
});
