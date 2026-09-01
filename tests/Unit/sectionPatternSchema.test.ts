import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import schema from '../../schemas/page-builder-section-pattern.schema.json';
import layoutDocument from '../Contract/document-layout-v2.fixture.json';

describe('Section pattern contract', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const pattern = {
    schema_version: 'g7-page-builder/section-pattern/v1',
    pattern_id: '123e4567-e89b-42d3-a456-426614174088',
    title: '두 열 소개', category: 'custom', source_document_schema: 'g7-page-builder/v2',
    section: layoutDocument.blocks[0],
    required_blocks: ['content.heading-01@1', 'layout.columns-01@1', 'layout.section-01@1'],
    asset_references: [], preview: { kind: 'section-summary', block_count: 4 },
    created_at: '2026-09-01T00:00:00+00:00', updated_at: '2026-09-01T00:00:00+00:00',
    compatible: true, compatibility_error: null,
  };

  it('accepts canonical Section data and rejects HTML or a non-Section root', () => {
    expect(validate(pattern), JSON.stringify(validate.errors)).toBe(true);
    expect(validate({ ...pattern, html: '<section>unsafe source</section>' })).toBe(false);
    expect(validate({ ...pattern, section: layoutDocument.blocks[0]?.slots.content[0] })).toBe(false);
  });

  it('requires an explicit v2 source and unique capability references', () => {
    expect(validate({ ...pattern, source_document_schema: 'g7-page-builder/v1' })).toBe(false);
    expect(validate({ ...pattern, required_blocks: ['content.heading-01@1', 'content.heading-01@1'] })).toBe(false);
  });
});
