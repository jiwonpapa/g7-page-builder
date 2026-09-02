import { BUILTIN_BLOCK_DEFINITIONS } from '../blocks/builtinCatalog';
import { layoutAllowsChild, layoutPolicy, layoutSlotNames, LayoutPolicyError } from '../documents/layoutPolicy';
import { resizeLayoutColumns } from '../documents/layoutTree';
import type { PageBuilderBlock } from '../documents/types';
import { idToUuid } from './puckBlockCodec';
import { canonicalTypeForEditor } from './puckEditorSelection';
import type { LayoutColumnCount, LayoutColumnRatio } from './layoutCatalogBlocks';
import { puckLayoutSlot, type LayoutColumnsPuckItem, type PuckEditorItem } from './puckLayoutData';

export interface LayoutColumnsResizeResult {
  props: LayoutColumnsPuckItem['props'];
  movedNodes: number;
  targetSlot: `column${1 | 2 | 3}`;
}

function isLayoutColumnRatio(value: unknown): value is LayoutColumnRatio {
  return typeof value === 'string' && Object.values(layoutPolicy.ratios).some((ratios) => ratios.includes(value));
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
  value: LayoutColumnsPuckItem['props'], columns: LayoutColumnCount,
): LayoutColumnsResizeResult {
  const originals = new Map<string, PuckEditorItem>();
  const shape = (item: PuckEditorItem): PageBuilderBlock => {
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
      const children = puckLayoutSlot(item, name);
      if (!children) throw new LayoutPolicyError('shape', name);
      slots[name] = children.map(shape);
      delete props[name];
    }
    return { instance_id: id, type, block_version: 1, props, slots };
  };
  const column = shape({ type: 'LayoutColumns', props: value });
  const sectionId = idToUuid(`column-control-parent:${column.instance_id.replaceAll('-', '')}`);
  const document = { blocks: [{ instance_id: sectionId, type: layoutPolicy.layouts.section, block_version: 1,
    props: { width: 'standard', spacing: 'normal' }, slots: { content: [column] } }] };
  const count = columns === '1' ? 1 : columns === '2' ? 2 : 3;
  const ratios: readonly string[] = layoutPolicy.ratios[count];
  const ratio = ratios.includes(value.ratio) ? value.ratio : ratios[0];
  const request = resizeLayoutColumns(document, column.instance_id, count, ratio);
  const result = request.status === 'confirmation-required'
    ? resizeLayoutColumns(document, column.instance_id, count, ratio, true) : request;
  const changed = result.document.blocks[0].slots.content[0];
  const props = structuredClone(value);
  props.columns = columns;
  const changedRatio = changed.props.ratio;
  if (!isLayoutColumnRatio(changedRatio)) throw new LayoutPolicyError('shape', 'ratio');
  props.ratio = changedRatio;
  const restoreSlot = (name: 'column1' | 'column2' | 'column3'): PuckEditorItem[] => {
    const children = changed.slots?.[name];
    if (!children) throw new LayoutPolicyError('shape', name);
    return children.map((child) => {
      const original = originals.get(child.instance_id);
      if (!original) throw new LayoutPolicyError('not_found', child.instance_id);
      return original;
    });
  };
  props.column1 = restoreSlot('column1');
  delete props.column2;
  delete props.column3;
  if (count >= 2) props.column2 = restoreSlot('column2');
  if (count === 3) props.column3 = restoreSlot('column3');
  return { props, movedNodes: request.status === 'confirmation-required' ? request.affectedNodes : 0, targetSlot: `column${count}` };
}
