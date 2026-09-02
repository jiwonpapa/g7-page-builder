import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BlockMotion, ElementAppearanceMap } from '../../resources/js/documents/blockPresentation';
import { CatalogBlockFrame } from '../../resources/js/editor/CatalogBlockFrame';
import {
  CANVAS_ELEMENT_MESSAGE,
  CanvasBlockAppearanceContext,
  CanvasCurrentElementStylesContext,
  CanvasElementStylesContext,
} from '../../resources/js/editor/canvasEditingContract';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanup: Array<() => void> = [];
const uuid = 'abcdef12-abcd-4abc-8abc-abcdef123456';
const rawId = `Heading_${uuid.toUpperCase()}`;
const none: BlockMotion = { preset: 'none', intensity: 'normal', trigger: 'once', stagger_ms: 100 };

afterEach(async () => {
  await act(async () => cleanup.splice(0).forEach((run) => run()));
});

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  cleanup.push(() => { root.unmount(); host.remove(); });
  return { host, render: async (children: React.ReactNode) => {
    await act(async () => root.render(children));
  } };
}

function element<T extends HTMLElement>(host: HTMLElement, selector: string): T {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${selector}`);
  return found;
}

function CurrentStyles({ observe }: { observe: (styles: ElementAppearanceMap | undefined) => void }) {
  const styles = React.useContext(CanvasCurrentElementStylesContext);
  React.useEffect(() => observe(styles), [observe, styles]);
  return null;
}

describe('shared catalog frame', () => {
  it('resolves raw ID, canonical UUID and fallback styles through the same context used by descendants', async () => {
    const view = mount();
    const raw: ElementAppearanceMap = { heading: { weight: 'bold' } };
    const canonical: ElementAppearanceMap = { heading: { tone: 'accent' } };
    const fallback: ElementAppearanceMap = { heading: { font: 'serif' } };
    const observe = vi.fn();
    const render = async (styles: Record<string, ElementAppearanceMap>, classes: Record<string, string>) => {
      await view.render(<CanvasElementStylesContext.Provider value={styles}>
        <CanvasBlockAppearanceContext.Provider value={classes}>
          <CatalogBlockFrame id={rawId} type="heading" motion={none} elementStyles={fallback}>
            <h2 className="sentinel-heading" data-g7pb-inline-field="heading">Synthetic heading</h2>
            <CurrentStyles observe={observe} />
          </CatalogBlockFrame>
        </CanvasBlockAppearanceContext.Provider>
      </CanvasElementStylesContext.Provider>);
    };

    await render({ [rawId]: raw, [uuid]: canonical }, { [rawId]: 'raw-container', [uuid]: 'canonical-container' });
    expect(observe.mock.lastCall?.[0]).toBe(raw);
    expect(element(view.host, 'h2').classList.contains('g7pb-element-weight--bold')).toBe(true);
    expect(element(view.host, 'section').className).toBe('g7pb-preview-block raw-container');
    expect(element(view.host, 'section').dataset.blockId).toBe(rawId);

    await render({ [uuid]: canonical }, { [uuid]: 'canonical-container' });
    expect(observe.mock.lastCall?.[0]).toBe(canonical);
    expect(element(view.host, 'h2').classList.contains('g7pb-element-tone--accent')).toBe(true);
    expect(element(view.host, 'section').className).toBe('g7pb-preview-block canonical-container');

    await render({}, {});
    expect(observe.mock.lastCall?.[0]).toBe(fallback);
    expect(element(view.host, 'h2').classList.contains('g7pb-element-font--serif')).toBe(true);
    expect(element(view.host, 'section').className).toBe('g7pb-preview-block');

    const empty: ElementAppearanceMap = {};
    await render({ [rawId]: empty, [uuid]: canonical }, { [rawId]: '', [uuid]: 'canonical-container' });
    expect(observe.mock.lastCall?.[0]).toBe(empty);
    expect(element(view.host, 'h2').className).toBe('sentinel-heading');
    expect(element(view.host, 'section').className).toBe('g7pb-preview-block canonical-container');
  });

  it('identifies the raw block and field during capture even when the child stops pointer bubbling', async () => {
    const view = mount();
    const selected = vi.fn();
    const sequence: string[] = [];
    const observe = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      sequence.push('capture');
      selected(event.detail);
    };
    window.addEventListener(CANVAS_ELEMENT_MESSAGE, observe);
    try {
      await view.render(<CatalogBlockFrame id={rawId} type="heading" motion={none}
        elementStyles={{ heading: { weight: 'bold' } }}>
        <h2 data-g7pb-inline-field="heading" onPointerDown={(event) => {
          sequence.push('child');
          event.stopPropagation();
        }}>Synthetic heading</h2>
      </CatalogBlockFrame>);
      const heading = element(view.host, 'h2');
      await act(async () => { heading.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); });
      expect(sequence).toEqual(['capture', 'child']);
      expect(selected).toHaveBeenCalledOnce();
      expect(selected).toHaveBeenCalledWith(expect.objectContaining({
        blockId: rawId, blockType: 'heading', fieldPath: 'heading', role: 'text', intent: 'identify',
      }));
      expect(heading.dataset.g7pbCanvasSelected).toBe('true');
    } finally {
      window.removeEventListener(CANVAS_ELEMENT_MESSAGE, observe);
    }
  });

  it('preserves focused child DOM while context and motion change without adding a second wrapper', async () => {
    const view = mount();
    const children = <div className="g7pb-surface--soft g7pb-spacing--compact">
      <label data-g7pb-inline-field="heading" className="sentinel-label">Synthetic label
        <input aria-label="Synthetic input" defaultValue="Initial" />
      </label>
    </div>;
    const render = async (motion: BlockMotion, styles: ElementAppearanceMap) => {
      await view.render(<CanvasElementStylesContext.Provider value={{ [uuid]: styles }}>
        <CatalogBlockFrame id={rawId} type="heading" motion={motion}>{children}</CatalogBlockFrame>
      </CanvasElementStylesContext.Provider>);
    };
    await render(none, { heading: { weight: 'regular' } });
    const input = element<HTMLInputElement>(view.host, 'input');
    input.value = 'Typed value';
    input.focus();
    const frame = element(view.host, 'section');
    const inner = element(view.host, 'section > div');

    await render({ preset: 'reveal', intensity: 'subtle', trigger: 'repeat', stagger_ms: 60 }, { heading: { weight: 'bold' } });
    expect(view.host.querySelectorAll('section')).toHaveLength(1);
    expect(view.host.querySelectorAll('[data-testid="page-builder-block"]')).toHaveLength(1);
    expect(element(view.host, 'section')).toBe(frame);
    expect(element(view.host, 'section > div')).toBe(inner);
    expect(inner.className).toBe('g7pb-surface--soft g7pb-spacing--compact');
    expect(frame.className).toBe('g7pb-preview-block');
    expect(frame.dataset).toMatchObject({ blockId: rawId, blockType: 'heading',
      g7pbMotion: 'reveal', g7pbMotionIntensity: 'subtle', g7pbMotionTrigger: 'repeat', g7pbMotionStagger: '60' });
    expect(element(view.host, 'input')).toBe(input);
    expect(input.value).toBe('Typed value');
    expect(document.activeElement).toBe(input);
    expect(element(view.host, 'label').classList.contains('g7pb-element-weight--bold')).toBe(true);
    expect(children.props.children.props.className).toBe('sentinel-label');

    await render(none, { heading: { tone: 'accent' } });
    for (const name of ['motion', 'motion-intensity', 'motion-trigger', 'motion-stagger']) {
      expect(frame.hasAttribute(`data-g7pb-${name}`)).toBe(false);
    }
    expect(element(view.host, 'input')).toBe(input);
    expect(input.value).toBe('Typed value');
    expect(document.activeElement).toBe(input);
  });
});
