import { copyTree, type TreeClipboard } from '../../documents/v3/clipboard';
import { cloneDocument } from '../../documents/v3/tree';
import { reject } from '../../documents/v3/schema';
import { validateDocumentV3 } from '../../documents/v3/validate';
import type { DocumentV3 } from '../../documents/v3/types';

/** Session catalog input, not another persisted document grammar.
 * Each source is an ordinary versioned PageBuilderDocument. Catalog identity
 * and labels are derived from that source; no block registry is consulted.
 */
export interface CompositionChoice { id: string; label: string; source: DocumentV3 }
export function compositionChoices(sources: readonly unknown[]): CompositionChoice[] {
  const ids = new Set<string>();
  return sources.map(value => {
    const source = cloneDocument(validateDocumentV3(value));
    if (ids.has(source.document_id)) reject('duplicate_composition', source.document_id);
    if (!source.blocks.length) reject('empty_composition', source.document_id);
    ids.add(source.document_id);
    return { id: source.document_id, label: source.blocks[0].name || source.slug, source };
  });
}
/** Paste owns ID remapping, asset imports, token resolution and the one Undo. */
export function compositionClipboard(choice: CompositionChoice): TreeClipboard {
  return copyTree(choice.source, choice.source.blocks.map(node => node.instance_id));
}
