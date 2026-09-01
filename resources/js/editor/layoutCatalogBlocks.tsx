import React from 'react';
import { usePuck, type Config, type Slot } from '@puckeditor/core';
import type { BlockAppearance, BlockMotion, ElementAppearanceMap } from '../documents/types';

interface LayoutInternalEditorProps {
  surface?: BlockAppearance['surface'];
  spacing?: BlockAppearance['spacing'];
  elementStyles?: ElementAppearanceMap;
  motion?: BlockMotion;
  structureInsert?: string;
  structureDelete?: string;
}

export interface LayoutSectionEditorProps extends LayoutInternalEditorProps {
  width: 'standard' | 'wide' | 'full';
  spacing: 'compact' | 'normal' | 'spacious';
  content: Slot;
}

export type LayoutColumnCount = '1' | '2' | '3';
export type LayoutColumnRatio = '1' | '1:1' | '1:2' | '2:1' | '1:1:1';

export interface LayoutColumnsEditorProps extends LayoutInternalEditorProps {
  columns: LayoutColumnCount;
  ratio: LayoutColumnRatio;
  gap: 'none' | 'compact' | 'normal' | 'spacious';
  column1: Slot;
  column2?: Slot;
  column3?: Slot;
}

export interface LayoutStackEditorProps extends LayoutInternalEditorProps {
  gap: 'none' | 'compact' | 'normal' | 'spacious';
  content: Slot;
}

export interface LayoutCatalogEditorComponents {
  LayoutSection: LayoutSectionEditorProps;
  LayoutColumns: LayoutColumnsEditorProps;
  LayoutStack: LayoutStackEditorProps;
}

type LayoutPuckItem = {
  type: keyof LayoutCatalogEditorComponents | string;
  props: Record<string, unknown> & { id: string };
};

const LEAF_COMPONENTS = ['Heading', 'RichText', 'Image', 'Buttons', 'Divider'] as const;
const SECTION_COMPONENTS = ['LayoutColumns', 'LayoutStack', ...LEAF_COMPONENTS] as const;
const COLUMN_COMPONENTS = ['LayoutStack', ...LEAF_COMPONENTS] as const;
const COLUMN_RATIO_OPTIONS: Record<LayoutColumnCount, ReadonlyArray<{ label: string; value: LayoutColumnRatio }>> = {
  '1': [{ label: '1열', value: '1' }],
  '2': [
    { label: '1 : 1', value: '1:1' },
    { label: '1 : 2', value: '1:2' },
    { label: '2 : 1', value: '2:1' },
  ],
  '3': [{ label: '1 : 1 : 1', value: '1:1:1' }],
};

