import { describe, expect, it } from 'vitest';
import { hydrateCatalogIcons } from '../../resources/js/public/publicHydration';

describe('public icons in renderer-backed thumbnails', () => {
  it('sizes an explicit common icon to its authored parent without copying arbitrary marker styles', () => {
    const root = document.implementation.createHTMLDocument('element icon');
    root.body.innerHTML = `<span role="img" aria-label="아이콘 설명" style="width:48px;height:32px;color:red"><span
      data-g7pb-runtime-icon data-g7pb-icon-sizing="parent" style="position:fixed"
      data-g7pb-icon-markup='&lt;path d="M20 6 9 17l-5-5"&gt;&lt;/path&gt;'><svg></svg></span></span>`;
    hydrateCatalogIcons(root);
    const svg = root.querySelector('svg')!;
    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(svg.getAttribute('width')).toBe('100%'); expect(svg.getAttribute('height')).toBe('100%');
    expect(svg.style.display).toBe('block'); expect(svg.style.position).toBe('');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.parentElement?.getAttribute('aria-label')).toBe('아이콘 설명');
    hydrateCatalogIcons(root); expect(root.querySelector('svg')).toBe(svg);
  });
  it('hydrates the real icon once while leaving forms and remote embeds inert', () => {
    const root = document.implementation.createHTMLDocument('owned thumbnail');
    root.body.innerHTML = `<span role="img" aria-label="보안 안내"><span class="g7pb-basic-icon-image" data-g7pb-runtime-icon data-g7pb-icon-markup='&lt;path d="M20 6 9 17l-5-5"&gt;&lt;/path&gt;'></span></span>
      <span data-g7pb-embed data-g7pb-embed-kind="video-youtube" data-g7pb-embed-src="https://www.youtube-nocookie.com/embed/fixture"></span>
      <div data-g7pb-inquiry-host></div>`;
    hydrateCatalogIcons(root);
    const svg = root.querySelector('svg');
    expect(svg?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg?.classList.contains('g7pb-basic-icon-image')).toBe(true);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.parentElement?.getAttribute('aria-label')).toBe('보안 안내');
    expect(root.querySelector('iframe,form')).toBeNull();
    hydrateCatalogIcons(root);
    expect(root.querySelectorAll('svg')).toHaveLength(1);
    expect(root.querySelector('svg')).toBe(svg);
  });

  it('does not hydrate arbitrary markup or event attributes', () => {
    const root = document.implementation.createHTMLDocument('owned invalid icons');
    for (const markup of ['<script>alert(1)</script>', '<path onload="alert(1)"></path>', '<image href="https://example.test/tracker"></image>']) {
      const marker = root.createElement('span');
      marker.dataset.g7pbRuntimeIcon = '';
      marker.dataset.g7pbIconMarkup = markup;
      root.body.replaceChildren(marker);
      hydrateCatalogIcons(root);
      expect(root.querySelector('svg')).toBeNull();
      expect(root.body.firstChild).toBe(marker);
    }
  });
});
