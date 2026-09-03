import type { ArticleListItem, ComparisonColumnItem, ComparisonRowItem, FaqItem, ProcessStepItem, TabItem, TestimonialItem } from '../documents/types';
import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';

export interface TestimonialsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: TestimonialItem[];
  layout: 'grid' | 'spotlight' | 'split' | 'wall' | 'quote-hero';
}

export interface FaqAccordionEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: FaqItem[];
  behavior: 'single' | 'multiple';
  openFirst: boolean;
}

export interface ProcessTimelineEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: ProcessStepItem[];
  layout: 'vertical' | 'horizontal';
}

export interface TabsEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: TabItem[];
  initialTab: '0' | '1' | '2' | '3' | '4' | '5';
  tabVariant: 'underline' | 'pills';
}

interface ComparisonRowEditor extends Omit<ComparisonRowItem, 'values'> {
  valuesText: string;
}

export interface ComparisonTableEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  columns: ComparisonColumnItem[];
  rows: ComparisonRowEditor[];
  highlightColumn: 'none' | '0' | '1' | '2' | '3';
}

export interface ArticleListEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: ArticleListItem[];
  layout: 'list' | 'grid' | 'featured' | 'magazine' | 'editorial';
}

export interface VideoEmbedEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  caption: string;
  provider: 'youtube' | 'vimeo';
  videoId: string;
  ratio: '16:9' | '4:3' | '1:1';
}

export interface Phase2CatalogEditorComponents {
  Testimonials: TestimonialsEditorProps;
  FaqAccordion: FaqAccordionEditorProps;
  ProcessTimeline: ProcessTimelineEditorProps;
  Tabs: TabsEditorProps;
  ComparisonTable: ComparisonTableEditorProps;
  ArticleList: ArticleListEditorProps;
  VideoEmbed: VideoEmbedEditorProps;
}

export type Phase2ComponentType = keyof Phase2CatalogEditorComponents;

