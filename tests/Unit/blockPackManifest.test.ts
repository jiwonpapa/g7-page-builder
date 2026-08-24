import Ajv2020 from 'ajv/dist/2020';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import fixture from '../Contract/block-pack-data-v1.fixture.json';
import builtinManifest from '../../resources/block-packs/builtin-core/manifest.json';
import schema from '../../schemas/block-pack-manifest.schema.json';

describe('Block Pack manifest v1 schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);

  it('accepts a data-only preset pack', () => {
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts the forty-five-definition production catalog and covers every type with a unique preview and preset', () => {
    expect(validate(builtinManifest), JSON.stringify(validate.errors)).toBe(true);
    expect(builtinManifest.pack_version).toBe('0.14.0');
    expect(builtinManifest.blocks).toHaveLength(45);
    expect(builtinManifest.presets).toHaveLength(55);
    expect(new Set(builtinManifest.blocks.map((block) => `${block.block_id}@${block.block_version}`)).size).toBe(45);
    expect(new Set(builtinManifest.presets.map((preset) => preset.preset_id)).size).toBe(55);
    const definitions = new Set(builtinManifest.blocks.map((block) => `${block.block_id}@${block.block_version}`));
    expect(builtinManifest.presets.every((preset) => definitions.has(`${preset.block_id}@${preset.block_version}`))).toBe(true);
    const presetBlockIds = new Set(builtinManifest.presets.map((preset) => preset.block_id));
    expect(builtinManifest.blocks.every((block) => presetBlockIds.has(block.block_id))).toBe(true);
    const thumbnails = [
      ...builtinManifest.blocks.map((block) => block.thumbnail),
      ...builtinManifest.presets.map((preset) => preset.thumbnail),
    ];
    expect(new Set(thumbnails).size).toBe(100);
    const thumbnailContents: Buffer[] = [];
    thumbnails.forEach((thumbnail) => {
      const thumbnailPath = resolve('resources/block-packs/builtin-core', thumbnail);
      expect(existsSync(thumbnailPath), thumbnail).toBe(true);
      const contents = readFileSync(thumbnailPath);
      expect(contents.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(contents.readUInt32BE(16)).toBe(320);
      expect(contents.readUInt32BE(20)).toBe(200);
      thumbnailContents.push(contents);
    });
    expect(new Set(thumbnailContents.map((contents) => contents.toString('base64'))).size).toBeGreaterThanOrEqual(55);
    const generatedIndex = JSON.parse(readFileSync(resolve(
      'resources/block-packs/builtin-core/thumbnails/generated/index.json',
    ), 'utf8')) as { count?: number; sources?: Record<string, string> };
    expect(generatedIndex.count).toBe(100);
    expect(Object.keys(generatedIndex.sources ?? {})).toHaveLength(100);
    expect(Object.values(generatedIndex.sources ?? {}).every((sha256) => /^[a-f0-9]{64}$/.test(sha256))).toBe(true);
    const categories = builtinManifest.blocks.reduce<Record<string, number>>((counts, block) => ({
      ...counts,
      [block.category]: (counts[block.category] ?? 0) + 1,
    }), {});
    expect(categories).toEqual({
      basic: 6,
      'hero-conversion': 6,
      content: 9,
      media: 3,
      navigation: 3,
      'trust-company': 6,
      'data-comparison': 4,
      'form-location': 2,
      'g7-data': 6,
    });
    expect(builtinManifest.blocks.map((block) => block.block_id)).toEqual(expect.arrayContaining([
      'content.heading-01',
      'content.rich-text-01',
      'media.image-01',
      'action.buttons-01',
      'media.image-text-01',
      'content.icon-list-01',
      'g7.board-recent-posts-01',
      'g7.ecommerce-product-grid-01',
      'form.inquiry-01',
      'location.map-directions-01',
      'trust.testimonials-01',
      'content.faq-accordion-01',
      'content.process-timeline-01',
      'content.tabs-01',
      'commerce.comparison-table-01',
      'content.article-list-01',
      'media.video-embed-01',
      'trust.logo-carousel-01',
      'trust.testimonial-slider-01',
      'content.event-schedule-01',
      'content.download-resources-01',
      'g7.board-content-archive-01',
      'g7.ecommerce-product-showcase-01',
      'g7.board-post-detail-01',
      'g7.ecommerce-product-detail-01',
      'content.divider-01',
      'content.blockquote-01',
      'content.notice-01',
      'content.card-grid-01',
      'navigation.breadcrumbs-01',
      'navigation.anchor-menu-01',
      'navigation.social-links-01',
      'media.image-carousel-01',
    ]));
    expect(builtinManifest.presets.map((preset) => preset.preset_id)).toEqual(expect.arrayContaining([
      'heading.section-intro',
      'rich-text.article-intro',
      'image.landscape',
      'buttons.primary-secondary',
      'image-text.product-story',
      'icon-list.benefits',
      'hero.service-intro',
      'faq.basic',
    ]));
  });

  it('rejects executable runtime fields in a data pack', () => {
    const invalid = {
      ...fixture,
      runtime: {
        provider: 'untrusted.provider',
        editor: 'dist/editor.js',
        styles: [],
      },
    };

    expect(validate(invalid)).toBe(false);
  });

  it('rejects archive traversal paths', () => {
    const invalid = {
      ...fixture,
      files: {
        '../outside.php': 'a'.repeat(64),
      },
    };

    expect(validate(invalid)).toBe(false);
  });
});
