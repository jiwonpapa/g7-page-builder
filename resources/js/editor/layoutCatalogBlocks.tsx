import React from 'react';
import type { Config, Slot } from '@puckeditor/core';
import type { BlockAppearance, BlockMotion, ElementAppearanceMap } from '../documents/types';

interface LayoutInternalEditorProps {
  surface?: BlockAppearance['surface'];
  spacing?: BlockAppearance['spacing'];
  elementStyles?: ElementAppearanceMap;
  motion?: BlockMotion;
}

export interface LayoutSectionEditorProps extends LayoutInternalEditorProps {
  width: 'standard' | 'wide' | 'full';
  spacing: 'compact' | 'normal' | 'spacious';
  content: Slot;
}

export interface LayoutColumnsEditorProps extends LayoutInternalEditorProps {
  columns: '2';
  ratio: '1:1' | '1:2' | '2:1';
  gap: 'compact' | 'normal' | 'spacious';
  column1: Slot;
  column2: Slot;
}

export interface LayoutCatalogEditorComponents {
  LayoutSection: LayoutSectionEditorProps;
  LayoutColumns: LayoutColumnsEditorProps;
}

const defaultLayout = {
  width: 'standard',
  spacing: 'normal',
  content: [{
    type: 'LayoutColumns',
    props: {
      columns: '2',
      ratio: '1:1',
      gap: 'normal',
      column1: [{
        type: 'Heading',
        props: { eyebrow: '', heading: '제목을 입력하세요', level: '2', anchor: '' },
      }],
      column2: [{
        type: 'RichText',
        props: { content: '<p>본문을 입력하세요.</p>', measure: 'standard' },
      }],
    },
  }],
} as unknown as LayoutSectionEditorProps;

export const layoutCatalogComponentConfigs: Config<LayoutCatalogEditorComponents>['components'] = {
  LayoutSection: {
    label: 'Section · 2열 기본',
    defaultProps: defaultLayout,
    fields: {
      width: {
        type: 'radio', label: '콘텐츠 폭', options: [
          { label: '기본', value: 'standard' },
          { label: '넓게', value: 'wide' },
          { label: '화면 전체', value: 'full' },
        ],
      },
      spacing: {
        type: 'radio', label: '세로 여백', options: [
          { label: '좁게', value: 'compact' },
          { label: '기본', value: 'normal' },
          { label: '넓게', value: 'spacious' },
        ],
      },
      content: { type: 'slot', allow: ['LayoutColumns'] },
    },
    render: ({ content: Content, width, spacing }) => (
      <section className={`g7pb-preview-layout-section g7pb-preview-layout-section--${width} g7pb-preview-layout-section--${spacing}`} data-testid="page-builder-layout-section">
        <Content minEmptyHeight={120} />
      </section>
    ),
  },
  LayoutColumns: {
    label: '2열 Columns',
    defaultProps: {
      columns: '2', ratio: '1:1', gap: 'normal', column1: [], column2: [],
    },
    fields: {
      columns: { type: 'radio', label: '열 수', options: [{ label: '2열', value: '2' }] },
      ratio: {
        type: 'radio', label: '열 비율', options: [
          { label: '1 : 1', value: '1:1' },
          { label: '1 : 2', value: '1:2' },
          { label: '2 : 1', value: '2:1' },
        ],
      },
      gap: {
        type: 'radio', label: '열 간격', options: [
          { label: '좁게', value: 'compact' },
          { label: '기본', value: 'normal' },
          { label: '넓게', value: 'spacious' },
        ],
      },
      column1: { type: 'slot', allow: ['Heading', 'RichText'] },
      column2: { type: 'slot', allow: ['Heading', 'RichText'] },
    },
    render: ({ column1: Column1, column2: Column2, ratio, gap }) => (
      <div className={`g7pb-preview-layout-columns g7pb-preview-layout-columns--${ratio.replace(':', '-')} g7pb-preview-layout-columns--gap-${gap}`} data-testid="page-builder-layout-columns">
        <div className="g7pb-preview-layout-columns__column"><Column1 minEmptyHeight={96} /></div>
        <div className="g7pb-preview-layout-columns__column"><Column2 minEmptyHeight={96} /></div>
      </div>
    ),
  },
};
