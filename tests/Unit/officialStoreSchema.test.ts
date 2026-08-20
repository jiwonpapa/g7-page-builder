import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import catalog from '../../resources/store/dist/catalog.json';
import catalogSchema from '../../schemas/official-store-catalog.schema.json';
import pageKitSchema from '../../schemas/page-kit-manifest.schema.json';
import pageKitFixture from '../Contract/page-kit-manifest-v1.fixture.json';

describe('official free store schemas', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateCatalog = ajv.compile(catalogSchema);
  const validatePageKit = ajv.compile(pageKitSchema);

  it('accepts the bundled official catalog and Page Kit contract', () => {
    expect(validateCatalog(catalog), JSON.stringify(validateCatalog.errors)).toBe(true);
    expect(validatePageKit(pageKitFixture), JSON.stringify(validatePageKit.errors)).toBe(true);
  });

  it('rejects a foreign publisher or paid product', () => {
    const foreign = structuredClone(catalog);
    foreign.publisher.id = 'another-vendor' as 'jiwonpapa';
    expect(validateCatalog(foreign)).toBe(false);

    const paid = structuredClone(catalog);
    paid.products[0].license = 'paid' as 'free';
    expect(validateCatalog(paid)).toBe(false);
  });

  it('rejects undeclared Page Kit manifest fields', () => {
    expect(validatePageKit({ ...pageKitFixture, executable: 'runtime.php' })).toBe(false);
  });
});
