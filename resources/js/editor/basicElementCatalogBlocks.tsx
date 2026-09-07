import React from 'react';
import type { Config } from '@puckeditor/core';
import { CatalogBlockFrame } from './CatalogBlockFrame';
import { CatalogIcon } from './catalogIcon';
import { ICON_OPTIONS } from './foundationCatalogData';
import { inlineArrayContent } from './previewContent';
import { createMotionField } from './blockMotion';
import type { AppearanceEditorProps } from './catalogAppearance';
import { DEFAULT_BADGE, DEFAULT_ICON, DEFAULT_LIST, isBasicIcon, type BasicElementEditorComponents, type BadgeEditorProps, type IconEditorProps, type ListEditorProps } from './basicElementCatalogData';

function appearanceClass(props: AppearanceEditorProps): string {
  return `g7pb-preview-surface--${props.surface} g7pb-preview-spacing--${props.spacing} g7pb-text-scale--${props.textScale ?? 'balanced'} g7pb-text-align--${props.textAlign ?? 'left'}`;
}

export function IconPreview(props: IconEditorProps & { id: string }): React.ReactElement {
  return <CatalogBlockFrame {...props} type="icon"><div className={appearanceClass(props)}>
    <span className={`g7pb-basic-icon g7pb-basic-size--${props.size} g7pb-basic-tone--${props.tone}`}
      role={props.decorative ? undefined : 'img'} aria-hidden={props.decorative ? true : undefined} aria-label={props.decorative ? undefined : props.label}>
      <CatalogIcon name={isBasicIcon(props.icon) ? props.icon : 'star'} />
    </span>
  </div></CatalogBlockFrame>;
}

export function ListPreview(props: ListEditorProps & { id: string }): React.ReactElement {
  const Tag = props.ordered ? 'ol' : 'ul';
  return <CatalogBlockFrame {...props} type="list"><div className={appearanceClass(props)}>
    <Tag className="g7pb-basic-list">{props.items.map((item, index) => <li key={index} data-g7pb-inline-field={`items.${index}.text`}>
      {inlineArrayContent(props.items, index, 'text', item.text)}
    </li>)}</Tag>
  </div></CatalogBlockFrame>;
}

export function BadgePreview(props: BadgeEditorProps & { id: string }): React.ReactElement {
  return <CatalogBlockFrame {...props} type="badge"><div className={appearanceClass(props)}>
    <span className={`g7pb-basic-badge g7pb-basic-size--${props.size} g7pb-basic-tone--${props.tone}`}>
      {isBasicIcon(props.icon) ? <CatalogIcon name={props.icon} /> : null}
      <span data-g7pb-inline-field="label">{props.label}</span>
    </span>
  </div></CatalogBlockFrame>;
}

const tone = { type: 'select', label: '색상', options: [{ label: '본문색', value: 'default' }, { label: '보조색', value: 'muted' }, { label: '강조색', value: 'accent' }] } as const;
const size = { type: 'select', label: '크기', options: [{ label: '작게', value: 'small' }, { label: '보통', value: 'medium' }, { label: '크게', value: 'large' }] } as const;
const commonFields = {
  elementStyles: { type: 'custom', label: '캔버스 요소 스타일', render: () => <></> },
  surface: { type: 'radio', label: '배경', options: [{ label: '기본', value: 'default' }, { label: '부드럽게', value: 'soft' }, { label: '강조', value: 'contrast' }] },
  spacing: { type: 'radio', label: '여백', options: [{ label: '좁게', value: 'compact' }, { label: '기본', value: 'normal' }, { label: '넓게', value: 'spacious' }] },
  motion: createMotionField(['none', 'reveal']),
} satisfies Partial<NonNullable<Config<BasicElementEditorComponents>['components']['Icon']['fields']>>;

export const basicElementComponentConfigs: Config<BasicElementEditorComponents>['components'] = {
  Icon: {
    label: '아이콘', defaultProps: DEFAULT_ICON,
    fields: { icon: { type: 'select', label: '아이콘', options: ICON_OPTIONS }, size, tone,
      decorative: { type: 'radio', label: '아이콘 용도', options: [{ label: '장식', value: true }, { label: '의미 전달', value: false }] },
      label: { type: 'text', label: '접근성 이름 (의미 전달 시 필수)' }, ...commonFields },
    render: (props) => <IconPreview {...props} />,
  },
  List: {
    label: '목록', defaultProps: DEFAULT_LIST,
    fields: { ordered: { type: 'radio', label: '목록 형식', options: [{ label: '글머리 기호', value: false }, { label: '번호', value: true }] },
      items: { type: 'array', label: '항목 (1~20개, 항목당 200자)', min: 1, max: 20,
        defaultItemProps: (index) => ({ text: `항목 ${index + 1}` }), getItemSummary: (item) => item.text,
        arrayFields: { text: { type: 'text', label: '항목 문구', contentEditable: true } } }, ...commonFields },
    render: (props) => <ListPreview {...props} />,
  },
  Badge: {
    label: '배지', defaultProps: DEFAULT_BADGE,
    fields: { label: { type: 'text', label: '문구 (40자 이내)', contentEditable: true },
      icon: { type: 'select', label: '아이콘', options: [{ label: '없음', value: '' }, ...ICON_OPTIONS] }, size, tone, ...commonFields },
    render: (props) => <BadgePreview {...props} />,
  },
};
