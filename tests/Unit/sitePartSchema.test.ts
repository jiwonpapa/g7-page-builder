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

  it('accepts typed viewport overrides and the mobile bottom sheet menu', () => {
    const responsive = structuredClone(document);
    (responsive.blocks[0]!.props as Record<string, unknown>).responsive = {
      tablet: { density: 'comfortable', alignment: 'center', show_cta: true, mobile_menu_style: 'drawer-left' },
      mobile: { density: 'compact', alignment: 'spread', show_cta: false, mobile_menu_style: 'sheet-bottom' },
    };
    expect(validate(responsive), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts one configurable G7 runtime control block and rejects duplicates', () => {
    const configured = structuredClone(document);
    configured.blocks[0]!.slots = {
      systemControls: [{
        instance_id: '123e4567-e89b-42d3-a456-426614174090',
        type: 'site.header.system-controls-01',
        block_version: 1,
        props: { search: true, account: true, cart: false, notifications: false, theme: true, locale: false, currency: false },
        slots: {},
      }],
    };
    expect(validate(configured), JSON.stringify(validate.errors)).toBe(true);

    const duplicate = structuredClone(configured);
    const duplicateSlots = duplicate.blocks[0]!.slots as { systemControls: Array<Record<string, unknown>> };
    duplicateSlots.systemControls.push({
      ...structuredClone(duplicateSlots.systemControls[0]!),
      instance_id: '123e4567-e89b-42d3-a456-426614174091',
    });
    expect(validate(duplicate)).toBe(false);
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

    const arbitraryResponsive = structuredClone(document);
    (arbitraryResponsive.blocks[0]!.props as Record<string, unknown>).responsive = { mobile: { class_name: 'fixed', style: 'position:fixed' } };
    expect(validate(arbitraryResponsive)).toBe(false);
  });

  it('rejects duplicate primary Header and Footer shells', () => {
    const duplicateHeader = structuredClone(document);
    duplicateHeader.blocks.push(structuredClone(duplicateHeader.blocks[0]!));
    duplicateHeader.blocks[1]!.instance_id = '123e4567-e89b-42d3-a456-426614174099';
    expect(validate(duplicateHeader)).toBe(false);

    const footer = {
      ...structuredClone(document),
      kind: 'footer',
      blocks: [{
        instance_id: '123e4567-e89b-42d3-a456-426614174101',
        type: 'site.footer.simple-01',
        block_version: 1,
        props: { brand_name: '지원소프트', home_url: '/', navigation: [], footer_text: '' },
        slots: {},
      }, {
        instance_id: '123e4567-e89b-42d3-a456-426614174102',
        type: 'site.footer.columns-01',
        block_version: 1,
        props: { brand_name: '지원소프트', home_url: '/', columns: [{ heading: '서비스', links: [] }], legal_text: '' },
        slots: {},
      }],
    };
    expect(validate(footer)).toBe(false);
  });
});
