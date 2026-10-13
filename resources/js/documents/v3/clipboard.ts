import type { DocumentV3, Node, Link, Run } from './types';
import { validateDocumentV3 } from './validate';
import { cloneDocument, indexTree, nodeAnchor, selectionRoots } from './tree';
import { reject, validateRule, V3Error } from './schema';
import schema from '../../../../schemas/page-builder-document-v3.schema.json';
import { remapBehavior } from './behaviors';
import { remapBinding } from './bindings';

/** Session clipboard, not a new persisted document format or an OS clipboard. */
export interface TreeClipboard { source: DocumentV3; ids: string[] }
export type NewId = () => string;
export function copyTree(document: DocumentV3, ids: readonly string[]): TreeClipboard {
  validateDocumentV3(document);
  const roots = selectionRoots(indexTree(document), ids);
  return { source: cloneDocument(document), ids: roots.map(item => item.node.instance_id) };
}
export function freshId(used: Set<string>, nextId: NewId): string {
  const id = nextId();
  if (used.has(id)) reject('generated_id', '$');
  try { validateRule(id, schema.$defs.uuid, schema.$defs); }
  catch (error) { if (error instanceof V3Error) reject('generated_id', '$'); throw error; }
  used.add(id);
  return id;
}
/** Clone roots, reconnect local fragment references, and import only referenced assets. */
export function materializeClipboard(target: DocumentV3, clipboard: TreeClipboard, nextId: NewId): Node[] {
  validateDocumentV3(clipboard.source);
  const source = cloneDocument(clipboard.source);
  const roots = selectionRoots(indexTree(source), clipboard.ids).map(item => item.node);
  const ids = new Map<string, string>();
  const used = new Set([...indexTree(target).keys(), ...indexTree(source).keys()]);
  function walk(nodes: Node[], visitor: (node: Node) => void): void {
    nodes.forEach(node => { visitor(node); walk(node.slots.content ?? [], visitor); });
  }
  walk(roots, node => ids.set(node.instance_id, freshId(used, nextId)));
  const assets = new Map<string, string>();
  const assetIds = new Set([...source.assets, ...target.assets].map(asset => asset.asset_id));
  function assetId(id: string): string {
    const mapped = assets.get(id);
    if (mapped) return mapped;
    const asset = source.assets.find(item => item.asset_id === id) ?? reject('asset_reference', id);
    const existing = target.assets.find(item => item.asset_id === id);
    const newId = existing && existing.url !== asset.url ? freshId(assetIds, nextId) : id;
    if (!existing || newId !== id) target.assets.push({ ...asset, asset_id: newId });
    assets.set(id, newId);
    return newId;
  }
  function link(value: Link): void {
    const replacement = ids.get(value.url.slice('#node-'.length));
    if (value.url.startsWith('#node-') && replacement) value.url = '#' + nodeAnchor(replacement);
  }
  function run(value: Run): void { if (value.link) link(value.link); }
  walk(roots, node => {
    node.instance_id = ids.get(node.instance_id) ?? reject('generated_id', '$');
    if (node.behavior) node.behavior = remapBehavior(node.behavior, ids);
    if (node.binding) node.binding = remapBinding(node.binding, ids);
    if (node.type === 'media.image') node.props.asset_id = assetId(node.props.asset_id);
    if (node.type === 'action.link') link(node.props.link);
    if (node.type === 'content.heading') node.props.runs.forEach(run);
    if (node.type === 'content.text') node.props.paragraphs.flat().forEach(run);
    for (const style of [node.style, ...Object.values(node.responsive)]) {
      if (style.background?.kind === 'image') style.background.asset_id = assetId(style.background.asset_id);
    }
  });
  // Preserve appearance across documents whose semantic tokens have different values.
  // The source is already schema-validated; replace only typed Color objects.
  return JSON.parse(JSON.stringify(roots, (_key, value: unknown) => {
    if (typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'token'
      && 'value' in value && typeof value.value === 'string' && Object.hasOwn(source.tokens, value.value)) {
      const key = value.value as keyof DocumentV3['tokens'];
      if (JSON.stringify(source.tokens[key]) !== JSON.stringify(target.tokens[key])) return source.tokens[key];
    }
    return value;
  })) as Node[];
}
