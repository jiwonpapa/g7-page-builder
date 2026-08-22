import React from 'react';
import type { Config } from '@puckeditor/core';

import { createRouteUrlField } from './RouteUrlField';
import {
  decorateCanvasElementStyles,
  normalizeElementAppearanceMap,
  notifyCanvasElementSelection,
  useCanvasElementStyles,
} from './canvasEditingContract';
import {
  createMotionField,
  DEFAULT_BLOCK_MOTION,
  motionPreviewAttributes,
  normalizeBlockMotion,
} from './blockMotion';
import {
  G7_POST_DETAIL_BLOCK_TYPE,
  G7_PRODUCT_DETAIL_BLOCK_TYPE,
  type BlockAppearance,
  type BlockMotion,
  type ElementAppearanceMap,
  type PageBuilderBlock,
} from '../documents/types';

interface AppearanceEditorProps {
  surface: BlockAppearance['surface'];
  spacing: BlockAppearance['spacing'];
  textScale?: NonNullable<BlockAppearance['textScale']>;
  textAlign?: NonNullable<BlockAppearance['textAlign']>;
  elementStyles?: ElementAppearanceMap;
  motion: BlockMotion;
}

export interface G7PostDetailEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  boardSlug: string;
  postId: number;
  detailUrl: string;
  linkLabel: string;
  audience: 'all' | 'guest' | 'member';
  showContent: boolean;
  emptyMessage: string;
}

export interface G7ProductDetailEditorProps extends AppearanceEditorProps {
  eyebrow: string;
  heading: string;
  productKey: string;
  detailUrl: string;
  buttonLabel: string;
  audience: 'all' | 'guest' | 'member';
  showDescription: boolean;
  emptyMessage: string;
}

export interface Phase4CatalogEditorComponents {
  G7PostDetail: G7PostDetailEditorProps;
  G7ProductDetail: G7ProductDetailEditorProps;
}

export type Phase4ComponentType = keyof Phase4CatalogEditorComponents;

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
const AUDIENCE_OPTIONS = [
  { label: '모두', value: 'all' },
  { label: '로그아웃 사용자', value: 'guest' },
  { label: '로그인 사용자', value: 'member' },
];
const appearanceFields = {
  surface: { type: 'select' as const, label: '배경 프리셋', options: SURFACE_OPTIONS },
  spacing: { type: 'select' as const, label: '세로 여백', options: SPACING_OPTIONS },
  elementStyles: { type: 'custom' as const, label: '캔버스 요소 스타일', render: () => <></> },
};

const DEFAULT_POST_DETAIL: G7PostDetailEditorProps = {
  eyebrow: '게시글 상세', heading: '선택한 게시글을 소개합니다', boardSlug: 'notice', postId: 1,
  detailUrl: '/board/notice/1', linkLabel: '게시글 전체 보기', audience: 'all', showContent: true,
  emptyMessage: '게시글을 불러오지 못했습니다.', surface: 'default', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};
