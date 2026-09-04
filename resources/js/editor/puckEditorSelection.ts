import { BUILTIN_BLOCK_DEFINITIONS } from '../blocks/builtinCatalog';
import { layoutAllowsChild, layoutPolicy, LayoutPolicyError } from '../documents/layoutPolicy';
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
  return layoutTypes[type] ?? BUILTIN_BLOCK_DEFINITIONS.find((block) => block.editor_component === type)?.block_id;
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
      for (const [name, value] of Object.entries(item.props)) {
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

function destinationLabel(parent: EditorItemLocation | null, slot: string): string {
  if (!parent) return '페이지 최상위';
  if (parent.item.type === 'LayoutColumns') {
    const column = Number(slot.replace('column', ''));
    return `Columns · ${Number.isInteger(column) ? `${column}열` : slot}`;
  }
  if (parent.item.type === 'LayoutSection') return 'Section · 내용';
  if (parent.item.type === 'LayoutStack') return 'Stack · 내용';
  return `${parent.item.type} · ${slot}`;
}

/** Every structural slot stays visible so the UI can explain invalid moves before dispatch. */
export function editorMoveDestinations(data: PuckEditorData, source: EditorItemLocation): EditorMoveDestination[] {
  const locations = editorItemLocations(data);
  const sourceType = canonicalTypeForEditor(source.item.type);
  const subtree = editorItemLocations({ content: [source.item] });
  const subtreeIds = new Set(subtree.map(({ item }) => item.props.id));
  const subtreeDepth = Math.max(...subtree.map(({ depth }) => depth)) - 1;
  const zones: Array<{ zone: string; label: string; parent: EditorItemLocation | null; length: number }> = [
    { zone: 'root:default-zone', label: destinationLabel(null, 'blocks'), parent: null, length: data.content.length },
  ];
  for (const parent of locations) {
    for (const [slot, value] of Object.entries(parent.item.props)) {
      if (!Array.isArray(value) || !value.every(isItem)) continue;
      zones.push({ zone: `${parent.item.props.id}:${slot}`, label: destinationLabel(parent, slot), parent, length: value.length });
    }
  }
  return zones.map(({ zone, label, parent, length }) => {
    let reason: string | null = null;
    const parentType = parent ? canonicalTypeForEditor(parent.item.type) : null;
    if (zone === source.selector.zone) reason = '현재 구역입니다.';
    else if (parent && subtreeIds.has(parent.item.props.id)) reason = '자기 하위 구역으로 이동할 수 없습니다.';
    else if (!sourceType || parentType === undefined || !layoutAllowsChild(parentType, sourceType)) reason = '이 블록을 받을 수 없는 구역입니다.';
    else if (parent && length >= layoutPolicy.limits.slot_children) reason = `구역 최대 ${layoutPolicy.limits.slot_children}개를 초과합니다.`;
    else {
      const destinationDepth = (parent?.depth ?? 0) + 1 + subtreeDepth;
      if (destinationDepth > layoutPolicy.limits.depth) reason = `중첩 최대 ${layoutPolicy.limits.depth}단계를 초과합니다.`;
    }
    return { selector: { zone, index: length }, label, valid: reason === null, reason };
  });
}

export function editorInsertionDestination(
  data: PuckEditorData,
  selector: EditorItemSelector | null,
  componentType: string,
  insertedNodes = 1,
): EditorItemSelector {
  const locations = editorItemLocations(data);
  const selected = resolveEditorSelection(data, selector);
  let zone = selected?.selector.zone ?? 'root:default-zone';
  let index = selected ? selected.selector.index + 1 : data.content.length;
  // Selecting a container inserts into its first compatible slot.
  const childType = canonicalTypeForEditor(componentType);
  const selectedType = selected ? canonicalTypeForEditor(selected.item.type) : undefined;
  if (selected && childType && selectedType && layoutAllowsChild(selectedType, childType)) {
    const slot = selected.item.type === 'LayoutColumns' ? 'column1' : 'content';
    const children = (selected.item.props as Record<string, unknown>)[slot];
    zone = `${selected.item.props.id}:${slot}`;
    index = Array.isArray(children) ? children.length : 0;
  }
  const destination = { index, zone };
  assertEditorInsertion(data, destination, componentType, insertedNodes);
  return destination;
}

/** The gallery, patterns and slot controls share the same insertion limits. */
export function assertEditorInsertion(
  data: PuckEditorData, destination: EditorItemSelector, componentType: string, insertedNodes = 1,
): void {
  const locations = editorItemLocations(data);
  const { zone, index } = destination;
  if (!Number.isInteger(insertedNodes) || insertedNodes < 1 || locations.length + insertedNodes > layoutPolicy.limits.nodes) throw new LayoutPolicyError('node_limit', 'blocks');
  const childType = canonicalTypeForEditor(componentType);
  if (zone !== 'root:default-zone') {
    const separator = zone.lastIndexOf(':');
    const parent = locations.find(({ item }) => item.props.id === zone.slice(0, separator));
    const parentType = parent && canonicalTypeForEditor(parent.item.type);
    if (!parent || !parentType || !childType || !layoutAllowsChild(parentType, childType)) {
      throw new LayoutPolicyError('parent', zone);
    }
    const children = (parent.item.props as Record<string, unknown>)[zone.slice(separator + 1)];
    if (!Array.isArray(children) || children.length >= layoutPolicy.limits.slot_children) throw new LayoutPolicyError('slot_limit', zone);
    if (!Number.isInteger(index) || index < 0 || index > children.length) throw new LayoutPolicyError('index', zone);
    if (parent.depth >= layoutPolicy.limits.depth) throw new LayoutPolicyError('depth_limit', zone);
  } else {
    if (!childType || !layoutAllowsChild(null, childType)) throw new LayoutPolicyError('parent', zone);
    if (!Number.isInteger(index) || index < 0 || index > data.content.length) throw new LayoutPolicyError('index', zone);
  }
}
