import type { Slot } from '@puckeditor/core';
import { BUILTIN_BLOCK_DEFINITIONS } from '../blocks/builtinCatalog';
import { layoutAllowsChild, layoutPolicy, layoutSlotNames, LayoutPolicyError } from '../documents/layoutPolicy';
import { resizeLayoutColumns } from '../documents/layoutTree';
import type { PageBuilderBlock } from '../documents/types';
import { idToUuid } from './puckBlockCodec';
import { canonicalTypeForEditor } from './puckEditorSelection';
import type { LayoutColumnCount, LayoutColumnsEditorProps } from './layoutCatalogBlocks';

type EditorItem = Slot[number];
export interface LayoutColumnsResizeResult {
  props: LayoutColumnsEditorProps & Record<string, unknown>;
  movedNodes: number;
  targetSlot: `column${1 | 2 | 3}`;
}

export function allowedLayoutComponents(parent: keyof typeof layoutPolicy.layouts): string[] {
  return ['LayoutColumns', 'LayoutStack', ...BUILTIN_BLOCK_DEFINITIONS.map((definition) => definition.editor_component)]
    .filter((component) => {
      const type = canonicalTypeForEditor(component);
      return type !== undefined && layoutAllowsChild(layoutPolicy.layouts[parent], type);
    });
}

/**
 * The column control delegates merging and policy validation to the domain
 * command. The temporary Section supplies the required structural parent;
 * the editor's original item IDs and props survive the canonical bridge.
 */
export function resizeLayoutColumnsEditorProps(
  value: LayoutColumnsEditorProps & Record<string, unknown>, columns: LayoutColumnCount,
): LayoutColumnsResizeResult {
  const originals = new Map<string, EditorItem>();
  const shape = (item: EditorItem): PageBuilderBlock => {
    const type = canonicalTypeForEditor(item.type);
    if (!type) throw new LayoutPolicyError('type', item.type);
    const id = idToUuid(item.props.id);
    if (originals.has(id)) throw new LayoutPolicyError('duplicate_id', id);
    originals.set(id, structuredClone(item));
    const props: Record<string, unknown> = { ...item.props };
    delete props.id;
    if (type === layoutPolicy.layouts.columns) props.columns = Number(props.columns);
    const names = layoutSlotNames({ type, props });
    const slots: Record<string, PageBuilderBlock[]> = {};
    for (const name of names) {
      const children = props[name];
      if (!Array.isArray(children)) throw new LayoutPolicyError('shape', name);
      slots[name] = children.map(shape);
      delete props[name];
    }
    return { instance_id: id, type, block_version: 1, props, slots };
  };
  const column = shape({ type: 'LayoutColumns', props: { ...value, id: typeof value.id === 'string' ? value.id : 'column-control' } });
  const sectionId = idToUuid(`column-control-parent:${column.instance_id.replaceAll('-', '')}`);
  const document = { blocks: [{ instance_id: sectionId, type: layoutPolicy.layouts.section, block_version: 1,
    props: { width: 'standard', spacing: 'normal' }, slots: { content: [column] } }] };
  const count = Number(columns) as 1 | 2 | 3;
  const ratios: readonly string[] = layoutPolicy.ratios[count];
  const ratio = ratios.includes(value.ratio) ? value.ratio : ratios[0];
  const request = resizeLayoutColumns(document, column.instance_id, count, ratio);
  const result = request.status === 'confirmation-required'
    ? resizeLayoutColumns(document, column.instance_id, count, ratio, true) : request;
  const changed = result.document.blocks[0].slots.content[0];
  const props = structuredClone(value);
  props.columns = columns;
  props.ratio = changed.props.ratio as LayoutColumnsEditorProps['ratio'];
  for (const name of layoutSlotNames(column)) delete props[name];
  for (const [name, children] of Object.entries(changed.slots ?? {})) {
    props[name] = children.map((child) => {
      const original = originals.get(child.instance_id);
      if (!original) throw new LayoutPolicyError('not_found', child.instance_id);
      return original;
    });
  }
  return { props, movedNodes: request.status === 'confirmation-required' ? request.affectedNodes : 0, targetSlot: `column${count}` };
}
