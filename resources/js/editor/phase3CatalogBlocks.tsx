import React, { useMemo, useState } from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame as Frame } from './CatalogBlockFrame';
import { createMediaField } from './MediaPickerField';
import { createDownloadField } from './DownloadPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import { createMotionField } from './blockMotion';
import type { AppearanceEditorProps } from './catalogAppearance';
import {
  type LogoCarouselEditorProps,
  type TestimonialSliderEditorProps,
  type EventScheduleEditorProps,
  type DownloadResourcesEditorProps,
  type G7BoardArchiveEditorProps,
  type G7ProductShowcaseEditorProps,
  type Phase3CatalogEditorComponents,
  DEFAULT_LOGO_CAROUSEL,
  DEFAULT_TESTIMONIAL_SLIDER,
  DEFAULT_EVENT_SCHEDULE,
  DEFAULT_DOWNLOADS_BLOCK,
  DEFAULT_BOARD_ARCHIVE,
  DEFAULT_PRODUCT_SHOWCASE,
  asRecord,
  asString,
  normalizeLogos,
  normalizeTestimonials,
  normalizeEvents,
  normalizeDownloads,
} from './phase3CatalogData';
export type {
  LogoCarouselEditorProps,
  TestimonialSliderEditorProps,
  EventScheduleEditorProps,
  DownloadResourcesEditorProps,
  G7BoardArchiveEditorProps,
  G7ProductShowcaseEditorProps,
  Phase3CatalogEditorComponents,
  Phase3ComponentType,
} from './phase3CatalogData';
export { canonicalPhase3BlockToPuck, phase3PuckBlockToCanonical } from './phase3CatalogCodec';

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

