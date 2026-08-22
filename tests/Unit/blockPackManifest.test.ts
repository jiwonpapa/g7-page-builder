import Ajv2020 from 'ajv/dist/2020';
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

  it('accepts the thirty-five-definition builtin core pack and its practical presets', () => {
    expect(validate(builtinManifest), JSON.stringify(validate.errors)).toBe(true);
    expect(builtinManifest.pack_version).toBe('0.11.0');
    expect(builtinManifest.blocks).toHaveLength(35);
    expect(builtinManifest.presets).toHaveLength(18);
    expect(new Set(builtinManifest.blocks.map((block) => `${block.block_id}@${block.block_version}`)).size).toBe(35);
    expect(new Set(builtinManifest.presets.map((preset) => preset.preset_id)).size).toBe(18);
    const definitions = new Set(builtinManifest.blocks.map((block) => `${block.block_id}@${block.block_version}`));
    expect(builtinManifest.presets.every((preset) => definitions.has(`${preset.block_id}@${preset.block_version}`))).toBe(true);
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
