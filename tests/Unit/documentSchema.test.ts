import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import fixture from '../Contract/document-v1.fixture.json';
import ctaContactFixture from '../Contract/document-cta-contact-v1.fixture.json';
import catalogFixture from '../Contract/document-catalog-v1.fixture.json';
import foundationFixture from '../Contract/document-foundation-v1.fixture.json';
import compileFixture from '../Contract/compile-result-v1.fixture.json';
import compileSchema from '../../schemas/compile-result.schema.json';
import schema from '../../schemas/page-builder-document.schema.json';
import builtinManifest from '../../resources/block-packs/builtin-core/manifest.json';
import { BUILTIN_CANVAS_EDITING_CONTRACT } from '../../resources/js/editor/canvasEditingContract';

const pageKitRoot = resolve('resources/store/source/page-kits');
const pageKitManifest = JSON.parse(readFileSync(resolve(pageKitRoot, 'manifest.json'), 'utf8')) as {
  manifest_version: string;
  page_kit_version: string;
  kits: Array<{
    slug: string;
    title: { ko: string; en: string };
    description: { ko: string; en: string };
    category: string;
    tags: string[];
    media: string[];
  }>;
};

interface RichTextFieldContract {
  blockId: string;
  inline: string[];
  block: string[];
}

const editingByComponent = new Map(BUILTIN_CANVAS_EDITING_CONTRACT.map((entry) => [entry.componentType, entry]));
const richTextFieldMatrix: RichTextFieldContract[] = builtinManifest.blocks.map((block) => {
  const editing = editingByComponent.get(block.editor_component);
  if (!editing) throw new Error(`Missing canvas editing capability for ${block.block_id}.`);
  return {
    blockId: block.block_id,
    inline: editing.textFields.filter((field) => field.kind === 'inline-rich').map((field) => field.path),
    block: editing.textFields.filter((field) => field.kind === 'block-rich').map((field) => field.path),
  };
});

function replaceRichTextPath(target: unknown, path: string, value: string): void {
  const [segment, ...remaining] = path.split('.');
  if (segment === undefined) throw new Error(`Invalid rich-text path: ${path}`);
  if (segment === '*') {
    if (!Array.isArray(target)) throw new Error(`Expected collection at rich-text path: ${path}`);
    target.forEach((item, index) => {
      if (remaining.length === 0) target[index] = value;
      else replaceRichTextPath(item, remaining.join('.'), value);
    });
    return;
  }
  if (typeof target !== 'object' || target === null || Array.isArray(target)) {
    throw new Error(`Expected object at rich-text path: ${path}`);
  }
  const record = target as Record<string, unknown>;
  if (remaining.length === 0) {
    record[segment] = value;
    return;
  }
  replaceRichTextPath(record[segment], remaining.join('.'), value);
}