function inlineArrayContent(value: unknown, index: number, key: string, fallback: string): React.ReactNode { const item = Array.isArray(value) ? asRecord(value[index]) : {}; const candidate = item[key]; return React.isValidElement(candidate) || typeof candidate === 'string' ? candidate : fallback; }
function inlineArrayText(value: unknown, index: number, key: string, fallback = ''): string { const item = Array.isArray(value) ? asRecord(value[index]) : {}; const candidate = item[key]; if (React.isValidElement(candidate)) { const elementValue = (candidate.props as { value?: unknown }).value; return typeof elementValue === 'string' ? elementValue : fallback; } return asString(candidate, fallback); }
function safeLink(value: string): string { const trimmed = value.trim(); if (/[\\\u0000-\u0020\u007f]/.test(trimmed)) return '#'; if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed; if (trimmed.startsWith('#') && /^#[a-z][a-z0-9-]{0,79}$/.test(trimmed)) return trimmed; try { const parsed = new URL(trimmed); if (['https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return trimmed; } catch { /* Invalid values remain editable but inert in the canvas. */ } return '#'; }

function surfaceClass(props: AppearanceEditorProps): string { return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`; }

function LogoCarouselPreview(props: LogoCarouselEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="logo-carousel" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-logo-carousel ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className="g7pb-preview-logo-carousel__viewport"><div className="g7pb-preview-logo-carousel__track">{normalizeLogos(props.logos).map((logo, index) => {
    const visual = logo.imageSrc
      ? <img className="g7pb-preview-logo-carousel__image" src={logo.imageSrc} alt={logo.imageAlt} />
      : <b data-g7pb-inline-field={`logos.${index}.name`}>{inlineArrayContent(props.logos, index, 'name', logo.name)}</b>;
    return <span className="g7pb-preview-logo-carousel__slide" key={`${logo.name}-${index}`} data-g7pb-media-field={`logos.${index}.imageSrc`}>{logo.url ? <a href={safeLink(logo.url)} onClick={(event) => event.preventDefault()}>{visual}</a> : visual}</span>;
  })}</div></div><footer><button type="button" aria-label="이전 로고">←</button><i>자동 {props.autoplay === 'yes' ? '재생' : '정지'}</i><button type="button" aria-label="다음 로고">→</button></footer></div></Frame>;
}

function TestimonialSliderPreview(props: TestimonialSliderEditorProps & { id: string }): React.ReactElement {
  const [active, setActive] = useState(0); const items = normalizeTestimonials(props.items); const activeIndex = Math.min(active, items.length - 1);
  return <Frame id={props.id} type="testimonial-slider" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-testimonial-slider ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className="g7pb-preview-testimonial-slider__viewport"><div className="g7pb-preview-testimonial-slider__track">{items.map((item, index) => <blockquote className="g7pb-preview-testimonial-slider__slide" style={{ order: index === activeIndex ? -1 : index }} key={`${item.name}-${index}`}><p className="g7pb-preview-testimonial-slider__rating">{'★'.repeat(item.rating)}</p><RichTextCanvasField fieldPath={`items.${index}.quote`} className="g7pb-preview-richtext g7pb-preview-testimonial-slider__quote">{inlineArrayContent(props.items, index, 'quote', item.quote)}</RichTextCanvasField><footer><figure>{item.avatarSrc ? <img className="g7pb-preview-testimonial-slider__avatar" data-g7pb-media-field={`items.${index}.avatarSrc`} src={item.avatarSrc} alt={item.avatarAlt} /> : <i data-g7pb-media-field={`items.${index}.avatarSrc`} aria-hidden="true">{inlineArrayText(props.items, index, 'name', item.name).slice(0, 1)}</i>}</figure><cite><strong data-g7pb-inline-field={`items.${index}.name`}>{inlineArrayContent(props.items, index, 'name', item.name)}</strong><span><span data-g7pb-inline-field={`items.${index}.role`}>{inlineArrayContent(props.items, index, 'role', item.role)}</span> · <span data-g7pb-inline-field={`items.${index}.company`}>{inlineArrayContent(props.items, index, 'company', item.company)}</span></span></cite></footer></blockquote>)}</div></div><nav aria-label="후기 선택">{items.map((entry, index) => <button type="button" aria-current={activeIndex === index} onClick={() => setActive(index)} key={`${entry.name}-${index}`}>{index + 1}</button>)}</nav></div></Frame>;
}

function EventSchedulePreview(props: EventScheduleEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="event-schedule" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-events g7pb-preview-events--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><ol>{normalizeEvents(props.items).map((item, index) => <li key={`${item.date}-${item.title}-${index}`}><time><b data-g7pb-inline-field={`items.${index}.date`}>{inlineArrayContent(props.items, index, 'date', item.date)}</b><span data-g7pb-inline-field={`items.${index}.time`}>{inlineArrayContent(props.items, index, 'time', item.time)}</span></time><div><small data-g7pb-inline-field={`items.${index}.location`}>{inlineArrayContent(props.items, index, 'location', item.location)}</small><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.description`}>{inlineArrayContent(props.items, index, 'description', item.description)}</RichTextCanvasField><b data-g7pb-inline-field={`items.${index}.buttonLabel`}>{inlineArrayContent(props.items, index, 'buttonLabel', item.buttonLabel)} →</b></div></li>)}</ol></div></Frame>;
}

function DownloadResourcesPreview(props: DownloadResourcesEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="download-resources" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-downloads ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><ul>{normalizeDownloads(props.items).map((item, index) => <li key={`${item.title}-${index}`}><span>{inlineArrayText(props.items, index, 'fileType', item.fileType) || 'FILE'}</span><div><RichTextCanvasField as="h3" className="g7pb-preview-richtext" fieldPath={`items.${index}.title`}>{inlineArrayContent(props.items, index, 'title', item.title)}</RichTextCanvasField><RichTextCanvasField fieldPath={`items.${index}.description`}>{inlineArrayContent(props.items, index, 'description', item.description)}</RichTextCanvasField><small><span data-g7pb-inline-field={`items.${index}.fileType`}>{inlineArrayContent(props.items, index, 'fileType', item.fileType)}</span> · <span data-g7pb-inline-field={`items.${index}.fileSize`}>{inlineArrayContent(props.items, index, 'fileSize', item.fileSize)}</span></small></div><b data-g7pb-inline-field={`items.${index}.buttonLabel`}>{inlineArrayContent(props.items, index, 'buttonLabel', item.buttonLabel)} ↓</b></li>)}</ul></div></Frame>;
}

