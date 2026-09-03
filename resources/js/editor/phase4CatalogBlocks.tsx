import React from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame as Frame } from './CatalogBlockFrame';
import { createRouteUrlField } from './RouteUrlField';
import { createInlineRichTextField, RichTextCanvasField } from './richTextEditing';
import { createMotionField } from './blockMotion';
import type { AppearanceEditorProps } from './catalogAppearance';
import {
  type G7PostDetailEditorProps,
  type G7ProductDetailEditorProps,
  type Phase4CatalogEditorComponents,
  DEFAULT_POST_DETAIL,
  DEFAULT_PRODUCT_DETAIL,
  audience,
} from './phase4CatalogData';
export type {
  G7PostDetailEditorProps,
  G7ProductDetailEditorProps,
  Phase4CatalogEditorComponents,
  Phase4ComponentType,
} from './phase4CatalogData';
export { canonicalPhase4BlockToPuck, phase4PuckBlockToCanonical } from './phase4CatalogCodec';

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

function surfaceClass(props: AppearanceEditorProps): string {
  return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`;
}

function G7PostDetailPreview(props: G7PostDetailEditorProps & { id: string }): React.ReactElement {
  return <Frame id={props.id} type="g7-post-detail" motion={props.motion} elementStyles={props.elementStyles}>
    <div className={`g7pb-preview-data-detail g7pb-preview-data-detail--post ${surfaceClass(props)}`}>
      <header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header>
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
      <header><small data-g7pb-inline-field="eyebrow">{props.eyebrow}</small><RichTextCanvasField as="h2" className="g7pb-preview-richtext" fieldPath="heading">{props.heading}</RichTextCanvasField></header>
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
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'),
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
      eyebrow: { type: 'text', label: '보조 문구', contentEditable: true }, heading: createInlineRichTextField('제목'),
      productKey: { type: 'text', label: '상품 코드 또는 ID' }, detailUrl: createRouteUrlField('상품 연결'),
      buttonLabel: { type: 'text', label: '버튼 문구', contentEditable: true },
      audience: { type: 'select', label: '데이터 노출 대상', options: AUDIENCE_OPTIONS },
      showDescription: { type: 'radio', label: '상품 설명', options: [{ label: '표시', value: true }, { label: '숨김', value: false }] },
      emptyMessage: { type: 'text', label: '빈 상태 문구' }, ...appearanceFields, motion: createMotionField(['none', 'reveal']),
    },
    render: (props) => <G7ProductDetailPreview {...props} />,
  },
};
