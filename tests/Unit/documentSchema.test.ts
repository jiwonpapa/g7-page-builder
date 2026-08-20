import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import fixture from '../Contract/document-v1.fixture.json';
import ctaContactFixture from '../Contract/document-cta-contact-v1.fixture.json';
import catalogFixture from '../Contract/document-catalog-v1.fixture.json';
import compileFixture from '../Contract/compile-result-v1.fixture.json';
import compileSchema from '../../schemas/compile-result.schema.json';
import schema from '../../schemas/page-builder-document.schema.json';

describe('PageBuilderDocument v1 schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  it('accepts the compatibility fixture', () => {
    expect(validate(fixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts canonical CTA and Contact blocks', () => {
    expect(validate(ctaContactFixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts the structured twelve-block test catalog', () => {
    expect(validate(catalogFixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects unsafe or out-of-range catalog values', () => {
    const invalid = structuredClone(catalogFixture) as unknown as {
      blocks: Array<{ props: { items: Array<Record<string, unknown>> } }>;
    };
    invalid.blocks[7]!.props.items[0]!.value = 140;
    expect(validate(invalid)).toBe(false);

    const arbitraryStyle = structuredClone(catalogFixture) as typeof catalogFixture & {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    arbitraryStyle.blocks[4].props.className = 'fixed inset-0';
    expect(validate(arbitraryStyle)).toBe(false);
  });

  it('accepts typed motion presets and rejects arbitrary runtime effects', () => {
    const animated = structuredClone(catalogFixture) as typeof catalogFixture & {
      blocks: Array<Record<string, unknown>>;
    };
    animated.blocks[3].motion = {
      preset: 'counter',
      intensity: 'normal',
      trigger: 'once',
      stagger_ms: 100,
    };
    expect(validate(animated), JSON.stringify(validate.errors)).toBe(true);

    animated.blocks[3].motion = {
      preset: 'javascript:alert(1)',
      intensity: 'normal',
      trigger: 'once',
      stagger_ms: 100,
    };
    expect(validate(animated)).toBe(false);
  });

  it('accepts allowlisted page design tokens and rejects arbitrary design values', () => {
    const designed = structuredClone(fixture) as typeof fixture & { tokens: Record<string, unknown> };
    designed.tokens = {
      ...designed.tokens,
      'design.palette': 'emerald',
      'design.font': 'serif',
      'design.radius': 'round',
      'design.width': 'wide',
      'design.scale': 'large',
    };
    expect(validate(designed), JSON.stringify(validate.errors)).toBe(true);

    designed.tokens['design.palette'] = 'url(javascript:alert(1))';
    expect(validate(designed)).toBe(false);
  });

  it('rejects malformed CTA links and Contact form props', () => {
    const malformedLink = structuredClone(ctaContactFixture);
    malformedLink.blocks[0].props.primaryLink = { label: '시작하기' } as never;
    expect(validate(malformedLink)).toBe(false);

    const contactWithForm = structuredClone(ctaContactFixture) as typeof ctaContactFixture & {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    contactWithForm.blocks[1].props.formAction = '/submit';
    expect(validate(contactWithForm)).toBe(false);

    const invalidContact = structuredClone(ctaContactFixture);
    invalidContact.blocks[1].props.phone = 'javascript:alert(1)';
    invalidContact.blocks[1].props.email = 'not-an-email';
    expect(validate(invalidContact)).toBe(false);
  });

  it('rejects an unknown root field', () => {
    const invalid = { ...fixture, internal_g7_model: 'App\\Models\\Page' };

    expect(validate(invalid)).toBe(false);
  });

  it('rejects a User Template site mode in schema v1', () => {
    expect(validate({ ...fixture, mode: 'site' })).toBe(false);
  });
});

describe('CompileResult v1 schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(compileSchema);

  it('accepts the compatibility fixture', () => {
    expect(validate(compileFixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it('requires a deterministic sha256', () => {
    expect(validate({ ...compileFixture, artifact_sha256: 'not-a-hash' })).toBe(false);
  });
});
