import React, { useRef } from 'react';
import { createPortal } from 'react-dom';

const FLOATING_LAYER_STABLE_FRAMES = 3;

type FloatingLayerStyle = React.CSSProperties & {
  '--g7pb-richtext-floating-left': string;
  '--g7pb-richtext-floating-top': string;
  '--g7pb-richtext-floating-max-width': string;
  '--g7pb-richtext-floating-max-height': string;
};

function finiteDataNumber(element: HTMLElement | null, name: string, fallback: number): number {
  const raw = element?.getAttribute(name);
  if (raw === null || raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function stableOverlayPixel(value: number, devicePixelRatio: number): number {
  const scale = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.round(value * scale) / scale;
}

export function RichTextFloatingLayer({
  anchorRef,
  align = 'start',
  preserveSelectionOnTouch = false,
  className,
  children,
  ...attributes
}: React.HTMLAttributes<HTMLDivElement> & {
  anchorRef: React.RefObject<HTMLElement | null>;
  align?: 'start' | 'end';
  preserveSelectionOnTouch?: boolean;
}): React.ReactElement | null {
  const layerRef = useRef<HTMLDivElement>(null);
  const initialStyle = useRef<FloatingLayerStyle>({
    '--g7pb-richtext-floating-left': '0px',
    '--g7pb-richtext-floating-top': '0px',
    '--g7pb-richtext-floating-max-width': 'calc(100vw - 1rem)',
    '--g7pb-richtext-floating-max-height': 'calc(100vh - 1rem)',
    visibility: 'hidden',
  });
  const anchor = anchorRef.current;
  const ownerDocument = anchor?.ownerDocument ?? null;

  React.useLayoutEffect(() => {
    const layer = layerRef.current;
    const currentAnchor = anchorRef.current;
    const currentDocument = currentAnchor?.ownerDocument;
    const ownerWindow = currentDocument?.defaultView;
    if (!layer || !currentAnchor || !currentDocument || !ownerWindow) return undefined;
    let animationFrame = 0;
    let pendingPlacement: string | null = null;
    let stablePlacementFrames = 0;
    let revealed = false;
    let lastGeometry: string | null = null;
    const actionBar = currentAnchor.closest<HTMLElement>('.g7pb-selected-block-actionbar');
    const readBounds = () => {
      const viewportWidth = currentDocument.documentElement.clientWidth || ownerWindow.innerWidth;
      const viewportHeight = currentDocument.documentElement.clientHeight || ownerWindow.innerHeight;
      return {
        viewportWidth, viewportHeight, devicePixelRatio: ownerWindow.devicePixelRatio,
        clipLeft: finiteDataNumber(actionBar, 'data-g7pb-safe-clip-left', 0),
        clipTop: finiteDataNumber(actionBar, 'data-g7pb-safe-clip-top', 0),
        clipRight: finiteDataNumber(actionBar, 'data-g7pb-safe-clip-right', viewportWidth),
        clipBottom: finiteDataNumber(actionBar, 'data-g7pb-safe-clip-bottom', viewportHeight),
      };
    };
    const readGeometry = (bounds = readBounds()) => ({
      ...bounds,
      anchorRect: currentAnchor.getBoundingClientRect(),
      layerRect: layer.getBoundingClientRect(),
    });
    const geometryKey = (geometry: ReturnType<typeof readGeometry>): string => [
      geometry.devicePixelRatio,
      ...[
        geometry.viewportWidth, geometry.viewportHeight,
        geometry.clipLeft, geometry.clipTop, geometry.clipRight, geometry.clipBottom,
        geometry.anchorRect.left, geometry.anchorRect.top, geometry.anchorRect.right, geometry.anchorRect.bottom,
        geometry.layerRect.width, geometry.layerRect.height,
      ].map(value => stableOverlayPixel(value, geometry.devicePixelRatio)),
    ].join('|');
    const position = (): void => {
      animationFrame = 0;
      const bounds = readBounds();
      const { clipLeft, clipTop, clipRight, clipBottom } = bounds;
      const inset = 8;
      const gap = 6;
      const safeLeft = Math.min(clipRight, clipLeft + inset);
      const safeTop = Math.min(clipBottom, clipTop + inset);
      const safeRight = Math.max(safeLeft, clipRight - inset);
      const safeBottom = Math.max(safeTop, clipBottom - inset);
      const maxWidth = stableOverlayPixel(Math.max(0, safeRight - safeLeft), ownerWindow.devicePixelRatio);
      const maxHeight = stableOverlayPixel(Math.max(0, safeBottom - safeTop), ownerWindow.devicePixelRatio);
      const writeVariable = (name: string, value: string): void => {
        if (layer.style.getPropertyValue(name) !== value) layer.style.setProperty(name, value);
      };
      writeVariable('--g7pb-richtext-floating-max-width', `${maxWidth}px`);
      writeVariable('--g7pb-richtext-floating-max-height', `${maxHeight}px`);
      const geometry = readGeometry(bounds);
      const { anchorRect, layerRect } = geometry;
      lastGeometry = geometryKey(geometry);
      const width = Math.min(layerRect.width, maxWidth);
      const height = Math.min(layerRect.height, maxHeight);
      const preferredLeft = align === 'end' ? anchorRect.right - width : anchorRect.left;
      const left = stableOverlayPixel(
        Math.min(Math.max(safeLeft, preferredLeft), Math.max(safeLeft, safeRight - width)),
        ownerWindow.devicePixelRatio,
      );
      const below = anchorRect.bottom + gap;
      const above = anchorRect.top - gap - height;
      const rawTop = below + height <= safeBottom
        ? below
        : above >= safeTop ? above : Math.min(Math.max(safeTop, below), Math.max(safeTop, safeBottom - height));
      const top = stableOverlayPixel(rawTop, ownerWindow.devicePixelRatio);
      writeVariable('--g7pb-richtext-floating-left', `${left}px`);
      writeVariable('--g7pb-richtext-floating-top', `${top}px`);
      const placement = [lastGeometry, maxWidth, maxHeight, left, top].join('|');
      if (!revealed) {
        if (pendingPlacement === placement) {
          stablePlacementFrames += 1;
        } else {
          pendingPlacement = placement;
          stablePlacementFrames = 1;
        }
        if (stablePlacementFrames >= FLOATING_LAYER_STABLE_FRAMES) {
          revealed = true;
          layer.setAttribute('data-g7pb-floating-ready', 'true');
          if (layer.style.visibility !== 'visible') layer.style.visibility = 'visible';
          return;
        }
        layer.removeAttribute('data-g7pb-floating-ready');
        if (layer.style.visibility !== 'hidden') layer.style.visibility = 'hidden';
        schedule();
        return;
      }
      if (layer.style.visibility !== 'visible') layer.style.visibility = 'visible';
    };
    const schedule = (): void => {
      if (animationFrame === 0) animationFrame = ownerWindow.requestAnimationFrame(position);
    };
    const invalidatePlacement = (): void => {
      const nextGeometry = geometryKey(readGeometry());
      // Observer delivery does not itself change placement. Keep a revealed
      // portal interactive, and keep pending stability frames, for equal inputs.
      if (nextGeometry === lastGeometry) return;
      lastGeometry = nextGeometry;
      revealed = false;
      pendingPlacement = null;
      stablePlacementFrames = 0;
      layer.removeAttribute('data-g7pb-floating-ready');
      if (layer.style.visibility !== 'hidden') layer.style.visibility = 'hidden';
      schedule();
    };
    const resizeObserver = new ownerWindow.ResizeObserver(invalidatePlacement);
    resizeObserver.observe(currentAnchor);
    resizeObserver.observe(layer);
    const safeClipObserver = actionBar ? new ownerWindow.MutationObserver(invalidatePlacement) : null;
    safeClipObserver?.observe(actionBar as HTMLElement, {
      attributes: true,
      attributeFilter: [
        'style',
        'data-g7pb-safe-clip-left', 'data-g7pb-safe-clip-top',
        'data-g7pb-safe-clip-right', 'data-g7pb-safe-clip-bottom',
      ],
    });
    const scheduleFromScroll = (event: Event): void => {
      if (event.target instanceof ownerWindow.Node && layer.contains(event.target)) return;
      invalidatePlacement();
    };
    currentDocument.addEventListener('scroll', scheduleFromScroll, true);
    ownerWindow.addEventListener('resize', invalidatePlacement);
    const retainSelectionFromTouch = (event: TouchEvent): void => {
      event.preventDefault();
      event.stopPropagation();
    };
    if (preserveSelectionOnTouch) {
      layer.addEventListener('touchstart', retainSelectionFromTouch, { passive: false });
    }
    position();
    return () => {
      if (animationFrame !== 0) ownerWindow.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      safeClipObserver?.disconnect();
      currentDocument.removeEventListener('scroll', scheduleFromScroll, true);
      ownerWindow.removeEventListener('resize', invalidatePlacement);
      if (preserveSelectionOnTouch) layer.removeEventListener('touchstart', retainSelectionFromTouch);
    };
  }, [align, anchorRef, ownerDocument, preserveSelectionOnTouch]);

  if (!ownerDocument?.body) return null;
  return createPortal(
    <div {...attributes} ref={layerRef}
      data-puck-rte-menu="portal"
      className={`${className ?? ''} g7pb-richtext-floating-layer`.trim()} style={initialStyle.current}>
      {children}
    </div>,
    ownerDocument.body,
  );
}
