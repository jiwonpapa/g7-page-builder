import { afterEach, describe, expect, it, vi } from 'vitest';

import { bootPageSliders, disposePageSliders } from '../../resources/js/public/publicSliderLoader';
import type { PublicSliderApi } from '../../resources/js/public/publicSliderLoader';
import * as sliderEntry from '../../resources/js/public/publicSliderEntry';
import { bootPageSliders as bootSliderImplementation, disposePageSliders as disposeSliderImplementation } from '../../resources/js/public/publicSliders';

interface SliderFixture {
  frame: HTMLIFrameElement;
  root: Document;
  view: Window;
  source: HTMLScriptElement;
}

const frames: HTMLIFrameElement[] = [];
const effectsPath = '/api/modules/assets/jiwonpapa-page_builder/dist/js/page-effects.iife.js';

function fixture(source = `${effectsPath}?v=fixture-123#release`, slider = true): SliderFixture {
  const frame = document.createElement('iframe');
  frame.src = window.location.href;
  document.body.append(frame); frames.push(frame);
  const root = frame.contentDocument!;
  const view = frame.contentWindow!;
  root.open(); root.write('<!doctype html><html><head></head><body></body></html>'); root.close();
  root.head.replaceChildren(); root.body.replaceChildren();
  const script = root.createElement('script'); script.src = source; script.nonce = 'fixture-nonce';
  root.head.append(script);
  if (slider) {
    const page = root.createElement('main'); page.className = 'g7pb-page';
    const block = root.createElement('section'); block.dataset.g7pbSlider = '';
    page.append(block); root.body.append(page);
  }
  return { frame, root, view, source: script };
}

function api() {
  return {
    bootPageSliders: vi.fn<(root?: Document, reducedMotion?: boolean) => void>(),
    disposePageSliders: vi.fn<(root?: Document) => void>(),
  } satisfies PublicSliderApi;
}

function pending(root: Document): HTMLScriptElement {
  return root.querySelector<HTMLScriptElement>('script[data-g7pb-slider-asset]')!;
}

function register(fixture: SliderFixture, implementation: PublicSliderApi): void {
  fixture.view.JiwonpapaPageSliders = implementation;
  pending(fixture.root).dispatchEvent(new Event('load'));
}

afterEach(() => {
  for (const frame of frames.splice(0)) {
    if (frame.contentDocument) disposePageSliders(frame.contentDocument);
    frame.remove();
  }
  vi.restoreAllMocks();
});

describe('optional public slider asset loader', () => {
  it('publishes the existing slider implementation through the optional IIFE entry', () => {
    expect(sliderEntry.bootPageSliders).toBe(bootSliderImplementation);
    expect(sliderEntry.disposePageSliders).toBe(disposeSliderImplementation);
  });

  it('does not request the optional bundle without slider DOM', () => {
    const current = fixture(`${effectsPath}?v=no-slider`, false);
    expect(bootPageSliders(current.root)).toBeUndefined();
    expect(current.root.querySelector('[data-g7pb-slider-asset]')).toBeNull();
  });

  it('derives a same-origin asset without currentScript and preserves cache busting and nonce', async () => {
    const current = fixture(); const implementation = api();
    expect(current.root.currentScript).toBeNull();
    bootPageSliders(current.root);
    const script = pending(current.root); const url = new URL(script.src);
    expect(url.origin).toBe(current.view.location.origin);
    expect(url.pathname).toBe('/api/modules/assets/jiwonpapa-page_builder/dist/js/page-sliders.iife.js');
    expect(url.search).toBe('?v=fixture-123');
    expect(url.hash).toBe('#release');
    expect(script.nonce).toBe('fixture-nonce');
    register(current, implementation);
    await vi.waitFor(() => expect(implementation.bootPageSliders).toHaveBeenCalledWith(current.root, false));
    expect(current.root.documentElement.dataset.g7pbSliderAssetReady).toBe('true');
    expect(current.root.documentElement.dataset.g7pbSliderLoadError).toBeUndefined();
  });

  it('shares one request and only applies the latest boot request', async () => {
    const current = fixture(); const implementation = api();
    bootPageSliders(current.root, false); bootPageSliders(current.root, true);
    expect(current.root.querySelectorAll('[data-g7pb-slider-asset]')).toHaveLength(1);
    register(current, implementation);
    await vi.waitFor(() => expect(implementation.bootPageSliders).toHaveBeenCalledTimes(1));
    expect(implementation.bootPageSliders).toHaveBeenCalledWith(current.root, true);
  });

  it('does not mount after removal or explicit disposal during loading', async () => {
    const removed = fixture(); const removedApi = api();
    bootPageSliders(removed.root);
    removed.root.querySelector('[data-g7pb-slider]')?.remove();
    bootPageSliders(removed.root);
    register(removed, removedApi);
    await vi.waitFor(() => expect(removedApi.disposePageSliders).toHaveBeenCalledWith(removed.root));
    expect(removedApi.bootPageSliders).not.toHaveBeenCalled();

    const disposed = fixture(); const disposedApi = api();
    bootPageSliders(disposed.root); disposePageSliders(disposed.root);
    register(disposed, disposedApi);
    await vi.waitFor(() => expect(disposedApi.disposePageSliders).toHaveBeenCalledWith(disposed.root));
    expect(disposedApi.bootPageSliders).not.toHaveBeenCalled();
  });

  it('records a failed load and retries with a fresh request', async () => {
    const current = fixture(); const implementation = api();
    bootPageSliders(current.root);
    const failed = pending(current.root);
    failed.dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(current.root.documentElement.dataset.g7pbSliderLoadError).toBe('true'));
    expect(failed.isConnected).toBe(false);

    bootPageSliders(current.root);
    const retry = pending(current.root);
    expect(retry).not.toBe(failed);
    register(current, implementation);
    await vi.waitFor(() => expect(implementation.bootPageSliders).toHaveBeenCalledWith(current.root, false));
    expect(current.root.documentElement.dataset.g7pbSliderLoadError).toBeUndefined();
  });

  it('keeps loading and slider ownership separate for each document window', async () => {
    const first = fixture(`${effectsPath}?v=first`); const second = fixture(`${effectsPath}?v=second`);
    const firstApi = api(); const secondApi = api();
    bootPageSliders(first.root); bootPageSliders(second.root, true);
    expect(pending(first.root).src).toContain('?v=first');
    expect(pending(second.root).src).toContain('?v=second');
    register(first, firstApi); register(second, secondApi);
    await vi.waitFor(() => {
      expect(firstApi.bootPageSliders).toHaveBeenCalledWith(first.root, false);
      expect(secondApi.bootPageSliders).toHaveBeenCalledWith(second.root, true);
    });
    expect(first.view.JiwonpapaPageSliders).toBe(firstApi);
    expect(second.view.JiwonpapaPageSliders).toBe(secondApi);
  });

  it('refuses a cross-origin page effects source', async () => {
    const current = fixture('https://cdn.invalid/dist/js/page-effects.iife.js?v=foreign');
    bootPageSliders(current.root);
    await vi.waitFor(() => expect(current.root.documentElement.dataset.g7pbSliderLoadError).toBe('true'));
    expect(current.root.querySelector('[data-g7pb-slider-asset]')).toBeNull();
    expect(current.view.JiwonpapaPageSliders).toBeUndefined();
  });
});
