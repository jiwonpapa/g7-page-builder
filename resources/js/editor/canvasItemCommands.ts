import type { PuckAction } from '@puckeditor/core';
import { editorContextProps, withEditorContextPatch } from '../blocks/externalEditorData';
import type { ElementAppearance } from '../documents/types';
import type { BlockGalleryItem } from './blockGalleryModel';
import { collectionLimit, normalizeElementAppearance, normalizeElementAppearanceMap, remapCollectionElementAppearanceMap, setValueAtPath } from './canvasEditingContract';
import type { PageDesignProps } from './pageDesignTokens';
import { canonicalBlockToPuck } from './puckBlockCodec';
import { assertEditorInsertion, editorInsertionDestination, editorItemLocations, type EditorItemLocation, type EditorItemSelector } from './puckEditorSelection';
import type { PuckEditorData } from './puckEditorTypes';

/** Puck owns insertion history; the preset and selection complete that same entry. */
export function insertGalleryItem(
  data: PuckEditorData,
  selector: EditorItemSelector | null,
  item: BlockGalleryItem,
  instanceId: string,
): PuckAction[] {
  const destination = editorInsertionDestination(data, selector, item.type);
  const actions: PuckAction[] = [{
    type: 'insert', componentType: item.type, destinationIndex: destination.index,
    destinationZone: destination.zone, id: instanceId,
  }];
  if (item.presetProps) {
    actions.push({
      type: 'replace', destinationIndex: destination.index, destinationZone: destination.zone,
      data: canonicalBlockToPuck({
        instance_id: instanceId, type: item.blockId, block_version: item.blockVersion,
        props: item.presetProps, slots: {},
      }),
      recordHistory: false,
    });
  }
  actions.push({ type: 'setUi', ui: { itemSelector: destination }, recordHistory: false });
  return actions;
}

export function setPageColorMode(colorMode: PageDesignProps['colorMode']): PuckAction {
  return {
    type: 'setData',
    data: (previous) => ({ root: { ...previous.root, props: { ...previous.root.props, colorMode } } }),
    recordHistory: true,
  };
}

export function moveCanvasItem(data: PuckEditorData, location: EditorItemLocation, destinationIndex: number): PuckAction[] {
  const { index, zone } = location.selector;
  const length = editorItemLocations(data).filter(({ selector }) => selector.zone === zone).length;
  if (destinationIndex < 0 || destinationIndex >= length) return [];
  return [{
    type: 'reorder', sourceIndex: index, destinationIndex, destinationZone: zone, recordHistory: true,
  }, {
    type: 'setUi', ui: { itemSelector: { index: destinationIndex, zone } }, recordHistory: false,
  }];
}

export function moveCanvasItemTo(
  data: PuckEditorData, location: EditorItemLocation, destination: EditorItemSelector,
): PuckAction[] {
  if (destination.zone === location.selector.zone) return moveCanvasItem(data, location, destination.index);
  return [{
    type: 'move', sourceIndex: location.selector.index, sourceZone: location.selector.zone,
    destinationIndex: destination.index, destinationZone: destination.zone, recordHistory: true,
  }, {
    type: 'setUi', ui: { itemSelector: destination }, recordHistory: false,
  }];
}

export function duplicateCanvasItem(data: PuckEditorData, location: EditorItemLocation): PuckAction[] {
  const subtreeNodes = editorItemLocations({ content: [location.item] }).length;
  const destination = { zone: location.selector.zone, index: location.selector.index + 1 };
  try {
    assertEditorInsertion(data, destination, location.item.type, subtreeNodes);
  } catch {
    return [];
  }
  return [{
    type: 'duplicate', sourceIndex: location.selector.index, sourceZone: location.selector.zone, recordHistory: true,
  }, {
    type: 'setUi', ui: { itemSelector: destination }, recordHistory: false,
  }];
}

