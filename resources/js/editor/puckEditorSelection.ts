import { BUILTIN_BLOCK_DEFINITIONS } from '../blocks/builtinCatalog';
import { externalBlockForComponent } from '../blocks/externalEditorRegistryData';
import { layoutAllowsChild, layoutPolicy, layoutSlotNames, LayoutPolicyError } from '../documents/layoutPolicy';
import { idToUuid } from './puckBlockCodec';
import type { PuckEditorData } from './puckEditorTypes';

type Item = PuckEditorData['content'][number];
export interface EditorItemSelector { index: number; zone: string }
export interface EditorItemLocation { item: Item; selector: EditorItemSelector; depth: number }
export interface EditorMoveDestination {
  selector: EditorItemSelector;
  label: string;
  valid: boolean;
  reason: string | null;
}

const layoutTypes: Readonly<Record<string, string>> = {
  LayoutSection: layoutPolicy.layouts.section,
  LayoutColumns: layoutPolicy.layouts.columns,
  LayoutStack: layoutPolicy.layouts.stack,
};

export function canonicalTypeForEditor(type: string): string | undefined {
  return layoutTypes[type] ?? BUILTIN_BLOCK_DEFINITIONS.find((block) => block.editor_component === type)?.block_id
    ?? externalBlockForComponent(type)?.block_id;
}

function isItem(value: unknown): value is Item {
  if (typeof value !== 'object' || value === null || !('type' in value) || typeof value.type !== 'string'
    || !('props' in value) || typeof value.props !== 'object' || value.props === null) return false;
  return 'id' in value.props && typeof value.props.id === 'string';
}

/** Resolve every UI entry point against the same current tree, including slots. */
export function editorItemLocations(data: Pick<PuckEditorData, 'content'>): EditorItemLocation[] {
  const locations: EditorItemLocation[] = [];
  const seen = new Set<Item>();
  const visit = (items: readonly Item[], zone: string, depth: number): void => {
    items.forEach((item, index) => {
      if (seen.has(item)) return;
      seen.add(item);
      locations.push({ item, selector: { index, zone }, depth });
      for (const name of activeEditorSlots(item.type, item.props)) {
        const value: unknown = Reflect.get(item.props, name);
        if (Array.isArray(value) && value.every(isItem)) visit(value, `${item.props.id}:${name}`, depth + 1);
      }
    });
  };
  visit(data.content, 'root:default-zone', 1);
  return locations;
}

export function resolveEditorSelection(
  data: PuckEditorData,
  selector: EditorItemSelector | null,
  canonicalId?: string | null,
): EditorItemLocation | null {
  const locations = editorItemLocations(data);
  const explicit = locations.find((location) => location.selector.index === selector?.index && location.selector.zone === selector.zone);
  if (!canonicalId) return explicit ?? null;
  const canvas = locations.find(({ item }) => idToUuid(item.props.id) === canonicalId);
  if (!canvas) return null;
  // An explicit tree selection must never edit a stale sibling canvas target.
  // Ancestor selection may still own a text field inside a nested slot.
  let owner = canvas;
  while (explicit && owner !== explicit && owner.selector.zone !== 'root:default-zone') {
    const parentId = owner.selector.zone.slice(0, owner.selector.zone.lastIndexOf(':'));
    const parent = locations.find(({ item }) => item.props.id === parentId);
    if (!parent) break;
    owner = parent;
  }
  return explicit && owner !== explicit ? null : canvas;
}

/** Only declared, active structural slots are destinations; repeater arrays never are. */
export function activeEditorSlots(type: string, props: Record<string, unknown>): string[] {
  const canonicalType = canonicalTypeForEditor(type);
  if (!canonicalType) return [];
  try {
    return layoutSlotNames({ type: canonicalType, props: type === 'LayoutColumns'
      ? { ...props, columns: Number(props.columns) } : props });
  } catch { return []; }
}

export function editorSubtreeSize(type: string, props: Record<string, unknown>): { nodes: number; depth: number } {
  const sizes = activeEditorSlots(type, props).flatMap((slot) => {
    const children = props[slot];
    if (!Array.isArray(children)) return [];
    return children.flatMap((child: unknown) => {
      if (typeof child !== 'object' || child === null || !('type' in child) || typeof child.type !== 'string'
        || !('props' in child) || typeof child.props !== 'object' || child.props === null || Array.isArray(child.props)) return [];
      return [editorSubtreeSize(child.type, child.props as Record<string, unknown>)];
    });
  });
  return { nodes: 1 + sizes.reduce((sum, size) => sum + size.nodes, 0), depth: 1 + Math.max(0, ...sizes.map((size) => size.depth)) };
}

