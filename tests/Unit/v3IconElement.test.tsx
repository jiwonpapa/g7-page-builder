import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import schema from '../../schemas/page-builder-document-v3.schema.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { documentPresentation } from '../../resources/js/documents/v3/presentation';
import { StructurePreview } from '../../resources/js/editor/v3/NodeRenderer';
import { IconInspector } from '../../resources/js/editor/v3/IconInspector';
import { catalogIconNames, isCatalogIconName } from '../../resources/js/editor/catalogIcon';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); });
function source() {
  const document = validateDocumentV3(structuredClone(fixture));
  const node = createPrimitive('media.icon', '00000000-0000-4000-8000-000000000091', document);
  if (node.type !== 'media.icon') throw new Error('Wrong primitive');
  document.blocks = [node]; return { document, node };
}
for (const value of cases.icons) it('shares PHP validation for ' + value.name, () => {
  const { document, node } = source();
  const input = { ...document, blocks: [{ ...node, props: value.props }] }, before = JSON.stringify(input);
  if (value.valid) expect(validateDocumentV3(input)).toEqual(input);
  else expect(() => validateDocumentV3(input)).toThrow(new RegExp('^' + value.error + ':'));
  expect(JSON.stringify(input)).toBe(before);
});
it('covers every contract icon without a block registration and preserves canonical input', () => {
  const names = schema.$defs.node.properties.props.anyOf.find(rule => 'icon' in rule.properties)?.properties.icon?.enum;
  expect(catalogIconNames).toEqual(names); expect(isCatalogIconName('__proto__')).toBe(false);
  const { document: value, node } = source();
  for (const icon of catalogIconNames) {
    node.props = { icon, decorative: false, label: '설명 <문자>' };
    validateDocumentV3(value); const before = JSON.stringify(value);
    document.body.innerHTML = renderToStaticMarkup(<StructurePreview document={value} />);
    const element = document.querySelector('[data-v3-node]')!, svg = element.querySelector('svg')!;
    expect(element.getAttribute('role')).toBe('img'); expect(element.getAttribute('aria-label')).toBe('설명 <문자>');
    expect(svg.children.length).toBeGreaterThan(0); expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('100%'); expect(svg.getAttribute('height')).toBe('100%');
    expect(JSON.stringify(value)).toBe(before);
  }
  node.props.decorative = true;
  document.body.innerHTML = renderToStaticMarkup(<StructurePreview document={value} />);
  const element = document.querySelector('[data-v3-node]')!;
  expect(element.getAttribute('role')).toBeNull(); expect(element.getAttribute('aria-label')).toBeNull();
  expect(element.getAttribute('aria-hidden')).toBe('true');
});
it('uses common commands and responsive style without changing the original or accepting a child', () => {
  const { document: original, node } = source(), before = JSON.stringify(original);
  const changed = executeDocumentCommand(original, { kind: 'transaction', commands: [
    { kind: 'content', id: node.instance_id, props: { icon: 'star', decorative: false, label: '중요' } },
    { kind: 'style', id: node.instance_id, set: { width: { value: 48, unit: 'px' }, height: { value: 32, unit: 'px' }, color: { kind: 'hex', value: '#123456' } }, reset: [] },
    { kind: 'style', id: node.instance_id, viewport: 'mobile', set: { width: { value: 20, unit: 'px' } }, reset: [] },
  ] }, () => crypto.randomUUID()).document;
  expect(documentPresentation(original).get(node.instance_id)).toMatchObject({ width: '24px', height: '24px' });
  expect(documentPresentation(changed).get(node.instance_id)).toMatchObject({ width: '48px', height: '32px', color: '#123456' });
  expect(documentPresentation(changed, 'mobile').get(node.instance_id)?.width).toBe('20px');
  expect(validateDocumentV3(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
  expect(JSON.stringify(original)).toBe(before);
  const child = createPrimitive('content.text', '00000000-0000-4000-8000-000000000092', original);
  expect(() => validateDocumentV3({ ...original, blocks: [{ ...node, slots: { content: [child] } }] })).toThrow('leaf_slots:');
});
it('exposes one element Inspector and surfaces rejected commands without issuing a replacement write', async () => {
  const { node } = source(), apply = vi.fn(() => { throw new Error('readonly'); });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<IconInspector node={node} disabled={false} apply={apply} />));
  expect(host.querySelectorAll('option')).toHaveLength(catalogIconNames.length);
  const select = host.querySelector('select')!;
  await act(async () => { select.value = 'star'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'content', id: node.instance_id, props: { icon: 'star', label: '', decorative: true } });
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('readonly'); expect(node.props.icon).toBe('check');
  await act(async () => root!.render(<IconInspector node={node} disabled apply={apply} />));
  expect(host.querySelector('fieldset')?.disabled).toBe(true);
});
