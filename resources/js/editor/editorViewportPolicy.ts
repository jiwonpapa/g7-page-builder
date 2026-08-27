export const PC_EDITOR_VIEWPORT_WIDTH = 1280;
export const TABLET_PREVIEW_VIEWPORT_WIDTH = 768;
export const MOBILE_PREVIEW_VIEWPORT_WIDTH = 360;
export const PC_EDITOR_MIN_HOST_WIDTH = 1024;

export const PC_EDITOR_POLICY_NOTICE = '편집은 PC에서만 지원합니다. 모바일·태블릿은 반응형 미리보기 전용입니다.';

export interface EditorViewportPolicy {
  canEdit: boolean;
  canvasWidth: number | '100%';
  hostSupported: boolean;
  mode: 'edit' | 'preview';
  status: string;
}

export interface EditorFieldContract {
  arrayFields?: Record<string, EditorFieldContract>;
  contentEditable?: boolean;
  filterFields?: Record<string, EditorFieldContract>;
  objectFields?: Record<string, EditorFieldContract>;
  [key: string]: unknown;
}

export function applyEditorContentPolicy<T extends Record<string, EditorFieldContract>>(
  fields: T,
  canEdit: boolean,
): T {
  if (canEdit) return fields;

  const makeReadOnly = (field: EditorFieldContract): EditorFieldContract => {
    const nested = (value: Record<string, EditorFieldContract> | undefined): Record<string, EditorFieldContract> | undefined => (
      value ? Object.fromEntries(Object.entries(value).map(([name, child]) => [name, makeReadOnly(child)])) : value
    );
    return {
      ...field,
      ...(field.contentEditable === true ? { contentEditable: false } : {}),
      ...(field.arrayFields ? { arrayFields: nested(field.arrayFields) } : {}),
      ...(field.objectFields ? { objectFields: nested(field.objectFields) } : {}),
      ...(field.filterFields ? { filterFields: nested(field.filterFields) } : {}),
    };
  };

  return Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, makeReadOnly(field)])) as T;
}

export function initialEditorCanvasWidth(hostWidth: number): number {
  if (hostWidth < 640) return MOBILE_PREVIEW_VIEWPORT_WIDTH;
  if (hostWidth < PC_EDITOR_MIN_HOST_WIDTH) return TABLET_PREVIEW_VIEWPORT_WIDTH;
  return PC_EDITOR_VIEWPORT_WIDTH;
}

export function resolveEditorViewportPolicy({
  canvasWidth,
  disabled,
  hostWidth,
}: {
  canvasWidth: number | '100%';
  disabled: boolean;
  hostWidth: number;
}): EditorViewportPolicy {
  const hostSupported = hostWidth >= PC_EDITOR_MIN_HOST_WIDTH;
  const canEdit = !disabled && hostSupported && canvasWidth === PC_EDITOR_VIEWPORT_WIDTH;
  const status = disabled
    ? '현재 문서는 읽기 전용입니다.'
    : !hostSupported
      ? '현재 기기에서는 편집할 수 없습니다.'
      : canvasWidth !== PC_EDITOR_VIEWPORT_WIDTH
        ? '현재 미리보기 전용입니다. PC 뷰포트로 전환하면 편집할 수 있습니다.'
        : 'PC 편집 모드입니다.';

  return {
    canEdit,
    canvasWidth,
    hostSupported,
    mode: canEdit ? 'edit' : 'preview',
    status,
  };
}