function documentForBlock(blockId: string, index: number): typeof fixture {
  const preset = builtinManifest.presets.find((candidate) => candidate.block_id === blockId);
  const compatibilityBlock = catalogFixture.blocks.find((candidate) => candidate.type === blockId);
  if (!preset && !compatibilityBlock) throw new Error(`${blockId}: bundled preset 또는 호환 fixture가 없습니다.`);
  return {
    ...structuredClone(fixture),
    slug: `rich-text-envelope-${index + 1}`,
    blocks: [{
      instance_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      type: blockId,
      block_version: preset?.block_version ?? compatibilityBlock!.block_version,
      props: structuredClone(preset?.props ?? compatibilityBlock!.props),
      slots: {},
    }],
  } as typeof fixture;
}

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

  it('accepts all eight production-library blocks and rejects unsafe structural values', () => {
    const productionDocument = {
      ...structuredClone(fixture),
      slug: 'production-library-contract',
      blocks: [
        { instance_id: '00000000-0000-4000-8000-000000000201', type: 'content.divider-01', block_version: 1, props: { variant: 'gradient', width: 'standard', label: '서비스 안내' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000202', type: 'content.blockquote-01', block_version: 1, props: { quote: '좋은 페이지는 다음 행동을 분명하게 만듭니다.', citation: '김기획', role: '제품 책임자', alignment: 'left', variant: 'mark' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000203', type: 'content.notice-01', block_version: 1, props: { tone: 'info', title: '방문 전 확인해 주세요', body: '운영 시간과 준비 사항을 확인하실 수 있습니다.', actionLabel: '운영 안내', actionUrl: '/guide' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000204', type: 'content.card-grid-01', block_version: 1, props: { eyebrow: 'SERVICES', heading: '필요한 서비스를 고르세요', items: [{ kicker: '01', title: '상담', body: '목표와 일정을 함께 정리합니다.', linkLabel: '상담 보기', linkUrl: '/consulting' }, { kicker: '02', title: '구축', body: '검증된 흐름으로 페이지를 완성합니다.', linkLabel: '구축 보기', linkUrl: '/build' }], columns: 2, variant: 'outlined' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000205', type: 'navigation.breadcrumbs-01', block_version: 1, props: { items: [{ label: '홈', url: '/' }, { label: '서비스', url: '/services' }], currentLabel: '상세 안내' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000206', type: 'navigation.anchor-menu-01', block_version: 1, props: { label: '이 페이지에서', items: [{ label: '소개', anchor: 'intro' }, { label: '가격', anchor: 'pricing' }], sticky: true, alignment: 'center' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000207', type: 'navigation.social-links-01', block_version: 1, props: { heading: '공식 채널', items: [{ network: 'instagram', label: '인스타그램', url: 'https://instagram.com/example' }, { network: 'blog', label: '블로그', url: '/blog' }], variant: 'icons', alignment: 'left' }, slots: {} },
        { instance_id: '00000000-0000-4000-8000-000000000208', type: 'media.image-carousel-01', block_version: 1, props: { eyebrow: 'GALLERY', heading: '공간을 미리 만나보세요', images: [{ src: 'https://images.example.com/space-1.webp', alt: '밝은 상담 공간', caption: '편안한 상담 공간' }, { src: '/storage/space-2.webp', alt: '제품 전시 공간', caption: '제품을 살펴보는 전시 공간' }], autoplay: false, interval: 5000, controls: 'both', aspectRatio: '16:9' }, slots: {} },
      ],
    };
    expect(validate(productionDocument), JSON.stringify(validate.errors)).toBe(true);

    const unsafeUrl = structuredClone(productionDocument) as unknown as { blocks: Array<{ props: Record<string, unknown> }> };
    unsafeUrl.blocks[2]!.props.actionUrl = 'javascript:alert(1)';
    expect(validate(unsafeUrl)).toBe(false);

    const unsafeAnchor = structuredClone(productionDocument) as unknown as { blocks: Array<{ props: { items: Array<Record<string, unknown>> } }> };
    unsafeAnchor.blocks[5]!.props.items[0]!.anchor = '#intro onclick=alert(1)';
    expect(validate(unsafeAnchor)).toBe(false);

    const missingImageAlt = structuredClone(productionDocument) as unknown as { blocks: Array<{ props: { images: Array<Record<string, unknown>> } }> };
    missingImageAlt.blocks[7]!.props.images[0]!.alt = '';
    expect(validate(missingImageAlt)).toBe(false);

    const arbitraryStyle = structuredClone(productionDocument) as unknown as { blocks: Array<{ props: Record<string, unknown> }> };
    arbitraryStyle.blocks[3]!.props.className = 'fixed inset-0';
    expect(validate(arbitraryStyle)).toBe(false);

    const explicitFontSize = structuredClone(productionDocument) as unknown as { blocks: Array<{ props: Record<string, unknown> }> };
    explicitFontSize.blocks[0]!.props.appearance = {
      surface: 'default', spacing: 'normal', elements: { title: { fontSizeRem: 3 } },
    };
    expect(validate(explicitFontSize), JSON.stringify(validate.errors)).toBe(true);

    const arbitraryFontSize = structuredClone(explicitFontSize);
    ((arbitraryFontSize.blocks[0]!.props.appearance as { elements: { title: { fontSizeRem: number } } })
      .elements.title.fontSizeRem) = 3.1;
    expect(validate(arbitraryFontSize)).toBe(false);

    const mixedLegacySize = structuredClone(explicitFontSize);
    ((mixedLegacySize.blocks[0]!.props.appearance as { elements: { title: Record<string, unknown> } })
      .elements.title).size = 'large';
    expect(validate(mixedLegacySize)).toBe(false);
  });

  it('accepts every bundled preset as a complete one-block document', () => {
    expect(builtinManifest.presets.length).toBeGreaterThanOrEqual(builtinManifest.blocks.length);
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

  it('accepts typed-mark serialization across every declared rich-text capability path', () => {
    const typedMark = '<span data-g7pb-font="serif" data-g7pb-font-size-rem="3" data-g7pb-tone="accent"><strong><em><u>가</u></em></strong></span>';
    const inlineMarkup = `<p>${typedMark.repeat(40)}</p>`;
    const blockMarkup = `<p>${typedMark.repeat(400)}</p>`;
    expect(new Set(richTextFieldMatrix.map((entry) => entry.blockId))).toEqual(
      new Set(builtinManifest.blocks.map((block) => block.block_id)),
    );
    const inlinePaths = richTextFieldMatrix.flatMap((entry) => entry.inline.map((path) => `${entry.blockId}:${path}`));
    const blockPaths = richTextFieldMatrix.flatMap((entry) => entry.block.map((path) => `${entry.blockId}:${path}`));
    expect(inlinePaths.length).toBeGreaterThan(0);
    expect(blockPaths.length).toBeGreaterThan(0);
    expect(new Set(inlinePaths).size).toBe(inlinePaths.length);
    expect(new Set(blockPaths).size).toBe(blockPaths.length);
    expect([...inlinePaths, ...blockPaths].every((path) => /^[a-z0-9.-]+:[A-Za-z0-9_*.-]+$/.test(path))).toBe(true);
    expect(inlineMarkup.length).toBeGreaterThan(300);
    expect(blockMarkup.length).toBeGreaterThan(2000);

    richTextFieldMatrix.forEach((entry, index) => {
      const document = documentForBlock(entry.blockId, index);
      const props = document.blocks[0]!.props;
      entry.inline.forEach((path) => replaceRichTextPath(props, path, inlineMarkup));
      entry.block.forEach((path) => replaceRichTextPath(props, path, blockMarkup));
      expect(validate(document), `${entry.blockId}: ${JSON.stringify(validate.errors)}`).toBe(true);
    });
  });

  it('rejects oversized serialized rich-text payloads on every approved path', () => {
    const oversizedInlineMarkup = `<p>${'가'.repeat(10_000)}</p>`;
    const oversizedBlockMarkup = `<p>${'가'.repeat(100_000)}</p>`;

    richTextFieldMatrix.forEach((entry, index) => {
      entry.inline.forEach((path) => {
        const document = documentForBlock(entry.blockId, index);
        replaceRichTextPath(document.blocks[0]!.props, path, oversizedInlineMarkup);
        expect(validate(document), `${entry.blockId}.${path} must reject oversized inline markup`).toBe(false);
      });
      entry.block.forEach((path) => {
        const document = documentForBlock(entry.blockId, index);
        replaceRichTextPath(document.blocks[0]!.props, path, oversizedBlockMarkup);
        expect(validate(document), `${entry.blockId}.${path} must reject oversized block markup`).toBe(false);
      });
    });
  });

  it('keeps plain labels, URLs and accessibility text on their original limits', () => {
    const buttons = documentForBlock('action.buttons-01', 100) as unknown as {
      blocks: Array<{ props: { items: Array<{ label: string; url: string }> } }>;
    };
    buttons.blocks[0]!.props.items[0]!.label = '가'.repeat(121);
    expect(validate(buttons)).toBe(false);
    buttons.blocks[0]!.props.items[0]!.label = '버튼';
    buttons.blocks[0]!.props.items[0]!.url = `/${'a'.repeat(2048)}`;
    expect(validate(buttons)).toBe(false);

    const image = documentForBlock('media.image-01', 101) as unknown as {
      blocks: Array<{ props: { alt: string } }>;
    };
    image.blocks[0]!.props.alt = '대체 텍스트'.repeat(51);
    expect(image.blocks[0]!.props.alt.length).toBeGreaterThan(300);
    expect(validate(image)).toBe(false);
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
    expect(pageKitManifest.manifest_version).toBe('g7pb-page-kits/v1');
    expect(pageKitManifest.page_kit_version).toMatch(/^\d+\.\d+\.\d+$/);
    const declaredSlugs = pageKitManifest.kits.map((kit) => kit.slug);
    const sourceSlugs = readdirSync(pageKitRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(declaredSlugs.length).toBeGreaterThan(0);
    expect(new Set(declaredSlugs).size).toBe(declaredSlugs.length);
    expect([...declaredSlugs].sort()).toEqual(sourceSlugs);
    pageKitManifest.kits.forEach((kit) => {
      expect(kit.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(kit.title.ko.trim()).not.toBe('');
      expect(kit.title.en.trim()).not.toBe('');
      expect(kit.description.ko.trim()).not.toBe('');
      expect(kit.description.en.trim()).not.toBe('');
      expect(kit.category.trim()).not.toBe('');
      expect(kit.tags.length).toBeGreaterThan(0);
      expect(kit.tags.every((tag) => tag.trim() !== '')).toBe(true);
      expect(kit.media.length).toBeGreaterThan(0);
      expect(kit.media.every((path) => /^media\/[a-z0-9][a-z0-9._-]*$/.test(path))).toBe(true);
      kit.media.forEach((path) => expect(existsSync(resolve(pageKitRoot, kit.slug, path)), path).toBe(true));
    });
    const pageKits = declaredSlugs.map((slug) => JSON.parse(
      readFileSync(resolve(pageKitRoot, slug, 'document.json'), 'utf8'),
    ));
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
      surface: 'default', spacing: 'spacious', containerWidth: 'full', containerAlign: 'right',
      minHeight: 'viewport', verticalAlign: 'center',
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
