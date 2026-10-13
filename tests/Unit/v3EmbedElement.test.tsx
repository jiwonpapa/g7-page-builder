import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import cases from '../Fixtures/document-v3-cases.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { documentPresentation } from '../../resources/js/documents/v3/presentation';
import { embedTarget } from '../../resources/js/documents/v3/embeds';
import { NodeRenderer, StructurePreview } from '../../resources/js/editor/v3/NodeRenderer';
import { EmbedInspector } from '../../resources/js/editor/v3/EmbedInspector';
import { hydrateTemplateRuntime } from '../../resources/js/public/publicHydration';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined;
afterEach(async () => { await act(async () => root?.unmount()); root = undefined; document.body.replaceChildren(); });
function source(props: unknown = { title: '영상·지도', source: { provider: 'none' } }) {
  const value = validateDocumentV3(structuredClone(fixture));
  const initial = createPrimitive('media.embed', '00000000-0000-4000-8000-000000000091', value);
  const document = validateDocumentV3({ ...value, blocks: [{ ...initial, props }] });
  const node = document.blocks[0]; if (node.type !== 'media.embed') throw new Error('Wrong primitive');
  return { document, node };
}
for (const value of cases.embeds) it('shares PHP validation and target generation: ' + value.name, () => {
  const before = JSON.stringify(value);
  if (value.valid) {
    const { document, node } = source(value.props);
    expect(embedTarget(node.props.source)).toEqual(value.target);
    expect(validateDocumentV3(JSON.parse(JSON.stringify(document)))).toEqual(document);
  } else expect(() => source(value.props)).toThrow(new RegExp('^' + value.error + ':'));
  expect(JSON.stringify(value)).toBe(before);
});
it('renders all providers in preview; editing frames cannot capture pointer or keyboard input', () => {
  for (const value of cases.embeds.filter(value => value.valid)) {
    const { document: canonical, node } = source(value.props), before = JSON.stringify(canonical);
    document.body.innerHTML = renderToStaticMarkup(<StructurePreview document={canonical} />);
    let frame = document.querySelector('iframe');
    if (!value.target) { expect(frame).toBeNull(); expect(document.body.textContent).toContain('제공자를 설정'); continue; }
    expect(frame?.getAttribute('src')).toBe(value.target.src);
    expect(frame?.title).toBe(node.props.title); expect(frame?.hasAttribute('allowfullscreen')).toBe(value.target.video);
    expect(frame?.style.width).toBe('100%'); expect(frame?.getAttribute('tabindex')).toBeNull();
    document.body.innerHTML = renderToStaticMarkup(<NodeRenderer node={node} document={canonical} editing styles={documentPresentation(canonical)} />);
    frame = document.querySelector('iframe'); expect(frame?.tabIndex).toBe(-1);
    expect(frame?.getAttribute('aria-hidden')).toBe('true'); expect(frame?.style.pointerEvents).toBe('none');
    expect(JSON.stringify(canonical)).toBe(before);
  }
});
it('hydrates only existing trusted providers, preserves legacy sizing, and is idempotent', () => {
  for (const value of cases.embeds.filter(value => value.valid && value.target)) {
    const { node } = source(value.props), target = embedTarget(node.props.source)!;
    const marker = document.createElement('span');
    Object.assign(marker.dataset, { g7pbEmbed: '', g7pbEmbedKind: target.kind, g7pbEmbedSrc: target.src,
      g7pbEmbedTitle: node.props.title, g7pbEmbedSizing: 'parent' });
    document.body.replaceChildren(marker); hydrateTemplateRuntime(document); hydrateTemplateRuntime(document);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
    const frame = document.querySelector('iframe')!;
    expect(frame.src).toBe(target.src); expect(frame.title).toBe(node.props.title); expect(frame.allowFullscreen).toBe(target.video);
    expect(frame.style.height).toBe('100%'); expect(frame.style.borderWidth).toBe('0px'); expect(frame.referrerPolicy).toBe('no-referrer');
  }
  document.body.innerHTML = '<span data-g7pb-embed data-g7pb-embed-kind="video-youtube" data-g7pb-embed-src="https://evil.test/"></span>';
  hydrateTemplateRuntime(document); expect(document.querySelector('iframe')).toBeNull();
  document.body.innerHTML = '<span data-g7pb-embed data-g7pb-embed-kind="video-vimeo" data-g7pb-embed-src="https://player.vimeo.com/video/123456"></span>';
  hydrateTemplateRuntime(document); expect(document.querySelector('iframe')?.getAttribute('style')).toBeNull();
});
it('uses common atomic commands and responsive styles without a block registration or leaf children', () => {
  const { document: original, node } = source(), before = JSON.stringify(original);
  const changed = executeDocumentCommand(original, { kind: 'transaction', commands: [
    { kind: 'content', id: node.instance_id, props: cases.embeds[1].props },
    { kind: 'style', id: node.instance_id, set: { width: { value: 480, unit: 'px' }, height: { value: 270, unit: 'px' } }, reset: [] },
    { kind: 'style', id: node.instance_id, viewport: 'mobile', set: { width: { value: 100, unit: '%' }, aspect_ratio: 1 }, reset: ['height'] },
  ] }, () => crypto.randomUUID()).document;
  expect(documentPresentation(original).get(node.instance_id)).toMatchObject({ width: '100%', 'aspect-ratio': '16 / 9' });
  expect(documentPresentation(changed).get(node.instance_id)).toMatchObject({ width: '480px', height: '270px' });
  expect(documentPresentation(changed, 'mobile').get(node.instance_id)).toMatchObject({ width: '100%', 'aspect-ratio': '1' });
  expect(JSON.stringify(original)).toBe(before);
  expect(() => executeDocumentCommand(original, { kind: 'content', id: node.instance_id, props: { title: '', source: { provider: 'none' } } }, () => crypto.randomUUID())).toThrow();
  const child = createPrimitive('content.text', '00000000-0000-4000-8000-000000000092', original);
  expect(() => validateDocumentV3({ ...original, blocks: [{ ...node, slots: { content: [child] } }] })).toThrow('leaf_slots:');
  expect(JSON.stringify(original)).toBe(before);
});
it('applies provider settings through one command, supports cancel, and respects disabled/error state', async () => {
  const { node } = source(), apply = vi.fn(() => { throw new Error('readonly'); });
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<EmbedInspector node={node} disabled={false} apply={apply} />));
  const provider = host.querySelector<HTMLSelectElement>('[aria-label="임베드 제공자"]')!;
  await act(async () => { provider.value = 'google'; provider.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.querySelectorAll('input[type="number"]')).toHaveLength(2);
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(apply).toHaveBeenCalledExactlyOnceWith({ kind: 'content', id: node.instance_id,
    props: { title: '영상·지도', source: { provider: 'google', latitude: 0, longitude: 0, zoom: 14 } } });
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('readonly');
  await act(async () => host.querySelector<HTMLButtonElement>('button[type="button"]')!.click());
  expect(provider.value).toBe('none'); expect(host.querySelector('[role="alert"]')).toBeNull();
  await act(async () => root!.render(<EmbedInspector node={node} disabled apply={apply} />));
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(host.querySelector('fieldset')?.disabled).toBe(true); expect(apply).toHaveBeenCalledTimes(1);
  expect(node.props.source.provider).toBe('none');
});
