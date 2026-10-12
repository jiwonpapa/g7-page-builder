import schema from '../../../../schemas/page-builder-document-v3.schema.json';
import type { DocumentV3, Style } from './types';
import { validateDocumentV3, designPolicyV3 } from './validate';
import { jsonBytes, reject } from './schema';
import { assertEditable, cloneDocument, indexTree, location } from './tree';
import { executeTreeCommand, type TreeCommand, type TreeResult } from './commands';
import type { NewId } from './clipboard';

export type DesignCommand =
  | { kind: 'style'; id: string; set: Style; reset?: (keyof Style)[] }
  | { kind: 'content'; id: string; props: unknown };
export type DocumentCommand = TreeCommand | DesignCommand;

/** One immutable command for panel and canvas; never a vendor/history payload. */
export function executeDocumentCommand(source: DocumentV3, command: DocumentCommand, nextId: NewId): TreeResult {
  if (command.kind !== 'style' && command.kind !== 'content') return executeTreeCommand(source, command, nextId);
  validateDocumentV3(source);
  if (jsonBytes(command, designPolicyV3.limits.json_depth) > designPolicyV3.limits.utf8_bytes) reject('byte_limit', '$');
  const document = cloneDocument(source), item = location(indexTree(document), command.id);
  assertEditable(item);
  if (command.kind === 'style') {
    for (const key of command.reset ?? []) {
      if (!Object.hasOwn(schema.$defs.style.properties, key) || Object.hasOwn(command.set, key)) reject('style_reset', key);
      delete item.node.style[key];
    }
    Object.assign(item.node.style, JSON.parse(JSON.stringify(command.set)));
  } else {
    if (!['content.heading', 'content.text', 'action.link'].includes(item.node.type)) reject('content_type', item.node.instance_id);
    Object.assign(item.node, { props: JSON.parse(JSON.stringify(command.props)) });
  }
  validateDocumentV3(document);
  const changed = JSON.stringify(document) !== JSON.stringify(source);
  return { document: changed ? document : source, selection: [command.id], changed };
}
