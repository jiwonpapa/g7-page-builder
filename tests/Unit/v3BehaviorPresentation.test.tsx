import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { behaviorPresentation } from '../../resources/js/documents/v3/behaviorPresentation';
import { indexTree, nodeAnchor } from '../../resources/js/documents/v3/tree';
import { StructurePreview } from '../../resources/js/editor/v3/NodeRenderer';
import { BehaviorPreview } from '../../resources/js/editor/v3/BehaviorPreview';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach(run => run())); });
const source = (kind: keyof typeof cases.behavior_fixtures) => validateDocumentV3({ ...structuredClone(fixture), blocks: structuredClone(cases.behavior_fixtures[kind]) });
const id = (n: number) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
describe('common behavior output from the canonical document', () => {
  it('inherits button typography without overriding authored and responsive values', () => {
    const document = source('tabs'), button = indexTree(document).get(id(102))!.node;
    for (const key of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']) {
      expect(behaviorPresentation(document).styles.get(id(102))?.[key]).toBe('inherit');
    }
    button.style.font_size = { value: 22, unit: 'px' }; button.responsive.mobile = { font_size: { value: 18, unit: 'px' } };
    expect(behaviorPresentation(document).styles.get(id(102))?.['font-size']).toBe('22px');
    expect(behaviorPresentation(document, 'mobile').styles.get(id(102))?.['font-size']).toBe('18px');
  });
  it.each(['tabs', 'disclosure', 'carousel', 'nested'] as const)('renders %s with stable native controls and no source mutation', kind => {
    const document = source(kind), before = JSON.stringify(document), host = globalThis.document.createElement('div');
    host.innerHTML = renderToStaticMarkup(<StructurePreview document={document} />);
    for (const { node } of indexTree(document).values()) {
      const element = host.querySelector('#' + nodeAnchor(node.instance_id));
      expect(element).not.toBeNull();
      if (node.type === 'action.button') expect(element?.tagName).toBe('BUTTON');
    }
    for (const control of host.querySelectorAll('[aria-controls]')) {
      expect(host.querySelector('#' + control.getAttribute('aria-controls'))).not.toBeNull();
      expect(control.getAttribute('type')).toBe('button');
    }
    expect(new Set([...host.querySelectorAll('[id]')].map(node => node.id)).size).toBe(host.querySelectorAll('[id]').length);
    expect(JSON.stringify(document)).toBe(before);
  });
  it('uses layout defaults only for unspecified values and preserves responsive hidden', () => {
    const document = source('carousel'), tree = indexTree(document);
    let output = behaviorPresentation(document);
    expect(output.styles.get(id(304))?.overflow).toBe('hidden');
    expect(output.styles.get(id(305))?.display).toBe('flex');
    expect(output.styles.get(id(306))?.['flex-basis']).toBe('100%');
    tree.get(id(305))!.node.style.display = 'grid';
    tree.get(id(306))!.node.style.basis = { value: 80, unit: '%' };
    tree.get(id(305))!.node.responsive.mobile = { hidden: true };
    output = behaviorPresentation(document);
    expect(output.styles.get(id(305))?.display).toBe('grid');
    expect(output.styles.get(id(306))?.['flex-basis']).toBe('80%');
    expect(behaviorPresentation(document, 'mobile').styles.get(id(305))?.display).toBe('none');
  });
  it('escapes authored labels rather than treating button text as markup', () => {
    const document = source('tabs'), button = indexTree(document).get(id(102))!.node;
    if (button.type !== 'action.button') throw new Error('button');
    button.props.label = '<img src=x onerror=alert(1)>';
    const html = renderToStaticMarkup(<StructurePreview document={document} />);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
  });
  it('runs nested previews without committing state and remounts cleanly after authored changes', async () => {
    const document = source('nested'), before = JSON.stringify(document), host = globalThis.document.createElement('div');
    globalThis.document.body.append(host); const root = createRoot(host);
    cleanup.push(() => { root.unmount(); host.remove(); });
    await act(async () => root.render(<BehaviorPreview document={document} />));
    const first = host.querySelector<HTMLElement>('#' + nodeAnchor(id(104)))!;
    const second = host.querySelector<HTMLElement>('#' + nodeAnchor(id(106)))!;
    const oldButton = host.querySelector<HTMLButtonElement>('#' + nodeAnchor(id(103)))!;
    expect(first.hidden).toBe(false); expect(second.hidden).toBe(true);
    await act(async () => oldButton.click());
    expect(first.hidden).toBe(true); expect(second.hidden).toBe(false);
    expect(JSON.stringify(document)).toBe(before);
    const changed = structuredClone(document), behavior = changed.blocks[0].behavior;
    if (behavior?.kind !== 'tabs') throw new Error('tabs');
    behavior.active_panel_id = id(106);
    await act(async () => root.render(<BehaviorPreview document={changed} />));
    expect(host.querySelector('#' + nodeAnchor(id(103)))).not.toBe(oldButton);
    oldButton.click();
    expect(host.querySelector<HTMLElement>('#' + nodeAnchor(id(106)))!.hidden).toBe(false);
    await act(async () => root.render(<StructurePreview document={changed} />));
    expect(host.querySelector<HTMLElement>('#' + nodeAnchor(id(104)))!.hidden).toBe(false);
    expect(host.querySelector('[data-g7pb-tabs-ready]')).toBeNull();
    expect(JSON.stringify(document)).toBe(before);
  });
});