export const DEFAULT_TESTIMONIALS: TestimonialsEditorProps = {
  eyebrow: '고객 이야기',
  heading: '직접 경험한 변화',
  items: [
    { quote: '복잡했던 페이지 운영이 훨씬 단순해졌습니다.', name: '김민서', role: '브랜드 매니저', company: '오르빗', avatarSrc: '', avatarAlt: '', rating: 5 },
    { quote: '필요한 내용을 바로 고치고 발행할 수 있어요.', name: '이도윤', role: '운영 리드', company: '노스스타', avatarSrc: '', avatarAlt: '', rating: 5 },
    { quote: '사이트의 일관성을 지키면서 제작 속도가 빨라졌습니다.', name: '박서연', role: '디자이너', company: '버텍스', avatarSrc: '', avatarAlt: '', rating: 4 },
  ],
  layout: 'wall', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_FAQ: FaqAccordionEditorProps = {
  eyebrow: '자주 묻는 질문', heading: '궁금한 점을 빠르게 확인하세요',
  items: [
    { question: '페이지는 몇 개까지 만들 수 있나요?', answer: '운영 정책에 맞춰 필요한 만큼 문서를 만들고 발행할 수 있습니다.' },
    { question: '모바일에서도 잘 보이나요?', answer: 'PC, 태블릿, 모바일 미리보기와 반응형 출력을 지원합니다.' },
    { question: '기존 G7 페이지와 함께 쓸 수 있나요?', answer: '기본 페이지 관리를 대체하지 않고 독립 모듈 경로로 함께 운영합니다.' },
  ],
  behavior: 'single', openFirst: true, surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_PROCESS: ProcessTimelineEditorProps = {
  eyebrow: '진행 방법', heading: '네 단계로 완성합니다',
  items: [
    { title: '요구 확인', body: '목표와 필요한 콘텐츠를 정리합니다.', linkLabel: '', linkUrl: '' },
    { title: '구성 선택', body: '목적에 맞는 블록과 순서를 선택합니다.', linkLabel: '', linkUrl: '' },
    { title: '내용 편집', body: '화면에서 텍스트와 이미지를 직접 다듬습니다.', linkLabel: '', linkUrl: '' },
    { title: '검토와 발행', body: '기기별 화면을 확인한 뒤 공개합니다.', linkLabel: '자세히 보기', linkUrl: '/' },
  ],
  layout: 'horizontal', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_TABS: TabsEditorProps = {
  eyebrow: '서비스 안내', heading: '필요한 정보를 나눠 확인하세요',
  items: [
    { label: '기획', heading: '목표가 분명한 페이지 구성', body: '방문자가 해야 할 행동을 중심으로 콘텐츠 흐름을 설계합니다.' },
    { label: '제작', heading: '블록으로 빠르게 만드는 화면', body: '검증된 블록을 배치하고 화면에서 내용을 편집합니다.' },
    { label: '운영', heading: '안전한 저장과 발행', body: '초안과 발행본을 분리하고 마지막 정상 발행본을 유지합니다.' },
  ],
  initialTab: '0', tabVariant: 'underline', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_COMPARISON: ComparisonTableEditorProps = {
  eyebrow: '비교하기', heading: '상황에 맞는 구성을 선택하세요',
  columns: [
    { title: '기본', description: '간단한 안내 페이지' },
    { title: '성장', description: '콘텐츠 운영이 필요한 팀' },
    { title: '비즈니스', description: '확장과 연동이 필요한 조직' },
  ],
  rows: [
    { feature: '페이지 수', valuesText: '3개\n무제한\n무제한' },
    { feature: '콘텐츠 블록', valuesText: '기본\n전체\n전체' },
    { feature: 'G7 데이터 연결', valuesText: '—\n지원\n지원' },
    { feature: '운영 지원', valuesText: '문서\n이메일\n맞춤' },
  ],
  highlightColumn: '1', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_ARTICLES: ArticleListEditorProps = {
  eyebrow: '인사이트', heading: '새로운 소식과 이야기',
  items: [
    { category: '제품', title: '더 빠른 페이지 운영을 위한 시작', summary: '콘텐츠를 구성하고 발행하는 기본 흐름을 소개합니다.', date: '2026-08-21', imageSrc: '', imageAlt: '', url: '/' },
    { category: '가이드', title: '좋은 랜딩 페이지가 답하는 세 가지', summary: '방문자의 질문과 행동을 중심으로 구조를 점검합니다.', date: '2026-08-18', imageSrc: '', imageAlt: '', url: '/' },
    { category: '업데이트', title: '새로 추가된 콘텐츠 블록', summary: '비교, FAQ, 후기 등 실무에서 자주 쓰는 구성을 확인하세요.', date: '2026-08-15', imageSrc: '', imageAlt: '', url: '/' },
    { category: '인터뷰', title: '현장에서 발견한 운영의 기준', summary: '꾸준히 관리되는 페이지가 갖춘 공통점을 정리합니다.', date: '2026-08-12', imageSrc: '', imageAlt: '', url: '/' },
  ],
  layout: 'magazine', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export const DEFAULT_VIDEO: VideoEmbedEditorProps = {
  eyebrow: '영상으로 보기', heading: '제품을 2분 안에 살펴보세요', caption: '재생 전에도 영상의 목적을 알 수 있도록 설명을 입력하세요.',
  provider: 'youtube', videoId: 'M7lc1UVf-VE', ratio: '16:9', surface: 'contrast', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function testimonialsLayout(value: unknown): TestimonialsEditorProps['layout'] {
  return value === 'spotlight' || value === 'split' || value === 'wall' || value === 'quote-hero' ? value : 'grid';
}

export function articleLayout(value: unknown): ArticleListEditorProps['layout'] {
  return value === 'grid' || value === 'featured' || value === 'magazine' || value === 'editorial' ? value : 'list';
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>, index: number) => T): T[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, max).map((item, index) => map(asRecord(item), index));
}

export function normalizeTestimonials(value: unknown): TestimonialItem[] {
  return normalizeArray(value, DEFAULT_TESTIMONIALS.items, 8, (item) => ({
    quote: asString(item.quote), name: asString(item.name), role: asString(item.role), company: asString(item.company),
    avatarSrc: asString(item.avatarSrc), avatarAlt: asString(item.avatarAlt),
    rating: ([1, 2, 3, 4, 5].includes(Number(item.rating)) ? Number(item.rating) : 5) as TestimonialItem['rating'],
  }));
}

export function normalizeFaq(value: unknown): FaqItem[] {
  return normalizeArray(value, DEFAULT_FAQ.items, 12, (item) => ({ question: asString(item.question), answer: asString(item.answer) }));
}

export function normalizeProcess(value: unknown): ProcessStepItem[] {
  return normalizeArray(value, DEFAULT_PROCESS.items, 8, (item) => ({ title: asString(item.title), body: asString(item.body), linkLabel: asString(item.linkLabel), linkUrl: asString(item.linkUrl) }));
}

export function normalizeTabs(value: unknown): TabItem[] {
  return normalizeArray(value, DEFAULT_TABS.items, 6, (item) => ({ label: asString(item.label), heading: asString(item.heading), body: asString(item.body) }));
}

export function normalizeColumns(value: unknown): ComparisonColumnItem[] {
  return normalizeArray(value, DEFAULT_COMPARISON.columns, 4, (item) => ({ title: asString(item.title), description: asString(item.description) }));
}

export function normalizeComparisonRows(value: unknown): ComparisonRowEditor[] {
  return normalizeArray(value, DEFAULT_COMPARISON.rows, 12, (item) => ({
    feature: asString(item.feature),
    valuesText: Array.isArray(item.values) ? item.values.filter((entry): entry is string => typeof entry === 'string').join('\n') : asString(item.valuesText),
  }));
}

export function normalizeArticles(value: unknown): ArticleListItem[] {
  return normalizeArray(value, DEFAULT_ARTICLES.items, 8, (item) => ({
    category: asString(item.category), title: asString(item.title), summary: asString(item.summary), date: asString(item.date),
    imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt), url: asString(item.url),
  }));
}
