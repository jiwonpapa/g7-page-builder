import schema from '../../../../schemas/page-builder-document-v3.schema.json';
import type { DocumentV3 } from './types';
import { reject, validateRule } from './schema';
import { assertEditable, cloneDocument, indexTree, location } from './tree';
import { validateDocumentV3 } from './validate';
import { executeTreeCommand, type Destination, type TreeResult } from './commands';
import { freshId, type NewId } from './clipboard';
import { createPrimitive } from './primitives';

export type ImageAsset = DocumentV3['assets'][number];
export interface ImageCommand { kind: 'image'; id: string; asset: ImageAsset; alt: string }
export interface ImageInsertCommand { kind: 'image-insert'; destination: Destination; asset: ImageAsset; alt: string }

export function validateImageAsset(asset: ImageAsset): ImageAsset {
  const source = { asset_id: asset.asset_id, url: asset.url };
  validateRule(source, schema.properties.assets.items, schema.$defs);
  return source;
}

/** Register and replace one image in the existing document transaction and Undo. */
export function replaceImage(source: DocumentV3, command: ImageCommand): TreeResult {
  validateDocumentV3(source);
  const asset = validateImageAsset(command.asset);
  const document = cloneDocument(source);
  const item = location(indexTree(document), command.id);
  assertEditable(item);
  if (item.node.type !== 'media.image') reject('image_target', command.id);
  const sameId = document.assets.find(value => value.asset_id === asset.asset_id);
  if (sameId && sameId.url !== asset.url) reject('asset_identity', asset.asset_id);
  const registered = document.assets.find(value => value.url === asset.url) ?? asset;
  if (!document.assets.some(value => value.asset_id === registered.asset_id)) document.assets.push(registered);
  item.node.props = { asset_id: registered.asset_id, alt: command.alt };
  validateDocumentV3(document);
  const changed = JSON.stringify(document) !== JSON.stringify(source);
  return { document: changed ? document : source, selection: [command.id], changed };
}

/** The first image does not require a pre-existing document asset or a preset. */
export function insertImage(source: DocumentV3, command: ImageInsertCommand, nextId: NewId): TreeResult {
  validateDocumentV3(source);
  const asset = validateImageAsset(command.asset), document = cloneDocument(source);
  const sameId = document.assets.find(value => value.asset_id === asset.asset_id);
  if (sameId && sameId.url !== asset.url) reject('asset_identity', asset.asset_id);
  const registered = document.assets.find(value => value.url === asset.url) ?? asset;
  if (!document.assets.some(value => value.asset_id === registered.asset_id)) document.assets.push(registered);
  const used = new Set([document.document_id, ...indexTree(document).keys(), ...document.assets.map(value => value.asset_id)]);
  const node = createPrimitive('media.image', freshId(used, nextId), document);
  if (node.type !== 'media.image') reject('image_target', '$');
  node.props = { asset_id: registered.asset_id, alt: command.alt };
  node.style = { width: { value: 100, unit: '%' } };
  return executeTreeCommand(document, { kind: 'insert', destination: command.destination, nodes: [node] }, nextId);
}
