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

  it('accepts the twenty-nine-definition builtin core pack', () => {
    expect(validate(builtinManifest), JSON.stringify(validate.errors)).toBe(true);
    expect(builtinManifest.blocks).toHaveLength(29);
    expect(builtinManifest.blocks.map((block) => block.block_id)).toEqual(expect.arrayContaining([
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
