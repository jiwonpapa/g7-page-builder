import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(resolve('resources/block-packs/builtin-core/manifest.json'), 'utf8')) as {
  presets: Array<{ preset_id: string; props: Record<string, unknown> }>;
};
const presets = new Map(manifest.presets.map((preset) => [preset.preset_id, preset]));
const ids = [
  'hero.service-intro',
  'rich-text.article-intro',
  'image-text.company-story',
  'features.core-benefits',
  'card-grid.services',
  'cta.contact',
];

describe('phase 6 representative preset quality', () => {
  it('keeps the exact six representative presets complete and reusable', () => {
    for (const id of ids) expect(presets.has(id), id).toBe(true);

    const hero = presets.get('hero.service-intro')!.props as any;
    expect(hero.title.length).toBeGreaterThan(10);
    expect(hero.primaryCta).toEqual({ label: '무료 상담 요청', url: '/contact' });
    expect(hero.image.src).toMatch(/^\/modules\/jiwonpapa-page_builder\/store\/previews\//);
    expect(hero.image.alt.length).toBeGreaterThan(10);

    const story = presets.get('image-text.company-story')!.props as any;
    expect(story.image.src).not.toBe('');
    expect(story.image.alt).not.toBe('');
    expect(story.body).not.toContain('소개해 주세요');

    const features = presets.get('features.core-benefits')!.props as any;
    expect(features.items).toHaveLength(3);
    expect(new Set(features.items.map((item: any) => item.title)).size).toBe(3);

    const services = presets.get('card-grid.services')!.props as any;
    expect(services.items).toHaveLength(3);
    expect({ variant: services.variant, layout: services.layout }).toEqual({ variant: 'plain', layout: 'grid' });
    expect(services.items.every((item: any) => item.body.length >= 20 && item.linkUrl.startsWith('/services/'))).toBe(true);

    const copy = presets.get('rich-text.article-intro')!.props.content as string;
    expect(copy).not.toContain('설명해 주세요');
    expect(copy.match(/<p>/g)).toHaveLength(2);
  });
});
