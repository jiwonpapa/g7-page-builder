import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import schema from '../../schemas/site-part-document.schema.json';

const document = {
  schema_version: 'g7-page-builder/site-part/v1',
  site_part_id: '123e4567-e89b-42d3-a456-426614174055',
  kind: 'header',
  locale: 'ko',
  tokens: {},
  blocks: [{
    instance_id: '123e4567-e89b-42d3-a456-426614174056',
    type: 'site.header.navigation-01',
    block_version: 1,
    props: {
      brand_name: '지원소프트',
      logo_url: '',
      home_url: '/',
      variant: 'solid',
      sticky: true,
      navigation: [{ label: '서비스', url: '/pages/services', children: [{ label: '기능', url: '/pages/features' }] }],
      cta: { label: '문의', url: '/pages/contact' },
      mobile_menu: true,
      mobile_menu_style: 'drawer-right',
    },
    slots: {},
  }],
};

describe('SitePartDocument v1 schema', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  it('accepts a typed two-level navigation document', () => {
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects third-level menus, executable routes, and arbitrary style fields', () => {
    const thirdLevel = structuredClone(document);
    (thirdLevel.blocks[0]!.props.navigation[0]!.children[0] as Record<string, unknown>).children = [{ label: '깊은 링크', url: '/deep' }];
    expect(validate(thirdLevel)).toBe(false);

    const executable = structuredClone(document);
    executable.blocks[0]!.props.navigation[0]!.children[0]!.url = 'javascript:alert(1)';
    expect(validate(executable)).toBe(false);

    const arbitrary = structuredClone(document) as typeof document & { className?: string };
    arbitrary.className = 'fixed inset-0';
    expect(validate(arbitrary)).toBe(false);
  });
});
