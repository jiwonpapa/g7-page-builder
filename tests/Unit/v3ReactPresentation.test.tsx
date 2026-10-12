import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import { reactStyle } from '../../resources/js/editor/v3/presentationReact';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { createPrimitive } from '../../resources/js/documents/v3/primitives';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
const { StructureEditor } = await import('../../resources/js/editor/v3/StructureEditor');
const cleanup: Array<() => void> = [];
afterEach(async () => { await act(async () => cleanup.splice(0).forEach(run => run())); });

describe('canonical background declarations at the React/Puck boundary', () => {
  it('uses independent longhands without changing generated declaration inputs', () => {
    const solid = { background: '#112233', 'font-size': '20px' };
    expect(reactStyle(solid)).toEqual({ backgroundColor: '#112233', fontSize: '20px' });
    expect(solid).toEqual({ background: '#112233', 'font-size': '20px' });
    const gradient = 'linear-gradient(90deg,#112233 0%,#ffffff 100%)';
    expect(reactStyle({ background: gradient })).toEqual({ backgroundColor: 'transparent', backgroundImage: gradient });
    expect(reactStyle({ 'background-image': 'url("/image.png")', 'background-size': 'cover' }))
      .toEqual({ backgroundColor: 'transparent', backgroundImage: 'url("/image.png")', backgroundSize: 'cover' });
    expect(reactStyle({ display: 'block' })).toEqual({ backgroundColor: 'transparent', display: 'block' });
  });
  it('preserves authored solid and empty transparent backgrounds in actual Puck slots', async () => {
    const doc = validateDocumentV3(structuredClone(fixture));
    const empty = createPrimitive('layout.container', '00000000-0000-4000-8000-000000000070', doc);
    empty.style = {}; empty.responsive = {};
    doc.blocks[0].style = { background: { kind: 'solid', color: { kind: 'hex', value: '#112233' } } };
    doc.blocks[0].responsive = {}; doc.blocks[0].slots.content = [empty];
    const before = JSON.stringify(doc), host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host); cleanup.push(() => { root.unmount(); host.remove(); });
    await act(async () => root.render(<StructureEditor document={doc} sessionId="background-slots" serverRevision={1}
      drafts={{ save: async request => ({ documentId: request.documentId, revision: 2 }) }}
      nextId={() => '00000000-0000-4000-8000-000000000099'} iframeEnabled={false} />));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 40)); });
    const authored = host.querySelector<HTMLElement>('[data-v3-node="' + doc.blocks[0].instance_id + '"]')!;
    const automatic = host.querySelector<HTMLElement>('[data-v3-node="' + empty.instance_id + '"]')!;
    expect(authored.style.backgroundColor).toBe('rgb(17, 34, 51)');
    expect(automatic.style.backgroundColor).toBe('transparent');
    expect(JSON.stringify(doc)).toBe(before);
  });
  it('removes a prior image or color when the canonical background changes', async () => {
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host); cleanup.push(() => { root.unmount(); host.remove(); });
    for (const background of ['linear-gradient(90deg,#112233 0%,#ffffff 100%)', '#112233', '']) {
      const style = reactStyle(background ? { background } : {});
      // Puck adds this longhand after the supplied style on every slot render.
      await act(async () => root.render(<div style={{ ...style, backgroundColor: style.backgroundColor }} />));
      const element = host.firstElementChild as HTMLElement;
      expect(element.style.backgroundImage).toBe(background.startsWith('linear-gradient')
        ? 'linear-gradient(90deg, rgb(17, 34, 51) 0%, rgb(255, 255, 255) 100%)' : '');
      expect(element.style.backgroundColor).toBe(background === '#112233' ? 'rgb(17, 34, 51)' : 'transparent');
    }
  });
});
