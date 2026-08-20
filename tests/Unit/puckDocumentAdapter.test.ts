import { describe, expect, it } from 'vitest';

import type { PuckEditorData } from '../../resources/js/editor/PuckEditorAdapter';
import catalogFixture from '../Contract/document-catalog-v1.fixture.json';
import {
  CONTACT_BLOCK_TYPE,
  CTA_BLOCK_TYPE,
  FEATURES_BLOCK_TYPE,
  HERO_BLOCK_TYPE,
  type PageBuilderDocument,
} from '../../resources/js/documents/types';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

const {
  canonicalToPuck,
  pageBuilderPuckConfig,
  puckToCanonical,
  sanitizeRichTextForPreview,
} = await import('../../resources/js/editor/PuckEditorAdapter');

const documentFixture: PageBuilderDocument = {
  schema_version: 'g7-page-builder/v1',
  document_id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'adapter-round-trip',
  mode: 'canvas',
  locale: 'ko',
  tokens: {
    accent: '#2458d6',
    compact: false,
    columns: 3,
    note: null,
  },
  blocks: [
    {
      instance_id: '223e4567-e89b-42d3-a456-426614174001',
      type: HERO_BLOCK_TYPE,
      block_version: 3,
      props: {
        eyebrow: '지원학습',
        title: '필요한 학습지를 바로 출력하세요',
        body: '<p><strong>선택</strong>하고 바로 시작합니다.</p>',
        primaryCta: { label: '시작하기', url: '/start' },
        image: { src: 'https://example.com/hero.webp', alt: '학습지 미리보기' },
        alignment: 'center',
      },
      slots: {},
    },
    {
      instance_id: '323e4567-e89b-42d3-a456-426614174002',
      type: FEATURES_BLOCK_TYPE,
      block_version: 2,
      props: {
        title: '핵심 기능',
        items: [
          { icon: 'sparkles', title: '빠른 선택', body: '필요한 자료를 찾습니다.' },
          { icon: 'shield', title: '안전한 발행', body: '정상 결과만 공개합니다.' },
        ],
      },
    },
    {
      instance_id: '423e4567-e89b-42d3-a456-426614174003',
      type: CTA_BLOCK_TYPE,
      block_version: 1,
      props: {
        eyebrow: '다음 단계',
        heading: '바로 시작하세요',
        body: '필요한 행동을 안내합니다.',
        primaryLink: { label: '시작하기', url: '/start' },
        secondaryLink: { label: '문의하기', url: 'mailto:hello@example.com' },
        theme: 'dark',
      },
      slots: {},
    },
    {
      instance_id: '523e4567-e89b-42d3-a456-426614174004',
      type: CONTACT_BLOCK_TYPE,
      block_version: 1,
      props: {
        heading: '문의 안내',
        address: '서울특별시 중구 세종대로 110',
        phone: '02-1234-5678',
        email: 'hello@example.com',
        cta: { label: '상담 요청', url: '/contact' },
        mapLink: { label: '지도 보기', url: 'https://maps.example.com/' },
      },
    },
  ],
};

