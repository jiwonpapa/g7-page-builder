// Deliberately NOT PageBuilderDocument v3: disposable geometry proof only.
// No persistence, second history, renderer, migration, G7, or vendor imports.
export type Box = { id: string; width: number; height: number };
export type Context = { session: string; revision: number; readonly: boolean };
export type Gesture = { context: Context; before: Box[] };
export type InputOwner = 'structure' | 'geometry' | 'text';

export function beginGesture(context: Context, boxes: Box[]): Gesture | null {
  if (context.readonly || boxes.length === 0) return null;
  return { context: { ...context }, before: boxes.map(box => ({ ...box })) };
}

export function completeGesture(gesture: Gesture | null, current: Context, result: Box[]): Box[] | null {
  if (!gesture || current.readonly || current.session !== gesture.context.session
    || current.revision !== gesture.context.revision || result.length !== gesture.before.length) return null;
  const ids = new Set(result.map(box => box.id));
  if (ids.size !== result.length || gesture.before.some(box => !ids.has(box.id))) return null;
  if (result.some(box => !Number.isFinite(box.width) || !Number.isFinite(box.height)
    || box.width < 24 || box.height < 24 || box.width > 4096 || box.height > 4096)) return null;
  const before = new Map(gesture.before.map(box => [box.id, box]));
  if (result.every(box => box.width === before.get(box.id)?.width && box.height === before.get(box.id)?.height)) return null;
  return result.map(box => ({ ...box }));
}

export function nodeKeyboardAllowed(owner: InputOwner, composing: boolean, editable: boolean, readonly: boolean): boolean {
  return owner === 'geometry' && !composing && !editable && !readonly;
}

// Reduce only a duplicate tail emitted by the same vendor gesture. The caller
// supplies Puck's history; this function holds no history or Undo state.
export function duplicateTail<T>(histories: T[], index: number, equivalent: (left: T, right: T) => boolean): T[] | null {
  if (index !== histories.length - 1 || index < 1 || !equivalent(histories[index - 1], histories[index])) return null;
  return [...histories.slice(0, -2), histories[index]];
}
