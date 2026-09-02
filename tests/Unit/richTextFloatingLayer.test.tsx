import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

class InitialResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = InitialResizeObserver;
const { createRichTextField } = await import('../../resources/js/editor/richTextEditing');

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function openFloatingOptions() {
  const pendingFrames = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextFrame++;
    pendingFrames.set(id, callback);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { pendingFrames.delete(id); });
  const observers: ControlledResizeObserver[] = [];
  class ControlledResizeObserver implements ResizeObserver {
    readonly targets = new Set<Element>();
    constructor(readonly callback: ResizeObserverCallback) { observers.push(this); }
    observe(target: Element): void { this.targets.add(target); }
    unobserve(target: Element): void { this.targets.delete(target); }
    disconnect(): void { this.targets.clear(); }
    notify(): void {
      if (this.targets.size === 0) return;
      this.callback([...this.targets].map((target) => {
        const rect = target.getBoundingClientRect();
        return { target, contentRect: new DOMRect(0, 0, rect.width, rect.height),
          borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [] };
      }), this);
    }
  }
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
  const geometry = { anchorLeft: 100, anchorWidth: 100, layerWidth: 120, layerHeight: 140 };
  const rectFor = (element: Element): DOMRect => element.classList.contains('g7pb-richtext-floating-layer')
    ? new DOMRect(100, 78, geometry.layerWidth, geometry.layerHeight)
    : new DOMRect(geometry.anchorLeft, 40, geometry.anchorWidth, 32);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { return rectFor(this); });
  const originalWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')?.get;
  const originalHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight')?.get;
  const measured = (element: Element): boolean => element.classList.contains('g7pb-richtext-floating-layer')
    || element.getAttribute('data-testid') === 'page-builder-richtext-font';
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return measured(this) ? rectFor(this).width : originalWidth?.call(this) ?? 0;
  });
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (this: Element) {
    return measured(this) ? rectFor(this).height : originalHeight?.call(this) ?? 0;
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let mounted = true;
  const unmount = (): void => {
    if (!mounted) return;
    act(() => root.unmount());
    container.remove();
    mounted = false;
  };
  cleanups.push(unmount);
  const InlineMenu = createRichTextField('합성 선택').renderInlineMenu;
  await act(async () => {
    root.render(<div className="g7pb-selected-block-actionbar">
      <InlineMenu editor={null} editorState={{ g7HasSelection: true }} readOnly={false}>
        <span />
      </InlineMenu>
    </div>);
  });
  const trigger = container.querySelector<HTMLButtonElement>('[data-testid="page-builder-richtext-font"]');
  const actionBar = container.querySelector<HTMLElement>('.g7pb-selected-block-actionbar');
  if (!trigger || !actionBar) throw new Error('Expected the native inline font control');
  await act(async () => {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  });
  const layer = document.body.querySelector<HTMLElement>('.g7pb-richtext-floating-layer');
  if (!layer) throw new Error('Expected the options portal');
  const frame = async (): Promise<void> => {
    const callbacks = [...pendingFrames.values()];
    pendingFrames.clear();
    await act(async () => { callbacks.forEach(callback => callback(performance.now())); });
  };
  const notifyResize = async (): Promise<void> => {
    await act(async () => { observers.forEach(observer => observer.notify()); });
  };
  const irrelevantStyle = async (): Promise<void> => {
    await act(async () => { actionBar.style.color = actionBar.style.color === 'red' ? 'blue' : 'red'; });
  };
  const expectVisible = (): void => {
    expect(layer.isConnected).toBe(true);
    expect(document.body.querySelector('.g7pb-richtext-floating-layer')).toBe(layer);
    expect(layer.style.visibility).toBe('visible');
    expect(layer.getAttribute('data-g7pb-floating-ready')).toBe('true');
  };
  const expectHidden = (): void => {
    expect(layer.style.visibility).toBe('hidden');
    expect(layer.hasAttribute('data-g7pb-floating-ready')).toBe(false);
  };
  await frame();
  await frame();
  expectVisible();
  return { actionBar, layer, geometry, frame, notifyResize, irrelevantStyle, expectVisible, expectHidden, pendingFrames, observers, unmount };
}

describe('floating rich-text option stability', () => {
  it('keeps the visible option DOM ready after a style notification with unchanged geometry', async () => {
    const fixture = await openFloatingOptions();
    await fixture.irrelevantStyle();
    fixture.expectVisible();
  });

  it('keeps the visible options ready for repeated resize entries after a real resize has settled', async () => {
    const fixture = await openFloatingOptions();
    fixture.geometry.anchorWidth += 20;
    fixture.geometry.layerWidth += 20;
    await fixture.notifyResize();
    fixture.expectHidden();
    await fixture.frame();
    fixture.expectHidden();
    await fixture.frame();
    fixture.expectHidden();
    await fixture.frame();
    fixture.expectVisible();
    await fixture.notifyResize();
    fixture.expectVisible();
  });

  it.each(['clip', 'anchor', 'layer', 'viewport', 'pixel-ratio'] as const)(
    'hides immediately for changed %s and needs three stable frames despite redundant notifications', async (input) => {
      const fixture = await openFloatingOptions();
      await act(async () => {
        if (input === 'clip') fixture.actionBar.setAttribute('data-g7pb-safe-clip-left', '80');
        if (input === 'anchor') {
          fixture.geometry.anchorLeft += 25;
          document.dispatchEvent(new Event('scroll'));
        }
        if (input === 'layer') {
          fixture.geometry.layerHeight += 20;
          fixture.observers.forEach(observer => observer.notify());
        }
        if (input === 'viewport') {
          vi.stubGlobal('innerHeight', window.innerHeight + 100);
          window.dispatchEvent(new Event('resize'));
        }
        if (input === 'pixel-ratio') {
          vi.stubGlobal('devicePixelRatio', window.devicePixelRatio + 1);
          window.dispatchEvent(new Event('resize'));
        }
      });
      fixture.expectHidden();
      await fixture.frame();
      fixture.expectHidden();
      await fixture.irrelevantStyle();
      await fixture.frame();
      fixture.expectHidden();
      await fixture.notifyResize();
      await fixture.frame();
      fixture.expectVisible();
    },
  );

  it('restarts stability when the anchor really changes during pending placement', async () => {
    const fixture = await openFloatingOptions();
    fixture.geometry.anchorLeft += 25;
    await act(async () => { document.dispatchEvent(new Event('scroll')); });
    await fixture.frame();
    fixture.expectHidden();
    fixture.geometry.anchorLeft += 25;
    await act(async () => { document.dispatchEvent(new Event('scroll')); });
    await fixture.frame();
    fixture.expectHidden();
    await fixture.frame();
    fixture.expectHidden();
    await fixture.frame();
    fixture.expectVisible();
  });

  it('cancels pending placement and stops observing after the menu unmounts', async () => {
    const fixture = await openFloatingOptions();
    fixture.geometry.anchorLeft += 25;
    await act(async () => { document.dispatchEvent(new Event('scroll')); });
    fixture.expectHidden();
    fixture.unmount();
    expect(fixture.layer.isConnected).toBe(false);
    expect(fixture.pendingFrames.size).toBe(0);
    expect(fixture.observers.every(observer => observer.targets.size === 0)).toBe(true);
    fixture.geometry.anchorLeft += 25;
    fixture.actionBar.setAttribute('data-g7pb-safe-clip-left', '90');
    await fixture.irrelevantStyle();
    await fixture.notifyResize();
    await act(async () => {
      document.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
    });
    expect(fixture.pendingFrames.size).toBe(0);
  });
});
