import { createMotionField } from './blockMotion';
import React from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame } from './CatalogBlockFrame';
import { ComponentComposition } from './ComponentComposition';
import type { CardEditorComponents, CardEditorProps } from './catalogEditorTypes';
import { DEFAULT_BLOCK_MOTION } from './blockMotionData';
import { CARD_SLOT_COMPONENTS } from './ComponentComposition';

const DEFAULT_CARD: CardEditorProps = { variant: 'outlined', surface: 'default', spacing: 'compact', motion: DEFAULT_BLOCK_MOTION, media: [], body: [], actions: [] };

export function cardComponentConfig(structureEnabled = false): Config<CardEditorComponents>['components']['Card'] {
  return {
    label: '카드', defaultProps: DEFAULT_CARD,
    fields: {
      composition: { type: 'custom', label: '내부 요소', render: ({ readOnly }) =>
        <ComponentComposition readOnly={readOnly} structureEnabled={structureEnabled} /> },
      surface: { type: 'radio', label: '배경', options: [{ label: '기본', value: 'default' }, { label: '부드럽게', value: 'soft' }, { label: '강조', value: 'contrast' }] },
      spacing: { type: 'radio', label: '여백', options: [{ label: '좁게', value: 'compact' }, { label: '기본', value: 'normal' }, { label: '넓게', value: 'spacious' }] },
      motion: createMotionField(['none', 'reveal']),
      variant: { type: 'radio', label: '카드 테두리', options: [{ label: '없음', value: 'plain' }, { label: '선', value: 'outlined' }] },
      media: { type: 'slot', label: '이미지', allow: structureEnabled ? [...CARD_SLOT_COMPONENTS.media] : [] },
      body: { type: 'slot', label: '본문', allow: structureEnabled ? [...CARD_SLOT_COMPONENTS.body] : [] },
      actions: { type: 'slot', label: '버튼', allow: structureEnabled ? [...CARD_SLOT_COMPONENTS.actions] : [] },
    },
    render: ({ media, body, actions, variant, surface, spacing, ...props }) => <CatalogBlockFrame {...props} type="card">
      <article className={`g7pb-single-card g7pb-single-card--${variant} g7pb-preview-surface--${surface} g7pb-surface--${surface} g7pb-spacing--${spacing}`}>
        <div data-card-slot="media">{media({ minEmptyHeight: 48 })}</div>
        <div data-card-slot="body">{body({ minEmptyHeight: 64 })}</div>
        <div data-card-slot="actions">{actions({ minEmptyHeight: 48 })}</div>
      </article>
    </CatalogBlockFrame>,
  };
}