function newLayoutId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `layout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slotValue(props: Record<string, unknown>, name: string): Slot {
  return Array.isArray(props[name]) ? props[name] as Slot : [];
}

function nestedItemCount(items: Slot): number {
  return items.reduce((total, item) => {
    const props = (item as LayoutPuckItem).props ?? {};
    const children = ['content', 'column1', 'column2', 'column3']
      .flatMap((name) => slotValue(props, name));
    return total + 1 + nestedItemCount(children);
  }, 0);
}

export interface LayoutColumnsResizeResult {
  props: LayoutColumnsEditorProps & Record<string, unknown>;
  movedNodes: number;
  targetSlot: `column${1 | 2 | 3}`;
}

export function resizeLayoutColumnsEditorProps(
  value: LayoutColumnsEditorProps & Record<string, unknown>,
  columns: LayoutColumnCount,
): LayoutColumnsResizeResult {
  const count = Number(columns) as 1 | 2 | 3;
  const currentCount = Number(value.columns) as 1 | 2 | 3;
  const targetSlot = `column${count}` as LayoutColumnsResizeResult['targetSlot'];
  const removed = Array.from({ length: Math.max(0, currentCount - count) }, (_, index) => (
    slotValue(value, `column${count + index + 1}`)
  )).flat();
  const allowedRatios = COLUMN_RATIO_OPTIONS[columns].map(({ value: ratio }) => ratio);
  const ratio = allowedRatios.includes(value.ratio) ? value.ratio : allowedRatios[0]!;
  const props = structuredClone(value) as LayoutColumnsEditorProps & Record<string, unknown>;
  props.columns = columns;
  props.ratio = ratio;
  for (let index = 1; index <= count; index++) props[`column${index}`] = slotValue(props, `column${index}`);
  props[targetSlot] = [...slotValue(props, targetSlot), ...removed];
  for (let index = count + 1; index <= 3; index++) delete props[`column${index}`];
  return { props, movedNodes: nestedItemCount(removed), targetSlot };
}

function useSelectedLayoutItem(): {
  item: LayoutPuckItem | null;
  dispatch: ReturnType<typeof usePuck>['dispatch'];
  selector: { index: number; zone: string } | null;
} {
  const { dispatch, getSelectorForId, selectedItem } = usePuck();
  const item = selectedItem as LayoutPuckItem | null;
  const selector = item ? getSelectorForId(item.props.id) ?? null : null;
  return { item, dispatch, selector };
}

function ColumnsCountField({ value, readOnly }: { value: LayoutColumnCount; readOnly?: boolean }): React.ReactElement {
  const { item, dispatch, selector } = useSelectedLayoutItem();
  const [pending, setPending] = React.useState<LayoutColumnsResizeResult | null>(null);

  React.useEffect(() => setPending(null), [value]);

  const apply = (result: LayoutColumnsResizeResult): void => {
    if (!item || !selector || item.type !== 'LayoutColumns') return;
    dispatch({
      type: 'replace', destinationIndex: selector.index, destinationZone: selector.zone,
      data: { ...item, props: result.props } as never,
      ui: { itemSelector: selector }, recordHistory: true,
    });
    setPending(null);
  };
  const request = (next: LayoutColumnCount): void => {
    if (!item || item.type !== 'LayoutColumns' || next === value) return;
    const result = resizeLayoutColumnsEditorProps(
      item.props as unknown as LayoutColumnsEditorProps & Record<string, unknown>, next,
    );
    if (result.movedNodes > 0 && Number(next) < Number(value)) setPending(result);
    else apply(result);
  };

  return <div className="g7pb-layout-inspector-control" data-testid="page-builder-layout-column-count">
    <div role="group" aria-label="열 수">
      {(['1', '2', '3'] as const).map((count) => <button type="button" key={count}
        disabled={readOnly} aria-pressed={value === count} onClick={() => request(count)}>{count}열</button>)}
    </div>
    {pending ? <div className="g7pb-layout-inspector-confirm" role="alert" data-testid="page-builder-layout-column-confirm">
      <strong>{pending.movedNodes}개 콘텐츠를 {pending.targetSlot} 끝으로 이동합니다.</strong>
      <span>열을 줄여도 콘텐츠는 삭제하지 않고 기존 순서를 유지합니다.</span>
      <div><button type="button" onClick={() => setPending(null)}>취소</button>
        <button type="button" onClick={() => apply(pending)}>이동 후 변경</button></div>
    </div> : null}
  </div>;
}

function StructureInsertField({ readOnly }: { readOnly?: boolean }): React.ReactElement {
  const { item, dispatch } = useSelectedLayoutItem();
  const [message, setMessage] = React.useState('');

  if (!item || (item.type !== 'LayoutSection' && item.type !== 'LayoutColumns')) return <></>;

  const insert = (zoneName: string, componentType: 'LayoutColumns' | 'LayoutStack', columns: LayoutColumnCount = '2'): void => {
    const items = slotValue(item.props, zoneName);
    if (items.length >= 200) {
      setMessage(`${zoneName}은 최대 200개까지 배치할 수 있습니다.`);
      return;
    }
    const id = newLayoutId();
    const destinationZone = `${item.props.id}:${zoneName}`;
    const destinationIndex = items.length;
    dispatch({ type: 'insert', componentType, destinationIndex, destinationZone, id, recordHistory: true });
    if (componentType === 'LayoutColumns' && columns !== '2') {
      dispatch({
        type: 'replace', destinationIndex, destinationZone,
        data: {
          type: 'LayoutColumns', props: {
            id, columns, ratio: columns === '1' ? '1' : '1:1:1', gap: 'normal',
            column1: [], ...(columns !== '1' ? { column2: [] } : {}), ...(columns === '3' ? { column3: [] } : {}),
          },
        } as never,
        recordHistory: false,
      });
    }
    setMessage(componentType === 'LayoutStack' ? '세로 Stack을 추가했습니다.' : `${columns}열 Columns를 추가했습니다.`);
  };

  return <div className="g7pb-layout-inspector-control" data-testid="page-builder-layout-structure-insert">
    {item.type === 'LayoutSection' ? <>
      <span>Section에 구조 추가</span>
      <div role="group" aria-label="Section 구조 추가">
        {(['1', '2', '3'] as const).map((columns) => <button type="button" key={columns} disabled={readOnly}
          onClick={() => insert('content', 'LayoutColumns', columns)}>{columns}열</button>)}
        <button type="button" disabled={readOnly} onClick={() => insert('content', 'LayoutStack')}>Stack</button>
      </div>
      <small>허용: Columns, Stack, 제목, 본문, 이미지, 버튼, 구분선</small>
    </> : <>
      <span>열 안에 Stack 추가</span>
      <div role="group" aria-label="열별 Stack 추가">
        {Array.from({ length: Number(item.props.columns) || 2 }, (_, index) => <button type="button" key={index}
          disabled={readOnly} onClick={() => insert(`column${index + 1}`, 'LayoutStack')}>{index + 1}열</button>)}
      </div>
      <small>각 열에는 Stack 또는 기본 콘텐츠 5종만 배치할 수 있습니다.</small>
    </>}
    {message ? <output>{message}</output> : null}
  </div>;
}

function StructureDeleteField({ readOnly }: { readOnly?: boolean }): React.ReactElement {
  const { item, dispatch, selector } = useSelectedLayoutItem();
  const [pending, setPending] = React.useState(false);
  if (!item || !['LayoutSection', 'LayoutColumns', 'LayoutStack'].includes(item.type)) return <></>;
  const childCount = nestedItemCount(['content', 'column1', 'column2', 'column3'].flatMap((name) => slotValue(item.props, name)));
  const remove = (): void => {
    if (!selector) return;
    dispatch({ type: 'remove', index: selector.index, zone: selector.zone, recordHistory: true });
  };
  return <div className="g7pb-layout-inspector-control g7pb-layout-inspector-control--danger" data-testid="page-builder-layout-delete">
    <button type="button" disabled={readOnly} onClick={() => childCount > 0 ? setPending(true) : remove()}>구조 삭제</button>
    {pending ? <div className="g7pb-layout-inspector-confirm" role="alert">
      <strong>내부 콘텐츠 {childCount}개도 함께 삭제됩니다.</strong>
      <div><button type="button" onClick={() => setPending(false)}>취소</button>
        <button type="button" onClick={remove}>구조와 콘텐츠 삭제</button></div>
    </div> : null}
  </div>;
}

const defaultLayout = {
  width: 'standard', spacing: 'normal',
  content: [{
    type: 'LayoutColumns',
    props: {
      columns: '2', ratio: '1:1', gap: 'normal',
      column1: [{ type: 'Heading', props: { eyebrow: '', heading: '제목을 입력하세요', level: '2', anchor: '' } }],
      column2: [{ type: 'RichText', props: { content: '<p>본문을 입력하세요.</p>', measure: 'standard' } }],
    },
  }],
} as unknown as LayoutSectionEditorProps;

const GAP_FIELD = {
  type: 'radio' as const, label: '간격', options: [
    { label: '없음', value: 'none' },
    { label: '좁게', value: 'compact' },
    { label: '기본', value: 'normal' },
    { label: '넓게', value: 'spacious' },
  ],
};

const STRUCTURE_DELETE_FIELD = {
  type: 'custom' as const, label: '구조 삭제', render: ({ readOnly }: { readOnly?: boolean }) => <StructureDeleteField readOnly={readOnly} />,
};

export const layoutCatalogComponentConfigs: Config<LayoutCatalogEditorComponents>['components'] = {
  LayoutSection: {
    label: 'Section · 구조 컨테이너',
    defaultProps: defaultLayout,
    permissions: { delete: false },
    fields: {
      structureInsert: { type: 'custom', label: '구조 추가', render: ({ readOnly }) => <StructureInsertField readOnly={readOnly} /> },
      width: { type: 'radio', label: '콘텐츠 폭', options: [
        { label: '기본', value: 'standard' }, { label: '넓게', value: 'wide' }, { label: '화면 전체', value: 'full' },
      ] },
      spacing: { type: 'radio', label: '세로 여백', options: [
        { label: '좁게', value: 'compact' }, { label: '기본', value: 'normal' }, { label: '넓게', value: 'spacious' },
      ] },
      content: { type: 'slot', allow: [...SECTION_COMPONENTS] },
      structureDelete: STRUCTURE_DELETE_FIELD,
    },
    render: ({ content: Content, width, spacing }) => (
      <section className={`g7pb-preview-layout-section g7pb-preview-layout-section--${width} g7pb-preview-layout-section--${spacing}`} data-testid="page-builder-layout-section">
        <span className="g7pb-preview-layout-label">Section</span><Content minEmptyHeight={120} />
      </section>
    ),
  },
  LayoutColumns: {
    label: 'Columns · 1/2/3열',
    defaultProps: { columns: '2', ratio: '1:1', gap: 'normal', column1: [], column2: [] },
    permissions: { delete: false },
    fields: {
      columns: { type: 'custom', label: '열 수', render: ({ value, readOnly }) => <ColumnsCountField value={value} readOnly={readOnly} /> },
      ratio: { type: 'radio', label: '열 비율', options: [...COLUMN_RATIO_OPTIONS['2']] },
      gap: GAP_FIELD,
      structureInsert: { type: 'custom', label: '중첩 Stack', render: ({ readOnly }) => <StructureInsertField readOnly={readOnly} /> },
      column1: { type: 'slot', allow: [...COLUMN_COMPONENTS] },
      column2: { type: 'slot', allow: [...COLUMN_COMPONENTS] },
      column3: { type: 'slot', allow: [...COLUMN_COMPONENTS] },
      structureDelete: STRUCTURE_DELETE_FIELD,
    },
    resolveFields: (data, { fields }) => {
      const columns = data.props?.columns === '1' || data.props?.columns === '3' ? data.props.columns : '2';
      return {
        ...fields,
        ratio: { type: 'radio', label: '열 비율', options: [...COLUMN_RATIO_OPTIONS[columns]] },
      } as typeof fields;
    },
    render: ({ column1: Column1, column2: Column2, column3: Column3, columns, ratio, gap }) => (
      <div className={`g7pb-preview-layout-columns g7pb-preview-layout-columns--count-${columns} g7pb-preview-layout-columns--${ratio.replaceAll(':', '-')} g7pb-preview-layout-columns--gap-${gap}`} data-testid="page-builder-layout-columns">
        <div className="g7pb-preview-layout-columns__column"><span>1열</span><Column1 minEmptyHeight={96} /></div>
        {Number(columns) >= 2 && Column2 ? <div className="g7pb-preview-layout-columns__column"><span>2열</span><Column2 minEmptyHeight={96} /></div> : null}
        {Number(columns) >= 3 && Column3 ? <div className="g7pb-preview-layout-columns__column"><span>3열</span><Column3 minEmptyHeight={96} /></div> : null}
      </div>
    ),
  },
  LayoutStack: {
    label: 'Stack · 세로 흐름',
    defaultProps: { gap: 'normal', content: [] },
    permissions: { delete: false },
    fields: {
      gap: GAP_FIELD,
      content: { type: 'slot', allow: [...LEAF_COMPONENTS] },
      structureDelete: STRUCTURE_DELETE_FIELD,
    },
    render: ({ content: Content, gap }) => <div className={`g7pb-preview-layout-stack g7pb-preview-layout-stack--gap-${gap}`} data-testid="page-builder-layout-stack">
      <span className="g7pb-preview-layout-label">Stack</span><Content minEmptyHeight={96} />
    </div>,
  },
};
