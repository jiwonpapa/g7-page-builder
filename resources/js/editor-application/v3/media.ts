import type { ImageAsset, ImageCommand, ImageInsertCommand } from '../../documents/v3/media';
import type { Destination } from '../../documents/v3/commands';
import { validateImageAsset } from '../../documents/v3/media';
import { reject } from '../../documents/v3/schema';
import type { EditContext } from './session';

export interface MediaChoice extends ImageAsset { name: string; width: number; height: number }
export interface MediaPort {
  list(): Promise<MediaChoice[]>;
  upload(file: unknown): Promise<MediaChoice>;
}
export interface MediaTarget { context: EditContext; nodeId: string | null }
export type MediaOutcome<T> = { status: 'ready'; value: T } | { status: 'stale' };

function snapshot(value: MediaTarget): MediaTarget {
  if (!value.nodeId || value.context.readonly) reject('media_target', '$');
  return { context: { ...value.context }, nodeId: value.nodeId };
}
function same(left: MediaTarget, right: MediaTarget): boolean {
  return !right.context.readonly && left.nodeId === right.nodeId && left.context.documentId === right.context.documentId
    && left.context.sessionId === right.context.sessionId && left.context.revision === right.context.revision;
}

/** Pending media never owns a second document or history and never deletes files. */
export function createMediaSession(read: () => MediaTarget, commit: (command: ImageCommand, expected: EditContext) => void) {
  let sequence = 0;
  let uploading = false;
  return {
    cancel(): void { sequence++; },
    choose(asset: ImageAsset, alt: string): void {
      const target = snapshot(read());
      const value = validateImageAsset(asset);
      if (!same(target, read())) reject('stale_context', '$');
      sequence++;
      commit({ kind: 'image', id: target.nodeId!, asset: value, alt }, target.context);
    },
    async list(port: MediaPort): Promise<MediaOutcome<MediaChoice[]>> {
      const target = snapshot(read());
      const token = ++sequence;
      try {
        const values = await port.list();
        if (token !== sequence || !same(target, read())) return { status: 'stale' };
        values.forEach(validateImageAsset);
        return { status: 'ready', value: values };
      } catch (error) {
        if (token !== sequence || !same(target, read())) return { status: 'stale' };
        throw error;
      }
    },
    async upload(port: MediaPort, file: unknown, alt: string): Promise<MediaOutcome<MediaChoice>> {
      if (uploading) reject('media_pending', '$');
      const target = snapshot(read());
      const token = ++sequence;
      uploading = true;
      try {
        const value = await port.upload(file);
        validateImageAsset(value);
        if (token !== sequence || !same(target, read())) return { status: 'stale' };
        commit({ kind: 'image', id: target.nodeId!, asset: { asset_id: value.asset_id, url: value.url }, alt }, target.context);
        return { status: 'ready', value };
      } catch (error) {
        if (token !== sequence || !same(target, read())) return { status: 'stale' };
        throw error;
      } finally { uploading = false; }
    },
  };
}

export interface MediaInsertionContext { context: EditContext; destination: Destination; selection: string[] }
export function createMediaInsertionSession(read: () => MediaInsertionContext,
  commit: (command: ImageInsertCommand, expected: EditContext) => void) {
  let sequence = 0;
  const snapshot = () => {
    const value = read();
    if (value.context.readonly) reject('readonly', '$');
    return { context: { ...value.context }, destination: { ...value.destination }, selection: [...value.selection] };
  };
  const current = (value: MediaInsertionContext, token: number) => {
    const latest = read();
    return token === sequence && !latest.context.readonly && value.context.documentId === latest.context.documentId
      && value.context.sessionId === latest.context.sessionId && value.context.revision === latest.context.revision
      && value.destination.parentId === latest.destination.parentId && value.destination.index === latest.destination.index
      && JSON.stringify(value.selection) === JSON.stringify(latest.selection);
  };
  return {
    cancel(): void { sequence++; },
    choose(asset: ImageAsset, alt: string): void {
      const value = snapshot(), token = ++sequence;
      const checked = validateImageAsset(asset);
      if (!current(value, token)) reject('stale_context', '$');
      commit({ kind: 'image-insert', destination: value.destination, asset: checked, alt }, value.context);
    },
    url(url: string, alt: string, nextId: () => string): void {
      const value = snapshot(), token = ++sequence;
      const asset = validateImageAsset({ asset_id: nextId(), url });
      if (!current(value, token)) reject('stale_context', '$');
      commit({ kind: 'image-insert', destination: value.destination, asset, alt }, value.context);
    },
    async list(port: MediaPort): Promise<MediaOutcome<MediaChoice[]>> {
      const value = snapshot(), token = ++sequence;
      try {
        const values = await port.list();
        if (!current(value, token)) return { status: 'stale' };
        values.forEach(validateImageAsset);
        return { status: 'ready', value: values };
      } catch (error) { if (!current(value, token)) return { status: 'stale' }; throw error; }
    },
    async upload(port: MediaPort, file: unknown, alt: string): Promise<MediaOutcome<MediaChoice>> {
      const value = snapshot(), token = ++sequence;
      try {
        const asset = await port.upload(file);
        if (!current(value, token)) return { status: 'stale' };
        commit({ kind: 'image-insert', destination: value.destination,
          asset: validateImageAsset(asset), alt }, value.context);
        return { status: 'ready', value: asset };
      } catch (error) { if (!current(value, token)) return { status: 'stale' }; throw error; }
    },
  };
}
