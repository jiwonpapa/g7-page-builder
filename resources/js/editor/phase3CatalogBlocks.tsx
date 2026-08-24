import React, { useMemo, useState } from 'react';
import type { Config } from '@puckeditor/core';

import { createMediaField } from './MediaPickerField';
import { createDownloadField } from './DownloadPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createRichTextField, RichTextCanvasField } from './richTextEditing';
import { decorateCanvasElementStyles, normalizeElementAppearanceMap, notifyCanvasElementSelection, useCanvasElementStyles } from './canvasEditingContract';
import { createMotionField, DEFAULT_BLOCK_MOTION, motionPreviewAttributes, normalizeBlockMotion } from './blockMotion';
import {
  DOWNLOAD_RESOURCES_BLOCK_TYPE,
  EVENT_SCHEDULE_BLOCK_TYPE,
  G7_BOARD_ARCHIVE_BLOCK_TYPE,
  G7_PRODUCT_SHOWCASE_BLOCK_TYPE,
  LOGO_CAROUSEL_BLOCK_TYPE,
  TESTIMONIAL_SLIDER_BLOCK_TYPE,
  type BlockAppearance,
  type BlockMotion,
  type ElementAppearanceMap,
  type DownloadResourceItem,
  type EventScheduleItem,
  type LogoItem,
  type PageBuilderBlock,
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

export interface LogoCarouselEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  logos: LogoItem[];
  autoplay: 'yes' | 'no';
  interval: '3000' | '5000' | '7000';
}

export interface TestimonialSliderEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: TestimonialItem[];
  autoplay: 'yes' | 'no';
  interval: '5000' | '7000' | '9000';
}

export interface EventScheduleEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: EventScheduleItem[];
  layout: 'agenda' | 'timeline';
}

export interface DownloadResourcesEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  items: DownloadResourceItem[];
}

export interface G7BoardArchiveEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'recent' | 'popular';
  period: 'today' | 'week' | 'month' | 'year';
  limit: '6' | '8' | '12';
  pageSize: '3' | '4' | '6';
  audience: 'all' | 'guest' | 'member';
  showSearch: boolean;
  showBoardFilter: boolean;
  emptyMessage: string;
}

export interface G7ProductShowcaseEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  source: 'latest' | 'new' | 'popular';
  limit: '3' | '4' | '6' | '8';
  pageSize: '3' | '4';
  audience: 'all' | 'guest' | 'member';
  detailBasePath: string;
  layout: 'featured' | 'rail';
  emptyMessage: string;
}

export interface Phase3CatalogEditorComponents {
  LogoCarousel: LogoCarouselEditorProps;
  TestimonialSlider: TestimonialSliderEditorProps;
  EventSchedule: EventScheduleEditorProps;
  DownloadResources: DownloadResourcesEditorProps;
  G7BoardArchive: G7BoardArchiveEditorProps;
  G7ProductShowcase: G7ProductShowcaseEditorProps;
}

export type Phase3ComponentType = keyof Phase3CatalogEditorComponents;

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
const appearanceFields = {
  surface: { type: 'select' as const, label: '배경 프리셋', options: SURFACE_OPTIONS },
  spacing: { type: 'select' as const, label: '세로 여백', options: SPACING_OPTIONS },
  elementStyles: { type: 'custom' as const, label: '캔버스 요소 스타일', render: () => <></> },
};

