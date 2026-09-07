import React from 'react';
import { acceptsNativeValue } from '../../native-editor/domain/fields';
import { readNativeFields } from './fields';
import { readNativeMedia } from './media';
import { readNativeNode } from '../../native-editor/domain/node';
import { prepareNativeTextChange } from '../../native-editor/domain/textChange';
import type { NativeContext, NativeHost, NativePath } from '../../native-editor/ports/host';
import { NativeTextPanel } from '../../native-editor/ui/NativeTextPanel';

declare global {
  interface Window {
    G7Core?: { layoutEditor?: {
      onReady?: (ready: () => void) => void;
      registerPanel?: (id: string, panel: { label: string; render: React.ComponentType<{ host: unknown }> } | null) => void;
    } };
  }
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function readContext(input: unknown): NativeContext | null {
  if (!record(input)) return null;
  const { templateIdentifier, layoutName, editMode, sessionId, revision, lockVersion, readonly, nodeId, path } = input;
  if (typeof templateIdentifier !== 'string' || !templateIdentifier || typeof layoutName !== 'string' || !layoutName
    || typeof editMode !== 'string' || typeof sessionId !== 'string' || !sessionId || typeof nodeId !== 'string' || !nodeId
    || typeof readonly !== 'boolean' || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0
    || typeof lockVersion !== 'number' || !Number.isSafeInteger(lockVersion) || lockVersion < 0 || !Array.isArray(path) || !path.length) return null;
  const parsed: NativePath = [];
  for (const segment of path) {
    if (typeof segment === 'number' && Number.isSafeInteger(segment) && segment >= 0) parsed.push(segment);
    else if (record(segment) && typeof segment.responsive === 'string' && segment.responsive) parsed.push(Object.freeze({ responsive: segment.responsive }));
    else return null;
  }
  Object.freeze(parsed);
  return Object.freeze({ templateIdentifier, layoutName, editMode, sessionId, revision, lockVersion, readonly, nodeId, path: parsed });
}
/** Only the verified public protocol can become an application port. */
export function readNativeHost(input: unknown): NativeHost | null {
  if (!record(input) || input.protocol !== 'g7.layout-editor/1' || !record(input.snapshot) || typeof input.execute !== 'function') return null;
  const context = readContext(input.snapshot.context);
  const parsed = readNativeNode(input.snapshot.node);
  if (!context || parsed.status !== 'valid' || context.nodeId !== parsed.node.id) return null;
  const execute = input.execute;
  const fields = readNativeFields(input.snapshot.fields);
  function invoke(command: object): ReturnType<NativeHost['applyText']> {
    try {
      const result: unknown = execute(command);
      if (record(result) && (result.kind === 'applied' || result.kind === 'noop')) return { kind: result.kind };
      if (record(result) && result.kind === 'refused' && typeof result.reason === 'string') return { kind: 'refused', reason: result.reason };
    } catch { return { kind: 'refused', reason: 'host-error' }; }
    return { kind: 'refused', reason: 'invalid-result' };
  }
  return { context, node: parsed.node, fields, media: readNativeMedia(input.media, context),
    applyField(id, value, reset = false) {
      const field = fields.find(item => item.id === id);
      if (context.readonly || context.editMode !== 'route' || !field || !acceptsNativeValue(field, value, reset)) return { kind: 'refused', reason: 'unsupported-field' };
      return invoke({ kind: 'setControl', expected: context, control: id, value, reset });
    }, applyText(text) {
    if (context.readonly || context.editMode !== 'route') return { kind: 'refused', reason: 'readonly' };
    const change = prepareNativeTextChange(parsed.node, parsed.node.text, text);
    if (change.status === 'unchanged') return { kind: 'noop' };
    if (change.status !== 'changed') return { kind: 'refused', reason: change.reason };
    return invoke({ kind: 'setText', expected: context, text });
  } };
}
function NativePanel({ host }: { host: unknown }): React.ReactElement {
  return <NativeTextPanel host={readNativeHost(host)} />;
}
export function registerNativeEditor(): boolean {
  if (typeof window.G7Core?.layoutEditor?.registerPanel !== 'function') return false;
  window.G7Core.layoutEditor.registerPanel('jiwonpapa-page-builder/detail', { label: '페이지 빌더 · 상세 편집', render: NativePanel });
  return true;
}
