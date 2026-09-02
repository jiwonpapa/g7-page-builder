import { BUILTIN_BLOCK_DEFINITIONS } from '../blocks/builtinCatalog';
import { layoutAllowsChild, layoutPolicy, LayoutPolicyError } from '../documents/layoutPolicy';
import { idToUuid } from './puckBlockCodec';
import type { PuckEditorData } from './puckEditorTypes';

type Item = PuckEditorData['content'][number];
export interface EditorItemSelector { index: number; zone: string }
export interface EditorItemLocation { item: Item; selector: EditorItemSelector; depth: number }

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
  } else if (!Number.isInteger(index) || index < 0 || index > data.content.length) {
    throw new LayoutPolicyError('index', zone);
  }
}
