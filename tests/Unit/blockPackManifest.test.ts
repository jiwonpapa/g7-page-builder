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

  it('accepts the fourteen-definition builtin core pack', () => {
    expect(validate(builtinManifest), JSON.stringify(validate.errors)).toBe(true);
    expect(builtinManifest.blocks).toHaveLength(14);
    expect(builtinManifest.blocks.map((block) => block.block_id)).toEqual(expect.arrayContaining([
      'g7.board-recent-posts-01',
      'g7.ecommerce-product-grid-01',
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
