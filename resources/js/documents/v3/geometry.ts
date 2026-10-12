import type { DocumentV3, Style } from './types';
import type { DesignCommand } from './designCommands';
import { assertEditable, indexTree, selectionRoots } from './tree';
import { reject } from './schema';

/** Untransformed CSS pixels in the authored parent's coordinate space; no DOM/vendor objects. */
export interface GeometryBox { id: string; left: number; top: number; width: number; height: number }
export type GeometryOperation =
  | { kind: 'resize'; width: number; height: number; keepRatio: boolean }
  | { kind: 'translate'; x: number; y: number }
  | { kind: 'rotate'; degrees: number }
  | { kind: 'align'; axis: 'x' | 'y'; edge: 'start' | 'center' | 'end' }
  | { kind: 'distribute'; axis: 'x' | 'y' };
export type StyleBatch = Extract<DesignCommand, { kind: 'styles' }>;
const px = (value: number) => ({ value: Math.round(value * 1000) / 1000, unit: 'px' as const });

export function geometryTargets(document: DocumentV3, ids: readonly string[], boxes: readonly GeometryBox[]) {
  const roots = selectionRoots(indexTree(document), ids);
  if (new Set(boxes.map(box => box.id)).size !== boxes.length) reject('geometry_duplicate', '$');
  return roots.map(item => {
    assertEditable(item);
    if (item.node.style.hidden || item.ancestors.some(node => node.style.hidden)) reject('hidden', item.node.instance_id);
    const box = boxes.find(value => value.id === item.node.instance_id);
    if (!box || ![box.left, box.top, box.width, box.height].every(Number.isFinite)
      || box.width <= 0 || box.height <= 0) reject('geometry_measurement', item.node.instance_id);
    return { item, box };
  });
}

/** Geometry is an input to the canonical validator, never a replacement document. */
export function geometryCommand(document: DocumentV3, ids: readonly string[], boxes: readonly GeometryBox[], operation: GeometryOperation): StyleBatch {
  const targets = geometryTargets(document, ids, boxes);
  const groupResize = operation.kind === 'resize' && targets.length > 1;
  const positioned = operation.kind !== 'resize' || groupResize;
  if (positioned && targets.some(({ item }) => item.node.style.position !== 'absolute' || !item.parent)) reject('absolute_required', '$');
  if (positioned && targets.some(({ item }) => item.parent !== targets[0].item.parent)) reject('mixed_parents', '$');
  if (targets.some(({ item }) => item.ancestors.some(node => node.style.rotation))) reject('rotated_parent', '$');
  if ((operation.kind === 'align' || operation.kind === 'distribute') && targets.some(({ item }) => item.node.style.rotation)) reject('rotated_alignment', '$');
  if (groupResize && targets.some(({ item }) => item.node.style.rotation)) reject('rotated_group_resize', '$');
  const changes = new Map<string, Style>();
  const resets = new Map<string, (keyof Style)[]>();
  const place = (box: GeometryBox, left: number, top: number) => {
    changes.set(box.id, { inset_left: px(left), inset_top: px(top), width: px(box.width), height: px(box.height) });
    // Resolving right/bottom/percent anchors into measured left/top is explicit in the result.
    resets.set(box.id, ['inset_right', 'inset_bottom']);
  };
  if (operation.kind === 'resize') {
    if (![operation.width, operation.height].every(value => Number.isFinite(value) && value > 0)) reject('geometry_size', '$');
    const primary = targets[0].box;
    const sx = operation.width / primary.width;
    const sy = operation.keepRatio ? sx : operation.height / primary.height;
    const left = Math.min(...targets.map(({ box }) => box.left));
    const top = Math.min(...targets.map(({ box }) => box.top));
    for (const { box, item } of targets) {
      const set: Style = { width: px(box.width * sx), height: px(box.height * sy) };
      const reset: (keyof Style)[] = [];
      if (groupResize) {
        set.inset_left = px(left + (box.left - left) * sx);
        set.inset_top = px(top + (box.top - top) * sy);
        reset.push('inset_right', 'inset_bottom');
      } else if (item.node.style.position === 'absolute') {
        // East/south handles keep the measured near edge, even when CSS was
        // initially anchored only by right/bottom (including near: auto).
        for (const [near, far, value] of [['inset_left', 'inset_right', box.left], ['inset_top', 'inset_bottom', box.top]] as const) {
          if ((item.node.style[near] === undefined || item.node.style[near] === 'auto')
            && item.node.style[far] !== undefined && item.node.style[far] !== 'auto') {
            set[near] = px(value); reset.push(far);
          }
        }
      }
      if (operation.keepRatio) set.aspect_ratio = box.width / box.height;
      // Flex shrink/grow must not silently undo a direct pixel size.
      if (item.parent?.style.display === 'flex') { set.grow = 0; set.shrink = 0; set.basis = 'auto'; }
      changes.set(box.id, set);
      if (!operation.keepRatio && item.node.style.aspect_ratio !== undefined) reset.push('aspect_ratio');
      if (reset.length) resets.set(box.id, reset);
    }
  } else if (operation.kind === 'translate') {
    if (![operation.x, operation.y].every(Number.isFinite)) reject('geometry_offset', '$');
    for (const { box } of targets) place(box, box.left + operation.x, box.top + operation.y);
  } else if (operation.kind === 'rotate') {
    if (!Number.isFinite(operation.degrees)) reject('geometry_rotation', '$');
    for (const { item } of targets) changes.set(item.node.instance_id, { rotation: (item.node.style.rotation ?? 0) + operation.degrees });
  } else {
    const start = (box: GeometryBox) => operation.axis === 'x' ? box.left : box.top;
    const size = (box: GeometryBox) => operation.axis === 'x' ? box.width : box.height;
    const ordered = targets.map(({ box }) => box).sort((a, b) => start(a) - start(b));
    const min = Math.min(...ordered.map(start)), max = Math.max(...ordered.map(box => start(box) + size(box)));
    const at = (box: GeometryBox, value: number) => place(box, operation.axis === 'x' ? value : box.left, operation.axis === 'y' ? value : box.top);
    if (operation.kind === 'align') {
      for (const box of ordered) at(box, operation.edge === 'start' ? min : operation.edge === 'end' ? max - size(box) : (min + max - size(box)) / 2);
    } else {
      if (ordered.length < 3) reject('distribution_count', '$');
      const gap = (max - min - ordered.reduce((sum, box) => sum + size(box), 0)) / (ordered.length - 1);
      if (gap < 0) reject('distribution_overlap', '$');
      let cursor = min;
      for (const box of ordered) { at(box, cursor); cursor += size(box) + gap; }
    }
  }
  return { kind: 'styles', updates: targets.map(({ box }) => ({ id: box.id, set: changes.get(box.id)!,
    ...(resets.has(box.id) ? { reset: resets.get(box.id)! } : {}) })) };
}

/** Shared Inspector mixed/omitted/value semantics without inventing a saved mixed value. */
export function selectedStyle(document: DocumentV3, ids: readonly string[], key: keyof Style): { mixed: boolean; value: Style[keyof Style] } {
  const nodes = selectionRoots(indexTree(document), ids).map(item => item.node);
  const value = nodes[0].style[key];
  return { mixed: nodes.some(node => JSON.stringify(node.style[key]) !== JSON.stringify(value)), value };
}
