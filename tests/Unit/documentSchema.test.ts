import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import fixture from '../Contract/document-v1.fixture.json';
import ctaContactFixture from '../Contract/document-cta-contact-v1.fixture.json';
import catalogFixture from '../Contract/document-catalog-v1.fixture.json';
import foundationFixture from '../Contract/document-foundation-v1.fixture.json';
import compileFixture from '../Contract/compile-result-v1.fixture.json';
import compileSchema from '../../schemas/compile-result.schema.json';
import schema from '../../schemas/page-builder-document.schema.json';
import officialCompanyPageKit from '../../resources/store/source/page-kits/company-launch/document.json';
import officialEditorialPageKit from '../../resources/store/source/page-kits/editorial-community/document.json';
import officialEventPageKit from '../../resources/store/source/page-kits/event-launch/document.json';
import officialLocalBusinessPageKit from '../../resources/store/source/page-kits/local-business/document.json';
import officialServicePageKit from '../../resources/store/source/page-kits/service-conversion/document.json';
import builtinManifest from '../../resources/block-packs/builtin-core/manifest.json';

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

  it('accepts all six typed foundation blocks', () => {
    expect(validate(foundationFixture), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts every bundled preset as a complete one-block document', () => {
    expect(builtinManifest.presets).toHaveLength(18);
    builtinManifest.presets.forEach((preset, index) => {
      const document = {
        ...structuredClone(fixture),
        slug: `preset-${index + 1}`,
        blocks: [{
          instance_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          type: preset.block_id,
          block_version: preset.block_version,
          props: structuredClone(preset.props),
          slots: {},
        }],
      };
      expect(validate(document), `${preset.preset_id}: ${JSON.stringify(validate.errors)}`).toBe(true);
    });
  });

  it('rejects malformed foundation block props', () => {
    const invalidAnchor = structuredClone(foundationFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    invalidAnchor.blocks[0]!.props.anchor = 'javascript:alert(1)';
    expect(validate(invalidAnchor)).toBe(false);

    const extraButton = structuredClone(foundationFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    const items = extraButton.blocks[3]!.props.items as Array<Record<string, unknown>>;
    items.push(
      { label: '세 번째', url: '/', variant: 'text' },
      { label: '네 번째', url: '/', variant: 'text' },
    );
    expect(validate(extraButton)).toBe(false);

    const unsupportedIcon = structuredClone(foundationFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    const iconItems = unsupportedIcon.blocks[5]!.props.items as Array<Record<string, unknown>>;
    iconItems[0]!.icon = 'javascript';
    expect(validate(unsupportedIcon)).toBe(false);

    const arbitraryStyle = structuredClone(foundationFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    arbitraryStyle.blocks[4]!.props.className = 'fixed inset-0';
    expect(validate(arbitraryStyle)).toBe(false);

    const imageWithoutAlt = structuredClone(foundationFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    imageWithoutAlt.blocks[2]!.props.alt = '';
    expect(validate(imageWithoutAlt)).toBe(false);

    const imageTextWithoutAlt = structuredClone(foundationFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    imageTextWithoutAlt.blocks[4]!.props.image = { src: 'https://images.example.com/story.webp', alt: '' };
    expect(validate(imageTextWithoutAlt)).toBe(false);
  });

  it('accepts every bundled official Page Kit source document', () => {
    const pageKits = [
      officialCompanyPageKit,
      officialServicePageKit,
      officialLocalBusinessPageKit,
      officialEventPageKit,
      officialEditorialPageKit,
    ];
    expect(pageKits).toHaveLength(5);
    pageKits.forEach((pageKit) => {
      expect(validate(pageKit), `${pageKit.slug}: ${JSON.stringify(validate.errors)}`).toBe(true);
    });
  });

  it('accepts typed G7 data blocks and rejects unsafe product routes', () => {
    const dynamic = {
      ...structuredClone(fixture),
      blocks: [
        {
          instance_id: '00000000-0000-4000-8000-000000000090',
          type: 'g7.board-recent-posts-01',
          block_version: 1,
          props: { eyebrow: 'NEWS', heading: '최근 글', source: 'recent', period: 'week', limit: 6, audience: 'all', emptyMessage: '글이 없습니다.' },
          slots: {},
        },
        {
          instance_id: '00000000-0000-4000-8000-000000000091',
          type: 'g7.ecommerce-product-grid-01',
          block_version: 1,
          props: { eyebrow: 'SHOP', heading: '추천 상품', source: 'new', limit: 4, columns: 4, audience: 'member', detailBasePath: '/shop/products', emptyMessage: '상품이 없습니다.' },
          slots: {},
        },
      ],
    };
    expect(validate(dynamic), JSON.stringify(validate.errors)).toBe(true);

    dynamic.blocks[1].props.detailBasePath = '//attacker.example/products';
    expect(validate(dynamic)).toBe(false);
  });

  it('accepts typed G7 details, pagination and generic visibility while rejecting arbitrary audiences', () => {
    const document = {
      ...structuredClone(fixture),
      blocks: [
        {
          instance_id: '00000000-0000-4000-8000-000000000092',
          type: 'g7.board-post-detail-01', block_version: 1,
          props: { eyebrow: 'POST', heading: '게시글', boardSlug: 'notice', postId: 17, detailUrl: '/board/notice/17', linkLabel: '전체 보기', audience: 'all', showContent: true, emptyMessage: '글이 없습니다.' },
          visibility: { audience: 'member' }, slots: {},
        },
        {
          instance_id: '00000000-0000-4000-8000-000000000093',
          type: 'g7.ecommerce-product-detail-01', block_version: 1,
          props: { eyebrow: 'PRODUCT', heading: '상품', productKey: 'SKU-17', detailUrl: '/shop/products/SKU-17', buttonLabel: '상품 보기', audience: 'guest', showDescription: true, emptyMessage: '상품이 없습니다.' },
          visibility: { audience: 'all' }, slots: {},
        },
        {
          instance_id: '00000000-0000-4000-8000-000000000094',
          type: 'g7.board-recent-posts-01', block_version: 1,
          props: { eyebrow: 'NEWS', heading: '최근 글', source: 'recent', period: 'week', limit: 6, pageSize: 3, audience: 'all', emptyMessage: '글이 없습니다.' },
          slots: {},
        },
      ],
    };
    expect(validate(document), JSON.stringify(validate.errors)).toBe(true);

    document.blocks[0]!.visibility = { audience: 'administrator' };
    expect(validate(document)).toBe(false);
    document.blocks[0]!.visibility = { audience: 'member' };
    document.blocks[1]!.props.productKey = '../unsafe';
    expect(validate(document)).toBe(false);
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

  it('accepts field-scoped element tokens and rejects unsafe paths or values', () => {
    const styled = structuredClone(catalogFixture) as unknown as {
      blocks: Array<{ props: Record<string, unknown> }>;
    };
    styled.blocks[0].props.appearance = {
      surface: 'default', spacing: 'spacious',
      elements: { title: { font: 'serif', size: 'large', weight: 'bold', align: 'right', tone: 'accent' } },
    };
    expect(validate(styled), JSON.stringify(validate.errors)).toBe(true);

    const elements = (styled.blocks[0]!.props.appearance as { elements: Record<string, unknown> }).elements;
    elements['title[onclick]'] = { size: 'large' };
    expect(validate(styled)).toBe(false);
    delete elements['title[onclick]'];
    elements.title = { size: 'expression(alert(1))' };
    expect(validate(styled)).toBe(false);
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

  it('accepts typed SEO metadata and rejects executable or unknown values', () => {
    const searchable = {
      ...structuredClone(fixture),
      seo: {
        title: '검색 결과 제목',
        description: '검색 결과와 링크 공유에 사용하는 설명입니다.',
        og_image_url: '/storage/page-builder/share.webp',
        robots: 'index',
      },
    };
    expect(validate(searchable), JSON.stringify(validate.errors)).toBe(true);

    searchable.seo.og_image_url = 'javascript:alert(1)';
    expect(validate(searchable)).toBe(false);
    searchable.seo.og_image_url = 'https://cdn.example.com/share.webp';
    searchable.seo.robots = 'follow-only';
    expect(validate(searchable)).toBe(false);
    expect(validate({ ...searchable, seo: { ...searchable.seo, robots: 'index', className: 'fixed' } })).toBe(false);
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
