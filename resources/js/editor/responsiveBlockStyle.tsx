import React from 'react';
import { usePuck } from '@puckeditor/core';

import type {
  BlockAppearance,
  BlockResponsiveOverride,
  BlockResponsiveOverrides,
  ResponsiveAppearanceOverride,
  ResponsiveLayoutOverride,
} from '../documents/blockPresentation';

export type ResponsiveViewport = 'tablet' | 'mobile';
export type ResponsiveLayoutKind = 'section' | 'columns' | 'stack';
export type CommonResponsiveLayout = Omit<ResponsiveLayoutOverride, 'columns'> & { columns?: 1 | 2 | 3 };

const SURFACES = ['default', 'soft', 'contrast'] as const;
const SPACINGS = ['compact', 'normal', 'spacious'] as const;
const TEXT_SCALES = ['compact', 'balanced', 'large'] as const;
const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
const WIDTHS = ['inherit', 'narrow', 'standard', 'wide', 'full'] as const;
const CONTAINER_ALIGNS = ['left', 'center', 'right', 'stretch'] as const;
const HEIGHTS = ['auto', 'compact', 'medium', 'large', 'viewport'] as const;
const VERTICAL_ALIGNS = ['start', 'center', 'end'] as const;
const LAYOUT_WIDTHS = ['standard', 'wide', 'full'] as const;
const GAPS = ['none', 'compact', 'normal', 'spacious'] as const;

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function choice<T extends string>(value: unknown, options: readonly T[]): T | undefined {
  return typeof value === 'string' && options.includes(value as T) ? value as T : undefined;
}

