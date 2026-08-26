export interface OverlayRectEdges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface OverlayRect extends OverlayRectEdges {
  width: number;
  height: number;
}

export interface OverlaySize {
  width: number;
  height: number;
}

export interface EditorOverlayPlacement {
  left: number;
  top: number;
  placement: 'above' | 'below' | 'dock-top' | 'dock-bottom';
  maxWidth: number;
  maxHeight: number;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function rectFromEdges(rect: OverlayRectEdges): OverlayRect {
  const left = finite(rect.left);
  const top = finite(rect.top);
  const right = Math.max(left, finite(rect.right, left));
  const bottom = Math.max(top, finite(rect.bottom, top));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (maximum <= minimum) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function overlapArea(first: OverlayRectEdges, second: OverlayRectEdges): number {
  const overlap = intersectOverlayRects([first, second]);
  return overlap ? overlap.width * overlap.height : 0;
}

export function intersectOverlayRects(rects: readonly OverlayRectEdges[]): OverlayRect | null {
  if (rects.length === 0) return null;
  const normalized = rects.map(rectFromEdges);
  const left = Math.max(...normalized.map((rect) => rect.left));
  const top = Math.max(...normalized.map((rect) => rect.top));
  const right = Math.min(...normalized.map((rect) => rect.right));
  const bottom = Math.min(...normalized.map((rect) => rect.bottom));
  if (right <= left || bottom <= top) return null;
  return rectFromEdges({ left, top, right, bottom });
}

export function mapHostClipToFrameViewport(
  hostClip: OverlayRectEdges,
  frameContentRect: OverlayRectEdges,
  frameViewport: OverlaySize,
): OverlayRect | null {
  const host = rectFromEdges(hostClip);
  const frame = rectFromEdges(frameContentRect);
  const viewportWidth = finite(frameViewport.width);
  const viewportHeight = finite(frameViewport.height);
  if (frame.width <= 0 || frame.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) return null;
  const scaleX = frame.width / viewportWidth;
  const scaleY = frame.height / viewportHeight;
  return rectFromEdges({
    left: (host.left - frame.left) / scaleX,
    top: (host.top - frame.top) / scaleY,
    right: (host.right - frame.left) / scaleX,
    bottom: (host.bottom - frame.top) / scaleY,
  });
}

export function placeEditorOverlay({
  anchorRect,
  overlaySize,
  visibleClip,
  avoidRects = [],
  gap = 8,
  inset = 8,
}: {
  anchorRect: OverlayRectEdges;
  overlaySize: OverlaySize;
  visibleClip: OverlayRectEdges;
  avoidRects?: readonly OverlayRectEdges[];
  gap?: number;
  inset?: number;
}): EditorOverlayPlacement {
  const anchor = rectFromEdges(anchorRect);
  const clip = rectFromEdges(visibleClip);
  const safeInset = Math.max(0, finite(inset));
  const safeGap = Math.max(0, finite(gap));
  const safeLeft = Math.min(clip.right, clip.left + safeInset);
  const safeTop = Math.min(clip.bottom, clip.top + safeInset);
  const safeRight = Math.max(safeLeft, clip.right - safeInset);
  const safeBottom = Math.max(safeTop, clip.bottom - safeInset);
  const maxWidth = safeRight - safeLeft;
  const maxHeight = safeBottom - safeTop;
  const width = Math.min(Math.max(0, finite(overlaySize.width)), maxWidth);
  const height = Math.min(Math.max(0, finite(overlaySize.height)), maxHeight);
  const left = clamp(anchor.right - width, safeLeft, safeRight - width);
  const roomAbove = Math.max(0, anchor.top - safeGap - safeTop);
  const roomBelow = Math.max(0, safeBottom - anchor.bottom - safeGap);
  const fitsAbove = height <= roomAbove;
  const fitsBelow = height <= roomBelow;
  const topDock = rectFromEdges({
    left,
    top: safeTop,
    right: left + width,
    bottom: safeTop + height,
  });
  const bottomDock = rectFromEdges({
    left,
    top: safeBottom - height,
    right: left + width,
    bottom: safeBottom,
  });
  const interactionRects = avoidRects.length > 0 ? avoidRects : [anchor];
  const topOverlap = interactionRects.reduce((total, rect) => total + overlapArea(topDock, rect), 0);
  const bottomOverlap = interactionRects.reduce((total, rect) => total + overlapArea(bottomDock, rect), 0);
  const dockPlacement: EditorOverlayPlacement['placement'] = topOverlap < bottomOverlap
    ? 'dock-top'
    : bottomOverlap < topOverlap
      ? 'dock-bottom'
      : roomAbove >= roomBelow ? 'dock-top' : 'dock-bottom';
  const placement: EditorOverlayPlacement['placement'] = fitsAbove
    ? 'above'
    : fitsBelow
      ? 'below'
      : dockPlacement;
  const preferredTop = placement === 'above'
    ? anchor.top - safeGap - height
    : placement === 'below'
      ? anchor.bottom + safeGap
      : placement === 'dock-top' ? safeTop : safeBottom - height;

  return {
    left,
    top: clamp(preferredTop, safeTop, safeBottom - height),
    placement,
    maxWidth,
    maxHeight,
  };
}

export function inverseScaledTranslation({
  currentRect,
  target,
  renderedScale,
}: {
  currentRect: OverlayRectEdges;
  target: { left: number; top: number };
  renderedScale: { x: number; y: number };
}): { x: number; y: number } {
  const scaleX = renderedScale.x > 0 && Number.isFinite(renderedScale.x) ? renderedScale.x : 1;
  const scaleY = renderedScale.y > 0 && Number.isFinite(renderedScale.y) ? renderedScale.y : 1;
  return {
    x: (finite(target.left) - finite(currentRect.left)) / scaleX,
    y: (finite(target.top) - finite(currentRect.top)) / scaleY,
  };
}
