import { describe, expect, it } from 'vitest';
import { readNativeNode } from '../../resources/js/native-editor/domain/node';
import { prepareNativeTextChange } from '../../resources/js/native-editor/domain/textChange';

function nativeNode() {
  return {
    id: 'node-heading', type: 'basic', name: 'H2', text: '기존 제목',
    props: { className: 'theme-heading', 'aria-label': '$t:page.heading' },
    __source: { kind: 'route', layout: 'projects/sample', futureOrigin: { value: 1 } },
    actions: [{ event: 'click', handler: 'navigate', params: { path: '/projects' } }],
    responsive: { portable: { text: '$t:page.small', props: { className: 'theme-small' } } },
    children: [{ id: 'child', name: 'Span', text: '{{item.label}}', iteration: { source: '{{items}}' } }],
    futureField: { nullable: null, nested: [true, 0, { text: '보존' }] },
  };
}

describe('native JSON node boundary', () => {
  it('retains every JSON field and detaches nested objects from caller-owned data', () => {
    const original = nativeNode();
    const result = readNativeNode(original);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') throw new Error(result.reason);
    expect(result.node).toEqual(original);
    expect(result.node).not.toBe(original);
    expect(result.node.futureField).not.toBe(original.futureField);
    original.futureField.nested.push(false);
    expect(result.node).not.toEqual(original);
    expect(Object.isFrozen(result.node)).toBe(true);
    expect(Object.isFrozen(result.node.futureField)).toBe(true);
  });

  it.each([null, [], {}, { id: 'x', name: 'H2' }, { id: '', name: 'H2', type: 'basic' }])(
    'rejects unsupported node shapes without guessing defaults: %j', (value) => {
      expect(readNativeNode(value).status).toBe('invalid');
    },
  );

  it.each([undefined, Number.NaN, Infinity, () => undefined, new Date(), new Map()])(
    'rejects non-JSON values instead of silently dropping them: %s', (value) => {
      expect(readNativeNode({ ...nativeNode(), future: value }).status).toBe('invalid');
    },
  );

  it('rejects cycles and sparse arrays but preserves ordinary shared values', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(readNativeNode({ ...nativeNode(), cyclic }).status).toBe('invalid');
    expect(readNativeNode({ ...nativeNode(), sparse: new Array(2) }).status).toBe('invalid');
    const shared = { retained: true };
    expect(readNativeNode({ ...nativeNode(), shared: [shared, shared] }).status).toBe('valid');
  });

  it('does not evaluate getters or drop symbol and non-enumerable fields', () => {
    let called = false;
    const accessor = Object.defineProperty(nativeNode(), 'future', { enumerable: true, get() { called = true; return 1; } });
    expect(readNativeNode(accessor).status).toBe('invalid');
    expect(called).toBe(false);
    expect(readNativeNode(Object.defineProperty(nativeNode(), 'hidden', { value: 1 })).status).toBe('invalid');
    expect(readNativeNode({ ...nativeNode(), [Symbol('future')]: true }).status).toBe('invalid');
  });

  it('preserves an own __proto__ JSON key without changing the result prototype', () => {
    const source: unknown = JSON.parse('{"id":"a","type":"basic","name":"H2","text":"제목","__proto__":{"future":true}}');
    const result = readNativeNode(source);
    if (result.status !== 'valid') throw new Error(result.reason);
    expect(Object.getPrototypeOf(result.node)).toBe(Object.prototype);
    expect(Object.hasOwn(result.node, '__proto__')).toBe(true);
    expect(JSON.stringify(result.node)).toBe(JSON.stringify(source));
  });
});

describe('native plain text change proposal', () => {
  it('changes only top-level text and preserves source, unknown fields, nested bindings and styling', () => {
    const source = nativeNode();
    const before = structuredClone(source);
    const result = prepareNativeTextChange(source, '기존 제목', '변경 제목');
    if (result.status !== 'changed') throw new Error(result.status);
    expect(result.node).toEqual({ ...before, text: '변경 제목' });
    expect(source).toEqual(before);
    expect(result.previousText).toBe('기존 제목');
    expect(Object.isFrozen(result.node)).toBe(true);
  });

  it('treats identical input as no change and allows an explicitly empty plain value', () => {
    expect(prepareNativeTextChange(nativeNode(), '기존 제목', '기존 제목').status).toBe('unchanged');
    expect(prepareNativeTextChange(nativeNode(), '기존 제목', '').status).toBe('changed');
  });

  it.each(['$t:page.heading', '문구 $t:page.heading', '{{item.name}}', '$core_settings:site.name', '{p0}', '<b>제목</b>'])(
    'preserves a bound or formatted source instead of flattening it: %s', (text) => {
      const source = { ...nativeNode(), text };
      expect(prepareNativeTextChange(source, text, '변경')).toEqual({ status: 'refused', reason: 'non-plain-text' });
      expect(source.text).toBe(text);
    },
  );

  it.each(['{{dangerous()}}', '$t:another.key', '<script>run()</script>', '{p1}'])(
    'does not introduce expressions or markup through a plain text change: %s', (value) => {
      expect(prepareNativeTextChange(nativeNode(), '기존 제목', value)).toEqual({ status: 'refused', reason: 'non-plain-text' });
    },
  );

  it.each(['base', 'partial', 'extension', 'unknown'])(
    'refuses other origins without removing their metadata: %s', (kind) => {
      const source = { ...nativeNode(), __source: { kind } };
      expect(prepareNativeTextChange(source, '기존 제목', '변경')).toEqual({ status: 'refused', reason: 'unsupported-origin' });
      expect(source.__source.kind).toBe(kind);
    },
  );

  it('rejects missing origin, extension points, iteration roots and stale text', () => {
    const { __source: _source, ...unmarked } = nativeNode();
    expect(prepareNativeTextChange(unmarked, '기존 제목', '변경')).toEqual({ status: 'refused', reason: 'unsupported-origin' });
    for (const source of [{ ...nativeNode(), type: 'extension_point' }, { ...nativeNode(), iteration: { source: '{{items}}' } }]) {
      expect(prepareNativeTextChange(source, '기존 제목', '변경')).toEqual({ status: 'refused', reason: 'unsupported-node' });
    }
    expect(prepareNativeTextChange(nativeNode(), '다른 제목', '변경')).toEqual({ status: 'refused', reason: 'stale-text' });
    expect(prepareNativeTextChange(nativeNode(), '기존 제목', null)).toEqual({ status: 'refused', reason: 'unsupported-text' });
    expect(prepareNativeTextChange({ ...nativeNode(), text: { key: 'value' } }, '기존 제목', '변경')).toEqual({ status: 'refused', reason: 'unsupported-text' });
  });
});