function normalizeAppearance(value: unknown): ResponsiveAppearanceOverride | undefined {
  const source = record(value);
  const next: ResponsiveAppearanceOverride = {};
  const surface = choice(source.surface, SURFACES);
  const spacing = choice(source.spacing, SPACINGS);
  const textScale = choice(source.textScale, TEXT_SCALES);
  const textAlign = choice(source.textAlign, TEXT_ALIGNS);
  const containerWidth = choice(source.containerWidth, WIDTHS);
  const containerAlign = choice(source.containerAlign, CONTAINER_ALIGNS);
  const minHeight = choice(source.minHeight, HEIGHTS);
  const verticalAlign = choice(source.verticalAlign, VERTICAL_ALIGNS);
  if (surface) next.surface = surface;
  if (spacing) next.spacing = spacing;
  if (textScale) next.textScale = textScale;
  if (textAlign) next.textAlign = textAlign;
  if (containerWidth) next.containerWidth = containerWidth;
  if (containerAlign) next.containerAlign = containerAlign;
  if (minHeight) next.minHeight = minHeight;
  if (verticalAlign) next.verticalAlign = verticalAlign;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeLayout(value: unknown, viewport: ResponsiveViewport): ResponsiveLayoutOverride | undefined {
  const source = record(value);
  const next: ResponsiveLayoutOverride = {};
  const width = choice(source.width, LAYOUT_WIDTHS);
  const spacing = choice(source.spacing, SPACINGS);
  const gap = choice(source.gap, GAPS);
  if (width) next.width = width;
  if (spacing) next.spacing = spacing;
  if (gap) next.gap = gap;
  if (viewport === 'tablet' && (source.columns === 1 || source.columns === 2)) next.columns = source.columns;
  if (viewport === 'mobile' && source.columns === 1) next.columns = 1;
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeViewport(value: unknown, viewport: ResponsiveViewport): BlockResponsiveOverride | undefined {
  const source = record(value);
  const appearance = normalizeAppearance(source.appearance);
  const layout = normalizeLayout(source.layout, viewport);
  return appearance || layout ? { ...(appearance ? { appearance } : {}), ...(layout ? { layout } : {}) } : undefined;
}

export function normalizeResponsiveOverrides(value: unknown): BlockResponsiveOverrides {
  const source = record(value);
  const tablet = normalizeViewport(source.tablet, 'tablet');
  const mobile = normalizeViewport(source.mobile, 'mobile');
  return { ...(tablet ? { tablet } : {}), ...(mobile ? { mobile } : {}) };
}

export function hasResponsiveOverrides(value: unknown): boolean {
  return Object.keys(normalizeResponsiveOverrides(value)).length > 0;
}

export function resolveResponsiveAppearance(
  common: BlockAppearance,
  value: unknown,
  viewport: ResponsiveViewport,
): BlockAppearance {
  const override = normalizeResponsiveOverrides(value)[viewport]?.appearance ?? {};
  return { ...common, ...override };
}

export function resolveResponsiveLayout(
  kind: ResponsiveLayoutKind,
  common: CommonResponsiveLayout,
  value: unknown,
  viewport: ResponsiveViewport,
): ResponsiveLayoutOverride {
  const { columns: commonColumns, ...commonValues } = common;
  const inherited: ResponsiveLayoutOverride = { ...commonValues };
  if (kind === 'columns') inherited.columns = viewport === 'mobile' ? 1 : Math.min(Number(commonColumns ?? 2), 2) as 1 | 2;
  return { ...inherited, ...(normalizeResponsiveOverrides(value)[viewport]?.layout ?? {}) };
}

export function resetResponsivePart(
  value: unknown,
  viewport: ResponsiveViewport,
  part: keyof BlockResponsiveOverride,
): BlockResponsiveOverrides {
  const next = normalizeResponsiveOverrides(value);
  const current = { ...(next[viewport] ?? {}) };
  delete current[part];
  if (Object.keys(current).length > 0) next[viewport] = current;
  else delete next[viewport];
  return next;
}

function updatePart(
  value: unknown,
  viewport: ResponsiveViewport,
  part: keyof BlockResponsiveOverride,
  key: string,
  nextValue: unknown,
): BlockResponsiveOverrides {
  const next = normalizeResponsiveOverrides(value);
  const currentViewport = { ...(next[viewport] ?? {}) };
  const currentPart = { ...record(currentViewport[part]) };
  if (nextValue === '' || nextValue === undefined) delete currentPart[key];
  else currentPart[key] = nextValue;
  if (Object.keys(currentPart).length > 0) currentViewport[part] = currentPart;
  else delete currentViewport[part];
  if (Object.keys(currentViewport).length > 0) next[viewport] = currentViewport;
  else delete next[viewport];
  return normalizeResponsiveOverrides(next);
}

const CLASS_KEYS: ReadonlyArray<[keyof ResponsiveAppearanceOverride, string]> = [
  ['surface', 'surface'], ['spacing', 'spacing'], ['textScale', 'text-scale'], ['textAlign', 'text-align'],
  ['containerWidth', 'container-width'], ['containerAlign', 'container-align'], ['minHeight', 'min-height'],
  ['verticalAlign', 'vertical-align'],
];
const LAYOUT_CLASS_KEYS: ReadonlyArray<[keyof ResponsiveLayoutOverride, string]> = [
  ['width', 'width'], ['spacing', 'spacing'], ['columns', 'columns'], ['gap', 'gap'],
];

export function responsiveClassName(value: unknown): string {
  const responsive = normalizeResponsiveOverrides(value);
  const classes: string[] = [];
  for (const viewport of ['tablet', 'mobile'] as const) {
    const appearance = responsive[viewport]?.appearance;
    const layout = responsive[viewport]?.layout;
    for (const [key, cssKey] of CLASS_KEYS) {
      const item = appearance?.[key];
      if (item !== undefined) classes.push(`g7pb-${viewport}-appearance-${cssKey}--${item}`);
    }
    for (const [key, cssKey] of LAYOUT_CLASS_KEYS) {
      const item = layout?.[key];
      if (item !== undefined) classes.push(`g7pb-${viewport}-layout-${cssKey}--${item}`);
    }
  }
  return classes.join(' ');
}

const appearanceOptions = {
  surface: SURFACES.map((value) => ({ value, label: { default: '기본', soft: '부드럽게', contrast: '강조' }[value] })),
  spacing: SPACINGS.map((value) => ({ value, label: { compact: '좁게', normal: '기본', spacious: '넓게' }[value] })),
  textScale: TEXT_SCALES.map((value) => ({ value, label: { compact: '작게', balanced: '기본', large: '크게' }[value] })),
  textAlign: TEXT_ALIGNS.map((value) => ({ value, label: { left: '왼쪽', center: '가운데', right: '오른쪽' }[value] })),
  containerWidth: WIDTHS.map((value) => ({ value, label: value })),
  containerAlign: CONTAINER_ALIGNS.map((value) => ({ value, label: value })),
  minHeight: HEIGHTS.map((value) => ({ value, label: value })),
  verticalAlign: VERTICAL_ALIGNS.map((value) => ({ value, label: value })),
};

function SelectOverride({
  label, value, inherited, options, readOnly, testId, onChange,
}: {
  label: string;
  value: string;
  inherited: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  readOnly?: boolean;
  testId: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  return <label className="g7pb-design-field"><span>{label}</span>
    <select className="g7pb-field-control" value={value} disabled={readOnly} data-testid={testId}
      onChange={(event) => onChange(event.currentTarget.value)}>
      <option value="">상속 · {inherited}</option>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <small>{value ? `직접 지정 · ${value}` : `공통값에서 상속 · ${inherited}`}</small>
  </label>;
}

function commonAppearanceFromSelection(): BlockAppearance {
  const { selectedItem } = usePuck();
  const props = record((selectedItem as { props?: unknown } | null)?.props);
  return {
    surface: choice(props.surface, SURFACES) ?? 'default',
    spacing: choice(props.spacing, SPACINGS) ?? 'normal',
    textScale: choice(props.textScale, TEXT_SCALES) ?? 'balanced',
    textAlign: choice(props.textAlign, TEXT_ALIGNS) ?? 'left',
    containerWidth: choice(props.containerWidth, WIDTHS) ?? 'inherit',
    containerAlign: choice(props.containerAlign, CONTAINER_ALIGNS) ?? 'center',
    minHeight: choice(props.minHeight, HEIGHTS) ?? 'auto',
    verticalAlign: choice(props.verticalAlign, VERTICAL_ALIGNS) ?? 'start',
  };
}

export function ResponsiveAppearanceField({ value, onChange, readOnly }: {
  value?: BlockResponsiveOverrides;
  onChange: (value: BlockResponsiveOverrides) => void;
  readOnly?: boolean;
}): React.ReactElement {
  const common = commonAppearanceFromSelection();
  const responsive = normalizeResponsiveOverrides(value);
  return <div className="g7pb-layout-inspector-control" data-testid="page-builder-responsive-appearance">
    {(['tablet', 'mobile'] as const).map((viewport) => <fieldset key={viewport}>
      <legend>{viewport === 'tablet' ? '태블릿 640–1023px' : '모바일 0–639px'}</legend>
      {([
        ['surface', '배경', common.surface], ['spacing', '세로 여백', common.spacing],
        ['textScale', '글자 비율', common.textScale ?? 'balanced'], ['textAlign', '글자 정렬', common.textAlign ?? 'left'],
        ['containerWidth', '콘텐츠 폭', common.containerWidth ?? 'inherit'], ['containerAlign', '가로 배치', common.containerAlign ?? 'center'],
        ['minHeight', '최소 높이', common.minHeight ?? 'auto'], ['verticalAlign', '세로 배치', common.verticalAlign ?? 'start'],
      ] as const).map(([key, label, inherited]) => <SelectOverride key={key} label={label}
        value={String(responsive[viewport]?.appearance?.[key] ?? '')} inherited={inherited}
        options={appearanceOptions[key]} readOnly={readOnly} testId={`page-builder-responsive-${viewport}-${key}`}
        onChange={(next) => onChange(updatePart(responsive, viewport, 'appearance', key, next))} />)}
      <button type="button" disabled={readOnly || !responsive[viewport]?.appearance}
        data-testid={`page-builder-responsive-${viewport}-reset`}
        onClick={() => onChange(resetResponsivePart(responsive, viewport, 'appearance'))}>{viewport === 'tablet' ? '태블릿' : '모바일'} 스타일 초기화</button>
    </fieldset>)}
  </div>;
}

function LayoutResponsiveField({ kind, value, onChange, readOnly }: {
  kind: ResponsiveLayoutKind;
  value?: BlockResponsiveOverrides;
  onChange: (value: BlockResponsiveOverrides) => void;
  readOnly?: boolean;
}): React.ReactElement {
  const { selectedItem } = usePuck();
  const common = record((selectedItem as { props?: unknown } | null)?.props);
  const responsive = normalizeResponsiveOverrides(value);
  return <div className="g7pb-layout-inspector-control" data-testid={`page-builder-responsive-layout-${kind}`}>
    {(['tablet', 'mobile'] as const).map((viewport) => {
      const current = responsive[viewport]?.layout;
      return <fieldset key={viewport}><legend>{viewport === 'tablet' ? '태블릿 640–1023px' : '모바일 0–639px'}</legend>
        {kind === 'section' ? <>
          <SelectOverride label="콘텐츠 폭" value={String(current?.width ?? '')} inherited={String(common.width ?? 'standard')}
            options={LAYOUT_WIDTHS.map((item) => ({ value: item, label: item }))} readOnly={readOnly}
            testId={`page-builder-responsive-${viewport}-layout-width`}
            onChange={(next) => onChange(updatePart(responsive, viewport, 'layout', 'width', next))} />
          <SelectOverride label="세로 여백" value={String(current?.spacing ?? '')} inherited={String(common.spacing ?? 'normal')}
            options={appearanceOptions.spacing} readOnly={readOnly} testId={`page-builder-responsive-${viewport}-layout-spacing`}
            onChange={(next) => onChange(updatePart(responsive, viewport, 'layout', 'spacing', next))} />
        </> : <>
          {kind === 'columns' ? viewport === 'tablet' ? <SelectOverride label="열 수" value={String(current?.columns ?? '')}
            inherited={String(Math.min(Number(common.columns ?? 2), 2))} options={[{ value: '1', label: '1열' }, { value: '2', label: '2열' }]}
            readOnly={readOnly} testId="page-builder-responsive-tablet-layout-columns"
            onChange={(next) => onChange(updatePart(responsive, viewport, 'layout', 'columns', next === '' ? '' : Number(next)))} />
            : <p>모바일 열 수 · 1열 고정</p> : null}
          <SelectOverride label="간격" value={String(current?.gap ?? '')} inherited={String(common.gap ?? 'normal')}
            options={GAPS.map((item) => ({ value: item, label: item }))} readOnly={readOnly}
            testId={`page-builder-responsive-${viewport}-layout-gap`}
            onChange={(next) => onChange(updatePart(responsive, viewport, 'layout', 'gap', next))} />
        </>}
        <button type="button" disabled={readOnly || !current} onClick={() => onChange(resetResponsivePart(responsive, viewport, 'layout'))}
          data-testid={`page-builder-responsive-${viewport}-layout-reset`}>{viewport === 'tablet' ? '태블릿' : '모바일'} 레이아웃 초기화</button>
      </fieldset>;
    })}
  </div>;
}

export function createResponsiveAppearanceField() {
  return {
    type: 'custom' as const,
    label: '기기별 공통 스타일',
    render: ({ value, onChange, readOnly }: { value?: BlockResponsiveOverrides; onChange: (value: BlockResponsiveOverrides) => void; readOnly?: boolean }) => (
      <ResponsiveAppearanceField value={value} onChange={onChange} readOnly={readOnly} />
    ),
  };
}

export function createResponsiveLayoutField(kind: ResponsiveLayoutKind) {
  return {
    type: 'custom' as const,
    label: '기기별 레이아웃',
    render: ({ value, onChange, readOnly }: { value?: BlockResponsiveOverrides; onChange: (value: BlockResponsiveOverrides) => void; readOnly?: boolean }) => (
      <LayoutResponsiveField kind={kind} value={value} onChange={onChange} readOnly={readOnly} />
    ),
  };
}
