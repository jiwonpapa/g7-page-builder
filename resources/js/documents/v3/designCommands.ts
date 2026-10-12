import schema from '../../../../schemas/page-builder-document-v3.schema.json';
import type { DocumentV3, Style } from './types';
import { validateDocumentV3, designPolicyV3, type Viewport } from './validate';
import { jsonBytes, reject } from './schema';
import { assertEditable, cloneDocument, indexTree, location, selectionRoots } from './tree';
import { executeTreeCommand, type TreeCommand, type TreeResult } from './commands';
import type { NewId } from './clipboard';

export type DesignCommand =
  | { kind: 'style'; id: string; set: Style; reset?: (keyof Style)[]; viewport?: Viewport }
  | { kind: 'styles'; updates: { id: string; set: Style; reset?: (keyof Style)[] }[]; viewport?: Viewport }
  | { kind: 'content'; id: string; props: unknown }
  | { kind: 'behavior'; id: string; value: unknown };
export type AtomicCommand = TreeCommand | DesignCommand;
export type DocumentCommand = AtomicCommand | { kind: 'transaction'; commands: AtomicCommand[] };

/** One immutable command for panel and canvas; never a vendor/history payload. */
export function executeDocumentCommand(source: DocumentV3, command: DocumentCommand, nextId: NewId): TreeResult {
  if (command.kind === 'transaction') {
    validateDocumentV3(source);
    if (jsonBytes(command, designPolicyV3.limits.json_depth) > designPolicyV3.limits.utf8_bytes) reject('byte_limit', '$');
    if (!command.commands.length || command.commands.length > designPolicyV3.limits.transaction_commands
      || command.commands.some(part => Object.hasOwn(part, 'commands'))) reject('transaction', '$');
    let result: TreeResult = { document: source, selection: [], changed: false };
    for (const part of command.commands) result = executeDocumentCommand(result.document, part, nextId);
    const changed = JSON.stringify(source) !== JSON.stringify(result.document);
    return { ...result, changed, document: changed ? result.document : source };
  }
  if (command.kind !== 'style' && command.kind !== 'styles' && command.kind !== 'content' && command.kind !== 'behavior') return executeTreeCommand(source, command, nextId);
  validateDocumentV3(source);
  const viewport = command.kind === 'content' || command.kind === 'behavior' ? 'base' : command.viewport ?? 'base';
  if (!['base', 'tablet', 'mobile'].includes(viewport)) reject('viewport', '$');
  if (jsonBytes(command, designPolicyV3.limits.json_depth) > designPolicyV3.limits.utf8_bytes) reject('byte_limit', '$');
  const document = cloneDocument(source), tree = indexTree(document);
  const updates = command.kind === 'styles' ? command.updates : [command];
  if (new Set(updates.map(update => update.id)).size !== updates.length) reject('duplicate_update', '$');
  const roots = selectionRoots(tree, updates.map(update => update.id));
  // Validate every selected target, including a child covered by its parent.
  for (const update of updates) assertEditable(location(tree, update.id));
  for (const item of roots) {
    const update = updates.find(value => value.id === item.node.instance_id)!;
    if (command.kind === 'content') {
      // Every primitive uses the same schema/semantic validator; no per-composition allowlist.
      Object.assign(item.node, { props: JSON.parse(JSON.stringify(command.props)) });
    } else if (command.kind === 'behavior') {
      assertEditable(item, true);
      if (command.value === null) delete item.node.behavior;
      else Object.assign(item.node, { behavior: JSON.parse(JSON.stringify(command.value)) });
    } else if ('set' in update) {
      const layer = viewport === 'base' ? item.node.style : item.node.responsive[viewport] ?? {};
      const previousLayer = JSON.stringify(layer);
      for (const key of update.reset ?? []) {
        if (!Object.hasOwn(schema.$defs.style.properties, key) || Object.hasOwn(update.set, key)) reject('style_reset', key);
        delete layer[key];
      }
      Object.assign(layer, JSON.parse(JSON.stringify(update.set)));
      if (viewport !== 'base' && JSON.stringify(layer) !== previousLayer) {
        // Reset removes only the selected layer; never copy inherited values.
        if (Object.keys(layer).length) item.node.responsive[viewport] = layer;
        else delete item.node.responsive[viewport];
      }
    }
  }
  validateDocumentV3(document);
  const changed = JSON.stringify(document) !== JSON.stringify(source);
  return { document: changed ? document : source, selection: roots.map(item => item.node.instance_id), changed };
}