const DEFAULT_PRODUCT_DETAIL: G7ProductDetailEditorProps = {
  eyebrow: '상품 상세', heading: '선택한 상품을 소개합니다', productKey: 'SAMPLE',
  detailUrl: '/shop/products/SAMPLE', buttonLabel: '상품 전체 보기', audience: 'all', showDescription: true,
  emptyMessage: '상품을 불러오지 못했습니다.', surface: 'soft', spacing: 'normal', motion: { ...DEFAULT_BLOCK_MOTION },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function asString(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
function audience(value: unknown): 'all' | 'guest' | 'member' { return value === 'guest' || value === 'member' ? value : 'all'; }
function appearance(value: unknown, fallback: BlockAppearance): BlockAppearance & { elementStyles?: ElementAppearanceMap } {
  const record = asRecord(value);
  const resolved: BlockAppearance = {
    surface: record.surface === 'soft' || record.surface === 'contrast' ? record.surface : fallback.surface,
    spacing: record.spacing === 'compact' || record.spacing === 'spacious' ? record.spacing : fallback.spacing,
    ...(record.textScale === 'compact' || record.textScale === 'large' ? { textScale: record.textScale } : {}),
    ...(record.textAlign === 'center' || record.textAlign === 'right' ? { textAlign: record.textAlign } : {}),
  };
  const elements = normalizeElementAppearanceMap(record.elementStyles ?? record.elements);
  return Object.keys(elements).length > 0 ? { ...resolved, elementStyles: elements } : resolved;
}
function attachAppearance(props: Record<string, unknown>, raw: Record<string, unknown>, fallback: BlockAppearance, include: boolean): Record<string, unknown> {
  const editor = appearance({ surface: raw.surface, spacing: raw.spacing, textScale: raw.textScale, textAlign: raw.textAlign, elementStyles: raw.elementStyles }, fallback);
  const { elementStyles, ...resolved } = editor;
  const canonical: BlockAppearance = { ...resolved, ...(elementStyles && Object.keys(elementStyles).length > 0 ? { elements: elementStyles } : {}) };
  return include || canonical.surface !== fallback.surface || canonical.spacing !== fallback.spacing || canonical.textScale || canonical.textAlign || canonical.elements
    ? { ...props, appearance: canonical }
    : props;
}
function common(block: PageBuilderBlock, fallback: BlockAppearance): AppearanceEditorProps {
  return { ...appearance(block.props.appearance, fallback), motion: normalizeBlockMotion(block.motion) };
}
function surfaceClass(props: AppearanceEditorProps): string {
  return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`;
}
function Frame({ id, type, motion, elementStyles, children }: { id: string; type: string; motion: BlockMotion; elementStyles?: ElementAppearanceMap; children: React.ReactNode }): React.ReactElement {
  const resolved = useCanvasElementStyles(id, elementStyles);
  return <section className="g7pb-preview-block" data-testid="page-builder-block" data-block-id={id} data-block-type={type}
    onPointerDownCapture={(event) => notifyCanvasElementSelection(event, id, type)} {...motionPreviewAttributes(motion)}>
    {decorateCanvasElementStyles(children, resolved)}
  </section>;
}

function G7PostDetailPreview(props: G7PostDetailEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="g7-post-detail" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-data-detail g7pb-preview-data-detail--post ${surfaceClass(props)}`}>
      <header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header>
      <article><p className="g7pb-preview-data-detail__meta">공지사항 · 2026.08.22 · 조회 128</p><h3>새로운 소식을 전합니다</h3>
        {props.showContent ? <p>공개 화면에서는 지정한 게시글의 제목, 작성 정보와 본문 요약을 안전한 텍스트로 불러옵니다.</p> : null}
        <b data-g7pb-inline-field="linkLabel">{props.linkLabel} →</b></article>
      <p>게시판 <strong>{props.boardSlug}</strong> · 글 번호 <strong>{props.postId}</strong></p>
    </div>
  </Frame>;
}

function G7ProductDetailPreview(props: G7ProductDetailEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="g7-product-detail" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-data-detail g7pb-preview-data-detail--product ${surfaceClass(props)}`}>
      <header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><h2 data-g7pb-inline-field="heading">{props.heading}</h2></header>
      <article><span className="g7pb-preview-data-detail__media">상품 이미지</span><div><small>PRODUCT · {props.productKey}</small><h3>시그니처 상품</h3><strong>39,000원</strong>
        {props.showDescription ? <p>공개 화면에서는 지정한 상품의 이미지, 가격과 설명을 G7 공개 API에서 불러옵니다.</p> : null}
        <b data-g7pb-inline-field="buttonLabel">{props.buttonLabel} →</b></div></article>
    </div>
  </Frame>;
}

export const phase4CatalogComponentConfigs: Config<Phase4CatalogEditorComponents>['components'] = {
  G7PostDetail: {
    label: 'G7 게시글 상세', defaultProps: DEFAULT_POST_DETAIL,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true },
      boardSlug: { type: 'text', label: '게시판 Slug' }, postId: { type: 'number', label: '게시글 번호', min: 1 },
      detailUrl: createRouteUrlField('게시글 연결'), linkLabel: { type: 'text', label: '링크 문구', contentEditable: true },
      audience: { type: 'select', label: '데이터 노출 대상', options: AUDIENCE_OPTIONS },
      showContent: { type: 'radio', label: '본문 요약', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
      emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <G7PostDetailPreview {...props} />,
  },
  G7ProductDetail: {
    label: 'G7 상품 상세', defaultProps: DEFAULT_PRODUCT_DETAIL,
    fields: {
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: { type: 'text', label: '제목', contentEditable: true },
      productKey: { type: 'text', label: '상품 코드 또는 ID' }, detailUrl: createRouteUrlField('상품 연결'),
      buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true },
      audience: { type: 'select', label: '데이터 노출 대상', options: AUDIENCE_OPTIONS },
      showDescription: { type: 'radio', label: '상품 설명', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
      emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <G7ProductDetailPreview {...props} />,
  },
};

export function canonicalPhase4BlockToPuck(block: PageBuilderBlock): { type: Phase4ComponentType; props: Phase4CatalogEditorComponents[Phase4ComponentType] } | null {
  const props = block.props;
  if (block.type === G7_POST_DETAIL_BLOCK_TYPE) return { type: 'G7PostDetail', props: {
    eyebrow: asString(props.eyebrow), heading: asString(props.heading), boardSlug: asString(props.boardSlug),
    postId: Number.isInteger(props.postId) ? Number(props.postId) : 1, detailUrl: asString(props.detailUrl),
    linkLabel: asString(props.linkLabel), audience: audience(props.audience), showContent: props.showContent !== false,
    emptyMessage: asString(props.emptyMessage, DEFAULT_POST_DETAIL.emptyMessage), ...common(block, { surface: 'default', spacing: 'normal' }),
  } };
  if (block.type === G7_PRODUCT_DETAIL_BLOCK_TYPE) return { type: 'G7ProductDetail', props: {
    eyebrow: asString(props.eyebrow), heading: asString(props.heading), productKey: asString(props.productKey),
    detailUrl: asString(props.detailUrl), buttonLabel: asString(props.buttonLabel), audience: audience(props.audience),
    showDescription: props.showDescription !== false, emptyMessage: asString(props.emptyMessage, DEFAULT_PRODUCT_DETAIL.emptyMessage),
    ...common(block, { surface: 'soft', spacing: 'normal' }),
  } };
  return null;
}

export function phase4PuckBlockToCanonical(type: string, raw: Record<string, unknown>, includeAppearance: boolean): { type: string; props: Record<string, unknown> } | null {
  if (type === 'G7PostDetail') return { type: G7_POST_DETAIL_BLOCK_TYPE, props: attachAppearance({
    eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), boardSlug: asString(raw.boardSlug),
    postId: Number(raw.postId) || 1, detailUrl: asString(raw.detailUrl), linkLabel: asString(raw.linkLabel),
    audience: audience(raw.audience), showContent: raw.showContent !== false,
    emptyMessage: asString(raw.emptyMessage, DEFAULT_POST_DETAIL.emptyMessage),
  }, raw, { surface: 'default', spacing: 'normal' }, includeAppearance) };
  if (type === 'G7ProductDetail') return { type: G7_PRODUCT_DETAIL_BLOCK_TYPE, props: attachAppearance({
    eyebrow: asString(raw.eyebrow), heading: asString(raw.heading), productKey: asString(raw.productKey),
    detailUrl: asString(raw.detailUrl), buttonLabel: asString(raw.buttonLabel), audience: audience(raw.audience),
    showDescription: raw.showDescription !== false,
    emptyMessage: asString(raw.emptyMessage, DEFAULT_PRODUCT_DETAIL.emptyMessage),
  }, raw, { surface: 'soft', spacing: 'normal' }, includeAppearance) };
  return null;
}