function G7BoardArchivePreview(props: G7BoardArchiveEditorProps & { id: string }): React.ReactElement {
  const [query, setQuery] = useState(''); const samples = ['페이지 제작 소식을 전합니다', '새로운 기능 업데이트 안내', '운영 가이드와 자주 묻는 질문']; const visible = useMemo(() => samples.filter((item) => item.includes(query)), [query]);
  return <Frame id={props.id} type="g7-board-archive" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-archive ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div className="g7pb-preview-archive__tools">{props.showSearch ? <input aria-label="콘텐츠 검색 미리보기" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 검색" /> : null}{props.showBoardFilter ? <select aria-label="게시판 분류 미리보기"><option>전체 게시판</option><option>공지사항</option><option>자료실</option></select> : null}</div><div>{visible.map((title, index) => <article key={title}><small>{index === 0 ? '공지사항' : '자료실'}</small><strong>{title}</strong><span>2026.08.{21 - index}</span><b>→</b></article>)}</div><p>실제 공개 게시글은 G7 공개 API capability가 있을 때 표시됩니다.</p></div></Frame>;
}

function G7ProductShowcasePreview(props: G7ProductShowcaseEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="g7-product-showcase" motion={props.motion} elementStyles={props.elementStyles}><div className={`g7pb-preview-product-showcase g7pb-preview-product-showcase--${props.layout} ${surfaceClass(props)}`}><header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header><div>{['시그니처 상품', '새로운 상품', '인기 상품'].map((name, index) => <article key={name}><span>상품 이미지</span><div><small>{index === 0 ? 'FEATURED' : 'PRODUCT'}</small><strong>{name}</strong><b>{(39000 + index * 12000).toLocaleString()}원</b><em>상품 보기 →</em></div></article>)}</div><p>실제 상품은 G7 쇼핑몰 공개 API capability가 있을 때 표시됩니다.</p></div></Frame>;
}

export const phase3CatalogComponentConfigs: Config<Phase3CatalogEditorComponents>['components'] = {
  LogoCarousel: { label: '로고 캐러셀', defaultProps: DEFAULT_LOGO_CAROUSEL, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), logos: { type: 'array', label: '로고', min: 3, max: 12, defaultItemProps: (index) => ({ name: `브랜드 ${index + 1}`, imageSrc: '', imageAlt: '', url: '/' }), getItemSummary: (item) => item.name, arrayFields: { name: { type: 'text', label: '브랜드 이름', contentEditable: true }, imageSrc: createMediaField('로고 이미지'), imageAlt: { type: 'text', label: '대체 텍스트' }, url: createRouteUrlField('브랜드 연결') } }, autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: 'yes' }, { label: '정지', value: 'no' }] }, interval: { type: 'select', label: '전환 간격', options: ['3000', '5000', '7000'].map((value) => ({ label: `${Number(value) / 1000}초`, value })) }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) }, render: (props) => <LogoCarouselPreview {...props} /> },
  TestimonialSlider: { label: '후기 슬라이더', defaultProps: DEFAULT_TESTIMONIAL_SLIDER, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), items: { type: 'array', label: '후기', min: 2, max: 8, defaultItemProps: (index) => ({ quote: '고객 경험을 입력하세요.', name: `고객 ${index + 1}`, role: '담당자', company: '회사명', avatarSrc: '', avatarAlt: '', rating: 5 }), getItemSummary: (item) => `${item.name} · ${item.company}`, arrayFields: { quote: createRichTextField('후기', 140), name: { type: 'text', label: '이름', contentEditable: true }, role: { type: 'text', label: '역할', contentEditable: true }, company: { type: 'text', label: '회사', contentEditable: true }, avatarSrc: createMediaField('프로필 이미지'), avatarAlt: { type: 'text', label: '대체 텍스트' }, rating: { type: 'select', label: '평점', options: [1, 2, 3, 4, 5].map((value) => ({ label: `${value}점`, value })) } } }, autoplay: { type: 'radio', label: '자동 재생', options: [{ label: '사용', value: 'yes' }, { label: '정지', value: 'no' }] }, interval: { type: 'select', label: '전환 간격', options: ['5000', '7000', '9000'].map((value) => ({ label: `${Number(value) / 1000}초`, value })) }, ...appearanceFields, motion: createMotionField(['none', 'reveal']) }, render: (props) => <TestimonialSliderPreview {...props} /> },
  EventSchedule: { label: '이벤트 일정', defaultProps: DEFAULT_EVENT_SCHEDULE, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), layout: { type: 'radio', label: '배치', options: [{ label: '일정표', value: 'agenda' }, { label: '타임라인', value: 'timeline' }] }, items: { type: 'array', label: '일정', min: 1, max: 12, defaultItemProps: (index) => ({ date: '2026-09-01', time: '14:00', title: `이벤트 ${index + 1}`, location: '온라인', description: '이벤트 설명을 입력하세요.', buttonLabel: '자세히 보기', buttonUrl: '/' }), getItemSummary: (item) => `${item.date} · ${item.title}`, arrayFields: { date: { type: 'text', label: '날짜', contentEditable: true }, time: { type: 'text', label: '시간', contentEditable: true }, title: createInlineRichTextField('제목'), location: { type: 'text', label: '장소', contentEditable: true }, description: createRichTextField('설명', 130), buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, buttonUrl: createRouteUrlField('이벤트 연결') } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <EventSchedulePreview {...props} /> },
  DownloadResources: { label: '다운로드 자료', defaultProps: DEFAULT_DOWNLOADS_BLOCK, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), items: { type: 'array', label: '자료', min: 1, max: 12, defaultItemProps: (index) => ({ title: `자료 ${index + 1}`, description: '자료 설명을 입력하세요.', fileType: 'PDF', fileSize: '', buttonLabel: '다운로드', url: '/' }), getItemSummary: (item) => `${item.fileType} · ${item.title}`, arrayFields: { title: createInlineRichTextField('자료명'), description: createRichTextField('설명', 130), fileType: { type: 'text', label: '파일 형식', contentEditable: true }, fileSize: { type: 'text', label: '파일 크기', contentEditable: true }, buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true }, url: createDownloadField('다운로드 파일') } }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <DownloadResourcesPreview {...props} /> },
  G7BoardArchive: { label: 'G7 콘텐츠 아카이브', defaultProps: DEFAULT_BOARD_ARCHIVE, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), source: { type: 'radio', label: '게시글 기준', options: [{ label: '최신글', value: 'recent' }, { label: '인기글', value: 'popular' }] }, period: { type: 'select', label: '인기글 기간', options: [{ label: '오늘', value: 'today' }, { label: '이번 주', value: 'week' }, { label: '이번 달', value: 'month' }, { label: '최근 1년', value: 'year' }] }, limit: { type: 'select', label: '불러올 개수', options: ['6', '8', '12'].map((value) => ({ label: `${value}개`, value })) }, pageSize: { type: 'select', label: '페이지당 개수', options: ['3', '4', '6'].map((value) => ({ label: `${value}개`, value })) }, audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] }, showSearch: { type: 'radio', label: '제목 검색', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] }, showBoardFilter: { type: 'radio', label: '게시판 필터', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] }, emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <G7BoardArchivePreview {...props} /> },
  G7ProductShowcase: { label: 'G7 상품 쇼케이스', defaultProps: DEFAULT_PRODUCT_SHOWCASE, fields: { eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'), source: { type: 'select', label: '상품 기준', options: [{ label: '최신순', value: 'latest' }, { label: '신상품', value: 'new' }, { label: '인기 상품', value: 'popular' }] }, limit: { type: 'select', label: '불러올 개수', options: ['3', '4', '6', '8'].map((value) => ({ label: `${value}개`, value })) }, pageSize: { type: 'select', label: '페이지당 개수', options: ['3', '4'].map((value) => ({ label: `${value}개`, value })) }, audience: { type: 'select', label: '노출 대상', options: [{ label: '모두', value: 'all' }, { label: '로그아웃 사용자', value: 'guest' }, { label: '로그인 사용자', value: 'member' }] }, detailBasePath: { type: 'text', label: '상품 상세 기본 경로' }, layout: { type: 'radio', label: '배치', options: [{ label: '대표 상품 강조', value: 'featured' }, { label: '가로 목록', value: 'rail' }] }, emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal', 'stagger']) }, render: (props) => <G7ProductShowcasePreview {...props} /> },
};