export function editorSelectionAncestors(data: PuckEditorData, source: EditorItemLocation): EditorItemLocation[] {
  const locations = editorItemLocations(data), ancestors: EditorItemLocation[] = [];
  let current = source;
  while (current.selector.zone !== 'root:default-zone') {
    const zone = current.selector.zone;
    const parent = locations.find(({ item }) => item.props.id === zone.slice(0, zone.lastIndexOf(':')));
    if (!parent || ancestors.includes(parent)) break;
    ancestors.unshift(parent);
    current = parent;
  }
  return ancestors;
}

export function editorLocationLabel(data: PuckEditorData, location: EditorItemLocation): string {
  const typeLabel = location.item.type === 'LayoutSection' ? '구역' : location.item.type === 'LayoutColumns' ? '열 묶음'
    : location.item.type === 'LayoutStack' ? '세로 묶음'
      : BUILTIN_BLOCK_DEFINITIONS.find((entry) => entry.editor_component === location.item.type)?.label.ko ?? '컴포넌트';
  const peers = editorItemLocations(data).filter(({ item }) => item.type === location.item.type);
  return `${typeLabel} ${peers.findIndex(({ item }) => item.props.id === location.item.props.id) + 1}`;
}

export interface EditorInsertionTarget { selector: EditorItemSelector; label: string }

export function editorInsertionTargets(data: PuckEditorData): EditorInsertionTarget[] {
  return [{ selector: { zone: 'root:default-zone', index: data.content.length }, label: '페이지 최상위' },
    ...editorItemLocations(data).flatMap((parent) => activeEditorSlots(parent.item.type, parent.item.props).flatMap((slot) => {
      const children: unknown = Reflect.get(parent.item.props, slot);
      if (!Array.isArray(children) || !children.every(isItem)) return [];
      const path = [...editorSelectionAncestors(data, parent), parent].map((entry) => editorLocationLabel(data, entry));
      const slotLabel = parent.item.type === 'LayoutColumns' ? `${slot.slice(6)}열` : '내용';
      return [{ selector: { zone: `${parent.item.props.id}:${slot}`, index: children.length }, label: [...path, slotLabel].join(' › ') }];
    }))];
}

export function editorDefaultInsertionTarget(data: PuckEditorData, selector: EditorItemSelector | null): EditorInsertionTarget {
  const selected = resolveEditorSelection(data, selector);
  if (selector && !selected) throw new LayoutPolicyError('not_found', selector.zone);
  const targets = editorInsertionTargets(data);
  if (!selected) return targets[0];
  if (activeEditorSlots(selected.item.type, selected.item.props).length) {
    const child = targets.find((target) => target.selector.zone.startsWith(`${selected.item.props.id}:`));
    if (!child) throw new LayoutPolicyError('slot', selected.item.props.id);
    return child;
  }
  const sibling = targets.find((target) => target.selector.zone === selected.selector.zone);
  if (!sibling) throw new LayoutPolicyError('slot', selected.selector.zone);
  return { ...sibling, selector: { ...selected.selector, index: selected.selector.index + 1 } };
}

export function editorPlacementReason(error: unknown): string {
  if (!(error instanceof LayoutPolicyError)) return '선택한 위치를 다시 확인해 주세요.';
  return ({ parent: '이 위치에는 이 종류를 넣을 수 없습니다.', slot: '현재 사용할 수 없는 내부 위치입니다.',
    slot_limit: `한 구역에 최대 ${layoutPolicy.limits.slot_children}개까지 배치할 수 있습니다.`,
    node_limit: `문서 전체 최대 ${layoutPolicy.limits.nodes}개를 초과합니다.`,
    depth_limit: `중첩 최대 ${layoutPolicy.limits.depth}단계를 초과합니다.`,
    descendant: '자기 하위 구역으로 이동할 수 없습니다.',
    not_found: '선택한 항목이 바뀌었습니다. 다시 선택해 주세요.',
    index: '선택한 순서가 바뀌었습니다. 다시 선택해 주세요.',
  }[error.code] ?? '문서 구조 제한에 맞지 않습니다.');
}