describe('Puck PageBuilderDocument adapter', () => {
  it('keeps inline editing explicit for Hero-family copy and excludes structural fields', () => {
    const components = pageBuilderPuckConfig.components as unknown as Record<string, {
      fields: Record<string, Record<string, unknown>>;
    }>;
    const hero = components.Hero.fields;
    const split = components.HeroSplit.fields;
    const sliderFields = components.HeroSlider.fields.slides as {
      arrayFields: Record<string, Record<string, unknown>>;
    };

    expect(hero.eyebrow.contentEditable).toBe(true);
    expect(hero.title.contentEditable).toBe(true);
    expect(hero.body.contentEditable).toBe(true);
    expect(hero.primaryUrl.contentEditable).not.toBe(true);
    expect(hero.imageSrc.contentEditable).not.toBe(true);

    expect(split.eyebrow.contentEditable).toBe(true);
    expect(split.title.contentEditable).toBe(true);
    expect(split.body.contentEditable).toBe(true);
    expect(split.primaryLabel.contentEditable).toBe(true);
    expect(split.primaryUrl.contentEditable).not.toBe(true);

    expect(sliderFields.arrayFields.eyebrow.contentEditable).toBe(true);
    expect(sliderFields.arrayFields.title.contentEditable).toBe(true);
    expect(sliderFields.arrayFields.body.contentEditable).toBe(true);
    expect(sliderFields.arrayFields.buttonLabel.contentEditable).toBe(true);
    expect(sliderFields.arrayFields.buttonUrl.contentEditable).not.toBe(true);
    expect(sliderFields.arrayFields.imageSrc.contentEditable).not.toBe(true);
  });

  it('does not expose arbitrary code, class, style, or script fields in the editor contract', () => {
    const forbidden = new Set([
      'class', 'classname', 'css', 'html', 'javascript', 'script', 'style', 'tailwind',
    ]);

    const visitFields = (fields: Record<string, unknown>): void => {
      for (const [name, rawField] of Object.entries(fields)) {
        expect(forbidden.has(name.toLowerCase()), `unsafe editor field: ${name}`).toBe(false);
        if (!rawField || typeof rawField !== 'object') continue;
        const field = rawField as Record<string, unknown>;
        if (field.arrayFields && typeof field.arrayFields === 'object') {
          visitFields(field.arrayFields as Record<string, unknown>);
        }
        if (field.objectFields && typeof field.objectFields === 'object') {
          visitFields(field.objectFields as Record<string, unknown>);
        }
      }
    };

    for (const component of Object.values(pageBuilderPuckConfig.components)) {
      visitFields((component as { fields?: Record<string, unknown> }).fields ?? {});
    }
  });

  it('round-trips all eight catalog blocks through the Puck adapter', () => {
    const fixture = catalogFixture as unknown as PageBuilderDocument;
    const session = canonicalToPuck(fixture);

    expect(session.data.content.map((block) => block.type)).toEqual([
      'HeroSplit', 'HeroSlider', 'LogoCloud', 'Stats', 'Pricing', 'Team', 'Gallery', 'BarChart',
    ]);
    expect(puckToCanonical(session.data, session.context)).toEqual(fixture);
  });

  it('round-trips all canonical MVP blocks without leaking Puck state', () => {
    const session = canonicalToPuck(documentFixture);
    const hero = session.data.content[0];
    const cta = session.data.content[2];
    const contact = session.data.content[3];

    expect(hero.type).toBe('Hero');
    expect(hero.props).toMatchObject({
      primaryLabel: '시작하기',
      primaryUrl: '/start',
      imageSrc: 'https://example.com/hero.webp',
      imageAlt: '학습지 미리보기',
    });
    expect(hero.props).not.toHaveProperty('primaryCta');
    expect(hero.props).not.toHaveProperty('image');
    expect(cta.type).toBe('Cta');
    expect(cta.props).toMatchObject({
      primaryLabel: '시작하기',
      primaryUrl: '/start',
      secondaryLabel: '문의하기',
      secondaryUrl: 'mailto:hello@example.com',
      theme: 'dark',
    });
    expect(cta.props).not.toHaveProperty('primaryLink');
    expect(contact.type).toBe('Contact');
    expect(contact.props).toMatchObject({
      ctaLabel: '상담 요청',
      ctaUrl: '/contact',
      mapLabel: '지도 보기',
      mapUrl: 'https://maps.example.com/',
    });
    expect(contact.props).not.toHaveProperty('mapLink');

    const vendorState = {
      ...session.data,
      root: { props: { title: 'Puck-only title' }, readOnly: { title: true } },
      zones: { 'vendor:zone': [] },
      content: session.data.content.map((block) => ({ ...block, readOnly: { title: true } })),
    } as PuckEditorData;

    const restored = puckToCanonical(vendorState, session.context);
    expect(restored).toEqual(documentFixture);
    expect(restored).not.toHaveProperty('root');
    expect(restored).not.toHaveProperty('zones');
    expect(restored.blocks[0]).not.toHaveProperty('readOnly');
  });

  it('round-trips typed block motion without leaking editor-only fields', () => {
    const animated: PageBuilderDocument = structuredClone(documentFixture);
    animated.blocks[0].motion = {
      preset: 'parallax-soft',
      intensity: 'subtle',
      trigger: 'repeat',
      stagger_ms: 60,
    };
    const session = canonicalToPuck(animated);

    expect(session.data.content[0].props.motion).toEqual(animated.blocks[0].motion);
    expect(puckToCanonical(session.data, session.context)).toEqual(animated);
  });

  it('omits empty optional link maps when converting new CTA and Contact blocks', () => {
    const session = canonicalToPuck({ ...documentFixture, blocks: [] });
    const data = {
      root: {},
      content: [
        {
          type: 'Cta',
          props: {
            id: 'Cta-61111111-1111-4111-8111-111111111111',
            eyebrow: '',
            heading: '행동 안내',
            body: '',
            primaryLabel: '',
            primaryUrl: '',
            secondaryLabel: '',
            secondaryUrl: '',
            theme: 'light',
          },
        },
        {
          type: 'Contact',
          props: {
            id: 'Contact-71111111-1111-4111-8111-111111111111',
            heading: '문의 안내',
            address: '서울',
            phone: '02-1234-5678',
            email: 'hello@example.com',
            ctaLabel: '',
            ctaUrl: '',
            mapLabel: '',
            mapUrl: '',
          },
        },
      ],
    } as PuckEditorData;

    const restored = puckToCanonical(data, session.context);
    expect(restored.blocks[0].props).toEqual({
      eyebrow: '',
      heading: '행동 안내',
      body: '',
      theme: 'light',
    });
    expect(restored.blocks[1].props).toEqual({
      heading: '문의 안내',
      address: '서울',
      phone: '02-1234-5678',
      email: 'hello@example.com',
    });
  });

  it('maps a new Puck block id to a canonical UUID and nested optional props', () => {
    const { tokens: _tokens, ...documentWithoutTokens } = documentFixture;
    const session = canonicalToPuck({ ...documentWithoutTokens, blocks: [] });
    const generatedId = 'Hero-11111111-1111-4111-8111-111111111111';
    const data = {
      root: {},
      content: [
        {
          type: 'Hero',
          props: {
            id: generatedId,
            eyebrow: '',
            title: '새 Hero',
            body: '<p>본문</p>',
            primaryLabel: '',
            primaryUrl: '',
            imageSrc: '',
            imageAlt: '',
            alignment: 'left',
          },
        },
      ],
    } as PuckEditorData;

    const restored = puckToCanonical(data, session.context);
    expect(restored.tokens).toBeUndefined();
    expect(restored.blocks).toEqual([
      {
        instance_id: '11111111-1111-4111-8111-111111111111',
        type: HERO_BLOCK_TYPE,
        block_version: 1,
        props: {
          eyebrow: '',
          title: '새 Hero',
          body: '<p>본문</p>',
          alignment: 'left',
        },
        slots: {},
      },
    ]);
  });

  it('rejects nested slots and unknown canonical blocks at the adapter boundary', () => {
    const nested = {
      ...documentFixture,
      blocks: [
        {
          ...documentFixture.blocks[0],
          slots: { body: [documentFixture.blocks[1]] },
        },
      ],
    };
    expect(() => canonicalToPuck(nested)).toThrow('cannot contain nested slots');

    const unknown = {
      ...documentFixture,
      blocks: [{ ...documentFixture.blocks[0], type: 'custom.unknown-01' }],
    };
    expect(() => canonicalToPuck(unknown)).toThrow('Unsupported PageBuilder block');
  });

  it('sanitizes editor rich-text preview to the MVP allowlist', () => {
    const safe = sanitizeRichTextForPreview(
      '<p onclick="alert(1)">문장 <strong style="color:red">강조</strong>' +
      '<script>alert(1)</script><a href="javascript:alert(1)">링크</a></p>',
    );

    expect(safe).toContain('<p>');
    expect(safe).toContain('<strong>강조</strong>');
    expect(safe).not.toContain('onclick');
    expect(safe).not.toContain('style=');
    expect(safe).not.toContain('<script');
    expect(safe).not.toContain('javascript:');
  });
});
