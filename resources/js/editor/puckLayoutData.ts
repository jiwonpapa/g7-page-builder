import type { PuckEditorData } from './puckEditorTypes';

export type PuckEditorItem = PuckEditorData['content'][number];
export type LayoutPuckItem = Extract<PuckEditorItem, { type: 'LayoutSection' | 'LayoutColumns' | 'LayoutStack' }>;
export type LayoutColumnsPuckItem = Extract<LayoutPuckItem, { type: 'LayoutColumns' }>;

/** Runtime slots contain the editor's identified component union, not default-prop Slots. */
export function puckLayoutSlot(item: PuckEditorItem, name: string): PuckEditorData['content'] | undefined {
  let slot: PuckEditorData['content'] | undefined;
  if ((item.type === 'LayoutSection' || item.type === 'LayoutStack') && name === 'content') {
    slot = item.props.content;
  } else if (item.type === 'LayoutColumns') {
    if (name === 'column1') slot = item.props.column1;
    if (name === 'column2') slot = item.props.column2;
    if (name === 'column3') slot = item.props.column3;
  }
  return Array.isArray(slot) ? slot : undefined;
}

export function puckLayoutChildren(item: PuckEditorItem): PuckEditorData['content'] {
  return ['content', 'column1', 'column2', 'column3'].flatMap((name) => puckLayoutSlot(item, name) ?? []);
}
