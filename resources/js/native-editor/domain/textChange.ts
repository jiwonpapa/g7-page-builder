import { readNativeNode, type NativeNode } from './node';

export type NativeTextChange =
  | { status: 'changed'; node: NativeNode; previousText: string }
  | { status: 'unchanged' }
  | { status: 'refused'; reason: 'invalid-node' | 'unsupported-origin' | 'unsupported-node'
      | 'unsupported-text' | 'non-plain-text' | 'stale-text' };

/** Conservative plain-text scope, not a replacement for G7's binding parser or markup editor. */
function isPlainText(value: string): boolean {
  return !/\{\{|\}\}|\$[A-Za-z_][A-Za-z0-9_]*:|\{p[0-9]+\}|<[^>]+>/.test(value);
}

/**
 * Prepare a detached node change only. This does not authorize, apply, save or add history.
 * The future host adapter must revalidate document/session/revision/path/readonly atomically.
 */
export function prepareNativeTextChange(input: unknown, expectedText: unknown, nextText: unknown): NativeTextChange {
  const parsed = readNativeNode(input);
  if (parsed.status !== 'valid') return { status: 'refused', reason: 'invalid-node' };
  const node = parsed.node;
  const origin = node.__source;
  if (!origin || typeof origin !== 'object' || Array.isArray(origin) || origin.kind !== 'route') {
    return { status: 'refused', reason: 'unsupported-origin' };
  }
  if (node.type === 'extension_point' || node.iteration !== undefined && node.iteration !== null) {
    return { status: 'refused', reason: 'unsupported-node' };
  }
  if (typeof node.text !== 'string' || typeof expectedText !== 'string' || typeof nextText !== 'string') {
    return { status: 'refused', reason: 'unsupported-text' };
  }
  if (node.text !== expectedText) return { status: 'refused', reason: 'stale-text' };
  if (!isPlainText(node.text) || !isPlainText(nextText)) return { status: 'refused', reason: 'non-plain-text' };
  if (node.text === nextText) return { status: 'unchanged' };
  return { status: 'changed', node: Object.freeze({ ...node, text: nextText }), previousText: node.text };
}
