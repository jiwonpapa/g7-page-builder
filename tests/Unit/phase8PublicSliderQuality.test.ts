import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicCss = readFileSync(resolve('resources/css/page-builder-public.css'), 'utf8');

describe('public catalog slider quality', () => {
  it('isolates logo and testimonial media from generic hero slide geometry', () => {
    expect(publicCss).toContain('.g7pb-logo-carousel .g7pb-hero-slider__slide { min-width: 22%; min-height: 8rem; flex: 0 0 22%; grid-template-columns: 1fr;');
    expect(publicCss).toContain('.g7pb-testimonial-slider footer figure { width: 3rem; height: 3rem; min-height: 3rem;');
  });
});