function assertPlacement(data: PuckEditorData, destination: EditorItemSelector, componentType: string,
  addedNodes: number, subtreeDepth: number, structureEnabled: boolean, source?: EditorItemLocation): void {
  const locations = editorItemLocations(data), { zone, index } = destination;
  const enforceLayout = structureEnabled || locations.some(({ item }) => item.type in layoutTypes);
  if (!Number.isInteger(subtreeDepth) || subtreeDepth < 1) throw new LayoutPolicyError('depth_limit', zone);
  if (!Number.isInteger(addedNodes) || addedNodes < 0
    || (enforceLayout && locations.length + addedNodes > layoutPolicy.limits.nodes)) throw new LayoutPolicyError('node_limit', 'blocks');
  const childType = canonicalTypeForEditor(componentType);
  const parent = zone === 'root:default-zone' ? null
    : locations.find(({ item }) => item.props.id === zone.slice(0, zone.lastIndexOf(':')));
  if (parent === undefined) throw new LayoutPolicyError('slot', zone);
  const slot = zone.slice(zone.lastIndexOf(':') + 1);
  if (parent && !activeEditorSlots(parent.item.type, parent.item.props).includes(slot)) throw new LayoutPolicyError('slot', zone);
  const children: unknown = parent ? Reflect.get(parent.item.props, slot) : data.content;
  if (!Array.isArray(children) || !children.every(isItem)) throw new LayoutPolicyError('slot', zone);
  if (parent && source && editorItemLocations({ content: [source.item] }).some(({ item }) => item.props.id === parent.item.props.id)) throw new LayoutPolicyError('descendant', zone);
  const parentType = parent ? canonicalTypeForEditor(parent.item.type) : null;
  const legacyExternalRoot = !enforceLayout && parent === null && Boolean(externalBlockForComponent(componentType));
  if (!legacyExternalRoot && (!childType || parentType === undefined || !layoutAllowsChild(parentType, childType))) throw new LayoutPolicyError('parent', zone);
  const sameZone = source?.selector.zone === zone;
  if (!Number.isInteger(index) || index < 0 || index > children.length - (sameZone ? 1 : 0)) throw new LayoutPolicyError('index', zone);
  if (parent && children.length - (sameZone ? 1 : 0) >= layoutPolicy.limits.slot_children) throw new LayoutPolicyError('slot_limit', zone);
  if (enforceLayout && (parent?.depth ?? 0) + subtreeDepth > layoutPolicy.limits.depth) throw new LayoutPolicyError('depth_limit', zone);
}

export function assertEditorMove(data: PuckEditorData, source: EditorItemLocation, destination: EditorItemSelector, structureEnabled = true): void {
  const current = resolveEditorSelection(data, source.selector);
  if (!current || current.item.props.id !== source.item.props.id) throw new LayoutPolicyError('not_found', source.selector.zone);
  const subtree = editorSubtreeSize(current.item.type, current.item.props);
  assertPlacement(data, destination, current.item.type, 0, subtree.depth, structureEnabled, current);
}

/** Menu choices and executable moves use the same preflight, including subtree depth. */
export function editorMoveDestinations(data: PuckEditorData, source: EditorItemLocation, structureEnabled = true): EditorMoveDestination[] {
  return editorInsertionTargets(data).map(({ selector, label }) => {
    let reason: string | null = selector.zone === source.selector.zone ? '현재 구역입니다.' : null;
    if (!reason) {
      try { assertEditorMove(data, source, selector, structureEnabled); }
      catch (error) { reason = editorPlacementReason(error); }
    }
    return { selector, label, valid: reason === null, reason };
  });
}

export function editorInsertionDestination(data: PuckEditorData, selector: EditorItemSelector | null,
  componentType: string, insertedNodes = 1, insertedDepth = 1, structureEnabled = true): EditorItemSelector {
  const destination = editorDefaultInsertionTarget(data, selector).selector;
  assertEditorInsertion(data, destination, componentType, insertedNodes, insertedDepth, structureEnabled);
  return destination;
}

/** Every caller declares the entire inserted subtree; native Puck still crosses canonical validation. */
export function assertEditorInsertion(data: PuckEditorData, destination: EditorItemSelector,
  componentType: string, insertedNodes = 1, insertedDepth = 1, structureEnabled = true): void {
  if (insertedNodes < 1) throw new LayoutPolicyError('node_limit', 'blocks');
  assertPlacement(data, destination, componentType, insertedNodes, insertedDepth, structureEnabled);
}
