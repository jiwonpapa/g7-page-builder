import { describe, expect, it } from 'vitest';

import type { PuckEditorData } from '../../resources/js/editor/PuckEditorAdapter';
import catalogFixture from '../Contract/document-catalog-v1.fixture.json';
import {
  ARTICLE_LIST_BLOCK_TYPE,
  BUTTONS_BLOCK_TYPE,
  COMPARISON_TABLE_BLOCK_TYPE,
  CONTACT_BLOCK_TYPE,
  CTA_BLOCK_TYPE,
  FAQ_ACCORDION_BLOCK_TYPE,
  FEATURES_BLOCK_TYPE,
  DOWNLOAD_RESOURCES_BLOCK_TYPE,
  EVENT_SCHEDULE_BLOCK_TYPE,
  G7_BOARD_ARCHIVE_BLOCK_TYPE,
  G7_PRODUCT_GRID_BLOCK_TYPE,
  G7_PRODUCT_SHOWCASE_BLOCK_TYPE,
  G7_RECENT_POSTS_BLOCK_TYPE,
  HERO_BLOCK_TYPE,
  HEADING_BLOCK_TYPE,
  ICON_LIST_BLOCK_TYPE,
  IMAGE_BLOCK_TYPE,
  IMAGE_TEXT_BLOCK_TYPE,
  INQUIRY_FORM_BLOCK_TYPE,
  MAP_DIRECTIONS_BLOCK_TYPE,
  LOGO_CAROUSEL_BLOCK_TYPE,
  PROCESS_TIMELINE_BLOCK_TYPE,
  RICH_TEXT_BLOCK_TYPE,
  TABS_BLOCK_TYPE,
  TESTIMONIALS_BLOCK_TYPE,
  TESTIMONIAL_SLIDER_BLOCK_TYPE,
  VIDEO_EMBED_BLOCK_TYPE,
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

  it('exposes only typed page-level design presets on the Puck root', () => {
    const root = pageBuilderPuckConfig.root as unknown as {
      fields: Record<string, { type: string }>;
    };

    expect(Object.keys(root.fields)).toEqual(['colorMode', 'palette', 'font', 'radius', 'width', 'scale']);
    expect(Object.values(root.fields).every((field) => field.type === 'custom')).toBe(true);
    expect(root.fields).not.toHaveProperty('css');
    expect(root.fields).not.toHaveProperty('className');
    expect(root.fields).not.toHaveProperty('style');
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
    } as unknown as PuckEditorData;

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

  it('round-trips safe page design tokens and preserves extension tokens', () => {
    const designed: PageBuilderDocument = {
      ...documentFixture,
      tokens: { ...documentFixture.tokens, 'design.palette': 'emerald', 'design.width': 'wide' },
    };
    const session = canonicalToPuck(designed);

    expect(session.data.root.props).toMatchObject({
      palette: 'emerald', width: 'wide', font: 'modern', radius: 'soft', scale: 'balanced',
    });

    const edited = structuredClone(session.data);
    if (!edited.root.props) throw new Error('Page design root props are missing.');
    edited.root.props.font = 'serif';
    edited.root.props.radius = 'round';
    const restored = puckToCanonical(edited, session.context);

    expect(restored.tokens).toMatchObject({
      accent: '#2458d6',
      'design.palette': 'emerald',
      'design.font': 'serif',
      'design.radius': 'round',
      'design.width': 'wide',
    });
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

  it('round-trips typed G7 public data source settings', () => {
    const dynamic: PageBuilderDocument = {
      ...documentFixture,
      blocks: [
        {
          instance_id: '623e4567-e89b-42d3-a456-426614174005',
          type: G7_RECENT_POSTS_BLOCK_TYPE,
          block_version: 1,
          props: { eyebrow: 'NEWS', heading: '인기글', source: 'popular', period: 'month', limit: 8, audience: 'guest', emptyMessage: '글 없음' },
          slots: {},
        },
        {
          instance_id: '723e4567-e89b-42d3-a456-426614174006',
          type: G7_PRODUCT_GRID_BLOCK_TYPE,
          block_version: 1,
          props: { eyebrow: 'SHOP', heading: '신상품', source: 'new', limit: 6, columns: 3, audience: 'member', detailBasePath: '/shop/products', emptyMessage: '상품 없음' },
          slots: {},
        },
      ],
    };

    const session = canonicalToPuck(dynamic);
    const restored = puckToCanonical(session.data, session.context);

    expect(restored.blocks).toEqual(dynamic.blocks);
  });

  it('round-trips inquiry and location blocks through the typed adapter', () => {
    const serviceBlocks: PageBuilderDocument = {
      ...documentFixture,
      blocks: [
        {
          instance_id: '823e4567-e89b-42d3-a456-426614174007',
          type: INQUIRY_FORM_BLOCK_TYPE,
          block_version: 1,
          props: {
            eyebrow: '상담',
            heading: '프로젝트를 알려주세요',
            description: '확인 후 연락드리겠습니다.',
            formKind: 'quote',
            submitLabel: '견적 요청',
            successMessage: '접수되었습니다.',
            privacyLabel: '문의 처리에 동의합니다.',
            showPhone: true,
            showSubject: false,
            appearance: { surface: 'soft', spacing: 'normal', textScale: 'large', textAlign: 'right' },
          },
          slots: {},
        },
        {
          instance_id: '923e4567-e89b-42d3-a456-426614174008',
          type: MAP_DIRECTIONS_BLOCK_TYPE,
          block_version: 1,
          props: {
            eyebrow: '오시는 길',
            heading: '사무실 안내',
            description: '대중교통 이용을 권장합니다.',
            address: '서울특별시 중구 세종대로 110',
            latitude: 37.5665,
            longitude: 126.978,
            zoom: 16,
            provider: 'openstreetmap',
            directionsLabel: '길찾기',
            directionsUrl: 'https://www.openstreetmap.org/',
            phone: '02-0000-0000',
            hours: '평일 09:00–18:00',
            parking: '방문객 주차 가능',
            appearance: { surface: 'default', spacing: 'normal', textScale: 'compact', textAlign: 'center' },
          },
          slots: {},
        },
      ],
    };

    const session = canonicalToPuck(serviceBlocks);

    expect(session.data.content.map((block) => block.type)).toEqual(['InquiryForm', 'MapDirections']);
    expect(puckToCanonical(session.data, session.context)).toEqual(serviceBlocks);
  });

  it('round-trips all seven phase-two product blocks and exposes their visible copy inline', () => {
    const phaseTwo: PageBuilderDocument = {
      ...documentFixture,
      blocks: [
        { instance_id: 'a23e4567-e89b-42d3-a456-426614174009', type: TESTIMONIALS_BLOCK_TYPE, block_version: 1, props: { eyebrow: '후기', heading: '고객 이야기', layout: 'grid', items: [{ quote: '좋았습니다.', name: '김고객', role: '대표', company: '예시', avatarSrc: '', avatarAlt: '', rating: 5 }, { quote: '편리합니다.', name: '이고객', role: '운영', company: '샘플', avatarSrc: '', avatarAlt: '', rating: 4 }] }, slots: {} },
        { instance_id: 'b23e4567-e89b-42d3-a456-426614174010', type: FAQ_ACCORDION_BLOCK_TYPE, block_version: 1, props: { eyebrow: 'FAQ', heading: '질문', behavior: 'single', openFirst: true, items: [{ question: '질문 1', answer: '답변 1' }, { question: '질문 2', answer: '답변 2' }] }, slots: {} },
        { instance_id: 'c23e4567-e89b-42d3-a456-426614174011', type: PROCESS_TIMELINE_BLOCK_TYPE, block_version: 1, props: { eyebrow: '과정', heading: '진행', layout: 'horizontal', items: [{ title: '선택', body: '선택합니다.', linkLabel: '', linkUrl: '' }, { title: '발행', body: '발행합니다.', linkLabel: '안내', linkUrl: '/guide' }] }, slots: {} },
        { instance_id: 'd23e4567-e89b-42d3-a456-426614174012', type: TABS_BLOCK_TYPE, block_version: 1, props: { eyebrow: '안내', heading: '서비스', initialTab: 1, style: 'pills', items: [{ label: '기획', heading: '기획 안내', body: '기획합니다.' }, { label: '운영', heading: '운영 안내', body: '운영합니다.' }] }, slots: {} },
        { instance_id: 'e23e4567-e89b-42d3-a456-426614174013', type: COMPARISON_TABLE_BLOCK_TYPE, block_version: 1, props: { eyebrow: '비교', heading: '플랜', highlightColumn: 1, columns: [{ title: '기본', description: '시작' }, { title: '성장', description: '운영' }], rows: [{ feature: '페이지', values: ['3개', '무제한'] }] }, slots: {} },
        { instance_id: 'f23e4567-e89b-42d3-a456-426614174014', type: ARTICLE_LIST_BLOCK_TYPE, block_version: 1, props: { eyebrow: '소식', heading: '이야기', layout: 'list', items: [{ category: '제품', title: '첫 글', summary: '첫 글입니다.', date: '2026-08-21', imageSrc: '', imageAlt: '', url: '/first' }, { category: '가이드', title: '둘째 글', summary: '둘째 글입니다.', date: '2026-08-20', imageSrc: '', imageAlt: '', url: '/second' }] }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174015', type: VIDEO_EMBED_BLOCK_TYPE, block_version: 1, props: { eyebrow: '영상', heading: '제품 소개', caption: '영상 설명', provider: 'youtube', videoId: 'abcDEF12345', ratio: '16:9' }, slots: {} },
      ],
    };

    const session = canonicalToPuck(phaseTwo);
    expect(session.data.content.map((block) => block.type)).toEqual(['Testimonials', 'FaqAccordion', 'ProcessTimeline', 'Tabs', 'ComparisonTable', 'ArticleList', 'VideoEmbed']);
    expect(puckToCanonical(session.data, session.context)).toEqual(phaseTwo);

    const components = pageBuilderPuckConfig.components as unknown as Record<string, { fields: Record<string, Record<string, unknown>> }>;
    expect(components.Testimonials.fields.heading.contentEditable).toBe(true);
    expect((components.FaqAccordion.fields.items.arrayFields as Record<string, Record<string, unknown>>).question.contentEditable).toBe(true);
    expect((components.ArticleList.fields.items.arrayFields as Record<string, Record<string, unknown>>).title.contentEditable).toBe(true);
    expect(components.VideoEmbed.fields.videoId.contentEditable).not.toBe(true);
  });

  it('round-trips all six phase-three product blocks through the canonical contract', () => {
    const phaseThree: PageBuilderDocument = {
      ...documentFixture,
      blocks: [
        { instance_id: '123e4567-e89b-42d3-a456-426614174020', type: LOGO_CAROUSEL_BLOCK_TYPE, block_version: 1, props: { eyebrow: '파트너', heading: '함께합니다', autoplay: true, interval: 5000, logos: [{ name: 'A', imageSrc: '', imageAlt: '', url: '/' }, { name: 'B', imageSrc: '', imageAlt: '', url: '/' }, { name: 'C', imageSrc: '', imageAlt: '', url: '/' }] }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174021', type: TESTIMONIAL_SLIDER_BLOCK_TYPE, block_version: 1, props: { eyebrow: '후기', heading: '고객 이야기', autoplay: false, interval: 7000, items: [{ quote: '좋습니다.', name: '김고객', role: '대표', company: 'A', avatarSrc: '', avatarAlt: '', rating: 5 }, { quote: '편합니다.', name: '이고객', role: '운영', company: 'B', avatarSrc: '', avatarAlt: '', rating: 4 }] }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174022', type: EVENT_SCHEDULE_BLOCK_TYPE, block_version: 1, props: { eyebrow: '일정', heading: '행사', layout: 'agenda', items: [{ date: '2026-09-03', time: '14:00', title: '웨비나', location: '온라인', description: '제품을 소개합니다.', buttonLabel: '신청', buttonUrl: '/events/1' }] }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174023', type: DOWNLOAD_RESOURCES_BLOCK_TYPE, block_version: 1, props: { eyebrow: '자료', heading: '다운로드', items: [{ title: '소개서', description: '제품 소개서입니다.', fileType: 'PDF', fileSize: '2 MB', buttonLabel: '받기', url: '/files/guide.pdf' }] }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174024', type: G7_BOARD_ARCHIVE_BLOCK_TYPE, block_version: 1, props: { eyebrow: '아카이브', heading: '게시글', source: 'recent', period: 'month', limit: 12, audience: 'all', showSearch: true, showBoardFilter: true, emptyMessage: '게시글이 없습니다.' }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174025', type: G7_PRODUCT_SHOWCASE_BLOCK_TYPE, block_version: 1, props: { eyebrow: '상품', heading: '추천', source: 'new', limit: 6, audience: 'member', detailBasePath: '/shop/products', layout: 'featured', emptyMessage: '상품이 없습니다.' }, slots: {} },
      ],
    };

    const session = canonicalToPuck(phaseThree);
    expect(session.data.content.map((block) => block.type)).toEqual(['LogoCarousel', 'TestimonialSlider', 'EventSchedule', 'DownloadResources', 'G7BoardArchive', 'G7ProductShowcase']);
    expect(puckToCanonical(session.data, session.context)).toEqual(phaseThree);

    const components = pageBuilderPuckConfig.components as unknown as Record<string, { fields: Record<string, Record<string, unknown>> }>;
    expect(components.LogoCarousel.fields.heading.contentEditable).toBe(true);
    expect((components.EventSchedule.fields.items.arrayFields as Record<string, Record<string, unknown>>).title.contentEditable).toBe(true);
    expect(components.G7BoardArchive.fields.showSearch.contentEditable).not.toBe(true);
  });

  it('round-trips all six foundation blocks and keeps visible copy directly editable', () => {
    const foundation: PageBuilderDocument = {
      ...documentFixture,
      blocks: [
        { instance_id: '123e4567-e89b-42d3-a456-426614174030', type: HEADING_BLOCK_TYPE, block_version: 1, props: { eyebrow: '안내', heading: '기본 제목', level: 2, anchor: 'foundation' }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174031', type: RICH_TEXT_BLOCK_TYPE, block_version: 1, props: { content: '<p>읽기 쉬운 <strong>본문</strong>입니다.</p>', measure: 'standard' }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174032', type: IMAGE_BLOCK_TYPE, block_version: 1, props: { src: '', alt: '', caption: '이미지 캡션', linkUrl: '', aspectRatio: '16:9' }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174033', type: BUTTONS_BLOCK_TYPE, block_version: 1, props: { items: [{ label: '시작', url: '/start', variant: 'primary' }, { label: '문의', url: '/contact', variant: 'secondary' }], alignment: 'center' }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174034', type: IMAGE_TEXT_BLOCK_TYPE, block_version: 1, props: { eyebrow: '제품', heading: '이미지와 설명', body: '<p>설명 본문</p>', image: { src: '', alt: '' }, mediaPosition: 'right', primaryLink: { label: '보기', url: '/details' } }, slots: {} },
        { instance_id: '123e4567-e89b-42d3-a456-426614174035', type: ICON_LIST_BLOCK_TYPE, block_version: 1, props: { eyebrow: '장점', heading: '세 가지 기준', items: [{ icon: 'bolt', title: '빠름', body: '빠르게 시작합니다.' }, { icon: 'shield', title: '안전', body: '안전하게 발행합니다.' }], layout: 'two-column' }, slots: {} },
      ],
    };

    const session = canonicalToPuck(foundation);
    expect(session.data.content.map((block) => block.type)).toEqual([
      'Heading', 'RichText', 'Image', 'Buttons', 'ImageText', 'IconList',
    ]);
    expect(puckToCanonical(session.data, session.context)).toEqual(foundation);

    const edited = structuredClone(session.data) as PuckEditorData;
    (edited.content[0]!.props as Record<string, unknown>).anchor = ' 2026 Launch Plan ';
    expect(puckToCanonical(edited, session.context).blocks[0]!.props.anchor).toBe('section-2026-launch-plan');

    const components = pageBuilderPuckConfig.components as unknown as Record<string, { fields: Record<string, Record<string, unknown>> }>;
    expect(components.Heading.fields.heading.contentEditable).toBe(true);
    expect(components.RichText.fields.content.contentEditable).toBe(true);
    expect(components.Image.fields.caption.contentEditable).toBe(true);
    expect(components.Image.fields.src.contentEditable).not.toBe(true);
    expect((components.Buttons.fields.items.arrayFields as Record<string, Record<string, unknown>>).label.contentEditable).toBe(true);
    expect((components.Buttons.fields.items.arrayFields as Record<string, Record<string, unknown>>).url.contentEditable).not.toBe(true);
    expect(components.ImageText.fields.body.contentEditable).toBe(true);
    expect((components.IconList.fields.items.arrayFields as Record<string, Record<string, unknown>>).title.contentEditable).toBe(true);
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
