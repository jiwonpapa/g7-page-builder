import type { BlockAppearance } from '../documents/types';

export interface BlockContainerEditorProps {
  containerWidth: NonNullable<BlockAppearance['containerWidth']>;
  containerAlign: NonNullable<BlockAppearance['containerAlign']>;
  minHeight: NonNullable<BlockAppearance['minHeight']>;
  verticalAlign: NonNullable<BlockAppearance['verticalAlign']>;
}

export const BLOCK_CONTAINER_FIELDS = {
  containerWidth: { type: 'select' as const, label: '블록 콘텐츠 폭', options: [
    { label: '페이지 설정', value: 'inherit' }, { label: '좁게', value: 'narrow' },
    { label: '기본', value: 'standard' }, { label: '넓게', value: 'wide' }, { label: '화면 전체', value: 'full' },
  ] },
  containerAlign: { type: 'select' as const, label: '가로 배치', options: [
    { label: '가운데', value: 'center' }, { label: '왼쪽', value: 'left' },
    { label: '오른쪽', value: 'right' }, { label: '늘이기', value: 'stretch' },
  ] },
  minHeight: { type: 'select' as const, label: '블록 높이', options: [
    { label: '내용에 맞춤', value: 'auto' }, { label: '작게', value: 'compact' },
    { label: '중간', value: 'medium' }, { label: '크게', value: 'large' }, { label: '화면 높이 100%', value: 'viewport' },
  ] },
  verticalAlign: { type: 'select' as const, label: '세로 배치', options: [
    { label: '위', value: 'start' }, { label: '가운데', value: 'center' }, { label: '아래', value: 'end' },
  ] },
};

const SURFACES = new Set<BlockAppearance['surface']>(['default', 'soft', 'contrast']);
const SPACINGS = new Set<BlockAppearance['spacing']>(['compact', 'normal', 'spacious']);
const TEXT_SCALES = new Set<NonNullable<BlockAppearance['textScale']>>(['compact', 'balanced', 'large']);
const TEXT_ALIGNS = new Set<NonNullable<BlockAppearance['textAlign']>>(['left', 'center', 'right']);
const WIDTHS = new Set<NonNullable<BlockAppearance['containerWidth']>>(['inherit', 'narrow', 'standard', 'wide', 'full']);
const CONTAINER_ALIGNS = new Set<NonNullable<BlockAppearance['containerAlign']>>(['left', 'center', 'right', 'stretch']);
const HEIGHTS = new Set<NonNullable<BlockAppearance['minHeight']>>(['auto', 'compact', 'medium', 'large', 'viewport']);
const VERTICAL_ALIGNS = new Set<NonNullable<BlockAppearance['verticalAlign']>>(['start', 'center', 'end']);

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function preset<T extends string>(values: ReadonlySet<T>, value: unknown): T | undefined {
  return typeof value === 'string' && values.has(value as T) ? value as T : undefined;
}

export function normalizeBlockAppearance(
  value: unknown,
  fallback: Pick<BlockAppearance, 'surface' | 'spacing'>,
): BlockAppearance {
  const source = record(value);
  const appearance: BlockAppearance = {
    surface: preset(SURFACES, source.surface) ?? fallback.surface,
    spacing: preset(SPACINGS, source.spacing) ?? fallback.spacing,
  };
  const textScale = preset(TEXT_SCALES, source.textScale);
  const textAlign = preset(TEXT_ALIGNS, source.textAlign);
  const containerWidth = preset(WIDTHS, source.containerWidth);
  const containerAlign = preset(CONTAINER_ALIGNS, source.containerAlign);
  const minHeight = preset(HEIGHTS, source.minHeight);
  const verticalAlign = preset(VERTICAL_ALIGNS, source.verticalAlign);
  if (textScale && textScale !== 'balanced') appearance.textScale = textScale;
  if (textAlign && textAlign !== 'left') appearance.textAlign = textAlign;
  if (containerWidth && containerWidth !== 'inherit') appearance.containerWidth = containerWidth;
  if (containerAlign && containerAlign !== 'center') appearance.containerAlign = containerAlign;
  if (minHeight && minHeight !== 'auto') appearance.minHeight = minHeight;
  if (verticalAlign && verticalAlign !== 'start') appearance.verticalAlign = verticalAlign;
  return appearance;
}

export function blockAppearanceClassName(appearance: BlockAppearance): string {
  return [
    `g7pb-surface--${appearance.surface}`,
    `g7pb-spacing--${appearance.spacing}`,
    `g7pb-text-scale--${appearance.textScale ?? 'balanced'}`,
    `g7pb-text-align--${appearance.textAlign ?? 'left'}`,
    blockContainerClassName(appearance),
  ].join(' ');
}

export function blockContainerClassName(appearance: BlockAppearance): string {
  return [
    `g7pb-container-width--${appearance.containerWidth ?? 'inherit'}`,
    `g7pb-container-align--${appearance.containerAlign ?? 'center'}`,
    `g7pb-container-height--${appearance.minHeight ?? 'auto'}`,
    `g7pb-container-vertical--${appearance.verticalAlign ?? 'start'}`,
  ].join(' ');
}

export function blockContainerEditorProps(value: unknown): BlockContainerEditorProps {
  const appearance = normalizeBlockAppearance(value, { surface: 'default', spacing: 'normal' });
  return {
    containerWidth: appearance.containerWidth ?? 'inherit',
    containerAlign: appearance.containerAlign ?? 'center',
    minHeight: appearance.minHeight ?? 'auto',
    verticalAlign: appearance.verticalAlign ?? 'start',
  };
}

export function mergeBlockContainerAppearance(
  current: unknown,
  editor: Record<string, unknown>,
): BlockAppearance | undefined {
  const existing = record(current);
  const container = blockContainerEditorProps(editor);
  const next: Record<string, unknown> = { ...existing };
  delete next.containerWidth;
  delete next.containerAlign;
  delete next.minHeight;
  delete next.verticalAlign;
  if (container.containerWidth !== 'inherit') next.containerWidth = container.containerWidth;
  if (container.containerAlign !== 'center') next.containerAlign = container.containerAlign;
  if (container.minHeight !== 'auto') next.minHeight = container.minHeight;
  if (container.verticalAlign !== 'start') next.verticalAlign = container.verticalAlign;
  if (Object.keys(next).length > 0 && typeof next.surface !== 'string') {
    next.surface = editor.surface === 'soft' || editor.surface === 'contrast' ? editor.surface : 'default';
  }
  if (Object.keys(next).length > 0 && typeof next.spacing !== 'string') {
    next.spacing = editor.spacing === 'compact' || editor.spacing === 'spacious' ? editor.spacing : 'normal';
  }
  if (Object.keys(next).length === 0) return undefined;
  return next as unknown as BlockAppearance;
}
