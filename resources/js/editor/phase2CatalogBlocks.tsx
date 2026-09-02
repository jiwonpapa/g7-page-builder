import React, { useState } from 'react';
import type { Config, Field } from '@puckeditor/core';
import { CatalogBlockFrame as Frame } from './CatalogBlockFrame';

import {
  createMotionField,
  DEFAULT_BLOCK_MOTION,
  normalizeBlockMotion,
} from './blockMotion';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import { normalizeElementAppearanceMap } from './canvasEditingContract';
import {
  ARTICLE_LIST_BLOCK_TYPE,
  COMPARISON_TABLE_BLOCK_TYPE,
  FAQ_ACCORDION_BLOCK_TYPE,
  PROCESS_TIMELINE_BLOCK_TYPE,
  TABS_BLOCK_TYPE,
  TESTIMONIALS_BLOCK_TYPE,
  VIDEO_EMBED_BLOCK_TYPE,
  type ArticleListItem,
  type BlockAppearance,
  type BlockMotion,
  type ElementAppearanceMap,
  type ComparisonColumnItem,
  type ComparisonRowItem,
  type FaqItem,
  type PageBuilderBlock,
  type ProcessStepItem,
  type TabItem,
  type TestimonialItem,
} from '../documents/types';

interface AppearanceEditorProps {
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

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

const SURFACE_OPTIONS = [
  { label: '기본', value: 'default' },
  { label: '부드럽게', value: 'soft' },
  { label: '강조', value: 'contrast' },
];

const SPACING_OPTIONS = [
  { label: '좁게', value: 'compact' },
  { label: '기본', value: 'normal' },
  { label: '넓게', value: 'spacious' },
];

const DEFAULT_TESTIMONIALS: TestimonialsEditorProps = {
  eyebrow: '고객 이야기',
  heading: '직접 경험한 변화',
  items: [
    { quote: '복잡했던 페이지 운영이 훨씬 단순해졌습니다.', name: '김민서', role: '브랜드 매니저', company: '오르빗', avatarSrc: '', avatarAlt: '', rating: 5 },
    { quote: '필요한 내용을 바로 고치고 발행할 수 있어요.', name: '이도윤', role: '운영 리드', company: '노스스타', avatarSrc: '', avatarAlt: '', rating: 5 },
    { quote: '사이트의 일관성을 지키면서 제작 속도가 빨라졌습니다.', name: '박서연', role: '디자이너', company: '버텍스', avatarSrc: '', avatarAlt: '', rating: 4 },
  ],
  layout: 'wall', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_FAQ: FaqAccordionEditorProps = {
  eyebrow: '자주 묻는 질문', heading: '궁금한 점을 빠르게 확인하세요',
  items: [
    { question: '페이지는 몇 개까지 만들 수 있나요?', answer: '운영 정책에 맞춰 필요한 만큼 문서를 만들고 발행할 수 있습니다.' },
    { question: '모바일에서도 잘 보이나요?', answer: 'PC, 태블릿, 모바일 미리보기와 반응형 출력을 지원합니다.' },
    { question: '기존 G7 페이지와 함께 쓸 수 있나요?', answer: '기본 페이지 관리를 대체하지 않고 독립 모듈 경로로 함께 운영합니다.' },
  ],
  behavior: 'single', openFirst: true, surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_PROCESS: ProcessTimelineEditorProps = {
  eyebrow: '진행 방법', heading: '네 단계로 완성합니다',
  items: [
    { title: '요구 확인', body: '목표와 필요한 콘텐츠를 정리합니다.', linkLabel: '', linkUrl: '' },
    { title: '구성 선택', body: '목적에 맞는 블록과 순서를 선택합니다.', linkLabel: '', linkUrl: '' },
    { title: '내용 편집', body: '화면에서 텍스트와 이미지를 직접 다듬습니다.', linkLabel: '', linkUrl: '' },
    { title: '검토와 발행', body: '기기별 화면을 확인한 뒤 공개합니다.', linkLabel: '자세히 보기', linkUrl: '/' },
  ],
  layout: 'horizontal', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_TABS: TabsEditorProps = {
  eyebrow: '서비스 안내', heading: '필요한 정보를 나눠 확인하세요',
  items: [
    { label: '기획', heading: '목표가 분명한 페이지 구성', body: '방문자가 해야 할 행동을 중심으로 콘텐츠 흐름을 설계합니다.' },
    { label: '제작', heading: '블록으로 빠르게 만드는 화면', body: '검증된 블록을 배치하고 화면에서 내용을 편집합니다.' },
    { label: '운영', heading: '안전한 저장과 발행', body: '초안과 발행본을 분리하고 마지막 정상 발행본을 유지합니다.' },
  ],
  initialTab: '0', tabVariant: 'underline', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_COMPARISON: ComparisonTableEditorProps = {
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

const DEFAULT_ARTICLES: ArticleListEditorProps = {
  eyebrow: '인사이트', heading: '새로운 소식과 이야기',
  items: [
    { category: '제품', title: '더 빠른 페이지 운영을 위한 시작', summary: '콘텐츠를 구성하고 발행하는 기본 흐름을 소개합니다.', date: '2026-08-21', imageSrc: '', imageAlt: '', url: '/' },
    { category: '가이드', title: '좋은 랜딩 페이지가 답하는 세 가지', summary: '방문자의 질문과 행동을 중심으로 구조를 점검합니다.', date: '2026-08-18', imageSrc: '', imageAlt: '', url: '/' },
    { category: '업데이트', title: '새로 추가된 콘텐츠 블록', summary: '비교, FAQ, 후기 등 실무에서 자주 쓰는 구성을 확인하세요.', date: '2026-08-15', imageSrc: '', imageAlt: '', url: '/' },
    { category: '인터뷰', title: '현장에서 발견한 운영의 기준', summary: '꾸준히 관리되는 페이지가 갖춘 공통점을 정리합니다.', date: '2026-08-12', imageSrc: '', imageAlt: '', url: '/' },
  ],
  layout: 'magazine', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

const DEFAULT_VIDEO: VideoEmbedEditorProps = {
  eyebrow: '영상으로 보기', heading: '제품을 2분 안에 살펴보세요', caption: '재생 전에도 영상의 목적을 알 수 있도록 설명을 입력하세요.',
  provider: 'youtube', videoId: 'M7lc1UVf-VE', ratio: '16:9', surface: 'contrast', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function testimonialsLayout(value: unknown): TestimonialsEditorProps['layout'] {
  return value === 'spotlight' || value === 'split' || value === 'wall' || value === 'quote-hero' ? value : 'grid';
}

function articleLayout(value: unknown): ArticleListEditorProps['layout'] {
  return value === 'grid' || value === 'featured' || value === 'magazine' || value === 'editorial' ? value : 'list';
}

function createDateField(label: string): Field<string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange, readOnly }) => (
      <input
        className="g7pb-field-control"
        type="date"
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.currentTarget.value)}
        disabled={readOnly}
        aria-label={label}
        data-testid="page-builder-article-date"
      />
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>, index: number) => T): T[] {
  const source = Array.isArray(value) ? value : fallback;
  return source.slice(0, max).map((item, index) => map(asRecord(item), index));
}

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback;
}

function inlineArrayText(value: unknown, index: number, key: string, fallback = ''): string {
  const item = Array.isArray(value) ? asRecord(value[index]) : {};
  const candidate = item[key];
  if (React.isValidElement(candidate)) {
    const elementValue = (candidate.props as { value?: unknown }).value;
    return typeof elementValue === 'string' ? elementValue : fallback;
  }
  return asString(candidate, fallback);
}

function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } {
  const record = asRecord(value);
  const resolved: BlockAppearance = {
    surface: record.surface === 'soft' || record.surface === 'contrast' ? record.surface : fallback.surface,
    spacing: record.spacing === 'compact' || record.spacing === 'spacious' ? record.spacing : fallback.spacing,
  };
  if (record.textScale === 'compact' || record.textScale === 'large') resolved.textScale = record.textScale;
  if (record.textAlign === 'center' || record.textAlign === 'right') resolved.textAlign = record.textAlign;
  const elements = normalizeElementAppearanceMap(record.elementStyles ?? record.elements);
  return Object.keys(elements).length > 0 ? { ...resolved, elementStyles: elements } : resolved;
}

function attachAppearance(props: Record<string, unknown>, raw: Record<string, unknown>, fallback: BlockAppearance, include: boolean): Record<string, unknown> {
  const next = { ...props };
  const editor = appearance({ surface: raw.surface, spacing: raw.spacing, textScale: raw.textScale, textAlign: raw.textAlign,
    elementStyles: raw.elementStyles }, fallback);
  const { elementStyles, ...resolved } = editor;
  const canonical: BlockAppearance = { ...resolved, ...(elementStyles && Object.keys(elementStyles).length > 0 ? { elements: elementStyles } : {}) };
  if (include || canonical.surface !== fallback.surface || canonical.spacing !== fallback.spacing || canonical.textScale || canonical.textAlign || canonical.elements) next.appearance = canonical;
  return next;
}

function normalizeTestimonials(value: unknown): TestimonialItem[] {
  return normalizeArray(value, DEFAULT_TESTIMONIALS.items, 8, (item) => ({
    quote: asString(item.quote), name: asString(item.name), role: asString(item.role), company: asString(item.company),
    avatarSrc: asString(item.avatarSrc), avatarAlt: asString(item.avatarAlt),
    rating: ([1, 2, 3, 4, 5].includes(Number(item.rating)) ? Number(item.rating) : 5) as TestimonialItem['rating'],
  }));
}

function normalizeFaq(value: unknown): FaqItem[] {
  return normalizeArray(value, DEFAULT_FAQ.items, 12, (item) => ({ question: asString(item.question), answer: asString(item.answer) }));
}

function normalizeProcess(value: unknown): ProcessStepItem[] {
  return normalizeArray(value, DEFAULT_PROCESS.items, 8, (item) => ({ title: asString(item.title), body: asString(item.body), linkLabel: asString(item.linkLabel), linkUrl: asString(item.linkUrl) }));
}

function normalizeTabs(value: unknown): TabItem[] {
  return normalizeArray(value, DEFAULT_TABS.items, 6, (item) => ({ label: asString(item.label), heading: asString(item.heading), body: asString(item.body) }));
}

function normalizeColumns(value: unknown): ComparisonColumnItem[] {
  return normalizeArray(value, DEFAULT_COMPARISON.columns, 4, (item) => ({ title: asString(item.title), description: asString(item.description) }));
}

function normalizeComparisonRows(value: unknown): ComparisonRowEditor[] {
  return normalizeArray(value, DEFAULT_COMPARISON.rows, 12, (item) => ({
    feature: asString(item.feature),
    valuesText: Array.isArray(item.values) ? item.values.filter((entry): entry is string => typeof entry === 'string').join('\n') : asString(item.valuesText),
  }));
}

function normalizeArticles(value: unknown): ArticleListItem[] {
  return normalizeArray(value, DEFAULT_ARTICLES.items, 8, (item) => ({
    category: asString(item.category), title: asString(item.title), summary: asString(item.summary), date: asString(item.date),
    imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt), url: asString(item.url),
  }));
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

function surfaceClass(props: AppearanceEditorProps): string {
  return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`;
}


function TestimonialsPreview(props: TestimonialsEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="testimonials" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-testimonials g7pb-preview-testimonials--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeTestimonials(props.items).map((item, index) => <blockquote key={`${item.name}-${index}`}><span aria-label={`${item.rating}점`}>{'★'.repeat(item.rating)}</span><RichTextCanvasField fieldPath={`items.${index}.quote`} className="g7pb-preview-richtext g7pb-preview-testimonial-quote">{inlineArrayContent(props.items, index, 'quote', item.quote)}</RichTextCanvasField><footer>{safeUrl(item.avatarSrc) ? <img data-g7pb-media-field={`items.${index}.avatarSrc`} src={item.avatarSrc} alt={item.avatarAlt} /> : <i data-g7pb-media-field={`items.${index}.avatarSrc`} aria-hidden="true">{inlineArrayText(props.items, index, 'name', item.name).slice(0, 1)}</i>}<cite><strong data-g7pb-inline-field={`items.${index}.name`}>{inlineArrayContent(props.items, index, 'name', item.name)}</strong><small><span data-g7pb-inline-field={`items.${index}.role`}>{inlineArrayContent(props.items, index, 'role', item.role)}</span> · <span data-g7pb-inline-field={`items.${index}.company`}>{inlineArrayContent(props.items, index, 'company', item.company)}</span></small></cite></footer></blockquote>)}</div></div></Frame>;
}

function FaqPreview(props: FaqAccordionEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="faq-accordion" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-faq ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeFaq(props.items).map((item, index) => <details key={`${item.question}-${index}`} open={props.openFirst && index === 0} onToggle={(event) => event.preventDefault()}><summary><RichTextCanvasField as="span" className="g7pb-preview-richtext" fieldPath={`items.${index}.question`}>{inlineArrayContent(props.items, index, 'question', item.question)}</RichTextCanvasField><i aria-hidden="true">+</i></summary><RichTextCanvasField fieldPath={`items.${index}.answer`}>{inlineArrayContent(props.items, index, 'answer', item.answer)}</RichTextCanvasField></details>)}</div></div></Frame>;
}

function ProcessPreview(props: ProcessTimelineEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="process-timeline" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-process g7pb-preview-process--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><ol>{normalizeProcess(props.items).map((item, index) => <li key={`${item.title}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.body`}>{inlineArrayContent(props.items, index, 'body', item.body)}</RichTextCanvasField>{inlineArrayText(props.items, index, 'linkLabel', item.linkLabel) ? <span data-g7pb-inline-field={`items.${index}.linkLabel`}>{inlineArrayContent(props.items, index, 'linkLabel', item.linkLabel)} →</span> : null}</li>)}</ol></div></Frame>;
}

function TabsPreview(props: TabsEditorProps & { id: string }): React.ReactElement {
  const items = normalizeTabs(props.items);
  const configured = Math.min(Number(props.initialTab), Math.max(items.length - 1, 0));
  const [selected, setSelected] = useState(configured);
  const active = Math.min(selected, Math.max(items.length - 1, 0));
  return <Frame id={props.id} type="tabs" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-tabs g7pb-preview-tabs--${props.tabVariant} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className="g7pb-preview-tabs__list" role="tablist" data-puck-overlay-portal="true" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>{items.map((item, index) => <button type="button" role="tab" aria-selected={active === index} key={`${item.label}-${index}`} onClick={() => setSelected(index)}><span data-g7pb-inline-field={`items.${index}.label`}>{inlineArrayContent(props.items, index, 'label', item.label)}</span></button>)}</div>{items.map((item, index) => <article role="tabpanel" hidden={active !== index} key={`${item.heading}-${index}`}><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.heading`}>{inlineArrayContent(props.items, index, 'heading', item.heading)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.body`}>{inlineArrayContent(props.items, index, 'body', item.body)}</RichTextCanvasField></article>)}</div></Frame>;
}

function ComparisonPreview(props: ComparisonTableEditorProps & { id: string }): React.ReactElement {
  const columns = normalizeColumns(props.columns);
  const rows = normalizeComparisonRows(props.rows);
  return <Frame id={props.id} type="comparison-table" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-comparison ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className="g7pb-preview-comparison__scroll"><table><thead><tr><th>항목</th>{columns.map((column, index) => <th className={props.highlightColumn === String(index) ? 'is-highlighted' : ''} key={`${column.title}-${index}`}><RichTextCanvasField as="strong" className="g7pb-preview-richtext" fieldPath={`columns.${index}.title`}>{inlineArrayContent(props.columns, index, 'title', column.title)}</RichTextCanvasField><RichTextCanvasField as="span" className="g7pb-preview-richtext" fieldPath={`columns.${index}.description`}>{inlineArrayContent(props.columns, index, 'description', column.description)}</RichTextCanvasField></th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => { const values = row.valuesText.split('\n'); return <tr key={`${row.feature}-${rowIndex}`}><th><RichTextCanvasField as="span" className="g7pb-preview-richtext" fieldPath={`rows.${rowIndex}.feature`}>{inlineArrayContent(props.rows, rowIndex, 'feature', row.feature)}</RichTextCanvasField></th>{columns.map((_, columnIndex) => <td className={props.highlightColumn === String(columnIndex) ? 'is-highlighted' : ''} key={columnIndex}>{values[columnIndex] ?? '—'}</td>)}</tr>; })}</tbody></table></div></div></Frame>;
}

function ArticleListPreview(props: ArticleListEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="article-list" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-articles g7pb-preview-articles--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{normalizeArticles(props.items).map((item, index) => <article key={`${item.title}-${index}`}>{safeUrl(item.imageSrc) ? <img data-g7pb-media-field={`items.${index}.imageSrc`} src={item.imageSrc} alt={item.imageAlt} /> : <i data-g7pb-media-field={`items.${index}.imageSrc`} aria-label="대표 이미지 자리">{String(index + 1).padStart(2, '0')}</i>}<div><small><span data-g7pb-inline-field={`items.${index}.category`}>{inlineArrayContent(props.items, index, 'category', item.category)}</span> · <time data-g7pb-inline-field={`items.${index}.date`}>{inlineArrayContent(props.items, index, 'date', item.date)}</time></small><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.summary`}>{inlineArrayContent(props.items, index, 'summary', item.summary)}</RichTextCanvasField><b data-g7pb-action-field={`items.${index}.title`}>읽어보기 →</b></div></article>)}</div></div></Frame>;
}

