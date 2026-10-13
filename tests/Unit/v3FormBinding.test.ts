import { expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { copyTree } from '../../resources/js/documents/v3/clipboard';
import { remapBinding } from '../../resources/js/documents/v3/bindings';
import { indexTree } from '../../resources/js/documents/v3/tree';

const source = () => validateDocumentV3({ ...structuredClone(fixture), blocks: structuredClone(cases.form_binding.blocks) });
const uuid = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
for (const entry of cases.form_binding.cases) it('PHP/TS service binding: ' + entry.name, () => {
  const candidate = { ...structuredClone(fixture), blocks: structuredClone(cases.form_binding.blocks) };
  for (const change of entry.changes) {
    let target: unknown = candidate.blocks;
    for (const key of change.path.slice(0, -1)) {
      if (typeof target !== 'object' || target === null) throw new Error('Fixture path');
      target = Reflect.get(target, key);
    }
    if (typeof target !== 'object' || target === null) throw new Error('Fixture target');
    Reflect.set(target, change.path.at(-1)!, structuredClone(change.value));
  }
  const before = JSON.stringify(candidate);
  if (entry.valid) expect(validateDocumentV3(candidate)).toEqual(candidate);
  else expect(() => validateDocumentV3(candidate)).toThrow(new RegExp('^' + ('error' in entry ? entry.error : '') + ':'));
  expect(JSON.stringify(candidate)).toBe(before);
});
it('uses common primitive insertion/content/style commands without storing entered values', () => {
  const document = source(), before = JSON.stringify(document);
  for (const type of ['form.control', 'form.label'] as const) {
    const node = createPrimitive(type, uuid(91), document);
    const inserted = executeDocumentCommand(document, { kind: 'insert', nodes: [node], destination: { parentId: null, index: 1 } }, () => '').document;
    const changed = executeDocumentCommand(inserted, { kind: 'style', id: node.instance_id, viewport: 'mobile',
      set: { width: { value: 100, unit: '%' }, color: { kind: 'hex', value: '#334455' } } }, () => '').document;
    expect(changed.blocks[1].responsive.mobile?.width).toEqual({ value: 100, unit: '%' });
    const props = { ...node.props, label: '새 라벨' };
    expect(executeDocumentCommand(changed, { kind: 'content', id: node.instance_id, props }, () => '').document.blocks[1].props).toEqual(props);
    expect(() => executeDocumentCommand(changed, { kind: 'content', id: node.instance_id, props: { ...props, value: 'private input' } }, () => '')).toThrow('value:');
  }
  expect(JSON.stringify(document)).toBe(before);
});
it('adds/removes/replaces the fixed binding through the same immutable command, respecting descendant locks', () => {
  const document = source(), host = document.blocks[0], binding = host.binding!, before = JSON.stringify(document);
  expect(executeDocumentCommand(document, { kind: 'binding', id: host.instance_id, value: binding }, () => '').changed).toBe(false);
  const unbound = executeDocumentCommand(document, { kind: 'binding', id: host.instance_id, value: null }, () => '').document;
  expect(unbound.blocks[0].binding).toBeUndefined();
  expect(executeDocumentCommand(unbound, { kind: 'binding', id: host.instance_id, value: binding }, () => '').document).toEqual(document);
  expect(() => executeDocumentCommand(document, { kind: 'binding', id: host.instance_id, value: { ...binding, submit_id: uuid(99) } }, () => '')).toThrow('binding_reference:');
  const locked = source(); locked.blocks[0].slots.content![0].locked = true;
  expect(() => executeDocumentCommand(locked, { kind: 'binding', id: host.instance_id, value: null }, () => '')).toThrow('locked:');
  expect(JSON.stringify(document)).toBe(before);
});
it('copies whole forms with fresh references, copies standalone fields unbound, and rejects dangling ownership', () => {
  const document = source(), host = document.blocks[0], before = JSON.stringify(document);
  let sequence = 100;
  const copied = executeDocumentCommand(document, { kind: 'duplicate', ids: [host.instance_id] }, () => uuid(++sequence)).document;
  const duplicate = copied.blocks[1], ids = new Set([...indexTree({ ...copied, blocks: [duplicate] }).keys()]);
  expect(duplicate.binding).not.toEqual(host.binding);
  expect(ids.has(duplicate.binding!.submit_id)).toBe(true);
  expect(ids.has(duplicate.binding!.status_id)).toBe(true);
  for (const field of duplicate.binding!.fields) { expect(ids.has(field.input_id)).toBe(true); expect(ids.has(field.label_id)).toBe(true); }
  const input = host.binding!.fields[0].input_id;
  const pasted = executeDocumentCommand(document, { kind: 'paste', clipboard: copyTree(document, [input]),
    destination: { parentId: null, index: 1 } }, () => uuid(++sequence)).document;
  expect(pasted.blocks[1].type).toBe('form.control'); expect(pasted.blocks[1].binding).toBeUndefined();
  expect(() => remapBinding(host.binding!, new Map())).toThrow('binding_clipboard:');
  for (const command of [
    { kind: 'delete' as const, ids: [input] },
    { kind: 'move' as const, ids: [input], destination: { parentId: null, index: 1 } },
  ]) expect(() => executeDocumentCommand(document, command, () => uuid(++sequence))).toThrow('binding_reference:');
  expect(executeDocumentCommand(document, { kind: 'delete', ids: [host.instance_id] }, () => '').document.blocks).toEqual([]);
  expect(JSON.stringify(document)).toBe(before);
});
it('cannot reuse interaction buttons as submission controls or put behavior on a service owner', () => {
  const document = source(), host = document.blocks[0], submit = host.slots.content!.splice(12, 1)[0];
  const group = createPrimitive('layout.container', uuid(20), document);
  const item = createPrimitive('layout.container', uuid(21), document);
  const panel = createPrimitive('layout.container', uuid(22), document);
  item.slots.content = [submit, panel]; group.slots.content = [item];
  group.behavior = { kind: 'disclosure', mode: 'single', pairs: [{ item_id: item.instance_id, trigger_id: submit.instance_id, panel_id: panel.instance_id, expanded: true }] };
  host.slots.content!.push(group);
  expect(() => validateDocumentV3(document)).toThrow('binding_action:');
  host.behavior = group.behavior; delete group.behavior;
  expect(() => validateDocumentV3(document)).toThrow('binding_owner:');
});
