import type { ImageAsset, ImageCommand } from '../../documents/v3/media';
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