function VideoPreview(props: VideoEmbedEditorProps & { id: string }): React.ReactElement {
  const captionValue = React.isValidElement(props.caption)
    ? (props.caption.props as { value?: unknown }).value : props.caption;
  const hasCaption = typeof captionValue === 'string' && captionValue.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
  return <Frame id={props.id} type="video-embed" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-video ${surfaceClass(props)}`}>
      <header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header>
      <figure>
        <div className="g7pb-preview-video__frame" data-ratio={props.ratio}><span aria-hidden="true">▶</span><strong>{props.provider === 'youtube' ? 'YouTube' : 'Vimeo'} 영상</strong><small>{props.videoId || '영상 ID를 입력하세요'}</small></div>
        {hasCaption ? <figcaption><RichTextCanvasField as="span" className="g7pb-preview-richtext g7pb-preview-video__caption" fieldPath="caption">{props.caption}</RichTextCanvasField></figcaption> : null}
      </figure>
    </div>
  </Frame>;
}

const appearanceFields = {
  surface: { type: 'select' as const, label: '배경 프리셋', options: SURFACE_OPTIONS },
  spacing: { type: 'select' as const, label: '세로 여백', options: SPACING_OPTIONS },
  elementStyles: { type: 'custom' as const, label: '캔버스 요소 스타일', render: () => <></> },
};

export const phase2CatalogComponentConfigs: Config<Phase2CatalogEditorComponents>['components'] = {
  Testimonials: {
    label: '고객 후기', defaultProps: DEFAULT_TESTIMONIALS,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), layout: { type: 'select', label: '레이아웃', options: [{ label: '후기 월', value: 'wall' }, { label: '균등 그리드', value: 'grid' }, { label: '한 줄 집중', value: 'spotlight' }, { label: '제목 분할', value: 'split' }, { label: '대형 인용', value: 'quote-hero' }] }, items: { type: 'array', label: '후기', min: 2, max: 8, defaultItemProps: (index) => ({ quote: '고객 경험을 입력하세요.', name: `고객 ${index + 1}`, role: '담당자', company: '회사명', avatarSrc: '', avatarAlt: '', rating: 5 }), getItemSummary: (item) => `${item.name} · ${item.company}`, arrayFields: { quote: createRichTextField('후기', 120), name: { type: 'text', label: '이름', contentEditable: true }, role: { type: 'text', label: '역할', contentEditable: true }, company: { type: 'text', label: '회사', contentEditable: true }, avatarSrc: createMediaField('프로필 이미지'), avatarAlt: { type: 'text', label: '대체 텍스트' }, rating: { type: 'select', label: '평점', options: [1, 2, 3, 4, 5].map((value) => ({ label: `${value}점`, value })) } } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
    render: (props) => <TestimonialsPreview {...props} />,
  },
  FaqAccordion: {
    label: 'FAQ 아코디언', defaultProps: DEFAULT_FAQ,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), behavior: { type: 'radio', label: '열림 방식', options: [{ label: '하나만', value: 'single' }, { label: '여러 개', value: 'multiple' }] }, openFirst: { type: 'radio', label: '첫 항목', options: [{ label: '열기', value: true }, { label: '닫기', value: false }] }, items: { type: 'array', label: '질문과 답변', min: 2, max: 12, defaultItemProps: (index) => ({ question: `질문 ${index + 1}`, answer: '답변을 입력하세요.' }), getItemSummary: (item) => item.question, arrayFields: { question: createInlineRichTextField('질문'), answer: createRichTextField('답변', 140) } }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <FaqPreview {...props} />,
  },
  ProcessTimeline: {
    label: '프로세스·타임라인', defaultProps: DEFAULT_PROCESS,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), layout: { type: 'radio', label: '배치', options: [{ label: '가로', value: 'horizontal' }, { label: '세로', value: 'vertical' }] }, items: { type: 'array', label: '단계', min: 2, max: 8, defaultItemProps: (index) => ({ title: `${index + 1}단계`, body: '단계 설명을 입력하세요.', linkLabel: '', linkUrl: '' }), getItemSummary: (item) => item.title, arrayFields: { title: createInlineRichTextField('제목'), body: createRichTextField('설명', 130), linkLabel: { type: 'text', label: '링크 문구', contentEditable: true }, linkUrl: createRouteUrlField('링크 연결') } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
    render: (props) => <ProcessPreview {...props} />,
  },
  Tabs: {
    label: '탭 콘텐츠', defaultProps: DEFAULT_TABS,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), tabVariant: { type: 'radio', label: '탭 모양', options: [{ label: '밑줄', value: 'underline' }, { label: '버튼', value: 'pills' }] }, initialTab: { type: 'select', label: '처음 보일 탭', options: [0, 1, 2, 3, 4, 5].map((value) => ({ label: `${value + 1}번 탭`, value: String(value) })) }, items: { type: 'array', label: '탭', min: 2, max: 6, defaultItemProps: (index) => ({ label: `탭 ${index + 1}`, heading: '탭 제목', body: '탭 내용을 입력하세요.' }), getItemSummary: (item) => item.label, arrayFields: { label: { type: 'text', label: '탭 이름', contentEditable: true }, heading: createInlineRichTextField('내용 제목'), body: createRichTextField('내용', 150) } }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <TabsPreview {...props} />,
  },
  ComparisonTable: {
    label: '비교표', defaultProps: DEFAULT_COMPARISON,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), highlightColumn: { type: 'select', label: '강조 열', options: [{ label: '강조 없음', value: 'none' }, ...[0, 1, 2, 3].map((value) => ({ label: `${value + 1}번 열`, value: String(value) }))] }, columns: { type: 'array', label: '비교 대상', min: 2, max: 4, defaultItemProps: (index) => ({ title: `선택 ${index + 1}`, description: '간단한 설명' }), getItemSummary: (item) => item.title, arrayFields: { title: createInlineRichTextField('이름'), description: createInlineRichTextField('설명') } }, rows: { type: 'array', label: '비교 항목', min: 1, max: 12, defaultItemProps: (index) => ({ feature: `항목 ${index + 1}`, valuesText: '지원\n지원' }), getItemSummary: (item) => item.feature, arrayFields: { feature: createInlineRichTextField('항목'), valuesText: { type: 'textarea', label: '열별 값(한 줄에 하나)' } } }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <ComparisonPreview {...props} />,
  },
  ArticleList: {
    label: '에디토리얼 목록', defaultProps: DEFAULT_ARTICLES,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), layout: { type: 'select', label: '레이아웃', options: [{ label: '매거진 2열', value: 'magazine' }, { label: '대표 기사', value: 'featured' }, { label: '에디토리얼', value: 'editorial' }, { label: '목록', value: 'list' }, { label: '그리드', value: 'grid' }] }, items: { type: 'array', label: '콘텐츠', min: 2, max: 8, defaultItemProps: (index) => ({ category: '소식', title: `콘텐츠 ${index + 1}`, summary: '콘텐츠 설명을 입력하세요.', date: '', imageSrc: '', imageAlt: '', url: '/' }), getItemSummary: (item) => item.title, arrayFields: { category: { type: 'text', label: '분류', contentEditable: true }, title: createInlineRichTextField('제목', { allowLink: false }), summary: createRichTextField('요약', 130), date: createDateField('날짜'), imageSrc: createMediaField('대표 이미지'), imageAlt: { type: 'text', label: '대체 텍스트' }, url: createRouteUrlField('콘텐츠 연결') } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) },
    render: (props) => <ArticleListPreview {...props} />,
  },
  VideoEmbed: {
    label: '영상', defaultProps: DEFAULT_VIDEO,
    fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), caption: createRichTextField('영상 설명', 130), provider: { type: 'radio', label: '영상 서비스', options: [{ label: 'YouTube', value: 'youtube' }, { label: 'Vimeo', value: 'vimeo' }] }, videoId: { type: 'text', label: '영상 ID' }, ratio: { type: 'select', label: '화면 비율', options: [{ label: '16:9', value: '16:9' }, { label: '4:3', value: '4:3' }, { label: '1:1', value: '1:1' }] }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) },
    render: (props) => <VideoPreview {...props} />,
  },
};

export function canonicalPhase2BlockToPuck(block: PageBuilderBlock): { type: Phase2ComponentType; props: Phase2CatalogEditorComponents[Phase2ComponentType] } | null {
  const props = block.props;
  const common = (fallback: BlockAppearance): AppearanceEditorProps => ({ ...appearance(props.appearance, fallback), motion: normalizeBlockMotion(block.motion) });
  if (block.type === TESTIMONIALS_BLOCK_TYPE) return { type: 'Testimonials', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeTestimonials(props.items), layout: testimonialsLayout(props.layout), ...common({ surface: 'soft', spacing: 'normal' }) } };
  if (block.type === FAQ_ACCORDION_BLOCK_TYPE) return { type: 'FaqAccordion', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeFaq(props.items), behavior: props.behavior === 'multiple' ? 'multiple' : 'single', openFirst: props.openFirst !== false, ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === PROCESS_TIMELINE_BLOCK_TYPE) return { type: 'ProcessTimeline', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeProcess(props.items), layout: props.layout === 'vertical' ? 'vertical' : 'horizontal', ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === TABS_BLOCK_TYPE) return { type: 'Tabs', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeTabs(props.items), initialTab: String(Math.min(5, Math.max(0, Number(props.initialTab) || 0))) as TabsEditorProps['initialTab'], tabVariant: props.style === 'pills' ? 'pills' : 'underline', ...common({ surface: 'soft', spacing: 'normal' }) } };
  if (block.type === COMPARISON_TABLE_BLOCK_TYPE) return { type: 'ComparisonTable', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), columns: normalizeColumns(props.columns), rows: normalizeComparisonRows(props.rows), highlightColumn: Number.isInteger(props.highlightColumn) && Number(props.highlightColumn) >= 0 ? String(Math.min(3, Number(props.highlightColumn))) as ComparisonTableEditorProps['highlightColumn'] : 'none', ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === ARTICLE_LIST_BLOCK_TYPE) return { type: 'ArticleList', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeArticles(props.items), layout: articleLayout(props.layout), ...common({ surface: 'default', spacing: 'normal' }) } };
  if (block.type === VIDEO_EMBED_BLOCK_TYPE) return { type: 'VideoEmbed', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), caption: asString(props.caption), provider: props.provider === 'vimeo' ? 'vimeo' : 'youtube', videoId: asString(props.videoId), ratio: props.ratio === '4:3' || props.ratio === '1:1' ? props.ratio : '16:9', ...common({ surface: 'contrast', spacing: 'normal' }) } };
  return null;
}

export function phase2PuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'Testimonials') return { type: TESTIMONIALS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeTestimonials(raw.items), layout: testimonialsLayout(raw.layout) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'FaqAccordion') return { type: FAQ_ACCORDION_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeFaq(raw.items), behavior: raw.behavior === 'multiple' ? 'multiple' : 'single', openFirst: raw.openFirst !== false }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'ProcessTimeline') return { type: PROCESS_TIMELINE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeProcess(raw.items), layout: raw.layout === 'vertical' ? 'vertical' : 'horizontal' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'Tabs') return { type: TABS_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeTabs(raw.items), initialTab: Math.max(0, Number(raw.initialTab) || 0), style: raw.tabVariant === 'pills' ? 'pills' : 'underline' }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'ComparisonTable') {
    const columns = normalizeColumns(raw.columns);
    const rows: ComparisonRowItem[] = normalizeComparisonRows(raw.rows).map((row) => ({ feature: row.feature, values: row.valuesText.split('\n').map((value) => value.trim()).slice(0, columns.length) }));
    return { type: COMPARISON_TABLE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), columns, rows, highlightColumn: raw.highlightColumn === 'none' ? -1 : Math.min(3, Math.max(0, Number(raw.highlightColumn) || 0)) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  }
  if (type === 'ArticleList') return { type: ARTICLE_LIST_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeArticles(raw.items), layout: articleLayout(raw.layout) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'VideoEmbed') return { type: VIDEO_EMBED_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), caption: asString(raw.caption), provider: raw.provider === 'vimeo' ? 'vimeo' : 'youtube', videoId: asString(raw.videoId), ratio: raw.ratio === '4:3' || raw.ratio === '1:1' ? raw.ratio : '16:9' }, raw, { surface: 'contrast', spacing: 'normal' }, includeAppearance) };
  return null;
}
