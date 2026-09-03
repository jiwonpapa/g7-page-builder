import React, { useState } from 'react';
import type { Config, Field } from '@puckeditor/core';
import { CatalogBlockFrame as Frame } from './CatalogBlockFrame';
import { createMediaField } from './MediaPickerField';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, createRichTextField, RichTextCanvasField } from './richTextEditing';
import { createMotionField } from './blockMotion';
import type { AppearanceEditorProps } from './catalogAppearance';
import {
  type TestimonialsEditorProps,
  type FaqAccordionEditorProps,
  type ProcessTimelineEditorProps,
  type TabsEditorProps,
  type ComparisonTableEditorProps,
  type ArticleListEditorProps,
  type VideoEmbedEditorProps,
  type Phase2CatalogEditorComponents,
  DEFAULT_TESTIMONIALS,
  DEFAULT_FAQ,
  DEFAULT_PROCESS,
  DEFAULT_TABS,
  DEFAULT_COMPARISON,
  DEFAULT_ARTICLES,
  DEFAULT_VIDEO,
  asString,
  asRecord,
  normalizeTestimonials,
  normalizeFaq,
  normalizeProcess,
  normalizeTabs,
  normalizeColumns,
  normalizeComparisonRows,
  normalizeArticles,
} from './phase2CatalogData';
export type {
  TestimonialsEditorProps,
  FaqAccordionEditorProps,
  ProcessTimelineEditorProps,
  TabsEditorProps,
  ComparisonTableEditorProps,
  ArticleListEditorProps,
  VideoEmbedEditorProps,
  Phase2CatalogEditorComponents,
  Phase2ComponentType,
} from './phase2CatalogData';
export { canonicalPhase2BlockToPuck, phase2PuckBlockToCanonical } from './phase2CatalogCodec';

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