export function deleteCanvasItem(data: PuckEditorData, location: EditorItemLocation): PuckAction[] {
  const siblings = editorItemLocations(data).filter(({ selector }) => selector.zone === location.selector.zone);
  const fallback = siblings.length > 1
    ? { zone: location.selector.zone, index: Math.min(location.selector.index, siblings.length - 2) }
    : location.selector.zone === 'root:default-zone'
      ? null
      : editorItemLocations(data).find(({ item }) => item.props.id === location.selector.zone.slice(0, location.selector.zone.lastIndexOf(':')))?.selector ?? null;
  return [{
    type: 'remove', index: location.selector.index, zone: location.selector.zone, recordHistory: true,
  }, {
    type: 'setUi', ui: { itemSelector: fallback }, recordHistory: false,
  }];
}

export function updateCanvasContext(location: EditorItemLocation, patch: Record<string, unknown>): PuckAction {
  return {
    type: 'replace', destinationIndex: location.selector.index, destinationZone: location.selector.zone,
    data: withEditorContextPatch(location.item, patch),
    ui: { itemSelector: location.selector }, recordHistory: true,
  };
}

export function updateCanvasElement(location: EditorItemLocation, fieldPath: string, patch: Partial<ElementAppearance> | null): PuckAction {
  const styles = normalizeElementAppearanceMap(editorContextProps(location.item).elementStyles);
  const nextStyles = { ...styles };
  const nextStyle = patch === null ? {} : normalizeElementAppearance({ ...normalizeElementAppearance(styles[fieldPath]), ...patch });
  if (Object.keys(nextStyle).length === 0) delete nextStyles[fieldPath];
  else nextStyles[fieldPath] = nextStyle;
  return updateCanvasContext(location, { elementStyles: nextStyles });
}

function replaceCanvasProps(location: EditorItemLocation, nextProps: Record<string, unknown>, retainSelection: boolean): PuckAction {
  return {
    type: 'replace', destinationIndex: location.selector.index, destinationZone: location.selector.zone,
    data: { ...location.item, props: { ...nextProps, id: location.item.props.id } },
    ...(retainSelection ? { ui: { itemSelector: location.selector } } : {}),
    recordHistory: true,
  };
}

export function updateCanvasPath(location: EditorItemLocation, path: string, value: unknown, retainSelection = false): PuckAction {
  return replaceCanvasProps(location, setValueAtPath(location.item.props, path, value), retainSelection);
}

export type CollectionOperation = 'up' | 'down' | 'duplicate' | 'delete';

export function updateCanvasCollection(
  location: EditorItemLocation, collection: string, itemIndex: number, operation: CollectionOperation,
): { action: PuckAction; nextIndex: number } | null {
  const selectedBlock = location.item;
  const selectedProps: Record<string, unknown> = selectedBlock.props;
  const selectedCollection = selectedProps[collection];
  const limits = collectionLimit(selectedBlock.type, collection);
  if (!Array.isArray(selectedCollection) || !limits
    || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= selectedCollection.length) return null;
  const next = structuredClone(selectedCollection);
  let nextIndex = itemIndex;
  if (operation === 'up' && itemIndex > 0) {
    [next[itemIndex - 1], next[itemIndex]] = [next[itemIndex], next[itemIndex - 1]];
    nextIndex = itemIndex - 1;
  } else if (operation === 'down' && itemIndex < next.length - 1) {
    [next[itemIndex + 1], next[itemIndex]] = [next[itemIndex], next[itemIndex + 1]];
    nextIndex = itemIndex + 1;
  } else if (operation === 'duplicate' && next.length < limits.max) {
    next.splice(itemIndex + 1, 0, structuredClone(next[itemIndex]));
    nextIndex = itemIndex + 1;
  } else if (operation === 'delete' && next.length > limits.min) {
    next.splice(itemIndex, 1);
    nextIndex = Math.min(itemIndex, next.length - 1);
  } else {
    return null;
  }
  const nextElementStyles = remapCollectionElementAppearanceMap(
    editorContextProps(selectedBlock).elementStyles, collection, operation, itemIndex,
  );
  const nextProps: Record<string, unknown> = { ...selectedBlock.props, [collection]: next };
  if (Object.keys(nextElementStyles).length > 0) nextProps.elementStyles = nextElementStyles;
  else delete nextProps.elementStyles;
  return { action: replaceCanvasProps(location, nextProps, true), nextIndex };
}