const DEFAULT_LOGOS: LogoItem[] = [
  { name: 'Orbit', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Northstar', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Vertex', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Morrow', imageSrc: '', imageAlt: '', url: '/' },
  { name: 'Layer', imageSrc: '', imageAlt: '', url: '/' },
];
const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  { quote: '필요한 정보를 찾고 페이지를 운영하는 시간이 크게 줄었습니다.', name: '김민서', role: '브랜드 매니저', company: '오르빗', avatarSrc: '', avatarAlt: '', rating: 5 },
  { quote: '모바일에서도 메시지가 선명하고 수정 흐름이 자연스럽습니다.', name: '이도윤', role: '운영 리드', company: '노스스타', avatarSrc: '', avatarAlt: '', rating: 5 },
  { quote: '정해진 디자인 언어 안에서 빠르게 결과를 만들 수 있습니다.', name: '박서연', role: '디자이너', company: '버텍스', avatarSrc: '', avatarAlt: '', rating: 4 },
];
const DEFAULT_EVENTS: EventScheduleItem[] = [
  { date: '2026-09-03', time: '14:00', title: '제품 소개 웨비나', location: '온라인', description: '핵심 기능과 실제 제작 흐름을 살펴봅니다.', buttonLabel: '참가 신청', buttonUrl: '/' },
  { date: '2026-09-12', time: '11:00', title: '운영자 워크숍', location: '서울 스튜디오', description: '콘텐츠 구조와 발행 운영 방법을 함께 실습합니다.', buttonLabel: '자세히 보기', buttonUrl: '/' },
  { date: '2026-09-24', time: '16:00', title: '업데이트 브리핑', location: '온라인', description: '새로운 블록과 데이터 연결 기능을 소개합니다.', buttonLabel: '일정 확인', buttonUrl: '/' },
];
const DEFAULT_DOWNLOADS: DownloadResourceItem[] = [
  { title: '서비스 소개서', description: '핵심 기능과 적용 사례를 한눈에 확인합니다.', fileType: 'PDF', fileSize: '2.4 MB', buttonLabel: '다운로드', url: '/' },
  { title: '운영 체크리스트', description: '발행 전에 확인할 항목을 정리했습니다.', fileType: 'PDF', fileSize: '780 KB', buttonLabel: '다운로드', url: '/' },
  { title: '브랜드 에셋', description: '로고와 기본 사용 지침을 제공합니다.', fileType: 'ZIP', fileSize: '6.8 MB', buttonLabel: '받기', url: '/' },
];

const DEFAULT_LOGO_CAROUSEL: LogoCarouselEditorProps = { eyebrow: '함께하는 브랜드', heading: '신뢰받는 팀이 선택했습니다', logos: DEFAULT_LOGOS, autoplay: 'yes', interval: '5000', surface: 'default', spacing: 'compact', motion: { ...DEFAULT_BLOCK_MOTION } };
const DEFAULT_TESTIMONIAL_SLIDER: TestimonialSliderEditorProps = { eyebrow: '고객 이야기', heading: '운영 현장에서 확인한 변화', items: DEFAULT_TESTIMONIALS, autoplay: 'yes', interval: '7000', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };
const DEFAULT_EVENT_SCHEDULE: EventScheduleEditorProps = { eyebrow: '다가오는 일정', heading: '만나고 배우는 시간', items: DEFAULT_EVENTS, layout: 'agenda', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };
const DEFAULT_DOWNLOADS_BLOCK: DownloadResourcesEditorProps = { eyebrow: '자료실', heading: '필요한 자료를 바로 받아보세요', items: DEFAULT_DOWNLOADS, surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };
const DEFAULT_BOARD_ARCHIVE: G7BoardArchiveEditorProps = { eyebrow: '콘텐츠 아카이브', heading: '관심 있는 이야기를 찾아보세요', source: 'recent', period: 'month', limit: '12', pageSize: '6', audience: 'all', showSearch: true, showBoardFilter: true, emptyMessage: '조건에 맞는 게시글이 없습니다.', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };
const DEFAULT_PRODUCT_SHOWCASE: G7ProductShowcaseEditorProps = { eyebrow: '추천 상품', heading: '지금 주목할 상품', source: 'new', limit: '6', pageSize: '3', audience: 'all', detailBasePath: '/shop/products', layout: 'featured', emptyMessage: '표시할 상품이 없습니다.', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION } };

function asRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function asString(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function normalizeArray<T>(value: unknown, fallback: T[], max: number, map: (item: Record<string, unknown>) => T): T[] { return (Array.isArray(value) ? value : fallback).slice(0, max).map((item) => map(asRecord(item))); }
function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode { const item = Array.isArray(value) ? asRecord(value[index]) : {}; const candidate = item[key]; return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback; }
function inlineArrayText(value: unknown, index: number, key: string, fallback = ''): string { const item = Array.isArray(value) ? asRecord(value[index]) : {}; const candidate = item[key]; if (React.isValidElement(candidate)) { const elementValue = (candidate.props as { value?: unknown }).value; return typeof elementValue === 'string' ? elementValue : fallback; } return asString(candidate, fallback); }
function normalizeLogos(value: unknown): LogoItem[] { return normalizeArray(value, DEFAULT_LOGOS, 12, (item) => ({ name: asString(item.name), imageSrc: asString(item.imageSrc), imageAlt: asString(item.imageAlt), url: asString(item.url) })); }
function normalizeTestimonials(value: unknown): TestimonialItem[] { return normalizeArray(value, DEFAULT_TESTIMONIALS, 8, (item) => ({ quote: asString(item.quote), name: asString(item.name), role: asString(item.role), company: asString(item.company), avatarSrc: asString(item.avatarSrc), avatarAlt: asString(item.avatarAlt), rating: ([1, 2, 3, 4, 5].includes(Number(item.rating)) ? Number(item.rating) : 5) as TestimonialItem['rating'] })); }
function normalizeEvents(value: unknown): EventScheduleItem[] { return normalizeArray(value, DEFAULT_EVENTS, 12, (item) => ({ date: asString(item.date), time: asString(item.time), title: asString(item.title), location: asString(item.location), description: asString(item.description), buttonLabel: asString(item.buttonLabel), buttonUrl: asString(item.buttonUrl) })); }
function normalizeDownloads(value: unknown): DownloadResourceItem[] { return normalizeArray(value, DEFAULT_DOWNLOADS, 12, (item) => ({ title: asString(item.title), description: asString(item.description), fileType: asString(item.fileType), fileSize: asString(item.fileSize), buttonLabel: asString(item.buttonLabel), url: asString(item.url) })); }
function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } { const record = asRecord(value); const resolved: BlockAppearance = { surface: record.surface === 'soft' || record.surface === 'contrast' ? record.surface : fallback.surface, spacing: record.spacing === 'compact' || record.spacing === 'spacious' ? record.spacing : fallback.spacing, ...(record.textScale === 'compact' || record.textScale === 'large' ? { textScale: record.textScale } : {}), ...(record.textAlign === 'center' || record.textAlign === 'right' ? { textAlign: record.textAlign } : {}) }; const elements = normalizeElementAppearanceMap(record.elementStyles ?? record.elements); return Object.keys(elements).length > 0 ? { ...resolved, elementStyles: elements } : resolved; }
function attachAppearance(props: Record<string, unknown>, raw: Record<string, unknown>, fallback: BlockAppearance, include: boolean): Record<string, unknown> { const editor = appearance({ surface: raw.surface, spacing: raw.spacing, textScale: raw.textScale, textAlign: raw.textAlign, elementStyles: raw.elementStyles }, fallback); const { elementStyles, ...resolved } = editor; const canonical: BlockAppearance = { ...resolved, ...(elementStyles && Object.keys(elementStyles).length > 0 ? { elements: elementStyles } : {}) }; return include || canonical.surface !== fallback.surface || canonical.spacing !== fallback.spacing || canonical.textScale || canonical.textAlign || canonical.elements ? { ...props, appearance: canonical } : props; }
function common(block: PageBuilderBlock, fallback: BlockAppearance): AppearanceEditorProps { return { ...appearance(block.props.appearance, fallback), motion: normalizeBlockMotion(block.motion) }; }
function surfaceClass(props: AppearanceEditorProps): string { return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`; }
function Frame({ id, type, motion, elementStyles, children }: { id: string; type: string; motion: BlockMotion; elementStyles?: ElementAppearanceMap; children: React.ReactNode }): React.ReactElement { const resolvedElementStyles = useCanvasElementStyles(id, elementStyles); return <section className="g7pb-preview-block" data-testid="page-builder-block" data-block-id={id} data-block-type={type} onPointerDownCapture={(event) => notifyCanvasElementSelection(event, id, type)} {...motionPreviewAttributes(motion)}>{decorateCanvasElementStyles(children, resolvedElementStyles)}</section>; }

function LogoCarouselPreview(props: LogoCarouselEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="logo-carousel" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-logo-carousel ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header><div>{normalizeLogos(props.logos).map((logo, index) => <span key={`${logo.name}-${index}`}>{logo.imageSrc ? <img data-g7pb-media-field={`logos.${index}.imageSrc`} src={logo.imageSrc} alt={logo.imageAlt} /> : <b data-g7pb-inline-field={`logos.${index}.name`}>{inlineArrayContent(props.logos, index, 'name', logo.name)}</b>}</span>)}</div><footer><button type="button" aria-label="이전 로고">←</button><i>자동 {props.autoplay === 'yes' ? '재생' : '정지'}</i><button type="button" aria-label="다음 로고">→</button></footer></div></Frame>;
}

function TestimonialSliderPreview(props: TestimonialSliderEditorProps & { id: string }): React.ReactElement {
  const [active, setActive] = useState(0); const items = normalizeTestimonials(props.items); const item = items[Math.min(active, items.length - 1)];
  return <Frame id={props.id} type="testimonial-slider" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-testimonial-slider ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header><blockquote><span>{'★'.repeat(item.rating)}</span><RichTextCanvasField fieldPath={`items.${active}.quote`} className="g7pb-preview-richtext g7pb-preview-testimonial-slider__quote">{inlineArrayContent(props.items, active, 'quote', item.quote)}</RichTextCanvasField><footer>{item.avatarSrc ? <img data-g7pb-media-field={`items.${active}.avatarSrc`} src={item.avatarSrc} alt={item.avatarAlt} /> : <i data-g7pb-media-field={`items.${active}.avatarSrc`} aria-hidden="true">{inlineArrayText(props.items, active, 'name', item.name).slice(0, 1)}</i>}<strong data-g7pb-inline-field={`items.${active}.name`}>{inlineArrayContent(props.items, active, 'name', item.name)}</strong><small><span data-g7pb-inline-field={`items.${active}.role`}>{inlineArrayContent(props.items, active, 'role', item.role)}</span> · <span data-g7pb-inline-field={`items.${active}.company`}>{inlineArrayContent(props.items, active, 'company', item.company)}</span></small></footer></blockquote><nav aria-label="후기 선택">{items.map((entry, index) => <button type="button" aria-current={active === index} onClick={() => setActive(index)} key={`${entry.name}-${index}`}>{index + 1}</button>)}</nav></div></Frame>;
}

function EventSchedulePreview(props: EventScheduleEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="event-schedule" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-events g7pb-preview-events--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header><ol>{normalizeEvents(props.items).map((item, index) => <li key={`${item.date}-${item.title}-${index}`}><time><b data-g7pb-inline-field={`items.${index}.date`}>{inlineArrayContent(props.items, index, 'date', item.date)}</b><span data-g7pb-inline-field={`items.${index}.time`}>{inlineArrayContent(props.items, index, 'time', item.time)}</span></time><div><small data-g7pb-inline-field={`items.${index}.location`}>{inlineArrayContent(props.items, index, 'location', item.location)}</small><h3 data-g7pb-inline-field={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</h3><RichTextCanvasField fieldPath={`items.${index}.description`}>{inlineArrayContent(props.items, index, 'description', item.description)}</RichTextCanvasField><b data-g7pb-inline-field={`items.${index}.buttonLabel`}>{inlineArrayContent(props.items, index, 'buttonLabel', item.buttonLabel)} →</b></div></li>)}</ol></div></Frame>;
}

function DownloadResourcesPreview(props: DownloadResourcesEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="download-resources" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-downloads ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header><ul>{normalizeDownloads(props.items).map((item, index) => <li key={`${item.title}-${index}`}><span>{inlineArrayText(props.items, index, 'fileType', item.fileType) || 'FILE'}</span><div><h3 data-g7pb-inline-field={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</h3><RichTextCanvasField fieldPath={`items.${index}.description`}>{inlineArrayContent(props.items, index, 'description', item.description)}</RichTextCanvasField><small><span data-g7pb-inline-field={`items.${index}.fileType`}>{inlineArrayContent(props.items, index, 'fileType', item.fileType)}</span> · <span data-g7pb-inline-field={`items.${index}.fileSize`}>{inlineArrayContent(props.items, index, 'fileSize', item.fileSize)}</span></small></div><b data-g7pb-inline-field={`items.${index}.buttonLabel`}>{inlineArrayContent(props.items, index, 'buttonLabel', item.buttonLabel)} ↓</b></li>)}</ul></div></Frame>;
}

function G7BoardArchivePreview(props: G7BoardArchiveEditorProps & { id: string }): React.ReactElement {
  const [query, setQuery] = useState(''); const samples = ['페이지 제작 소식을 전합니다', '새로운 기능 업데이트 안내', '운영 가이드와 자주 묻는 질문']; const visible = useMemo(() => samples.filter((item) => item.includes(query)), [query]);
  return <Frame id={props.id} type="g7-board-archive" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-archive ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header><div className="g7pb-preview-archive__tools">{props.showSearch ? <input aria-label="콘텐츠 검색 미리보기" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 검색" /> : null}{props.showBoardFilter ? <select aria-label="게시판 분류 미리보기"><option>전체 게시판</option><option>공지사항</option><option>자료실</option></select> : null}</div><div>{visible.map((title, index) => <article key={title}><small>{index === 0 ? '공지사항' : '자료실'}</small><strong>{title}</strong><span>2026.08.{21 - index}</span><b>→</b></article>)}</div><p>실제 공개 게시글은 G7 공개 API capability가 있을 때 표시됩니다.</p></div></Frame>;
}

function G7ProductShowcasePreview(props: G7ProductShowcaseEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="g7-product-showcase" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-product-showcase g7pb-preview-product-showcase--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header><div>{['시그니처 상품', '새로운 상품', '인기 상품'].map((name, index) => <article key={name}><span>상품 이미지</span><div><small>{index === 0 ? 'FEATURED' : 'PRODUCT'}</small><strong>{name}</strong><b>{(39000 + index * 12000).toLocaleString()}원</b><em>상품 보기 →</em></div></article>)}</div><p>실제 상품은 G7 쇼핑몰 공개 API capability가 있을 때 표시됩니다.</p></div></Frame>;
}

export const phase3CatalogComponentConfigs: Config<Phase3CatalogEditorComponents>['components'] = {
  LogoCarousel: { label: '로고 캐러셀', defaultProps: DEFAULT_LOGO_CAROUSEL, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, logos: { type: 'array', label: '로고', min: 3, max: 12, defaultItemProps: (index) => ({ name: `브랜드 ${index + 1}`, imageSrc: '', imageAlt: '', url: '/' }), getItemSummary: (item) => item.name, arrayFields: { name: { type: 'text', label: '브랜드 이름', contentEditable: true }, imageSrc: createMediaField('로고 이미지'), imageAlt: { type: 'text', label: '대체 텍스트' }, url: createRouteUrlField('브랜드 연결') } }, autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: 'yes' }, { label: '정지', value: 'no' }] }, interval: { type: 'select', label: '전환 간격', options: ['3000', '5000', '7000'].map((value) => ({ label: `${Number(value) / 1000}초`, value })) }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) }, render: (props) => <LogoCarouselPreview {...props} /> },
  TestimonialSlider: { label: '후기 슬라이더', defaultProps: DEFAULT_TESTIMONIAL_SLIDER, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, items: { type: 'array', label: '후기', min: 2, max: 8, defaultItemProps: (index) => ({ quote: '고객 경험을 입력하세요.', name: `고객 ${index + 1}`, role: '담당자', company: '회사명', avatarSrc: '', avatarAlt: '', rating: 5 }), getItemSummary: (item) => `${item.name} · ${item.company}`, arrayFields: { quote: createRichTextField('후기', 140), name: { type: 'text', label: '이름', contentEditable: true }, role: { type: 'text', label: '역할', contentEditable: true }, company: { type: 'text', label: '회사', contentEditable: true }, avatarSrc: createMediaField('프로필 이미지'), avatarAlt: { type: 'text', label: '대체 텍스트' }, rating: { type: 'select', label: '평점', options: [1, 2, 3, 4, 5].map((value) => ({ label: `${value}점`, value })) } } }, autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: 'yes' }, { label: '정지', value: 'no' }] }, interval: { type: 'select', label: '전환 간격', options: ['5000', '7000', '9000'].map((value) => ({ label: `${Number(value) / 1000}초`, value })) }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) }, render: (props) => <TestimonialSliderPreview {...props} /> },
  EventSchedule: { label: '이벤트 일정', defaultProps: DEFAULT_EVENT_SCHEDULE, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, layout: { type: 'radio', label: '배치', options: [{ label: '일정표', value: 'agenda' }, { label: '타임라인', value: 'timeline' }] }, items: { type: 'array', label: '일정', min: 1, max: 12, defaultItemProps: (index) => ({ date: '2026-09-01', time: '14:00', title: `이벤트 ${index + 1}`, location: '온라인', description: '이벤트 설명을 입력하세요.', buttonLabel: '자세히 보기', buttonUrl: '/' }), getItemSummary: (item) => `${item.date} · ${item.title}`, arrayFields: { date: { type: 'text', label: '날짜', contentEditable: true }, time: { type: 'text', label: '시간', contentEditable: true }, title: { type: 'text', label: '제목', contentEditable: true }, location: { type: 'text', label: '장소', contentEditable: true }, description: createRichTextField('설명', 130), buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, buttonUrl: createRouteUrlField('이벤트 연결') } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <EventSchedulePreview {...props} /> },
  DownloadResources: { label: '다운로드 자료', defaultProps: DEFAULT_DOWNLOADS_BLOCK, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, items: { type: 'array', label: '자료', min: 1, max: 12, defaultItemProps: (index) => ({ title: `자료 ${index + 1}`, description: '자료 설명을 입력하세요.', fileType: 'PDF', fileSize: '', buttonLabel: '다운로드', url: '/' }), getItemSummary: (item) => `${item.fileType} · ${item.title}`, arrayFields: { title: { type: 'text', label: '자료명', contentEditable: true }, description: createRichTextField('설명', 130), fileType: { type: 'text', label: '파일 형식', contentEditable: true }, fileSize: { type: 'text', label: '파일 크기', contentEditable: true }, buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, url: createDownloadField('다운로드 파일') } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <DownloadResourcesPreview {...props} /> },
  G7BoardArchive: { label: 'G7 콘텐츠 아카이브', defaultProps: DEFAULT_BOARD_ARCHIVE, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, source: { type: 'radio', label: '게시글 기준', options: [{ label: '최신글', value: 'recent' }, { label: '인기글', value: 'popular' }] }, period: { type: 'select', label: '인기글 기간', options: [{ label: '오늘', value: 'today' }, { label: '이번 주', value: 'week' }, { label: '이번 달', value: 'month' }, { label: '최근 1년', value: 'year' }] }, limit: { type: 'select', label: '불러올 개수', options: ['6', '8', '12'].map((value) => ({ label: `${value}개`, value })) }, pageSize: { type: 'select', label: '페이지당 개수', options: ['3', '4', '6'].map((value) => ({ label: `${value}개`, value })) }, audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] }, showSearch: { type: 'radio', label: '제목 검색', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] }, showBoardFilter: { type: 'radio', label: '게시판 필터', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] }, emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <G7BoardArchivePreview {...props} /> },
  G7ProductShowcase: { label: 'G7 상품 쇼케이스', defaultProps: DEFAULT_PRODUCT_SHOWCASE, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true }, source: { type: 'select', label: '상품 기준', options: [{ label: '최신순', value: 'latest' }, { label: '신상품', value: 'new' }, { label: '인기 상품', value: 'popular' }] }, limit: { type: 'select', label: '불러올 개수', options: ['3', '4', '6', '8'].map((value) => ({ label: `${value}개`, value })) }, pageSize: { type: 'select', label: '페이지당 개수', options: ['3', '4'].map((value) => ({ label: `${value}개`, value })) }, audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] }, detailBasePath: { type: 'text', label: '상품 상세 기본 경로' }, layout: { type: 'radio', label: '배치', options: [{ label: '대표 상품 강조', value: 'featured' }, { label: '가로 목록', value: 'rail' }] }, emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <G7ProductShowcasePreview {...props} /> },
};

export function canonicalPhase3BlockToPuck(block: PageBuilderBlock): { type: Phase3ComponentType; props: Phase3CatalogEditorComponents[Phase3ComponentType] } | null {
  const props = block.props;
  if (block.type === LOGO_CAROUSEL_BLOCK_TYPE) return { type: 'LogoCarousel', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), logos: normalizeLogos(props.logos), autoplay: props.autoplay === false ? 'no' : 'yes', interval: props.interval === 3000 ? '3000' : props.interval === 7000 ? '7000' : '5000', ...common(block, { surface: 'default', spacing: 'compact' }) } };
  if (block.type === TESTIMONIAL_SLIDER_BLOCK_TYPE) return { type: 'TestimonialSlider', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeTestimonials(props.items), autoplay: props.autoplay === false ? 'no' : 'yes', interval: props.interval === 5000 ? '5000' : props.interval === 9000 ? '9000' : '7000', ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  if (block.type === EVENT_SCHEDULE_BLOCK_TYPE) return { type: 'EventSchedule', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeEvents(props.items), layout: props.layout === 'timeline' ? 'timeline' : 'agenda', ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === DOWNLOAD_RESOURCES_BLOCK_TYPE) return { type: 'DownloadResources', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), items: normalizeDownloads(props.items), ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  if (block.type === G7_BOARD_ARCHIVE_BLOCK_TYPE) return { type: 'G7BoardArchive', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' ? 'popular' : 'recent', period: ['today', 'week', 'year'].includes(asString(props.period)) ? asString(props.period) as G7BoardArchiveEditorProps['period'] : 'month', limit: ['6', '8'].includes(String(props.limit)) ? String(props.limit) as G7BoardArchiveEditorProps['limit'] : '12', pageSize: ['3', '4'].includes(String(props.pageSize)) ? String(props.pageSize) as G7BoardArchiveEditorProps['pageSize'] : '6', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', showSearch: props.showSearch !== false, showBoardFilter: props.showBoardFilter !== false, emptyMessage: asString(props.emptyMessage, DEFAULT_BOARD_ARCHIVE.emptyMessage), ...common(block, { surface: 'default', spacing: 'normal' }) } };
  if (block.type === G7_PRODUCT_SHOWCASE_BLOCK_TYPE) return { type: 'G7ProductShowcase', props: { eyebrow: asString(props.eyebrow), heading: asString(props.heading), source: props.source === 'popular' || props.source === 'latest' ? props.source : 'new', limit: ['3', '4', '8'].includes(String(props.limit)) ? String(props.limit) as G7ProductShowcaseEditorProps['limit'] : '6', pageSize: props.pageSize === 4 || props.pageSize === '4' ? '4' : '3', audience: props.audience === 'guest' || props.audience === 'member' ? props.audience : 'all', detailBasePath: asString(props.detailBasePath, '/shop/products'), layout: props.layout === 'rail' ? 'rail' : 'featured', emptyMessage: asString(props.emptyMessage, DEFAULT_PRODUCT_SHOWCASE.emptyMessage), ...common(block, { surface: 'soft', spacing: 'normal' }) } };
  return null;
}

export function phase3PuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'LogoCarousel') return { type: LOGO_CAROUSEL_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), logos: normalizeLogos(raw.logos), autoplay: raw.autoplay !== 'no', interval: Number(raw.interval) || 5000 }, raw, { surface: 'default', spacing: 'compact' }, includeAppearance) };
  if (type === 'TestimonialSlider') return { type: TESTIMONIAL_SLIDER_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeTestimonials(raw.items), autoplay: raw.autoplay !== 'no', interval: Number(raw.interval) || 7000 }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'EventSchedule') return { type: EVENT_SCHEDULE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeEvents(raw.items), layout: raw.layout === 'timeline' ? 'timeline' : 'agenda' }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'DownloadResources') return { type: DOWNLOAD_RESOURCES_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), items: normalizeDownloads(raw.items) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7BoardArchive') return { type: G7_BOARD_ARCHIVE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' ? 'popular' : 'recent', period: ['today', 'week', 'year'].includes(asString(raw.period)) ? raw.period : 'month', limit: Number(raw.limit) || 12, pageSize: Number(raw.pageSize) || 6, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', showSearch: raw.showSearch !== false, showBoardFilter: raw.showBoardFilter !== false, emptyMessage: asString(raw.emptyMessage, DEFAULT_BOARD_ARCHIVE.emptyMessage) }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7ProductShowcase') return { type: G7_PRODUCT_SHOWCASE_BLOCK_TYPE, props: attachAppearance({ eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), source: raw.source === 'popular' || raw.source === 'latest' ? raw.source : 'new', limit: Number(raw.limit) || 6, pageSize: Number(raw.pageSize) || 3, audience: raw.audience === 'guest' || raw.audience === 'member' ? raw.audience : 'all', detailBasePath: asString(raw.detailBasePath, '/shop/products'), layout: raw.layout === 'rail' ? 'rail' : 'featured', emptyMessage: asString(raw.emptyMessage, DEFAULT_PRODUCT_SHOWCASE.emptyMessage) }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  return null;
}
