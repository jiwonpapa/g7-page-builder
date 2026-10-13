import type { DocumentV3 } from '../../documents/v3/types';
import { copyTree, type NewId } from '../../documents/v3/clipboard';
import { cloneDocument, indexTree } from '../../documents/v3/tree';
import { executeTreeCommand } from '../../documents/v3/commands';
import { validateDocumentV3 } from '../../documents/v3/validate';
import { reject } from '../../documents/v3/schema';
import type { EditContext } from './session';

export interface UserComposition { id: string; title: string; source: DocumentV3 | null; error?: string }
export interface CompositionLibraryPort {
  list(): Promise<UserComposition[]>;
  create(title: string, source: DocumentV3): Promise<UserComposition>;
  remove(id: string): Promise<void>;
}

/** Same versioned document and paste grammar; only the selected roots and assets are retained. */
export function captureComposition(source: DocumentV3, ids: string[], nextId: NewId): DocumentV3 {
  const clipboard = copyTree(source, ids);
  if (!clipboard.ids.length) reject('empty_composition', '$');
  const target = cloneDocument(source);
  target.document_id = nextId(); target.slug = 'composition-' + target.document_id;
  target.shell_mode = 'none'; target.blocks = []; target.assets = []; delete target.seo;
  const result = executeTreeCommand(target, { kind: 'paste', destination: { parentId: null, index: 0 }, clipboard }, nextId).document;
  const nodes = indexTree(result);
  const reference = (url: string) => {
    if (url.startsWith('#node-') && !nodes.has(url.slice(6))) reject('composition_reference', url);
  };
  for (const { node } of nodes.values()) {
    if (node.type === 'action.link') reference(node.props.link.url);
    if (node.type === 'content.heading') node.props.runs.forEach(run => { if (run.link) reference(run.link.url); });
    if (node.type === 'content.text') node.props.paragraphs.flat().forEach(run => { if (run.link) reference(run.link.url); });
  }
  return validateDocumentV3(result);
}

export interface CompositionContext { context: EditContext; document: DocumentV3; ids: string[] }
function same(left: EditContext, right: EditContext): boolean {
  return !right.readonly && left.documentId === right.documentId && left.sessionId === right.sessionId && left.revision === right.revision;
}
export function createCompositionLibrarySession(read: () => CompositionContext, nextId: NewId) {
  let pending = false;
  return {
    async save(port: CompositionLibraryPort, title: string): Promise<{ status: 'saved' | 'stale'; value: UserComposition }> {
      if (pending) reject('composition_pending', '$');
      const snapshot = read();
      if (snapshot.context.readonly) reject('readonly', '$');
      if (!title.trim() || title.trim().length > 120) reject('composition_title', '$');
      const expected = { ...snapshot.context };
      const source = captureComposition(snapshot.document, snapshot.ids, nextId);
      if (!same(expected, read().context)) reject('stale_context', '$');
      pending = true;
      try {
        const value = await port.create(title.trim(), source);
        return { status: same(expected, read().context) ? 'saved' : 'stale', value };
      } finally { pending = false; }
    },
  };
}
