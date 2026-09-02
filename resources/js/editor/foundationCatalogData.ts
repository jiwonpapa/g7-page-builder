import type { ButtonItem, IconListItem } from '../documents/types';
import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';

export interface HeadingEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  level: '2' | '3' | '4';
  anchor: string;
}

export interface RichTextEditorProps extends AppearanceEditorProps {
  content: string;
  measure: 'narrow' | 'standard' | 'wide';
}

export interface ImageEditorProps extends AppearanceEditorProps {
  src: string;
  alt: string;
  caption: string;
  linkUrl: string;
  aspectRatio: 'auto' | '16:9' | '4:3' | '1:1';
}

export interface ButtonsEditorProps extends AppearanceEditorProps {
  items: ButtonItem[];
  alignment: 'left' | 'center' | 'right';
}

export interface ImageTextEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  mediaPosition: 'left' | 'right';
  primaryLabel: string;
  primaryUrl: string;
}

export interface IconListEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: IconListItem[];
  layout: 'single' | 'two-column';
}

export interface FoundationCatalogEditorComponents {
  Heading: HeadingEditorProps;
  RichText: RichTextEditorProps;
  Image: ImageEditorProps;
  Buttons: ButtonsEditorProps;
  ImageText: ImageTextEditorProps;
  IconList: IconListEditorProps;
}

export type FoundationComponentType = keyof FoundationCatalogEditorComponents;

export const ICON_OPTIONS = [
  { label: '번개', value: 'bolt' },
  { label: '확인', value: 'check' },
  { label: '코드', value: 'code' },
  { label: '글로브', value: 'globe' },
  { label: '하트', value: 'heart' },
  { label: '레이어', value: 'layers' },
  { label: '모바일', value: 'mobile' },
  { label: '팔레트', value: 'palette' },
  { label: '보호', value: 'shield' },
  { label: '반짝임', value: 'sparkles' },
  { label: '별', value: 'star' },
];

export const DEFAULT_HEADING: HeadingEditorProps = {
  eyebrow: '섹션 안내', heading: '이 섹션의 핵심을 한 문장으로', level: '2', anchor: '',
  surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_RICH_TEXT: RichTextEditorProps = {
  content: '<p>방문자가 이해해야 할 내용을 읽기 편한 문단으로 작성해 주세요.</p><p><strong>중요한 문장</strong>은 굵게 강조하고 목록이나 링크를 활용할 수 있습니다.</p>',
  measure: 'standard', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_IMAGE: ImageEditorProps = {
  src: '', alt: '', caption: '이미지를 설명하는 캡션을 입력하세요.', linkUrl: '', aspectRatio: 'auto',
  surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_BUTTONS: ButtonsEditorProps = {
  items: [
    { label: '자세히 보기', url: '/', variant: 'primary' },
    { label: '문의하기', url: '/contact', variant: 'secondary' },
  ],
  alignment: 'left', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_IMAGE_TEXT: ImageTextEditorProps = {
  eyebrow: '핵심 소개', heading: '이미지와 설명을 함께 전달하세요',
  body: '<p>제품, 서비스, 공간처럼 시각 자료와 설명을 함께 봐야 이해가 빠른 내용을 구성합니다.</p>',
  imageSrc: '', imageAlt: '', mediaPosition: 'left', primaryLabel: '자세히 보기', primaryUrl: '/',
  surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_ICON_LIST: IconListEditorProps = {
  eyebrow: '핵심 포인트', heading: '빠르게 훑어보는 주요 내용',
  items: [
    { icon: 'check', title: '분명한 정보', body: '한 항목에는 하나의 핵심만 담아 이해를 돕습니다.' },
    { icon: 'bolt', title: '빠른 탐색', body: '짧은 제목과 설명으로 필요한 내용을 바로 찾습니다.' },
    { icon: 'shield', title: '일관된 품질', body: '검증된 구조와 디자인 토큰으로 페이지 흐름을 지킵니다.' },
  ],
  layout: 'two-column', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>) => T): T[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, max).map((item) => map(asRecord(item)));
}

export function normalizeButtons(value: unknown): ButtonItem[] {
  return normalizeArray(value, DEFAULT_BUTTONS.items, 3, (item) => ({
    label: asString(item.label),
    url: asString(item.url),
    variant: item.variant === 'secondary' || item.variant === 'text' ? item.variant : 'primary',
  }));
}

export function normalizeIconItems(value: unknown): IconListItem[] {
  return normalizeArray(value, DEFAULT_ICON_LIST.items, 8, (item) => {
    const icon = asString(item.icon);
    return {
      icon: ICON_OPTIONS.some((option) => option.value === icon) ? icon : 'check',
      title: asString(item.title),
      body: asString(item.body),
    };
  });
}

export function normalizeAnchor(value: unknown): string {
  const normalized = asString(value).trim().toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!normalized) return '';
  const anchored = /^[a-z]/.test(normalized) ? normalized : `section-${normalized}`;
  return anchored.slice(0, 80).replace(/-+$/g, '');
}
