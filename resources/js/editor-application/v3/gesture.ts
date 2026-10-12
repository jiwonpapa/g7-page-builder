import type { DocumentCommand } from '../../documents/v3/designCommands';
import { executeDocumentCommand } from '../../documents/v3/designCommands';
import { geometryTargets, type GeometryBox } from '../../documents/v3/geometry';
import type { TreeResult } from '../../documents/v3/commands';
import { reject } from '../../documents/v3/schema';
import type { EditContext, Snapshot } from './session';

export interface GesturePort {
  read(): Snapshot;
  execute(command: DocumentCommand, expected: EditContext): TreeResult;
}
/** Only holds a provisional command. Canonical document and Undo remain in EditorPort. */
export function createGeometryGesture(port: GesturePort) {
  let pending: { context: EditContext; ids: string[]; command: DocumentCommand | null } | null = null;
  const current = () => {
    const snapshot = port.read(), expected = pending?.context;
    if (!expected || snapshot.context.readonly || expected.readonly
      || snapshot.context.documentId !== expected.documentId || snapshot.context.sessionId !== expected.sessionId
      || snapshot.context.revision !== expected.revision) {
      pending = null; reject('gesture_cancelled', '$');
    }
    return snapshot;
  };
  return {
    begin(ids: readonly string[], boxes: readonly GeometryBox[]) {
      pending = null;
      const snapshot = port.read();
      if (snapshot.context.readonly) reject('readonly', '$');
      const roots = geometryTargets(snapshot.document, ids, boxes);
      pending = { context: { ...snapshot.context }, ids: roots.map(({ box }) => box.id), command: null };
    },
    preview(command: DocumentCommand): TreeResult {
      const snapshot = current();
      if (command.kind !== 'styles' || JSON.stringify(command.updates.map(update => update.id)) !== JSON.stringify(pending!.ids)) {
        pending = null; reject('gesture_targets', '$');
      }
      try {
        const result = executeDocumentCommand(snapshot.document, command, () => reject('gesture_identity', '$'));
        pending!.command = JSON.parse(JSON.stringify(command)) as DocumentCommand;
        return result;
      } catch (error) { pending = null; throw error; }
    },
    finish(): TreeResult | null {
      current();
      const transaction = pending!;
      pending = null;
      return transaction.command ? port.execute(transaction.command, transaction.context) : null;
    },
    cancel() { pending = null; },
    active: () => pending !== null,
  };
}
