import { externalEditorComponents } from '../blocks/runtimeRegistry';
import { applyEditorContentPolicy, type EditorFieldContract } from './editorViewportPolicy';
import React, { useEffect, useState } from 'react';
import type { Config } from '@puckeditor/core';
import type { ContactEditorProps, CtaEditorProps, EditorComponents, HeroEditorProps } from './puckEditorTypes';
import { StableSelectField, withBlockContainerFields } from './blockInspectorFields';
import { createMotionField, DEFAULT_BLOCK_MOTION } from './blockMotion';
import { catalogComponentConfigs } from './catalogBlocks';
import { layoutCatalogComponentConfigs } from './layoutCatalogBlocks';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField } from './richTextEditing';
import { DEFAULT_FEATURES, normalizeTheme } from './puckBlockCodec';
import type { PageDesignProps } from './pageDesignTokens';
import { FullSiteRoot } from './FullSiteCanvas';
import { ContactPreview, CtaPreview, FeaturesPreview, HeroPreview } from './puckBuiltinPreviews';

const DEFAULT_HERO: HeroEditorProps = {
  eyebrow: '새로운 페이지',
  title: '방문자가 바로 이해하는 한 문장',
  body: '<p>핵심 가치와 다음 행동을 짧고 분명하게 안내해 보세요.</p>',
  primaryLabel: '자세히 보기',
  primaryUrl: '/',
  imageSrc: '',
  imageAlt: '',
  alignment: 'center',
  mediaPosition: 'right',
  layout: 'product',
  surface: 'default',
  spacing: 'spacious',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_CTA: CtaEditorProps = {
  eyebrow: '다음 단계',
  heading: '방문자가 바로 행동할 수 있게 안내하세요',
  body: '가장 중요한 행동 하나와 보조 선택지를 짧고 분명하게 제시합니다.',
  primaryLabel: '지금 시작하기',
  primaryUrl: '/',
  secondaryLabel: '자세히 보기',
  secondaryUrl: '/about',
  theme: 'light',
  layout: 'split',
  surface: 'soft',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_CONTACT: ContactEditorProps = {
  heading: '문의 안내',
  address: '서울특별시 중구 세종대로 110',
  phone: '02-1234-5678',
  email: 'hello@example.com',
  ctaLabel: '문의하기',
  ctaUrl: '/contact',
  mapLabel: '지도에서 보기',
  mapUrl: 'https://maps.google.com/',
  surface: 'default',
  spacing: 'normal',
  motion: { ...DEFAULT_BLOCK_MOTION },
};

function StableInputField({
  value,
  onChange,
  readOnly,
  testId,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId: string;
  multiline?: boolean;
}): React.ReactElement {
  if (multiline) {
    return (
      <textarea
        className="g7pb-field-control g7pb-field-control--textarea"
        data-testid={testId}
        value={value ?? ''}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <input
      className="g7pb-field-control"
      data-testid={testId}
      type="text"
      value={value ?? ''}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function StableColorField({
  value,
  onChange,
  readOnly,
  testId,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  testId: string;
  label: string;
}): React.ReactElement {
  const [draftValue, setDraftValue] = useState(value);
  useEffect(() => setDraftValue(value), [value]);
  return <label className="g7pb-design-field g7pb-design-field--color">
    <span>{label}</span>
    <input className="g7pb-field-control" type="color" value={draftValue} disabled={readOnly}
      data-testid={testId} onChange={(event) => {
        const next = event.currentTarget.value.toLowerCase();
        setDraftValue(next);
        onChange(next);
      }} />
  </label>;
}

function createPageColorField(label: string, testId: string) {
  return {
    type: 'custom' as const,
    label,
    render: ({ value, onChange, readOnly }: {
      value: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
    }) => <StableColorField value={value} onChange={onChange} readOnly={readOnly} testId={testId} label={label} />,
  };
}

export const pageBuilderPuckConfig: Config<EditorComponents, PageDesignProps> = {
  categories: {
    layout: {
      title: '구조 레이아웃',
      components: ['LayoutSection'],
      defaultExpanded: true,
    },
    layoutInternal: {
      components: ['LayoutColumns', 'LayoutStack'],
      visible: false,
    },
    content: {
      title: '콘텐츠 블록',
      components: ['Heading', 'RichText', 'ImageText', 'IconList', 'Hero', 'HeroSlider', 'Features', 'Cta', 'Buttons', 'Contact', 'FaqAccordion', 'ProcessTimeline', 'Tabs', 'ArticleList', 'EventSchedule', 'DownloadResources', 'InquiryForm', 'MapDirections'],
      defaultExpanded: true,
    },
    business: {
      title: '비즈니스·신뢰',
      components: ['LogoCloud', 'LogoCarousel', 'Testimonials', 'TestimonialSlider', 'Pricing', 'ComparisonTable', 'Team'],
      defaultExpanded: true,
    },
    dataMedia: {
      title: '데이터·미디어',
      components: ['Image', 'Stats', 'BarChart', 'Gallery', 'VideoEmbed'],
      defaultExpanded: true,
    },
    g7Data: {
      title: 'G7 데이터',
      components: ['G7RecentPosts', 'G7BoardArchive', 'G7PostDetail', 'G7ProductGrid', 'G7ProductShowcase', 'G7ProductDetail'],
      defaultExpanded: true,
    },
    legacy: {
      components: ['HeroSplit'],
      visible: false,
    },
  },
  components: withBlockContainerFields({
    ...layoutCatalogComponentConfigs,
    ...catalogComponentConfigs,
    Hero: {
      label: 'Hero',
      defaultProps: DEFAULT_HERO,
      fields: {
        eyebrow: {
          type: 'custom',
          label: '보조 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-hero-subtitle"
            />
          ),
        },
        title: createInlineRichTextField('제목'),
        body: createRichTextField('본문', 150, true),
        primaryLabel: {
          type: 'custom', label: '버튼 문구', contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-hero-primary-label" />
          ),
        },
        primaryUrl: createRouteUrlField('버튼 연결', 'page-builder-hero-primary-url'),
        imageSrc: createMediaField('대표 이미지', 'hero-image'),
        imageAlt: { type: 'text', label: '이미지 대체 텍스트' },
        alignment: {
          type: 'radio',
          label: '정렬',
          options: [
            { label: '왼쪽', value: 'left' },
            { label: '가운데', value: 'center' },
          ],
        },
        mediaPosition: {
          type: 'radio',
          label: '이미지 위치',
          options: [
            { label: '왼쪽', value: 'left' },
            { label: '오른쪽', value: 'right' },
          ],
        },
        layout: {
          type: 'select', label: '레이아웃', options: [
            { label: '기존 기본', value: 'classic' },
            { label: '제품 소개', value: 'product' }, { label: '포스터', value: 'poster' },
            { label: '배경 이미지', value: 'backdrop' }, { label: '에디토리얼', value: 'editorial' },
            { label: '디바이스 쇼케이스', value: 'device' },
            { label: '균형 분할', value: 'balanced' }, { label: '제품 스크린샷', value: 'screenshot' },
            { label: '이미지 겹침', value: 'overlap' }, { label: '세로 오프셋', value: 'offset' },
          ],
        },
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
        surface: {
          type: 'select',
          label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select',
          label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal', 'parallax-soft']),
      },
      render: (props) => <HeroPreview {...props} />,
    },
    Features: {
      label: 'Features',
      defaultProps: DEFAULT_FEATURES,
      fields: {
        title: createInlineRichTextField('제목'),
        items: {
          type: 'array',
          label: '항목',
          min: 2,
          max: 6,
          defaultItemProps: (index) => ({ icon: 'sparkles', title: `기능 ${index + 1}`, body: '기능 설명을 입력하세요.' }),
          getItemSummary: (item) => item.title,
          arrayFields: {
            icon: { type: 'select', label: '아이콘', options: [
              { label: '반짝임', value: 'sparkles' }, { label: '보호', value: 'shield' },
              { label: '속도', value: 'bolt' }, { label: '관심', value: 'heart' },
            ] },
            title: createInlineRichTextField('제목'),
            body: createRichTextField('설명', 130),
          },
        },
        layout: { type: 'select', label: '레이아웃', options: [
          { label: '벤토', value: 'bento' }, { label: '균등 그리드', value: 'grid' },
          { label: '에디토리얼', value: 'editorial' }, { label: '패널', value: 'panel' },
          { label: '세로 목록', value: 'list' },
        ] },
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
        surface: {
          type: 'select', label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select', label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal', 'stagger']),
      },
      render: ({ id, title, items, layout, surface, spacing, motion }) => (
        <FeaturesPreview id={id} title={title} items={items} layout={layout} surface={surface} spacing={spacing} motion={motion} />
      ),
    },
    Cta: {
      label: 'CTA',
      defaultProps: DEFAULT_CTA,
      fields: {
        eyebrow: {
          type: 'custom',
          label: '보조 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-eyebrow" />
          ),
        },
        heading: createInlineRichTextField('제목'),
        body: createRichTextField('본문', 150, true),
        primaryLabel: {
          type: 'custom',
          label: '주 버튼 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-primary-label" />
          ),
        },
        primaryUrl: createRouteUrlField('주 버튼 연결', 'page-builder-cta-primary-url'),
        secondaryLabel: {
          type: 'custom',
          label: '보조 링크 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-cta-secondary-label" />
          ),
        },
        secondaryUrl: createRouteUrlField('보조 링크 연결', 'page-builder-cta-secondary-url'),
        theme: {
          type: 'custom',
          label: '테마',
          render: ({ value, onChange, readOnly }) => (
            <StableSelectField
              value={normalizeTheme(value)}
              onChange={onChange}
              readOnly={readOnly}
              testId="page-builder-cta-theme"
              options={[
                { label: '밝게', value: 'light' },
                { label: '어둡게', value: 'dark' },
              ]}
            />
          ),
        },
        layout: { type: 'select', label: '레이아웃', options: [
          { label: '분할', value: 'split' }, { label: '가운데 집중', value: 'centered' },
          { label: '가로 배너', value: 'banner' }, { label: '강조 패널', value: 'panel' },
        ] },
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
        surface: {
          type: 'select', label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select', label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal']),
      },
      render: (props) => <CtaPreview {...props} theme={normalizeTheme(props.theme)} />,
    },
    Contact: {
      label: 'Contact',
      defaultProps: DEFAULT_CONTACT,
      fields: {
        heading: createInlineRichTextField('제목'),
        address: {
          type: 'custom',
          label: '주소',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly} multiline
              testId="page-builder-contact-address" />
          ),
        },
        phone: {
          type: 'custom',
          label: '전화번호',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-phone" />
          ),
        },
        email: {
          type: 'custom',
          label: '이메일',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-email" />
          ),
        },
        ctaLabel: {
          type: 'custom',
          label: '문의 링크 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-cta-label" />
          ),
        },
        ctaUrl: createRouteUrlField('문의 링크 연결', 'page-builder-contact-cta-url'),
        mapLabel: {
          type: 'custom',
          label: '지도 링크 문구',
          contentEditable: true,
          render: ({ value, onChange, readOnly }) => (
            <StableInputField value={value} onChange={onChange} readOnly={readOnly}
              testId="page-builder-contact-map-label" />
          ),
        },
        mapUrl: createRouteUrlField('지도 링크 연결', 'page-builder-contact-map-url'),
        elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
        surface: {
          type: 'select', label: '배경 프리셋',
          options: [
            { label: '기본', value: 'default' },
            { label: '부드럽게', value: 'soft' },
            { label: '강조', value: 'contrast' },
          ],
        },
        spacing: {
          type: 'select', label: '세로 여백',
          options: [
            { label: '좁게', value: 'compact' },
            { label: '기본', value: 'normal' },
            { label: '넓게', value: 'spacious' },
          ],
        },
        motion: createMotionField(['none', 'reveal']),
      },
      render: (props) => <ContactPreview {...props} />,
    },
  }),
  root: {
    fields: {
      colorMode: {
        type: 'custom', label: '화면 테마',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="화면 테마" help="공개 페이지와 편집 캔버스의 밝기를 정합니다."
            testId="page-builder-design-color-mode" options={[
              { label: '라이트', value: 'light' }, { label: '다크', value: 'dark' }, { label: '기기 설정', value: 'system' },
            ]} />
        ),
      },
      palette: {
        type: 'custom', label: '브랜드 색상',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="브랜드 색상" help="버튼, 링크, 강조 요소에 공통 적용됩니다."
            testId="page-builder-design-palette" options={[
              { label: '인디고', value: 'indigo' }, { label: '블루', value: 'blue' },
              { label: '에메랄드', value: 'emerald' }, { label: '앰버', value: 'amber' },
              { label: '로즈', value: 'rose' }, { label: '슬레이트', value: 'slate' },
            ]} />
        ),
      },
      font: {
        type: 'custom', label: '글꼴 분위기',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="글꼴 분위기" help="페이지 전체 타이포그래피 계열을 선택합니다."
            testId="page-builder-design-font" options={[
              { label: '시스템', value: 'system' }, { label: '모던', value: 'modern' }, { label: '명조', value: 'serif' },
            ]} />
        ),
      },
      radius: {
        type: 'custom', label: '모서리',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="모서리" help="카드, 이미지, 버튼의 둥근 정도입니다."
            testId="page-builder-design-radius" options={[
              { label: '각지게', value: 'sharp' }, { label: '부드럽게', value: 'soft' }, { label: '둥글게', value: 'round' },
            ]} />
        ),
      },
      width: {
        type: 'custom', label: '콘텐츠 폭',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="콘텐츠 폭" help="본문이 차지하는 최대 가로 폭입니다."
            testId="page-builder-design-width" options={[
              { label: '좁게', value: 'narrow' }, { label: '기본', value: 'standard' }, { label: '넓게', value: 'wide' },
            ]} />
        ),
      },
      scale: {
        type: 'custom', label: '글자 크기',
        render: ({ value, onChange, readOnly }) => (
          <StableSelectField value={value} onChange={onChange} readOnly={readOnly} label="기본 글자 크기" help="전체 글자 비율을 한 번에 조절합니다."
            testId="page-builder-design-scale" options={[
              { label: '작게', value: 'compact' }, { label: '기본', value: 'balanced' }, { label: '크게', value: 'large' },
            ]} />
        ),
      },
      customColor1Light: createPageColorField('사용자색 1 · 라이트', 'page-builder-design-custom-1-light'),
      customColor1Dark: createPageColorField('사용자색 1 · 다크', 'page-builder-design-custom-1-dark'),
      customColor2Light: createPageColorField('사용자색 2 · 라이트', 'page-builder-design-custom-2-light'),
      customColor2Dark: createPageColorField('사용자색 2 · 다크', 'page-builder-design-custom-2-dark'),
      customColor3Light: createPageColorField('사용자색 3 · 라이트', 'page-builder-design-custom-3-light'),
      customColor3Dark: createPageColorField('사용자색 3 · 다크', 'page-builder-design-custom-3-dark'),
      customColor4Light: createPageColorField('사용자색 4 · 라이트', 'page-builder-design-custom-4-light'),
      customColor4Dark: createPageColorField('사용자색 4 · 다크', 'page-builder-design-custom-4-dark'),
    },
    render: ({ children, ...design }) => <FullSiteRoot design={design}>{children}</FullSiteRoot>,
  },
};


export function createRuntimePuckConfig(structureEditingEnabled: boolean, editingDisabled: boolean): Config<EditorComponents, PageDesignProps> {
    const baseConfig = {
      ...pageBuilderPuckConfig,
      categories: {
        ...pageBuilderPuckConfig.categories,
        layout: {
          ...pageBuilderPuckConfig.categories?.layout,
          visible: structureEditingEnabled,
        },
      },
      components: {
        ...pageBuilderPuckConfig.components,
        ...externalEditorComponents(),
      },
    } as Config<EditorComponents, PageDesignProps>;
    if (!editingDisabled) return baseConfig;
    const components = Object.fromEntries(Object.entries(baseConfig.components).map(([type, candidate]) => {
      const component = candidate as typeof candidate & { fields?: Record<string, EditorFieldContract> };
      if (!component.fields) return [type, component];
      return [type, { ...component, fields: applyEditorContentPolicy(component.fields, false) }];
    })) as Config<EditorComponents, PageDesignProps>['components'];
    return { ...baseConfig, components };
}
